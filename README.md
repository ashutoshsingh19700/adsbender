# Ad Network Platform

Production-oriented ad network platform with publisher onboarding, advertiser campaign creation, low-latency ad serving, Redis hot-cache targeting, fraud controls, stream ingestion, and ClickHouse analytics.

## Run Locally

```powershell
docker compose up -d
cd backend
npm.cmd install
npx.cmd prisma migrate dev
npm.cmd run start:dev
```

In a second terminal, start the frontend:

```powershell
cd web
npm.cmd install
npm.cmd run dev -- -p 3001
```

Open:

- `http://localhost:3001/` — landing page
- `http://localhost:3001/login` — sign in / register
- `http://localhost:3001/publisher` — Publisher Portal
- `http://localhost:3001/advertiser` — Advertiser Studio
- `http://localhost:3001/analytics` — Analytics Dashboard

For local dev, set `CORS_ORIGIN=http://localhost:3001` in `backend/.env` so the browser can send the auth cookie cross-port with credentials. The publisher ad tag (`publisher_tag.js`) and its manual test harness are unaffected and still served by the backend at `http://localhost:3000/assets/sample-index.html`.

## Verification

```powershell
cd backend
npm.cmd test -- --runInBand
npm.cmd run build
```

```powershell
cd web
npm.cmd run lint
npm.cmd run build
```

## Production Notes

- Replace all secrets in `.env` and `backend/.env`.
- Run migrations before deployment.
- `CAMPAIGN_CACHE_SYNC_ENABLED` and `CLICKHOUSE_INGESTION_ENABLED` default to `true` (the campaign hot-cache refresh worker and the impression/click stream-ingestion workers run automatically). Set either to `false` only if you need to disable that worker for a specific deployment.
- Set `GEOIP_DB_PATH` to a licensed `GeoLite2-Country.mmdb` file (free tier available at https://www.maxmind.com/en/geolite2/signup). Without it, the app falls back to MaxMind's public test fixture bundled at `backend/test/fixtures/geoip/GeoLite2-Country-Test.mmdb`, which only resolves a handful of MaxMind's documented test IPs — fine for local dev/CI, not for real traffic.
- Set `CORS_ORIGIN` to the deployed frontend (`web/`) origin. Prefer deploying `web/` reverse-proxied on the same origin as the API in production, so cookie `SameSite`/`Secure` behavior doesn't depend on cross-origin CORS at all.
- Build the frontend for production with `cd web && npm run build`, or build the included `web/Dockerfile` (multi-stage, Next.js standalone output). Set `NEXT_PUBLIC_API_URL` (see `web/.env.example`) to the backend's public URL at build time.
- The backend has no dedicated logout endpoint (the JWT cookie is httpOnly by design). `web/app/api/logout/route.ts` clears it instead — see the comment there for why this works despite living in a separate app.

## Architecture Decisions

- **Message broker: Redis Streams, not RabbitMQ/Kafka.** The original blueprint called out RabbitMQ or Kafka for the impression/click event pipeline. This build uses Redis Streams (`XADD`/`XREAD`/consumer groups) instead — Redis is already a required dependency for hot-cache and rate limiting, so this avoids running a second piece of broker infrastructure. Functionally it provides the same fire-and-forget, non-blocking event dispatch with consumer-group-style batched reads. Revisit this if event volume or delivery-guarantee requirements grow beyond what a single Redis instance can serve.
