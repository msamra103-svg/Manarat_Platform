import { createRng } from "../core/random.mjs";
const STEP = 1 / 120;
const DIFFICULTY = {
  // كسور من أقصى أفضلية للاعب المجيب عن الكل صحيحًا
  easy: { fractions: [-0.5, -0.3, -0.1, 0.1, 0.3], label: "سهل" },
  normal: { fractions: [-0.15, 0.1, 0.3, 0.48, 0.64], label: "متوسط" },
  hard: { fractions: [0.12, 0.36, 0.56, 0.74, 0.86], label: "صعب" }
};
const LANES = [-6.6, -3.95, -1.3, 1.35, 4, 6.65];
function createRaceModel(opts = {}) {
  const cfg = {
    questionCount: Math.max(1, opts.questionCount ?? 6),
    segmentSeconds: Math.min(8, Math.max(4, opts.segmentSeconds ?? 6)),
    sprintSeconds: Math.min(6, Math.max(3, opts.sprintSeconds ?? 4)),
    baseSpeed: opts.baseSpeed ?? 12,
    // م/ث (~43 كم/س)
    boost: opts.boost ?? 0.12,
    // تسارع الإجابة الصحيحة (+12%)
    competitors: Math.min(5, Math.max(1, opts.competitors ?? 5)),
    difficulty: DIFFICULTY[opts.difficulty] ? opts.difficulty : "normal",
    seed: opts.seed ?? 12345,
    accelTau: 0.65,
    startTau: 0.9,
    noiseAmp: 35e-4,
    playerLane: opts.playerLane ?? 2
  };
  cfg.segmentSteps = Math.round(cfg.segmentSeconds / STEP);
  cfg.sprintSteps = Math.round(cfg.sprintSeconds / STEP);
  function dryRun(allCorrect) {
    let v = 0, d = 0, mult = 1;
    const steps = cfg.segmentSteps * cfg.questionCount + cfg.sprintSteps;
    let dAtSprint = 0;
    for (let s = 0; s < steps; s++) {
      const seg = Math.floor(s / cfg.segmentSteps);
      if (s === cfg.segmentSteps * cfg.questionCount) dAtSprint = d;
      mult = seg >= 1 && allCorrect ? 1 + cfg.boost : 1;
      const tau = s * STEP < 2 ? cfg.startTau : cfg.accelTau;
      v += (cfg.baseSpeed * mult - v) * (1 - Math.exp(-STEP / tau));
      d += v * STEP;
    }
    return { d, dAtSprint };
  }
  const correctRun = dryRun(true);
  const wrongRun = dryRun(false);
  const maxAdvantage = correctRun.d / wrongRun.d - 1;
  const rng = createRng(cfg.seed);
  const fractions = DIFFICULTY[cfg.difficulty].fractions.slice(5 - cfg.competitors);
  const order = fractions.map((f, i) => ({ f, r: rng.next(), i })).sort((a, b) => a.r - b.r).map((o) => o.f);
  const compMult = order.map((f) => 1 + f * maxAdvantage);
  const cMax = Math.max(...compMult) * (1 + cfg.noiseAmp);
  const typicalAtSprint = Math.max(cMax * wrongRun.dAtSprint, (correctRun.dAtSprint + wrongRun.dAtSprint) / 2);
  let finishX = Math.ceil(typicalAtSprint + cfg.baseSpeed * cfg.sprintSeconds * 1.1);
  let finishPlaced = false;
  const SPRINT_KICK = 1.1;
  const lanes = LANES.slice(0, cfg.competitors + 1);
  const playerLane = Math.min(lanes.length - 1, cfg.playerLane);
  const racers = [];
  let ci = 0;
  for (let i = 0; i < lanes.length; i++) {
    const isPlayer = i === playerLane;
    racers.push({
      id: isPlayer ? "player" : `c${ci + 1}`,
      isPlayer,
      lane: i,
      homeZ: lanes[i],
      z: lanes[i],
      zVel: 0,
      d: 0,
      v: 0,
      mult: isPlayer ? 1 : compMult[ci],
      baseMult: isPlayer ? 1 : compMult[ci],
      noisePh: [rng.next() * 6.28, rng.next() * 6.28],
      noiseW: [0.31 + rng.next() * 0.2, 0.71 + rng.next() * 0.3],
      wanderPh: rng.next() * 6.28,
      finished: false,
      finishTime: null,
      boostActive: false
    });
    if (!isPlayer) ci++;
  }
  const player = racers.find((r) => r.isPlayer);
  const state = {
    phase: "ready",
    // ready | segment | checkpoint | sprint | finished
    segmentIndex: -1,
    // رقم المقطع الجاري (0 = المقطع قبل السؤال الأول)
    stepsLeft: 0,
    time: 0,
    sprintK: 1,
    answers: [],
    // صحيح/خطأ لكل سؤال
    finishOrder: [],
    acc: 0,
    pendingEvents: []
  };
  function targetSpeed(r) {
    if (r.finished && r.d > model.finishX + 2) {
      return cfg.baseSpeed * 0.55;
    }
    let m = r.mult;
    if (!r.isPlayer) {
      m *= 1 + cfg.noiseAmp * (0.6 * Math.sin(r.noiseW[0] * state.time + r.noisePh[0]) + 0.4 * Math.sin(r.noiseW[1] * state.time + r.noisePh[1]));
    }
    return cfg.baseSpeed * m * (state.phase === "sprint" || state.phase === "finished" ? state.sprintK : 1);
  }
  function integrateStep(events) {
    const tau = state.time < 2 ? cfg.startTau : cfg.accelTau;
    const a = 1 - Math.exp(-STEP / tau);
    for (const r of racers) {
      const vt = targetSpeed(r);
      r.v += (vt - r.v) * a;
      const prev = r.d;
      r.d += r.v * STEP;
      const F = finishPlaced ? model.finishX : Infinity;
      if (!r.finished && prev < F && r.d >= F) {
        r.finished = true;
        r.finishTime = state.time + STEP * ((F - prev) / (r.d - prev));
        state.finishOrder.push(r.id);
        events.push({ type: "cross", id: r.id, time: r.finishTime });
      }
    }
    lateralStep();
    state.time += STEP;
  }
  function lateralStep() {
    for (const r of racers) {
      let target = r.homeZ + 0.35 * Math.sin(0.23 * state.time + r.wanderPh);
      for (const o of racers) {
        if (o === r) continue;
        const dd = Math.abs(o.d - r.d), dz = r.z - o.z;
        if (dd < 4 && Math.abs(dz) < 1.8) target += (dz >= 0 ? 1 : -1) * (1.8 - Math.abs(dz)) * 1.2;
      }
      target = Math.max(-9, Math.min(9, target));
      const desired = Math.max(-0.9, Math.min(0.9, (target - r.z) * 1.5));
      r.zVel += (desired - r.zVel) * Math.min(1, STEP * 4);
      r.z += r.zVel * STEP;
    }
  }
  function step(dt) {
    const events = state.pendingEvents.splice(0);
    if (state.phase !== "segment" && state.phase !== "sprint" && state.phase !== "finished") return events;
    state.acc += Math.min(dt, 0.25);
    while (state.acc >= STEP) {
      state.acc -= STEP;
      if (state.phase === "segment") {
        integrateStep(events);
        state.stepsLeft--;
        if (state.stepsLeft <= 0) {
          state.phase = "checkpoint";
          state.acc = 0;
          events.push({ type: "checkpoint", index: state.segmentIndex });
          break;
        }
      } else if (state.phase === "sprint" || state.phase === "finished") {
        integrateStep(events);
        if (state.phase === "sprint" && racers.every((r) => r.finished)) {
          state.phase = "finished";
          events.push({ type: "allFinished" });
        }
      }
    }
    return events;
  }
  function startSegment() {
    state.segmentIndex++;
    state.phase = "segment";
    state.stepsLeft = cfg.segmentSteps;
    state.acc = 0;
    applyPlayerMultiplier();
    if (state.segmentIndex === cfg.questionCount - 1) placeFinish();
  }
  function predictPositionsAtSegmentEnd() {
    const sim = racers.map((r) => ({ r, v: r.v, d: r.d }));
    let t = state.time;
    for (let s = 0; s < state.stepsLeft; s++) {
      const tau = t < 2 ? cfg.startTau : cfg.accelTau;
      const a = 1 - Math.exp(-STEP / tau);
      for (const o of sim) {
        let m = o.r.mult;
        if (!o.r.isPlayer) m *= 1 + cfg.noiseAmp * (0.6 * Math.sin(o.r.noiseW[0] * t + o.r.noisePh[0]) + 0.4 * Math.sin(o.r.noiseW[1] * t + o.r.noisePh[1]));
        o.v += (cfg.baseSpeed * m - o.v) * a;
        o.d += o.v * STEP;
      }
      t += STEP;
    }
    return sim;
  }
  function placeFinish() {
    const sim = predictPositionsAtSegmentEnd();
    let lead = sim[0];
    for (const o of sim) if (o.d > lead.d) lead = o;
    const leadBaseMult = lead.r.isPlayer ? 1 : lead.r.mult;
    const sprintDist = cfg.baseSpeed * leadBaseMult * SPRINT_KICK * cfg.sprintSeconds;
    model.finishX = Math.ceil(lead.d + Math.max(sprintDist, 30));
    finishPlaced = true;
    state.pendingEvents.push({ type: "finishPlaced", x: model.finishX });
  }
  function applyPlayerMultiplier() {
    const prev = state.answers[state.segmentIndex - 1] ?? state.answers[state.answers.length - 1];
    const lastAnswerIndex = state.phase === "sprint" ? cfg.questionCount - 1 : state.segmentIndex - 1;
    const correct = lastAnswerIndex >= 0 ? !!state.answers[lastAnswerIndex] : false;
    void prev;
    player.mult = correct ? 1 + cfg.boost : 1;
    player.boostActive = correct;
  }
  function startSprint() {
    state.phase = "sprint";
    state.acc = 0;
    applyPlayerMultiplier();
    let lead = racers[0];
    for (const r of racers) if (r.d > lead.d) lead = r;
    const vLead = cfg.baseSpeed * lead.mult;
    const k = (model.finishX - lead.d) / (vLead * cfg.sprintSeconds);
    state.sprintK = Math.min(1.3, Math.max(1, k));
  }
  const model = {
    config: cfg,
    finishX,
    get finishPlaced() {
      return finishPlaced;
    },
    racers,
    player,
    state,
    calibration: { maxAdvantage, compMult: compMult.slice(), correctRun, wrongRun },
    step,
    // بدء السباق بعد العد التنازلي
    start() {
      if (state.phase !== "ready") return;
      startSegment();
    },
    // تسجيل نتيجة سؤال المرحلة الحالية (لا يحرك أحدًا)
    recordAnswer(index, correct) {
      if (state.phase !== "checkpoint" || index !== state.segmentIndex) return false;
      state.answers[index] = !!correct;
      return true;
    },
    // استئناف بعد التغذية الراجعة
    resume() {
      if (state.phase !== "checkpoint") return;
      if (state.answers[state.segmentIndex] === void 0) return;
      if (state.segmentIndex + 1 < cfg.questionCount) startSegment();
      else startSprint();
    },
    isFrozen() {
      return state.phase === "checkpoint" || state.phase === "ready";
    },
    // توقع موضع اللاعب في نهاية المقطع الحالي (لوضع علامة المرحلة بدقة)
    predictCheckpointX() {
      if (state.phase !== "segment") return null;
      let v = player.v, d = player.d, t = state.time;
      for (let s = 0; s < state.stepsLeft; s++) {
        const tau = t < 2 ? cfg.startTau : cfg.accelTau;
        v += (cfg.baseSpeed * player.mult - v) * (1 - Math.exp(-STEP / tau));
        d += v * STEP;
        t += STEP;
      }
      return d;
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
        const tie = r.finished && prevTime !== null && Math.abs(r.finishTime - prevTime) < 1e-3;
        const tieD = !r.finished && prevD !== null && Math.abs(r.d - prevD) < 5e-4;
        if (!(tie || tieD)) rank = i + 1;
        prevTime = r.finished ? r.finishTime : null;
        prevD = r.finished ? null : r.d;
        return { id: r.id, isPlayer: r.isPlayer, rank, d: r.d, finished: r.finished, finishTime: r.finishTime };
      });
    },
    // للاختبارات: محاكاة كاملة سريعة بمجموعة إجابات
    simulateAll(answers) {
      const evts = [];
      this.start();
      let guard = 0;
      while (state.phase !== "finished" && guard++ < 1e5) {
        const e = step(STEP);
        evts.push(...e);
        for (const ev of e) {
          if (ev.type === "checkpoint") {
            this.recordAnswer(ev.index, answers[ev.index]);
            this.resume();
          }
        }
      }
      return evts;
    }
  };
  return model;
}
export {
  DIFFICULTY,
  STEP,
  createRaceModel
};
