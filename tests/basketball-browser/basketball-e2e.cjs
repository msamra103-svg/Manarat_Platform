// Browser end-to-end tests (requires Playwright + Chromium; run a static server at the package root first):
//   python3 -m http.server 8099                                   (package root)
//   (cd tests/browser/attacker && python3 -m http.server 8098 --bind 127.0.0.1)   (cross-origin attacker page)
//   node tests/browser/basketball-e2e.cjs [outDir]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8099';
const OUT = process.argv[2] || 'qa-out'; fs.mkdirSync(OUT, { recursive: true });
const results = []; const pass = (name, ok, info) => { results.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + JSON.stringify(info).slice(0, 300) : '')); };
const Q = 'capture=1&manual=1&quality=low';

async function gameFrame(page) { for (let i = 0; i < 200; i++) { const f = page.frames().find(f => f.url().includes('/games/basketball/index.html')); if (f) return f; await page.waitForTimeout(100); } throw new Error('no game frame'); }
async function waitPhase(f, phase, stepSec = 0.5, max = 40, render = false) {
  for (let t = 0; t < max; t += stepSec) { const p = await f.evaluate(([s, r]) => window.__qaStep ? window.__qaStep(s, 1 / 30, r) : window.Basketball.phase, [stepSec, render]); if (p === phase) return true; }
  return (await f.evaluate('Basketball.phase')) === phase;
}
async function untilWelcome(f) { await f.waitForFunction('window.Basketball && Basketball.phase==="welcome"', null, { timeout: 180000, polling: 250 }); }

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  // ---------------- embedded flow through a host that mirrors HOST_REFERENCE.js ----------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => errors.push('host:' + e.message));
    await page.goto(`${BASE}/tests/basketball-browser/host.html?game=${encodeURIComponent('?' + Q)}`);
    const f = await gameFrame(page); f.page().on('pageerror', e => errors.push('game:' + e.message));
    await untilWelcome(f);
    pass('embedded: config received, assignment title shown', (await f.evaluate('document.getElementById("assignmentTitle").textContent')) === 'لعبة النباتات المائية');
    await f.evaluate('document.getElementById("start").click()');
    pass('embedded: start -> ready (dribbling)', await waitPhase(f, 'ready', 0.5, 12));
    await f.evaluate('document.getElementById("shoot").click()');
    pass('embedded: shot pauses mid-flight and host shows its question', await waitPhase(f, 'question', 0.25, 8) && await page.evaluate('document.getElementById("q").classList.contains("open")'));
    const frozen1 = await f.evaluate('JSON.stringify(Basketball.snapshot().ball)'); await f.evaluate('__qaStep(1.5,1/30,false)');
    pass('embedded: ball holds while waiting for the answer', frozen1 === await f.evaluate('JSON.stringify(Basketball.snapshot().ball)'));
    await page.evaluate('attackFromHost(); attackFromSibling(); attackCrossOrigin();'); await page.waitForTimeout(2500); await f.evaluate('__qaStep(0.5,1/30,false)');
    pass('security: forged token / wrong index / sibling frame / cross-origin frame ignored', (await f.evaluate('Basketball.phase')) === 'question' && (await f.evaluate('Basketball.outcome')) === '');
    await f.evaluate('__qaStep(0.05,1/30,true)'); await page.screenshot({ path: `${OUT}/e2e_embedded_question.png` });
    await page.evaluate('answer("pending")');
    pass('pending: neutral outcome, no score, no failure', await waitPhase(f, 'outcome', 0.25, 12) && (await f.evaluate('Basketball.outcome')) === 'pending' && (await f.evaluate('Basketball.goals')) === 0 && (await f.evaluate('Basketball.snapshot().ballOpacity')) < 0.05);
    await f.evaluate('__qaStep(0.05,1/30,true)'); await page.screenshot({ path: `${OUT}/e2e_embedded_pending.png` });
    await f.evaluate('document.getElementById("next").click()');
    pass('next round: host advance -> pass from rebounder -> ready', await waitPhase(f, 'ready', 0.5, 20) && (await f.evaluate('Basketball.round')) === 1);
    await f.evaluate('document.getElementById("shoot").click()'); await waitPhase(f, 'question', 0.25, 8);
    await page.evaluate('answer("correct")');
    pass('correct answer scores', await waitPhase(f, 'outcome', 0.1, 10) && (await f.evaluate('Basketball.outcome')) === 'goal' && (await f.evaluate('Basketball.goals')) === 1);
    await f.evaluate('__qaStep(0.6,1/30,false)'); await f.evaluate('__qaStep(0.05,1/30,true)'); await page.screenshot({ path: `${OUT}/e2e_embedded_make.png` });
    await f.evaluate('document.getElementById("next").click()'); await waitPhase(f, 'ready', 0.5, 20);
    await f.evaluate('document.getElementById("shoot").click()'); await waitPhase(f, 'question', 0.25, 8);
    await page.evaluate('answer("wrong")');
    pass('wrong answer misses', await waitPhase(f, 'outcome', 0.1, 10) && (await f.evaluate('Basketball.outcome')) === 'wide' && (await f.evaluate('Basketball.goals')) === 1);
    await f.evaluate('document.getElementById("fullscreen").click()'); await page.waitForTimeout(200);
    pass('fullscreen request is delegated to the platform', (await page.evaluate('play.log')).includes('fullscreen'));
    await f.evaluate('document.getElementById("next").click()'); await page.waitForTimeout(800);
    pass('final result: host finish shows the exact assignment title', (await page.evaluate('document.getElementById("resTitle").textContent')) === 'لعبة النباتات المائية', await page.evaluate('play.log.slice(-6)'));
    await page.screenshot({ path: `${OUT}/e2e_host_result.png` });
    await page.close();
  }
  // ---------------- finish failure -> retry ----------------
  {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
    await page.goto(`${BASE}/tests/basketball-browser/host.html?n=1&failFinish=1&game=${encodeURIComponent('?' + Q)}`);
    const f = await gameFrame(page); await untilWelcome(f);
    await f.evaluate('document.getElementById("start").click()'); await waitPhase(f, 'ready', 0.5, 12);
    await f.evaluate('document.getElementById("shoot").click()'); await waitPhase(f, 'question', 0.25, 8);
    await page.evaluate('answer("correct")'); await waitPhase(f, 'outcome', 0.1, 10);
    await f.evaluate('document.getElementById("next").click()'); await page.waitForTimeout(600);
    const reenabled = await f.evaluate('!document.getElementById("next").disabled');
    await f.evaluate('document.getElementById("next").click()'); await page.waitForTimeout(600);
    pass('failed finish -> retry re-enables next; second attempt completes', reenabled && await page.evaluate('!!play.finished'));
    await page.close();
  }
  // ---------------- standalone: sound controls, resize, reduced motion, repeated rounds ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 650 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push('standalone:' + e.message));
    await page.goto(`${BASE}/games/basketball/index.html?${Q}`);
    await untilWelcome(page);
    await page.evaluate('document.getElementById("start").click()');
    await waitPhase(page, 'ready', 0.5, 12);
    const muted0 = await page.evaluate('document.getElementById("sound").getAttribute("aria-pressed")');
    await page.evaluate('document.getElementById("sound").click()');
    const muted1 = await page.evaluate('document.getElementById("sound").getAttribute("aria-pressed")');
    await page.evaluate('const v=document.getElementById("volume");v.value="40";v.dispatchEvent(new Event("input"))');
    pass('sound: mute toggles and volume control responds', muted0 === 'true' && muted1 === 'false' && (await page.evaluate('document.getElementById("sound").dataset.on')) === '1');
    const cam0 = await page.evaluate('JSON.stringify(Basketball.snapshot().camera.map(x=>x.toFixed(3)))');
    await page.evaluate('document.getElementById("shoot").click()'); await waitPhase(page, 'question', 0.25, 8);
    const cam1 = await page.evaluate('JSON.stringify(Basketball.snapshot().camera.map(x=>x.toFixed(3)))');
    pass('reduced motion: camera stays fixed during the shot', cam0 === cam1, { cam0, cam1 });
    await page.setViewportSize({ width: 700, height: 900 }); await page.waitForTimeout(400); await page.evaluate('__qaStep(0.1,1/30,true)');
    const sz = await page.evaluate('(()=>{const c=document.getElementById("pitch");return [c.width,c.height,c.clientWidth,c.clientHeight,innerWidth,document.documentElement.scrollWidth]})()');
    pass('resize: canvas follows the viewport, no horizontal scroll', Math.abs(sz[2] - 700) < 2 && sz[5] <= sz[4], sz);
    await page.setViewportSize({ width: 1100, height: 650 }); await page.waitForTimeout(300);
    // repeated rounds: memory / audio voices bounded
    const mem = [];
    for (let r = 0; r < 9; r++) {
      if ((await page.evaluate('Basketball.phase')) !== 'question') { await page.evaluate('document.getElementById("shoot").click()'); await waitPhase(page, 'question', 0.25, 8); }
      await page.evaluate('document.querySelectorAll("#choices button")[' + (r % 2 ? 3 : 0) + '].click()');
      await waitPhase(page, 'outcome', 0.25, 12);
      const s = await page.evaluate('(()=>{const s=Basketball.snapshot();return {g:s.geometries,t:s.textures,calls:s.calls,heap:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,voices:Basketball.audio.voices||0}})()');
      mem.push(s);
      await page.evaluate('document.getElementById("next").click()');
      if ((await page.evaluate('Basketball.phase')) === 'finished') { await page.evaluate('document.getElementById("again").click()'); }
      await waitPhase(page, 'ready', 0.5, 20);
    }
    const g = mem.map(m => m.g), t = mem.map(m => m.t);
    pass('repeated rounds: geometries/textures stable (no leaks)', Math.max(...g) - Math.min(...g) <= 3 && Math.max(...t) - Math.min(...t) <= 3, mem);
    pass('restart after completion works', (await page.evaluate('Basketball.round')) <= 2);
    await ctx.close();
  }
  // ---------------- missing asset -> useful error ----------------
  {
    const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
    await page.route('**/athlete_b.glb', r => r.abort());
    await page.goto(`${BASE}/games/basketball/index.html?${Q}`);
    await page.waitForFunction('document.body.dataset.phase==="error"', null, { timeout: 120000 }).catch(() => { });
    const vis = await page.evaluate('!document.getElementById("loadingError").hidden && document.getElementById("errorText").textContent');
    pass('missing asset shows an Arabic error with retry (no black canvas)', !!vis, vis);
    await page.screenshot({ path: `${OUT}/e2e_missing_asset.png` });
    await page.close();
  }
  // ---------------- mobile portrait + landscape (touch) ----------------
  for (const [w, h, name] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(name + ':' + e.message));
    await page.goto(`${BASE}/games/basketball/index.html?capture=1&manual=1`);
    await untilWelcome(page);
    await page.screenshot({ path: `${OUT}/mobile_${name}_welcome.png` });
    await page.tap('#start').catch(() => page.evaluate('document.getElementById("start").click()'));
    await waitPhase(page, 'ready', 0.5, 12, false); await page.evaluate('__qaStep(0.05,1/30,true)');
    await page.screenshot({ path: `${OUT}/mobile_${name}_ready.png` });
    const shootBox = await page.evaluate('(()=>{const r=document.getElementById("shoot").getBoundingClientRect();return [r.width,r.height,r.bottom<=innerHeight,r.right<=innerWidth]})()');
    await page.tap('#shoot').catch(() => page.evaluate('document.getElementById("shoot").click()'));
    await waitPhase(page, 'question', 0.25, 8);
    await page.evaluate('__qaStep(0.05,1/30,true)'); await page.screenshot({ path: `${OUT}/mobile_${name}_question.png` });
    const qfit = await page.evaluate('(()=>{const q=document.getElementById("question").getBoundingClientRect();const b=[...document.querySelectorAll("#choices button")].map(x=>x.getBoundingClientRect());return {inView:q.top>=0&&q.bottom<=innerHeight+1,minH:Math.min(...b.map(x=>x.height)),scrollX:document.documentElement.scrollWidth<=innerWidth}})()');
    pass(`mobile ${name}: controls and question fit, touch targets >= 44px`, shootBox[1] >= 44 && shootBox[2] && shootBox[3] && qfit.inView && qfit.minH >= 44 && qfit.scrollX, { shootBox, qfit });
    await page.tap('#choices button').catch(() => page.evaluate('document.querySelector("#choices button").click()'));
    await waitPhase(page, 'outcome', 0.25, 12, false); await page.evaluate('__qaStep(0.8,1/30,false)'); await page.evaluate('__qaStep(0.05,1/30,true)');
    await page.screenshot({ path: `${OUT}/mobile_${name}_outcome.png` });
    await ctx.close();
  }
  pass('no uncaught page errors', errors.length === 0, errors);
  fs.writeFileSync(path.join(OUT, 'e2e-results.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 1));
  await browser.close();
  const failed = results.filter(r => !r.ok).length; console.log(`\n${results.length - failed}/${results.length} browser checks passed`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
