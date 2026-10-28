/* Fishing V24 — real-browser integration suite (Playwright + Chromium, software WebGL in CI).
 * Covers: GLB loading, offline/no-network, embedded host protocol via a harness that mirrors school.js,
 * forged-message rejection, 1/0/0 catches, viewports without scrolling, keyboard + touch, context loss,
 * file:// offline export, frame-time sampling. Screenshots → games/fishing/docs/screenshots/.
 * Usage: node tests/fishing-browser.cjs [--dist=<offline export dir>]
 */
'use strict';
const { chromium } = require('playwright'), assert = require('node:assert/strict'), path = require('path'), fs = require('fs');
const srv = require('../games/fishing/tools/serve.cjs');
const SHOTS = path.join(__dirname, '..', 'games/fishing/docs/screenshots'); fs.mkdirSync(SHOTS, { recursive: true });
const distArg = (process.argv.find(a => a.startsWith('--dist=')) || '').slice(7);
const dist = distArg ? path.resolve(distArg) : '';
let checks = 0; const results = []; const ok = (c, m) => { assert(c, m); checks++; };
const note = (k, v) => { results.push([k, v]); console.log('  ·', k, typeof v === 'string' ? v : JSON.stringify(v)); };
(async () => {
  const server = await srv.start(8600 + Math.floor(Math.random() * 300)), base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const external = [];
  async function page(vp, opts = {}) {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: !!opts.touch, isMobile: !!opts.mobile, deviceScaleFactor: opts.dpr || 1 });
    await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('file:') || u === 'about:srcdoc' || u === 'about:blank') return r.continue(); external.push(u); return r.abort(); });
    const p = await ctx.newPage(); p.setDefaultTimeout(180000); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/GL Driver|GPU stall/.test(m.text())) p.errors.push(m.text()); }); return p;
  }
  const welcome = p => p.waitForFunction("window.FishingGame && FishingGame.phase==='welcome'", null, { timeout: 120000 });

  /* 1. standalone: GLB models, demo flow with all three outcomes, audio assets */
  { const p = await page({ width: 1280, height: 720 }); await p.goto(base + '/games/fishing/index.html?qa=1&quality=low'); await welcome(p);
    const rep = await p.evaluate(() => FishingGame.view.assets.report); ok(Object.values(rep).every(r => r.source === 'glb'), 'all six models loaded from GLB'); note('model sources', Object.fromEntries(Object.entries(rep).map(([k, v]) => [k, v.source + ' ' + Math.round(v.bytes / 1024) + 'KB'])));
    await p.screenshot({ path: path.join(SHOTS, '01-welcome-1280x720.jpg'), quality: 84 });
    const out = await p.evaluate(() => { const G = FishingGame, Q = G.qa, r = []; Q.pause(true); Q.start(); Q.step(2.2);
      for (const kind of ['correct', 'wrong', 'pending']) { Q.until(() => G.simPhase === 'ready'); Q.cast(); Q.until(() => G.phase === 'question', 60); const held = JSON.stringify(G.sim.target.pos); Q.step(2); r.push(held === JSON.stringify(G.sim.target.pos)); Q.answer(kind); Q.until(() => G.phase === 'outcome', 80); r.push(G.phase); Q.next(); }
      return { r, catches: G.catches, misses: G.misses, pendings: G.pendings, phase: G.phase, audio: G.audio.source }; });
    ok(out.r.filter(x => x === true).length === 3, 'question freeze holds the fish'); ok(out.catches === 1 && out.misses === 1 && out.pendings === 1 && out.phase === 'finished', 'demo 1 catch / 1 escape / 1 neutral');
    await p.waitForFunction(() => FishingGame.audio.source && FishingGame.audio.source !== 'none', null, { timeout: 60000 }).catch(() => {}); const audio = await p.evaluate(() => FishingGame.audio.source); note('audio source after user gesture', audio); ok(['wav', 'dsp', 'mixed'].includes(audio), 'audio engine started after gesture');
    ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | ')); await p.context().close(); }

  /* 2. embedded: harness that mirrors school.js; forged sibling messages ignored */
  { const p = await page({ width: 1280, height: 800 }); await p.goto(base + '/games/fishing/tools/host-harness.html?answers=correct,wrong,pending&delay=1500');
    const fr = () => p.frame({ url: /games\/fishing\/index\.html/ });
    await p.waitForFunction(() => window.hostLog && hostLog.some(m => m.type === 'school-fishing-config'), null, { timeout: 120000 });
    await fr().waitForFunction("window.FishingGame && FishingGame.phase==='welcome'", null, { timeout: 120000 });
    await fr().evaluate(() => { FishingGame.qa.pause(true); FishingGame.qa.start(); FishingGame.qa.step(2.2); });
    for (let round = 0; round < 3; round++) {
      await fr().evaluate(() => { const G = FishingGame; G.qa.until(() => G.simPhase === 'ready'); G.qa.cast(); G.qa.until(() => G.phase === 'question', 60); });
      if (round === 0) { const tok = await p.evaluate(() => harness.token); await p.evaluate(t => forge({ type: 'school-fishing-result', token: t, index: 0, correct: true }), tok); await p.waitForTimeout(100); ok(await fr().evaluate(() => FishingGame.phase) === 'question', 'forged result from a sibling frame ignored'); }
      await p.waitForFunction(r => hostLog.filter(m => m.type === 'school-fishing-result').length > r, round, { timeout: 10000 }).catch(async e => { console.log(await p.evaluate(() => JSON.stringify(hostLog.map(m => [m.dir, m.type, m.index])))); console.log(await fr().evaluate(() => FishingGame.phase + ' ' + FishingGame.round + ' ' + FishingGame.simPhase)); throw e; });
      await p.waitForTimeout(100); await fr().evaluate(() => { const G = FishingGame; G.qa.until(() => G.phase === 'outcome', 80); });
      if (round === 0) await p.screenshot({ path: path.join(SHOTS, '07-embedded-outcome-harness.jpg'), quality: 84 });
      await fr().evaluate(() => FishingGame.qa.next()); if (round < 2) await fr().waitForFunction(() => FishingGame.phase === 'retrieving', null, { timeout: 10000 }); else await p.waitForTimeout(300);
    }
    const s = await fr().evaluate(() => ({ c: FishingGame.catches, m: FishingGame.misses, p: FishingGame.pendings })); const log = await p.evaluate(() => hostLog.map(m => m.dir + ':' + m.type.replace('school-fishing-', '') + (m.index !== undefined ? '#' + m.index : '')));
    ok(s.c === 1 && s.m === 1 && s.p === 1, 'embedded: correct=1 catch, wrong=0, pending=neutral'); ok(await p.evaluate(() => harness.finished), 'host finish reached after last next');
    const count = t => log.filter(x => x.split('#')[0] === 'game→host:' + t).length;
    note('host log', log.join(' ')); ok(count('ready') === 1 && count('question') === 3 && count('outcome') === 3 && count('next') === 3, 'one question/outcome/next per round');
    ok(p.errors.length === 0, 'no page errors (embedded)'); await p.context().close(); }

  /* 3. viewports: classroom projector, smartboard, iPad, iOS, Android — no scrolling, HUD inside the screen */
  const vps = [['projector-1920x1080', { width: 1920, height: 1080 }], ['smartboard-1366x768', { width: 1366, height: 768 }], ['ipad-landscape-1024x768', { width: 1024, height: 768 }, { touch: true }], ['ipad-portrait-768x1024', { width: 768, height: 1024 }, { touch: true }], ['iphone-portrait-390x844', { width: 390, height: 844 }, { touch: true, mobile: true, dpr: 2 }], ['iphone-landscape-844x390', { width: 844, height: 390 }, { touch: true, mobile: true, dpr: 2 }], ['android-412x915', { width: 412, height: 915 }, { touch: true, mobile: true, dpr: 2 }]];
  for (const [name, vp, o] of vps) {
    const p = await page(vp, o || {}); await p.goto(base + '/games/fishing/index.html?qa=1&quality=low'); await welcome(p);
    const check = async (label) => { const r = await p.evaluate(() => { const d = document.documentElement, vis = id => { const e = document.getElementById(id); if (!e || e.hidden || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
        return { sw: d.scrollWidth, sh: d.scrollHeight, iw: innerWidth, ih: innerHeight, sy: scrollY, rects: Object.fromEntries(['score', 'round', 'camera', 'sound', 'fullscreen', 'start', 'cast', 'next', 'card', 'controls'].map(k => [k, vis(k)]).filter(x => x[1])) }; });
      ok(r.sw <= r.iw && r.sh <= r.ih && r.sy === 0, `${name} ${label}: no page scroll (${r.sw}x${r.sh} in ${r.iw}x${r.ih})`);
      for (const [k, b] of Object.entries(r.rects)) ok(b[0] >= -1 && b[1] >= -1 && b[2] <= r.iw + 1 && b[3] <= r.ih + 1, `${name} ${label}: ${k} inside viewport ${b}`); };
    await check('welcome'); if (name.startsWith('projector') || name.startsWith('iphone-portrait')) await p.screenshot({ path: path.join(SHOTS, `02-welcome-${name}.jpg`), quality: 84 });
    if (o && o.touch) { await p.tap('#start'); } else await p.click('#start');
    await p.evaluate(() => { FishingGame.qa.pause(true); FishingGame.qa.step(2.2); }); await check('ready');
    if (name.startsWith('projector') || name.startsWith('iphone') || name.startsWith('android')) await p.screenshot({ path: path.join(SHOTS, `03-ready-${name}.jpg`), quality: 84 });
    if (o && o.touch) { await p.tap('#cast'); await p.evaluate(() => FishingGame.qa.step(0.1)); ok(await p.evaluate(() => FishingGame.phase) === 'casting', name + ': touch tap casts'); }
    else { await p.keyboard.press('ArrowLeft'); ok(await p.evaluate(() => document.querySelector('[data-aim=left]').classList.contains('selected')), name + ': arrow key aims'); await p.keyboard.press('Space'); ok(await p.evaluate(() => FishingGame.phase) === 'casting', name + ': space casts'); }
    await p.evaluate(() => { const G = FishingGame; G.qa.until(() => G.phase === 'question', 60); G.qa.answer('correct'); G.qa.until(() => G.phase === 'outcome', 80); }); await check('outcome');
    if (name.startsWith('projector') || name.startsWith('iphone-portrait')) await p.screenshot({ path: path.join(SHOTS, `04-outcome-${name}.jpg`), quality: 84 });
    ok(p.errors.length === 0, name + ' no errors'); await p.context().close();
  }

  /* 4. live rendering sample (software WebGL: CPU-bound, not representative of a GPU), memory, context loss */
  { const p = await page({ width: 1280, height: 720 }); await p.goto(base + '/games/fishing/index.html?qa=1&quality=medium'); await welcome(p);
    await p.evaluate(() => FishingGame.qa.start()); await p.waitForTimeout(6000);
    const perf = await p.evaluate(async () => { const t = []; let last = performance.now(); await new Promise(res => { let n = 0; const f = now => { t.push(now - last); last = now; if (++n < 40) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); t.sort((a, b) => a - b); const s = FishingGame.view.stats(); return { medianFrameMs: Math.round(t[20]), p90FrameMs: Math.round(t[36]), ...s, jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; });
    note('software-WebGL frame sample (medium, 1280x720)', perf); ok(perf.calls > 20 && perf.triangles > 20000, 'scene renders real geometry');
    const lost = await p.evaluate(async () => { const gl = FishingGame.view.renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return 'no-ext'; ext.loseContext(); await new Promise(r => setTimeout(r, 400)); ext.restoreContext(); await new Promise(r => setTimeout(r, 1500)); return document.getElementById('loadingError').hidden ? 'recovered' : 'error-panel'; });
    note('WebGL context loss', lost); ok(lost === 'recovered' || lost === 'no-ext', 'recovers from context loss');
    await p.screenshot({ path: path.join(SHOTS, '05-after-context-restore.jpg'), quality: 84 });
    ok(p.errors.length === 0, 'no errors after context restore: ' + p.errors.join(' | ')); await p.context().close(); }

  /* 5. cinematic sequence screenshots (correct answer) */
  { const p = await page({ width: 1600, height: 900 }); await p.goto(base + '/games/fishing/index.html?qa=1&quality=high'); await welcome(p);
    const shots = [['ready', 0.5, '10-ready-shoulder'], ['windup', 0.55, '11-windup'], ['flight', 0.35, '12-cast-flight'], ['settle', 1.0, '13-float-settled'], ['inspect', 0.8, '14-underwater-inspect'], ['nibble', 0.3, '15-nibble'], ['question', 0.3, '16-bite-question-freeze'], ['fight', 1.2, '17-fight'], ['fight', 3.3, '18-fight-underwater'], ['net', 1.1, '19-landing-net'], ['onboard', 0.3, '20-into-icebox'], ['celebrate', 0.7, '21-celebrate'], ['outcome', 0.2, '22-catch-card']];
    await p.evaluate(() => { const Q = FishingGame.qa; Q.pause(true); Q.start(); Q.step(2.2); Q.aim('right'); });
    for (const [ph, extra, name] of shots) {
      await p.evaluate(([ph, extra]) => { const G = FishingGame, Q = G.qa; if (ph === 'windup') Q.cast(); Q.until(() => { if (G.phase === 'question' && ph !== 'question') Q.answer('correct'); return G.simPhase === ph || G.phase === ph; }, 80); Q.step(extra); }, [ph, extra]);
      const nan = await p.evaluate(() => { const bad = []; FishingGame.view.scene.traverse(o => { if (o.visible && !o.matrixWorld.elements.every(Number.isFinite)) bad.push(o.name || o.type); }); return bad; }); ok(nan.length === 0, name + ': all scene transforms finite ' + nan.slice(0, 3));
      await p.screenshot({ path: path.join(SHOTS, name + '.jpg'), quality: 84 });
    }
    ok(p.errors.length === 0, 'no errors during cinematic sequence'); await p.context().close(); }

  /* 6. offline export opened from disk (file://) */
  if (dist) { const p = await page({ width: 1280, height: 720 }); await p.goto('file://' + path.join(dist, 'fishing-v24-offline-student/games/fishing/index.html') + '?qa=1&quality=low'); await welcome(p);
    const src = await p.evaluate(() => FishingGame.view.assets.source); note('file:// offline model source', src); ok(src === 'embedded-glb', 'offline export loads embedded GLB');
    const run = await p.evaluate(() => { const G = FishingGame, Q = G.qa; Q.pause(true); Q.start(); Q.step(2); Q.cast(); Q.until(() => G.phase === 'question', 60); Q.answer('correct'); Q.until(() => G.phase === 'outcome', 80); return G.catches; }); ok(run === 1, 'offline export plays a full catch');
    await p.waitForFunction(() => FishingGame.audio.source && FishingGame.audio.source !== 'none', null, { timeout: 20000 }).catch(() => {}); note('file:// audio source', await p.evaluate(() => FishingGame.audio.source)); ok(p.errors.length === 0, 'offline no errors: ' + p.errors.join(' | ')); await p.context().close(); }

  ok(external.length === 0, 'no external network requests: ' + external.join(', ')); note('external requests blocked', external.length);
  await browser.close(); server.close();
  fs.writeFileSync(path.join(SHOTS, '..', 'browser-results.json'), JSON.stringify({ date: new Date().toISOString(), checks, notes: results }, null, 2));
  console.log(`PASS fishing browser suite (${checks} checks)`);
})().catch(e => { console.error(e); process.exit(1); });
