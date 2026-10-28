/* Target Shooting 3D — animation stability on the real game (browser, QA manual stepping).
 * For every mode: complete shot cycles (acquire → raise → nock → draw → hold → release → follow-through →
 * recover) at 30, 60 and 144 fps and with a random frame time between 1/144 s and 1/20 s (simulated CPU/GPU
 * load), measured by core/diagnostics.js on the final skeleton. Also: bow/hand/string/arrow attachment,
 * a perfectly still hold, a stepping TURN without foot sliding, mode changes without re-creating the character.
 */
const { chromium } = require('playwright'), fs = require('fs'), http = require('http'), path = require('path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)); fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); }); });
const LIMITS = { tremble: 0, maxW: 20, maxAcc: 1600, footSlide: 0.001, minSole: -0.003, scale: 1e-4, rootStep: 1e-6, camSpikes: 0, conflicts: 0 };
const results = [];

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/games/target-shooting/index.html?qa=1&manual=1&quality=low');
  await page.waitForFunction(() => window.__tsQA && document.body.dataset.phase === 'menu', null, { timeout: 300000 });
  await page.evaluate(() => {
    window.__cycle = (fps, variable, shots) => {
      const Q = __tsQA, A = Q.archer(); let seed = 99; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const dt = () => variable ? 1 / 144 + rnd() * (1 / 20 - 1 / 144) : 1 / fps;
      const step = (sec) => { let t = 0; while (t < sec) { const d = dt(); Q.step(1, d, false); t += d; } };
      const out = { attach: 0, string: 0, arrowDir: 0, holdHeadW: 0, releases: 0 };
      const before = Q.state.shots;
      for (let k = 0; k < shots; k++) {
        if (Q.state.phase !== 'shooting' || Q.state.arrowsLeft <= 0) break;
        const aimFn = () => { const ok = Q.aimAtTarget(0, true, false); if (!ok) Q.aimAt(0, 4, -25, false); };
        aimFn(); Q.draw();
        let g = 0; while (A.state !== 'AIM_HOLD' && g++ < 2000) { Q.step(1, dt(), false); aimFn(); }
        step(0.4);   // aim springs settle on the (stopped) aim point
        // full draw: bow hand on the grip, draw fingers on the string, arrow on the string and over the rest
        const T = THREE, r = A.rig, p = r.pose.hand.L, pal = r.rest.L_palm;
        const fW = p.fdir.clone().normalize(), nW = p.ndir.clone().normalize(); fW.sub(nW.clone().multiplyScalar(fW.dot(nW))).normalize();
        const wrist = p.pos.clone().addScaledVector(fW, -pal.len * 0.55).addScaledVector(nW, -0.028);
        out.attach = Math.max(out.attach, r.worldOf('L_Hand', new T.Vector3()).distanceTo(wrist));
        const nockW = A.bow.nockLocal.clone().applyMatrix4(A.bow.group.matrixWorld);
        out.string = Math.max(out.string, nockW.distanceTo(A.arrow.position));
        out.arrowDir = Math.max(out.arrowDir, new T.Vector3(0, 0, 1).applyQuaternion(A.arrow.quaternion).angleTo(A.out.dir));
        // perfectly still hold: aim held, 0.5 s
        const assist = Q.setAssist(0); Q.aimAt(...Q.aim().point, false); step(0.8);   // the student stops moving: reticle settles
        const head = r.bones.Head; let q0 = head.getWorldQuaternion(new T.Quaternion());
        for (let i = 0, tt = 0; tt < 0.35; i++) { const d = dt(); tt += d; Q.step(1, d, false); const q = head.getWorldQuaternion(new T.Quaternion()); const dq = q0.clone().invert().multiply(q); if (i > 0) out.holdHeadW = Math.max(out.holdHeadW, 2 * Math.atan2(Math.hypot(dq.x, dq.y, dq.z), Math.abs(dq.w)) / d); q0 = q; }
        Q.setAssist(assist);
        const rel = A.shotCount; Q.loose(); step(0.2); if (A.shotCount === rel + 1) out.releases++;
        g = 0; while ((Q.state.flights > 0 || !['IDLE', 'RECOVER'].includes(A.state)) && g++ < 3000) Q.step(1, dt(), false);
      }
      out.shots = Q.state.shots - before;
      return out;
    };
  });
  const modes = (process.env.TS_MODES || 'archery,birds,balloons,clay').split(',');
  const runs = [[60, false], [30, false], [144, false], [0, true]];
  const rigUuid = await page.evaluate(() => __tsQA.archer().rig.root.uuid);
  for (const mode of modes) {
    for (const [fps, variable] of runs) {
      await page.evaluate(m => __tsQA.start(m, 'intermediate'), mode);
      await page.waitForFunction(() => document.body.dataset.phase === 'shooting', null, { timeout: 60000 });
      if (mode !== 'archery') await page.evaluate(() => __tsQA.step(150, 1 / 60, false));   // let moving targets enter
      await page.evaluate(() => __tsQA.resetDiag());
      const att = await page.evaluate(([f, v]) => __cycle(f, v, 2), [fps, variable]);
      const d = await page.evaluate(() => __tsQA.diag());
      const label = mode + ' @' + (variable ? 'variable 20–144' : fps) + ' fps';
      results.push({ label, d, att });
      const bad = [];
      if (d.tremble > LIMITS.tremble) bad.push('tremble ' + d.tremble + ' ' + JSON.stringify(Object.entries(d.bones).filter(([k, v]) => v.tremble)));
      if (d.maxBoneAngularVelocity > LIMITS.maxW) bad.push('maxW ' + d.maxBoneAngularVelocity + ' ' + JSON.stringify(Object.entries(d.bones).filter(([k, v]) => v.maxW > LIMITS.maxW).map(([k, v]) => k + ' ' + v.at)));
      if (!variable && d.maxBoneAngularAcceleration > LIMITS.maxAcc) bad.push('maxAcc ' + d.maxBoneAngularAcceleration);
      if (d.footSlide > LIMITS.footSlide) bad.push('footSlide ' + d.footSlide);
      if (d.minSole < LIMITS.minSole) bad.push('sole ' + d.minSole);
      if (+d.scaleDrift > LIMITS.scale) bad.push('scale ' + d.scaleDrift);
      if (d.rootMaxStep > LIMITS.rootStep) bad.push('root ' + d.rootMaxStep);
      if (d.camera.spikes > LIMITS.camSpikes) bad.push('camera ' + JSON.stringify(d.camera));
      if (d.conflicts > LIMITS.conflicts) bad.push('conflicts ' + d.conflicts);
      if (att.attach > 0.012) bad.push('bow hand off the grip ' + att.attach.toFixed(4));
      if (att.string > 0.001) bad.push('arrow nock off the string ' + att.string);
      if (att.arrowDir > 0.01) bad.push('arrow not aligned ' + att.arrowDir);
      if (att.holdHeadW > 0.05) bad.push('head moves during the hold ' + att.holdHeadW.toFixed(4));
      if (att.releases !== att.shots || att.shots < 1) bad.push('releases ' + att.releases + ' / shots ' + att.shots);
      assert.deepEqual(bad, [], label + ': ' + bad.join('; '));
      console.log('PASS', label.padEnd(30), 'tremble 0 · ω≤', d.maxBoneAngularVelocity, 'rad/s · α≤', d.maxBoneAngularAcceleration, '· slide', d.footSlide, 'm · grip err', (att.attach * 1000).toFixed(1), 'mm · hold head ω', att.holdHeadW.toFixed(4));
    }
  }
  // identity lock: one character instance across every mode change
  assert.equal(await page.evaluate(() => __tsQA.archer().rig.root.uuid), rigUuid);
  console.log('PASS identity lock: the same rig instance (', rigUuid.slice(0, 8), ') in all four modes; no re-creation');
  // TURN: real stepping in place, the planted foot never slides, root never jumps
  await page.evaluate(() => { const Q = __tsQA, A = Q.archer(); A.standDown(); Q.step(120, 1 / 60, false); Q.resetDiag(); });
  const turn = await page.evaluate(() => { const A = __tsQA.archer(); if (A.state !== 'IDLE') return 'not idle ' + A.state; A.setStance(A.stance.pos.clone(), new THREE.Vector3(-0.4, 0, -1).normalize(), false); const s = A.state; __tsQA.step(90, 1 / 60, false); const d = __tsQA.diag(); return { s, end: A.state, slide: d.footSlide, root: d.rootMaxStep, tremble: d.tremble, maxW: d.maxBoneAngularVelocity }; });
  assert.equal(turn.s, 'TURN'); assert.equal(turn.end, 'IDLE'); assert(turn.slide <= LIMITS.footSlide && turn.root <= LIMITS.rootStep && turn.tremble === 0, JSON.stringify(turn));
  console.log('PASS TURN: feet step one after the other, planted foot slide', turn.slide, 'm, root fixed, no tremble');
  // invalid transitions are rejected and counted, never applied
  const rej = await page.evaluate(() => { const A = __tsQA.archer(); const c = A.conflicts, s = A.state; const ok = A.go('RELEASE'); return { ok, same: A.state === s, counted: A.conflicts === c + 1 }; });
  assert.deepEqual(rej, { ok: false, same: true, counted: true });
  console.log('PASS state machine rejects an illegal transition (IDLE → RELEASE) without touching the pose');
  // real-time loop under CPU load: busy main thread + rAF loop, dt clamped
  const page2 = await browser.newPage({ viewport: { width: 640, height: 360 } }); page2.on('pageerror', e => errors.push(e.message));
  await page2.goto(base + '/games/target-shooting/index.html?qa=1&quality=low');
  await page2.waitForFunction(() => window.__tsQA && document.body.dataset.phase === 'menu', null, { timeout: 300000 });
  await page2.evaluate(() => __tsQA.start('archery', 'beginner'));
  await page2.waitForFunction(() => document.body.dataset.phase === 'shooting', null, { timeout: 60000 });
  await page2.evaluate(() => { __tsQA.resetDiag(); __tsQA.aimAtTarget(0, false); __tsQA.draw(); window.__load = setInterval(() => { const t = performance.now(); while (performance.now() - t < 18); }, 30); });
  await page2.waitForTimeout(6000);
  const live = await page2.evaluate(() => { clearInterval(window.__load); __tsQA.loose(); return __tsQA.diag(); });
  assert(live.tremble === 0 && live.footSlide <= LIMITS.footSlide && live.camera.spikes === 0, JSON.stringify({ t: live.tremble, s: live.footSlide, c: live.camera }));
  console.log('PASS real-time loop with a saturated main thread:', live.frames, 'frames, tremble 0, camera spikes 0');
  if (process.env.TS_REPORT) fs.writeFileSync(process.env.TS_REPORT, JSON.stringify(results, null, 1));
  assert.deepEqual(errors, []);
  await browser.close(); server.close(); console.log('TARGET SHOOTING MOTION ALL PASS');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
