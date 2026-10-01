import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../shared/current-user.decorator';
import { JwtAuthGuard } from '../shared/jwt-auth.guard';
import type { AuthUser } from '../shared/current-user.decorator';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { SalesService } from './sales.service';

/** Task 2 — automatic sale recording. Staff only. */
@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async record(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.salesService.recordSale(dto, user?.id || null);
    return {
      success: true,
      message: `Sale ${data.reference} recorded. Stock updated and revenue counted.`,
      data,
    };
  }

  @Get()
  async list(@Query() query: SalesQueryDto) {
    const data = await this.salesService.list(query);
    return { success: true, message: 'Sales loaded.', data };
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.salesService.findOne(id);
    return { success: true, message: 'Sale loaded.', data };
  }
}
