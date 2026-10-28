/* صيد الأسماك V24 — procedural Gulf fish models (unit total length, head towards +Z).
 * The body is lofted from the same species profile used for the simulated weight (FishingFish.profile),
 * so the displayed weight is genuinely computed from the model volume. Exported to assets/models/fish-<id>.glb.
 */
(function (root) {
  'use strict';
  const T = root.THREE, FF = root.FishingFish;
  function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; }
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* skin texture: u along the body (tail→snout), v around (0 belly · 0.25 right · 0.5 back · 0.75 left · 1 belly) */
  function skin(sp) {
    const L = sp.look, R = seeded(sp.id.length * 7919 + 13);
    return tex(1024, 512, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, L.belly); grad.addColorStop(0.2, L.base); grad.addColorStop(0.5, shade(L.base, -0.28)); grad.addColorStop(0.8, L.base); grad.addColorStop(1, L.belly);
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      if (L.bars) for (let i = 0; i < L.bars_n; i++) { const x = w * (0.28 + i * 0.13); g.fillStyle = L.bars + '55'; for (const c of [0.25, 0.75]) { g.beginPath(); g.ellipse(x + R() * 20, h * c + (c < 0.5 ? 1 : -1) * h * 0.06, 26 + R() * 14, h * 0.17, 0.2, 0, 7); g.fill(); } }
      // scales: overlapping arcs
      g.lineWidth = 1; for (let y = 0; y < h; y += 9) for (let x = (y / 9 % 2) * 6; x < w * 0.86; x += 12) { g.strokeStyle = 'rgba(0,0,0,0.10)'; g.beginPath(); g.arc(x, y, 7, -0.9, 0.9); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.arc(x - 1.5, y, 6, -0.9, 0.9); g.stroke(); }
      // spots
      for (let i = 0; i < L.spotCount; i++) { const u = 0.18 + R() * 0.74, v = 0.08 + R() * 0.84; if (L.mouth === 'pointed' && u > 0.86) continue; const r = L.spotSize * w * (0.7 + R() * 0.6); g.fillStyle = L.spots + (sp.id === 'shaari' ? 'cc' : 'dd'); g.beginPath(); g.ellipse(u * w, v * h, r, r * 0.8, 0, 0, 7); g.fill(); }
      // lateral line
      g.strokeStyle = 'rgba(30,25,15,0.25)'; g.lineWidth = 2; for (const c of [0.3, 0.7]) { g.beginPath(); for (let x = w * 0.15; x < w * 0.82; x += 8) { const y = h * c + (c < 0.5 ? 1 : -1) * Math.sin((x / w - 0.15) * 4) * h * 0.04; if (x === w * 0.15) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
      // gill cover + head shading
      const gx = w * 0.79; g.strokeStyle = 'rgba(20,15,10,0.45)'; g.lineWidth = 3; for (const c of [0.25, 0.75]) { g.beginPath(); g.ellipse(gx + 30, h * c, 32, h * 0.2, 0, Math.PI * 0.6, Math.PI * 1.4); g.stroke(); }
      const hg = g.createLinearGradient(w * 0.8, 0, w, 0); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(25,18,10,0.28)'); g.fillStyle = hg; g.fillRect(w * 0.8, 0, w * 0.2, h);
      if (L.cheekLines) { g.strokeStyle = L.cheekLines; g.lineWidth = 3; for (const c of [0.25, 0.75]) for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(w * 0.86, h * c + (k - 1.5) * 12); g.lineTo(w * 0.97, h * c + (k - 1.5) * 18 + (c < 0.5 ? -10 : 10)); g.stroke(); } }
      // mouth line
      g.strokeStyle = 'rgba(25,10,8,0.7)'; g.lineWidth = L.mouth === 'large' ? 6 : 3; for (const c of [0.12, 0.88]) { g.beginPath(); g.moveTo(w * (L.mouth === 'large' ? 0.9 : 0.94), h * c); g.lineTo(w, h * (c < 0.5 ? 0.16 : 0.84)); g.stroke(); }
      // belly sheen
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, w, h * 0.06); g.fillRect(0, h * 0.94, w, h * 0.06);
    });
  }
  function shade(hex, k) { const c = new T.Color(hex); c.offsetHSL(0, 0, k * 0.5); return '#' + c.getHexString(); }
  function finTexture(color, spots) { return tex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); const gr = g.createRadialGradient(0, h / 2, 10, 0, h / 2, w); gr.addColorStop(0, color + 'f0'); gr.addColorStop(0.75, color + 'c8'); gr.addColorStop(1, color + '20'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(30,20,10,0.35)'; g.lineWidth = 2; for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, i / 17 * h); g.stroke(); } if (spots) for (let i = 0; i < 70; i++) { g.fillStyle = spots + 'aa'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 3, 0, 7); g.fill(); } }); }
  function eyeTexture(iris) { return tex(128, 128, (g) => { g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, 128, 128); const r = g.createRadialGradient(64, 64, 8, 64, 64, 60); r.addColorStop(0, '#050505'); r.addColorStop(0.42, '#050505'); r.addColorStop(0.46, iris); r.addColorStop(0.9, shade(iris, -0.3)); r.addColorStop(1, '#2a2418'); g.fillStyle = r; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(52, 50, 7, 0, 7); g.fill(); }); }

  function bodyGeometry(sp) {
    const u0 = sp.body[0][0], NS = 56, NR = 32, pos = [], uv = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, uu = Math.min(1, u0 + (1 - u0) * t), s = FF.profile(sp, uu), z = uu - 0.5;
      for (let j = 0; j <= NR; j++) {
        const th = -Math.PI / 2 + j / NR * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        const x = (s.w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.92), y = s.c + (s.h / 2) * Math.sign(sn) * Math.pow(Math.abs(sn), sn > 0 ? 0.9 : 1.05);
        pos.push(x, y, z); uv.push(uu, j / NR);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a = i * (NR + 1) + j, b = a + 1, c = a + NR + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    // close the snout tip and the peduncle end
    [[0, u0], [NS, 1]].forEach(([ring, uu]) => { const s = FF.profile(sp, uu), ci = pos.length / 3; pos.push(0, s.c, uu - 0.5 + (ring ? 0.004 : 0)); uv.push(uu, 0.5); for (let j = 0; j < NR; j++) { const a = ring * (NR + 1) + j; if (ring) idx.push(a, ci, a + 1); else idx.push(a, a + 1, ci); } });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function finMesh(points, mat, name) { const sh = new T.Shape(); points.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y)); const g = new T.ShapeGeometry(sh, 6); // shape in (x=z, y) → rotate so local x maps to body z
    const p = g.attributes.position, uvA = []; let minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity; for (let i = 0; i < p.count; i++) { minZ = Math.min(minZ, p.getX(i)); maxZ = Math.max(maxZ, p.getX(i)); minY = Math.min(minY, p.getY(i)); maxY = Math.max(maxY, p.getY(i)); }
    const pos = []; for (let i = 0; i < p.count; i++) { const z = p.getX(i), y = p.getY(i); pos.push(0, y, z); uvA.push((z - minZ) / (maxZ - minZ || 1), (y - minY) / (maxY - minY || 1)); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uvA, 2)); geo.setIndex(g.index); geo.computeVertexNormals(); const m = new T.Mesh(geo, mat); m.name = name; return m; }

  function build(id) {
    const sp = FF.SPECIES[id], L = sp.look, fins = sp.fins, root3 = new T.Group(); root3.name = 'fish-' + id;
    const bodyMat = new T.MeshStandardMaterial({ map: skin(sp), roughness: 0.38, metalness: 0.08, name: 'fish-skin-' + id });
    const finMat = new T.MeshStandardMaterial({ map: finTexture(L.fin, id === 'hamour' ? L.spots : null), transparent: true, alphaTest: 0.08, side: T.DoubleSide, roughness: 0.6, name: 'fish-fin-' + id });
    const body = new T.Mesh(bodyGeometry(sp), bodyMat); body.name = 'body'; body.castShadow = true; root3.add(body);
    const top = u => { const s = FF.profile(sp, u); return s.c + s.h / 2; }, bot = u => { const s = FF.profile(sp, u); return s.c - s.h / 2; };
    // dorsal & anal fins (in the body's mid plane)
    const dors = [[fins.dorsal[0][0] - 0.5, top(fins.dorsal[0][0]) - 0.01]]; fins.dorsal.forEach(([u, hh]) => dors.push([u - 0.5, top(u) + hh])); const dl = fins.dorsal[fins.dorsal.length - 1][0]; dors.push([dl + 0.03 - 0.5, top(dl + 0.03) - 0.01]);
    for (let k = fins.dorsal.length - 1; k >= 0; k--) dors.push([fins.dorsal[k][0] - 0.5, top(fins.dorsal[k][0]) - 0.012]);
    root3.add(finMesh(dors, finMat, 'fin-dorsal'));
    const an = [[fins.anal[0][0] - 0.5, bot(fins.anal[0][0]) + 0.01]]; fins.anal.forEach(([u, hh]) => an.push([u - 0.5, bot(u) - hh])); const al = fins.anal[fins.anal.length - 1][0]; an.push([al + 0.02 - 0.5, bot(al + 0.02) + 0.01]);
    for (let k = fins.anal.length - 1; k >= 0; k--) an.push([fins.anal[k][0] - 0.5, bot(fins.anal[k][0]) + 0.012]);
    root3.add(finMesh(an, finMat, 'fin-anal'));
    // caudal fin
    const u0 = sp.body[0][0], pe = FF.profile(sp, u0 + 0.01), base = u0 + 0.02 - 0.5, tipZ = -0.5, span = fins.caudalLen * 1.25, c = pe.c; let tail;
    if (fins.caudal === 'forked') tail = [[base, c + pe.h * 0.45], [tipZ - 0.015, c + span], [tipZ + 0.05, c + span * 0.2], [tipZ + 0.035, c], [tipZ + 0.05, c - span * 0.2], [tipZ - 0.015, c - span], [base, c - pe.h * 0.45]];
    else if (fins.caudal === 'emarginate') tail = [[base, c + pe.h * 0.45], [tipZ, c + span * 0.85], [tipZ + 0.02, c + span * 0.35], [tipZ + 0.028, c], [tipZ + 0.02, c - span * 0.35], [tipZ, c - span * 0.85], [base, c - pe.h * 0.45]];
    else tail = [[base, c + pe.h * 0.45], [tipZ + 0.03, c + span * 0.72], [tipZ + 0.005, c + span * 0.4], [tipZ - 0.004, c], [tipZ + 0.005, c - span * 0.4], [tipZ + 0.03, c - span * 0.72], [base, c - pe.h * 0.45]];
    root3.add(finMesh(tail, finMat, 'fin-caudal'));
    // paired fins on pivots (animated in the game)
    const head = FF.profile(sp, 0.74);
    [-1, 1].forEach(side => {
      const pv = new T.Group(); pv.name = 'fin-pectoral-' + (side < 0 ? 'R' : 'L'); pv.position.set(side * head.w * 0.47, head.c - head.h * 0.1, 0.74 - 0.5); pv.rotation.y = side * 0.5; root3.add(pv);
      const pf = finMesh([[0, 0.012], [-fins.pectoral * 0.9, 0.03], [-fins.pectoral, 0.0], [-fins.pectoral * 0.8, -0.022], [0, -0.012]], finMat, 'pectoral'); pv.add(pf);
      const pl = new T.Group(); pl.name = 'fin-pelvic-' + (side < 0 ? 'R' : 'L'); const pu = 0.68, ps = FF.profile(sp, pu); pl.position.set(side * ps.w * 0.25, ps.c - ps.h * 0.46, pu - 0.5); pl.rotation.set(0.4, 0, side * 0.5); root3.add(pl);
      pl.add(finMesh([[0, 0], [-fins.pelvic, -0.02], [-fins.pelvic * 0.9, -0.034], [-0.01, -0.012]], finMat, 'pelvic'));
      // eye
      const eu = id === 'shaari' ? 0.905 : id === 'safi' ? 0.915 : 0.9, es = FF.profile(sp, eu), er = id === 'hamour' ? 0.017 : id === 'safi' ? 0.024 : 0.02;
      const eye = new T.Mesh(new T.SphereGeometry(er, 18, 12), new T.MeshStandardMaterial({ map: eyeTexture(L.eye), roughness: 0.12, metalness: 0.1, name: 'fish-eye-' + id }));
      eye.name = 'eye-' + (side < 0 ? 'R' : 'L'); eye.position.set(side * es.w * 0.42, es.c + es.h * 0.2, eu - 0.5); eye.rotation.y = side * Math.PI / 2; eye.scale.z = 0.55; root3.add(eye);
    });
    // lower jaw / lips for large-mouthed groupers and thick-lipped emperors
    if (L.mouth !== 'small') { const s = FF.profile(sp, 0.975); const lip = new T.Mesh(new T.SphereGeometry(1, 14, 8), new T.MeshStandardMaterial({ color: shade(L.base, id === 'shaari' ? 0.1 : -0.1), roughness: 0.5, name: 'fish-lip-' + id })); lip.name = 'jaw'; lip.scale.set(s.w * 0.42, s.h * 0.16, 0.03); lip.position.set(0, s.c - s.h * 0.32, 0.478); root3.add(lip); }
    root3.userData = { species: id, length: 1 };
    return root3;
  }
  function buildAll() { const g = new T.Group(); g.name = 'fish-models'; FF.ORDER.forEach(id => g.add(build(id))); return g; }
  root.FishingFishModel = { build, buildAll, skin };
})(typeof window !== 'undefined' ? window : globalThis);
