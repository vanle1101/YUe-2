(() => {
  'use strict';

  const MAX_USES = 3;
  const KEY = 'meet-yue2-generation-usage-v2';
  const legacyKeys = ['meet-yue2-successful-submissions-v1', 'meet-yue2-cover-successful-submissions-v1'];
  const mockMode = new URLSearchParams(location.search).get('mock') === '1';
  const count = value => Math.max(0, Number(value) || 0);
  let used = localStorage.getItem(KEY) === null
    ? legacyKeys.reduce((total, key) => total + count(localStorage.getItem(key)), 0)
    : count(localStorage.getItem(KEY));
  let pending;

  function setUsed(value) {
    used = Math.min(MAX_USES, count(value));
    if (!mockMode) localStorage.setItem(KEY, String(used));
    window.dispatchEvent(new Event('yue:quota'));
  }

  async function refresh() {
    if (mockMode) return;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetch('/api/quota', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) return;
        const quota = await response.json();
        if (Number.isFinite(quota.remaining)) setUsed(MAX_USES - quota.remaining);
        return quota;
      } catch (_) {
        // Keep the shared local estimate until the server is reachable again.
      }
    })();
    try { return await pending; } finally { pending = null; }
  }

  window.yueGenerationQuota = { get used() { return used; }, setUsed, refresh };
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) {
      used = count(localStorage.getItem(KEY));
      window.dispatchEvent(new Event('yue:quota'));
      void refresh();
    }
  });
  window.addEventListener('focus', () => { void refresh(); });
})();
