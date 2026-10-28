/* Target Shooting 3D — the four challenges on the real game (browser): targets, projectiles, collisions,
 * effects and cleanup. Also checks reticle/impact agreement on the archery face, round flow without freezes,
 * memory stability across rounds and mode changes, and the responsive 16:9 layout (no page scroll).
 */
const { chromium } = require('playwright'), fs = require('fs'), http = require('http'), path = require('path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)); fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); }); });

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/games/target-shooting/index.html?qa=1&manual=1&quality=low');
  await page.waitForFunction(() => window.__tsQA && document.body.dataset.phase === 'menu', null, { timeout: 300000 });
  await page.evaluate(() => {
    window.__shoot = (lead = true) => {
      const Q = __tsQA, A = Q.archer();
      if (!Q.aimAtTarget(0, lead)) {
        if (Q.mode().key !== 'clay') return null;
        // clay: the disc is pulled when the archer is ready — draw first, then wait for it
        Q.aimAt(0, 4, -25); Q.draw(); let w = 0; while (A.state !== 'AIM_HOLD' && w++ < 600) Q.step(1, 1 / 60, false);
        w = 0; while (!Q.aimAtTarget(0, lead, false) && w++ < 240) Q.step(1, 1 / 60, false);
        if (!Q.targets().some(t => t.alive)) { Q.loose(); return null; }
      }
      Q.draw(); let g = 0; while (A.state !== 'AIM_HOLD' && g++ < 600) { Q.step(1, 1 / 60, false); Q.aimAtTarget(0, lead, false); }
      // hold until the reticle sits on the (moving) lead point, as a player would
      for (let i = 0; i < 45; i++) { const p = Q.aimAtTarget(0, lead, false); if (!p) break; Q.step(1, 1 / 60, false); const a = Q.aim().point; if (Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]) < 0.12) break; }
      const before = { shots: Q.state.shots, hits: Q.state.hits, alive: Q.targets().filter(t => t.alive).length, aim: Q.aim().point };
      Q.loose(); Q.step(1, 1 / 60, false);
      const inFlight = Q.state.flights;
      g = 0; while (Q.state.flights > 0 && g++ < 600) Q.step(1, 1 / 60, false);
      return { before, inFlight, after: { shots: Q.state.shots, hits: Q.state.hits, alive: Q.targets().filter(t => t.alive).length } };
    };
    window.__mem = () => { const i = __tsQA.world().renderer.info; return { geo: i.memory.geometries, tex: i.memory.textures }; };
  });
  const T0 = Date.now();
  // ---------------------------------------------------------------- archery: reticle == impact, embedding, ring score
  await page.evaluate(() => __tsQA.start('archery', 'beginner'));
  await page.waitForFunction(() => document.body.dataset.phase === 'shooting', null, { timeout: 60000 });
  const arch = await page.evaluate(() => {
    const Q = __tsQA, A = Q.archer(), T = THREE, out = [];
    const t = Q.mode().targets[0], face = t.mesh.userData.face; face.updateMatrixWorld(true);
    for (const [ox, oy] of [[0, 0], [0.25, 0.1], [-0.3, -0.2], [0.05, 0.42]]) {
      const p = new T.Vector3(ox, oy, 0).applyMatrix4(face.matrixWorld);
      Q.aimAt(p.x, p.y, p.z); Q.draw(); let g = 0; while (A.state !== 'AIM_HOLD' && g++ < 600) { Q.step(1, 1 / 60, false); Q.aimAt(p.x, p.y, p.z); }
      const pts = Q.state.roundPoints; Q.loose(); let k = 0; while ((Q.state.flights > 0) && k++ < 600) Q.step(1, 1 / 60, false);
      const arrow = t.mesh.userData.holder.children.filter(c => c.name === 'arrow').pop();
      const tip = arrow ? new T.Vector3(0, 0, 0.74).applyMatrix4(arrow.matrixWorld) : null;
      const local = tip ? face.worldToLocal(tip.clone()) : null;
      out.push({ aim: [ox, oy], err: local ? Math.hypot(local.x - ox, local.y - oy) : 99, depth: local ? -local.z : null, points: Q.state.roundPoints - pts, attached: !!arrow });
      g = 0; while (!['IDLE', 'RECOVER'].includes(A.state) && g++ < 300) Q.step(1, 1 / 60, false);
      if (Q.state.arrowsLeft <= 0) break;
    }
    return out;
  });
  for (const r of arch) {
    assert(r.attached, 'arrow embedded in the target');
    assert(r.err < 0.02, 'reticle vs impact ' + r.err);
    assert(r.depth > 0.02 && r.depth < 0.2, 'tip inside the boss, never through it: ' + r.depth);
    const expect = Math.max(1, 10 - Math.floor(Math.hypot(...r.aim) / 0.061)) * 10; assert.equal(r.points, expect);
  }
  console.log('PASS archery: reticle = impact within', Math.max(...arch.map(r => r.err * 1000)).toFixed(1), 'mm; arrows embed 2–20 cm (no pass-through); ring points', arch.map(r => r.points).join(','));
  // ---------------------------------------------------------------- moving modes: hits register once, targets cleaned up
  for (const [mode, diff] of [['birds', 'beginner'], ['balloons', 'intermediate'], ['clay', 'beginner'], ['archery', 'advanced']]) {
    await page.evaluate(([m, d]) => __tsQA.start(m, d), [mode, diff]);
    await page.waitForFunction(() => document.body.dataset.phase === 'shooting', null, { timeout: 60000 });
    await page.evaluate(() => __tsQA.step(120, 1 / 60, false));
    const shots = [];
    for (let k = 0; k < 3; k++) {
      let r = await page.evaluate(() => __shoot(true));
      for (let w = 0; !r && w < 20; w++) r = await page.evaluate(() => { __tsQA.step(30, 1 / 60, false); return __shoot(true); });
      if (r) shots.push(r);
      if ((await page.evaluate(() => __tsQA.state.phase)) !== 'shooting') break;
    }
    assert(shots.length >= 1, mode + ': at least one shot');
    for (const s of shots) {
      assert.equal(s.after.shots - s.before.shots, 1, 'one arrow per release');
      assert(s.inFlight <= 1, 'no duplicate projectiles');
      assert(s.after.hits - s.before.hits <= 1, 'a single arrow registers at most one hit');
    }
    const hits = shots.reduce((n, s) => n + s.after.hits - s.before.hits, 0);
    assert(await page.evaluate(() => __tsQA.mode().targets.filter(t => t.tagged || ['popped', 'broken'].includes(t.state)).every(t => !t.alive)), 'a hit target stops being a target');
    const st = await page.evaluate(() => { const Q = __tsQA; const vis = Q.mode().targets.filter(t => !t.alive && t.mesh.visible && ['popped', 'broken'].includes(t.state) && t.mesh.userData.env && t.mesh.userData.env.visible).length; return { vis, phase: Q.state.phase }; });
    assert.equal(st.vis, 0, 'no destroyed target stays visible');
    console.log('PASS', (mode + '/' + diff).padEnd(22), shots.length, 'shots,', hits, 'hits — one arrow per release, ≤1 hit per arrow, destroyed targets vanish at impact');
    // let the round end and check the question opens (no freeze) and targets calm down / leave
    const ph = await page.evaluate(() => { __tsQA.endRound(); for (let i = 0; i < 30; i++) __tsQA.step(1, 1 / 60, false); return __tsQA.state.phase; });
    assert(['roundEnd', 'question'].includes(ph), 'round ends: ' + ph);
    await page.waitForFunction(() => ['question'].includes(document.body.dataset.phase), null, { timeout: 30000 });
    await page.evaluate(() => __tsQA.step(400, 1 / 60, false));
    const calm = await page.evaluate(() => ({ alive: __tsQA.targets().filter(t => t.alive).length, archer: __tsQA.archer().state, flights: __tsQA.state.flights }));
    if (mode !== 'archery') assert.equal(calm.alive, 0, 'moving targets leave smoothly during the question');
    assert(['IDLE', 'RECOVER'].includes(calm.archer), 'archer never frozen in a draw while the question is open: ' + calm.archer);
    await page.evaluate(() => __tsQA.answer(true, false)); await page.waitForFunction(() => document.body.dataset.phase === 'feedback', null, { timeout: 30000 });
    await page.evaluate(() => __tsQA.next()); await page.waitForFunction(() => __tsQA.state.round === 1, null, { timeout: 30000 });
    const fresh = await page.evaluate(() => ({ stuck: __tsQA.state.stuck, arrows: __tsQA.state.arrowsLeft }));
    assert.equal(fresh.stuck, 0, 'stuck arrows cleared for the next round'); assert(fresh.arrows > 0);
    console.log('PASS', (mode + '/' + diff).padEnd(22), 'round end → question (targets leave, archer relaxed) → correct answer → next round (clean)');
  }
  // ---------------------------------------------------------------- no shooting while a question is open
  await page.waitForFunction(() => document.body.dataset.phase === 'shooting', null, { timeout: 60000 });
  await page.evaluate(() => { const Q = __tsQA; Q.endRound(); for (let i = 0; i < 200; i++) Q.step(1, 1 / 60, false); });
  await page.waitForFunction(() => document.body.dataset.phase === 'question', null, { timeout: 30000 });
  const tryShoot = await page.evaluate(() => { const Q = __tsQA, s = Q.state.shots; const c = document.getElementById('scene').getBoundingClientRect(); document.getElementById('scene').dispatchEvent(new PointerEvent('pointerdown', { clientX: c.left + c.width / 2, clientY: c.top + c.height / 2, button: 0, pointerId: 1, bubbles: true })); Q.step(200, 1 / 60, false); return { shots: Q.state.shots - s, archer: Q.archer().state }; });
  assert.equal(tryShoot.shots, 0); assert.notEqual(tryShoot.archer, 'DRAW_BOW');
  console.log('PASS no shooting while the question panel is open');
  // ---------------------------------------------------------------- memory: geometries/textures stable across mode switches
  await page.evaluate(() => __tsQA.answer(false, false));
  const m0 = await page.evaluate(async () => { for (const m of ['archery', 'birds', 'balloons', 'clay']) { await __tsQA.setMode(m); __tsQA.render(); } return __mem(); });
  const m1 = await page.evaluate(async () => { for (const m of ['archery', 'birds', 'balloons', 'clay']) { await __tsQA.setMode(m); __tsQA.render(); } return __mem(); });
  const m2 = await page.evaluate(async () => { for (const m of ['archery', 'birds', 'balloons', 'clay']) { await __tsQA.setMode(m); __tsQA.render(); } return __mem(); });
  assert(m2.geo <= m1.geo + 2 && m2.tex <= m1.tex + 1, 'no GPU leak across mode cycles ' + JSON.stringify([m0, m1, m2]));
  console.log('PASS memory stable across 3 full mode cycles (geometries', m0.geo, '→', m1.geo, '→', m2.geo, ', textures', m0.tex, '→', m1.tex, '→', m2.tex, ')');
  // ---------------------------------------------------------------- layout: 16:9, tablet, short landscape: no scroll, HUD inside
  for (const [w, h, touch] of [[1920, 1080, false], [1366, 768, false], [1024, 768, true], [844, 390, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '/games/target-shooting/index.html?qa=1&manual=1&quality=low');
    await p.waitForFunction(() => window.__tsQA && document.body.dataset.phase === 'menu', null, { timeout: 300000 });
    const lay = await p.evaluate(async () => { const out = { scroll: document.scrollingElement.scrollHeight - innerHeight, menu: [...document.querySelectorAll('.card,#btnStart')].every(e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0 && r.right <= innerWidth + 1 && r.left >= -1; }) }; await __tsQA.start('archery', 'beginner'); return out; });
    await p.waitForFunction(() => document.body.dataset.phase === 'shooting', null, { timeout: 60000 });
    const hud = await p.evaluate(() => { __tsQA.render(); return [...document.querySelectorAll('#hud .hud-stats, #hud .hud-tools, #hud .hud-id')].every(e => { const r = e.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1 && r.bottom <= innerHeight; }) && document.scrollingElement.scrollHeight <= innerHeight + 1; });
    if (touch) {
      // touch: tap in simple mode fires automatically
      const fired = await p.evaluate(() => { document.getElementById('optSimple').checked = true; document.getElementById('btnHelpClose').click(); return true; });
      const c = await p.evaluate(() => { const r = document.getElementById('scene').getBoundingClientRect(); const s = __tsQA.project(new THREE.Vector3(...__tsQA.targets()[0].pos)); return { x: r.left + s.x, y: r.top + s.y }; });
      await p.touchscreen.tap(c.x, c.y);
      // simple mode runs on real timers: interleave simulation steps with real time
      for (let i = 0; i < 80 && (await p.evaluate(() => __tsQA.state.shots)) === 0; i++) { await p.evaluate(() => __tsQA.step(6, 1 / 60, false)); await p.waitForTimeout(60); }
      assert.equal(await p.evaluate(() => __tsQA.state.shots), 1, 'touch tap (simple mode) shoots once');
    }
    assert(lay.scroll <= 1 && lay.menu && hud, JSON.stringify({ w, h, lay, hud }));
    console.log('PASS layout', w + '×' + h, touch ? '(touch, simple-mode tap fired one arrow)' : '', '— menu and HUD inside the viewport, no page scroll');
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  await browser.close(); server.close(); console.log('TARGET SHOOTING MODES ALL PASS (' + Math.round((Date.now() - T0) / 1000) + ' s)');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
