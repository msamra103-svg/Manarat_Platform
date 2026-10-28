'use strict';
// Regression: on BOTH direct hosted link and teacher assignments, launch precedes question,
// pause occurs while arrow is in flight before contact, then correctness selects hit or miss.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PH = require('../games/target-shooting/physics/projectile.js');
const source = fs.readFileSync(path.join(__dirname, '../games/target-shooting/game.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../games/target-shooting/index.html'), 'utf8');
const school = fs.readFileSync(path.join(__dirname, '../js/school.js'), 'utf8');
assert.match(source, /const guided = embedded \|\| \(!preset && location\.protocol !== 'file:'/);
assert.match(source, /S\.drawing = false; phase\('flight'\); archer\.loose\(\)/);
assert.match(source, /f\.flight\.t >= f\.pauseAt/);
assert.match(source, /phase\('midflight'\)/);
assert.match(source, /S\.midFlightPaused \|\| S\.phase === 'question'/);
assert.match(source, /if \(embedded\) \{ show\('waiting', true\); post\('question'\); return; \}/);
assert.match(source, /TS\.Questions\.ask/);
assert.match(source, /const sol = PH\.solveLaunch\(f\.flight\.p, dest, PH\.SPEED\)/);
assert.match(source, /clearArrows\(\); S\.midFlightPaused = false; archer\.standDown\(\)/);
assert.match(school, /play\.template==='target-shooting'/);
assert.match(school, /play\.template\+'-result'/);
assert.match(html, /game\.js\?v=3-midflight/);

const face = { x: 0, y: 1.55, z: -12 };
const collider = { kind: 'disc', c0: face, c1: face, n: { x: 0, y: 0, z: 1 }, r: 0.61 };
for (const fps of [30, 60, 144]) {
  for (const origin of [
    { x: -0.5, y: 1.7, z: -0.1 },
    { x: 0.8, y: 1.8, z: 0.4 },
    { x: 0.1, y: 1.5, z: 0.2 }
  ]) {
    for (const correct of [true, false]) {
      const s = PH.solveLaunch(origin, face, PH.SPEED);
      assert.ok(s);
      const arrow = new PH.Flight(origin, s.v, 'midflight');
      let preContact = null;
      // Simulate 240 Hz physics, with additional per-frame validation at requested presentation FPS.
      const pause = s.t * 0.43;
      while (arrow.t < pause) {
        preContact = arrow.step(PH.STEP, [collider]);
        assert.equal(preContact, null, 'question must arrive before impact');
      }
      assert.ok(arrow.t > 0 && arrow.t < s.t * 0.7, 'arrow physically moved and paused before target');
      const heldZ = arrow.p.z;
      // Keep exactly the same arrow: redirect only its remaining trajectory after the answer.
      const dest = { ...face, x: correct ? 0 : 2.9 };
      const resume = PH.solveLaunch(arrow.p, dest, PH.SPEED);
      assert.ok(resume);
      Object.assign(arrow.v, resume.v);
      arrow.tipOf(arrow.p, arrow.v, arrow.tip);
      Object.assign(arrow.prevTip, arrow.tip);
      let hit = null;
      let frames = 0;
      while (arrow.p.z > -15 && frames < fps * 2) {
        for (let j = 0; j < Math.round(240 / fps); j++) {
          const result = arrow.step(PH.STEP, [collider]);
          if (result) { hit = result; break; }
        }
        if (hit) break;
        frames++;
      }
      assert.ok(arrow.p.z < heldZ, 'the SAME arrow continues towards target after answer');
      assert.equal(!!hit, correct, `fps=${fps}, correct=${correct}`);
    }
  }
}
console.log('PASS mid-flight question: one launched arrow freezes before impact; correct hits, wrong misses (30/60/144 FPS)');