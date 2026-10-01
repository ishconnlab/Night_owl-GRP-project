import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { daysUntil } from '../shared/dates';
import {
  AdjustStockDto,
  CreateMedicineDto,
  UpdateMedicineDto,
} from './dto/medicine.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { Medicine } from './entities/medicine.entity';

/**
 * Task 1 — medicine inventory.
 *
 * Staff-facing CRUD over the catalogue. Stock is never set directly after a
 * medicine is created: `quantityInStock` is only changed through recordSale()
 * (Task 2) or adjustStock(), so every movement has a reason behind it.
 */
@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicines: Repository<Medicine>,
  ) {}

  async list(query: InventoryQueryDto) {
    const builder = this.medicines
      .createQueryBuilder('m')
      .where('m.is_active = true');

    if (query.search?.trim()) {
      builder.andWhere('m.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    switch (query.status) {
      case 'in_stock':
        builder.andWhere('m.quantity_in_stock > 0');
        break;
      case 'out_of_stock':
        builder.andWhere('m.quantity_in_stock <= 0');
        break;
      case 'low_stock':
        builder.andWhere('m.quantity_in_stock <= m.min_stock_level');
        break;
    }

    if (query.expiringWithin === 'expired') {
      builder.andWhere('m.expiration_date IS NOT NULL');
      builder.andWhere('m.expiration_date < CURRENT_DATE');
    } else if (query.expiringWithin !== 'all') {
      const days = Number(query.expiringWithin);
      builder.andWhere('m.expiration_date IS NOT NULL');
      builder.andWhere(
        'm.expiration_date >= CURRENT_DATE AND m.expiration_date <= CURRENT_DATE + (:days || \' days\')::interval',
        { days },
      );
    }

    const [column, direction] = query.sort.split('_');
    const sortable: Record<string, string> = {
      name: 'm.name',
      price: 'm.unit_price',
      stock: 'm.quantity_in_stock',
      expiry: 'm.expiration_date',
    };
    const sortColumn = sortable[column] ?? 'm.name';
    const sortDirection = direction.toUpperCase() as 'ASC' | 'DESC';

    builder
      .orderBy(sortColumn, sortDirection)
      .addOrderBy('m.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [items, total] = await builder.getManyAndCount();

    return {
      items: items.map((m) => this.toView(m)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  /** Same list, unpaginated — powers the "add to basket" picker on the sale screen. */
  async listForSalePicker() {
    const items = await this.medicines
      .createQueryBuilder('m')
      .where('m.is_active = true')
      .orderBy('m.name', 'ASC')
      .getMany();

    return items.map((m) => ({
      id: m.id,
      name: m.name,
      unitPrice: m.unitPrice,
      quantityInStock: m.quantityInStock,
      stockStatus: this.stockStatus(m),
    }));
  }

  async findOne(id: string) {
    const medicine = await this.medicines.findOneBy({ id, isActive: true });

    if (!medicine) {
      throw new NotFoundException('Medicine not found.');
    }

    return this.toView(medicine);
  }

  async create(dto: CreateMedicineDto) {
    const medicine = this.medicines.create({
      name: dto.name.trim(),
      quantityInStock: dto.quantityInStock,
      unitPrice: dto.unitPrice,
      expirationDate: dto.expirationDate?.trim() || null,
      batchNumber: dto.batchNumber?.trim() || null,
      supplierId: dto.supplierId ?? null,
      supplierName: dto.supplierName?.trim() || null,
      minStockLevel: dto.minStockLevel,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.medicines.save(medicine);
    return this.toView(saved);
  }

  async update(id: string, dto: UpdateMedicineDto) {
    const medicine = await this.medicines.findOneBy({ id });

    if (!medicine) {
      throw new NotFoundException('Medicine not found.');
    }

    if (dto.name !== undefined) medicine.name = dto.name.trim();
    if (dto.unitPrice !== undefined) medicine.unitPrice = dto.unitPrice;
    if (dto.expirationDate !== undefined)
      medicine.expirationDate = dto.expirationDate.trim() || null;
    if (dto.batchNumber !== undefined)
      medicine.batchNumber = dto.batchNumber.trim() || null;
    if (dto.supplierId !== undefined) medicine.supplierId = dto.supplierId;
    if (dto.supplierName !== undefined)
      medicine.supplierName = dto.supplierName.trim() || null;
    if (dto.minStockLevel !== undefined)
      medicine.minStockLevel = dto.minStockLevel;
    if (dto.isActive !== undefined) medicine.isActive = dto.isActive;

    const saved = await this.medicines.save(medicine);
    return this.toView(saved);
  }

  /**
   * Retires a medicine instead of deleting it, so past receipts keep resolving.
   * The row disappears from the catalogue and the dashboard immediately.
   */
  async archive(id: string) {
    const medicine = await this.medicines.findOneBy({ id });

    if (!medicine) {
      throw new NotFoundException('Medicine not found.');
    }

    if (!medicine.isActive) {
      return { id, isActive: false, alreadyArchived: true };
    }

    medicine.isActive = false;
    await this.medicines.save(medicine);
    return { id, isActive: false, alreadyArchived: false };
  }

  /**
   * Applies a signed stock change from a delivery, a correction or a write-off.
   * Refuses to drive the quantity negative, which is what a sale is for.
   */
  async adjustStock(id: string, dto: AdjustStockDto) {
    const medicine = await this.medicines.findOneBy({ id });

    if (!medicine) {
      throw new NotFoundException('Medicine not found.');
    }

    const next = medicine.quantityInStock + dto.quantityChange;

    if (next < 0) {
      throw new BadRequestException(
        `Cannot remove ${Math.abs(dto.quantityChange)} unit(s): only ${medicine.quantityInStock} in stock.`,
      );
    }

    medicine.quantityInStock = next;
    const saved = await this.medicines.save(medicine);

    return {
      ...this.toView(saved),
      previousQuantity: next - dto.quantityChange,
      quantityChange: dto.quantityChange,
    };
  }

  private stockStatus(medicine: Medicine) {
    if (medicine.quantityInStock <= 0) return 'out_of_stock';
    if (medicine.quantityInStock <= medicine.minStockLevel) return 'low_stock';
    return 'in_stock';
  }

  /** Single response shape for the staff UI, with the derived fields it needs. */
  private toView(medicine: Medicine) {
    return {
      id: medicine.id,
      name: medicine.name,
      quantityInStock: medicine.quantityInStock,
      unitPrice: medicine.unitPrice,
      expirationDate: medicine.expirationDate,
      batchNumber: medicine.batchNumber,
      supplierId: medicine.supplierId,
      supplierName: medicine.supplierName,
      minStockLevel: medicine.minStockLevel,
      isActive: medicine.isActive,
      stockStatus: this.stockStatus(medicine),
      stockValue: Number((medicine.unitPrice * medicine.quantityInStock).toFixed(2)),
      daysToExpiry: daysUntil(medicine.expirationDate),
      createdAt: medicine.createdAt,
      updatedAt: medicine.updatedAt,
    };
  }
}
