(function () {
  'use strict';

  var API_PATH = '/api/v1/serve';
  var ZONE_SELECTOR = '[data-zone-id]';
  var HONEYPOT_HTML = '<a href="/api/v1/trap" style="display:none !important;"></a>';

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
        '<a data-ad-network-honeypot="true" href="/api/v1/trap" style="display:none !important;"></a>'
      );
    }
    zone.setAttribute('data-ad-network-status', 'empty');
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

        zone.innerHTML = payload.creative.html || HONEYPOT_HTML;
        zone.setAttribute('data-ad-network-status', 'rendered');
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
