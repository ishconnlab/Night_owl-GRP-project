import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class DashboardQueryDto {
  /**
   * Window for the trend chart, in days.
   *
   * `@Type(() => Number)` is required: query parameters arrive as strings, and
   * without the transform `@IsInt()` rejects every real request.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  @IsIn([7, 14, 30, 60, 90])
  trendDays = 14;

  /** How far ahead "expiring soon" reaches, in days. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiryDays = 30;
}
