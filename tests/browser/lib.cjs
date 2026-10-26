/* Shared helpers for the real-browser tests (Playwright + Chromium).
 * Starts a static server on the package root, launches Chromium with a real WebGL implementation
 * (SwiftShader software GPU in CI/containers; a hardware GPU is used automatically when available). */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'qa');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright is required: npm i -D playwright (then npx playwright install chromium)'); process.exit(2); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(ROOT, u); if (!f.startsWith(ROOT)) { rsp.writeHead(403); return rsp.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      fs.readFile(f, (err, data) => { if (err) { rsp.writeHead(404); return rsp.end('404'); } rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); rsp.end(data); });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}
async function launch(extraArgs = []) {
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...extraArgs] });
}
async function openGame(browser, base, { viewport = { width: 1366, height: 768 }, query = 'qa=1&manual=1', reducedMotion, init } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: reducedMotion || 'no-preference', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  await page.goto(base + '/games/bowling/index.html?' + query);
  return { ctx, page, errors };
}
async function waitPhase(page, phases, timeout = 120000) {
  const list = [].concat(phases);
  await page.waitForFunction(l => window.Bowling && l.includes(window.Bowling.phase), list, { timeout, polling: 200 });
  return page.evaluate(() => Bowling.phase);
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), timeout: 240000 });
const step = (page, n, dt = 1 / 60) => page.evaluate(([n, dt]) => __bowlingQA.step(dt, n), [n, dt]);
const until = (page, phase, max = 3000) => page.evaluate(([p, m]) => __bowlingQA.until(ph => ph === p, 1 / 60, m), [phase, max]);
let passed = 0, failed = 0;
async function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;   // ONLY=<text> runs a subset
  const t0 = Date.now();
  try { await fn(); passed++; console.log('PASS', name, '(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)'); }
  catch (e) { failed++; console.log('FAIL', name, '\n  ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n   ') : e); }
}
function summary(label) { console.log(`\n${label}: ${passed} passed, ${failed} failed`); return failed; }
module.exports = { serve, launch, openGame, waitPhase, shot, step, until, test, summary, ROOT, OUT };
