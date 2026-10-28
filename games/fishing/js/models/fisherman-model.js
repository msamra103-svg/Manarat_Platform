/* صيد الأسماك V24 — original procedural adult male angler (≈1.76 m): sculpted head, short beard, cap,
 * long-sleeve shirt with rolled cuffs, inflatable-style life jacket, cargo trousers and deck shoes.
 * Rigid-skin articulated rig with named joints; the game drives it with analytic two-bone IK so hands
 * stay on the rod / reel / net. Exported to assets/models/fisherman.glb (this builder is the fallback).
 * Character frame: +Z forward, +Y up, +X = character's left. Joints point their child along -Y.
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const SKIN = '#b98260';
  function tex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
  function fabric(color, lines, rep = [3, 3]) { return tex(256, 256, (g, w, h) => { g.fillStyle = color; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = y % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(0, y, w, 1); } for (let x = 0; x < w; x += 3) { g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(x, 0, 1, h); } if (lines) lines(g, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, rep); }
  const mats = {};
  function materials() {
    if (mats.skin) return mats;
    mats.skin = new T.MeshStandardMaterial({ map: tex(512, 256, (g, w, h) => { g.fillStyle = SKIN; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(120,60,40,0.06)' : 'rgba(255,220,200,0.05)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } }), roughness: 0.58, name: 'skin' });
    mats.face = new T.MeshStandardMaterial({ map: tex(512, 512, (g, w, h) => { g.fillStyle = SKIN; g.fillRect(0, 0, w, h);
      // equirect: u around (front = 0.75), v from top. cheeks/nose warmth, beard shadow on the lower face
      const front = w * 0.75; const r = g.createRadialGradient(front, h * 0.55, 10, front, h * 0.55, 120); r.addColorStop(0, 'rgba(190,90,70,0.20)'); r.addColorStop(1, 'rgba(190,90,70,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const x = front + (Math.random() - 0.5) * w * 0.55, y = h * (0.6 + Math.random() * 0.4); if (Math.abs(x - front) < 22 && y < h * 0.66) continue; g.fillStyle = 'rgba(40,28,20,0.16)'; g.fillRect(x, y, 1, 2); }
      for (let i = 0; i < 2500; i++) { g.fillStyle = 'rgba(120,60,40,0.05)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } }), roughness: 0.55, name: 'face' });
    mats.shirt = new T.MeshStandardMaterial({ map: fabric('#cbd8df'), roughness: 0.85, name: 'shirt' });
    mats.trousers = new T.MeshStandardMaterial({ map: fabric('#857756', (g, w) => { g.strokeStyle = 'rgba(40,30,15,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.5, 0); g.lineTo(w * 0.5, 256); g.stroke(); }), roughness: 0.9, name: 'trousers' });
    mats.vest = new T.MeshStandardMaterial({ map: tex(512, 256, (g, w, h) => { g.fillStyle = '#e4621d'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, y, w, 1); } [0.55].forEach(v => { g.fillStyle = '#c9cfd2'; g.fillRect(0, h * v, w, 12); }); g.fillStyle = '#1d1f22'; g.fillRect(w * 0.745, 0, 6, h); for (let y = 0; y < h; y += 6) { g.fillStyle = '#5a5f63'; g.fillRect(w * 0.745 - 2, y, 10, 2); } for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(i * w / 18, 0); g.lineTo(i * w / 18, h); g.stroke(); } }), roughness: 0.65, name: 'life-jacket' });
    mats.strap = new T.MeshStandardMaterial({ color: '#16191c', roughness: 0.7, name: 'strap' });
    mats.buckle = new T.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.4, metalness: 0.3, name: 'buckle' });
    mats.cap = new T.MeshStandardMaterial({ map: fabric('#24384f', null, [4, 2]), roughness: 0.85, name: 'cap' });
    mats.hair = new T.MeshStandardMaterial({ map: tex(256, 256, (g, w, h) => { g.fillStyle = '#1f1712'; g.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { g.strokeStyle = Math.random() < 0.5 ? 'rgba(80,60,45,0.4)' : 'rgba(0,0,0,0.4)'; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y + 5); g.stroke(); } }), roughness: 0.95, name: 'hair' });
    mats.eye = new T.MeshStandardMaterial({ map: tex(128, 128, (g) => { g.fillStyle = '#f2eee6'; g.fillRect(0, 0, 128, 128); const r = g.createRadialGradient(64, 64, 4, 64, 64, 30); r.addColorStop(0, '#060606'); r.addColorStop(0.35, '#060606'); r.addColorStop(0.42, '#4a2e1a'); r.addColorStop(0.9, '#2a1a0f'); r.addColorStop(1, '#f2eee6'); g.fillStyle = r; g.beginPath(); g.arc(64, 64, 30, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(56, 56, 5, 0, 7); g.fill(); }), roughness: 0.08, name: 'eye' });
    mats.lip = new T.MeshStandardMaterial({ color: '#8f5446', roughness: 0.45, name: 'lip' });
    mats.shoe = new T.MeshStandardMaterial({ color: '#5a412c', roughness: 0.6, name: 'shoe-leather' });
    mats.sole = new T.MeshStandardMaterial({ color: '#efece4', roughness: 0.8, name: 'shoe-sole' });
    mats.watch = new T.MeshStandardMaterial({ color: '#202428', roughness: 0.3, metalness: 0.6, name: 'watch' });
    return mats;
  }
  function lathe(profile, seg, mat, zScale = 1, name) { const g = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(Math.max(0.0005, r), y)), seg); if (zScale !== 1) g.scale(1, 1, zScale); const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; return m; }
  function joint(parent, name, x, y, z) { const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; }
  function smoothProfile(pts, n = 3) { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < n; k++) { const t = k / n, a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)]; const f = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); out.push([f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])]); } out.push(pts[pts.length - 1]); return out; }

  /* ---------- head ---------- */
  const sq = v => v * v, HS = [0.079, 0.113, 0.1];
  function deform(x, y, z) { // unit-sphere point → sculpted head point (metres)
    const ax = Math.abs(x);
    if (y < 0) { const k = Math.pow(-y, 1.4); x *= 1 - 0.19 * k; z *= 1 - 0.06 * k; }
    if (z < 0 && y > -0.25) z *= 1.08;
    if (y > 0.35 && z > 0) z *= 0.97;
    if (z > 0) {
      z += 0.12 * Math.exp(-sq((y + 0.82) / 0.2) - sq(x / 0.38));
      z += 0.24 * Math.exp(-sq(x / 0.1) - sq((y + 0.08) / 0.22)) * Math.max(0, z);
      z += 0.05 * Math.exp(-sq(x / 0.2) - sq((y + 0.27) / 0.07));
      z += 0.055 * Math.exp(-sq((y - 0.27) / 0.08) - sq(x / 0.62));
      z -= 0.07 * Math.exp(-sq((ax - 0.36) / 0.15) - sq((y - 0.15) / 0.11));
      z += 0.045 * Math.exp(-sq(x / 0.3) - sq((y + 0.47) / 0.12));
      x += Math.sign(x) * 0.04 * Math.exp(-sq((ax - 0.62) / 0.2) - sq((y + 0.02) / 0.2));
    }
    return [x * HS[0], y * HS[1], z * HS[2]];
  }
  function surface(ux, uy) { const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy)); return deform(ux, uy, uz); }
  function headGeometry() { const g = new T.SphereGeometry(1, 64, 48), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const d = deform(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, d[0], d[1], d[2]); } g.computeVertexNormals(); return g; }
  function faceTexture() {
    const W = 512, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const skin = new T.Color(SKIN), hair = new T.Color('#1d1510'), lip = new T.Color('#9a5a4b'), blush = new T.Color('#c27a62');
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const u = px / W, v = 1 - py / H, phi = u * Math.PI * 2, th = (1 - v) * Math.PI;
      const x = -Math.cos(phi) * Math.sin(th), y = Math.cos(th), z = Math.sin(phi) * Math.sin(th), ax = Math.abs(x), n = rnd();
      let col = skin.clone();
      col.lerp(blush, 0.35 * Math.exp(-sq((ax - 0.5) / 0.22) - sq((y + 0.08) / 0.18)) * (z > 0 ? 1 : 0) + 0.25 * Math.exp(-sq(x / 0.12) - sq((y + 0.1) / 0.15)) * (z > 0.7 ? 1 : 0));
      const ss = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
      // hair: back + sides below the cap, sideburns joining a short trimmed beard
      const back = ss(0.32, 0.12, z) * ss(-0.5, -0.3, y + 0.25 * Math.max(0, z));
      const side = ss(0.72, 0.84, ax) * ss(-0.25, -0.1, y) * ss(0.6, 0.4, z);
      const beardEdge = -0.2 - 0.2 * Math.max(0, 0.6 - ax);
      const beard = ss(-0.12, 0.05, z) * ss(beardEdge + 0.05, beardEdge - 0.04, y);
      const mous = ss(0.55, 0.7, z) * ss(0.38, 0.3, ax) * ss(-0.39, -0.36, y) * ss(-0.27, -0.3, y);
      const lipAmt = ss(0.6, 0.72, z) * ss(0.25, 0.2, ax) * ss(0.045, 0.02, Math.abs(y + 0.425));
      const hairAmt = Math.max(back * 0.95, side * 0.9, beard * (0.55 + 0.25 * n), mous * 0.85);
      col.lerp(hair, hairAmt * (0.82 + 0.18 * n));
      col.lerp(lip, lipAmt * 0.75);
      const k = (rnd() - 0.5) * 0.04; const i = (py * W + px) * 4; d[i] = Math.min(255, (col.r + k) * 255); d[i + 1] = Math.min(255, (col.g + k) * 255); d[i + 2] = Math.min(255, (col.b + k) * 255); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  function buildHead(head) {
    const M = materials(), c = new T.Group(); c.name = 'head-geo'; c.position.set(0, 0.098, 0.014); head.add(c);
    const faceMat = new T.MeshStandardMaterial({ map: faceTexture(), roughness: 0.56, name: 'face' });
    const skull = new T.Mesh(headGeometry(), faceMat); skull.castShadow = true; skull.name = 'face'; c.add(skull);
    const mouth = new T.Group(); mouth.name = 'mouth'; const mp = surface(0, -0.415); mouth.position.set(mp[0], mp[1], mp[2] + 0.001); c.add(mouth);
    const lip = new T.Mesh(new T.TorusGeometry(0.017, 0.0022, 5, 16, Math.PI * 0.6), new T.MeshStandardMaterial({ color: '#4a2620', roughness: 0.6, name: 'mouth-line' })); lip.rotation.z = Math.PI + Math.PI * 0.2; lip.scale.set(1, 0.3, 0.4); lip.position.y = 0.0045; lip.name = 'lip'; mouth.add(lip);
    [-1, 1].forEach(s => {
      const side = s > 0 ? 'L' : 'R', ep = surface(s * 0.36, 0.15), er = 0.0104;
      const eye = new T.Mesh(new T.SphereGeometry(er, 20, 14), M.eye); eye.name = 'eye_' + side; eye.position.set(ep[0], ep[1], ep[2] - 0.0062); eye.rotation.y = -Math.PI / 2; c.add(eye);
      const lid = new T.Group(); lid.name = 'eyelid_' + side; lid.position.copy(eye.position); c.add(lid);
      const lm = new T.Mesh(new T.SphereGeometry(er + 0.0013, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), faceMat); lm.rotation.x = -0.35; lid.add(lm);
      const bp = surface(s * 0.33, 0.29); const brow = new T.Mesh(new T.BoxGeometry(0.03, 0.0045, 0.006), M.hair); brow.name = 'brow_' + side; brow.position.set(bp[0], bp[1], bp[2] + 0.002); brow.rotation.set(-0.2, s * 0.25, -s * 0.08); c.add(brow);
      const ear = new T.Mesh(new T.SphereGeometry(1, 14, 10), M.skin); ear.position.set(s * 0.077, 0.004, -0.01); ear.scale.set(0.011, 0.029, 0.018); ear.rotation.y = s * 0.3; c.add(ear);
    });
    const cap = new T.Group(); cap.name = 'cap'; c.add(cap);
    const crown = new T.Mesh(new T.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), M.cap); crown.scale.set(0.086, 0.078, 0.112); crown.position.set(0, 0.04, -0.008); crown.castShadow = true; cap.add(crown);
    const vis = []; const vi = []; const N = 18; for (let i = 0; i <= N; i++) { const a = (-0.5 + i / N) * Math.PI * 0.9, ix = Math.sin(a) * 0.085, iz = Math.cos(a) * 0.111 - 0.008, ox = Math.sin(a) * 0.092, oz = iz + Math.cos(a) * Math.cos(a) * 0.062; vis.push(ix, 0.043, iz, ox, 0.034 - 0.01 * Math.cos(a), oz); if (i) { const k = (i - 1) * 2; vi.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const vg = new T.BufferGeometry(); vg.setAttribute('position', new T.Float32BufferAttribute(vis, 3)); vg.setIndex(vi); vg.computeVertexNormals(); vg.computeVertexNormals(); const nn = vg.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0.15); const visor = new T.Mesh(vg, new T.MeshStandardMaterial({ color: '#22364b', roughness: 0.85, side: T.DoubleSide, name: 'cap-visor' })); visor.castShadow = true; cap.add(visor);
    return c;
  }

  /* ---------- hand (closed grip around a cylinder along local X) ---------- */
  function handGeometry(side) {
    const parts = [], s = side; // side: -1 right hand, +1 left hand (mirror)
    const palm = new T.SphereGeometry(1, 16, 12); palm.scale(0.036, 0.046, 0.017); palm.translate(0, -0.052, 0.002); parts.push(palm);
    const wrist = new T.CylinderGeometry(0.026, 0.028, 0.03, 12); wrist.scale(1, 1, 0.7); wrist.translate(0, -0.012, 0); parts.push(wrist);
    const gripC = new T.Vector3(0, -0.086, 0.022);
    [-0.026, -0.009, 0.008, 0.024].forEach((fx, i) => {
      const len = [0.95, 1.05, 1.0, 0.82][i], r = 0.0088 - i * 0.0003, pts = [];
      for (let k = 0; k <= 8; k++) { const a = -2.3 + k / 8 * 3.3 * len; pts.push(new T.Vector3(fx, gripC.y + Math.cos(a) * 0.024, gripC.z + Math.sin(a) * 0.024)); }
      pts[0].set(fx, -0.082, -0.004); const tube = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, r, 8, false); parts.push(tube);
      const tip = new T.SphereGeometry(r, 8, 6); const e = pts[pts.length - 1]; tip.translate(e.x, e.y, e.z); parts.push(tip);
    });
    const tpts = [new T.Vector3(0.03, -0.035, 0.012), new T.Vector3(0.04, -0.06, 0.03), new T.Vector3(0.045, -0.078, 0.046), new T.Vector3(0.05, -0.088, 0.052)]; parts.push(new T.TubeGeometry(new T.CatmullRomCurve3(tpts), 10, 0.0098, 8, false)); const tt = new T.SphereGeometry(0.0098, 8, 6); tt.translate(0.05, -0.088, 0.052); parts.push(tt);
    // merge
    let pos = [], nrm = [], idx = [], off = 0;
    for (const g of parts) { const p = g.attributes.position, n = g.attributes.normal; const mx = s < 0 ? 1 : -1; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i) * mx, p.getY(i), p.getZ(i)); nrm.push(n.getX(i) * mx, n.getY(i), n.getZ(i)); } const ix = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i); for (let i = 0; i < ix.length; i += 3) { if (s < 0) idx.push(ix[i] + off, ix[i + 1] + off, ix[i + 2] + off); else idx.push(ix[i] + off, ix[i + 2] + off, ix[i + 1] + off); } off += p.count; }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3)); geo.setIndex(idx); return geo;
  }

  function build() {
    const M = materials(), man = new T.Group(); man.name = 'fisherman';
    const hips = joint(man, 'hips', 0, 0.95, 0), spine = joint(hips, 'spine', 0, 0.09, 0), chest = joint(spine, 'chest', 0, 0.2, 0), neck = joint(chest, 'neck', 0, 0.25, -0.01), head = joint(neck, 'head', 0, 0.1, 0.01);
    // torso
    hips.add(lathe(smoothProfile([[0.145, -0.1], [0.158, -0.06], [0.163, 0.0], [0.152, 0.1]]), 28, M.trousers, 0.66, 'pelvis'));
    const crotch = new T.Mesh(new T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.trousers); crotch.scale.set(0.15, 0.06, 0.1); crotch.position.y = -0.095; hips.add(crotch);
    const belt = lathe([[0.155, 0.085], [0.157, 0.1], [0.155, 0.115]], 28, M.strap, 0.71, 'belt'); hips.add(belt);
    spine.add(lathe(smoothProfile([[0.15, -0.02], [0.152, 0.08], [0.16, 0.2], [0.162, 0.22]]), 28, M.shirt, 0.68, 'abdomen'));
    chest.add(lathe(smoothProfile([[0.16, 0.0], [0.172, 0.08], [0.178, 0.16], [0.168, 0.21], [0.12, 0.245], [0.06, 0.26]]), 30, M.shirt, 0.62, 'chest-shirt'));
    // life jacket (two shells so it bends with the spine) + straps + buckles + collar
    spine.add(lathe(smoothProfile([[0.17, 0.0], [0.172, 0.1], [0.18, 0.21]]), 30, M.vest, 0.72, 'vest-lower'));
    const vu = lathe(smoothProfile([[0.18, -0.01], [0.192, 0.08], [0.196, 0.15], [0.17, 0.205], [0.11, 0.235]]), 30, M.vest, 0.66, 'vest-upper'); chest.add(vu);
    [-1, 1].forEach(s => { const st = new T.Mesh(new T.TorusGeometry(0.075, 0.016, 6, 16, Math.PI), M.vest); st.position.set(s * 0.1, 0.215, -0.002); st.rotation.set(0, Math.PI / 2, 0); st.scale.set(1.0, 0.75, 1.3); st.castShadow = true; chest.add(st); });
    [0.09].forEach(y => { const s = lathe([[0.199, y - 0.008], [0.2, y], [0.199, y + 0.008]], 30, M.strap, 0.67); s.scale.set(1.0, 1, 1.0); chest.add(s); const b = new T.Mesh(new T.BoxGeometry(0.04, 0.026, 0.012), M.buckle); b.position.set(0.0, y, 0.134); chest.add(b); });
    const collar = lathe([[0.075, 0.24], [0.08, 0.27], [0.07, 0.29]], 20, M.shirt, 0.9, 'collar'); chest.add(collar);
    neck.add(lathe([[0.052, -0.02], [0.05, 0.06], [0.054, 0.12]], 18, M.skin, 0.95, 'neck-skin'));
    buildHead(head);
    // arms
    [['R', -1], ['L', 1]].forEach(([S, s]) => {
      const up = joint(chest, 'upperArm_' + S, s * 0.19, 0.185, -0.012), fore = joint(up, 'foreArm_' + S, 0, -0.29, 0), hand = joint(fore, 'hand_' + S, 0, -0.255, 0);
      const delt = new T.Mesh(new T.SphereGeometry(0.064, 18, 14), M.vest); delt.scale.set(1, 0.9, 0.95); delt.position.set(0, -0.015, 0); delt.castShadow = true; up.add(delt);
      up.add(lathe(smoothProfile([[0.046, -0.29], [0.05, -0.22], [0.056, -0.12], [0.058, -0.04], [0.05, 0.0]]).map(([r, y]) => [r, y]), 20, M.shirt, 1, 'sleeve'));
      const elbow = new T.Mesh(new T.SphereGeometry(0.046, 14, 10), M.shirt); elbow.position.y = -0.29; up.add(elbow);
      fore.add(lathe([[0.049, -0.07], [0.052, -0.04], [0.05, 0.0]], 18, M.shirt, 1, 'cuff'));
      fore.add(lathe(smoothProfile([[0.029, -0.255], [0.033, -0.2], [0.041, -0.1], [0.043, -0.06]]), 18, M.skin, 0.85, 'forearm'));
      if (s > 0) { const w = lathe([[0.034, -0.235], [0.035, -0.215]], 18, M.watch, 0.85, 'watch'); fore.add(w); }
      const hm = new T.Mesh(handGeometry(s < 0 ? -1 : 1), M.skin); hm.name = 'hand-geo_' + S; hm.castShadow = true; hand.add(hm);
    });
    // legs
    [['R', -1], ['L', 1]].forEach(([S, s]) => {
      const th = joint(hips, 'thigh_' + S, s * 0.095, -0.045, 0), sh = joint(th, 'shin_' + S, 0, -0.43, 0), ft = joint(sh, 'foot_' + S, 0, -0.41, 0);
      th.add(lathe(smoothProfile([[0.06, -0.43], [0.068, -0.35], [0.083, -0.18], [0.09, -0.06], [0.085, 0.03]]), 22, M.trousers, 0.95, 'thigh'));
      const pocket = new T.Mesh(new T.BoxGeometry(0.012, 0.1, 0.085), M.trousers); pocket.position.set(s * 0.083, -0.22, 0.0); th.add(pocket);
      const knee = new T.Mesh(new T.SphereGeometry(0.06, 14, 10), M.trousers); knee.position.y = -0.43; th.add(knee);
      sh.add(lathe(smoothProfile([[0.06, -0.41], [0.055, -0.36], [0.052, -0.28], [0.062, -0.12], [0.06, 0.0]]), 20, M.trousers, 0.95, 'shin'));
      const sole = new T.Mesh(new T.BoxGeometry(0.098, 0.026, 0.27), M.sole); sole.position.set(0, -0.058, 0.05); sole.castShadow = true; ft.add(sole);
      const upper = new T.Mesh(new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.shoe); upper.scale.set(0.05, 0.07, 0.135); upper.position.set(0, -0.046, 0.05); upper.castShadow = true; ft.add(upper);
      const ankle = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 0.06, 14), M.shoe); ankle.position.y = -0.02; ft.add(ankle);
    });
    man.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return man;
  }
  const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArm_R', 'foreArm_R', 'hand_R', 'upperArm_L', 'foreArm_L', 'hand_L', 'thigh_R', 'shin_R', 'foot_R', 'thigh_L', 'shin_L', 'foot_L', 'eye_L', 'eye_R', 'eyelid_L', 'eyelid_R', 'brow_L', 'brow_R', 'mouth'];
  root.FishingFishermanModel = { build, BONES, LIMBS: { upperArm: 0.29, foreArm: 0.255, thigh: 0.43, shin: 0.41, gripOffset: [0, -0.086, 0.022] } };
})(typeof window !== 'undefined' ? window : globalThis);
