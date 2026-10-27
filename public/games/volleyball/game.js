/* الكرة الطائرة V24 — game flow and the school-volleyball-* bridge.
 *
 * Assessment authority belongs to the parent platform. In embedded mode this file NEVER grades: it
 * freezes the rally, posts `school-volleyball-question`, and waits for `school-volleyball-result`.
 * correct → the student's team earns the point; wrong → the opponent earns it; pending (teacher-reviewed
 * essay) → play is stopped for review and no point is awarded. One question per rally, one outcome
 * message per round, one score change per round.
 *
 * The message protocol, shapes and guards are identical to the previous version (V20 experiences
 * engine): same message types, token/index checks, event.source === window.parent and
 * event.origin === location.origin.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const VR = window.VolleyRally;
  const kind = 'volleyball', prefix = 'school-' + kind + '-';
  // Offline classroom builds never talk to a platform, even when shown inside another page's iframe.
  const embedded = window.parent !== window && !window.VOLLEY_OFFLINE;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('vb24.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('vb24.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const query = (() => { try { return new URLSearchParams(location.search); } catch (e) { return { get: () => null }; } })();

  const MODE_LABEL = { match: 'مباراة كاملة', serve: 'تدريب الإرسال', receive: 'تدريب الاستقبال', attack: 'تدريب الهجوم', block: 'تدريب حائط الصد' };
  const HIT_LABEL = { match: 'اضرب!', attack: 'اضرب!', serve: 'أرسل!', receive: 'استقبل!', block: 'اصدّ!' };
  const REASON = {
    kill: 'ضربة ساحقة ناجحة داخل ملعب المنافس', tip: 'كرة خادعة سقطت خلف حائط الصد', 'block-out': 'لمست الكرة أيدي حائط الصد وخرجت',
    shank: 'لم يسيطر المدافع على الكرة فخرجت', ace: 'إرسال مباشر لم يُستقبَل', block: 'حائط صد ناجح أعاد الكرة إلى ملعب المنافس',
    stuff: 'صدّ المنافس الضربة إلى ملعبك', net: 'الكرة اصطدمت بالشبكة', out: 'الكرة سقطت خارج حدود الملعب',
    counter: 'دافع المنافس وردّ بهجوم مضاد ناجح', 'serve-net': 'الإرسال اصطدم بالشبكة', 'serve-out': 'الإرسال خرج خارج الملعب',
    tool: 'لمست الكرة أيدي حائط الصد وخرجت', review: 'أوقف الحكم اللعب لمراجعة الإجابة', in: 'سقطت الكرة داخل الملعب',
  };
  // Standalone demo content only. Real assignments always come from the platform and are graded there.
  const DEMO_BANK = [
    { text: 'كم يساوي ٧ × ٨؟', choices: ['٥٤', '٥٦', '٦٤', '٤٨'], answer: 1 },
    { text: 'ما عاصمة دولة قطر؟', choices: ['الوكرة', 'الدوحة', 'الخور', 'الريان'], answer: 1 },
    { text: 'سؤال مقالي: اكتب جملتين عن أهمية العمل الجماعي في الكرة الطائرة.', essay: true },
    { text: 'ما الغاز الذي تمتصه النباتات في عملية البناء الضوئي؟', choices: ['الأكسجين', 'النيتروجين', 'ثاني أكسيد الكربون', 'الهيدروجين'], answer: 2 },
    { text: 'كم عدد لاعبي الفريق الواحد داخل ملعب الكرة الطائرة؟', choices: ['٥', '٦', '٧', '١١'], answer: 1 },
    { text: 'ما ارتفاع شبكة الكرة الطائرة للرجال؟', choices: ['٢٫٢٤ م', '٢٫٤٣ م', '٢٫٨٠ م', '١٫٩٠ م'], answer: 1 },
    { text: 'ما ناتج ١٢٠ ÷ ٤؟', choices: ['٢٥', '٣٠', '٣٥', '٤٠'], answer: 1 },
  ];
  const QUESTION_SECONDS = 30;
  // Offline classroom builds provide their own local practice set (offline.js); the platform never does.
  const bank = () => { const l = !embedded && window.VolleyQuestionBank?.list?.(); return l && l.length ? l : DEMO_BANK; };

  const prefs = {
    quality: store.get('quality', 'auto'), replays: store.get('replays', true), calm: store.get('calm', false), ticking: store.get('ticking', true),
    audio: store.get('audio', { enabled: true, sfx: 0.9, crowd: 0.6, music: 0.35, announcer: true }),
  };
  const reduced = () => !!prefs.calm || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const S = {
    phase: 'loading', round: 0, total: embedded ? 1 : 5, goals: 0, misses: 0, pendingCount: 0, token: '', images: [], cycle: 0,
    mode: 'match', aim: 'center', shot: 'spike', correct: false, pending: false, feedback: '', scored: false, outcomePosted: false,
    serve: { serving: 'home', rotation: { home: 0, away: 0 } }, previous: null, plan: null, t: 0, lastPoint: null,
    resumeWall: 0, replayT: 0, introUntil: 0, timing: null, questionLeft: 0, questionTimer: null, speed: Number(query.get('speed')) || 1, maxFps: Number(query.get('maxfps')) || 0, lastRender: 0,
    fps: 0, frameMs: [], degraded: [], questionsAsked: 0, outcomesPosted: 0,
  };
  let world = null, audio = null, frameId = 0, prevNow = 0, wall = 0, configured = !embedded, worldReady = false, lostContext = false;

  // ───────── bridge ─────────
  function post(suffix, extra = {}) {
    if (embedded) window.parent.postMessage({ type: prefix + suffix, token: S.token, index: S.round, ...extra }, location.origin);
  }
  window.addEventListener('message', (e) => {
    if (!embedded || e.source !== window.parent || e.origin !== location.origin || !e.data) return;
    const b = e.data;
    if (b.type === prefix + 'config' && S.phase === 'loading') {
      S.token = String(b.token || '');
      S.total = Math.max(1, Math.min(100, Number(b.count) || 1));
      S.images = Array.isArray(b.images) ? b.images.slice(0, 100) : [];
      $('modeLabel').textContent = String(b.title || 'مهمة المعلم');
      configured = true;
      hud();
      ready();
    } else if (b.token === S.token && b.index === S.round) {
      if (b.type === prefix + 'result') resolve(b);
      if (b.type === prefix + 'advance' && S.phase === 'outcome') { S.round++; reset(); }
      if (b.type === prefix + 'retry' && S.phase === 'outcome') $('next').disabled = false;
    }
  });

  // ───────── helpers ─────────
  function phase(p) { S.phase = p; document.body.dataset.phase = p; }
  function show(id, on) { const n = $(id); if (n) n.hidden = !on; }
  function instruct(text) { $('instruction').textContent = text; }
  function hud() {
    $('score').textContent = String(S.goals);
    $('opponentScore').textContent = String(S.misses);
    $('round').textContent = Math.min(S.round + 1, S.total) + ' / ' + S.total;
    const done = S.round + (['outcome', 'finished'].includes(S.phase) ? 1 : 0);
    const pct = Math.round((Math.min(done, S.total) / S.total) * 100);
    $('progressFill').style.width = pct + '%';
    const bar = document.querySelector('.progress'); if (bar) bar.setAttribute('aria-valuenow', String(pct));
    const serving = S.plan?.serving || S.serve.serving;
    $('serveHome').classList.toggle('on', serving === 'home');
    $('serveAway').classList.toggle('on', serving === 'away');
    $('modeChip').textContent = MODE_LABEL[S.mode];
    world?.setScore({ home: S.goals, away: S.misses, round: Math.min(S.round + 1, S.total), total: S.total, serving, mode: MODE_LABEL[S.mode], statusText: statusText() });
  }
  function statusText() {
    return { welcome: 'استعداد', ready: 'استعداد للإرسال', rally: 'تبادل الكرة', question: 'سؤال · توقّف اللعب', resolve: 'تابع الكرة', replay: 'إعادة', outcome: S.pending ? 'قيد مراجعة المعلم' : S.correct ? 'نقطة لأبو عبيدة' : 'نقطة للمنافس', finished: 'نهاية التجربة' }[S.phase] || '';
  }
  function makePlan(outcome) {
    return VR.create({ mode: S.mode, serving: S.serve.serving, rotation: S.serve.rotation, aim: S.aim, shot: S.shot, round: S.round + S.cycle * 100, previous: S.previous, outcome });
  }
  function setPlan(p) { S.plan = p; world?.setPlan(p); }

  // ───────── world ─────────
  function buildWorld() {
    const q = prefs.quality === 'auto' ? undefined : prefs.quality;
    world = window.VolleyScene.create($('pitch'), { quality: q, reducedMotion: reduced(), capture: query.get('capture') === '1' });
    if (S.plan) world.setPlan(S.plan);
    const canvas = $('pitch');
    if (!canvas.__vbBound) { // bind once per canvas element (rebuilds reuse the same canvas)
      canvas.__vbBound = true;
      canvas.addEventListener('webglcontextlost', onContextLost, false);
      canvas.addEventListener('webglcontextrestored', onContextRestored, false);
      canvas.addEventListener('pointerdown', () => { if (S.phase === 'rally' && !$('hit').hidden) hit(); });
    }
    $('qualityInfo').textContent = world.kind === 'webgl' ? `الجودة الحالية: ${({ low: 'منخفضة', medium: 'متوسطة', high: 'عالية' })[world.quality] || world.quality}` : 'المتصفح لا يدعم WebGL: يُعرض الملعب بشكل مبسّط ثنائي الأبعاد.';
    hud();
  }
  function rebuildWorld() {
    try { world?.dispose(); } catch (e) { /* ignore */ }
    world = null;
    buildWorld();
  }
  function onContextLost(e) {
    e.preventDefault();
    lostContext = true;
    show('glLost', true);
    audio?.suspend(true);
  }
  function onContextRestored() {
    lostContext = false;
    show('glLost', false);
    rebuildWorld();
    audio?.suspend(false);
  }

  // ───────── round lifecycle ─────────
  function ready() {
    if (!configured || !worldReady) return;
    phase('welcome');
    show('loading', false);
    S.plan || setPlan(makePlan(null));
    $('start').disabled = false;
    $('start').textContent = 'ابدأ المباراة ←';
    show('demoBadge', !embedded);
    hud();
  }
  function reset() {
    // Players walk from wherever the last rally left them into the new rotation (no teleport).
    if (S.plan) S.previous = VR.endState(S.plan, S.t);
    S.serve = VR.nextServe(S.serve, S.lastPoint);
    S.lastPoint = null;
    Object.assign(S, { t: 0, correct: false, pending: false, feedback: '', scored: false, outcomePosted: false, timing: null });
    setPlan(makePlan(null));
    phase('ready');
    ['feedback', 'question', 'next', 'reopen', 'hit', 'waitHost', 'replayBadge', 'timing'].forEach((id) => show(id, false));
    $('next').disabled = false;
    show('shoot', true); $('shoot').disabled = false;
    show('aimGroup', true);
    show('shotGroup', S.mode === 'match' || S.mode === 'attack');
    instruct('اختر منطقة التصويب ونوع الضربة ثم ابدأ التبادل');
    audio?.setCrowd(0.3, 0);
    hud();
  }
  function shoot() {
    if (S.phase !== 'ready') return;
    audio?.unlock();
    // Rebuild with the final aim/shot: the rally up to the serve is identical, so nothing jumps.
    const t = S.t;
    setPlan(makePlan(null));
    S.t = Math.min(t, S.plan.tHold);
    phase('rally');
    show('shoot', false); show('aimGroup', false);
    instruct('تابع الكرة… استعد للحظة الحاسمة');
    hud();
  }
  function hit() {
    if (S.phase !== 'rally' || S.timing) return;
    const left = S.plan.tFreeze - S.t;
    S.timing = left < 0.3 ? { rating: 'perfect', text: 'توقيت مثالي!', power: 1.25 } : left < 0.7 ? { rating: 'good', text: 'توقيت جيد', power: 1.05 } : { rating: 'early', text: 'مبكر قليلًا', power: 0.9 };
    show('hit', false);
    $('timing').textContent = S.timing.text + ' · النتيجة تحددها إجابتك';
    show('timing', true);
    setTimeout(() => show('timing', false), 1600);
    audio?.whoosh();
  }
  function ask() {
    if (S.phase !== 'rally') return;
    phase('question');
    S.questionsAsked++;
    show('hit', false);
    world?.cue('question');
    audio?.anticipation(true); audio?.questionStart(); audio?.duckMusic(0.35);
    startQuestionTimer();
    instruct('الكرة متوقفة عند الشبكة · أجب لتستكمل النقطة');
    if (embedded) { show('reopen', true); show('waitHost', true); post('question'); }
    else renderDemoQuestion();
    hud();
  }
  function startQuestionTimer() {
    stopQuestionTimer();
    S.questionLeft = QUESTION_SECONDS;
    const paint = () => {
      $('timerText').textContent = String(Math.max(0, S.questionLeft));
      $('timerArc').style.strokeDashoffset = String(97.4 * (1 - Math.max(0, S.questionLeft) / QUESTION_SECONDS));
      $('timer').classList.toggle('late', S.questionLeft <= 5);
    };
    paint();
    S.questionTimer = setInterval(() => {
      S.questionLeft--;
      paint();
      if (S.questionLeft === 0) { $('questionHelp').textContent = 'انتهى الوقت المقترح · ما زال بإمكانك الإجابة'; }
    }, 1000);
    if (prefs.ticking) audio?.startTicking(QUESTION_SECONDS);
  }
  function stopQuestionTimer() { if (S.questionTimer) clearInterval(S.questionTimer); S.questionTimer = null; audio?.stopTicking(); }
  function renderDemoQuestion() {
    const list = bank(), q = list[(S.round + (window.VolleyQuestionBank ? 0 : S.cycle * 2)) % list.length];
    $('questionText').textContent = q.text;
    $('questionHelp').textContent = q.essay ? 'سؤال مقالي: في المنصة يراجعه المعلم، لذا لا تُحتسب نقطة لأي فريق.' : 'اختر إجابتك (أو اضغط رقم الخيار ١-٤).';
    const nodes = [];
    if (q.essay) {
      const ta = document.createElement('textarea'); ta.setAttribute('aria-label', 'إجابتك'); ta.placeholder = 'اكتب إجابتك هنا…';
      const send = document.createElement('button'); send.textContent = 'إرسال للمراجعة';
      send.onclick = () => resolve({ correct: false, pending: true, feedback: 'وصلت إجابتك وستُراجع.' });
      nodes.push(ta, send);
    } else {
      q.choices.forEach((text, i) => {
        const b = document.createElement('button'); b.textContent = text; b.dataset.key = String(i + 1);
        b.onclick = () => resolve({ correct: i === q.answer, pending: false, feedback: i === q.answer ? 'إجابة صحيحة، أحسنت!' : 'الإجابة الصحيحة: ' + q.choices[q.answer] });
        nodes.push(b);
      });
    }
    $('choices').replaceChildren(...nodes);
    show('question', true);
    nodes[0]?.focus?.();
  }
  function resolve(b) {
    if (S.phase !== 'question') return;
    S.correct = b.correct === true && !b.pending;
    S.pending = b.pending === true;
    S.feedback = String(b.feedback || '');
    stopQuestionTimer();
    show('question', false); show('reopen', false); show('waitHost', false);
    const outcome = S.pending ? 'neutral' : S.correct ? 'correct' : 'wrong';
    const tF = S.plan.tFreeze;
    const next = makePlan(outcome);
    // Continuity guard: the branch must start from exactly the frozen frame.
    const a = VR.ballAt(S.plan, tF).p, c = VR.ballAt(next, tF).p;
    if (Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]) > 1e-6) console.warn('volleyball: branch continuity mismatch');
    setPlan(next);
    S.t = tF;
    S.resumeWall = wall;
    phase('resolve');
    world?.cue('resume');
    audio?.anticipation(false); audio?.duckMusic(1);
    instruct(S.pending ? 'وصلت الإجابة للمراجعة' : 'تابع الكرة…');
    hud();
  }
  function point() {
    if (S.scored) return;
    S.scored = true;
    const v = S.plan.verdict || {};
    const team = S.pending ? null : S.correct ? 'home' : 'away';
    if (team && v.pointTo && v.pointTo !== team) console.warn('volleyball: rally verdict disagrees with assessment; assessment wins');
    S.lastPoint = team;
    if (team === 'home') S.goals++;
    else if (team === 'away') S.misses++;
    else S.pendingCount++;
    const power = S.timing?.power || 1;
    if (team) {
      world?.cue('point', team, wall);
      document.querySelector('.board')?.classList.remove('pulse');
      void document.querySelector('.board')?.offsetWidth;
      document.querySelector('.board')?.classList.add('pulse');
    }
    if (team === 'home') { audio?.roar(power); audio?.success(); if ((S.round % 2) === 0) setTimeout(() => audio?.chant(), 1400); audio?.announce('نقطة لأبو عبيدة!'); }
    else if (team === 'away') { audio?.groan(); audio?.failure(); audio?.announce('نقطة للمنافس'); }
    else { audio?.neutral(); }
    hud();
    if (team && prefs.replays && !reduced() && world?.kind === 'webgl') startReplay();
    else outcome();
  }
  function startReplay() {
    phase('replay');
    S.replayT = Math.max(S.plan.tContact - 0.75, 0);
    show('replayBadge', true);
    world?.cue('replay');
  }
  function endReplay() { if (S.phase !== 'replay') return; show('replayBadge', false); outcome(); }
  function outcome() {
    phase('outcome');
    const v = S.plan.verdict || {};
    const fb = $('feedback');
    fb.classList.toggle('miss', !S.correct && !S.pending);
    fb.classList.toggle('pending', S.pending);
    $('momentLabel').textContent = S.pending ? 'في انتظار تصحيح المعلم' : S.correct ? 'أحسنت، واصل التقدّم' : 'تعلّم وجرّب من جديد';
    $('momentTitle').textContent = S.pending ? 'إجابة قيد المراجعة' : S.correct ? 'نقطة لفريقك!' : 'نقطة للمنافس';
    $('momentReason').textContent = REASON[S.plan.variant] || REASON[v.reason] || '';
    $('momentText').textContent = S.feedback;
    show('feedback', true);
    show('next', true);
    $('next').disabled = false;
    $('next').textContent = S.round + 1 >= S.total ? (embedded ? 'إنهاء وعرض النتيجة ←' : 'عرض الملخص ←') : 'النقطة التالية ←';
    instruct(S.pending ? 'لا تُحتسب نقطة حتى يراجع المعلم الإجابة' : 'تابع إلى النقطة التالية');
    $('next').focus?.();
    hud();
    if (!S.outcomePosted) { S.outcomePosted = true; S.outcomesPosted++; post('outcome'); }
  }
  function next() {
    if (S.phase !== 'outcome') return;
    if (embedded) { $('next').disabled = true; post('next'); return; }
    if (S.round + 1 < S.total) { S.round++; reset(); }
    else finish();
  }
  function finish() {
    phase('finished');
    ['feedback', 'controls', 'next'].forEach((id) => show(id, false));
    const graded = S.total - S.pendingCount;
    $('sumCorrect').textContent = String(S.goals);
    $('sumAccuracy').textContent = graded ? Math.round((S.goals / graded) * 100) + '%' : '—';
    $('sumScore').textContent = S.goals + ' : ' + S.misses;
    $('sumPending').textContent = String(S.pendingCount);
    $('summaryTitle').textContent = S.goals > S.misses ? 'فوز لأبو عبيدة في الكرة الطائرة!' : S.goals === S.misses ? 'تعادل في الكرة الطائرة' : 'انتهت مباراة الكرة الطائرة';
    show('summary', true);
    $('again').focus?.();
    hud();
  }
  function again() {
    Object.assign(S, { round: 0, goals: 0, misses: 0, pendingCount: 0, lastPoint: null });
    S.cycle++;
    show('summary', false); show('controls', true);
    reset();
  }

  // ───────── audio events from the plan ─────────
  function fireEvents(plan, t0, t1, replay) {
    if (!audio || t1 <= t0) return;
    for (const e of plan.events) {
      if (e.t <= t0 || e.t > t1) continue;
      if (e.type === 'contact') {
        audio.contact(e.kind, (S.timing && e.team === 'home' && e.t >= plan.tContact - 0.01 ? S.timing.power : 1));
        if (!replay && (e.kind === 'spike' || e.kind === 'serve')) world?.cue('spike');
      } else if (e.type === 'floor') audio.floor(e.speed);
      else if (e.type === 'net') audio.net();
      else if (e.type === 'bounce' || e.type === 'catch') audio.thud();
      else if (e.type === 'whistle' && !replay) audio.whistle(e.kind === 'point' || e.kind === 'review');
    }
    if (replay) return;
    // Sneaker squeaks on hard plants.
    for (const a of plan.actors) for (const S2 of ['L', 'R']) for (const st of a.steps[S2]) {
      if (st.land <= t0 || st.land > t1 || st.air) continue;
      const s = VR.actorAt(a, st.land);
      if (s.speed > 2.6 && (VR.hash(a.id, Math.round(st.land * 10)) % 3) === 0) audio.squeak(a.id);
    }
  }

  // ───────── frame loop ─────────
  function cameraMode() {
    if (S.phase === 'loading' || S.phase === 'welcome') return 'intro';
    if (S.phase === 'replay') return 'replay';
    if (reduced()) return 'play';
    if (wall < S.introUntil) return 'intro';
    if (S.phase === 'question') return 'freeze';
    if (S.phase === 'rally' && S.plan && S.plan.tFreeze - S.t < 0.9 && ['match', 'attack', 'block'].includes(S.mode)) return 'attack';
    if (S.phase === 'outcome' && S.lastPoint) return 'celebrate';
    return S.phase === 'resolve' ? 'resolve' : 'play';
  }
  function advance(dtw) {
    const p = S.plan;
    if (!p) return;
    const t0 = S.t;
    if (S.phase === 'welcome' || S.phase === 'ready') S.t = Math.min(S.t + dtw, p.tHold);
    else if (S.phase === 'rally') {
      const left = p.tFreeze - S.t;
      // Ease into the freeze (a short broadcast slow-down) so the ball stops without a hard cut.
      const scale = left < 0.45 ? Math.max(0.14, left / 0.45) : 1;
      S.t += dtw * scale;
      if (p.tFreeze - S.t < 1.15 && !S.timing && $('hit').hidden) { $('hit').textContent = HIT_LABEL[S.mode]; show('hit', true); }
      if (S.t >= p.tFreeze - 1e-6) { S.t = p.tFreeze; fireEvents(p, t0, S.t); ask(); return; }
    } else if (S.phase === 'resolve') {
      const k = Math.min(1, 0.15 + (wall - S.resumeWall) / 0.6);
      S.t += dtw * k;
      const end = p.tDead !== null ? p.tDead + 0.35 : p.tFreeze + 1;
      if (S.t >= end) { fireEvents(p, t0, S.t); point(); return; }
    } else if (S.phase === 'replay') {
      const r0 = S.replayT;
      S.replayT += dtw * 0.38;
      fireEvents(p, r0, S.replayT, true);
      if (S.replayT >= (p.tDead ?? p.tFreeze) + 0.3) endReplay();
      return;
    } else if (S.phase === 'outcome' || S.phase === 'finished') S.t = Math.min(S.t + dtw, p.tEnd);
    fireEvents(p, t0, S.t);
  }
  function tick(now) {
    frameId = requestAnimationFrame(tick);
    const raw = document.hidden ? 0 : Math.min((now - (prevNow || now)) / 1000, 0.1);
    prevNow = now;
    if (lostContext || S.paused) return;
    const dtw = raw * S.speed;
    wall += dtw;
    if (raw > 0) {
      S.frameMs.push(raw * 1000);
      if (S.frameMs.length >= 90) {
        const avg = S.frameMs.reduce((a, b) => a + b, 0) / S.frameMs.length;
        S.fps = Math.round(1000 / avg);
        S.frameMs.length = 0;
        if (prefs.quality === 'auto' && S.fps < 26 && world?.degrade) { const d = world.degrade(); if (d) S.degraded.push(d); }
      }
    }
    if (worldReady && S.phase !== 'loading') advance(dtw);
    // Test-only frame cap (?maxfps=) for software-GL capture runs; normal play renders every frame.
    if (S.maxFps && now - S.lastRender < 1000 / S.maxFps) return;
    S.lastRender = now;
    const wd = Math.min(0.25, wall - (S.lastRenderWall ?? wall)); S.lastRenderWall = wall;
    if (world && S.plan) world.frame({ t: S.phase === 'replay' ? S.replayT : S.t, dt: wd, wallDt: wd, wall, cam: cameraMode(), camT: wall });
  }

  // ───────── UI wiring ─────────
  function setAim(a) {
    if (S.phase !== 'ready' || !['left', 'center', 'right'].includes(a)) return;
    S.aim = a;
    document.querySelectorAll('[data-aim]').forEach((n) => { const on = n.dataset.aim === a; n.classList.toggle('selected', on); n.setAttribute('aria-checked', String(on)); });
  }
  function setShot(s) {
    if (S.phase !== 'ready' || !['spike', 'tip'].includes(s)) return;
    S.shot = s;
    document.querySelectorAll('[data-shot]').forEach((n) => { const on = n.dataset.shot === s; n.classList.toggle('selected', on); n.setAttribute('aria-checked', String(on)); });
  }
  function start() {
    if (S.phase !== 'welcome') return;
    const chosen = document.querySelector('input[name="mode"]:checked');
    S.mode = chosen && MODE_LABEL[chosen.value] ? chosen.value : 'match';
    if (!embedded && window.VolleyQuestionBank) S.total = Math.max(1, Math.min(30, bank().length));
    show('welcome', false); show('controls', true);
    audio?.unlock(); audio?.music(true); audio?.setCrowd(0.35, 0.2);
    audio?.whistle(true); audio?.announce('مرحبًا بكم في صالة مدرسة أبو عبيدة');
    world?.cue('intro');
    S.introUntil = wall + (reduced() ? 0 : 2.4);
    setTimeout(() => world?.cue('introEnd'), 2400);
    S.plan = null;
    reset();
  }
  function togglePanel(id) {
    const open = $(id).hidden;
    ['audioPanel', 'settingsPanel'].forEach((p) => show(p, false));
    show(id, open);
  }
  function applyAudioPrefs() {
    if (!audio) return;
    audio.setEnabled(prefs.audio.enabled !== false);
    audio.setVolume('sfx', prefs.audio.sfx ?? 0.9); audio.setVolume('crowd', prefs.audio.crowd ?? 0.6); audio.setVolume('music', prefs.audio.music ?? 0.35);
    audio.state.announcer = prefs.audio.announcer !== false;
    $('sound').setAttribute('aria-pressed', String(prefs.audio.enabled !== false));
  }
  function wire() {
    $('start').onclick = start;
    $('shoot').onclick = shoot;
    $('hit').onclick = hit;
    $('next').onclick = next;
    $('again').onclick = again;
    $('reopen').onclick = () => { if (S.phase === 'question') post('question'); };
    $('skipReplay').onclick = endReplay;
    $('sound').onclick = () => { audio?.unlock(); togglePanel('audioPanel'); };
    $('settings').onclick = () => togglePanel('settingsPanel');
    document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => show(b.dataset.close, false); });
    document.querySelectorAll('[data-aim]').forEach((b) => { b.onclick = () => setAim(b.dataset.aim); });
    document.querySelectorAll('[data-shot]').forEach((b) => { b.onclick = () => setShot(b.dataset.shot); });
    const bindRange = (id, key) => { const el = $(id); el.value = String(prefs.audio[key] ?? el.value); el.oninput = () => { prefs.audio[key] = Number(el.value); store.set('audio', prefs.audio); applyAudioPrefs(); }; };
    bindRange('volSfx', 'sfx'); bindRange('volCrowd', 'crowd'); bindRange('volMusic', 'music');
    $('audioOn').checked = prefs.audio.enabled !== false;
    $('audioOn').onchange = () => { prefs.audio.enabled = $('audioOn').checked; store.set('audio', prefs.audio); audio?.unlock(); applyAudioPrefs(); };
    $('announcer').checked = prefs.audio.announcer !== false;
    $('announcer').onchange = () => { prefs.audio.announcer = $('announcer').checked; store.set('audio', prefs.audio); applyAudioPrefs(); };
    $('ticking').checked = !!prefs.ticking;
    $('ticking').onchange = () => { prefs.ticking = $('ticking').checked; store.set('ticking', prefs.ticking); if (!prefs.ticking) audio?.stopTicking(); };
    $('replays').checked = !!prefs.replays;
    $('replays').onchange = () => { prefs.replays = $('replays').checked; store.set('replays', prefs.replays); };
    $('calmMotion').checked = !!prefs.calm;
    $('calmMotion').onchange = () => { prefs.calm = $('calmMotion').checked; store.set('calm', prefs.calm); };
    $('quality').value = prefs.quality;
    $('quality').onchange = () => { prefs.quality = $('quality').value; store.set('quality', prefs.quality); rebuildWorld(); };
    $('fullscreen').onclick = async () => {
      try {
        if (embedded) post('fullscreen');
        else if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const el = $('stadium'); await (el.requestFullscreen || el.webkitRequestFullscreen).call(el); }
      } catch (e) { instruct('دوّر الجهاز أفقيًا لمشهد أوسع.'); }
    };
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (['TEXTAREA', 'INPUT', 'SELECT'].includes(tag)) return;
      if (e.key === 'Escape') { ['audioPanel', 'settingsPanel'].forEach((p) => show(p, false)); if (S.phase === 'replay') endReplay(); return; }
      if (e.code === 'Space' && (e.target === document.body || !e.target || tag === 'CANVAS')) {
        e.preventDefault();
        if (S.phase === 'welcome') start(); else if (S.phase === 'ready') shoot(); else if (S.phase === 'rally') hit(); else if (S.phase === 'replay') endReplay();
        return;
      }
      if (S.phase === 'ready' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const order = ['right', 'center', 'left'], i = order.indexOf(S.aim);
        setAim(order[clamp(i + (e.key === 'ArrowRight' ? -1 : 1), 0, 2)]);
      }
      if (S.phase === 'ready' && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !$('shotGroup').hidden) setShot(S.shot === 'spike' ? 'tip' : 'spike');
      if (S.phase === 'question' && !embedded && /^[1-4١-٤]$/.test(e.key)) {
        const n = '١٢٣٤'.includes(e.key) ? '١٢٣٤'.indexOf(e.key) + 1 : Number(e.key);
        document.querySelector(`#choices [data-key="${n}"]`)?.click();
      }
      if (e.key === 'm' || e.key === 'M') { prefs.audio.enabled = prefs.audio.enabled === false; $('audioOn').checked = prefs.audio.enabled; store.set('audio', prefs.audio); audio?.unlock(); applyAudioPrefs(); }
      if ((e.key === 'f' || e.key === 'F') && !embedded) $('fullscreen').onclick();
    });
    document.addEventListener('visibilitychange', () => { prevNow = 0; audio?.suspend(document.hidden); });
    window.addEventListener('resize', () => world?.resize());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => world?.resize()).observe($('stadium'));
    window.addEventListener('pagehide', () => { cancelAnimationFrame(frameId); stopQuestionTimer(); try { world?.dispose(); } catch (e) { /* */ } audio?.dispose(); });
  }

  // ───────── boot ─────────
  function boot() {
    phase('loading');
    $('modeLabel').textContent = embedded ? 'جارٍ استلام مهمة المعلم…' : 'وضع تجريبي · أسئلة نموذجية لا تُسجّل في تقارير الطلاب';
    show('demoBadge', !embedded);
    if (!embedded) $('sumNote').textContent = window.VolleyQuestionBank ? 'تدريب دون اتصال: النتيجة على هذا الجهاز فقط ولا تُرسل إلى أي تقرير. التقييم الرسمي يتم عبر المنصة.' : 'وضع تجريبي: هذه نتيجتك الشخصية في هذه الجلسة فقط، ولا تُرسل إلى أي تقرير.';
    if (!embedded && window.VolleyQuestionBank) S.total = Math.max(1, Math.min(30, bank().length));
    audio = window.VolleyAudio ? window.VolleyAudio.create(prefs.audio) : null;
    applyAudioPrefs();
    wire();
    // Build after the loading overlay has painted.
    const build = () => {
      try {
        buildWorld();
        S.plan = makePlan(null);
        world.setPlan(S.plan);
        worldReady = true;
        ready();
      } catch (e) {
        console.error(e);
        show('loading', false); show('welcome', false); show('loadingError', true);
        $('errorText').textContent = 'تعذّر بناء المشهد على هذا الجهاز. أعد التحميل أو جرّب متصفحًا آخر.';
      }
    };
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => setTimeout(build, 0)); else build();
    frameId = requestAnimationFrame(tick);
    if (embedded) post('ready');
  }

  window.VolleyGame = {
    get phase() { return S.phase; }, get round() { return S.round; }, get total() { return S.total; }, get goals() { return S.goals; }, get misses() { return S.misses; },
    get pending() { return S.pending; }, get pendingCount() { return S.pendingCount; }, get t() { return S.t; }, get plan() { return S.plan; }, get mode() { return S.mode; },
    get questionsAsked() { return S.questionsAsked; }, get outcomesPosted() { return S.outcomesPosted; }, get fps() { return S.fps; }, get timing() { return S.timing; },
    get world() { return world; }, get audio() { return audio; },
    // Test/capture hooks: pause the loop so a screenshot can be taken between frames.
    pause(on) { S.paused = !!on; prevNow = 0; },
    renderNow() { if (world && S.plan) world.frame({ t: S.phase === 'replay' ? S.replayT : S.t, dt: 0, wallDt: 0, wall, cam: cameraMode(), camT: wall }); },
    snapshot: () => ({ phase: S.phase, round: S.round, goals: S.goals, misses: S.misses, t: S.t, fps: S.fps, degraded: S.degraded.slice(), ...(world ? world.snapshot() : {}) }),
  };
  boot();
})();
