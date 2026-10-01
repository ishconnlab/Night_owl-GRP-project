import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { daysUntil } from '../shared/dates';
import { Medicine } from '../inventory/entities/medicine.entity';
import { AlertQueryDto } from './dto/alert-query.dto';
import {
  AlertKind,
  EXPIRATION_THRESHOLDS,
  severityForDays,
  StockAlert,
} from './entities/stock-alert.entity';

interface PendingAlert {
  kind: AlertKind;
  medicineId: string;
  severity: 'info' | 'warning' | 'critical';
  thresholdDays: number;
  daysRemaining: number | null;
  message: string;
}

/**
 * Tasks 3 & 4 — expiration and low-stock notifications.
 *
 * A scan compares every active batch against the rules the brief asks for and
 * records what it finds. Alerts are keyed on (kind, medicine, threshold) so a
 * batch crossing 30, 14, 7 and 1 day boundaries gets one alert per boundary
 * rather than a fresh row on every run, and a batch that is restocked or
 * replaced has its alert closed instead of deleted.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(StockAlert)
    private readonly alerts: Repository<StockAlert>,
    @InjectRepository(Medicine)
    private readonly medicines: Repository<Medicine>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Evaluates every active batch and reconciles the alert table with the result.
   * Returns the same summary the staff badge reads, so callers can show the
   * effect of a manual scan immediately.
   */
  async scan() {
    const medicines = await this.medicines
      .createQueryBuilder('m')
      .where('m.is_active = true')
      .getMany();

    const pending: PendingAlert[] = [];

    for (const medicine of medicines) {
      const remaining = daysUntil(medicine.expirationDate);

      if (remaining === null) continue;

      // Task 3: one alert per boundary the batch has already crossed. A batch
      // 5 days out has passed 30, 14 and 7 — staff should see all three, most
      // urgent first.
      if (remaining <= 30) {
        for (const threshold of EXPIRATION_THRESHOLDS) {
          if (remaining > threshold) continue;

          pending.push({
            kind: 'expiring',
            medicineId: medicine.id,
            severity: severityForDays(remaining),
            thresholdDays: threshold,
            daysRemaining: remaining,
            message: this.expirationMessage(medicine, remaining, threshold),
          });
        }
      }

      // Task 4: at or below the reorder level, including fully out of stock.
      if (medicine.quantityInStock <= medicine.minStockLevel) {
        pending.push({
          kind: 'low_stock',
          medicineId: medicine.id,
          severity: medicine.quantityInStock <= 0 ? 'critical' : 'warning',
          thresholdDays: medicine.minStockLevel,
          daysRemaining: null,
          message: this.lowStockMessage(medicine),
        });
      }
    }

    await this.upsert(pending);
    await this.resolveStale(pending);

    return this.summary();
  }

  async list(query: AlertQueryDto) {
    const builder = this.alerts
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.medicine', 'm')
      .orderBy(
        `CASE "a"."severity" WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`,
        'ASC',
      )
      .addOrderBy('a.created_at', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.status !== 'all') {
      builder.andWhere('a.status = :status', { status: query.status });
    }
    if (query.kind !== 'all') {
      builder.andWhere('a.kind = :kind', { kind: query.kind });
    }

    const [items, total] = await builder.getManyAndCount();

    return {
      items: items.map((alert) => this.toView(alert)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  /** Counts for the nav badge and the dashboard tiles. */
  async summary() {
    const raw = (await this.alerts
      .createQueryBuilder('a')
      .select('a.kind', 'kind')
      .addSelect('a.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('a.status IN (:...statuses)', { statuses: ['open', 'acknowledged'] })
      .groupBy('a.kind')
      .addGroupBy('a.severity')
      .getRawMany<{ kind: string; severity: string; count: string }>()) ?? [];

    const totals = { open: 0, critical: 0, expiring: 0, lowStock: 0 };

    for (const row of raw) {
      const count = Number(row.count);
      totals.open += count;
      if (row.severity === 'critical') totals.critical += count;
      if (row.kind === 'expiring') totals.expiring += count;
      if (row.kind === 'low_stock') totals.lowStock += count;
    }

    const lastRun = await this.lastRunAt();
    return { ...totals, lastRunAt: lastRun, nextRunInMinutes: this.intervalMinutes };
  }

  async acknowledge(id: string, staffId: string | null) {
    const alert = await this.alerts.findOneBy({ id });

    if (!alert) {
      return null;
    }

    if (alert.status === 'open') {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = staffId;
      await this.alerts.save(alert);
    }

    return this.toView(alert);
  }

  /** Closes an alert the moment the underlying problem is handled. */
  async resolve(id: string) {
    const alert = await this.alerts.findOneBy({ id });

    if (!alert) {
      return null;
    }

    if (alert.status !== 'resolved') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      await this.alerts.save(alert);
    }

    return this.toView(alert);
  }

  /** Re-evaluates immediately; the staff Alerts screen uses this after a change. */
  async refresh() {
    return this.scan();
  }

  get intervalMinutes() {
    const configured = Number(
      this.config.get<string>('ALERT_SCAN_INTERVAL_MINUTES', '60'),
    );
    return Number.isFinite(configured) && configured > 0 ? configured : 60;
  }

  private async upsert(pending: PendingAlert[]) {
    if (pending.length === 0) {
      return;
    }

    await this.alerts
      .createQueryBuilder()
      .insert()
      .into(StockAlert)
      .values(
        pending.map((alert) => ({
          kind: alert.kind,
          medicineId: alert.medicineId,
          severity: alert.severity,
          thresholdDays: alert.thresholdDays,
          daysRemaining: alert.daysRemaining,
          message: alert.message.slice(0, 255),
          status: 'open',
        })),
      )
      .orUpdate(
        [
          'severity',
          'days_remaining',
          'message',
          'status',
          'acknowledged_at',
          'updated_at',
        ],
        ['kind', 'medicine_id', 'threshold_days'],
      )
      .execute()
      .catch((error: unknown) => {
        this.logger.error('Alert upsert failed', error as Error);
        throw error;
      });
  }

  /**
   * Closes alerts whose trigger is gone: a batch restocked above its reorder
   * level, or a low-stock line that has since been replenished.
   */
  private async resolveStale(pending: PendingAlert[]) {
    if (pending.length === 0) {
      await this.alerts.query(
        `UPDATE stock_alerts
            SET status = 'resolved', resolved_at = now(), updated_at = now()
          WHERE status <> 'resolved'`,
      );
      return;
    }

    const keys = pending.map(
      (alert) =>
        `${alert.kind}:${alert.medicineId}:${alert.thresholdDays}`,
    );

    await this.alerts.query(
      `UPDATE stock_alerts
          SET status = 'resolved', resolved_at = now(), updated_at = now()
        WHERE status <> 'resolved'
          AND (kind || ':' || medicine_id::text || ':' || COALESCE(threshold_days, 0))
              <> ALL($1::text[])`,
      [keys],
    );
  }

  private async lastRunAt(): Promise<string | null> {
    const row = await this.alerts.query(
      `SELECT max(updated_at) AS last_run FROM stock_alerts`,
    );
    const value = row?.[0]?.last_run;
    return value instanceof Date ? value.toISOString() : (value ?? null);
  }

  private expirationMessage(
    medicine: Medicine,
    daysRemaining: number,
    threshold: number,
  ): string {
    const batch = medicine.batchNumber ? ` (batch ${medicine.batchNumber})` : '';

    if (daysRemaining < 0) {
      return `${medicine.name}${batch} expired ${Math.abs(daysRemaining)} day(s) ago.`;
    }
    if (daysRemaining === 0) {
      return `${medicine.name}${batch} expires today.`;
    }
    return `${medicine.name}${batch} expires in ${daysRemaining} day(s) (${threshold}-day alert).`;
  }

  private lowStockMessage(medicine: Medicine): string {
    if (medicine.quantityInStock <= 0) {
      return `${medicine.name} is out of stock (minimum ${medicine.minStockLevel}).`;
    }
    return `${medicine.name} has only ${medicine.quantityInStock} left, at or below the minimum of ${medicine.minStockLevel}.`;
  }

  private toView(alert: StockAlert) {
    return {
      id: alert.id,
      kind: alert.kind,
      severity: alert.severity,
      status: alert.status,
      thresholdDays: alert.thresholdDays,
      daysRemaining: alert.daysRemaining,
      message: alert.message,
      medicine: alert.medicine
        ? {
            id: alert.medicine.id,
            name: alert.medicine.name,
            batchNumber: alert.medicine.batchNumber,
            quantityInStock: alert.medicine.quantityInStock,
            minStockLevel: alert.medicine.minStockLevel,
            unitPrice: alert.medicine.unitPrice,
            expirationDate: alert.medicine.expirationDate,
          }
        : null,
      createdAt: alert.createdAt,
      acknowledgedAt: alert.acknowledgedAt,
      resolvedAt: alert.resolvedAt,
    };
  }
}
