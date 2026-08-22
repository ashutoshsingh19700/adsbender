import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalFetch = global.fetch;
  let service: TurnstileService;

  beforeEach(() => {
    service = new TurnstileService();
  });

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = originalSecret;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('skips verification when no secret is configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(service.verify(undefined)).resolves.toBe(true);
  });

  it('rejects a missing token once a secret is configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';

    await expect(service.verify(undefined)).resolves.toBe(false);
  });

  it('returns true when Cloudflare reports success', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    global.fetch = jest
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve({ success: true }) }) as never;

    await expect(service.verify('a-valid-token')).resolves.toBe(true);
  });

  it('returns false when Cloudflare reports failure', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    global.fetch = jest
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve({ success: false }) }) as never;

    await expect(service.verify('a-bad-token')).resolves.toBe(false);
  });

  it('returns false when the verification request itself fails', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as never;

    await expect(service.verify('a-token')).resolves.toBe(false);
  });
});
