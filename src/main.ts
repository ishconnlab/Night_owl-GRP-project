import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { ApiExceptionFilter } from './shared/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Shared by every module: the `/api` prefix, DTO validation and the error
  // envelope the frontend relies on.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    // transform is required for the @Type(() => Number) coercion every query
    // DTO uses; whitelist rejects unknown fields instead of ignoring them.
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();