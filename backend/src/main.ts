import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import express from 'express';
import { join } from 'path';

import { AppModule } from './app.module';
import { frontendAssetPath } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Parse Cookies
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.use((_, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    next();
  });

  // Frontend static assets.
  app.use('/assets', express.static(join(process.cwd(), frontendAssetPath())));

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Start Server
  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `🚀 Server running at http://localhost:${process.env.PORT ?? 3000}`,
  );
}

bootstrap();
