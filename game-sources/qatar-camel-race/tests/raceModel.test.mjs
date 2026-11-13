import { createRaceModel, STEP } from "../src/race/raceModel.mjs";
let failures = 0, passes = 0;
const check = (cond, msg) => {
  if (cond) passes++;
  else {
    failures++;
    console.log("FAIL:", msg);
  }
};
function run(opts, answers) {
  const m = createRaceModel(opts);
  const N = m.config.questionCount;
  let lastCheckpointTime = null, sprintStart = null, firstCross = null;
  let minLateralGap = Infinity, backwards = false, frozenMoved = false;
  const prevD = new Map(m.racers.map((r) => [r.id, 0]));
  m.start();
  let guard = 0;
  while (m.state.phase !== "finished" && guard++ < 2e5) {
    const ev = m.step(STEP);
    for (const r of m.racers) {
      if (r.d < prevD.get(r.id) - 1e-9) backwards = true;
      prevD.set(r.id, r.d);
    }
    for (let i = 0; i < m.racers.length; i++) for (let j = i + 1; j < m.racers.length; j++) {
      const a = m.racers[i], b = m.racers[j];
      if (Math.abs(a.d - b.d) < 3.2) minLateralGap = Math.min(minLateralGap, Math.abs(a.z - b.z));
    }
    for (const e of ev) {
      if (e.type === "checkpoint") {
        lastCheckpointTime = m.state.time;
        const snap = m.racers.map((r) => r.d);
        m.step(5);
        m.step(30);
        if (m.racers.some((r, i) => r.d !== snap[i])) frozenMoved = true;
        m.recordAnswer(e.index, answers[e.index]);
        m.resume();
        if (e.index === N - 1) sprintStart = m.state.time;
      }
      if (e.type === "cross" && firstCross === null) firstCross = e.time;
    }
  }
  const st = m.standings();
  const playerRank = st.find((s) => s.isPlayer).rank;
  const orderByTime = m.racers.slice().sort((a, b) => a.finishTime - b.finishTime).map((r) => r.id);
  return { m, playerRank, sprintStart, firstCross, lastCheckpointTime, minLateralGap, backwards, frozenMoved, orderByTime, st };
}
const all = (n, v) => Array.from({ length: n }, () => v);
const summary = {};
for (const difficulty of ["easy", "normal", "hard"]) {
  for (const N of [1, 2, 3, 6, 8, 10]) {
    for (const T of [4, 6, 8]) {
      for (let seed = 1; seed <= 12; seed++) {
        const opts = { questionCount: N, segmentSeconds: T, difficulty, seed };
        const good = run(opts, all(N, true));
        const bad = run(opts, all(N, false));
        const key = `${difficulty}`;
        summary[key] ??= { good: [], bad: [] };
        summary[key].good.push(good.playerRank);
        summary[key].bad.push(bad.playerRank);
        for (const r of [good, bad]) {
          check(r.firstCross > r.sprintStart - 1e-9, `no one crosses before last answer applied (${difficulty} N${N} T${T} s${seed})`);
          check(!r.backwards, "no racer moves backwards");
          check(!r.frozenMoved, "nobody moves while frozen at checkpoint");
          check(r.minLateralGap >= 1, `lateral gap >= 1m when overlapping (got ${r.minLateralGap.toFixed(2)})`);
          const ranked = r.st.map((s) => s.id);
          check(JSON.stringify(ranked) === JSON.stringify(r.orderByTime), "results order == finish-line crossing order");
          const leaderSprint = r.firstCross - r.sprintStart;
          check(leaderSprint > 2.8 && leaderSprint < 6, `final sprint ~4s for leader (got ${leaderSprint.toFixed(2)}s) ${difficulty} N${N} T${T} good=${r === good}`);
        }
        if (difficulty !== "hard") check(good.playerRank === 1, `all-correct wins (${difficulty} N${N} T${T} s${seed}) rank=${good.playerRank}`);
        check(bad.playerRank > 1, `all-wrong does not win automatically (${difficulty} N${N} T${T} s${seed})`);
      }
    }
  }
}
{
  const r = run({ questionCount: 6, segmentSeconds: 6, seed: 7 }, all(6, true));
  const runTime = r.firstCross;
  console.log(`default: finishX=${r.m.finishX}m, run time to first crossing=${runTime.toFixed(2)}s, sprintK=${r.m.state.sprintK.toFixed(3)}`);
  check(Math.abs(runTime - 40) < 1.5, `default total running ≈ 40s (got ${runTime.toFixed(2)})`);
}
for (const difficulty of ["easy", "normal", "hard"]) {
  const row = [];
  for (let k = 0; k <= 6; k++) {
    let sum = 0, wins = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const answers = all(6, false);
      const idx = [0, 1, 2, 3, 4, 5].sort((a, b) => (a * 7 + seed * 13) % 11 - (b * 7 + seed * 13) % 11);
      for (let i = 0; i < k; i++) answers[idx[i]] = true;
      const r = run({ questionCount: 6, segmentSeconds: 6, difficulty, seed }, answers);
      sum += r.playerRank;
      if (r.playerRank === 1) wins++;
    }
    row.push(`${k}✓: avg rank ${(sum / 30).toFixed(2)} wins ${wins}/30`);
  }
  console.log(difficulty, "|", row.join(" | "));
}
for (const k in summary) {
  const g = summary[k].good, b = summary[k].bad;
  console.log(`${k}: all-correct rank dist`, hist(g), " all-wrong rank dist", hist(b));
}
function hist(a) {
  const h = {};
  a.forEach((x) => {
    h[x] = (h[x] || 0) + 1;
  });
  return JSON.stringify(h);
}
console.log(`
${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
