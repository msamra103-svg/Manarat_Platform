/* Football game shell: renderer + quality tiers, asset loading, match director wiring, cameras, replay, audio, touch-first controls,
 * broadcast HUD and the school-platform iframe protocol (school-football-*).
 * Assessment authority stays in the parent (school-api): this file never grades anything. It only receives {correct, pending, feedback}
 * and turns it into a physical outcome. The shared games/sports/* engine is not used by this page. */
(function () {
  'use strict';
  const FB = window.FB, T = THREE, V = T.Vector3, M = FB.math, { clamp, lerp } = M, G = FB.PITCH, GZ = G.goalZ, HW = G.goalHalf, GH = G.goalHeight;
  const $ = id => document.getElementById(id);
  const embedded = window.parent !== window;
  const params = new URLSearchParams(location.search);
  const canvas = $('pitch'), stage = $('stadium');
  const touchDevice = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
  const STEP = 1 / 60;

  /* ------------------------------------------------------------------ settings */
  const SKEY = 'footballSettings';
  const readSettings = () => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; } };
  const settings = Object.assign({ mode: 'standard', diff: 1, reduced: null, quality: 'auto' }, readSettings());
  const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { } };
  if (['light', 'standard', 'pro'].includes(params.get('mode'))) settings.mode = params.get('mode');
  if (params.get('diff') !== null && [0, 1, 2].includes(+params.get('diff'))) settings.diff = +params.get('diff');
  if (!['light', 'standard', 'pro'].includes(settings.mode)) settings.mode = 'standard';
  if (![0, 1, 2].includes(+settings.diff)) settings.diff = 1;
  const mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => params.get('reduced') === '1' ? true : params.get('reduced') === '0' ? false : (settings.reduced === null ? !!mqReduce.matches : !!settings.reduced);

  const TIERS = [
    { name: 'light', pr: 1, shadow: 0, crowd: 1200, level: 0, aa: false },
    { name: 'balanced', pr: 1.5, shadow: 1024, crowd: 3200, level: 1, aa: true },
    { name: 'high', pr: 2, shadow: 2048, crowd: 6000, level: 2, aa: true }
  ];
  function pickTier() {
    const q = params.get('q') !== null ? params.get('q') : settings.quality;
    if (q !== null && q !== 'auto' && TIERS[+q]) return +q;
    const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 4;
    if (touchDevice) return (mem <= 4 || cores <= 4) ? 0 : 1;
    return cores <= 2 ? 1 : 2;
  }
  let tierIdx = pickTier(), tier = TIERS[tierIdx], autoQuality = (params.get('q') === null && settings.quality === 'auto');
  let resScale = 1;

  /* ------------------------------------------------------------------ state */
  const demoQs = params.get('demo') === 'long'
    ? [{ text: 'في حديث طويل عن أهمية التعاون بين أفراد الفريق الواحد داخل الملعب وخارجه، وكيف أن التمرير الدقيق في الوقت المناسب يصنع الفارق بين الفوز والخسارة، ما العبارة التي تلخّص أفضل ما يمكن أن يتعلّمه اللاعب من هذه التجربة الجماعية الممتدة عبر الموسم كاملًا؟', options: ['العمل الجماعي يتفوّق على المهارة الفردية المنعزلة عندما يتحدّث الجميع بلغة واحدة ويثقون ببعضهم بعضًا تمامًا', 'التسديد من مسافة بعيدة دائمًا أفضل من التمرير للزميل', 'الاحتفاظ بالكرة أطول وقت ممكن هو الهدف الوحيد', 'لا فرق بين اللعب الفردي واللعب الجماعي'], correct: 0 }]
    : [{ text: 'كم لاعبًا يبدأ المباراة في كل فريق لكرة القدم؟', options: ['11 لاعبًا', '9 لاعبين', '7 لاعبين', '12 لاعبًا'], correct: 0 }, { text: 'ما ناتج 8 × 7؟', options: ['54', '56', '64', '48'], correct: 1 }, { text: 'ما عاصمة دولة قطر؟', options: ['الوكرة', 'الخور', 'الدوحة', 'دخان'], correct: 2 }];
  const S = {
    phase: 'loading', round: 0, total: params.get('demo') === 'long' ? 1 : 3, goals: 0, results: [], correct: false, pending: false, feedback: '', result: '', variant: '',
    token: '', configReady: !embedded, assetsReady: false, live: false, replaying: false, lite: false, introDone: false, elapsed: 0, aim: { x: 0, y: 0.5, power: 0.7 }, aimTouched: false, stateT: 0, outcomeT: 0, passOptions: []
  };
  let renderer, scene, camera, stadium, crowd, ballView, fx, match, director, replay, audio;
  const audioInst = new FB.Audio({ base: '../football/assets', onState: st => syncSound(st) });
  audio = audioInst;
  let rafId = 0, prev = 0, acc = 0, manualMode = params.get('manual') === '1' || window.__FOOTBALL_MANUAL === true, timers = [], contextLost = false, disposed = false;
  const actors = [];
  const ctx = { ball: new V(), ballV: new V(), focus: new V(), shooterBall: null, shooter: null, reactTo: null, slow: 0, replaySide: 1 };

  const later = (sec, fn) => { timers.push({ t: sec, fn }); };
  const runTimers = dt => { for (let i = timers.length - 1; i >= 0; i--) { const k = timers[i]; k.t -= dt; if (k.t <= 0) { timers.splice(i, 1); try { k.fn(); } catch (e) { console.error(e); } } } };

  function post(type, extra = {}) { if (embedded) parent.postMessage({ type, index: S.round, token: S.token, ...extra }, location.origin); }
  function setPhase(p) { S.phase = p; S.stateT = 0; document.body.dataset.phase = p; }

  /* ------------------------------------------------------------------ HUD helpers */
  const AR = n => String(n);
  function updateHud() {
    $('score').textContent = S.goals; $('round').textContent = Math.min(S.round + 1, S.total) + ' / ' + S.total;
    const p = $('pips'); p.replaceChildren(...Array.from({ length: Math.min(S.total, 12) }, (_, i) => { const e = document.createElement('i'); const r = S.results[i]; e.className = r === 'goal' ? 'goal' : r === 'miss' ? 'miss' : r === 'pending' ? 'pending' : (i === S.round ? 'now' : ''); return e; }));
  }
  function instruction(t) { $('instruction').textContent = t; }
  function ticker(text, ms = 2400) { const t = $('ticker'); t.textContent = text; t.hidden = false; clearTimeout(ticker.h); ticker.h = setTimeout(() => { t.hidden = true; }, ms); }
  function syncSound(st) {
    const b = $('sound'), on = !audioInst.muted; b.setAttribute('aria-pressed', String(on));
    b.querySelector('span').textContent = st === 'unsupported' ? 'الصوت غير متاح' : st === 'failed' ? 'تعذر تشغيل الصوت' : on ? 'الصوت: مفعّل' : 'الصوت: مكتوم';
    b.classList.toggle('muted', !on); S.audioReady = !!(audioInst.ready && audioInst.buffers.cheer);
  }
  function setLoad(p, text) { $('loadBar').firstElementChild.style.width = Math.round(p * 100) + '%'; if (text) $('start').textContent = text; }

  /* ------------------------------------------------------------------ boot */
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  function fail(kind) {
    const msg = { webgl: 'تعذر تشغيل الرسوم ثلاثية الأبعاد على هذا الجهاز. حدّث المتصفح وتأكد من تفعيل WebGL، أو تابع بنسخة نصية مبسّطة.', assets: 'تعذر تحميل ملفات الملعب. تحقق من اتصالك ثم أعد المحاولة.', lost: 'توقف عرض الرسوم على الجهاز. اضغط إعادة المحاولة لاستكمال اللعب.' }[kind] || 'حدث خطأ غير متوقع.';
    $('loadingError').hidden = false; $('loadingError').querySelector('p').textContent = msg; $('welcome').hidden = true; $('errLite').hidden = !(kind === 'webgl' || kind === 'assets');
    cancelAnimationFrame(rafId);
  }
  function applySize() {
    if (!renderer) return; const w = Math.max(2, stage.clientWidth), h = Math.max(2, stage.clientHeight), pr = clamp(Math.min(window.devicePixelRatio || 1, tier.pr) * resScale, 0.5, 2);
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false); director.setAspect(w / h);
  }
  async function boot() {
    try {
      if (!FB.hasWebGL()) throw new Error('webgl');
      renderer = new T.WebGLRenderer({ canvas, antialias: tier.aa, powerPreference: 'high-performance', stencil: false });
    } catch (e) { fail('webgl'); return; }
    try {
      renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = !!tier.shadow; renderer.shadowMap.type = T.PCFSoftShadowMap;
      scene = new T.Scene(); camera = new T.PerspectiveCamera(48, 16 / 9, 0.1, 1500); director = new FB.CameraDirector(camera, { reduced: reduced() }); director.cut('orbit', true);
      setLoad(0.05, 'جارٍ تجهيز الملعب…'); await nextFrame();
      const base = '../football/assets/characters', builds = ['athlete', 'runner', 'keeper'], assets = {}, tex = {};
      const eye = FB.Char.loadTexture(base + '/textures/eye_brown.png');
      await Promise.all(builds.map(async n => { assets[n] = await FB.Char.load(base, n); tex[n] = { skinClean: await FB.Char.loadTexture(`${base}/textures/skin_${n}_clean.jpg`), skinStubble: await FB.Char.loadTexture(`${base}/textures/skin_${n}_stubble.jpg`), eye: await eye }; setLoad(0.2 + 0.1 * builds.indexOf(n)); }));
      setLoad(0.45, 'جارٍ بناء المدرجات…'); await nextFrame();
      stadium = FB.Stadium.build(scene, { level: tier.level, shadow: tier.shadow }); setLoad(0.62); await nextFrame();
      crowd = FB.Crowd.build(scene, stadium, { count: tier.crowd, reduced: reduced() }); crowd.setReduced(reduced()); setLoad(0.75, 'جارٍ إدخال اللاعبين…'); await nextFrame();
      ballView = FB.BallView.create(scene); fx = FB.Fx.create(scene, { reduced: reduced() });
      const seed = params.get('seed') ? (+params.get('seed') || 1) : (Math.floor(Math.random() * 1e9) + 1);
      const makeActor = spec => {
        const a = FB.Char.create(assets[spec.build], { kit: spec.kit, tone: spec.tone, stubble: spec.stubble, hair: { style: spec.hair, color: FB.Char.HAIR_COLORS[spec.seed % FB.Char.HAIR_COLORS.length] }, number: spec.team === 'ref' ? null : spec.number, keeper: !!spec.keeper, textures: tex[spec.build], seed: spec.seed, name: spec.id });
        scene.add(a.root); actors.push(a); return a;
      };
      match = new FB.Match({ makeActor, seed, difficulty: +settings.diff, mode: settings.mode, net: stadium.net, onEvent });
      replay = new FB.Replay(match.players, match.ball, stadium.net, 8);
      match.begin(0, settings.mode, +settings.diff); for (let i = 0; i < 30; i++) match.update(STEP);
      applySize(); setLoad(0.9, 'جارٍ تجهيز الإضاءة…'); await nextFrame();
      try { renderer.compile(scene, camera); } catch (e) { }
      renderFrame(); setLoad(1);
      S.assetsReady = true; ready();
    } catch (e) { console.error(e); fail('assets'); return; }
    if (!manualMode) rafId = requestAnimationFrame(loop);
  }
  function ready() {
    if (!(S.assetsReady || S.lite) || !S.configReady) return; if (S.phase !== 'loading') return;
    $('start').disabled = false; $('start').textContent = S.lite ? 'ابدأ ←' : 'ادخل الملعب ←'; $('loadBar').hidden = true; setPhase('welcome'); updateHud();
    if (!embedded && !touchDevice) $('start').focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ round flow */
  function showControls(on) { $('controls').hidden = !on; }
  function resetUi() {
    $('feedback').hidden = true; $('question').hidden = true; $('shoot').hidden = true; $('next').hidden = true; $('next').disabled = false; $('reopen').hidden = true; $('replayBtn').hidden = true; $('aimBlock').hidden = true; $('passButtons').hidden = true; $('passButtons').replaceChildren(); $('markers').replaceChildren(); $('reticle').hidden = true; $('skip').hidden = true; $('ticker').hidden = true;
    document.body.classList.remove('replaying'); canvas.style.touchAction = 'auto';
  }
  async function enter() {
    if (S.phase !== 'welcome') return; $('welcome').hidden = true; $('settings').hidden = true; $('settingsBtn').setAttribute('aria-expanded', 'false'); S.live = true;
    audioInst.init().then(() => syncSound('ready')); syncSound('ready');
    if (S.lite) { startRound(); return; }
    if (!S.introDone && !reduced()) {
      S.introDone = true; setPhase('intro'); showControls(false); resetUi(); $('skip').hidden = false; $('skip').textContent = 'تخطّي المقدمة ‹'; instruction('أهلًا بك في ملعب أبو عبيدة…');
      director.cut('establish', true, 4.2, () => { $('skip').hidden = true; startRound(); });
    } else { S.introDone = true; startRound(); }
  }
  function startRound() {
    timers = []; if (replay) { replay.stop(); replay.clear(); } resetUi(); S.correct = false; S.pending = false; S.feedback = ''; S.result = ''; S.variant = ''; S.aimTouched = false; S.aim.x = 0; S.aim.y = 0.5; S.aim.power = 0.7; S.passOptions = [];
    showControls(true); updateHud(); highlightAim();
    if (S.lite) { setPhase('ready'); instruction('اضغط «سدّد» لتبدأ التسديدة'); $('shoot').hidden = false; $('shoot').disabled = false; return; }
    director.cut('attack', true); crowd.setExcitement(0.18); audioInst.setExcitement(0.18); setPhase('build'); instruction(settings.mode === 'light' ? 'الهجمة تتقدّم… التمريرة ستكون تلقائية' : 'الهجمة تتقدّم… استعد للتمرير');
    match.begin(S.round, settings.mode, +settings.diff); stage.classList.toggle('light-mode', settings.mode === 'light');
  }

  /* pass UI */
  const ROLE_AR = { S: 'المهاجم', W1: 'الجناح الأيسر', W2: 'الجناح الأيمن', M: 'لاعب الوسط', C: 'لاعب الارتكاز' };
  function showPass(opts) {
    S.passOptions = opts; $('markers').replaceChildren(); const box = $('passButtons'); box.replaceChildren();
    opts.slice().sort((a, b) => b.x - a.x).forEach(o => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.pass = o.id; b.innerHTML = `<b>${o.number}</b><span>${ROLE_AR[o.id] || ''}</span>`; b.setAttribute('aria-label', 'مرّر إلى ' + (ROLE_AR[o.id] || 'زميل') + ' رقم ' + o.number); b.onclick = () => doPass(o.id); box.appendChild(b);
      const m = document.createElement('button'); m.type = 'button'; m.className = 'pass-marker'; m.dataset.pass = o.id; m.tabIndex = -1; m.setAttribute('aria-hidden', 'true'); m.innerHTML = `<b>${o.number}</b>`; m.onclick = () => doPass(o.id); $('markers').appendChild(m);
    });
    if (settings.mode === 'light') { box.hidden = true; $('markers').replaceChildren(); instruction('تمريرة تلقائية…'); } else { box.hidden = false; instruction(match.passN === 0 ? 'اختر زميلًا لتمرّر إليه الكرة' : 'تمريرة ثانية: اختر الزميل التالي'); }
  }
  function doPass(id) { if (S.phase !== 'build') return; audioInst.init(); if (match.pass(id)) { hidePass(); } }
  function hidePass() { $('passButtons').hidden = true; $('markers').replaceChildren(); instruction('تمريرة…'); }

  /* aim UI */
  const AIMX = { left: -0.68, center: 0, right: 0.68 }, AIMY = { low: 0.16, mid: 0.5, high: 0.86 };
  function showAim() {
    setPhase('ready'); const light = settings.mode === 'light'; $('aimBlock').hidden = false; $('heightGroup').hidden = light; $('powerBox').hidden = light; $('shoot').hidden = false; $('shoot').disabled = false;
    $('reticle').hidden = light; $('power').value = Math.round(S.aim.power * 100); $('powerOut').textContent = Math.round(S.aim.power * 100) + '%'; canvas.style.touchAction = light ? 'auto' : 'none'; highlightAim();
    instruction(light ? 'اختر الزاوية، ثم سدّد' : (touchDevice ? 'اسحب لتحدّد الهدف، واضبط القوة، ثم سدّد' : 'حرّك المؤشر نحو الهدف أو اختر زاوية، واضبط القوة، ثم سدّد'));
  }
  function highlightAim() {
    const near = (obj, v) => Object.entries(obj).reduce((b, [k, x]) => Math.abs(x - v) < Math.abs(obj[b] - v) ? k : b, Object.keys(obj)[0]);
    const kx = S.aimTouched ? null : near(AIMX, S.aim.x), ky = S.aimTouched ? null : near(AIMY, S.aim.y);
    document.querySelectorAll('[data-aim]').forEach(b => b.classList.toggle('selected', b.dataset.aim === kx || (S.aimTouched && Math.abs(AIMX[b.dataset.aim] - S.aim.x) < 0.12)));
    document.querySelectorAll('[data-height]').forEach(b => b.classList.toggle('selected', b.dataset.height === ky || (S.aimTouched && Math.abs(AIMY[b.dataset.height] - S.aim.y) < 0.12)));
  }
  const ray = new T.Raycaster(), ndc = new T.Vector2(), pt = new V();
  function aimFromPointer(e) {
    const r = canvas.getBoundingClientRect(), lift = e.pointerType === 'touch' ? 58 : 0;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - lift - r.top) / r.height) * 2 - 1)); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction; if (Math.abs(d.z) < 1e-4) return; const t = (GZ - o.z) / d.z; if (t <= 0) return; pt.copy(o).addScaledVector(d, t);
    S.aim.x = clamp(pt.x / (HW - 0.4), -1, 1); S.aim.y = clamp((pt.y - 0.28) / (GH - 0.62), 0, 1); S.aimTouched = true; highlightAim();
  }
  function shoot() {
    if (S.phase !== 'ready') return; audioInst.init();
    if (S.lite) { setPhase('runup'); $('shoot').hidden = true; instruction('اقتراب… ارتكاز… تسديدة قوية!'); later(0.9, () => { setPhase('flight'); later(0.5, () => { S.flight = 0.5; ask(); }); }); return; }
    const a = settings.mode === 'light' ? { x: S.aim.x, y: 0.5, power: 0.7 } : S.aim;
    if (!match.shoot({ x: a.x, y: a.y, power: a.power })) return;
    setPhase('runup'); $('shoot').hidden = true; $('aimBlock').hidden = true; $('reticle').hidden = true; canvas.style.touchAction = 'auto'; instruction('اقتراب… ارتكاز… تسديدة قوية!');
  }

  /* question / resolve / outcome */
  function ask() {
    setPhase('question'); S.flight = 0.5; audioInst.duck(true); instruction('الكرة معلّقة في منتصف الطريق… أجب لتكمل'); showControls(true); $('shoot').hidden = true; $('aimBlock').hidden = true; $('reticle').hidden = true;
    if (embedded) { $('reopen').hidden = false; post('school-football-question'); return; }
    const q = demoQs[S.round % demoQs.length]; $('questionText').textContent = q.text;
    $('choices').replaceChildren(...q.options.map((label, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => resolve({ correct: i === q.correct, pending: false, feedback: i === q.correct ? 'إجابة صحيحة. أحسنت!' : 'الإجابة الصحيحة: ' + q.options[q.correct] }); return b; }));
    $('question').hidden = false; const f = $('choices').querySelector('button'); if (f) f.focus({ preventScroll: true });
  }
  function resolve(res) {
    if (S.phase !== 'question') return;
    S.correct = res.correct === true; S.pending = res.pending === true; S.feedback = String(res.feedback || '');
    S.result = S.pending ? 'pending' : S.correct ? 'goal' : (S.round % 2 === 0 ? 'save' : 'wide');
    $('question').hidden = true; $('reopen').hidden = true; audioInst.duck(false); instruction(S.pending ? 'تم إرسال الإجابة للمراجعة' : 'شاهد مصير التسديدة…');
    setPhase('resolve');
    if (S.lite) { later(1.0, () => outcomeShown(S.result)); return; }
    if (!match.resolve({ outcome: S.result })) { later(0.3, () => outcomeShown(S.result)); return; }
    S.variant = match.plan && match.plan.variant || '';
  }
  function momentCopy() {
    if (S.pending) return ['في انتظار المعلم', 'وصلت إجابتك'];
    if (S.correct) return ['الشباك تهتز… والمدرجات تحتفل!', 'جــــــــول!'];
    if (S.result === 'save') return ['الفرصة القادمة لك', S.variant === 'catch' ? 'الحارس يحتضن الكرة!' : 'تصدٍّ رائع!'];
    return ['الفرصة القادمة لك', S.variant === 'post' ? 'ارتدت من القائم!' : S.variant === 'over' ? 'فوق العارضة!' : 'خارج المرمى!'];
  }
  function outcomeShown(outcome) {
    if (S.phase === 'outcome') return; setPhase('outcome'); S.flight = 1; S.results[S.round] = S.pending ? 'pending' : S.correct ? 'goal' : 'miss'; if (S.correct) S.goals++; updateHud();
    const [label, title] = momentCopy(); $('feedback').classList.toggle('miss', !S.correct && !S.pending); $('feedback').classList.toggle('neutral', S.pending);
    $('momentLabel').textContent = label; $('momentTitle').textContent = title; $('momentText').textContent = S.feedback; $('feedback').hidden = false;
    $('next').textContent = S.round + 1 === S.total ? 'عرض النتيجة ←' : 'التسديدة التالية ←'; $('next').hidden = false; $('next').disabled = false;
    instruction(S.pending ? 'ستُحتسب الدرجة بعد مراجعة المعلم.' : S.correct ? 'أحسنت! أكمل بنفس التركيز.' : 'لا بأس… استعد لفرصة جديدة.');
    if (!S.lite) {
      if (!S.correct && !S.pending) audioInst.groan();
      crowd.setExcitement(S.correct ? 0.9 : 0.2); audioInst.setExcitement(S.correct ? 0.8 : 0.18);
      ctx.reactTo = S.result === 'save' ? match.keeper : match.shooter; if (S.pending) director.cut('follow', false); else director.cut('react', true);
      if (S.correct) { $('replayBtn').hidden = false; if (!reduced()) later(2.6, () => { if (S.phase === 'outcome' && !S.replaying) startReplay(); }); }
    } else if (S.correct) { audioInst.cheer(); }
    post('school-football-outcome', { outcome: S.result });
    later(0.05, () => { if (S.phase === 'outcome' && !S.replaying) $('next').focus({ preventScroll: true }); });
  }
  function next() {
    if (S.phase !== 'outcome') return; stopReplay();
    if (embedded) { $('next').disabled = true; post('school-football-next'); return; }
    if (S.round + 1 < S.total) { S.round++; startRound(); } else finishStandalone();
  }
  function finishStandalone() {
    setPhase('finished'); $('ticker').hidden = true; $('feedback').hidden = false; $('feedback').classList.remove('miss', 'neutral'); $('momentTitle').textContent = 'نهاية التحدّي'; $('momentLabel').textContent = 'صافرة النهاية'; $('momentText').textContent = `سجّلت ${S.goals} من ${S.total} أهداف. جرّب مرة أخرى وحسّن نتيجتك.`;
    $('next').textContent = 'العب مرة أخرى ←'; $('next').hidden = false; $('replayBtn').hidden = true; if (!S.lite) { audioInst.whistle('end'); director.cut('react', false); }
    $('next').onclick = () => { S.round = 0; S.goals = 0; S.results = []; $('next').onclick = next; startRound(); };
  }

  /* replay */
  function startReplay() {
    if (S.phase !== 'outcome' || S.replaying || S.lite) return; if (!replay.start(0.7, 0.7)) return; S.replaying = true; document.body.classList.add('replaying'); $('feedback').hidden = true; $('skip').hidden = false; $('skip').textContent = 'تخطّي الإعادة ‹'; ticker('إعادة اللقطة', 60000);
    S.replayStage = 0; ctx.replaySide = match.ball.p.x >= 0 ? -1 : 1; director.cut('replayA', true);
  }
  function stopReplay() {
    if (!S.replaying) return; replay.stop(); S.replaying = false; document.body.classList.remove('replaying'); $('skip').hidden = true; $('ticker').hidden = true; $('feedback').hidden = false;
    ctx.reactTo = match.shooter; director.cut('react', true); ballView.set(match.ball.p, match.ball.q); stadium.net.reset();
  }

  /* ------------------------------------------------------------------ match events */
    function onEvent(e) {
    if (!S.live || S.phase === 'intro') return;
    if (S.assetsReady && !S.replaying) { try { audioInst.onEvent(e); } catch (er) { } }
    const b = match.ball;
    switch (e.type) {
      case 'state': onState(e.state); break;
      case 'passReady': if (S.phase === 'build') showPass(e.options); break;
      case 'passStart': ticker('تمريرة!', 1200); break;
      case 'aimReady': if (S.phase === 'build') showAim(); break;
      case 'kick': if (e.kind === 'shot') { replay.mark(); director.kick(0.035); fx.puff(b.p.x, b.p.z, 1); crowd.pulse(0.5, 2); audioInst.setExcitement(0.5); } else fx.puff(b.p.x, b.p.z, 0.5); break;
      case 'freeze': ask(); break;
      case 'goalLine': if (S.result === 'goal') { audioInst.cheer(); crowd.pulse(1, 6); audioInst.setExcitement(1); director.kick(0.05); fx.confetti(b.p.x * 0.3, GZ + 8); ticker('هدف!', 1800); } break;
      case 'ballHit': if (e.kind === 'net') replay.noteImpact({ x: e.x, y: e.y, z: e.z, vx: b.v.x, vy: b.v.y, vz: b.v.z }); if (e.kind === 'post' || e.kind === 'bar') { crowd.pulse(0.5, 1.5); director.kick(0.03); } if (e.kind === 'bounce' && e.strength > 6) fx.puff(e.x, e.z, 0.6); break;
      case 'glove': case 'parry': case 'catch': crowd.pulse(0.55, 1.6); break;
      case 'dive': fx.puff(match.keeper.pos.x, match.keeper.pos.z, 0.9); break;
      case 'outcomeReady': outcomeShown(e.outcome); break;
    }
  }
  function onState(st) {
    if (S.phase !== 'intro') {
      if ((st === 'build' || st === 'pass' || st === 'prep') && S.phase !== 'build') setPhase('build');
      else if (st === 'flight') setPhase('flight');
      // aim -> showAim() sets 'ready'; frozen -> ask() sets 'question'; resolve -> resolve() sets 'resolve'; outcome -> outcomeShown()
    }
    switch (st) {
      case 'build': director.cut('attack', false); break;
      case 'aim': director.cut('aim', false); break;
      case 'runup': case 'strike': director.cut('runup', false); break;
      case 'flight': director.cut('flight', false); break;
      case 'frozen': director.hold(); break;
      case 'resolve': {
        const v = match.plan && match.plan.variant, o = match.outcome;
        if (o === 'goal') director.cut('behindGoal', true); else if (o === 'save' || v === 'post' || v === 'over') director.cut('goalside', true); else director.cut('follow', false);
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ frame */
  function simActive() { return S.assetsReady && !S.replaying && !contextLost && (S.live ? S.phase !== 'finished' : (S.phase === 'welcome' || S.phase === 'intro')); }
  function advance(dt) {
    S.elapsed += dt; S.stateT += dt; runTimers(dt); if (!S.assetsReady) return;
    if (S.replaying) {
      const alive = replay.update(dt); const v = replay.ballView; if (v) { ctx.ball.set(v.x, v.y, v.z); ctx.ballV.set(0, 0, -1); ballView.set(ctx.ball, v.q); }
      if (S.replayStage === 0 && replay.clock / Math.max(1, replay.end) > 0.8) { S.replayStage = 1; director.cut('replayB', true); }
      if (!alive) stopReplay();
    } else if (simActive()) {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 5) { const sd = match.state === 'frozen' ? 0 : STEP * match.timeScale; match.update(STEP); if (S.live) replay.record(sd); acc -= STEP; n++; }
      if (n >= 5) acc = 0;
      const b = match.ball; ballView.set(b.p, b.q); ctx.ball.copy(b.p); ctx.ballV.copy(b.v);
    }
    ctx.shooter = match.shooter ? match.shooter : match.owner; ctx.others = match.players.map(q => q.pos); ctx.shooterBall = match.ball.p; ctx.focus.copy(match.owner && match.state === 'build' ? match.ball.p : match.ball.p); ctx.slow = clamp(1 - match.timeScale, 0, 1);
    if (S.phase === 'welcome') { if (director.shot !== 'orbit') director.cut('orbit', true); }
    director.update(dt, ctx); stadium.update(dt, S.elapsed); crowd.update(dt, S.elapsed); fx.update(dt);
    if (tier.shadow && renderer.shadowMap.enabled) stadium.focus(match.ball.p.x, match.ball.p.z);
    audioInst.focusZ = match.ball.p.z;
    updateOverlays();
  }
  const _p = new V();
  function project(x, y, z, out) { _p.set(x, y, z).project(camera); out.x = (_p.x * 0.5 + 0.5) * stage.clientWidth; out.y = (-_p.y * 0.5 + 0.5) * stage.clientHeight; out.ok = _p.z < 1 && _p.z > -1; return out; }
  const _o = { x: 0, y: 0, ok: false };
  function updateOverlays() {
    if (S.phase === 'build' && !$('markers').hidden) for (const m of $('markers').children) { const p = match.P[m.dataset.pass]; if (!p) continue; project(p.pos.x, 2.25, p.pos.z, _o); m.style.transform = `translate(${_o.x.toFixed(1)}px,${_o.y.toFixed(1)}px) translate(-50%,-50%)`; m.style.visibility = _o.ok && _o.x > 8 && _o.x < stage.clientWidth - 8 && _o.y > 60 ? 'visible' : 'hidden'; }
    if (!$('reticle').hidden) { const tx = S.aim.x * (HW - 0.4), ty = 0.28 + S.aim.y * (GH - 0.62); project(tx, ty, GZ, _o); $('reticle').style.transform = `translate(${_o.x.toFixed(1)}px,${_o.y.toFixed(1)}px) translate(-50%,-50%) scale(${(0.8 + 0.5 * S.aim.power).toFixed(2)})`; }
    lodFrame++; updateLod();
  }
  let lodFrame = 0;
  function updateLod() {
    if (lodFrame % 8) return; const cp = camera.position;
    for (const p of match.players) { const d = Math.hypot(p.pos.x - cp.x, p.pos.z - cp.z), want = tier.level === 0 ? (d > 12 ? 1 : 0) : (d > 42 ? 1 : 0); if (p.actor._lod !== want) { p.actor._lod = want; p.actor.setLOD(want); } }
  }
  function renderFrame() { if (!renderer || contextLost) return; renderer.render(scene, camera); }

  /* adaptive resolution / quality: frame-time based, reversible, never changes gameplay */
  let ema = 1 / 60, perfN = 0, goodT = 0, fpsShow = 60;
  function perf(raw) {
    if (!raw) return; ema = ema * 0.94 + raw * 0.06; fpsShow = 1 / ema; perfN++; if (perfN % 45 || !autoQuality || manualMode) return;
    const limit = touchDevice ? 0.034 : 0.022;
    if (ema > limit) { goodT = 0; if (resScale > 0.58) { resScale = Math.max(0.58, resScale - 0.1); applySize(); } else if (renderer.shadowMap.enabled) { disableShadows(); } else if (tierIdx > 0) { /* last resort: simplify characters */ tier = Object.assign({}, tier, { level: 0 }); tierIdx = 0; } }
    else if (ema < limit * 0.62) { goodT += 45 / 60; if (goodT > 6 && resScale < 1) { resScale = Math.min(1, resScale + 0.05); applySize(); goodT = 0; } }
  }
  function disableShadows() { renderer.shadowMap.enabled = false; if (stadium.key) stadium.key.castShadow = false; scene.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; }); }
  function loop(now) {
    if (disposed) return; const raw = (document.hidden || contextLost) ? 0 : Math.min((now - (prev || now)) / 1000, 0.1); prev = now;
    if (!manualMode) { advance(raw); renderFrame(); perf(raw); if (!$('debug').hidden) debugText(); }
    rafId = requestAnimationFrame(loop);
  }
  function debugText() { $('debug').textContent = `tier ${tier.name} · scale ${resScale.toFixed(2)} · ${fpsShow.toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris\nphase ${S.phase} · state ${match.state} · shot ${director.shot} · ts ${match.timeScale.toFixed(2)}`; }

  /* ------------------------------------------------------------------ lite (no-WebGL) path */
  function enterLite() {
    S.lite = true; S.assetsReady = false; document.body.classList.add('lite'); $('loadingError').hidden = true; $('welcome').hidden = false; $('loadBar').hidden = true; $('start').disabled = true;
    if (S.phase !== 'loading') setPhase('loading'); ready(); rafId = requestAnimationFrame(liteLoop);
  }
  let litePrev = 0; function liteLoop(now) { const dt = Math.min((now - (litePrev || now)) / 1000, 0.1); litePrev = now; if (!manualMode) { S.elapsed += dt; runTimers(dt); } rafId = requestAnimationFrame(liteLoop); }

  /* ------------------------------------------------------------------ protocol */
  window.addEventListener('message', e => {
    if (!embedded || e.origin !== location.origin || e.source !== parent) return; const m = e.data; if (!m || typeof m !== 'object') return;
    if (m.type === 'school-football-config' && !S.configReady) { S.total = Math.max(1, Math.min(100, Number(m.count) || 1)); S.token = String(m.token || ''); S.configReady = true; $('modeLabel').textContent = String(m.title || 'مهمة المعلم'); updateHud(); ready(); }
    else if (m.token === S.token && m.index === S.round) {
      if (m.type === 'school-football-result') resolve(m);
      if (m.type === 'school-football-retry' && S.phase === 'outcome') $('next').disabled = false;
      if (m.type === 'school-football-advance' && S.phase === 'outcome') { S.round++; $('next').disabled = false; startRound(); }
    }
  });

  /* ------------------------------------------------------------------ wiring */
  function bind() {
    $('start').onclick = enter; $('shoot').onclick = shoot; $('next').onclick = next; $('replayBtn').onclick = () => { if (S.phase === 'outcome') { if (S.replaying) stopReplay(); startReplay(); } };
    $('sound').onclick = () => { audioInst.toggle(); audioInst.init(); syncSound(); };
    $('reopen').onclick = () => { if (S.phase === 'question') post('school-football-question'); };
    $('skip').onclick = () => { if (S.phase === 'intro') director.skip(); else if (S.replaying) stopReplay(); };
    $('errLite').onclick = enterLite;
    document.querySelectorAll('[data-aim]').forEach(b => b.onclick = () => { if (S.phase !== 'ready') return; S.aim.x = AIMX[b.dataset.aim]; S.aimTouched = false; highlightAim(); });
    document.querySelectorAll('[data-height]').forEach(b => b.onclick = () => { if (S.phase !== 'ready') return; S.aim.y = AIMY[b.dataset.height]; S.aimTouched = false; highlightAim(); });
    $('power').oninput = e => { S.aim.power = clamp(+e.target.value / 100, 0.2, 1); $('powerOut').textContent = Math.round(S.aim.power * 100) + '%'; };
    $('fullscreen').onclick = async () => { try { if (embedded) { post('school-football-fullscreen'); return; } if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); } catch (e) { instruction('يمكنك تدوير الهاتف أفقيًا لمشهد أوسع.'); } };
    // settings
    const open = on => { $('settings').hidden = !on; $('settingsBtn').setAttribute('aria-expanded', String(on)); if (on) $('settingsClose').focus({ preventScroll: true }); };
    $('settingsBtn').onclick = () => open($('settings').hidden); $('settingsClose').onclick = () => { open(false); $('settingsBtn').focus({ preventScroll: true }); };
    const mark = () => { document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode))); document.querySelectorAll('[data-diff]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.diff === +settings.diff))); $('optReduced').checked = reduced(); $('optQuality').value = String(settings.quality); };
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { settings.mode = b.dataset.mode; saveSettings(); mark(); });
    document.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { settings.diff = +b.dataset.diff; saveSettings(); mark(); });
    $('optReduced').onchange = e => { settings.reduced = e.target.checked; saveSettings(); director && director.setReduced(reduced()); crowd && crowd.setReduced(reduced()); fx && fx.setReduced(reduced()); };
    $('optQuality').onchange = e => { settings.quality = e.target.value; saveSettings(); autoQuality = settings.quality === 'auto' && params.get('q') === null; if (!autoQuality && TIERS[+settings.quality]) { tierIdx = +settings.quality; tier = TIERS[tierIdx]; if (renderer) { renderer.shadowMap.enabled = !!tier.shadow && !!stadium.key.shadow.map; applySize(); } } };
    mark(); syncSound();
    // pointer aiming on the pitch
    let dragging = false;
    canvas.addEventListener('pointerdown', e => { if (S.phase !== 'ready' || settings.mode === 'light') return; dragging = true; try { canvas.setPointerCapture(e.pointerId); } catch (x) { } aimFromPointer(e); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if (dragging) aimFromPointer(e); });
    const up = e => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (x) { } }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    document.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (e.key === 'Escape') { if (!$('settings').hidden) { open(false); return; } if (S.phase === 'intro' || S.replaying) { $('skip').click(); return; } }
      if ((e.code === 'Space' || e.code === 'Enter') && e.target === document.body) { if (S.phase === 'ready') { e.preventDefault(); shoot(); } else if (S.phase === 'intro' || S.replaying) { e.preventDefault(); $('skip').click(); } }
      if (S.phase === 'ready' && settings.mode !== 'light' && tag !== 'INPUT' && tag !== 'SELECT') {
        const st = 0.08; let used = true;
        if (e.key === 'ArrowLeft') S.aim.x = clamp(S.aim.x - st, -1, 1); else if (e.key === 'ArrowRight') S.aim.x = clamp(S.aim.x + st, -1, 1); else if (e.key === 'ArrowUp') S.aim.y = clamp(S.aim.y + st, 0, 1); else if (e.key === 'ArrowDown') S.aim.y = clamp(S.aim.y - st, 0, 1);
        else if (e.key === '+' || e.key === '=') S.aim.power = clamp(S.aim.power + 0.05, 0.2, 1); else if (e.key === '-') S.aim.power = clamp(S.aim.power - 0.05, 0.2, 1); else used = false;
        if (used) { e.preventDefault(); S.aimTouched = true; $('power').value = Math.round(S.aim.power * 100); $('powerOut').textContent = Math.round(S.aim.power * 100) + '%'; highlightAim(); }
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) audioInst.suspend(); else audioInst.resume(); prev = 0; litePrev = 0; });
    window.addEventListener('pagehide', dispose);
    if (window.ResizeObserver) new ResizeObserver(() => applySize()).observe(stage); else window.addEventListener('resize', applySize);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; audioInst.suspend(); $('loadingError').hidden = false; $('loadingError').querySelector('p').textContent = 'توقف عرض الرسوم على الجهاز مؤقتًا… جارٍ المحاولة لاستعادته.'; $('errLite').hidden = true; });
    canvas.addEventListener('webglcontextrestored', () => { contextLost = false; $('loadingError').hidden = true; audioInst.resume(); applySize(); renderFrame(); });
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', () => { if (settings.reduced === null) { director && director.setReduced(reduced()); crowd && crowd.setReduced(reduced()); fx && fx.setReduced(reduced()); $('optReduced').checked = reduced(); } });
    if (params.get('debug') === '1') $('debug').hidden = false;
  }
  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(rafId); try { audioInst.close(); } catch (e) { }
    try { crowd && crowd.dispose(); stadium && stadium.dispose(); ballView && ballView.dispose(); fx && fx.dispose(); for (const a of actors) a.dispose && a.dispose(); renderer && renderer.dispose(); } catch (e) { }
  }

  /* ------------------------------------------------------------------ public API (also used by the automated tests) */
  const api = {
    get phase() { return S.phase; },
    get flight() { return S.phase === 'question' ? 0.5 : S.phase === 'resolve' ? 0.5 + Math.min(0.5, S.stateT / 2) : S.phase === 'outcome' || S.phase === 'finished' ? 1 : S.phase === 'flight' ? Math.min(0.5, match ? match.progress() : 0) : 0; },
    get goals() { return S.goals; }, get outcome() { return S.result; }, get variant() { return S.variant; }, get audioReady() { return !!S.audioReady; }, get round() { return S.round; },
    get replaying() { return S.replaying; }, get mode() { return settings.mode; }, get tier() { return tier.name; }, get lite() { return S.lite; }, get state() { return match ? match.state : ''; },
    get match() { return match; }, get camera() { return director; }, get aim() { return S.aim; },
    snapshot() { return match ? { phase: S.phase, state: match.state, ball: match.ball.p.toArray(), keeper: [match.keeper.pos.x, match.keeper.pos.z], camera: { shot: director.shot, pos: camera.position.toArray() }, tier: tier.name, scale: resScale, fps: fpsShow } : { phase: S.phase }; },
    /** deterministic stepping (tests / screenshots): advance the simulation by `seconds` without waiting for real time, render once at the end */
    step(seconds, renderAtEnd = true) { const n = Math.max(1, Math.round(seconds / STEP)); for (let i = 0; i < n; i++) advance(STEP); if (renderAtEnd) renderFrame(); return S.phase; },
    manual(on = true) { manualMode = !!on; if (on) { cancelAnimationFrame(rafId); } else if (!disposed) { prev = 0; rafId = requestAnimationFrame(loop); } },
    render: renderFrame,
    /** renderer counters of the last frame (draw calls / triangles / resources) for QA */
    stats() { const i = renderer.info; return { tier: tier.name, scale: resScale, calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : 0 }; }
  };
  window.Football = window.SportGame = api;

  bind(); updateHud();
  if (params.get('lite') === '1') { enterLite(); } else { boot(); }
  if (embedded) post('school-football-ready');
})();
