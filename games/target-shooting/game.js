/* Target Shooting 3D (التصويب على الهدف) — game controller: UI, input, rounds, educational flow and the
 * platform contract.
 *
 * Platform mode: the archer draws automatically, a centered school question opens, and the server's
 * answer result determines ONE arrow flight. Correct = target hit, wrong = visible miss; an essay awaiting
 * teacher review is neutral and no arrow is shot. The independent/offline edition retains its original
 * four shooting challenges, manual controls and scoring. No answer key is transmitted to this iframe.
 *
 * Contract (same-origin iframe, prefix school-target-shooting-, outgoing parent.postMessage(payload, location.origin)):
 *   game -> host: ready, question{token,index}, outcome{token,index,outcome,earned,hits}, next{token,index}, fullscreen{token,index}
 *   host -> game: config{title,count,images,token[,school,shooting,student]}, result{token,index,correct,pending,feedback},
 *                 advance{token,index(old)}, retry{token,index}
 * Every incoming message is checked for origin, source (=== parent), type, exact token, exact index and phase.
 */
(() => {
  'use strict';
  const TS = window.TS, U = TS.util, C = TS.config, PH = TS.Physics;
  const T = window.THREE;
  // ------------------------------------------------------------------ markup + role
  const tpl = document.getElementById('app-markup');
  document.body.prepend(tpl.content.cloneNode(true));
  const $ = id => document.getElementById(id);
  const PREFIX = 'school-' + C.KEY + '-';
  const embedded = window.parent !== window;
  const guided = embedded; // only the school platform iframe uses the one-question/one-arrow flow
  const params = new URLSearchParams(location.search);
  const QA = params.has('qa'), MANUAL = QA && params.has('manual');
  let preset = null; try { preset = JSON.parse(($('ts-preset') || {}).textContent || 'null'); } catch (e) { preset = null; }
  const role = embedded ? 'student' : (preset && preset.role) || document.body.dataset.role || 'student';
  document.body.dataset.role = role;
  const STORE_KEY = 'ts-teacher-config-v1';
  let cfg = C.sanitize(preset && preset.config ? preset.config : (role === 'teacher' || !embedded ? U.store.get(STORE_KEY, null) : null));
  if (preset && preset.config) cfg = C.sanitize(preset.config);
  const prefs = U.store.get('ts-prefs', { sfx: true, music: true, simple: false, name: '' });

  const S = {
    phase: 'loading', round: 0, total: 0, token: '', configured: !embedded, title: '', student: prefs.name || '',
    mode: guided ? 'archery' : cfg.mode === 'choice' ? 'archery' : cfg.mode, difficulty: guided ? 'beginner' : cfg.difficulty, points: 0, roundPoints: 0, correct: 0, pending: 0,
    shots: 0, hits: 0, roundShots: 0, roundHits: 0, arrowsLeft: 0, questions: [], result: null, resultUsed: false, nextSent: false,
    loaded: false, paused: false, roundTimer: 0, endTimer: -1, simple: !!prefs.simple || cfg.controls === 'simple', drawing: false, guidedDecision: null
  };
  const timers = U.timerSet();

  // ------------------------------------------------------------------ audio
  const audio = TS.Audio.create({ sfx: cfg.sound && prefs.sfx !== false, music: cfg.music && prefs.music !== false });
  const unlock = () => { audio.unlock().then(ok => { if (ok && S.loaded && !audio.started) { audio.started = true; audio.ambience(ambienceFor(S.mode)); audio.music(S.phase === 'menu' ? 'menu' : 'play'); } }); };
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  const ambienceFor = m => m === 'balloons' ? 'carnival' : 'meadow';

  // ------------------------------------------------------------------ helpers
  function post(type, extra = {}) { if (!embedded) return; parent.postMessage(Object.assign({ type: PREFIX + type, token: S.token, index: S.round }, extra), location.origin); }
  function phase(p) { S.phase = p; document.body.dataset.phase = p; if (window.ManaratNavigation) window.ManaratNavigation.update(); }
  function show(id, on) { const el = $(id); if (el) el.hidden = !on; }
  function hint(text, warn) { $('hintText').textContent = text; $('hint').classList.toggle('warn', !!warn); }
  function toast(text, ms = 2600) { const t = $('toast'); t.textContent = text; t.hidden = false; timers.later(() => { t.hidden = true; }, ms); }
  const D = n => U.digits(n);
  function applyAccent() { document.documentElement.style.setProperty('--accent', cfg.accent); }

  // ------------------------------------------------------------------ 3D
  let world, fx, rigFactory, archer, aim, camRig, mode = null, diag = null;
  const canvas = $('scene');
  const arrows = { pool: [], flights: [], stuck: [] };
  const v1 = new T.Vector3(), v2 = new T.Vector3();

  function diffOf() { return C.DIFFICULTY[S.difficulty] || C.DIFFICULTY.beginner; }
  function buildMode(key) {
    const m = TS.Modes[key].create({ cfg, diff: diffOf(), world, fx, audio, rng: U.rng(7 + S.round) });
    world.setEnvironment(m.env);
    m.setBranding && m.setBranding({ school: cfg.school, lesson: cfg.lesson });
    archer.setStance(m.stance.pos, m.stance.dir, true);
    aim.setStance(archer.aimOrigin(new T.Vector3()), m.stance.dir);
    aim.limits.yawMin = -(m.yawLimit || 1.0); aim.limits.yawMax = 0.62; aim.limits.pitchMax = m.pitchMax || 0.85;
    camRig.setStance(m.stance.pos, m.stance.dir); camRig.setFraming(m.framing);
    world.focusShadow(v1.copy(m.stance.pos).addScaledVector(m.stance.dir, 5), 11);
    aim.raw.yaw = 0; aim.raw.pitch = m.defaultPitch || 0.02; aim.raw.range = m.defaultRange || 30; aim.snap();
    return m;
  }
  function setMode(key, { fade = true } = {}) {
    if (mode && mode.key === key && mode.diffKey === S.difficulty) return Promise.resolve();
    return new Promise(res => {
      const doIt = () => {
        clearArrows(); fx.clear();
        if (mode) { mode.dispose(); }
        mode = buildMode(key); mode.key = key; mode.diffKey = S.difficulty;
        if (archer.state === 'MODE_TRANSITION' || archer.state === 'IDLE') { /* stays */ }
        if (audio.started) audio.ambience(ambienceFor(key));
        hud();
        timers.later(() => { $('fade').classList.remove('on'); res(); }, fade ? 60 : 0);
      };
      if (archer.state === 'IDLE') archer.go('MODE_TRANSITION'); else archer.standDown();
      if (fade) { $('fade').classList.add('on'); timers.later(doIt, 400); } else doIt();
    });
  }

  // ------------------------------------------------------------------ arrows
  function arrowMesh() {
    let m = arrows.pool.pop();
    if (!m) { m = TS.Gear.makeArrow(archer.mats); }
    m.visible = true; m.scale.setScalar(1);
    if (m.parent !== world.scene) world.scene.add(m);
    return m;
  }
  function recycle(m) { if (m.parent) m.parent.remove(m); m.visible = false; arrows.pool.push(m); }
  function clearArrows() { arrows.flights.forEach(f => recycle(f.mesh)); arrows.stuck.forEach(s => recycle(s.mesh)); arrows.flights = []; arrows.stuck = []; }
  const Z = new T.Vector3(0, 0, 1), QQ = new T.Quaternion();
  function orientArrow(mesh, p, v) { mesh.position.set(p.x, p.y, p.z); v1.set(v.x, v.y, v.z).normalize(); mesh.quaternion.setFromUnitVectors(Z, v1); }

  function onRelease(pose) {
    if (!(S.phase === 'shooting' || (guided && S.phase === 'flight')) || S.arrowsLeft <= 0) return;
    const draw = Math.max(0.55, pose.draw);
    const speed = PH.SPEED * (0.6 + 0.4 * draw);
    const o = PH.v3(pose.nock.x, pose.nock.y, pose.nock.z);
    // In school mode only the server-graded answer selects a deterministic trajectory.
    // The target is stationary, centred, and the wrong trajectory passes well outside its rings.
    const target = guided ? mode.targets[0] : null;
    const point = guided && target && S.guidedDecision
      ? new T.Vector3(target.pos.x + (S.guidedDecision === 'miss' ? 2.8 : 0), target.pos.y, target.pos.z)
      : aim.point;
    const sol = PH.solveLaunch(o, point, speed);
    const vel = sol ? sol.v : PH.v3(aim.launch.x * speed, aim.launch.y * speed, aim.launch.z * speed);
    const flight = new PH.Flight(o, vel, 'a' + S.shots);
    const mesh = arrowMesh(); orientArrow(mesh, flight.p, flight.v);
    arrows.flights.push({ flight, mesh, aimPoint: aim.point.clone() });
    S.arrowsLeft--; S.shots++; S.roundShots++;
    audio.play('release');
    hud();
  }

  function simStep(h) {
    if (!mode) return;
    mode.preStep(); mode.step(h, S.phase, S.phase === 'shooting' && archer.state === 'AIM_HOLD');
    if (!arrows.flights.length) return;
    const cols = mode.colliders();
    for (const f of arrows.flights) {
      if (!f.flight.alive) continue;
      const hit = f.flight.step(h, cols);
      if (hit) handleHit(f, hit);
      else if (f.flight.p.y < -2 || f.flight.t > 6) { f.flight.alive = false; f.lost = true; }
    }
    arrows.flights = arrows.flights.filter(f => { if (!f.flight.alive) { if (!f.kept) recycle(f.mesh); return false; } return true; });
  }
  function handleHit(f, hit) {
    const fl = f.flight, res = mode.onHit(hit, fl.v) || { points: 0, stick: true };
    const p = hit.point, pan = projectPan(p);
    if (res.points > 0) { S.roundPoints += res.points; }
    if (res.success) { S.hits++; S.roundHits++; }
    if (res.stick) {
      // embed: tip at the contact point plus penetration along the flight direction
      const dir = v1.set(fl.v.x, fl.v.y, fl.v.z).normalize();
      const pen = res.kind === 'ground' ? 0.16 : res.kind === 'backstop' ? 0.22 : 0.075;
      f.mesh.position.set(fl.p.x, fl.p.y, fl.p.z).addScaledVector(dir, pen);
      f.mesh.quaternion.setFromUnitVectors(Z, dir);
      if (res.attach) res.attach.attach(f.mesh);
      fl.alive = false; f.kept = true;
      arrows.stuck.push({ mesh: f.mesh, t: 0, attach: res.attach });
      while (arrows.stuck.length > 14) recycle(arrows.stuck.shift().mesh);
      audio.play(res.kind === 'face' || res.kind === 'boss' ? 'thud' : 'ground', { pan });
      if (res.kind === 'face' || res.kind === 'boss') fx.burst('dust', p, { count: 8, colors: [0xd8c08a, 0xb89a62], speed: 1.2, size: 0.02, life: 0.5, gravity: 2, dir: v2.set(-dir.x, -dir.y, -dir.z), cone: 0.8 });
      else fx.burst('dust', p, { count: 10, colors: [0x8a7550, 0x6d5c3e], speed: 1.4, size: 0.03, life: 0.7, gravity: 3 });
    } else if (res.consume) {
      fl.alive = false;
    }
    if (res.fx) res.fx(p, fl);
    popup(p, res);
    if (res.bull) { audio.play('bull'); if (cfg.celebration !== 'low') fx.burst('spark', p, { count: cfg.celebration === 'high' ? 40 : 22, colors: [0xffd34d, 0xffffff, 0xff8fb0], speed: 3, size: 0.03, life: 0.9, gravity: 1.5 }); }
    hud();
    if (mode.roundComplete && mode.roundComplete()) scheduleRoundEnd(1.1);
  }
  function popup(p, res) {
    if (!res.label) return;
    const s = project(p); if (!s) return;
    const el = document.createElement('div');
    el.dir = 'rtl';
    el.className = 'pop ' + (res.bull || res.bonus ? 'gold' : res.points > 0 || res.success ? '' : 'miss');
    el.textContent = res.points > 0 ? res.label + ' · +' + D(res.points) : res.label;
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    $('popups').appendChild(el);
    timers.later(() => el.remove(), 1300);
  }
  function project(p) {
    const r = canvas.getBoundingClientRect(), c = world.camera;
    v2.set(p.x, p.y, p.z).project(c); if (v2.z > 1) return null;
    return { x: (v2.x * 0.5 + 0.5) * r.width, y: (-v2.y * 0.5 + 0.5) * r.height };
  }
  function projectPan(p) { const s = project(p); if (!s) return 0; return U.clamp((s.x / canvas.clientWidth) * 2 - 1, -1, 1) * 0.7; }

  // ------------------------------------------------------------------ HUD
  function hud() {
    const m = C.MODES[S.mode];
    $('hudMode').textContent = m.title;
    $('hudSchool').textContent = [cfg.school, S.title || cfg.lesson].filter(Boolean).join(' · ');
    $('hudProgress').textContent = S.total ? D(Math.min(S.round + 1, S.total)) + ' / ' + D(S.total) : '—';
    $('hudScore').textContent = D(S.points + (S.phase === 'shooting' || S.phase === 'roundEnd' ? S.roundPoints : 0));
    $('hudArrows').textContent = D(Math.max(0, S.arrowsLeft));
    $('hudTargetsLabel').textContent = m.targets;
    $('hudTargets').textContent = mode ? D(mode.remaining()) : '—';
    $('hudDiff').textContent = diffOf().title;
    show('hudTimerCell', cfg.timeLimit > 0);
    document.title = (S.title ? S.title + ' | ' : '') + C.GAME_NAME + ' | ' + cfg.school;
  }

  // ------------------------------------------------------------------ menu
  const CARD_ART = {
    archery: '<svg viewBox="0 0 120 90"><g class="bob"><circle cx="78" cy="45" r="30" fill="#fff"/><circle cx="78" cy="45" r="24" fill="#1a1a1a"/><circle cx="78" cy="45" r="18" fill="#1f7bd8"/><circle cx="78" cy="45" r="12" fill="#e2252b"/><circle cx="78" cy="45" r="6" fill="#ffd21f"/></g><g class="arrow"><path d="M8 45H74" stroke="#fff" stroke-width="2.4"/><path d="M74 45l-7-3v6z" fill="#fff"/><path d="M8 45l-6-5M8 45l-6 5M14 45l-6-5M14 45l-6 5" stroke="#f2c14e" stroke-width="2"/></g></svg>',
    birds: '<svg viewBox="0 0 120 90"><path d="M0 80Q30 60 60 72T120 66V90H0z" fill="rgba(255,255,255,.25)"/><g class="fly"><path d="M40 40q10-14 20 0q10-14 20 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g><g class="fly" style="animation-delay:-1.4s"><path d="M78 22q7-10 14 0q7-10 14 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/></g><g class="fly" style="animation-delay:-2.6s"><path d="M16 26q6-8 12 0q6-8 12 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/></g></svg>',
    balloons: '<svg viewBox="0 0 120 90"><g class="bob"><ellipse cx="40" cy="34" rx="14" ry="17" fill="#e2252b"/><path d="M40 51q-3 12 2 26" stroke="#fff" fill="none"/></g><g class="bob2"><ellipse cx="66" cy="28" rx="14" ry="17" fill="#f2c14e"/><path d="M66 45q3 14-2 30" stroke="#fff" fill="none"/></g><g class="bob" style="animation-delay:-1s"><ellipse cx="90" cy="38" rx="13" ry="16" fill="#1f7bd8"/><path d="M90 54q-3 12 1 24" stroke="#fff" fill="none"/></g></svg>',
    clay: '<svg viewBox="0 0 120 90"><path class="arc" d="M10 80Q60 -10 112 60" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2"/><g class="disc"><ellipse cx="62" cy="38" rx="14" ry="5" fill="#ff6a1a"/><ellipse cx="62" cy="36" rx="9" ry="3" fill="#ffa25f"/></g><rect x="4" y="74" width="24" height="12" rx="3" fill="#3b4148"/></svg>'
  };
  function buildMenu() {
    const box = $('modeCards'); box.innerHTML = '';
    (guided ? ['archery'] : C.MODE_KEYS).forEach((k, i) => {
      const m = C.MODES[k], b = document.createElement('button');
      b.className = 'card'; b.type = 'button'; b.dataset.mode = k; b.setAttribute('role', 'radio');
      b.innerHTML = '<span class="num">' + D(i + 1) + '</span><div class="art">' + CARD_ART[k] + '</div><h3>' + m.title + '</h3><p>' + m.sub + '</p>';
      const locked = cfg.mode !== 'choice' && cfg.mode !== k;
      if (locked) { b.setAttribute('aria-disabled', 'true'); b.tabIndex = -1; }
      b.onclick = () => selectMode(k);
      b.onmouseenter = b.onfocus = () => { if (!locked) previewSoon(k); };
      box.appendChild(b);
    });
    $('modeCards').hidden = guided;
    $('diffGroup').hidden = guided;
    const dg = $('diffGroup'); dg.classList.toggle('locked', embedded && cfg.lockDifficulty !== false && !!cfg.fromPlatform);
    dg.querySelectorAll('button').forEach(b => { b.onclick = () => { if (dg.classList.contains('locked')) return; S.difficulty = b.dataset.diff; menuUI(); previewSoon(S.mode, true); }; });
    menuUI();
  }
  let previewTimer = 0;
  function previewSoon(k, force) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { if (S.phase !== 'menu') return; if (force || !mode || mode.key !== k) { S.mode = k; menuUI(); setMode(k); } }, force ? 50 : 420);
  }
  function selectMode(k) { if (cfg.mode !== 'choice' && cfg.mode !== k) return; S.mode = k; audio.play('click'); menuUI(); previewSoon(k, true); }
  function menuUI() {
    $('modeCards').querySelectorAll('.card').forEach(c => c.setAttribute('aria-checked', String(c.dataset.mode === S.mode)));
    $('diffGroup').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.diff === S.difficulty)));
    $('menuSchool').textContent = cfg.school + (cfg.department ? ' · ' + cfg.department : '');
    $('menuLesson').textContent = guided ? (S.title || 'اسحب القوس · أجب عن السؤال · شاهد السهم يصيب أو يخطئ') : S.title || cfg.lesson || 'لعبة تعليمية ثلاثية الأبعاد · أربعة تحديات رماية';
    const qn = S.total;
    $('menuNote').textContent = guided ? (S.configured ? D(qn) + ' أسئلة · سهم واحد لكل سؤال · التصويب تلقائي' : 'بانتظار بيانات المهمة من المنصة…')
      : (cfg.questions ? D(qn) + ' أسئلة من إعداد المعلم' : 'تدريب بأسئلة تجريبية · لا يُسجّل في تقارير المنصة') + ' · ' + D(cfg.arrowsPerQuestion) + ' أسهم في كل جولة';
    const ready = S.loaded && S.configured;
    $('btnStart').disabled = !ready;
    $('btnStart').textContent = ready ? (guided ? 'ابدأ الرماية التعليمية' : 'ابدأ التحدي: ' + C.MODES[S.mode].title) : S.loaded ? 'بانتظار المهمة…' : 'جارٍ التجهيز…';
    $('btnTeacher').hidden = role !== 'teacher';
    soundUI();
  }
  function soundUI() {
    $('btnMusic').setAttribute('aria-pressed', String(audio.musicOn)); $('btnMusic').textContent = 'الموسيقى: ' + (audio.musicOn ? 'تعمل' : 'متوقفة');
    $('btnSfx').setAttribute('aria-pressed', String(audio.sfxOn)); $('btnSfx').textContent = 'المؤثرات: ' + (audio.sfxOn ? 'تعمل' : 'متوقفة');
    $('btnSound').classList.toggle('off', !audio.sfxOn); $('btnSound').setAttribute('aria-pressed', String(audio.sfxOn)); $('btnSound').setAttribute('aria-label', audio.sfxOn ? 'كتم الصوت' : 'تشغيل الصوت');
  }
  function savePrefs() { U.store.set('ts-prefs', { sfx: audio.sfxOn, music: audio.musicOn, simple: S.simple, name: S.student }); }
  function enterMenu() {
    timers.clear(); clearArrows(); fx.clear();
    ['hud', 'hint', 'question', 'feedback', 'summary', 'pause', 'intro', 'waiting', 'drawMeter'].forEach(id => show(id, false));
    archer.standDown();
    camRig.mode = 'menu';
    phase('menu'); show('menu', true); menuUI();
    if (audio.started) audio.music('menu');
  }

  // ------------------------------------------------------------------ game flow
  function questionList() {
    let qs = (cfg.questions || C.DEMO_QUESTIONS).slice();
    if (cfg.order === 'random') qs = U.shuffle(qs);
    if (cfg.questionCount > 0) qs = qs.slice(0, cfg.questionCount);
    return qs;
  }
  async function startGame() {
    if (!S.loaded || !S.configured) return;
    camRig.mode = 'play';
    unlock();
    Object.assign(S, { round: 0, points: 0, correct: 0, pending: 0, shots: 0, hits: 0 });
    if (!embedded) { S.questions = questionList(); S.total = S.questions.length; }
    show('menu', false);
    camRig.mode = 'play';
    await setMode(S.mode, { fade: !mode || mode.key !== S.mode || mode.diffKey !== S.difficulty });
    if (audio.started) audio.music('play');
    show('hud', true);
    startRound();
  }
  function startRound() {
    timers.clear(); clearArrows();
    S.roundPoints = 0; S.roundShots = 0; S.roundHits = 0; S.arrowsLeft = guided ? 1 : cfg.arrowsPerQuestion; S.endTimer = -1;
    S.guidedDecision = null; S.drawing = false;
    S.result = null; S.resultUsed = false; S.nextSent = false; S.outcomeSent = false;
    S.roundTimer = cfg.timeLimit;
    mode.rng = U.rng(101 + S.round * 7);
    mode.startRound(S.round);
    TS.World.linearize(mode.group);
    archer.standDown();
    ['question', 'feedback', 'waiting', 'summary'].forEach(id => show(id, false));
    const m = C.MODES[S.mode];
    $('introSmall').textContent = 'السؤال ' + D(S.round + 1) + ' من ' + D(S.total);
    $('introTitle').textContent = m.title;
    $('introText').textContent = guided ? 'سهم واحد وسؤال واحد — الإجابة الصحيحة تُصيب الهدف' : D(cfg.arrowsPerQuestion) + ' أسهم في هذه الجولة' + (cfg.timeLimit ? ' · ' + D(cfg.timeLimit) + ' ثانية' : '');
    show('intro', true); phase('intro'); hud();
    timers.later(() => {
      show('intro', false); show('hint', true);
      if (guided) {
        phase('preparing');
        const t = mode.targets[0];
        if (t) { aim.lookAtPoint(t.pos); aim.snap(); }
        hint('الرامي يشد القوس… ثم أجب عن السؤال');
        S.drawing = true; archer.draw(); audio.play('draw');
      } else {
        phase('shooting');
        hint(mode.hint ? mode.hint : S.simple ? 'المس الهدف لتصوّب وتطلق تلقائيًا' : 'حرّك المؤشر للتصويب · اضغط مطولًا لشد القوس · اترك للإطلاق');
      }
      hud();
    }, guided ? 700 : 1500);
  }
  function scheduleRoundEnd(delay) { if (S.phase !== 'shooting' || S.endTimer >= 0) return; S.endTimer = delay; }
  function endRound() {
    if (S.phase !== 'shooting') return;
    phase('roundEnd'); show('hint', false); show('drawMeter', false);
    archer.standDown(); mode.calmDown && mode.calmDown();
    const m = C.MODES[S.mode];
    $('introSmall').textContent = 'انتهت الجولة';
    $('introTitle').textContent = S.roundHits ? 'إصابات: ' + D(S.roundHits) + ' · ' + D(S.roundPoints) + ' نقطة' : 'لم تُصب ' + m.targets + ' هذه المرة';
    $('introText').textContent = 'الآن سؤال تعليمي — الإجابة الصحيحة تثبّت نقاط الجولة.';
    show('intro', true);
    timers.later(() => { show('intro', false); openQuestion(); }, 1700);
  }
  function openQuestion() {
    phase('question'); hud();
    if (embedded) { show('waiting', true); post('question'); return; }
    const q = S.questions[S.round];
    show('question', true);
    TS.Questions.ask({ root: $('question') }, q, { index: S.round, total: S.total, attempts: cfg.attempts, shuffle: cfg.shuffleOptions, feedback: cfg.feedback })
      .then(r => { if (S.phase !== 'question') return; show('question', false); resolve({ correct: r.correct, pending: r.pending, feedback: '', retried: r.attempts > 1, explanation: q.explanation }); });
  }
  function resolve(r) {
    if (S.resultUsed || S.phase !== 'question') return;
    S.resultUsed = true; S.result = r;
    if (guided) {
      // The host is authoritative: do not release a shot until its server result arrives.
      show('waiting', false); show('hint', false); show('drawMeter', false);
      S.drawing = false; phase('flight');
      if (r.pending) {
        // Awaiting the teacher's grade is neither a hit nor a miss.
        archer.standDown();
        timers.later(() => finalizeResult(r), 850);
      } else {
        S.guidedDecision = r.correct === true ? 'hit' : 'miss';
        archer.loose();
        timers.later(() => finalizeResult(r), 1450);
      }
      return;
    }
    finalizeResult(r);
  }
  function finalizeResult(r) {
    show('waiting', false);
    let earned = 0, outcome = 'wrong';
    if (r.pending) { outcome = 'pending'; S.pending++; }
    else if (r.correct) { outcome = 'correct'; S.correct++; earned = S.roundPoints + (r.retried ? Math.round(cfg.pointsCorrect / 2) : cfg.pointsCorrect); }
    S.points += earned;
    phase('feedback');
    const icon = $('fbIcon'); icon.className = 'fb-icon ' + (outcome === 'correct' ? 'ok' : outcome === 'pending' ? 'wait' : 'no');
    icon.textContent = outcome === 'correct' ? '✓' : outcome === 'pending' ? '…' : '!';
    $('fbSmall').textContent = 'السؤال ' + D(S.round + 1) + ' من ' + D(S.total);
    $('fbTitle').textContent = outcome === 'correct' ? 'إجابة صحيحة — أحسنت!' : outcome === 'pending' ? 'أُرسلت إجابتك للمعلم' : 'إجابة غير صحيحة';
    const fbText = typeof r.feedback === 'string' && r.feedback.trim() ? r.feedback.trim().slice(0, 300) : '';
    $('fbText').textContent = outcome === 'correct' ? (guided ? 'أصاب السهم الهدف! ' : 'ثبّتنا نقاط الجولة وأضفنا مكافأة الإجابة. ') + (cfg.feedback === 'explain' && r.explanation ? r.explanation : fbText)
      : outcome === 'pending' ? 'سيراجع المعلم إجابتك المكتوبة، ولا تُحتسب كخطأ. تابع التحدي.'
      : (guided ? 'ابتعد السهم عن الهدف. ' : 'لا بأس، راجع الفكرة جيدًا. لم تُثبَّت نقاط هذه الجولة. ') + (cfg.feedback === 'explain' && r.explanation ? r.explanation : fbText);
    $('fbRound').textContent = D(earned); $('fbTotal').textContent = D(S.points);
    $('fbSave').textContent = '';
    const last = S.round + 1 >= S.total;
    $('btnNext').textContent = last ? 'عرض النتيجة النهائية' : 'الجولة التالية ←';
    $('btnNext').disabled = false;
    show('feedback', true); timers.later(() => $('btnNext').focus(), 50);
    if (outcome === 'correct') { audio.play('correct'); celebrate(); } else if (outcome === 'pending') audio.play('neutral'); else audio.play('wrong');
    hud();
    post('outcome', { outcome, earned, hits: S.roundHits });
    S.outcomeSent = true;
  }
  function celebrate() {
    if (cfg.celebration === 'low') return;
    const n = cfg.celebration === 'high' ? 140 : 70;
    const h = archer.headPos(v1).clone(); h.y += 0.6;
    fx.burst('confetti', h, { count: n, colors: [0x8A1538, 0xffffff, 0xf2c14e, 0x1f7bd8], speed: 4.5, size: 0.045, life: 2.2, gravity: 2.2, drag: 1.6, dir: v2.set(0, 1, 0), cone: 1.1, spin: 10 });
    audio.play('cheer', { level: cfg.celebration === 'high' ? 1.4 : 1 });
    document.body.classList.add('celebrate'); timers.later(() => document.body.classList.remove('celebrate'), 1300);
  }
  function next() {
    if (S.phase !== 'feedback') return;
    audio.play('click');
    if (embedded) {
      if (S.round + 1 >= S.total) { finish(); return; }           // last round: in-game results first, then save
      if (S.nextSent) return; S.nextSent = true; $('btnNext').disabled = true;
      $('fbSave').textContent = S.round + 1 >= S.total ? 'جارٍ حفظ النتيجة في المنصة…' : 'جارٍ الانتقال…';
      post('next');
      return;
    }
    if (S.round + 1 >= S.total) finish(); else { S.round++; startRound(); }
  }
  function finish() {
    timers.clear(); show('feedback', false); show('hud', false); show('hint', false);
    archer.standDown(); mode.calmDown && mode.calmDown();
    phase('summary'); camRig.mode = 'menu';
    $('sumSchool').textContent = cfg.school;
    $('sumTitle').textContent = C.GAME_NAME;
    $('sumMode').textContent = 'التحدي: ' + C.MODES[S.mode].title + ' · المستوى: ' + diffOf().title + (S.title || cfg.lesson ? ' · ' + (S.title || cfg.lesson) : '');
    $('sumStudent').textContent = S.student || '—'; show('sumStudentRow', !!S.student);
    $('sumCorrect').textContent = D(S.correct) + ' / ' + D(S.total);
    $('sumPending').textContent = D(S.pending);
    $('sumPoints').textContent = D(S.points);
    $('sumAccuracy').textContent = D(S.shots ? Math.round(100 * S.hits / S.shots) : 0) + '٪';
    $('sumNote').textContent = embedded ? 'تُحسب الدرجة التعليمية الرسمية في المنصة من إجاباتك. اضغط الزر لحفظ النتيجة.' : 'نتيجة تدريب محلية على هذا الجهاز.';
    show('btnSubmit', embedded); show('btnAgain', !embedded); show('btnMenu', !embedded);
    show('summary', true);
    audio.play('complete'); if (audio.started) audio.music('victory');
    if (cfg.celebration !== 'low') { const p = archer.headPos(v1).clone(); p.y += 1; fx.burst('confetti', p, { count: cfg.celebration === 'high' ? 220 : 120, colors: [0x8A1538, 0xffffff, 0xf2c14e], speed: 5, size: 0.05, life: 2.6, gravity: 2, drag: 1.4, dir: v2.set(0, 1, 0), cone: 1.2 }); }
    timers.later(() => $(embedded ? 'btnSubmit' : 'btnAgain').focus(), 60);
  }

  // ------------------------------------------------------------------ platform messages
  addEventListener('message', e => {
    if (!embedded || e.origin !== location.origin || e.source !== window.parent) return;
    const b = e.data;
    if (!b || typeof b !== 'object' || typeof b.type !== 'string' || !b.type.startsWith(PREFIX)) return;
    const type = b.type.slice(PREFIX.length);
    if (type === 'config') {
      if (S.configured) return;
      const token = typeof b.token === 'string' ? b.token : '', count = Number(b.count);
      if (token.length < 8 || token.length > 200 || !/^[\w-]+$/.test(token)) return;
      if (!Number.isInteger(count) || count < 1 || count > 100) return;
      S.token = token; S.total = count; S.configured = true;
      S.title = typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 140) : 'مهمة المعلم';
      if (typeof b.student === 'string') S.student = b.student.trim().slice(0, 100);
      const sh = b.shooting && typeof b.shooting === 'object' ? b.shooting : {};
      const next = C.fromPlatform(Object.assign({}, sh, { school: typeof b.school === 'string' ? b.school : sh.school }));
      next.fromPlatform = true; next.lockDifficulty = !!sh.difficulty;
      cfg = Object.assign(next, { questions: null });
      if (guided) Object.assign(cfg, { mode: 'archery', difficulty: 'beginner', arrowsPerQuestion: 1, targetsPerQuestion: 1, speed: 1, size: 1, timeLimit: 0 });
      applyAccent();
      if (cfg.mode !== 'choice') S.mode = cfg.mode;
      S.difficulty = cfg.difficulty; S.simple = guided || S.simple || cfg.controls === 'simple';
      if (aim) aim.assist = C.assistStrength(cfg);           // config may arrive before the 3D assets finish loading
      if (S.phase === 'menu') { buildMenu(); setMode(S.mode); }
      if (S.loaded) { hud(); menuUI(); }
      return;
    }
    if (!S.configured || b.token !== S.token || b.index !== S.round) return;
    if (type === 'result') {
      if (S.phase !== 'question' || S.resultUsed) return;
      resolve({ correct: b.correct === true, pending: b.pending === true, feedback: b.feedback });
    } else if (type === 'advance') {
      if (S.phase !== 'feedback' || !S.nextSent) return;
      if (S.round + 1 >= S.total) return;
      S.round++; startRound();
    } else if (type === 'retry') {
      if (!['feedback', 'summary'].includes(S.phase) || !S.nextSent) return;
      S.nextSent = false; $('btnNext').disabled = false; $('btnSubmit').disabled = false;
      if (S.phase === 'summary') { $('sumNote').textContent = 'تعذر الحفظ لدى المنصة. تحقق من الاتصال ثم اضغط الزر للمحاولة مجددًا.'; $('btnSubmit').focus(); return; }
      $('fbSave').textContent = 'تعذر الحفظ لدى المنصة. تحقق من الاتصال ثم اضغط الزر للمحاولة مجددًا.';
      $('btnNext').focus();
    }
  });

  // ------------------------------------------------------------------ input
  const canShoot = () => S.phase === 'shooting' && !S.paused && S.arrowsLeft > 0 && S.endTimer < 0;
  function aimFromScreen(x, y) {
    if (!mode) return;
    const r = canvas.getBoundingClientRect();
    const nx = ((x - r.left) / r.width) * 2 - 1, ny = -((y - r.top) / r.height) * 2 + 1;
    const n = camRig.neutral; n.aspect = r.width / r.height; n.fov = 64; n.updateProjectionMatrix(); camRig.updateNeutral(); n.updateMatrixWorld(true);
    const ray = new T.Raycaster(); ray.setFromCamera({ x: nx, y: ny }, n);
    // first hit along the camera ray -> aim at that point from the archer's aim origin
    const d = mode.rayHit(ray.ray.origin, ray.ray.direction);
    const p = v1.copy(ray.ray.origin).addScaledVector(ray.ray.direction, Math.min(d, 120));
    aim.lookAtPoint(p);
  }
  let pointerId = null, simpleTimer = 0;
  canvas.addEventListener('pointermove', e => { if (S.phase === 'shooting' && !S.paused && (e.pointerType === 'mouse' || pointerId === e.pointerId)) aimFromScreen(e.clientX, e.clientY); });
  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0 || !canShoot()) return;
    canvas.focus({ preventScroll: true });
    pointerId = e.pointerId; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    aimFromScreen(e.clientX, e.clientY);
    if (S.simple) { autoShot(); return; }
    S.drawing = true; archer.draw(); audio.play('draw');
  });
  const up = e => {
    if (pointerId !== null && e.pointerId !== pointerId) return;
    pointerId = null;
    if (S.simple) return;
    if (S.drawing) { S.drawing = false; looseWithHint(); }
  };
  function looseWithHint() {
    const before = archer.state, draw = archer.drawAmount();
    archer.loose();
    if (['TARGET_ACQUIRE', 'RAISE_BOW'].includes(before) || (before === 'DRAW_BOW' && draw < 0.35)) toast('استمر بالضغط حتى يكتمل شدّ القوس، ثم اترك للإطلاق.', 2200);
  }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  function autoShot() {
    // simple mode: aim assist toward the touched target (with lead), draw, short hold, release
    const savedAssist = aim.assist; aim.assist = Math.max(aim.assist, 0.85);
    S.drawing = true; archer.draw(); audio.play('draw');
    clearTimeout(simpleTimer);
    const wait = () => {
      if (!S.drawing) return;
      if (archer.state === 'AIM_HOLD') {
        // hold briefly; if the challenge releases its targets on readiness (clay "pull"), wait for one to appear
        const t0 = performance.now();
        const fire = () => { if (!S.drawing) return; if (mode.aimTargets().length || performance.now() - t0 > 3200) { simpleTimer = setTimeout(() => { S.drawing = false; archer.loose(); aim.assist = savedAssist; }, mode.aimTargets().length && mode.hint ? 650 : 280); } else simpleTimer = setTimeout(fire, 80); };
        fire(); return;
      }
      if (!['TARGET_ACQUIRE', 'RAISE_BOW', 'DRAW_BOW', 'RECOVER', 'IDLE', 'FOLLOW_THROUGH'].includes(archer.state)) { S.drawing = false; aim.assist = savedAssist; return; }
      simpleTimer = setTimeout(wait, 60);
    };
    wait();
  }
  const keys = new Set();
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target, onScene = t === document.body || t === canvas;
    if (e.key === 'Escape') { if (!$('help').hidden) { show('help', false); return; } if (S.phase === 'shooting' || S.paused) { togglePause(); e.preventDefault(); } return; }
    if (!onScene) return;
    if ((e.code === 'Space' || e.key === 'Enter') && canShoot() && !e.repeat) { e.preventDefault(); if (S.simple) { autoShot(); return; } S.drawing = true; archer.draw(); audio.play('draw'); }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { keys.add(e.code); e.preventDefault(); }
  });
  document.addEventListener('keyup', e => {
    keys.delete(e.code);
    if ((e.code === 'Space' || e.key === 'Enter') && S.drawing && !S.simple) { S.drawing = false; looseWithHint(); }
  });
  function keyAim(dt) {
    if (!keys.size || S.phase !== 'shooting') return;
    const k = 0.55 * dt;
    // RTL screen: right arrow aims right on screen
    const yaw = (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0);
    const pitch = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
    aim.nudge(yaw * k, pitch * k * 0.7, (o, d) => mode.rayHit(o, d));
  }

  // buttons
  $('btnStart').onclick = startGame;
  $('btnNext').onclick = next;
  $('btnReopen').onclick = () => { if (S.phase === 'question' && !S.resultUsed) post('question'); };
  $('btnSubmit').onclick = () => {
    if (!embedded || S.phase !== 'summary' || S.nextSent || !S.outcomeSent) return;
    S.nextSent = true; $('btnSubmit').disabled = true; $('sumNote').textContent = 'جارٍ حفظ النتيجة في المنصة…';
    post('next');
  };
  $('btnAgain').onclick = () => { show('summary', false); startGame(); };
  $('btnMenu').onclick = () => { show('summary', false); if (embedded) { startGame(); return; } enterMenu(); };
  $('btnHelp').onclick = () => { $('optSimple').checked = S.simple; show('help', true); $('btnHelpClose').focus(); };
  $('btnHelpClose').onclick = () => { S.simple = $('optSimple').checked || cfg.controls === 'simple'; savePrefs(); show('help', false); };
  $('btnMusic').onclick = () => { unlock(); audio.setMusic(!audio.musicOn); if (audio.musicOn && audio.started) audio.music(S.phase === 'menu' ? 'menu' : 'play'); savePrefs(); soundUI(); };
  $('btnSfx').onclick = $('btnSound').onclick = () => { unlock(); audio.setSfx(!audio.sfxOn); savePrefs(); soundUI(); };
  $('btnPause').onclick = togglePause;
  $('btnResume').onclick = togglePause;
  $('btnQuit').onclick = () => { S.paused = false; show('pause', false); if (embedded) { togglePause(); return; } enterMenu(); };
  $('btnTeacher').onclick = () => TS.Teacher && TS.Teacher.open({ cfg, apply: applyTeacherConfig, root: $('teacher'), store: STORE_KEY });
  $('btnFull').onclick = async () => {
    if (embedded) { post('fullscreen'); return; }
    const el = document.documentElement, doc = document;
    try { if (doc.fullscreenElement || doc.webkitFullscreenElement) await (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc); else if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); else throw 0; }
    catch (err) { toast('ملء الشاشة غير متاح هنا. دوّر الجهاز أفقيًا لأفضل عرض.'); }
  };
  document.addEventListener('fullscreenchange', () => timers.later(() => world && world.resize(), 80));
  function togglePause() {
    if (!(S.phase === 'shooting' || S.paused)) return;
    S.paused = !S.paused;
    show('pause', S.paused);
    if (S.paused) { S.drawing = false; archer.standDown(); audio.suspend(); $('btnResume').focus(); } else { audio.resume(); prev = 0; }
  }
  function applyTeacherConfig(next) {
    cfg = C.sanitize(next); U.store.set(STORE_KEY, cfg); applyAccent();
    S.difficulty = cfg.difficulty; if (cfg.mode !== 'choice') S.mode = cfg.mode;
    S.simple = !!prefs.simple || cfg.controls === 'simple';
    aim.assist = C.assistStrength(cfg);
    audio.setSfx(cfg.sound); audio.setMusic(cfg.music);
    S.questions = questionList(); S.total = S.questions.length;
    if (mode) { mode.diffKey = '__'; }
    buildMenu(); setMode(S.mode); hud(); menuUI();
  }

  // standalone lifecycle hooks for js/platform-nav.js
  if (!embedded) {
    window.ManaratGameControls = {
      isActive: () => !['loading', 'menu', 'summary'].includes(S.phase),
      canRestart: () => S.loaded,
      isBusy: () => false,
      restart: async () => { show('summary', false); startGame(); },
      end: async () => { if (S.phase === 'loading') return; finish(); }
    };
  }

  // ------------------------------------------------------------------ reticle / meter
  const ret = $('reticle'), retDraw = ret.querySelector('.r-draw'), retOuter = ret.querySelector('.r-outer');
  function reticle() {
    const on = S.phase === 'shooting' && !S.paused;
    ret.classList.toggle('on', on);
    if (!on) return;
    const s = project(aim.point);
    if (!s) return;
    ret.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
    const draw = archer.drawAmount();
    retDraw.style.strokeDasharray = (draw * 100).toFixed(1) + ' 100';
    retOuter.style.transform = 'scale(' + (1 - 0.28 * draw).toFixed(3) + ')';
    ret.classList.toggle('full', archer.state === 'AIM_HOLD');
    ret.classList.toggle('assist', (aim.assisted || 0) > 0.15);
    const meter = $('drawMeter'); meter.hidden = !(S.drawing || draw > 0.02); meter.firstElementChild.style.width = (draw * 100).toFixed(0) + '%';
  }

  // ------------------------------------------------------------------ loop
  let raf = 0, prev = 0, stopped = false, acc = 0, clock = 0;
  const gov = { samples: [], ratio: 1, shadows: true };
  function tick(now) {
    if (stopped) return;
    const raw = document.hidden ? 0 : (now - (prev || now)) / 1000; prev = now;
    const dt = Math.min(0.05, raw);
    frame(dt);
    if (raw > 0 && !MANUAL) governor(Math.min(raw, 1));
    raf = requestAnimationFrame(tick);
  }
  function frame(dt, render = true) {
    if (!S.loaded) return;
    clock += dt;
    const live = S.paused ? 0 : dt;
    keyAim(live);
    // simulation: fixed sub-steps (physics + targets)
    if (live > 0) { acc += live; let n = 0; while (acc >= PH.STEP && n < 40) { simStep(PH.STEP); acc -= PH.STEP; n++; } }
    // aim (smoothed) -> archer
    if (live > 0) aim.update(live, mode && S.phase === 'shooting' ? mode.aimTargets() : null);
    archer.setAim(aim.launch, aim.point);
    archer.update(live);
    if (guided && S.phase === 'preparing' && archer.state === 'AIM_HOLD') {
      // The bow stays fully drawn while the school shows its centered question.
      phase('question'); show('hint', false); show('waiting', true); post('question');
    }
    // round end bookkeeping
    if (S.phase === 'shooting' && live > 0) {
      if (cfg.timeLimit > 0 && S.endTimer < 0) { S.roundTimer -= live; $('hudTimer').textContent = D(Math.max(0, Math.ceil(S.roundTimer))); if (S.roundTimer <= 0) { toast('انتهى وقت الجولة'); scheduleRoundEnd(0.4); } }
      if (S.arrowsLeft <= 0 && !arrows.flights.length && !S.drawing && ['IDLE', 'RECOVER', 'FOLLOW_THROUGH'].includes(archer.state)) scheduleRoundEnd(0.9);
      if (S.endTimer >= 0) { S.endTimer -= live; if (S.endTimer < 0) endRound(); }
    }
    // arrows in flight follow their simulation
    for (const f of arrows.flights) orientArrow(f.mesh, f.flight.p, f.flight.v);
    for (const s of arrows.stuck) { s.t += live; }
    camRig.update(dt, S.phase === 'shooting' ? { yaw: aim.yaw.x, pitch: aim.pitch.x } : { yaw: 0, pitch: 0 }, S.phase === 'shooting' ? archer.drawAmount() : 0);
    if (diag) diag.sampleCamera(world.camera, dt);
    world.update(live, clock);
    fx.update(live, world.camera);
    if (S.phase === 'shooting' && live > 0 && (Math.floor(clock * 4) !== Math.floor((clock - live) * 4))) hud();
    if (render) { reticle(); world.render(); }
  }
  function governor(dt) {
    if (!['shooting', 'menu'].includes(S.phase)) { gov.samples.length = 0; return; }
    gov.samples.push(dt);
    if (gov.samples.length < 30) return;
    const avg = gov.samples.reduce((a, b) => a + b, 0) / gov.samples.length; gov.samples.length = 0;
    if (1 / avg < 28 && gov.ratio > 0.7) { gov.ratio = Math.max(0.7, gov.ratio * 0.85); world.setPixelRatio(Math.min(devicePixelRatio || 1, world.tier.maxDpr) * gov.ratio); }
    else if (1 / avg < 22 && gov.shadows) { gov.shadows = false; world.setShadows(false); }
  }
  addEventListener('resize', () => world && world.resize());
  document.addEventListener('visibilitychange', () => { prev = 0; if (document.hidden) audio.suspend(); else if (!S.paused) audio.resume(); });
  function teardown() { if (stopped) return; stopped = true; cancelAnimationFrame(raf); timers.clear(); audio.close(); try { mode && mode.dispose(); world && world.dispose(); } catch (e) { } }
  addEventListener('pagehide', teardown);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stopped = true; cancelAnimationFrame(raf); audio.stopAll(); fail('توقف عرض الرسوم ثلاثية الأبعاد (فقد سياق WebGL). اضغط «إعادة المحاولة».'); });
  function fail(text) { show('loading', false); $('errorText').textContent = text; show('error', true); phase('error'); }
  $('btnErrorRetry').onclick = () => location.reload();
  $('btnLoadRetry').onclick = () => location.reload();

  // ------------------------------------------------------------------ QA hooks (no answers, no secrets)
  function qaApi() {
    return {
      get state() { return { phase: S.phase, round: S.round, total: S.total, points: S.points, roundPoints: S.roundPoints, arrowsLeft: S.arrowsLeft, shots: S.shots, hits: S.hits, mode: S.mode, difficulty: S.difficulty, archer: archer.state, flights: arrows.flights.length, stuck: arrows.stuck.length, targets: mode ? mode.remaining() : 0, correct: S.correct, pending: S.pending, guided }; },
      start(m, d) { if (m) S.mode = m; if (d) S.difficulty = d; return startGame(); },
      setMode: (m) => { S.mode = m; return setMode(m, { fade: false }); },
      // snap = true jumps the smoothed aim (test convenience); snap = false moves it like real input (springs)
      aimAt(x, y, z, snap = true) { aim.lookAtPoint(new T.Vector3(x, y, z)); if (snap) aim.snap(); },
      aimAtTarget(i = 0, lead = true, snap = true) { const t = mode.targets.filter(t => t.alive !== false)[i]; if (!t) return false; const p = lead ? aim.leadPoint({ pos: t.pos, vel: t.vel, acc: t.acc, predict: t.predict }, new T.Vector3()) : t.pos.clone(); aim.lookAtPoint(p); if (snap) aim.snap(); return p.toArray(); },
      draw() { S.drawing = true; archer.draw(); }, loose() { S.drawing = false; archer.loose(); },
      setAssist(v) { const old = aim.assist; aim.assist = v; return old; },
      step(n = 1, dt = 1 / 60, render = true) { for (let i = 0; i < n; i++) frame(dt, render && i === n - 1); },
      render() { frame(0, true); },
      answer(correct, pending) { if (S.phase === 'question' && !embedded) { show('question', false); resolve({ correct: !!correct, pending: !!pending }); } },
      next, finish, endRound: () => { if (S.phase === 'shooting') S.endTimer = 0; },
      aim: () => ({ point: aim.point.toArray(), launch: aim.launch.toArray(), yaw: aim.yaw.x, pitch: aim.pitch.x, range: aim.range.x }),
      impacts: () => arrows.stuck.map(s => s.mesh.getWorldPosition(new T.Vector3()).toArray()),
      diag: () => diag ? diag.report() : null, resetDiag: () => diag && diag.reset(),
      targets: () => mode.targets.map(t => ({ id: t.id, alive: t.alive !== false, pos: t.pos.toArray(), vel: t.vel ? t.vel.toArray() : null, r: t.r })),
      world: () => world, archer: () => archer, mode: () => mode, cfg: () => cfg, fx: () => fx, project
    };
  }

  // ------------------------------------------------------------------ boot
  applyAccent();
  if (embedded) post('ready');
  const slow = setTimeout(() => { $('loadText').textContent = 'التحميل يستغرق وقتًا أطول من المعتاد…'; show('btnLoadRetry', true); }, 25000);
  (async () => {
    try {
      if (!window.WebGLRenderingContext) throw new Error('webgl');
      const q = TS.World.detectQuality(params.get('quality'));
      world = TS.World.create(canvas, q);
      fx = TS.FX.create(world.scene);
      const setP = p => { $('loadBar').style.width = Math.round(p * 100) + '%'; $('loadMeter').setAttribute('aria-valuenow', String(Math.round(p * 100))); };
      setP(0.1);
      rigFactory = await TS.Rig.load({ anisotropy: world.tier.anisotropy });
      setP(0.65);
      archer = new TS.Archer.Archer(rigFactory, world.scene, { accent: cfg.accent });
      archer.onRelease = onRelease;
      if (QA) { diag = new TS.Diagnostics.Diagnostics(); archer.diag = diag; }
      aim = new TS.Aim.Aim(); aim.assist = C.assistStrength(cfg);
      camRig = new TS.Aim.CameraRig(world.camera);
      setP(0.8);
      mode = buildMode(S.mode); mode.key = S.mode; mode.diffKey = S.difficulty;
      if (!embedded) { S.questions = questionList(); S.total = S.questions.length; }
      setP(1);
      clearTimeout(slow);
      S.loaded = true;
      if (QA) window.__tsQA = qaApi();
      window.TargetShooting = { get phase() { return S.phase; }, get mode() { return S.mode; }, get round() { return S.round; }, get points() { return S.points; } };
      buildMenu();
      show('loading', false); enterMenu();
      if (!MANUAL) raf = requestAnimationFrame(tick); else frame(0);
      document.title = C.GAME_NAME + ' | ' + cfg.school;
    } catch (err) {
      console.error(err);
      clearTimeout(slow);
      fail(err && err.message === 'webgl' ? 'هذا المتصفح لا يدعم الرسوم ثلاثية الأبعاد (WebGL). جرّب متصفحًا حديثًا.' : 'تعذر تحميل ملفات اللعبة. تحقق من وجود جميع الملفات ثم أعد المحاولة.');
    }
  })();
})();