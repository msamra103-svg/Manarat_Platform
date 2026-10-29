/* Premium Qatar-inspired night stadium (an original, fictional venue): mown pitch with real markings, goal frames, corner flags, LED ad boards,
 * a two-tier seating bowl with a tensile roof and floodlights, scoreboard, dugouts, tunnel and sky. Everything is generated procedurally
 * (no external assets) and scaled by a quality tier. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, M = FB.math;
  const P = FB.PITCH, CZ = P.centerZ, HL = P.length / 2, HW = P.width / 2;
  const MAROON = '#8a1538', GOLD = '#cfa95a', IVORY = '#f7f2e8';

  const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctex = (c, o = {}) => { const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = o.aniso || 4; if (o.repeat) t.wrapS = t.wrapT = T.RepeatWrapping; if (o.wrapS) t.wrapS = o.wrapS; return t; };
  const rnd = M.rng(20261023);

  /** rounded-rectangle ring (superellipse) around the pitch centre; returns [x,z] */
  function ringXZ(ax, az, u, n = 3.4) { const c = Math.cos(u), s = Math.sin(u), e = 2 / n; return [ax * Math.sign(c) * Math.pow(Math.abs(c), e), CZ + az * Math.sign(s) * Math.pow(Math.abs(s), e)]; }

  /** build a lofted strip between ring A and ring B ({ax,az,y}); returns arrays to be merged */
  class Mesher {
    constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
    strip(a, b, N, o = {}) {
      const base = this.pos.length / 3, per = o.perimeter || 1, uvs = o.uvScale || [1, 1], v0 = o.v0 || 0, v1 = o.v1 === undefined ? 1 : o.v1;
      const pa = [], pb = [];
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * Math.PI * 2; const A = ringXZ(a.ax, a.az, u, o.n), B = ringXZ(b.ax, b.az, u, o.n);
        pa.push([A[0], a.y, A[1]]); pb.push([B[0], b.y, B[1]]);
      }
      for (let i = 0; i <= N; i++) {
        this.pos.push(...pa[i], ...pb[i]);
        const arc = (i / N) * per;
        this.uv.push(arc * uvs[0], v0 * uvs[1], arc * uvs[0], v1 * uvs[1]);
        const c = o.color || [1, 1, 1]; this.col.push(...c, ...c);
      }
      for (let i = 0; i < N; i++) { const k = base + i * 2; if (o.flip) this.idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); else this.idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    geometry(computeNormals = true) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3)); g.setIndex(this.idx); if (computeNormals) g.computeVertexNormals(); g.computeBoundingSphere(); return g;
    }
  }

  /* ---------------- textures ---------------- */
  function grassTexture(q) {
    const w = q > 1 ? 1024 : 512, h = Math.round(w * 1.5), c = cvs(w, h), x = c.getContext('2d');
    // bands run across the pitch (parallel to the goal lines); 20 bands over the length
    const bands = 20, bh = h / bands;
    for (let i = 0; i < bands; i++) { const g = x.createLinearGradient(0, i * bh, 0, (i + 1) * bh); const lo = i % 2 ? '#2f7a36' : '#3b8a3c', hi = i % 2 ? '#2b7132' : '#357f37'; g.addColorStop(0, lo); g.addColorStop(1, hi); x.fillStyle = g; x.fillRect(0, i * bh, w, bh + 1); }
    // large soft wear and sun patches
    for (let i = 0; i < 60; i++) { const px = rnd() * w, py = rnd() * h, r = 30 + rnd() * 120, g = x.createRadialGradient(px, py, 0, px, py, r); const dark = rnd() < 0.5; g.addColorStop(0, dark ? 'rgba(10,40,12,0.16)' : 'rgba(150,190,80,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
    // worn goalmouths and penalty spots (fractions of the pitch)
    for (const [fy] of [[0.025], [0.975]]) { const g = x.createRadialGradient(w / 2, fy * h, 0, w / 2, fy * h, w * 0.18); g.addColorStop(0, 'rgba(120,110,60,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, fy * h - w * 0.2, w, w * 0.4); }
    // fine blade noise
    const id = x.getImageData(0, 0, w, h), d = id.data, nr = M.rng(99);
    for (let i = 0; i < d.length; i += 4) { const n = (nr() - 0.5) * 22; d[i] += n * 0.7; d[i + 1] += n; d[i + 2] += n * 0.6; }
    x.putImageData(id, 0, 0);
    return ctex(c, { aniso: q > 1 ? 8 : 4 });
  }
  function detailTexture() {
    const c = cvs(256, 256), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256); const r = M.rng(5);
    for (let i = 0; i < 5200; i++) { const a = r() * 256, b = r() * 256, l = 4 + r() * 9, ang = -Math.PI / 2 + (r() - 0.5) * 1.1; x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'; x.lineWidth = 1; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(ang) * l, b + Math.sin(ang) * l); x.stroke(); }
    const t = ctex(c, { repeat: true, aniso: 8 }); t.encoding = T.LinearEncoding; return t;
  }
  function seatTexture() {
    const w = 2048, h = 64, c = cvs(w, h), x = c.getContext('2d');
    x.fillStyle = '#6f1030'; x.fillRect(0, 0, w, h);
    // diamond lattice (sadu-inspired) in ivory/maroon/gold running along the bowl
    const cell = 32;
    for (let row = 0; row < h / cell * 2 + 2; row++) for (let i = 0; i < w / cell + 2; i++) {
      const cx = i * cell + (row % 2 ? cell / 2 : 0), cy = row * cell / 2; const k = (i * 7 + row * 3) % 5;
      x.fillStyle = k === 0 ? '#f0e8d8' : k === 1 ? '#a31c46' : k === 2 ? '#7d1334' : k === 3 ? '#cfa95a' : '#8a1538';
      x.beginPath(); x.moveTo(cx, cy - cell / 2); x.lineTo(cx + cell / 2, cy); x.lineTo(cx, cy + cell / 2); x.lineTo(cx - cell / 2, cy); x.closePath(); x.fill();
    }
    // aisles
    x.fillStyle = '#26282c'; for (let i = 0; i < 24; i++) x.fillRect(i * w / 24 - 6, 0, 12, h);
    // seat texture (subtle horizontal slats)
    x.globalAlpha = 0.18; x.fillStyle = '#000'; for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 1);
    return ctex(c, { repeat: true });
  }
  function concreteTexture() {
    const c = cvs(256, 256), x = c.getContext('2d'); x.fillStyle = '#aeb0b2'; x.fillRect(0, 0, 256, 256); const r = M.rng(3);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${(r() * 0.08).toFixed(3)})`; x.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2; x.strokeRect(0, 0, 256, 256);
    return ctex(c, { repeat: true });
  }
  function roofTexture() {
    const c = cvs(1024, 128), x = c.getContext('2d'); x.fillStyle = '#e9e6dd'; x.fillRect(0, 0, 1024, 128);
    // diamond membrane panel seams + sadu band near the edge
    x.strokeStyle = 'rgba(80,70,60,0.22)'; x.lineWidth = 2; const s = 64;
    for (let i = -2; i < 18; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s + 64, 128); x.stroke(); x.beginPath(); x.moveTo(i * s + 64, 0); x.lineTo(i * s, 128); x.stroke(); }
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,50,40,0.25)'); x.fillStyle = g; x.fillRect(0, 0, 1024, 128);
    x.fillStyle = MAROON; x.fillRect(0, 112, 1024, 6); x.fillStyle = GOLD; x.fillRect(0, 118, 1024, 3);
    return ctex(c, { repeat: true });
  }
  const FONT_AR = '"Noto Naskh Arabic","Segoe UI",Tahoma,Arial,sans-serif';
  /** LED board artwork: a strip of 8 message panels (RTL Arabic), LED dot pattern, sRGB. kind: 'ads' | 'goal' | 'save' | 'chance' */
  function ledTexture(messages, kind = 'ads') {
    const w = 4096, h = 128, c = cvs(w, h), x = c.getContext('2d'); x.fillStyle = '#0c1016'; x.fillRect(0, 0, w, h);
    const sets = { ads: [[MAROON, IVORY], ['#f7f2e8', MAROON], ['#10303a', GOLD], ['#5d0e26', '#ffe2a8']], goal: [[MAROON, '#ffd98a'], ['#ffd98a', MAROON]], save: [['#0f3b2a', '#e8ff7a'], ['#e8ff7a', '#0f3b2a']], chance: [['#10303a', IVORY], [IVORY, '#10303a']] };
    const colors = sets[kind] || sets.ads; let px = 0, i = 0; const seg = 512;
    x.direction = 'rtl'; x.textBaseline = 'middle'; x.textAlign = 'center';
    while (px < w) {
      const m = messages[i % messages.length], [bg, fg] = colors[i % colors.length];
      const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, bg); gr.addColorStop(1, shade(bg, -0.25)); x.fillStyle = gr; x.fillRect(px, 0, seg, h);
      x.fillStyle = kind === 'ads' ? GOLD : fg; x.fillRect(px, 0, 3, h);
      x.fillStyle = fg; x.font = (kind === 'ads' ? 'bold 60px ' : 'bold 76px ') + FONT_AR; x.fillText(m, px + seg / 2, h / 2 + 4, seg - 40);
      px += seg; i++;
    }
    // LED pixel grid (subtle so text stays readable from the broadcast camera)
    x.globalAlpha = 0.18; x.fillStyle = '#000'; for (let yy = 0; yy < h; yy += 4) x.fillRect(0, yy, w, 1); for (let xx = 0; xx < w; xx += 4) x.fillRect(xx, 0, 1, h);
    x.globalAlpha = 1; return ctex(c, { repeat: true, aniso: 8 });
  }
  function shade(hex, k) { const c = new T.Color(hex); c.multiplyScalar(1 + k); return '#' + c.getHexString(); }
  /** Rounded-rectangle path around the pitch (corners included), sampled every ~0.5 m: [{x, z, nx, nz, s}] with inward normals. */
  function roundRectPath(hx, hz, rad, step = 0.5) {
    const pts = [], push = (x, z, nx, nz) => { z += CZ; const l = pts.length ? pts[pts.length - 1] : null; const s = l ? l.s + Math.hypot(x - l.x, z - l.z) : 0; pts.push({ x, z, nx, nz, s }); };
    const line = (x0, z0, x1, z1, nx, nz) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / step)); for (let i = 0; i < n; i++) { const t = i / n; push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz); } };
    const arc = (cx, cz, a0) => { const n = Math.max(4, Math.ceil(rad * Math.PI / 2 / step)); for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI / 2, ox = Math.cos(a), oz = Math.sin(a); push(cx + ox * rad, cz + oz * rad, -ox, -oz); } };
    line(hx, -hz + rad, hx, hz - rad, -1, 0); arc(hx - rad, hz - rad, 0);
    line(hx - rad, hz, -hx + rad, hz, 0, -1); arc(-hx + rad, hz - rad, Math.PI / 2);
    line(-hx, hz - rad, -hx, -hz + rad, 1, 0); arc(-hx + rad, -hz + rad, Math.PI);
    line(-hx + rad, -hz, hx - rad, -hz, 0, 1); arc(hx - rad, -hz + rad, Math.PI * 1.5);
    const f = pts[0], l = pts[pts.length - 1]; pts.push({ x: f.x, z: f.z, nx: f.nx, nz: f.nz, s: l.s + Math.hypot(f.x - l.x, f.z - l.z) });
    return pts;
  }
  /** vertical ribbon along a path: y0..y1, u = s / uLen; offset pushes it along -normal (outward) */
  function ribbon(pts, y0, y1, uLen, offset = 0) {
    const n = pts.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), nor = new Float32Array(n * 6), idx = [];
    pts.forEach((p, i) => { const x = p.x - p.nx * offset, z = p.z - p.nz * offset; pos.set([x, y0, z, x, y1, z], i * 6); nor.set([p.nx, 0, p.nz, p.nx, 0, p.nz], i * 6); uv.set([p.s / uLen, 0, p.s / uLen, 1], i * 4); if (i < n - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }

  /* ---------------- builders ---------------- */
  function buildPitch(group, q) {
    const map = grassTexture(q), detail = detailTexture();
    map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
    const mat = new T.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uDetail = { value: detail }; sh.uniforms.uTile = { value: new T.Vector2(P.width / 1.6, P.length / 1.6) };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; uniform vec2 uTile;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n float dn = texture2D(uDetail, vUv * uTile).r; diffuseColor.rgb *= mix(1.0, dn * 1.9 + 0.1, 0.42 * (1.0 - smoothstep(30.0, 90.0, length(vViewPosition))));')
        .replace('void main() {', 'varying float vDummy;\nvoid main() {');
      sh.fragmentShader = sh.fragmentShader.replace('varying float vDummy;\n', '');
    };
    const pitch = new T.Mesh(new T.PlaneGeometry(P.width, P.length), mat); pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0, CZ); pitch.receiveShadow = true; pitch.name = 'pitch'; group.add(pitch);
    // pitch runs along z; texture v maps along the length, so flip so band 0 is at the goal we attack
    // surround (apron) turf
    const ap = new T.Mesh(new T.PlaneGeometry(P.width + 40, P.length + 40), new T.MeshStandardMaterial({ color: FB.color('#2a6a30'), roughness: 1 })); ap.rotation.x = -Math.PI / 2; ap.position.set(0, -0.012, CZ); ap.receiveShadow = true; group.add(ap);
    // markings as thin ribbons (crisp at any distance)
    const w = 0.12, y = 0.006, pos = [], idx = [];
    const seg = (x1, z1, x2, z2) => { const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz), nx = -dz / l * w / 2, nz = dx / l * w / 2, b = pos.length / 3; pos.push(x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz, x2 + nx, y, z2 + nz, x2 - nx, y, z2 - nz); idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); };
    const rect = (x1, z1, x2, z2) => { seg(x1 - w / 2, z1, x2 + w / 2, z1); seg(x2, z1, x2, z2); seg(x2 + w / 2, z2, x1 - w / 2, z2); seg(x1, z2, x1, z1); };
    const arc = (cx, cz, r, a0, a1, n = 48) => { let px = cx + Math.cos(a0) * r, pz = cz + Math.sin(a0) * r; for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; seg(px, pz, x, z); px = x; pz = z; } };
    const gz = P.goalZ, ez = gz + P.length;
    rect(-HW, gz, HW, ez); seg(-HW, CZ, HW, CZ); arc(0, CZ, P.arcR, 0, Math.PI * 2, 72);
    for (const [gl, dir] of [[gz, 1], [ez, -1]]) {
      rect(-P.penaltyHalf, gl, P.penaltyHalf, gl + dir * P.penaltyDepth); rect(-P.sixHalf, gl, P.sixHalf, gl + dir * P.sixDepth);
      const sz = gl + dir * P.spotDist, a = Math.acos((P.penaltyDepth - P.spotDist) / P.arcR);
      if (dir > 0) arc(0, sz, P.arcR, Math.PI / 2 - a, Math.PI / 2 + a, 24); else arc(0, sz, P.arcR, -Math.PI / 2 - a, -Math.PI / 2 + a, 24);
      // spot
      const sp = new T.Mesh(new T.CircleGeometry(0.11, 20), new T.MeshBasicMaterial({ color: FB.color(0xf2f2ec) })); sp.rotation.x = -Math.PI / 2; sp.position.set(0, y + 0.001, sz); group.add(sp);
    }
    for (const sx of [-1, 1]) for (const gl of [gz, ez]) arc(sx * HW, gl, 1, gl === gz ? 0 : Math.PI, gl === gz ? (sx > 0 ? Math.PI : Math.PI) : 0, 1);
    for (const [cx, cz, a0, a1] of [[-HW, gz, 0, Math.PI / 2], [HW, gz, Math.PI / 2, Math.PI], [-HW, ez, -Math.PI / 2, 0], [HW, ez, Math.PI, Math.PI * 1.5]]) arc(cx, cz, 1, a0, a1, 10);
    const sp = new T.Mesh(new T.CircleGeometry(0.11, 20), new T.MeshBasicMaterial({ color: FB.color(0xf2f2ec) })); sp.rotation.x = -Math.PI / 2; sp.position.set(0, y + 0.001, CZ); group.add(sp);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const lines = new T.Mesh(g, new T.MeshStandardMaterial({ color: FB.color(0xf4f4ee), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); lines.receiveShadow = true; group.add(lines);
    return { pitch, lines };
  }

  function buildGoal(group) {
    const hw = P.goalHalf, H = P.goalHeight, z = P.goalZ, r = P.postR, mat = new T.MeshStandardMaterial({ color: FB.color(0xf6f6f2), roughness: 0.38, metalness: 0.15 });
    const tube = (a, b, rad = r) => { const d = new V().subVectors(b, a), m = new T.Mesh(new T.CylinderGeometry(rad, rad, d.length(), 14), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new V(0, 1, 0), d.normalize()); m.castShadow = true; group.add(m); return m; };
    const pL = new V(-(hw + r), 0, z), pR = new V(hw + r, 0, z), tL = new V(-(hw + r), H + r, z), tR = new V(hw + r, H + r, z);
    tube(pL, tL); tube(pR, tR); tube(new V(-(hw + r) - 0.0, H + r, z), new V(hw + r, H + r, z));
    // back stanchions + bottom/top back rails (visible structure that carries the net)
    const nT = P.netDepthTop, nB = P.netDepthBottom;
    for (const sx of [-1, 1]) { tube(new V(sx * (hw + r), H + r, z), new V(sx * (hw + r), H + r, z - nT), 0.035); tube(new V(sx * (hw + r), H + r, z - nT), new V(sx * (hw + r), 0.0, z - nB), 0.035); tube(new V(sx * (hw + r), 0.0, z - nB), new V(sx * (hw + r), 0.0, z), 0.03); }
    tube(new V(-(hw + r), H + r, z - nT), new V(hw + r, H + r, z - nT), 0.035); tube(new V(-(hw + r), 0, z - nB), new V(hw + r, 0, z - nB), 0.03);
    // paint rings on the posts (red/white band hint)
    return mat;
  }

  function buildFlags(group) {
    const out = [];
    for (const [x, z] of [[-HW, P.goalZ], [HW, P.goalZ], [-HW, P.goalZ + P.length], [HW, P.goalZ + P.length]]) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 1.5, 8), new T.MeshStandardMaterial({ color: FB.color(0xf2f2ec), roughness: 0.5 })); pole.position.set(x, 0.75, z); pole.castShadow = true; group.add(pole);
      const g = new T.PlaneGeometry(0.42, 0.32, 8, 2); g.translate(0.21, 0, 0); const base = g.attributes.position.array.slice();
      const f = new T.Mesh(g, new T.MeshStandardMaterial({ color: FB.color(MAROON), side: T.DoubleSide, roughness: 0.8 })); f.position.set(x, 1.34, z); f.userData.base = base; group.add(f); out.push(f);
    }
    return out;
  }

  const AD_MSGS = ['مدرسة أبو عبيدة الإعدادية للبنين', 'كرة القدم', 'العلم نور… والعمل أمل', 'تعلّم · العب · تفوّق', 'مهارة · انضباط · روح رياضية', 'أجب بتركيز وسجّل هدفك', 'فخورون بطلابنا', 'أبو عبيدة'];
  const EVENT_MSGS = { goal: ['هدف!', 'هدف رائع', 'أبو عبيدة', 'هدف!'], save: ['تصدٍّ رائع', 'الحارس يتألّق', 'تصدٍّ رائع', 'كرة القدم'], chance: ['فرصة!', 'ركّز وسدّد', 'فرصة!', 'كرة القدم'] };
  /** V23: LED advertising all the way round — a continuous pitch-side loop (including the corners) and a 360° fascia ribbon
   *  between the tiers. Both scroll continuously (in opposite directions) and switch to event artwork on goals/saves. */
  function buildAdBoards(group, quality) {
    const tex = { ads: ledTexture(AD_MSGS, 'ads'), goal: ledTexture(EVENT_MSGS.goal, 'goal'), save: ledTexture(EVENT_MSGS.save, 'save'), chance: ledTexture(EVENT_MSGS.chance, 'chance') };
    const fasciaTex = {}; for (const k in tex) { fasciaTex[k] = tex[k].clone(); fasciaTex[k].needsUpdate = true; }
    const ledMat = new T.MeshBasicMaterial({ map: tex.ads, toneMapped: false, side: T.DoubleSide });
    const fasciaMat = new T.MeshBasicMaterial({ map: fasciaTex.ads, toneMapped: false, side: T.DoubleSide, color: FB.color(0xe6e6e6) });
    const dark = new T.MeshStandardMaterial({ color: FB.color(0x14171b), roughness: 0.6, side: T.DoubleSide });
    // pitch-side loop: 1.0 m tall, 4.2 m outside the touchlines and 5.2 m behind the goal lines, 7 m corner radius
    const path = roundRectPath(HW + 4.2, HL + 5.2, 7, quality > 0 ? 0.5 : 1.0), panel = 6.4 * 8;
    const face = new T.Mesh(ribbon(path, 0.06, 1.06, panel), ledMat); face.name = 'ledLoop'; group.add(face);
    const back = new T.Mesh(ribbon(path, 0.0, 1.12, panel, 0.14), dark); group.add(back);
    const lip = new T.Mesh(ribbon(path, 1.06, 1.12, panel, 0.0), dark); group.add(lip);
    // fascia ribbon on the concourse wall under the upper tier (360°)
    const fp = [], N = 260; let s0 = 0, prev = null;
    for (let i = 0; i <= N; i++) { const u = (i / N) * Math.PI * 2, p = ringXZ(59.45, 74.95, u); const q = ringXZ(59.45, 74.95, u + 0.002); const tx = q[0] - p[0], tz = q[1] - p[1], tl = Math.hypot(tx, tz) || 1; if (prev) s0 += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; fp.push({ x: p[0], z: p[1], nx: -tz / tl, nz: tx / tl, s: s0 }); }
    const fascia = new T.Mesh(ribbon(fp, 12.45, 13.5, 2.2 * 8 * 1.2), fasciaMat); fascia.name = 'ledFascia'; group.add(fascia);
    let mode = 'ads', modeT = 0;
    return {
      tex, fasciaTex, face, fascia, loopLength: path[path.length - 1].s,
      /** switch the whole LED system to event artwork for `hold` seconds (no flashing: a single cut and a slow brightness swell) */
      event(kind, hold = 4) { if (!tex[kind]) return; mode = kind; modeT = hold; ledMat.map = tex[kind]; fasciaMat.map = fasciaTex[kind]; },
      update(dt, t) {
        if (modeT > 0) { modeT -= dt; if (modeT <= 0) { mode = 'ads'; ledMat.map = tex.ads; fasciaMat.map = fasciaTex.ads; } }
        const k = mode === 'ads' ? 1 : 1 + 0.12 * Math.sin(t * 2.4);
        ledMat.color.setScalar(k); fasciaMat.color.setScalar(0.9 * k);
        const sp = mode === 'ads' ? 0.010 : 0.022;
        for (const kk in tex) tex[kk].offset.x = (t * sp) % 1;
        for (const kk in fasciaTex) fasciaTex[kk].offset.x = (-t * sp * 0.6) % 1;
      },
      get mode() { return mode; }
    };
  }

  function buildScoreboard(group, end = 0) {
    const c = cvs(1024, 320), x = c.getContext('2d'), tex = ctex(c); const state = { home: 0, away: 0, label: '' };
    const draw = () => {
      x.fillStyle = '#0b0f14'; x.fillRect(0, 0, 1024, 320);
      const g = x.createLinearGradient(0, 0, 1024, 0); g.addColorStop(0, MAROON); g.addColorStop(0.5, '#a3194a'); g.addColorStop(1, MAROON); x.fillStyle = g; x.fillRect(0, 0, 1024, 70);
      x.fillStyle = GOLD; x.fillRect(0, 70, 1024, 5);
      x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = IVORY; x.font = 'bold 40px "Noto Naskh Arabic","Segoe UI",Tahoma,Arial,sans-serif'; x.fillText('مدرسة أبو عبيدة الإعدادية للبنين', 512, 38);
      x.fillStyle = '#e9e4d6'; x.font = 'bold 34px "Noto Naskh Arabic","Segoe UI",Tahoma,Arial,sans-serif'; x.fillText('أبو عبيدة', 790, 130); x.fillText('الضيوف', 234, 130);
      x.fillStyle = '#ffd98a'; x.font = 'bold 150px "DejaVu Sans",Arial,sans-serif'; x.direction = 'ltr'; x.fillText(String(state.home), 760, 225); x.fillText(String(state.away), 264, 225); x.fillText('–', 512, 220);
      x.fillStyle = '#b8c4cc'; x.font = '30px "Noto Naskh Arabic","Segoe UI",Tahoma,Arial,sans-serif'; x.direction = 'rtl'; x.fillText(state.label || 'كرة القدم', 512, 290);
      tex.needsUpdate = true;
    };
    draw();
    const zb = end ? P.goalZ + P.length + 15.2 : P.goalZ - 15.2, sg = end ? -1 : 1, g0 = new T.Group(); g0.position.set(0, 0, zb); if (end) g0.rotation.y = Math.PI; group.add(g0);
    const m = new T.Mesh(new T.PlaneGeometry(16, 5), new T.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.set(0, 28.2, 0); g0.add(m);
    const frame = new T.Mesh(new T.BoxGeometry(16.6, 5.6, 0.4), new T.MeshStandardMaterial({ color: FB.color(0x14171b), metalness: 0.4, roughness: 0.5 })); frame.position.set(0, 28.2, -0.3); g0.add(frame);
    for (const sx of [-7, 7]) { const cable = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 6, 6), new T.MeshStandardMaterial({ color: FB.color(0x222222) })); cable.position.set(sx, 33.2, -0.3); g0.add(cable); }
    return { mesh: m, set(h, a, label) { state.home = h; state.away = a; if (label !== undefined) state.label = label; draw(); } };
  }

  function buildBowl(group, q) {
    const N = q > 1 ? 160 : 96, seat = seatTexture(), conc = concreteTexture(), roofT = roofTexture();
    const seatMat = new T.MeshLambertMaterial({ map: seat, vertexColors: true, side: T.DoubleSide }), concMat = new T.MeshLambertMaterial({ map: conc, vertexColors: true, color: FB.color(0xcfd0d2), side: T.DoubleSide });
    const per = 410;
    // lower tier: stepped
    const st = new Mesher(), co = new Mesher();
    const tier = (d0, y0, ax0, az0, rows, depth, rise, perimeter) => {
      for (let k = 0; k < rows; k++) {
        const a = { ax: ax0 + k * depth, az: az0 + k * depth, y: y0 + k * rise }, b = { ax: ax0 + (k + 1) * depth, az: az0 + (k + 1) * depth, y: y0 + k * rise };
        const shade = 0.82 + 0.18 * (k % 2);
        st.strip(a, b, N, { perimeter, uvScale: [1 / 4, 1 / 4], color: [shade, shade, shade], flip: false });
        co.strip({ ax: b.ax, az: b.az, y: b.y }, { ax: b.ax, az: b.az, y: y0 + (k + 1) * rise }, N, { perimeter, uvScale: [1 / 205, 1], v0: 0, v1: 1, color: [shade, shade, shade], flip: true });
      }
    };
    tier(0, 1.2, 44, 59.5, 20, 0.78, 0.46, per);                    // lower
    tier(0, 13.5, 60, 75.5, 26, 0.78, 0.62, per * 1.2);               // upper
    // risers carry the seat-back pattern (what the camera mostly sees); treads are dark concrete
    const geomSeat = co.geometry(); const seats = new T.Mesh(geomSeat, seatMat); seats.receiveShadow = false; group.add(seats);
    const geomC = st.geometry(); const risers = new T.Mesh(geomC, new T.MeshLambertMaterial({ map: conc, vertexColors: true, color: FB.color(0x6b6d72), side: T.DoubleSide })); group.add(risers);
    // concourse band between the tiers + upper back wall
    const cm = new Mesher();
    cm.strip({ ax: 59.6, az: 75.1, y: 10.4 }, { ax: 59.6, az: 75.1, y: 13.5 }, N, { perimeter: per, uvScale: [1 / 3, 1 / 3], flip: true });
    cm.strip({ ax: 59.6, az: 75.1, y: 10.4 }, { ax: 60, az: 75.5, y: 10.4 }, N, { perimeter: per });
    cm.strip({ ax: 80.4, az: 96, y: 30 }, { ax: 80.4, az: 96, y: 14 }, N, { perimeter: per * 1.3, uvScale: [1 / 4, 1 / 4], flip: false });
    const gC = cm.geometry(); const concourse = new T.Mesh(gC, new T.MeshLambertMaterial({ map: conc, vertexColors: true, color: FB.color(0xb9bbbf), side: T.DoubleSide })); group.add(concourse);
    // vomitories (dark openings) in the concourse wall
    const vom = new T.InstancedMesh(new T.BoxGeometry(3.2, 2.4, 0.4), new T.MeshBasicMaterial({ color: FB.color(0x07090c) }), 36); const dm = new T.Object3D();
    for (let i = 0; i < 36; i++) { const u = (i / 36) * Math.PI * 2 + 0.05, p = ringXZ(59.7, 75.2, u), pn = ringXZ(60.4, 76, u + 0.001); dm.position.set(p[0], 11.1, p[1]); dm.rotation.y = Math.atan2(CZ - p[1], -p[0]) + 0; dm.lookAt(0, 11.1, CZ); dm.updateMatrix(); vom.setMatrixAt(i, dm.matrix); }
    group.add(vom);
    // advertising fascia rings (LED strip) under the upper tier + gold trim
    const trim = new Mesher(); trim.strip({ ax: 59.5, az: 75, y: 13.62 }, { ax: 59.5, az: 75, y: 13.5 }, N, { perimeter: per }); trim.strip({ ax: 59.5, az: 75, y: 12.45 }, { ax: 59.5, az: 75, y: 12.33 }, N, { perimeter: per }); trim.strip({ ax: 44, az: 59.5, y: 1.15 }, { ax: 44, az: 59.5, y: 0.0 }, N, { perimeter: per, flip: true });
    const trimMesh = new T.Mesh(trim.geometry(), new T.MeshStandardMaterial({ color: FB.color(GOLD), metalness: 0.65, roughness: 0.35, side: T.DoubleSide })); group.add(trimMesh);
    // roof: tensile membrane + girder
    const rf = new Mesher();
    rf.strip({ ax: 50, az: 65.5, y: 34.5 }, { ax: 88, az: 103.5, y: 41 }, N, { perimeter: per * 1.45, uvScale: [1 / 70, 1], flip: false, color: [1, 1, 1] });
    const roofMat = new T.MeshLambertMaterial({ map: roofT, side: T.DoubleSide, vertexColors: true, emissive: FB.color(0x2b2a27), emissiveIntensity: 0.4 });
    const roof = new T.Mesh(rf.geometry(), roofMat); group.add(roof);
    const ring = new Mesher(); ring.strip({ ax: 50, az: 65.5, y: 34.5 }, { ax: 50, az: 65.5, y: 33.0 }, N, { perimeter: per }); ring.strip({ ax: 50, az: 65.5, y: 33.0 }, { ax: 50.4, az: 66, y: 33.0 }, N, { perimeter: per });
    const girder = new T.Mesh(ring.geometry(), new T.MeshStandardMaterial({ color: FB.color(0xe9e4d6), metalness: 0.3, roughness: 0.4, side: T.DoubleSide })); group.add(girder);
    // roof support masts (distinct Qatar-style tent poles, slightly canted)
    const masts = new T.InstancedMesh(new T.CylinderGeometry(0.35, 0.55, 36, 8), new T.MeshStandardMaterial({ color: FB.color(0xd9d4c6), metalness: 0.4, roughness: 0.4 }), 28);
    for (let i = 0; i < 28; i++) { const u = (i / 28) * Math.PI * 2, p = ringXZ(82, 98, u); dm.position.set(p[0], 18, p[1]); dm.rotation.set(0, 0, 0); dm.lookAt(0, 18, CZ); dm.rotateX(0); dm.updateMatrix(); masts.setMatrixAt(i, dm.matrix); }
    group.add(masts);
    return { seats, roof, concourse, roofMat, seatMat };
  }

  function buildFloodlights(group, q) {
    // emissive lamp banks hanging from the roof edge, plus additive glow sprites
    const count = q > 1 ? 56 : 28, geo = new T.BoxGeometry(1.6, 0.9, 0.3), mat = new T.MeshBasicMaterial({ color: FB.color(0xfff6dc), toneMapped: false });
    const im = new T.InstancedMesh(geo, mat, count), dm = new T.Object3D(), glowC = cvs(128, 128), gx = glowC.getContext('2d'); const gr = gx.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,246,220,0.95)'); gr.addColorStop(0.25, 'rgba(255,236,190,0.35)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
    const glowMat = new T.SpriteMaterial({ map: ctex(glowC), blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7, fog: false });
    for (let i = 0; i < count; i++) {
      const u = (i / count) * Math.PI * 2, p = ringXZ(49.6, 65, u); dm.position.set(p[0], 33.6, p[1]); dm.lookAt(0, 0, CZ); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix);
      if (i % 2 === 0) { const s = new T.Sprite(glowMat); s.position.set(p[0], 33.6, p[1]); s.scale.set(9, 9, 1); group.add(s); }
    }
    group.add(im); return { im, glowMat };
  }

  function buildDugouts(group) {
    const mat = new T.MeshStandardMaterial({ color: FB.color(0x24292e), roughness: 0.6 }), glass = new T.MeshStandardMaterial({ color: FB.color(0x9fd0e0), transparent: true, opacity: 0.28, roughness: 0.1 });
    const seatM = new T.MeshStandardMaterial({ color: FB.color(0x8a1538), roughness: 0.7 });
    for (const sx of [-1, 1]) for (const dz of [-7, 7]) {
      const g = new T.Group(); g.position.set(sx * (HW + 8.5), 0, CZ + dz);
      const back = new T.Mesh(new T.BoxGeometry(0.15, 2.2, 6.2), glass); back.position.set(sx * 1.3, 1.1, 0); g.add(back);
      const roof = new T.Mesh(new T.BoxGeometry(2.8, 0.12, 6.4), mat); roof.position.set(0, 2.25, 0); g.add(roof);
      const bench = new T.Mesh(new T.BoxGeometry(0.6, 0.12, 5.6), seatM); bench.position.set(sx * 0.5, 0.5, 0); g.add(bench);
      for (let i = -2; i <= 2; i++) { const b = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.5), seatM); b.position.set(sx * 0.9, 0.9, i * 1.1); g.add(b); }
      group.add(g);
    }
  }
  function buildTunnel(group) {
    const g = new T.Group(); g.position.set(HW + 14, 0, CZ - 0); const mat = new T.MeshStandardMaterial({ color: FB.color(0x1a1d21), roughness: 0.7 });
    const hole = new T.Mesh(new T.BoxGeometry(0.4, 3.4, 5.2), new T.MeshBasicMaterial({ color: FB.color(0x040507) })); hole.position.set(0, 1.7, 0); g.add(hole);
    const top = new T.Mesh(new T.BoxGeometry(0.6, 0.4, 6.0), new T.MeshStandardMaterial({ color: FB.color(GOLD), metalness: 0.6, roughness: 0.4 })); top.position.set(-0.1, 3.5, 0); g.add(top);
    group.add(g);
  }

  function buildSky(scene, q) {
    const c = cvs(16, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#060b1a'); g.addColorStop(0.45, '#0e1d3c'); g.addColorStop(0.75, '#25406a'); g.addColorStop(0.93, '#6a6f86'); g.addColorStop(1, '#c19a78'); x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const tex = ctex(c); const sky = new T.Mesh(new T.SphereGeometry(900, 24, 16), new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false, depthWrite: false })); sky.position.set(0, 0, CZ); sky.rotation.y = 0;
    sky.geometry.attributes.uv; sky.renderOrder = -10; scene.add(sky); return sky;
  }

  /* ---------------- public ---------------- */
  /** quality: {level:0|1|2, shadow:int, crowd:int} */
  function build(scene, quality = {}) {
    const q = quality.level === undefined ? 2 : quality.level;
    const group = new T.Group(); group.name = 'stadium'; scene.add(group);
    scene.background = new T.Color(0x0a1226); scene.fog = new T.FogExp2(FB.color(0x1a2b4a), q > 0 ? 0.0042 : 0.006);
    const sky = buildSky(scene, q);
    const pit = buildPitch(group, q), goalMat = buildGoal(group), flags = buildFlags(group), boards = buildAdBoards(group, q), score = buildScoreboard(group, 0), score2 = buildScoreboard(group, 1);
    const bowl = buildBowl(group, q), lights = buildFloodlights(group, q); buildDugouts(group); buildTunnel(group);
    const net = new FB.Net({ q: q > 1 ? 1 : 0.7 }); group.add(net.group);
    // light rig: warm hemisphere + a strong floodlight key with soft shadows that follows the action
    const hemi = new T.HemisphereLight(FB.color(0xcfe0ff), FB.color(0x35502f), 0.72); scene.add(hemi);
    const key = new T.DirectionalLight(FB.color(0xfff2dc), 1.55); key.position.set(18, 40, 12); key.target.position.set(0, 0, P.goalZ + 14); scene.add(key, key.target);
    if (quality.shadow) { key.castShadow = true; key.shadow.mapSize.set(quality.shadow, quality.shadow); const s = key.shadow.camera; s.left = -16; s.right = 16; s.top = 16; s.bottom = -16; s.near = 10; s.far = 90; key.shadow.bias = -0.00035; key.shadow.normalBias = 0.03; key.shadow.radius = 2.5; }
    const fill = new T.DirectionalLight(FB.color(0xbfd4ff), 0.38); fill.position.set(-20, 25, 40); scene.add(fill);
    const api = {
      group, sky, pitch: pit.pitch, net, key, hemi, fill, score, score2, boards,
      ledEvent(kind, hold) { boards.event(kind, hold); },
      setScore(h, a, label) { score.set(h, a, label); score2.set(h, a, label); }, flags, bowl, lights, quality: q,
      focus(x, z) { // keep the shadow frustum centred on the action (snapped to texels to avoid shimmering)
        const k = key, sz = 32 / (quality.shadow || 1024); const sx = Math.round(x / sz) * sz, szz = Math.round(z / sz) * sz;
        k.target.position.set(sx, 0, szz); k.position.set(sx + 18, 40, szz + 12);
      },
      update(dt, t) {
        net.update(dt);
        const f = Math.sin(t * 2.2); for (const fl of flags) { const p = fl.geometry.attributes.position, b = fl.userData.base; for (let i = 0; i < p.count; i++) { const x = b[i * 3], k = x / 0.42; p.setY(i, b[i * 3 + 1] + Math.sin(t * 5 - x * 12) * 0.03 * k * (1 + 0.3 * f)); p.setZ(i, Math.cos(t * 4.3 - x * 9) * 0.025 * k); } p.needsUpdate = true; }
        boards.update(dt, t);
      },
      dispose() { scene.remove(group, hemi, key, key.target, fill, sky); net.dispose(); for (const k in boards.tex) { boards.tex[k].dispose(); boards.fasciaTex[k].dispose(); } group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { for (const m of Array.isArray(o.material) ? o.material : [o.material]) { for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].dispose(); m.dispose(); } } }); }
    };
    return api;
  }
  FB.Stadium = { build, ringXZ, Mesher };
})(typeof window !== 'undefined' ? window : globalThis);
