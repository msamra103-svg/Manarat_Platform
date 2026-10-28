/* Target Shooting 3D — real platform integration (js/school.js host + games/target-shooting iframe).
 * The school API is mocked at the network layer exactly like tests/basketball-integration.cjs; everything
 * else (host rendering, question dialog, server-graded result relay, next/advance, finish) is the real code.
 * Checks: config handshake carries assignment settings + school + student; forged / other-sport / wrong-token /
 * wrong-origin / wrong-index messages are ignored; correct answer banks points; pending essay stays neutral;
 * final platform report shows the correct game name.
 */
const { chromium } = require('playwright'), fs = require('fs'), http = require('http'), path = require('path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (file.endsWith('/')) file += 'index.html'; fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); }); });
const teacher = '22222222-2222-4222-8222-222222222222';
const questions = [{ id: 'q1', type: 'multiple_choice', text: 'ما العنصر الذي يحتاجه النبات؟', options: ['الماء', 'البلاستيك'], points: 10 }, { id: 'q2', type: 'open_text', text: 'اشرح أهمية الماء.', points: 10 }];
const config = { name: 'مدرسة أبو عبيدة الإعدادية للبنين', subtitle: 'منصة التعلّم التفاعلي', primary: '#8a1538', background: '#f8f6f4', hero: 'تعلّم بطريقتك.', description: 'منصة', socials: [], sections: ['games', 'videos', 'about'] };
const shooting = { mode: 'balloons', difficulty: 'intermediate', arrowsPerQuestion: 2, aimAssist: 'high' };
const assignment = { id: 'as', code: 'code', teacher_id: teacher, title: 'لعبة النباتات المائية', game_id: 'g', class_name: 'سابع 1', active: true, settings: { templates: ['race', 'football', 'basketball', 'volleyball', 'bowling', 'fishing', 'target-shooting', 'puzzle', 'classic'], types: ['multiple_choice', 'open_text'], shooting }, types: ['multiple_choice', 'open_text'], videos: [] };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
  let answers = 0, finished = 0;
  await page.addInitScript(() => {
    if (location.pathname.includes('/games/target-shooting/')) history.replaceState(null, '', location.pathname + '?qa=1&manual=1&quality=low');
    window.addEventListener('message', e => { if (e.origin === location.origin && e.source === parent && e.data?.type === 'school-target-shooting-config') window.__tsTestConfig = e.data; });
  });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url()); if (u.hostname === '127.0.0.1') return r.continue();
    if (u.pathname.endsWith('/school-api')) {
      const b = r.request().postDataJSON(); let j = {};
      switch (b.action) {
        case 'settings': j = config; break;
        case 'open': j = assignment; break;
        case 'start': assert.equal(b.template, 'target-shooting'); j = { id: 's', secret: 'secret', questions, threshold: 70 }; break;
        case 'answer': answers++; j = { correct: b.question === 'q1', pending: b.question === 'q2', points: b.question === 'q1' ? 10 : 0, feedback: 'تم تسجيل إجابتك', explanation: '' }; break;
        case 'finish': finished++; j = { score: 50, pending: true, group: false }; break;
        case 'settingsHistory': case 'leaderboard': case 'saveSettings': j = []; break;
      }
      return r.fulfill({ json: j });
    }
    return r.fulfill({ json: [] });
  });
  const shots = process.env.TS_SHOTS || ''; const snap = async (p, n) => { if (shots) try { await p.screenshot({ path: path.join(shots, n + '.png'), timeout: 90000 }); } catch (e) { console.log('screenshot skipped', n); } };
  await page.goto(base + '/?task=code');
  await page.locator('#studentName').fill('طالب الرماية');
  await page.locator('[data-action=selectTemplate][data-id="target-shooting"]').click();
  await page.locator('#startForm button').last().click();
  await page.locator('[id="target-shootingGame"]').waitFor();
  let F = null; for (let i = 0; i < 300 && !F; i++) { F = page.frames().find(f => f.url().includes('/games/target-shooting/')); if (!F) await page.waitForTimeout(100); }
  await F.waitForFunction(() => window.__tsQA && document.body.dataset.phase === 'menu' && !document.getElementById('btnStart').disabled, null, { timeout: 300000 });
  const cfgMsg = await F.evaluate(() => window.__tsTestConfig);
  assert(cfgMsg && cfgMsg.token && cfgMsg.count === 2, 'config handshake');
  assert.deepEqual(cfgMsg.shooting, shooting); assert.equal(cfgMsg.school, config.name); assert.equal(cfgMsg.student, 'طالب الرماية');
  const st0 = await F.evaluate(() => __tsQA.state);
  assert.equal(st0.mode, 'archery'); assert.equal(st0.difficulty, 'beginner'); assert.equal(st0.total, 2); assert.equal(st0.guided, true);
  assert.equal(await F.evaluate(() => document.getElementById('modeCards').hidden && document.getElementById('diffGroup').hidden), true, 'advanced controls hidden');
  console.log('PASS config handshake: existing tasks become simple auto-archery, settings hidden');
  await snap(page, 'int_menu');
  await F.evaluate(() => __tsQA.start());
  await F.waitForFunction(() => document.body.dataset.phase === 'intro', null, { timeout: 60000 });
  await page.waitForTimeout(900);
  await F.evaluate(() => { const Q = __tsQA; for (let i = 0; i < 360 && Q.state.phase !== 'question'; i++) Q.step(1, 1 / 60, false); });
  await F.waitForFunction(() => document.body.dataset.phase === 'question', null, { timeout: 60000 });
  assert.equal(await F.evaluate(() => __tsQA.state.shots), 0, 'question comes before release');
  assert.equal(await F.evaluate(() => __tsQA.state.archer), 'AIM_HOLD', 'bow is visibly drawn');
  console.log('PASS archer auto draws -> centered school question, no shooting controls');
  await page.locator('#modal [data-action=answer]').first().waitFor({ timeout: 60000 }); await snap(page, 'int_question');
  // protocol hardening
  await page.evaluate(() => { const w = document.getElementById('target-shootingGame').contentWindow; w.postMessage({ type: 'school-target-shooting-result', token: 'not-the-session-token', index: 0, correct: true, pending: false }, location.origin); w.postMessage({ type: 'school-bowling-result', token: 'x', index: 0, correct: true }, location.origin); });
  await page.waitForTimeout(300); assert.equal(await F.evaluate(() => __tsQA.state.phase), 'question'); assert.equal(await F.evaluate(() => __tsQA.state.correct), 0);
  await F.evaluate(() => { const c = window.__tsTestConfig, data = { type: 'school-target-shooting-result', token: c.token, index: 0, correct: true, pending: false }; for (const o of [{ origin: 'https://untrusted.invalid' }, { source: window }, { data: { ...data, index: 7 } }]) window.dispatchEvent(new MessageEvent('message', { data, origin: location.origin, source: parent, ...o })); });
  assert.equal(await F.evaluate(() => __tsQA.state.phase), 'question'); assert.equal(await F.evaluate(() => __tsQA.state.correct), 0);
  console.log('PASS forged / other-sport / wrong-token / wrong-origin / wrong-source / wrong-index messages ignored');
  // correct answer (server-graded by the host)
  await page.locator('#modal [data-action=answer]').first().click();
  await F.waitForFunction(() => document.body.dataset.phase === 'flight', null, { timeout: 60000 });
  await F.evaluate(() => { __tsQA.step(160, 1 / 60, false); });
  await F.waitForFunction(() => document.body.dataset.phase === 'feedback', null, { timeout: 60000 });
  const fb = await F.evaluate(() => ({ s: __tsQA.state, title: document.getElementById('fbTitle').textContent }));
  assert.equal(answers, 1); assert.equal(fb.s.correct, 1); assert.equal(fb.s.shots, 1); assert.equal(fb.s.hits, 1, 'correct answer arrow hits the target'); assert(fb.s.points >= 100, 'correct answer awards points'); assert(fb.title.includes('صحيحة'));
  console.log('PASS embedded correct answer → host → server grading → banked points', fb.s.points);
  await snap(page, 'int_feedback');
  await F.locator('#btnNext').click();
  await F.waitForFunction(() => __tsQA.state.round === 1 && ['intro', 'preparing'].includes(document.body.dataset.phase), null, { timeout: 60000 });
  console.log('PASS next → advance → round 2');
  await page.waitForTimeout(900);
  await F.evaluate(() => { const Q = __tsQA; for (let i = 0; i < 360 && Q.state.phase !== 'question'; i++) Q.step(1, 1 / 60, false); });
  await F.waitForFunction(() => document.body.dataset.phase === 'question', null, { timeout: 60000 });
  await page.locator('#answerText').fill('الماء ضروري لحياة النبات'); await page.locator('[data-action=textAnswer]').click();
  await F.waitForFunction(() => document.body.dataset.phase === 'feedback', null, { timeout: 60000 });
  const pend = await F.evaluate(() => ({ s: __tsQA.state, icon: document.getElementById('fbIcon').className, title: document.getElementById('fbTitle').textContent }));
  assert.equal(pend.s.pending, 1); assert.equal(pend.s.shots, 1, 'pending essay does not trigger a miss'); assert(pend.icon.includes('wait'), 'pending is neutral'); assert(!pend.icon.includes('no')); assert(pend.title.includes('للمعلم'));
  console.log('PASS pending essay stays neutral (not marked wrong)');
  await F.locator('#btnNext').click();
  await F.waitForFunction(() => document.body.dataset.phase === 'summary', null, { timeout: 60000 });
  const sum = await F.evaluate(() => ({ title: document.getElementById('sumTitle').textContent, mode: document.getElementById('sumMode').textContent, school: document.getElementById('sumSchool').textContent, student: document.getElementById('sumStudent').textContent, correct: document.getElementById('sumCorrect').textContent }));
  assert.equal(sum.title, 'التصويب على الهدف'); assert(sum.mode.includes('رماية الأسهم')); assert.equal(sum.school, config.name); assert.equal(sum.student, 'طالب الرماية');
  assert.equal(finished, 0, 'nothing is saved before the student confirms');
  console.log('PASS in-game final results: game name, mode, school, student, answers', sum.correct);
  await snap(page, 'int_summary');
  await F.locator('#btnSubmit').click();
  await page.locator('.result-score').waitFor({ timeout: 120000 });
  assert.equal(answers, 2); assert.equal(finished, 1);
  const report = await page.locator('#app').innerText();
  assert(report.includes('الدرجة مبدئية') || report.includes('مبدئية'), 'platform final report');
  console.log('PASS platform final report after the last round');
  await snap(page, 'int_report');
  assert.deepEqual(errors, []);
  await browser.close(); server.close(); console.log('PASS target-shooting platform integration');
})().catch(e => { console.error(e); server.close(); process.exit(1); });