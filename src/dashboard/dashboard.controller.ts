import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { JwtAuthGuard } from '../shared/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

/**
 * Staff-only financial dashboard.
 *
 * Staff login (see AuthModule) because every figure here is commercial
 * information: revenue, stock value and sell-through.
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async summary(@Query() query: DashboardQueryDto) {
    return {
      success: true,
      message: 'Dashboard summary loaded.',
      data: await this.dashboardService.getSummary(query),
    };
  }
}
