/* Bowling hall interior (bowling-only): realistic wall build-up and animated educational screens.
 *  - side walls: oak slat wainscot, acoustic fabric panels in bays, plaster columns with up/down lights,
 *    a gold rail, an illuminated exit door, a textured acoustic ceiling;
 *  - an LED video wall above the masking units: rotating educational slides about the physics of the shot,
 *    an animated diagram of the ball path (skid -> hook -> roll), and the student's live progress;
 *  - side-wall screens (educational slides with transitions), animated promotion lightboxes with
 *    learning messages, and scrolling LED tickers;
 * Content is original, educational and in Arabic; no brand, logo or real sponsor is shown.
 *   BowlingHall.build(scene, { venue, quality, font, schoolName, platformName, reduced, hand }) ->
 *     { update(dt), setInfo({title, round, total, points, lastPins, correct}), setReduced(b), dispose() }
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const MAROON = '#8a1538', MAROON_D = '#5b0e27', GOLD = '#c9a24d', GOLD_L = '#e8cf8f', WHITE = '#ffffff';
  const digits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ------------------------------------------------------------------ material textures (procedural)
  function slatTexture() { // warm oak slats with dark shadow gaps
    const c = canvas(512, 256), x = c.getContext('2d'), r = rng(5);
    x.fillStyle = '#1a0f0a'; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 16; i++) {
      const x0 = i * 32 + 3, w = 26, base = [128 + r() * 26, 82 + r() * 18, 48 + r() * 12];
      const g = x.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, `rgb(${base[0] * 0.8 | 0},${base[1] * 0.8 | 0},${base[2] * 0.8 | 0})`); g.addColorStop(0.5, `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`); g.addColorStop(1, `rgb(${base[0] * 0.72 | 0},${base[1] * 0.72 | 0},${base[2] * 0.72 | 0})`);
      x.fillStyle = g; x.fillRect(x0, 0, w, 256);
      for (let k = 0; k < 9; k++) { x.strokeStyle = `rgba(60,32,14,${0.15 + r() * 0.2})`; x.lineWidth = 0.7; const gx = x0 + 2 + r() * (w - 4); x.beginPath(); x.moveTo(gx, 0); x.bezierCurveTo(gx + 2, 80, gx - 2, 170, gx + 1, 256); x.stroke(); }
    }
    return c;
  }
  function fabricTexture(col, seam) { // acoustic panels: 2 x 2 per tile, fabric weave, recessed seams
    const S = 512, c = canvas(S, S), x = c.getContext('2d'), r = rng(9), img = x.createImageData(S, S);
    const [cr, cg, cb] = col;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const n = (r() - 0.5) * 18 + ((i + j) % 4 < 2 ? 4 : -4) + ((i - j + 512) % 6 < 3 ? 3 : -3);
      const o = (j * S + i) * 4; img.data[o] = clamp(cr + n, 0, 255); img.data[o + 1] = clamp(cg + n * 0.7, 0, 255); img.data[o + 2] = clamp(cb + n * 0.7, 0, 255); img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // soft vertical light falloff on each panel + seams
    for (const py of [0, S / 2]) for (const px of [0, S / 2]) { const g = x.createLinearGradient(0, py, 0, py + S / 2); g.addColorStop(0, 'rgba(255,240,220,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0.12)'); x.fillStyle = g; x.fillRect(px, py, S / 2, S / 2); }
    x.fillStyle = seam; x.fillRect(0, 0, S, 6); x.fillRect(0, S / 2 - 3, S, 6); x.fillRect(0, 0, 6, S); x.fillRect(S / 2 - 3, 0, 6, S);
    return c;
  }
  function plasterTexture() {
    const c = canvas(256, 256), x = c.getContext('2d'), r = rng(13), img = x.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) { const n = (r() - 0.5) * 14; img.data[i * 4] = 206 + n; img.data[i * 4 + 1] = 199 + n; img.data[i * 4 + 2] = 190 + n; img.data[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); return c;
  }
  function ceilingTexture() { // dark acoustic tiles with a grid
    const c = canvas(512, 512), x = c.getContext('2d'), r = rng(17);
    x.fillStyle = '#26272c'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.035)`; x.fillRect(r() * 512, r() * 512, 2, 2); }
    x.fillStyle = '#131418'; for (let k = 0; k <= 4; k++) { x.fillRect(k * 128 - 3, 0, 6, 512); x.fillRect(0, k * 128 - 3, 512, 6); }
    return c;
  }
  function tex(c, srgb = true, rep = null, aniso = 4) {
    const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = aniso;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }

  // ------------------------------------------------------------------ Arabic text helpers
  function wrap(x, text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }
  function fit(x, text, maxW, size, weight, fam) { let s = size; x.font = `${weight} ${s}px ${fam}`; while (x.measureText(text).width > maxW && s > 10) { s -= 2; x.font = `${weight} ${s}px ${fam}`; } return s; }
  function para(x, text, rightX, y, maxW, size, lh, weight, fam, color) {
    x.font = `${weight} ${size}px ${fam}`; x.fillStyle = color; x.textAlign = 'right'; x.direction = 'rtl';
    const lines = wrap(x, text, maxW); lines.forEach((l, i) => x.fillText(l, rightX, y + i * lh)); return y + lines.length * lh;
  }

  // ------------------------------------------------------------------ educational content
  const SLIDES = [
    { kind: 'hook', title: 'فيزياء الرمية: الاحتكاك يصنع الانحناء', body: 'تنزلق الكرة أولًا على طبقة الزيت، ثم يمسك الاحتكاك بها في المنطقة الجافة فتنحني، ثم تتدحرج تدحرجًا كاملًا.' },
    { kind: 'pocket', title: 'نقطة الجيب', body: 'أفضل فرصة لإسقاط القوارير العشر: بين القارورتين ١ و٣ (أو ١ و٢ للأعسر) بزاوية دخول صغيرة.' },
    { kind: 'momentum', title: 'الزخم = الكتلة × السرعة', body: 'كتلة الكرة ٦٫٤ كغ وكتلة القارورة ١٫٥٣ كغ؛ لذلك تنقل الكرة زخمًا كبيرًا وتواصل طريقها بين القوارير.' },
    { kind: 'rule', title: 'قاعدة التحدّي', body: 'التصويب يُسقط القوارير، والإجابة الصحيحة تحوّلها إلى نقاط. فكّر جيدًا… ثم صوّب بثقة.' },
    { kind: 'numbers', title: 'أرقام المسار', body: '١٨٫٢٩ م من خط الخطأ إلى القارورة الأولى · عرض المسار ١٫٠٥ م · ٣٩ لوحًا خشبيًا · ٣٠٫٥ سم بين مراكز القوارير المتجاورة.' },
    { kind: 'motivation', title: 'كل رمية فرصة جديدة', body: 'الخطأ جزء من التعلّم: راجع الملاحظة، عدّل زاويتك، وجرّب من جديد.' }
  ];
  const ADS = [
    { a: 'العب · تعلّم · تفوّق', b: 'منصة التعلّم التفاعلي والألعاب التعليمية', c: [MAROON, '#3d0919'] },
    { a: 'اقرأ ٢٠ دقيقة كل يوم', b: 'القراءة تصنع الفرق في كل مادة', c: ['#1f4e79', '#0e2740'] },
    { a: 'الاحترام · الإتقان · التعاون', b: 'قيمٌ نلعب بها ونتعلّم بها', c: ['#7a5a1a', '#3d2c08'] },
    { a: 'الرياضة + المعرفة = بطل', b: 'تحرّك، فكّر، وأجب بدقة', c: ['#1f6a41', '#0b3320'] }
  ];
  const TICKER = '✦ أجب بدقة… وصوّب بثقة ✦ الإجابة الصحيحة تحوّل القوارير الساقطة إلى نقاط ✦ الاحتكاك في المنطقة الجافة يصنع انحناء الكرة ✦ الاحترام · الإتقان · التعاون ✦ ';

  // drawing primitives for slides
  function laneDiagram(x, X, Y, W, H, t, hand) { // top view of the lane, ball path with skid / hook / roll zones
    x.save();
    x.fillStyle = '#d9b483'; x.fillRect(X, Y, W, H);
    for (let i = 1; i < 13; i++) { x.fillStyle = 'rgba(120,80,40,0.25)'; x.fillRect(X + i * W / 13, Y, 1, H); }
    x.fillStyle = 'rgba(80,140,220,0.18)'; x.fillRect(X, Y + H * 0.33, W, H * 0.67);               // oil (near the foul line = bottom)
    x.fillStyle = '#1a1a1a'; x.fillRect(X, Y + H - 4, W, 4);                                      // foul line
    // pins (top)
    for (let row = 0; row < 4; row++) for (let col = 0; col <= row; col++) { const px = X + W / 2 + (col - row / 2) * W * 0.16, py = Y + 14 + (3 - row) * W * 0.07; x.fillStyle = WHITE; x.beginPath(); x.arc(px, py, W * 0.035, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#b11'; x.lineWidth = 2; x.stroke(); }
    // path: straight skid, hook, roll into the pocket
    const sgn = hand === 'left' ? 1 : -1;
    const path = u => { const yy = Y + H - 10 - u * (H - 50); const k = clamp((u - 0.45) / 0.55, 0, 1); return [X + W / 2 - sgn * W * 0.28 + sgn * W * 0.32 * k * k, yy]; };
    x.lineWidth = 3; x.setLineDash([8, 6]); x.strokeStyle = MAROON; x.beginPath(); for (let i = 0; i <= 40; i++) { const [a, b] = path(i / 40); i ? x.lineTo(a, b) : x.moveTo(a, b); } x.stroke(); x.setLineDash([]);
    const u = (t % 3.2) / 3.2, [bx, by] = path(u);
    x.fillStyle = MAROON_D; x.beginPath(); x.arc(bx, by, W * 0.05, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(bx - 3, by - 3, W * 0.015, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  function pocketDiagram(x, cx, cy, s, t, hand) {
    const hl = hand === 'left' ? [1, 2] : [1, 3];
    let id = 1;
    for (let row = 0; row < 4; row++) for (let col = 0; col <= row; col++) {
      const px = cx + (col - row / 2) * s, py = cy - row * s * 0.87;
      const on = hl.includes(id);
      x.fillStyle = on ? GOLD_L : WHITE; x.beginPath(); x.arc(px, py, s * 0.32, 0, Math.PI * 2); x.fill();
      x.strokeStyle = on ? MAROON : 'rgba(0,0,0,0.25)'; x.lineWidth = on ? 4 : 2; x.stroke();
      x.fillStyle = MAROON_D; x.font = `800 ${s * 0.32 | 0}px Tajawal, Tahoma, sans-serif`; x.textAlign = 'center'; x.fillText(digits(id), px, py + s * 0.11);
      id++;
    }
    // arrow toward the pocket
    const sgn = hand === 'left' ? -1 : 1, a = 0.5 + 0.5 * Math.sin(t * 3);
    const tx = cx + sgn * s * 0.26, ty = cy + s * 0.35, fx = tx + sgn * s * 0.9, fy = ty + s * 2.0 - a * s * 0.3;
    x.strokeStyle = MAROON; x.lineWidth = 6; x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(fx, ty + s * 0.6, tx, ty); x.stroke();
    x.fillStyle = MAROON; x.beginPath(); x.arc(tx, ty, 8, 0, Math.PI * 2); x.fill();
  }
  function momentumDiagram(x, X, Y, W, H, t) {
    const u = (t % 2.6) / 2.6, hit = 0.55;
    const bx = X + W * 0.1 + Math.min(u, hit) / hit * W * 0.45 + Math.max(0, u - hit) * W * 0.35, py = Y + H * 0.55;
    const pinX = X + W * 0.68 + Math.max(0, u - hit) / (1 - hit) * W * 0.25, rot = Math.max(0, u - hit) * 4;
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(X, py + H * 0.18, W, 3);
    x.save(); x.translate(pinX, py + H * 0.18); x.rotate(rot); x.fillStyle = WHITE; x.beginPath(); x.ellipse(0, -H * 0.18, H * 0.06, H * 0.18, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#b11'; x.fillRect(-H * 0.05, -H * 0.3, H * 0.1, 5); x.restore();
    x.fillStyle = MAROON_D; x.beginPath(); x.arc(bx, py + H * 0.07, H * 0.11, 0, Math.PI * 2); x.fill();
    x.font = '700 22px Tajawal, Tahoma, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#333';
    x.fillText('٦٫٤ كغ', bx, py - H * 0.1); x.fillText('١٫٥٣ كغ', pinX, py - H * 0.25);
  }

  /** A slide card: title band, body text, and an animated illustration. */
  function drawSlide(x, W, H, slide, t, fam, hand) {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fbf7f2'); g.addColorStop(1, '#efe6dc'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = MAROON; x.fillRect(0, 0, W, H * 0.2); x.fillStyle = GOLD; x.fillRect(0, H * 0.2, W, 5);
    x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = WHITE; fit(x, slide.title, W * 0.92, H * 0.11 | 0, 800, fam); x.fillText(slide.title, W * 0.96, H * 0.14);
    const textW = slide.kind === 'rule' || slide.kind === 'numbers' || slide.kind === 'motivation' ? W * 0.9 : W * 0.5;
    para(x, slide.body, W * 0.96, H * 0.36, textW, H * 0.075 | 0, H * 0.105, 700, fam, '#2a1219');
    const L = W * 0.04, top = H * 0.27, w = W * 0.38, h = H * 0.66;
    if (slide.kind === 'hook') { laneDiagram(x, L + w * 0.25, top, w * 0.5, h, t, hand); x.font = `700 ${H * 0.045 | 0}px ${fam}`; x.fillStyle = MAROON_D; x.textAlign = 'left'; x.fillText('انزلاق', L + w * 0.78, top + h * 0.85); x.fillText('انحناء', L + w * 0.78, top + h * 0.5); x.fillText('تدحرج', L + w * 0.78, top + h * 0.18); }
    else if (slide.kind === 'pocket') pocketDiagram(x, L + w * 0.5, top + h * 0.72, h * 0.2, t, hand);
    else if (slide.kind === 'momentum') momentumDiagram(x, L, top, w, h, t);
    else if (slide.kind === 'motivation') { x.fillStyle = 'rgba(138,21,56,0.08)'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(W * (0.1 + i * 0.16), H * (0.85 + 0.04 * Math.sin(t * 1.5 + i)), H * 0.06, 0, Math.PI * 2); x.fill(); } }
  }
  function drawAd(x, W, H, ad, t, fam, reduced) {
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, ad.c[0]); g.addColorStop(1, ad.c[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // moving light sweep + geometric pattern (restrained motion)
    const sweep = reduced ? 0.5 : (t * 0.25) % 1.6 - 0.3;
    const sg = x.createLinearGradient(W * sweep - W * 0.25, 0, W * sweep + W * 0.25, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.13)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = sg; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(232,207,143,0.35)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const px = W * 0.06 + i * H * 0.13; x.beginPath(); x.moveTo(px, H * 0.12); x.lineTo(px + H * 0.065, H * 0.2); x.lineTo(px + H * 0.13, H * 0.12); x.stroke(); }
    x.fillStyle = GOLD; x.fillRect(0, H - 8, W, 8);
    x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = WHITE; fit(x, ad.a, W * 0.86, H * 0.3 | 0, 800, fam); x.fillText(ad.a, W / 2, H * 0.55);
    x.fillStyle = GOLD_L; fit(x, ad.b, W * 0.86, H * 0.15 | 0, 700, fam); x.fillText(ad.b, W / 2, H * 0.8);
  }
  function drawTicker(text, fam) {
    const c = canvas(4096, 96), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#2a0611'); g.addColorStop(1, '#4d0c20'); x.fillStyle = g; x.fillRect(0, 0, 4096, 96);
    // LED dot raster
    x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4096; i += 6) x.fillRect(i, 0, 1, 96); for (let j = 0; j < 96; j += 6) x.fillRect(0, j, 4096, 1);
    x.direction = 'rtl'; x.textAlign = 'right'; x.font = `800 50px ${fam}`; x.fillStyle = GOLD_L;
    let s = text; while (x.measureText(s + text).width < 4060) s += text;
    x.fillText(s, 4090, 64);
    return c;
  }

  // ------------------------------------------------------------------ build
  function build(scene, opts = {}) {
    const V = opts.venue, Q = opts.quality || {}, fam = opts.font || 'Tajawal, Tahoma, Arial, sans-serif';
    let reduced = !!opts.reduced; const hand = opts.hand || 'right';
    const low = Q.tier === 'low';
    const group = new T.Group(); group.name = 'hall'; scene.add(group);
    const disposables = [], screens = [];
    // static pieces are baked into one merged mesh per material (few draw calls)
    const buckets = new Map(), M4 = new T.Matrix4(), Q4 = new T.Quaternion(), E4 = new T.Euler(), V4 = new T.Vector3(), ONE = new T.Vector3(1, 1, 1);
    const add = (geo, mat, x, y, z, ry = 0, rx = 0) => {
      M4.compose(V4.set(x, y, z), Q4.setFromEuler(E4.set(rx, ry, 0)), ONE); geo.applyMatrix4(M4);
      if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(geo);
    };
    const flush = () => {
      for (const [mat, list] of buckets) { const mesh = new T.Mesh(root.BowlingVenue.mergeInto(list), mat); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; group.add(mesh); disposables.push(mesh.geometry); list.forEach(g => g.dispose()); }
      buckets.clear();
    };
    const std = o => { const m = new T.MeshStandardMaterial(o); disposables.push(m); return m; };
    const H = V.halfHall, Z0 = -21, Z1 = 12.45, L = Z1 - Z0, ZC = (Z0 + Z1) / 2, ceilY = 4.99;
    const t1 = tex(slatTexture(), true, [L / 2.0, 1]), t2 = tex(fabricTexture([58, 22, 34], '#140509'), true, [L / 2.4, 3.85 / 2.4]);
    const t3 = tex(plasterTexture(), true, [1, 3]), t4 = tex(ceilingTexture(), true, [H * 2 / 2.4, L / 2.4]);
    const t5 = tex(fabricTexture([34, 30, 34], '#0c0b0d'), true, [8, 2]);
    disposables.push(t1, t2, t3, t4, t5);
    const slatMat = std({ map: t1, roughness: 0.62, metalness: 0 }), fabricMat = std({ map: t2, roughness: 0.95 }), plasterMat = std({ map: t3, color: '#a3968a', roughness: 0.85 });
    const ceilMat = std({ map: t4, roughness: 0.95 }), darkFabric = std({ map: t5, roughness: 0.95 }), goldMat = std({ color: GOLD, roughness: 0.35, metalness: 0.7 });
    const bezel = std({ color: '#0d0d10', roughness: 0.35, metalness: 0.3 }), glow = new T.MeshBasicMaterial({ color: '#fff3df' }); disposables.push(glow);
    const baseMat = std({ color: '#141416', roughness: 0.6 });

    // ---- side walls (faces inward)
    for (const sd of [-1, 1]) {
      const x = sd * (H - 0.01), ry = -sd * Math.PI / 2;
      add(new T.PlaneGeometry(L, 1.15), slatMat, x, 0.575 + 0.08, ZC, ry);
      add(new T.PlaneGeometry(L, ceilY - 1.15), fabricMat, x, 1.15 + (ceilY - 1.15) / 2, ZC, ry);
      add(new T.BoxGeometry(0.03, 0.04, L), goldMat, x - sd * 0.015, 1.17, ZC);
      add(new T.BoxGeometry(0.04, 0.12, L), baseMat, x - sd * 0.02, 0.06, ZC);           // skirting
      // plaster columns with up/down light slots
      for (let z = 10.4; z > Z0 + 1; z -= 4.6) {
        add(new T.BoxGeometry(0.22, ceilY, 0.5), plasterMat, x - sd * 0.11, ceilY / 2, z);
        add(new T.BoxGeometry(0.02, 0.5, 0.06), glow, x - sd * 0.225, 4.3, z);
        add(new T.BoxGeometry(0.02, 0.35, 0.06), glow, x - sd * 0.225, 0.45, z);
      }
    }
    // ceiling
    add(new T.PlaneGeometry(H * 2, L), ceilMat, 0, ceilY, ZC, 0, Math.PI / 2);
    // back wall above the masking units: dark slats + LED wall frame
    const backZ = V.maskZ - 0.14, maskTop = V.maskY + 1.25;
    add(new T.PlaneGeometry(H * 2, ceilY - maskTop), darkFabric, 0, maskTop + (ceilY - maskTop) / 2, backZ);
    // wall behind the spectators
    const rearMat = fabricMat.clone(); rearMat.map = t2.clone(); rearMat.map.repeat.set(H * 2 / 2.4, ceilY / 2.4); rearMat.map.needsUpdate = true; disposables.push(rearMat, rearMat.map);
    add(new T.PlaneGeometry(H * 2, ceilY), rearMat, 0, ceilY / 2, Z1 - 0.003, Math.PI);
    // exit door with an illuminated sign (left wall, near the spectators)
    {
      const x = -H + 0.02, z = 11.2;
      add(new T.BoxGeometry(0.06, 2.2, 1.15), std({ color: '#3a3d44', metalness: 0.5, roughness: 0.4 }), x, 1.1, z);
      add(new T.BoxGeometry(0.07, 2.05, 1.0), std({ color: '#6b4a2e', roughness: 0.55 }), x + 0.01, 1.03, z);
      add(new T.BoxGeometry(0.08, 0.04, 0.5), goldMat, x + 0.04, 1.05, z - 0.25);
      const c = canvas(256, 96), g = c.getContext('2d'); g.fillStyle = '#0b7a3b'; g.fillRect(0, 0, 256, 96); g.fillStyle = WHITE; g.textAlign = 'center'; g.direction = 'rtl'; g.font = `800 52px ${fam}`; g.fillText('مخرج', 150, 66); g.fillStyle = WHITE; g.beginPath(); g.moveTo(20, 48); g.lineTo(52, 22); g.lineTo(52, 36); g.lineTo(84, 36); g.lineTo(84, 60); g.lineTo(52, 60); g.lineTo(52, 74); g.closePath(); g.fill();
      const st = tex(c); disposables.push(st);
      const sm = new T.MeshBasicMaterial({ map: st, toneMapped: false }); disposables.push(sm); add(new T.PlaneGeometry(0.6, 0.22), sm, x + 0.05, 2.45, z, Math.PI / 2);
    }

    // ---- screens
    function makeScreen(w, h, cw, ch, x, y, z, ry, draw, fps, frameDepth = 0.08) {
      const c = canvas(cw, ch), ctx = c.getContext('2d'), t = tex(c, true, null, 8);
      const mat = new T.MeshBasicMaterial({ map: t, toneMapped: false }); disposables.push(t, mat);
      const holder = new T.Group(); holder.position.set(x, y, z); holder.rotation.y = ry; group.add(holder);
      const fr = new T.Mesh(new T.BoxGeometry(w + 0.12, h + 0.12, frameDepth), bezel); fr.position.z = -frameDepth / 2; holder.add(fr); disposables.push(fr.geometry);
      const sc = new T.Mesh(new T.PlaneGeometry(w, h), mat); sc.position.z = 0.003; holder.add(sc); disposables.push(sc.geometry);
      const s = { ctx, tex: t, draw, fps, acc: 1e9, time: Math.random() * 10, w: cw, h: ch, holder, dirty: true };
      screens.push(s); return s;
    }
    const info = { title: '', round: 0, total: 0, points: 0, lastPins: null, correct: 0 };

    // LED video wall above the lanes: [diagram | slides | live progress]
    const ledW = Math.min(V.maskW - 0.6, 9.6), ledH = ledW / 4.6;
    const led = makeScreen(ledW, ledH, 2048, Math.round(2048 / 4.6), 0, maskTop + 0.25 + ledH / 2, backZ + 0.05, 0, (x, W, Hh, t) => {
      x.fillStyle = '#0b0507'; x.fillRect(0, 0, W, Hh);
      const third = W / 3.6, pad = 14;
      // right zone (RTL start): live progress of this student
      const rx = W - third, g = x.createLinearGradient(rx, 0, W, Hh); g.addColorStop(0, MAROON); g.addColorStop(1, MAROON_D); x.fillStyle = g; x.fillRect(rx + pad, pad, third - 2 * pad, Hh - 2 * pad);
      x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = GOLD_L; fit(x, opts.schoolName, third - 60, 30, 700, fam); x.fillText(opts.schoolName, W - 30, 62);
      x.fillStyle = WHITE; const ttl = info.title || 'تحدّي البولينج'; fit(x, ttl, third - 60, 40, 800, fam); x.fillText(ttl, W - 30, 116);
      const cells = [['الرمية', info.total ? digits(Math.min(info.round + 1, info.total)) + ' / ' + digits(info.total) : '—'], ['نقاط اللعب', digits(info.points)], ['آخر رمية', info.lastPins == null ? '—' : digits(info.lastPins) + ' / ١٠']];
      cells.forEach(([k, v], i) => { const cy = 170 + i * 82; x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(rx + 34, cy - 44, third - 68, 70); x.textAlign = 'right'; x.fillStyle = GOLD_L; x.font = `700 28px ${fam}`; x.fillText(k, W - 50, cy); x.textAlign = 'left'; x.fillStyle = WHITE; x.font = `800 44px ${fam}`; x.fillText(v, rx + 52, cy + 6); });
      // left zone: animated ball-path diagram
      const lx = pad, lw = third - 2 * pad; x.fillStyle = '#f3ece3'; x.fillRect(lx, pad, lw, Hh - 2 * pad);
      laneDiagram(x, lx + lw * 0.3, pad + 40, lw * 0.4, Hh - 2 * pad - 60, reduced ? 1.6 : t, hand);
      x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = MAROON_D; x.font = `800 30px ${fam}`; x.fillText('مسار الكرة', lx + lw / 2, pad + 30);
      x.font = `700 24px ${fam}`; x.textAlign = 'right'; x.fillText('تدحرج', lx + lw * 0.27, pad + 90); x.fillText('انحناء', lx + lw * 0.27, pad + Hh * 0.45); x.fillText('انزلاق', lx + lw * 0.27, Hh - pad - 40);
      // centre: rotating slides with a horizontal wipe
      const cx0 = third + pad, cw = W - 2 * third - 2 * pad, per = 9, idx = Math.floor(t / per), u = (t % per) / per;
      const a = SLIDES[idx % SLIDES.length], b = SLIDES[(idx + 1) % SLIDES.length];
      const c = led.sub || (led.sub = canvas(cw | 0, (Hh - 2 * pad) | 0)), sx = c.getContext('2d');
      drawSlide(sx, c.width, c.height, a, reduced ? 1.6 : t, fam, hand); x.drawImage(c, cx0, pad);
      if (u > 0.92 && !reduced) { const k = smooth((u - 0.92) / 0.08); drawSlide(sx, c.width, c.height, b, t, fam, hand); x.save(); x.beginPath(); x.rect(cx0 + cw * (1 - k), pad, cw * k, Hh - 2 * pad); x.clip(); x.drawImage(c, cx0, pad); x.restore(); }
      // LED pixel raster
      x.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < W; i += 4) x.fillRect(i, 0, 1, Hh); for (let j = 0; j < Hh; j += 4) x.fillRect(0, j, W, 1);
    }, low ? 6 : 12);

    // side-wall screens (education) and lightboxes (promotions)
    const bays = low ? [[-1, -1.5, 'slide', 0], [1, -6.1, 'ad', 0], [1, 3.1, 'slide', 2]] : [[-1, -1.5, 'slide', 0], [1, -1.5, 'slide', 3], [-1, -10.7, 'slide', 1], [1, -10.7, 'slide', 4], [-1, 3.1, 'ad', 0], [1, 3.1, 'ad', 1], [-1, -6.1, 'ad', 2], [1, -6.1, 'ad', 3], [1, 7.7, 'slide', 5], [-1, -15.3, 'ad', 1], [1, -15.3, 'ad', 2]];
    for (const [sd, z, kind, k] of bays) {
      const x = sd * (H - 0.06), ry = -sd * Math.PI / 2;
      if (kind === 'slide') {
        makeScreen(2.6, 1.46, 1024, 576, x, 2.55, z, ry, (ctx, W, Hh, t) => {
          const per = 8, idx = Math.floor(t / per) + k, u = (t % per) / per;
          drawSlide(ctx, W, Hh, SLIDES[idx % SLIDES.length], t, fam, hand);
          if (u > 0.94 && !reduced) { ctx.fillStyle = `rgba(0,0,0,${Math.sin(Math.PI * (u - 0.94) / 0.06)})`; ctx.fillRect(0, 0, W, Hh); }
        }, low ? 2 : 6, 0.06);
      } else {
        makeScreen(2.6, 1.0, 1024, 394, x, 2.4, z, ry, (ctx, W, Hh, t) => {
          const per = 10, idx = Math.floor((t + k * 3) / per) + k;
          drawAd(ctx, W, Hh, ADS[idx % ADS.length], t, fam, reduced);
        }, low ? 2 : 8, 0.14);
      }
    }
    // rear wall: two promotion lightboxes either side of the existing banner
    if (!low) for (const [x, k] of [[-H * 0.62, 0], [H * 0.62, 3]]) makeScreen(2.4, 0.95, 1024, 405, x, 2.35, Z1 - 0.2, Math.PI, (ctx, W, Hh, t) => drawAd(ctx, W, Hh, ADS[(Math.floor(t / 11) + k) % ADS.length], t, fam, reduced), 4, 0.12);

    // scrolling LED tickers along both side walls (texture offset only: no redraw)
    const tickC = drawTicker(TICKER + opts.schoolName + ' ✦ ' + opts.platformName + ' ', fam), tickT = tex(tickC, true, [Math.max(1, L / 14), 1]);
    tickT.wrapS = T.RepeatWrapping; disposables.push(tickT);
    const tickMat = new T.MeshBasicMaterial({ map: tickT, toneMapped: false }); disposables.push(tickMat);
    for (const sd of [-1, 1]) {
      add(new T.PlaneGeometry(L - 0.6, 0.32), tickMat, sd * (H - 0.05), 3.95, ZC, -sd * Math.PI / 2);
      add(new T.BoxGeometry(0.06, 0.4, L - 0.5), bezel, sd * (H - 0.02), 3.95, ZC);
    }

    function update(dt) {
      if (!reduced) tickT.offset.x -= dt * 0.035;                   // Arabic ticker moves left-to-right on screen
      for (const s of screens) {
        s.time += dt; s.acc += dt;
        if (s.acc < 1 / s.fps && !s.dirty) continue;
        s.acc = 0; s.dirty = false;
        s.ctx.save(); s.draw(s.ctx, s.w, s.h, s.time); s.ctx.restore();
        s.tex.needsUpdate = true;
      }
    }
    function setInfo(d) { Object.assign(info, d); led.dirty = true; }
    function dispose() { disposables.forEach(d => { try { d.dispose(); } catch (e) { } }); scene.remove(group); }
    flush();
    update(0);
    return { group, update, setInfo, setReduced(v) { reduced = !!v; screens.forEach(s => { s.dirty = true; }); }, dispose, screens };
  }

  root.BowlingHall = { build, SLIDES, ADS };
})(typeof window !== 'undefined' ? window : globalThis);
