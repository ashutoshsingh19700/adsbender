export const requiredEnv = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const frontendAssetPath = () =>
  process.env.FRONTEND_DIR ?? 'public';

export const webAppUrl = () =>
  process.env.WEB_APP_URL ?? 'http://localhost:3001';

// The origin this ad server is itself publicly reachable at - needed when
// building a link (e.g. the /api/v1/click redirect) that gets embedded via
// publisher_tag.js on an arbitrary third-party site: a relative path there
// would resolve against the PUBLISHER's origin instead and 404 (same
// reasoning as the tag script's own AD_SERVER_ORIGIN comment). Derived from
// PUBLIC_TAG_URL rather than a separate env var since that's already the
// designated "where this server is publicly hosted" value (see
// PublisherService.buildSnippet).
export const adServerPublicOrigin = () => {
  const tagUrl =
    process.env.PUBLIC_TAG_URL ?? 'http://localhost:3000/assets/publisher_tag.js';

  try {
    return new URL(tagUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
};

export type RedisConnectionOptions = {
  host: string;
  port: number;
  password?: string;
  tls: boolean;
};

// Every RedisRespClient consumer (zone/campaign/blacklist cache, velocity
// counters, the stream broker) used to read REDIS_HOST/REDIS_PORT/
// REDIS_PASSWORD/REDIS_TLS directly, which silently falls back to
// 127.0.0.1:6379 - i.e. "no Redis at all" - the moment any of those four
// vars is missing or wrong. Managed Redis providers (including Render's own
// Key Value offering) commonly hand out ONE connection string
// (redis://[:password@]host:port or rediss://... for TLS) instead of four
// separate fields; pasting that whole string into just REDIS_HOST (an easy
// mistake - there's no visible error until a request actually needs Redis)
// produces exactly that silent-localhost-fallback failure mode. Preferring
// REDIS_URL when it's set, and falling back to the four discrete vars
// otherwise, makes either provisioning style work without the caller
// needing to know which one is in play.
export const resolveRedisConnectionOptions = (): RedisConnectionOptions => {
  const url = process.env.REDIS_URL;

  if (url) {
    try {
      const parsed = new URL(url);

      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 6379,
        password: parsed.password || undefined,
        tls: parsed.protocol === 'rediss:',
      };
    } catch {
      // Malformed REDIS_URL - fall through to the discrete vars below
      // rather than crashing module construction over it.
    }
  }

  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
  };
};
