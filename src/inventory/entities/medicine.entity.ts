import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A product in the pharmacy catalogue.
 *
 * One row per batch: two batches of the same medicine are tracked separately so
 * each keeps its own expiration date and batch number, which is what the
 * expiration alerts (Task 3) key off.
 */
@Entity({ name: 'medicines' })
@Index('idx_medicines_is_active', ['isActive'])
@Index('idx_medicines_name_lower', { synchronize: false })
export class Medicine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'quantity_in_stock', type: 'int', default: 0 })
  quantityInStock: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  unitPrice: number;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: string | null;

  @Column({ name: 'batch_number', type: 'varchar', length: 64, nullable: true })
  batchNumber: string | null;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @Column({ name: 'supplier_name', type: 'varchar', length: 255, nullable: true })
  supplierName: string | null;

  /** Reorder level. Stock at or below this raises a low-stock alert (Task 4). */
  @Column({ name: 'min_stock_level', type: 'int', default: 0 })
  minStockLevel: number;

  /** Soft delete: retired lines stay in the table for sale history. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
