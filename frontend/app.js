(() => {
  'use strict';

  const API = '/api';
  const HISTORY_KEY = 'meet-yue2-history-v1';
  const PENDING_KEY = 'meet-yue2-pending-v1';
  const LANGUAGE_KEY = 'meet-yue2-language-v1';
  const MAX_USES = 3;
  const params = new URLSearchParams(location.search);
  const mockMode = params.get('mock') === '1';
  const terminal = new Set(['succeeded', 'truncated', 'partial_failed', 'failed', 'cancelled']);
  const $ = id => document.getElementById(id);
  const state = {
    voice: 'auto',
    instrumental: false,
    styles: [],
    histories: mockMode ? [] : readJson(localStorage, HISTORY_KEY, []),
    coverHistories: [],
    used: mockMode && params.has('used')
      ? Math.max(0, Number(params.get('used')) || 0)
      : window.yueGenerationQuota.used,
    pollTimers: new Map(),
    tipTimers: new Map(),
    tipIndexes: new Map(),
    players: new Map(),
    submitting: false,
    forceHome: true,
    composerCollapsed: false,
    suppressScrollTracker: false,
    lastConversationScrollTop: 0,
    lastWindowScrollY: window.scrollY,
    scrollGuardTimer: null,
    mockPollCounts: new Map(),
    mockAudioUrls: null,
    visibleJobIds: new Set(),
    visibleJobs: new Map(),
    analyticsTerminalJobs: new Set(),
    language: localStorage.getItem(LANGUAGE_KEY) === 'zh' ? 'zh' : 'en',
  };

  const copy = {
    en: {
      exploreMore: 'Explore more', developerApi: 'Developer API', queue: 'Open noiz music — skip the queue', backHome: 'Back', history: 'History',
      expandComposer: 'Expand composer', continueCreate: 'Create another song', composingCompact: 'Creating your song…',
      promptTitle: 'Song description', promptHint: 'Theme, scene and expression',
      promptPlaceholder: 'A cyberpunk synth-pop song at 120 BPM with a driving beat and female vocals.',
      lyrics: 'Lyrics', lyricsHint: 'Paste or write your own',
      lyricsPlaceholder: '[Verse]\nNeon lights are fading down the avenue\nEvery shadow leads me back to you\n\n[Chorus]\nEven when the night is closing in\nI will keep a spark alive within',
      voice: 'Voice', voiceAuto: 'Default', voiceAutoChip: 'Default voice', voiceFemale: 'Female', voiceMale: 'Male', style: 'Style',
      instrumental: 'Instrumental', instrumentalOn: 'Instrumental on', instrumentalHint: 'Music only, no vocals',
      instrumentalPlaceholder: 'Warm solo piano with gentle strings, reflective and peaceful.',
      instrumentalPlanning: 'Composing the score and instrument arrangement…', instrumentalRendering: 'Rendering two instrumental versions…', instrumentalPanel: 'Instrumental · no lyrics',
      generate: 'Generate', getMore: 'Get more', remaining: '{count} left', goNoiz: 'Go to noiz music', submitting: 'Submitting…',
      generateAria: 'Generate now, {count} uses left', getMoreAria: 'Get more on noiz music',
      footer: 'Free to use, endless to explore', wechat: 'WeChat', wechatQr: 'WeChat QR code', discord: 'Discord', customStyle: 'Custom style…',
      chooseVoice: 'Choose voice type', chooseStyle: 'Choose style', close: 'Close',
      historySubtitle: 'Saved for this browser', noHistory: 'No songs yet. Create one to get started.', coverHistory: 'Cover',
      untitled: 'Untitled song', completed: 'Completed', failed: 'Failed', generating: 'Generating',
      historyLoading: 'Loading history audio…', musicComplete: 'Music generation complete', partialComplete: 'Some versions are ready',
      generationFailed: 'Generation failed. Please try again later.', cancelled: 'Generation cancelled', newSong: 'New song', vocalChip: 'Vocal',
      audioLoading: 'Version {index} audio loading', versionFailed: 'Version {index} failed', versionGenerating: 'Version {index} generating',
      downloadVersion: 'Download version {index}', waveformProgress: 'Version {index} playback progress',
      audioLoadFailed: 'Audio failed to load', loading: 'Loading audio', pause: 'Pause', play: 'Play', loadFailed: 'Load failed',
      audioPlayError: 'Audio is temporarily unavailable. Please try again.', copyLyrics: 'Copy lyrics',
      lyricsFallback: 'Lyrics will appear here', copied: 'Lyrics copied', copyFailed: 'Copy failed. Please select the lyrics manually.',
      promptRequired: 'Please enter a song description', lyricsRequired: 'Please enter lyrics', requestFailed: 'Request failed. Please try again.',
      mockNotice: 'Preview mode — generation does not use your trial allowance.', switchLanguage: 'Switch to Chinese',
      networkLimit: "This network has reached today's safety limit", browserLimit: 'This browser has used all three generations',
      exampleFilled: 'Filled in “{title}” — edit it or hit Generate',
      fillConfirmTitle: 'Replace what you wrote?', fillConfirmCancel: 'Cancel', fillConfirmOk: 'Replace',
      fillConfirmText: 'This fills in the description and lyrics of “{title}” and clears your voice and style picks. What you have written now will be replaced.',
      styles: { '流行': 'Pop', '轻松': 'Chill', '动感': 'Energetic', '情绪': 'Emotional', '摇滚': 'Rock', '电子': 'Electronic', '嘻哈': 'Hip-hop', 'Lo-Fi': 'Lo-Fi', '影视配乐': 'Soundtrack', '爵士': 'Jazz', '古典': 'Classical', '氛围': 'Ambient' },
      tips: [
        'Understanding your idea and shaping its mood, style, and structure…',
        'Building the main melody and bringing the track to life…',
        'Arranging instrumental layers and enriching the atmosphere…',
        'Rendering audio details and preparing playable versions…',
        'This is taking a little longer. You can also check it later in History.',
      ],
    },
    zh: {
      exploreMore: '探索更多', developerApi: '开发者 API', queue: '点击进入noiz music，免排队', backHome: '返回主页', history: '生成历史',
      expandComposer: '展开输入框', continueCreate: '继续创作下一首歌', composingCompact: '正在为你谱曲…',
      promptTitle: '歌曲描述', promptHint: '主题、场景与表达',
      promptPlaceholder: '一首赛博朋克风格的合成器流行，BPM 120，节奏强劲，女声演唱。',
      lyrics: '歌词', lyricsHint: '粘贴或直接撰写',
      lyricsPlaceholder: '[主歌]\n晚风吹过无人的街角\n影子在路灯下被拉长\n\n[副歌]\n就算世界偶尔让人失望\n也要保留心底那束微光',
      voice: '人声类型', voiceAuto: '默认', voiceAutoChip: '默认人声', voiceFemale: '女声', voiceMale: '男声', style: '风格',
      instrumental: '纯音乐', instrumentalOn: '纯音乐已开启', instrumentalHint: '只有器乐，没有人声',
      instrumentalPlaceholder: '温暖的钢琴独奏配轻柔弦乐，沉静舒缓。',
      instrumentalPlanning: '正在构思乐谱与乐器编排…', instrumentalRendering: '正在渲染两个纯音乐版本…', instrumentalPanel: '纯音乐 · 无歌词',
      generate: '立即生成', getMore: '获取更多', remaining: '剩余 {count} 次', goNoiz: '前往 noiz music', submitting: '正在提交…',
      generateAria: '立即生成，剩余 {count} 次', getMoreAria: '获取更多，前往 noiz music',
      footer: '免费使用，无尽探索', wechat: '微信', wechatQr: '微信二维码', discord: 'Discord', customStyle: '自定义风格…',
      chooseVoice: '选择人声类型', chooseStyle: '选择风格', close: '关闭',
      historySubtitle: '与当前浏览器关联', noHistory: '暂无记录，生成一首试试吧。', coverHistory: '翻唱',
      untitled: '未命名歌曲', completed: '已完成', failed: '失败', generating: '生成中',
      historyLoading: '正在加载历史音频…', musicComplete: '音乐生成完成', partialComplete: '部分版本生成完成',
      generationFailed: '生成失败，请稍后重试', cancelled: '生成已取消', newSong: '新歌曲', vocalChip: '人声',
      audioLoading: '版本 {index} 音频加载中', versionFailed: '版本 {index} 生成失败', versionGenerating: '版本 {index} 生成中',
      downloadVersion: '下载版本 {index}', waveformProgress: '版本 {index} 播放进度',
      audioLoadFailed: '音频加载失败', loading: '音频加载中', pause: '暂停', play: '播放', loadFailed: '加载失败',
      audioPlayError: '音频暂时无法播放，请稍后重试', copyLyrics: '复制歌词',
      lyricsFallback: '歌词将在这里显示', copied: '歌词已复制', copyFailed: '复制失败，请手动选择歌词',
      promptRequired: '请填写歌曲描述', lyricsRequired: '请填写歌词', requestFailed: '请求失败，请稍后重试',
      mockNotice: '当前为样式预览模式，不消耗体验次数', switchLanguage: 'Switch to English',
      networkLimit: '当前网络已达到今日安全限制', browserLimit: '当前浏览器 Create 和 Cover 共用的三次生成机会已用完',
      exampleFilled: '已填入「{title}」，可直接生成或继续修改',
      fillConfirmTitle: '替换当前内容？', fillConfirmCancel: '取消', fillConfirmOk: '替换',
      fillConfirmText: '将填入「{title}」的描述和歌词，并清空已选的人声和风格，输入框里现有的内容会被覆盖。',
      styles: { '流行': '流行', '轻松': '轻松', '动感': '动感', '情绪': '情绪', '摇滚': '摇滚', '电子': '电子', '嘻哈': '嘻哈', 'Lo-Fi': 'Lo-Fi', '影视配乐': '影视配乐', '爵士': '爵士', '古典': '古典', '氛围': '氛围' },
      tips: [
        '正在理解你的灵感，提取情绪、风格和结构…',
        '正在构建主旋律，让曲目逐渐成形…',
        '正在编排乐器层次，丰富整体氛围…',
        '正在渲染音频细节，生成可试听的版本…',
        '生成时间稍久，我们仍在处理；完成后也可在历史记录查看。',
      ],
    },
  };
  const voiceKeys = { auto: 'voice', female: 'voiceFemale', male: 'voiceMale', instrumental: 'instrumental' };
  let toastTimer = null;
  let audioContext = null;

  function t(key, values = {}) {
    const value = copy[state.language][key] ?? copy.en[key] ?? key;
    if (typeof value !== 'string') return value;
    return Object.entries(values).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement), value);
  }

  function voiceName(value) {
    return t(voiceKeys[value] || 'voice');
  }

  function track(eventName, detail = {}) {
    return window.yueAnalytics?.track(eventName, { mode: 'text', ...detail });
  }

  function localizeServerError(message) {
    if (state.language === 'en') return message;
    if (message === copy.en.networkLimit) return t('networkLimit');
    if (message === copy.en.browserLimit) return t('browserLimit');
    if (/^Please wait \d+ seconds before trying again$/.test(message)) {
      const seconds = message.match(/\d+/)?.[0] || '15';
      return `请等待 ${seconds} 秒后再试`;
    }
    return message;
  }

  function readJson(storage, key, fallback) {
    try { return JSON.parse(storage.getItem(key) || '') || fallback; } catch { return fallback; }
  }

  function saveHistory() {
    state.histories = state.histories.slice(0, 20);
    if (mockMode) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.histories));
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.remove('is-hidden');
    toastTimer = setTimeout(() => $('toast').classList.add('is-hidden'), 2800);
  }

  function applyLanguage({ rerender = true } = {}) {
    document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
    const texts = {
      exploreText: 'exploreMore', developerApiText: 'developerApi', queueText: 'queue', backLabel: 'backHome', historyLabel: 'history',
      promptTitle: 'promptTitle', promptHint: 'promptHint', lyricsFieldTitle: 'lyrics', lyricsHint: 'lyricsHint',
      footerLink: 'footer', voicePickerTitle: 'voice', stylePickerTitle: 'style', historyTitle: 'history',
      historySubtitle: 'historySubtitle',
    };
    Object.entries(texts).forEach(([id, key]) => {
      const el = $(id);
      if (el) el.textContent = t(key);
    });
    $('promptInput').placeholder = state.instrumental ? t('instrumentalPlaceholder') : t('promptPlaceholder');
    $('lyricsInput').placeholder = t('lyricsPlaceholder');
    $('customStyle').placeholder = t('customStyle');
    $('wechatButton')?.setAttribute('aria-label', t('wechat'));
    if ($('wechatQrImage')) $('wechatQrImage').alt = t('wechatQr');
    $('discordLink')?.setAttribute('aria-label', t('discord'));
    $('fillConfirmTitle').textContent = t('fillConfirmTitle');
    $('fillConfirmCancel').textContent = t('fillConfirmCancel');
    $('fillConfirmOk').textContent = t('fillConfirmOk');
    $('queueLink').setAttribute('aria-label', t('queue'));
    $('backButton').setAttribute('aria-label', t('backHome'));
    $('collapsedComposer').setAttribute('aria-label', t('expandComposer'));
    $('voicePicker').setAttribute('aria-label', t('chooseVoice'));
    $('stylePicker').setAttribute('aria-label', t('chooseStyle'));
    document.querySelectorAll('.picker-close').forEach(node => node.setAttribute('aria-label', t('close')));
    $('closeHistory').setAttribute('aria-label', t('close'));
    const toggle = $('languageToggle');
    toggle.dataset.language = state.language;
    toggle.setAttribute('aria-label', t('switchLanguage'));
    toggle.title = t('switchLanguage');
    document.querySelectorAll('[data-choice-group="voice"] .choice').forEach(node => {
      node.textContent = t(node.dataset.value === 'auto' ? 'voiceAuto' : `voice${node.dataset.value[0].toUpperCase()}${node.dataset.value.slice(1)}`);
    });
    document.querySelectorAll('[data-choice-group="style"] .choice').forEach(node => {
      node.textContent = copy[state.language].styles[node.dataset.value] || node.dataset.value;
    });
    updateOptions();
    updateInstrumental();
    updateRemaining();
    setComposerCollapsed(state.composerCollapsed);
    $('compactPrompt').textContent = $('promptInput').value.trim() || t('continueCreate');
    if (!$('historyOverlay').classList.contains('is-hidden')) renderHistory();
    if (rerender) [...state.visibleJobs.entries()].forEach(([jobId, job]) => {
      const record = state.histories.find(item => item.id === jobId);
      renderJob(job, record);
    });
  }

  function updateRemaining() {
    const left = Math.max(0, MAX_USES - state.used);
    const button = $('generateButton');
    const title = button.querySelector('strong');
    button.classList.toggle('is-upgrade', left === 0);
    button.classList.toggle('is-submitting', state.submitting);
    title.textContent = left > 0 ? t('generate') : t('getMore');
    if ($('remainingLabel')) $('remainingLabel').textContent = left > 0 ? t('remaining', { count: left }) : t('goNoiz');
    button.setAttribute('aria-label', left > 0 ? t('generateAria', { count: left }) : t('getMoreAria'));
  }

  function bindCounter(inputId, countId, max) {
    const input = $(inputId);
    const update = () => {
      $(countId).textContent = `${input.value.length}/${max}`;
      if (inputId === 'promptInput') $('compactPrompt').textContent = input.value.trim() || t('continueCreate');
    };
    input.addEventListener('input', update);
    update();
  }

  function openPicker(id) {
    $('pickerBackdrop').classList.remove('is-hidden');
    $(id).classList.remove('is-hidden');
  }

  function closePickers() {
    $('pickerBackdrop').classList.add('is-hidden');
    document.querySelectorAll('.picker').forEach(node => node.classList.add('is-hidden'));
    settleFillConfirm('cancelled');
  }

  function updateInstrumental() {
    const on = state.instrumental;
    $('instrumentalButton').classList.toggle('is-active', on);
    $('instrumentalButton').setAttribute('aria-checked', String(on));
    $('instrumentalButton').title = t('instrumentalHint');
    $('instrumentalLabel').textContent = t('instrumental');
    $('lyricsBlock').classList.toggle('is-hidden', on);
    $('voiceButton').classList.toggle('is-hidden', on);
    $('composer').classList.toggle('is-instrumental', on);
    $('promptInput').placeholder = on ? t('instrumentalPlaceholder') : t('promptPlaceholder');
  }

  function setInstrumental(value) {
    state.instrumental = Boolean(value);
    if (state.instrumental) closePickers();
    updateInstrumental();
  }

  function updateOptions() {
    $('voiceLabel').textContent = voiceName(state.voice);
    const custom = $('customStyle').value.trim();
    const count = state.styles.length + (custom ? 1 : 0);
    $('styleLabel').textContent = count ? `${t('style')} · ${count}` : t('style');
  }

  function buildPayload() {
    const prompt = $('promptInput').value.trim();
    const lyrics = $('lyricsInput').value.trim();
    if (!prompt) throw new Error(t('promptRequired'));
    if (!state.instrumental && !lyrics) throw new Error(t('lyricsRequired'));
    const vocal = state.instrumental ? '' : state.voice === 'female'
      ? 'female lead vocal'
      : state.voice === 'male'
        ? 'male lead vocal'
        : state.voice === 'auto' ? 'lead vocal' : '';
    const custom = $('customStyle').value.trim();
    const selected = [...state.styles, ...(custom ? [custom] : [])];
    return {
      n: 2,
      style: [prompt, ...selected, vocal].filter(Boolean).join(', '),
      ...(state.instrumental ? { instrumental: true } : { lyrics }),
      cot: 'full',
      seed: Math.floor(Math.random() * 2_147_483_647),
    };
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'same-origin' });
    if (!response.ok) {
      let detail = response.statusText;
      try { const body = await response.json(); detail = body.detail || body.message || detail; } catch { /* noop */ }
      const error = new Error(typeof detail === 'string' ? localizeServerError(detail) : t('requestFailed'));
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function makeMockWav(seed = 1, variant = 0, seconds = 12) {
    const sampleRate = 12000;
    const samples = sampleRate * seconds;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const write = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i += 1) {
      const t = i / sampleRate;
      const pulse = .42 + .58 * Math.sin(t * Math.PI * (1.6 + variant * .15)) ** 2;
      const melody = Math.sin(2 * Math.PI * (180 + variant * 42) * t) * .55 + Math.sin(2 * Math.PI * (270 + seed % 37) * t) * .25;
      view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, melody * pulse)) * 32767, true);
    }
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  }

  function getMockAudioUrls() {
    state.mockAudioUrls ||= [makeMockWav(104729, 0, 12), makeMockWav(130363, 1, 14)];
    return state.mockAudioUrls;
  }

  function makeMockJob(payload) {
    const id = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    return {
      id,
      kind: 'group',
      status: 'running',
      created_at: Date.now() / 1000,
      completed_count: 0,
      request: payload,
      candidates: [0, 1].map(i => ({ id: `${id}-${i}`, status: 'running', seed: payload.seed + i, stage: 'composing' })),
    };
  }

  function makeMockHistoryRecords() {
    const now = Date.now();
    const audioUrls = getMockAudioUrls();
    const fixtures = [
      {
        id: 'mock-history-t2m-1', age: 90_000, prompt: 'Neon city pop at midnight',
        lyrics: '[Verse]\nNeon rain across the avenue\nEvery light keeps leading back to you', styles: ['流行', '电子'], voice: 'female', seed: 1101,
      },
      {
        id: 'mock-history-t2m-2', age: 240_000, prompt: 'Warm acoustic song for a quiet morning',
        lyrics: '[Verse]\nMorning light is resting on the floor\nA gentle day is waiting by the door', styles: ['轻松'], voice: 'male', seed: 2202,
      },
      {
        id: 'mock-history-t2m-3', age: 420_000, prompt: 'Cinematic ambient journey through the stars',
        lyrics: '[Verse]\nSilver constellations drift away\nWe follow where the distant echoes stay', styles: ['影视配乐', '氛围'], voice: 'auto', seed: 3303,
      },
    ];
    return fixtures.map(fixture => {
      const snapshot = {
        id: fixture.id,
        kind: 'group',
        status: 'succeeded',
        created_at: (now - fixture.age) / 1000,
        completed_count: 2,
        request: { n: 2, style: fixture.prompt, lyrics: fixture.lyrics, cot: 'full', seed: fixture.seed },
        candidates: [0, 1].map(index => ({
          id: `${fixture.id}-${index}`,
          status: 'succeeded',
          seed: fixture.seed + index,
          stage: 'done',
          result: { audio_url: audioUrls[index], duration: index === 0 ? 12 : 14 },
        })),
      };
      return {
        id: fixture.id,
        createdAt: now - fixture.age,
        prompt: fixture.prompt,
        lyrics: fixture.lyrics,
        styles: fixture.styles,
        voice: fixture.voice,
        status: snapshot.status,
        snapshot,
      };
    });
  }

  function remember(job, input) {
    const record = {
      id: job.id,
      createdAt: Date.now(),
      prompt: input.prompt,
      lyrics: input.lyrics,
      styles: input.styles,
      voice: input.voice,
      status: job.status || 'queued',
      snapshot: job,
    };
    state.histories = [record, ...state.histories.filter(item => item.id !== job.id)];
    saveHistory();
    return record;
  }

  function updateRecord(job) {
    const record = state.histories.find(item => item.id === job.id);
    if (!record) return;
    record.status = job.status;
    record.snapshot = job;
    saveHistory();
  }

  function resultText(job) {
    if (job.history_loading) return t('historyLoading');
    if (job.status === 'succeeded' || job.status === 'truncated') return t('musicComplete');
    if (job.status === 'partial_failed') return t('partialComplete');
    if (job.status === 'failed') return t('generationFailed');
    if (job.status === 'cancelled') return t('cancelled');
    if (job.instrumental_stage === 'planning') return t('instrumentalPlanning');
    if (job.instrumental_stage === 'rendering') return t('instrumentalRendering');
    return copy[state.language].tips[state.tipIndexes.get(job.id) || 0];
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return '--:--';
    const value = Math.max(0, Math.round(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function playIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 9 5-9 5z"/></svg>';
  }

  function pauseIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h4v12H7zM14 6h4v12h-4z"/></svg>';
  }

  function errorIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:2"><path d="M7 7l10 10M17 7 7 17"/></svg>';
  }

  function downloadIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 20h14"/></svg>';
  }

  function copyIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h10v11H9zM5 4h10v3M5 4v12h2"/></svg>';
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function seededPeaks(value, count = 150) {
    let seed = [...String(value)].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
    return Array.from({ length: count }, (_, index) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const envelope = .45 + .45 * Math.sin((index / count) * Math.PI);
      return .18 + ((seed / 4294967295) * .72 * envelope);
    });
  }

  function audioPeaks(buffer, count = 150) {
    const values = [];
    const step = Math.max(1, Math.floor(buffer.length / count));
    const stride = Math.max(1, Math.floor(step / 80));
    for (let index = 0; index < count; index += 1) {
      let peak = 0;
      const start = index * step;
      const end = Math.min(buffer.length, start + step);
      for (let position = start; position < end; position += stride) {
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
          peak = Math.max(peak, Math.abs(buffer.getChannelData(channel)[position] || 0));
        }
      }
      values.push(peak);
    }
    const maximum = Math.max(...values, .01);
    return values.map(value => Math.max(.08, value / maximum));
  }

  function drawWaveform(canvas, peaks, progress = 0) {
    if (!canvas.isConnected) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const gap = 2;
    const barWidth = Math.max(1, (width - gap * (peaks.length - 1)) / peaks.length);
    peaks.forEach((peak, index) => {
      const x = index * (barWidth + gap);
      const barHeight = Math.max(3, peak * (height - 5));
      context.fillStyle = (x + barWidth / 2) / width <= progress ? '#6f6d75' : '#e5e4e8';
      context.beginPath();
      context.roundRect(x, (height - barHeight) / 2, barWidth, barHeight, Math.min(barWidth / 2, 2));
      context.fill();
    });
  }

  async function prepareAudioAsset(url, fallback) {
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('audio fetch failed');
      const bytes = await response.arrayBuffer();
      const playbackBlob = new Blob([bytes], { type: response.headers.get('content-type') || 'audio/flac' });
      const playbackUrl = URL.createObjectURL(playbackBlob);
      let peaks = fallback;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        try {
          audioContext ||= new AudioContextClass();
          const decoded = await audioContext.decodeAudioData(bytes.slice(0));
          peaks = audioPeaks(decoded);
        } catch { /* keep deterministic fallback waveform */ }
      }
      return { peaks, playbackUrl, objectUrl: playbackUrl };
    } catch {
      return { peaks: fallback, playbackUrl: url, objectUrl: null };
    }
  }

  function stopOtherPlayers(current) {
    state.players.forEach(player => {
      if (player !== current && !player.audio.paused) player.audio.pause();
    });
  }

  function disposePlayersForJob(jobId) {
    state.players.forEach((player, key) => {
      if (player.jobId !== jobId) return;
      player.audio.pause();
      player.resizeObserver?.disconnect();
      if (player.objectUrl) URL.revokeObjectURL(player.objectUrl);
      state.players.delete(key);
    });
  }

  function resetDisplayedResults() {
    const stack = $('resultsStack');
    [...stack.children].forEach(card => disposePlayersForJob(card.dataset.jobId));
    stack.replaceChildren();
    stack.scrollTop = 0;
    state.visibleJobIds.clear();
    state.visibleJobs.clear();
    state.lastConversationScrollTop = 0;
  }

  function attachPlayer({ jobId, candidate, url, button, canvas, durationLabel, expectedDuration, row }) {
    const audio = new Audio();
    audio.preload = 'auto';
    const player = {
      jobId,
      audio,
      button,
      canvas,
      peaks: seededPeaks(candidate.id),
      progress: 0,
      resizeObserver: null,
      mediaReady: false,
      waveformReady: false,
      ready: false,
      error: false,
      objectUrl: null,
    };
    state.players.set(candidate.id, player);
    const redraw = () => drawWaveform(canvas, player.peaks, player.progress);
    const updateButton = () => {
      if (player.error) {
        button.innerHTML = errorIcon();
        button.classList.remove('is-loading');
        button.disabled = true;
        button.setAttribute('aria-label', t('audioLoadFailed'));
        return;
      }
      if (!player.ready) {
        button.innerHTML = '';
        button.classList.add('is-loading');
        button.disabled = true;
        button.setAttribute('aria-label', t('loading'));
        return;
      }
      const playing = !audio.paused && !audio.ended;
      button.classList.remove('is-loading');
      button.disabled = false;
      button.innerHTML = playing ? pauseIcon() : playIcon();
      button.setAttribute('aria-label', playing ? t('pause') : t('play'));
    };
    const markReady = () => {
      if (player.error) return;
      player.mediaReady = true;
      player.ready = player.mediaReady && player.waveformReady;
      row.classList.toggle('is-audio-loading', !player.ready);
      updateButton();
    };
    const updateTime = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : expectedDuration;
      player.progress = duration > 0 ? Math.min(1, audio.currentTime / duration) : 0;
      durationLabel.textContent = `${formatDuration(audio.currentTime)}/${formatDuration(duration)}`;
      redraw();
    };
    button.addEventListener('click', async () => {
      if (!player.ready) return;
      if (audio.paused) {
        stopOtherPlayers(player);
        try { await audio.play(); } catch { toast(t('audioPlayError')); }
      } else audio.pause();
      updateButton();
    });
    audio.addEventListener('play', () => {
      updateButton();
      const rows = [...(row.closest('.candidate-list')?.querySelectorAll('.candidate') || [])];
      track('audio_played', {
        job_id: jobId,
        generation_id: jobId,
        candidate_id: candidate.id,
        status: 'started',
        properties: { variant: Math.max(1, rows.indexOf(row) + 1) },
      });
    });
    audio.addEventListener('pause', updateButton);
    audio.addEventListener('ended', updateButton);
    audio.addEventListener('loadedmetadata', updateTime);
    audio.addEventListener('canplay', markReady, { once: true });
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('error', () => {
      player.error = true;
      player.ready = false;
      row.classList.remove('is-audio-loading');
      row.classList.add('is-failed');
      durationLabel.textContent = t('loadFailed');
      updateButton();
    });
    const seekTo = (target) => new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        audio.removeEventListener('seeked', finish);
        resolve();
      };
      const timer = setTimeout(finish, 1500);
      audio.addEventListener('seeked', finish);
      audio.currentTime = target;
      if (!audio.seeking && Math.abs(audio.currentTime - target) < .08) queueMicrotask(finish);
    });
    canvas.addEventListener('click', async event => {
      if (!player.ready) return;
      const rect = canvas.getBoundingClientRect();
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : expectedDuration;
      if (!(duration > 0)) return;
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const target = Math.min(Math.max(0, duration - .01), ratio * duration);
      stopOtherPlayers(player);
      audio.pause();
      await seekTo(target);
      updateTime();
      try { await audio.play(); } catch { toast(t('audioPlayError')); }
    });
    if ('ResizeObserver' in window) {
      player.resizeObserver = new ResizeObserver(redraw);
      player.resizeObserver.observe(canvas);
    }
    redraw();
    updateButton();
    prepareAudioAsset(url, player.peaks).then(asset => {
      if (!canvas.isConnected) return;
      player.peaks = asset.peaks;
      player.objectUrl = asset.objectUrl;
      player.waveformReady = true;
      redraw();
      audio.src = asset.playbackUrl;
      audio.load();
    });
  }

  function createCandidate(jobId, candidate, index) {
    const result = candidate.result || {};
    const ready = ['succeeded', 'truncated'].includes(candidate.status) && Boolean(result.audio_url);
    const failed = candidate.status === 'failed';
    const row = element('article', `candidate${ready ? ' is-audio-loading' : failed ? ' is-failed' : ' is-loading'}`);
    const play = element('button', `play-button${failed ? '' : ' is-loading'}`);
    play.type = 'button';
    play.disabled = true;
    if (failed) play.innerHTML = errorIcon();
    play.setAttribute('aria-label', ready
      ? t('audioLoading', { index: index + 1 })
      : failed ? t('versionFailed', { index: index + 1 }) : t('versionGenerating', { index: index + 1 }));
    const version = element('span', 'version', `V${index + 1}.0`);
    const waveWrap = element('div', 'wave-wrap');
    const duration = element('span', 'duration');
    const expectedDuration = Number(result.audio_seconds ?? result.duration);
    duration.textContent = ready ? `0:00/${formatDuration(expectedDuration)}` : failed ? t('failed') : '--:--';
    const download = element('a', 'download-button');
    download.innerHTML = downloadIcon();
    download.setAttribute('aria-label', t('downloadVersion', { index: index + 1 }));
    if (ready) {
      const canvas = element('canvas', 'waveform');
      canvas.setAttribute('aria-label', t('waveformProgress', { index: index + 1 }));
      waveWrap.append(canvas);
      download.href = result.audio_url;
      download.target = '_blank';
      download.rel = 'noopener';
      download.dataset.generationId = jobId;
      download.dataset.candidateId = candidate.id || '';
      download.dataset.variant = String(index + 1);
      attachPlayer({ jobId, candidate, url: result.audio_url, button: play, canvas, durationLabel: duration, expectedDuration, row });
    } else download.setAttribute('aria-disabled', 'true');
    row.append(play, version, waveWrap, duration, download);
    return row;
  }

  function setComposerCollapsed(collapsed) {
    state.composerCollapsed = collapsed;
    $('composer').classList.toggle('is-collapsed', collapsed);
    const generating = state.histories.some(item => !terminal.has(item.status));
    $('compactStatus').textContent = generating ? t('composingCompact') : t('expandComposer');
  }

  // The composer grows over the results as it expands (.34s); keep the stack
  // pinned to its end for the whole transition so the newest result rides up.
  function keepLatestResultInView(duration = 450) {
    const stack = $('resultsStack');
    const until = performance.now() + duration;
    const pin = () => {
      stack.scrollTop = stack.scrollHeight;
      if (performance.now() < until) requestAnimationFrame(pin);
    };
    requestAnimationFrame(pin);
  }

  function programmaticScrollGuard() {
    state.suppressScrollTracker = true;
    clearTimeout(state.scrollGuardTimer);
    state.scrollGuardTimer = setTimeout(() => {
      state.lastConversationScrollTop = $('resultsStack').scrollTop;
      state.lastWindowScrollY = window.scrollY;
      state.suppressScrollTracker = false;
      state.scrollGuardTimer = null;
    }, 800);
  }

  function showResults() {
    state.forceHome = false;
    $('resultsStack').classList.remove('is-hidden');
    $('queueLink').classList.remove('is-hidden');
    $('backButton').classList.remove('is-hidden');
    document.body.classList.add('has-results');
    state.lastConversationScrollTop = $('resultsStack').scrollTop;
  }

  function renderJob(job, record, { reveal = false, forceView = false } = {}) {
    if (forceView) state.visibleJobIds.add(job.id);
    // Polling may continue after the user leaves a result session. Keep those
    // records in history, but never let them silently reappear in a new one.
    if (!state.visibleJobIds.has(job.id)) return;
    state.visibleJobs.set(job.id, job);
    if (forceView || !state.forceHome) showResults();
    disposePlayersForJob(job.id);
    let card = [...$('resultsStack').children].find(node => node.dataset.jobId === job.id);
    const isNewCard = !card;
    if (!card) {
      card = element('section', 'result-stage is-entering');
      card.dataset.jobId = job.id;
      $('resultsStack').append(card);
      card.addEventListener('animationend', () => card.classList.remove('is-entering'), { once: true });
    }
    card.replaceChildren();

    const resultCopy = element('div', 'result-copy');
    const status = element('div', 'generation-status');
    const complete = terminal.has(job.status);
    status.classList.toggle('is-complete', complete && !['failed', 'cancelled'].includes(job.status));
    status.append(element('span', 'spinner'), element('strong', '', resultText(job)));
    const title = element('h2', '', record?.prompt || t('newSong'));
    const chips = element('div', 'result-chips');
    const translatedStyles = (record?.styles || []).map(value => copy[state.language].styles[value] || value);
    const isInstrumental = record?.voice === 'instrumental' || job.instrumental === true;
    const voiceChip = isInstrumental ? t('instrumental') : record?.voice === 'auto' ? t('voiceAutoChip') : record?.voice ? voiceName(record.voice) : null;
    [...translatedStyles, voiceChip].filter(Boolean).forEach(value => chips.append(element('span', 'result-chip', value || t('vocalChip'))));
    const candidateList = element('div', 'candidate-list');
    (job.candidates || [job]).forEach((candidate, index) => candidateList.append(createCandidate(job.id, candidate, index)));
    resultCopy.append(status, title, chips, candidateList);

    const lyricsPanel = element('aside', 'lyrics-only');
    const lyricsTitle = element('div', 'lyrics-title-row');
    const copyButton = element('button', 'icon-button');
    copyButton.type = 'button';
    copyButton.setAttribute('aria-label', t('copyLyrics'));
    copyButton.innerHTML = copyIcon();
    const lyrics = element('div', 'lyrics-scroll', isInstrumental ? t('instrumentalPanel') : record?.lyrics || job.request?.lyrics || t('lyricsFallback'));
    copyButton.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(lyrics.textContent); toast(t('copied')); } catch { toast(t('copyFailed')); }
    });
    if (isInstrumental) { copyButton.classList.add('is-hidden'); lyricsPanel.classList.add('is-instrumental'); }
    lyricsTitle.append(element('span', '', t('lyrics')), copyButton);
    lyricsPanel.append(lyricsTitle, lyrics);
    card.append(resultCopy, lyricsPanel);

    if (reveal) {
      setComposerCollapsed(false);
      programmaticScrollGuard();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const stack = $('resultsStack');
        stack.scrollTo({ top: stack.scrollHeight, behavior: isNewCard ? 'smooth' : 'auto' });
      }));
    }
  }

  function startTips(jobId) {
    clearInterval(state.tipTimers.get(jobId));
    state.tipIndexes.set(jobId, 0);
    const timer = setInterval(() => {
      state.tipIndexes.set(jobId, Math.min(copy[state.language].tips.length - 1, (state.tipIndexes.get(jobId) || 0) + 1));
      const card = [...$('resultsStack').children].find(node => node.dataset.jobId === jobId);
      const status = card?.querySelector('.generation-status strong');
      const record = state.histories.find(item => item.id === jobId);
      if (status && record && !terminal.has(record.status) && !state.visibleJobs.get(jobId)?.instrumental_stage) status.textContent = copy[state.language].tips[state.tipIndexes.get(jobId)];
    }, 12000);
    state.tipTimers.set(jobId, timer);
  }

  async function poll(jobId) {
    clearTimeout(state.pollTimers.get(jobId));
    try {
      let job;
      const currentRecord = state.histories.find(item => item.id === jobId);
      if (mockMode && jobId.startsWith('mock-')) {
        const pollCount = (state.mockPollCounts.get(jobId) || 0) + 1;
        state.mockPollCounts.set(jobId, pollCount);
        job = structuredClone(currentRecord.snapshot);
        job.mock_poll_count = pollCount;
        if (pollCount >= 3) {
          const mockAudioUrls = getMockAudioUrls();
          job.status = 'succeeded';
          job.completed_count = 2;
          job.candidates = job.candidates.map((item, index) => ({
            ...item,
            status: 'succeeded',
            stage: 'done',
            result: { audio_url: mockAudioUrls[index], duration: index === 0 ? 12 : 14 },
          }));
        } else {
          job.status = pollCount === 1 ? 'queued' : 'running';
          job.candidates = job.candidates.map(item => ({ ...item, status: job.status, stage: pollCount === 1 ? 'queued' : 'composing' }));
        }
      } else job = await api(`/jobs/${encodeURIComponent(jobId)}`);
      const record = state.histories.find(item => item.id === jobId);
      updateRecord(job);
      renderJob(job, record);
      if (terminal.has(job.status) && !state.analyticsTerminalJobs.has(jobId)) {
        state.analyticsTerminalJobs.add(jobId);
        const succeeded = ['succeeded', 'truncated', 'partial_failed'].includes(job.status);
        track(succeeded ? 'generation_completed' : 'generation_failed', {
          job_id: jobId,
          status: succeeded ? 'completed' : job.status === 'cancelled' ? 'cancelled' : 'failed',
          duration_ms: Math.max(0, Date.now() - new Date(record?.createdAt || Date.now()).getTime()),
          properties: { stage: succeeded ? 'generation' : 'generation_failed' },
        });
      }
      if (!terminal.has(job.status)) state.pollTimers.set(jobId, setTimeout(() => poll(jobId), mockMode ? 1000 : 3000));
      else {
        clearInterval(state.tipTimers.get(jobId));
        state.tipTimers.delete(jobId);
        setComposerCollapsed(state.composerCollapsed);
        void window.yueGenerationQuota.refresh();
      }
    } catch (error) {
      toast(error.message);
      state.pollTimers.set(jobId, setTimeout(() => poll(jobId), 6000));
    }
  }

  async function submit() {
    if (state.used >= MAX_USES) {
      track('quota_exhausted', { status: 'blocked', properties: { limit_type: 'text_lifetime', remaining: 0 } });
      window.yueAnalytics?.trackOutbound('quota_redirect_text', 'noiz.ai', 'text');
      location.href = window.yueAnalytics?.outboundUrl('quota_redirect_text') || 'https://noiz.ai/create/music';
      return;
    }
    let payload;
    try { payload = buildPayload(); } catch (error) { toast(error.message); return; }
    const input = {
      prompt: $('promptInput').value.trim(),
      lyrics: state.instrumental ? '' : $('lyricsInput').value.trim(),
      styles: [...state.styles, ...($('customStyle').value.trim() ? [$('customStyle').value.trim()] : [])],
      voice: state.instrumental ? 'instrumental' : state.voice,
    };
    state.submitting = true;
    updateRemaining();
    $('remainingLabel') && ($('remainingLabel').textContent = t('submitting'));
    try {
      let job;
      if (mockMode) job = makeMockJob(payload);
      else {
        let pending = readJson(sessionStorage, PENDING_KEY, null);
        const body = JSON.stringify({ ...payload, client_input: input });
        if (!pending || pending.body !== body) {
          pending = { body, key: `web-${Date.now()}-${Math.random().toString(36).slice(2)}` };
          sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        }
        job = await api('/jobs', { method: 'POST', headers: { 'Idempotency-Key': pending.key }, body });
        sessionStorage.removeItem(PENDING_KEY);
        window.yueGenerationQuota.setUsed(Number.isFinite(job.remaining) ? MAX_USES - job.remaining : state.used + 1);
      }
      const record = remember(job, input);
      track('generation_submitted', {
        job_id: job.id,
        status: 'started',
        properties: { style_count: input.styles.length, voice: input.voice || 'none' },
      });
      renderJob(job, record, { reveal: true, forceView: true });
      startTips(job.id);
      poll(job.id);
    } catch (error) {
      if (error.status === 429 && /three|3 次|体验次数|三次生成机会/i.test(error.message)) {
        state.used = MAX_USES;
        if (!mockMode) window.yueGenerationQuota.setUsed(MAX_USES);
      }
      if (error.status === 429) {
        const limitType = /network|网络/i.test(error.message) ? 'network_daily' : /wait|等待/i.test(error.message) ? 'cooldown' : 'text_lifetime';
        track('quota_exhausted', { status: 'blocked', properties: { limit_type: limitType, remaining: Math.max(0, MAX_USES - state.used) } });
      } else {
        track('generation_failed', { status: 'failed', properties: { stage: 'submission' } });
      }
      toast(error.message);
    } finally {
      state.submitting = false;
      updateRemaining();
      setComposerCollapsed(state.composerCollapsed);
      void window.yueGenerationQuota.refresh();
    }
  }

  function historyTimestamp(record) {
    const value = record.kind === 'cover' ? Number(record.created_at) * 1000 : record.createdAt;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function loadCoverHistory() {
    if (mockMode) {
      state.coverHistories = window.yueCoverHistory?.mockItems?.() || [];
      return state.coverHistories;
    }
    try {
      const payload = await api('/cover/history');
      state.coverHistories = Array.isArray(payload.items)
        ? payload.items.map(item => ({ ...item, kind: 'cover' }))
        : [];
    } catch {
      // Text history remains usable if the Cover history request is temporarily unavailable.
      state.coverHistories = [];
    }
    return state.coverHistories;
  }

  function renderHistory() {
    const list = $('historyList');
    list.replaceChildren();
    const records = [
      ...state.histories.map(item => ({ ...item, kind: 'text' })),
      ...state.coverHistories,
    ].sort((left, right) => historyTimestamp(right) - historyTimestamp(left));
    if (!records.length) {
      list.append(element('p', 'history-empty', t('noHistory')));
      return;
    }
    records.forEach(record => {
      const button = element('button', 'history-item');
      button.type = 'button';
      const isCover = record.kind === 'cover';
      const titleText = isCover
        ? record.request?.music_description || record.request?.style || t('coverHistory')
        : record.prompt || t('untitled');
      const title = element('strong', '', isCover ? `${t('coverHistory')} · ${titleText}` : titleText);
      const time = element('small', '', new Date(historyTimestamp(record)).toLocaleString(state.language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false }));
      const done = isCover ? record.status === 'completed' : ['succeeded', 'truncated', 'partial_failed'].includes(record.status);
      const failed = ['failed', 'cancelled'].includes(record.status);
      const badge = element('span', `history-state${done ? ' done' : failed ? ' failed' : ''}`, done ? t('completed') : failed ? t('failed') : t('generating'));
      button.append(title, time, badge);
      button.addEventListener('click', () => {
        closeHistory();
        if (isCover) {
          window.yueCoverHistory?.open(record);
          return;
        }
        window.yueCoverHistory?.switchToText();
        resetDisplayedResults();
        if (mockMode) {
          renderJob(record.snapshot, record, { reveal: true, forceView: true });
          if (!terminal.has(record.status)) { startTips(record.id); poll(record.id); }
          return;
        }
        // Old localStorage snapshots may still contain same-origin UCloud
        // artifact paths. Refresh through the publisher before attaching any
        // audio element, so both old and new history always play from GCS.
        const loading = structuredClone(record.snapshot);
        loading.status = 'running';
        loading.history_loading = true;
        loading.candidates = (loading.candidates || [loading]).map(candidate => ({
          ...candidate,
          status: 'running',
          stage: 'publishing',
          result: undefined,
        }));
        renderJob(loading, record, { reveal: true, forceView: true });
        startTips(record.id);
        poll(record.id);
      });
      list.append(button);
    });
  }

  async function openHistory() {
    $('historyOverlay').classList.remove('is-hidden');
    $('historyOverlay').setAttribute('aria-hidden', 'false');
    renderHistory();
    await loadCoverHistory();
    if (!$('historyOverlay').classList.contains('is-hidden')) renderHistory();
  }

  function closeHistory() {
    $('historyOverlay').classList.add('is-hidden');
    $('historyOverlay').setAttribute('aria-hidden', 'true');
  }

  function goHome() {
    state.forceHome = true;
    resetDisplayedResults();
    $('resultsStack').classList.add('is-hidden');
    $('queueLink').classList.add('is-hidden');
    $('backButton').classList.add('is-hidden');
    document.body.classList.remove('has-results');
    setComposerCollapsed(false);
    programmaticScrollGuard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  let fillConfirmResolve = null;

  function settleFillConfirm(result) {
    const resolve = fillConfirmResolve;
    fillConfirmResolve = null;
    resolve?.(result);
  }

  // Resolves true when the user agrees to replace what they have entered.
  function confirmReplace(text) {
    closePickers();
    $('fillConfirmText').textContent = text;
    openPicker('fillConfirm');
    $('fillConfirmOk').focus();
    return new Promise(resolve => { fillConfirmResolve = result => resolve(result === 'filled'); });
  }

  // Resolves 'filled' or 'cancelled'. Asks first when the composer holds text
  // that the example would overwrite.
  async function fillExample(example) {
    const prompt = $('promptInput').value.trim();
    const lyrics = $('lyricsInput').value.trim();
    const wouldOverwrite = (prompt || lyrics) && (prompt !== example.prompt.trim() || lyrics !== example.lyrics.trim());
    if (wouldOverwrite && !(await confirmReplace(t('fillConfirmText', { title: example.title })))) return 'cancelled';
    applyExample(example);
    return 'filled';
  }

  // The example's prompt already names its voice and style, so voice/style
  // selections are cleared to keep the submitted style identical to the example's.
  function applyExample({ title, prompt, lyrics }) {
    if (document.body.classList.contains('cover-mode')) {
      window.yueCoverHistory?.switchToText();
      goHome();
    }
    $('promptInput').value = prompt;
    $('lyricsInput').value = lyrics;
    ['promptInput', 'lyricsInput'].forEach(id => $(id).dispatchEvent(new Event('input')));
    state.voice = null;
    setInstrumental(false);
    state.styles = [];
    $('customStyle').value = '';
    document.querySelectorAll('[data-choice-group] .choice').forEach(node => {
      node.classList.remove('is-active');
      node.setAttribute('aria-pressed', 'false');
    });
    updateOptions();
    setComposerCollapsed(false);
    const composer = $('composer');
    composer.classList.remove('is-filled');
    void composer.offsetWidth;
    composer.classList.add('is-filled');
    // In the desktop results layout the composer is pinned on screen already.
    if (!document.body.classList.contains('has-results') || window.innerWidth <= 860) {
      composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    toast(t('exampleFilled', { title }));
  }

  function onConversationScroll() {
    if (state.suppressScrollTracker) return;
    const stack = $('resultsStack');
    const next = stack.scrollTop;
    const delta = next - state.lastConversationScrollTop;
    state.lastConversationScrollTop = next;
    if (state.forceHome || state.composerCollapsed || stack.children.length < 2 || Math.abs(delta) < 8) return;
    // Match noizweb: only an upward gesture while reviewing older results
    // folds the composer. Downward reading never collapses it.
    if (delta < 0) setComposerCollapsed(true);
  }

  function onWindowScroll() {
    if (window.innerWidth > 860 || state.suppressScrollTracker) return;
    const next = window.scrollY;
    const delta = next - state.lastWindowScrollY;
    state.lastWindowScrollY = next;
    if (state.forceHome || state.composerCollapsed || $('resultsStack').children.length < 2 || Math.abs(delta) < 8) return;
    if (delta < 0) setComposerCollapsed(true);
  }

  if (mockMode) state.histories = makeMockHistoryRecords();
  bindCounter('promptInput', 'promptCount', 3000);
  bindCounter('lyricsInput', 'lyricsCount', 5000);
  applyLanguage({ rerender: false });
  const wechatButton = $('wechatButton');
  if (wechatButton) {
    const wechatAnchor = wechatButton.parentElement;
    const trackWechatQr = source => track('wechat_qr_opened', { mode: 'site', status: 'viewed', properties: { source } });
    function dismissWechatQr() {
      wechatAnchor.classList.remove('is-open');
      wechatButton.setAttribute('aria-expanded', 'false');
      if (wechatAnchor.matches(':hover')) wechatAnchor.classList.add('is-dismissed');
    }
    function showWechatQr() {
      wechatAnchor.classList.remove('is-dismissed');
      wechatAnchor.classList.add('is-open');
      wechatButton.setAttribute('aria-expanded', 'true');
    }
    wechatAnchor.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && !wechatAnchor.classList.contains('is-open')) trackWechatQr('hover');
    });
    wechatAnchor.addEventListener('mouseleave', () => wechatAnchor.classList.remove('is-dismissed'));
    document.addEventListener('pointerdown', event => {
      const inside = wechatAnchor.contains(event.target);
      if (event.pointerType === 'touch' && inside) {
        if (wechatAnchor.classList.contains('is-open')) dismissWechatQr();
        else { showWechatQr(); trackWechatQr('tap'); }
        return;
      }
      if (inside && wechatAnchor.classList.contains('is-open')) {
        dismissWechatQr();
        return;
      }
      if (!inside) dismissWechatQr();
    });
    document.addEventListener('scroll', dismissWechatQr, true);
    window.addEventListener('wheel', dismissWechatQr, { passive: true });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') dismissWechatQr();
    });
  }
  $('fillConfirmOk').addEventListener('click', () => {
    const resolve = fillConfirmResolve;
    fillConfirmResolve = null;
    closePickers();
    resolve?.('filled');
  });
  $('fillConfirmCancel').addEventListener('click', closePickers);
  $('languageToggle').addEventListener('click', () => {
    state.language = state.language === 'en' ? 'zh' : 'en';
    localStorage.setItem(LANGUAGE_KEY, state.language);
    applyLanguage();
  });
  $('instrumentalButton').addEventListener('click', () => setInstrumental(!state.instrumental));
  $('voiceButton').addEventListener('click', () => openPicker('voicePicker'));
  $('styleButton').addEventListener('click', () => openPicker('stylePicker'));
  $('pickerBackdrop').addEventListener('click', closePickers);
  document.querySelectorAll('.picker-close').forEach(node => node.addEventListener('click', closePickers));
  document.querySelectorAll('[data-choice-group="voice"] .choice').forEach(node => node.addEventListener('click', () => {
    state.voice = state.voice === node.dataset.value ? null : node.dataset.value;
    document.querySelectorAll('[data-choice-group="voice"] .choice').forEach(item => {
      const active = item.dataset.value === state.voice;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updateOptions(); closePickers();
  }));
  document.querySelectorAll('[data-choice-group="style"] .choice').forEach(node => node.addEventListener('click', () => {
    const value = node.dataset.value;
    if (state.styles.includes(value)) state.styles = state.styles.filter(item => item !== value);
    else state.styles.push(value);
    const active = state.styles.includes(value);
    node.classList.toggle('is-active', active);
    node.setAttribute('aria-pressed', String(active));
    updateOptions();
  }));
  $('customStyle').addEventListener('input', updateOptions);
  $('generateButton').addEventListener('click', submit);
  $('historyButton').addEventListener('click', openHistory);
  $('backButton').addEventListener('click', goHome);
  $('collapsedComposer').addEventListener('click', () => {
    setComposerCollapsed(false);
    programmaticScrollGuard();
    keepLatestResultInView();
  });
  $('closeHistory').addEventListener('click', closeHistory);
  $('historyOverlay').addEventListener('click', event => { if (event.target === $('historyOverlay')) closeHistory(); });
  $('resultsStack').addEventListener('scroll', onConversationScroll, { passive: true });
  window.addEventListener('scroll', onWindowScroll, { passive: true });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closePickers(); closeHistory(); } });

  window.addEventListener('yue:quota', () => {
    if (mockMode) return;
    state.used = window.yueGenerationQuota.used;
    updateRemaining();
  });
  void window.yueGenerationQuota.refresh();

  window.yueComposer = { fill: fillExample, confirmReplace, goHome };

  if (mockMode) toast(t('mockNotice'));
})();
