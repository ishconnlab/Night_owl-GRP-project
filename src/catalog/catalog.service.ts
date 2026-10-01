import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from '../inventory/entities/medicine.entity';
import { CatalogQueryDto } from './dto/catalog-query.dto';

export type Availability = 'in_stock' | 'out_of_stock';

/**
 * The public product catalogue.
 *
 * Read-only and unauthenticated: it exposes name, price and whether a line is
 * in stock. Batch numbers, expiry dates and cost are deliberately withheld —
 * only staff see those.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicines: Repository<Medicine>,
    private readonly config: ConfigService,
  ) {}

  async listMedicines(query: CatalogQueryDto) {
    const builder = this.medicines
      .createQueryBuilder('m')
      .where('m.is_active = true');

    if (query.search?.trim()) {
      builder.andWhere('m.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.availability === 'in_stock') {
      builder.andWhere('m.quantity_in_stock > 0');
    } else if (query.availability === 'out_of_stock') {
      builder.andWhere('m.quantity_in_stock <= 0');
    }

    // Whitelisted rather than interpolated: `sort` is a raw string from the
    // query and must never reach the SQL text unchecked.
    const [column, direction] = query.sort.split('_');
    const sortColumn = column === 'price' ? 'm.unit_price' : 'm.name';
    const sortDirection = direction.toUpperCase() as 'ASC' | 'DESC';

    builder
      .orderBy(sortColumn, sortDirection)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [items, total] = await builder.getManyAndCount();

    return {
      items: items.map((medicine) => this.toCatalogItem(medicine)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getMedicine(id: string) {
    const medicine = await this.medicines
      .createQueryBuilder('m')
      .where('m.id = :id', { id })
      .andWhere('m.is_active = true')
      .getOne();

    if (!medicine) {
      throw new NotFoundException('This medicine is not available.');
    }

    return {
      ...this.toCatalogItem(medicine),
      // Stock that will still be usable when the customer collects.
      batchNumber: medicine.batchNumber,
      expirationDate: medicine.expirationDate,
    };
  }

  getPharmacy() {
    return {
      name: this.config.get<string>('PHARMACY_NAME', 'Night Owl Pharmacy'),
      address: this.config.get<string>('PHARMACY_ADDRESS', ''),
      phone: this.config.get<string>('PHARMACY_PHONE', ''),
      email: this.config.get<string>('PHARMACY_EMAIL', ''),
      openingHours: this.config.get<string>('PHARMACY_HOURS', ''),
    };
  }

  private toCatalogItem(medicine: Medicine) {
    const availability: Availability =
      medicine.quantityInStock > 0 ? 'in_stock' : 'out_of_stock';

    return {
      id: medicine.id,
      name: medicine.name,
      unitPrice: medicine.unitPrice,
      availability,
      unitsAvailable:
        availability === 'in_stock' ? medicine.quantityInStock : 0,
    };
  }
}
