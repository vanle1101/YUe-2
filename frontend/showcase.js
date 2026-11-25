/* Example songs: cover marquee under the header + persistent bottom player.
   Tracks come from showcase-data.js; audio and covers stream from the public
   bucket. The strip loops two copies of the covers (CSS animation); one <audio>
   element backs the bar and covers just switch its source. "Use this example"
   hands the playing song's prompt + lyrics to the composer in app.js. */
(() => {
  'use strict';

  const TRACKS = Array.isArray(window.YUE2_SHOWCASE) ? window.YUE2_SHOWCASE : [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);

  const copy = {
    en: {
      strip: 'Example songs, tap to play', bar: 'Now playing', play: 'Play', pause: 'Pause', prev: 'Previous', next: 'Next',
      close: 'Close', seek: 'Seek', use: 'Make similar', useAria: 'Fill this song’s description and lyrics into Text to Song',
      coverUse: 'Cover it', coverUseAria: 'Use this song as the original in Cover and fill in its lyrics',
    },
    zh: {
      strip: '示例歌曲，点击试听', bar: '正在播放', play: '播放', pause: '暂停', prev: '上一首', next: '下一首',
      close: '关闭', seek: '进度', use: '同款生成', useAria: '把这首的描述和歌词填入文字生成',
      coverUse: '翻唱这首', coverUseAria: '把这首歌作为原曲填入翻唱模式，并带上它的歌词',
    },
  };
  const lang = () => ($('languageToggle')?.dataset.language === 'zh' ? 'zh' : 'en');
  const t = key => copy[lang()][key];
  const genreOf = track => track.genre?.[lang()] || track.genre?.en || '';
  const formatTime = seconds => {
    const total = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
  const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const strip = $('coverStrip');
  const rail = $('coverStripTrack');
  const bar = $('playerBar');
  if (!strip || !rail || !bar || !TRACKS.length) { strip?.remove(); bar?.remove(); return; }

  const el = {
    disc: $('playerDisc'), cover: $('playerCover'), title: $('playerTitle'), genre: $('playerGenre'),
    toggle: $('playerToggle'), prev: $('playerPrev'), next: $('playerNext'),
    time: $('playerTime'), duration: $('playerDuration'), track: $('playerTrack'), fill: $('playerFill'),
    use: $('playerUse'), useText: $('playerUseText'), coverUse: $('playerCoverUse'), coverUseText: $('playerCoverUseText'),
    close: $('playerClose'),
  };

  const playSvg = '<svg class="ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
  const pauseSvg = '<svg class="ico-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>';
  const item = (song, index, clone) => `
    <button class="strip-item" type="button" data-index="${index}" aria-label="${escapeHtml(song.title)}" ${clone ? 'tabindex="-1" aria-hidden="true"' : ''}>
      <span class="strip-disc"><img src="${escapeHtml(song.cover)}" alt="" width="256" height="256" ${clone ? 'loading="lazy"' : ''} /></span>
      <span class="strip-btn">${playSvg}${pauseSvg}</span>
    </button>`;
  // two copies → translateX(-50%) loops seamlessly; the copy is inert for a11y
  rail.innerHTML = TRACKS.map((song, index) => item(song, index, false)).join('') + TRACKS.map((song, index) => item(song, index, true)).join('');
  const items = [...rail.querySelectorAll('.strip-item')];

  const audio = new Audio();
  audio.preload = 'none';
  let current = -1;
  let barOpen = false;

  /* Only one thing should sound at a time. app.js / cover.js keep their <audio>
     elements detached from the DOM, so coordinate at the prototype: any other
     media starting pauses the showcase, and the showcase pauses whatever it saw. */
  const liveMedia = new Set();
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play(...args) {
    if (this !== audio && !audio.paused) audio.pause();
    liveMedia.add(this);
    return nativePlay.apply(this, args);
  };
  const pauseOtherMedia = () => liveMedia.forEach(media => {
    if (media === audio) return;
    if (media.paused) liveMedia.delete(media); else media.pause();
  });

  function applyLanguage() {
    strip.setAttribute('aria-label', t('strip'));
    bar.setAttribute('aria-label', t('bar'));
    items.forEach(node => {
      const track = TRACKS[Number(node.dataset.index)];
      node.title = `${track.title} · ${genreOf(track)}`;
    });
    if (current >= 0) el.genre.textContent = genreOf(TRACKS[current]);
    [['use', 'use'], ['coverUse', 'coverUse']].forEach(([name, key]) => {
      el[`${name}Text`].textContent = t(key);
      el[name].setAttribute('aria-label', t(`${key}Aria`));
      el[name].title = t(`${key}Aria`);
    });
    const labels = { prev: 'prev', next: 'next', close: 'close', track: 'seek' };
    Object.entries(labels).forEach(([name, key]) => el[name].setAttribute('aria-label', t(key)));
    syncState();
  }

  /* A record clicked on the strip flies along an arc into the bar's platter. */
  function flyDisc(fromNode, dst, onLand) {
    const src = fromNode.querySelector('.strip-disc').getBoundingClientRect();
    const clone = document.createElement('span');
    clone.className = 'strip-disc fly-disc';
    clone.innerHTML = `<img src="${escapeHtml(TRACKS[current].cover)}" alt="" width="256" height="256" />`;
    Object.assign(clone.style, { left: `${src.left}px`, top: `${src.top}px`, width: `${src.width}px`, height: `${src.height}px` });
    document.body.appendChild(clone);
    const p0 = { x: src.left + src.width / 2, y: src.top + src.height / 2 };
    const p1 = { x: dst.left + dst.width / 2, y: dst.top + dst.height / 2 };
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    // bow the arc away from the screen centre
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ctrl = [1, -1]
      .map(sign => ({ x: mid.x - (sign * dy / len) * len * 0.16, y: mid.y + (sign * dx / len) * len * 0.16 }))
      .sort((a, b) => Math.hypot(b.x - centre.x, b.y - centre.y) - Math.hypot(a.x - centre.x, a.y - centre.y))[0];
    const endScale = dst.width / src.width;
    const frames = Array.from({ length: 17 }, (_, i) => {
      const s = i / 16;
      const u = 1 - s;
      const x = u * u * p0.x + 2 * u * s * ctrl.x + s * s * p1.x - p0.x;
      const y = u * u * p0.y + 2 * u * s * ctrl.y + s * s * p1.y - p0.y;
      return { transform: `translate(${x}px, ${y}px) scale(${1 + (endScale - 1) * s}) rotate(${540 * s}deg)` };
    });
    const flight = clone.animate(frames, { duration: 850, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' });
    flight.onfinish = () => { clone.remove(); onLand(); };
  }

  function punchDisc() {
    if (reduceMotion) return;
    el.disc.animate([{ transform: 'scale(.86)' }, { transform: 'scale(1.06)', offset: 0.55 }, { transform: 'scale(1)' }], { duration: 480, easing: 'ease-out' });
  }

  function openBar() {
    if (barOpen) return;
    barOpen = true;
    bar.removeAttribute('inert');
    bar.setAttribute('aria-hidden', 'false');
    bar.classList.add('is-open');
    document.body.classList.add('has-player');
  }

  function closeBar() {
    if (!barOpen) return;
    barOpen = false;
    bar.setAttribute('inert', '');
    bar.setAttribute('aria-hidden', 'true');
    bar.classList.remove('is-open');
    document.body.classList.remove('has-player');
  }

  // Where the platter will sit once the bar has slid up — measured with the
  // slide transition suspended so the flight can aim at its final position.
  function settledDiscRect() {
    bar.classList.add('is-measuring', 'is-open');
    const rect = el.disc.getBoundingClientRect();
    bar.classList.remove('is-open');
    void bar.offsetWidth;
    bar.classList.remove('is-measuring');
    return rect;
  }

  function syncState() {
    const playing = current >= 0 && !audio.paused;
    items.forEach(node => {
      const index = Number(node.dataset.index);
      node.classList.toggle('is-active', index === current);
      node.classList.toggle('is-playing', index === current && playing);
    });
    bar.classList.toggle('is-playing', playing);
    el.toggle.setAttribute('aria-label', t(playing ? 'pause' : 'play'));
    el.disc.setAttribute('aria-label', t(playing ? 'pause' : 'play'));
  }

  function paint() {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : TRACKS[current]?.seconds || 0;
    const ratio = duration ? Math.min(1, audio.currentTime / duration) : 0;
    el.fill.style.width = `${ratio * 100}%`;
    el.time.textContent = formatTime(audio.currentTime);
    el.duration.textContent = formatTime(duration);
    el.track.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  }

  function load(index, fromNode) {
    current = (index + TRACKS.length) % TRACKS.length;
    const track = TRACKS[current];
    audio.src = track.audio;
    el.title.textContent = track.title;
    el.genre.textContent = genreOf(track);
    el.fill.style.width = '0%';
    el.time.textContent = '0:00';
    el.duration.textContent = formatTime(track.seconds);
    const setCover = () => { el.cover.src = track.cover; };
    const fly = fromNode && !reduceMotion;
    if (!barOpen) {
      setCover();
      if (fly) {
        const target = settledDiscRect();
        el.disc.classList.add('is-waiting');
        openBar();
        flyDisc(fromNode, target, () => { el.disc.classList.remove('is-waiting'); punchDisc(); });
      } else openBar();
    } else if (fly) {
      flyDisc(fromNode, el.disc.getBoundingClientRect(), () => { setCover(); punchDisc(); });
    } else {
      setCover();
      punchDisc();
    }
    syncState();
  }

  function trackEvent(name, status, properties = {}, track = TRACKS[current]) {
    if (!track) return;
    window.yueAnalytics?.track(name, { mode: 'site', status, properties: { track: track.n, track_language: track.lang, ...properties } });
  }

  async function play(index, fromNode, source = 'bar') {
    let started = false;
    if (index !== undefined && index !== current) { load(index, fromNode); started = true; }
    if (current < 0) { load(0, fromNode); started = true; }
    if (started) trackEvent('showcase_played', 'started', { source });
    pauseOtherMedia();
    try { await audio.play(); } catch { /* autoplay refused — user can press play */ }
    syncState();
  }

  const toggle = () => { if (audio.paused) play(); else audio.pause(); };

  function seekTo(ratio) {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (!duration) return;
    audio.currentTime = Math.max(0, Math.min(duration - 0.05, ratio * duration));
    paint();
  }

  rail.addEventListener('click', event => {
    const node = event.target.closest('.strip-item');
    if (!node) return;
    const index = Number(node.dataset.index);
    node.blur();
    if (index === current) toggle(); else play(index, node, 'strip');
  });
  el.toggle.addEventListener('click', toggle);
  el.disc.addEventListener('click', () => { toggle(); punchDisc(); });
  el.prev.addEventListener('click', () => play(current - 1));
  el.next.addEventListener('click', () => play(current + 1));
  el.track.addEventListener('click', event => {
    const rect = el.track.getBoundingClientRect();
    seekTo((event.clientX - rect.left) / rect.width);
  });
  el.track.addEventListener('keydown', event => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!duration || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
    event.preventDefault();
    seekTo((audio.currentTime + (event.key === 'ArrowRight' ? 5 : -5)) / duration);
  });
  const fillStatus = { filled: 'completed', cancelled: 'cancelled', failed: 'failed' };
  el.use.addEventListener('click', async () => {
    const track = TRACKS[current];
    if (!track || !window.yueComposer) return;
    const result = await window.yueComposer.fill({ title: track.title, prompt: track.prompt, lyrics: track.lyrics });
    trackEvent('showcase_filled', fillStatus[result], { source: 'text' }, track);
  });
  el.coverUse.addEventListener('click', async () => {
    const track = TRACKS[current];
    if (!track || !window.yueCoverHistory?.fillExample) return;
    el.coverUse.classList.add('is-loading');
    try {
      const result = await window.yueCoverHistory.fillExample({ title: track.title, audio: track.audio, lyrics: track.lyrics });
      trackEvent('showcase_filled', fillStatus[result], { source: 'cover' }, track);
    } finally {
      el.coverUse.classList.remove('is-loading');
    }
  });
  el.close.addEventListener('click', () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    current = -1;
    closeBar();
    syncState();
  });
  ['play', 'pause'].forEach(name => audio.addEventListener(name, syncState));
  audio.addEventListener('ended', () => {
    trackEvent('showcase_completed', 'completed', { source: 'auto' });
    play(current + 1, undefined, 'auto');
  });
  audio.addEventListener('timeupdate', paint);
  audio.addEventListener('loadedmetadata', paint);
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    el.time.textContent = '--:--';
    syncState();
  });
  $('languageToggle')?.addEventListener('click', () => queueMicrotask(applyLanguage));

  applyLanguage();
})();
