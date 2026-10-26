/* Choreography plan tests (pure, Node): run with `node tests/bowling-motion.cjs` */
'use strict';
const assert = require('node:assert/strict');
const M = require('../games/bowling/motion.js');
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const CASES = [];
for (const hand of ['right', 'left']) for (const inp of [{ start: 0, angle: 0, power: 0.65 }, { start: 0.3, angle: -2.5, power: 1 }, { start: -0.36, angle: 3, power: 0 }]) CASES.push(Object.assign({ hand }, inp));

ok('the bowler faces and travels toward the pins (never backward) for every aim and hand', () => {
  for (const c of CASES) {
    const P = M.plan(c);
    const fwd = [Math.sin(P.yaw), 0, Math.cos(P.yaw)];                       // rig forward (+Z) after yaw
    assert.ok(Math.abs(fwd[0] - P.d[0]) < 1e-9 && Math.abs(fwd[2] - P.d[2]) < 1e-9, 'yaw maps the rig forward onto the lane heading');
    let prev = M.sample(P, 0).pelvis;
    for (let t = 0.01; t <= P.end; t += 0.01) {
      const p = M.sample(P, t).pelvis, step = (p[0] - prev[0]) * P.d[0] + (p[2] - prev[2]) * P.d[2];
      assert.ok(step > -1e-4, 'pelvis moves backward at t=' + t.toFixed(2) + ' ' + JSON.stringify(c));
      prev = p;
    }
    assert.ok(P.d[2] < 0, 'heading toward -Z (the pins)');
  }
});

ok('walking, not running: there is always a foot on the floor; planted feet never slide', () => {
  for (const c of CASES) {
    const P = M.plan(c); const last = {};
    for (let t = 0; t <= P.end + 0.5; t += 0.004) {
      const s = M.sample(P, t);
      const L = s.feet.L, R = s.feet.R;
      assert.ok(L.contact !== 'swing' || R.contact !== 'swing', 'both feet airborne at ' + t.toFixed(3));
      for (const side of ['L', 'R']) {
        const f = s.feet[side];
        if (f.contact === 'planted' && last[side] && last[side].contact === 'planted') {
          const d = Math.hypot(f.toe[0] - last[side].toe[0], f.toe[2] - last[side].toe[2]);
          assert.ok(d < 1e-9, 'planted toe moved ' + d + ' at ' + t.toFixed(3));
        }
        last[side] = f;
      }
    }
  }
});

ok('a planted leg is never over-stretched (the IK can always reach: no floating feet)', () => {
  for (const c of CASES) {
    const P = M.plan(c); let worst = 0;
    for (let t = 0; t <= P.end; t += 0.005) {
      const s = M.sample(P, t), r = M.hipAnkleReach(P, t);
      for (const side of ['L', 'R']) if (s.feet[side].contact !== 'swing') worst = Math.max(worst, r[side]);
    }
    assert.ok(worst < 0.99, 'max planted reach ' + worst.toFixed(3) + ' ' + JSON.stringify(c));
  }
});

ok('the 4-step delivery is ordered and the slide uses the foot opposite the throwing hand', () => {
  for (const c of CASES) {
    const P = M.plan(c), T = P.t;
    assert.equal(P.slide, c.hand === 'left' ? 'R' : 'L'); assert.equal(P.throwHand, c.hand === 'left' ? 'L' : 'R');
    assert.ok(T.step1[1] < T.step2[1] && T.step2[1] < T.step3[1] && T.step3[1] < T.step4[1] && T.step4[1] < T.release && T.release < T.slideEnd);
    assert.ok(T.pushaway[0] < T.step1[1] && T.backswing[1] <= T.step3[1] + 1e-9, 'pushaway with step 1, top of backswing at step 3');
    // swing angle: forward at the end of the pushaway, back to the top, then forward through the release
    const th = t => M.swingTheta(P, t);
    assert.ok(th(T.pushaway[1]) > 0.5 && th(T.backswing[1]) < -1.1 && Math.abs(th(T.release) - P.thetaRelease) < 1e-9 && th(T.follow) > 2);
    // the slide decelerates monotonically and the toe stays behind the foul line (z >= 0)
    let prevS = -Infinity, prevV = Infinity;
    for (let t = T.step4[1]; t <= T.slideEnd; t += 0.01) {
      const f = M.sample(P, t).feet[P.slide]; const v = f.s - prevS;
      if (prevS > -Infinity) { assert.ok(v >= -1e-9, 'slide never goes backward'); assert.ok(v <= prevV + 1e-6, 'slide decelerates'); prevV = v; }
      prevS = f.s;
      const tipZ = f.toe[2] - 0.07 * Math.cos(P.angle);
      assert.ok(tipZ > -0.005, 'slide toe crosses the foul line: ' + tipZ.toFixed(3));
    }
  }
});

ok('release happens exactly once and the ball is with the hand until then', () => {
  for (const c of CASES) {
    const P = M.plan(c); let flips = 0, prev = false;
    for (let t = -0.5; t <= P.end + 1; t += 0.003) { const r = M.sample(P, t).released; if (r !== prev) flips++; assert.ok(!(prev && !r), 'release is irreversible'); prev = r; }
    assert.equal(flips, 1);
  }
});

ok('left-handed delivery is a deliberate mirror of the right-handed one about the ball line', () => {
  const R = M.plan({ hand: 'right', start: 0.1 }), L = M.plan({ hand: 'left', start: 0.1 });
  for (let t = 0; t <= R.end; t += 0.05) {
    const a = M.sample(R, t), b = M.sample(L, t);
    assert.ok(Math.abs((a.pelvis[0] - 0.1) + (b.pelvis[0] - 0.1)) < 1e-9 && Math.abs(a.pelvis[2] - b.pelvis[2]) < 1e-9);
    const fa = a.feet[R.slide], fb = b.feet[L.slide];
    assert.ok(Math.abs((fa.toe[0] - 0.1) + (fb.toe[0] - 0.1)) < 1e-9, 'slide feet mirrored');
  }
});

ok('a stronger shot is a slightly quicker approach (bounded tempo)', () => {
  const a = M.plan({ power: 0 }), b = M.plan({ power: 1 });
  assert.ok(b.t.release < a.t.release && a.t.release / b.t.release < 1.15);
});

console.log(`\n${passed} motion tests passed`);
