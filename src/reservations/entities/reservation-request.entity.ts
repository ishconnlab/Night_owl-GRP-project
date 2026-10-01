import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ReservationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Collected = 'collected',
}

/**
 * A customer's request for the pharmacy to hold a product.
 *
 * Stock is only deducted when staff accept the request, so a pending request
 * never blocks a sale. The medicine name is copied rather than joined so the
 * record still reads correctly after the catalogue line is renamed or retired.
 */
@Entity({ name: 'reservation_requests' })
export class ReservationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12, unique: true })
  reference: string;

  /** References medicines.id. Kept as a plain uuid with no foreign key so the
   * reservations table can be created independently of the inventory schema. */
  @Column({ name: 'medicine_id', type: 'uuid' })
  medicineId: string;

  @Column({ name: 'medicine_name', type: 'varchar', length: 255 })
  medicineName: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'customer_name', type: 'varchar', length: 120 })
  customerName: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 30 })
  customerPhone: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 180, nullable: true })
  customerEmail: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({
    // A varchar + CHECK in the database, not a Postgres enum: adding a status
    // later is an ALTER instead of a type rewrite.
    type: 'varchar',
    length: 20,
    default: ReservationStatus.Pending,
  })
  status: ReservationStatus;

  /** Staff member who accepted, rejected or collected it. */
  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}