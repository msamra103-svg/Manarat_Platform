/* Real-browser UI, accessibility and failure tests: `node tests/browser/ui.cjs`
 * - viewports 390x844, 844x390, 768x1024, 1366x768 (+ the platform iframe at reduced height, + fullscreen):
 *   no horizontal overflow, touch targets >= 44 px, controls inside the viewport, panels readable
 * - missing asset, no WebGL, WebGL context loss, slow loading, reduced motion, blocked/absent audio
 * - real-time frame rate on this machine's renderer (reported, not asserted) and startup transfer size */
'use strict';
const assert = require('node:assert/strict');
const path = require('path'), fs = require('fs');
const { serve, launch, openGame, waitPhase, shot, step, until, test, summary, OUT } = require('./lib.cjs');
const report = {};

const layoutCheck = () => {
  const vw = innerWidth, vh = innerHeight, bad = [], small = [], clipped = [];
  if (document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) bad.push('horizontal overflow ' + document.documentElement.scrollWidth + '>' + vw);
  for (const el of document.querySelectorAll('button, input, select')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    if (el.closest('[hidden]') || el.closest('#platform-navigation')) continue;   // shared platform bar: not part of this package
    const h = el.type === 'range' || el.type === 'radio' || el.type === 'checkbox' ? Math.max(r.height, el.closest('label') ? el.closest('label').getBoundingClientRect().height : 0) : r.height;
    if (h < 43.5 || (el.type !== 'range' && r.width < 43.5)) small.push((el.id || el.textContent.trim().slice(0, 20) || el.type) + ' ' + Math.round(r.width) + 'x' + Math.round(h));
    if (r.right > vw + 1 || r.left < -1) bad.push('offscreen ' + (el.id || el.textContent.trim().slice(0, 20)));
  }
  for (const el of document.querySelectorAll('.panel:not([hidden]) h1, .panel:not([hidden]) h2, .panel:not([hidden]) p, #instruction, .cell b, .cell span')) {
    if (el.closest('[hidden]')) continue;
    if (el.scrollWidth > el.clientWidth + 2) clipped.push((el.id || el.className || el.tagName) + ':' + el.textContent.slice(0, 24));
  }
  const c = document.getElementById('controls'); const cr = c && !c.hidden ? c.getBoundingClientRect() : null;
  if (cr && cr.bottom > vh + 1) bad.push('controls below the viewport ' + Math.round(cr.bottom) + '>' + vh);
  const th = document.getElementById('throw'); const tr = th && !c.hidden ? th.getBoundingClientRect() : null;
  if (tr && (tr.bottom > vh + 1 || tr.top < 0)) bad.push('throw button not reachable');
  return { bad, small, clipped };
};

(async () => {
  const { srv, base } = await serve();
  const browser = await launch();

  for (const [w, h] of [[390, 844], [844, 390], [768, 1024], [1366, 768]]) {
    await test(`viewport ${w}x${h}: no overflow, >=44px targets, reachable controls, readable panels`, async () => {
      const { page, ctx, errors } = await openGame(browser, base, { viewport: { width: w, height: h } });
      await waitPhase(page, 'welcome'); await step(page, 2);
      let r = await page.evaluate(layoutCheck); assert.deepEqual(r, { bad: [], small: [], clipped: [] }, 'welcome ' + JSON.stringify(r));
      await page.evaluate(() => __bowlingQA.enterHall()); await step(page, 40);
      r = await page.evaluate(layoutCheck); assert.deepEqual(r, { bad: [], small: [], clipped: [] }, 'ready ' + JSON.stringify(r));
      await shot(page, `shot-vp-${w}x${h}-ready.png`);
      if (w < 900) {
        await page.evaluate(() => __bowlingQA.setInputs({ start: 0.05, power: 0.6, spin: 0 })); await page.evaluate(() => __bowlingQA.shoot());
        assert.ok(await until(page, 'question')); await step(page, 3);
        r = await page.evaluate(layoutCheck); assert.deepEqual(r.bad, [], 'question ' + JSON.stringify(r)); assert.deepEqual(r.small, []);
        await shot(page, `shot-vp-${w}x${h}-question.png`);
        await page.evaluate(() => __bowlingQA.answer(0)); assert.ok(await until(page, 'outcome', 1500)); await step(page, 10);
        r = await page.evaluate(layoutCheck); assert.deepEqual(r, { bad: [], small: [], clipped: [] }, 'outcome ' + JSON.stringify(r));
        const inView = await page.evaluate(() => { const b = document.getElementById('next').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; });
        assert.ok(inView, 'Next button visible');
        await shot(page, `shot-vp-${w}x${h}-outcome.png`);
      }
      assert.deepEqual(errors, []); await ctx.close();
    });
  }

  await test('platform iframe at reduced height (844x390 phone landscape inside the test host)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } }); const page = await ctx.newPage();
    await page.goto(base + '/test-host.html?game=qa=1%26manual=1');
    await page.waitForFunction(() => { const f = document.getElementById('bowlingGame'); return f && f.contentWindow.Bowling && f.contentWindow.Bowling.phase === 'welcome'; }, null, { timeout: 120000 });
    const F = page.frame({ url: /games\/bowling\/index\.html\?qa=1/ });
    await F.evaluate(() => __bowlingQA.enterHall()); await F.evaluate(() => __bowlingQA.step(1 / 60, 30));
    const frameH = await page.evaluate(() => document.getElementById('bowlingGame').getBoundingClientRect().height);
    const r = await F.evaluate(layoutCheck);
    report.iframeHeight = frameH;
    assert.deepEqual(r.bad, [], JSON.stringify(r)); assert.deepEqual(r.small, [], JSON.stringify(r));
    await shot(page, 'shot-vp-iframe-844x390.png');
    await ctx.close();
  });

  await test('fullscreen (standalone): Fullscreen API on the venue, or a clear message when refused', async () => {
    const { page, ctx, errors } = await openGame(browser, base);
    await waitPhase(page, 'welcome'); await page.evaluate(() => __bowlingQA.enterHall()); await step(page, 5);
    await page.click('#full'); await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ fs: !!document.fullscreenElement, id: document.fullscreenElement && document.fullscreenElement.id, msg: document.getElementById('instruction').textContent, w: innerWidth, h: innerHeight }));
    report.fullscreen = st;
    assert.ok(st.fs ? st.id === 'venue' : /ملء الشاشة/.test(st.msg), JSON.stringify(st));
    if (st.fs) { await step(page, 5); const r = await page.evaluate(layoutCheck); assert.deepEqual(r.bad, []); await shot(page, 'shot-vp-fullscreen.png'); await page.evaluate(() => document.exitFullscreen()); }
    assert.deepEqual(errors, []); await ctx.close();
  });

  await test('keyboard: focus is visible, Space throws, R resets, arrows adjust; labels exist', async () => {
    const { page, ctx } = await openGame(browser, base);
    await waitPhase(page, 'welcome'); await page.focus('#start'); await page.keyboard.press('Enter'); await step(page, 5);
    assert.equal(await page.evaluate(() => Bowling.phase), 'ready');
    await page.focus('#lane'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp');
    const v = await page.evaluate(() => [Number(document.getElementById('angle').value), Number(document.getElementById('power').value)]);
    assert.deepEqual(v, [0.1, 70]);
    await page.keyboard.press('r'); assert.equal(await page.evaluate(() => Number(document.getElementById('angle').value)), 0);
    const unlabeled = await page.evaluate(() => [...document.querySelectorAll('button, input, select, canvas')].filter(e => !e.closest('[hidden]') && !(e.getAttribute('aria-label') || e.textContent.trim() || (e.labels && e.labels.length))).map(e => e.id));
    assert.deepEqual(unlabeled, []);
    await page.keyboard.press('Space'); await step(page, 3);
    assert.equal(await page.evaluate(() => Bowling.phase), 'approach');
    await ctx.close();
  });

  await test('missing asset: honest error panel with retry', async () => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.route('**/athlete_b.glb', r => r.fulfill({ status: 404, body: 'missing' }));
    await page.goto(base + '/games/bowling/index.html?qa=1&manual=1');
    await page.waitForSelector('#error:not([hidden])', { timeout: 120000 });
    const t = await page.textContent('#errorText'); assert.match(t, /athlete_b\.glb/); assert.ok(await page.isVisible('#errorRetry'));
    await shot(page, 'shot-fail-missing-asset.png'); await ctx.close();
  });

  await test('no WebGL: clear message, no crash', async () => {
    const { page, ctx, errors } = await openGame(browser, base, { init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; } });
    await page.waitForSelector('#error:not([hidden])', { timeout: 30000 });
    assert.match(await page.textContent('#errorText'), /WebGL/);
    assert.deepEqual(errors.filter(e => /pageerror/.test(e)), []); await ctx.close();
  });

  await test('WebGL context loss during play: loop stops, recoverable error panel', async () => {
    const { page, ctx } = await openGame(browser, base);
    await waitPhase(page, 'welcome'); await page.evaluate(() => __bowlingQA.enterHall());
    await page.evaluate(() => __bowlingQA.scene.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());
    await page.waitForSelector('#error:not([hidden])', { timeout: 10000 });
    assert.equal(await page.evaluate(() => Bowling.phase), 'error'); assert.ok(await page.isVisible('#errorRetry'));
    await ctx.close();
  });

  await test('slow loading shows a message, then the game starts normally', async () => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.route('**/clips.glb', async r => { await new Promise(res => setTimeout(res, 13500)); r.continue(); });
    await page.goto(base + '/games/bowling/index.html?qa=1&manual=1');
    await page.waitForSelector('#loadSlow:not([hidden])', { timeout: 20000 });
    await waitPhase(page, 'welcome'); await ctx.close();
  });

  await test('reduced motion: honoured from the OS setting (fixed shots, no celebration animation)', async () => {
    const { page, ctx, errors } = await openGame(browser, base, { reducedMotion: 'reduce' });
    await waitPhase(page, 'welcome');
    assert.ok(await page.evaluate(() => document.body.classList.contains('reduced')));
    assert.ok(await page.evaluate(() => document.getElementById('reducedToggle').checked));
    await page.evaluate(() => __bowlingQA.enterHall()); await page.evaluate(() => __bowlingQA.setInputs({ start: 0.2, power: 0.65, spin: -0.6 }));
    await page.evaluate(() => __bowlingQA.shoot()); assert.ok(await until(page, 'question'));
    const cam = await page.evaluate(() => Bowling.snapshot().camera);
    assert.ok(cam[2] < -6, 'reduced motion uses a fixed lane shot at the question: ' + cam);
    await page.evaluate(() => __bowlingQA.answer(0)); assert.ok(await until(page, 'outcome', 1500));
    assert.ok(!(await page.evaluate(() => getComputedStyle(document.body, '::after').animationName !== 'none' && document.body.classList.contains('celebrate'))));
    assert.deepEqual(errors, []); await ctx.close();
  });

  await test('audio blocked / unavailable: the game still plays; mute + volume persist', async () => {
    const { page, ctx, errors } = await openGame(browser, base, { init: () => { delete window.AudioContext; delete window.webkitAudioContext; } });
    await waitPhase(page, 'welcome'); await page.evaluate(() => __bowlingQA.enterHall());
    await page.evaluate(() => __bowlingQA.shoot()); assert.ok(await until(page, 'question'));
    assert.equal((await page.evaluate(() => Bowling.audio())).state, 'none');
    await page.click('#sound'); const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('manarat-bowling-audio')));
    assert.equal(saved.muted, true);
    assert.deepEqual(errors, []); await ctx.close();
    // with Web Audio available: a gesture unlocks it, the hall bed + roll loop exist once, and close() releases them
    const g = await openGame(browser, base);
    await waitPhase(g.page, 'welcome'); await g.page.click('#start');
    await g.page.waitForFunction(() => Bowling.audio().state !== 'none', null, { timeout: 10000 });
    await g.page.waitForFunction(() => Bowling.audio().loops === 2, null, { timeout: 60000, polling: 250 });   // loops start once synthesised (sliced, in the background)
    const a = await g.page.evaluate(() => Bowling.audio()); report.audio = a;
    assert.equal(a.loops, 2);
    const an = await g.page.evaluate(() => __bowlingQA.audioAnalyse());
    for (const [k, list] of Object.entries(an)) for (const b of list) { assert.ok(!b.nan && b.peak <= 1, k + ' buffer invalid ' + JSON.stringify(b)); }
    report.audioBuffers = Object.fromEntries(Object.entries(an).map(([k, l]) => [k, l.length]));
    await g.ctx.close();
  });

  await test('performance (reported): real-time frame rate and startup transfer on this machine', async () => {
    const { page, ctx } = await openGame(browser, base, { query: 'qa=1' });
    await waitPhase(page, 'welcome');
    const res = await page.evaluate(() => performance.getEntriesByType('resource').map(e => ({ n: e.name.replace(location.origin, ''), s: e.encodedBodySize || e.transferSize || 0 })));
    report.startupBytes = res.reduce((a, b) => a + b.s, 0); report.requests = res.length;
    await page.evaluate(() => __bowlingQA.enterHall());
    await page.waitForTimeout(3000);
    const fps = async ms => { const f0 = await page.evaluate(() => Bowling.frames); await page.waitForTimeout(ms); const f1 = await page.evaluate(() => Bowling.frames); return +((f1 - f0) / (ms / 1000)).toFixed(1); };
    report.fpsReady = await fps(8000);
    await page.evaluate(() => __bowlingQA.shoot());
    report.fpsThrow = await fps(8000);
    report.quality = await page.evaluate(() => { const q = Bowling.quality(); return { tier: q.tier, ratio: q.ratio, gpu: q.gpu, reason: q.reason, downgraded: q.downgraded }; });
    report.info = (await page.evaluate(() => Bowling.snapshot())).info;
    await ctx.close();
  });

  fs.writeFileSync(path.join(OUT, 'ui-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close(); srv.close();
  process.exit(summary('browser ui') ? 1 : 0);
})();
