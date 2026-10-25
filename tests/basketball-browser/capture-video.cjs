// Deterministic runtime recording of the real game page (not generated imagery):
// frames are stepped at a fixed 1/FPS s (default 24) through the page's QA hook and screenshotted, then encoded with ffmpeg.
//   node tests/browser/capture-video.cjs outDir [quality]
const { chromium } = require('playwright'); const fs = require('fs'); const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:8099';
const OUT = process.argv[2] || 'qa-video'; const QUALITY = process.argv[3] || 'high';
const W = +(process.env.W || 1280), H = +(process.env.H || 720), FPS = +(process.env.FPS || 24);
(async () => {
  fs.mkdirSync(OUT + '/frames', { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(`${BASE}/games/basketball/index.html?capture=1&manual=1&quality=${QUALITY}`);
  await p.waitForFunction('window.Basketball && Basketball.phase==="welcome"', null, { timeout: 240000, polling: 300 });
  let n = 0;
  const shot = async () => { await p.screenshot({ path: `${OUT}/frames/f${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 }); };
  const run = async (sec, until) => { for (let t = 0; t < sec; t += 1 / FPS) { const ph = await p.evaluate(`__qaStep(1/${FPS},1/${FPS},true)`); await shot(); if (until && ph === until) return true; } return false; };
  await run(1.2);
  await p.evaluate('document.getElementById("start").click()');
  await run(6, 'ready'); await run(1.4);
  await p.evaluate('document.getElementById("shoot").click()');
  await run(4, 'question'); await run(2.2);
  await p.evaluate('document.querySelectorAll("#choices button")[0].click()');
  await run(4, 'outcome'); await run(3.6);
  await p.evaluate('document.getElementById("next").click()');
  await run(8, 'ready'); await run(1.0);
  await p.evaluate('document.getElementById("shoot").click()');
  await run(4, 'question'); await run(1.6);
  await p.evaluate('document.querySelectorAll("#choices button")[0].click()');
  await run(4, 'outcome'); await run(3.2);
  await b.close();
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${OUT}/frames/f%05d.jpg -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -movflags +faststart ${OUT}/basketball-runtime.mp4`);
  console.log('frames', n, 'video', OUT + '/basketball-runtime.mp4');
})();
