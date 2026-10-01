import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class AlertQueryDto {
  /** `open` and `acknowledged` are the actionable ones; `resolved` is history. */
  @IsOptional()
  @IsIn(['all', 'open', 'acknowledged', 'resolved'])
  status: 'all' | 'open' | 'acknowledged' | 'resolved' = 'open';

  @IsOptional()
  @IsIn(['all', 'expiring', 'low_stock'])
  kind: 'all' | 'expiring' | 'low_stock' = 'all';

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
