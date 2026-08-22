import { Injectable, Logger } from '@nestjs/common';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Verifies the Cloudflare Turnstile token the frontend widget attaches to
// login/register requests (see web/components/app/turnstile-widget.tsx).
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET_KEY;

    // No secret configured (e.g. local dev without a Cloudflare account) -
    // skip verification rather than locking everyone out of auth. Set
    // TURNSTILE_SECRET_KEY in production to actually enforce this.
    if (!secret) {
      this.logger.warn(
        'TURNSTILE_SECRET_KEY not set - skipping Turnstile verification',
      );
      return true;
    }

    if (!token) {
      return false;
    }

    try {
      const body = new URLSearchParams({ secret, response: token });
      if (remoteIp) {
        body.set('remoteip', remoteIp);
      }

      const res = await fetch(VERIFY_URL, { method: 'POST', body });
      const data = (await res.json()) as { success: boolean };
      return data.success === true;
    } catch (error) {
      this.logger.error('Turnstile verification request failed', error as Error);
      return false;
    }
  }
}
