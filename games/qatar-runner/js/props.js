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
  // licence plate (white, black digits, maroon band — generic, not a real registration)
  function plateTex() {
    return mat('plateTex', () => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#8a1538'; x.fillRect(0, 0, 52, 64);
      x.fillStyle = '#fff'; x.font = '700 15px Arial'; x.textAlign = 'center'; x.fillText('قطر', 26, 28); x.font = '700 11px Arial'; x.fillText('QATAR', 26, 46);
      x.fillStyle = '#111'; x.font = '700 38px Arial'; x.fillText(String(100000 + ((Math.random() * 899999) | 0)), 152, 46);
      x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 253, 61);
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; });
  }
  function rimTex() {
    return mat('rimTex', () => { const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
      x.fillStyle = '#1a1b1d'; x.fillRect(0, 0, S, S); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, '#d9dde0'); g.addColorStop(0.75, '#aab0b5'); g.addColorStop(0.8, '#555a5e'); g.addColorStop(1, '#1a1b1d');
      x.fillStyle = g; x.beginPath(); x.arc(64, 64, 60, 0, 6.283); x.fill();
      x.fillStyle = '#1d1f22'; for (let k = 0; k < 5; k++) { x.save(); x.translate(64, 64); x.rotate(k / 5 * 6.283 + 0.6); x.beginPath(); x.moveTo(10, -8); x.lineTo(46, -15); x.quadraticCurveTo(50, 0, 46, 15); x.lineTo(10, 8); x.closePath(); x.fill(); x.restore(); }
      x.fillStyle = '#c9ced2'; x.beginPath(); x.arc(64, 64, 10, 0, 6.283); x.fill();
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; });
  }
  function aoTex() {
    return mat('aoTex', () => { const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
      const im = x.createImageData(S, S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = (i + 0.5) / S * 2 - 1, v = (j + 0.5) / S * 2 - 1; const d = Math.max(0, 1 - Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25)); const k = (j * S + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 0; im.data[k + 3] = Math.min(255, Math.pow(d, 0.6) * 230); }
      x.putImageData(im, 0, 0); return new T.CanvasTexture(c); });
  }
  // passenger car lofted from cross-sections: body with real wheel arches, glasshouse with A/B/C pillars, tumblehome,
  // head/tail lights, grille, mirrors, plates, tyres with five-spoke rims, wheel-well darkness and a soft contact shadow.
  // Faces +Z (front), length along Z, width X, ground at y = 0.
  function car(kind = 'suv') {
    const suv = kind !== 'sedan';
    const L = suv ? 4.88 : 4.72, W = suv ? 1.94 : 1.80, H = suv ? 1.80 : 1.44, clr = suv ? 0.22 : 0.15;
    const R = suv ? 0.37 : 0.33, axF = L / 2 - (suv ? 0.92 : 0.95), axR = -L / 2 + (suv ? 1.0 : 1.05), arch = R + 0.06;
    const z0 = -L / 2, Lz = L, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // side profile, u = 0 rear … 1 front
    const belt = suv ? 1.13 : 0.92;
    const deck = u => suv ? belt - 0.02 * sm(0.9, 1, u) - (1 - sm(0.0, 0.06, u)) * 0.08
      : (u < 0.25 ? belt + 0.04 * sm(0.0, 0.2, u) : belt + 0.04);
    const bonnet = u => suv ? belt - 0.13 * sm(0.74, 1.0, u) - 0.22 * sm(0.95, 1.0, u) : belt + 0.04 - 0.16 * sm(0.68, 1.0, u) - 0.18 * sm(0.95, 1.0, u);
    const top = u => (u > (suv ? 0.74 : 0.68) ? bonnet(u) : deck(u));                                       // painted body top
    const cabin = suv ? [0.015, 0.74] : [0.2, 0.68];
    const roof = u => { if (suv) { const r0 = H, a = sm(0.58, 0.74, u); return r0 * (1 - a) + top(u) * a - 0.04 * (1 - sm(0.0, 0.05, u)); }
      const a = sm(0.47, 0.68, u), b = 1 - sm(0.2, 0.36, u); return H * (1 - Math.max(a, b)) + top(u) * Math.max(a, b); };
    const bottom = u => { const z = z0 + u * Lz; let y = clr + 0.08 * (1 - sm(0.0, 0.08, u)) + 0.1 * sm(0.93, 1.0, u);
      for (const az of [axF, axR]) { const d = Math.abs(z - az); if (d < arch) y = Math.max(y, R + Math.sqrt(arch * arch - d * d)); } return y; };
    const halfW = u => { const e = Math.abs(u * 2 - 1); return W / 2 * (1 - 0.1 * Math.pow(Math.max(0, e - 0.78) / 0.22, 2)) * (e > 0.96 ? Math.sqrt(Math.max(0.35, 1 - ((e - 0.96) / 0.045) ** 2)) : 1); };
    // stations along z (denser at the ends and around the arches)
    const us = []; for (let i = 0; i <= 48; i++) { const t = i / 48; us.push(0.5 - 0.5 * Math.cos(Math.PI * t)); }
    const NR = 14; // ring points per side (bottom centre → top centre)
    const bodyPos = [], bodyIdx = [], glassPos = [], glassIdx = [], paintGH = [];
    const ringBody = u => { const hw = halfW(u), y0 = bottom(u), y1 = top(u), pts = [];
      for (let k = 0; k <= NR; k++) { const t = k / NR; // walk: bottom centre → lower corner → side → shoulder → top centre
        let x, y; if (t < 0.15) { const a = t / 0.15; x = hw * 0.86 * a; y = y0; } else if (t < 0.3) { const a = (t - 0.15) / 0.15, an = -Math.PI / 2 + a * Math.PI / 2; x = hw * 0.86 + Math.cos(an) * hw * 0.14; y = y0 + 0.1 + Math.sin(an) * 0.1; }
        else if (t < 0.7) { const a = (t - 0.3) / 0.4; x = hw * (1 - 0.02 * a); y = y0 + 0.1 + (y1 - y0 - 0.22) * a; } else if (t < 0.85) { const a = (t - 0.7) / 0.15, an = a * Math.PI / 2; x = hw * 0.98 - 0.12 + Math.cos(an) * 0.12; y = y1 - 0.12 + Math.sin(an) * 0.12; }
        else { const a = (t - 0.85) / 0.15; x = (hw * 0.98 - 0.12) * (1 - a); y = y1 + 0.01 * a; }
        pts.push([x, Math.min(y, y1 + 0.01)]); } return pts; };
    const ringGH = u => { const hw = halfW(u) * 0.97, y0 = top(u), y1 = Math.max(roof(u), y0 + 0.005), pts = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; let x, y; if (t < 0.6) { const a = t / 0.6; x = hw * (1 - 0.2 * a) - 0.06; y = y0 + (y1 - y0 - 0.06) * a; } else if (t < 0.8) { const a = (t - 0.6) / 0.2, an = a * Math.PI / 2; x = hw * 0.8 - 0.12 + Math.cos(an) * 0.06; y = y1 - 0.06 + Math.sin(an) * 0.06; } else { const a = (t - 0.8) / 0.2; x = (hw * 0.8 - 0.12) * (1 - a); y = y1; } pts.push([x, y]); } return pts; };
    const loft = (ringFn, ulist, posArr, idxArr, n, side) => { // both sides, mirrored
      const base = posArr.length / 3, cols = n + 1;
      for (const s of [1, -1]) for (const u of ulist) { const z = z0 + u * Lz; for (const [x, y] of ringFn(u)) posArr.push(s * x, y, z); }
      for (let sd = 0; sd < 2; sd++) { const off = base + sd * ulist.length * cols; for (let i = 0; i < ulist.length - 1; i++) for (let k = 0; k < n; k++) { const a = off + i * cols + k, b = a + cols; if (sd === 0) idxArr.push(a, a + 1, b, a + 1, b + 1, b); else idxArr.push(a, b, a + 1, a + 1, b, b + 1); } }
      return { base, cols };
    };
    const lb = loft(ringBody, us, bodyPos, bodyIdx, NR);
    // end caps (rear and front) — fan from the ring centroid
    for (const [ui, sgn] of [[0, -1], [us.length - 1, 1]]) { const pts = ringBody(us[ui]); const z = z0 + us[ui] * Lz; const c = bodyPos.length / 3; bodyPos.push(0, (bottom(us[ui]) + top(us[ui])) / 2, z);
      for (let sd = 0; sd < 2; sd++) { const off = lb.base + sd * us.length * lb.cols + ui * lb.cols; for (let k = 0; k < NR; k++) { const a = off + k, b = off + k + 1; if ((sd === 0) === (sgn > 0)) bodyIdx.push(c, a, b); else bodyIdx.push(c, b, a); } } void pts; }
    // glasshouse: split into glass and painted pillars/roof
    const ug = us.filter(u => u >= cabin[0] && u <= cabin[1]); const gb = glassPos.length / 3;
    for (const s of [1, -1]) for (const u of ug) { const z = z0 + u * Lz; for (const [x, y] of ringGH(u)) glassPos.push(s * x, y, z); }
    const pillar = u => suv ? (u < 0.05 || Math.abs(u - 0.33) < 0.018 || Math.abs(u - 0.49) < 0.022 || u > 0.705) : (u < 0.23 || Math.abs(u - 0.45) < 0.02 || u > 0.655);
    const giA = [], giB = [];
    for (let sd = 0; sd < 2; sd++) { const off = gb + sd * ug.length * 9; for (let i = 0; i < ug.length - 1; i++) for (let k = 0; k < 8; k++) { const a = off + i * 9 + k, b = a + 9; const tri = sd === 0 ? [a, a + 1, b, a + 1, b + 1, b] : [a, b, a + 1, a + 1, b, b + 1]; const um = (ug[i] + ug[i + 1]) / 2; const roofPart = k >= 6, sideEdge = k === 0; (roofPart || sideEdge || pillar(um) ? giA : giB).push(...tri); } }
    const mk = (pos, idx) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const n = pos.length / 3, uv = new Float32Array(n * 2); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); return g; };
    // close the glasshouse ends (SUV: near-vertical rear window; both: thin caps so nothing is see-through)
    for (const [ui, sgn] of [[0, -1], [ug.length - 1, 1]]) { const c = glassPos.length / 3; const pts = ringGH(ug[ui]); const zc = z0 + ug[ui] * Lz; glassPos.push(0, (top(ug[ui]) + Math.max(roof(ug[ui]), top(ug[ui]))) / 2, zc);
      for (let sd = 0; sd < 2; sd++) { const off = gb + sd * ug.length * 9 + ui * 9; for (let k = 0; k < 8; k++) { const a = off + k, b = off + k + 1; ((sd === 0) === (sgn > 0) ? giB.push(c, a, b) : giB.push(c, b, a)); } }
      { const l0 = gb + ui * 9, r0 = gb + ug.length * 9 + ui * 9; giB.push(c, l0, r0); } void pts; }
    const ghPaint = mk(glassPos, giA), glass = mk(glassPos.slice(), giB);
    // windscreen & rear window caps are covered by the loft (sloped stations); close the glasshouse ends
    const body = merge([mk(bodyPos, bodyIdx), ghPaint]);
    const paint = mat(suv ? 'carPaintSUV' : 'carPaintSedan', () => new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.1, name: 'car-paint' }));
    const parts = [{ name: 'body', geo: body, mat: paint }, { name: 'glass', geo: glass, mat: mat('carGlass', () => std({ color: C('#0d1217'), roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5, name: 'car-glass', side: T.DoubleSide })) }];
    // wheels: tyre (lathe with rounded shoulders), rim disc with spokes, dark wheel wells
    const tyreProf = []; const tw = suv ? 0.25 : 0.23; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; tyreProf.push(new T.Vector2(R - 0.035 + Math.sin(a) * 0.035, -tw / 2 + (1 - Math.cos(a)) / 2 * tw)); }
    const tyres = [], rims = [], wells = [];
    for (const az of [axF, axR]) for (const s of [-1, 1]) {
      const t = new T.LatheGeometry([new T.Vector2(R * 0.66, -tw / 2), ...tyreProf, new T.Vector2(R * 0.66, tw / 2)], 22); t.rotateZ(Math.PI / 2); tr(t, s * (W / 2 - tw / 2 - 0.03), R, az); tyres.push(t);
      const r = new T.CircleGeometry(R * 0.68, 20); r.rotateY(s * Math.PI / 2); tr(r, s * (W / 2 - 0.035), R, az); rims.push(r);
      const w = new T.CylinderGeometry(arch - 0.01, arch - 0.01, 0.42, 16, 1, true, -Math.PI / 2, Math.PI); w.rotateZ(Math.PI / 2); w.scale(1, 1, 1); tr(w, s * (W / 2 - 0.26), R, az); wells.push(w);
    }
    parts.push({ name: 'tire', geo: merge(tyres), mat: mat('tire', () => std({ color: C('#161616'), roughness: 0.88, name: 'tyre' })) },
      { name: 'rim', geo: merge(rims), mat: mat('rim', () => std({ map: rimTex(), roughness: 0.3, metalness: 0.75, name: 'rim' })) },
      { name: 'well', geo: merge(wells), mat: mat('well', () => std({ color: C('#0b0b0c'), roughness: 1, side: T.DoubleSide, name: 'wheel-well' })), shadow: false });
    // lights, grille, bumpers trim, mirrors, plates
    const yb = top(0.99), yr = top(0.01), hwF = halfW(0.985), hwR = halfW(0.015);
    const head = [], tail = [], trim = [], plates = [];
    for (const s of [-1, 1]) {
      const h = new T.BoxGeometry(0.42, 0.1, 0.06); tr(h, s * (hwF - 0.3), yb - 0.1, L / 2 - 0.03, 0, s * 0.18, 0); head.push(h);
      const tl = suv ? new T.BoxGeometry(0.1, 0.32, 0.05) : new T.BoxGeometry(0.42, 0.11, 0.05); tr(tl, s * (hwR - (suv ? 0.08 : 0.28)), suv ? yr - 0.08 : yr - 0.1, -L / 2 + 0.02, 0, -s * 0.15, 0); tail.push(tl);
      const m = new T.BoxGeometry(0.05, 0.11, 0.17); tr(m, s * (halfW(cabin[1] - 0.02) * 0.97 - 0.02), top(cabin[1]) + 0.08, z0 + (cabin[1] - 0.035) * Lz, 0, -s * 0.25, 0); trim.push(m);
    }
    const gr = new T.BoxGeometry(W * 0.46, 0.2, 0.05); tr(gr, 0, yb - 0.27, L / 2 - 0.01); trim.push(gr);
    const bf = new T.BoxGeometry(W * 0.9, 0.09, 0.06); tr(bf, 0, clr + 0.17, L / 2 - 0.02); trim.push(bf); const br = new T.BoxGeometry(W * 0.9, 0.09, 0.06); tr(br, 0, clr + 0.2, -L / 2 + 0.02); trim.push(br);
    const sill = new T.BoxGeometry(0.03, 0.06, Math.abs(axF - axR) - arch * 2 + 0.05); for (const s of [-1, 1]) { const g = sill.clone(); tr(g, s * (W / 2 - 0.01), clr + 0.12, (axF + axR) / 2); trim.push(g); }
    for (const [zz, ry] of [[L / 2 + 0.005, 0], [-L / 2 - 0.005, Math.PI]]) { const p = new T.PlaneGeometry(0.52, 0.13); p.rotateY(ry); tr(p, 0, zz > 0 ? clr + 0.32 : (suv ? clr + 0.55 : clr + 0.45), zz); plates.push(p); }
    parts.push({ name: 'head', geo: merge(head), mat: mat('headL', () => std({ color: 0xffffff, emissive: C('#fff6e0'), emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.3 })) },
      { name: 'tail', geo: merge(tail), mat: mat('tailL', () => std({ color: C('#7a0d10'), emissive: C('#ff2a20'), emissiveIntensity: 0.5, roughness: 0.25 })) },
      { name: 'trim', geo: merge(trim), mat: mat('trim', () => std({ color: C('#1b1c1e'), roughness: 0.55, metalness: 0.3 })) },
      { name: 'plate', geo: merge(plates), mat: mat('plate', () => std({ map: plateTex(), roughness: 0.5 })), shadow: false });
    const ao = new T.PlaneGeometry(W + 0.5, L + 0.5); ao.rotateX(-Math.PI / 2); tr(ao, 0, 0.012, 0);
    parts.push({ name: 'ao', geo: ao, mat: mat('carAO', () => new T.MeshBasicMaterial({ map: aoTex(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.75 })), shadow: false });
    return { parts, size: [W + 0.1, H + 0.05, L + 0.1] };
  }
  function van() { // light box truck: rounded cab, cargo box with a sign, chassis, dual rear wheels, lights, plates
    const parts = [], W = 2.1, L = 6.2, R = 0.42;
    const rbox = (w, h, d, r) => { const sh = new T.Shape(), x0 = -w / 2, y0 = 0; sh.moveTo(x0 + r, y0); sh.lineTo(x0 + w - r, y0); sh.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); sh.lineTo(x0 + w, y0 + h - r); sh.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); sh.lineTo(x0 + r, y0 + h); sh.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0); const g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -d / 2); return g; };
    const cargo = new T.BoxGeometry(W, 2.3, 4.25); tr(cargo, 0, 0.62 + 1.15, -0.95);
    const cab = rbox(W - 0.08, 1.55, 1.6, 0.18); tr(cab, 0, 0.6, 2.1);
    const nose = rbox(W - 0.12, 0.62, 0.5, 0.12); tr(nose, 0, 0.55, 3.0);
    parts.push({ name: 'body', geo: merge([cab, nose]), mat: mat('carPaintSUV', () => new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.12 })) });
    parts.push({ name: 'cargo', geo: cargo, mat: mat('vanCargo', () => { const t = X.sign('توصيل سريع', { w: 512, h: 256, bg: '#efede6', fg: '#8a1538', size: 72, border: '#efede6' }); return std({ map: t, roughness: 0.55, metalness: 0.1 }); }) });
    const ws = new T.BoxGeometry(W - 0.22, 0.62, 0.04); tr(ws, 0, 1.75, 2.93, -0.18); const sw = []; for (const s of [-1, 1]) { const g = new T.BoxGeometry(0.03, 0.5, 0.75); tr(g, s * (W / 2 - 0.03), 1.78, 2.35); sw.push(g); }
    parts.push({ name: 'glass', geo: merge([ws, ...sw]), mat: mat('carGlass', () => std({ color: C('#0d1217'), roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5, side: T.DoubleSide })) });
    const chassis = new T.BoxGeometry(W * 0.7, 0.22, L - 0.6); tr(chassis, 0, 0.5, -0.1);
    const trim = [chassis]; const bf = new T.BoxGeometry(W - 0.05, 0.18, 0.12); tr(bf, 0, 0.5, 3.25); trim.push(bf); const br = new T.BoxGeometry(W - 0.1, 0.12, 0.1); tr(br, 0, 0.55, -3.1); trim.push(br);
    const gr = new T.BoxGeometry(W * 0.5, 0.22, 0.03); tr(gr, 0, 0.88, 3.26); trim.push(gr);
    for (const s of [-1, 1]) { const m = new T.BoxGeometry(0.06, 0.22, 0.12); tr(m, s * (W / 2 + 0.12), 1.7, 2.75); trim.push(m); }
    parts.push({ name: 'trim', geo: merge(trim), mat: mat('trim', () => std({ color: C('#1b1c1e'), roughness: 0.55, metalness: 0.3 })) });
    const head = [], tail = []; for (const s of [-1, 1]) { const h = new T.BoxGeometry(0.34, 0.14, 0.04); tr(h, s * (W / 2 - 0.3), 0.98, 3.26); head.push(h); const t = new T.BoxGeometry(0.12, 0.28, 0.04); tr(t, s * (W / 2 - 0.12), 0.95, -3.09); tail.push(t); }
    parts.push({ name: 'head', geo: merge(head), mat: mat('headL', () => std({ color: 0xffffff, emissive: C('#fff6e0'), emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.3 })) },
      { name: 'tail', geo: merge(tail), mat: mat('tailL', () => std({ color: C('#7a0d10'), emissive: C('#ff2a20'), emissiveIntensity: 0.5, roughness: 0.25 })) });
    const tyres = [], rims = [];
    for (const [zz, dual] of [[2.35, 0], [-1.6, 1]]) for (const s of [-1, 1]) for (let d = 0; d <= dual; d++) {
      const t = new T.CylinderGeometry(R, R, 0.26, 22); t.rotateZ(Math.PI / 2); const x = s * (W / 2 - 0.16 - d * 0.28); tr(t, x, R, zz); tyres.push(t);
      if (!d) { const r = new T.CircleGeometry(R * 0.62, 20); r.rotateY(s * Math.PI / 2); tr(r, x + s * 0.132, R, zz); rims.push(r); }
    }
    parts.push({ name: 'tire', geo: merge(tyres), mat: mat('tire', () => std({ color: C('#161616'), roughness: 0.88 })) }, { name: 'rim', geo: merge(rims), mat: mat('rim', () => std({ map: rimTex(), roughness: 0.3, metalness: 0.75 })) });
    const plates = []; for (const [zz, ry, y] of [[3.33, 0, 0.62], [-3.16, Math.PI, 0.7]]) { const p = new T.PlaneGeometry(0.52, 0.13); p.rotateY(ry); tr(p, 0, y, zz); plates.push(p); }
    parts.push({ name: 'plate', geo: merge(plates), mat: mat('plate', () => std({ map: plateTex(), roughness: 0.5 })), shadow: false });
    const ao = new T.PlaneGeometry(W + 0.5, L + 0.5); ao.rotateX(-Math.PI / 2); tr(ao, 0, 0.012, 0);
    parts.push({ name: 'ao', geo: ao, mat: mat('carAO', () => new T.MeshBasicMaterial({ map: aoTex(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.75 })), shadow: false });
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
    const tg = new T.CylinderGeometry(0.17, 0.25, h, 8, 6, true); tg.translate(0, h / 2, 0);
    const p = tg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / h; const ring = 1 + 0.06 * Math.max(0, Math.sin(y * 9.5)); p.setX(i, p.getX(i) * ring + 0.35 * t * t); p.setZ(i, p.getZ(i) * ring); }
    const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * h / 2.2); tg.computeVertexNormals();
    const base = new T.CylinderGeometry(0.265, 0.27, 1.25, 8, 1, true); base.translate(0, 0.62, 0);
    const fr = []; const top = new T.Vector3(0.35, h, 0);
    const NF = 34;
    for (let f = 0; f < NF; f++) {
      const L = 3.3 + ((f * 37) % 9) / 10, wd = 1.55, segs = 5, a = f / NF * Math.PI * 2 * 2.618 + (f % 3) * 0.13, pitch = [0.95, 0.62, 0.3, 0.02, -0.28, -0.55][f % 6], droop = 0.08 + (f % 5) * 0.035;
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
    return { parts: [{ name: 'trunk', geo: tg, mat: mat('bark', () => std({ map: X.photo('trunk_c'), normalMap: X.photo('trunk_n', { srgb: false }), normalScale: new T.Vector2(1.2, 1.2), roughness: 0.95, side: T.DoubleSide })) },
      { name: 'base', geo: base, mat: mat('whitePaint', () => std({ color: C('#f4f4f0'), roughness: 0.6 })) },
      { name: 'crown', geo: merge([crown, ...dates]), mat: mat('crown', () => std({ color: C('#5b4628'), roughness: 0.9 })) },
      { name: 'fronds', geo: merge(fr), mat: mat('frond', () => std({ map: X.photo('frond_c', { wrap: false }), alphaTest: 0.3, alphaToCoverage: true, side: T.DoubleSide, roughness: 0.6, color: C('#e8eedc') })), sway: true }], size: [1, h, 1] };
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
  function shrub() { // trimmed ficus bush: a few overlapping lumpy domes with a leafy texture (no flat shading)
    const parts = [];
    for (const [x, z, r, h] of [[0, 0, 0.62, 0.7], [0.5, 0.18, 0.45, 0.55], [-0.46, -0.12, 0.5, 0.6], [0.08, -0.42, 0.42, 0.5]]) {
      const g = new T.IcosahedronGeometry(1, 2); const p = g.attributes.position, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const v = new T.Vector3().fromBufferAttribute(p, i); const k = 1 + 0.08 * Math.sin(v.x * 7 + z * 3) * Math.cos(v.z * 6 + x * 2) + 0.05 * Math.sin(v.y * 11 + x * 5);
        v.multiplyScalar(k); const y = Math.max(-0.05, v.y);
        p.setXYZ(i, x + v.x * r, y * h + 0.05, z + v.z * r);
        uv[i * 2] = (Math.atan2(v.z, v.x) / (2 * Math.PI) + 0.5) * 3; uv[i * 2 + 1] = (v.y * 0.5 + 0.5) * 1.5;
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.computeVertexNormals(); parts.push(g);
    }
    return { parts: [{ name: 'shrub', geo: merge(parts), mat: mat('shrub', () => std({ map: X.photo('hedge_c'), normalMap: X.photo('hedge_n', { srgb: false }), normalScale: new T.Vector2(1.4, 1.4), color: C('#cfd8c0'), roughness: 0.85 })) }] };
  }
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
