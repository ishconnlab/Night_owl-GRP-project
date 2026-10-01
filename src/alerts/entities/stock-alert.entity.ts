import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Medicine } from '../../inventory/entities/medicine.entity';

export type AlertKind = 'expiring' | 'low_stock';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

/** Boundaries staff asked to be warned at, in days before expiration. */
export const EXPIRATION_THRESHOLDS = [30, 14, 7, 1] as const;

export function severityForDays(daysRemaining: number): AlertSeverity {
  if (daysRemaining <= 7) return 'critical';
  if (daysRemaining <= 14) return 'warning';
  return 'info';
}

/**
 * A notification raised for a batch that is expiring soon (Task 3) or has hit
 * its reorder level (Task 4).
 *
 * The unique key on (kind, medicine_id, threshold_days) is what makes repeated
 * scans cheap: the scanner upserts instead of raising a new row every run, and
 * a medicine that recovers has its open alert closed rather than deleted, so
 * staff keep the history.
 */
@Entity({ name: 'stock_alerts' })
@Index('idx_stock_alerts_status', ['status', 'severity'])
@Index('idx_stock_alerts_kind', ['kind'])
export class StockAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  kind: AlertKind;

  @Column({ name: 'medicine_id', type: 'uuid' })
  medicineId: string;

  @Column({ type: 'varchar', length: 20 })
  severity: AlertSeverity;

  /** expiring: the 30/14/7/1 boundary crossed. low_stock: the reorder level hit. */
  @Column({ name: 'threshold_days', type: 'int', nullable: true })
  thresholdDays: number | null;

  @Column({ name: 'days_remaining', type: 'int', nullable: true })
  daysRemaining: number | null;

  @Column({ type: 'varchar', length: 255 })
  message: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: AlertStatus;

  @ManyToOne(() => Medicine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medicine_id' })
  medicine: Medicine;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
