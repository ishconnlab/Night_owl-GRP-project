import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
// Type-only, for the same reason as sale.entity.ts: a runtime import here forms a
// Sale <-> SaleItem cycle. TypeORM resolves the string target by entity name.
import type { Sale } from './sale.entity';

/**
 * One line of a sale.
 *
 * Name and unit price are snapshotted rather than joined at read time, so a
 * receipt still shows what the customer actually paid after the catalogue is
 * repriced. `medicine_id` is nullable because a medicine can be removed while
 * its sales history is kept.
 */
@Entity({ name: 'sale_items' })
@Index('idx_sale_items_sale_id', ['saleId'])
@Index('idx_sale_items_medicine_id', ['medicineId'])
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sale_id', type: 'uuid' })
  saleId: string;

  @Column({ name: 'medicine_id', type: 'uuid', nullable: true })
  medicineId: string | null;

  @Column({ name: 'medicine_name', type: 'varchar', length: 255 })
  medicineName: string;

  @Column({ type: 'int' })
  quantity: number;

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

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  lineTotal: number;

  @ManyToOne('Sale', (sale: Sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;
}
