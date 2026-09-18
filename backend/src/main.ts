import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cluster from 'cluster';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import os from 'os';
import { join } from 'path';

import { AppModule } from './app.module';
import { frontendAssetPath } from './config/env';

// Node is single-threaded - one process means one CPU core actually doing
// work, no matter how many requests pile up concurrently. Under real load
// (hundreds of concurrent users) that shows up as p95/p99 latency climbing
// even though the app never errors or crashes, because every request queues
// on the same event loop instead of being spread across cores. Forking one
// worker per core (cluster.fork() below) fixes that: the OS load-balances
// incoming connections across workers automatically once they all listen on
// the same port. Safe to do here because nothing in the request path keeps
// correctness-critical in-memory state - Postgres/Redis are the only shared
// source of truth - EXCEPT a handful of singleton background jobs (Redis
// stream consumers with no consumer-group support, periodic cache
// resyncs), which is what CLUSTER_WORKER_INDEX/isSingletonWorker() (see
// common/cluster-worker.ts) exists to protect: exactly one worker runs
// those regardless of how many are serving HTTP traffic.
//
// Off by default outside production (dev/watch mode and Jest both want a
// single, easy-to-debug process) and capped at 4 workers even when more
// cores are available: every worker opens its own Prisma connection pool
// against Supabase's pooler and its own Redis connections, so blindly
// forking os.cpus().length workers on a big box can exhaust the pooler's
// connection limit for no latency benefit. Override either direction with
// CLUSTER_WORKERS (0/1 disables clustering entirely; a higher number opts
// into more workers on a box that can actually support the DB connection
// load).
const CLUSTER_WORKERS_ENV = process.env.CLUSTER_WORKERS;
const CLUSTER_ENABLED =
  CLUSTER_WORKERS_ENV !== undefined
    ? Number(CLUSTER_WORKERS_ENV) > 1
    : process.env.NODE_ENV === 'production';
const WORKER_COUNT =
  Number(CLUSTER_WORKERS_ENV) || Math.min(os.cpus().length, 4);

if (CLUSTER_ENABLED && cluster.isPrimary) {
  runPrimary();
} else {
  runWorker();
}

function runPrimary() {
  const logger = new Logger('ClusterPrimary');
  logger.log(`Forking ${WORKER_COUNT} worker(s) (pid ${process.pid})`);

  const indexByPid = new Map<number, number>();
  const forkWorker = (index: number) => {
    // cluster.fork(env) merges `env` into the CHILD's process.env before its
    // code runs (unlike sending it via worker.send/IPC, which arrives too
    // late - after this module's top-level code, including runWorker(),
    // has already executed). Read back by isSingletonWorker()
    // (common/cluster-worker.ts) - exactly one worker (index "0") runs the
    // singleton Redis-stream/cache-sync jobs.
    const worker = cluster.fork({ CLUSTER_WORKER_INDEX: String(index) });
    if (worker.process.pid) indexByPid.set(worker.process.pid, index);
  };

  for (let i = 0; i < WORKER_COUNT; i += 1) {
    forkWorker(i);
  }

  let shuttingDown = false;
  cluster.on('exit', (worker, code, signal) => {
    const index = worker.process.pid
      ? (indexByPid.get(worker.process.pid) ?? 0)
      : 0;
    if (worker.process.pid) indexByPid.delete(worker.process.pid);

    if (shuttingDown) return;

    // A worker dying is exactly the "one bad code path shouldn't take the
    // whole app down" case main.ts's own unhandledRejection/uncaughtException
    // handlers exist for at the process level - this is that same guarantee
    // one level up, for a worker that died anyway (e.g. an OOM kill).
    // Re-forking with the SAME index means the singleton-worker role
    // (index 0) always has exactly one owner, migrating to the replacement
    // automatically instead of leaving those jobs unrun until a manual
    // restart.
    logger.error(
      `Worker ${worker.process.pid} (index ${index}) exited (${signal ?? code}) - restarting`,
    );
    forkWorker(index);
  });

  // Docker/Kubernetes/Render send SIGTERM to this primary process only on
  // deploy/scale-down - without forwarding it, workers get hard-killed by
  // the orchestrator's own grace-period timeout instead of running their
  // graceful shutdown (app.enableShutdownHooks() below: PrismaService
  // disconnect, Redis client cleanup), the same problem that hook was
  // originally added to prevent for the single-process case.
  const shutdown = (signal: NodeJS.Signals) => {
    shuttingDown = true;
    const workers = Object.values(cluster.workers ?? {});
    logger.log(`Received ${signal} - shutting down ${workers.length} worker(s)`);
    for (const worker of workers) {
      worker?.process.kill(signal);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function runWorker() {
  // A rejected promise or thrown error that escapes Nest's own request-level
  // handling (e.g. in a timer/interval outside any request, or during
  // bootstrap itself) would otherwise crash the whole process with no log
  // line explaining why - fatal for every in-flight request, not just the one
  // that triggered it. Logging and continuing (rather than exiting) trades a
  // theoretical "should never happen" bug for keeping the server serving
  // traffic instead of one bad code path taking every user down with it.
  process.on('unhandledRejection', (reason) => {
    new Logger('UnhandledRejection').error(
      reason instanceof Error ? reason.stack : reason,
    );
  });

  process.on('uncaughtException', (error) => {
    new Logger('UncaughtException').error(error.stack ?? error.message);
  });

  bootstrap().catch((error) => {
    new Logger('Bootstrap').error('Failed to start application', error?.stack ?? error);
    process.exit(1);
  });
}

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
  // `verify` runs on the raw bytes before JSON-parsing and just stashes them
  // on the request - cheap (the buffer is already in memory to parse
  // anyway) but required for RazorpayPaymentsController's webhook signature
  // check, which must HMAC the exact bytes Razorpay sent rather than a
  // re-serialization of the parsed body (whitespace/key-order would break
  // the signature). PayPal's webhook doesn't need this - it verifies via a
  // round trip to PayPal's own API instead of a local HMAC.
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

  // `credentials: true` means any origin this reflects back can make
  // cookie-authenticated requests on a signed-in visitor's behalf - fine to
  // default wide open (`true`, reflect any origin) in local dev, but in
  // production an unset CORS_ORIGIN must fail closed (no cross-origin
  // caller allowed) rather than silently becoming "every website on the
  // internet can ride this app's session cookies," which is what the old
  // `?? true` fallback did regardless of environment.
  const isProduction = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? (isProduction ? false : true),
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
  const workerLabel = cluster.isWorker ? ` (worker ${cluster.worker?.id})` : '';
  logger.log(
    `🚀 Server running at http://localhost:${process.env.PORT ?? 3000}${workerLabel}`,
  );
}
