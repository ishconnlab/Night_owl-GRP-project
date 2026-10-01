import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  RESERVATION_STATUSES,
  ReservationsService,
} from './reservations.service';
import {
  ReservationRequest,
  ReservationStatus,
} from './entities/reservation-request.entity';
import type { Medicine } from '../inventory/entities/medicine.entity';

const MEDICINE_ID = '11111111-1111-4111-8111-111111111111';

function spy<A extends unknown[], R>(impl: (...args: A) => R) {
  const calls: A[] = [];
  const fn = (...args: A): R => {
    calls.push(args);
    return impl(...args);
  };
  return Object.assign(fn, { calls });
}

function makeMedicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: MEDICINE_ID,
    name: 'Panadol 500mg',
    quantityInStock: 10,
    unitPrice: 12.4,
    expirationDate: null,
    batchNumber: null,
    supplierId: null,
    supplierName: null,
    minStockLevel: 5,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as Medicine;
}

function makeReservation(
  overrides: Partial<ReservationRequest> = {},
): ReservationRequest {
  return {
    id: 'res-1',
    reference: 'RES-M1AB2C3',
    medicineId: MEDICINE_ID,
    medicineName: 'Panadol 500mg',
    quantity: 2,
    customerName: 'Ada Lovelace',
    customerPhone: '07000123456',
    customerEmail: null,
    note: null,
    status: ReservationStatus.Pending,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    ...overrides,
  } as ReservationRequest;
}

function makeMedicinesRepo(medicine: Medicine | null) {
  const builder = {
    setLock: spy(() => builder),
    where: spy(() => builder),
    getOne: spy(async () => medicine),
  };

  const transactionManager = {
    createQueryBuilder: spy(() => builder),
    save: spy((_entity: unknown, row: Medicine) => Promise.resolve(row)),
  };

  const medicines = {
    increment: spy(async () => ({ affected: 1 })),
    manager: {
      transaction: spy((cb: (m: typeof transactionManager) => Promise<void>) =>
        cb(transactionManager),
      ),
    },
    builder,
    transactionManager,
  };

  return medicines;
}

function makeService(
  reservation: ReservationRequest | null,
  medicine: Medicine | null,
) {
  const reservations = {
    findOneBy: spy(async () => reservation),
    create: spy((input: Partial<ReservationRequest>) => ({ ...input })),
    save: spy((reservation: ReservationRequest) => Promise.resolve(reservation)),
  };
  const medicines = makeMedicinesRepo(medicine);
  const service = new ReservationsService(reservations as never, medicines as never);

  return { service, reservations, medicines };
}

describe('RESERVATION_STATUSES', () => {
  it('lists the states in the order staff work them', () => {
    expect(RESERVATION_STATUSES).toEqual([
      'pending',
      'accepted',
      'collected',
      'rejected',
    ]);
  });
});

describe('ReservationsService.updateStatus', () => {
  it('returns null for an unknown id', async () => {
    const { service, reservations } = makeService(null, null);

    await expect(
      service.updateStatus('missing', ReservationStatus.Accepted, 'staff-1'),
    ).resolves.toBeNull();
    expect(reservations.save.calls).toHaveLength(0);
  });

  it('holds stock when a pending request is accepted', async () => {
    const medicine = makeMedicine({ quantityInStock: 10 });
    const { service, reservations, medicines } = makeService(
      makeReservation({ status: ReservationStatus.Pending, quantity: 2 }),
      medicine,
    );

    const result = await service.updateStatus(
      'res-1',
      ReservationStatus.Accepted,
      'staff-1',
    );

    expect(medicines.manager.transaction.calls).toHaveLength(1);
    expect(medicines.builder.setLock.calls[0][0]).toBe('pessimistic_write');
    expect(medicines.transactionManager.save.calls).toHaveLength(1);
    expect(medicine.quantityInStock).toBe(8);
    expect(medicines.increment.calls).toHaveLength(0);
    expect(reservations.save.calls).toHaveLength(1);
    expect(result?.status).toBe('accepted');
    expect(result?.decidedAt).toBeInstanceOf(Date);
  });

  it('rejects a hold it cannot satisfy', async () => {
    const medicine = makeMedicine({ quantityInStock: 1 });
    const { service, reservations, medicines } = makeService(
      makeReservation({ status: ReservationStatus.Pending, quantity: 5 }),
      medicine,
    );

    await expect(
      service.updateStatus('res-1', ReservationStatus.Accepted, 'staff-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(medicines.transactionManager.save.calls).toHaveLength(0);
    expect(medicines.increment.calls).toHaveLength(0);
    expect(reservations.save.calls).toHaveLength(0);
  });

  it('reports how many units were left when a hold cannot be satisfied', async () => {
    const { service } = makeService(
      makeReservation({ status: ReservationStatus.Pending, quantity: 5 }),
      makeMedicine({ quantityInStock: 1 }),
    );

    await expect(
      service.updateStatus('res-1', ReservationStatus.Accepted, null),
    ).rejects.toThrow(
      'Cannot accept: only 1 unit(s) left, this request needs 5.',
    );
  });

  it('reports a medicine that no longer exists', async () => {
    const { service } = makeService(
      makeReservation({ status: ReservationStatus.Pending }),
      null,
    );

    await expect(
      service.updateStatus('res-1', ReservationStatus.Accepted, null),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the units when an accepted request is rejected', async () => {
    const { service, medicines } = makeService(
      makeReservation({ status: ReservationStatus.Accepted, quantity: 2 }),
      makeMedicine(),
    );

    const result = await service.updateStatus(
      'res-1',
      ReservationStatus.Rejected,
      'staff-1',
    );

    expect(medicines.increment.calls[0]).toEqual([
      { id: MEDICINE_ID },
      'quantityInStock',
      2,
    ]);
    expect(medicines.manager.transaction.calls).toHaveLength(0);
    expect(result?.status).toBe('rejected');
  });

  it('returns the units when an accepted request is reopened', async () => {
    const { service, medicines } = makeService(
      makeReservation({ status: ReservationStatus.Accepted, quantity: 4 }),
      makeMedicine(),
    );

    await service.updateStatus('res-1', ReservationStatus.Pending, null);

    expect(medicines.increment.calls[0]).toEqual([
      { id: MEDICINE_ID },
      'quantityInStock',
      4,
    ]);
    expect(medicines.manager.transaction.calls).toHaveLength(0);
  });

  it('touches no stock when a collected request goes back to accepted', async () => {
    const { service, medicines } = makeService(
      makeReservation({ status: ReservationStatus.Collected, quantity: 3 }),
      makeMedicine(),
    );

    await service.updateStatus('res-1', ReservationStatus.Accepted, null);

    expect(medicines.increment.calls).toHaveLength(0);
    expect(medicines.manager.transaction.calls).toHaveLength(0);
  });

  it('touches no stock when a pending request is rejected', async () => {
    const { service, medicines } = makeService(
      makeReservation({ status: ReservationStatus.Pending, quantity: 2 }),
      makeMedicine(),
    );

    const result = await service.updateStatus(
      'res-1',
      ReservationStatus.Rejected,
      'staff-1',
    );

    expect(medicines.manager.transaction.calls).toHaveLength(0);
    expect(medicines.increment.calls).toHaveLength(0);
    expect(result?.status).toBe('rejected');
  });

  it('touches no stock when the status does not change', async () => {
    const { service, medicines } = makeService(
      makeReservation({ status: ReservationStatus.Pending, quantity: 2 }),
      makeMedicine(),
    );

    await service.updateStatus('res-1', ReservationStatus.Pending, null);

    expect(medicines.manager.transaction.calls).toHaveLength(0);
    expect(medicines.increment.calls).toHaveLength(0);
  });
});
