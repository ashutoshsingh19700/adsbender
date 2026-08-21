import { domainFromHeaderUrl, normalizeDomain } from './domain.util';

describe('normalizeDomain', () => {
  it('strips protocol, path, and casing', () => {
    expect(normalizeDomain('https://Example.com/some/path')).toBe(
      'example.com',
    );
    expect(normalizeDomain('http://example.com')).toBe('example.com');
    expect(normalizeDomain('  example.com  ')).toBe('example.com');
  });
});

describe('domainFromHeaderUrl', () => {
  it('extracts the hostname from a well-formed absolute URL', () => {
    expect(domainFromHeaderUrl('https://example.com/article?x=1')).toBe(
      'example.com',
    );
  });

  it('returns null for missing or malformed values', () => {
    expect(domainFromHeaderUrl(undefined)).toBeNull();
    expect(domainFromHeaderUrl('')).toBeNull();
    expect(domainFromHeaderUrl('not-a-url')).toBeNull();
  });
});
