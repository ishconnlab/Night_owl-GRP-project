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

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit = 12;

  @IsOptional()
  @IsIn(['name_asc', 'name_desc', 'price_asc', 'price_desc'])
  sort: 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' = 'name_asc';

  @IsOptional()
  @IsIn(['all', 'in_stock', 'out_of_stock'])
  availability: 'all' | 'in_stock' | 'out_of_stock' = 'all';
}