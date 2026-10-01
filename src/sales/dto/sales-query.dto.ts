import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SalesQueryDto {
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

  /** ISO date; only sales at or after this moment are returned. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  /** ISO date; only sales at or before this moment are returned. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  search?: string;
}
