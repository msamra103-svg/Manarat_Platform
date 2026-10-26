/* Bowling V20 game controller: UI, input, educational flow and the platform message contract.
 *
 * Educational rule (unchanged from V19.4): one throw per question on a fresh ten-pin rack.
 * The shot alone decides the physical pinfall. A correct answer enables the local game points for
 * that pinfall; a wrong answer earns zero game points even if pins fell; a pending (manual review)
 * answer stays neutral and earns nothing before review. The official school grade is computed by
 * the platform, never here. The answer never changes the physics.
 *
 * Contract (same-origin iframe, prefix school-bowling-, outgoing parent.postMessage(payload, location.origin)):
 *   game -> host: ready, question{token,index}, outcome{token,index,outcome,pins,earned}, next{token,index}, fullscreen{token,index}
 *   host -> game: config{title,count,images,token}, result{token,index,correct,pending,feedback},
 *                 advance{token,index(old)}, retry{token,index}
 * Every incoming message is checked for origin, source (=== parent), type, exact token, exact index and phase.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PREFIX = 'school-bowling-';
  const SCHOOL = 'مدرسة أبو عبيدة الإعدادية للبنين';
  const PLATFORM = 'منصة التعلّم التفاعلي والألعاب التعليمية';
  const embedded = window.parent !== window;
  const params = new URLSearchParams(location.search);
  const QA = params.has('qa');
  const MANUAL = QA && params.has('manual');
  const digits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };

  const DEMO = [
    { text: 'كم قارورة تُرتَّب في بداية رمية البولينج؟', options: ['١٠ قوارير', '٨ قوارير', '٦ قوارير', '١٢ قارورة'], correct: 0 },
    { text: 'ما ناتج ٩ × ٦؟', options: ['٤٥', '٥٤', '٦٣', '٥٦'], correct: 1 },
    { text: 'ما عاصمة دولة قطر؟', options: ['الخور', 'الوكرة', 'الدوحة', 'دخان'], correct: 2 }
  ];

  const S = {
    phase: 'loading', round: 0, total: embedded ? 0 : DEMO.length, token: '', configured: !embedded,
    title: embedded ? '' : 'تدريب البولينج — أسئلة تجريبية', meta: '',
    points: 0, correctN: 0, pendingN: 0, lastPins: null,
    input: { start: 0, angle: 0, power: 0.65, spin: 0 },
    result: null, resultUsed: false, nextSent: false, outcomeSent: false, loaded: false, finishedEarly: false,
    hand: store.get('manarat-bowling-hand', 'right'),
    reduced: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || store.get('manarat-bowling-reduced', false)
  };
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  // ------------------------------------------------------------------ audio
  const prefs = store.get('manarat-bowling-audio', { muted: false, volume: 0.8 });
  const audio = BowlingAudio.create({ muted: prefs.muted, volume: prefs.volume });
  function savePrefs() { store.set('manarat-bowling-audio', { muted: audio.muted, volume: audio.volume }); }
  function unlockAudio() { audio.unlock().then(ok => { if (!ok && !audio.muted) setStatus('الصوت غير متاح في هذا المتصفح حاليًا؛ اللعبة تعمل بدونه.', true); }).catch(() => { }); }
  addEventListener('pointerdown', unlockAudio, { capture: true });
  addEventListener('keydown', unlockAudio, { capture: true });
  function soundUI() {
    $('sound').setAttribute('aria-pressed', String(!audio.muted));
    $('sound').setAttribute('aria-label', audio.muted ? 'تشغيل الصوت' : 'كتم الصوت');
    $('sound').classList.toggle('off', audio.muted);
    $('volume').value = Math.round(audio.volume * 100);
  }

  // ------------------------------------------------------------------ helpers
  function post(type, extra = {}) {
    if (!embedded) return;
    parent.postMessage(Object.assign({ type: PREFIX + type, token: S.token, index: S.round }, extra), location.origin);
  }
  function phase(p) { S.phase = p; document.body.dataset.phase = p; if (window.ManaratNavigation) window.ManaratNavigation.update(); }
  function show(id, on) { $(id).hidden = !on; if (['controls', 'question', 'feedback', 'summary', 'settings'].includes(id)) frameShift(); }
  const shortLandscape = window.matchMedia ? matchMedia('(max-height: 520px) and (orientation: landscape)') : { matches: false };
  function frameShift() {
    if (!scene) return;
    if (!shortLandscape.matches) { scene.setShift(0); return; }
    const el = ['controls', 'question', 'feedback'].map($).find(e => e && !e.hidden && getComputedStyle(e).display !== 'none');
    scene.setShift(el ? el.getBoundingClientRect().width : 0);
  }
  function setStatus(text, warn = false) { const el = $('instruction'); el.textContent = text; el.classList.toggle('warn', !!warn); }
  function hud() {
    $('round').textContent = S.total ? digits(Math.min(S.round + 1, S.total)) + ' / ' + digits(S.total) : '—';
    $('points').textContent = digits(S.points);
    $('correctN').textContent = digits(S.correctN);
    $('pendingN').textContent = digits(S.pendingN); show('pendingCell', S.pendingN > 0);
    $('lastPins').textContent = S.lastPins == null ? '—' : digits(S.lastPins);
    $('assignmentTitle').textContent = S.title || 'البولينج';
    $('assignmentMeta').textContent = S.meta; show('assignmentMeta', !!S.meta);
    document.title = (S.title ? S.title + ' | ' : '') + 'البولينج | ' + SCHOOL;
    scene && scene.setMonitor({ round: S.total ? 'الرمية ' + digits(S.round + 1) + '/' + digits(S.total) : '', big: S.lastPins, caption: 'القوارير الساقطة في الرمية', footer: S.title || SCHOOL });
  }
  function controlsUI() {
    const i = S.input;
    $('startValue').textContent = Math.abs(i.start) < 0.005 ? 'المنتصف' : digits(Math.round(Math.abs(i.start) * 100)) + ' سم ' + (i.start > 0 ? 'يمينًا' : 'يسارًا');
    $('angleValue').textContent = Math.abs(i.angle) < 0.025 ? 'مستقيم' : digits(Math.abs(i.angle).toFixed(2)) + '° ' + (i.angle > 0 ? 'يمينًا' : 'يسارًا');
    $('spinValue').textContent = Math.abs(i.spin) < 0.025 ? 'بلا دوران' : digits(Math.round(Math.abs(i.spin) * 100)) + '٪ ' + (i.spin > 0 ? 'نحو اليمين' : 'نحو اليسار');
    $('powerValue').textContent = digits(Math.round(i.power * 100)) + '٪ · ' + digits(((5 + 4 * i.power) * 3.6).toFixed(0)) + ' كم/س';
  }
  function readControls() {
    if (S.phase !== 'ready') return;
    S.input = { start: Number($('position').value) / 100, angle: Number($('angle').value), spin: Number($('spin').value) / 100, power: Number($('power').value) / 100 };
    controlsUI(); scene.setAim(S.input);
  }
  function writeControls() {
    $('position').value = Math.round(S.input.start * 100); $('angle').value = S.input.angle.toFixed(2);
    $('spin').value = Math.round(S.input.spin * 100); $('power').value = Math.round(S.input.power * 100);
    controlsUI();
  }

  // ------------------------------------------------------------------ scene
  let scene = null;
  const canvas = $('lane');
  try {
    const q = BowlingScene.detectQuality(params.get('quality'));
    scene = BowlingScene.create(canvas, {
      quality: q, reducedMotion: S.reduced, assetBase: 'assets/', hand: S.hand, fadeEl: $('fade'),
      preserveDrawingBuffer: QA, schoolName: SCHOOL, platformName: PLATFORM,
      fontReady: document.fonts ? Promise.race([document.fonts.load('700 40px Tajawal'), new Promise(r => setTimeout(r, 2500))]).catch(() => { }) : null,
      font: 'Tajawal, Tahoma, Arial, sans-serif', onEvent
    });
    if (q.reason === 'software renderer') document.body.classList.add('soft-gl');
  } catch (e) {
    fail('هذا المتصفح أو الجهاز لا يتيح رسومات WebGL اللازمة لصالة البولينج ثلاثية الأبعاد. جرّب متصفحًا حديثًا (Chrome أو Edge أو Safari أو Firefox) أو فعّل تسريع الرسومات.', false);
    return;
  }

  function onEvent(type, d) {
    switch (type) {
      case 'release': audio.event('release', d); setStatus('أُطلقت الكرة… تابع دورانها على المسار.'); phase('rolling'); break;
      case 'question': ask(); break;
      case 'settled': outcome(d); break;
      case 'ready': if (S.phase === 'resetting') ready(); break;
      case 'roll': audio.rolling(d); break;
      case 'step': case 'slide': case 'slideStop': case 'contact': case 'pit': case 'sweep': case 'return': audio.event(type, d); break;
    }
  }

  // ------------------------------------------------------------------ flow
  function welcome() {
    if (!S.loaded || !S.configured || S.phase !== 'loading') return;
    phase('welcome');
    show('loading', false); show('welcome', true);
    $('welcomeTitle').textContent = S.title || 'تحدّي البولينج';
    $('welcomeMode').textContent = embedded ? 'مهمة المعلم · ' + digits(S.total) + ' أسئلة · رمية واحدة لكل سؤال على عشر قوارير جديدة' : 'تدريب محلي بأسئلة تجريبية · لا تُحفظ النتائج';
    $('start').disabled = false; $('start').focus();
    hud();
  }
  function enterHall() {
    if (S.phase !== 'welcome') return;
    unlockAudio(); audio.crowd('calm');
    show('welcome', false); ready();
  }
  function ready() {
    phase('ready'); S.result = null; S.resultUsed = false; S.nextSent = false; S.outcomeSent = false;
    show('feedback', false); show('question', false); show('waiting', false); show('reopen', false); show('controls', true);
    $('next').disabled = false; $('throw').disabled = false;
    setStatus('اضبط رميتك ثم اضغط «ارمِ الكرة». المسار يعرض الاتجاه الأولي فقط، لا المنحنى النهائي.');
    writeControls(); scene.setAim(S.input); hud();
  }
  function shoot() {
    if (S.phase !== 'ready') return;
    unlockAudio();
    if (!scene.throw()) return;
    phase('approach'); $('throw').disabled = true;
    setStatus('اقتراب… دفع الكرة… مرجحة الذراع… انزلاق وإطلاق.');
    document.body.classList.add('in-shot');
  }
  function ask() {
    phase('question'); audio.crowd('question');
    show('waiting', true);
    setStatus('الكرة متوقفة في منتصف المسار. أجب عن السؤال لتكمل الرمية.');
    if (embedded) { show('reopen', true); post('question'); return; }
    const q = DEMO[S.round % DEMO.length];
    $('questionText').textContent = q.text;
    $('choices').replaceChildren(...q.options.map((label, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.onclick = () => resolve({ correct: i === q.correct, pending: false, feedback: i === q.correct ? '' : 'الإجابة الصحيحة: ' + q.options[q.correct] + '.' });
      return b;
    }));
    show('question', true);
    $('choices').querySelector('button').focus();
  }
  function resolve(b) {
    if (S.phase !== 'question' || S.resultUsed) return false;
    S.resultUsed = true;
    const pending = b.pending === true;
    S.result = { pending, correct: !pending && b.correct === true, feedback: typeof b.feedback === 'string' ? b.feedback.slice(0, 600) : '' };
    show('question', false); show('waiting', false); show('reopen', false);
    setStatus('تابع الكرة حتى القوارير…');
    phase('resolve');
    scene.resume();
    return true;
  }
  function outcome(d) {
    if (S.phase !== 'resolve' || S.outcomeSent) return;
    const pins = clamp(d.knocked | 0, 0, 10), r = S.result || { correct: false, pending: true, feedback: '' };
    const earned = r.correct && !r.pending ? pins : 0;
    S.points += earned; if (r.correct && !r.pending) S.correctN++; if (r.pending) S.pendingN++;
    S.lastPins = pins;
    phase('outcome'); document.body.classList.remove('in-shot'); hud();
    const strike = pins === 10, gutter = !!d.gutter && pins === 0;
    // feedback: pinfall (physics) is described separately from the answer (education)
    const label = r.pending ? 'بانتظار مراجعة المعلم' : r.correct ? 'إجابة صحيحة' : 'إجابة غير صحيحة';
    $('resultLabel').textContent = label;
    $('feedback').dataset.kind = r.pending ? 'pending' : r.correct ? 'correct' : 'wrong';
    $('resultTitle').textContent = strike ? 'سقطت القوارير العشر' : gutter ? 'الكرة في المجرى الجانبي' : pins === 0 ? 'لم تسقط أي قارورة' : 'سقطت ' + digits(pins) + ' من ١٠ قوارير';
    $('pinBadge').textContent = strike ? (r.correct && !r.pending ? 'سترايك! · ١٠/١٠' : 'سترايك فيزيائي · ١٠/١٠') : 'القوارير الساقطة: ' + digits(pins) + '/١٠';
    $('pinBadge').hidden = false;
    let text;
    if (r.pending) text = 'سُجّلت إجابتك وستُراجع لاحقًا؛ لا تُحتسب نقاط اللعب لهذه الرمية قبل المراجعة. ' + (pins ? 'سقوط القوارير نتيجة التصويب فقط.' : '');
    else if (r.correct) text = earned ? 'أحسنت! أُضيفت ' + digits(earned) + ' ' + (earned === 1 ? 'نقطة' : earned === 2 ? 'نقطتان' : earned <= 10 ? 'نقاط' : 'نقطة') + ' لعب لهذه الرمية.' : 'أحسنت في الإجابة. هذه الرمية لم تُسقط قوارير، فلم تُضف نقاط لعب — عدّل التصويب في الرمية القادمة.';
    else text = pins ? 'سقطت ' + digits(pins) + ' قوارير بفضل التصويب، لكن الإجابة غير صحيحة فلم تُضف نقاط لعب. راجع الملاحظة وحاول في السؤال التالي.' : 'الإجابة غير صحيحة، ولم تسقط قوارير هذه المرة. لا بأس — راجع الملاحظة وحاول في السؤال التالي.';
    $('resultText').textContent = text;
    $('hostFeedback').textContent = r.feedback || ''; show('hostFeedback', !!r.feedback);
    $('outcomeTitle').textContent = S.title;
    const last = S.round + 1 >= S.total;
    $('next').textContent = last ? (embedded ? 'إنهاء وعرض التقرير ←' : 'عرض الملخص ←') : 'الرمية التالية ←';
    $('next').disabled = false; $('saveStatus').textContent = '';
    show('feedback', true); show('controls', false);
    later(() => { if (S.phase === 'outcome') $('next').focus(); }, 60);
    setStatus(strike && !r.correct && !r.pending ? 'الإسقاط الكامل نتيجة فيزيائية للتصويب؛ صحة الإجابة هي التي تمنح النقاط.' : 'كل سؤال يبدأ برمية واحدة على عشر قوارير جديدة.');
    // reactions: celebrate only what is true; never celebrate a pending answer
    const kind = r.pending ? 'pending' : !r.correct ? 'wrong' : strike ? 'strike' : pins >= 7 ? 'good' : pins >= 1 ? 'fair' : 'miss';
    scene.react(kind);
    audio.crowd(kind === 'strike' ? 'strike' : kind === 'good' ? 'good' : kind === 'wrong' || kind === 'miss' ? 'support' : 'calm');
    if (kind === 'strike' && !S.reduced) document.body.classList.add('celebrate'), later(() => document.body.classList.remove('celebrate'), 1600);
    S.outcomeSent = true;
    post('outcome', { outcome: r.pending ? 'pending' : r.correct ? 'goal' : 'miss', pins, earned });
  }
  function next() {
    if (S.phase !== 'outcome') return;
    if (embedded) {
      if (S.nextSent) return;
      S.nextSent = true; $('next').disabled = true;
      $('saveStatus').textContent = S.round + 1 >= S.total ? 'جارٍ إنهاء المهمة وحفظها لدى المنصة…' : 'جارٍ تجهيز السؤال التالي…';
      post('next');
      return;
    }
    if (S.round + 1 < S.total) advanceRound();
    else finish(false);
  }
  function advanceRound() {
    S.round++; S.lastPins = null; S.result = null;
    show('feedback', false); phase('resetting'); hud();
    setStatus('الماسحة تجمع القوارير وتُرتَّب عشر قوارير جديدة…');
    audio.crowd('calm');
    if (!scene.nextRack()) { scene.hardReset(); ready(); }
  }
  function finish(early) {
    clearTimers();
    phase('finished'); S.finishedEarly = early;
    show('feedback', false); show('controls', false); show('question', false); show('waiting', false);
    $('summaryTitle').textContent = S.title;
    $('summaryLead').textContent = early ? 'انتهى التدريب قبل إكمال الأسئلة.' : 'انتهى تدريب البولينج.';
    $('summaryPoints').textContent = digits(S.points);
    $('summaryCorrect').textContent = digits(S.correctN) + ' / ' + digits(S.total);
    $('summaryNote').textContent = 'هذه نقاط لعب محلية للتدريب ولا تُحفظ. في مهام المعلم تُحسب الدرجة التعليمية الرسمية في المنصة.';
    show('summary', true); $('again').focus();
    document.body.classList.remove('in-shot');
  }
  function restart() {
    clearTimers(); audio.stopAll();
    Object.assign(S, { round: 0, points: 0, correctN: 0, pendingN: 0, lastPins: null, result: null, resultUsed: false, nextSent: false, outcomeSent: false, finishedEarly: false });
    show('summary', false); show('feedback', false); show('question', false); show('waiting', false);
    document.body.classList.remove('in-shot', 'celebrate');
    phase('resetting'); scene.hardReset(); ready();
  }

  // ------------------------------------------------------------------ platform messages
  addEventListener('message', e => {
    if (!embedded || e.origin !== location.origin || e.source !== window.parent) return;
    const b = e.data;
    if (!b || typeof b !== 'object' || typeof b.type !== 'string' || !b.type.startsWith(PREFIX)) return;
    const type = b.type.slice(PREFIX.length);
    if (type === 'config') {
      if (S.configured) return;                                                           // initialise once
      const token = typeof b.token === 'string' ? b.token : '', count = Number(b.count);
      if (token.length < 8 || token.length > 200 || !/^[\w-]+$/.test(token)) return;      // reject empty/invalid token
      if (!Number.isInteger(count) || count < 1 || count > 100) return;                  // reject unsafe count
      S.token = token; S.total = count; S.configured = true;
      S.title = typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 140) : 'مهمة المعلم';
      const meta = [b.subject, b.teacher].filter(v => typeof v === 'string' && v.trim()).map(v => v.trim().slice(0, 60));
      S.meta = meta.join(' · ');
      hud(); welcome();
      return;
    }
    if (!S.configured || b.token !== S.token || b.index !== S.round) return;            // wrong token, stale index
    if (type === 'result') {
      if (S.phase !== 'question' || S.resultUsed) return;                               // once, only while waiting
      resolve({ correct: b.correct === true, pending: b.pending === true, feedback: b.feedback });
    } else if (type === 'advance') {
      if (S.phase !== 'outcome' || !S.nextSent) return;
      if (S.round + 1 >= S.total) return;                                                // the host finishes the last round itself
      advanceRound();
    } else if (type === 'retry') {
      if (S.phase !== 'outcome' || !S.nextSent) return;
      S.nextSent = false; $('next').disabled = false;                                    // never awards again
      $('saveStatus').textContent = 'تعذر الحفظ لدى المنصة. تحقق من الاتصال ثم اضغط الزر للمحاولة مجددًا.';
      $('next').focus();
    }
  });

  // standalone lifecycle hooks for js/platform-nav.js
  if (!embedded) {
    window.ManaratGameControls = {
      isActive: () => !['loading', 'welcome', 'finished'].includes(S.phase),
      canRestart: () => S.loaded,
      isBusy: () => false,
      restart: async () => { restart(); },
      end: async () => { if (['loading'].includes(S.phase)) return; clearTimers(); audio.stopAll(); scene.hardReset(); finish(true); }
    };
  }

  // ------------------------------------------------------------------ input
  $('start').onclick = enterHall;
  $('throw').onclick = shoot;
  $('next').onclick = next;
  $('again').onclick = restart;
  $('reopen').onclick = () => { if (S.phase === 'question' && !S.resultUsed) post('question'); };
  $('resetAim').onclick = () => { if (S.phase !== 'ready') return; S.input = { start: 0, angle: 0, power: 0.65, spin: 0 }; writeControls(); scene.setAim(S.input); };
  for (const id of ['position', 'angle', 'power', 'spin']) $(id).addEventListener('input', readControls);
  $('sound').onclick = () => { unlockAudio(); audio.setMuted(!audio.muted); savePrefs(); soundUI(); };
  $('volume').addEventListener('input', () => { unlockAudio(); audio.setVolume(Number($('volume').value) / 100); if (audio.muted && audio.volume > 0) audio.setMuted(false); savePrefs(); soundUI(); });
  $('settingsBtn').onclick = () => { const open = $('settings').hidden; show('settings', open); $('settingsBtn').setAttribute('aria-expanded', String(open)); if (open) $('closeSettings').focus(); };
  $('closeSettings').onclick = () => { show('settings', false); $('settingsBtn').setAttribute('aria-expanded', 'false'); $('settingsBtn').focus(); };
  $('handRight').onchange = $('handLeft').onchange = () => {
    const h = $('handLeft').checked ? 'left' : 'right';
    if (scene.setHand(h)) { S.hand = h; store.set('manarat-bowling-hand', h); } else { (S.hand === 'left' ? $('handLeft') : $('handRight')).checked = true; setStatus('يمكن تغيير اليد قبل بدء الرمية فقط.', true); }
  };
  $('reducedToggle').onchange = () => { S.reduced = $('reducedToggle').checked; store.set('manarat-bowling-reduced', S.reduced); scene.setReducedMotion(S.reduced); document.body.classList.toggle('reduced', S.reduced); };
  $('qualitySel').onchange = () => applyQuality($('qualitySel').value);
  $('toggleControls').onclick = () => { const c = $('controls').classList.toggle('collapsed'); $('toggleControls').setAttribute('aria-expanded', String(!c)); };

  // pointer aiming on the canvas only (UI elements never steer the lane)
  let dragging = false;
  function aim(e) {
    const a = scene.aimAt(e.clientX, e.clientY); if (!a) return;
    if (a.angle !== undefined) S.input.angle = Math.round(a.angle * 20) / 20;
    if (a.start !== undefined) S.input.start = Math.round(a.start * 100) / 100;
    writeControls(); scene.setAim(S.input);
  }
  canvas.addEventListener('pointerdown', e => { if (S.phase !== 'ready' || e.button > 0) return; dragging = true; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); aim(e); });
  canvas.addEventListener('pointermove', e => { if (dragging && S.phase === 'ready') aim(e); });
  const stopDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag); canvas.addEventListener('lostpointercapture', stopDrag);
  document.addEventListener('keydown', e => {
    const t = e.target, onScene = t === document.body || t === canvas;
    if (e.key === 'Escape' && !$('settings').hidden) { $('closeSettings').click(); return; }
    if (!onScene || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.code === 'Space' || e.key === 'Enter') && S.phase === 'ready') { e.preventDefault(); shoot(); }
    else if (e.key === 'r' || e.key === 'R' || e.key === 'ر') { $('resetAim').click(); }
    else if (S.phase === 'ready' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') S.input.angle = clamp(S.input.angle - 0.1, -3, 3);
      if (e.key === 'ArrowRight') S.input.angle = clamp(S.input.angle + 0.1, -3, 3);
      if (e.key === 'ArrowUp') S.input.power = clamp(S.input.power + 0.05, 0, 1);
      if (e.key === 'ArrowDown') S.input.power = clamp(S.input.power - 0.05, 0, 1);
      writeControls(); scene.setAim(S.input);
    }
  });

  // fullscreen: the host owns it when embedded; standalone uses the Fullscreen API when available
  $('full').onclick = async () => {
    if (embedded) { post('fullscreen'); return; }
    const el = $('venue'), doc = document;
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) await (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      else if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else throw new Error('unsupported');
    } catch (err) { setStatus('ملء الشاشة غير متاح هنا. دوّر الجهاز أفقيًا لرؤية الصالة كاملة.', true); }
  };
  document.addEventListener('fullscreenchange', () => { $('full').setAttribute('aria-pressed', String(!!document.fullscreenElement)); later(() => scene.resize(), 60); });

  // ------------------------------------------------------------------ quality governor (live, no reload)
  const quality = { tier: scene.quality.tier, ratio: scene.quality.pixelRatio, shadows: true, samples: [], downgraded: 0 };
  function applyQuality(tier) {
    const T = BowlingScene.TIERS[tier] || BowlingScene.TIERS.medium;
    quality.tier = tier; quality.ratio = Math.min(window.devicePixelRatio || 1, T.maxDpr);
    scene.setPixelRatio(quality.ratio); quality.shadows = true; scene.setShadows(true);
    scene.thinCrowd(tier === 'low' ? 0.5 : 1);
  }
  function governor(dt) {
    if (MANUAL || !['ready', 'approach', 'rolling', 'resolve'].includes(S.phase)) { quality.samples.length = 0; return; }
    quality.samples.push(dt);
    const span = quality.samples.reduce((a, b) => a + b, 0);
    if (quality.samples.length < 12 || span < 2) return;                 // judge every ~2 s of real time
    const avg = quality.samples.reduce((a, b) => a + b, 0) / quality.samples.length; quality.samples.length = 0;
    const fps = 1 / avg;
    if (fps < 26 && quality.ratio > 0.7) { quality.ratio = Math.max(0.7, quality.ratio * 0.85); scene.setPixelRatio(quality.ratio); quality.downgraded++; }
    else if (fps < 22 && quality.shadows) { quality.shadows = false; scene.setShadows(false); scene.thinCrowd(0.4); quality.downgraded++; }
  }

  // ------------------------------------------------------------------ loop + lifecycle
  let raf = 0, prev = 0, stopped = false, frames = 0;
  function tick(now) {
    if (stopped) return;
    const raw = document.hidden ? 0 : (now - (prev || now)) / 1000, dt = Math.min(0.05, raw); prev = now;
    frame(dt, raw);
    raf = requestAnimationFrame(tick);
  }
  function frame(dt, raw = dt) {
    frames++;
    scene.update(dt);
    const c = scene.camera; audio.setListener(c.position.toArray(), [c.matrixWorld.elements[0], c.matrixWorld.elements[1], c.matrixWorld.elements[2]]);
    if (raw > 0) governor(Math.min(raw, 1));             // the governor judges real frame time, not the clamped step
  }
  addEventListener('resize', () => { scene.resize(); frameShift(); });
  document.addEventListener('visibilitychange', () => { prev = 0; document.hidden ? audio.suspend() : audio.resume(); });
  function teardown() { if (stopped) return; stopped = true; cancelAnimationFrame(raf); clearTimers(); audio.close(); try { scene.dispose(); } catch (e) { } }
  addEventListener('pagehide', teardown);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stopped = true; cancelAnimationFrame(raf); audio.stopAll(); fail('توقف عرض الرسوم ثلاثية الأبعاد (فقد سياق WebGL). اضغط «إعادة المحاولة» لتشغيل الصالة من جديد.', true); });

  function fail(text, retry) {
    show('loading', false); show('welcome', false); show('controls', false);
    $('errorText').textContent = text; show('errorRetry', !!retry); show('error', true);
    phase('error');
  }
  $('errorRetry').onclick = () => location.reload();
  $('loadRetry').onclick = () => location.reload();

  // ------------------------------------------------------------------ boot
  document.body.classList.toggle('standalone', !embedded);
  $('handRight').checked = S.hand !== 'left'; $('handLeft').checked = S.hand === 'left';
  $('reducedToggle').checked = S.reduced; document.body.classList.toggle('reduced', S.reduced);
  $('qualitySel').value = scene.quality.tier;
  soundUI(); writeControls(); hud();
  if (embedded) post('ready');                     // no session token exists yet; the host replies with config
  const slow = setTimeout(() => show('loadSlow', true), 12000);
  const giveUp = setTimeout(() => { if (!S.loaded) { show('loadSlow', true); $('loadSlow').textContent = 'التحميل يستغرق وقتًا أطول من المعتاد. يمكنك الانتظار أو إعادة المحاولة.'; show('loadRetry', true); } }, 45000);
  scene.load(p => { $('loadBar').style.width = Math.round(p * 100) + '%'; $('loadMeter').setAttribute('aria-valuenow', String(Math.round(p * 100))); $('loadPct').textContent = digits(Math.round(p * 100)) + '٪'; })
    .then(() => {
      clearTimeout(slow); clearTimeout(giveUp);
      S.loaded = true;
      if (S.hand !== 'right') scene.setHand(S.hand);
      if (embedded && !S.configured) { $('loadText').textContent = 'بانتظار بيانات المهمة من المنصة…'; }
      welcome();
    })
    .catch(err => { clearTimeout(slow); clearTimeout(giveUp); console.error(err); const m = String(err && err.message || err), file = (m.match(/(?:file:|texture)\s*(\S+)/) || [])[1]; fail('تعذر تحميل ملفات الصالة' + (file ? ' (الملف: ' + file.slice(0, 120) + ')' : '') + '. تحقق من الاتصال ثم أعد المحاولة.', true); });
  if (!MANUAL) raf = requestAnimationFrame(tick);

  // read-only state for QA and the test host (no answers, no secrets)
  window.Bowling = {
    get phase() { return S.phase; }, get points() { return S.points; }, get round() { return S.round; }, get total() { return S.total; },
    get knocked() { return scene.world.knocked; }, get title() { return S.title; }, get frames() { return frames; },
    get correct() { return S.correctN; }, get pending() { return S.pendingN; },
    snapshot: () => scene.snapshot(), pose: () => scene.poseCheck(), audio: () => audio.stats(), quality: () => Object.assign({}, quality, scene.quality)
  };
  if (QA) window.__bowlingQA = {
    setInputs(i) { if (S.phase !== 'ready') return false; S.input = Object.assign({}, S.input, i); writeControls(); return scene.setAim(S.input); },
    step(dt = 1 / 60, n = 1) { for (let k = 0; k < n; k++) frame(dt); return S.phase; },
    until(pred, dt = 1 / 60, max = 3000) { for (let k = 0; k < max; k++) { if (pred(S.phase)) return true; frame(dt); } return false; },
    state: () => ({ phase: S.phase, round: S.round, total: S.total, resultUsed: S.resultUsed, nextSent: S.nextSent, outcomeSent: S.outcomeSent, configured: S.configured }),
    shoot, enterHall, next, answer: i => { const b = $('choices').querySelectorAll('button')[i]; b && b.click(); }, audioAnalyse: () => audio.analyse(), scene
  };
})();
