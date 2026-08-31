// Shared by publisher domain validation (ads.txt) and ad-engine auto-verify
// (Referer-based) so both paths agree on what counts as "the same domain".
export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

// Same idea as normalizeDomain(), plus dropping a leading "www." - used
// only by the publisher Statistics screen's "Domain" grouping/filtering
// (PublisherService.getStatistics), where "example.com" and
// "www.example.com" are the same site to a publisher and should collapse
// into one row instead of splitting revenue across two. Kept separate from
// normalizeDomain() itself, which backs ads.txt ownership verification and
// must stay an exact match against what the publisher typed there.
export function normalizeStatsDomain(domain: string): string {
  return normalizeDomain(domain).replace(/^www\./, '');
}

// Extracts and normalizes the hostname a request actually came from, from a
// raw `Referer`/`Origin` HTTP header value (e.g. "https://example.com/page").
// Returns null for anything that isn't a well-formed absolute URL - callers
// must treat that as "unknown, don't trust it" rather than falling back to
// any client-suppliable value.
export function domainFromHeaderUrl(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  try {
    return new URL(headerValue).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}
