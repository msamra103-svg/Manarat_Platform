/* عدّاء قطر — real platform integration (js/school.js host + games/qatar-runner iframe).
 * Same approach as tests/target-shooting-integration.cjs: the school API is mocked at the network layer; the
 * host page, its question dialog, the server-graded result relay, next/advance and finish are the real code.
 * Checks: config handshake (token, count, school, student); the gate stops the boy and asks the HOST to show the
 * question; forged / other-game / wrong-token / wrong-origin / wrong-source / wrong-index messages are ignored;
 * a correct answer opens the gate; a pending essay opens the gate neutrally (never marked wrong); the run ends
 * at the finish arch and the platform records the attempt (finish) and shows its report.
 */
const { chromium } = require('playwright'), fs = require('fs'), http = require('http'), path = require('path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => { let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (file.endsWith('/')) file += 'index.html'; fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(d); }); });
const teacher = '22222222-2222-4222-8222-222222222222';
const questions = [{ id: 'q1', type: 'multiple_choice', text: 'ما العنصر الذي يحتاجه النبات؟', options: ['الماء', 'البلاستيك'], points: 10 }, { id: 'q2', type: 'open_text', text: 'اشرح أهمية الماء.', points: 10 }];
const config = { name: 'مدرسة أبو عبيدة الإعدادية للبنين', subtitle: 'منصة التعلّم التفاعلي', primary: '#8a1538', background: '#f8f6f4', hero: 'تعلّم بطريقتك.', description: 'منصة', socials: [], sections: ['games', 'videos', 'about'] };
const assignment = { id: 'as', code: 'code', teacher_id: teacher, teacher: 'أ. محمود', title: 'لعبة النباتات المائية', game_id: 'g', class_name: 'سابع 1', active: true, settings: { templates: ['race', 'football', 'basketball', 'volleyball', 'bowling', 'fishing', 'target-shooting', 'qatar-runner', 'puzzle', 'classic'], types: ['multiple_choice', 'open_text'] }, types: ['multiple_choice', 'open_text'], videos: [] };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
  let answers = 0, finished = 0;
  await page.addInitScript(() => {
    if (location.pathname.includes('/games/qatar-runner/')) history.replaceState(null, '', location.pathname + '?qa=1&quality=low');
    window.addEventListener('message', e => { if (e.origin === location.origin && e.source === parent && e.data?.type === 'school-qatar-runner-config') window.__qrTestConfig = e.data; });
  });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url()); if (u.hostname === '127.0.0.1') return r.continue();
    if (u.pathname.endsWith('/school-api')) {
      const b = r.request().postDataJSON(); let j = {};
      switch (b.action) {
        case 'settings': j = config; break;
        case 'open': j = assignment; break;
        case 'start': assert.equal(b.template, 'qatar-runner'); j = { id: 's', secret: 'secret', questions, threshold: 70 }; break;
        case 'answer': answers++; j = { correct: b.question === 'q1', pending: b.question === 'q2', points: b.question === 'q1' ? 10 : 0, feedback: 'تم تسجيل إجابتك', explanation: '' }; break;
        case 'finish': finished++; j = { score: 50, pending: true, group: false }; break;
        case 'settingsHistory': case 'leaderboard': case 'saveSettings': j = []; break;
      }
      return r.fulfill({ json: j });
    }
    return r.fulfill({ json: [] });
  });
  const shots = process.env.QR_SHOTS || ''; const snap = async (p, n) => { if (shots) try { await p.screenshot({ path: path.join(shots, n + '.png'), timeout: 120000 }); } catch (e) { console.log('screenshot skipped', n); } };
  await page.goto(base + '/?task=code');
  await page.locator('#studentName').fill('طالب العدّاء');
  await page.locator('[data-action=selectTemplate][data-id="qatar-runner"]').click();
  await page.locator('#startForm button').last().click();
  await page.locator('[id="qatar-runnerGame"]').waitFor();
  let F = null; for (let i = 0; i < 300 && !F; i++) { F = page.frames().find(f => f.url().includes('/games/qatar-runner/')); if (!F) await page.waitForTimeout(100); }
  await F.waitForFunction(() => window.QRGame && window.QRGame.state.phase === 'menu', null, { timeout: 300000 });
  const cfgMsg = await F.evaluate(() => window.__qrTestConfig);
  assert(cfgMsg && cfgMsg.token && cfgMsg.count === 2, 'config handshake'); assert.equal(cfgMsg.school, config.name); assert.equal(cfgMsg.student, 'طالب العدّاء');
  const st0 = await F.evaluate(() => ({ total: QRGame.state.total, embedded: QRGame.embedded, teacherHidden: document.getElementById('btnTeacher').hidden, mode: document.getElementById('mMode').textContent }));
  assert.equal(st0.total, 2); assert.equal(st0.embedded, true); assert.equal(st0.teacherHidden, true, 'teacher dashboard hidden inside the platform'); assert(st0.mode.includes('منصة'));
  console.log('PASS config handshake: 2 platform questions, school + student names, teacher panel hidden');
  await snap(page, 'qr_int_menu');
  // run to the first gate: the game must stop before the gate and ask the HOST for the question
  await F.evaluate(() => { QRGame.autopilot(true); QRGame.start(); QRGame.until(s => s.phase === 'question', 120); });
  assert.equal(await F.evaluate(() => QRGame.state.phase), 'question');
  const g0 = await F.evaluate(() => ({ d: QRGame.state.distance, gate: QRGame.state.gates[0].s, ownCard: document.getElementById('question').hidden }));
  assert(g0.d < g0.gate - 4, 'boy stopped before the gate'); assert.equal(g0.ownCard, true, 'the game never shows platform questions itself');
  await page.locator('#modal [data-action=answer]').first().waitFor({ timeout: 60000 });
  assert((await page.locator('#modal').innerText()).includes('ما العنصر الذي يحتاجه النبات'), 'host question dialog');
  console.log('PASS gate stop → host shows the school question (game has no answer key)');
  await snap(page, 'qr_int_question');
  // protocol hardening
  await page.evaluate(() => { const w = document.getElementById('qatar-runnerGame').contentWindow; w.postMessage({ type: 'school-qatar-runner-result', token: 'not-the-session-token', index: 0, correct: true, pending: false }, location.origin); w.postMessage({ type: 'school-bowling-result', token: 'x', index: 0, correct: true }, location.origin); });
  await page.waitForTimeout(300); assert.equal(await F.evaluate(() => QRGame.state.phase), 'question'); assert.equal(await F.evaluate(() => QRGame.state.correctTotal), 0);
  await F.evaluate(() => { const c = window.__qrTestConfig, data = { type: 'school-qatar-runner-result', token: c.token, index: 0, correct: true, pending: false }; for (const o of [{ origin: 'https://untrusted.invalid' }, { source: window }, { data: { ...data, index: 7 } }]) window.dispatchEvent(new MessageEvent('message', { data, origin: location.origin, source: parent, ...o })); });
  assert.equal(await F.evaluate(() => QRGame.state.phase), 'question'); assert.equal(await F.evaluate(() => QRGame.state.correctTotal), 0);
  console.log('PASS forged / other-game / wrong-token / wrong-origin / wrong-source / wrong-index messages ignored');
  // correct answer graded by the host → gate opens → the boy runs through → next → advance
  const correctBtn = page.locator('#modal [data-action=answer]').filter({ hasText: 'الماء' }).first();
  await (await correctBtn.count() ? correctBtn : page.locator('#modal [data-action=answer]').first()).click();
  await F.waitForFunction(() => QRGame.state.phase === 'success', null, { timeout: 60000 });
  assert.equal(answers, 1); assert.equal(await F.evaluate(() => QRGame.state.correctTotal), 1);
  await F.evaluate(() => QRGame.until(s => s.phase === 'run' && s.gateIdx === 1, 20));
  await F.waitForFunction(() => QRGame.state.platform.round === 1, null, { timeout: 30000 });
  assert.equal(await F.evaluate(() => QRGame.state.gateIdx), 1); assert.equal(await F.evaluate(() => QRGame.state.platform.round), 1, 'host advanced to question 2');
  console.log('PASS correct answer → host grading → gate opens → run on → next/advance');
  // second gate: essay (pending) must stay neutral
  await F.evaluate(() => QRGame.until(s => s.phase === 'question', 120));
  await page.locator('#answerText').fill('الماء ضروري لحياة النبات'); await page.locator('[data-action=textAnswer]').click();
  await F.waitForFunction(() => QRGame.state.phase === 'success', null, { timeout: 60000 });
  const pend = await F.evaluate(() => ({ pending: QRGame.state.pendingTotal, wrong: QRGame.state.wrongTotal, hearts: QRGame.state.hearts }));
  assert.equal(pend.pending, 1); assert.equal(pend.wrong, 0, 'pending essay is not wrong'); assert.equal(pend.hearts, 3, 'no heart lost for a pending essay');
  console.log('PASS pending essay opens the gate neutrally (not marked wrong)');
  assert.equal(finished, 0, 'nothing finished before the run ends');
  await F.evaluate(() => QRGame.until(s => s.phase === 'results', 90));
  const res = await F.evaluate(() => ({ school: document.getElementById('rSchool').textContent, student: document.getElementById('rStudent').textContent, title: document.getElementById('rTitle').textContent }));
  assert.equal(res.school, config.name); assert.equal(res.student, 'طالب العدّاء'); assert(res.title.includes('عدّاء قطر'));
  await page.locator('.result-score').waitFor({ timeout: 120000 });
  assert.equal(answers, 2); assert.equal(finished, 1);
  console.log('PASS finish arch → in-game results → platform report (finish recorded once)');
  await snap(page, 'qr_int_report');
  // homepage demo route (local demo grading in the host): a wrong answer recoils the boy, then the gate opens for the next question
  const demo = await browser.newPage({ viewport: { width: 1280, height: 860 } }); demo.on('pageerror', e => errors.push(e.message));
  await demo.addInitScript(() => { if (location.pathname.includes('/games/qatar-runner/')) history.replaceState(null, '', location.pathname + '?qa=1&quality=low'); });
  await demo.route('**/*', async r => { const u = new URL(r.request().url()); if (u.hostname === '127.0.0.1') return r.continue(); if (u.pathname.endsWith('/school-api')) { const b = r.request().postDataJSON(); return r.fulfill({ json: b.action === 'settings' ? config : [] }); } return r.fulfill({ json: [] }); });
  await demo.goto(base + '/index.html?demo=qatar-runner');
  let D = null; for (let i = 0; i < 600 && !D; i++) { D = demo.frames().find(f => f.url().includes('/games/qatar-runner/')); if (!D) await demo.waitForTimeout(100); }
  await D.waitForFunction(() => window.QRGame && QRGame.state.phase === 'menu', null, { timeout: 300000 });
  assert.equal(await D.evaluate(() => QRGame.state.total), 3, 'demo has the host demo questions');
  await D.evaluate(() => { QRGame.autopilot(true); QRGame.start(); QRGame.until(s => s.phase === 'question', 120); });
  await demo.locator('#modal [data-action=answer]').filter({ hasText: '٧' }).first().click();
  await D.waitForFunction(() => QRGame.state.phase === 'reject', null, { timeout: 60000 });
  await D.evaluate(() => QRGame.until(s => s.phase === 'run' && s.gateIdx === 1, 30));
  await D.waitForFunction(() => QRGame.state.platform.round === 1, null, { timeout: 30000 });
  const dm = await D.evaluate(() => ({ gate: QRGame.state.gateIdx, outcome: QRGame.state.gates[0].outcome, round: QRGame.state.platform.round, hearts: QRGame.state.hearts }));
  assert.deepEqual(dm, { gate: 1, outcome: 'wrong', round: 1, hearts: 2 });
  console.log('PASS homepage demo: wrong answer → light-wave recoil → gate opens for the next question (host graded once)');
  await demo.close();
  assert.deepEqual(errors, []);
  await browser.close(); server.close(); console.log('PASS qatar-runner platform integration');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
