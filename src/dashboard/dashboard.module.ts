import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Medicine } from '../inventory/entities/medicine.entity';
import { Sale } from '../sales/entities/sale.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * The JWT secret is registered globally by AuthModule, so this module only needs
 * the repositories it aggregates over.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Medicine, Sale])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
