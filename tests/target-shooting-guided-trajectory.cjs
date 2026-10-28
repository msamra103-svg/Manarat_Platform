'use strict';
/* The platform's simplified archer uses server-correct -> face centre, server-wrong -> clear miss.
   Verify the projectile sweep for realistic archer nock positions at multiple frame rates. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const PH = require('../games/target-shooting/physics/projectile.js');
const face = { x: 0, y: 1.55, z: -12 };
function flight(origin, correct, dt) {
  const goal = { ...face, x: face.x + (correct ? 0 : 2.8) };
  const solution = PH.solveLaunch(origin, goal, PH.SPEED);
  assert.ok(solution, 'flight solution exists');
  const arrow = new PH.Flight(origin, solution.v, 'guided');
  const colliders = [
    { kind: 'disc', c0: face, c1: face, n: { x: 0, y: 0, z: 1 }, r: 0.61 },
    { kind: 'plane', c0: { x: 0, y: 0, z: 0 }, n: { x: 0, y: 1, z: 0 } }
  ];
  for (let t = 0; t < 5; t += dt) {
    const contact = arrow.step(dt, colliders);
    if (contact) return contact;
  }
  return null;
}
for (const dt of [1 / 30, 1 / 60, 1 / 144, 1 / 240]) {
  for (const o of [{ x: -0.5, y: 1.7, z: -0.1 }, { x: 0.8, y: 1.8, z: 0.4 }, { x: 0.1, y: 1.5, z: 0.2 }]) {
    assert.equal(flight(o, true, dt)?.collider.kind, 'disc', 'correct answer hits the target');
    assert.notEqual(flight(o, false, dt)?.collider.kind, 'disc', 'wrong answer misses the target');
  }
}
const source = fs.readFileSync(path.join(__dirname, '../games/target-shooting/game.js'), 'utf8');
assert.match(source, /const guided = embedded/);
assert.match(source, /if \(guided && S\.phase === 'preparing' && archer\.state === 'AIM_HOLD'\)/);
assert.match(source, /S\.guidedDecision = r\.correct === true \? 'hit' : 'miss'/);
assert.match(source, /if \(r\.pending\) \{[\s\S]*?archer\.standDown\(\)/);
const parent = fs.readFileSync(path.join(__dirname, '../js/school.js'), 'utf8');
assert.ok(parent.includes("play.template+'-result'"), 'host uses backend result for this sport');
assert.match(parent, /play\.template==='target-shooting'/);
console.log('PASS guided archery: correct hits; wrong misses; pending neutral; server-result-only release');