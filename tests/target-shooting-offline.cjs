/* Target Shooting 3D — offline package: builds the teacher/student HTML files, opens them from file:// with
 * EVERY network request blocked, edits the configuration and questions in the teacher panel, exports a
 * student file, opens it, plays a round, answers the teacher's question and reaches the final results.
 */
const { chromium } = require('playwright'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('node:assert/strict');
const { build } = require('../games/target-shooting/tools/build-offline.cjs');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-offline-')), out = path.join(dir, 'pkg');
  const r = build(out);
  const teacherFile = path.join(out, 'التصويب-على-الهدف-نسخة-المعلم.html'), studentFile = path.join(out, 'التصويب-على-الهدف-نسخة-الطالب.html');
  assert(fs.existsSync(teacherFile) && fs.existsSync(studentFile));
  for (const f of [teacherFile, studentFile]) { const h = fs.readFileSync(f, 'utf8'); assert(!/<script[^>]+src=/i.test(h), 'no external script'); assert(!/<link[^>]+href=/i.test(h), 'no external stylesheet'); assert(!/url\((['"]?)(https?:|assets\/)/.test(h), 'no external CSS url'); }
  console.log('PASS build: self-contained files', Object.entries(r.sizes).map(([k, v]) => k + ' ' + (v / 1048576).toFixed(2) + ' MB').join(', '), r.zip ? '+ zip' : '');
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
  const network = []; await ctx.route(/^(https?|wss?):/, rt => { network.push(rt.request().url()); rt.abort(); });
  const errors = [];
  const open = async (file) => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); await p.goto('file://' + file, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForFunction(() => ['menu', 'error'].includes(document.body.dataset.phase), null, { timeout: 180000 }); assert.equal(await p.evaluate(() => document.body.dataset.phase), 'menu'); return p; };
  // teacher version
  const t = await open(teacherFile);
  assert(await t.isVisible('#btnTeacher'), 'teacher button in the teacher version');
  await t.click('#btnTeacher'); await t.waitForSelector('.t-wrap');
  await t.fill('[data-k=school]', 'مدرسة الاختبار النموذجية'); await t.fill('[data-k=lesson]', 'درس الكسور');
  await t.selectOption('[data-k=mode]', 'archery'); await t.selectOption('[data-k=difficulty]', 'beginner'); await t.fill('[data-k=arrowsPerQuestion]', '1');
  await t.click('[data-tab=questions]');
  // keep exactly one question: edit the first, delete the rest
  const n0 = await t.locator('.t-q').count();
  for (let i = n0 - 1; i >= 1; i--) { t.once('dialog', d => d.accept()); await t.click(`[data-act=del][data-q="${i}"]`); }
  await t.fill('[data-q="0"][data-f="text"]', 'كم يساوي نصف الواحد؟');
  for (const [k, v] of [[0, '٠٫٢٥'], [1, '٠٫٥'], [2, '٠٫٧٥'], [3, '١']]) await t.fill(`[data-q="0"][data-f="opt"][data-o="${k}"]`, v);
  await t.check('input[name=c0][value="1"]');
  await t.click('[data-act=save]'); await t.waitForSelector('.t-msg:has-text("تم الحفظ")');
  console.log('PASS teacher panel: identity, mode, difficulty, arrows and a 4-option question edited and saved');
  await t.click('[data-tab=export]');
  const [dl] = await Promise.all([t.waitForEvent('download', { timeout: 120000 }), t.click('[data-act=student]')]);
  const exported = path.join(dir, 'exported-student.html'); await dl.saveAs(exported);
  await t.close();
  // exported student version
  const s = await open(exported);
  assert(!(await s.isVisible('#btnTeacher')), 'no admin control in the student version');
  assert.equal(await s.textContent('#menuSchool'), 'مدرسة الاختبار النموذجية');
  assert.deepEqual(await s.evaluate(() => [...document.querySelectorAll('.card')].filter(c => c.getAttribute('aria-disabled') !== 'true').map(c => c.dataset.mode)), ['archery']);
  await s.click('#btnStart');
  await s.waitForFunction(() => document.body.dataset.phase === 'shooting', null, { timeout: 60000 });
  // one arrow: hold to draw then release on the canvas
  const box = await s.locator('#scene').boundingBox();
  await s.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5); await s.mouse.down();
  await s.waitForFunction(() => window.TargetShooting && document.body.dataset.phase === 'shooting' && document.getElementById('drawMeter') && !document.getElementById('drawMeter').hidden && parseFloat(document.querySelector('#drawMeter i').style.width) >= 99, null, { timeout: 60000 });
  await s.mouse.up();
  await s.waitForFunction(() => document.body.dataset.phase === 'question', null, { timeout: 60000 });
  assert.equal(await s.textContent('#qText'), 'كم يساوي نصف الواحد؟');
  assert.equal(await s.locator('#qBody .opt').count(), 4);
  await s.locator('#qBody .opt', { hasText: '٠٫٥' }).click();
  await s.waitForFunction(() => document.body.dataset.phase === 'feedback', null, { timeout: 30000 });
  assert((await s.textContent('#fbTitle')).includes('صحيحة'));
  await s.click('#btnNext'); await s.waitForFunction(() => document.body.dataset.phase === 'summary', null, { timeout: 30000 });
  assert.equal(await s.textContent('#sumTitle'), 'التصويب على الهدف'); assert.equal(await s.textContent('#sumSchool'), 'مدرسة الاختبار النموذجية');
  console.log('PASS exported student file: teacher config + question applied, mouse hold/release shot, correct answer, final results');
  assert.deepEqual(network, [], 'no network request at all');
  assert.deepEqual(errors, []);
  console.log('PASS zero network requests, zero errors (file://)');
  await browser.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log('TARGET SHOOTING OFFLINE ALL PASS');
})().catch(e => { console.error(e); process.exit(1); });
