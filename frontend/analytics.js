(() => {
  'use strict';

  const mockMode = new URLSearchParams(location.search).get('mock') === '1';
  const SESSION_KEY = 'meet-yue2-analytics-session-v1';
  const newId = () => crypto.randomUUID().replaceAll('-', '_');
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId || !/^[A-Za-z0-9_-]{8,96}$/.test(sessionId)) {
    sessionId = newId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  const language = () => document.getElementById('languageToggle')?.dataset.language === 'zh' ? 'zh' : 'en';
  const activeMode = () => document.body.classList.contains('cover-mode') ? 'cover' : 'text';

  // noiz.ai's GA4 property; cross-domain linker keeps one client_id from yue2 into noiz.ai.
  const GA4_ID = 'G-DHXRM91N5G';
  const UTM = { utm_source: 'yue2-public', utm_medium: 'referral', utm_campaign: 'yue2_public' };
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (!mockMode) {
    gtag('js', new Date());
    gtag('config', GA4_ID, { linker: { domains: ['noiz.ai'] } });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(tag);
  }

  // Ad click ids must reach noiz.ai as plain query parameters. noiz.ai's own attribution reads them from the
  // URL; the linker's `_gl` only rides along when a link is clicked, never on a script redirect. They are kept
  // for this tab only (sessionStorage) and only go to the main site, never to developers.noiz.ai or other hosts.
  // utm_* is deliberately not forwarded: the outbound UTM above still says where the visit was handed over.
  const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id', 'twclid'];
  const CLICK_ID_KEY = 'meet-yue2-click-ids-v1';
  const CLICK_ID_HOSTS = ['noiz.ai', 'www.noiz.ai', 'test.noiz.ai'];

  function pickClickIds(read) {
    const found = {};
    for (const key of CLICK_ID_PARAMS) {
      const value = read(key);
      if (typeof value === 'string' && value) found[key] = value;
    }
    return found;
  }

  const visitClickIds = (() => {
    let stored = {};
    try {
      const saved = JSON.parse(sessionStorage.getItem(CLICK_ID_KEY) || '{}');
      stored = pickClickIds(key => saved?.[key]);
    } catch { /* unreadable storage: the landing URL still counts */ }
    const fromUrl = new URLSearchParams(location.search);
    const merged = { ...stored, ...pickClickIds(key => fromUrl.get(key)) };
    if (Object.keys(merged).length) {
      try { sessionStorage.setItem(CLICK_ID_KEY, JSON.stringify(merged)); } catch { /* keep going without storage */ }
    }
    return merged;
  })();

  function outboundUrl(source, url = 'https://noiz.ai/create/music') {
    const target = new URL(url, location.href);
    for (const [key, value] of Object.entries(UTM)) target.searchParams.set(key, value);
    if (source) target.searchParams.set('utm_content', source);
    if (CLICK_ID_HOSTS.includes(target.hostname)) {
      for (const [key, value] of Object.entries(visitClickIds)) {
        if (!target.searchParams.has(key)) target.searchParams.set(key, value);
      }
    }
    return target.toString();
  }

  function sendToGa4(payload) {
    if (mockMode || payload.event_name === 'page_view') return; // gtag config already sends page_view
    const params = { mode: payload.mode, language: payload.language };
    if (payload.status) params.status = payload.status;
    if (payload.duration_ms !== undefined) params.duration_ms = payload.duration_ms;
    for (const [key, value] of Object.entries(payload.properties || {})) {
      if (['string', 'number', 'boolean'].includes(typeof value)) params[key] = value;
    }
    gtag('event', payload.event_name, params);
  }

  document.querySelectorAll('a[data-outbound-source]').forEach(link => {
    const host = new URL(link.href, location.href).hostname;
    if (host === 'noiz.ai' || host.endsWith('.noiz.ai')) link.href = outboundUrl(link.dataset.outboundSource, link.href);
  });

  function track(eventName, detail = {}) {
    const payload = {
      event_id: newId(),
      session_id: sessionId,
      event_name: eventName,
      mode: detail.mode || activeMode(),
      language: detail.language || language(),
    };
    if (detail.status) payload.status = detail.status;
    if (Number.isInteger(detail.duration_ms)) payload.duration_ms = Math.max(0, Math.min(86_400_000, detail.duration_ms));
    if (detail.job_id) payload.job_id = String(detail.job_id).slice(0, 128);
    if (detail.generation_id) payload.generation_id = String(detail.generation_id).slice(0, 128);
    if (detail.candidate_id) payload.candidate_id = String(detail.candidate_id).slice(0, 128);
    if (detail.properties && Object.keys(detail.properties).length) payload.properties = detail.properties;
    sendToGa4(payload);
    if (mockMode) return Promise.resolve({ mock: true, payload });
    return fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => undefined);
  }

  function trackOutbound(source, destination = 'noiz.ai', mode = activeMode()) {
    return track('outbound_link_clicked', {
      mode,
      status: 'clicked',
      properties: { source, destination },
    });
  }

  window.yueAnalytics = { track, trackOutbound, outboundUrl, clickIds: () => ({ ...visitClickIds }), mode: activeMode, language };

  document.getElementById('languageToggle')?.addEventListener('click', () => queueMicrotask(() => {
    track('language_changed', { mode: 'site', status: 'clicked', properties: { source: language() } });
  }));
  document.getElementById('textModeTab')?.addEventListener('click', () => queueMicrotask(() => {
    track('mode_selected', { mode: 'text', status: 'clicked' });
  }));
  document.getElementById('coverModeTab')?.addEventListener('click', () => queueMicrotask(() => {
    track('mode_selected', { mode: 'cover', status: 'clicked' });
  }));
  document.getElementById('historyButton')?.addEventListener('click', () => {
    track('history_opened', { status: 'clicked' });
  });
  document.addEventListener('click', event => {
    const outbound = event.target.closest?.('[data-outbound-source]');
    if (outbound) {
      trackOutbound(
        outbound.dataset.outboundSource,
        outbound.dataset.outboundDestination || 'noiz.ai',
        outbound.id === 'developerApiLink' || outbound.classList.contains('brand') || outbound.classList.contains('explore')
          ? 'site' : activeMode(),
      );
    }
    const download = event.target.closest?.('.download-button');
    if (!download) return;
    const card = download.closest('[data-job-id], [data-cover-job]');
    const jobId = card?.dataset.jobId || card?.dataset.coverJob;
    const rows = [...(download.closest('.candidate-list')?.querySelectorAll('.download-button') || [])];
    track('audio_downloaded', {
      job_id: jobId,
      generation_id: download.dataset.generationId || jobId,
      candidate_id: download.dataset.candidateId || undefined,
      status: 'clicked',
      properties: { variant: Number(download.dataset.variant) || Math.max(1, rows.indexOf(download) + 1) },
    });
  });

  queueMicrotask(() => track('page_view', { mode: activeMode(), status: 'viewed' }));
})();
