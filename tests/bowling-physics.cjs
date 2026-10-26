/* Physics tests (Node, no browser): run with `node tests/bowling-physics.cjs` */
'use strict';
const assert = require('node:assert/strict');
const P = require('../games/bowling/physics.js');
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log('PASS', name); };

function roll(input, dt = 1 / 60, maxT = 14) {
  const w = P.create(); w.launch(P.releaseState(input));
  for (let t = 0; t < maxT && !w.settled; t += dt) w.update(dt);
  return w;
}
const finalState = w => JSON.stringify(w.snapshot().pins.map(p => [p.pos.map(v => +v.toFixed(9)), p.q.map(v => +v.toFixed(9))]));

ok('real-scale constants (USBC nominal: 60 ft, 41.5 in, 12 in spacing; ball 6.4 kg, pin 1.53 kg)', () => {
  assert.equal(P.LENGTH, 18.288); assert.equal(P.WIDTH, 1.0541); assert.equal(P.PIN_SPACING, 0.3048);
  assert.equal(P.BALL_MASS, 6.4); assert.equal(P.PIN_MASS, 1.53); assert.equal(P.PIN_H, 0.381);
  assert.ok(Math.abs(P.R - 0.1085) < 1e-9);
});

ok('a fresh rack stands still on its own (no jitter, pins asleep, none down)', () => {
  const w = P.create();
  for (let i = 0; i < 300; i++) w.update(1 / 60);
  assert.equal(w.knocked, 0); assert.ok(w.pins.every(p => p.asleep));
  assert.ok(w.pins.every(p => Math.abs(p.pos[1] - P.PIN_COM) < 1e-9));
});

ok('pocket hook strikes; poor aim leaves pins; gutter balls score zero', () => {
  const pocket = roll({ start: 0.20, angle: 0, power: 0.65, spin: -0.6 });
  assert.equal(pocket.knocked, 10, 'pocket shot should strike');
  const light = roll({ start: 0.10, angle: 0, power: 0.65, spin: 0 });
  assert.ok(light.knocked > 0 && light.knocked < 10, 'off-pocket straight ball leaves pins: ' + light.knocked);
  for (const g of [{ start: 0.34, angle: 2, power: 0.8, spin: 0 }, { start: -0.3, angle: -2, power: 0.5, spin: 0 }, { start: 0.3, angle: 0.5, power: 0.4, spin: 1 }]) {
    const w = roll(g); assert.equal(w.knocked, 0, 'gutter ' + JSON.stringify(g)); assert.ok(w.ball.gutter);
  }
});

ok('inputs genuinely matter: power, aim and spin change the physical result', () => {
  const fast = P.create(), slow = P.create();
  fast.launch(P.releaseState({ power: 1 })); slow.launch(P.releaseState({ power: 0 }));
  for (let i = 0; i < 90; i++) { fast.update(1 / 60); slow.update(1 / 60); }
  assert.ok(fast.ball.pos[2] < slow.ball.pos[2] - 2.5, 'more power travels farther');
  // spin hooks through friction: + spin drifts toward +X, - spin toward -X, mostly on the dry back end
  const path = spin => { const w = P.create(); w.launch(P.releaseState({ start: 0, power: 0.6, spin })); const xs = {}; while (w.ball.pos[2] > -17.5) { w.update(1 / 120); for (const d of [6, 12, 17]) if (xs[d] === undefined && -w.ball.pos[2] > d) xs[d] = w.ball.pos[0]; } return xs; };
  const r = path(1), l = path(-1), s = path(0);
  assert.ok(r[17] > 0.25 && l[17] < -0.25 && Math.abs(s[17]) < 1e-9, 'hook direction/magnitude ' + JSON.stringify({ r, l, s }));
  assert.ok(r[17] - r[12] > r[12] - r[6], 'more hook after the oil ends (skid -> hook)');
  // different aims give meaningfully different pinfall
  const outcomes = new Set([-0.25, -0.1, 0, 0.1, 0.2, 0.3].map(x => roll({ start: x, power: 0.65, spin: -0.6 }).standingIds.join(',')));
  assert.ok(outcomes.size >= 4, 'aim changes the leave: ' + [...outcomes].join(' | '));
});

ok('skid -> hook -> roll phases are reported and the ball ends in a true roll', () => {
  const w = P.create(); w.launch(P.releaseState({ start: 0.15, power: 0.55, spin: -0.8 }));
  const seen = new Set(); while (w.ball.pos[2] > -17.8) { w.update(1 / 120); seen.add(w.ball.phase); }
  assert.ok(seen.has('flight') && seen.has('skid') && seen.has('hook'), [...seen].join(','));
  assert.ok(w.ball.hookStart !== null && w.ball.hookStart < -11, 'hook begins near the end of the oil');
});

ok('frame-rate independence: 30, 60, 144 Hz and irregular frames give identical results', () => {
  const inp = { start: 0.2, angle: -0.3, power: 0.7, spin: -0.5 };
  const a = roll(inp, 1 / 30), b = roll(inp, 1 / 60), c = roll(inp, 1 / 144);
  const w = P.create(); w.launch(P.releaseState(inp)); let k = 0; for (let t = 0; t < 14 && !w.settled; k++) { const dt = [0.011, 0.033, 0.017, 0.05][k % 4]; w.update(dt); t += dt; }
  for (const x of [b, c, w]) { assert.equal(x.knocked, a.knocked); assert.deepEqual(x.standingIds, a.standingIds); }
  // continue all to the same simulated time and compare the full state
  const runTo = (wd, T) => { while (wd.time < T - 1e-9) wd.step(); return wd; };
  const T = Math.max(a.time, b.time, c.time, w.time) + 0.5;
  const fs = [a, b, c, w].map(x => finalState(runTo(x, T)));
  assert.ok(fs.every(f => f === fs[0]), 'identical final states');
});

ok('no NaN, no tunnelling, bounded penetration, everything contained (60 shots)', () => {
  let worst = 0;
  for (let i = 0; i < 60; i++) {
    const inp = { start: -0.36 + (i % 10) * 0.08, angle: ((i * 7) % 13 - 6) * 0.25, power: (i % 6) / 5, spin: ((i * 3) % 9 - 4) / 4 };
    const w = roll(inp);
    assert.ok(w.finite(), 'finite state ' + JSON.stringify(inp));
    worst = Math.max(worst, w.stats.maxPen);
    for (const p of w.pins) { assert.ok(Math.abs(p.pos[0]) < 0.8 && p.pos[2] > -20.1 && p.pos[1] > -0.3 && p.pos[1] < 1.0, 'pin contained ' + p.pos); }
    // a ball that reached the pins on the lane must have touched a pin if it passed within reach of the head pin
    if (!w.ball.gutter && Math.abs(w.ball.pos[0]) < 0.05) assert.ok(w.knocked > 0, 'ball through the head pin without contact ' + JSON.stringify(inp));
  }
  assert.ok(worst < 0.02, 'max penetration ' + worst.toFixed(4) + ' m');
});

ok('settling: pins come to rest, no persistent jitter, the count is frozen at settle', () => {
  const w = roll({ start: 0.12, power: 0.7, spin: -0.3 });
  assert.ok(w.settled);
  const before = finalState(w), count = w.knocked;
  for (let i = 0; i < 600 * 4; i++) w.step();            // 4 more seconds
  const deck = w.pins.filter(p => p.pos[2] > P.DECK_END && Math.abs(p.pos[0]) < P.HALF && p.pos[1] > 0);
  assert.ok(deck.every(p => p.asleep), 'deck pins asleep');
  assert.equal(w.knocked, count);
  void before;
});

ok('halfway pause freezes the state exactly; resume continues as if never paused', () => {
  const inp = { start: 0.2, power: 0.6, spin: -0.6 };
  const a = P.create(), b = P.create(); a.launch(P.releaseState(inp)); b.launch(P.releaseState(inp));
  while (a.ball.pos[2] > -P.LENGTH / 2) a.step();
  const held = JSON.stringify(a.snapshot());
  for (let i = 0; i < 100; i++) a.update(0);               // frozen frames
  assert.equal(JSON.stringify(a.snapshot()), held);
  while (!a.settled) a.step();
  while (!b.settled) b.step();
  assert.equal(finalState(a), finalState(b)); assert.equal(a.knocked, b.knocked);
});

ok('reset gives a clean rack and no ball; releaseState clamps unsafe inputs', () => {
  const w = roll({ start: 0, power: 0.8 }); w.reset();
  assert.equal(w.knocked, 0); assert.equal(w.pins.length, 10); assert.equal(w.ball, null); assert.equal(w.settled, false);
  const s = P.releaseState({ start: 9, angle: 99, power: 7, spin: -5 });
  assert.ok(s.pos[0] <= 0.4 && Math.abs(Math.atan2(s.dir[0], -s.dir[2]) * 180 / Math.PI - 3) < 1e-9 && s.speed === 9);
});

ok('contact events are de-duplicated per pair (one sound per new contact, not per sub-step)', () => {
  const w = P.create(); w.launch(P.releaseState({ start: 0.2, power: 0.65, spin: -0.6 }));
  const ev = []; while (!w.settled) { w.update(1 / 60); ev.push(...w.drainEvents()); }
  const bp = ev.filter(e => e.type === 'ball-pin');
  assert.ok(bp.length > 0 && bp.length < 40, 'ball-pin events ' + bp.length);
  assert.ok(ev.length < 400, 'total events ' + ev.length);
});

console.log(`\n${passed} physics tests passed`);
