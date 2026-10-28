/* عدّاء قطر — original procedural 3D props (vehicles, street furniture, palms, souq pieces, obstacles, dhows).
 * Every model is generated from code; nothing is copied from any other game.
 * Each builder returns parts [{ geo, mat, name }] in a shared local frame so they can be instanced or grouped.
 */
(function (root) {
  'use strict';
  const T = root.THREE, X = root.QRTex;
  const M = {}; // shared materials, created lazily
  const C = h => new T.Color(h).convertSRGBToLinear();
  function mat(name, f) { return M[name] || (M[name] = f()); }
  const std = (o) => new T.MeshStandardMaterial(o);

  function merge(geos) { // minimal BufferGeometry merge (position/normal/uv/color, indexed)
    const out = new T.BufferGeometry(); const attrs = ['position', 'normal', 'uv', 'color']; const data = {}; attrs.forEach(a => data[a] = []); const idx = []; let base = 0;
    const hasColor = geos.some(g => g.attributes.color);
    for (let g of geos) {
      if (!g.index) { const n = g.attributes.position.count, ii = []; for (let i = 0; i < n; i++) ii.push(i); g.setIndex(ii); }
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.position.count;
      for (const a of attrs) { const at = g.attributes[a]; if (a === 'color' && !hasColor) continue; if (at) for (let i = 0; i < n * at.itemSize; i++) data[a].push(at.array[i]); else { const sz = a === 'uv' ? 2 : 3; for (let i = 0; i < n * sz; i++) data[a].push(a === 'color' ? 1 : 0); } }
      for (let i = 0; i < g.index.count; i++) idx.push(g.index.array[i] + base); base += n;
    }
    out.setAttribute('position', new T.Float32BufferAttribute(data.position, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(data.normal, 3)); out.setAttribute('uv', new T.Float32BufferAttribute(data.uv, 2));
    if (hasColor) out.setAttribute('color', new T.Float32BufferAttribute(data.color, 3));
    out.setIndex(idx); out.computeBoundingSphere(); return out;
  }
  const tr = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = null) => { const m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), s ? new T.Vector3(...s) : new T.Vector3(1, 1, 1)); g.applyMatrix4(m); return g; };
  const colorize = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };

  // ------------------------------------------------------------------ vehicles
  function car(kind = 'suv') { // faces +Z, length along Z, width X, ground at y = 0
    const L = kind === 'sedan' ? 4.7 : 4.95, W = kind === 'sedan' ? 1.78 : 1.95, H = kind === 'sedan' ? 1.45 : 1.88;
    const belt = kind === 'sedan' ? 0.88 : 1.08, clr = 0.2;
    const side = new T.Shape(); // lower body silhouette (z along x-axis of the shape)
    const z0 = -L / 2, z1 = L / 2;
    side.moveTo(z0 + 0.1, clr); side.lineTo(z1 - 0.18, clr); side.quadraticCurveTo(z1, clr, z1, clr + 0.25); side.lineTo(z1 - 0.06, belt - 0.12); side.quadraticCurveTo(z1 - 0.12, belt, z1 - 0.45, belt);
    side.lineTo(z0 + 0.18, belt); side.quadraticCurveTo(z0, belt, z0, belt - 0.2); side.lineTo(z0, clr + 0.2); side.quadraticCurveTo(z0, clr, z0 + 0.1, clr);
    const ew = (shape, depth, bevel) => { const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 3, curveSegments: 8 }); g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2); return g; };
    const body = ew(side, W - 0.16, 0.08);
    // wheel arches: dark inner boxes
    const cab = new T.Shape(); const cf = kind === 'sedan' ? 0.95 : 0.55, cr = kind === 'sedan' ? -1.15 : -L / 2 + 0.25;
    cab.moveTo(cr, belt); cab.lineTo(z1 - cf - 0.1, belt); cab.lineTo(z1 - cf - 0.75, H - 0.04); cab.lineTo(cr + (kind === 'sedan' ? 0.55 : 0.12), H - 0.04); cab.lineTo(cr, belt);
    const glass = ew(cab, W - 0.42, 0.02);
    const roof = new T.Shape(); roof.moveTo(z1 - cf - 0.8, H - 0.06); roof.lineTo(cr + (kind === 'sedan' ? 0.5 : 0.08), H - 0.06); roof.lineTo(cr + (kind === 'sedan' ? 0.5 : 0.08), H); roof.lineTo(z1 - cf - 0.8, H); roof.lineTo(z1 - cf - 0.8, H - 0.06);
    const roofG = ew(roof, W - 0.36, 0.03);
    const pillars = [];
    for (const s of [-1, 1]) {
      const bp = new T.BoxGeometry(0.06, H - belt, 0.12); tr(bp, s * (W / 2 - 0.2), (H + belt) / 2, 0.1 + (kind === 'sedan' ? -0.2 : 0)); pillars.push(bp);
      const ap = new T.BoxGeometry(0.06, 0.07, 0.95); tr(ap, s * (W / 2 - 0.23), (H + belt) / 2 + 0.05, z1 - cf - 0.45, -Math.atan2(H - belt, 0.65)); pillars.push(ap);
      if (kind !== 'sedan') { const rr = new T.BoxGeometry(0.05, 0.05, L * 0.62); tr(rr, s * (W / 2 - 0.25), H + 0.04, -0.2); pillars.push(rr); }
    }
    const bodyG = merge([body, roofG, ...pillars]);
    const parts = [{ name: 'body', geo: bodyG, mat: mat('carPaint', () => std({ color: 0xffffff, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.2, name: 'car-paint' })) },
      { name: 'glass', geo: glass, mat: mat('carGlass', () => std({ color: C('#141b22'), roughness: 0.06, metalness: 0.9, envMapIntensity: 1.4, name: 'car-glass' })) }];
    const tires = [], rims = [];
    for (const zz of [z1 - 0.85, z0 + 0.9]) for (const s of [-1, 1]) {
      const t = new T.CylinderGeometry(0.38, 0.38, 0.27, 20); t.rotateZ(Math.PI / 2); tr(t, s * (W / 2 - 0.1), 0.38, zz); tires.push(t);
      const r = new T.CylinderGeometry(0.24, 0.24, 0.28, 12); r.rotateZ(Math.PI / 2); tr(r, s * (W / 2 - 0.08), 0.38, zz); rims.push(r);
    }
    parts.push({ name: 'tire', geo: merge(tires), mat: mat('tire', () => std({ color: C('#151515'), roughness: 0.9 })) }, { name: 'rim', geo: merge(rims), mat: mat('rim', () => std({ color: C('#b9bec4'), roughness: 0.3, metalness: 0.9 })) });
    const head = [], tail = [], grille = [];
    for (const s of [-1, 1]) { const h = new T.BoxGeometry(0.36, 0.13, 0.05); tr(h, s * (W / 2 - 0.3), belt - 0.25, z1 + 0.04); head.push(h); const t = new T.BoxGeometry(0.32, 0.16, 0.05); tr(t, s * (W / 2 - 0.28), belt - 0.2, z0 - 0.04); tail.push(t); }
    const gr = new T.BoxGeometry(W * 0.48, 0.22, 0.04); tr(gr, 0, belt - 0.32, z1 + 0.05); grille.push(gr); const bp = new T.BoxGeometry(W - 0.2, 0.12, 0.08); tr(bp, 0, clr + 0.12, z1 + 0.04); grille.push(bp); const bpr = new T.BoxGeometry(W - 0.2, 0.12, 0.08); tr(bpr, 0, clr + 0.12, z0 - 0.04); grille.push(bpr);
    parts.push({ name: 'head', geo: merge(head), mat: mat('headL', () => std({ color: 0xffffff, emissive: C('#fff6e0'), emissiveIntensity: 0.4, roughness: 0.2 })) },
      { name: 'tail', geo: merge(tail), mat: mat('tailL', () => std({ color: C('#7a0d10'), emissive: C('#ff2a20'), emissiveIntensity: 0.5, roughness: 0.3 })) },
      { name: 'trim', geo: merge(grille), mat: mat('trim', () => std({ color: C('#1d1f22'), roughness: 0.5, metalness: 0.4 })) });
    return { parts, size: [W + 0.1, H + 0.05, L + 0.1] };
  }
  function van() { // delivery truck: cab + cargo box
    const parts = [], W = 2.15, L = 6.2;
    const cargo = new T.BoxGeometry(W, 2.35, 4.3); tr(cargo, 0, 0.5 + 1.175 + 0.15, -0.85);
    const cab = new T.BoxGeometry(W - 0.05, 1.55, 1.75); tr(cab, 0, 0.55 + 0.78, 2.15);
    const hood = new T.BoxGeometry(W - 0.1, 0.55, 0.45); tr(hood, 0, 0.82, 3.0);
    parts.push({ name: 'body', geo: merge([cab, hood]), mat: mat('carPaint', () => std({ color: 0xffffff, roughness: 0.32, metalness: 0.55 })) });
    parts.push({ name: 'cargo', geo: cargo, mat: mat('vanCargo', () => { const [t] = [X.sign('توصيل سريع', { w: 512, h: 256, bg: '#f3f1ea', fg: '#8a1538', size: 72, border: '#f3f1ea' })]; return std({ map: t, roughness: 0.6 }); }) });
    const gl = new T.BoxGeometry(W - 0.02, 0.6, 0.9); tr(gl, 0, 1.75, 2.55); parts.push({ name: 'glass', geo: gl, mat: mat('carGlass', () => std({ color: C('#141b22'), roughness: 0.06, metalness: 0.9 })) });
    const tires = []; for (const zz of [2.4, -0.4, -2.0]) for (const s of [-1, 1]) { const t = new T.CylinderGeometry(0.45, 0.45, 0.3, 18); t.rotateZ(Math.PI / 2); tr(t, s * (W / 2 - 0.12), 0.45, zz); tires.push(t); }
    parts.push({ name: 'tire', geo: merge(tires), mat: mat('tire', () => std({ color: C('#151515'), roughness: 0.9 })) });
    return { parts, size: [W + 0.1, 3.0, L] };
  }
  // ------------------------------------------------------------------ obstacles
  function cone() {
    const prof = [[0, 0], [0.2, 0], [0.19, 0.04], [0.06, 0.72], [0.035, 0.75], [0, 0.75]].map(p => new T.Vector2(p[0], p[1]));
    const g = new T.LatheGeometry(prof, 18); const n = g.attributes.position.count, col = new Float32Array(n * 3), o = C('#ff5a12'), w = C('#f6f6f6');
    for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i); const c = (y > 0.36 && y < 0.46) || (y > 0.55 && y < 0.62) ? w : o; col.set([c.r, c.g, c.b], i * 3); } g.setAttribute('color', new T.BufferAttribute(col, 3));
    const base = colorize(tr(new T.BoxGeometry(0.46, 0.05, 0.46), 0, 0.025, 0), C('#1b1b1b'));
    return { parts: [{ name: 'cone', geo: merge([g, base]), mat: mat('vcol', () => std({ vertexColors: true, roughness: 0.55 })) }], size: [0.46, 0.75, 0.46] };
  }
  function jersey() { // water-filled plastic barrier, one lane wide (along X)
    const s = new T.Shape(); s.moveTo(-0.32, 0); s.lineTo(0.32, 0); s.lineTo(0.3, 0.15); s.lineTo(0.14, 0.32); s.lineTo(0.12, 0.86); s.quadraticCurveTo(0, 0.95, -0.12, 0.86); s.lineTo(-0.14, 0.32); s.lineTo(-0.3, 0.15); s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2);
    const a = colorize(tr(g.clone(), -0.52, 0, 0), C('#d81f26')), b = colorize(tr(g, 0.52, 0, 0), C('#f2f2f0'));
    return { parts: [{ name: 'jersey', geo: merge([a, b]), mat: mat('vcolGloss', () => std({ vertexColors: true, roughness: 0.38 })) }], size: [2.12, 0.95, 0.68] };
  }
  function stripes(a = '#d81f26', b = '#ffffff', diag = true) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = b; x.fillRect(0, 0, 256, 64); x.fillStyle = a; for (let i = -64; i < 256; i += 48) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 24, 64); x.lineTo(i + (diag ? 88 : 24), 0); x.lineTo(i + (diag ? 64 : 0), 0); x.closePath(); x.fill(); } const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; }
  function hurdle() { // construction barricade: striped boards on A-frame legs (jump)
    const legs = []; for (const s of [-1, 1]) for (const k of [-1, 1]) { const l = new T.BoxGeometry(0.06, 1.1, 0.06); tr(l, s * 1.0, 0.52, k * 0.18, k * 0.18); legs.push(l); }
    const foot = []; for (const s of [-1, 1]) { const f = new T.BoxGeometry(0.1, 0.06, 0.6); tr(f, s * 1.0, 0.03, 0); foot.push(f); }
    const board = new T.BoxGeometry(2.1, 0.26, 0.04); tr(board, 0, 0.86, 0.02); const board2 = new T.BoxGeometry(2.1, 0.2, 0.04); tr(board2, 0, 0.5, 0.02);
    const lamp = new T.SphereGeometry(0.06, 10, 8); tr(lamp, 0.9, 1.04, 0.02);
    return { parts: [{ name: 'legs', geo: merge([...legs, ...foot]), mat: mat('metalW', () => std({ color: C('#e9e9e6'), roughness: 0.5, metalness: 0.3 })) },
      { name: 'board', geo: merge([board, board2]), mat: mat('stripeRW', () => std({ map: stripes(), roughness: 0.5 })) },
      { name: 'lamp', geo: lamp, mat: mat('amberL', () => std({ color: C('#ffb020'), emissive: C('#ff9a00'), emissiveIntensity: 1.2 })) }], size: [2.12, 1.0, 0.5] };
  }
  function beam() { // overhead scaffold bar with a hanging banner: slide under (bar spans one lane)
    const posts = []; for (const s of [-1, 1]) { const p = new T.BoxGeometry(0.1, 2.3, 0.1); tr(p, s * 1.2, 1.15, 0); posts.push(p); const f = new T.BoxGeometry(0.4, 0.05, 0.4); tr(f, s * 1.2, 0.03, 0); posts.push(f); }
    const bar = new T.BoxGeometry(2.5, 0.22, 0.2); tr(bar, 0, 1.36, 0);
    const banner = new T.PlaneGeometry(2.1, 0.62); tr(banner, 0, 1.72, 0.06);
    return { parts: [{ name: 'posts', geo: merge(posts), mat: mat('scaff', () => std({ color: C('#9aa1a8'), roughness: 0.4, metalness: 0.7 })) },
      { name: 'bar', geo: bar, mat: mat('stripeYB', () => std({ map: stripes('#111111', '#f6c400'), roughness: 0.5 })) },
      { name: 'banner', geo: banner, mat: mat('bannerW', () => std({ map: X.sign('انخفض ↓', { w: 512, h: 150, bg: '#f6c400', fg: '#111', size: 74, border: '#111' }), roughness: 0.7, side: T.DoubleSide })) }], size: [2.5, 0.24, 0.24], yMin: 1.18 };
  }
  // ------------------------------------------------------------------ souq obstacles
  function cart() { // wooden market cart with spice baskets (dodge)
    const wood = mat('wood', () => std({ color: C('#7b5434'), roughness: 0.8 }));
    const bed = new T.BoxGeometry(1.7, 0.18, 2.4); tr(bed, 0, 0.82, 0); const sides = []; for (const s of [-1, 1]) { const sd = new T.BoxGeometry(0.06, 0.32, 2.4); tr(sd, s * 0.85, 1.05, 0); sides.push(sd); const h = new T.BoxGeometry(0.07, 0.07, 1.2); tr(h, s * 0.5, 0.8, 1.7, 0.25); sides.push(h); }
    const wheels = []; for (const s of [-1, 1]) { const w = new T.TorusGeometry(0.42, 0.06, 6, 18); w.rotateY(Math.PI / 2); tr(w, s * 0.92, 0.45, -0.2); wheels.push(w); for (let k = 0; k < 4; k++) { const sp = new T.BoxGeometry(0.03, 0.82, 0.04); tr(sp, s * 0.92, 0.45, -0.2, k * Math.PI / 4); wheels.push(sp); } }
    const leg = new T.BoxGeometry(0.08, 0.8, 0.08); tr(leg, 0, 0.4, 1.0);
    const baskets = []; const cols = ['#c8641e', '#d9a520', '#9b2d1c', '#6f8a2c', '#b5452a', '#e0c070'];
    for (let i = 0; i < 6; i++) { const b = new T.CylinderGeometry(0.28, 0.22, 0.22, 14); tr(b, (i % 2 - 0.5) * 0.75, 1.02, -0.8 + Math.floor(i / 2) * 0.8); colorize(b, C('#8a6a40')); baskets.push(b); const sp = new T.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); sp.scale(1, 0.55, 1); tr(sp, (i % 2 - 0.5) * 0.75, 1.13, -0.8 + Math.floor(i / 2) * 0.8); colorize(sp, C(cols[i])); baskets.push(sp); }
    const canopyPoles = []; for (const s of [-1, 1]) for (const k of [-1, 1]) { const p = new T.CylinderGeometry(0.025, 0.025, 1.1, 6); tr(p, s * 0.8, 1.45, k * 1.1); canopyPoles.push(p); }
    const canopy = new T.BoxGeometry(1.9, 0.05, 2.6); tr(canopy, 0, 2.02, 0, 0, 0, 0.05);
    return { parts: [{ name: 'wood', geo: merge([bed, ...sides, leg, ...canopyPoles]), mat: wood }, { name: 'wheels', geo: merge(wheels), mat: mat('woodDark', () => std({ color: C('#4a3220'), roughness: 0.85 })) },
      { name: 'goods', geo: merge(baskets), mat: mat('vcol', () => std({ vertexColors: true, roughness: 0.55 })) },
      { name: 'canopy', geo: canopy, mat: mat('canvasStripe', () => std({ map: stripes('#8a1538', '#efe6d4', false), roughness: 0.85, side: T.DoubleSide })) }], size: [1.95, 2.1, 2.7] };
  }
  function crates() { // stacked wooden crates with dates/oranges (jump)
    const g = []; const wood = C('#a8814f');
    for (const [x, y, z, r] of [[-0.55, 0.25, 0, 0.05], [0.0, 0.25, 0.05, -0.03], [0.55, 0.25, -0.03, 0.08], [-0.25, 0.73, 0, 0.12], [0.3, 0.73, 0.02, -0.06]]) { const b = new T.BoxGeometry(0.52, 0.46, 0.5); tr(b, x, y, z, 0, r); colorize(b, wood); g.push(b); }
    for (const [x, y, c] of [[-0.25, 0.98, '#e07a1a'], [0.3, 0.98, '#5a2a14']]) { const fr = new T.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); fr.scale(1.1, 0.4, 1); tr(fr, x, y, 0); colorize(fr, C(c)); g.push(fr); }
    return { parts: [{ name: 'crates', geo: merge(g), mat: mat('vcol', () => std({ vertexColors: true, roughness: 0.55 })) }], size: [1.7, 1.05, 0.6] };
  }
  function carpetBanner() { // hanging carpet between two poles (slide under)
    const posts = []; for (const s of [-1, 1]) { const p = new T.CylinderGeometry(0.05, 0.06, 2.6, 8); tr(p, s * 1.2, 1.3, 0); posts.push(p); }
    const rod = new T.CylinderGeometry(0.04, 0.04, 2.5, 8); rod.rotateZ(Math.PI / 2); tr(rod, 0, 2.5, 0); posts.push(rod);
    const rug = new T.PlaneGeometry(2.2, 1.2, 6, 4); tr(rug, 0, 1.88, 0);
    return { parts: [{ name: 'posts', geo: merge(posts), mat: mat('woodDark', () => std({ color: C('#4a3220'), roughness: 0.85 })) },
      { name: 'rug', geo: rug, mat: mat('rug', () => std({ map: rugTexture(), roughness: 0.9, side: T.DoubleSide })) }], size: [2.4, 1.2, 0.2], yMin: 1.26 };
  }
  function rugTexture() { const c = document.createElement('canvas'); c.width = 256; c.height = 140; const x = c.getContext('2d'); x.fillStyle = '#8f1d1d'; x.fillRect(0, 0, 256, 140); x.strokeStyle = '#e8c070'; x.lineWidth = 6; x.strokeRect(8, 8, 240, 124); x.fillStyle = '#1e2a5a'; x.fillRect(20, 20, 216, 100); x.fillStyle = '#e8c070'; for (let i = 0; i < 5; i++) { x.beginPath(); const cx = 46 + i * 41, cy = 70; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, r = k % 2 ? 9 : 18; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.fill(); } x.fillStyle = '#c53b2b'; for (let i = 0; i < 12; i++) x.fillRect(24 + i * 18, 24, 8, 8); for (let i = 0; i < 12; i++) x.fillRect(24 + i * 18, 108, 8, 8); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }
  // ------------------------------------------------------------------ street furniture & nature
  function palm(h = 7.5) { // trunk (+ white-painted base, as along the Corniche) and a crown of fronds
    const tg = new T.CylinderGeometry(0.17, 0.25, h, 8, 10, true); tg.translate(0, h / 2, 0);
    const p = tg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / h; const ring = 1 + 0.06 * Math.max(0, Math.sin(y * 9.5)); p.setX(i, p.getX(i) * ring + 0.35 * t * t); p.setZ(i, p.getZ(i) * ring); }
    const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * h / 1.2); tg.computeVertexNormals();
    const base = new T.CylinderGeometry(0.265, 0.27, 1.25, 8, 1, true); base.translate(0, 0.62, 0);
    const fr = []; const top = new T.Vector3(0.35, h, 0);
    for (let f = 0; f < 22; f++) {
      const L = 3.1 + ((f * 37) % 7) / 10, wd = 1.28, segs = 7, a = f / 22 * Math.PI * 2 + (f % 3) * 0.13, pitch = f % 3 === 0 ? 0.75 : f % 3 === 1 ? 0.28 : -0.3, droop = 0.1 + (f % 4) * 0.03;
      const g = new T.PlaneGeometry(wd, L, 2, segs); const pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const u = pp.getX(i) / wd, v = pp.getY(i) / L + 0.5, d = v * L;
        const fwd = d * Math.cos(pitch), up = d * Math.sin(pitch) - droop * d * d, w = u * wd * Math.sin(Math.PI * Math.min(1, v * 1.1 + 0.1)), fold = -Math.abs(u) * 0.22;
        const x = Math.cos(a) * fwd - Math.sin(a) * w, z = Math.sin(a) * fwd + Math.cos(a) * w;
        pp.setXYZ(i, top.x + x, top.y + up + fold, top.z + z);
      }
      g.computeVertexNormals(); fr.push(g);
    }
    const crown = new T.SphereGeometry(0.34, 7, 5); crown.scale(1, 1.3, 1); tr(crown, top.x, h - 0.15, 0);
    const dates = []; for (let k = 0; k < 4; k++) { const d = new T.SphereGeometry(0.1, 4, 3); d.scale(1, 1.6, 1); tr(d, top.x + Math.cos(k * 1.3) * 0.3, h - 0.42, Math.sin(k * 1.3) * 0.3); dates.push(d); }
    return { parts: [{ name: 'trunk', geo: tg, mat: mat('bark', () => std({ map: X.bark(), roughness: 0.95, side: T.DoubleSide })) },
      { name: 'base', geo: base, mat: mat('whitePaint', () => std({ color: C('#f4f4f0'), roughness: 0.6 })) },
      { name: 'crown', geo: merge([crown, ...dates]), mat: mat('crown', () => std({ color: C('#5b4628'), roughness: 0.9 })) },
      { name: 'fronds', geo: merge(fr), mat: mat('frond', () => std({ map: X.frond(), alphaTest: 0.42, side: T.DoubleSide, roughness: 0.7, color: C('#c4d4b0') })), sway: true }], size: [1, h, 1] };
  }
  function lamp(arms = 2) { // tall Corniche street light: slim pole, curved arms, lantern heads
    const H = 9.0, pole = new T.CylinderGeometry(0.07, 0.13, H, 10); pole.translate(0, H / 2, 0);
    const parts = [pole], heads = [];
    for (let k = 0; k < arms; k++) {
      const s = arms === 1 ? 1 : k ? 1 : -1;
      const curve = new T.CubicBezierCurve3(new T.Vector3(0, H - 1.2, 0), new T.Vector3(0, H - 0.2, 0), new T.Vector3(s * 0.6, H + 0.1, 0), new T.Vector3(s * 1.6, H - 0.1, 0));
      parts.push(new T.TubeGeometry(curve, 12, 0.045, 6)); const hd = new T.BoxGeometry(0.6, 0.12, 0.28); tr(hd, s * 1.75, H - 0.16, 0); parts.push(hd);
      const glass = new T.BoxGeometry(0.5, 0.04, 0.22); tr(glass, s * 1.75, H - 0.235, 0); heads.push(glass);
    }
    const ring = new T.TorusGeometry(0.14, 0.03, 6, 12); ring.rotateX(Math.PI / 2); tr(ring, 0, 3.2, 0); parts.push(ring);
    return { parts: [{ name: 'pole', geo: merge(parts), mat: mat('lampMetal', () => std({ color: C('#d8dbdc'), roughness: 0.35, metalness: 0.75 })) },
      { name: 'light', geo: merge(heads), mat: mat('lampGlow', () => std({ color: C('#fff8e6'), emissive: C('#ffe0a8'), emissiveIntensity: 0.2, roughness: 0.3 })), glow: true }], size: [3.5, H, 0.3] };
  }
  function flagBanner() { // vertical Qatar flag banner on a lamp post (waves in the shader)
    const g = new T.PlaneGeometry(1.1, 2.0, 8, 8); g.rotateY(Math.PI / 2); tr(g, 0, 5.6, 0.62);
    const arm = new T.CylinderGeometry(0.02, 0.02, 1.2, 6); arm.rotateX(Math.PI / 2); tr(arm, 0, 6.6, 0.62);
    const ft = X.qatarFlag(); ft.center.set(0.5, 0.5); ft.rotation = Math.PI / 2;
    return { parts: [{ name: 'flag', geo: g, mat: mat('flag', () => std({ map: ft, side: T.DoubleSide, roughness: 0.8 })), wave: true }, { name: 'arm', geo: arm, mat: mat('lampMetal', () => std({ color: C('#d8dbdc'), roughness: 0.35, metalness: 0.75 })) }], size: [0.2, 2, 1.2] };
  }
  function shrub() { const g = new T.IcosahedronGeometry(0.75, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new T.Vector3().fromBufferAttribute(p, i); const k = 1 + 0.18 * Math.sin(v.x * 6) * Math.cos(v.z * 5) + 0.1 * Math.sin(v.y * 9); v.multiplyScalar(k); v.y = Math.max(-0.1, v.y * 0.7); p.setXYZ(i, v.x, v.y + 0.45, v.z); } g.computeVertexNormals(); return { parts: [{ name: 'shrub', geo: g, mat: mat('shrub', () => std({ color: C('#4c7a35'), roughness: 0.9, flatShading: true })) }] }; }
  function bench() { const s = []; const seat = new T.BoxGeometry(1.8, 0.06, 0.5); tr(seat, 0, 0.45, 0); s.push(seat); const back = new T.BoxGeometry(1.8, 0.4, 0.05); tr(back, 0, 0.75, -0.24, -0.15); s.push(back); const legs = []; for (const k of [-1, 1]) { const l = new T.BoxGeometry(0.06, 0.45, 0.45); tr(l, k * 0.8, 0.22, 0); legs.push(l); } return { parts: [{ name: 'wood', geo: merge(s), mat: mat('woodLight', () => std({ color: C('#a9784a'), roughness: 0.7 })) }, { name: 'legs', geo: merge(legs), mat: mat('lampMetal', () => std({ color: C('#d8dbdc'), roughness: 0.35, metalness: 0.75 })) }] }; }
  function railPost() { const p = new T.BoxGeometry(0.07, 1.05, 0.07); tr(p, 0, 0.52, 0); return { parts: [{ name: 'post', geo: p, mat: mat('railWhite', () => std({ color: C('#f2f2ef'), roughness: 0.4, metalness: 0.3 })) }] }; }
  function umbrella() { // café parasol + table + two chairs
    const cone = new T.ConeGeometry(1.5, 0.55, 4, 1, true); cone.rotateY(Math.PI / 4); tr(cone, 0, 2.55, 0); const pole = new T.CylinderGeometry(0.03, 0.03, 2.5, 6); tr(pole, 0, 1.25, 0);
    const top = new T.CylinderGeometry(0.4, 0.4, 0.04, 16); tr(top, 0, 0.74, 0); const leg = new T.CylinderGeometry(0.04, 0.12, 0.74, 8); tr(leg, 0, 0.37, 0);
    const chairs = []; for (const s of [-1, 1]) { const st = new T.BoxGeometry(0.42, 0.05, 0.42); tr(st, s * 0.72, 0.45, 0); chairs.push(st); const bk = new T.BoxGeometry(0.42, 0.45, 0.04); tr(bk, s * 0.92, 0.7, 0, 0, Math.PI / 2); chairs.push(bk); for (const k of [-1, 1]) for (const j of [-1, 1]) { const l = new T.BoxGeometry(0.03, 0.45, 0.03); tr(l, s * 0.72 + k * 0.18, 0.22, j * 0.18); chairs.push(l); } }
    return { parts: [{ name: 'canopy', geo: cone, mat: mat('parasol', () => std({ color: C('#e9dcc2'), roughness: 0.9, side: T.DoubleSide })) }, { name: 'frame', geo: merge([pole, top, leg]), mat: mat('lampMetal', () => std({ color: C('#d8dbdc'), roughness: 0.35, metalness: 0.75 })) }, { name: 'chairs', geo: merge(chairs), mat: mat('chairDark', () => std({ color: C('#2b2b2e'), roughness: 0.5, metalness: 0.4 })) }] };
  }
  function lantern() { // brass lantern hanging from a short chain
    const frame = []; const cap = new T.ConeGeometry(0.16, 0.16, 6); tr(cap, 0, 0.28, 0); frame.push(cap); const base = new T.CylinderGeometry(0.1, 0.13, 0.05, 6); tr(base, 0, -0.02, 0); frame.push(base); const ch = new T.CylinderGeometry(0.008, 0.008, 0.5, 4); tr(ch, 0, 0.6, 0); frame.push(ch);
    for (let k = 0; k < 6; k++) { const b = new T.BoxGeometry(0.015, 0.3, 0.015); const a = k / 6 * Math.PI * 2; tr(b, Math.cos(a) * 0.12, 0.13, Math.sin(a) * 0.12); frame.push(b); }
    const glass = new T.CylinderGeometry(0.115, 0.115, 0.28, 6); tr(glass, 0, 0.13, 0);
    return { parts: [{ name: 'brass', geo: merge(frame), mat: mat('brass', () => std({ color: C('#a07a35'), roughness: 0.35, metalness: 0.85 })) }, { name: 'glass', geo: glass, mat: mat('lanternGlow', () => std({ color: C('#ffd590'), emissive: C('#ffb24a'), emissiveIntensity: 0.6, roughness: 0.3, transparent: true, opacity: 0.92 })), glow: true }] };
  }
  function dhow() { // traditional wooden dhow (moored on the bay), faces +Z
    const L = 12, shape = new T.Shape(); shape.moveTo(-L / 2, 1.2); shape.quadraticCurveTo(-L / 2 + 0.6, 0, -L / 2 + 2.5, -0.2); shape.lineTo(L / 2 - 2.5, -0.2); shape.quadraticCurveTo(L / 2 - 0.4, 0.2, L / 2 + 0.8, 1.9); shape.lineTo(L / 2 + 0.6, 2.0); shape.lineTo(-L / 2 + 0.1, 1.6); shape.closePath();
    const hull = new T.ExtrudeGeometry(shape, { depth: 3.2, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.2, bevelSegments: 3 }); hull.translate(0, 0, -1.6);
    const p = hull.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), t = Math.abs(x) / (L / 2 + 0.8); p.setZ(i, p.getZ(i) * (1 - 0.75 * Math.pow(Math.min(1, t), 2.2))); } hull.computeVertexNormals(); hull.rotateY(-Math.PI / 2);
    const deck = new T.BoxGeometry(2.6, 0.12, L - 3); tr(deck, 0, 1.35, 0); const cabin = new T.BoxGeometry(2.2, 1.0, 2.4); tr(cabin, 0, 1.9, -3.3);
    const mast = new T.CylinderGeometry(0.1, 0.14, 8, 8); tr(mast, 0, 5.3, 1.2, 0.08); const yard = new T.CylinderGeometry(0.06, 0.08, 9, 8); tr(yard, 0, 8.2, 1.0, 1.2);
    const sail = new T.CylinderGeometry(0.22, 0.22, 7.5, 8); tr(sail, 0, 8.0, 1.05, 1.2);
    return { parts: [{ name: 'hull', geo: hull, mat: mat('teak', () => std({ color: C('#8a5a32'), roughness: 0.6 })) }, { name: 'deck', geo: merge([deck, cabin, mast, yard]), mat: mat('woodLight', () => std({ color: C('#a9784a'), roughness: 0.7 })) }, { name: 'sail', geo: sail, mat: mat('sailcloth', () => std({ color: C('#efe8d8'), roughness: 0.9 })) }] };
  }
  function coin() { const g = new T.CylinderGeometry(0.32, 0.32, 0.07, 18); g.rotateX(Math.PI / 2); const rim = new T.TorusGeometry(0.31, 0.03, 4, 18); return { parts: [{ name: 'coin', geo: merge([g, rim]), mat: mat('coin', () => std({ map: coinTexture(), color: C('#ffd34d'), emissive: C('#b07800'), emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.95 })) }] }; }
  function coinTexture() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#ffd34d'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#a86e00'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke(); x.fillStyle = '#8a1538'; x.font = '800 54px Tajawal, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ق', 64, 70); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }

  function group(def) { const g = new T.Group(); for (const p of def.parts) { const m = new T.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true; m.name = p.name; g.add(m); } g.userData.size = def.size; g.userData.yMin = def.yMin || 0; return g; }
  root.QRProps = { car, van, cone, jersey, hurdle, beam, cart, crates, carpetBanner, palm, lamp, flagBanner, shrub, bench, railPost, umbrella, lantern, dhow, coin, group, merge, tr, colorize, materials: M, C };
})(typeof window !== 'undefined' ? window : globalThis);
