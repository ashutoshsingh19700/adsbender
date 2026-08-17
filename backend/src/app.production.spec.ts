import { readFileSync } from 'fs';
import { join } from 'path';

import { AppController } from './app.controller';

describe('production readiness surface', () => {
  it('points the platform entry point at the Next.js web app', () => {
    const platform = new AppController().getPlatform();

    expect(platform.dashboard).toContain('/analytics');
    expect(platform.publisherPortal).toContain('/publisher');
    expect(platform.advertiserStudio).toContain('/advertiser');
  });

  it('documents required production environment variables', () => {
    const envExample = readFileSync(
      join(process.cwd(), '.env.example'),
      'utf8',
    );

    expect(envExample).toContain('DATABASE_URL=');
    expect(envExample).toContain('SUPABASE_URL=');
    expect(envExample).toContain('SUPABASE_SERVICE_ROLE_KEY=');
    expect(envExample).toContain('CLICKHOUSE_URL=');
    expect(envExample).toContain('CAMPAIGN_CACHE_SYNC_ENABLED=');
  });
});
