(function () {
  'use strict';

  // Publishers embed this script cross-origin (on their own site), so every
  // API call must be an absolute URL pointing back at the ad server - a
  // relative path like '/api/v1/serve' would resolve against the EMBEDDING
  // page's origin instead and always 404. document.currentScript.src is
  // only reliable during this synchronous top-level execution, so capture
  // it now rather than inside the async fetch handlers below.
  var AD_SERVER_ORIGIN = (function () {
    var thisScript = document.currentScript;

    if (thisScript && thisScript.src) {
      try {
        return new URL(thisScript.src).origin;
      } catch (error) {
        // fall through to same-origin default below
      }
    }

    return window.location.origin;
  })();

  var API_PATH = AD_SERVER_ORIGIN + '/api/v1/serve';
  var ZONE_SELECTOR = '[data-zone-id]';
  var TRAP_PATH = AD_SERVER_ORIGIN + '/api/v1/trap';
  var HONEYPOT_HTML = '<a href="' + TRAP_PATH + '" style="display:none !important;"></a>';
  var MAX_Z_INDEX = '2147483000';

  function buildQuery(zone) {
    var params = new URLSearchParams();
    params.set('zoneId', zone.getAttribute('data-zone-id'));
    params.set('origin', window.location.origin);
    params.set('path', window.location.pathname);
    params.set('referrer', document.referrer || '');
    params.set('viewportWidth', String(window.innerWidth || 0));
    params.set('viewportHeight', String(window.innerHeight || 0));
    params.set('devicePixelRatio', String(window.devicePixelRatio || 1));
    params.set('screenWidth', String((window.screen && window.screen.width) || 0));
    params.set('screenHeight', String((window.screen && window.screen.height) || 0));
    params.set('language', navigator.language || '');

    return params;
  }

  function renderFallback(zone) {
    if (zone.querySelector('[data-ad-network-honeypot]') === null) {
      zone.insertAdjacentHTML(
        'beforeend',
        '<a data-ad-network-honeypot="true" href="' + TRAP_PATH + '" style="display:none !important;"></a>'
      );
    }
    zone.setAttribute('data-ad-network-status', 'empty');
  }

  // ---------------------------------------------------------------------
  // Per-session gating (popups/interstitials/welcome screens/floating
  // dismissals must not re-fire on every single pageview or they'd wreck
  // the visitor experience). sessionStorage is wrapped in try/catch since
  // it throws in some privacy modes/embeds - fails open (treats as "never
  // shown yet") rather than crashing the whole tag.
  // ---------------------------------------------------------------------
  function hasSeen(key) {
    try {
      return window.sessionStorage.getItem(key) === '1';
    } catch (error) {
      return false;
    }
  }

  function markSeen(key) {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch (error) {
      // ignore - worst case this shows once more than intended
    }
  }

  // ---------------------------------------------------------------------
  // Shared DOM helpers
  // ---------------------------------------------------------------------
  function buildOverlay(innerHtml, options) {
    var overlay = document.createElement('div');
    overlay.setAttribute('data-ad-network-overlay', 'true');
    var backgroundStyle = options.dimBackground
      ? 'background:rgba(0,0,0,.6);'
      : '';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;z-index:' +
      MAX_Z_INDEX +
      ';display:flex;align-items:center;justify-content:center;' +
      backgroundStyle;

    var panel = document.createElement('div');
    panel.style.cssText = options.fullscreen
      ? 'position:relative;width:100%;height:100%;'
      : 'position:relative;max-width:92vw;max-height:92vh;';
    panel.innerHTML = innerHtml;

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close ad');
    closeBtn.textContent = '×';
    closeBtn.style.cssText =
      'position:absolute;top:8px;right:8px;width:28px;height:28px;' +
      'border:none;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;' +
      'font-size:18px;line-height:28px;cursor:pointer;z-index:1;';
    closeBtn.addEventListener('click', function () {
      removeOverlay(overlay);
      if (options.onClose) {
        options.onClose();
      }
    });

    panel.appendChild(closeBtn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    if (options.autoDismissAfterMs) {
      setTimeout(function () {
        removeOverlay(overlay);
        if (options.onDismiss) {
          options.onDismiss();
        }
      }, options.autoDismissAfterMs);
    }

    return overlay;
  }

  function removeOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function skipAfterMs(html) {
    var match = /data-skip-after="(\d+)"/.exec(html || '');
    var seconds = match ? Number(match[1]) : 5;

    return (Number.isFinite(seconds) ? seconds : 5) * 1000;
  }

  // ---------------------------------------------------------------------
  // Render families - see RENDER_FAMILY_BY_FORMAT in
  // backend/src/common/ad-formats.ts for which format maps to which of
  // these. Every family ends by marking the zone's
  // data-ad-network-status so publishers/QA can inspect what happened.
  // ---------------------------------------------------------------------

  // Plain in-place render - covers `inline` (most banners/native/video
  // markup, which already carries its own styling from the /serve
  // response) and any unrecognized/legacy family.
  function renderInline(zone, payload) {
    zone.innerHTML = payload.creative.html || HONEYPOT_HTML;
    zone.setAttribute('data-ad-network-status', 'rendered');
  }

  // Stays where the publisher placed the <section> but pins itself to the
  // viewport while scrolling - CSS only, no relocation in the DOM.
  function renderSticky(zone, payload) {
    if (payload.format === 'STICKY_SIDEBAR') {
      zone.style.position = 'sticky';
      zone.style.top = '0';
    } else {
      // STICKY_BANNER - pin to the bottom of the viewport, the common
      // mobile/desktop sticky-banner placement.
      zone.style.position = 'fixed';
      zone.style.left = '0';
      zone.style.right = '0';
      zone.style.bottom = '0';
    }
    zone.style.zIndex = MAX_Z_INDEX;
    renderInline(zone, payload);
  }

  var FLOATING_CORNER_STYLE = {
    FLOATING_SIDEBAR: 'top:120px;right:16px;',
    FLOATING_OVERLAY: 'bottom:16px;right:16px;',
    FLOATING_CORNER_AD: 'bottom:12px;right:12px;',
    STICKY_BOTTOM_BANNER: 'left:0;right:0;bottom:0;width:100%;',
  };

  // Detaches from normal page flow entirely into a `position:fixed`
  // element appended to <body>, with a dismiss control the visitor can use
  // to hide it for the rest of the session.
  function renderFloating(zone, payload) {
    var dismissKey = 'adnetwork_floating_dismissed_' + payload.zoneId;

    if (hasSeen(dismissKey)) {
      zone.setAttribute('data-ad-network-status', 'dismissed');
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.setAttribute('data-ad-network-floating', 'true');
    wrapper.style.cssText =
      'position:fixed;z-index:' +
      MAX_Z_INDEX +
      ';' +
      (FLOATING_CORNER_STYLE[payload.format] || FLOATING_CORNER_STYLE.FLOATING_CORNER_AD);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close ad');
    closeBtn.textContent = '×';
    closeBtn.style.cssText =
      'position:absolute;top:-10px;right:-10px;width:22px;height:22px;' +
      'border:none;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;' +
      'font-size:14px;line-height:22px;cursor:pointer;';
    closeBtn.addEventListener('click', function () {
      removeOverlay(wrapper);
      markSeen(dismissKey);
    });

    var content = document.createElement('div');
    content.innerHTML = payload.creative.html || HONEYPOT_HTML;

    wrapper.appendChild(content);
    wrapper.appendChild(closeBtn);
    document.body.appendChild(wrapper);
    zone.setAttribute('data-ad-network-status', 'rendered');
  }

  var GESTURE_WINDOW_SIZE = { width: 640, height: 480 };

  // Opens a real browser window/tab on the visitor's first click anywhere
  // on the page - a user gesture is required or the browser's popup
  // blocker silently swallows window.open. `popunder` immediately refocuses
  // the original tab afterward so the new window ends up behind it -
  // that's the entire difference between the two.
  function renderGestureWindow(zone, payload, isPopunder) {
    var key = 'adnetwork_popup_shown_' + payload.zoneId;

    if (hasSeen(key)) {
      zone.setAttribute('data-ad-network-status', 'skipped');
      return;
    }

    zone.setAttribute('data-ad-network-status', 'armed');

    function trigger() {
      document.removeEventListener('click', trigger, true);

      if (hasSeen(key)) {
        return;
      }
      markSeen(key);

      var win = window.open(
        'about:blank',
        '_blank',
        'width=' + GESTURE_WINDOW_SIZE.width + ',height=' + GESTURE_WINDOW_SIZE.height
      );

      if (win && win.document) {
        win.document.open();
        win.document.write(payload.creative.html || HONEYPOT_HTML);
        win.document.close();
      }

      if (isPopunder && win) {
        window.focus();
      }

      zone.setAttribute('data-ad-network-status', 'rendered');
    }

    document.addEventListener('click', trigger, true);
  }

  // Shows a centered modal the moment the cursor crosses the top edge of
  // the viewport heading for the tab/URL bar - the standard exit-intent
  // signal, since a real mouseleave-the-page event doesn't exist.
  function renderExitIntent(zone, payload) {
    var key = 'adnetwork_exit_intent_shown_' + payload.zoneId;

    if (hasSeen(key)) {
      zone.setAttribute('data-ad-network-status', 'skipped');
      return;
    }

    zone.setAttribute('data-ad-network-status', 'armed');

    function onMouseMove(event) {
      if (event.clientY > 0) {
        return;
      }

      document.removeEventListener('mousemove', onMouseMove);
      markSeen(key);
      buildOverlay(payload.creative.html || HONEYPOT_HTML, { dimBackground: true });
      zone.setAttribute('data-ad-network-status', 'rendered');
    }

    document.addEventListener('mousemove', onMouseMove);
  }

  // Full-page greeting shown once per session, immediately on load.
  function renderWelcomeScreen(zone, payload) {
    var key = 'adnetwork_welcome_shown';

    if (hasSeen(key)) {
      zone.setAttribute('data-ad-network-status', 'skipped');
      return;
    }

    markSeen(key);
    buildOverlay(payload.creative.html || HONEYPOT_HTML, {
      dimBackground: true,
      fullscreen: true,
    });
    zone.setAttribute('data-ad-network-status', 'rendered');
  }

  // Covers the entire screen on load, once per session, auto-dismissing
  // after the creative's `data-skip-after` hint (default 5s) or a visitor
  // click on the close button, whichever comes first.
  function renderInterstitial(zone, payload) {
    var key = 'adnetwork_interstitial_shown_' + payload.zoneId;

    if (hasSeen(key)) {
      zone.setAttribute('data-ad-network-status', 'skipped');
      return;
    }

    markSeen(key);
    var html = payload.creative.html || HONEYPOT_HTML;
    buildOverlay(html, {
      dimBackground: true,
      fullscreen: true,
      autoDismissAfterMs: skipAfterMs(html),
    });
    zone.setAttribute('data-ad-network-status', 'rendered');
  }

  // Intercepts the visitor's next same-origin navigation and shows a brief
  // full-screen interstitial before letting it proceed. Only catches real
  // <a href> clicks - it cannot see client-side SPA router navigations
  // that don't go through an anchor element.
  function renderPageTransition(zone, payload) {
    var key = 'adnetwork_page_transition_shown';

    if (hasSeen(key)) {
      zone.setAttribute('data-ad-network-status', 'skipped');
      return;
    }

    zone.setAttribute('data-ad-network-status', 'armed');

    function onClick(event) {
      var target = event.target;
      var link = target && target.closest ? target.closest('a[href]') : null;

      if (!link || hasSeen(key)) {
        return;
      }

      var destination;
      try {
        destination = new URL(link.href, window.location.href);
      } catch (error) {
        return;
      }

      if (destination.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      markSeen(key);
      document.removeEventListener('click', onClick, true);

      var html = payload.creative.html || HONEYPOT_HTML;
      buildOverlay(html, { dimBackground: true, fullscreen: true });
      zone.setAttribute('data-ad-network-status', 'rendered');

      setTimeout(function () {
        window.location.href = link.href;
      }, skipAfterMs(html) || 1000);
    }

    document.addEventListener('click', onClick, true);
  }

  // Newsletter Sponsorship never loads through this tag at all (email
  // clients don't run JS) - see PublisherService.getNewsletterSnippet. If
  // one somehow ends up embedded on a live page anyway, render nothing
  // rather than erroring.
  function renderNewsletter(zone) {
    zone.setAttribute('data-ad-network-status', 'unsupported');
  }

  var FAMILY_RENDERERS = {
    inline: renderInline,
    sticky: renderSticky,
    floating: renderFloating,
    native: renderInline,
    popup: function (zone, payload) {
      renderGestureWindow(zone, payload, false);
    },
    popunder: function (zone, payload) {
      renderGestureWindow(zone, payload, true);
    },
    exit_intent: renderExitIntent,
    welcome_screen: renderWelcomeScreen,
    interstitial: renderInterstitial,
    page_transition: renderPageTransition,
    video: renderInline,
    video_overlay: renderInline,
    newsletter: renderNewsletter,
  };

  function renderCreative(zone, payload) {
    var renderer = FAMILY_RENDERERS[payload.renderFamily] || renderInline;
    renderer(zone, payload);
  }

  function requestAd(zone) {
    var zoneId = zone.getAttribute('data-zone-id');

    if (!zoneId || zone.getAttribute('data-ad-network-loaded') === 'true') {
      return;
    }

    zone.setAttribute('data-ad-network-loaded', 'true');

    fetch(API_PATH + '?' + buildQuery(zone).toString(), {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      keepalive: true,
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Ad request failed');
        }

        return response.json();
      })
      .then(function (payload) {
        if (!payload || !payload.creative || !payload.creative.html) {
          renderFallback(zone);
          return;
        }

        renderCreative(zone, {
          zoneId: zoneId,
          format: payload.format,
          renderFamily: payload.renderFamily,
          creative: payload.creative,
        });
      })
      .catch(function () {
        zone.setAttribute('data-ad-network-status', 'failed');
      });
  }

  function boot() {
    var zones = document.querySelectorAll(ZONE_SELECTOR);

    for (var index = 0; index < zones.length; index += 1) {
      requestAd(zones[index]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
