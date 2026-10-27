/* Records one complete throw (setup, approach, release, halfway question, continued roll, pinfall,
 * reaction) as qa/throw-full.mp4. Frames are rendered OFFLINE in the real game at a fixed 1/25 s step
 * (manual QA mode) and encoded with ffmpeg, so the video plays at real speed even on a software GPU.
 * It is a faithful capture of the game's own frames, not a real-time performance recording.
 * SOUND: every call the game made to its audio module during the capture is logged against the game
 * clock (QA mode), then replayed into the real audio.js running on an OfflineAudioContext in the same
 * page; the rendered track (qa/throw-audio.wav) is muxed into the video, so what you hear is exactly what
 * the game schedules (same events, listener positions and synthesis) at the frames you see.
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
  const t0 = await page.evaluate(() => __bowlingQA.clock);
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
  const t1 = await page.evaluate(() => __bowlingQA.clock);
  // offline audio render of the logged calls (3 s pre-roll so the hall bed is already up, trimmed below)
  const wavB64 = await page.evaluate(async ([t0, t1]) => {
    const PRE = 3, sr = 44100, log = __bowlingQA.audioLog().filter(e => e.t >= t0 - 0.001 && e.t <= t1);
    const oc = new OfflineAudioContext(2, Math.ceil(sr * (t1 - t0 + PRE + 1)), sr);
    const a = BowlingAudio.create({ context: oc, volume: 0.85 });
    a.at(0); await a.unlock(); a.crowd('calm');
    for (const e of log) { a.at(e.t - t0 + PRE); a[e.m](...e.a); }
    const buf = await oc.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    const ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab); let o = 0;
    const s4 = s => { for (const ch of s) v.setUint8(o++, ch.charCodeAt(0)); }, u32 = x => { v.setUint32(o, x, true); o += 4; }, u16 = x => { v.setUint16(o, x, true); o += 2; };
    s4('RIFF'); u32(36 + n * 4); s4('WAVE'); s4('fmt '); u32(16); u16(1); u16(2); u32(sr); u32(sr * 4); u16(4); u16(16); s4('data'); u32(n * 4);
    for (let i = 0; i < n; i++) { v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true); o += 4; }
    let bin = ''; const u8 = new Uint8Array(ab); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }, [t0, t1]);
  const wavRaw = path.join(dir, 'raw.wav'), wav = path.join(OUT, 'throw-audio.wav');
  fs.writeFileSync(wavRaw, Buffer.from(wavB64, 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '3', '-i', wavRaw, '-t', String(n / FPS), wav]);
  await ctx.close(); await browser.close(); srv.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.jpg'), '-i', wav, '-c:a', 'aac', '-b:a', '160k', '-shortest', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, 'throw-full.mp4')]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(JSON.stringify({ frames: n, seconds: +(n / FPS).toFixed(1), size: W + 'x' + H, result: meta, errors }));
})().catch(e => { console.error(e); process.exit(1); });
