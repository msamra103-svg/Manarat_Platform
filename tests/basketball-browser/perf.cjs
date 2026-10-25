// Performance probe on the current machine (reports, does not assert). node tests/browser/perf.cjs [out.json]
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8099';
(async () => {
  const out = { when: new Date().toISOString(), viewport: '1280x720', note: '', tiers: {} };
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  out.renderer = await (await b.newPage()).evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : g.RENDERER); });
  out.cpu = require('os').cpus()[0].model + ' x' + require('os').cpus().length;
  for (const tier of ['low', 'medium', 'high']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const t0 = Date.now();
    await p.goto(`${BASE}/games/basketball/index.html?capture=1&manual=1&quality=${tier}`);
    await p.waitForFunction('window.Basketball && Basketball.phase==="welcome"', null, { timeout: 240000, polling: 200 });
    const loadSec = (Date.now() - t0) / 1000;
    await p.evaluate('document.getElementById("start").click()');
    await p.evaluate('__qaStep(4,1/60,false)');
    const r = await p.evaluate(() => {
      const sc = window.Basketball; const snap = sc.snapshot();
      // render cost: average of 5 full renders
      let t = performance.now(); for (let i = 0; i < 5; i++) window.__qaStep(1 / 60, 1 / 60, true); const render = (performance.now() - t) / 5;
      // full frame including rasterisation: force completion with a 1-pixel read-back
      const gl = document.getElementById('pitch').getContext('webgl2'); const px = new Uint8Array(4);
      t = performance.now(); for (let i = 0; i < 3; i++) { window.__qaStep(1 / 60, 1 / 60, true); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } const frameSync = (performance.now() - t) / 3;
      // simulation/animation cost without rendering, across dribble + shot + outcome
      document.getElementById('shoot').click();
      t = performance.now(); window.__qaStep(2.0, 1 / 60, false); const shotPart = performance.now() - t;
      const choices = document.querySelectorAll('#choices button'); if (choices[0]) choices[0].click();
      t = performance.now(); window.__qaStep(3.0, 1 / 60, false); const outPart = performance.now() - t;
      const updMs = (shotPart + outPart - 2 * render) / (5 * 60);
      return { triangles: snap.triangles, drawCalls: snap.calls, crowd: snap.crowd, cpuSubmitMs: +render.toFixed(1), softwareFrameMs: +frameSync.toFixed(0), updateMsPerFrame: +updMs.toFixed(2), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
    });
    out.tiers[tier] = { loadToWelcomeSec: +loadSec.toFixed(1), ...r };
    console.log(tier, JSON.stringify(out.tiers[tier]));
    await p.close();
  }
  out.note = 'softwareFrameMs = full frame on a CPU software rasteriser (SwiftShader, no GPU) and is NOT representative of real graphics hardware. cpuSubmitMs = CPU-side cost of one update+render submission. updateMsPerFrame = JavaScript animation/IK/simulation/crowd-state cost per frame on this CPU.';
  await b.close();
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
