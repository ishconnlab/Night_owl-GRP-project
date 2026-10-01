import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../shared/current-user.decorator';
import type { AuthUser } from '../shared/current-user.decorator';
import { JwtAuthGuard } from '../shared/jwt-auth.guard';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  RESERVATION_STATUSES,
  ReservationsService,
  type ReservationStatusValue,
} from './reservations.service';

class StaffReservationQueryDto {
  @IsOptional()
  @IsIn(['all', 'pending', 'accepted', 'rejected', 'collected'])
  status: 'all' | 'pending' | 'accepted' | 'rejected' | 'collected' = 'all';

  /** Grouping shortcut, used when `status` is 'all'. */
  @IsOptional()
  @IsIn(['all', 'open', 'closed'])
  view: 'all' | 'open' | 'closed' = 'open';

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

class UpdateStatusDto {
  @IsIn(RESERVATION_STATUSES as unknown as string[])
  status: ReservationStatusValue;
}

/**
 * Reservations.
 *
 * Public: anyone may submit a request or check one by reference.
 * Staff: the queue behind a JWT, mounted on the same path so the customer-facing
 * URL space stays clean.
 */
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // --- Customer ---

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateReservationDto) {
    return {
      success: true,
      message: 'Reservation request received.',
      data: await this.reservationsService.createReservation(dto),
    };
  }

  /** Declared before `:reference` so the literal path wins the match. */
  @Get('counts')
  @UseGuards(JwtAuthGuard)
  async counts() {
    return {
      success: true,
      message: 'Reservation counts loaded.',
      data: await this.reservationsService.counts(),
    };
  }

  @Get(':reference')
  async getByReference(@Param('reference') reference: string) {
    return {
      success: true,
      message: 'Reservation loaded.',
      data: await this.reservationsService.getByReference(reference),
    };
  }

  // --- Staff ---

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Query() query: StaffReservationQueryDto) {
    return {
      success: true,
      message: 'Reservations loaded.',
      data: await this.reservationsService.list(query),
    };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const reservation = await this.reservationsService.updateStatus(
      id,
      dto.status,
      user?.id || null,
    );

    if (!reservation) {
      throw new NotFoundException('Reservation not found.');
    }

    return {
      success: true,
      message: `Reservation ${reservation.reference} marked ${dto.status}.`,
      data: reservation,
    };
  }
}
