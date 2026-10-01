import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  medicineId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsString()
  @MaxLength(120)
  customerName: string;

  @IsString()
  @Length(7, 30)
  customerPhone: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}