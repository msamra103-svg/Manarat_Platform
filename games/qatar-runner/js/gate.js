/* عدّاء قطر — the smart question gate (luminous Islamic-lattice arch with two light wings and a floating 3D
 * Arabic question mark ؟), its effects (opening, rejection light-wave, particles), and the finish arch + confetti.
 */
(function (root) {
  'use strict';
  const T = root.THREE, X = root.QRTex, P = root.QRProps, C = P.C;
  const add = (THREE_BLEND) => THREE_BLEND;
  const lat = X.lattice('#d9d0c2', 7, '#f6f3ec'); lat.repeat.set(0.55, 0.55);
  const latNeon = X.lattice('#ffffff', 10, '#000000');
  const glowTex = X.glow('rgba(255,255,255,1)');
  function sprite(color, size, opacity = 0.9) { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending })); s.scale.setScalar(size); return s; }
  function textPlane(text, w, h, opts) { const t = X.sign(text, opts); const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: new T.Color(1, 1, 1), emissiveMap: t, emissiveIntensity: 0.6 })); return m; }
  function questionMark() { // Arabic question mark ؟ (mirror image of the Latin "?")
    const pts = [[0.55, 1.15], [0.42, 1.45], [0.05, 1.62], [-0.38, 1.5], [-0.55, 1.15], [-0.42, 0.84], [-0.08, 0.66], [0.0, 0.44], [0.0, 0.3]].map(([x, y]) => new T.Vector3(x, y, 0));
    const g = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: C('#ffd66b'), emissive: C('#ffb22c'), emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.4 });
    const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.13, 12), mat); g.add(tube);
    for (const end of [pts[0], pts[pts.length - 1]]) { const cap = new T.Mesh(new T.SphereGeometry(0.13, 12, 8), mat); cap.position.copy(end); g.add(cap); }
    const dot = new T.Mesh(new T.SphereGeometry(0.18, 16, 12), mat); dot.position.set(0, 0.0, 0); g.add(dot);
    g.userData.mat = mat; return g;
  }
  class Gate {
    constructor() {
      const g = this.group = new T.Group(); g.name = 'question-gate';
      const W = 5.25, Hp = 5.0, apex = 7.7;
      // frame: pillars + pointed arch, one extruded shape with the opening as a hole
      const sh = new T.Shape(); sh.moveTo(-W - 0.9, 0); sh.lineTo(-W - 0.9, Hp); sh.quadraticCurveTo(-W - 0.9, apex + 0.3, 0, apex + 1.05); sh.quadraticCurveTo(W + 0.9, apex + 0.3, W + 0.9, Hp); sh.lineTo(W + 0.9, 0); sh.closePath();
      const hole = new T.Path(); hole.moveTo(-W, 0); hole.lineTo(-W, Hp); hole.quadraticCurveTo(-W, apex - 0.4, 0, apex); hole.quadraticCurveTo(W, apex - 0.4, W, Hp); hole.lineTo(W, 0); hole.closePath(); sh.holes.push(hole);
      const frameGeo = new T.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, curveSegments: 24 }); frameGeo.translate(0, 0, -0.4);
      this.frameMat = new T.MeshStandardMaterial({ map: lat, color: C('#f4f1ea'), roughness: 0.45, metalness: 0.05, emissive: C('#ff4fb8'), emissiveMap: latNeon, emissiveIntensity: 0.25 });
      latNeon.repeat.set(0.55, 0.55); latNeon.wrapS = latNeon.wrapT = T.RepeatWrapping;
      const frame = new T.Mesh(frameGeo, this.frameMat); frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
      // neon rims (inner magenta, outer pearl)
      const innerPts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; let x, y; if (t < 0.15) { x = -W; y = t / 0.15 * Hp; } else if (t > 0.85) { x = W; y = (1 - t) / 0.15 * Hp; } else { const u = (t - 0.15) / 0.7; const side = u < 0.5 ? -1 : 1, v = u < 0.5 ? u * 2 : (1 - u) * 2; const a = new T.Vector2(side * W, Hp), c = new T.Vector2(side * W, apex - 0.4), b = new T.Vector2(0, apex); const q = new T.QuadraticBezierCurve(a, c, b).getPoint(v); x = q.x; y = q.y; } innerPts.push(new T.Vector3(x, y, 0.47)); }
      this.neonMat = new T.MeshStandardMaterial({ color: C('#ff7fd0'), emissive: C('#ff2fa8'), emissiveIntensity: 2.2, roughness: 0.3 });
      const neon = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(innerPts), 160, 0.075, 8), this.neonMat); g.add(neon);
      const neonBack = neon.clone(); neonBack.position.z = -0.94; g.add(neonBack);
      // pillar bases and cap lights
      const baseMat = new T.MeshStandardMaterial({ color: C('#e9e4da'), roughness: 0.6 });
      for (const s of [-1, 1]) { const b = new T.Mesh(new T.BoxGeometry(1.5, 0.5, 1.4), baseMat); b.position.set(s * (W + 0.45), 0.25, 0); b.castShadow = true; g.add(b); const sp = sprite(0xff6fd0, 2.2, 0.55); sp.position.set(s * (W + 0.45), Hp + 0.4, 0.6); g.add(sp); }
      // wings (doors): lattice light panels hinged at the inner pillar faces
      this.wingMat = new T.MeshStandardMaterial({ map: X.lattice('#ffffff', 8), color: C('#d8f6ff'), emissive: C('#6fe2ff'), emissiveIntensity: 1.15, transparent: true, opacity: 0.92, side: T.DoubleSide, depthWrite: false, alphaTest: 0.05, roughness: 0.3 });
      this.wingMat.map.repeat.set(1.6, 1.6);
      this.wingGlassMat = new T.MeshBasicMaterial({ color: C('#7fe7ff'), transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending });
      this.wings = [];
      for (const s of [-1, 1]) {
        const pivot = new T.Group(); pivot.position.set(s * W, 0, 0.0); g.add(pivot);
        const wgeo = new T.PlaneGeometry(W, 4.8); wgeo.translate(-s * W / 2, 2.45, 0);
        const panel = new T.Mesh(wgeo, this.wingMat); panel.renderOrder = 2; pivot.add(panel);
        const glass = new T.Mesh(wgeo, this.wingGlassMat); glass.renderOrder = 1; pivot.add(glass);
        const edge = new T.Mesh(new T.BoxGeometry(0.12, 4.9, 0.12), this.neonMat); edge.position.set(-s * W + s * 0.06, 2.45, 0); pivot.add(edge);
        const top = new T.Mesh(new T.BoxGeometry(W, 0.1, 0.1), this.neonMat); top.position.set(-s * W / 2, 4.86, 0); pivot.add(top);
        pivot.userData.side = s; this.wings.push(pivot);
      }
      // floating question mark
      this.qm = questionMark(); this.qm.position.set(0, 5.35, 0.2); this.qm.scale.setScalar(1.05); g.add(this.qm);
      this.qmGlow = sprite(0xffc04a, 4.2, 0.65); this.qmGlow.position.set(0, 6.15, 0.1); g.add(this.qmGlow);
      this.bigGlow = sprite(0xff5fc8, 10, 0.12); this.bigGlow.position.set(0, 4.5, -0.3); g.add(this.bigGlow);
      // number plaque + stop line on the road
      this.plaqueMat = null; this.setNumber(1);
      const lineMat = this.lineMat = new T.MeshBasicMaterial({ color: C('#ffd66b'), transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
      const line = this.stopLine = new T.Mesh(new T.PlaneGeometry(9.6, 0.35), lineMat); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.03, 4.2); g.add(line);
      const arrows = new T.Mesh(new T.PlaneGeometry(9.6, 2.4), new T.MeshBasicMaterial({ map: arrowTex(), transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending })); arrows.rotation.x = -Math.PI / 2; arrows.position.set(0, 0.025, 6.0); g.add(arrows); this.arrows = arrows;
      // wave + particles
      this.wave = new T.Mesh(new T.RingGeometry(0.7, 1.0, 64), new T.MeshBasicMaterial({ color: C('#ff4a5a'), transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); this.wave.position.set(0, 2.2, 0.5); g.add(this.wave);
      this.parts = new Burst(160); g.add(this.parts.points);
      this.state = 'idle'; this.t = 0; this.open = 0; this.flash = 0; this.waveT = -1; this.tint = 'normal';
    }
    setNumber(n) {
      if (this.plaque) { this.group.remove(this.plaque); this.plaque.material.map.dispose(); }
      this.plaque = textPlane('السؤال ' + String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]), 2.6, 0.62, { w: 512, h: 124, size: 66, bg: '#5a0f27', fg: '#ffe8b0', border: '#ffd66b' });
      this.plaque.position.set(0, 8.25, 0.52); this.group.add(this.plaque);
    }
    place(trackZ, n) { this.group.position.set(0, 0, trackZ); this.setNumber(n); this.reset(); }
    reset() { this.bigGlow.visible = true; this.qmGlow.visible = true; this.state = 'idle'; this.open = 0; this.flash = 0; this.waveT = -1; this.tint = 'normal'; this.wings.forEach(w => w.rotation.y = 0); this.setTint('normal'); this.group.visible = true; }
    setTint(kind) {
      this.tint = kind;
      const pal = { normal: ['#6fe2ff', '#ff2fa8', '#ffb22c'], active: ['#9ff0ff', '#ff4fb8', '#ffc84a'], good: ['#7dffb0', '#22d07a', '#9dff9a'], bad: ['#ff8080', '#ff2a3a', '#ff6a5a'], pending: ['#9cc8ff', '#5d8cff', '#a8c4ff'], passed: ['#5f8f9a', '#7d3b63', '#8a7440'] }[kind];
      this.wingMat.emissive.copy(C(pal[0])); this.neonMat.emissive.copy(C(pal[1])); this.qm.userData.mat.emissive.copy(C(pal[2])); this.qmGlow.material.color.copy(C(pal[2])); this.bigGlow.material.color.copy(C(pal[1]));
    }
    activate() { this.state = 'active'; this.setTint('active'); }
    succeed() { this.state = 'opening'; this.t = 0; this.setTint('good'); this.parts.emit(new T.Vector3(0, 3, 0.6), 0x9dffb0, 160); }
    pending() { this.state = 'opening'; this.t = 0; this.setTint('pending'); }
    reject() { this.state = 'reject'; this.t = 0; this.flash = 1; this.waveT = 0; this.setTint('bad'); }
    pass() { this.state = 'passed'; this.setTint('passed'); this.bigGlow.visible = false; this.qmGlow.visible = false; }
    update(dt, time) {
      this.t += dt;
      this.qm.rotation.y = Math.sin(time * 1.4) * 0.32; this.qm.position.y = 5.35 + Math.sin(time * 2.0) * 0.12;
      const pulse = this.state === 'active' ? 0.5 + 0.5 * Math.sin(time * 6) : 0.5 + 0.5 * Math.sin(time * 2.4);
      this.qm.userData.mat.emissiveIntensity = 1.2 + 0.9 * pulse; this.qmGlow.material.opacity = 0.45 + 0.35 * pulse; this.neonMat.emissiveIntensity = 1.6 + 0.8 * pulse; this.lineMat.opacity = 0.5 + 0.45 * pulse;
      this.arrows.material.map.offset.y = (-time * 0.8) % 1;
      if (this.state === 'opening') { this.open = Math.min(1, this.open + dt / 0.9); const e = 1 - Math.pow(1 - this.open, 3); this.wings.forEach(w => w.rotation.y = w.userData.side * -1.85 * e); this.wingMat.opacity = 0.92 - 0.35 * e; }
      if (this.state === 'reject') { this.flash = Math.max(0, this.flash - dt * 1.6); const shake = Math.sin(this.t * 70) * 0.04 * this.flash; this.wings.forEach(w => w.rotation.y = shake * w.userData.side); if (this.t > 1.2) { this.state = 'active'; this.setTint('active'); } }
      if (this.waveT >= 0) { this.waveT += dt; const k = this.waveT / 0.55; this.wave.scale.setScalar(1 + k * 6); this.wave.position.z = 0.5 + k * 5.5; this.wave.material.opacity = Math.max(0, 0.9 * (1 - k)); if (k >= 1) { this.waveT = -1; this.wave.material.opacity = 0; } }
      this.parts.update(dt);
    }
  }
  function arrowTex() { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.clearRect(0, 0, 256, 64); x.fillStyle = 'rgba(255,214,107,0.9)'; for (let k = 0; k < 3; k++) { const cx = 40 + k * 88; x.beginPath(); x.moveTo(cx - 24, 50); x.lineTo(cx, 14); x.lineTo(cx + 24, 50); x.lineTo(cx + 12, 50); x.lineTo(cx, 32); x.lineTo(cx - 12, 50); x.closePath(); x.fill(); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 1); return t; }
  class Burst { // additive particle burst (success sparks / confetti)
    constructor(n, opts = {}) {
      this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.col = new Float32Array(n * 3);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.BufferAttribute(this.col, 3));
      this.points = new T.Points(g, new T.PointsMaterial({ size: opts.size || 0.35, map: opts.square ? null : glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: opts.square ? T.NormalBlending : T.AdditiveBlending, sizeAttenuation: true }));
      this.points.frustumCulled = false; this.gravity = opts.gravity == null ? 6 : opts.gravity; for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -999;
    }
    emit(at, color, count, spread = 6, palette = null) {
      const c = new T.Color(color);
      for (let k = 0, i = 0; i < this.n && k < count; i++) { if (this.life[i] > 0) continue; k++; this.life[i] = 1 + Math.random() * 0.8; this.pos.set([at.x + (Math.random() - 0.5) * 2, at.y + (Math.random() - 0.5) * 2, at.z], i * 3); const a = Math.random() * 6.28, u = Math.random(); this.vel.set([Math.cos(a) * spread * u, 2 + Math.random() * spread, Math.sin(a) * spread * u * 0.6 + 1.5], i * 3); const cc = palette ? new T.Color(palette[(Math.random() * palette.length) | 0]) : c; this.col.set([cc.r, cc.g, cc.b], i * 3); }
      this.points.geometry.attributes.color.needsUpdate = true;
    }
    update(dt) { let any = false; for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) continue; any = true; this.life[i] -= dt; const j = i * 3; this.vel[j + 1] -= this.gravity * dt; this.vel[j] *= 0.985; this.vel[j + 2] *= 0.985; this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt; if (this.life[i] <= 0) this.pos[j + 1] = -999; } if (any) this.points.geometry.attributes.position.needsUpdate = true; }
  }
  class FinishArch {
    constructor() {
      const g = this.group = new T.Group(); g.name = 'finish';
      const maroon = new T.MeshStandardMaterial({ color: C('#8a1538'), roughness: 0.5 }), white = new T.MeshStandardMaterial({ color: C('#f6f3ee'), roughness: 0.5 });
      for (const s of [-1, 1]) { const t = new T.Mesh(new T.BoxGeometry(1.4, 9, 1.4), maroon); t.position.set(s * 6.2, 4.5, 0); t.castShadow = true; g.add(t); const cap = new T.Mesh(new T.BoxGeometry(1.7, 0.4, 1.7), white); cap.position.set(s * 6.2, 9.2, 0); g.add(cap);
        // Qatar flag on top of each tower
        const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 3.2, 6), white); pole.position.set(s * 6.2, 10.9, 0); g.add(pole);
        const fg = new T.PlaneGeometry(2.4, 0.95, 10, 2); fg.translate(1.2, 0, 0); const flag = new T.Mesh(fg, new T.MeshStandardMaterial({ map: X.qatarFlag(), side: T.DoubleSide, roughness: 0.8 })); flag.position.set(s * 6.2, 11.9, 0); g.add(flag); (this.flags = this.flags || []).push(flag); }
      const banner = textPlane('خط النهاية', 11, 1.8, { w: 1024, h: 168, size: 120, bg: '#8a1538', fg: '#ffffff', border: '#ffffff' }); banner.position.set(0, 8.1, 0.72); g.add(banner);
      const beam = new T.Mesh(new T.BoxGeometry(13.8, 2.2, 1.2), white); beam.position.set(0, 8.1, 0); beam.castShadow = true; g.add(beam);
      // serrated maroon/white bunting
      for (let i = 0; i < 22; i++) { const tri = new T.Mesh(new T.ConeGeometry(0.28, 0.6, 3), i % 2 ? maroon : white); tri.rotation.z = Math.PI; tri.position.set(-6 + i * 0.57, 6.75, 0.65); g.add(tri); }
      const check = new T.Mesh(new T.PlaneGeometry(11, 1.2), new T.MeshStandardMaterial({ map: checkerTex(), roughness: 0.8 })); check.rotation.x = -Math.PI / 2; check.position.set(0, 0.03, 0); g.add(check);
      this.confetti = new Burst(500, { size: 0.16, square: true, gravity: 2.2 }); g.add(this.confetti.points);
      this.t = 0;
    }
    celebrate() { for (let k = 0; k < 4; k++) setTimeout(() => this.confetti.emit(new T.Vector3((k % 2 ? 1 : -1) * 5, 9, 1), 0xffffff, 120, 7, ['#8a1538', '#ffffff', '#ffd66b', '#8a1538', '#3cb7ae']), k * 350); }
    update(dt, time) { this.flags.forEach((f, i) => { const p = f.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k); p.setZ(k, Math.sin(time * 5 + x * 2.2 + i) * 0.12 * x / 2.4); } p.needsUpdate = true; }); this.confetti.update(dt); }
  }
  function checkerTex() { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d'); for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(i * 8, j * 8, 8, 8); } const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.magFilter = T.NearestFilter; return t; }
  void add;
  root.QRGate = { Gate, FinishArch, Burst };
})(typeof window !== 'undefined' ? window : globalThis);
