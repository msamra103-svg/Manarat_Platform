/* Fishing integration with the actual school.js host and assignment UI.
 * API responses are isolated fixtures: no production students or grades are created.
 * Exercises server-authoritative results, essay review, failed-finish retry and presets.
 */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('../games/fishing/tools/serve.cjs');
const questions = [
  { id: 'fish-q1', type: 'multiple_choice', text: 'ما عاصمة دولة قطر؟', options: ['الدوحة', 'الخور'], points: 10 },
  { id: 'fish-q2', type: 'multiple_choice', text: 'كم يساوي ٨ × ٧؟', options: ['٥٦', '٦٤'], points: 10 },
  { id: 'fish-q3', type: 'open_text', text: 'كيف نحافظ على نظافة البحر؟', points: 10 }
];
const assignment = { id: 'fishing-integration', code: 'fishing-test', title: 'مهمة صيد الأسماك التجريبية',
  teacher_id: '22222222-2222-4222-8222-222222222222', game_id: 'g-fishing', class_name: 'سابع ١', active: true,
  settings: { templates: ['fishing'], types: ['multiple_choice', 'open_text'] }, types: ['multiple_choice', 'open_text'], videos: [] };
const config = { name: 'مدرسة أبو عبيدة الإعدادية للبنين', primary: '#8a1538', socials: [], sections: ['games'] };

(async () => {
  const server = await start(0), base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const errors = [], answered = [], apiCalls = [];
  let finishCalls = 0;
  try {
    await ctx.addInitScript(() => {
      if (location.pathname === '/games/fishing/index.html') history.replaceState(null, '', location.pathname + '?qa=1&quality=low');
    });
    await ctx.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      if (url.pathname.endsWith('/school-api')) {
        const body = route.request().postDataJSON(); apiCalls.push(body.action);
        let json = {};
        switch (body.action) {
          case 'settings': json = config; break;
          case 'designState': json = { data: config, revision: 'fishing-integration', preview: false, publicVideos: [] }; break;
          case 'open': json = assignment; break;
          case 'start': json = { id: 'fishing-session', secret: 'fixture-secret', questions, threshold: 70 }; break;
          case 'answer': {
            assert.equal(body.id, 'fishing-session'); assert.equal(body.secret, 'fixture-secret');
            assert(!answered.some(a => a.question === body.question), 'one answer request per question');
            answered.push(body);
            json = { correct: body.question === 'fish-q1', pending: body.question === 'fish-q3',
              points: body.question === 'fish-q1' ? 10 : 0, feedback: 'تم تسجيل إجابتك', explanation: '' };
            break;
          }
          case 'finish':
            finishCalls++;
            if (finishCalls === 1) return route.fulfill({ status: 503, json: { error: 'تعذر حفظ النتيجة، أعد المحاولة.' } });
            json = { score: 33, passed: false, pending: true, group: false }; break;
          case 'leaderboard': json = []; break;
        }
        return route.fulfill({ json });
      }
      return route.fulfill({ json: [] });
    });
    const p = await ctx.newPage(); p.setDefaultTimeout(120000); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '/?task=fishing-test');
    await p.locator('#studentName').fill('طالب اختبار الدمج');
    await p.locator('[data-action=selectTemplate][data-id=fishing]').click();
    await p.locator('#startForm button').last().click();
    await p.locator('#fishingGame').waitFor();
    const frame = p.frame({ url: /games\/fishing\/index\.html/ });
    await frame.waitForFunction(() => window.FishingGame?.phase === 'welcome');
    assert.equal(await frame.locator('#modeLabel').innerText(), assignment.title);
    assert.equal(await frame.evaluate(() => FishingGame.total), 3);
    await frame.locator('#start').click();
    await frame.evaluate(() => { FishingGame.qa.pause(true); FishingGame.qa.step(2.2); });
    for (let i = 0; i < 3; i++) {
      await frame.evaluate(() => { const G = FishingGame; G.qa.until(() => G.simPhase === 'ready'); G.qa.cast(); G.qa.until(() => G.phase === 'question', 60); });
      await p.locator('#modal[open] .question').waitFor();
      assert.equal(await p.locator('#modal .question').innerText(), questions[i].text);
      assert.equal(await frame.evaluate(() => FishingGame.qa.answer('correct')), false, 'embedded game cannot locally grade official questions');
      if (i === 2) {
        await p.locator('#answerText').fill('نجمع المخلفات ونحافظ على الكائنات البحرية.');
        await p.locator('[data-action=textAnswer]').click();
      } else await p.locator('#modal [data-action=answer]').nth(i === 0 ? 0 : 1).click();
      await frame.waitForFunction(() => FishingGame.phase === 'resolve');
      assert.equal(await p.locator('#modal').isVisible(), false);
      await frame.evaluate(() => FishingGame.qa.until(() => FishingGame.phase === 'outcome', 80));
      assert.deepEqual(await frame.evaluate(() => FishingGame.results), ['catch', 'escape', 'pending'].slice(0, i + 1));
      assert.equal(await frame.evaluate(() => FishingGame.catches), 1);
      if (i === 0) {
        const shots = path.join(__dirname, '..', 'games/fishing/docs/screenshots');
        fs.mkdirSync(shots, { recursive: true });
        await p.screenshot({ path: path.join(shots, '23-platform-student-outcome.jpg'), quality: 84 });
      }
      await frame.locator('#next').click();
      if (i < 2) await frame.waitForFunction(() => FishingGame.phase === 'retrieving');
    }
    await p.locator('#notice').filter({ hasText: 'تعذر حفظ النتيجة' }).waitFor();
    await frame.waitForFunction(() => !document.getElementById('next').disabled);
    assert.equal(await frame.evaluate(() => FishingGame.round), 2);
    await frame.locator('#next').click();
    await p.locator('.result-score').waitFor();
    assert.equal(await p.locator('.result-score').innerText(), '33%');
    assert((await p.locator('#app').innerText()).includes('الدرجة مبدئية حتى مراجعة الأسئلة المقالية'));
    assert.equal(answered.length, 3); assert.equal(finishCalls, 2);
    assert.equal(apiCalls.filter(a => a === 'start').length, 1);
    console.log('PASS actual school assignment: correct/wrong/essay, server results, one answer each, finish retry, final grade');

    // Changing the visible quality selector must affect this session immediately.
    await p.goto(base + '/games/fishing/index.html?qa=1&quality=low');
    await p.waitForFunction(() => window.FishingGame?.phase === 'welcome');
    assert.equal(await p.evaluate(() => FishingGame.view.qualityName), 'low');
    await p.selectOption('#quality', 'medium');
    await p.click('#start');
    await p.waitForFunction(() => FishingGame.phase === 'ready');
    assert.equal(await p.evaluate(() => FishingGame.view.qualityName), 'medium');
    assert(await p.evaluate(() => !!FishingGame.view.refl && FishingGame.view.renderer.shadowMap.enabled));
    await p.evaluate(() => { const G = FishingGame; G.qa.pause(true); G.qa.step(2.2); G.qa.cast(); G.qa.until(() => G.phase === 'question'); G.qa.answer('correct'); G.qa.until(() => G.phase === 'outcome', 80); });
    assert.equal(await p.evaluate(() => FishingGame.catches), 1);
    assert.deepEqual(errors, []);
    console.log('PASS selected quality applies before play, rebuilt scene completes a catch, no browser errors');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
