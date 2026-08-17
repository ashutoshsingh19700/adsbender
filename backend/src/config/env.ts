export const requiredEnv = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const frontendAssetPath = () =>
  process.env.FRONTEND_DIR ?? '../frontend';

export const webAppUrl = () =>
  process.env.WEB_APP_URL ?? 'http://localhost:3001';
