import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { SalesService } from './sales.service';
import type { CreateSaleDto } from './dto/create-sale.dto';
import type { Sale } from './entities/sale.entity';
import type { SaleItem } from './entities/sale-item.entity';

const AMOXICILLIN = '11111111-1111-4111-8111-111111111101';
const PARACETAMOL = '11111111-1111-4111-8111-111111111102';

type LockedRow = {
  id: string;
  name: string;
  unit_price: string;
  quantity_in_stock: number;
  is_active: boolean;
};

function makeHarness(rows: LockedRow[]) {
  const created: unknown[] = [];
  const saved: Array<Record<string, unknown>> = [];
  const updates: Array<{ sql: string; params: unknown[] }> = [];

  const medicineQueryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => null),
  };

  const manager = {
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
      ...data,
      id: 'sale-id',
    })),
    save: jest.fn(async (entity: Record<string, unknown>) => {
      saved.push(entity);
      return { ...entity, id: 'sale-id' };
    }),
    insert: jest.fn(async (_entity: unknown, values: unknown[]) => {
      created.push(...values);
    }),
    createQueryBuilder: jest.fn(() => medicineQueryBuilder),
  };

  const queryRunner = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    manager,
    query: jest.fn(async (sql: string, params: unknown[]) => {
      // The FOR UPDATE select is recorded separately; `updates` is the stock
      // decrements the caller must be able to count.
      if (sql.startsWith('UPDATE medicines')) updates.push({ sql, params });
      return sql.includes('FOR UPDATE') ? rows : [];
    }),
  };

  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  } as unknown as DataSource;

  const saleItemsRepo = {} as Repository<SaleItem>;
  const service = new SalesService({} as Repository<Sale>, saleItemsRepo, dataSource);

  return { service, queryRunner, manager, updates, created, saved };
}

const dto = (items: Array<{ medicineId: string; quantity: number }>) =>
  ({ items }) as CreateSaleDto;

const stockRows: LockedRow[] = [
  {
    id: AMOXICILLIN,
    name: 'Amoxicillin 500mg capsules',
    unit_price: '12.40',
    quantity_in_stock: 240,
    is_active: true,
  },
  {
    id: PARACETAMOL,
    name: 'Paracetamol 500mg tablets',
    unit_price: '4.15',
    quantity_in_stock: 1800,
    is_active: true,
  },
];

describe('SalesService.recordSale', () => {
  it('totals the lines exactly, in cents', async () => {
    const { service } = makeHarness(stockRows);

    const sale = await service.recordSale(
      dto([
        { medicineId: AMOXICILLIN, quantity: 3 },
        { medicineId: PARACETAMOL, quantity: 2 },
      ]),
      'staff-id',
    );

    expect(sale.totalAmount).toBe(45.5);
    expect(sale.itemCount).toBe(5);
  });

  it('returns a unique receipt reference and stamps the seller', async () => {
    const { service, saved } = makeHarness(stockRows);

    const sale = await service.recordSale(
      dto([{ medicineId: AMOXICILLIN, quantity: 1 }]),
      'staff-id',
    );

    expect(sale.reference).toMatch(/^S-[0-9A-Z]{6,10}$/);
    expect(saved[0].createdBy).toBe('staff-id');
  });

  it('merges duplicate lines into a single line and a single decrement', async () => {
    const { service, created, updates } = makeHarness(stockRows);

    const sale = await service.recordSale(
      dto([
        { medicineId: AMOXICILLIN, quantity: 2 },
        { medicineId: AMOXICILLIN, quantity: 3 },
      ]),
      null,
    );

    expect(created).toHaveLength(1);
    expect(sale.lines).toHaveLength(1);
    expect(sale.lines[0]).toMatchObject({ quantity: 5, lineTotal: 62 });
    expect(sale.totalAmount).toBe(62);
    expect(updates).toHaveLength(1);
    expect(updates[0].params).toEqual([5, AMOXICILLIN]);
  });

  it('decrements stock once per line and then commits', async () => {
    const { service, queryRunner, updates } = makeHarness(stockRows);

    await service.recordSale(
      dto([
        { medicineId: AMOXICILLIN, quantity: 2 },
        { medicineId: PARACETAMOL, quantity: 5 },
      ]),
      null,
    );

    expect(updates).toHaveLength(2);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('locks the medicine rows before reading them', async () => {
    const { service, queryRunner } = makeHarness(stockRows);

    await service.recordSale(
      dto([{ medicineId: AMOXICILLIN, quantity: 1 }]),
      null,
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      [[AMOXICILLIN]],
    );
  });

  it('rejects a sale that would oversell, and rolls back', async () => {
    const scarce = [{ ...stockRows[0], quantity_in_stock: 2 }];
    const { service, queryRunner, created } = makeHarness(scarce);

    await expect(
      service.recordSale(
        dto([{ medicineId: AMOXICILLIN, quantity: 5 }]),
        null,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(0);
  });

  it('rejects a retired medicine', async () => {
    const retired = [{ ...stockRows[0], is_active: false }];
    const { service, queryRunner } = makeHarness(retired);

    await expect(
      service.recordSale(
        dto([{ medicineId: AMOXICILLIN, quantity: 1 }]),
        null,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a medicine that is no longer in the catalogue at all', async () => {
    const { service } = makeHarness([]);

    await expect(
      service.recordSale(
        dto([{ medicineId: AMOXICILLIN, quantity: 1 }]),
        null,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('turns a receipt-number collision into a retryable conflict', async () => {
    const { service, queryRunner } = makeHarness(stockRows);
    queryRunner.manager.save.mockImplementationOnce(async () => {
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    });

    await expect(
      service.recordSale(
        dto([{ medicineId: AMOXICILLIN, quantity: 1 }]),
        null,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('releases the query runner even when the sale fails', async () => {
    const { service, queryRunner } = makeHarness([]);

    await expect(
      service.recordSale(
        dto([{ medicineId: AMOXICILLIN, quantity: 1 }]),
        null,
      ),
    ).rejects.toThrow();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
