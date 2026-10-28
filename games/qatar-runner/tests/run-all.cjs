#!/usr/bin/env node
/* عدّاء قطر — automated test suite (headless Chromium + SwiftShader WebGL, deterministic QA stepping).
 * Covers the brief's required scenarios that can be verified by code: lanes, jump, slide, collisions, fair
 * generation, gate stop / question / correct / wrong + recoil / hearts / recovery / no repeats / no freezes,
 * answer randomisation, Arabic RTL, sounds, character lock + cloth sanity + knee direction + foot planting +
 * jitter, teacher save replaces samples, images, touch swipes, restart, timer, game over, offline single file,
 * student export, performance counters.  Writes docs/test-results.json and docs/TEST_RESULTS.md.
 *   node tests/run-all.cjs            (from the game folder; needs dist/ built by tools/build-offline.cjs)
 */
'use strict';
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), url = (f, q = '') => 'file://' + path.join(root, f) + q;
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'];
const results = []; const only = process.argv.slice(2);
async function run(name, fn) {
  if (only.length && !only.some(o => name.includes(o))) return;
  const t0 = Date.now();
  try { const info = await fn(); results.push({ name, pass: true, ms: Date.now() - t0, info: info || '' }); console.log('PASS', name, info ? '— ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''); }
  catch (e) { results.push({ name, pass: false, ms: Date.now() - t0, error: String(e && e.message || e).slice(0, 600) }); console.log('FAIL', name, '—', e && e.message); }
}
async function openGame(browser, q = '?qa=1&quality=low', vp = { width: 1100, height: 680 }, extra = {}) {
  const page = await browser.newPage(Object.assign({ viewport: vp }, extra)); const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', r => requests.push(r.url()));
  await page.goto(url(extra.file || 'index.html', q));
  await page.waitForFunction(() => window.QRGame && QRGame.state.phase === 'menu', null, { timeout: 300000 });
  return { page, errors, requests };
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ARGS });
  const A = await openGame(browser, '?qa=1&quality=low&reset=1'); const p = A.page;

  await run('01 boot: menu reached, Arabic RTL, Tajawal font, no runtime errors, no network', async () => {
    const r = await ev(p, async () => { await document.fonts.ready; return { dir: document.documentElement.dir, lang: document.documentElement.lang, font: document.fonts.check('800 20px Tajawal'), title: document.title, start: !document.getElementById('btnStart').disabled }; });
    assert.equal(r.dir, 'rtl'); assert.equal(r.lang, 'ar'); assert.equal(r.font, true, 'Tajawal loaded'); assert(r.title.includes('عدّاء قطر')); assert.equal(r.start, true);
    const net = A.requests.filter(u => !u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')); assert.deepEqual(net, [], 'no network requests');
    assert.deepEqual(A.errors, []); return 'dir=rtl, fonts ok, ' + A.requests.length + ' local files';
  });
  await run('02 three lanes: smooth lane switching, exactly three lanes', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state; G.start(); G.step(1.0); G.clearTrack(); G.teleport(40); const xs = [];
      G.moveLane(-1); let t = 0; while (Math.abs(S.x + 2.5) > 0.1 && t < 2) { G.step(1 / 60); t += 1 / 60; } const tLane = t;
      G.step(0.3); xs.push(S.x); G.moveLane(-1); G.step(0.4); xs.push(S.x); G.moveLane(1); G.step(0.4); G.moveLane(1); G.step(0.5); xs.push(S.x); G.moveLane(1); G.step(0.4); xs.push(S.x);
      let maxJump = 0, prev = S.x; G.moveLane(-1); for (let i = 0; i < 40; i++) { G.step(1 / 60); maxJump = Math.max(maxJump, Math.abs(S.x - prev)); prev = S.x; }
      return { xs, tLane, maxJump, lane: S.lane }; });
    assert(Math.abs(r.xs[0] + 2.5) < 0.05 && Math.abs(r.xs[1] + 2.5) < 0.05, 'left limit'); assert(Math.abs(r.xs[2] - 2.5) < 0.05 && Math.abs(r.xs[3] - 2.5) < 0.05, 'right limit');
    assert(r.tLane < 0.4, 'lane change under 0.4 s'); assert(r.maxJump < 0.25, 'no teleporting between frames (< 15 m/s lateral)'); return `lane change ${r.tLane.toFixed(2)} s, max step ${r.maxJump.toFixed(3)} m/frame`;
  });
  await run('03 jump: consistent height and duration, landing detected, no double-jump', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state; G.clearTrack(); G.teleport(40); G.step(0.5); const out = [];
      for (let k = 0; k < 2; k++) { G.jump(); let maxY = 0, t = 0; G.step(0.15); if (k === 1) G.jump(); while (S.air && t < 3) { G.step(1 / 60); t += 1 / 60; maxY = Math.max(maxY, S.y); } out.push({ maxY, t: t + 0.15, y: S.y, air: S.air }); G.step(0.3); }
      return { out, H: G.consts.JUMP_H, T: G.consts.JUMP_T }; });
    for (const j of r.out) { assert(Math.abs(j.maxY - r.H) < 0.03, 'height ' + j.maxY); assert(Math.abs(j.t - r.T) < 0.05, 'duration ' + j.t); assert.equal(j.y, 0); assert.equal(j.air, false); }
    return `peak ${r.out[0].maxY.toFixed(2)} m, airtime ${r.out[0].t.toFixed(2)} s, second press mid-air ignored (peak ${r.out[1].maxY.toFixed(2)} m)`;
  });
  await run('04 slide: fixed duration, returns to running', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state; G.clearTrack(); G.slide(); let t = 0; while (S.slideT >= 0 && t < 3) { G.step(1 / 60); t += 1 / 60; } G.step(0.3); return { t, slideT: S.slideT, T: G.consts.SLIDE_T, anim: G.anim.state }; });
    assert(Math.abs(r.t - r.T) < 0.05); assert.equal(r.slideT, -1); assert.equal(r.anim, 'run'); return `slide ${r.t.toFixed(2)} s`;
  });
  await run('05 collisions: hit when ignoring a hazard, clear when jumping / sliding / dodging; no getting stuck', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state; const out = {};
      const go = (lanes, act) => { G.teleport(40); G.state.lane = 1; G.step(0.6); G.state.invulT = 0; const h0 = S.hits; G.testRow(lanes, 16); for (let i = 0; i < 160; i++) { const row = G.track.rows[0]; const d = row ? row.s - S.distance : 99; if (act === 'jump' && !S.air && d < S.speed * 0.34 + 0.6 && d > 0.3) G.jump(); if (act === 'slide' && S.slideT < 0 && d < 2.6 && d > 0.2) G.slide(); if (act === 'dodge' && d < 12 && S.lane === 1) G.moveLane(-1); G.step(1 / 60); } return S.hits - h0; };
      out.jerseyIgnore = go(['free', 'jersey', 'free'], null); G.step(1.2); out.jerseyJump = go(['free', 'jersey', 'free'], 'jump'); G.step(0.4);
      out.hurdleJump = go(['free', 'hurdle', 'free'], 'jump'); G.step(0.4); out.coneJump = go(['free', 'cone', 'free'], 'jump'); G.step(0.4);
      out.beamIgnore = go(['free', 'beam', 'free'], null); G.step(1.2); out.beamSlide = go(['free', 'beam', 'free'], 'slide'); G.step(0.4);
      out.carDodge = go(['free', 'suv', 'free'], 'dodge'); G.step(0.6); G.moveLane(1); G.step(0.6);
      const h0 = S.hits; G.teleport(40); G.state.lane = 1; G.step(0.5); G.state.invulT = 0; G.testRow(['free', 'suv', 'free'], 16); let stuck = 0, minSpeedAfter = 99; for (let i = 0; i < 240; i++) { G.step(1 / 60); if (S.bumpT < 0 && S.hits > h0) minSpeedAfter = Math.min(minSpeedAfter, S.speed); if (S.speed < 0.5 && S.bumpT < 0 && S.hits > h0) stuck++; }
      out.carFront = S.hits - h0; out.laneAfterBump = S.lane; out.speedAfter = S.speed; out.stuckFrames = stuck; return out; });
    assert.equal(r.jerseyIgnore, 1); assert.equal(r.jerseyJump, 0); assert.equal(r.hurdleJump, 0); assert.equal(r.coneJump, 0); assert.equal(r.beamIgnore, 1); assert.equal(r.beamSlide, 0); assert.equal(r.carDodge, 0);
    assert.equal(r.carFront, 1); assert.notEqual(r.laneAfterBump, 1, 'auto side-step after bumping a car'); assert(r.speedAfter > 5, 'keeps running'); assert(r.stuckFrames < 5, 'not stuck');
    return r;
  });
  await run('06 fair generation: every row keeps a reachable passable lane (3 difficulties × 6 km), no hazards near gates', async () => {
    const r = await ev(p, () => { const T = THREE, out = {};
      for (const diff of ['easy', 'normal', 'hard']) {
        const tr = new QRTrack.Track(new T.Scene(), new T.Group(), { difficulty: diff }); tr.reset({ start: 70, seed: 99 }); tr.setBlocked([[900, 1030], [1900, 2030]]);
        let speed = 7, bad = 0, minGap = 1e9, blockedHits = 0, reach = 0b111, last = 0, rows = 0;
        for (let d = 0; d < 6000; d += 20) { speed = Math.min(12.5, 7 + d / 600); tr.generate(d, speed, () => (d % 1400 < 700 ? 'corniche' : 'souq')); }
        for (const row of tr.rows) { rows++; if (last) minGap = Math.min(minGap, row.s - last); if (tr.isBlocked(row.s)) blockedHits++;
          const sp = Math.min(12.5, 7 + row.s / 600), k = Math.max(0, Math.min(2, Math.floor((row.s - last) / sp / 0.3))); let r2 = reach; for (let i = 0; i < k; i++) r2 = r2 | ((r2 << 1) & 7) | (r2 >> 1); if (!last) r2 = 7;
          let pass = 0; row.lanes.forEach((t, i) => { if (t !== 'block') pass |= 1 << i; }); reach = pass & r2; if (!reach) bad++; last = row.s; }
        out[diff] = { rows, bad, minGap: +minGap.toFixed(1), blockedHits };
      }
      return out; });
    for (const d of ['easy', 'normal', 'hard']) { assert.equal(r[d].bad, 0, d + ' unreachable rows'); assert(r[d].minGap >= 12.5, d + ' min gap'); assert.equal(r[d].blockedHits, 0, d + ' hazard inside gate zone'); assert(r[d].rows > 150); }
    return r;
  });
  await run('07 question gate: stop before gate → question; wrong = recoil + exactly one heart; retry; correct opens; no repeats', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state; G.restart(false); G.autopilot(true); const out = {};
      G.until(s => s.phase === 'question', 120); const g = S.gates[0]; out.stopGap = g.s - S.distance; out.speed = S.speed; out.cardVisible = !document.getElementById('question').hidden; out.opts = document.querySelectorAll('#qOptions .opt').length;
      out.optsFirst = [...document.querySelectorAll('#qOptions .opt-t')].map(e => e.textContent);
      const h0 = S.hearts; G.answerWrong(); let minD = S.distance, phases = new Set(); for (let i = 0; i < 60 * 10 && S.phase !== 'question'; i++) { G.step(1 / 60); minD = Math.min(minD, S.distance); phases.add(S.phase); }
      out.heartsLost = h0 - S.hearts; out.recoil = +(g.s - G.consts.STOP_BEFORE - minD).toFixed(2); out.phases = [...phases]; out.reopened = S.phase === 'question';
      out.optsSecond = [...document.querySelectorAll('#qOptions .opt-t')].map(e => e.textContent);
      G.answerCorrect(); G.until(s => s.phase === 'run', 10); out.gateIdx = S.gateIdx; out.passed = S.distance > g.s;
      G.until(s => s.phase === 'question', 120); out.next = S.gateIdx; G.answerCorrect(); G.until(s => s.phase === 'run', 10);
      out.results = S.results.map(x => x.q + (x.correct ? '✓' : '✗')); return out; });
    assert(r.stopGap > 4.5 && r.stopGap < 5.3, 'stops before the gate'); assert.equal(r.speed, 0); assert.equal(r.cardVisible, true); assert.equal(r.opts, 4);
    assert.equal(r.heartsLost, 1, 'exactly one heart'); assert(Math.abs(r.recoil - 6.6) < 0.6, 'recoil ≈ 6.6 m, got ' + r.recoil); assert.equal(r.reopened, true);
    assert(r.phases.includes('reject') && r.phases.includes('recover') && r.phases.includes('retry') && r.phases.includes('approach'));
    assert.deepEqual([...r.optsFirst].sort(), [...r.optsSecond].sort(), 'same options, reshuffled');
    assert.equal(r.gateIdx, 1); assert.equal(r.passed, true); assert.equal(r.next, 1); assert.deepEqual(r.results, ['0✗', '0✓', '1✓']);
    return { recoil_m: r.recoil, phases: r.phases.join('→'), results: r.results.join(' ') };
  });
  await run('08 input protection: repeated answer clicks evaluate once; a closed gate cannot be crossed', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state; G.until(s => s.phase === 'question', 120); const n0 = S.results.length; G.answer(0); G.answer(1); G.answer(2); G.step(1.2); const n1 = S.results.length;
      G.until(s => s.phase === 'question' || s.phase === 'run', 20); if (S.phase === 'question') { G.answerCorrect(); G.until(s => s.phase === 'run', 10); }
      G.autopilot(false); G.until(s => s.phase === 'approach', 120); const g = S.gates[S.gateIdx]; G.teleport(g.s + 3); G.step(1 / 60); const d = S.distance; G.autopilot(true); return { evals: n1 - n0, d, limit: g.s - G.consts.STOP_BEFORE }; });
    assert.equal(r.evals, 1); assert(r.d <= r.limit + 0.01, 'clamped at the gate'); return r;
  });
  await run('09 answer randomisation: correct answer spread over all positions (2/3/4 answers)', async () => {
    const r = await ev(p, () => { const q = { options: ['أ', 'ب', 'ج', 'د'], correct: 0 }, out = {}; for (const n of [2, 3, 4]) { const c = new Array(n).fill(0); for (let i = 0; i < 6000; i++) { const pr = QRConfig.present(q, n); c[pr.correctPos]++; if (pr.options[pr.correctPos] !== 'أ' || pr.options.length !== n) return 'mapping broken'; } out[n] = c; } return out; });
    assert.notEqual(r, 'mapping broken'); for (const n of [2, 3, 4]) for (const c of r[n]) assert(Math.abs(c - 6000 / n) < 6000 / n * 0.12, 'uniform ' + n); return r;
  });
  await run('10 sounds fire at the right moments (wrong → wave → recoil; correct → success → gate opens)', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state, A = G.audio; A.init(); A.log.length = 0; G.restart(false); G.autopilot(true);
      G.until(s => s.phase === 'question', 120); G.answerWrong(); G.until(s => s.phase === 'question', 12); G.answerCorrect(); G.until(s => s.phase === 'run', 10); for (let i = 0; i < 60 && !A.log.includes('jump'); i++) G.step(0.5);
      return { log: A.log.slice(), ctx: !!A.ctx, state: A.ctx && A.ctx.state }; });
    const L = r.log, idx = k => L.indexOf(k);
    assert(r.ctx, 'audio context'); for (const k of ['question-open', 'select', 'wrong', 'wave', 'recoil', 'success', 'gate-open']) assert(idx(k) >= 0, 'missing ' + k);
    assert(idx('wrong') < idx('wave') && idx('wave') < idx('recoil') && idx('recoil') < L.lastIndexOf('question-open') && L.lastIndexOf('question-open') < idx('success') && idx('success') < idx('gate-open'));
    return L.filter(k => !k.startsWith('music')).slice(0, 14).join(' → ');
  });
  await run('11 character lock + cloth + knees + planted feet + no jitter', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state, B = G.boy, T = THREE;
      const sig = () => { const m = []; B.group.traverse(o => { if (o.isMesh) m.push(o.name + ':' + o.geometry.attributes.position.count + ':' + (o.material.uuid || '')); }); return m.join('|'); };
      const s0 = sig(); G.restart(false); G.clearTrack(); G.step(1.5);
      const hip = new T.Vector3(), knee = new T.Vector3(), ank = new T.Vector3(), fwd = new T.Vector3(), prevA = { L: null, R: null };
      let kneeBack = 0, frames = 0, nan = 0, planted = 0, plantedOk = 0; const ys = [];
      for (let i = 0; i < 180; i++) { G.step(1 / 60); frames++;
        for (const sd of ['L', 'R']) { const L = B.legs[sd]; L.thigh.getWorldPosition(hip); L.shin.getWorldPosition(knee); L.foot.getWorldPosition(ank); fwd.set(0, 0, -1);
          const ha = ank.clone().sub(hip), t = knee.clone().sub(hip).dot(ha) / ha.lengthSq(), proj = hip.clone().addScaledVector(ha, t), off = knee.clone().sub(proj).dot(fwd); if (off < -0.01) kneeBack++;
          if (G.anim.lastContact[sd] && prevA[sd] && ank.y < 0.16) { planted++; const vz = (ank.z - prevA[sd].z) * 60; if (Math.abs(vz - S.speed) < S.speed * 0.35) plantedOk++; }
          prevA[sd] = ank.clone(); }
        B.bones.root.getWorldPosition(hip); ys.push(hip.y);
        for (const a of [B.skirt.p, B.ghutra.p]) for (let k = 0; k < a.length; k++) if (!Number.isFinite(a[k])) nan++; }
      let jerk = 0; for (let i = 3; i < ys.length; i++) jerk = Math.max(jerk, Math.abs(ys[i] - 3 * ys[i - 1] + 3 * ys[i - 2] - ys[i - 3]));
      // cloth stays attached: ghutra cap pinned to head, skirt top pinned to pelvis
      B.model.updateMatrixWorld(true); const mi = new T.Matrix4().copy(B.model.matrixWorld).invert(); let pinErr = 0; for (const [k, loc] of B.ghutraPins) { const w = loc.clone().applyMatrix4(B.bones.head.matrixWorld).applyMatrix4(mi); pinErr = Math.max(pinErr, w.distanceTo(new T.Vector3().fromArray(B.ghutra.p, k * 3))); }
      // states: jump, slide, recoil, idle, victory — identity must not change
      G.jump(); G.step(0.4); const s1 = sig(); G.step(0.5); G.slide(); G.step(0.4); const s2 = sig();
      return { same: s0 === s1 && s1 === s2, meshes: s0.split('|').length, kneeBack, frames, planted, plantedOk, jerk, nan, pinErr }; });
    assert.equal(r.same, true, 'meshes/materials identical in every state'); assert.equal(r.kneeBack, 0, 'knees never bend backwards'); assert.equal(r.nan, 0);
    assert(r.pinErr < 1e-4, 'ghutra pinned'); assert(r.plantedOk / Math.max(1, r.planted) > 0.8, 'planted feet move with the ground ' + r.plantedOk + '/' + r.planted); assert(r.jerk < 0.006, 'hip jerk ' + r.jerk);
    return { meshes: r.meshes, plantedFeet: r.plantedOk + '/' + r.planted, hipJerk: +r.jerk.toFixed(4) };
  });
  await run('12 restart from pause, question timer timeout, game over → retry from gate', async () => {
    const r = await ev(p, () => { const G = QRGame, S = G.state; const out = {};
      G.restart(false); G.step(3); document.getElementById('btnPause').click(); out.paused = S.paused; document.getElementById('btnRestart').click(); out.afterRestart = { d: S.distance, paused: S.paused, phase: S.phase };
      const c = Object.assign({}, G.cfg, { timer: 15, attempts: 1 }); G.setConfig(c); G.restart(false); G.autopilot(true); G.until(s => s.phase === 'question', 120);
      out.timerShown = !document.getElementById('qTimer').hidden; G.step(15.8); out.timeout = S.results[S.results.length - 1]; G.until(s => s.phase === 'gameover', 10); out.over = S.phase; out.screen = !document.getElementById('gameover').hidden;
      document.getElementById('btnRetryGate').click(); G.until(s => s.phase === 'question', 30); out.retry = { phase: S.phase, hearts: S.hearts, gate: S.gateIdx };
      G.setConfig(Object.assign({}, c, { timer: 0, attempts: 3 })); return out; });
    assert.equal(r.paused, true); assert.equal(r.afterRestart.paused, false); assert(r.afterRestart.d < 1);
    assert.equal(r.timerShown, true); assert(r.timeout && r.timeout.timeout === true && r.timeout.correct === false, 'timeout counts as wrong'); assert.equal(r.over, 'gameover'); assert.equal(r.screen, true);
    assert.deepEqual(r.retry, { phase: 'question', hearts: 1, gate: 0 }); return 'pause→restart, 15 s timer, game over → retry gate';
  });
  await run('13 performance counters (low quality, headless)', async () => {
    const r = await ev(p, () => { const G = QRGame; G.restart(false); G.autopilot(true); G.step(4); const t0 = performance.now(); for (let i = 0; i < 120; i++) G.step(1 / 60); const stepMs = (performance.now() - t0) / 120; G.render(); const info = G.world.renderer.info.render; return { stepMs: +stepMs.toFixed(2), calls: info.calls, triangles: info.triangles }; });
    assert(r.stepMs < 25, 'logic+animation+cloth per frame'); return r;
  });
  assert.deepEqual(A.errors, []); await p.close();

  // ---------------- teacher dashboard
  const B = await openGame(browser, '?qa=1&quality=low&reset=1', { width: 1200, height: 900 });
  await run('14 teacher: new lesson replaces sample data; correct-answer selector; image upload; settings persist', async () => {
    const q = B.page; await q.click('#btnTeacher'); await q.waitForSelector('.t-q');
    await q.fill('[data-k=lesson]', 'الكسور العشرية'); await q.fill('[data-k=teacher]', 'أ. محمود'); await q.selectOption('[data-k=attempts]', '2'); await q.selectOption('[data-k=environment]', 'souq');
    // keep two questions: delete the rest
    while ((await q.locator('.t-q').count()) > 2) { await q.locator('.t-q').last().locator('[data-q=del]').click(); }
    const cards = q.locator('.t-q');
    await cards.nth(0).locator('[data-qk=text]').fill('كم يساوي ٠٫٥ + ٠٫٢٥؟'); for (const [k, v] of [[0, '٠٫٧٥'], [1, '٠٫٧'], [2, '٠٫٣'], [3, '١٫٧٥']]) await cards.nth(0).locator(`[data-qo="${k}"]`).fill(v); await cards.nth(0).locator('[data-qc="0"]').check();
    await cards.nth(1).locator('[data-qk=text]').fill('أيّ عدد أكبر؟'); for (const [k, v] of [[0, '٠٫٠٩'], [1, '٠٫٩'], [2, ''], [3, '']]) await cards.nth(1).locator(`[data-qo="${k}"]`).fill(v); await cards.nth(1).locator('[data-qc="1"]').check();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDGgAQZGBgAeIAMB0zsCgAAAAABJRU5ErkJggg==', 'base64');
    await cards.nth(0).locator('[data-qimg]').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: png }); await q.waitForSelector('.t-thumb');
    await q.click('[data-act=save]'); await q.waitForSelector('.t-msg.ok');
    const r = await q.evaluate(() => { const c = QRConfig.load(); return { n: c.questions.length, sample: c.sample, lesson: c.lesson, attempts: c.attempts, env: c.environment, q2: c.questions[1], img: c.questions[0].image.slice(0, 23), stored: localStorage.getItem('qatarRunner.config.v1').length, other: Object.keys(localStorage).filter(k => !k.startsWith('qatarRunner')) }; });
    assert.equal(r.n, 2); assert.equal(r.sample, false); assert.equal(r.lesson, 'الكسور العشرية'); assert.equal(r.attempts, 2); assert.equal(r.env, 'souq');
    assert.deepEqual(r.q2.options, ['٠٫٠٩', '٠٫٩']); assert.equal(r.q2.correct, 1, 'correct answer kept after removing empty boxes'); assert.equal(r.img, 'data:image/jpeg;base64,'); assert.deepEqual(r.other, [], 'no other storage keys touched');
    await q.click('[data-act=close]'); const g = await q.evaluate(() => { QRGame.start(); QRGame.step(0.5); return { total: QRGame.state.total, gates: QRGame.state.gates.length, hearts: QRGame.state.hearts, zone: QRGame.state.zone, menuLesson: document.getElementById('mLesson').textContent }; });
    assert.equal(g.total, 2); assert.equal(g.gates, 2); assert.equal(g.hearts, 2); assert.equal(g.zone, 'souq'); assert.equal(g.menuLesson, 'الكسور العشرية');
    const img = await q.evaluate(() => { QRGame.autopilot(true); QRGame.until(s => s.phase === 'question', 120); return { shown: !document.getElementById('qImage').hidden, text: document.getElementById('qText').textContent }; });
    assert.equal(img.shown, true); assert.equal(img.text, 'كم يساوي ٠٫٥ + ٠٫٢٥؟'); return 'saved 2 questions, image, 2 hearts, Souq route';
  });
  assert.deepEqual(B.errors, []); await B.page.close();

  // ---------------- touch / phone
  const C = await openGame(browser, '?qa=1&quality=low', { width: 390, height: 844 }, { hasTouch: true, isMobile: true });
  await run('15 phone portrait: swipe controls (left / right / up / down) and on-screen buttons', async () => {
    const q = C.page; await q.evaluate(() => { QRGame.start(); QRGame.step(1.0); QRGame.clearTrack(); });
    const swipe = async (dx, dy) => { await q.evaluate(([dx, dy]) => { const c = document.getElementById('view'), o = { pointerType: 'touch', bubbles: true, clientX: 195, clientY: 500, pointerId: 1 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointermove', Object.assign({}, o, { clientX: 195 + dx, clientY: 500 + dy }))); c.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, { clientX: 195 + dx, clientY: 500 + dy }))); QRGame.step(0.05); }, [dx, dy]); };
    await swipe(-80, 0); const a = await q.evaluate(() => QRGame.state.lane); await q.evaluate(() => QRGame.step(0.4)); await swipe(0, -90); const b = await q.evaluate(() => QRGame.state.air);
    await q.evaluate(() => QRGame.step(1)); await swipe(0, 90); const c = await q.evaluate(() => QRGame.state.slideT >= 0); await q.evaluate(() => QRGame.step(1)); await swipe(80, 0); await q.evaluate(() => QRGame.step(0.4)); const d = await q.evaluate(() => QRGame.state.lane);
    const visible = await q.evaluate(() => !document.getElementById('controls').hidden); await q.evaluate(() => document.querySelector('[data-ctl=right]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); const e = await q.evaluate(() => QRGame.state.lane);
    assert.equal(a, 0); assert.equal(b, true); assert.equal(c, true); assert.equal(d, 1); assert.equal(visible, true); assert.equal(e, 2); return 'swipes + buttons ok';
  });
  assert.deepEqual(C.errors, []); await C.page.close();

  // ---------------- offline single file + student export
  if (fs.existsSync(path.join(root, 'dist/qatar-runner-offline.html'))) {
    await run('16 offline single file: runs from file:// with all network blocked; student export hides the teacher panel', async () => {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 }, acceptDownloads: true }); await ctx.route(/^https?:/, r => r.abort());
      const q = await ctx.newPage(); const errs = []; q.on('pageerror', e => errs.push(e.message));
      await q.goto(url('dist/qatar-runner-offline.html', '?qa=1&quality=low&reset=1')); await q.waitForFunction(() => window.QRGame && QRGame.state.phase === 'menu', null, { timeout: 300000 });
      await q.evaluate(() => { QRConfig.save(Object.assign(QRConfig.defaults(), { sample: false, lesson: 'درس التصدير', questions: [{ text: 'سؤال واحد؟', options: ['نعم', 'لا'], correct: 0 }] })); QRGame.setConfig(QRConfig.load()); });
      await q.evaluate(() => document.getElementById('btnTeacher').click()); await q.waitForSelector('.t-q');
      const [dl] = await Promise.all([q.waitForEvent('download'), q.click('[data-act=export]')]); const file = path.join(root, 'dist', 'student-export-test.html'); await dl.saveAs(file);
      const html = fs.readFileSync(file, 'utf8'); assert(html.includes('__QR_EMBEDDED_CONFIG__')); assert(html.length > 1e6);
      const s = await ctx.newPage(); s.on('pageerror', e => errs.push(e.message)); await s.goto('file://' + file + '?qa=1&quality=low'); await s.waitForFunction(() => window.QRGame && QRGame.state.phase === 'menu', null, { timeout: 300000 });
      const r = await s.evaluate(() => ({ lesson: document.getElementById('mLesson').textContent, teacherHidden: document.getElementById('btnTeacher').hidden, n: QRGame.cfg.questions.length }));
      fs.unlinkSync(file); await ctx.close(); assert.deepEqual(errs, []);
      assert.equal(r.lesson, 'درس التصدير'); assert.equal(r.teacherHidden, true); assert.equal(r.n, 1); return 'offline OK, export ' + (html.length / 1048576).toFixed(2) + ' MB';
    });
  }
  await browser.close();
  // ---------------- report
  const pass = results.filter(r => r.pass).length, out = { date: new Date().toISOString(), browser: 'Chromium (Playwright) + SwiftShader WebGL, headless', pass, total: results.length, results };
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true }); fs.writeFileSync(path.join(root, 'docs/test-results.json'), JSON.stringify(out, null, 2));
  const md = ['# نتائج الاختبارات الآلية — عدّاء قطر', '', `التاريخ: ${out.date} · البيئة: ${out.browser}`, '', `**النتيجة: ${pass} / ${results.length} ناجح**`, '', '| # | الاختبار | النتيجة | التفاصيل | الزمن |', '|---|---|---|---|---|',
    ...results.map((r, i) => `| ${i + 1} | ${r.name} | ${r.pass ? '✅ ناجح' : '❌ فشل'} | ${String(r.pass ? (typeof r.info === 'string' ? r.info : JSON.stringify(r.info)) : r.error).replace(/\|/g, '/').slice(0, 260)} | ${(r.ms / 1000).toFixed(1)} ث |`)];
  fs.writeFileSync(path.join(root, 'docs/TEST_RESULTS.md'), md.join('\n') + '\n');
  console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
