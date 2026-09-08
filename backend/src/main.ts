import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import { join } from 'path';

import { AppModule } from './app.module';
import { frontendAssetPath } from './config/env';

async function bootstrap() {
  // bodyParser: false so the size limit set below via useBodyParser is the
  // one that actually takes effect - Nest otherwise registers its own
  // express.json()/urlencoded() with body-parser's un-overridable-from-here
  // default (100kb) before any app.use() call of ours would run, and by the
  // time that default parser has already consumed the request stream a
  // second json()/urlencoded() call is a silent no-op (body-parser skips
  // re-parsing a request it's already parsed).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const httpAdapter = app.getHttpAdapter().getInstance();

  // Behind a real reverse proxy/load balancer in production
  // (TRUST_PROXY=1/true, or a hop count for a known proxy chain), Express
  // needs to be told to trust X-Forwarded-For - otherwise @Ip() everywhere
  // (fraud detection, click integrity, rate limiting, audit logs) resolves
  // to the proxy's own IP for every single request: every visitor looks
  // like the same client, frequency caps and IP-based fraud/rate limiting
  // collapse onto one shared bucket, and one heavy publisher's traffic can
  // trip a limit meant to catch a single abusive IP. Left unset (falsy) by
  // default so a direct-to-Node deployment doesn't trust a client-supplied
  // header instead.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    httpAdapter.set(
      'trust proxy',
      trustProxy === 'true' ? true : Number(trustProxy) || trustProxy,
    );
  }

  // Ad creatives can carry a fair amount of inline HTML/base64 imagery, but
  // there's no legitimate reason for any JSON/form body on this API to
  // approach the multi-MB range - capping it (default well above any real
  // payload, well below "someone can OOM the process with a giant body")
  // is a cheap guard against a request-body memory-exhaustion attempt.
  // `verify` runs on the raw bytes before JSON-parsing and just stashes
  // them on the request - cheap (the buffer is already in memory to parse
  // anyway) but required for RazorpayController's webhook signature check,
  // which must HMAC the exact bytes Razorpay sent rather than a
  // re-serialization of the parsed body (whitespace/key-order would break
  // the signature).
  const bodyLimit = process.env.MAX_REQUEST_BODY_SIZE ?? '2mb';
  app.useBodyParser('json', {
    limit: bodyLimit,
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  // Compresses every response over Express's default 1KB threshold -
  // meaningful bandwidth/latency savings on the JSON analytics/dashboard
  // payloads in particular, at negligible CPU cost.
  app.use(compression());

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

  // Lets Nest run each module's OnModuleDestroy/OnApplicationShutdown hook
  // (PrismaService.$disconnect, every RedisRespClient.destroy() - see
  // ad-engine's *.store.ts / *.consumer.ts / *.publisher.ts) when the
  // process receives SIGTERM/SIGINT, instead of the orchestrator (Docker,
  // Kubernetes, a process manager) hard-killing it after its grace period.
  // Without this, a deploy or autoscale-down mid-traffic drops whatever
  // requests were in flight and leaves DB/Redis connections to be cleaned
  // up by the OS rather than closed properly.
  app.enableShutdownHooks();

  // Start Server
  await app.listen(process.env.PORT ?? 3000);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Server running at http://localhost:${process.env.PORT ?? 3000}`);
}

// A rejected promise or thrown error that escapes Nest's own request-level
// handling (e.g. in a timer/interval outside any request, or during
// bootstrap itself) would otherwise crash the whole process with no log
// line explaining why - fatal for every in-flight request, not just the one
// that triggered it. Logging and continuing (rather than exiting) trades a
// theoretical "should never happen" bug for keeping the server serving
// traffic instead of one bad code path taking every user down with it.
process.on('unhandledRejection', (reason) => {
  new Logger('UnhandledRejection').error(reason instanceof Error ? reason.stack : reason);
});

process.on('uncaughtException', (error) => {
  new Logger('UncaughtException').error(error.stack ?? error.message);
});

bootstrap().catch((error) => {
  new Logger('Bootstrap').error('Failed to start application', error?.stack ?? error);
  process.exit(1);
});
