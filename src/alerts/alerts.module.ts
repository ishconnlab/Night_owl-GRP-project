import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Medicine } from '../inventory/entities/medicine.entity';
import { AlertScheduler } from './alert-scheduler.service';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { StockAlert } from './entities/stock-alert.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockAlert, Medicine])],
  controllers: [AlertsController],
  providers: [AlertsService, AlertScheduler],
  exports: [AlertsService],
})
export class AlertsModule {}
