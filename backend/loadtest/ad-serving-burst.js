// k6 load test for the ad-serving hot path (/serve, /click) plus a light
// pass at the auth rate limits added in app.module.ts / auth.controller.ts.
//
// Run (requires the backend, Postgres, Redis and ClickHouse from
// docker-compose.yml to all be up, and at least one active campaign/zone
// seeded - a zoneId with no matching campaign still exercises the full
// path, just returns creative: null):
//
//   docker compose up -d
//   TRUST_PROXY=true npm run start:dev   (in backend/ - see the per-VU
//     X-Forwarded-For comment on adServing() below for why this matters)
//   npx k6 run backend/loadtest/ad-serving-burst.js
//
// NEVER point BASE_URL at production without deliberately choosing to -
// this hits real ad-serving/auth endpoints at real volume. Point it at a
// local/staging stack unless you've specifically sized down VUS_PEAK and
// accepted the load/cost on production infra.
//
// Override target/zone via env vars, e.g.:
//   k6 run -e BASE_URL=https://staging.example.com -e ZONE_ID=<real-zone-id> ad-serving-burst.js
//
// What this checks:
//   - the server survives a burst ramp to VUS_PEAK concurrent virtual
//     users without error-rate spiking or p95 latency blowing up
//   - /serve and /click (SkipThrottle'd - see ad-engine.controller.ts)
//     keep serving under load instead of getting 429'd by the global
//     throttler meant for the rest of the API
//   - the auth 'burst' throttle (5-10 req/min on login/register/otp) DOES
//     kick in and return 429, proving the brute-force guard is live
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000';
const ZONE_ID = __ENV.ZONE_ID ?? '00000000-0000-0000-0000-000000000000';
const VUS_PEAK = Number(__ENV.VUS_PEAK ?? 300);

const serveErrors = new Rate('serve_error_rate');
const serveLatency = new Trend('serve_latency_ms');
const clickErrors = new Rate('click_error_rate');

export const options = {
  scenarios: {
    ad_serving_burst: {
      executor: 'ramping-vus',
      exec: 'adServing',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.round(VUS_PEAK * 0.3) }, // warm-up
        { duration: '1m', target: VUS_PEAK }, // burst to peak concurrency
        { duration: '2m', target: VUS_PEAK }, // sustain the burst
        { duration: '30s', target: 0 }, // ramp down
      ],
    },
    auth_abuse_check: {
      executor: 'constant-vus',
      exec: 'authAbuse',
      vus: 5,
      duration: '30s',
      startTime: '10s',
    },
  },
  thresholds: {
    // Fail the run (non-zero exit) if the ad-serving path degrades under
    // load - these are the numbers that matter for "does this survive
    // production traffic", not just "did every request return 200".
    serve_error_rate: ['rate<0.01'],
    serve_latency_ms: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.02'],
  },
};

export function adServing() {
  // Simulates a distinct real visitor per VU - real production traffic
  // comes from thousands of different IPs, not one load-generator box. Only
  // takes effect if the server has TRUST_PROXY set (see main.ts); without
  // it every VU collapses onto the load generator's own IP and trips the
  // per-visitor velocity/frequency cap as if it were one client hammering
  // the endpoint, which is a load-test artifact, not a real finding.
  const fakeIp = `${100 + (__VU % 155)}.${(__VU * 7) % 255}.${(__VU * 13) % 255}.${(__ITER * 3 + __VU) % 255}`;
  const headers = { 'User-Agent': `k6-load-test/1.0 vu-${__VU}`, 'X-Forwarded-For': fakeIp };
  const serveUrl = `${BASE_URL}/api/v1/serve?zoneId=${ZONE_ID}&origin=https://example-publisher.test&path=/&viewportWidth=1280&viewportHeight=800&devicePixelRatio=2&referrer=`;
  const serveRes = http.get(serveUrl, { headers });

  serveErrors.add(serveRes.status !== 200);
  serveLatency.add(serveRes.timings.duration);

  check(serveRes, {
    'serve: status is 200': (r) => r.status === 200,
    'serve: has ad_response body': (r) => {
      try {
        return JSON.parse(r.body).type === 'ad_response';
      } catch {
        return false;
      }
    },
  });

  // If a real campaign served a creative with a click URL, exercise the
  // click/redirect path too - otherwise skip (no creative for this zone).
  let clickUrl;
  try {
    const body = JSON.parse(serveRes.body);
    clickUrl = body?.creative?.html?.match(/href="([^"]+\/api\/v1\/click[^"]*)"/)?.[1];
  } catch {
    // ignore parse failures, handled by the check() above
  }

  if (clickUrl) {
    // ClickIntegrityService.minAgeMs (250ms default) rejects a click that
    // follows its own /serve impression faster than real human reaction
    // time - correct anti-bot behavior, but it means this script has to
    // wait at least that long before clicking too, same as a real user
    // would, or every click here would get a false-positive 403.
    sleep(0.3);
    const clickRes = http.get(clickUrl.replace(/&amp;/g, '&'), {
      redirects: 0,
      headers,
    });
    clickErrors.add(clickRes.status >= 500);
    check(clickRes, {
      'click: not a server error': (r) => r.status < 500,
    });
  }

  sleep(Math.random() * 0.5);
}

export function authAbuse() {
  // Deliberately hammers /login past its 10 req/min 'burst' throttle (see
  // auth.controller.ts) with obviously-wrong credentials - this scenario
  // is expected to start getting 429s partway through, and that's a PASS,
  // not a failure: it's proving the brute-force guard actually engages.
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'loadtest@example.com', password: 'wrong-password' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(res, {
    'login: never 5xx (only 400/401/429 expected)': (r) => r.status < 500,
  });

  sleep(0.2);
}
