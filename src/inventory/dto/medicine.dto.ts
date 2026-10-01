import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Every field a staff member enters when adding a medicine to the catalogue. */
export class CreateMedicineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityInStock: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999.99)
  unitPrice: number;

  @IsOptional()
  @IsDateString({ strict: true })
  expirationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  batchNumber?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplierName?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  minStockLevel = 0;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Every field optional: this is what PATCH /inventory/medicines/:id accepts. */
export class UpdateMedicineDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999.99)
  unitPrice?: number;

  @IsOptional()
  @IsDateString({ strict: true })
  expirationDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  batchNumber?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplierName?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  minStockLevel?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Stock movement that is not a sale: deliveries, corrections, write-offs. */
export class AdjustStockDto {
  /**
   * Signed change to apply. `5` receives five units, `-5` removes five.
   * The resulting quantity must stay at or above zero.
   */
  @Type(() => Number)
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  @Matches(/^-?\d+$/, { message: 'quantityChange must be a whole number.' })
  quantityChange: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
