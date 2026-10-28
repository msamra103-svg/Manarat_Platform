/* Target Shooting 3D — target models (original procedural work) and the shared mode base.
 *   - World Archery 10-ring face (canvas texture, true ring geometry) on a straw boss + wooden stand
 *   - virtual birds: articulated 3D body with two-segment wings (flap, glide, bank)
 *   - balloons: lathe-profile glossy envelopes with a knot and a simulated string
 *   - clay discs: dome-profile lathe discs, plus trap launchers
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util, PH = TS.Physics, B = TS.World.B;
  const shared = (o) => { (o.userData || (o.userData = {})).shared = true; return o; };

  // ---------------------------------------------------------------- archery face
  const RING_COLORS = ['#ffffff', '#ffffff', '#1a1a1a', '#1a1a1a', '#1f7bd8', '#1f7bd8', '#e2252b', '#e2252b', '#ffd21f', '#ffd21f'];
  function faceTexture() {
    if (faceTexture.t) return faceTexture.t;
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), R = S / 2;
    g.fillStyle = '#f3efe4'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 10; i++) {
      const r = R * (10 - i) / 10;
      g.beginPath(); g.arc(R, R, r, 0, Math.PI * 2); g.fillStyle = RING_COLORS[i]; g.fill();
      g.lineWidth = 2.2; g.strokeStyle = i === 2 || i === 3 ? '#e8e8e8' : '#222'; g.stroke();
    }
    g.beginPath(); g.arc(R, R, R / 20, 0, Math.PI * 2); g.lineWidth = 1.5; g.strokeStyle = '#333'; g.stroke();
    g.beginPath(); g.moveTo(R - 7, R); g.lineTo(R + 7, R); g.moveTo(R, R - 7); g.lineTo(R, R + 7); g.strokeStyle = '#333'; g.lineWidth = 1.5; g.stroke();
    // ring numbers on the horizontal axis (as printed faces)
    g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 9; i++) { const r = R * (10 - i - 0.5) / 10; g.fillStyle = i === 2 || i === 3 ? '#fff' : '#111'; g.fillText(String(i + 1), R + r, R); g.fillText(String(i + 1), R - r, R); }
    // subtle paper fibre
    const rnd = U.rng(77); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.04})`; g.fillRect(rnd() * S, rnd() * S, 1, 1); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; shared(t);
    return (faceTexture.t = t);
  }
  function strawTexture() {
    if (strawTexture.t) return strawTexture.t;
    const rnd = U.rng(31);
    const t = B.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c8a25f'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) { const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 22, a = (rnd() - 0.5) * 0.9; g.strokeStyle = `rgba(${150 + rnd() * 80 | 0},${110 + rnd() * 60 | 0},${50 + rnd() * 40 | 0},${0.35 + rnd() * 0.5})`; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }, { repeat: 1 });
    shared(t); return (strawTexture.t = t);
  }
  /** Target on a stand. Face radius in metres (0.61 = 122 cm face). Group origin on the ground; face tilted back. */
  function archeryTarget(faceR, mats) {
    const g = new T.Group(); g.name = 'archery-target';
    const boss = 1.25 * Math.max(0.6, faceR / 0.61) * 1.0, depth = 0.32;
    const tilt = 0.17;
    const holder = new T.Group(); holder.position.y = 0.55 + boss / 2; holder.rotation.x = -tilt; g.add(holder);
    const straw = new T.Mesh(new T.BoxGeometry(boss, boss, depth), new T.MeshStandardMaterial({ map: strawTexture(), roughness: 1 }));
    straw.castShadow = straw.receiveShadow = true; holder.add(straw);
    const face = new T.Mesh(new T.CircleGeometry(faceR, 72), new T.MeshStandardMaterial({ map: faceTexture(), roughness: 0.85 }));
    face.position.z = depth / 2 + 0.003; face.receiveShadow = true; holder.add(face);
    // wooden A-frame
    const wood = mats.wood;
    for (const sx of [-1, 1]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.07, 0.6 + boss + 0.25, 0.07), wood); leg.position.set(sx * (boss / 2 - 0.08), (0.6 + boss) / 2, -0.05); leg.rotation.x = -tilt; leg.castShadow = true; g.add(leg);
      const back = new T.Mesh(new T.BoxGeometry(0.06, 1.7 + boss * 0.6, 0.06), wood); back.position.set(sx * (boss / 2 - 0.08), 0.85, -0.55); back.rotation.x = 0.42; back.castShadow = true; g.add(back);
    }
    const shelf = new T.Mesh(new T.BoxGeometry(boss + 0.1, 0.06, 0.4), wood); shelf.position.set(0, 0.52, 0.0); shelf.castShadow = true; g.add(shelf);
    g.userData = { holder, face, faceR, depth, tilt, stuck: [] };
    return g;
  }

  // ---------------------------------------------------------------- birds
  function birdMats(seed) {
    const r = U.rng(seed);
    const hue = [0.07, 0.58, 0.0, 0.1][Math.floor(r() * 4)];
    return {
      body: new T.MeshStandardMaterial({ color: new T.Color().setHSL(hue, 0.18, 0.62), roughness: 0.8 }),
      wing: new T.MeshStandardMaterial({ color: new T.Color().setHSL(hue, 0.15, 0.48), roughness: 0.85, side: T.DoubleSide }),
      tip: new T.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.85, side: T.DoubleSide }),
      beak: new T.MeshStandardMaterial({ color: 0xe8a33a, roughness: 0.5 }),
      eye: new T.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.2 }),
      belly: new T.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.85 })
    };
  }
  let birdGeo = null;
  function birdGeometry() {
    if (birdGeo) return birdGeo;
    const body = new T.SphereGeometry(0.1, 18, 12); body.scale(1, 0.9, 2.1);
    const belly = new T.SphereGeometry(0.098, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55); belly.scale(0.96, 0.9, 2.0); belly.translate(0, -0.004, 0);
    const head = new T.SphereGeometry(0.07, 14, 10); head.translate(0, 0.05, 0.22);
    const beak = new T.ConeGeometry(0.022, 0.07, 8); beak.rotateX(Math.PI / 2); beak.translate(0, 0.045, 0.3);
    const eye = new T.SphereGeometry(0.011, 8, 6);
    const tailS = new T.Shape(); tailS.moveTo(-0.03, 0); tailS.lineTo(0.03, 0); tailS.lineTo(0.08, -0.17); tailS.quadraticCurveTo(0, -0.21, -0.08, -0.17); tailS.lineTo(-0.03, 0);
    const tail = new T.ShapeGeometry(tailS); tail.rotateX(-Math.PI / 2); tail.translate(0, 0.0, -0.16);
    // wing: inner and outer panels in the XZ plane, hinged at x = 0 (body side) / at their root
    const inner = new T.Shape(); inner.moveTo(0, 0.07); inner.lineTo(0.2, 0.06); inner.lineTo(0.2, -0.07); inner.quadraticCurveTo(0.08, -0.1, 0, -0.06); inner.lineTo(0, 0.07);
    const innerG = new T.ShapeGeometry(inner); innerG.rotateX(-Math.PI / 2);
    const outer = new T.Shape(); outer.moveTo(0, 0.06); outer.quadraticCurveTo(0.14, 0.05, 0.24, -0.04); outer.lineTo(0.2, -0.07); outer.lineTo(0.0, -0.07); outer.lineTo(0, 0.06);
    const outerG = new T.ShapeGeometry(outer); outerG.rotateX(-Math.PI / 2);
    for (const g of [body, belly, head, beak, eye, tail, innerG, outerG]) shared(g);
    return (birdGeo = { body, belly, head, beak, eye, tail, innerG, outerG });
  }
  function bird(seed, size) {
    const g = birdGeometry(), m = birdMats(seed);
    const o = new T.Group(); o.name = 'bird';
    const body = new T.Group(); o.add(body);
    body.add(new T.Mesh(g.body, m.body), new T.Mesh(g.belly, m.belly), new T.Mesh(g.head, m.body), new T.Mesh(g.beak, m.beak), new T.Mesh(g.tail, m.wing));
    for (const sx of [-1, 1]) { const e = new T.Mesh(g.eye, m.eye); e.position.set(sx * 0.05, 0.07, 0.26); body.add(e); }
    const wings = [];
    for (const sx of [-1, 1]) {
      const root = new T.Group(); root.position.set(sx * 0.055, 0.03, 0.03); root.scale.x = sx;
      const innerM = new T.Mesh(g.innerG, m.wing); root.add(innerM);
      const elbow = new T.Group(); elbow.position.x = 0.2; root.add(elbow);
      const outerM = new T.Mesh(g.outerG, m.tip); elbow.add(outerM);
      body.add(root); wings.push({ root, elbow });
    }
    o.traverse(x => { if (x.isMesh) x.castShadow = true; });
    o.scale.setScalar(size);
    o.userData = { body, wings, mats: m, flap: 0 };
    return o;
  }
  /** wings: amount 0 (glide, slight dihedral) .. 1 (full stroke); phase drives the stroke */
  function poseBird(o, phase, amount, glide) {
    const { wings } = o.userData;
    const stroke = Math.sin(phase), lag = Math.sin(phase - 0.9);
    const base = 0.12 * glide;
    for (const w of wings) {
      w.root.rotation.z = (base + stroke * 0.85 * amount);
      w.elbow.rotation.z = (lag * 0.55 * amount) + 0.06 * glide;
      w.root.rotation.y = -0.15 * amount * Math.cos(phase);
    }
  }

  // ---------------------------------------------------------------- balloons
  let balloonGeo = null;
  function balloonGeometry() {
    if (balloonGeo) return balloonGeo;
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, a = t * Math.PI;
      const r = Math.sin(a) * (1 - 0.18 * t) * 0.2 * (t < 0.08 ? 0.8 + t * 2.5 : 1);
      const y = -Math.cos(a) * 0.25 + 0.02 * Math.sin(a * 2);
      pts.push(new T.Vector2(Math.max(0.0001, r), y));
    }
    const env = new T.LatheGeometry(pts.reverse(), 36); env.computeVertexNormals();
    const knot = new T.ConeGeometry(0.018, 0.04, 10); knot.translate(0, -0.27, 0);
    shared(env); shared(knot);
    return (balloonGeo = { env, knot });
  }
  function balloon(color, bonus) {
    const g = balloonGeometry();
    const mat = new T.MeshPhysicalMaterial({ color, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0, transmission: 0 });
    if (bonus) { mat.metalness = 0.6; mat.roughness = 0.22; mat.emissive = new T.Color(0x553300); }
    const o = new T.Group(); o.name = 'balloon';
    const env = new T.Mesh(g.env, mat); env.castShadow = true; o.add(env);
    const knot = new T.Mesh(g.knot, mat); o.add(knot);
    // string: 7-point verlet chain rendered as a line
    const n = 8, pos = new Float32Array(n * 3);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const line = new T.Line(geo, new T.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.85 }));
    line.frustumCulled = false;
    o.userData = { env, mat, line, chain: Array.from({ length: n }, () => ({ p: new T.Vector3(), q: new T.Vector3() })), segLen: 0.11 };
    return o;
  }

  // ---------------------------------------------------------------- clay discs
  let discGeo = null;
  function discGeometry() {
    if (discGeo) return discGeo;
    const pts = [new T.Vector2(0.0001, 0.026), new T.Vector2(0.03, 0.026), new T.Vector2(0.05, 0.022), new T.Vector2(0.088, 0.013), new T.Vector2(0.104, 0.006), new T.Vector2(0.11, 0.0), new T.Vector2(0.106, -0.004), new T.Vector2(0.09, -0.004), new T.Vector2(0.06, 0.004), new T.Vector2(0.0001, 0.004)];
    const g = new T.LatheGeometry(pts, 36); g.computeVertexNormals(); shared(g);
    const ring = new T.TorusGeometry(0.095, 0.005, 6, 36); ring.rotateX(Math.PI / 2); ring.translate(0, 0.012, 0); shared(ring);
    return (discGeo = { g, ring });
  }
  function clayDisc(mat, matRing) {
    const d = discGeometry(), o = new T.Group(); o.name = 'clay';
    const m = new T.Mesh(d.g, mat); m.castShadow = true; o.add(m);
    o.add(new T.Mesh(d.ring, matRing));
    return o;
  }
  function launcher(mats) {
    const g = new T.Group(); g.name = 'trap';
    const base = new T.Mesh(new T.BoxGeometry(0.9, 0.45, 0.7), mats.metalDark); base.position.y = 0.3; base.castShadow = true; g.add(base);
    const top = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.06, 20), mats.metal); top.position.y = 0.56; g.add(top);
    const arm = new T.Mesh(new T.BoxGeometry(0.06, 0.04, 0.6), mats.accent); arm.position.set(0, 0.6, 0.15); g.add(arm);
    const stack = new T.Mesh(new T.CylinderGeometry(0.115, 0.115, 0.32, 18), mats.clay); stack.position.set(0.25, 0.75, -0.1); g.add(stack);
    const sand = new T.Mesh(new T.CylinderGeometry(0.9, 1.0, 0.25, 20), mats.sandbag); sand.position.y = 0.12; sand.scale.z = 0.8; sand.receiveShadow = true; g.add(sand);
    g.traverse(x => { if (x.isMesh) x.castShadow = true; });
    g.userData.arm = arm;
    return g;
  }

  /** Base for the four modes: targets, sub-stepping, colliders, ray tests. */
  class Mode {
    constructor(ctx) {
      this.ctx = ctx; this.targets = []; this.time = 0; this.statics = []; this.done = false;
      this.group = new T.Group();
      this.tmp = new T.Vector3();
    }
    preStep() { for (const t of this.targets) t.prev.copy(t.pos); }
    colliders() {
      const out = [];
      for (const t of this.targets) if (t.alive) out.push(t.kind === 'disc' ? { kind: 'disc', c0: t.prev, c1: t.pos, n: t.n, r: t.r, ref: t } : { kind: 'sphere', c0: t.prev, c1: t.pos, r: t.r, ref: t });
      for (const s of this.statics) out.push(s);
      return out;
    }
    /** distance along a ray to the first thing the aim should rest on */
    rayHit(o, d) {
      let best = Infinity;
      for (const t of this.targets) {
        if (!t.alive) continue;
        if (t.kind === 'disc') {
          const den = d.dot(t.n); if (den > -1e-4) continue;
          const s = this.tmp.subVectors(t.pos, o).dot(t.n) / den; if (s <= 0) continue;
          const hit = this.tmp.copy(o).addScaledVector(d, s).sub(t.pos); if (hit.length() <= t.r * 1.15 && s < best) best = s;
        } else {
          const oc = this.tmp.subVectors(o, t.pos), b = oc.dot(d), c = oc.dot(oc) - t.r * t.r * 1.3, disc = b * b - c;
          if (disc >= 0) { const s = -b - Math.sqrt(disc); if (s > 0 && s < best) best = s; }
        }
      }
      for (const s of this.statics) {
        if (s.kind !== 'plane') continue;
        const den = d.dot(s.n); if (den > -1e-4) continue;
        const k = this.tmp.set(s.c0.x - o.x, s.c0.y - o.y, s.c0.z - o.z).dot(s.n) / den; if (k > 0 && k < best) best = k;
      }
      return best < Infinity ? best : (this.defaultRange || 35);
    }
    aimTargets() { return this.targets.filter(t => t.alive && t.aimable !== false).map(t => ({ pos: t.pos, vel: t.vel, acc: t.acc, r: t.r, predict: t.predict })); }
    remaining() { return this.targets.filter(t => t.alive).length; }
    dispose() { }
  }
  const plane = (p, n) => ({ kind: 'plane', c0: PH.v3(p.x, p.y, p.z), n: PH.v3(n.x, n.y, n.z) });
  function commonMats(accent) {
    return {
      wood: new T.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.85 }),
      woodDark: new T.MeshStandardMaterial({ color: 0x4f3a28, roughness: 0.9 }),
      metal: new T.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.8 }),
      metalDark: new T.MeshStandardMaterial({ color: 0x3b4148, roughness: 0.5, metalness: 0.6 }),
      white: new T.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.7 }),
      accent: new T.MeshStandardMaterial({ color: new T.Color(accent), roughness: 0.55 }),
      fabric: new T.MeshStandardMaterial({ color: new T.Color(accent), roughness: 0.9, side: T.DoubleSide }),
      fabricWhite: new T.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.9, side: T.DoubleSide }),
      net: new T.MeshStandardMaterial({ color: 0x2f5a35, roughness: 1, transparent: true, opacity: 0.82, side: T.DoubleSide }),
      clay: new T.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.55 }),
      sandbag: new T.MeshStandardMaterial({ color: 0x9c8a62, roughness: 1 }),
      earth: new T.MeshStandardMaterial({ color: 0x7b6243, roughness: 1 })
    };
  }
  /** waving flag on a pole (vertex animation, deterministic) */
  function flag(mat, w = 0.9, h = 0.55) {
    const g = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.02, 0.025, 3, 8), new T.MeshStandardMaterial({ color: 0xdedede, metalness: 0.6, roughness: 0.4 })); pole.position.y = 1.5; pole.castShadow = true; g.add(pole);
    const geo = new T.PlaneGeometry(w, h, 12, 4); geo.translate(w / 2, 0, 0);
    const cloth = new T.Mesh(geo, mat); cloth.position.y = 2.7; cloth.castShadow = true; g.add(cloth);
    const base = Float32Array.from(geo.attributes.position.array);
    g.userData.update = (t, wind = 1) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; p.setZ(i, Math.sin(x * 5 - t * 6 * wind + y * 1.5) * 0.07 * x / w * wind); p.setY(i, y - 0.04 * x * x); }
      p.needsUpdate = true; geo.computeVertexNormals();
    };
    return g;
  }

  TS.Targets = { faceTexture, archeryTarget, bird, poseBird, balloon, clayDisc, discGeometry, launcher, Mode, plane, commonMats, flag, RING_COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
