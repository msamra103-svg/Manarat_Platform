/* Audio checks in Node (no browser): `node tests/bowling-audio.cjs`
 * Runs the real games/bowling/audio.js against a minimal Web Audio stand-in (real sample buffers,
 * stub nodes that record scheduling). Checks the synthesised sounds objectively:
 *  - every buffer finite, peak <= 1, sensible length;
 *  - loops (rolling, hall bed) have no seam: the jump across the loop point is no larger than the
 *    signal's ordinary sample-to-sample movement;
 *  - impacts decay (pins, deck, land): the tail is quiet, so they "crack" rather than ring like bells;
 *  - spectral balance: the rolling loop is low-frequency dominated, pin hits carry real high-frequency energy;
 *  - voice limits per kind and globally, events only after unlock, stopAll keeps exactly 2 loops,
 *    the offline clock (.at) drives scheduling;
 *  - synthesis time at start-up. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '../games/bowling/audio.js'), 'utf8');

function fakeContext(sampleRate = 44100) {
  const param = v => ({ value: v, setTargetAtTime() { }, setValueAtTime() { }, linearRampToValueAtTime() { } });
  const started = [];
  const node = extra => Object.assign({ connect(n) { return n || this; }, disconnect() { } }, extra);
  const ctx = {
    sampleRate, currentTime: 0, state: 'running', destination: node({}), started,
    createBuffer(ch, n, sr) { const data = Array.from({ length: ch }, () => new Float32Array(n)); return { numberOfChannels: ch, length: n, sampleRate: sr, duration: n / sr, getChannelData: c => data[c] }; },
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ type: '', frequency: param(350), Q: param(1) }),
    createStereoPanner: () => node({ pan: param(0) }),
    createConvolver: () => node({ buffer: null }),
    createChannelSplitter: () => node({}),
    createDynamicsCompressor: () => node({ threshold: param(0), ratio: param(1), attack: param(0), release: param(0) }),
    createPeriodicWave: () => ({}),
    createOscillator: () => node({ frequency: param(1), setPeriodicWave() { }, start() { }, stop() { } }),
    createBufferSource() { const s = node({ buffer: null, loop: false, playbackRate: param(1), start(t) { s.t = t; started.push(s); }, stop() { s.stopped = true; } }); return s; }
  };
  return ctx;
}
function load(extra = {}) { const sb = Object.assign({ Math, Float32Array, Array, Object, Map, Number, JSON, Promise, console, Date, setTimeout }, extra); sb.window = sb; vm.createContext(sb); vm.runInContext(SRC, sb); return sb.BowlingAudio; }

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e && e.message); } }

(async () => {
  const A = load(), ctx = fakeContext();
  const audio = A.create({ context: ctx, seed: 5 });
  const t0 = Date.now(); await audio.unlock(); const synthMs = Date.now() - t0;
  const an = audio.analyse();
  const kinds = Object.keys(an);

  await test('all ' + kinds.length + ' sound kinds synthesised: finite, peak <= 1, non-silent (' + synthMs + ' ms)', () => {
    assert.ok(kinds.length >= 17, 'kinds ' + kinds);
    for (const [k, list] of Object.entries(an)) for (const b of list) { assert.ok(!b.nan, k + ' NaN'); assert.ok(b.peak <= 1 && b.peak > 0.3, k + ' peak ' + b.peak); assert.ok(b.rms > 0.005, k + ' silent'); }
    assert.ok(synthMs < 8000, 'synthesis too slow: ' + synthMs + ' ms');
  });

  await test('loops are seamless (rolling + hall bed): loop-point jump <= ordinary sample movement', () => {
    for (const k of ['roll', 'bed']) for (const b of an[k]) assert.ok(b.seam <= b.maxStep * 0.6, k + ' seam ' + b.seam + ' vs max step ' + b.maxStep);
  });

  // grab the actual buffers through a voice: fire an event and read the started source's buffer
  const buffers = {};
  const A2 = load(), ctx2 = fakeContext(); const au2 = A2.create({ context: ctx2, seed: 9 }); await au2.unlock();
  const loopSources = ctx2.started.filter(s => s.loop);
  buffers.roll = loopSources[0].buffer; buffers.bed = loopSources[1].buffer;   // roll starts first (built first)
  const grab = (fire) => { ctx2.started.length = 0; fire(); return ctx2.started.map(s => s.buffer); };
  buffers.pinHit = grab(() => au2.event('contact', { type: 'ball-pin', speed: 6, pos: [0, 0.2, -18] }))[0];
  buffers.pinDeck = grab(() => au2.event('contact', { type: 'deck', a: 'pin', speed: 2, pos: [0, 0.1, -18] }))[0];
  buffers.land = grab(() => au2.event('contact', { type: 'lane', speed: 1.5, pos: [0, 0, -1] }))[0];
  buffers.step = grab(() => au2.event('step', { pos: [0, 0, 2] }))[0];

  const ch = b => b.getChannelData(0);
  const energy = (d, a, z) => { let s = 0; for (let i = Math.floor(a); i < Math.floor(z); i++) s += d[i] * d[i]; return s; };
  await test('impacts decay quickly (crack, not bell): last 40% of pin/deck/land/step buffers < 1% of the energy', () => {
    for (const k of ['pinHit', 'pinDeck', 'land', 'step']) { const d = ch(buffers[k]), n = d.length, tot = energy(d, 0, n), tail = energy(d, n * 0.6, n); assert.ok(tail / tot < 0.01, k + ' tail ratio ' + (tail / tot).toFixed(4)); }
    const d = ch(buffers.pinHit), sr = 44100; assert.ok(energy(d, 0, sr * 0.02) / energy(d, 0, d.length) > 0.35, 'pin hit energy front-loaded');
  });

  // share of the energy below a frequency (4-pole low-pass at the buffer's own sample rate)
  const lowShare = (b, fc, from = 0, to = 1) => { const d = ch(b), a0 = Math.floor(d.length * from), a1 = Math.floor(d.length * to), k = Math.exp(-2 * Math.PI * fc / b.sampleRate); let y1 = 0, y2 = 0, y3 = 0, y4 = 0, eL = 0, eT = 0; for (let i = a0; i < a1; i++) { const x = d[i]; y1 = (1 - k) * x + k * y1; y2 = (1 - k) * y1 + k * y2; y3 = (1 - k) * y2 + k * y3; y4 = (1 - k) * y3 + k * y4; eL += y4 * y4; eT += x * x; } return eL / eT; };
  await test('spectral balance: rolling rumble and landing are low, pin hits are bright', () => {
    const r = { roll: lowShare(buffers.roll, 500), land: lowShare(buffers.land, 400, 0, 0.5), pinHit: lowShare(buffers.pinHit, 500, 0, 0.15), step: lowShare(buffers.step, 500, 0, 0.3) };
    console.log('   energy share below 400-500 Hz', JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.toFixed(2)]))));
    assert.ok(r.roll > 0.7, 'roll ' + r.roll); assert.ok(r.land > 0.6, 'land ' + r.land); assert.ok(r.pinHit < 0.35, 'pin ' + r.pinHit);
  });

  await test('voice limits per kind and globally; nothing plays before unlock; stopAll keeps the 2 loops', async () => {
    const A3 = load(), c3 = fakeContext(), a3 = A3.create({ context: c3 });
    a3.event('contact', { type: 'ball-pin', speed: 5 }); assert.equal(a3.stats().voices, 0, 'no voice before unlock');
    await a3.unlock();
    for (let i = 0; i < 40; i++) a3.event('contact', { type: 'pin-pin', speed: 3, pos: [0, 0.2, -18] });
    assert.ok(a3.stats().voices <= 8, 'pin-pin voices ' + a3.stats().voices);
    for (let i = 0; i < 60; i++) { a3.event('contact', { type: 'deck', a: 'pin', speed: 2 }); a3.event('step', {}); a3.event('contact', { type: 'ball-pin', speed: 4 }); a3.event('contact', { type: 'kickback', speed: 3 }); a3.event('contact', { type: 'gutter', a: 'pin', speed: 2 }); }
    assert.ok(a3.stats().voices <= 28, 'global voices ' + a3.stats().voices);
    a3.stopAll(); assert.equal(a3.stats().voices, 0); assert.equal(a3.stats().loops, 2);
  });

  await test('offline clock: events are scheduled at .at(t) (+ their own delay)', async () => {
    const A4 = load(), c4 = fakeContext(), a4 = A4.create({ context: c4 }); a4.at(0); await a4.unlock();
    c4.started.length = 0; a4.at(3.25); a4.event('step', {}); assert.equal(c4.started[0].t, 3.25);
    c4.started.length = 0; a4.at(5); a4.event('sweep', {}); assert.deepEqual(c4.started.map(s => s.t), [5, 6]);
  });

  await test('distant lane activity: occasional, quiet, and silent while a question is open', async () => {
    const A5 = load(), c5 = fakeContext(), a5 = A5.create({ context: c5, seed: 3 }); a5.at(0); await a5.unlock();
    let far = 0; c5.started.length = 0;
    for (let t = 0; t < 120; t += 0.04) { a5.at(t); a5.rolling({ speed: 0 }); }
    far = c5.started.length; assert.ok(far >= 3 && far <= 12, 'far events in 2 min: ' + far);
    c5.started.length = 0; a5.crowd('question');
    for (let t = 120; t < 240; t += 0.04) { a5.at(t); a5.rolling({ speed: 0, frozen: true }); }
    assert.equal(c5.started.length, 0, 'no distant crashes during the question');
  });

  await test('live start-up never blocks the page: unlock returns at once, synthesis runs in short slices (~10 ms target, < 100 ms), loops start when built', async () => {
    // loaded as a plain script on the real global (a VM sandbox would slow global lookups and distort timing)
    global.window = global; global.AudioContext = function () { const c = fakeContext(48000); c.resume = async () => { }; return c; };
    require(path.join(__dirname, '../games/bowling/audio.js')); const A6 = global.BowlingAudio;
    const a6 = A6.create({});
    const t0 = Date.now(); assert.equal(await a6.unlock(), true); const tUnlock = Date.now() - t0;
    assert.ok(tUnlock < 150, 'unlock blocked for ' + tUnlock + ' ms');
    let worst = 0, last = Date.now(), done = false;
    a6.built.then(() => { done = true; });
    while (!done) { await new Promise(r => setTimeout(r, 0)); const n = Date.now(); worst = Math.max(worst, n - last); last = n; }
    console.log('   unlock ' + tUnlock + ' ms, longest synthesis slice ' + worst + ' ms, total ' + (Date.now() - t0) + ' ms');
    assert.ok(worst < 100, 'longest blocking slice ' + worst + ' ms');   // ~10 ms target; margin for a loaded CI machine
    assert.equal(a6.stats().loops, 2);
  });
  console.log(`\naudio: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
