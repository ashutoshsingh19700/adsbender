import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

describe('publisher_tag.js', () => {
  const publicDir = join(process.cwd(), 'public');
  const tagSource = readFileSync(join(publicDir, 'publisher_tag.js'), 'utf8');
  const sampleHtml = readFileSync(join(publicDir, 'sample-index.html'), 'utf8');

  it('is loaded asynchronously by the local verification page', () => {
    expect(sampleHtml).toContain(
      '<script async src="/assets/publisher_tag.js"></script>',
    );
    expect(sampleHtml).toContain('data-zone-id="42"');
  });

  it('collects zone, browser, page, and viewport data into a non-blocking serve request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        creative: null,
      }),
    });
    const zone = {
      attributes: {
        'data-zone-id': '42',
      },
      setAttribute: jest.fn((key: string, value: string) => {
        zone.attributes[key] = value;
      }),
      getAttribute: jest.fn((key: string) => zone.attributes[key] ?? null),
      querySelector: jest.fn().mockReturnValue(null),
      insertAdjacentHTML: jest.fn(),
      innerHTML: '',
    };
    const documentMock = {
      readyState: 'complete',
      referrer: 'https://referrer.test',
      querySelectorAll: jest.fn().mockReturnValue([zone]),
      addEventListener: jest.fn(),
    };
    const context = {
      URLSearchParams,
      Error,
      fetch: fetchMock,
      navigator: {
        language: 'en-US',
      },
      window: {
        location: {
          origin: 'https://publisher.test',
          pathname: '/article',
        },
        innerWidth: 1366,
        innerHeight: 768,
        devicePixelRatio: 2,
        screen: {
          width: 1920,
          height: 1080,
        },
      },
      document: documentMock,
    };

    vm.runInNewContext(tagSource, context);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(documentMock.querySelectorAll).toHaveBeenCalledWith(
      '[data-zone-id]',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      keepalive: true,
    });

    const requestUrl = new URL(
      fetchMock.mock.calls[0][0],
      'https://engine.test',
    );

    expect(requestUrl.pathname).toBe('/api/v1/serve');
    expect(requestUrl.searchParams.get('zoneId')).toBe('42');
    expect(requestUrl.searchParams.get('origin')).toBe(
      'https://publisher.test',
    );
    expect(requestUrl.searchParams.get('path')).toBe('/article');
    expect(requestUrl.searchParams.get('viewportWidth')).toBe('1366');
    expect(requestUrl.searchParams.get('viewportHeight')).toBe('768');
    expect(requestUrl.searchParams.get('devicePixelRatio')).toBe('2');
    expect(requestUrl.searchParams.get('referrer')).toBe(
      'https://referrer.test',
    );
    expect(requestUrl.searchParams.get('language')).toBe('en-US');
    expect(zone.setAttribute).toHaveBeenCalledWith(
      'data-ad-network-loaded',
      'true',
    );
    expect(zone.insertAdjacentHTML).toHaveBeenCalledWith(
      'beforeend',
      '<a data-ad-network-honeypot="true" href="/api/v1/trap" style="display:none !important;"></a>',
    );
  });
});
