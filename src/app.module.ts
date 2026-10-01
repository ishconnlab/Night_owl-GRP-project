import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from './alerts/alerts.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SalesModule } from './sales/sales.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'night-owl-pharmacy-local',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'night-owl-pharmacy-local',
      serviceId: 'night-owl-pharmacy',
    }),

    // Shared database wiring. The schema is owned by src/migrations/*.sql and
    // applied with psql; TypeORM never creates or alters tables here.
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5432)),
        database: config.get<string>('DB_NAME') ?? 'pharmacy',
        username: config.get<string>('DB_USER') ?? 'pharmacy',
        password: config.get<string>('DB_PASSWORD') ?? '',
        ssl: config.get('DB_SSL', 'false') === 'true',
        // Never synchronize: the schema is owned by src/migrations/*.sql.
        synchronize: false,
        logging: config.get('DB_LOGGING', 'false') === 'true',
        autoLoadEntities: true,
      }),
    }),

    // Staff operations: authentication, inventory, sale recording, and the
    // expiration / low-stock alert scan.
    //
    // AuthModule is @Global: it registers the JwtModule secret once so
    // JwtAuthGuard and AuthService share it, instead of every module repeating
    // the same registerAsync block.
    AuthModule,
    InventoryModule,
    SalesModule,
    AlertsModule,

    // Staff reporting and the customer-facing storefront.
    DashboardModule,
    CatalogModule,
    ReservationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
