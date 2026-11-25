(() => {
  'use strict';

  const MAX_USES = 999999;
  const mockMode = new URLSearchParams(location.search).get('mock') === '1';
  let used = 0;
  let pending;

  function setUsed() {
    used = 0;
    window.dispatchEvent(new Event('yue:quota'));
  }

  async function refresh() {
    if (mockMode) return;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetch('/api/quota', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) return;
        return await response.json();
      } catch (_) {
        // Keep unlimited local quota when server is starting up.
      }
    })();
    try { return await pending; } finally { pending = null; }
  }

  window.yueGenerationQuota = { get used() { return used; }, setUsed, refresh, MAX_USES };
})();
