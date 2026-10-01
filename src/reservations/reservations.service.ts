import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  ReservationRequest,
  ReservationStatus,
} from './entities/reservation-request.entity';
import { Medicine } from '../inventory/entities/medicine.entity';

/** The states a reservation moves through, in the order staff work them. */
export const RESERVATION_STATUSES = [
  ReservationStatus.Pending,
  ReservationStatus.Accepted,
  ReservationStatus.Collected,
  ReservationStatus.Rejected,
] as const;

export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

/**
 * Reservations, from both sides.
 *
 * Customers submit a request without an account; staff work the resulting queue.
 * A *pending* request promises nothing — it only records interest. Stock is held
 * when a request is accepted, which is why accepting re-checks availability
 * under a row lock instead of trusting the number shown on screen.
 */
@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationRequest)
    private readonly reservations: Repository<ReservationRequest>,
    @InjectRepository(Medicine)
    private readonly medicines: Repository<Medicine>,
  ) {}

  // ---------------------------------------------------------------------------
  // Customer side
  // ---------------------------------------------------------------------------

  async createReservation(dto: CreateReservationDto) {
    const medicine = await this.medicines.findOneBy({ id: dto.medicineId });

    if (!medicine || !medicine.isActive) {
      throw new NotFoundException('This medicine is not available.');
    }

    if (medicine.quantityInStock < dto.quantity) {
      throw new BadRequestException(
        `Only ${medicine.quantityInStock} unit(s) left in stock. Please lower the quantity.`,
      );
    }

    const saved = await this.reservations.save(
      this.reservations.create({
        reference: this.generateReference(),
        medicineId: medicine.id,
        // Name is copied, not joined, so the request still reads correctly after
        // the catalogue line is renamed or retired.
        medicineName: medicine.name,
        quantity: dto.quantity,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail?.trim() ?? null,
        note: dto.note?.trim() ?? null,
        status: ReservationStatus.Pending,
      }),
    );

    return {
      reference: saved.reference,
      medicineName: saved.medicineName,
      quantity: saved.quantity,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  /** Lets a customer follow up using the reference they were given. */
  async getByReference(reference: string) {
    const reservation = await this.reservations.findOneBy({
      reference: reference.trim().toUpperCase(),
    });

    if (!reservation) {
      throw new NotFoundException('No reservation matches that reference.');
    }

    return {
      reference: reservation.reference,
      medicineName: reservation.medicineName,
      quantity: reservation.quantity,
      status: reservation.status,
      customerName: reservation.customerName,
      createdAt: reservation.createdAt,
      decidedAt: reservation.decidedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Staff side: the queue the pharmacy works through
  // ---------------------------------------------------------------------------

  async list(query: {
    status: string;
    view: string;
    page: number;
    limit: number;
  }) {
    const builder = this.reservations
      .createQueryBuilder('r')
      .orderBy('r.created_at', 'DESC');

    if (query.status !== 'all') {
      builder.andWhere('r.status = :status', { status: query.status });
    } else if (query.view === 'open') {
      builder.andWhere('r.status IN (:...open)', {
        open: [ReservationStatus.Pending, ReservationStatus.Accepted],
      });
    } else if (query.view === 'closed') {
      builder.andWhere('r.status IN (:...closed)', {
        closed: [ReservationStatus.Rejected, ReservationStatus.Collected],
      });
    }

    builder.skip((query.page - 1) * query.limit).take(query.limit);

    const [items, total] = await builder.getManyAndCount();

    return {
      items: items.map((reservation) => this.toView(reservation)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  /** Badge counts for the staff navigation. */
  async counts() {
    const rows = await this.reservations
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status')
      .getRawMany<{ status: string; count: string }>();

    const counts: Record<ReservationStatus, number> = {
      [ReservationStatus.Pending]: 0,
      [ReservationStatus.Accepted]: 0,
      [ReservationStatus.Rejected]: 0,
      [ReservationStatus.Collected]: 0,
    };

    let total = 0;
    for (const row of rows) {
      const count = Number(row.count);
      if (row.status in counts) {
        counts[row.status as ReservationStatus] = count;
      }
      total += count;
    }

    return { counts, total, needsAttention: counts[ReservationStatus.Pending] };
  }

  /**
   * Moves a request through pending -> accepted -> collected, or rejects it.
   *
   * Accepting is the point where stock is held: the batch is decremented under a
   * pessimistic lock so two members of staff accepting the last unit at the same
   * moment cannot both succeed. Rejecting or reopening returns the units.
   */
  async updateStatus(
    id: string,
    status: ReservationStatusValue,
    staffId: string | null,
  ) {
    const reservation = await this.reservations.findOneBy({ id });

    if (!reservation) {
      return null;
    }

    const holdsStock = (value: string) =>
      value === ReservationStatus.Accepted ||
      value === ReservationStatus.Collected;

    const wasHoldingStock = holdsStock(reservation.status);
    const willHoldStock = holdsStock(status);

    if (willHoldStock && !wasHoldingStock) {
      await this.holdStock(reservation);
    } else if (wasHoldingStock && !willHoldStock) {
      await this.releaseStock(reservation);
    }

    reservation.status = status;
    reservation.decidedAt = new Date();
    reservation.decidedBy = staffId;

    return this.toView(await this.reservations.save(reservation));
  }

  private async holdStock(reservation: ReservationRequest) {
    await this.medicines.manager.transaction(async (manager) => {
      const medicine = await manager
        .createQueryBuilder(Medicine, 'm')
        .setLock('pessimistic_write')
        .where('m.id = :id', { id: reservation.medicineId })
        .getOne();

      if (!medicine) {
        throw new NotFoundException(
          'The medicine for this reservation no longer exists.',
        );
      }

      if (medicine.quantityInStock < reservation.quantity) {
        throw new BadRequestException(
          `Cannot accept: only ${medicine.quantityInStock} unit(s) left, this request needs ${reservation.quantity}.`,
        );
      }

      medicine.quantityInStock -= reservation.quantity;
      await manager.save(Medicine, medicine);
    });
  }

  private async releaseStock(reservation: ReservationRequest) {
    await this.medicines.increment(
      { id: reservation.medicineId },
      'quantityInStock',
      reservation.quantity,
    );
  }

  private toView(reservation: ReservationRequest) {
    return {
      id: reservation.id,
      reference: reservation.reference,
      medicineId: reservation.medicineId,
      medicineName: reservation.medicineName,
      quantity: reservation.quantity,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      note: reservation.note,
      status: reservation.status,
      createdAt: reservation.createdAt,
      decidedAt: reservation.decidedAt,
    };
  }

  private generateReference() {
    return `RES-${Date.now().toString(36).toUpperCase()}`;
  }
}
