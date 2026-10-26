/* Real-browser end-to-end tests: `node tests/browser/e2e.cjs`
 * 1. standalone complete throw with screenshots (ready / approach / question / outcome / reaction)
 * 2. the answer never changes the physics (same shot, correct vs wrong answer -> identical pinfall)
 * 3. embedded in test-host.html: config/title, forged messages, pending essay, save failure + retry, final report
 * 4. repeated rounds + restart: no resource growth, audio voices cleaned up */
'use strict';
const assert = require('node:assert/strict');
const { serve, launch, openGame, waitPhase, shot, step, until, test, summary } = require('./lib.cjs');

(async () => {
  const { srv, base } = await serve();
  const browser = await launch();

  await test('standalone: complete throw (approach, release, halfway question, continued roll, pinfall) + screenshots', async () => {
    const { page, errors, ctx } = await openGame(browser, base);
    await waitPhase(page, 'welcome');
    await step(page, 2); await shot(page, 'shot-01-welcome-1366x768.png');
    await page.evaluate(() => __bowlingQA.enterHall()); await step(page, 90);
    await page.evaluate(() => __bowlingQA.setInputs({ start: 0.2, angle: 0, power: 0.65, spin: -0.6 })); await step(page, 60);
    await shot(page, 'shot-02-ready-1366x768.png');
    await page.evaluate(() => __bowlingQA.shoot());
    await step(page, 70); await shot(page, 'shot-03-approach-backswing.png');
    await step(page, 42); await shot(page, 'shot-04-approach-release.png');
    assert.ok(await until(page, 'question'));
    const s = await page.evaluate(() => Bowling.snapshot());
    assert.ok(Math.abs(s.physics.ball.pos[2] + 9.144) < 0.05, 'paused at the halfway point: z=' + s.physics.ball.pos[2]);
    await step(page, 120);
    const s2 = await page.evaluate(() => Bowling.snapshot());
    assert.deepEqual(s2.physics, s.physics, 'ball and pins frozen while the question is open');
    await shot(page, 'shot-05-question-halfway.png');
    await page.evaluate(() => __bowlingQA.answer(0));
    assert.ok(await until(page, 'outcome', 1500));
    const after = await page.evaluate(() => Bowling.snapshot());
    assert.ok(after.physics.time > s.physics.time, 'resumed from the frozen state');
    await step(page, 20); await shot(page, 'shot-06-outcome-pins.png');
    const res = await page.evaluate(() => ({ k: Bowling.knocked, p: Bowling.points }));
    assert.equal(res.p, res.k, 'correct demo answer -> local points = physical pinfall');
    await step(page, 150); await shot(page, 'shot-07-reaction.png');
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await test('the answer never changes the physics: same shot with correct vs wrong answer', async () => {
    const out = [];
    for (const answer of [0, 2]) {
      const { page, ctx, errors } = await openGame(browser, base);
      await waitPhase(page, 'welcome'); await page.evaluate(() => __bowlingQA.enterHall()); await step(page, 10);
      await page.evaluate(() => __bowlingQA.setInputs({ start: 0.12, angle: -0.4, power: 0.7, spin: -0.3 }));
      await page.evaluate(() => __bowlingQA.shoot());
      assert.ok(await until(page, 'question'));
      await step(page, 37);                                // different time spent reading the question
      await page.evaluate(a => __bowlingQA.answer(a), answer);
      assert.ok(await until(page, 'outcome', 1500));
      out.push(await page.evaluate(() => ({ knocked: Bowling.knocked, points: Bowling.points, pins: Bowling.snapshot().physics.pins.map(p => p.pos.map(v => +v.toFixed(6))) })));
      assert.deepEqual(errors, []); await ctx.close();
    }
    assert.equal(out[0].knocked, out[1].knocked); assert.deepEqual(out[0].pins, out[1].pins);
    assert.equal(out[0].points, out[0].knocked); assert.equal(out[1].points, 0, 'wrong answer earns no game points');
  });

  await test('embedded in the test host: contract, forged messages, pending, save failure + retry, final title', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('crash', () => console.log('   (renderer crashed)'));
    page.on('console', m => { if (m.type() === 'error') console.log('   console.error', m.text().slice(0, 200)); });
    await page.goto(base + '/test-host.html?game=qa=1%26manual=1');
    await page.evaluate(() => { document.getElementById('failSave').checked = true; });
    const frame = () => page.frame({ url: /games\/bowling\/index\.html\?qa=1/ });
    await page.waitForFunction(() => { const f = document.getElementById('bowlingGame'); return f && f.contentWindow && f.contentWindow.Bowling && f.contentWindow.Bowling.phase === 'welcome'; }, null, { timeout: 120000, polling: 250 });
    const F = frame();
    assert.equal(await F.evaluate(() => Bowling.title), 'لعبة النباتات المائية');
    assert.equal(await F.evaluate(() => document.getElementById('assignmentTitle').textContent), 'لعبة النباتات المائية');
    await F.evaluate(() => __bowlingQA.enterHall());
    for (let round = 0; round < 3; round++) {
      await F.evaluate(() => __bowlingQA.step(1 / 60, 10));
      await F.evaluate(() => __bowlingQA.shoot());
      assert.ok(await F.evaluate(() => __bowlingQA.until(p => p === 'question')));
      await page.waitForSelector('#dialog.open');
      if (round === 0) {
        await page.screenshot({ path: require('path').join(require('./lib.cjs').OUT, 'shot-08-embedded-host-question.png'), timeout: 240000 });
        for (const k of ['wrongToken', 'staleIndex', 'otherSport', 'sibling', 'badConfig']) await page.evaluate(k => HOST.forge[k](), k);
        await page.waitForTimeout(300);
        assert.equal(await F.evaluate(() => Bowling.phase), 'question', 'forged messages ignored');
        assert.equal(await F.evaluate(() => Bowling.title), 'لعبة النباتات المائية');
      }
      if (round < 2) await page.evaluate(i => document.querySelectorAll('#dialog button.opt')[i].click(), round === 0 ? 0 : 2);   // q1 correct, q2 wrong
      else { await page.fill('#dialog textarea', 'تختبئ فيها الأسماك'); await page.evaluate(() => document.querySelector('#dialog button.opt').click()); }
      try { await page.waitForFunction(() => document.getElementById('bowlingGame').contentWindow.Bowling.phase !== 'question', null, { timeout: 10000, polling: 100 }); }
      catch (e) { throw new Error('round ' + round + ' answer not applied; host log tail: ' + JSON.stringify(await page.evaluate(() => HOST.log.slice(-4))) + ' dialog open: ' + await page.evaluate(() => document.getElementById('dialog').className) + ' game: ' + JSON.stringify(await F.evaluate(() => __bowlingQA.state()))); }
      if (round === 0) { await page.evaluate(() => HOST.forge.duplicate()); await page.waitForTimeout(200); }
      console.log('   round', round, 'resolving');
      assert.ok(await F.evaluate(() => __bowlingQA.until(p => p === 'outcome', 1 / 60, 1500)));
      const st = await F.evaluate(() => ({ points: Bowling.points, knocked: Bowling.knocked, pending: Bowling.pending, kind: document.getElementById('feedback').dataset.kind }));
      if (round === 0) assert.equal(st.points, st.knocked);
      if (round === 1) assert.equal(st.kind, 'wrong');
      if (round === 2) { assert.equal(st.kind, 'pending'); assert.equal(st.pending, 1); }
      const pointsBefore = st.points;
      await F.evaluate(() => __bowlingQA.next());
      if (round < 2) {
        // the host answers 'next' asynchronously with 'advance' (old index): let the message arrive before stepping
        await page.waitForFunction(r => document.getElementById('bowlingGame').contentWindow.Bowling.round === r + 1, round, { timeout: 10000, polling: 100 });
        assert.ok(await F.evaluate(() => __bowlingQA.until(p => p === 'ready', 1 / 60, 600)), 'next rack ready');
        assert.equal(await F.evaluate(() => Bowling.round), round + 1);
      } else {
        // first finish attempt fails (simulated): Next is re-enabled, nothing awarded twice
        await page.waitForFunction(() => HOST.log.some(l => l.m && l.m.type === 'school-bowling-retry'), null, { timeout: 30000, polling: 100 });
        await page.waitForTimeout(150);
        assert.equal(await F.evaluate(() => document.getElementById('next').disabled), false);
        assert.equal(await F.evaluate(() => Bowling.points), pointsBefore);
        await F.evaluate(() => __bowlingQA.next());
        try { await page.waitForSelector('#report[style*="block"]', { timeout: 180000 }); }
        catch (e) { throw new Error('host did not finish; host log tail: ' + JSON.stringify(await page.evaluate(() => HOST.log.slice(-5))) + ' game: ' + JSON.stringify(await F.evaluate(() => __bowlingQA.state()).catch(x => String(x)))); }   // the iframe teardown (WebGL dispose) can block a software-GPU main thread for a while
        assert.equal(await page.textContent('#rTitle'), 'لعبة النباتات المائية');
      }
    }
    const outs = await page.evaluate(() => HOST.log.filter(l => l.dir === '<-').map(l => l.m));
    assert.ok(outs.every(m => m.type.startsWith('school-bowling-')));
    assert.ok(outs.filter(m => m.type === 'school-bowling-outcome').every(m => typeof m.pins === 'number' && ['goal', 'miss', 'pending'].includes(m.outcome)));
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await test('three rounds + restart: no resource growth, audio voices released, no errors', async () => {
    const { page, ctx, errors } = await openGame(browser, base);
    await waitPhase(page, 'welcome'); await page.evaluate(() => __bowlingQA.enterHall()); await step(page, 5);
    const info0 = (await page.evaluate(() => Bowling.snapshot())).info;
    for (let r = 0; r < 3; r++) {
      await page.evaluate(() => __bowlingQA.shoot());
      assert.ok(await until(page, 'question'));
      await page.evaluate(() => __bowlingQA.answer(1));
      assert.ok(await until(page, 'outcome', 1500));
      await page.evaluate(() => __bowlingQA.next());
      if (r < 2) assert.ok(await until(page, 'ready', 600));
    }
    assert.equal(await page.evaluate(() => Bowling.phase), 'finished');
    await page.evaluate(() => ManaratGameControls.restart()); await step(page, 30);
    const info1 = (await page.evaluate(() => Bowling.snapshot())).info;
    assert.ok(info1.geometries <= info0.geometries + 2 && info1.textures <= info0.textures + 1, 'GPU resources grew: ' + JSON.stringify({ info0, info1 }));
    const a = await page.evaluate(() => Bowling.audio());
    assert.ok(a.voices <= 4 && a.loops <= 2, 'audio voices ' + JSON.stringify(a));
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await browser.close(); srv.close();
  process.exit(summary('browser e2e') ? 1 : 0);
})();
