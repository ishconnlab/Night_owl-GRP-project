import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';

interface LockedMedicine {
  id: string;
  name: string;
  unit_price: string;
  quantity_in_stock: number;
  is_active: boolean;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly sales: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItems: Repository<SaleItem>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Task 2 — automatic sale recording.
   *
   * One transaction does all four things the brief asks for, or none of them:
   *   1. checks there is enough stock on every line,
   *   2. reduces the stock quantities,
   *   3. records the sale and its lines,
   * 4. calculates the money received (the order total).
   *
   * Stock rows are locked FOR UPDATE before they are read, so two tills selling
   * the last pack at the same moment cannot both succeed.
   */
  async recordSale(dto: CreateSaleDto, staffId: string | null) {
    const wanted = new Map<string, number>();
    for (const line of dto.items) {
      wanted.set(line.medicineId, (wanted.get(line.medicineId) ?? 0) + line.quantity);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const locked = await this.lockMedicines(queryRunner, [...wanted.keys()]);

      const lines: Array<{
        medicineId: string;
        medicineName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }> = [];

      for (const [medicineId, quantity] of wanted) {
        const medicine = locked.get(medicineId);

        if (!medicine || !medicine.is_active) {
          throw new NotFoundException(
            'One of the items is no longer in the catalogue. Refresh and try again.',
          );
        }

        if (medicine.quantity_in_stock < quantity) {
          throw new BadRequestException(
            `Not enough stock for ${medicine.name}: ${medicine.quantity_in_stock} available, ${quantity} requested.`,
          );
        }

        const unitPriceCents = toCents(medicine.unit_price);
        lines.push({
          medicineId,
          medicineName: medicine.name,
          quantity,
          unitPrice: fromCents(unitPriceCents),
          lineTotal: fromCents(unitPriceCents * quantity),
        });
      }

      const totalCents = lines.reduce(
        (sum, line) => sum + toCents(line.lineTotal),
        0,
      );

      const sale = queryRunner.manager.create(Sale, {
        reference: this.generateReference(),
        soldAt: new Date(),
        totalAmount: fromCents(totalCents),
        createdBy: staffId,
      });
      const savedSale = await queryRunner.manager.save(sale);

      await queryRunner.manager.insert(
        SaleItem,
        lines.map((line) => ({
          saleId: savedSale.id,
          medicineId: line.medicineId,
          medicineName: line.medicineName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        })),
      );

      // One statement so the decrement cannot race the check above.
      for (const line of lines) {
        await queryRunner.query(
          `UPDATE medicines
              SET quantity_in_stock = quantity_in_stock - $1,
                  updated_at = now()
            WHERE id = $2`,
          [line.quantity, line.medicineId],
        );
      }

      await queryRunner.commitTransaction();

      return {
        id: savedSale.id,
        reference: savedSale.reference,
        soldAt: savedSale.soldAt,
        totalAmount: savedSale.totalAmount,
        itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        lines,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Could not allocate a receipt number. Please try again.',
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async list(query: SalesQueryDto) {
    const builder = this.sales
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.items', 'i')
      .orderBy('s.sold_at', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.from && !Number.isNaN(Date.parse(query.from))) {
      builder.andWhere('s.sold_at >= :from', { from: new Date(query.from) });
    }
    if (query.to && !Number.isNaN(Date.parse(query.to))) {
      builder.andWhere('s.sold_at <= :to', { to: new Date(query.to) });
    }
    if (query.search?.trim()) {
      builder.andWhere(
        '(s.reference ILIKE :search OR EXISTS (SELECT 1 FROM sale_items x WHERE x.sale_id = s.id AND x.medicine_name ILIKE :search))',
        { search: `%${query.search.trim()}%` },
      );
    }

    const [sales, total] = await builder.getManyAndCount();

    return {
      items: sales.map((sale) => this.toView(sale)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async findOne(id: string) {
    const sale = await this.sales
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.items', 'i')
      .where('s.id = :id', { id })
      .getOne();

    if (!sale) {
      throw new NotFoundException('Sale not found.');
    }

    return this.toView(sale);
  }

  private async lockMedicines(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    ids: string[],
  ): Promise<Map<string, LockedMedicine>> {
    const rows = (await queryRunner.query(
      `SELECT id, name, unit_price, quantity_in_stock, is_active
         FROM medicines
        WHERE id = ANY($1::uuid[])
        FOR UPDATE`,
      [ids],
    )) as LockedMedicine[];

    return new Map(rows.map((row) => [row.id, row]));
  }

  private generateReference() {
    const stamp = Date.now().toString(36).toUpperCase().slice(-6);
    const random = randomBytes(2).toString('hex').toUpperCase();
    return `S-${stamp}${random}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  private toView(sale: Sale) {
    return {
      id: sale.id,
      reference: sale.reference,
      soldAt: sale.soldAt,
      totalAmount: sale.totalAmount,
      createdBy: sale.createdBy,
      itemCount: (sale.items ?? []).reduce((sum, i) => sum + i.quantity, 0),
      items: (sale.items ?? []).map((item) => ({
        id: item.id,
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    };
  }
}

/**
 * Money is handled in whole cents. NUMERIC arrives as a string and the brief's
 * totals are exact, so nothing is ever accumulated in binary floating point.
 */
function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}
