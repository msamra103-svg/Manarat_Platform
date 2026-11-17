import { createRng } from '../core/random.js';

// نموذج سباق الخيل بالحواجز — حتمي ومنفصل تمامًا عن العرض والصوت والأسئلة.
//
// التسلسل: جري نحو الحاجز ← نقطة السؤال (قبل الحاجز بـ CP_DIST) والسباق كله متجمد ←
//   إجابة صحيحة: يكمل الحصان ويقفز الحاجز.
//   إجابة خاطئة: «رفض» — يكبح الحصان ويتوقف أمام الحاجز، يستدير ويعود قليلًا ثم يقترب من جديد،
//                والمنافسون يواصلون الجري، ثم يُعاد السؤال. لا يُتخطى الحاجز إلا بإجابة صحيحة.
// بعد آخر حاجز: اندفاع ختامي نحو خط النهاية.
// التكامل بخطوة ثابتة (1/120 ث) يجعل النتيجة مستقلة عن معدل الإطارات.
//
// العدالة:
// - المنافسون يجرون بمضاعفات سرعة ثابتة تُحسب كنسبة من «أقصى أفضلية» للاعب يجيب عن الكل صحيحًا من أول محاولة.
// - الإجابة الصحيحة من أول محاولة تمنح اندفاعة في المقطع التالي؛ الصحيحة بعد رفض لا تمنحها.
// - خط النهاية يُثبَّت لحظة تطبيق آخر إجابة صحيحة وأمام المتصدر، فلا يعبره أحد قبل ذلك.

export const STEP = 1 / 120;

export const DIFFICULTY = {
  // fractions: سرعة المنافس كنسبة من أقصى أفضلية للاعب. refusals: عدد الحواجز التي يرفضها كل منافس (لكل 6 حواجز)
  // — كما في السباقات الحقيقية، خيول المنافسين ترفض أحيانًا؛ الأسرع أقل رفضًا.
  easy: { fractions: [-0.5, -0.3, -0.1, 0.1, 0.3], refusals: [4, 3, 3, 2, 2], label: 'سهل' },
  normal: { fractions: [-0.15, 0.1, 0.3, 0.48, 0.64], refusals: [3, 2, 2, 1, 1], label: 'متوسط' },
  hard: { fractions: [0.12, 0.36, 0.56, 0.74, 0.86], refusals: [2, 1, 1, 0, 0], label: 'صعب' },
};

// هندسة القفزة (بالأمتار)
export const JUMP = {
  cpDist: 7.0, // نقطة السؤال قبل الحاجز
  takeoff: 2.1, // نقطة الارتقاء قبل الحاجز
  span: 4.4, // طول القفزة الأفقي من الارتقاء إلى هبوط الأماميتين
};

// سيناريو الرفض (ثوانٍ): كبح ← استدارة ← عودة ← استدارة ← اقتراب
export const REFUSAL = { brake: 0.6, turn1: 0.4, back: 0.85, turn2: 0.4, approach: 0.55, backDist: 5.0, approachDist: 3.0, endSpeed: 8 };
REFUSAL.total = REFUSAL.brake + REFUSAL.turn1 + REFUSAL.back + REFUSAL.turn2 + REFUSAL.approach;

const LANES = [-6.6, -3.95, -1.3, 1.35, 4.0, 6.65];
const ease = (t) => t * t * (3 - 2 * t);

export function createRaceModel(opts = {}) {
  const cfg = {
    questionCount: Math.max(1, opts.questionCount ?? 6),
    segmentSeconds: Math.min(8, Math.max(4, opts.segmentSeconds ?? 6)),
    sprintSeconds: Math.min(6, Math.max(3, opts.sprintSeconds ?? 4)),
    baseSpeed: opts.baseSpeed ?? 13, // م/ث (~47 كم/س، سرعة سباقات الحواجز)
    boost: opts.boost ?? 0.12,
    competitors: Math.min(5, Math.max(1, opts.competitors ?? 5)),
    difficulty: DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal',
    seed: opts.seed ?? 12345,
    accelTau: 0.65,
    startTau: 0.9,
    noiseAmp: 0.0035,
    playerLane: opts.playerLane ?? 2,
  };
  cfg.segmentSteps = Math.round(cfg.segmentSeconds / STEP);
  cfg.sprintSteps = Math.round(cfg.sprintSeconds / STEP);
  cfg.refusalSteps = Math.round(REFUSAL.total / STEP);

  // ---- معايرة: لاعب يجيب الكل صحيحًا من أول محاولة مقابل لاعب بلا اندفاعات ----
  function dryRun(allCorrect) {
    let v = 0, d = 0;
    const steps = cfg.segmentSteps * cfg.questionCount + cfg.sprintSteps;
    let dAtFirst = 0;
    for (let s = 0; s < steps; s++) {
      const seg = Math.floor(s / cfg.segmentSteps);
      if (s === cfg.segmentSteps) dAtFirst = d;
      const mult = seg >= 1 && allCorrect ? 1 + cfg.boost : 1;
      const tau = s * STEP < 2 ? cfg.startTau : cfg.accelTau;
      v += (cfg.baseSpeed * mult - v) * (1 - Math.exp(-STEP / tau));
      d += v * STEP;
    }
    return { d, dAtFirst };
  }
  const correctRun = dryRun(true);
  const wrongRun = dryRun(false);
  const maxAdvantage = correctRun.d / wrongRun.d - 1;

  const rng = createRng(cfg.seed);
  const fractions = DIFFICULTY[cfg.difficulty].fractions.slice(5 - cfg.competitors);
  const refCounts = DIFFICULTY[cfg.difficulty].refusals.slice(5 - cfg.competitors);
  const shuffled = fractions.map((f, i) => ({ f, n: refCounts[i], r: rng.next() })).sort((a, b) => a.r - b.r);
  const compMult = shuffled.map((o) => 1 + o.f * maxAdvantage);
  // الحواجز التي يرفضها كل منافس (اختيار حتمي من البذرة، متناسب مع عدد الحواجز)
  const compRefusals = shuffled.map((o) => {
    const n = Math.min(cfg.questionCount, Math.round((o.n * cfg.questionCount) / 6));
    const idx = Array.from({ length: cfg.questionCount }, (_, k) => ({ k, r: rng.next() })).sort((a, b) => a.r - b.r).slice(0, n).map((e) => e.k);
    return new Set(idx);
  });

  // ---- مواضع الحواجز: الأول بعد مدة مقطع من الانطلاق، ثم بمسافات متساوية ----
  const spacing = cfg.baseSpeed * cfg.segmentSeconds;
  const fences = [];
  for (let k = 0; k < cfg.questionCount; k++) fences.push(Math.round((wrongRun.dAtFirst + JUMP.cpDist + k * spacing) * 10) / 10);
  const lastFence = fences[fences.length - 1];
  let finishX = Math.ceil(lastFence + cfg.baseSpeed * 1.1 * cfg.sprintSeconds); // تقدير مبدئي للعرض
  let finishPlaced = false;
  const SPRINT_KICK = 1.1;

  const lanes = LANES.slice(0, cfg.competitors + 1);
  const playerLane = Math.min(lanes.length - 1, cfg.playerLane);
  const racers = [];
  let ci = 0;
  for (let i = 0; i < lanes.length; i++) {
    const isPlayer = i === playerLane;
    racers.push({
      id: isPlayer ? 'player' : `c${ci + 1}`,
      isPlayer, lane: i, homeZ: lanes[i], z: lanes[i], zVel: 0,
      d: 0, v: 0, heading: 0, // heading: زاوية الاتجاه (0 = للأمام، π = للخلف أثناء الرفض)
      gaitDelta: 0, // المسافة المقطوعة فعليًا في آخر خطوة (لتحريك الأرجل حتى عند العودة للخلف)
      mult: isPlayer ? 1 : compMult[ci], baseMult: isPlayer ? 1 : compMult[ci],
      noisePh: [rng.next() * 6.28, rng.next() * 6.28],
      noiseW: [0.31 + rng.next() * 0.2, 0.71 + rng.next() * 0.3],
      wanderPh: rng.next() * 6.28,
      nextFence: 0,
      finished: false, finishTime: null, boostActive: false, refusing: false, refusal: null,
      refuseAt: isPlayer ? null : compRefusals[ci],
    });
    if (!isPlayer) ci++;
  }
  const player = racers.find((r) => r.isPlayer);

  const state = {
    phase: 'ready', // ready | segment | checkpoint | refusal | sprint | finished
    segmentIndex: -1, // رقم الحاجز/السؤال الجاري
    attempt: 1, // رقم المحاولة على السؤال الحالي
    stepsLeft: 0,
    time: 0,
    sprintK: 1,
    answers: [], // لكل سؤال: { attempts, firstTry }
    wrongAttempts: 0,
    finishOrder: [],
    acc: 0,
    pendingEvents: [],
  };

  function targetSpeed(r) {
    if (r.finished && r.d > model.finishX + 2) return cfg.baseSpeed * 0.55;
    let m = r.mult;
    if (!r.isPlayer) m *= 1 + cfg.noiseAmp * (0.6 * Math.sin(r.noiseW[0] * state.time + r.noisePh[0]) + 0.4 * Math.sin(r.noiseW[1] * state.time + r.noisePh[1]));
    return cfg.baseSpeed * m * (state.phase === 'sprint' || state.phase === 'finished' ? state.sprintK : 1);
  }

  function advance(r, events) {
    const tau = state.time < 2 ? cfg.startTau : cfg.accelTau;
    const vt = targetSpeed(r);
    r.v += (vt - r.v) * (1 - Math.exp(-STEP / tau));
    const prev = r.d;
    r.d += r.v * STEP;
    r.gaitDelta = r.v * STEP;
    // أحداث الارتقاء (للصوت والغبار)
    if (r.nextFence < fences.length) {
      const tk = fences[r.nextFence] - JUMP.takeoff;
      if (prev < tk && r.d >= tk) { events.push({ type: 'takeoff', id: r.id, fence: r.nextFence }); r.airFence = r.nextFence; }
    }
    if (r.airFence !== undefined && r.airFence !== null) {
      const ld = fences[r.airFence] - JUMP.takeoff + JUMP.span;
      if (prev < ld && r.d >= ld) { events.push({ type: 'land', id: r.id, fence: r.airFence }); r.nextFence = r.airFence + 1; r.airFence = null; }
    }
    const F = finishPlaced ? model.finishX : Infinity;
    if (!r.finished && prev < F && r.d >= F) {
      r.finished = true;
      r.finishTime = state.time + STEP * ((F - prev) / (r.d - prev));
      state.finishOrder.push(r.id);
      events.push({ type: 'cross', id: r.id, time: r.finishTime });
    }
  }

  // حركة الحصان المبرمجة أثناء الرفض (للاعب وللمنافسين)
  function beginRefusal(r) {
    r.refusal = { t: 0, d0: r.d, v0: r.v };
    r.refusing = true;
  }
  function refusalStep(r) {
    const player = r;
    const R = r.refusal;
    R.t += STEP;
    const t = R.t;
    const prev = player.d;
    // يتوقف دائمًا قبل نقطة الارتقاء بمسافة أمان، مهما تكرر الرفض أو زادت السرعة
    const limit = fences[Math.min(fences.length - 1, r.nextFence)] - JUMP.takeoff - 0.9;
    const brakeDist = Math.max(0.2, Math.min((R.v0 * REFUSAL.brake) / 2, limit - R.d0));
    const stopD = R.d0 + brakeDist;
    let d, v, heading;
    const t1 = REFUSAL.brake, t2 = t1 + REFUSAL.turn1, t3 = t2 + REFUSAL.back, t4 = t3 + REFUSAL.turn2;
    if (t < t1) { const k = t / t1; d = R.d0 + brakeDist * (2 * k - k * k); v = R.v0 * (1 - k); heading = 0; }
    else if (t < t2) { d = stopD; v = 0; heading = Math.PI * ease((t - t1) / REFUSAL.turn1); }
    else if (t < t3) { const k = (t - t2) / REFUSAL.back; d = stopD - REFUSAL.backDist * ease(k); v = (REFUSAL.backDist / REFUSAL.back) * 6 * k * (1 - k); heading = Math.PI; }
    else if (t < t4) { d = stopD - REFUSAL.backDist; v = 0; heading = Math.PI * (1 + ease((t - t3) / REFUSAL.turn2)); }
    else { const k = Math.min(1, (t - t4) / REFUSAL.approach); d = stopD - REFUSAL.backDist + REFUSAL.approachDist * k * k; v = REFUSAL.endSpeed * k; heading = 0; }
    player.d = d; player.v = v; player.heading = heading;
    player.gaitDelta = Math.abs(d - prev);
  }

  function integrateStep(events) {
    for (const r of racers) {
      if (r.refusing) {
        refusalStep(r);
        if (!r.isPlayer && r.refusal.t >= REFUSAL.total) { r.refusing = false; r.refusal = null; r.heading = 0; r.v = REFUSAL.endSpeed; }
        continue;
      }
      // المنافس يرفض الحاجز المحدد له عند نقطة الاقتراب
      if (!r.isPlayer && r.nextFence < fences.length && r.refuseAt.has(r.nextFence) && r.d >= fences[r.nextFence] - JUMP.cpDist) {
        r.refuseAt.delete(r.nextFence);
        beginRefusal(r);
        events.push({ type: 'refusal', id: r.id, fence: r.nextFence });
        continue;
      }
      advance(r, events);
    }
    lateralStep();
    state.time += STEP;
  }

  function lateralStep() {
    for (const r of racers) {
      let target = r.homeZ + 0.25 * Math.sin(0.23 * state.time + r.wanderPh);
      for (const o of racers) {
        if (o === r) continue;
        const dd = Math.abs(o.d - r.d), dz = r.z - o.z;
        if (dd < 4 && Math.abs(dz) < 1.9) target += (dz >= 0 ? 1 : -1) * (1.9 - Math.abs(dz)) * 1.2;
      }
      target = Math.max(-8.6, Math.min(8.6, target));
      const desired = Math.max(-0.8, Math.min(0.8, (target - r.z) * 1.5));
      r.zVel += (desired - r.zVel) * Math.min(1, STEP * 4);
      r.z += r.zVel * STEP;
    }
  }

  const cpX = (k) => fences[k] - JUMP.cpDist;

  function step(dt) {
    const events = state.pendingEvents.splice(0);
    if (!['segment', 'refusal', 'sprint', 'finished'].includes(state.phase)) return events;
    state.acc += Math.min(dt, 0.25);
    while (state.acc >= STEP) {
      state.acc -= STEP;
      integrateStep(events);
      if (state.phase === 'segment') {
        if (player.d >= cpX(state.segmentIndex)) {
          state.phase = 'checkpoint';
          state.acc = 0;
          events.push({ type: 'checkpoint', index: state.segmentIndex, attempt: state.attempt });
          break;
        }
      } else if (state.phase === 'refusal') {
        if (--state.stepsLeft <= 0) {
          player.refusing = false;
          player.heading = 0;
          player.v = REFUSAL.endSpeed;
          player.refusal = null;
          state.phase = 'checkpoint';
          state.acc = 0;
          events.push({ type: 'checkpoint', index: state.segmentIndex, attempt: state.attempt });
          break;
        }
      } else if (state.phase === 'sprint' && racers.every((r) => r.finished)) {
        state.phase = 'finished';
        events.push({ type: 'allFinished' });
      }
    }
    return events;
  }

  function startSegment() {
    state.segmentIndex++;
    state.attempt = 1;
    state.phase = 'segment';
    state.acc = 0;
  }

  function placeFinish() {
    let lead = racers[0];
    for (const r of racers) if (r.d > lead.d) lead = r;
    const leadBase = lead.isPlayer ? 1 : lead.mult;
    const sprintDist = cfg.baseSpeed * leadBase * SPRINT_KICK * cfg.sprintSeconds;
    // أمام المتصدر بمسافة الاندفاع، وبعد آخر حاجز بمسافة كافية للهبوط والعدو
    model.finishX = Math.ceil(Math.max(lead.d + Math.max(sprintDist, 30), lastFence + JUMP.span + 28));
    finishPlaced = true;
    state.pendingEvents.push({ type: 'finishPlaced', x: model.finishX });
  }

  function startSprint() {
    placeFinish();
    state.phase = 'sprint';
    state.acc = 0;
    let lead = racers[0];
    for (const r of racers) if (r.d > lead.d) lead = r;
    const k = (model.finishX - lead.d) / (cfg.baseSpeed * lead.mult * cfg.sprintSeconds);
    state.sprintK = Math.min(1.3, Math.max(1.0, k));
  }

  const model = {
    config: cfg,
    finishX,
    fences,
    get finishPlaced() { return finishPlaced; },
    racers, player, state,
    calibration: { maxAdvantage, compMult: compMult.slice(), compRefusals: compRefusals.map((s) => [...s]), correctRun, wrongRun },
    step,
    start() { if (state.phase === 'ready') startSegment(); },
    // تسجيل نتيجة محاولة على سؤال الحاجز الحالي (لا يحرك أحدًا)
    recordAnswer(index, correct) {
      if (state.phase !== 'checkpoint' || index !== state.segmentIndex) return false;
      if (state.pendingResult !== undefined) return false;
      state.pendingResult = !!correct;
      if (correct) state.answers[index] = { attempts: state.attempt, firstTry: state.attempt === 1 };
      else state.wrongAttempts++;
      return true;
    },
    // استئناف بعد التغذية الراجعة: قفز ومتابعة، أو رفض وإعادة محاولة
    resume() {
      if (state.phase !== 'checkpoint' || state.pendingResult === undefined) return null;
      const ok = state.pendingResult;
      state.pendingResult = undefined;
      if (!ok) {
        state.attempt++;
        state.phase = 'refusal';
        state.stepsLeft = cfg.refusalSteps;
        state.acc = 0;
        beginRefusal(player);
        player.mult = 1; player.boostActive = false;
        return 'refusal';
      }
      const first = state.answers[state.segmentIndex].firstTry;
      player.mult = first ? 1 + cfg.boost : 1;
      player.boostActive = first;
      if (state.segmentIndex + 1 < cfg.questionCount) { startSegment(); return 'jump'; }
      startSprint();
      return 'jump';
    },
    isFrozen() { return state.phase === 'checkpoint' || state.phase === 'ready'; },
    predictCheckpointX() { return state.phase === 'segment' ? cpX(state.segmentIndex) : null; },
    // تقدّم القفزة لمتسابق: null خارج القفزة، وإلا { u, fence } حيث u من 0 (ارتقاء) إلى ~1.15 (اكتمال الهبوط)
    jumpProgress(r) {
      if (r.refusing) return null;
      for (let k = Math.max(0, r.nextFence - 1); k < fences.length && k <= r.nextFence; k++) {
        const u = (r.d - (fences[k] - JUMP.takeoff)) / JUMP.span;
        if (u > 0 && u < 1.15) return { u, fence: k };
      }
      return null;
    },
    standings() {
      const list = racers.slice().sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.d - a.d;
      });
      let rank = 0, prevTime = null, prevD = null;
      return list.map((r, i) => {
        const tie = r.finished && prevTime !== null && Math.abs(r.finishTime - prevTime) < 0.001;
        const tieD = !r.finished && prevD !== null && Math.abs(r.d - prevD) < 0.0005;
        if (!(tie || tieD)) rank = i + 1;
        prevTime = r.finished ? r.finishTime : null;
        prevD = r.finished ? null : r.d;
        return { id: r.id, isPlayer: r.isPlayer, rank, d: r.d, finished: r.finished, finishTime: r.finishTime };
      });
    },
    // للاختبارات: answers[k] = عدد المحاولات الخاطئة قبل الصحيحة (أو true/false: false = خطأ واحد)
    simulateAll(answers) {
      const evts = [];
      const wrongs = answers.map((a) => (a === true ? 0 : a === false ? 1 : a | 0));
      this.start();
      let guard = 0;
      while (state.phase !== 'finished' && guard++ < 400000) {
        const e = step(STEP);
        evts.push(...e);
        for (const ev of e) {
          if (ev.type === 'checkpoint') {
            this.recordAnswer(ev.index, ev.attempt > (wrongs[ev.index] ?? 0));
            this.resume();
          }
        }
      }
      return evts;
    },
  };
  return model;
}
