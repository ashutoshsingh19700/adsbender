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
      // Publishers load this script cross-origin - currentScript.src is how
      // it locates the ad server regardless of what site it's embedded on.
      // See the AD_SERVER_ORIGIN comment in publisher_tag.js.
      currentScript: {
        src: 'https://engine.test/assets/publisher_tag.js',
      },
      querySelectorAll: jest.fn().mockReturnValue([zone]),
      addEventListener: jest.fn(),
    };
    const context = {
      URLSearchParams,
      URL,
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
      '<a data-ad-network-honeypot="true" href="https://engine.test/api/v1/trap" style="display:none !important;"></a>',
    );
  });

  // Minimal fake DOM element good enough for style/attribute assertions and
  // for being appended as a child - real enough to drive the render-family
  // dispatch in publisher_tag.js without needing a full jsdom environment.
  function makeStyle() {
    const style: Record<string, string> = {};
    Object.defineProperty(style, 'cssText', {
      set(value: string) {
        String(value)
          .split(';')
          .forEach((declaration) => {
            const [prop, val] = declaration.split(':');
            if (!prop || val === undefined) return;
            const camelProp = prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            style[camelProp] = val.trim();
          });
      },
      get() {
        return '';
      },
    });
    return style;
  }

  function makeFakeElement() {
    var attributes: Record<string, string> = {};
    var children: any[] = [];
    var listeners: Record<string, Function[]> = {};
    const element: any = {
      style: makeStyle(),
      attributes: attributes,
      children: children,
      listeners: listeners,
      innerHTML: '',
      setAttribute: jest.fn((key: string, value: string) => {
        attributes[key] = value;
      }),
      getAttribute: jest.fn((key: string) => attributes[key] ?? null),
      appendChild: jest.fn((child: any) => {
        children.push(child);
        child.parentNode = element;
      }),
      removeChild: jest.fn((child: any) => {
        var idx = children.indexOf(child);
        if (idx >= 0) children.splice(idx, 1);
      }),
      addEventListener: jest.fn((type: string, handler: Function) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      }),
      removeEventListener: jest.fn((type: string, handler: Function) => {
        listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
      }),
      querySelector: jest.fn().mockReturnValue(null),
      insertAdjacentHTML: jest.fn(),
      parentNode: null,
    };
    return element;
  }

  function makeFetchMock(payload: unknown) {
    return jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(payload),
    });
  }

  function makeContext(zone: any, fetchMock: any, sessionStore: Record<string, string>) {
    const scheduled: Array<{ cb: Function; ms: number }> = [];
    const fakeSetTimeout = jest.fn((cb: Function, ms: number) => {
      scheduled.push({ cb, ms });
      return scheduled.length;
    });
    const bodyChildren: any[] = [];
    const body = {
      appendChild: jest.fn((child: any) => {
        bodyChildren.push(child);
        child.parentNode = body;
      }),
      removeChild: jest.fn((child: any) => {
        var idx = bodyChildren.indexOf(child);
        if (idx >= 0) bodyChildren.splice(idx, 1);
      }),
      children: bodyChildren,
    };
    const documentListeners: Record<string, Function[]> = {};
    const documentMock: any = {
      readyState: 'complete',
      referrer: '',
      currentScript: { src: 'https://engine.test/assets/publisher_tag.js' },
      querySelectorAll: jest.fn().mockReturnValue([zone]),
      addEventListener: jest.fn((type: string, handler: Function) => {
        documentListeners[type] = documentListeners[type] || [];
        documentListeners[type].push(handler);
      }),
      removeEventListener: jest.fn((type: string, handler: Function) => {
        documentListeners[type] = (documentListeners[type] || []).filter(
          (h) => h !== handler,
        );
      }),
      createElement: jest.fn(() => makeFakeElement()),
      body: body,
      listeners: documentListeners,
    };

    return {
      context: {
        URLSearchParams,
        URL,
        Error,
        Number,
        setTimeout: fakeSetTimeout,
        fetch: fetchMock,
        navigator: { language: 'en-US' },
        window: {
          location: { origin: 'https://publisher.test', pathname: '/article', href: 'https://publisher.test/article' },
          innerWidth: 1366,
          innerHeight: 768,
          devicePixelRatio: 2,
          screen: { width: 1920, height: 1080 },
          sessionStorage: {
            getItem: (key: string) => (key in sessionStore ? sessionStore[key] : null),
            setItem: (key: string, value: string) => {
              sessionStore[key] = value;
            },
          },
          open: jest.fn(() => ({ document: { open: jest.fn(), write: jest.fn(), close: jest.fn() } })),
          focus: jest.fn(),
        },
        document: documentMock,
      },
      documentMock,
      body,
      scheduled,
    };
  }

  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('pins a `sticky` family creative to the viewport instead of just dropping it inline', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'STICKY_BANNER',
      renderFamily: 'sticky',
      creative: { html: '<div>sticky ad</div>' },
    });
    const { context } = makeContext(zone, fetchMock, {});

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    expect(zone.style.position).toBe('fixed');
    expect(zone.style.bottom).toBe('0');
    expect(zone.innerHTML).toBe('<div>sticky ad</div>');
    expect(zone.getAttribute('data-ad-network-status')).toBe('rendered');
  });

  it('detaches a `floating` family creative into a fixed body-level element with a working dismiss control', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'FLOATING_CORNER_AD',
      renderFamily: 'floating',
      creative: { html: '<div>floating ad</div>' },
    });
    const sessionStore: Record<string, string> = {};
    const { context, body } = makeContext(zone, fetchMock, sessionStore);

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    expect(body.appendChild).toHaveBeenCalled();
    const wrapper = body.children[0];
    expect(wrapper.style.position).toBe('fixed');

    // The dismiss button is the second child appended to the wrapper.
    const closeBtn = wrapper.children[1];
    const clickHandler = closeBtn.listeners.click[0];
    clickHandler();

    expect(body.removeChild).toHaveBeenCalledWith(wrapper);
    expect(sessionStore['adnetwork_floating_dismissed_42']).toBe('1');
  });

  it('does not re-render a `floating` creative once dismissed this session', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'FLOATING_CORNER_AD',
      renderFamily: 'floating',
      creative: { html: '<div>floating ad</div>' },
    });
    const sessionStore = { adnetwork_floating_dismissed_42: '1' };
    const { context, body } = makeContext(zone, fetchMock, sessionStore);

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    expect(body.appendChild).not.toHaveBeenCalled();
    expect(zone.getAttribute('data-ad-network-status')).toBe('dismissed');
  });

  it('gates a `popup` family creative on the visitor\'s first click, only firing once per session', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'POPUP',
      renderFamily: 'popup',
      creative: { html: '<div>popup ad</div>' },
    });
    const { context, documentMock } = makeContext(zone, fetchMock, {});

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    expect(zone.getAttribute('data-ad-network-status')).toBe('armed');
    expect(context.window.open).not.toHaveBeenCalled();

    const clickHandler = documentMock.listeners.click[0];
    clickHandler({ clientY: 0 });

    expect(context.window.open).toHaveBeenCalledTimes(1);
    expect(context.window.focus).not.toHaveBeenCalled();
    expect(zone.getAttribute('data-ad-network-status')).toBe('rendered');
  });

  it('refocuses the original window for a `popunder` family creative, unlike a plain popup', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'POPUNDER',
      renderFamily: 'popunder',
      creative: { html: '<div>popunder ad</div>' },
    });
    const { context, documentMock } = makeContext(zone, fetchMock, {});

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    const clickHandler = documentMock.listeners.click[0];
    clickHandler({ clientY: 0 });

    expect(context.window.open).toHaveBeenCalledTimes(1);
    expect(context.window.focus).toHaveBeenCalledTimes(1);
  });

  it('shows an `exit_intent` overlay only when the cursor crosses the top of the viewport', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'EXIT_INTENT_POPUP',
      renderFamily: 'exit_intent',
      creative: { html: '<div>exit intent ad</div>' },
    });
    const { context, documentMock, body } = makeContext(zone, fetchMock, {});

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    const moveHandler = documentMock.listeners.mousemove[0];
    moveHandler({ clientY: 200 });
    expect(body.appendChild).not.toHaveBeenCalled();

    moveHandler({ clientY: 0 });
    expect(body.appendChild).toHaveBeenCalled();
    expect(zone.getAttribute('data-ad-network-status')).toBe('rendered');
  });

  it('shows an `interstitial` full-screen overlay once per session and auto-dismisses after the skip window', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'INTERSTITIAL',
      renderFamily: 'interstitial',
      creative: { html: '<div data-skip-after="5">interstitial ad</div>' },
    });
    const sessionStore: Record<string, string> = {};
    const { context, body, scheduled } = makeContext(zone, fetchMock, sessionStore);

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    expect(body.appendChild).toHaveBeenCalledTimes(1);
    const overlay = body.children[0];

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].ms).toBe(5000);
    scheduled[0].cb();

    expect(body.removeChild).toHaveBeenCalledWith(overlay);
  });

  it('renders a `native` family creative inline, preserving the server-built "Sponsored" wrapper', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'IN_FEED',
      renderFamily: 'native',
      creative: {
        html: '<div class="adnetwork-native"><span>Sponsored</span><div>native ad</div></div>',
      },
    });
    const { context } = makeContext(zone, fetchMock, {});

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    expect(zone.innerHTML).toContain('Sponsored');
    expect(zone.getAttribute('data-ad-network-status')).toBe('rendered');
  });

  it('never attempts to render a `newsletter` family creative client-side', async () => {
    const zone = makeFakeElement();
    zone.setAttribute('data-zone-id', '42');
    const fetchMock = makeFetchMock({
      format: 'NEWSLETTER_SPONSORSHIP',
      renderFamily: 'newsletter',
      creative: { html: '<table>newsletter</table>' },
    });
    const { context, body } = makeContext(zone, fetchMock, {});

    vm.runInNewContext(tagSource, context);
    await flushMicrotasks();

    expect(zone.innerHTML).toBe('');
    expect(body.appendChild).not.toHaveBeenCalled();
    expect(zone.getAttribute('data-ad-network-status')).toBe('unsupported');
  });
});
