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
