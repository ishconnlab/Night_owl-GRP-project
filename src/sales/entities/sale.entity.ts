import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
// Type-only, and the relation names its target as a string: a Sale -> SaleItem ->
// Sale runtime cycle deadlocks under native ESM (decorator metadata reads the
// class while it is still initialising).
import type { SaleItem } from './sale-item.entity';

/** Order header: when a sale happened, for how much, and who rang it up. */
@Entity({ name: 'sales' })
@Index('idx_sales_sold_at', ['soldAt'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-facing receipt number, e.g. `S-8F3K2QD`. */
  @Column({ type: 'varchar', length: 20, unique: true })
  reference: string;

  @Column({ name: 'sold_at', type: 'timestamptz' })
  soldAt: Date;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  totalAmount: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @OneToMany('SaleItem', (item: SaleItem) => item.sale)
  items: SaleItem[];
}
