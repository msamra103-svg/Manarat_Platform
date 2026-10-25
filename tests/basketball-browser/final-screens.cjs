// Captures the reference screenshots of the real page (manual stepping, chosen quality). node tests/browser/final-screens.cjs outDir [quality]
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8099'; const OUT = process.argv[2] || 'qa-screens'; const Q = process.argv[3] || 'high';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(`${BASE}/games/basketball/index.html?capture=1&manual=1&quality=${Q}`);
  await p.waitForFunction('window.Basketball && Basketball.phase==="welcome"', null, { timeout: 300000, polling: 300 });
  const step = (s, r = false) => p.evaluate(([s, r]) => __qaStep(s, 1 / 30, r), [s, r]);
  const until = async (ph, max = 12) => { for (let t = 0; t < max; t += 0.25) if ((await step(0.25)) === ph) return; };
  const shot = async n => { await step(1 / 30, true); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };
  await step(1.5); await shot('desktop_01_welcome');
  await p.evaluate('document.getElementById("start").click()'); await until('ready'); await step(0.9); await shot('desktop_02_ready_dribble');
  await p.evaluate('document.getElementById("shoot").click()');
  await step(0.95); await shot('desktop_03_jump_shot');
  await until('question'); await step(0.6); await shot('desktop_04_question_ball_frozen');
  await p.evaluate('document.querySelectorAll("#choices button")[0].click()'); await until('outcome'); await step(1.1); await shot('desktop_05_make_celebration');
  await p.evaluate('document.getElementById("next").click()'); await until('ready', 16); await step(0.3);
  await p.evaluate('document.getElementById("shoot").click()'); await until('question');
  await p.evaluate('document.querySelectorAll("#choices button")[0].click()'); await until('outcome'); await step(0.9); await shot('desktop_06_miss_reaction');
  await p.evaluate('document.getElementById("next").click()'); await until('ready', 16); await step(0.3);
  await p.evaluate('document.getElementById("shoot").click()'); await until('question');
  await p.evaluate('document.querySelectorAll("#choices button")[2].click()'); await until('outcome'); await step(0.6);
  await p.evaluate('document.getElementById("next").click()'); await step(0.5); await shot('desktop_07_summary');
  await b.close();
})();
