import { createHmac, timingSafeEqual } from 'crypto';

import { Injectable } from '@nestjs/common';

export type ClickTokenVerification = {
  valid: boolean;
  ageMs?: number;
  reason?:
    | 'MISSING_CLICK_TOKEN'
    | 'MALFORMED_CLICK_TOKEN'
    | 'CLICK_TOKEN_SIGNATURE_MISMATCH'
    | 'CLICK_TOKEN_SCOPE_MISMATCH'
    | 'CLICK_TOKEN_EXPIRED';
};

// Proves a click actually followed a real ad impression served by THIS
// server, rather than someone (a script, a "click farm", a competitor
// hammering a rival's budget) hitting /api/v1/click directly with a guessed
// zoneId/campaignId. AdEngineController mints one of these into the anchor
// href it renders at /serve time (see buildClickUrl) - a legitimate click
// always carries a token that was issued moments earlier for that exact
// zone+campaign; a forged request has to either omit it or guess a valid
// HMAC, which the secret below makes infeasible.
//
// Deliberately NOT a JWT/session cookie: the publisher tag embeds cross-site
// with credentials: 'omit' (see publisher_tag.js), so there is no cookie to
// carry a session, and a compact signed string in the URL is the only thing
// that survives being rendered into a plain <a href> on a third-party page.
@Injectable()
export class ClickIntegrityService {
  // A real click always takes at least this long after the ad first paints
  // (impression) - human reaction time to see + move the pointer + click is
  // consistently >200-300ms in UX research. Anything faster is either a
  // prefetch bot firing the link immediately or a scripted click, not a
  // person. Configurable because "how fast is too fast" is a judgment call
  // an operator may want to tune down for high-traffic mobile placements.
  private readonly minAgeMs = Number(
    process.env.CLICK_TOKEN_MIN_AGE_MS ?? 250,
  );

  // Bounds how long a rendered ad can sit in a background/inactive tab and
  // still produce a billable click - generous on purpose (people do leave
  // tabs open), but a token from days ago is far more likely to be a
  // replayed/reused URL than a genuine late click.
  private readonly maxAgeMs = Number(
    process.env.CLICK_TOKEN_MAX_AGE_MS ?? 24 * 60 * 60 * 1000,
  );

  private readonly secret =
    process.env.CLICK_TOKEN_SECRET ?? 'dev-click-token-secret-change-me';

  sign(zoneId: string, campaignId: string, issuedAtMs = Date.now()): string {
    const payload = `${zoneId}.${campaignId}.${issuedAtMs}`;
    const payloadEncoded = Buffer.from(payload, 'utf8').toString('base64url');
    const signature = this.hmac(payloadEncoded);

    return `${payloadEncoded}.${signature}`;
  }

  verify(
    token: string | undefined,
    zoneId: string,
    campaignId: string,
  ): ClickTokenVerification {
    if (!token) {
      return { valid: false, reason: 'MISSING_CLICK_TOKEN' };
    }

    const [payloadEncoded, signature] = token.split('.');
    if (!payloadEncoded || !signature) {
      return { valid: false, reason: 'MALFORMED_CLICK_TOKEN' };
    }

    if (!this.timingSafeCompare(signature, this.hmac(payloadEncoded))) {
      return { valid: false, reason: 'CLICK_TOKEN_SIGNATURE_MISMATCH' };
    }

    let payload: string;
    try {
      payload = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    } catch {
      return { valid: false, reason: 'MALFORMED_CLICK_TOKEN' };
    }

    const [tokenZoneId, tokenCampaignId, issuedAtRaw] = payload.split('.');
    const issuedAtMs = Number(issuedAtRaw);

    if (!tokenZoneId || !tokenCampaignId || !Number.isFinite(issuedAtMs)) {
      return { valid: false, reason: 'MALFORMED_CLICK_TOKEN' };
    }

    if (tokenZoneId !== zoneId || tokenCampaignId !== campaignId) {
      return { valid: false, reason: 'CLICK_TOKEN_SCOPE_MISMATCH' };
    }

    const ageMs = Date.now() - issuedAtMs;

    if (ageMs < this.minAgeMs || ageMs > this.maxAgeMs) {
      return { valid: false, ageMs, reason: 'CLICK_TOKEN_EXPIRED' };
    }

    return { valid: true, ageMs };
  }

  private hmac(payloadEncoded: string): string {
    return createHmac('sha256', this.secret)
      .update(payloadEncoded)
      .digest('base64url');
  }

  private timingSafeCompare(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return timingSafeEqual(bufferA, bufferB);
  }
}
