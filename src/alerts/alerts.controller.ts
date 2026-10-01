import {
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
import { CurrentUser } from '../shared/current-user.decorator';
import type { AuthUser } from '../shared/current-user.decorator';
import { JwtAuthGuard } from '../shared/jwt-auth.guard';
import { AlertQueryDto } from './dto/alert-query.dto';
import { AlertsService } from './alerts.service';

/** Tasks 3 & 4 — expiration and low-stock notifications. Staff only. */
@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async list(@Query() query: AlertQueryDto) {
    const data = await this.alertsService.list(query);
    return { success: true, message: 'Alerts loaded.', data };
  }

  @Get('summary')
  async summary() {
    const data = await this.alertsService.summary();
    return { success: true, message: 'Alert counts loaded.', data };
  }

  /** Forces an immediate re-check. Idempotent, so it is safe to call often. */
  @Post('scan')
  @HttpCode(HttpStatus.OK)
  async scan() {
    const data = await this.alertsService.scan();
    return {
      success: true,
      message: `Stock and expiry rules re-checked. ${data.open} alert(s) need attention.`,
      data,
    };
  }

  @Patch(':id/acknowledge')
  async acknowledge(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const alert = await this.alertsService.acknowledge(id, user?.id || null);

    if (!alert) {
      throw new NotFoundException('Alert not found.');
    }

    return { success: true, message: 'Alert acknowledged.', data: alert };
  }

  @Patch(':id/resolve')
  async resolve(@Param('id', new ParseUUIDPipe()) id: string) {
    const alert = await this.alertsService.resolve(id);

    if (!alert) {
      throw new NotFoundException('Alert not found.');
    }

    return { success: true, message: 'Alert closed.', data: alert };
  }
}
