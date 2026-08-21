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

  // The ad-serving endpoints are embedded via publisher_tag.js on arbitrary
  // third-party publisher sites (see backend/public/publisher_tag.js) - they
  // must be callable cross-origin from ANY domain, unlike the rest of the
  // API above which is locked to CORS_ORIGIN for cookie-auth safety. These
  // requests never carry credentials (the tag sends `credentials: "omit"`),
  // so a wildcard origin is safe here.
  app.use(
    ['/api/v1/serve', '/api/v1/click', '/api/v1/trap'],
    (_req: express.Request, response: express.Response, next: express.NextFunction) => {
      response.setHeader('Access-Control-Allow-Origin', '*');
      next();
    },
  );

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
