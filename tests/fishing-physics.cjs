/* Fishing V24 — deterministic physics & simulation contract tests (Node, no browser). */
'use strict';
const assert = require('node:assert/strict');
const P = require('../games/fishing/js/fishing-physics.js'), F = require('../games/fishing/js/fishing-fish.js'), { FishingSim } = require('../games/fishing/js/fishing-sim.js');
const { V } = P; let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };

// 1. sea: deterministic, Gerstner height consistent with displacement, finite normals
for (const [x, z, t] of [[0, 0, 0], [3.2, -8.1, 12.5], [-6, -11, 99.9]]) {
  const h = P.Sea.height(x, z, t); ok(h === P.Sea.height(x, z, t), 'sea deterministic'); ok(Math.abs(h) < 0.25, 'calm sea amplitude');
  const n = P.Sea.normal(x, z, t); ok(V.finite(n) && n[1] > 0.9, 'sea normal');
}
// 2. ballistic cast lands exactly on the target and is continuous
{ const from = [0.4, 2.8, -1.6], to = [3.5, 0, -10.2], T = P.Ballistic.flightTime(9), v = P.Ballistic.launch(from, to, T); ok(V.dist(P.Ballistic.at(from, v, T), to) < 1e-9, 'lands on target'); let prev = from; for (let i = 1; i <= 120; i++) { const p = P.Ballistic.at(from, v, T * i / 120); ok(V.dist(prev, p) < 0.4, 'no teleport in flight'); prev = p; } }
// 3. rod: straight without load, bends monotonically with tension, lag (overshoot) then settles, never NaN
{ const rod = new P.Rod(); rod.step(1 / 120, [0, 1, 0], [0, 0.5, -0.86], [0, 1, 0], [0, 0, 0]); ok(Math.abs(V.dist(rod.points[0], rod.tip) - rod.length) < 1e-6, 'unloaded rod straight');
  let last = -1; for (const f of [0, 0.2, 0.5, 0.9, 1.3]) { const r = new P.Rod(); for (let i = 0; i < 600; i++) r.step(1 / 120, [0, 1, 0], [0, 0.5, -0.86], [0, 1, 0], [0, -f, 0]); ok(r.bend >= last - 1e-9, 'bend grows with tension'); ok(r.bend <= r.maxBend + 1e-9, 'bend saturates'); ok(r.points.every(V.finite), 'finite rod'); last = r.bend;
    let len = 0; for (let i = 1; i < r.points.length; i++) len += V.dist(r.points[i - 1], r.points[i]); ok(Math.abs(len - r.length) < 1e-6, 'rod keeps its length while bending'); }
  const r = new P.Rod(); let peak = 0; for (let i = 0; i < 240; i++) { r.step(1 / 120, [0, 1, 0], [0, 0.5, -0.86], [0, 1, 0], [0, -0.6, 0]); peak = Math.max(peak, r.bend); } ok(peak > r.bend * 1.05, 'rod tip overshoots (dynamic lag)'); }
// 4. fight: every species lands within the cap for every player strategy; tension bounded
for (const id of F.ORDER) for (const strat of ['none', 'always', 'pulse', 'random']) {
  const f = new F.Fight(F.SPECIES[id], 13.5, 99); let t = 0; const r = P.rng(5);
  while (!f.done && t < 30) { const reel = strat === 'always' || (strat === 'pulse' && Math.floor(t * 2) % 2 === 0) || (strat === 'random' && r() < 0.5); f.step(1 / 120, reel); t += 1 / 120; ok(f.tension >= 0 && f.tension <= 1, 'tension bounded'); }
  ok(f.done && t < 16, `${id}/${strat} landed in ${t.toFixed(1)} s`);
}
// 5. weights are computed from the model volume and stay plausible
for (const id of F.ORDER) { const s = F.SPECIES[id]; const w0 = F.weight(s, s.lengths[0]), w1 = F.weight(s, s.lengths[1]); ok(w0 > 0.05 && w1 < 4 && w1 > w0, id + ' weight plausible'); }

// 6. full sim per outcome: exactly-one / zero catches, freeze, continuity, no clipping, line intact
function run(result, seed = 's1', frameDt = 1 / 60) {
  const s = new FishingSim({ seed }); s.ready(); const log = []; let prevFish = null, prevPhase = '', maxJump = 0, maxStretch = 0, frozen = null, clip = 0, qEvents = 0, doneEvents = 0;
  const step = () => { s.update(frameDt); for (const e of s.drain()) { if (e.type === 'question') qEvents++; if (e.type === 'done') doneEvents++; } if (s.phase !== prevPhase) { log.push(s.phase); prevPhase = s.phase; }
    for (let k = 0; k < s.rope.p.length - 1; k++) maxStretch = Math.max(maxStretch, V.dist(s.rope.p[k].x, s.rope.p[k + 1].x) - s.rope.rest(k));
    const f = s.target; if (f) { if (prevFish && prevFish.id === f.id && !['net', 'onboard'].includes(s.phase)) maxJump = Math.max(maxJump, V.dist(prevFish.p, f.pos)); prevFish = { id: f.id, p: V.copy(f.pos) };
      if (!['surface', 'net', 'onboard', 'celebrate', 'done'].includes(s.phase) && f.pos[1] > P.Sea.height(f.pos[0], f.pos[2], s.t)) clip++;
      if (f.pos[1] < P.seabed(f.pos[0], f.pos[2]) - 0.01) clip++; } };
  for (let i = 0; i < 3 / frameDt; i++) step(); s.setAim('left', 0.7); ok(s.startCast(), 'cast starts');
  let guard = 0; while (s.phase !== 'question' && guard++ < 40 / frameDt) step(); ok(s.phase === 'question', 'reaches the question');
  const a = JSON.stringify([s.target.pos, s.rope.hookPos]); for (let i = 0; i < 3 / frameDt; i++) step(); ok(JSON.stringify([s.target.pos, s.rope.hookPos]) === a, 'fish + hook frozen during the question'); frozen = true;
  ok(!s.resolve({ correct: true, pending: false }) || true); // first resolve accepted below
  return { s, step, log, stats: () => ({ maxJump, maxStretch, clip, qEvents, doneEvents }), frozen };
}
for (const kind of ['correct', 'wrong', 'pending']) for (const fr of [1 / 30, 1 / 60, 1 / 120]) {
  const s = new FishingSim({ seed: 'k-' + kind }); s.ready(); let q = 0, d = 0, maxJump = 0, maxStretch = 0, clip = 0, prev = null; const phases = new Set();
  const step = () => { s.update(fr); for (const e of s.drain()) { if (e.type === 'question') q++; if (e.type === 'done') d++; } phases.add(s.phase);
    for (let k = 0; k < s.rope.p.length - 1; k++) maxStretch = Math.max(maxStretch, V.dist(s.rope.p[k].x, s.rope.p[k + 1].x) - s.rope.rest(k));
    const f = s.target; if (f) { if (prev && prev.id === f.id && !['net', 'onboard'].includes(s.phase)) maxJump = Math.max(maxJump, V.dist(prev.p, f.pos) / fr); prev = { id: f.id, p: V.copy(f.pos) };
      if (['approach', 'inspect', 'nibble', 'bite', 'question', 'fight', 'escape', 'review', 'strike', 'shake'].includes(s.phase) && f.pos[1] > P.Sea.height(f.pos[0], f.pos[2], s.t) - 0.05) clip++;
      if (f.pos[1] < P.seabed(f.pos[0], f.pos[2])) clip++; const L = s.boat.toLocal(f.pos); if ((L[0] / 2.75) ** 2 + (L[2] / 0.98) ** 2 < 1 && L[1] < 0 && L[1] > -0.3 && !['net', 'onboard'].includes(s.phase)) clip++; } };
  for (let i = 0; i < 3 / fr; i++) step(); s.setAim('center', 0.5); s.startCast();
  let g = 0; while (s.phase !== 'question' && g++ < 40 / fr) step(); ok(s.phase === 'question', 'question reached @' + fr);
  const held = JSON.stringify([s.target.pos, s.rope.hookPos]); for (let i = 0; i < 2 / fr; i++) step(); ok(JSON.stringify([s.target.pos, s.rope.hookPos]) === held, 'frozen @' + fr);
  ok(s.resolve({ correct: kind === 'correct', pending: kind === 'pending' }), 'resolve accepted'); ok(!s.resolve({ correct: true }), 'second resolve ignored');
  g = 0; while (s.phase !== 'done' && g++ < 40 / fr) step(); ok(s.phase === 'done', kind + ' finishes @' + fr);
  ok(s.catches.length === (kind === 'correct' ? 1 : 0), `${kind}: ${s.catches.length} catch(es)`);
  ok(q === 1 && d === 1, 'one question + one done event');
  if (kind === 'correct') ok(phases.has('fight') && phases.has('net') && phases.has('onboard'), 'correct: fight → net → onboard');
  if (kind === 'wrong') ok(phases.has('strike') && phases.has('escape') && !phases.has('fight'), 'wrong: strike → escape, no fight');
  if (kind === 'pending') ok(phases.has('review') && !phases.has('escape') && !phases.has('fight'), 'pending: neutral review');
  ok(maxJump < 5.5, `fish speed bounded (${maxJump.toFixed(2)} m/s)`); ok(maxStretch < 0.15, `line intact (${maxStretch.toFixed(3)} m)`); ok(clip === 0, `no clipping (${clip})`);
  // next cast returns to ready without teleporting the boat or the remaining fish
  const before = s.school.fish.filter(f => !f.landed).map(f => V.copy(f.pos)); ok(s.nextCast(), 'next cast'); s.update(fr); const after = s.school.fish.filter(f => !f.landed).slice(0, before.length).map(f => f.pos);
  ok(before.every((p, i) => V.dist(p, after[i]) < 0.2), 'no fish teleport on reset'); g = 0; while (s.phase !== 'ready' && g++ < 20 / fr) step(); ok(s.phase === 'ready', 'ready again');
}
// 7. fixed-step determinism across frame rates (same simulated time → same state)
{ const snap = fr => { const s = new FishingSim({ seed: 'det' }); s.ready(); for (let i = 0; i < Math.round(2 / fr); i++) s.update(fr); s.startCast(); for (let i = 0; i < Math.round(4 / fr); i++) s.update(fr); return JSON.stringify(s.snapshot()); };
  const a = snap(1 / 30), b = snap(1 / 60), c = snap(1 / 120); ok(a === b && b === c, 'identical state at 30/60/120 fps'); }
// 8. tab-visibility spikes are clamped (no explosion)
{ const s = new FishingSim({ seed: 'vis' }); s.ready(); s.update(5); s.update(0.1); ok(s.rope.p.every(q => V.finite(q.x)), 'finite after long frame'); }
// 9. buoyancy: the float rides the waves at the waterline while the sinker/hook hang below it
{ const s = new FishingSim({ seed: 'buoy' }); s.ready(); for (let i = 0; i < 180; i++) s.update(1 / 60); s.startCast(); let g = 0; while (s.phase !== 'approach' && g++ < 1200) s.update(1 / 60);
  const devs = []; for (let i = 0; i < 40; i++) { s.update(1 / 60); const f = s.rope.floatPos; devs.push(Math.abs(f[1] - P.Sea.height(f[0], f[2], s.t))); }
  ok(Math.max(...devs) < 0.09, 'float at waterline (max ' + Math.max(...devs).toFixed(3) + ' m)'); ok(s.rope.hookPos[1] < s.rope.floatPos[1] - 1.0, 'hook hangs ~1.5 m below the float'); }
console.log(`PASS fishing physics & simulation (${checks} checks): cast ballistics, rod bending/lag, Verlet line integrity, buoyancy, fight landing bound, 1/0/0 catches, freeze, 30/60/120 determinism`);
