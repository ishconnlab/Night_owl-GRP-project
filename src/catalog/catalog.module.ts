import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Medicine } from '../inventory/entities/medicine.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([Medicine])],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
