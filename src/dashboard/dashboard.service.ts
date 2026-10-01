import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { Medicine } from '../inventory/entities/medicine.entity';
import { Sale } from '../sales/entities/sale.entity';
import { DAY_MS, daysUntil, startOfDayUtc } from '../shared/dates';

type Bucket = { date: string; revenue: number; orders: number };

/**
 * Read-only aggregation over recorded sales and current stock.
 *
 * Every figure is computed in SQL rather than in JavaScript so the dashboard
 * cost stays flat as the sales table grows.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicines: Repository<Medicine>,
    @InjectRepository(Sale)
    private readonly sales: Repository<Sale>,
  ) {}

  async getSummary(query: DashboardQueryDto) {
    const now = new Date();
    const todayStart = startOfDayUtc(now);
    // UTC month boundary, matching the UTC day bucketing below, so a sale at
    // 23:30 UTC on the last day of the month is never split across two tiles.
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const trendStart = new Date(todayStart.getTime() - (query.trendDays - 1) * DAY_MS);

    const [today, weekly, monthly, totalRevenue, stock, salesSinceTrend] =
      await Promise.all([
        this.revenueBetween(todayStart, now),
        this.revenueBetween(new Date(todayStart.getTime() - 6 * DAY_MS), now),
        this.revenueBetween(monthStart, now),
        this.sales
          .createQueryBuilder('s')
          .select('COALESCE(SUM(s.total_amount), 0)', 'revenue')
          .addSelect('COUNT(s.id)', 'orders')
          .getRawOne<{ revenue: string; orders: string }>(),
        this.medicines
          .createQueryBuilder('m')
          .select('COALESCE(SUM(m.quantity_in_stock), 0)', 'units')
          .addSelect('COALESCE(SUM(m.quantity_in_stock * m.unit_price), 0)', 'value')
          .addSelect('COUNT(m.id)', 'products')
          .where('m.is_active = true')
          .getRawOne<{ units: string; products: string; value: string }>(),
        this.buckets(trendStart, query.trendDays),
      ]);

    const expiringSoon = await this.expiringSoon(query.expiryDays);
    const lowStock = await this.lowStock();

    return {
      todaySales: today.revenue,
      todayOrders: today.orders,
      weeklySales: weekly.revenue,
      weeklyOrders: weekly.orders,
      monthlySales: monthly.revenue,
      monthlyOrders: monthly.orders,
      totalRevenue: Number(totalRevenue?.revenue ?? 0),
      totalOrders: Number(totalRevenue?.orders ?? 0),
      totalMedicinesInStock: Number(stock?.units ?? 0),
      totalDistinctMedicines: Number(stock?.products ?? 0),
      inventoryValue: Number(stock?.value ?? 0),
      expiringSoonCount: expiringSoon.length,
      lowStockCount: lowStock.length,
      expiringSoon,
      lowStock,
      trend: salesSinceTrend,
      generatedAt: now.toISOString(),
    };
  }

  private async revenueBetween(from: Date, to: Date) {
    const row = await this.sales
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.total_amount), 0)', 'revenue')
      .addSelect('COUNT(s.id)', 'orders')
      .where('s.sold_at >= :from AND s.sold_at <= :to', { from, to })
      .getRawOne<{ revenue: string; orders: string }>();

    return {
      revenue: Number(row?.revenue ?? 0),
      orders: Number(row?.orders ?? 0),
    };
  }

  /** Daily revenue for the trend chart, including days with no sales. */
  private async buckets(from: Date, days: number): Promise<Bucket[]> {
    const rows = await this.sales
      .createQueryBuilder('s')
      .select("TO_CHAR(s.sold_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')", 'date')
      .addSelect('COALESCE(SUM(s.total_amount), 0)', 'revenue')
      .addSelect('COUNT(s.id)', 'orders')
      .where('s.sold_at >= :from', { from })
      .groupBy("TO_CHAR(s.sold_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')")
      .getRawMany<{ date: string; revenue: string; orders: string }>();

    const byDate = new Map(rows.map((r) => [r.date, r]));

    return Array.from({ length: days }, (_, index) => {
      const day = new Date(from.getTime() + index * DAY_MS);
      const key = day.toISOString().slice(0, 10);
      const match = byDate.get(key);
      return {
        date: key,
        revenue: Number(match?.revenue ?? 0),
        orders: Number(match?.orders ?? 0),
      };
    });
  }

  private async expiringSoon(withinDays: number) {
    const today = startOfDayUtc(new Date());
    const rows = await this.medicines
      .createQueryBuilder('m')
      .where('m.is_active = true')
      .andWhere('m.expiration_date IS NOT NULL')
      .andWhere('m.expiration_date <= :limit', {
        limit: new Date(today.getTime() + withinDays * DAY_MS),
      })
      .andWhere('m.expiration_date >= :today', { today })
      .andWhere('m.quantity_in_stock > 0')
      .orderBy('m.expiration_date', 'ASC')
      .getMany();

    return rows.map((m) => ({
      id: m.id,
      name: m.name,
      batchNumber: m.batchNumber,
      expirationDate: m.expirationDate,
      quantityInStock: m.quantityInStock,
      daysRemaining: daysUntil(m.expirationDate) ?? 0,
    }));
  }

  private async lowStock() {
    const rows = await this.medicines
      .createQueryBuilder('m')
      .where('m.is_active = true')
      .andWhere('m.quantity_in_stock <= m.min_stock_level')
      .orderBy('m.quantity_in_stock', 'ASC')
      .getMany();

    return rows.map((m) => ({
      id: m.id,
      name: m.name,
      quantityInStock: m.quantityInStock,
      minStockLevel: m.minStockLevel,
      unitPrice: m.unitPrice,
    }));
  }
}