import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../shared/jwt-auth.guard';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import {
  AdjustStockDto,
  CreateMedicineDto,
  UpdateMedicineDto,
} from './dto/medicine.dto';
import { InventoryService } from './inventory.service';

/** Task 1 — inventory management. Staff only. */
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('medicines')
  async list(@Query() query: InventoryQueryDto) {
    const data = await this.inventoryService.list(query);
    return { success: true, message: 'Inventory loaded.', data };
  }

  @Get('medicines/picker')
  async picker() {
    const data = await this.inventoryService.listForSalePicker();
    return { success: true, message: 'Picker options loaded.', data };
  }

  @Get('medicines/:id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.inventoryService.findOne(id);
    return { success: true, message: 'Medicine loaded.', data };
  }

  @Post('medicines')
  async create(@Body() dto: CreateMedicineDto) {
    const data = await this.inventoryService.create(dto);
    return { success: true, message: `${data.name} added to the catalogue.`, data };
  }

  @Patch('medicines/:id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMedicineDto,
  ) {
    const data = await this.inventoryService.update(id, dto);
    return { success: true, message: `${data.name} updated.`, data };
  }

  @Delete('medicines/:id')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.inventoryService.archive(id);
    return {
      success: true,
      message: data.alreadyArchived
        ? 'Medicine was already retired.'
        : 'Medicine retired.',
      data,
    };
  }

  /** Deliveries, corrections and write-offs. Sales go through POST /sales. */
  @Post('medicines/:id/stock')
  @HttpCode(HttpStatus.OK)
  async adjustStock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdjustStockDto,
  ) {
    const data = await this.inventoryService.adjustStock(id, dto);
    const verb = dto.quantityChange >= 0 ? 'added to' : 'removed from';
    return {
      success: true,
      message: `${Math.abs(dto.quantityChange)} unit(s) ${verb} ${data.name}.`,
      data,
    };
  }
}
