import { ClickIntegrityService } from './click-integrity.service';

describe('ClickIntegrityService', () => {
  let service: ClickIntegrityService;

  beforeEach(() => {
    service = new ClickIntegrityService();
  });

  it('verifies a token signed moments ago for the same zone+campaign', () => {
    const token = service.sign('zone-1', 'campaign-1', Date.now() - 1000);

    expect(service.verify(token, 'zone-1', 'campaign-1')).toEqual({
      valid: true,
      ageMs: expect.any(Number),
    });
  });

  it('rejects a missing token', () => {
    expect(service.verify(undefined, 'zone-1', 'campaign-1')).toEqual({
      valid: false,
      reason: 'MISSING_CLICK_TOKEN',
    });
  });

  it('rejects a malformed token', () => {
    expect(service.verify('not-a-real-token', 'zone-1', 'campaign-1')).toEqual(
      { valid: false, reason: 'MALFORMED_CLICK_TOKEN' },
    );
  });

  it('rejects a token whose signature was tampered with', () => {
    const token = service.sign('zone-1', 'campaign-1', Date.now() - 1000);
    const [payload] = token.split('.');
    const tampered = `${payload}.not-the-real-signature`;

    expect(service.verify(tampered, 'zone-1', 'campaign-1')).toEqual({
      valid: false,
      reason: 'CLICK_TOKEN_SIGNATURE_MISMATCH',
    });
  });

  it('rejects a token issued for a different zone or campaign', () => {
    const token = service.sign('zone-1', 'campaign-1', Date.now() - 1000);

    expect(service.verify(token, 'zone-2', 'campaign-1')).toEqual({
      valid: false,
      reason: 'CLICK_TOKEN_SCOPE_MISMATCH',
    });
    expect(service.verify(token, 'zone-1', 'campaign-2')).toEqual({
      valid: false,
      reason: 'CLICK_TOKEN_SCOPE_MISMATCH',
    });
  });

  it('rejects a click fired faster than a human can react', () => {
    const token = service.sign('zone-1', 'campaign-1', Date.now());

    const result = service.verify(token, 'zone-1', 'campaign-1');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('CLICK_TOKEN_EXPIRED');
  });

  it('rejects a token far older than the max allowed age', () => {
    const token = service.sign(
      'zone-1',
      'campaign-1',
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    );

    const result = service.verify(token, 'zone-1', 'campaign-1');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('CLICK_TOKEN_EXPIRED');
  });
});
