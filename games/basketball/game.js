/* Basketball game controller (basketball-only; football keeps games/sports/game.js).
 * Platform contract preserved: school-basketball-{ready,config,question,result,outcome,
 * next,advance,retry,fullscreen}. Messages are accepted only from the same origin AND
 * from window.parent, with the session token and the current question index, and only
 * in the phase where they make sense. The game never grades: correctness comes from
 * the host after its own assessment. Standalone mode uses separate practice questions.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PREFIX = 'school-basketball-';
  const embedded = window.parent !== window;
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const store = { get(k, d) { try { const v = localStorage.getItem('manarat-bb-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('manarat-bb-' + k, JSON.stringify(v)); } catch (e) { } } };

  // practice questions for the standalone demo only (never sent anywhere; no real assignment data)
  const DEMO = [
    { text: 'كم نقطة تُحتسب للتصويبة الناجحة من داخل قوس الثلاث نقاط؟', options: ['نقطتان', 'نقطة واحدة', 'ثلاث نقاط', 'أربع نقاط'], correct: 0 },
    { text: 'ما ناتج ٨ × ٧؟', options: ['٥٤', '٥٦', '٦٤', '٤٨'], correct: 1 },
    { text: 'ما عاصمة دولة قطر؟', options: ['الوكرة', 'الخور', 'الدوحة', 'دخان'], correct: 2 }
  ];
  const DEMO_TITLE = 'تحدّي كرة السلة التدريبي';

  const S = {
    phase: 'loading', round: 0, total: embedded ? 1 : DEMO.length, token: '', title: embedded ? '' : DEMO_TITLE,
    makes: 0, correct: 0, pending: 0, answered: 0, eduPoints: null, result: '', feedback: '',
    assetsReady: false, configReady: !embedded, audioOn: false, flight: 0, sceneMode: ''
  };
  document.body.dataset.mode = embedded ? 'embedded' : 'standalone';

  // ---------- audio ----------
  const audio = window.BasketballAudio.create({ muted: store.get('muted', false), volume: store.get('volume', 0.8), crowdBase: '../football/assets/' });

  // ---------- scene ----------
  let scene;
  const quality = window.SportScene.detectQuality(new URLSearchParams(location.search).get('quality') || undefined);
  try {
    scene = window.SportScene.create($('pitch'), { quality, reducedMotion, assetBase: 'assets/', onEvent: sceneEvent, preserveDrawingBuffer: /[?&]capture=1/.test(location.search) });
  } catch (e) {
    fail('تعذر تشغيل الرسوم ثلاثية الأبعاد على هذا الجهاز. حدّث المتصفح وتأكد من تفعيل WebGL ثم أعد المحاولة.', String(e && e.message || e));
    return;
  }

  // ---------- helpers ----------
  function post(type, extra = {}) {
    if (!embedded) return;
    window.parent.postMessage({ type: PREFIX + type, index: S.round, token: S.token, ...extra }, location.origin);
  }
  function setPhase(p) { S.phase = p; document.body.dataset.phase = p; updateControls(); }
  const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  function updateHud() {
    $('bbPoints').textContent = ar(S.makes * 2);
    $('attempt').textContent = ar(Math.min(S.round + 1, S.total)) + ' / ' + ar(S.total);
    $('eduCorrect').textContent = ar(S.correct);
    $('eduPending').hidden = S.pending === 0; $('eduPendingN').textContent = ar(S.pending);
    $('eduPointsWrap').hidden = S.eduPoints === null; if (S.eduPoints !== null) $('eduPoints').textContent = ar(S.eduPoints);
    $('assignmentTitle').textContent = S.title || 'كرة السلة';
    document.title = (S.title ? S.title + ' | ' : '') + 'كرة السلة — منصة التعلّم التفاعلي';
    scene && scene.scoreboard && scene.scoreboard({ home: S.makes * 2, away: 0, label: 'المحاولة ' + ar(Math.min(S.round + 1, S.total)) + ' من ' + ar(S.total) });
  }
  function say(text) { $('instruction').textContent = text; }
  function updateControls() {
    const p = S.phase;
    $('shoot').hidden = !(p === 'ready' || p === 'windup');
    $('shoot').disabled = p !== 'ready';
    $('next').hidden = p !== 'outcome';
    $('reopen').hidden = !(embedded && p === 'question');
    $('controls').hidden = ['loading', 'welcome', 'finished', 'error'].includes(p);
  }
  function fail(msg, detail) {
    S.phase = 'error'; document.body.dataset.phase = 'error';
    $('loading').hidden = true; $('welcome').hidden = true; $('controls').hidden = true;
    $('loadingError').hidden = false; $('errorText').textContent = msg; if (detail) $('errorDetail').textContent = detail;
  }

  // ---------- loading ----------
  const fontsReady = (document.fonts && document.fonts.load) ? Promise.all(['400 16px Tajawal', '700 16px Tajawal', '800 16px Tajawal'].map(f => document.fonts.load(f))).catch(() => { }) : Promise.resolve();
  const watchdog = setTimeout(() => { if (!S.assetsReady) $('loadSlow').hidden = false; }, 15000);
  fontsReady.then(() => scene.load(p => { const pct = Math.round(p * 100); $('loadBar').style.width = pct + '%'; $('loadPct').textContent = ar(pct) + '٪'; $('loadMeter').setAttribute('aria-valuenow', String(pct)); }))
    .then(() => {
      clearTimeout(watchdog);
      S.assetsReady = true; $('loadBar').style.width = '100%';
      maybeWelcome();
    })
    .catch(e => { clearTimeout(watchdog); fail('تعذر تحميل ملفات الملعب أو اللاعبين. تحقّق من الاتصال ثم أعد المحاولة.', String(e && e.message || e)); });

  function maybeWelcome() {
    if (!S.assetsReady || !S.configReady || S.phase !== 'loading') return;
    $('loading').hidden = true; $('welcome').hidden = false;
    $('start').disabled = false; $('start').textContent = 'ادخل الملعب';
    $('modeLabel').textContent = embedded ? 'مهمة من المعلّم · تُحتسب الدرجات من المنصة' : 'تجربة تدريبية · لا تُسجَّل في تقارير الطلاب';
    setPhase('welcome'); updateHud();
    $('start').focus({ preventScroll: true });
  }

  // ---------- flow ----------
  async function start() {
    if (S.phase !== 'welcome') return;
    $('welcome').hidden = true;
    audio.unlock().then(ok => { S.audioOn = ok; if (ok) audio.event('whistle'); syncSound(); });
    updateHud();
    if (scene.state.mode === 'ready') { setPhase('ready'); say('اضغط «صوّب» أو مفتاح المسافة عندما تكون جاهزًا'); }
    else { setPhase('intro'); say('استعد… اللاعب يتسلّم الكرة'); }
  }
  function shoot() {
    if (S.phase !== 'ready') return;
    audio.unlock().then(ok => { S.audioOn = ok; syncSound(); });
    if (scene.shoot()) { setPhase('windup'); say('ثنيُ الركبتين… قفزة… تصويب!'); }
  }
  function ask() {
    setPhase('question');
    audio.crowd('question');
    say('الكرة معلّقة في منتصف الطريق… أجب لتكمل التسديدة');
    if (embedded) { post('question'); return; }
    const q = DEMO[S.round];
    $('qEyebrow').textContent = 'السؤال ' + ar(S.round + 1) + ' من ' + ar(S.total);
    $('questionText').textContent = q.text;
    $('choices').replaceChildren(...q.options.map((label, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'choice';
      b.innerHTML = `<span class="key" aria-hidden="true">${ar(i + 1)}</span><span></span>`; b.lastChild.textContent = label;
      b.onclick = () => resolve({ correct: i === q.correct, pending: false, feedback: i === q.correct ? 'إجابة صحيحة. أحسنت!' : 'الإجابة الصحيحة: ' + q.options[q.correct] });
      return b;
    }));
    $('question').hidden = false;
    requestAnimationFrame(() => $('choices').querySelector('button').focus({ preventScroll: true }));
  }
  function resolve(result) {
    if (S.phase !== 'question') return;
    S.pendingAnswer = result.pending === true;
    S.correctAnswer = result.correct === true && !S.pendingAnswer;
    S.feedback = String(result.feedback || '');
    if (typeof result.points === 'number' && isFinite(result.points)) S.eduPoints = (S.eduPoints || 0) + result.points;
    S.result = S.pendingAnswer ? 'pending' : S.correctAnswer ? 'goal' : 'wide';
    $('question').hidden = true;
    say(S.pendingAnswer ? 'أُرسلت إجابتك للمراجعة…' : 'شاهد مصير التسديدة…');
    setPhase('resolve');
    scene.resolve(S.pendingAnswer ? 'pending' : S.correctAnswer ? 'make' : 'miss');
  }
  function outcome() {
    setPhase('outcome');
    S.answered++;
    if (S.result === 'goal') { S.makes++; S.correct++; }
    if (S.result === 'pending') S.pending++;
    audio.crowd(S.result === 'goal' ? 'make' : S.result === 'wide' ? 'miss' : 'pending');
    const fb = $('feedback');
    fb.dataset.kind = S.result;
    $('momentLabel').textContent = S.result === 'pending' ? 'بانتظار مراجعة المعلّم' : S.result === 'goal' ? 'إجابة صحيحة' : 'محاولة جيدة';
    $('momentTitle').textContent = S.result === 'pending' ? 'وصلت إجابتك' : S.result === 'goal' ? 'سلّة! +٢' : 'ارتدّت من الحلقة';
    $('momentText').textContent = S.feedback || (S.result === 'pending' ? 'ستُحتسب الدرجة بعد مراجعة المعلّم.' : '');
    fb.hidden = false;
    const last = S.round + 1 >= S.total;
    $('next').textContent = last ? 'عرض النتيجة' : 'التسديدة التالية';
    $('next').disabled = false;
    say(S.result === 'pending' ? 'لا تُحتسب هذه التسديدة نجاحًا أو إخفاقًا حتى يراجعها المعلّم.' : S.result === 'goal' ? 'أحسنت! أكمل بنفس التركيز.' : 'لا بأس… استعد لفرصة جديدة.');
    updateHud();
    post('outcome', { outcome: S.result });
    requestAnimationFrame(() => $('next').focus({ preventScroll: true }));
  }
  function next() {
    if (S.phase !== 'outcome') return;
    if (embedded) { $('next').disabled = true; post('next'); return; }
    if (S.round + 1 < S.total) advance();
    else finish();
  }
  function advance() {
    S.round++;
    $('feedback').hidden = true;
    audio.stopReactions(); audio.crowd('calm');
    setPhase('passing'); say('زميلك يمرّر الكرة…');
    scene.nextRound();
    updateHud();
  }
  function finish(early = false) {
    setPhase('finished');
    $('feedback').hidden = true; $('question').hidden = true;
    audio.event('whistle');
    $('sumTitle').textContent = S.title || DEMO_TITLE;
    $('sumEyebrow').textContent = early ? 'انتهت المحاولة مبكرًا' : 'نهاية التحدّي';
    $('sumBall').textContent = ar(S.makes * 2);
    $('sumCorrect').textContent = ar(S.correct) + ' / ' + ar(S.answered);
    $('sumPendingRow').hidden = S.pending === 0; $('sumPending').textContent = ar(S.pending);
    $('sumNote').textContent = embedded ? 'تُعرض الدرجة الرسمية في المنصة.' : 'هذه تجربة تدريبية ولا تُسجَّل في تقارير الطلاب.';
    $('summary').hidden = false; $('again').hidden = embedded;
    requestAnimationFrame(() => (embedded ? $('summary') : $('again')).focus({ preventScroll: true }));
  }
  function restart() {
    if (embedded) return;
    S.round = 0; S.makes = 0; S.correct = 0; S.pending = 0; S.answered = 0; S.eduPoints = null;
    $('summary').hidden = true; $('feedback').hidden = true; $('question').hidden = true;
    audio.stopReactions();
    if (S.phase === 'ready' || S.phase === 'welcome' || S.phase === 'intro') { setPhase(S.phase === 'welcome' ? 'welcome' : 'ready'); updateHud(); return; }
    setPhase('passing'); say('بداية جديدة… زميلك يمرّر الكرة');
    scene.nextRound();
    updateHud();
  }

  // ---------- scene events ----------
  function sceneEvent(type, d) {
    if (type === 'ready') {
      if (S.phase === 'intro' || S.phase === 'passing') { setPhase('ready'); say('اضغط «صوّب» أو مفتاح المسافة عندما تكون جاهزًا'); }
    } else if (type === 'question') { if (S.phase === 'windup') ask(); }
    else if (type === 'outcome') { if (S.phase === 'resolve') outcome(); }
    else if (type === 'gather') audio.crowd('anticipate');
    if (S.audioOn) {
      if (['dribble', 'contact', 'release', 'land', 'squeak', 'catch', 'pass', 'gather'].includes(type)) audio.event(type, d);
    }
  }

  // ---------- platform messages ----------
  window.addEventListener('message', e => {
    if (!embedded || e.origin !== location.origin || e.source !== window.parent) return;
    const m = e.data; if (!m || typeof m !== 'object' || typeof m.type !== 'string' || !m.type.startsWith(PREFIX)) return;
    const kind = m.type.slice(PREFIX.length);
    if (kind === 'config') {
      if (S.configReady || S.phase !== 'loading') return;
      const token = typeof m.token === 'string' ? m.token : String(m.token || '');
      if (!token) return;
      S.total = Math.max(1, Math.min(100, Number(m.count) || 1));
      S.token = token; S.title = String(m.title || 'مهمة المعلّم').slice(0, 160);
      const meta = [];
      if (m.subject) meta.push(String(m.subject).slice(0, 60));
      if (m.teacher) meta.push('المعلّم: ' + String(m.teacher).slice(0, 60));
      $('assignmentMeta').textContent = meta.join(' · '); $('assignmentMeta').hidden = !meta.length;
      S.configReady = true; updateHud(); maybeWelcome();
      return;
    }
    if (!S.token || m.token !== S.token || m.index !== S.round) return;
    if (kind === 'result' && S.phase === 'question') resolve(m);
    else if (kind === 'retry' && S.phase === 'outcome') $('next').disabled = false;
    else if (kind === 'advance' && S.phase === 'outcome') { $('next').disabled = false; advance(); }
  });

  // ---------- controls ----------
  $('start').onclick = start;
  $('shoot').onclick = shoot;
  $('next').onclick = next;
  $('again').onclick = restart;
  $('reopen').onclick = () => { if (S.phase === 'question') post('question'); };
  $('retryLoad').onclick = () => location.reload();
  function syncSound() {
    const on = !audio.muted;
    $('sound').setAttribute('aria-pressed', String(on));
    $('sound').setAttribute('aria-label', on ? 'كتم الصوت' : 'تشغيل الصوت');
    $('sound').dataset.on = on ? '1' : '0';
    $('volume').value = String(Math.round(audio.volume * 100));
  }
  $('sound').onclick = () => { audio.setMuted(!audio.muted); store.set('muted', audio.muted); if (!audio.muted) audio.unlock().then(ok => { S.audioOn = ok; }); syncSound(); };
  $('volume').oninput = e => { audio.setVolume(Number(e.target.value) / 100); store.set('volume', audio.volume); if (audio.muted && audio.volume > 0) { audio.setMuted(false); store.set('muted', false); } syncSound(); };
  syncSound();
  $('fullscreen').onclick = async () => {
    try {
      if (embedded) { post('fullscreen'); return; }
      if (document.fullscreenElement) await document.exitFullscreen(); else await $('stadium').requestFullscreen({ navigationUI: 'hide' });
    } catch (err) { say('يمكنك تدوير الجهاز أفقيًا لمشهد أوسع.'); }
  };
  document.addEventListener('fullscreenchange', () => { $('fullscreen').setAttribute('aria-pressed', String(!!document.fullscreenElement)); setTimeout(() => scene.resize(), 60); });
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if ((e.code === 'Space' || e.code === 'Enter') && S.phase === 'ready' && (e.target === document.body || e.target === $('pitch'))) { e.preventDefault(); shoot(); }
    if (S.phase === 'question' && !embedded && /^Digit[1-4]$|^Numpad[1-4]$/.test(e.code) && tag !== 'INPUT') { const i = Number(e.code.slice(-1)) - 1; const b = $('choices').children[i]; if (b) { e.preventDefault(); b.click(); } }
  });

  // standalone lifecycle hooks for the shared platform navigation bar (restart / end early)
  if (!embedded) {
    window.ManaratGameControls = {
      isActive: () => !['loading', 'welcome', 'finished', 'error'].includes(S.phase),
      canRestart: () => true,
      isBusy: () => false,
      restart: async () => restart(),
      end: async () => finish(true)
    };
  }

  // ---------- loop, resize, visibility, cleanup ----------
  let last = 0, raf = 0, perf = { acc: 0, n: 0, t: 0, ratio: quality.pixelRatio, stepped: 0 };
  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    if (!document.hidden) {
      scene.update(dt);
      const cam = scene.camera; if (cam && S.audioOn) { const r = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion); audio.setListener(cam.position.toArray(), r.toArray()); }
      governor(dt);
    }
    raf = requestAnimationFrame(frame);
  }
  function governor(dt) {
    // adaptive resolution: if frames are consistently slow, lower the pixel ratio (never below 0.7)
    if (!dt || S.phase === 'loading') return;
    perf.acc += dt; perf.n++; perf.t += dt;
    if (perf.t >= 4) {
      const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0; perf.t = 0;
      if (avg > 0.028 && perf.stepped < 5) {
        perf.stepped++;
        if (perf.ratio > 0.75) { perf.ratio = Math.max(0.7, perf.ratio - 0.25); scene.setPixelRatio(perf.ratio); }
        else if (!perf.thinned) { perf.thinned = true; scene.thinCrowd && scene.thinCrowd(0.6); }
      }
    }
  }
  // QA capture mode (?capture=1&manual=1): frames are stepped by the test runner at a fixed
  // timestep instead of requestAnimationFrame, so recordings/screenshots are deterministic.
  const manual = /[?&]manual=1/.test(location.search) && /[?&]capture=1/.test(location.search);
  if (manual) window.__qaStep = (sec = 1 / 30, dt = 1 / 30, render = true) => {
    const r = scene.renderer.render; if (!render) scene.renderer.render = () => { };
    try { for (let t = 0; t < sec - 1e-9; t += dt) scene.update(dt); } finally { scene.renderer.render = r; }
    // Non-rendered QA steps intentionally skip GPU work.
    return S.phase;
  };
  else raf = requestAnimationFrame(frame);
  const onResize = () => scene.resize();
  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe($('stadium'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else { audio.resume(); last = 0; } });
  window.addEventListener('pagehide', () => { cancelAnimationFrame(raf); audio.close(); try { scene.dispose(); } catch (e) { } });
  $('pitch').addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); audio.suspend(); fail('توقف عرض الرسوم على الجهاز. اضغط «إعادة المحاولة» لاستكمال اللعب.'); });

  // scene polling for phase transitions that depend on the scene clock
  setInterval(() => { if (scene.state) S.sceneMode = scene.state.mode; }, 250);

  // debug / test surface (read-only)
  window.SportGame = window.Basketball = {
    snapshot: () => scene.snapshot(),
    get phase() { return S.phase; }, get round() { return S.round; }, get goals() { return S.makes; }, get outcome() { return S.result; },
    get audioReady() { return S.audioOn; }, get audio() { return audio.stats(); }, audioAnalyse: () => audio.analyse(), get title() { return S.title; }, get total() { return S.total; }, get correct() { return S.correct; }, get pending() { return S.pending; }
  };

  updateHud(); updateControls();
  if (embedded) post('ready');
})();
