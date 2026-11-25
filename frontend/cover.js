(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const mockMode = params.get('mock') === '1';
  const LYRICS_USAGE_KEY = 'meet-yue2-cover-lyrics-recognition-v1';
  const MAX_USES = 3;
  const allowedExtensions = new Set(['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg']);
  const state = {
    mode: 'text',
    file: null,
    fileUrl: null,
    sourceId: null,
    sourceAudio: null,
    voice: 'auto',
    styles: new Set(),
    strength: 'high',
    used: mockMode ? 0 : window.yueGenerationQuota.used,
    lyricsUsed: mockMode ? 0 : Math.max(0, Number(localStorage.getItem(LYRICS_USAGE_KEY) || 0)),
    recognizing: false,
    generating: false,
    jobs: 0,
    players: [],
    recognizedLyrics: '',
    historyView: false,
    historySource: false,
  };

  const copy = {
    en: {
      textMode: 'Text to Song', coverMode: 'Cover', kicker: 'AI cover studio',
      uploadTitle: 'Turn any song into your own cover', uploadIntro: 'Upload a song, recognize its lyrics, and reshape it with Yue2.',
      dropTitle: 'Drop your song here', dropHint: 'or click to upload · MP3, WAV, FLAC, M4A, AAC, OGG · up to 100 MB', choose: 'Choose audio', demo: 'Use demo song',
      original: 'Original song', ready: 'Ready', replace: 'Replace', remove: 'Remove', playOriginal: 'Play original', pauseOriginal: 'Pause original',
      lyrics: 'Lyrics', lyricsHint: 'Paste lyrics or recognize them from the song', recognize: 'Recognize lyrics', recognizing: 'Recognizing…',
      lyricsPlaceholder: 'Lyrics will appear here after recognition, or you can write your own.',
      description: 'Cover description', descriptionHint: 'Describe the new mood and arrangement',
      descriptionPlaceholder: 'Warm indie pop, intimate female vocal, soft acoustic guitar and gentle drums.',
      voice: 'Voice', auto: 'Auto', female: 'Female', male: 'Male', style: 'Style', customStyle: 'Add a custom style',
      melody: 'Reference melody', close: 'Close', closeHint: 'Keep melody & structure', free: 'Free', freeHint: 'Keep main melody only',
      privacy: 'Your upload is used only to create this cover.', generate: 'Generate cover', generating: 'Creating your cover…',
      remaining: '{count} left', getMore: 'Get more', goNoiz: 'Go to noiz music',
      invalidFile: 'Please choose an MP3, WAV, FLAC, M4A, AAC, or OGG file.', tooLarge: 'The audio file must be 100 MB or smaller.',
      uploading: 'Uploading audio…', uploadFailed: 'Audio upload failed. Please try again.',
      uploadFirst: 'Upload an audio file first.', lyricsRequired: 'Add or recognize lyrics first.', styleRequired: 'Add a cover description or choose a style.',
      lyricsLimit: 'All three lyric recognitions have been used.', coverLimit: 'All three generations across Create and Cover have been used.',
      recognitionDone: 'Lyrics recognized. You can edit them before generating.', recognitionFailed: 'Lyrics recognition failed. Please try again.',
      preparing: 'Preparing the original song…', score: 'Reading melody and structure…', submit: 'Sending the arrangement to Yue2…', waiting: 'Waiting for an available GPU…', render: 'Rendering two cover versions…',
      complete: 'Cover generation complete', coverTitle: 'Your new cover', download: 'Download version {index}', play: 'Play version {index}', pause: 'Pause version {index}',
      resultLyrics: 'Lyrics', demoName: 'Midnight-demo.wav', mockOnly: 'This local preview uses demo audio and does not consume quota.',
      missingSource: 'Original audio is no longer available', missingSourceHint: 'Upload it again to continue editing this cover.', uploadOriginal: 'Upload original',
      exampleLoading: 'Loading “{title}” as the original…', exampleLoadFailed: 'Could not load the example song. Please try again.',
      exampleFilled: '“{title}” is loaded with its lyrics — describe the new style you want',
      exampleConfirm: 'This uses “{title}” as the original song and fills in its lyrics. Your current original, lyrics and cover description will be replaced.',
    },
    zh: {
      textMode: 'Tạo nhạc từ chữ', coverMode: 'Chế độ Cover', kicker: 'Studio Cover AI',
      uploadTitle: 'Biến bất kỳ bài hát nào thành bản cover mới', uploadIntro: 'Tải bài hát lên, tách lời tự động và phối lại phong cách bằng Yue2.',
      dropTitle: 'Kéo thả bài hát vào đây', dropHint: 'hoặc bấm để tải lên · Hỗ trợ MP3, WAV, FLAC, M4A, AAC, OGG · Tối đa 100 MB', choose: 'Chọn tệp âm thanh', demo: 'Dùng bài mẫu',
      original: 'Bài gốc', ready: 'Sẵn sàng', replace: 'Đổi bài', remove: 'Xóa', playOriginal: 'Phát bài gốc', pauseOriginal: 'Tạm dừng bài gốc',
      lyrics: 'Lời bài hát', lyricsHint: 'Dán lời hoặc bóc lời từ bài gốc', recognize: 'Nhận diện lời', recognizing: 'Đang nhận diện…',
      lyricsPlaceholder: 'Lời nhận diện sẽ hiện ở đây, hoặc bạn có thể nhập trực tiếp.',
      description: 'Mô tả bản cover', descriptionHint: 'Mô tả không khí và cách phối mới',
      descriptionPlaceholder: 'Indie pop ấm áp, giọng nữ gần gũi, guitar mộc nhẹ và trống êm.',
      voice: 'Giọng hát', auto: 'Tự động', female: 'Nữ', male: 'Nam', style: 'Thể loại', customStyle: 'Thêm thể loại tùy chỉnh',
      melody: 'Độ bám giai điệu', close: 'Sát bản gốc', closeHint: 'Giữ giai điệu & cấu trúc', free: 'Tự do', freeHint: 'Chỉ giữ giai điệu chính',
      privacy: 'Tệp tải lên chỉ dùng cho bản cover này.', generate: 'Tạo bản cover', generating: 'Đang tạo bản cover…',
      remaining: 'Còn {count} lượt', getMore: 'Nhận thêm lượt', goNoiz: 'Mở noiz music',
      invalidFile: 'Vui lòng chọn tệp MP3, WAV, FLAC, M4A, AAC hoặc OGG.', tooLarge: 'Tệp âm thanh phải nhỏ hơn 100 MB.',
      uploading: 'Đang tải âm thanh lên…', uploadFailed: 'Tải âm thanh thất bại, thử lại nhé.',
      uploadFirst: 'Vui lòng tải tệp âm thanh lên trước.', lyricsRequired: 'Vui lòng nhập hoặc nhận diện lời bài hát.', styleRequired: 'Vui lòng nhập mô tả hoặc chọn thể loại.',
      lyricsLimit: 'Đã hết 3 lượt nhận diện lời.', coverLimit: 'Đã hết 3 lượt dùng thử chung cho Create và Cover.',
      recognitionDone: 'Đã nhận diện xong lời, bạn có thể sửa lại trước khi tạo.', recognitionFailed: 'Nhận diện lời thất bại, thử lại nhé.',
      preparing: 'Đang chuẩn bị bài gốc…', score: 'Đang phân tích giai điệu & cấu trúc…', submit: 'Đang gửi bản phối tới Yue2…', waiting: 'GPU đang bận, đang chờ lượt trống…', render: 'Đang render hai bản cover…',
      complete: 'Bản cover đã sẵn sàng', coverTitle: 'Bản cover mới của bạn', download: 'Tải bản {index}', play: 'Phát bản {index}', pause: 'Tạm dừng bản {index}',
      resultLyrics: 'Lời bài hát', demoName: 'midnight-demo.wav', mockOnly: 'Chế độ xem thử local, không trừ lượt dùng.',
      missingSource: 'Bài gốc đã hết hạn hoặc không khả dụng', missingSourceHint: 'Hãy tải lại bài gốc để tiếp tục chỉnh sửa bản cover này.', uploadOriginal: 'Tải bài gốc',
      exampleLoading: 'Đang nạp "{title}" làm bài gốc…', exampleLoadFailed: 'Không nạp được bài mẫu, thử lại nhé.',
      exampleFilled: 'Đã nạp "{title}" và lời, hãy mô tả phong cách bạn muốn',
      exampleConfirm: 'Thao tác này sẽ dùng "{title}" làm bài gốc và điền lời bài hát. Bài gốc, lời và mô tả cover hiện tại sẽ bị thay thế.',
    },
  };

  const language = () => $('languageToggle').dataset.language === 'zh' ? 'zh' : 'en';
  const t = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), copy[language()][key] || key);
  let toastTimer = null;
  let mockHistoryAudioUrls = null;
  let mockHistorySourceUrls = null;

  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.remove('is-hidden');
    toastTimer = setTimeout(() => $('toast').classList.add('is-hidden'), 3000);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, options);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const error = new Error(payload?.detail || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function track(eventName, detail = {}) {
    return window.yueAnalytics?.track(eventName, { mode: 'cover', ...detail });
  }

  function sizeBucket(bytes) {
    if (bytes < 5 * 1024 ** 2) return 'under_5mb';
    if (bytes < 20 * 1024 ** 2) return '5_20mb';
    if (bytes < 50 * 1024 ** 2) return '20_50mb';
    return '50_100mb';
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return mockMode ? '2.8 MB' : '';
    return bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  function updateCounters() {
    $('coverLyricsCount').textContent = `${$('coverLyrics').value.length}/5000`;
    $('coverDescriptionCount').textContent = `${$('coverDescription').value.length}/3000`;
  }

  function updateQuota() {
    const coverLeft = Math.max(0, MAX_USES - state.used);
    const lyricsLeft = Math.max(0, MAX_USES - state.lyricsUsed);
    $('recognizeRemaining').textContent = t('remaining', { count: lyricsLeft });
    $('coverGenerateRemaining').textContent = coverLeft ? t('remaining', { count: coverLeft }) : t('goNoiz');
    $('coverGenerateText').textContent = coverLeft ? (state.generating ? t('generating') : t('generate')) : t('getMore');
    $('coverGenerateButton').classList.toggle('is-upgrade', coverLeft === 0);
    $('coverGenerateButton').classList.toggle('is-submitting', state.generating);
  }

  function syncQuota(coverRemaining, lyricsRemaining) {
    if (Number.isFinite(coverRemaining)) {
      state.used = Math.max(0, MAX_USES - Number(coverRemaining));
      if (!mockMode) window.yueGenerationQuota.setUsed(state.used);
    }
    if (Number.isFinite(Number(lyricsRemaining))) {
      state.lyricsUsed = Math.max(0, MAX_USES - Number(lyricsRemaining));
      if (!mockMode) localStorage.setItem(LYRICS_USAGE_KEY, String(state.lyricsUsed));
    }
    updateQuota();
  }

  async function refreshServerQuota() {
    if (mockMode) return;
    try {
      const quota = await window.yueGenerationQuota.refresh();
      if (quota) syncQuota(quota.remaining, quota.lyrics_remaining);
    } catch (_) {
      // Keep the local estimate when the network is temporarily unavailable.
    }
  }

  function applyLanguage() {
    const texts = {
      textModeLabel: 'textMode', coverModeLabel: 'coverMode', coverKicker: 'kicker', coverUploadTitle: 'uploadTitle', coverUploadIntro: 'uploadIntro',
      coverDropTitle: 'dropTitle', coverDropHint: 'dropHint', coverChooseFile: 'choose', coverDemoButton: 'demo', coverOriginalLabel: 'original', coverReplaceFile: 'replace', coverRemoveFile: 'remove',
      coverLyricsTitle: 'lyrics', coverLyricsHint: 'lyricsHint', recognizeLyricsText: state.recognizing ? 'recognizing' : 'recognize', coverDescriptionTitle: 'description', coverDescriptionHint: 'descriptionHint',
      coverVoiceTitle: 'voice', coverStyleTitle: 'style', coverStrengthTitle: 'melody', coverStrengthClose: 'close', coverStrengthCloseHint: 'closeHint', coverStrengthFree: 'free', coverStrengthFreeHint: 'freeHint', coverPrivacy: 'privacy',
      coverMissingSourceLabel: 'original', coverMissingSourceTitle: 'missingSource', coverMissingSourceHint: 'missingSourceHint', coverHistoryUploadButton: 'uploadOriginal',
    };
    Object.entries(texts).forEach(([id, key]) => { $(id).textContent = t(key); });
    $('coverLyrics').placeholder = t('lyricsPlaceholder');
    $('coverDescription').placeholder = t('descriptionPlaceholder');
    $('coverCustomStyle').placeholder = t('customStyle');
    const voiceKeys = { auto: 'auto', female: 'female', male: 'male' };
    document.querySelectorAll('[data-cover-group="voice"] button').forEach(button => { button.textContent = t(voiceKeys[button.dataset.value]); });
    document.querySelectorAll('[data-cover-text]').forEach(node => { node.textContent = t(node.dataset.coverText); });
    if (state.file) $('coverFileMeta').textContent = `${formatBytes(state.file.size)} · ${t('ready')}`;
    $('coverSourcePlay').setAttribute('aria-label', t(state.sourceAudio && !state.sourceAudio.paused ? 'pauseOriginal' : 'playOriginal'));
    updateQuota();
  }

  function disposePlayers() {
    state.players.forEach(player => {
      player.audio.pause();
      player.resize?.disconnect();
    });
    state.players = [];
  }

  function setMode(mode, { history = false } = {}) {
    state.mode = mode;
    const cover = mode === 'cover';
    state.historyView = cover && history;
    document.body.classList.toggle('cover-mode', cover);
    document.body.classList.toggle('cover-history-view', state.historyView);
    $('coverRoot').classList.toggle('is-hidden', !cover);
    $('textModeTab').classList.toggle('is-active', !cover);
    $('coverModeTab').classList.toggle('is-active', cover);
    $('textModeTab').setAttribute('aria-selected', String(!cover));
    $('coverModeTab').setAttribute('aria-selected', String(cover));
    if (cover) {
      $('queueLink').classList.toggle('is-hidden', !state.historyView);
      $('backButton').classList.toggle('is-hidden', !state.historyView);
      document.body.classList.toggle('has-results', state.historyView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function exitHistoryView() {
    if (!state.historyView) return;
    disposePlayers();
    $('coverResults').replaceChildren();
    document.body.classList.remove('cover-history-view', 'has-results');
    state.historyView = false;
    if (state.historySource) {
      state.sourceAudio?.pause();
      state.file = null;
      state.fileUrl = null;
      state.sourceId = null;
      state.sourceAudio = null;
      state.historySource = false;
    }
    $('queueLink').classList.add('is-hidden');
    $('backButton').classList.add('is-hidden');
    if (state.file) {
      $('coverUploadPanel').classList.add('is-hidden');
      $('coverWorkspace').classList.remove('is-hidden');
    } else {
      $('coverUploadPanel').classList.remove('is-hidden');
      $('coverWorkspace').classList.add('is-hidden');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchToText() {
    disposePlayers();
    state.historyView = false;
    if (state.historySource) {
      state.sourceAudio?.pause();
      state.file = null;
      state.fileUrl = null;
      state.sourceId = null;
      state.sourceAudio = null;
      state.historySource = false;
    }
    state.mode = 'text';
    document.body.classList.remove('cover-mode', 'cover-history-view', 'has-results');
    $('coverRoot').classList.add('is-hidden');
    $('textModeTab').classList.add('is-active');
    $('coverModeTab').classList.remove('is-active');
    $('textModeTab').setAttribute('aria-selected', 'true');
    $('coverModeTab').setAttribute('aria-selected', 'false');
    $('queueLink').classList.add('is-hidden');
    $('backButton').classList.add('is-hidden');
  }

  function makeToneWav(frequency, seconds = 14) {
    const sampleRate = 12000;
    const length = sampleRate * seconds;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    const write = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length * 2, true);
    for (let i = 0; i < length; i += 1) {
      const envelope = Math.min(1, i / 1000, (length - i) / 1200);
      const pulse = .55 + .45 * Math.sin(i / sampleRate * Math.PI * 3.7);
      const value = Math.sin(2 * Math.PI * frequency * i / sampleRate) * .2 * envelope * pulse;
      view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, value)) * 32767, true);
    }
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  }

  function mockHistoryItems() {
    mockHistoryAudioUrls ||= [makeToneWav(246.94, 13), makeToneWav(293.66, 15)];
    mockHistorySourceUrls ||= [makeToneWav(196, 10), makeToneWav(220, 10)];
    const now = Date.now() / 1000;
    const fixtures = [
      {
        id: 'mock-history-cover-1', age: 150,
        description: 'Dreamy synth-pop cover with airy female vocals', style: 'Pop, Electronic', voice: 'female',
        lyrics: '[Verse]\nMidnight neon falls across an old refrain\nA familiar melody is calling out my name',
      },
      {
        id: 'mock-history-cover-2', age: 330,
        description: 'Warm acoustic cover with intimate guitar', style: 'Acoustic, Chill', voice: 'male',
        lyrics: '[Verse]\nMorning light is resting on the floor\nSing the old song softly once more',
      },
    ];
    return fixtures.map((fixture, fixtureIndex) => ({
      id: fixture.id,
      kind: 'cover',
      status: 'completed',
      stage: 'completed',
      created_at: now - fixture.age,
      request: {
        source_id: `mock-cover-source-${fixtureIndex + 1}`,
        lyrics: fixture.lyrics,
        music_description: fixture.description,
        style: fixture.style,
        melody_adherence: fixtureIndex ? 'main_melody' : 'high',
        vocal_gender: fixture.voice,
      },
      source: {
        source_id: `mock-cover-source-${fixtureIndex + 1}`,
        audio_url: mockHistorySourceUrls[fixtureIndex],
        filename: fixtureIndex ? 'morning-demo.wav' : 'midnight-demo.wav',
        mime_type: 'audio/wav',
        size_bytes: 2.8 * 1024 ** 2,
      },
      candidates: mockHistoryAudioUrls.map((audioUrl, index) => ({
        id: `${fixture.id}-${index}`,
        status: 'succeeded',
        result: { audio_url: audioUrl, duration: index === 0 ? 13 : 15 },
      })),
    }));
  }

  // Resolves true once the file is uploaded and shown as the original.
  async function selectFile(file, { demo = false, source } = {}) {
    const extension = String(file?.name || '').split('.').pop().toLowerCase();
    if (!demo && !allowedExtensions.has(extension)) return toast(t('invalidFile'));
    if (!demo && file.size > 100 * 1024 * 1024) return toast(t('tooLarge'));
    const dropzone = $('coverDropzone');
    dropzone.classList.add('is-uploading');
    $('coverDropTitle').textContent = t('uploading');
    try {
      let sourceId = null;
      if (!mockMode && !demo) {
        const uploaded = await api('/api/cover/sources', {
          method: 'POST',
          headers: {
            'Content-Type': file.type || ({ mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg' }[extension]),
            'X-Audio-Extension': extension,
          },
          body: file,
        });
        sourceId = uploaded.source_id;
      }
      if (state.fileUrl?.startsWith('blob:') && !state.historySource) URL.revokeObjectURL(state.fileUrl);
      if (state.sourceAudio) state.sourceAudio.pause();
      state.file = file;
      state.sourceId = sourceId;
      state.historySource = false;
      state.fileUrl = demo ? makeToneWav(196, 10) : URL.createObjectURL(file);
      state.sourceAudio = new Audio(state.fileUrl);
      state.sourceAudio.addEventListener('ended', updateSourcePlay);
      state.sourceAudio.addEventListener('pause', updateSourcePlay);
      state.sourceAudio.addEventListener('play', updateSourcePlay);
      $('coverFileName').textContent = file.name;
      $('coverFileMeta').textContent = `${formatBytes(file.size)} · ${t('ready')}`;
      $('coverSourceCard').classList.remove('is-hidden');
      $('coverHistorySourceUpload').classList.add('is-hidden');
      $('coverUploadPanel').classList.add('is-hidden');
      $('coverWorkspace').classList.remove('is-hidden');
      requestAnimationFrame(() => $('coverWorkspace').classList.add('is-ready'));
      track('audio_uploaded', {
        status: 'completed',
        properties: {
          source: source || (demo ? 'demo' : 'user'),
          file_type: demo ? 'wav' : extension,
          size_bucket: sizeBucket(file.size),
        },
      });
      return true;
    } catch (error) {
      track('audio_uploaded', { status: 'failed', properties: { source: source || (demo ? 'demo' : 'user'), file_type: extension } });
      toast(error.message || t('uploadFailed'));
      return false;
    } finally {
      dropzone.classList.remove('is-uploading');
      $('coverDropTitle').textContent = t('dropTitle');
    }
  }

  // Loads a showcase song as the original and fills in its lyrics, so the
  // lyric recognition allowance is not needed. Resolves 'filled', 'cancelled' or 'failed'.
  async function fillExample({ title, audio, lyrics }) {
    const hasWork = state.file || $('coverLyrics').value.trim() || $('coverDescription').value.trim();
    if (hasWork && !(await window.yueComposer.confirmReplace(t('exampleConfirm', { title })))) return 'cancelled';
    if (state.historyView) exitHistoryView();
    else if (state.mode !== 'cover' && document.body.classList.contains('has-results')) window.yueComposer.goHome();
    setMode('cover');
    toast(t('exampleLoading', { title }));
    const name = `${title}.mp3`;
    let loaded = false;
    if (mockMode) {
      loaded = await selectFile({ name, size: 2.8 * 1024 ** 2 }, { demo: true, source: 'showcase' });
    } else {
      try {
        const response = await fetch(audio);
        if (!response.ok) throw new Error('example fetch failed');
        const blob = await response.blob();
        loaded = await selectFile(new File([blob], name, { type: 'audio/mpeg' }), { source: 'showcase' });
      } catch {
        toast(t('exampleLoadFailed'));
        return 'failed';
      }
    }
    if (!loaded) return 'failed';
    $('coverLyrics').value = lyrics;
    state.recognizedLyrics = lyrics;
    $('coverDescription').value = '';
    updateCounters();
    const description = $('coverDescription');
    description.focus({ preventScroll: true });
    description.closest('.cover-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(t('exampleFilled', { title }));
    return 'filled';
  }

  function openFilePicker() {
    const input = $('coverFileInput');
    input.value = '';
    input.click();
  }

  function clearSelectedFile() {
    if (state.sourceAudio) state.sourceAudio.pause();
    if (state.fileUrl?.startsWith('blob:') && !state.historySource) URL.revokeObjectURL(state.fileUrl);
    state.file = null;
    state.fileUrl = null;
    state.sourceId = null;
    state.sourceAudio = null;
    state.historySource = false;
    $('coverFileInput').value = '';
    $('coverSourceCard').classList.add('is-hidden');
    updateSourcePlay();

    if (state.historyView || $('coverResults').childElementCount > 0) {
      $('coverHistorySourceUpload').classList.remove('is-hidden');
      $('coverWorkspace').classList.remove('is-hidden');
      return;
    }
    $('coverHistorySourceUpload').classList.add('is-hidden');
    $('coverWorkspace').classList.remove('is-ready');
    $('coverWorkspace').classList.add('is-hidden');
    $('coverUploadPanel').classList.remove('is-hidden');
  }

  function updateSourcePlay() {
    const playing = state.sourceAudio && !state.sourceAudio.paused;
    $('coverSourcePlay').classList.toggle('is-playing', Boolean(playing));
    $('coverSourcePlay').querySelector('span').textContent = playing ? 'Ⅱ' : '▶';
    $('coverSourcePlay').setAttribute('aria-label', t(playing ? 'pauseOriginal' : 'playOriginal'));
  }

  function showHistorySource(source, fallbackSourceId) {
    if (!source?.audio_url) {
      if (state.sourceAudio) state.sourceAudio.pause();
      state.file = null;
      state.fileUrl = null;
      state.sourceId = null;
      state.sourceAudio = null;
      state.historySource = true;
      $('coverSourceCard').classList.add('is-hidden');
      $('coverHistorySourceUpload').classList.remove('is-hidden');
      updateSourcePlay();
      return;
    }
    if (state.sourceAudio) state.sourceAudio.pause();
    const filename = source.filename || 'original-song';
    const size = Number(source.size_bytes) || 0;
    state.file = { name: filename, size };
    state.fileUrl = source.audio_url;
    state.sourceId = source.source_id || fallbackSourceId || null;
    state.historySource = true;
    state.sourceAudio = new Audio(state.fileUrl);
    state.sourceAudio.preload = 'metadata';
    state.sourceAudio.addEventListener('ended', updateSourcePlay);
    state.sourceAudio.addEventListener('pause', updateSourcePlay);
    state.sourceAudio.addEventListener('play', updateSourcePlay);
    state.sourceAudio.addEventListener('error', () => {
      if (state.historyView && state.fileUrl === source.audio_url) showHistorySource(null, null);
    }, { once: true });
    $('coverFileName').textContent = filename;
    $('coverFileMeta').textContent = `${formatBytes(size)} · ${t('ready')}`;
    $('coverSourceCard').classList.remove('is-hidden');
    $('coverHistorySourceUpload').classList.add('is-hidden');
    updateSourcePlay();
  }

  async function recognizeLyrics() {
    if (!state.file) return toast(t('uploadFirst'));
    if (state.lyricsUsed >= MAX_USES) {
      track('quota_exhausted', { status: 'blocked', properties: { limit_type: 'lyrics_lifetime', remaining: 0 } });
      return toast(t('lyricsLimit'));
    }
    if (state.recognizing) return;
    const startedAt = Date.now();
    state.recognizing = true;
    $('recognizeLyricsButton').classList.add('is-loading');
    applyLanguage();
    track('lyrics_recognition_started', { status: 'started', properties: { remaining: Math.max(0, MAX_USES - state.lyricsUsed) } });
    try {
      let lyrics;
      let remaining;
      if (mockMode) {
        await new Promise(resolve => setTimeout(resolve, 900));
        lyrics = language() === 'zh'
          ? '[Verse]\nÁnh đèn đêm rơi trên đĩa nhạc cũ\nMột giai điệu quen vang qua con phố nhỏ\n\n[Chorus]\nHát lại bằng một giọng mới, dưới ánh trăng\nBiến khúc ca xưa thành điều mới mẻ hôm nay'
          : '[Verse]\nMidnight neon falls across an old refrain\nA familiar melody is calling out my name\n\n[Chorus]\nSing it in a new voice, let the moonlight start again\nTurn the song we used to know into something new today';
        remaining = Math.max(0, MAX_USES - state.lyricsUsed - 1);
      } else {
        const result = await api('/api/cover/recognize-lyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `lyrics-${Date.now()}-${crypto.randomUUID()}` },
          body: JSON.stringify({ source_id: state.sourceId }),
        });
        if (!result.has_vocals || !result.lyrics) throw new Error(language() === 'zh' ? 'Không phát hiện được lời hát rõ ràng.' : 'No recognizable vocal lyrics were found.');
        lyrics = result.lyrics;
        remaining = result.remaining;
      }
      state.lyricsUsed = MAX_USES - Math.max(0, Number(remaining));
      $('coverLyrics').value = lyrics;
      state.recognizedLyrics = lyrics;
      if (!mockMode) localStorage.setItem(LYRICS_USAGE_KEY, String(state.lyricsUsed));
      updateCounters();
      track('lyrics_recognition_completed', {
        status: 'completed',
        duration_ms: Date.now() - startedAt,
        properties: { remaining: Math.max(0, MAX_USES - state.lyricsUsed) },
      });
      toast(t('recognitionDone'));
    } catch (error) {
      track('lyrics_recognition_failed', { status: 'failed', duration_ms: Date.now() - startedAt, properties: { stage: 'recognition' } });
      if (error.status === 429 && /all three/i.test(error.message)) {
        state.lyricsUsed = MAX_USES;
        if (!mockMode) localStorage.setItem(LYRICS_USAGE_KEY, String(state.lyricsUsed));
      }
      toast(error.message || t('recognitionFailed'));
    } finally {
      state.recognizing = false;
      $('recognizeLyricsButton').classList.remove('is-loading');
      applyLanguage();
    }
  }

  function seededPeaks(seed, count = 104) {
    let value = seed;
    return Array.from({ length: count }, (_, index) => {
      value = (value * 9301 + 49297 + index) % 233280;
      return .18 + (value / 233280) * .78;
    });
  }

  function drawWave(canvas, peaks, progress = 0) {
    const rect = canvas.getBoundingClientRect();
    const ratio = devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    const gap = 2.2 * ratio;
    const barWidth = Math.max(1, width / peaks.length - gap);
    peaks.forEach((peak, index) => {
      const x = index * width / peaks.length;
      const barHeight = Math.max(2 * ratio, peak * height * .75);
      context.fillStyle = index / peaks.length <= progress ? '#fc3e57' : '#e9e8ec';
      context.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
    });
  }

  function formatTime(value) {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
  }

  function createPlayer(url, index, generationId = '', candidateId = '') {
    const row = document.createElement('article');
    row.className = 'candidate is-audio-loading';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'play-button is-loading'; button.disabled = true;
    const version = document.createElement('span'); version.className = 'version'; version.textContent = `V${index}.0`;
    const waveWrap = document.createElement('div'); waveWrap.className = 'wave-wrap';
    const canvas = document.createElement('canvas'); canvas.className = 'waveform'; waveWrap.append(canvas);
    const duration = document.createElement('span'); duration.className = 'duration'; duration.textContent = '0:00/--:--';
    const download = document.createElement('a'); download.className = 'download-button'; download.href = url; download.download = `yue2-cover-v${index}.${url.startsWith('blob:') ? 'wav' : 'mp3'}`; download.setAttribute('aria-label', t('download', { index }));
    download.dataset.generationId = generationId;
    download.dataset.candidateId = candidateId;
    download.dataset.variant = String(index);
    download.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14"/></svg>';
    row.append(button, version, waveWrap, duration, download);
    const audio = new Audio(url);
    const peaks = seededPeaks(4409 + index * 811);
    const redraw = () => drawWave(canvas, peaks, audio.duration ? audio.currentTime / audio.duration : 0);
    const setButton = () => {
      const playing = !audio.paused && !audio.ended;
      button.classList.remove('is-loading'); button.disabled = false;
      button.innerHTML = playing
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
      button.setAttribute('aria-label', t(playing ? 'pause' : 'play', { index }));
    };
    audio.addEventListener('loadedmetadata', () => { row.classList.remove('is-audio-loading'); setButton(); duration.textContent = `0:00/${formatTime(audio.duration)}`; redraw(); });
    audio.addEventListener('timeupdate', () => { duration.textContent = `${formatTime(audio.currentTime)}/${formatTime(audio.duration)}`; redraw(); });
    audio.addEventListener('play', () => {
      setButton();
      const card = row.closest('[data-cover-job]');
      track('audio_played', {
        job_id: card?.dataset.coverJob,
        generation_id: generationId || card?.dataset.coverJob,
        candidate_id: candidateId || undefined,
        status: 'started',
        properties: { variant: index },
      });
    });
    audio.addEventListener('pause', setButton); audio.addEventListener('ended', setButton);
    button.addEventListener('click', async () => { state.players.forEach(player => { if (player.audio !== audio) player.audio.pause(); }); if (audio.paused) await audio.play(); else audio.pause(); });
    canvas.addEventListener('click', async event => {
      if (!audio.duration) return;
      const rect = canvas.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(audio.duration - .01, (event.clientX - rect.left) / rect.width * audio.duration));
      if (audio.paused) await audio.play();
    });
    audio.load();
    const resize = new ResizeObserver(redraw); resize.observe(canvas);
    state.players.push({ audio, resize });
    return row;
  }

  function renderGenerating(jobNumber) {
    const card = document.createElement('section');
    card.className = 'cover-result-card'; card.dataset.coverJob = String(jobNumber);
    card.setAttribute('aria-busy', 'true');
    card.innerHTML = `<div class="cover-result-main"><div class="generation-status"><span class="spinner"></span><strong data-cover-text="preparing">${t('preparing')}</strong></div><h2 data-cover-text="coverTitle">${t('coverTitle')}</h2><p>${$('coverDescription').value.trim()}</p><div class="cover-progress"><div class="cover-progress-track"><i></i></div><span>${t('preparing')}</span></div></div><aside class="cover-result-lyrics"><div class="lyrics-title-row"><span data-cover-text="resultLyrics">${t('resultLyrics')}</span></div><div class="lyrics-scroll"></div></aside>`;
    card.querySelector('.lyrics-scroll').textContent = $('coverLyrics').value.trim();
    $('coverResults').append(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return card;
  }

  function completeCard(card, candidates = null) {
    const status = card.querySelector('.generation-status');
    status.classList.add('is-complete');
    status.querySelector('strong').dataset.coverText = 'complete';
    status.querySelector('strong').textContent = t('complete');
    card.querySelector('.cover-progress').remove();
    const list = document.createElement('div'); list.className = 'candidate-list';
    const urls = candidates
      ? candidates.map(candidate => candidate?.result?.audio_url).filter(Boolean)
      : [makeToneWav(246.94, 13), makeToneWav(293.66, 15)];
    urls.slice(0, 2).forEach((url, index) => list.append(createPlayer(
      url,
      index + 1,
      card.dataset.coverJob || '',
      candidates?.[index]?.id || '',
    )));
    if (!urls.length) throw new Error('Generated audio is not available yet.');
    card.querySelector('.cover-result-main').append(list);
  }

  function renderHistoryCard(job) {
    disposePlayers();
    $('coverResults').replaceChildren();
    const request = job.request || {};
    const card = document.createElement('section');
    card.className = 'cover-result-card';
    card.dataset.coverJob = String(job.id || 'cover-history');
    card.innerHTML = `<div class="cover-result-main"><div class="generation-status"><span class="spinner"></span><strong></strong></div><h2 data-cover-text="coverTitle">${t('coverTitle')}</h2><p></p><div class="cover-progress"><div class="cover-progress-track"><i></i></div><span></span></div></div><aside class="cover-result-lyrics"><div class="lyrics-title-row"><span data-cover-text="resultLyrics">${t('resultLyrics')}</span></div><div class="lyrics-scroll"></div></aside>`;
    card.querySelector('.cover-result-main > p').textContent = request.music_description || request.style || '';
    card.querySelector('.lyrics-scroll').textContent = request.lyrics || '';
    $('coverResults').append(card);
    if (job.status === 'completed') {
      completeCard(card, job.candidates || []);
    } else if (job.status === 'failed') {
      syncQuota(job.remaining, undefined);
      markCardFailed(card, coverFailureMessage(job));
    } else {
      updateGenerationStage(card, job.stage);
    }
    return card;
  }

  async function openHistoryJob(job) {
    setMode('cover', { history: true });
    const request = job.request || {};
    showHistorySource(job.source, request.source_id);
    state.voice = ['auto', 'female', 'male'].includes(request.vocal_gender) ? request.vocal_gender : 'auto';
    state.strength = ['high', 'main_melody'].includes(request.melody_adherence) ? request.melody_adherence : 'high';
    state.styles.clear();
    $('coverCustomStyle').value = request.style || '';
    $('coverLyrics').value = request.lyrics || '';
    $('coverDescription').value = request.music_description || '';
    document.querySelectorAll('[data-cover-group="voice"] button').forEach(button => button.classList.toggle('is-active', button.dataset.value === state.voice));
    document.querySelectorAll('[data-cover-group="strength"] button').forEach(button => button.classList.toggle('is-active', button.dataset.value === state.strength));
    document.querySelectorAll('#coverStyleChoices button').forEach(button => button.classList.remove('is-active'));
    updateCounters();
    applyLanguage();
    $('coverUploadPanel').classList.add('is-hidden');
    $('coverWorkspace').classList.remove('is-hidden');
    $('coverWorkspace').classList.add('is-ready');
    const card = renderHistoryCard(job);
    if (!['completed', 'failed'].includes(job.status)) {
      try {
        const completed = await pollCoverJob(job.id, card);
        renderHistoryCard(completed);
      } catch (error) {
        markCardFailed(card, error.message);
      }
    }
  }

  function updateGenerationStage(card, stage) {
    const stageKey = ({ score_pending: 'preparing', transcribing_score: 'score', submitting_generation: 'submit', waiting_for_capacity: 'waiting', generating: 'render' })[stage] || 'render';
    const progress = ({ preparing: 12, score: 38, submit: 66, waiting: 72, render: 88 })[stageKey];
    const message = t(stageKey);
    card.querySelector('.generation-status strong').textContent = message;
    card.querySelector('.cover-progress span').textContent = message;
    card.querySelector('.cover-progress-track i').style.width = `${progress}%`;
  }

  function coverFailureMessage(job) {
    if (language() === 'zh') {
      if (job?.error?.code === 'yue_capacity_timeout') return 'GPU đang bận, lượt cover đã được hoàn lại, vui lòng thử lại sau.';
      if (String(job?.error?.code || '').startsWith('sheetsage_http_')) return 'Phân tích bài gốc thất bại, vui lòng thử tệp âm thanh khác.';
      return 'Tạo bản cover thất bại, vui lòng thử lại.';
    }
    return job?.error?.message || 'Cover generation failed. Your cover opportunity was restored.';
  }

  function markCardFailed(card, message) {
    card.classList.add('is-failed');
    card.setAttribute('aria-busy', 'false');
    const status = card.querySelector('.generation-status');
    status?.classList.add('is-failed');
    const strong = status?.querySelector('strong');
    if (strong) strong.textContent = message;
    card.querySelector('.cover-progress')?.remove();
  }

  async function pollCoverJob(jobId, card) {
    for (;;) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const job = await api(`/api/cover/jobs/${encodeURIComponent(jobId)}`);
      syncQuota(job.remaining, undefined);
      if (job.status === 'completed') return job;
      if (job.status === 'failed') {
        const error = new Error(coverFailureMessage(job));
        error.job = job;
        throw error;
      }
      updateGenerationStage(card, job.stage);
    }
  }

  async function generateCover() {
    if (state.used >= MAX_USES) {
      track('quota_exhausted', { status: 'blocked', properties: { limit_type: 'cover_lifetime', remaining: 0 } });
      window.yueAnalytics?.trackOutbound('quota_redirect_cover', 'noiz.ai', 'cover');
      location.href = window.yueAnalytics?.outboundUrl('quota_redirect_cover') || 'https://noiz.ai/create/music';
      return;
    }
    if (!state.file) return toast(t('uploadFirst'));
    if (!$('coverLyrics').value.trim()) return toast(t('lyricsRequired'));
    if (!$('coverDescription').value.trim() && !state.styles.size && !$('coverCustomStyle').value.trim()) return toast(t('styleRequired'));
    if (state.generating) return;
    const startedAt = Date.now();
    state.generating = true; updateQuota();
    let jobId = `cover_${Date.now()}_${++state.jobs}`;
    const card = renderGenerating(jobId);
    track('generation_submitted', {
      job_id: jobId,
      status: 'started',
      properties: {
        melody_adherence: state.strength,
        voice: state.voice,
        style_count: state.styles.size + ($('coverCustomStyle').value.trim() ? 1 : 0),
        lyrics_edited: Boolean(state.recognizedLyrics && state.recognizedLyrics !== $('coverLyrics').value),
      },
    });
    const stages = [['score', 35], ['submit', 68], ['render', 88]];
    try {
      let completed;
      if (mockMode) {
        for (const [stage, progress] of stages) {
          await new Promise(resolve => setTimeout(resolve, 900));
          const message = t(stage);
          card.querySelector('.generation-status strong').textContent = message;
          card.querySelector('.cover-progress span').textContent = message;
          card.querySelector('.cover-progress-track i').style.width = `${progress}%`;
        }
      } else {
        const style = [...state.styles, $('coverCustomStyle').value.trim()].filter(Boolean).join(', ');
        const submitted = await api('/api/cover/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `cover-${Date.now()}-${crypto.randomUUID()}` },
          body: JSON.stringify({
            source_id: state.sourceId,
            lyrics: $('coverLyrics').value.trim(),
            music_description: $('coverDescription').value.trim(),
            style,
            melody_adherence: state.strength,
            vocal_gender: state.voice,
          }),
        });
        jobId = submitted.id;
        card.dataset.coverJob = jobId;
        syncQuota(submitted.remaining, undefined);
        updateGenerationStage(card, submitted.stage);
        completed = await pollCoverJob(jobId, card);
      }
      completeCard(card, completed?.candidates || null);
      if (mockMode) state.used += 1;
      track('generation_completed', {
        job_id: jobId,
        status: 'completed',
        duration_ms: Date.now() - startedAt,
        properties: { stage: 'generation' },
      });
      if (mockMode) toast(t('mockOnly'));
    } catch (error) {
      markCardFailed(card, error.message);
      if (error.status === 429 && /all three/i.test(error.message)) {
        state.used = MAX_USES;
        if (!mockMode) window.yueGenerationQuota.setUsed(state.used);
      }
      track('generation_failed', { job_id: jobId, status: 'failed', duration_ms: Date.now() - startedAt, properties: { stage: 'generation' } });
      toast(error.message);
    } finally {
      state.generating = false; updateQuota();
      void refreshServerQuota();
    }
  }

  $('textModeTab').addEventListener('click', () => setMode('text'));
  $('coverModeTab').addEventListener('click', () => setMode('cover'));
  $('backButton').addEventListener('click', event => {
    if (!state.historyView) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exitHistoryView();
  }, true);
  $('languageToggle').addEventListener('click', () => queueMicrotask(applyLanguage));
  $('coverFileInput').addEventListener('change', event => { const [file] = event.target.files; if (file) void selectFile(file); });
  $('coverDropzone').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFilePicker(); } });
  ['dragenter', 'dragover'].forEach(name => $('coverDropzone').addEventListener(name, event => { event.preventDefault(); $('coverDropzone').classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach(name => $('coverDropzone').addEventListener(name, event => { event.preventDefault(); $('coverDropzone').classList.remove('is-dragging'); }));
  $('coverDropzone').addEventListener('drop', event => { const [file] = event.dataTransfer.files; if (file) void selectFile(file); });
  $('coverDemoButton').addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void selectFile({ name: t('demoName'), size: 2.8 * 1024 ** 2 }, { demo: true }); });
  $('coverReplaceFile').addEventListener('click', openFilePicker);
  $('coverRemoveFile').addEventListener('click', clearSelectedFile);
  $('coverHistoryUploadButton').addEventListener('click', openFilePicker);
  $('coverSourcePlay').addEventListener('click', async () => { if (!state.sourceAudio) return; if (state.sourceAudio.paused) await state.sourceAudio.play(); else state.sourceAudio.pause(); });
  $('recognizeLyricsButton').addEventListener('click', recognizeLyrics);
  $('coverGenerateButton').addEventListener('click', generateCover);
  $('coverLyrics').addEventListener('input', updateCounters);
  $('coverDescription').addEventListener('input', updateCounters);
  document.querySelectorAll('[data-cover-group]').forEach(group => group.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    group.querySelectorAll('button').forEach(item => item.classList.toggle('is-active', item === button));
    state[group.dataset.coverGroup] = button.dataset.value;
  })));
  document.querySelectorAll('#coverStyleChoices button').forEach(button => button.addEventListener('click', () => {
    if (state.styles.has(button.dataset.value)) state.styles.delete(button.dataset.value); else state.styles.add(button.dataset.value);
    button.classList.toggle('is-active', state.styles.has(button.dataset.value));
  }));

  if (mockMode) $('coverDemoButton').classList.remove('is-hidden');
  window.yueCoverHistory = { open: openHistoryJob, switchToText, mockItems: mockHistoryItems, fillExample };
  window.addEventListener('yue:quota', () => {
    if (mockMode) return;
    state.used = window.yueGenerationQuota.used;
    updateQuota();
  });
  updateCounters();
  applyLanguage();
  void refreshServerQuota();
})();
