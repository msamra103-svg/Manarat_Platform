/* عدّاء قطر — مغامرة التحدي · game flow.
 * Explicit finite-state machine for the run and the question checkpoints:
 *   menu → intro → RUN → APPROACH (brake, centre lane) → QUESTION → EVALUATE → SUCCESS (gate opens, run on)
 *                                                                       └→ RECOIL (light-wave pushes back) → RETRY → APPROACH … | GAMEOVER
 *   last gate → FINISH (finish arch, victory) → RESULTS
 * All timing runs inside the update loop (no stray timeouts), so no stale timers can fire into a later state.
 *
 * Platform contract (same as the platform's other sport games, key "qatar-runner"):
 *   game → host : school-qatar-runner-ready | -question | -outcome | -next | -fullscreen  {type, token, index}
 *   host → game : school-qatar-runner-config {token,count,title,images} | -result {token,index,correct,pending,feedback} | -advance | -retry
 * In platform mode the host shows and grades every question; the game never sees answer keys.
 */
(function (root) {
  'use strict';
  const T = root.THREE, doc = root.document, $ = id => doc.getElementById(id);
  const params = new URLSearchParams(root.location.search || '');
  const KEY = 'qatar-runner', PREFIX = 'school-' + KEY + '-';
  const embedded = root.parent !== root && params.get('school') !== '0';
  const QA = params.has('qa');
  const LANES = root.QRTrack.LANES;
  const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
  const JUMP_T = 0.68, JUMP_H = 1.28, GRAV = 8 * JUMP_H / (JUMP_T * JUMP_T), V0 = 4 * JUMP_H / JUMP_T, SLIDE_T = 0.82;
  const STOP_BEFORE = 4.9, DECEL = 6.2, RECOIL_D = 6.6, RECOIL_T = 1.3;

  let cfg = root.QRConfig.load();
  if (params.get('reset') === '1') cfg = root.QRConfig.reset();
  const studentBuild = !!root.__QR_EMBEDDED_CONFIG__ || params.get('student') === '1';

  // ------------------------------------------------------------------ state
  const S = {
    phase: 'boot', pt: 0, time: 0, paused: false,
    distance: 0, speed: 0, lane: 1, x: 0, xv: 0, y: 0, vy: 0, air: false, airT: 0, landT: -1, slideT: -1, slideQueued: false, jumpBuffer: 0,
    stumbleT: 0, invulT: 0, bumpT: -1, bumpFrom: 0, recoilT: -1, recoilV: 0,
    score: 0, coins: 0, combo: 0, coinChain: 0, hits: 0, hearts: 3,
    gates: [], gateIdx: 0, finishS: 0, total: 0, results: [], firstTry: 0, correctTotal: 0, wrongTotal: 0, pendingTotal: 0,
    q: null, qLocked: false, qTimer: 0, qTimerMax: 0, lastTick: 0, todTarget: 0, tod: 0,
    platform: { on: embedded, token: '', configured: !embedded, title: '', round: 0, images: [], awaiting: false, result: null, outcomeSent: false, nextSent: false },
    zone: 'corniche', started: false, finished: false, lastS: 0
  };
  root.__QR_STATE__ = S;

  // ------------------------------------------------------------------ renderer / world / boy
  const canvas = $('view');
  const quality = (() => { const q = params.get('quality') || cfg.quality; if (q !== 'auto') return q; const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)); return mobile ? 'medium' : 'high'; })();
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: QA }); }
  catch (e) { fatal('هذا المتصفح أو الجهاز لا يدعم الرسوميات ثلاثية الأبعاد (WebGL). جرّب متصفحًا حديثًا مثل Chrome أو Safari أو Edge.'); return; }
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = quality !== 'low'; renderer.shadowMap.type = quality === 'high' ? T.PCFSoftShadowMap : T.PCFShadowMap;
  const maxDPR = { high: 2, medium: 1.5, low: 1 }[quality] || 1.5; let dpr = Math.min(root.devicePixelRatio || 1, maxDPR);
  if (QA) dpr = 1;
  renderer.setPixelRatio(dpr);
  const camera = new T.PerspectiveCamera(58, 16 / 9, 0.15, 900);
  const world = new root.QRWorld.World(renderer, { quality });
  const track = new root.QRTrack.Track(world.scene, world.track, { difficulty: cfg.difficulty });
  const audio = new root.QRAudio({ music: cfg.music, sfx: cfg.sfx, muted: (() => { try { return localStorage.getItem('qatarRunner.muted') === '1'; } catch (e) { return false; } })() });
  let boy = null, anim = null;
  const gatesPool = [], gateObjs = new Map(); let finish = null;
  world.onCarPass = () => audio.carPass(-0.75);

  function resize() { const w = root.innerWidth, h = root.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 72 : 58; camera.updateProjectionMatrix(); }
  root.addEventListener('resize', resize); resize();

  // ------------------------------------------------------------------ lesson setup
  function lessonQuestions() { return S.platform.on ? new Array(S.total).fill(null) : cfg.questions; }
  function setupRun() {
    const n = S.platform.on ? S.total : cfg.questions.length; S.total = n;
    const gap = root.QRConfig.GAPS[cfg.gap] || 320, first = Math.max(230, gap * 0.78);
    S.gates = Array.from({ length: n }, (_, k) => ({ s: Math.round(first + k * gap), done: false, tries: 0, outcome: null }));
    S.finishS = S.gates.length ? S.gates[S.gates.length - 1].s + 120 : 300;
    world.setPlan(cfg.environment, S.gates.map(g => g.s));
    track.difficulty = cfg.difficulty;
    track.reset({ start: 70, seed: (Date.now() & 0xffff) + 7 });
    track.setBlocked([...S.gates.map(g => [g.s - 95, g.s + 32]), [S.finishS - 95, S.finishS + 1e6]]);
    Object.assign(S, { distance: 0, speed: 0, lane: 1, x: 0, xv: 0, y: 0, vy: 0, air: false, airT: 0, landT: -1, slideT: -1, slideQueued: false, stumbleT: 0, invulT: 0, bumpT: -1, recoilT: -1, score: 0, coins: 0, combo: 0, coinChain: 0, hits: 0, hearts: cfg.attempts, gateIdx: 0, results: [], firstTry: 0, correctTotal: 0, wrongTotal: 0, pendingTotal: 0, q: null, qLocked: false, todTarget: 0, tod: 0, finished: false });
    world.setTimeOfDay(0, true); world.clearTraffic();
    for (const [, g] of gateObjs) { world.track.remove(g.group); gatesPool.push(g); } gateObjs.clear();
    if (!finish) { finish = new root.QRGate.FinishArch(); } finish.group.position.set(0, 0, -S.finishS); world.track.add(finish.group);
    hud(); updateZone(true);
  }
  function speedRange() { return root.QRConfig.SPEEDS[cfg.speed] || [7.4, 10.8]; }
  function runSpeedAt(s) { const [a, b] = speedRange(); return lerp(a, b, clamp(s / 1800, 0, 1)); }
  function curGate() { return S.gates[S.gateIdx] || null; }

  // ------------------------------------------------------------------ phases
  function phase(p) { if (S.phase === p) return; S.phase = p; S.pt = 0; doc.body.dataset.phase = p; }
  function start() {
    if (S.phase !== 'menu') return; audio.init(); if (audio.ctx) audio.ctx.resume();
    setupRun(); hide('menu'); show('hud'); controlsVisibility(); audio.setMode('run'); phase('intro'); S.started = true;
    toast(cfg.lesson ? 'درس: ' + cfg.lesson : 'انطلق!', 1.6);
  }
  function restart(fromGate) {
    hideAll(); show('hud');
    if (fromGate && S.gates.length && !S.platform.on) { // retry from the current gate with full hearts
      const g = curGate(); S.hearts = cfg.attempts; S.distance = Math.max(0, (g ? g.s : 0) - 60); S.speed = 0; S.y = 0; S.air = false; S.slideT = -1; S.recoilT = -1; track.reset({ start: S.distance + 30, seed: Date.now() & 0xffff }); track.setBlocked([...S.gates.map(q => [q.s - 95, q.s + 32]), [S.finishS - 95, S.finishS + 1e6]]); if (g) { g.tries = 0; const o = gateObjs.get(S.gateIdx); if (o) o.reset(); }
      audio.setMode('run'); phase('run'); hud(); return;
    }
    setupRun(); audio.setMode('run'); phase('intro');
  }

  // ------------------------------------------------------------------ input
  function moveLane(d) { if (!canSteer()) return; const nl = clamp(S.lane + d, 0, 2); if (nl === S.lane) return; S.laneFrom = S.lane; S.lane = nl; audio.lane(d); }
  function canSteer() { return (S.phase === 'run' || S.phase === 'intro') && S.bumpT < 0; }
  function canAct() { return (S.phase === 'run' || S.phase === 'intro') && S.bumpT < 0 && S.recoilT < 0; }
  function jump() {
    if (!canAct()) return;
    if (S.air) { S.jumpBuffer = 0.16; return; }
    S.slideT = -1; S.air = true; S.fastFall = false; S.vy = V0; S.airT = 0; audio.jump(); audio.note('jump-start');
  }
  function slide() {
    if (!canAct()) return;
    if (S.air) { S.fastFall = true; S.vy = Math.min(S.vy, -9); S.slideQueued = true; return; }
    if (S.slideT >= 0) return; S.slideT = 0; audio.slide();
  }
  const keys = { ArrowLeft: () => moveLane(-1), KeyA: () => moveLane(-1), ArrowRight: () => moveLane(1), KeyD: () => moveLane(1), ArrowUp: jump, KeyW: jump, Space: jump, ArrowDown: slide, KeyS: slide };
  doc.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '')) return;
    if (S.phase === 'question' && !S.platform.on && /^(Digit|Numpad)[1-4]$/.test(e.code)) { answer(Number(e.code.slice(-1)) - 1); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
    if (e.code === 'KeyM') { toggleMute(); return; }
    if (e.code === 'Enter' && S.phase === 'menu') { start(); return; }
    const f = keys[e.code]; if (f && !S.paused) { e.preventDefault(); if (!e.repeat) f(); }
  });
  // swipes (touch / mouse drag on the 3D view)
  let sw = null;
  canvas.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY, t: performance.now(), fired: false }; });
  canvas.addEventListener('pointermove', e => { if (!sw || sw.fired) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; if (Math.max(Math.abs(dx), Math.abs(dy)) > 34) { sw.fired = true; swipe(dx, dy); } });
  canvas.addEventListener('pointerup', e => { if (!sw) return; if (!sw.fired && performance.now() - sw.t < 650) { const dx = e.clientX - sw.x, dy = e.clientY - sw.y; if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) swipe(dx, dy); } sw = null; });
  function swipe(dx, dy) { if (S.paused) return; if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide(); }
  doc.querySelectorAll('[data-ctl]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); audio.init(); ({ left: () => moveLane(-1), right: () => moveLane(1), up: jump, down: slide })[b.dataset.ctl](); }));
  function controlsVisibility() { const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0; const on = cfg.controls === 'on' || (cfg.controls === 'auto' && touch); $('controls').hidden = !on; }

  // ------------------------------------------------------------------ question flow (local mode)
  function openQuestion() {
    const g = curGate(); if (!g || S.q || S.phase !== 'approach') return;
    const gate = gateObjs.get(S.gateIdx); if (gate) gate.activate();
    g.tries++; audio.questionOpen(); audio.setMode('question');
    if (S.platform.on) { phase('question'); S.platform.awaiting = true; S.platform.result = null; S.platform.outcomeSent = false; S.platform.nextSent = false; post('question'); showPlatformWait(true); return; }
    const q = cfg.questions[S.gateIdx]; const pres = root.QRConfig.present(q, Math.min(cfg.answers, q.options.length));
    S.q = { idx: S.gateIdx, q, pres, chosen: -1 }; S.qLocked = false; S.qTimerMax = cfg.timer; S.qTimer = cfg.timer; S.lastTick = Math.ceil(cfg.timer);
    renderQuestion(); phase('question');
  }
  function renderQuestion() {
    const { q, pres } = S.q, box = $('question');
    $('qBadge').textContent = 'السؤال ' + AR(S.gateIdx + 1) + ' من ' + AR(S.total); $('qText').textContent = q.text;
    const img = $('qImage'); if (q.image) { img.src = q.image; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }
    const letters = ['أ', 'ب', 'ج', 'د'], list = $('qOptions'); list.innerHTML = '';
    pres.options.forEach((o, i) => { const b = doc.createElement('button'); b.type = 'button'; b.className = 'opt'; b.dataset.i = i; b.innerHTML = `<span class="opt-l">${letters[i]}</span><span class="opt-t"></span>`; b.querySelector('.opt-t').textContent = o; b.addEventListener('click', () => answer(i)); list.appendChild(b); });
    $('qFeedback').textContent = ''; $('qFeedback').className = 'q-feedback';
    $('qTimer').hidden = !S.qTimerMax; $('qHearts').textContent = heartsText();
    box.hidden = false; box.classList.remove('leaving'); requestAnimationFrame(() => box.classList.add('shown'));
    const first = list.querySelector('button'); if (first) setTimeout(() => { if (S.phase === 'question') first.focus({ preventScroll: true }); }, 50);
  }
  function answer(i) {
    if (S.phase !== 'question' || S.qLocked || !S.q || S.platform.on) return;
    S.qLocked = true; S.q.chosen = i; audio.select();
    const btns = $('qOptions').querySelectorAll('.opt'); btns.forEach(b => { b.disabled = true; if (Number(b.dataset.i) === i) b.classList.add('chosen'); });
    phase('evaluate');
  }
  function evaluate() {
    const { pres, chosen } = S.q, ok = chosen === pres.correctPos, g = curGate();
    const btns = $('qOptions').querySelectorAll('.opt');
    btns.forEach(b => { const k = Number(b.dataset.i); if (k === pres.correctPos && ok) b.classList.add('right'); if (k === chosen && !ok) b.classList.add('wrong'); });
    S.results.push({ q: S.gateIdx, try: g.tries, correct: ok, chosen: chosen >= 0 ? pres.options[chosen] : null, timeout: chosen < 0 });
    if (ok) onCorrect(); else onWrong();
  }
  function onCorrect(pending = false) {
    const g = curGate(), gate = gateObjs.get(S.gateIdx);
    if (pending) { S.pendingTotal++; S.openPending = 'pending'; fb('إجابتك قيد التصحيح عند المعلم — تابع الجري!', 'pending'); }
    else {
      S.correctTotal++; if (g.tries === 1) S.firstTry++; S.combo++; const mult = Math.min(5, S.combo); const pts = 100 * mult;
      S.score += pts; S.coins += 5; audio.success(); S.openPending = true;
      fb(['أحسنت!', 'إجابة رائعة!', 'ممتاز!', 'بطل!'][S.combo % 4] + '  +' + AR(pts) + (mult > 1 ? '  (×' + AR(mult) + ')' : ''), 'good'); flash('good');
    }
    g.done = true; g.outcome = pending ? 'pending' : 'correct';
    if (cfg.dayNight) S.todTarget = Math.min(3, (S.gates.filter(q => q.done).length) * 3 / Math.max(1, S.total - 0.5));
    phase('success'); hud();
  }
  function onWrong() {
    const g = curGate(), gate = gateObjs.get(S.gateIdx);
    S.wrongTotal++; S.combo = 0; audio.wrong(); void gate;
    fb(S.q && S.q.chosen < 0 ? 'انتهى الوقت!' : 'إجابة غير صحيحة', 'bad'); flash('bad');
    if (!S.platform.on) S.hearts = Math.max(0, S.hearts - 1); else S.hearts = Math.max(0, S.hearts - 1);
    void g; phase('reject'); hud();
  }
  function closeQuestion() { const box = $('question'); if (box.hidden) return; box.classList.add('leaving'); box.classList.remove('shown'); S.closeAt = S.time + 0.35; }
  function fb(text, kind) { const f = $('qFeedback'); f.textContent = text; f.className = 'q-feedback ' + kind; }

  // ------------------------------------------------------------------ platform bridge
  function post(suffix, extra = {}) { if (!S.platform.on) return; try { root.parent.postMessage(Object.assign({ type: PREFIX + suffix, token: S.platform.token, index: S.platform.round }, extra), root.location.origin); } catch (e) { /* ignore */ } }
  function showPlatformWait(on) { const w = $('platformWait'); if (w) w.hidden = !on; }
  root.addEventListener('message', e => {
    if (!S.platform.on || e.source !== root.parent || e.origin !== root.location.origin || !e.data || typeof e.data !== 'object') return;
    const b = e.data;
    if (b.type === PREFIX + 'config') {
      if (S.platform.configured || typeof b.token !== 'string' || !b.token) return;
      const n = Number(b.count); if (!Number.isSafeInteger(n) || n < 1 || n > 100) return;
      S.platform.token = b.token; S.total = n; S.platform.title = String(b.title || '').slice(0, 150); S.platform.images = Array.isArray(b.images) ? b.images.slice(0, 100) : [];
      if (typeof b.school === 'string') cfg.school = b.school.slice(0, 150); if (typeof b.teacher === 'string') cfg.teacher = b.teacher.slice(0, 150); if (typeof b.student === 'string') cfg.student = b.student.slice(0, 80);
      cfg.lesson = S.platform.title || cfg.lesson; S.platform.configured = true; menuInfo(); readyCheck(); return;
    }
    if (b.token !== S.platform.token || b.index !== S.platform.round) return;
    if (b.type === PREFIX + 'result') {
      if (S.phase !== 'question' || !S.platform.awaiting) return;
      S.platform.awaiting = false; showPlatformWait(false);
      S.results.push({ q: S.gateIdx, try: 1, correct: b.correct === true, pending: b.pending === true, feedback: String(b.feedback || '').slice(0, 300) });
      if (b.correct === true) onCorrect(false); else if (b.pending === true) onCorrect(true); else { S.platformWrong = true; onWrong(); }
      if (b.feedback) toast(String(b.feedback).slice(0, 140), 2.6);
      return;
    }
    if (b.type === PREFIX + 'advance') { S.platform.round++; S.platform.nextSent = false; return; }
    if (b.type === PREFIX + 'retry') { S.platform.nextSent = false; $('btnPlatformNext').hidden = false; return; }
  });

  // ------------------------------------------------------------------ main update
  function update(dt) {
    S.time += dt; S.pt += dt;
    const p = S.phase;
    if (p === 'intro') { if (S.pt > 0.6) phase('run'); }
    if (['intro', 'run', 'approach', 'success', 'retry', 'finish'].includes(p)) runPhysics(dt);
    if (p === 'run') {
      const g = curGate();
      if (g && !g.done) { const stopS = g.s - STOP_BEFORE, brake = S.speed * S.speed / (2 * DECEL); if (S.distance >= stopS - brake - 6 && !S.air) { phase('approach'); S.lane = 1; S.slideT = -1; } }
      if (!g && S.distance >= S.finishS - 2) { phase('finish'); audio.stage(); finish.celebrate(); toast('أكملت الدرس! 🎉', 2.2); }
    }
    if (p === 'approach') { const g = curGate(); if (g && S.speed < 0.08 && Math.abs(S.distance - (g.s - STOP_BEFORE)) < 0.25 && S.pt > 0.4 && Math.abs(S.x - LANES[1]) < 0.05) openQuestion(); }
    if (p === 'question' && !S.platform.on && S.qTimerMax) {
      S.qTimer -= dt; const pct = clamp(S.qTimer / S.qTimerMax, 0, 1); $('qTimerFill').style.width = (pct * 100) + '%'; $('qTimer').classList.toggle('urgent', S.qTimer < 5.5);
      const sec = Math.ceil(S.qTimer); if (cfg.countdownSound && sec < S.lastTick && sec >= 0) { S.lastTick = sec; if (sec <= 5) audio.tick(sec <= 3); }
      if (S.qTimer <= 0 && !S.qLocked) { S.qLocked = true; S.q.chosen = -1; $('qOptions').querySelectorAll('.opt').forEach(b => b.disabled = true); phase('evaluate'); }
    }
    if (p === 'evaluate' && S.pt > 0.55) evaluate();
    if (p === 'success') {
      if (S.pt > 0.7 && S.openPending) { const gate = gateObjs.get(S.gateIdx); if (gate) { if (S.openPending === 'pending') gate.pending(); else gate.succeed(); } audio.gateOpen(); S.openPending = false; if (!S.closeAt) closeQuestion(); }
      if (S.pt > 1.15) { // run through the open gate
        const g = curGate();
        if (S.platform.on && !S.platform.outcomeSent) { S.platform.outcomeSent = true; post('outcome'); }
        if (S.distance > g.s + 3) {
          const gate = gateObjs.get(S.gateIdx); gate && gate.pass(); S.q = null; S.closeAt = 0;
          if (S.platform.on && !S.platform.nextSent && S.gateIdx < S.total - 1) { S.platform.nextSent = true; post('next'); }
          S.gateIdx++; audio.setMode('run'); phase('run');
        }
      }
    }
    if (p === 'reject') { // feedback on the card → card closes → light-wave leaves the gate → boy is pushed back
      if (S.pt > 0.75 && !S.waveSent) { S.waveSent = true; closeQuestion(); const gate = gateObjs.get(S.gateIdx); gate && gate.reject(); audio.wave(); }
      if (S.pt > 1.08 && S.recoilT < 0) { S.recoilT = 0; audio.recoil(); }
      if (S.recoilT >= 0) recoilStep(dt);
    }
    if (p === 'recover') {
      S.waveSent = false;
      if (S.pt > 0.9) {
        S.q = null; S.closeAt = 0;
        if (S.platform.on) { // the host graded once: the gate opens for the next question
          const gate = gateObjs.get(S.gateIdx); gate && gate.pending(); const g = curGate(); g.done = true; g.outcome = 'wrong';
          if (!S.platform.outcomeSent) { S.platform.outcomeSent = true; post('outcome'); }
          phase('success'); S.pt = 1.16; toast('واصل! السؤال التالي فرصة جديدة 💪', 2); audio.setMode('run');
        } else if (S.hearts <= 0) { gameOver(); }
        else { toast('حاول مرة أخرى — ' + heartsText(), 1.8); audio.setMode('run'); phase('retry'); }
      }
    }
    if (p === 'retry' && S.pt > 0.5) phase('approach');
    if (p === 'finish') {
      const stop = S.finishS + 14; if (S.distance >= stop - 0.3 && S.speed < 0.2 && !S.finished) { S.finished = true; audio.setMode('finish'); S.finishT = S.time; }
      if (S.finished && S.time - S.finishT > 2.6 && !S.resultsShown) showResults();
    }
    if (S.closeAt && S.time > S.closeAt) { $('question').hidden = true; S.closeAt = 0; }
    // time of day follows lesson progress
    if (Math.abs(S.tod - S.todTarget) > 0.001) { S.tod += clamp(S.todTarget - S.tod, -dt * 0.22, dt * 0.22); world.setTimeOfDay(S.tod); }
    // gates: place pooled gates ahead, recycle passed ones
    for (let k = 0; k < S.gates.length; k++) {
      const g = S.gates[k], has = gateObjs.has(k), near = g.s > S.distance - 45 && g.s < S.distance + 340;
      if (near && !has) { const gate = gatesPool.pop() || new root.QRGate.Gate(); gate.place(-g.s, k + 1); if (g.done) { gate.open = 1; gate.state = 'opening'; gate.setTint('passed'); } world.track.add(gate.group); gateObjs.set(k, gate); if (k === S.gateIdx) audio.gateAppear(); }
      else if (!near && has) { const gate = gateObjs.get(k); world.track.remove(gate.group); gatesPool.push(gate); gateObjs.delete(k); }
    }
    for (const [, gate] of gateObjs) gate.update(dt, S.time);
    if (finish) finish.update(dt, S.time);
    track.generate(S.distance, Math.max(S.speed, runSpeedAt(S.distance)), s => world.zoneAt(s));
    track.update(dt, S.distance, S.time);
    updateZone(false);
    hud();
  }
  // QA autopilot: reads the generated rows like a player would (proves every row is passable)
  function autopilot() {
    if (S.phase !== 'run' || S.bumpT >= 0) return;
    const rows = track.rows.filter(r => r.s > S.distance - 0.3 && r.s < S.distance + 30);
    const r = rows[0]; if (!r) { if (S.lane !== 1 && Math.abs(S.x - LANES[S.lane]) < 0.3) moveLane(Math.sign(1 - S.lane)); return; }
    const d = r.s - S.distance;
    const clear = i => !track.rows.some(q => q.objs.some(o => o.action === 'block' && o.lane === i && o.box.s1 > S.distance - 0.6 && o.box.s0 < r.s + 1));
    const opts = [0, 1, 2].filter(i => r.lanes[i] !== 'block' && clear(i)).sort((a, b) => Math.abs(a - S.lane) - Math.abs(b - S.lane) || (r.lanes[a] === 'free' ? -1 : 1));
    const target = opts.length ? opts[0] : S.lane;
    if (target !== S.lane) { if (Math.abs(S.x - LANES[S.lane]) < 0.5 && !S.air) moveLane(Math.sign(target - S.lane)); return; }
    const t = r.lanes[S.lane];
    if (t === 'jump' && !S.air && d < S.speed * 0.34 + 0.6 && d > 0.3) jump();
    if (t === 'slide' && S.slideT < 0 && d < 2.6 + S.speed * 0.05 && d > 0.2) slide();
  }
  function runPhysics(dt) {
    if (S.autopilot) autopilot();
    const g = curGate(), p = S.phase;
    // forward speed
    let target = runSpeedAt(S.distance);
    if (S.stumbleT > 0) { S.stumbleT -= dt; target *= 0.55; }
    if (p === 'intro') target *= 0.6;
    if (p === 'success' && S.pt < 0.95) target = 0;
    let v = S.speed + clamp(target - S.speed, -9 * dt, 4.2 * dt);
    if (p === 'approach' && g) { const rem = Math.max(0, g.s - STOP_BEFORE - S.distance); v = Math.min(v, Math.sqrt(2 * DECEL * rem)); if (rem < 0.02) v = 0; }
    if (p === 'retry') v = Math.min(v, 2.5);
    if (p === 'finish') { const rem = Math.max(0, S.finishS + 14 - S.distance); v = Math.min(v, Math.sqrt(2 * 4.5 * rem)); }
    if (S.bumpT >= 0) { S.bumpT += dt; v = S.bumpT < 0.45 ? -2.2 * (1 - S.bumpT / 0.45) : Math.min(v, S.bumpT * 6); if (S.bumpT > 0.45 && S.lane === S.bumpFrom) { const fl = track.freeLaneNear(S.distance, S.lane); if (fl != null) { S.lane = fl; audio.lane(fl > S.bumpFrom ? 1 : -1); } } if (S.bumpT > 0.9) S.bumpT = -1; }
    S.speed = v; S.distance += v * dt;
    // a closed gate is a wall: never cross it before it is answered
    if (g && !g.done && S.distance > g.s - STOP_BEFORE + 0.05) { S.distance = g.s - STOP_BEFORE; S.speed = 0; }
    // lateral: critically damped spring toward the lane centre
    const tx = LANES[S.lane], w = 14.5; S.xv += (w * w * (tx - S.x) - 2 * w * S.xv) * dt; S.x += S.xv * dt;
    // vertical
    S.jumpBuffer = Math.max(0, S.jumpBuffer - dt);
    if (S.air) { // analytic arc (frame-rate independent, identical every jump); fast-fall integrates
      S.airT += dt;
      if (S.fastFall) { S.vy -= GRAV * 1.6 * dt; S.y += S.vy * dt; } else { S.y = V0 * S.airT - 0.5 * GRAV * S.airT * S.airT; S.vy = V0 - GRAV * S.airT; }
      if (S.y <= 0 && S.airT > 0.05) { S.y = 0; S.air = false; S.vy = 0; S.fastFall = false; S.landT = 0; audio.land(clamp(S.airT / JUMP_T, 0.4, 1)); if (S.slideQueued) { S.slideQueued = false; S.slideT = 0; audio.slide(); } else if (S.jumpBuffer > 0 && canAct()) { S.jumpBuffer = 0; jump(); } }
    }
    if (S.landT >= 0) { S.landT += dt; if (S.landT > 0.16) S.landT = -1; }
    if (S.slideT >= 0) { S.slideT += dt; if (S.slideT > SLIDE_T) S.slideT = -1; }
    if (S.invulT > 0) S.invulT -= dt;
    // collisions & coins (only while really running)
    if ((p === 'run' || p === 'intro') && S.invulT <= 0 && S.bumpT < 0) {
      const h = S.slideT >= 0 && S.slideT < SLIDE_T - 0.08 ? 0.82 : 1.56;
      const o = track.collide({ s: S.distance, x: S.x, y: S.y, h, half: 0.32 });
      if (o) hit(o);
    }
    const n = track.collect({ s: S.distance, x: S.x, y: S.y }); if (n) { S.coins += n; S.score += 10 * n; for (let i = 0; i < n; i++) audio.coin(S.coinChain++); S.lastCoin = S.time; } else if (S.time - (S.lastCoin || 0) > 1.2) S.coinChain = 0;
    if (p === 'run') S.score += v * dt * 0.5;
  }
  function hit(o) {
    (S.hitLog = S.hitLog || []).push({ d: +S.distance.toFixed(1), kind: o.kind, action: o.action, lane: o.lane, my: S.lane, x: +S.x.toFixed(2), y: +S.y.toFixed(2), air: S.air, slide: S.slideT, row: track.rowAt(o.box.s0 + 0.5) ? track.rowAt(o.box.s0 + 0.5).lanes.join(',') : '', box: [o.box.s0.toFixed(1), o.box.s1.toFixed(1), o.box.y0, o.box.y1] });
    S.hits++; S.score = Math.max(0, S.score - 20); S.invulT = 1.1; S.combo = Math.max(0, S.combo);
    if (o.action === 'block') {
      const frontal = S.distance - 0.4 < o.box.s0 + 0.6;
      if (frontal) { S.bumpT = 0; S.bumpFrom = S.lane; audio.hit('hard'); flash('bad'); toast('انتبه للسيارة! تفادَها يمينًا أو يسارًا', 1.6); }
      else { S.lane = S.laneFrom == null ? S.lane : S.laneFrom; S.stumbleT = 0.4; audio.hit('soft'); flash('bad'); }
      o.hit = true;
    } else {
      track.knock(o, S.speed); S.stumbleT = 0.55; audio.hit(o.kind === 'cone' ? 'cone' : 'soft'); flash('bad');
      toast(o.action === 'jump' ? 'اقفز فوق الحواجز ↑' : 'انزلق تحت العوائق ↓', 1.3);
      if (o.action === 'slide') o.hit = true;
    }
  }
  function recoilStep(dt) {
    S.recoilT += dt; const t = S.recoilT;
    const v = t < RECOIL_T ? -(2 * RECOIL_D / RECOIL_T) * (1 - t / RECOIL_T) : 0; S.speed = v; S.distance += v * dt;
    const tx = LANES[S.lane], w = 19; S.xv += (w * w * (tx - S.x) - 2 * w * S.xv) * dt; S.x += S.xv * dt;
    if (t > RECOIL_T + 0.25) { S.recoilT = -1; S.speed = 0; phase('recover'); }
  }
  function gameOver() {
    phase('gameover'); audio.setMode('menu');
    const g = curGate(); $('goText').textContent = 'نفدت المحاولات عند السؤال ' + AR(S.gateIdx + 1) + '. لا بأس، التعلّم يحتاج إلى تكرار!';
    $('btnRetryGate').hidden = cfg.onFail === 'restart'; show('gameover'); void g;
  }
  function showResults() {
    S.resultsShown = true; phase('results');
    const n = S.total, first = S.firstTry, pct = n ? Math.round(first / n * 100) : 0, pass = S.platform.on ? null : pct >= cfg.threshold;
    $('rTitle').textContent = 'عدّاء قطر — مغامرة التحدي';
    $('rSchool').textContent = cfg.school; $('rTeacher').textContent = cfg.teacher; $('rLesson').textContent = cfg.lesson; $('rStudent').textContent = cfg.student || '—';
    $('rCorrect').textContent = AR(S.correctTotal) + ' / ' + AR(n); $('rFirst').textContent = AR(first); $('rScore').textContent = AR(Math.round(S.score)); $('rCoins').textContent = AR(S.coins);
    $('rStatus').textContent = S.platform.on ? 'تم إرسال إجاباتك إلى منصة المدرسة' : pass ? 'ناجح — أتممت الدرس بنجاح 🎉' : 'أكملت المسار — راجع الدرس وحاول تحسين نتيجتك';
    $('rStatus').className = 'r-status ' + (S.platform.on ? 'info' : pass ? 'good' : 'warn');
    $('btnCert').hidden = S.platform.on; $('btnPlatformNext').hidden = !S.platform.on; $('btnReplay').hidden = S.platform.on;
    show('results');
    if (S.platform.on && !S.platform.nextSent) { S.platform.nextSent = true; post('next'); }
  }
  // ------------------------------------------------------------------ animation + camera
  const camPos = new T.Vector3(0, 3.2, 7), camLook = new T.Vector3(0, 1.3, -8), tmpV = new T.Vector3(), tmpL = new T.Vector3();
  function animate(dt) {
    if (!boy) return;
    const p = S.phase; let state = 'idle', ctx = { speed: S.speed, lateral: S.xv, t: S.time };
    if (p === 'menu' || p === 'boot') state = 'idle';
    else if (p === 'gameover' || p === 'question' || p === 'evaluate') state = 'idle';
    else if (S.finished || p === 'results') state = 'victory';
    else if (p === 'reject' || p === 'recover') { state = S.recoilT >= 0 ? 'recoil' : 'idle'; ctx.recoilT = Math.max(0, S.recoilT); }
    else if (S.bumpT >= 0 && S.bumpT < 0.5) { state = 'recoil'; ctx.recoilT = 0.6 + S.bumpT; }
    else if (S.air) { state = 'jump'; ctx.jumpT = clamp(S.airT / JUMP_T, 0, 1); ctx.fade = 0.08; }
    else if (S.slideT >= 0) { state = 'slide'; ctx.slideT = clamp(S.slideT / SLIDE_T, 0, 1); ctx.fade = 0.08; }
    else if (S.landT >= 0) { state = 'land'; ctx.landT = S.landT / 0.16; ctx.fade = 0.06; }
    else state = S.speed > 0.2 ? 'run' : 'idle';
    if (S.stumbleT > 0 && state === 'run') ctx.accelLean = -0.3 * S.stumbleT;
    ctx.state = state; anim.update(dt, ctx);
    boy.group.position.set(S.x, S.y, 0); boy.group.rotation.y = Math.PI + clamp(-S.xv * 0.035, -0.18, 0.18);
    boy.simulate(dt, S.speed);
    // camera
    let cp, cl;
    if (p === 'menu' || p === 'boot' || p === 'loading') { const a = Math.sin(S.time * 0.16) * 0.3; cp = tmpV.set(-1.1 + a, 1.5, -3.6 + a * 0.4); cl = tmpL.set(-1.55, 1.2, 0.8); }
    else if (p === 'question' || p === 'evaluate' || (p === 'reject' && S.pt < 0.7) || (p === 'success' && S.pt < 0.6)) { const g = curGate(); const gz = g ? -(g.s - S.distance) : -5; cp = tmpV.set(S.x + 4.6, 1.75, 5.2); cl = tmpL.set(-0.4, 2.1, gz * 0.55); }
    else if (S.finished || p === 'results') { cp = tmpV.set(S.x + 2.4, 1.7, -4.6); cl = tmpL.set(S.x, 1.2, 0); }
    else { const k = clamp(S.speed / 12, 0, 1); cp = tmpV.set(S.x * 0.8, 2.6 + S.y * 0.45 + k * 0.12, 5.0 + k * 0.45); cl = tmpL.set(S.x * 0.9, 1.2 + S.y * 0.6, -6.5); }
    const r = S.snapCam ? 1 : 1 - Math.exp(-dt * (p === 'run' ? 7 : 3.2)); S.snapCam = false; camPos.lerp(cp, r); camLook.lerp(cl, r);
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (S.camOverride) { const o = S.camOverride; camera.position.set(S.x + o.pos[0], S.y + o.pos[1], o.pos[2]); camera.lookAt(S.x + o.look[0], o.look[1], o.look[2]); if (o.fov) camera.fov = o.fov; }
    const fovT = (camera.aspect < 0.8 ? 72 : 58) + clamp(S.speed, 0, 13) * 0.3; camera.fov = lerp(camera.fov, fovT, 1 - Math.exp(-dt * 2)); camera.updateProjectionMatrix();
    // sun shadow follows the player
    world.sun.position.copy(world.sunDir).multiplyScalar(60).add(tmpV.set(S.x, 0, -12)); world.sun.target.position.set(S.x, 0, -12); world.sun.target.updateMatrixWorld();
  }
  let surf = 'asphalt';
  function updateZone(force) { const z = world.zoneAt(S.distance + 1); if (force || z !== S.zone) { S.zone = z; surf = z === 'souq' ? 'stone' : 'asphalt'; } }

  // ------------------------------------------------------------------ HUD / UI
  function heartsText() { return '❤'.repeat(S.hearts) + '♡'.repeat(Math.max(0, cfg.attempts - S.hearts)); }
  let hudCache = '';
  function hud() {
    const done = S.gates.filter(g => g.done).length, key = [Math.round(S.score), S.coins, S.hearts, done, S.total, S.combo].join('|'); if (key === hudCache) return; hudCache = key;
    $('hScore').textContent = AR(Math.round(S.score)); $('hCoins').textContent = AR(S.coins); $('hHearts').textContent = heartsText();
    $('hProg').textContent = AR(done) + ' / ' + AR(S.total); $('hProgFill').style.width = (S.total ? done / S.total * 100 : 0) + '%';
    const c = $('hCombo'); c.hidden = S.combo < 2; c.textContent = '×' + AR(Math.min(5, S.combo));
  }
  let toastT = 0; function toast(t, secs = 1.6) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), secs * 1000); }
  function flash(kind) { const f = $('flash'); f.className = 'flash ' + kind; void f.offsetWidth; f.classList.add('go'); }
  function show(id) { const el = $(id); if (el) el.hidden = false; }
  function hide(id) { const el = $(id); if (el) el.hidden = true; }
  function hideAll() { ['gameover', 'results', 'pause', 'certificate', 'question', 'help'].forEach(hide); }
  function togglePause() {
    if (['menu', 'boot', 'results', 'gameover'].includes(S.phase)) return;
    S.paused = !S.paused; $('pause').hidden = !S.paused; if (S.paused) audio.suspend(); else { audio.resume(); last = 0; }
  }
  function toggleMute() { const m = audio.toggleMute(); try { localStorage.setItem('qatarRunner.muted', m ? '1' : '0'); } catch (e) { /* ignore */ } $('btnMute').classList.toggle('off', m); $('btnMute').setAttribute('aria-pressed', String(m)); }
  function menuInfo() {
    $('mLesson').textContent = cfg.lesson; $('mTeacher').textContent = cfg.teacher; $('mSchool').textContent = cfg.school;
    $('mCount').textContent = AR(S.platform.on ? S.total : cfg.questions.length) + ' أسئلة';
    $('mMode').textContent = S.platform.on ? 'مهمة من منصة المدرسة — يُصحَّح على المنصة' : cfg.sample ? 'أسئلة تجريبية — يمكن للمعلم إضافة أسئلة الدرس' : 'درس المعلم' + (cfg.className ? ' · ' + cfg.className : '');
    $('btnTeacher').hidden = S.platform.on || studentBuild;
    $('envSel').value = cfg.environment; $('envSel').disabled = S.platform.on && false;
  }
  function readyCheck() { if (S.phase !== 'loading' || !boy || !S.platform.configured) return; hide('loading'); phase('menu'); S.snapCam = true; show('menu'); menuInfo(); $('btnStart').disabled = false; $('btnStart').focus({ preventScroll: true }); }
  function fatal(msg) { const l = $('loading'); if (l) { l.hidden = false; $('loadMsg').textContent = msg; $('loadBar').hidden = true; } }

  // certificate (printable)
  function certificate() {
    $('cName').textContent = cfg.student || 'الطالب البطل'; $('cLesson').textContent = cfg.lesson; $('cSchool').textContent = cfg.school; $('cTeacher').textContent = cfg.teacher;
    $('cScore').textContent = AR(S.correctTotal) + ' / ' + AR(S.total) + ' إجابات صحيحة — ' + AR(Math.round(S.score)) + ' نقطة';
    $('cDate').textContent = new Date().toLocaleDateString('ar-QA', { year: 'numeric', month: 'long', day: 'numeric' });
    show('certificate');
  }
  // buttons
  $('btnStart').addEventListener('click', start);
  $('btnHelp').addEventListener('click', () => show('help')); $('btnHelpClose').addEventListener('click', () => hide('help'));
  $('btnPause').addEventListener('click', togglePause); $('btnResume').addEventListener('click', togglePause);
  $('btnRestart').addEventListener('click', () => { S.paused = false; audio.resume(); hide('pause'); restart(false); });
  $('btnMute').addEventListener('click', () => { audio.init(); toggleMute(); });
  $('btnFull').addEventListener('click', async () => { try { if (S.platform.on) post('fullscreen'); else if (doc.fullscreenElement) await doc.exitFullscreen(); else await doc.documentElement.requestFullscreen(); } catch (e) { toast('دوّر الجهاز أفقيًا لمشهد أوسع', 1.6); } });
  $('btnRetryGate').addEventListener('click', () => { hide('gameover'); restart(true); });
  $('btnRestartAll').addEventListener('click', () => { hide('gameover'); restart(false); });
  $('btnReplay').addEventListener('click', () => { S.resultsShown = false; hideAll(); restart(false); });
  $('btnCert').addEventListener('click', certificate); $('btnCertClose').addEventListener('click', () => hide('certificate')); $('btnPrint').addEventListener('click', () => root.print());
  $('btnPlatformNext').addEventListener('click', () => { if (S.platform.on && !S.platform.nextSent) { S.platform.nextSent = true; post('next'); $('btnPlatformNext').hidden = true; } });
  if (root.__QR_ARTIFACT__) $('btnPrint').hidden = true; // the claude.ai viewer cannot open the print dialog
  $('volMusic').value = cfg.music; $('volSfx').value = cfg.sfx;
  $('volMusic').addEventListener('input', e => audio.set('music', Number(e.target.value))); $('volSfx').addEventListener('input', e => audio.set('sfx', Number(e.target.value)));
  $('envSel').addEventListener('change', e => { cfg.environment = e.target.value; if (!S.platform.on && !studentBuild) root.QRConfig.save(Object.assign({}, cfg)); });
  $('btnTeacher').addEventListener('click', () => { if (root.QRTeacher) root.QRTeacher.open(cfg, saved => { cfg = saved; track.difficulty = cfg.difficulty; menuInfo(); }); });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) { audio.suspend(); if (['run', 'approach', 'intro'].includes(S.phase) && !S.paused) togglePause(); } else if (!S.paused) audio.resume(); });

  // ------------------------------------------------------------------ loop
  let last = 0, fpsAcc = 0, fpsN = 0, lowT = 0, raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    if (S.paused || QA_HOLD.on) return;
    step(dt); render();
    fpsAcc += dt; fpsN++; if (fpsAcc > 2) { const fps = fpsN / fpsAcc; S.fps = fps; fpsAcc = 0; fpsN = 0; if (fps < 26 && ['run', 'approach'].includes(S.phase)) { lowT++; if (lowT >= 2 && dpr > 0.75) { dpr = Math.max(0.75, dpr * 0.8); renderer.setPixelRatio(dpr); resize(); lowT = 0; } } else lowT = 0; }
  }
  function step(dt) { if (S.phase !== 'boot' && S.phase !== 'loading') update(dt); animate(dt); world.update(dt, S.distance, camera); audio.update(dt, { speed: S.speed, zone: S.zone, paused: ['question', 'evaluate', 'menu'].includes(S.phase) }); }
  function render() { world.render(camera); }
  const QA_HOLD = { on: QA };
  // footsteps from the animator's real foot contacts
  async function boot() {
    phase('loading'); show('loading');
    $('loadMsg').textContent = 'جارٍ تجهيز الدوحة والولد العدّاء…';
    try {
      boy = await new root.QRBoy.Boy().build(); boy.quality = quality === 'low' ? 0 : 1;
      boy.group.rotation.y = Math.PI; world.scene.add(boy.group);
      anim = new root.QRBoy.Animator(boy); anim.onFootstep = (side, sp) => { if (['run', 'approach', 'retry', 'intro', 'finish', 'success'].includes(S.phase) || S.recoilT >= 0) audio.footstep(side, sp, surf); };
      anim.update(1 / 60, { state: 'idle', speed: 0, lateral: 0, t: 0 }); boy.settle(160);
    } catch (e) { fatal('تعذّر تجهيز الشخصية: ' + (e && e.message || e)); return; }
    $('loadBarFill').style.width = '100%';
    S.total = cfg.questions.length; setupRun();
    world.update(1 / 60, 0, camera);
    if (S.platform.on) { $('loadMsg').textContent = 'جارٍ الاتصال بمنصة المدرسة…'; post('ready'); setTimeout(() => { if (!S.platform.configured) fatal('تعذّر الاتصال بمنصة المدرسة. افتح اللعبة من رابط المهمة داخل المنصة.'); }, 20000); }
    readyCheck();
  }
  // QA hooks (deterministic stepping without rendering; used by tests/*.cjs)
  root.QRGame = {
    get state() { return S; }, get cfg() { return cfg; }, world, track, audio, get boy() { return boy; }, get anim() { return anim; }, camera,
    gates: () => gateObjs,
    start, moveLane, jump, slide, answer, restart,
    answerCorrect: () => { if (S.q) answer(S.q.pres.correctPos); }, answerWrong: () => { if (S.q) answer((S.q.pres.correctPos + 1) % S.q.pres.options.length); },
    hold: v => { QA_HOLD.on = v !== false; last = 0; },
    step: (secs, fps = 60) => { const n = Math.round(secs * fps); for (let i = 0; i < n; i++) step(1 / fps); return S.phase; },
    until: (pred, max = 60, fps = 30) => { for (let i = 0; i < max * fps; i++) { step(1 / fps); if (pred(S)) return true; } return false; },
    render, snapshot: () => ({ phase: S.phase, distance: +S.distance.toFixed(2), speed: +S.speed.toFixed(2), lane: S.lane, x: +S.x.toFixed(2), y: +S.y.toFixed(2), hearts: S.hearts, gateIdx: S.gateIdx, score: Math.round(S.score), coins: S.coins, hits: S.hits, zone: S.zone, tod: +S.tod.toFixed(2), track: track.snapshot(), results: S.results.slice() }),
    setConfig: c => { cfg = root.QRConfig.validate(c); menuInfo(); },
    autopilot: v => { S.autopilot = v !== false; },
    cameraOverride: o => { S.camOverride = o || null; },
    testRow: (lanes, ahead = 14) => { track.reset({ start: S.distance + 1e6 }); track.lastS = 0; return track.testRow(S.distance + ahead, lanes, world.zoneAt(S.distance + ahead)); },
    clearTrack: () => track.reset({ start: S.distance + 1e6 }),
    teleport: d => { S.distance = d; },
    openQuestionNow: () => openQuestion(),
    consts: { JUMP_T, JUMP_H, SLIDE_T, STOP_BEFORE, RECOIL_D },
    embedded
  };
  raf = requestAnimationFrame(frame); boot();
})(window);
