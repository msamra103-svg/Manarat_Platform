/* صيد الأسماك V24 — game flow, school-platform bridge, HUD and input.
 * Platform contract (unchanged from the shared engine it replaces):
 *   game → host : school-fishing-ready | -question | -outcome | -next | -fullscreen   {type, token, index}
 *   host → game : school-fishing-config {token,count,title,images} | -result {token,index,correct,pending,feedback} | -advance | -retry
 * Messages are accepted only from window.parent with the same origin, matching token + index, in the permitted phase.
 * The game never grades real school questions; the host's result alone decides catch / escape / neutral review.
 */
(function (root) {
  'use strict';
  const doc = root.document, $ = id => doc.getElementById(id), embedded = root.parent !== root;
  const params = new URLSearchParams(root.location.search || ''), qa = params.has('qa'), speed = qa ? Math.max(0.25, Math.min(8, Number(params.get('speed')) || 1)) : 1;
  const DEMO = [
    { text: 'كم يساوي حاصل ضرب ٣ × ٤؟', options: ['٧', '١٢', '١٦'], correct: 1, explain: 'الإجابة الصحيحة: ١٢' },
    { text: 'ما الكوكب الذي نعيش عليه؟', options: ['الأرض', 'المريخ', 'زحل'], correct: 0, explain: 'الإجابة الصحيحة: الأرض' },
    { text: 'اكتب جملة قصيرة تصف فيها البحر عند الغروب.', essay: true }
  ];
  function teacherQuestions() { // optional local practice set from the offline teacher page (#q=base64 JSON)
    try { const m = /[#&]q=([^&]+)/.exec(root.location.hash || ''); if (!m) return null; const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1])))); const list = JSON.parse(json); if (!Array.isArray(list) || !list.length) return null;
      return list.slice(0, 30).map(q => q && q.essay ? { text: String(q.text || '').slice(0, 300), essay: true } : { text: String(q.text || '').slice(0, 300), options: (q.options || []).slice(0, 4).map(o => String(o).slice(0, 80)), correct: Math.max(0, Math.min(3, Number(q.correct) || 0)), explain: q.options ? 'الإجابة الصحيحة: ' + String(q.options[Number(q.correct) || 0] || '') : '' }).filter(q => q.text && (q.essay || q.options.length >= 2));
    } catch (e) { return null; }
  }
  const LOCAL = embedded ? null : (teacherQuestions() || DEMO), localKind = embedded ? 'platform' : (LOCAL === DEMO ? 'demo' : 'teacher');

  if (qa) doc.body.dataset.qa = '1';
  const S = { phase: 'loading', round: 0, total: embedded ? 1 : LOCAL.length, catches: 0, misses: 0, pendings: 0, token: '', images: [], configured: !embedded, assetsReady: false, correct: false, pending: false, feedback: '', asked: false, outcomeSent: false, nextSent: false, aim: 'center', power: 0.55, results: [] };
  const sim = new root.FishingSimulation.FishingSim({ seed: 'abu-ubaida-fishing-v24' });
  const audio = root.FishingAudio ? new root.FishingAudio() : { init() {}, event() {}, update() {}, play() {}, suspend() {}, resume() {}, close() {}, set() {}, toggleMute() { return false; }, prefs: { muted: false, music: 0.7, sfx: 0.85, amb: 0.7 } };
  const QA = { paused: false };
  let view = null, frame = 0, previous = 0, lowFps = 0, reduceSteps = 0, contextLost = false;
  const preferredQuality = params.get('quality') || (() => { try { return localStorage.getItem('abu-ubaida-fishing-quality') || 'auto'; } catch (e) { return 'auto'; } })();
  const savedQuality = ['auto', 'low', 'medium', 'high'].includes(preferredQuality) ? preferredQuality : 'auto';

  function post(suffix, extra = {}) { if (embedded) root.parent.postMessage({ type: 'school-fishing-' + suffix, token: S.token, index: S.round, ...extra }, root.location.origin); }
  function phase(p) { S.phase = p; doc.body.dataset.phase = p; }
  function hud() { $('score').textContent = String(S.catches); $('round').textContent = Math.min(S.round + 1, S.total) + ' / ' + S.total; }
  function say(t) { $('instruction').textContent = t; }

  /* ---------- boot ---------- */
  try { view = new root.FishingView.FishingView($('pitch'), { quality: savedQuality, preserve: qa }); }
  catch (e) { $('loadingError').hidden = false; $('welcome').hidden = true; $('errorText').textContent = 'هذا المتصفح لا يدعم الرسوميات ثلاثية الأبعاد (WebGL). جرّب متصفحًا حديثًا أو جهازًا آخر.'; if (embedded) post('ready'); return; }
  $('quality').value = savedQuality; $('modeLabel').textContent = embedded ? 'جارٍ الاتصال بالمنصة…' : localKind === 'teacher' ? 'تدريب محلي من المعلم · لا يُسجّل في تقارير الطلاب' : 'وضع تجريبي · ٣ أسئلة · لا يُسجّل في تقارير الطلاب';
  view.load(p => { $('loadBar').firstElementChild.style.width = Math.round(p * 100) + '%'; }).then(() => { S.assetsReady = true; ready(); }).catch(err => { $('loadingError').hidden = false; $('errorText').textContent = 'تعذّر تحميل نماذج اللعبة: ' + (err && err.message || err); });
  function ready() { if (!S.configured || !S.assetsReady || S.phase !== 'loading') return; phase('welcome'); $('start').disabled = false; $('start').textContent = 'ابدأ الصيد ←'; hud(); }

  /* ---------- flow ---------- */
  function start() {
    if (S.phase !== 'welcome') return; audio.init();
    const q = $('quality').value;
    try { localStorage.setItem('abu-ubaida-fishing-quality', q); } catch (e) { /* ignore */ }
    // Apply the selected preset to this game, including sea geometry, shadows and reflections.
    // Rebuild only before play, so the platform token, questions and simulation stay intact.
    const quality = q === 'auto' ? root.FishingView.autoQuality() : q;
    if (quality !== view.qualityName) {
      phase('loading'); S.assetsReady = false; $('start').disabled = true; $('quality').disabled = true;
      $('start').textContent = 'جارٍ تطبيق جودة الرسوميات…';
      try {
        view.dispose();
        view = new root.FishingView.FishingView($('pitch'), { quality, preserve: qa });
        view.load(p => { $('loadBar').firstElementChild.style.width = Math.round(p * 100) + '%'; }).then(() => {
          previous = 0; lowFps = 0; reduceSteps = 0; S.assetsReady = true;
          $('quality').disabled = false; ready(); start();
        }).catch(showLoadError);
      } catch (e) { showLoadError(e); }
      return;
    }
    view.setReduced($('reduced').checked); $('welcome').hidden = true; $('controls').hidden = false; sim.ready(); toReady();
  }
  function showLoadError() { $('loadingError').hidden = false; $('errorText').textContent = 'تعذّر تطبيق جودة الرسوميات. أعد المحاولة.'; }
  function toReady() { phase('ready'); S.asked = false; S.outcomeSent = false; S.nextSent = false; S.correct = false; S.pending = false; S.feedback = '';
    $('card').hidden = true; $('question').hidden = true; $('next').hidden = true; $('next').disabled = false; $('reopen').hidden = true; $('reel').hidden = true; $('cast').hidden = false; $('cast').disabled = sim.phase !== 'ready';
    doc.querySelector('.aim').hidden = false; $('power').hidden = false; hud(); }
  let charge = null;
  function castDown(e) { if (S.phase !== 'ready' || sim.phase !== 'ready') return; audio.init(); charge = { t0: performance.now(), p: S.power }; if (e) e.preventDefault(); }
  function castUp() { if (!charge) return; const held = performance.now() - charge.t0; const power = held < 180 ? S.power : charge.p; charge = null; cast(power); }
  function cast(power = S.power) {
    if (S.phase !== 'ready' || sim.phase !== 'ready') return false;
    sim.setAim(S.aim === 'custom' ? null : S.aim, S.aim === 'custom' ? null : power); if (!sim.startCast()) return false;
    phase('casting'); $('cast').hidden = true; doc.querySelector('.aim').hidden = true; $('power').hidden = true; say('ارتفعت السنارة… راقب العوّامة'); return true;
  }
  function ask() {
    if (S.phase !== 'casting') return; phase('question'); say('السمكة تمسك الطُّعم! أجب عن السؤال لتقرّر نتيجة الصيد');
    if (embedded) { if (!S.asked) { S.asked = true; post('question'); } $('reopen').hidden = false; return; }
    const q = LOCAL[S.round]; $('questionTag').textContent = localKind === 'teacher' ? 'سؤال تدريبي من المعلم' : 'سؤال تجريبي'; $('questionText').textContent = q.text;
    if (q.essay) { $('choices').replaceChildren(); $('essay').hidden = false; $('essayText').value = ''; $('essaySend').onclick = () => resolve({ correct: false, pending: true, feedback: 'إجابة مقالية تجريبية: في المنصة يراجعها المعلم قبل احتسابها.' }); }
    else { $('essay').hidden = true; $('choices').replaceChildren(...q.options.map((text, i) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = () => resolve({ correct: i === q.correct, pending: false, feedback: i === q.correct ? 'أحسنت! إجابة صحيحة.' : q.explain }); return b; })); }
    $('question').hidden = false; const first = $('choices').querySelector('button') || $('essayText'); if (first && first.focus) first.focus();
  }
  function resolve(b) {
    if (S.phase !== 'question') return false;
    S.correct = b.correct === true && b.pending !== true; S.pending = b.pending === true; S.feedback = String(b.feedback || '').slice(0, 600);
    $('question').hidden = true; $('reopen').hidden = true; phase('resolve'); S.catchBase = sim.catchCount; S.landedThisRound = false;
    sim.resolve({ correct: S.correct, pending: S.pending });
    if (S.correct) { $('reel').hidden = false; say('اصطدت السمكة! اضغط مطوّلًا على «لفّ البكرة» (أو المسافة) لتسريع السحب'); }
    else if (S.pending) say('أُرسلت إجابتك للمراجعة… السمكة تبتعد بهدوء');
    else say('السمكة تقاوم الخطاف…');
    return true;
  }
  function outcome() {
    if (S.phase !== 'resolve') return; phase('outcome'); $('reel').hidden = true; sim.reelInput = false; $('reel').classList.remove('active');
    if (S.correct) { if (!S.landedThisRound && sim.catchCount > S.catchBase) { S.catches++; } } else if (S.pending) S.pendings++; else S.misses++;
    S.results.push(S.correct ? 'catch' : S.pending ? 'pending' : 'escape'); hud();
    const c = $('card'); c.classList.remove('success', 'miss', 'pending'); c.classList.add(S.correct ? 'success' : S.pending ? 'pending' : 'miss');
    $('cardLabel').textContent = S.pending ? 'في انتظار تصحيح المعلم' : S.correct ? 'أحسنت، إجابة صحيحة' : 'تعلّم وجرّب من جديد';
    $('cardTitle').textContent = S.pending ? 'إجابة قيد المراجعة' : S.correct ? 'صيد ناجح!' : 'أفلتت السمكة';
    const fish = S.correct ? sim.catches[sim.catches.length - 1] : null; $('fishInfo').hidden = !fish;
    if (fish) { $('fishName').textContent = fish.ar; $('fishSci').textContent = fish.en + ' · ' + fish.sci; $('fishLength').textContent = Math.round(fish.length * 100) + ' سم'; $('fishWeight').textContent = fish.weight.toFixed(2) + ' كغ'; addLog(fish); }
    $('cardText').textContent = (S.pending ? 'لا تُحتسب صيدًا ولا خطأً حتى يقرّر المعلم. ' : '') + S.feedback;
    c.hidden = false; const last = S.round + 1 >= S.total;
    $('next').hidden = false; $('next').disabled = false; $('next').textContent = last ? 'عرض النتيجة ←' : 'الرمية التالية ←'; if ($('next').focus) $('next').focus();
    say(last ? 'انتهت الأسئلة' : 'استعد للرمية التالية');
    if (last) audio.play('victory', { gain: 0.8, music: true, delay: 2.2 });
    if (!S.outcomeSent) { S.outcomeSent = true; post('outcome'); }
  }
  function addLog(f) { const s = doc.createElement('span'); s.textContent = '🎣 ' + f.ar + ' · ' + Math.round(f.length * 100) + ' سم'; $('catchLog').appendChild(s); }
  function next() {
    if (S.phase !== 'outcome') return;
    if (embedded) { if (S.nextSent) return; S.nextSent = true; $('next').disabled = true; post('next'); return; }
    S.round++; if (S.round >= S.total) finish(); else retrieve();
  }
  function retrieve() { $('card').hidden = true; $('next').hidden = true; phase('retrieving'); hud(); sim.nextCast(); say('لفّ الخيط وجهّز الطُّعم للرمية التالية…'); }
  function finish() {
    phase('finished'); const c = $('card'); c.classList.remove('miss', 'pending'); c.classList.add('success'); $('fishInfo').hidden = true;
    $('cardLabel').textContent = localKind === 'teacher' ? 'تدريب محلي · لا يُسجّل' : 'وضع تجريبي · لا يُسجّل'; $('cardTitle').textContent = 'اكتملت رحلة الصيد';
    $('cardText').textContent = `صيد ناجح: ${S.catches} من ${S.total}` + (S.pendings ? ` · قيد المراجعة: ${S.pendings}` : '') + (S.misses ? ` · أفلتت: ${S.misses}` : '');
    c.hidden = false; $('next').hidden = false; $('next').textContent = 'العب مرة أخرى ↻'; say('أحسنت! يمكنك تكرار الرحلة');
  }
  function replay() { if (S.phase !== 'finished') return; S.round = 0; S.catches = 0; S.misses = 0; S.pendings = 0; S.results = []; $('catchLog').replaceChildren(); retrieve(); }

  /* ---------- sim events → flow / audio / effects ---------- */
  function events() {
    const list = sim.drain(); if (!list.length) return; view.handleEvents(list);
    for (const e of list) {
      if (e.type === 'celebrate') e.final = false; audio.event(e, sim);
      if (e.type === 'question') ask();
      if (e.type === 'landed' && S.phase === 'resolve' && !S.landedThisRound) { S.landedThisRound = true; S.catches++; hud(); }
      if (e.type === 'done') outcome();
    }
  }
  function syncUi() {
    if (S.phase === 'retrieving' && sim.phase === 'ready') toReady();
    if (S.phase === 'ready') $('cast').disabled = sim.phase !== 'ready';
    if (S.phase === 'resolve' && !$('reel').hidden && !['hookset', 'fight'].includes(sim.phase)) { $('reel').hidden = true; reelOn(false); }
    const fight = ['hookset', 'fight', 'surface'].includes(sim.phase); $('gauges').hidden = !fight;
    if (fight) { const t = Math.max(0, Math.min(1, sim.tension / 1.2)); $('tensionFill').style.height = Math.round(t * 100) + '%'; const z = sim.fight ? sim.fight.zone : 'green'; $('tensionText').textContent = z === 'red' ? 'خطر!' : z === 'low' ? 'رخو' : 'مثالي'; const L = sim.fight ? sim.fight.L : sim.rope.mainLength; $('lineFill').style.height = Math.round(Math.min(1, L / 14) * 100) + '%'; $('lineText').textContent = L.toFixed(1) + ' م'; }
    const tips = { settle: 'استقرّت العوّامة… الأسماك تقترب', approach: 'سمكة تقترب من الطُّعم', inspect: 'السمكة تتفحّص الطُّعم بحذر', nibble: 'نقرة! العوّامة تهتز', bite: 'العوّامة تغطس!', fight: 'السمكة تقاوم — ثبّت السنارة ولفّ البكرة', surface: 'السمكة على السطح!', net: 'الصياد يلتقط السمكة بالشبكة', onboard: 'السمكة في صندوق الثلج', rebait: 'الصياد يضع طُعمًا جديدًا' };
    if (tips[sim.phase] && ['casting', 'resolve', 'retrieving'].includes(S.phase) && $('instruction').dataset.tip !== sim.phase) { $('instruction').dataset.tip = sim.phase; say(tips[sim.phase]); }
  }

  /* ---------- main loop (fixed-step sim inside; visibility pauses) ---------- */
  function tick(now) {
    frame = root.requestAnimationFrame(tick);
    const dt = doc.hidden || contextLost ? 0 : Math.min((now - (previous || now)) / 1000, 0.1); previous = now;
    if (dt <= 0) return;
    if (S.phase !== 'loading' && !QA.paused) sim.update(dt * speed);
    events(); syncUi();
    try { view.update(sim, dt * speed); } catch (e) { if (!contextLost) throw e; }
    audio.update(sim, view.camera, view.under, dt);
    if (S.phase !== 'loading' && S.phase !== 'welcome' && !QA.paused) { if (view.fps < 28) lowFps += dt; else lowFps = Math.max(0, lowFps - dt); if (lowFps > 4 && reduceSteps < 2) { reduceSteps++; lowFps = 0; view.renderer.setPixelRatio(Math.max(0.6, view.renderer.getPixelRatio() * 0.75)); view.resize(); } }
  }

  /* ---------- platform messages ---------- */
  root.addEventListener('message', e => {
    if (!embedded || e.source !== root.parent || e.origin !== root.location.origin || !e.data || typeof e.data !== 'object') return;
    const b = e.data, prefix = 'school-fishing-';
    if (b.type === prefix + 'config') { if (S.phase !== 'loading' || S.configured) return; S.token = String(b.token || ''); S.total = Math.max(1, Math.min(100, Number(b.count) || 1)); S.images = Array.isArray(b.images) ? b.images.slice(0, 100) : []; $('modeLabel').textContent = String(b.title || 'مهمة المعلم').slice(0, 120); S.configured = true; hud(); ready(); return; }
    if (b.token !== S.token || b.index !== S.round) return;
    if (b.type === prefix + 'result') resolve(b);
    else if (b.type === prefix + 'advance' && S.phase === 'outcome') { S.round++; retrieve(); }
    else if (b.type === prefix + 'retry' && S.phase === 'outcome') { S.nextSent = false; $('next').disabled = false; }
  });

  /* ---------- input ---------- */
  $('start').onclick = start;
  $('cast').addEventListener('pointerdown', castDown); $('cast').addEventListener('pointerup', castUp); $('cast').addEventListener('pointerleave', () => { if (charge) castUp(); });
  $('cast').onclick = e => { if (e.detail === 0) cast(); }; // keyboard activation
  $('next').onclick = () => (S.phase === 'finished' ? replay() : next());
  $('reopen').onclick = () => { if (S.phase === 'question') post('question'); };
  const reelOn = v => { sim.reelInput = !!v && sim.phase === 'fight'; $('reel').classList.toggle('active', sim.reelInput); };
  ['pointerdown'].forEach(k => $('reel').addEventListener(k, e => { e.preventDefault(); reelOn(true); }));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => $('reel').addEventListener(k, () => reelOn(false)));
  doc.querySelectorAll('[data-aim]').forEach(b => { b.onclick = () => setAim(b.dataset.aim); });
  function setAim(a) { if (S.phase !== 'ready') return; S.aim = a; sim.setAim(a, S.power); doc.querySelectorAll('[data-aim]').forEach(n => n.classList.toggle('selected', n.dataset.aim === a)); say({ left: 'الرمي نحو اليسار', center: 'الرمي نحو الوسط', right: 'الرمي نحو اليمين' }[a] + ' · اضغط مطوّلًا على «ارمِ» لزيادة القوة أو المس الماء لتحديد الهدف'); }
  $('pitch').addEventListener('pointerdown', e => {
    if (S.phase === 'resolve' && sim.phase === 'fight') { reelOn(true); return; }
    if (S.phase !== 'ready' || !view.camera || !root.THREE) return;
    const r = $('pitch').getBoundingClientRect(), T = root.THREE, ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), view.camera);
    const hit = new T.Vector3(); if (ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), hit) && sim.setTarget(hit.toArray())) { S.aim = 'custom'; doc.querySelectorAll('[data-aim]').forEach(n => n.classList.remove('selected')); say('حُدّد هدف الرمي على الماء · اضغط «ارمِ السنارة»'); }
  });
  ['pointerup', 'pointercancel'].forEach(k => $('pitch').addEventListener(k, () => reelOn(false)));
  doc.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '')) return;
    if (e.code === 'Space' || e.code === 'Enter') { if (S.phase === 'ready' && e.code === 'Space') { e.preventDefault(); cast(); } else if (sim.phase === 'fight' && e.code === 'Space') { e.preventDefault(); reelOn(true); } }
    else if (e.code === 'ArrowLeft') setAim(S.aim === 'right' ? 'center' : 'left'); else if (e.code === 'ArrowRight') setAim(S.aim === 'left' ? 'center' : 'right');
    else if (e.code === 'KeyC') cycleCamera(); else if (e.code === 'KeyM') toggleMute();
  });
  doc.addEventListener('keyup', e => { if (e.code === 'Space') reelOn(false); });
  function cycleCamera() { const m = view.director.cycle(); $('cameraLabel').textContent = { auto: 'تلقائي', wide: 'واسعة', shoulder: 'الكتف', bobber: 'العوّامة', underwater: 'تحت الماء' }[m]; $('camera').setAttribute('aria-label', view.director.label()); }
  $('camera').onclick = cycleCamera;
  function toggleMute() { const m = audio.toggleMute(); $('mute').checked = m; $('soundLabel').textContent = m ? 'مكتوم' : 'الصوت'; }
  $('sound').onclick = () => { audio.init(); const p = $('soundPanel'); p.hidden = !p.hidden; $('sound').setAttribute('aria-expanded', String(!p.hidden)); };
  $('mute').checked = !!audio.prefs.muted; $('mute').onchange = () => toggleMute();
  [['volMusic', 'music'], ['volSfx', 'sfx'], ['volAmb', 'amb']].forEach(([id, k]) => { $(id).value = audio.prefs[k]; $(id).oninput = () => audio.set(k, Number($(id).value)); });
  $('reduced').onchange = () => view.setReduced($('reduced').checked);
  try { if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) { $('reduced').checked = true; view.setReduced(true); } } catch (e) { /* ignore */ }
  $('fullscreen').onclick = async () => { try { if (embedded) post('fullscreen'); else if (doc.fullscreenElement) await doc.exitFullscreen(); else await $('stadium').requestFullscreen(); } catch (e) { say('دوّر الجهاز أفقيًا للحصول على مشهد أوسع'); } };
  // charging power while the cast button is held
  setInterval(() => { if (charge) { const t = (performance.now() - charge.t0) / 1000; charge.p = 0.15 + 0.85 * (0.5 - 0.5 * Math.cos(t * Math.PI * 0.9)); $('powerFill').style.width = Math.round(charge.p * 100) + '%'; } else if ($('powerFill')) $('powerFill').style.width = Math.round(S.power * 100) + '%'; }, 50);
  doc.addEventListener('visibilitychange', () => { previous = 0; if (doc.hidden) audio.suspend(); else audio.resume(); });
  root.addEventListener('resize', () => view.resize());
  root.addEventListener('pagehide', () => { root.cancelAnimationFrame(frame); audio.close(); try { view.dispose(); } catch (e) { /* ignore */ } });
  $('pitch').addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; audio.suspend(); say('جارٍ استعادة الرسوميات…'); setTimeout(() => { if (contextLost) $('loadingError').hidden = false; }, 5000); });
  $('pitch').addEventListener('webglcontextrestored', () => { contextLost = false; $('loadingError').hidden = true; audio.resume(); view.resize(); });

  /* ---------- QA / integration hooks ---------- */
  root.FishingGame = {
    get phase() { return S.phase; }, get round() { return S.round; }, get catches() { return S.catches; }, get misses() { return S.misses; }, get pendings() { return S.pendings; }, get total() { return S.total; }, get results() { return S.results.slice(); },
    get simPhase() { return sim.phase; }, sim, get view() { return view; }, audio, embedded, localKind,
    snapshot: () => ({ game: S.phase, round: S.round, catches: S.catches, sim: sim.snapshot(), view: view.snapshot(sim), audio: audio.source || 'idle' }),
    qa: qa ? { start, cast, answer: kind => { if (embedded || S.phase !== 'question') return false; const q = LOCAL[S.round]; if (kind === 'pending' || q.essay) return resolve({ correct: false, pending: true, feedback: 'QA pending' }); return resolve({ correct: kind === 'correct', pending: false, feedback: 'QA ' + kind }); }, next, reel: v => reelOn(v), aim: setAim,
      pause: v => { QA.paused = v !== false; },
      step: (sec, fps = 60) => { QA.paused = true; const n = Math.round(sec * fps); for (let i = 0; i < n; i++) { sim.update(1 / fps); events(); syncUi(); if (i % 6 === 5) { view.director.update(sim, 6 / fps); } } view.update(sim, 1 / fps); return sim.phase; },
      until: (pred, max = 60) => { QA.paused = true; for (let i = 0; i < max * 60; i++) { sim.update(1 / 60); events(); syncUi(); if (i % 6 === 5) view.director.update(sim, 0.1); if (pred()) break; } view.update(sim, 1 / 60); return sim.phase; } } : null
  };
  frame = root.requestAnimationFrame(tick); hud();
  if (embedded) post('ready'); else ready();
})(window);
