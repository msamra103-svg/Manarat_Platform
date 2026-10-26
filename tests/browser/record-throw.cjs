/* Records one complete throw (setup, approach, release, halfway question, continued roll, pinfall,
 * reaction) as qa/throw-full.mp4. Frames are rendered OFFLINE in the real game at a fixed 1/25 s step
 * (manual QA mode) and encoded with ffmpeg, so the video plays at real speed even on a software GPU.
 * It is a faithful capture of the game's own frames, not a real-time performance recording.
 * Usage: node tests/browser/record-throw.cjs [width] [height]   (requires ffmpeg on PATH) */
'use strict';
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const { serve, launch, openGame, waitPhase, OUT } = require('./lib.cjs');
(async () => {
  const W = +process.argv[2] || 960, H = +process.argv[3] || 540, FPS = 25, dir = path.join(OUT, 'frames');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { srv, base } = await serve(), browser = await launch();
  const { page, ctx, errors } = await openGame(browser, base, { viewport: { width: W, height: H } });
  await waitPhase(page, 'welcome');
  await page.evaluate(() => __bowlingQA.enterHall());
  await page.evaluate(() => __bowlingQA.step(1 / 60, 60));
  await page.evaluate(() => __bowlingQA.setInputs({ start: 0.2, angle: 0, power: 0.65, spin: -0.6 }));
  let n = 0;
  const frame = async () => { await page.screenshot({ path: path.join(dir, String(n++).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 82, timeout: 240000 }); };
  const run = async (count, before) => { for (let i = 0; i < count; i++) { if (before) await before(i); await page.evaluate(d => __bowlingQA.step(d, 1), 1 / FPS); await frame(); } };
  await run(FPS * 1);                                                         // setup view
  await page.evaluate(() => __bowlingQA.shoot());
  for (let i = 0; i < FPS * 8 && (await page.evaluate(() => Bowling.phase)) !== 'question'; i++) { await page.evaluate(d => __bowlingQA.step(d, 1), 1 / FPS); await frame(); }
  await run(Math.round(FPS * 1.6));                                           // the question is open, the ball waits
  await page.evaluate(() => __bowlingQA.answer(0));
  for (let i = 0; i < FPS * 12 && (await page.evaluate(() => Bowling.phase)) !== 'outcome'; i++) { await page.evaluate(d => __bowlingQA.step(d, 1), 1 / FPS); await frame(); }
  await run(FPS * 4);                                                         // outcome + reaction
  const meta = await page.evaluate(() => ({ knocked: Bowling.knocked, points: Bowling.points }));
  await ctx.close(); await browser.close(); srv.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.jpg'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, 'throw-full.mp4')]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(JSON.stringify({ frames: n, seconds: +(n / FPS).toFixed(1), size: W + 'x' + H, result: meta, errors }));
})().catch(e => { console.error(e); process.exit(1); });
