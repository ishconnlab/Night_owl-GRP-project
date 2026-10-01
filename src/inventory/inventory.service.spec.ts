import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Repository } from 'typeorm';
import { InventoryService } from './inventory.service';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { CreateMedicineDto } from './dto/medicine.dto';
import type { Medicine } from './entities/medicine.entity';

type FakeRepo = {
  create: jest.Mock;
  findOneBy: jest.Mock;
  save: jest.Mock;
};

function makeMedicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: '11111111-1111-4111-8111-111111111101',
    name: 'Amoxicillin 500mg capsules',
    quantityInStock: 240,
    unitPrice: 12.4,
    expirationDate: '2027-03-01',
    batchNumber: 'AMX-2401',
    supplierId: null,
    supplierName: 'Northgate Wholesale',
    minStockLevel: 40,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  } as Medicine;
}

function makeService(medicine?: Medicine | null) {
  const repo: FakeRepo = {
    create: jest.fn((dto) => ({ ...dto, id: 'new-id', isActive: true })),
    findOneBy: jest.fn().mockResolvedValue(medicine ?? null),
    save: jest.fn(async (entity) => entity),
  };

  return {
    repo,
    service: new InventoryService(repo as unknown as Repository<Medicine>),
  };
}

const query = (overrides: Partial<InventoryQueryDto> = {}): InventoryQueryDto =>
  ({
    status: 'all',
    expiringWithin: 'all',
    sort: 'name_asc',
    page: 1,
    limit: 20,
    ...overrides,
  }) as InventoryQueryDto;

describe('InventoryService.create', () => {
  it('trims the name before storing it', async () => {
    const { service, repo } = makeService();

    await service.create({ name: '  Ibuprofen 200mg  ' } as CreateMedicineDto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ibuprofen 200mg' }),
    );
  });

  it('normalises blank optional text to null', async () => {
    const { service, repo } = makeService();

    await service.create({
      name: 'Vitamin D3 1000IU',
      batchNumber: '   ',
      supplierName: '',
    } as unknown as CreateMedicineDto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ batchNumber: null, supplierName: null }),
    );
  });
});

describe('InventoryService.findOne', () => {
  it('exposes the derived fields the staff table renders', async () => {
    const { service } = makeService(makeMedicine({ quantityInStock: 240, minStockLevel: 40 }));

    const view = await service.findOne('any-id');

    expect(view.stockStatus).toBe('in_stock');
    expect(view.stockValue).toBe(2976);
    expect(view.batchNumber).toBe('AMX-2401');
  });

  it('reports low stock at or below the reorder level', async () => {
    const { service } = makeService(makeMedicine({ quantityInStock: 40, minStockLevel: 40 }));

    await expect(service.findOne('any-id')).resolves.toMatchObject({
      stockStatus: 'low_stock',
    });
  });

  it('reports out of stock at zero', async () => {
    const { service } = makeService(makeMedicine({ quantityInStock: 0 }));

    await expect(service.findOne('any-id')).resolves.toMatchObject({
      stockStatus: 'out_of_stock',
    });
  });

  it('throws for a medicine that does not exist', async () => {
    const { service } = makeService(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('InventoryService.update', () => {
  it('only changes the fields that were sent', async () => {
    const medicine = makeMedicine();
    const { service } = makeService(medicine);

    await service.update(medicine.id, { unitPrice: 13.75 } as never);

    expect(medicine.unitPrice).toBe(13.75);
    expect(medicine.name).toBe('Amoxicillin 500mg capsules');
  });

  it('clears an expiration date that is cleared to an empty string', async () => {
    const medicine = makeMedicine();
    const { service } = makeService(medicine);

    await service.update(medicine.id, { expirationDate: '' } as never);

    expect(medicine.expirationDate).toBeNull();
  });

  it('throws for a medicine that does not exist', async () => {
    const { service } = makeService(null);

    await expect(service.update('missing', {})).rejects.toThrow(NotFoundException);
  });
});

describe('InventoryService.archive', () => {
  it('retires an active medicine without deleting it', async () => {
    const medicine = makeMedicine();
    const { service, repo } = makeService(medicine);

    await expect(service.archive(medicine.id)).resolves.toEqual({
      id: medicine.id,
      isActive: false,
      alreadyArchived: false,
    });
    expect(medicine.isActive).toBe(false);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('is idempotent for a medicine that is already retired', async () => {
    const medicine = makeMedicine({ isActive: false });
    const { service, repo } = makeService(medicine);

    await expect(service.archive(medicine.id)).resolves.toMatchObject({
      alreadyArchived: true,
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws for a medicine that does not exist', async () => {
    const { service } = makeService(null);

    await expect(service.archive('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('InventoryService.adjustStock', () => {
  it('adds a delivery and reports the previous quantity', async () => {
    const medicine = makeMedicine();
    const { service } = makeService(medicine);

    const result = await service.adjustStock(medicine.id, { quantityChange: 60 });

    expect(medicine.quantityInStock).toBe(300);
    expect(result.previousQuantity).toBe(240);
    expect(result.quantityChange).toBe(60);
    expect(result.quantityInStock).toBe(300);
  });

  it('removes units for a correction or write-off', async () => {
    const medicine = makeMedicine();
    const { service } = makeService(medicine);

    await service.adjustStock(medicine.id, { quantityChange: -12 });

    expect(medicine.quantityInStock).toBe(228);
  });

  it('refuses to drive stock below zero', async () => {
    const medicine = makeMedicine({ quantityInStock: 5 });
    const { service, repo } = makeService(medicine);

    await expect(
      service.adjustStock(medicine.id, { quantityChange: -6 }),
    ).rejects.toThrow(BadRequestException);
    expect(medicine.quantityInStock).toBe(5);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows taking stock to exactly zero', async () => {
    const medicine = makeMedicine({ quantityInStock: 5 });
    const { service } = makeService(medicine);

    await service.adjustStock(medicine.id, { quantityChange: -5 });

    expect(medicine.quantityInStock).toBe(0);
  });

  it('throws for a medicine that does not exist', async () => {
    const { service } = makeService(null);

    await expect(
      service.adjustStock('missing', { quantityChange: 5 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('InventoryService.list', () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  const listRepo = {
    createQueryBuilder: jest.fn(() => builder),
  } as unknown as Repository<Medicine>;

  it('defaults to the first page sorted by name', async () => {
    const service = new InventoryService(listRepo);

    await service.list(query());

    expect(builder.where).toHaveBeenCalledWith('m.is_active = true');
    expect(builder.orderBy).toHaveBeenCalledWith('m.name', 'ASC');
    expect(builder.skip).toHaveBeenCalledWith(0);
    expect(builder.take).toHaveBeenCalledWith(20);
  });

  it('maps a whitelisted sort key onto a real column', async () => {
    const service = new InventoryService(listRepo);

    await service.list(query({ sort: 'stock_desc' }));

    expect(builder.orderBy).toHaveBeenCalledWith('m.quantity_in_stock', 'DESC');
  });

  it('ignores an unknown sort key instead of interpolating it', async () => {
    const service = new InventoryService(listRepo);

    await service.list(query({ sort: 'password_hash' }));

    expect(builder.orderBy).toHaveBeenCalledWith('m.name', 'ASC');
  });

  it('paginates from the requested page', async () => {
    const service = new InventoryService(listRepo);

    await service.list(query({ page: 3, limit: 10 }));

    expect(builder.skip).toHaveBeenCalledWith(20);
    expect(builder.take).toHaveBeenCalledWith(10);
  });

  it('always reports at least one page, even when empty', async () => {
    const service = new InventoryService(listRepo);

    const result = await service.list(query());

    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
  });
});
