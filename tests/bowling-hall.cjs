/* Hall interior (walls, LED wall, educational screens, tickers) in Node: `node tests/bowling-hall.cjs`
 * Builds the REAL venue.js + hall.js with Three r128 against a recording 2D-canvas stand-in (no GPU) and checks:
 *  - the walls are no longer one flat colour: textured wainscot, acoustic panels, columns, ceiling tiles, tickers;
 *  - every screen faces into the hall, sits inside it above head height, and never over a lane or the pins;
 *  - slides/ads are educational Arabic text; no brand, sponsor, ministry or logo wording; the exact school name;
 *  - live info (title, throw, points, last pins) reaches the LED wall; screens redraw at a limited rate;
 *  - reduced motion stops the scrolling ticker and transitions; low tier uses fewer screens;
 *  - static parts are merged (few draw calls); dispose releases everything. */
'use strict';
const assert = require('node:assert/strict');
const { loadThree } = require('./lib/three-node.cjs');
let passed = 0;
const ok = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };

function canvasStub(texts) {
  const ctx2d = () => {
    let font = '10px sans-serif';
    const target = {
      canvas: null, set font(v) { font = v; }, get font() { return font; },
      measureText: t => ({ width: String(t).length * (parseFloat(/(\d+)px/.exec(font) || [0, 10])[1]) * 0.5 }),
      createLinearGradient: () => ({ addColorStop() { } }), createRadialGradient: () => ({ addColorStop() { } }),
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      fillText: (t) => { texts.push(String(t)); }, drawImage() { }
    };
    return new Proxy(target, { get: (o, k) => (k in o ? o[k] : (typeof k === 'string' ? () => { } : undefined)), set: (o, k, v) => { o[k] = v; return true; } });
  };
  return { createElement: () => { const c = { width: 1, height: 1, style: {} }; const g = ctx2d(); c.getContext = () => g; return c; } };
}

(async () => {
  const texts = [];
  const ctx = loadThree();
  ctx.document = canvasStub(texts);
  const vm = require('vm'), fs = require('fs'), path = require('path');
  for (const f of ['physics.js', 'venue.js', 'hall.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../games/bowling', f), 'utf8'), ctx, { filename: f });
  const T = ctx.THREE, P = ctx.BowlingPhysics;
  const SCHOOL = 'مدرسة أبو عبيدة الإعدادية للبنين', PLATFORM = 'منصة التعلّم التفاعلي والألعاب التعليمية';
  const build = tier => {
    const scene = new T.Scene();
    const Q = { tier, lanes: 2, neighbor: false };
    const venue = ctx.BowlingVenue.build(scene, { env: null, quality: Q, lanes: 2, font: 'Tajawal', schoolName: SCHOOL, platformName: PLATFORM });
    const hall = ctx.BowlingHall.build(scene, { venue, quality: Q, font: 'Tajawal', schoolName: SCHOOL, platformName: PLATFORM, reduced: false, hand: 'right' });
    scene.updateMatrixWorld(true);
    return { scene, venue, hall };
  };
  const hi = build('high'), lo = build('low');

  await ok('walls are built up (not one flat colour): textured wainscot, acoustic panels, columns, ceiling, tickers', () => {
    const mats = new Set(); hi.hall.group.traverse(o => { if (o.isMesh) mats.add(o.material); });
    const mapped = [...mats].filter(m => m.map).length;
    assert.ok(mapped >= 7, 'textured hall materials: ' + mapped);
    const box = new T.Box3().setFromObject(hi.hall.group), H = hi.venue.halfHall;
    assert.ok(box.min.x <= -H + 0.1 && box.max.x >= H - 0.1, 'covers both side walls');
    assert.ok(box.max.y >= 4.9 && box.min.y <= 0.1, 'floor to ceiling');
  });

  await ok('every screen faces into the hall, above head height, never over a lane, the pins or the approach', () => {
    for (const { hall, venue } of [hi, lo]) for (const s of hall.screens) {
      const h = s.holder, p = h.getWorldPosition(new T.Vector3()), n = new T.Vector3(0, 0, 1).applyQuaternion(h.getWorldQuaternion(new T.Quaternion()));
      const toCentre = new T.Vector3(-p.x, 0, (-8) - p.z).normalize();
      assert.ok(n.dot(toCentre) > 0.2, 'screen at ' + p.toArray().map(v => v.toFixed(1)) + ' faces away');
      assert.ok(p.y > 2.0 && p.y < 5, 'height ' + p.y);
      const sideWall = Math.abs(Math.abs(p.x) - venue.halfHall) < 0.2, backWall = p.z < venue.maskZ, rearWall = p.z > 12;
      assert.ok(sideWall || backWall || rearWall, 'screen not on a wall: ' + p.toArray());
    }
    assert.ok(lo.hall.screens.length < hi.hall.screens.length, 'low tier uses fewer screens');
  });

  await ok('content: educational Arabic slides and messages; exact school name; no brand/sponsor/ministry/logo words', () => {
    for (let i = 0; i < 400; i++) hi.hall.update(0.5);    // run through every slide and ad
    const all = texts.join(' | ');
    assert.ok(all.includes(SCHOOL), 'school name shown');
    for (const w of ['الاحتكاك', 'نقطة الجيب', 'الزخم', '١٨٫٢٩', 'الإجابة الصحيحة']) assert.ok(all.includes(w), 'missing educational content: ' + w);
    for (const w of ['وزارة', 'ministry', 'sponsor', 'راعي', '®', '™', 'Brunswick', 'AMF', 'Storm', 'Ebonite', 'Coca', 'Pepsi', 'Ooredoo', 'QNB', 'Qatar Airways']) assert.ok(!all.toLowerCase().includes(w.toLowerCase()), 'forbidden word: ' + w);
    assert.ok(ctx.BowlingHall.SLIDES.length >= 5 && ctx.BowlingHall.ADS.length >= 3);
  });

  await ok('live info reaches the LED wall; screens redraw at a limited rate (not every frame)', () => {
    texts.length = 0; hi.hall.setInfo({ title: 'لعبة النباتات المائية', round: 1, total: 3, points: 9, lastPins: 7 }); hi.hall.update(1 / 60);
    const t = texts.join(' | ');
    assert.ok(t.includes('لعبة النباتات المائية') && t.includes('٢ / ٣') && t.includes('٩') && t.includes('٧ / ١٠'), t.slice(0, 300));
    const led = hi.hall.screens[0]; let draws = 0; const d0 = led.draw; led.draw = (...a) => { draws++; return d0(...a); };
    for (let i = 0; i < 120; i++) hi.hall.update(1 / 60);      // 2 s at 60 fps
    led.draw = d0;
    assert.ok(draws >= 18 && draws <= 26, 'LED redraws in 2 s: ' + draws);
  });

  await ok('reduced motion: ticker stops scrolling; normal mode scrolls it', () => {
    const tick = (() => { let t = null; hi.hall.group.traverse(o => { if (o.isMesh && o.material.map && o.material.map.wrapS === T.RepeatWrapping && o.material.map.image && o.material.map.image.width === 4096) t = o.material.map; }); return t; })();
    assert.ok(tick, 'ticker texture');
    const x0 = tick.offset.x; hi.hall.update(1); assert.notEqual(tick.offset.x, x0);
    hi.hall.setReduced(true); const x1 = tick.offset.x; hi.hall.update(1); assert.equal(tick.offset.x, x1);
    hi.hall.setReduced(false);
  });

  await ok('static hall parts merged: few meshes per tier', () => {
    let meshes = 0; lo.hall.group.traverse(o => { if (o.isMesh) meshes++; });
    console.log('   low-tier hall meshes (draw calls):', meshes, '· screens:', lo.hall.screens.length);
    assert.ok(meshes <= 24, 'meshes ' + meshes);
  });

  await ok('dispose removes the hall from the scene', () => {
    hi.hall.dispose(); assert.ok(!hi.scene.children.includes(hi.hall.group));
  });

  console.log(`\n${passed} hall tests passed`);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
