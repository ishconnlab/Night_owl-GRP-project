import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type StockStatus = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
export type ExpiryWindow = 'all' | 'expired' | '30' | '14' | '7' | '1';

export class InventoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsIn(['all', 'in_stock', 'out_of_stock', 'low_stock'])
  status: StockStatus = 'all';

  @IsOptional()
  @IsIn(['all', 'expired', '30', '14', '7', '1'])
  expiringWithin: ExpiryWindow = 'all';

  @IsOptional()
  @IsIn(['name_asc', 'name_desc', 'price_asc', 'price_desc', 'stock_asc', 'stock_desc', 'expiry_asc'])
  sort: string = 'name_asc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
