// Basketball physics + shot planning (pure Node, no browser). Run: node tests/basketball-motion-v23.cjs
const assert = require('node:assert/strict');
const M = require('../games/basketball/motion.js');
const { COURT, R, SHOT, DRIBBLE } = M;
const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let checks = 0; const ok = () => checks++;

// 1. closed-form shot solver reaches the target with the requested descent angle
{
  const p0 = [-1.1, 2.45, -7.3], tgt = [0, 3.05, COURT.rim.z];
  for (const ang of [42, 47, 52]) {
    const s = M.solveShot(p0, tgt, ang);
    const end = M.ballistic(p0, s.v, s.T);
    assert(dist(end, tgt) < 1e-9, 'solver hits target');
    const vy = s.v[1] - M.G * s.T, vh = Math.hypot(s.v[0], s.v[2]);
    near(Math.atan2(-vy, vh) * 180 / Math.PI, ang, 1e-6, 'descent angle'); ok();
  }
}

// 2. simulation is exact before contact (integrator matches the analytic arc)
{
  const p0 = [-1.07, 2.46, -7.82], mk = M.planMake(p0);
  for (const t of [0.1, 0.3, 0.5, M.questionTime(mk)]) assert(dist(M.ballistic(p0, mk.v, t), M.sampleSim(mk.sim, t).p) < 2e-4, 'sim == analytic at ' + t);
  ok();
}

// 3. correct answers always score cleanly; wrong answers never score (many positions x seeds)
const releases = [];
for (const x of [-2.6, -1.25, 0, 1.3]) for (const z of [-8.4, -7.55, -6.9]) releases.push([x, 2.42 + (x + 3) * 0.01, z]);
for (const rel of releases) {
  const mk = M.planMake(rel); assert(mk, 'make planned');
  assert(mk.sim.scoredAt > 0, 'make scores ' + rel);
  assert(mk.sim.firstContact < 0 || mk.sim.firstContact > mk.sim.scoredAt, 'make does not touch rim/board before scoring ' + rel);
  assert(mk.sim.minRimGap > 0.005, 'make clears the rim ' + mk.sim.minRimGap);
  const tq = M.questionTime(mk);
  // shooter has landed and recovered balance before the question freezes the shot
  assert(SHOT.release + tq > SHOT.land + 0.12, 'landed before question');
  for (let seed = 1; seed <= 12; seed++) {
    const ms = M.planMiss(rel, mk, seed);
    assert(ms, 'miss planned ' + rel + ' seed ' + seed);
    assert(ms.sim.scoredAt < 0, 'miss never scores');
    assert(ms.tc > tq + 0.1, 'miss contact happens after the question');
    const plan = { release: rel, make: mk, tq, miss: ms };
    // identical displayed path up to the question, regardless of outcome
    for (const t of [0.05, tq * 0.5, tq]) assert(dist(M.shotBall(plan, t, 'make').p, M.shotBall(plan, t, 'miss').p) < 1e-9, 'same path before answer');
    // resume after the answer (tq): position AND velocity continuous
    { const e = 1e-4, a = M.shotBall(plan, tq - e, 'miss'), b = M.shotBall(plan, tq + e, 'miss');
      assert(dist(a.p, b.p) < 0.002, 'position continuity at tq'); assert(dist(a.v, b.v) < 0.05, 'velocity continuity at tq ' + dist(a.v, b.v)); }
    // first rim contact (tc): position continuous; velocity before contact equals the planned miss arc
    { const e = 1e-5, a = M.shotBall(plan, ms.tc - e, 'miss'), b = M.shotBall(plan, ms.tc + e, 'miss');
      assert(dist(a.p, b.p) < 0.001, 'position continuity at contact ' + dist(a.p, b.p));
      const vb = [ms.v[0], ms.v[1] - M.G * ms.tc, ms.v[2]]; assert(dist(a.v, vb) < 0.02, 'arrives on the simulated miss arc'); }
    // blended segment never passes inside the rim tube
    for (let t = tq; t < ms.tc; t += 1 / 240) {
      const p = M.shotBall(plan, t, 'miss').p, dx = p[0] - COURT.rim.x, dz = p[2] - COURT.rim.z, h = Math.hypot(dx, dz);
      const q = [COURT.rim.x + dx / h * COURT.rim.major, COURT.rim.y, COURT.rim.z + dz / h * COURT.rim.major];
      assert(dist(p, q) > R + COURT.rim.tube - 0.004, 'no rim penetration during blend');
    }
    ok();
  }
}

// 4. no teleporting: per-frame displacement bounded by speed, ball never below the floor
{
  const rel = [-1.07, 2.46, -7.82], mk = M.planMake(rel), tq = M.questionTime(mk), ms = M.planMiss(rel, mk, 3);
  const plan = { release: rel, make: mk, tq, miss: ms };
  for (const out of ['make', 'miss']) {
    let prev = M.shotBall(plan, 0, out).p;
    for (let t = 1 / 120; t < 6; t += 1 / 120) {
      const p = M.shotBall(plan, t, out).p;
      assert(dist(p, prev) < 12 / 120, 'no jump ' + out + ' t=' + t.toFixed(3));
      assert(p[1] >= R - 1e-6, 'above floor');
      prev = p;
    }
  }
  ok();
}

// 5. make goes through the net and bounces on the floor afterwards
{
  const mk = M.planMake([-1.07, 2.46, -7.82]);
  const types = mk.sim.events.map(e => e.type);
  assert(types[0] === 'net', 'first contact of a make is the net');
  assert(types.includes('floor'), 'make bounces on the floor');
  const net = mk.sim.events.find(e => e.type === 'net'), floor = mk.sim.events.find(e => e.type === 'floor');
  assert(floor.t > net.t, 'floor after net');
  ok();
}

// 6. dribble: analytic, periodic, contact-synchronised
{
  const D = DRIBBLE;
  near(M.dribbleAt(D.t1 - 1e-9).y, R, 1e-6, 'ball reaches the floor exactly at t1');
  near(M.dribbleAt(D.t1 + D.t2 - 1e-9).y, D.yCatch, 1e-6, 'ball reaches the hand at catch');
  let prev = M.dribbleAt(0).y;
  for (let t = 0.001; t < 3 * D.period; t += 0.001) { const y = M.dribbleAt(t).y; assert(Math.abs(y - prev) < 0.0062, 'continuous dribble ' + t); assert(y >= R - 1e-9, 'never below floor'); prev = y; }
  // hand touches the ball top during the whole contact phase
  for (let s = 0; s < D.tc; s += 0.01) { const t = D.t1 + D.t2 + s; near(M.dribbleHand(t).y, M.dribbleAt(t).y + R, 1e-9, 'hand on ball'); }
  // hand continuity at contact boundaries
  for (const t of [D.t1 + D.t2, D.period]) near(M.dribbleHand(t - 1e-6).y, M.dribbleHand(t + 1e-6).y, 1e-3, 'hand continuity');
  ok();
}

// 7. jump: pelvis curve is continuous; feet only leave the floor while airborne
{
  let prev = M.pelvisShot(0);
  for (let t = 0.002; t < 2.5; t += 0.002) { const y = M.pelvisShot(t); assert(Math.abs(y - prev) < 0.012, 'pelvis continuity ' + t); prev = y; }
  assert(M.feetLift(SHOT.takeoff - 0.01) === 0 && M.feetLift(SHOT.land + 0.01) === 0, 'feet planted outside the jump');
  assert(M.feetLift((SHOT.takeoff + SHOT.land) / 2) > 0.2, 'jump height');
  assert(SHOT.release > SHOT.takeoff && SHOT.release < SHOT.land, 'release while airborne');
  ok();
}

console.log(`PASS basketball motion v23 (${checks} groups): exact arcs, guaranteed make/miss, continuity at question and contact, dribble sync, jump timing`);
