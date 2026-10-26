/* Anatomy, attachment and release tests on the REAL skinned rig (GLB + IK) in Node.
 * Run with `node tests/bowling-rig.cjs` (no browser, no GPU needed). */
'use strict';
const assert = require('node:assert/strict');
const { makeBowler } = require('./lib/bowler-node.cjs');
let passed = 0;
const ok = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };

(async () => {
  const cases = [];
  for (const hand of ['right', 'left']) for (const inp of [{ start: 0, angle: 0, power: 0.65, spin: 0 }, { start: 0.25, angle: -1.2, power: 1, spin: -0.8 }, { start: -0.3, angle: 1.5, power: 0, spin: 0.6 }]) cases.push({ hand, inp });
  const runs = [];
  for (const c of cases) {
    const R = await makeBowler({ hand: c.hand });
    const { bowler, T } = R, ath = bowler.athlete, b = ath.bones;
    bowler.setPlan(c.inp); bowler.startStance();
    for (let i = 0; i < 30; i++) bowler.update(1 / 60);
    // hinge reference: sign of the bend-plane normal against the child bone's local Z in the bind pose
    const W = n => ath.worldOf(n, new T.Vector3());
    const zAxis = n => new T.Vector3(0, 0, 1).applyQuaternion(ath.quatOf(n, new T.Quaternion()));
    const hingeSign = (a, m, e) => { const A = W(a), B = W(m), C = W(e); const n = new T.Vector3().subVectors(B, A).cross(new T.Vector3().subVectors(C, B)); return { s: Math.sign(n.dot(zAxis(m))), bend: n.length() / (A.distanceTo(B) * B.distanceTo(C)) }; };
    bowler.startApproach();
    const P = bowler.plan, frames = [];
    let prevPel = W('Pelvis'), prevToe = { L: W('L_Toe0'), R: W('R_Toe0') }, prevContact = {};
    while (bowler.t < P.end + 0.4) {
      bowler.update(1 / 60);
      const r = bowler.request, rep = bowler.poseReport(), cl = bowler.clearance();
      const pel = W('Pelvis'), toes = { L: W('L_Toe0'), R: W('R_Toe0') };
      frames.push({
        t: bowler.t, released: r.released, support: rep.support, supportGap: rep.supportGap, rep, cl,
        move: (pel.x - prevPel.x) * P.d[0] + (pel.z - prevPel.z) * P.d[2],
        hinge: { kL: hingeSign('L_Thigh', 'L_Calf', 'L_Foot'), kR: hingeSign('R_Thigh', 'R_Calf', 'R_Foot'), eL: hingeSign('L_UpperArm', 'L_Forearm', 'L_Hand'), eR: hingeSign('R_UpperArm', 'R_Forearm', 'R_Hand') },
        skate: Object.fromEntries(['L', 'R'].map(s => [s, r.feet[s].contact === 'planted' && prevContact[s] === 'planted' ? Math.hypot(toes[s].x - prevToe[s].x, toes[s].z - prevToe[s].z) : 0])), // horizontal: a foot rolling onto its toe tip may rise
        ball: bowler.ball.pos.clone(), hand: W(P.throwHand + '_Hand')
      });
      prevPel = pel; prevToe = toes; prevContact = { L: r.feet.L.contact, R: r.feet.R.contact };
    }
    runs.push({ c, R, frames, P });
  }

  await ok('approach direction: the pelvis always moves toward the pins (no backward walking)', () => {
    for (const { c, frames } of runs) assert.ok(frames.every(f => f.move > -0.004), JSON.stringify(c) + ' min ' + Math.min(...frames.map(f => f.move)).toFixed(4));
  });
  await ok('knees bend forward and elbows never invert (hinge side constant, checked on the real bones)', () => {
    for (const { c, frames } of runs) {
      const ref = frames[0].hinge;
      for (const f of frames) {
        for (const k of ['kL', 'kR']) if (f.hinge[k].bend > 0.12) assert.equal(f.hinge[k].s, ref[k].s, 'knee ' + k + ' inverted at ' + f.t.toFixed(2) + ' ' + JSON.stringify(c));
        for (const k of ['eL', 'eR']) if (f.hinge[k].bend > 0.12) assert.equal(f.hinge[k].s, ref[k].s, 'elbow ' + k + ' inverted at ' + f.t.toFixed(2) + ' ' + JSON.stringify(c));
        for (const s of ['L', 'R']) if (f.rep.knees[s].bend > 0.25) assert.ok(f.rep.knees[s].forward > 0, 'knee not forward at ' + f.t.toFixed(2));
      }
    }
  });
  await ok('feet: soles never sink into the floor and planted toes do not skate (slide excluded)', () => {
    for (const { c, frames } of runs) {
      let low = 1, skate = 0;
      for (const f of frames) { for (const s of ['L', 'R']) { const ft = f.rep.feet[s]; low = Math.min(low, ft.heel, ft.toe, ft.tip); skate = Math.max(skate, f.skate[s]); } }
      assert.ok(low > -0.012, 'sole below floor ' + low.toFixed(4) + ' ' + JSON.stringify(c));
      assert.ok(skate < 0.003, 'planted toe moved ' + skate.toFixed(4) + ' m in one frame ' + JSON.stringify(c));
    }
  });
  await ok('hand–ball attachment: the throwing hand holds the ball until release; the support hand only touches it', () => {
    for (const { c, frames } of runs) {
      for (const f of frames.filter(f => !f.released)) {
        const d = f.ball.distanceTo(f.hand);
        assert.ok(d > 0.07 && d < 0.2, 'wrist-to-ball ' + d.toFixed(3) + ' at ' + f.t.toFixed(2) + ' ' + JSON.stringify(c));
        assert.ok(f.rep.armReach < 0.9995, 'throwing arm cannot reach the ball (hand would separate) at ' + f.t.toFixed(2));
        if (f.support.w > 0.98) assert.ok(f.supportGap < 0.02, 'support hand floats beside the ball: ' + f.supportGap + ' at ' + f.t.toFixed(2));
      }
    }
  });
  await ok('the ball never passes through the torso or legs (capsule clearance)', () => {
    for (const { c, frames } of runs) {
      const worst = frames.filter(f => !f.released).reduce((m, f) => f.cl.min < m.min ? f.cl : m, { min: 1 });
      assert.ok(worst.min > -0.01, 'ball intersects ' + worst.which + ' by ' + worst.min + ' ' + JSON.stringify(c));
    }
  });
  await ok('low release near the ankle; continuous position and orientation; deterministic at 60 and 144 fps', async () => {
    for (const { c, R, P } of runs) {
      const { bowler } = R;
      const rel = bowler.evaluate(P.t.release - 1e-6);
      assert.ok(rel.pos.y > 0.14 && rel.pos.y < 0.30, 'release height ' + rel.pos.y.toFixed(3));
      const slideToe = R.M.sample(P, P.t.release).feet[P.slide].toe;
      assert.ok(Math.abs(rel.pos.z - slideToe[2]) < 0.45, 'release beside the slide foot');
      // velocity of the hand-carried ball just before release vs the physical release velocity
      const a = bowler.evaluate(P.t.release - 0.008).pos.clone(), b2 = bowler.evaluate(P.t.release - 1e-6).pos.clone();
      const vHand = b2.clone().sub(a).divideScalar(0.008 - 1e-6), phys = R.P.releaseState(Object.assign({}, c.inp, { pos: b2.toArray() }));
      const vP = new R.T.Vector3(...phys.vel), ang = vHand.angleTo(vP) * 180 / Math.PI, ratio = vHand.length() / vP.length();
      assert.ok(ang < 12 && ratio > 0.85 && ratio < 1.15, 'release velocity mismatch: angle ' + ang.toFixed(1) + '°, ratio ' + ratio.toFixed(2) + ' ' + JSON.stringify(c));
      // the same release at another frame rate
      const R2 = await makeBowler({ hand: c.hand }); R2.bowler.setPlan(c.inp); R2.bowler.startStance(); for (let i = 0; i < 13; i++) R2.bowler.update(1 / 144); R2.bowler.startApproach();
      while (R2.bowler.t < P.t.release - 0.02) R2.bowler.update(1 / 144);
      const rel2 = R2.bowler.evaluate(P.t.release - 1e-6);
      assert.ok(rel2.pos.distanceTo(rel.pos) < 1e-9 && Math.abs(rel2.quat.dot(rel.quat)) > 1 - 1e-12, 'release state depends on frame rate');
    }
  });
  await ok('left-handed bowler throws with the left hand on the start line; repeated rounds reset cleanly', async () => {
    for (const { c, R, P } of runs) {
      const rel = R.bowler.evaluate(P.t.release - 1e-6);
      assert.ok(Math.abs(rel.pos.x - c.inp.start) < 0.06, 'ball released on its line: ' + rel.pos.x.toFixed(3) + ' vs ' + c.inp.start);
    }
    const R = await makeBowler({ hand: 'right' }), bw = R.bowler; const stanceBalls = [];
    for (let round = 0; round < 3; round++) {
      bw.setPlan({ start: 0.1, angle: 0, power: 0.6, spin: 0 }); bw.startStance(); for (let i = 0; i < 20; i++) bw.update(1 / 60);
      stanceBalls.push(bw.ball.pos.clone()); assert.equal(bw.mode, 'stance');
      bw.startApproach(); while (bw.t < bw.plan.end + 0.3) bw.update(1 / 60);
      bw.startRecover('cheer_small'); for (let i = 0; i < 150; i++) bw.update(1 / 60);
      assert.equal(bw.mode, 'react');
    }
    assert.ok(stanceBalls.every(p => p.distanceTo(stanceBalls[0]) < 0.02), 'stance pose drifts between rounds');
  });
  console.log(`\n${passed} rig tests passed`);
})().catch(e => { console.error(e); process.exit(1); });
