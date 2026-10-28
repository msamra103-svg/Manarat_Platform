/* عدّاء قطر — the Qatari boy: skinned MakeHuman-derived body (js/boy-data.js), runtime thobe skirt and
 * ghutra as Verlet cloth that collides with the body, rigid agal + tassels, running shoes, and a procedural
 * locomotion animator (foot-planted run/walk gait with two-bone leg IK, jump, slide, recoil, idle, victory).
 *
 * Conventions (model space): the boy faces +Z, up is +Y, his left side is +X, soles rest on y = 0.
 * Every bone has an identity rest rotation (world-aligned), so a bone's rest direction is head→tail in bind space.
 * Character lock: the body, face, garments and proportions are built once from fixed data; animation only
 * rotates bones and simulates cloth, it never swaps meshes or materials.
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const V3 = T.Vector3, Q = T.Quaternion;
  const SOLE = 0.024;                       // shoe sole thickness (model is lifted by this much)
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ data decoding
  function decodeBin() {
    const s = atob(root.QR_BOY_BIN), u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8.buffer;
  }
  function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('texture decode failed')); im.src = src; }); }
  function meshGeometry(m, buf) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(buf, m.pos[0], m.pos[1]), 3));
    if (m.nrm) g.setAttribute('normal', new T.BufferAttribute(new Int8Array(buf, m.nrm[0], m.nrm[1]), 3, true));
    g.setAttribute('uv', new T.BufferAttribute(new Uint16Array(buf, m.uv[0], m.uv[1]), 2, true));
    g.setAttribute('skinIndex', new T.BufferAttribute(new Uint8Array(buf, m.si[0], m.si[1]), 4));
    g.setAttribute('skinWeight', new T.BufferAttribute(new Uint8Array(buf, m.sw[0], m.sw[1]), 4, true));
    g.setIndex(new T.BufferAttribute(new Uint16Array(buf, m.index[0], m.index[1]), 1));
    if (!m.nrm) g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  // ------------------------------------------------------------------ procedural fabric textures (canvas, offline)
  function fabricTexture(size, base, opts = {}) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, size, size);
    const img = x.getImageData(0, 0, size, size), d = img.data;
    let seed = opts.seed || 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
      const i = (yy * size + xx) * 4;
      const weave = ((xx + (yy >> 1)) % 4 < 2 ? 1 : 0.985) * (yy % 3 === 0 ? 0.992 : 1);
      const n = 0.985 + rnd() * 0.03;
      const k = weave * n;
      d[i] = d[i] * k; d[i + 1] = d[i + 1] * k; d[i + 2] = d[i + 2] * k;
    }
    x.putImageData(img, 0, 0);
    if (opts.hem) { // stitched hem border along v = 0 (bottom edge of the UV square)
      x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, size - opts.hem, size, opts.hem);
      x.strokeStyle = 'rgba(0,0,0,0.10)'; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(0, size - opts.hem - 1.5); x.lineTo(size, size - opts.hem - 1.5); x.stroke();
    }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    return t;
  }

  // ------------------------------------------------------------------ Verlet cloth
  class Cloth {
    constructor(n) {
      this.n = n; this.p = new Float32Array(n * 3); this.o = new Float32Array(n * 3); this.w = new Float32Array(n).fill(1);
      this._a = []; this._b = []; this._l = []; this._k = [];
    }
    link(a, b, k = 1) { const p = this.p; const dx = p[b * 3] - p[a * 3], dy = p[b * 3 + 1] - p[a * 3 + 1], dz = p[b * 3 + 2] - p[a * 3 + 2]; this._a.push(a); this._b.push(b); this._l.push(Math.hypot(dx, dy, dz)); this._k.push(k); }
    finalize() { this.ca = Int32Array.from(this._a); this.cb = Int32Array.from(this._b); this.cl = Float32Array.from(this._l); this.ck = Float32Array.from(this._k); this.o.set(this.p); delete this._a; delete this._b; delete this._l; delete this._k; }
    integrate(h, ax, ay, az, damp) {
      const p = this.p, o = this.o, w = this.w, h2 = h * h;
      for (let i = 0; i < this.n; i++) {
        if (!w[i]) continue; const j = i * 3;
        const vx = (p[j] - o[j]) * damp, vy = (p[j + 1] - o[j + 1]) * damp, vz = (p[j + 2] - o[j + 2]) * damp;
        o[j] = p[j]; o[j + 1] = p[j + 1]; o[j + 2] = p[j + 2];
        p[j] += vx + ax * h2; p[j + 1] += vy + ay * h2; p[j + 2] += vz + az * h2;
      }
    }
    solve() {
      const p = this.p, w = this.w, A = this.ca, B = this.cb, Lr = this.cl, Kk = this.ck;
      for (let c = 0; c < A.length; c++) {
        const a = A[c] * 3, b = B[c] * 3, wa = w[A[c]], wb = w[B[c]], ws = wa + wb; if (!ws) continue;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const f = (d - Lr[c]) / d * Kk[c] / ws;
        p[a] += dx * f * wa; p[a + 1] += dy * f * wa; p[a + 2] += dz * f * wa;
        p[b] -= dx * f * wb; p[b + 1] -= dy * f * wb; p[b + 2] -= dz * f * wb;
      }
    }
    // tether: keep particle i within maxD[i] of its rest point (given in a bone frame, mapped by matrix m into sim space)
    setTethers(restLocal, maxD) { this.tr = restLocal; this.td = maxD; }
    tether(m) {
      const p = this.p, r = this.tr, D = this.td, e = m.elements; if (!r) return;
      for (let i = 0; i < this.n; i++) {
        if (!this.w[i]) continue; const j = i * 3, x = r[j], y = r[j + 1], z = r[j + 2];
        const rx = e[0] * x + e[4] * y + e[8] * z + e[12], ry = e[1] * x + e[5] * y + e[9] * z + e[13], rz = e[2] * x + e[6] * y + e[10] * z + e[14];
        const dx = p[j] - rx, dy = p[j + 1] - ry, dz = p[j + 2] - rz, dd = dx * dx + dy * dy + dz * dz, md = D[i];
        if (dd > md * md) { const f = md / Math.sqrt(dd); p[j] = rx + dx * f; p[j + 1] = ry + dy * f; p[j + 2] = rz + dz * f; }
      }
    }
    pin(i, x, y, z) { const j = i * 3; this.p[j] = x; this.p[j + 1] = y; this.p[j + 2] = z; this.o[j] = x; this.o[j + 1] = y; this.o[j + 2] = z; }
  }
  // capsule push-out (a, b endpoints as arrays [x,y,z], radius r)
  function collideCapsule(cl, ax, ay, az, bx, by, bz, r) {
    const p = cl.p, w = cl.w, ex = bx - ax, ey = by - ay, ez = bz - az, ee = ex * ex + ey * ey + ez * ez || 1e-9, r2 = r * r;
    for (let i = 0; i < cl.n; i++) {
      if (!w[i]) continue; const j = i * 3;
      const px = p[j] - ax, py = p[j + 1] - ay, pz = p[j + 2] - az;
      let t = (px * ex + py * ey + pz * ez) / ee; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - ex * t, dy = py - ey * t, dz = pz - ez * t, dd = dx * dx + dy * dy + dz * dz;
      if (dd < r2) { const d = Math.sqrt(dd) || 1e-6, s = (r - d) / d; p[j] += dx * s; p[j + 1] += dy * s; p[j + 2] += dz * s; }
    }
  }
  // one-sided leg collision for the thobe: front-panel cloth must stay in front of the legs, back panel behind,
  // even when a fast-swinging shin would tunnel through within one sub-step.
  function collideLegSided(cl, side, ax, ay, az, bx, by, bz, r) {
    const p = cl.p, w = cl.w, ex = bx - ax, ey = by - ay, ez = bz - az, ee = ex * ex + ey * ey + ez * ez || 1e-9;
    for (let i = 0; i < cl.n; i++) {
      const sg = side[i]; if (!w[i] || !sg) continue; const j = i * 3;
      const px = p[j] - ax, py = p[j + 1] - ay, pz = p[j + 2] - az;
      const t = (px * ex + py * ey + pz * ez) / ee; if (t <= 0.02 || t >= 1.02) continue;
      const tc = Math.min(t, 1), dx = px - ex * tc, dy = py - ey * tc, dz = pz - ez * tc;
      if (Math.abs(dx) > r * 1.05 || dz * sg > r * 0.98 || dz * sg < -0.3) continue;
      // inside the leg or on the wrong side of it → move to the panel's own side, just outside the leg surface
      const ox = Math.max(-r, Math.min(r, dx)), oz = sg * Math.sqrt(Math.max(0, r * r - ox * ox));
      const nz = az + ez * tc + oz;
      if ((p[j + 2] - nz) * sg < 0) p[j + 2] = nz;
    }
  }
  // radial profile (bands of {y, r[24]} around a vertical axis) — interpolated support radius
  function profileR(prof, y, th) {
    let k = 0; while (k < prof.length - 2 && prof[k + 1].y < y) k++;
    const a = prof[k], b = prof[k + 1], t = clamp((y - a.y) / (b.y - a.y), 0, 1);
    const f = ((th % TAU) + TAU) % TAU / TAU * 24, i0 = Math.floor(f) % 24, i1 = (i0 + 1) % 24, u = f - Math.floor(f);
    const ra = a.r[i0] * (1 - u) + a.r[i1] * u, rb = b.r[i0] * (1 - u) + b.r[i1] * u;
    return ra * (1 - t) + rb * t;
  }
  function cleanProfile(prof) { // fill empty samples and smooth around the ring
    const out = prof.map(b => ({ y: b.y, r: b.r.slice() }));
    for (let k = 0; k < out.length; k++) { const r = out[k].r; if (r.every(v => v === 0)) { const src = out[k - 1] || out[k + 1]; out[k].r = src.r.map(v => v * 0.7); } }
    for (const b of out) { const r = b.r, s = r.map((v, i) => (r[(i + 23) % 24] + 2 * v + r[(i + 1) % 24]) / 4); b.r = s; }
    return out;
  }

  // ------------------------------------------------------------------ the boy
  class Boy {
    constructor() { this.ready = false; }
    async build() {
      const D = root.QR_BOY_DATA, buf = decodeBin();
      this.D = D;
      const group = this.group = new T.Group(); group.name = 'qatari-boy';
      const model = this.model = new T.Group(); model.position.y = SOLE; group.add(model);
      // skeleton (identity rest rotations)
      const bones = this.bones = {}, list = [];
      for (const b of D.bones) { const bone = new T.Bone(); bone.name = b.name; bone.userData.head = new V3().fromArray(b.head); bone.userData.tail = new V3().fromArray(b.tail); bones[b.name] = bone; list.push(bone); }
      for (const b of D.bones) { const bone = bones[b.name]; if (b.parent) { const p = bones[b.parent]; bone.position.copy(bone.userData.head).sub(p.userData.head); p.add(bone); } else { bone.position.copy(bone.userData.head); model.add(bone); } }
      model.updateMatrixWorld(true);
      const skeleton = this.skeleton = new T.Skeleton(list);
      const imgs = {}; for (const [k, src] of Object.entries(root.QR_BOY_TEX)) imgs[k] = await loadImage(src);
      const tex = k => { const t = new T.Texture(imgs[k]); t.encoding = T.sRGBEncoding; t.anisotropy = 4; t.needsUpdate = true; return t; };
      const thobeTex = tex('thobe');
      this.mats = {
        skin: new T.MeshStandardMaterial({ map: tex('skin'), roughness: 0.52, metalness: 0, name: 'boy-skin' }),
        thobe: new T.MeshStandardMaterial({ map: thobeTex, color: 0xe6e6e1, roughness: 0.9, alphaTest: 0.5, side: T.DoubleSide, name: 'boy-thobe' }),
        sirwal: new T.MeshStandardMaterial({ map: tex('sirwal'), color: 0xdedeD8, roughness: 0.9, alphaTest: 0.5, side: T.DoubleSide, name: 'boy-sirwal' }),
        eyes: new T.MeshStandardMaterial({ map: tex('eyes'), roughness: 0.25, name: 'boy-eyes' }),
        cornea: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.14, depthWrite: false, name: 'boy-cornea' }),
        cloth: new T.MeshStandardMaterial({ map: fabricTexture(256, '#f6f6f2', { seed: 11 }), color: 0xe4e4df, roughness: 0.9, side: T.DoubleSide, name: 'boy-thobe-skirt' }),
        ghutra: new T.MeshStandardMaterial({ map: fabricTexture(256, '#fbfbf8', { seed: 5, hem: 10 }), color: 0xececE8, roughness: 0.88, side: T.DoubleSide, name: 'boy-ghutra' }),
        agal: new T.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.62, metalness: 0.0, name: 'boy-agal' }),
      };
      this.meshes = {};
      for (const name of ['skin', 'sirwal', 'thobe', 'eyes', 'cornea']) {
        const mesh = new T.SkinnedMesh(meshGeometry(D.meshes[name], buf), this.mats[name]); mesh.name = 'boy-' + name;
        this.mats[name].skinning = true; mesh.castShadow = !['eyes', 'cornea'].includes(name); mesh.receiveShadow = true; mesh.frustumCulled = false;
        model.add(mesh); mesh.bind(skeleton); this.meshes[name] = mesh;
      }
      this.buildShoes();
      this.buildSkirt();
      this.buildGhutra();
      this.buildAgal();
      this.cacheRig();
      this.prevGroupPos = new V3(); this.groupVel = new V3(); this.groupAcc = new V3(); this._accSm = new V3();
      this.wind = 0; this.time = 0; this.clothAccum = 0; this.quality = 1;
      this.ready = true;
      return this;
    }

    // -------------------------------------------------------------- running shoes (rigid on the foot bones)
    buildShoes() {
      const D = this.D, B = this.bones;
      const upperMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, name: 'shoe-upper' });
      const soleMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, name: 'shoe-sole' });
      const laceMat = new T.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8, name: 'shoe-lace' });
      const maroon = new T.Color(0x8a1538).convertSRGBToLinear(), white = new T.Color(0xf3f3f1).convertSRGBToLinear(), grey = new T.Color(0x9aa0a6).convertSRGBToLinear(), dark = new T.Color(0x2a2c30).convertSRGBToLinear();
      for (const sd of ['L', 'R']) {
        const f = D.feet[sd], foot = B['foot_' + sd], a = foot.userData.head.toArray();
        const z0 = f.min[2] - 0.012, z1 = f.max[2] + 0.014, cx = (f.min[0] + f.max[0]) / 2, W = (f.max[0] - f.min[0]) / 2 + 0.01, NS = 30, NR = 22;
        const width = u => W * (0.74 + 0.26 * Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.1))) * (u > 0.86 ? Math.sqrt(Math.max(0.02, 1 - ((u - 0.86) / 0.15) ** 2)) : 1) * (u < 0.08 ? Math.sqrt(Math.max(0.2, u / 0.08)) : 1);
        const height = u => 0.0 + (u < 0.28 ? 0.074 : u < 0.62 ? 0.074 - 0.004 * Math.sin((u - 0.28) / 0.34 * Math.PI) : 0.07 * (1 - (u - 0.62) / 0.38) + 0.028 * ((u - 0.62) / 0.38)) * (u > 0.965 ? Math.max(0.35, (1 - u) / 0.035) : 1);
        const pos = [], col = [], idx = [];
        for (let i = 0; i <= NS; i++) {
          const u = i / NS, w = width(u), h = height(u), z = z0 + (z1 - z0) * u;
          for (let j = 0; j <= NR; j++) {
            const th = j / NR * Math.PI, sx = Math.cos(th), sy = Math.pow(Math.sin(th), 0.55);
            pos.push(cx + sx * w - a[0], 0.006 + (h - 0.006) * sy - a[1], z - a[2]);
            // colourway: white upper, maroon side swoop band (original), grey heel counter
            const band = Math.abs(sy - (0.45 + 0.35 * (1 - u))) < 0.09 && u > 0.12 && u < 0.78 && Math.abs(sx) > 0.25;
            const heel = u < 0.14 && sy < 0.8;
            const c = band ? maroon : heel ? grey : white; col.push(c.r, c.g, c.b);
          }
        }
        for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const p0 = i * (NR + 1) + j, p1 = p0 + 1, p2 = p0 + NR + 1, p3 = p2 + 1; idx.push(p0, p1, p2, p1, p3, p2); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
        const upper = new T.Mesh(g, upperMat); upper.name = 'shoe-upper-' + sd; upper.castShadow = true; foot.add(upper);
        // two-layer sole: white foam midsole + dark rubber outsole, extruded from the footprint outline
        const outline = new T.Shape(); const pts = [];
        for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([cx + width(u) + 0.005, z0 - 0.005 + (z1 - z0 + 0.01) * u]); }
        for (let i = 40; i >= 0; i--) { const u = i / 40; pts.push([cx - width(u) - 0.005, z0 - 0.005 + (z1 - z0 + 0.01) * u]); }
        pts.forEach((p, i) => i ? outline.lineTo(p[0], p[1]) : outline.moveTo(p[0], p[1]));
        for (const [th, y0, c] of [[0.017, -SOLE + 0.007, white], [0.007, -SOLE, dark]]) {
          const sg = new T.ExtrudeGeometry(outline, { depth: th, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 4 });
          sg.rotateX(Math.PI / 2); sg.translate(-a[0], y0 + th - a[1], -a[2]);
          const n = sg.attributes.position.count, cc = new Float32Array(n * 3); for (let i = 0; i < n; i++) cc.set([c.r, c.g, c.b], i * 3); sg.setAttribute('color', new T.BufferAttribute(cc, 3));
          const sole = new T.Mesh(sg, soleMat); sole.castShadow = true; foot.add(sole);
        }
        for (let k = 0; k < 4; k++) { const u = 0.44 + k * 0.07, z = z0 + (z1 - z0) * u; const l = new T.Mesh(new T.BoxGeometry(width(u) * 0.85, 0.004, 0.006), laceMat); l.position.set(cx - a[0], height(u) + 0.004 - a[1], z - a[2]); l.rotation.x = -0.25; foot.add(l); }
      }
    }

    // -------------------------------------------------------------- thobe skirt (Verlet cloth pinned to the pelvis)
    buildSkirt() {
      const D = this.D, B = this.bones;
      const hips = cleanProfile(D.cap.hips), hz = D.lm.hip[2];
      const yTop = D.hem + 0.035, yHem = 0.085, NR = 19, NC = 44;
      const legPt = (sd, y) => { // point on a natural standing leg (feet ~20 cm apart, not the bind A-stance)
        const h = B['upperleg01_' + sd].userData.head, a = B['foot_' + sd].userData.head, s = sd === 'L' ? 1 : -1;
        const t = clamp((h.y - y) / (h.y - a.y), 0, 1);
        return new V3(lerp(h.x, s * 0.098, t), y, lerp(h.z, a.z + 0.01, t) + 0.02 * Math.sin(Math.PI * t));
      };
      const cl = this.skirt = new Cloth(NR * NC); const rowY = [];
      for (let i = 0; i < NR; i++) {
        const t = i / (NR - 1), y = lerp(yTop, yHem, Math.pow(t, 0.92)); rowY.push(y);
        const pl = legPt('L', y), pr = legPt('R', y), legR = lerp(0.07, 0.05, t), ease = lerp(0.004, 0.034, Math.pow(t, 0.8)), legW = smooth(0.05, 0.3, t);
        for (let j = 0; j < NC; j++) {
          const th = j / NC * TAU, dx = Math.sin(th), dz = Math.cos(th);
          let r = profileR(hips, Math.max(y, hips[0].y), th) + (i === 0 ? 0.001 : 0.006);
          const sup = Math.max(dx * pl.x + dz * (pl.z - hz), dx * pr.x + dz * (pr.z - hz)) + legR + ease;
          r = Math.max(r, lerp(r, sup, legW));
          if (i > 0) { const prev = cl.p[((i - 1) * NC + j) * 3], pz = cl.p[((i - 1) * NC + j) * 3 + 2] - hz; r = Math.max(r, Math.hypot(prev, pz) * 0.985); }
          const v = (i * NC + j) * 3; cl.p[v] = dx * r; cl.p[v + 1] = y; cl.p[v + 2] = hz + dz * r;
        }
      }
      const id = (i, j) => i * NC + ((j % NC) + NC) % NC;
      for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) {
        if (i + 1 < NR) { cl.link(id(i, j), id(i + 1, j), 1); cl.link(id(i, j), id(i + 1, j + 1), 0.5); cl.link(id(i, j), id(i + 1, j - 1), 0.5); }
        cl.link(id(i, j), id(i, j + 1), 0.9);
        if (i + 2 < NR) cl.link(id(i, j), id(i + 2, j), 0.55);
        cl.link(id(i, j), id(i, j + 2), 0.3);
      }
      cl.finalize();
      // pins: the two top rows ride the pelvis (root bone)
      const rootB = B.root, rh = rootB.userData.head; this.skirtPins = [];
      for (let i = 0; i < 2; i++) for (let j = 0; j < NC; j++) { const k = id(i, j); cl.w[k] = 0; this.skirtPins.push([k, new V3(cl.p[k * 3] - rh.x, cl.p[k * 3 + 1] - rh.y, cl.p[k * 3 + 2] - rh.z)]); }
      { const rl = new Float32Array(cl.n * 3), md = new Float32Array(cl.n);
        for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) { const k = id(i, j); rl[k * 3] = cl.p[k * 3] - rh.x; rl[k * 3 + 1] = cl.p[k * 3 + 1] - rh.y; rl[k * 3 + 2] = cl.p[k * 3 + 2] - rh.z; md[k] = 0.025 + 0.42 * Math.pow(i / (NR - 1), 1.1); }
        cl.setTethers(rl, md); }
      this.skirtSide = new Int8Array(cl.n);
      for (let i = 2; i < NR; i++) for (let j = 0; j < NC; j++) { const th = j / NC * TAU, c = Math.cos(th); this.skirtSide[id(i, j)] = c > 0.45 ? 1 : c < -0.45 ? -1 : 0; }
      // render mesh (seam column duplicated for UVs)
      const g = new T.BufferGeometry(), nv = NR * (NC + 1);
      const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
      for (let i = 0; i < NR; i++) for (let j = 0; j <= NC; j++) { const v = i * (NC + 1) + j; uv[v * 2] = j / NC * 3; uv[v * 2 + 1] = 1 - i / (NR - 1) * 2; }
      for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NC; j++) { const a = i * (NC + 1) + j, b = a + 1, c = a + NC + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
      const mesh = this.skirtMesh = new T.Mesh(g, this.mats.cloth); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'boy-thobe-skirt';
      this.model.add(mesh); this.skirtNR = NR; this.skirtNC = NC;
    }

    // -------------------------------------------------------------- ghutra: rigid cap on the head + draped cloth over neck/shoulders/back
    buildGhutra() {
      const D = this.D, B = this.bones, cap = D.cap, lm = D.lm;
      const prof = cleanProfile(cap.profile), torso = cleanProfile(cap.torso);
      this.headProf = prof; this.torsoProf = torso;
      const hc = cap.center, top = cap.top, brow = cap.brow, yJaw = lm.chin[1] + 0.035;
      const NC = 40, NH = 17, rows = [];
      for (let k = 0; k < NH; k++) rows.push(lerp(top - 0.005, yJaw, Math.pow(k / (NH - 1), 1.05)));
      const hemY = th => { const b = (1 - Math.cos(th)) / 2; return lerp(1.085, 0.95, Math.pow(b, 1.4)); };
      for (let y = yJaw - 0.018; y > 0.94; y -= 0.018) rows.push(y);
      const yAg = top - 0.052;
      const grid = rows.map(() => new Int32Array(NC).fill(-1));
      const P = [], pinned = [];
      const thetaCut = y => y >= brow ? 0 : 0.98 * Math.sqrt(clamp((brow - y) / 0.014, 0, 1));
      const nc = [0, lm.neck[2] + 0.004];
      for (let i = 0; i < rows.length; i++) {
        const y = rows[i], isHead = i < NH;
        for (let j = 0; j < NC; j++) {
          let th = j / NC * TAU; const ths = th > Math.PI ? th - TAU : th;           // signed angle, 0 = front
          if (Math.abs(ths) < thetaCut(y)) continue;
          if (!isHead && y < hemY(th)) continue;
          const dx = Math.sin(th), dz = Math.cos(th);
          let x, z, yy = y;
          if (isHead) {
            const back = smooth(0.4, 2.6, Math.abs(ths));
            let r = profileR(prof, y, th) + 0.009 + 0.006 * back * smooth(yAg, yJaw, y) - 0.003 * Math.exp(-(((y - yAg) / 0.008) ** 2));
            if (y > brow && y < brow + 0.032) { const pk = Math.exp(-((ths / 0.3) ** 2)) * (1 - (y - brow) / 0.032); r += 0.012 * pk; yy += 0.003 * pk; } // front peak
            if (i === 0) r *= 0.6;
            x = hc[0] + dx * r; z = hc[2] + dz * r;
          } else {
            const t = clamp((yJaw - y) / 0.12, 0, 1);
            const jr = profileR(prof, yJaw, th) + 0.012;
            const jx = hc[0] + dx * jr, jz = hc[2] + dz * jr;
            const rn = Math.hypot(jx - nc[0], jz - nc[1]);
            const tr = y <= lm.neck[1] + 0.005 ? profileR(torso, y, th) + 0.026 : 0;
            const r = Math.max(lerp(rn, 0.07, t * 0.5), tr, 0.065);
            x = nc[0] + dx * r; z = nc[1] + dz * r;
          }
          grid[i][j] = P.length; P.push([x, yy, z]); pinned.push(isHead);
        }
      }
      const apex = P.length; P.push([hc[0], top + 0.004, hc[2] - 0.004]); pinned.push(true);
      const cl = this.ghutra = new Cloth(P.length);
      P.forEach((p, i) => { cl.p.set(p, i * 3); if (pinned[i]) cl.w[i] = 0; });
      const at = (i, j) => (i >= 0 && i < rows.length) ? grid[i][((j % NC) + NC) % NC] : -1;
      for (let i = 0; i < rows.length; i++) for (let j = 0; j < NC; j++) {
        const a = at(i, j); if (a < 0) continue;
        const L = (b, k) => { if (b >= 0 && (cl.w[a] || cl.w[b])) cl.link(a, b, k); };
        L(at(i + 1, j), 1); L(at(i, j + 1), 0.9); L(at(i + 1, j + 1), 0.45); L(at(i + 1, j - 1), 0.45); L(at(i + 2, j), 0.5); L(at(i, j + 2), 0.3);
      }
      cl.finalize();
      const hh = B.head.userData.head; this.ghutraPins = [];
      for (let i = 0; i < cl.n; i++) if (!cl.w[i]) this.ghutraPins.push([i, new V3(cl.p[i * 3] - hh.x, cl.p[i * 3 + 1] - hh.y, cl.p[i * 3 + 2] - hh.z)]);
      { const rl = new Float32Array(cl.n * 3), md = new Float32Array(cl.n);
        for (let i = 0; i < cl.n; i++) { rl[i * 3] = cl.p[i * 3] - hh.x; rl[i * 3 + 1] = cl.p[i * 3 + 1] - hh.y; rl[i * 3 + 2] = cl.p[i * 3 + 2] - hh.z; md[i] = 0.015 + 0.38 * Math.max(0, yJaw - cl.p[i * 3 + 1]); }
        cl.setTethers(rl, md); }
      // render mesh
      const idx = [], uv = new Float32Array(cl.n * 2);
      for (let i = 0; i < rows.length; i++) for (let j = 0; j < NC; j++) { const a = at(i, j); if (a >= 0) { uv[a * 2] = j / NC * 4; uv[a * 2 + 1] = 1 - i / (rows.length - 1); } }
      uv[apex * 2] = 0.5; uv[apex * 2 + 1] = 1.02;
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < NC; j++) {
        const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1);
        if (a >= 0 && b >= 0 && c >= 0 && d >= 0) idx.push(a, b, c, b, d, c);
        else if (a >= 0 && b >= 0 && c >= 0) idx.push(a, b, c);
        else if (a >= 0 && b >= 0 && d >= 0) idx.push(a, b, d);
        else if (a >= 0 && c >= 0 && d >= 0) idx.push(a, d, c);
        else if (b >= 0 && c >= 0 && d >= 0) idx.push(b, d, c);
      }
      for (let j = 0; j < NC; j++) { const a = at(0, j), b = at(0, j + 1); if (a >= 0 && b >= 0) idx.push(apex, b, a); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(cl.n * 3), 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
      const mesh = this.ghutraMesh = new T.Mesh(g, this.mats.ghutra); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'boy-ghutra';
      this.model.add(mesh);
      this.ghutraInfo = { yAg, hc, rows, NH, grid, NC };
    }

    // -------------------------------------------------------------- agal (rigid, on the head bone) + two hanging tassels
    buildAgal() {
      const B = this.B = this.bones, { yAg, hc } = this.ghutraInfo, prof = this.headProf, head = B.head, hh = head.userData.head;
      const ringPts = dy => { const pts = []; for (let k = 0; k < 48; k++) { const th = k / 48 * TAU, dx = Math.sin(th), dz = Math.cos(th); const y = yAg + dy + 0.011 * Math.cos(th); const r = profileR(prof, y, th) + 0.0175; pts.push(new V3(hc[0] + dx * r - hh.x, y - hh.y, hc[2] + dz * r - hh.z)); } return new T.CatmullRomCurve3(pts, true); };
      for (const dy of [0.0, -0.0155]) { const m = new T.Mesh(new T.TubeGeometry(ringPts(dy), 96, 0.0068, 10, true), this.mats.agal); m.castShadow = true; m.name = 'boy-agal-ring'; head.add(m); }
      // tassel cords: short Verlet chains hanging from the back of the agal
      const th = Math.PI, r = profileR(prof, yAg - 0.008, th) + 0.02;
      this.tassels = [];
      for (const s of [-1, 1]) {
        const anchor = new V3(hc[0] + s * 0.012, yAg - 0.01 - 0.006, hc[2] - r);
        const n = 7, seg = 0.022, chain = new Cloth(n);
        for (let i = 0; i < n; i++) chain.p.set([anchor.x, anchor.y - i * seg, anchor.z - 0.004 * i], i * 3);
        for (let i = 0; i < n - 1; i++) chain.link(i, i + 1, 1);
        chain.finalize(); chain.w[0] = 0;
        const parts = []; for (let i = 0; i < n - 1; i++) { const m = new T.Mesh(new T.CylinderGeometry(i === n - 2 ? 0.0065 : 0.0032, i === n - 2 ? 0.0045 : 0.0032, 1, 6), this.mats.agal); m.castShadow = true; this.model.add(m); parts.push(m); }
        this.tassels.push({ chain, anchor: anchor.clone().sub(hh), parts });
      }
    }

    // -------------------------------------------------------------- rig cache
    cacheRig() {
      const B = this.bones, h = n => B[n].userData.head;
      this.legs = {};
      for (const sd of ['L', 'R']) {
        const hip = h('upperleg01_' + sd), knee = h('lowerleg01_' + sd), ankle = h('foot_' + sd), toe = B['foot_' + sd].userData.tail;
        this.legs[sd] = { sd, l1: hip.distanceTo(knee), l2: knee.distanceTo(ankle), rThigh: knee.clone().sub(hip).normalize(), rShin: ankle.clone().sub(knee).normalize(), rFoot: toe.clone().sub(ankle).normalize(), restAnkle: ankle.clone(), thigh: B['upperleg01_' + sd], shin: B['lowerleg01_' + sd], foot: B['foot_' + sd] };
        const sh = h('upperarm01_' + sd), el = h('lowerarm01_' + sd), wr = h('wrist_' + sd);
        const across = h('finger2-1_' + sd).clone().sub(h('finger5-1_' + sd)).normalize(), hand = h('finger3-1_' + sd).clone().sub(wr).normalize();
        let palm = new V3().crossVectors(hand, across).normalize(); if (palm.y > 0) palm.negate();
        const fingers = [];
        for (let f = 1; f <= 5; f++) for (let s = 1; s <= 3; s++) { const b = B[`finger${f}-${s}_${sd}`]; const dir = b.userData.tail.clone().sub(b.userData.head).normalize(); fingers.push({ b, f, axis: new V3().crossVectors(dir, palm).normalize() }); }
        this['arm' + sd] = { sd, rUpper: el.clone().sub(sh).normalize(), rFore: wr.clone().sub(el).normalize(), upper: B['upperarm01_' + sd], fore: B['lowerarm01_' + sd], wrist: B['wrist_' + sd], clav: B['clavicle_' + sd], fingers };
      }
      this.spine = ['spine05', 'spine04', 'spine03', 'spine02', 'spine01'].map(n => B[n]);
      this.neck = ['neck01', 'neck02', 'neck03', 'head'].map(n => B[n]);
      this.rootRest = B.root.userData.head.clone();
      this._q = new Q(); this._q2 = new Q(); this._e = new T.Euler(); this._v = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new V3());
      this._m = new T.Matrix4(); this._mi = new T.Matrix4();
    }

    // aim `bone` so its rest direction `rest` (bind space) points along world direction `dirW`
    aim(bone, rest, dirW) {
      const pq = this._q2; bone.parent.getWorldQuaternion(pq); pq.invert();
      const d = this._v[7].copy(dirW).applyQuaternion(pq).normalize();
      bone.quaternion.setFromUnitVectors(rest, d);
      bone.updateMatrixWorld(true);
    }

    // -------------------------------------------------------------- apply a pose (see Animator) to the skeleton
    applyPose(P) {
      const B = this.bones, g = this.group, model = this.model, e = this._e;
      B.root.position.set(this.rootRest.x + P.rx, this.rootRest.y + P.ry, this.rootRest.z + P.rz);
      B.root.quaternion.setFromEuler(e.set(P.rp, P.ryaw, P.rr, 'YXZ'));
      const sf = [0.16, 0.2, 0.2, 0.24, 0.2];
      this.spine.forEach((b, i) => b.quaternion.setFromEuler(e.set(P.sp * sf[i], P.sy * sf[i], P.sr * sf[i], 'YXZ')));
      const nf = [0.25, 0.25, 0.2, 0.3];
      this.neck.forEach((b, i) => b.quaternion.setFromEuler(e.set(P.np * nf[i], P.ny * nf[i], P.nr * nf[i], 'YXZ')));
      g.updateMatrixWorld(true);
      const gq = this._q; g.getWorldQuaternion(gq);
      const V = this._v;
      // legs: two-bone IK toward ankle targets given in boy (group) space
      for (const sd of ['L', 'R']) {
        const L = this.legs[sd], s = sd === 'L' ? 1 : -1;
        const hip = L.thigh.getWorldPosition(V[0]);
        const tgt = V[1].set(P[sd + 'ax'], P[sd + 'ay'], P[sd + 'az']); g.localToWorld(tgt);
        const d = V[2].subVectors(tgt, hip); let dist = d.length();
        const maxL = (L.l1 + L.l2) * 0.9995, minL = Math.abs(L.l1 - L.l2) * 1.05 + 0.05;
        dist = clamp(dist, minL, maxL); d.normalize();
        const pole = V[3].set(s * P[sd + 'ko'], -0.05, 1).normalize().applyQuaternion(gq);
        pole.addScaledVector(d, -pole.dot(d)).normalize();
        const a = (L.l1 * L.l1 - L.l2 * L.l2 + dist * dist) / (2 * dist), hgt = Math.sqrt(Math.max(0, L.l1 * L.l1 - a * a));
        const knee = V[4].copy(hip).addScaledVector(d, a).addScaledVector(pole, hgt);
        this.aim(L.thigh, L.rThigh, V[5].subVectors(knee, hip));
        const ankle = V[6].copy(hip).addScaledVector(d, dist);
        this.aim(L.shin, L.rShin, V[5].subVectors(ankle, knee));
        const fp = P[sd + 'fp'];
        const fdir = V[5].set(0, -Math.sin(0.47 + fp), Math.cos(0.47 + fp)).applyQuaternion(gq);
        this.aim(L.foot, L.rFoot, fdir);
      }
      // arms in the chest frame
      const chestQ = B.spine01.getWorldQuaternion(this._q2.clone());
      for (const sd of ['L', 'R']) {
        const A = this['arm' + sd], s = sd === 'L' ? 1 : -1;
        const sw = P[sd + 'sw'], ab = P[sd + 'ab'], el = P[sd + 'el'], tw = P[sd + 'tw'];
        A.clav.quaternion.setFromEuler(e.set(0, 0, -s * P.shrug, 'XYZ')); A.clav.updateMatrixWorld(true);
        const up = V[0].set(s * Math.sin(ab), -Math.cos(sw) * Math.cos(ab), Math.sin(sw) * Math.cos(ab)).normalize();
        const hinge = V[1].crossVectors(up, V[2].set(0, 0, 1)); if (hinge.lengthSq() < 1e-6) hinge.set(-1, 0, 0); hinge.normalize();
        const fore = V[3].copy(up).applyAxisAngle(hinge, el).applyAxisAngle(V[2].set(0, 1, 0), -s * tw).normalize();
        this.aim(A.upper, A.rUpper, up.applyQuaternion(chestQ));
        this.aim(A.fore, A.rFore, fore.applyQuaternion(chestQ));
        A.wrist.quaternion.setFromEuler(e.set(P[sd + 'wf'] || 0, 0, 0)); A.wrist.updateMatrixWorld(true);
        const curl = P[sd + 'hc'];
        for (const F of A.fingers) { const k = F.f === 1 ? 0.35 : 1; F.b.quaternion.setFromAxisAngle(F.axis, curl * k * (F.f === 1 ? 0.6 : 1.25)); }
      }
      model.updateMatrixWorld(true);
    }

    // -------------------------------------------------------------- cloth simulation step (model space)
    toModel(bone, local, out) { return out.copy(local).applyMatrix4(bone.matrixWorld).applyMatrix4(this._mi); }
    simulate(dt, speed) {
      this.model.updateMatrixWorld(true);
      this._mi.copy(this.model.matrixWorld).invert();
      const B = this.bones, V = this._v;
      // group acceleration (world) → inertial acceleration in model space
      const gp = this.group.getWorldPosition(V[0]);
      if (!this._init) { this.prevGroupPos.copy(gp); this.groupVel.set(0, 0, 0); this._init = true; }
      const vel = V[1].subVectors(gp, this.prevGroupPos).divideScalar(Math.max(dt, 1e-4));
      const acc = V[2].subVectors(vel, this.groupVel).divideScalar(Math.max(dt, 1e-4));
      if (acc.length() > 40) acc.setLength(40);
      this._accSm.lerp(acc, 0.35); this.groupVel.copy(vel); this.prevGroupPos.copy(gp);
      const inv = this._q; this.model.getWorldQuaternion(inv); inv.invert();
      const g = V[3].set(0, -9.81, 0).sub(this._accSm).applyQuaternion(inv);
      this.time += dt;
      const gust = 0.75 + 0.25 * Math.sin(this.time * 2.3) * Math.sin(this.time * 0.7 + 1);
      const wind = -0.022 * speed * Math.abs(speed) * gust;
      // pins
      const pinTo = (cl, pins, bone) => { for (const [k, loc] of pins) { this.toModel(bone, loc, V[4]); cl.pin(k, V[4].x, V[4].y, V[4].z); } };
      // colliders (model space)
      const P = n => this.toModel(B[n], V[5].set(0, 0, 0), new V3());
      const caps = [], sided = [];
      for (const sd of ['L', 'R']) {
        const hip = P('upperleg01_' + sd), knee = P('lowerleg01_' + sd), ank = P('foot_' + sd);
        const th0 = hip.clone().lerp(knee, 0.28);
        caps.push([th0, knee, 0.072], [knee, ank, 0.056]);
        sided.push([th0, knee, 0.072], [knee, ank.clone().add(new V3(0, -0.03, 0)), 0.058]);
      }
      const hipL = P('upperleg01_L'), hipR = P('upperleg01_R'), pelv = P('root');
      const buttL = hipL.clone().add(new V3(0, 0.01, -0.035)), buttR = hipR.clone().add(new V3(0, 0.01, -0.035));
      caps.push([buttL, buttR, 0.1]);
      const arms = [];
      for (const sd of ['L', 'R']) { const sh = P('upperarm01_' + sd), el = P('lowerarm01_' + sd), wr = P('wrist_' + sd); arms.push([sh, el, 0.05], [el, wr, 0.04]); }
      const neckA = P('neck01'), headA = P('head');
      const h = 1 / 180, steps = clamp(Math.round(dt / h), 1, this.quality > 0 ? 5 : 2), hs = dt / steps, iters = this.quality > 0 ? 4 : 2;
      const ground = -this.group.position.y - this.model.position.y + 0.004;
      const mRoot = this._mr || (this._mr = new T.Matrix4()), mHead = this._mh || (this._mh = new T.Matrix4());
      mRoot.copy(this._mi).multiply(B.root.matrixWorld); mHead.copy(this._mi).multiply(B.head.matrixWorld);
      // skirt
      pinTo(this.skirt, this.skirtPins, B.root);
      for (let s = 0; s < steps; s++) {
        this.skirt.integrate(hs, g.x, g.y, g.z + wind, 0.978);
        for (let it = 0; it < iters; it++) {
          this.skirt.solve();
          this.skirt.tether(mRoot);
          for (const c of caps) collideCapsule(this.skirt, c[0].x, c[0].y, c[0].z, c[1].x, c[1].y, c[1].z, c[2]);
          for (const c of sided) collideLegSided(this.skirt, this.skirtSide, c[0].x, c[0].y, c[0].z, c[1].x, c[1].y, c[1].z, c[2]);
          const p = this.skirt.p; for (let i = 1; i < p.length; i += 3) if (p[i] < ground) p[i] = ground;
        }
      }
      // ghutra
      pinTo(this.ghutra, this.ghutraPins, B.head);
      for (let s = 0; s < steps; s++) {
        this.ghutra.integrate(hs, g.x, g.y, g.z + wind * 0.3, 0.975);
        for (let it = 0; it < iters; it++) {
          this.ghutra.solve();
          this.ghutra.tether(mHead);
          this.collideTorso(this.ghutra, 0.02);
          collideCapsule(this.ghutra, neckA.x, neckA.y, neckA.z, headA.x, headA.y, headA.z, 0.058);
          for (const c of arms) collideCapsule(this.ghutra, c[0].x, c[0].y, c[0].z, c[1].x, c[1].y, c[1].z, c[2] + 0.012);
        }
      }
      // tassels
      for (const tz of this.tassels) {
        this.toModel(B.head, tz.anchor, V[4]); tz.chain.pin(0, V[4].x, V[4].y, V[4].z);
        for (let s = 0; s < steps; s++) { tz.chain.integrate(hs, g.x, g.y, g.z + wind * 0.4, 0.97); for (let it = 0; it < 3; it++) { tz.chain.solve(); this.collideTorso(tz.chain, 0.036); } }
        const p = tz.chain.p;
        tz.parts.forEach((m, i) => { const a = V[5].fromArray(p, i * 3), b = V[6].fromArray(p, i * 3 + 3); m.position.copy(a).add(b).multiplyScalar(0.5); const d = V[7].subVectors(b, a); const len = d.length() || 1e-4; m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(V[4].set(0, 1, 0), d.divideScalar(len)); });
      }
      this.syncClothMeshes();
    }
    // keep cloth outside the torso: radial profile measured in bind space, evaluated in the spine01 frame
    collideTorso(cl, margin) {
      const B = this.bones, sp = B.spine01, V = this._v;
      const toBone = this._toBone || (this._toBone = new T.Matrix4()); toBone.copy(sp.matrixWorld).invert().multiply(this.model.matrixWorld);
      const fromBone = this._fromBone || (this._fromBone = new T.Matrix4()); fromBone.copy(this._mi).multiply(sp.matrixWorld);
      const hd = sp.userData.head, nz = this.D.lm.neck[2], prof = this.torsoProf, y0 = prof[0].y, y1 = prof[prof.length - 1].y;
      const p = cl.p, v = V[0];
      for (let i = 0; i < cl.n; i++) {
        if (!cl.w[i]) continue;
        v.fromArray(p, i * 3).applyMatrix4(toBone).add(hd);       // → bind space
        if (v.y < y0 - 0.05 || v.y > y1) continue;
        const dx = v.x, dz = v.z - nz, rr = Math.hypot(dx, dz) || 1e-5;
        const th = Math.atan2(dx, dz), R = profileR(prof, clamp(v.y, y0, y1), th) + margin;
        if (rr < R) { v.x = dx / rr * R; v.z = nz + dz / rr * R; v.sub(hd).applyMatrix4(fromBone); p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; }
      }
    }
    syncClothMeshes() {
      const NR = this.skirtNR, NC = this.skirtNC, pos = this.skirtMesh.geometry.attributes.position.array;
      // one Laplacian pass on the rendered surface (simulation untouched) — removes sub-grid crumpling
      const raw = this.skirt.p, sp = this._skS || (this._skS = new Float32Array(raw.length));
      for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) {
        const k = (i * NC + j) * 3;
        if (i < 2 || i === NR - 1) { sp[k] = raw[k]; sp[k + 1] = raw[k + 1]; sp[k + 2] = raw[k + 2]; continue; }
        const a = ((i - 1) * NC + j) * 3, b = ((i + 1) * NC + j) * 3, c = (i * NC + (j + 1) % NC) * 3, d = (i * NC + (j + NC - 1) % NC) * 3;
        for (let q = 0; q < 3; q++) sp[k + q] = raw[k + q] * 0.5 + (raw[a + q] + raw[b + q] + raw[c + q] + raw[d + q]) * 0.125;
      }
      for (let i = 0; i < NR; i++) { for (let j = 0; j < NC; j++) { const s = (i * NC + j) * 3, d = (i * (NC + 1) + j) * 3; pos[d] = sp[s]; pos[d + 1] = sp[s + 1]; pos[d + 2] = sp[s + 2]; } const s = (i * NC) * 3, d = (i * (NC + 1) + NC) * 3; pos[d] = sp[s]; pos[d + 1] = sp[s + 1]; pos[d + 2] = sp[s + 2]; }
      this.skirtMesh.geometry.attributes.position.needsUpdate = true; this.skirtMesh.geometry.computeVertexNormals();
      const gp = this.ghutraMesh.geometry.attributes.position; gp.array.set(this.ghutra.p); gp.needsUpdate = true; this.ghutraMesh.geometry.computeVertexNormals();
    }
    settle(n = 240) { for (let i = 0; i < n; i++) this.simulate(1 / 120, 0); }

    // world-space helpers for gameplay/camera
    headWorld(out) { return this.bones.head.getWorldPosition(out); }
  }

  // ------------------------------------------------------------------ Animator: produces a pose (plain numbers, blendable)
  const KEYS = ['rx', 'ry', 'rz', 'rp', 'ryaw', 'rr', 'sp', 'sy', 'sr', 'np', 'ny', 'nr', 'shrug',
    'Lax', 'Lay', 'Laz', 'Lfp', 'Lko', 'Rax', 'Ray', 'Raz', 'Rfp', 'Rko',
    'Lsw', 'Lab', 'Lel', 'Ltw', 'Lhc', 'Lwf', 'Rsw', 'Rab', 'Rel', 'Rtw', 'Rhc', 'Rwf'];
  function blank() { const p = {}; for (const k of KEYS) p[k] = 0; return p; }
  function mix(out, a, b, t) { for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t; return out; }
  function catmull(pts, ts, u) { // pts: [[z,y],...], ts: knot times
    let k = 0; while (k < ts.length - 2 && u > ts[k + 1]) k++;
    const t = (u - ts[k]) / (ts[k + 1] - ts[k]);
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
    const t2 = t * t, t3 = t2 * t;
    const f = i => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
    return [f(0), f(1)];
  }
  const lin = (x, xs, ys) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1])); return ys[ys.length - 1]; };

  class Animator {
    constructor(boy) {
      this.boy = boy; this.phase = 0; this.pose = blank(); this.prev = blank(); this.cur = blank();
      this.ankleH = boy.legs.L.restAnkle.y + SOLE; this.hipRestY = boy.rootRest.y + SOLE;
      this.state = 'idle'; this.stateT = 0; this.fade = 1; this.fadeDur = 0.2; this.from = blank();
      this.onFootstep = null; this.lastContact = { L: false, R: false };
      this.lean = 0; this.leanVel = 0; this.speedSm = 0;
    }
    set(state, fade = 0.18) {
      if (state === this.state) return;
      this.from = Object.assign({}, this.pose); this.state = state; this.stateT = 0; this.fade = 0; this.fadeDur = fade;
    }
    // ---- gait (walk ↔ run, forward or backward): foot-planted stance, spline swing
    gait(v, p, out, opt = {}) {
      const a = Math.abs(v), dirS = v < 0 ? -1 : 1;
      const R = smooth(1.9, 3.6, a);                     // 0 walk … 1 run
      const Tp = lin(a, [0, 0.8, 1.6, 3, 5, 7, 9, 12], [1.15, 1.05, 0.9, 0.72, 0.62, 0.55, 0.51, 0.46]);
      let ds = lin(a, [0, 0.8, 2, 2.6, 4, 7, 10, 12], [0.66, 0.64, 0.58, 0.42, 0.31, 0.2, 0.15, 0.13]);
      let sweep = a * Tp * ds; const maxS = lerp(0.6, 0.56, R); if (sweep > maxS) { ds = maxS / (a * Tp); sweep = maxS; }
      const lift = clamp(sweep / 0.5, 0.25, 1) * (opt.liftScale || 1);
      const zf = sweep * (R > 0.5 ? 0.36 : 0.48), zb = sweep - zf;
      const legs = {};
      for (const sd of ['L', 'R']) {
        const q = ((p + (sd === 'R' ? 0.5 : 0)) % 1 + 1) % 1, s = sd === 'L' ? 1 : -1;
        let z, y, fp, contact = false;
        if (q < ds) {
          const u = q / ds; z = zf - sweep * u; y = 0; contact = true;
          fp = R > 0.5 ? -0.05 + 0.6 * smooth(0.55, 1, u) : lerp(-0.18, 0, smooth(0, 0.25, u)) + 0.55 * smooth(0.6, 1, u);
          y += (R > 0.5 ? 0.05 : 0.07) * smooth(0.6, 1, u) ** 2;
        } else {
          const u = (q - ds) / (1 - ds);
          const pts = [[-zb, 0], [-zb - 0.03 - 0.03 * R, (0.05 + 0.07 * R) * lift], [-0.06 - 0.1 * R, (0.07 + 0.19 * R) * lift], [0.06 + 0.07 * R, (0.06 + 0.15 * R) * lift], [zf + 0.03 + 0.05 * R, (0.025 + 0.05 * R) * lift], [zf, 0]];
          [z, y] = catmull(pts, [0, 0.12, 0.36, 0.62, 0.86, 1], u);
          fp = lin(u, [0, 0.12, 0.45, 0.85, 1], [0.6, 0.7 * (0.5 + 0.5 * R), 0.25, R > 0.5 ? 0.0 : -0.2, R > 0.5 ? -0.05 : -0.18]);
        }
        if (dirS < 0) { z = -z; fp = fp * 0.5; }
        if (contact && !this.lastContact[sd] && this.onFootstep && a > 0.3) this.onFootstep(sd, a);
        this.lastContact[sd] = contact;
        legs[sd] = { x: s * lerp(0.092, 0.072, R), y: this.ankleH + Math.max(0, y), z: z + 0.015 + (opt.zBias || 0), fp };
      }
      const bobA = lerp(0.016, -0.026, R) * clamp(a / 2.5, 0.2, 1);
      const bob = bobA * Math.cos(TAU * 2 * (p - ds / 2));
      out.ry = -lerp(0.01, 0.034, R) * clamp(a / 3, 0, 1) + bob + (opt.drop || 0);
      out.rz = lerp(0.0, 0.03, R) * dirS; out.rx = 0;
      out.rp = lerp(0.02, 0.08, R) * dirS;
      out.ryaw = -lerp(0.07, 0.05, R) * Math.cos(TAU * p) * dirS;
      out.rr = lerp(0.03, 0.02, R) * Math.sin(TAU * p * 2) * 0.5;
      out.sp = (lerp(0.03, 0.14, R) + (opt.lean || 0)) * (dirS < 0 ? -0.6 : 1);
      out.sy = lerp(0.09, 0.12, R) * Math.cos(TAU * p) * dirS;
      out.sr = 0;
      out.np = -out.sp * 0.75 - out.rp * 0.9 - bob * 0.8;
      out.ny = -out.sy * 0.6 - out.ryaw * 0.7; out.nr = 0; out.shrug = 0.02 * R;
      for (const sd of ['L', 'R']) { out[sd + 'ax'] = legs[sd].x; out[sd + 'ay'] = legs[sd].y; out[sd + 'az'] = legs[sd].z; out[sd + 'fp'] = legs[sd].fp; out[sd + 'ko'] = 0.12; }
      const S = lerp(0.32, 0.72, R) * clamp(a / 3, 0.3, 1);
      const swL = -S * Math.cos(TAU * p) * dirS + 0.04 * R, swR = S * Math.cos(TAU * p) * dirS + 0.04 * R;
      for (const [sd, sw] of [['L', swL], ['R', swR]]) {
        out[sd + 'sw'] = sw; out[sd + 'ab'] = lerp(0.13, 0.2, R); out[sd + 'el'] = lerp(0.28, 1.35, R) + lerp(0.1, 0.35, R) * clamp(sw / Math.max(S, 0.01), 0, 1);
        out[sd + 'tw'] = lerp(0.0, 0.3, R) * clamp(0.5 + sw, 0, 1.2); out[sd + 'hc'] = lerp(0.3, 0.85, R); out[sd + 'wf'] = -0.1;
      }
      return Tp;
    }
    idle(t, out) {
      const br = Math.sin(t * 2.1);
      Object.assign(out, blank());
      out.ry = -0.008 + 0.003 * br; out.rx = 0.008 * Math.sin(t * 0.45); out.rr = -0.01 * Math.sin(t * 0.45);
      out.sp = 0.02 + 0.006 * br; out.np = -0.02; out.shrug = 0.01 * br;
      out.Lax = 0.1; out.Lay = this.ankleH; out.Laz = 0.02; out.Rax = -0.1; out.Ray = this.ankleH; out.Raz = -0.01; out.Lko = out.Rko = 0.1;
      for (const sd of ['L', 'R']) { out[sd + 'sw'] = 0.04; out[sd + 'ab'] = 0.11; out[sd + 'el'] = 0.24; out[sd + 'hc'] = 0.4; out[sd + 'tw'] = 0; out[sd + 'wf'] = -0.05; }
      return out;
    }
    victory(t, out) {
      this.idle(t, out);
      const hop = Math.max(0, Math.sin(t * 6.2)); out.ry += 0.035 * hop;
      for (const sd of ['L', 'R']) { out[sd + 'sw'] = 2.55 + 0.1 * Math.sin(t * 6.2); out[sd + 'ab'] = 0.42; out[sd + 'el'] = 0.35; out[sd + 'hc'] = 1.0; }
      out.np = -0.12; out.sp = -0.04;
      return out;
    }
    jump(j, out) { // j: 0..1 airborne progress
      Object.assign(out, blank());
      const tuck = Math.sin(Math.PI * clamp(j * 1.15, 0, 1));
      const land = smooth(0.62, 1, j);
      out.ry = -0.02 + 0.04 * tuck; out.sp = 0.16 + 0.1 * tuck - 0.12 * land; out.np = -out.sp * 0.7; out.rp = 0.05;
      // hurdle style: right leg leads, left leg tucked behind
      out.Rax = -0.08; out.Ray = this.ankleH + lerp(0.08, 0.3, tuck) * (1 - land) + 0.06 * land; out.Raz = lerp(0.12, 0.34, tuck) * (1 - land) + 0.06 * land; out.Rfp = lerp(0.4, -0.05, tuck);
      out.Lax = 0.085; out.Lay = this.ankleH + lerp(0.2, 0.44, tuck) * (1 - land) + 0.08 * land; out.Laz = lerp(-0.22, -0.18, tuck) * (1 - land) - 0.04 * land; out.Lfp = 0.75 - 0.5 * land;
      out.Lko = out.Rko = 0.12;
      out.Lsw = lerp(0.5, 1.05, tuck); out.Lel = 1.25; out.Lab = 0.22; out.Rsw = lerp(-0.2, -0.55, tuck); out.Rel = 0.95; out.Rab = 0.26;
      out.Lhc = out.Rhc = 0.75; out.Ltw = 0.2; out.Rtw = 0.1;
      return out;
    }
    landing(k, out, base) { // k: 0..1 absorb; base: a running pose to blend into
      const dip = Math.sin(Math.PI * clamp(k, 0, 1));
      Object.assign(out, base); out.ry -= 0.11 * dip; out.sp += 0.12 * dip; out.np -= 0.08 * dip;
      for (const sd of ['L', 'R']) { out[sd + 'ab'] += 0.12 * dip; }
      return out;
    }
    slide(k, out) { // k: 0..1 over the slide
      Object.assign(out, blank());
      const inn = smooth(0, 0.16, k), outW = 1 - smooth(0.82, 1, k), w = inn * outW;
      const drop = this.hipRestY - 0.33;
      out.ry = -drop * w; out.rz = -0.06 * w; out.rp = -0.42 * w; out.rr = 0.08 * w; out.ryaw = 0.12 * w;
      out.sp = -0.18 * w + 0.12 * (1 - w); out.sy = -0.1 * w; out.np = 0.62 * w; out.ny = -0.08 * w;
      // lead leg (L) extended forward along the ground, trail leg (R) folded underneath, knee outward
      out.Lax = lerp(0.08, 0.1, w); out.Lay = this.ankleH + lerp(0.02, 0.06, w); out.Laz = lerp(0.05, 0.64, w); out.Lfp = -0.35 * w; out.Lko = 0.15;
      out.Rax = lerp(-0.08, 0.02, w); out.Ray = this.ankleH + lerp(0.02, 0.02, w); out.Raz = lerp(-0.05, 0.2, w); out.Rfp = 0.6 * w; out.Rko = lerp(0.1, 2.2, w);
      out.Rsw = lerp(0.1, -0.55, w); out.Rab = lerp(0.15, 0.55, w); out.Rel = lerp(0.6, 0.15, w); out.Rhc = 0.3;
      out.Lsw = lerp(0.2, 0.85, w); out.Lab = lerp(0.15, 0.32, w); out.Lel = lerp(0.8, 0.55, w); out.Lhc = 0.6;
      return out;
    }
    recoil(t, out, scratch) { // t seconds since the wave hit; backward stumble then regain balance
      const back = 1 - smooth(0.0, 1.25, t);
      this.gait(-lerp(0.6, 2.3, back), this.phase, out, { lean: -0.32 * back, liftScale: 0.7 });
      const guard = smooth(0, 0.12, t) * (1 - smooth(0.55, 1.1, t));
      for (const sd of ['L', 'R']) { out[sd + 'sw'] = lerp(out[sd + 'sw'], 1.0, guard); out[sd + 'el'] = lerp(out[sd + 'el'], 1.7, guard); out[sd + 'ab'] = lerp(out[sd + 'ab'], 0.32, guard); out[sd + 'hc'] = lerp(out[sd + 'hc'], 0.5, guard); }
      out.np += -0.25 * guard; out.sp -= 0.12 * guard;
      return out;
    }
    // ---- main update: ctx = { state, speed, jumpT, slideT, landT, recoilT, lateral, t }
    update(dt, ctx) {
      const b = this.boy; if (ctx.state !== this.state) this.set(ctx.state, ctx.fade == null ? 0.18 : ctx.fade); this.stateT += dt;
      const cur = this.cur, v = ctx.speed;
      this.speedSm = lerp(this.speedSm, v, 1 - Math.exp(-dt * 8));
      switch (ctx.state) {
        case 'run': case 'walk': case 'decel': {
          const Tp = this.gait(this.speedSm, this.phase, cur, { lean: ctx.accelLean || 0 });
          this.phase = (this.phase + dt / Tp) % 1; break;
        }
        case 'jump': this.jump(ctx.jumpT, cur); this.phase = 0.1; break;
        case 'land': { const base = blank(); const Tp = this.gait(this.speedSm, this.phase, base, {}); this.phase = (this.phase + dt / Tp) % 1; this.landing(ctx.landT, cur, base); break; }
        case 'slide': this.slide(ctx.slideT, cur); break;
        case 'recoil': { this.recoil(ctx.recoilT, cur); const Tp = 0.62; this.phase = (this.phase + dt / Tp) % 1; break; }
        case 'victory': this.victory(ctx.t, cur); break;
        default: this.idle(ctx.t, cur);
      }
      // lane-change lean (critically damped) — roll into the turn, slight hip shift
      const target = clamp(-ctx.lateral * 0.065, -0.2, 0.2);
      this.leanVel += ((target - this.lean) * 120 - this.leanVel * 22) * dt; this.lean += this.leanVel * dt;
      cur.rr += this.lean; cur.sr += this.lean * 0.4; cur.nr -= this.lean * 0.9; cur.ny += clamp(ctx.lateral * 0.02, -0.2, 0.2);
      this.fade = Math.min(1, this.fade + dt / Math.max(this.fadeDur, 1e-3));
      const w = smooth(0, 1, this.fade);
      mix(this.pose, this.from, cur, w);
      b.applyPose(this.pose);
    }
  }

  root.QRBoy = { Boy, Animator, SOLE, blankPose: blank, KEYS };
})(typeof window !== 'undefined' ? window : globalThis);
