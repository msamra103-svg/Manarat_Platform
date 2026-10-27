/* الكرة الطائرة V24 — skinned procedural volleyball athletes.
 *
 * Every athlete is one continuous SkinnedMesh (torso, limbs, head, hands, shoes) driven by a
 * 19-bone skeleton. Geometry, faces, uniforms and textures are generated locally from code —
 * no downloaded models, photos or real-player likenesses.
 *
 * Animation is procedural and time-based: VolleyRally supplies root motion, planted footsteps and
 * the current action; this module turns that into a pose with analytic two-bone IK for both legs
 * (planted feet never slide) and both arms (hands/forearms meet the ball at the contact instant).
 */
(function () {
  'use strict';
  const T = THREE;
  const VR = typeof VolleyRally !== 'undefined' ? VolleyRally : window.VolleyRally;
  const B = VR.BODY, H = 1.95, R = VR.BALL.radius;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => smooth((t - a) / ((b - a) || 1e-6));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ───────── skeleton (character space: 1.95 m tall, facing +z, left side = +x) ─────────
  const LEN = { thigh: B.thigh * H, shin: B.shin * H, upper: B.upperArm * H, fore: B.foreArm * H, palm: B.palm * H, ankle: B.ankle * H };
  const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'upperL', 'foreL', 'handL', 'clavR', 'upperR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
  const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
  const Y = { pelvis: B.pelvis * H, waist: B.waist * H, chest: B.chest * H, neck: 1.6, head: 1.69, headCenter: 1.822, shoulder: B.shoulder * H, hip: B.hip * H };

  function buildSkeleton() {
    const bones = {};
    const mk = (name, parent, x, y, z) => { const b = new T.Bone(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); bones[name] = b; return b; };
    const hips = mk('hips', null, 0, Y.pelvis, 0);
    const spine = mk('spine', hips, 0, Y.waist - Y.pelvis, 0);
    const chest = mk('chest', spine, 0, Y.chest - Y.waist, 0);
    const neck = mk('neck', chest, 0, Y.neck - Y.chest, -0.012);
    mk('head', neck, 0, Y.head - Y.neck, 0.004);
    for (const [S, g] of [['L', 1], ['R', -1]]) {
      const clav = mk('clav' + S, chest, g * 0.03, Y.shoulder - Y.chest - 0.006, -0.004);
      const upper = mk('upper' + S, clav, g * (B.shoulderWidth * H - 0.03), 0.006, 0);
      upper.rotation.z = g * 0.2; // A-pose for binding, keeps arms clear of the torso
      const fore = mk('fore' + S, upper, 0, -LEN.upper, 0);
      mk('hand' + S, fore, 0, -LEN.fore, 0);
      const thigh = mk('thigh' + S, hips, g * B.hipWidth * H, Y.hip - Y.pelvis, 0);
      const shin = mk('shin' + S, thigh, 0, -LEN.thigh, 0);
      mk('foot' + S, shin, 0, -LEN.shin, 0);
    }
    hips.updateMatrixWorld(true);
    return { bones, list: BONES.map((n) => bones[n]) };
  }

  // ───────── geometry builder ─────────
  class Builder {
    constructor() { this.parts = []; }
    add(part) { this.parts.push(part); return part; }
    merge(materialCount) {
      let nv = 0;
      for (const p of this.parts) nv += p.pos.length / 3;
      const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
      const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
      const perMat = Array.from({ length: materialCount }, () => []);
      let o = 0;
      for (const p of this.parts) {
        const n = p.pos.length / 3;
        pos.set(p.pos, o * 3); nrm.set(p.nrm, o * 3); uv.set(p.uv, o * 2); col.set(p.col, o * 3); si.set(p.si, o * 4); sw.set(p.sw, o * 4);
        for (const i of p.idx) perMat[p.mat].push(i + o);
        o += n;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
      const all = [];
      perMat.forEach((list, m) => { if (list.length) { g.addGroup(all.length, list.length, m); all.push(...list); } });
      g.setIndex(all);
      g.computeBoundingSphere();
      return g;
    }
  }
  // Finalise a raw mesh part: normals (seam-averaged), colours and skin attributes.
  function finish(raw, mat, weightFn, color = [1, 1, 1], colorFn = null) {
    const n = raw.pos.length / 3;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(raw.pos, 3));
    g.setIndex(raw.idx);
    g.computeVertexNormals();
    const nrm = g.attributes.normal.array;
    for (const [a, b] of raw.seams || []) {
      for (let k = 0; k < 3; k++) { const m = (nrm[a * 3 + k] + nrm[b * 3 + k]) / 2; nrm[a * 3 + k] = nrm[b * 3 + k] = m; }
    }
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), col = new Float32Array(n * 3);
    const v = new T.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromArray(raw.pos, i * 3);
      const w = weightFn(i, v, raw);
      let tot = 0;
      w.slice(0, 4).forEach(([b, x], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = x; tot += x; });
      for (let k = 0; k < 4; k++) sw[i * 4 + k] /= tot || 1;
      const c = colorFn ? colorFn(i, v, raw) : color;
      col.set(c, i * 3);
    }
    g.dispose();
    return { pos: raw.pos, nrm: Float32Array.from(nrm), uv: raw.uv, idx: raw.idx, si, sw, col, mat, ring: raw.ring, rings: raw.rings };
  }
  // Loft: rings of a (super)ellipse swept along a centre line.
  function loft(o) {
    const { centers, rx, rz, M = 16, ref = new T.Vector3(0, 0, 1), e = 2, theta0 = 0, shape = null, capStart = false, capEnd = false, vOf = null } = o;
    const N = centers.length, pos = [], uv = [], idx = [], ring = [], seams = [];
    const t = new T.Vector3(), f = new T.Vector3(), s = new T.Vector3(), p = new T.Vector3();
    for (let i = 0; i < N; i++) {
      t.subVectors(centers[Math.min(N - 1, i + 1)], centers[Math.max(0, i - 1)]).normalize();
      f.copy(ref).addScaledVector(t, -ref.dot(t)).normalize();
      s.crossVectors(t, f).normalize();
      for (let j = 0; j <= M; j++) {
        const th = theta0 + (j / M) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        const pc = Math.sign(c) * Math.pow(Math.abs(c), 2 / e), ps = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e);
        const k = shape ? shape(i / (N - 1), th) : 1;
        p.copy(centers[i]).addScaledVector(f, pc * rz[i] * k).addScaledVector(s, ps * rx[i] * k);
        if (o.offset) { const d = o.offset(i / (N - 1), th); p.x += d[0]; p.y += d[1]; p.z += d[2]; }
        pos.push(p.x, p.y, p.z);
        uv.push(j / M, vOf ? vOf(i / (N - 1)) : i / (N - 1));
        ring.push(i);
      }
      seams.push([i * (M + 1), i * (M + 1) + M]);
    }
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const cap = (i, flip) => {
      const ci = pos.length / 3;
      pos.push(centers[i].x, centers[i].y, centers[i].z); uv.push(0.5, i / (N - 1)); ring.push(i);
      for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
    };
    if (capStart) cap(0, false);
    if (capEnd) cap(N - 1, true);
    // Make winding point outward (paths may run up or down).
    const v0 = new T.Vector3().fromArray(pos, idx[0] * 3), v1 = new T.Vector3().fromArray(pos, idx[1] * 3), v2 = new T.Vector3().fromArray(pos, idx[2] * 3);
    const nrm = new T.Vector3().crossVectors(v1.clone().sub(v0), v2.clone().sub(v0));
    if (nrm.dot(v0.clone().sub(centers[0])) < 0) for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x; }
    return { pos, uv, idx, ring, seams, rings: N, M };
  }
  function ellipsoid(cx, cy, cz, ax, ay, az, W = 16, Hs = 12, deform = null) {
    const pos = [], uv = [], idx = [], seams = [];
    const p = new T.Vector3();
    for (let i = 0; i <= Hs; i++) {
      const v = i / Hs, phi = v * Math.PI;
      for (let j = 0; j <= W; j++) {
        const u = j / W, th = u * Math.PI * 2;
        const x = Math.sin(phi) * Math.sin(th), y = Math.cos(phi), z = Math.sin(phi) * Math.cos(th);
        p.set(x * ax, y * ay, z * az);
        if (deform) deform(p, x, y, z);
        pos.push(cx + p.x, cy + p.y, cz + p.z); uv.push(u, 1 - v);
      }
      seams.push([i * (W + 1), i * (W + 1) + W]);
    }
    for (let i = 0; i < Hs; i++) for (let j = 0; j < W; j++) {
      const a = i * (W + 1) + j, b = a + 1, c = a + W + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    return { pos, uv, idx, seams };
  }
  function transformRaw(raw, m) {
    const v = new T.Vector3();
    for (let i = 0; i < raw.pos.length; i += 3) { v.fromArray(raw.pos, i).applyMatrix4(m); raw.pos[i] = v.x; raw.pos[i + 1] = v.y; raw.pos[i + 2] = v.z; }
    return raw;
  }
  const rigid = (bone) => () => [[BI[bone], 1]];
  const blend2 = (a, b, x) => { x = smooth(x); return [[BI[a], 1 - x], [BI[b], x]]; };

  // ───────── looks (deterministic variety; no real-person likeness) ─────────
  const SKIN = ['#8a5a3c', '#b07650', '#c99068', '#6a4331', '#d2a27d', '#7c4b33', '#a86c47', '#5b3a29', '#be855d', '#94603f'];
  const HAIR = ['#141012', '#1d1713', '#2a1f19', '#0d0b0b', '#3a2a1e'];
  const STYLES = ['crop', 'buzz', 'curly', 'fade', 'crop', 'wavy'];
  const TEAM = {
    home: { jersey: '#8a1538', trim: '#ffffff', panel: '#5e0c26', shorts: '#ffffff', shortsTrim: '#8a1538', sock: '#ffffff', shoe: '#f4f1ea', sole: '#8a1538', text: '#ffffff', name: 'أبو عبيدة' },
    away: { jersey: '#f2f0ea', trim: '#1d3f66', panel: '#d9dde3', shorts: '#1d3f66', shortsTrim: '#ffffff', sock: '#1d3f66', shoe: '#e9edf2', sole: '#1d3f66', text: '#1d3f66', name: 'المنافس' },
    official: { jersey: '#f7f7f4', trim: '#1a1a1a', panel: '#e9e9e4', shorts: '#1b1d22', shortsTrim: '#1b1d22', sock: '#1b1d22', shoe: '#1d1d1d', sole: '#111111', text: '#1a1a1a', name: 'حكم' },
  };
  function looksFor(team, idx, number) {
    const h = VR.hash(team, idx, number);
    return {
      skin: SKIN[(h >>> 3) % SKIN.length], hair: HAIR[(h >>> 7) % HAIR.length], style: STYLES[(h >>> 11) % STYLES.length],
      beard: ((h >>> 15) % 5) < 2, headband: ((h >>> 19) % 7) === 0 && team !== 'official', sleeve: ((h >>> 21) % 4) === 0 && team !== 'official',
      jaw: 0.94 + ((h >>> 23) % 9) * 0.012, nose: 0.9 + ((h >>> 27) % 7) * 0.035, build: 0.96 + ((h >>> 5) % 8) * 0.012,
    };
  }
  const hex = (c) => { const x = new T.Color(c); return [x.r, x.g, x.b]; };

  function canvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function weave(x, w, h, base, alpha) {
    if (!x.fillRect) return;
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { x.fillStyle = y % 4 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`; x.fillRect(0, y, w, 1); }
    for (let i = 0; i < w; i += 3) { x.fillStyle = `rgba(0,0,0,${alpha * 0.6})`; x.fillRect(i, 0, 1, h); }
  }
  const textureCache = new Map();
  function jerseyTexture(teamKey, number, detail) {
    const key = teamKey + number + detail;
    if (textureCache.has(key)) return textureCache.get(key);
    const k = TEAM[teamKey], W = detail ? 768 : 384, Hh = detail ? 512 : 256, c = canvas(W, Hh);
    let tex = null;
    if (c) {
      const x = c.getContext('2d'), sx = W / 768, sy = Hh / 512;
      weave(x, W, Hh, k.jersey, 0.035);
      // Side panels sit at u = 0 / 0.5 / 1 (the loft seam is on the right side).
      if (x.fillRect) {
        x.fillStyle = k.panel;
        for (const u of [0, 0.5, 1]) x.fillRect(u * W - 52 * sx, 0, 104 * sx, Hh * 0.84);
        x.fillStyle = k.trim;
        for (const u of [0, 0.5, 1]) { x.fillRect(u * W - 56 * sx, 0, 6 * sx, Hh * 0.84); x.fillRect(u * W + 50 * sx, 0, 6 * sx, Hh * 0.84); }
        x.fillRect(0, Hh - 26 * sy, W, 14 * sy); // collar band (top of the loft)
        x.fillStyle = k.jersey; x.fillRect(0, Hh - 12 * sy, W, 12 * sy);
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = k.text;
        if (teamKey !== 'official') {
          x.font = `bold ${Math.round(230 * sy)}px Arial, sans-serif`;
          x.lineWidth = 8 * sy; x.strokeStyle = k.trim === '#ffffff' ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.4)';
          x.strokeText(String(number), 0.75 * W, Hh * 0.46);
          x.fillText(String(number), 0.75 * W, Hh * 0.46); // back number
          x.font = `bold ${Math.round(46 * sy)}px Tahoma, Arial, sans-serif`;
          x.fillText(k.name, 0.75 * W, Hh * 0.78); // team name over the number
          x.font = `bold ${Math.round(84 * sy)}px Arial, sans-serif`;
          x.fillText(String(number), 0.25 * W + 70 * sx, Hh * 0.62); // chest number
          // Chest crest: a simple original roundel.
          x.beginPath(); x.arc(0.25 * W - 72 * sx, Hh * 0.66, 26 * sx, 0, Math.PI * 2); x.fillStyle = k.trim; x.fill();
          x.beginPath(); x.arc(0.25 * W - 72 * sx, Hh * 0.66, 18 * sx, 0, Math.PI * 2); x.fillStyle = k.jersey; x.fill();
        } else {
          x.font = `bold ${Math.round(40 * sy)}px Tahoma, Arial, sans-serif`;
          x.fillText('حكم', 0.25 * W + 70 * sx, Hh * 0.66);
        }
      }
      tex = new T.CanvasTexture(c);
      tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
    }
    textureCache.set(key, tex);
    return tex;
  }
  function noiseTexture(size, amp) {
    const key = 'n' + size + amp;
    if (textureCache.has(key)) return textureCache.get(key);
    const c = canvas(size, size);
    let tex = null;
    if (c) {
      const x = c.getContext('2d');
      if (x.createImageData) {
        const img = x.createImageData(size, size), rnd = VR.rng(size * 31 + amp * 997);
        for (let i = 0; i < size * size; i++) { const v = 128 + (rnd() - 0.5) * amp; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
        x.putImageData(img, 0, 0);
      }
      tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(6, 6);
    }
    textureCache.set(key, tex);
    return tex;
  }

  // ───────── body assembly ─────────
  const MAT = { skin: 0, jersey: 1, shorts: 2, sock: 3, shoe: 4, sole: 5, hair: 6, eye: 7, pad: 8, sleeve: 9 };
  function buildBody(team, looks, detail, official) {
    const { bones } = buildSkeleton();
    const b = new Builder(), k = TEAM[official ? 'official' : team];
    const Mr = detail ? 18 : 12, Mt = detail ? 28 : 16;
    const wp = (n) => bones[n].getWorldPosition(new T.Vector3());
    const build = looks.build;
    const skinC = [1, 1, 1];

    // Torso = jersey surface. Superellipse rings from hips to the neck base.
    const ty = [0.94, 1.0, 1.07, 1.15, 1.24, 1.33, 1.41, 1.48, 1.535, 1.572, 1.6];
    const trx = [0.158, 0.162, 0.150, 0.142, 0.150, 0.166, 0.180, 0.188, 0.180, 0.132, 0.075].map((r) => r * build);
    const trz = [0.108, 0.110, 0.101, 0.096, 0.101, 0.112, 0.118, 0.112, 0.098, 0.078, 0.06].map((r, i) => r * (i > 4 ? build : 1));
    const torso = loft({
      centers: ty.map((y, i) => new T.Vector3(0, y, i > 7 ? -0.012 : 0.004)), rx: trx, rz: trz, M: Mt, e: 2.35, theta0: -Math.PI / 2,
      shape: (v, th) => 1 + (Math.cos(th) > 0 ? 0.045 * Math.cos(th) ** 2 * smooth((v - 0.45) / 0.3) * (1 - smooth((v - 0.85) / 0.1)) : 0) + (Math.cos(th) < 0 ? 0.03 * Math.cos(th) ** 2 * smooth((v - 0.6) / 0.2) : 0),
    });
    b.add(finish(torso, MAT.jersey, (i, v) => {
      if (v.y < 1.08) return [[BI.hips, 1]];
      if (v.y < 1.24) return blend2('hips', 'spine', (v.y - 1.08) / 0.16);
      if (v.y < 1.38) return blend2('spine', 'chest', (v.y - 1.24) / 0.14);
      if (v.y > 1.585) return blend2('chest', 'neck', (v.y - 1.585) / 0.03);
      return [[BI.chest, 1]];
    }));
    // Neck.
    const neck = loft({ centers: [1.55, 1.6, 1.66, 1.715].map((y, i) => new T.Vector3(0, y, -0.016 + i * 0.006)), rx: [0.064, 0.057, 0.054, 0.046], rz: [0.062, 0.056, 0.054, 0.044], M: Mr });
    b.add(finish(neck, MAT.skin, (i, v) => (v.y < 1.6 ? blend2('chest', 'neck', (v.y - 1.55) / 0.05) : blend2('neck', 'head', (v.y - 1.62) / 0.08)), skinC));
    // Shorts (pelvis section; leg sleeves are added with the thighs).
    const shorts = loft({ centers: [0.83, 0.9, 0.97, 1.04].map((y) => new T.Vector3(0, y, -0.004)), rx: [0.168, 0.172, 0.168, 0.16].map((r) => r * build), rz: [0.12, 0.122, 0.118, 0.11], M: Mt, e: 2.3 });
    b.add(finish(shorts, MAT.shorts, (i, v) => (v.y < 0.9 ? blend2('hips', 'hips', 0) : [[BI.hips, 1]])));

    for (const [S, g] of [['L', 1], ['R', -1]]) {
      // Arm: shoulder → elbow → wrist in the bind A-pose.
      const sh = wp('upper' + S), el = wp('fore' + S), wr = wp('hand' + S);
      const inward = new T.Vector3(-g * 0.03, 0.01, 0);
      const armPts = [], arx = [], arz = [];
      const prof = [[0, 0.07, 0.068], [0.08, 0.064, 0.064], [0.2, 0.053, 0.054], [0.33, 0.05, 0.05], [0.45, 0.043, 0.043], [0.53, 0.041, 0.042], [0.6, 0.044, 0.043], [0.7, 0.045, 0.04], [0.84, 0.037, 0.031], [0.97, 0.03, 0.025], [1.0, 0.029, 0.024]];
      const se = LEN.upper / (LEN.upper + LEN.fore);
      for (const [s, a, c] of prof) {
        const p = s < se ? sh.clone().lerp(el, s / se) : el.clone().lerp(wr, (s - se) / (1 - se));
        if (s < 0.1) p.add(inward.clone().multiplyScalar(1 - s / 0.1));
        armPts.push(p); arx.push(a * build * 1.1); arz.push(c * build * 1.1);
      }
      const armW = (i, v, raw) => {
        const s = prof[raw.ring[i]][0];
        if (s < 0.08) return [[BI['upper' + S], 0.55 + s * 5], [BI.chest, 0.45 - s * 5]];
        if (s < se - 0.07) return [[BI['upper' + S], 1]];
        if (s < se + 0.07) return blend2('upper' + S, 'fore' + S, (s - (se - 0.07)) / 0.14);
        return [[BI['fore' + S], 1]];
      };
      b.add(finish(loft({ centers: armPts, rx: arx, rz: arz, M: Mr, ref: new T.Vector3(0, 0, 1) }), MAT.skin, armW, skinC));
      // Sleeve over the upper arm (cloth slightly larger than the arm).
      const slv = prof.filter(([s]) => s <= 0.3);
      const sPts = slv.map(([s]) => { const p = sh.clone().lerp(el, s / se); if (s < 0.1) p.add(inward.clone().multiplyScalar(1 - s / 0.1)); return p; });
      const sl = loft({ centers: sPts, rx: slv.map(([, a]) => a * build + 0.012), rz: slv.map(([, , c]) => c * build + 0.012), M: Mr });
      b.add(finish(sl, looks.sleeve ? MAT.sleeve : MAT.jersey, (i, v, raw) => armW(i, v, { ring: raw.ring.map((r) => prof.indexOf(slv[r])) })));
      // Hand (rigid): palm, four fingers and a thumb, built in hand-bone space, palm facing +z.
      const hm = bones['hand' + S].matrixWorld;
      const palm = loft({ centers: [0, -0.03, -0.06, -0.088].map((y) => new T.Vector3(0, y, 0)), rx: [0.032, 0.041, 0.044, 0.043], rz: [0.022, 0.018, 0.017, 0.015], M: 12, e: 2.6, capEnd: true, capStart: true });
      b.add(finish(transformRaw(palm, hm), MAT.skin, rigid('hand' + S), skinC));
      [-0.03, -0.01, 0.01, 0.03].forEach((x, n) => {
        const L = [0.078, 0.088, 0.085, 0.07][n];
        const pts = [0, 0.33, 0.66, 1].map((q) => new T.Vector3(x * 0.95, -0.085 - L * q, 0.006 + Math.sin(q * 1.4) * 0.012));
        const f = loft({ centers: pts, rx: [0.0095, 0.009, 0.0085, 0.007], rz: [0.009, 0.0085, 0.008, 0.0065], M: 8, capEnd: true });
        b.add(finish(transformRaw(f, hm), MAT.skin, rigid('hand' + S), skinC));
      });
      const thumb = loft({ centers: [[0.035, -0.02, 0.012], [0.05, -0.045, 0.02], [0.058, -0.07, 0.03], [0.06, -0.09, 0.034]].map((p) => new T.Vector3(g * p[0], p[1], p[2])), rx: [0.013, 0.011, 0.0095, 0.008], rz: [0.012, 0.01, 0.009, 0.0075], M: 8, capEnd: true });
      b.add(finish(transformRaw(thumb, hm), MAT.skin, rigid('hand' + S), skinC));

      // Leg: hip → knee → ankle.
      const hp = wp('thigh' + S), kn = wp('shin' + S), an = wp('foot' + S);
      const lprof = [[0, 0.094, 0.1], [0.12, 0.088, 0.092], [0.26, 0.08, 0.082], [0.38, 0.068, 0.068], [0.46, 0.056, 0.058], [0.5, 0.052, 0.056], [0.55, 0.053, 0.056], [0.62, 0.057, 0.062], [0.7, 0.054, 0.058], [0.8, 0.044, 0.044], [0.9, 0.035, 0.036], [1.0, 0.031, 0.034]];
      const lPts = lprof.map(([s]) => { const p = s < 0.5 ? hp.clone().lerp(kn, s / 0.5) : kn.clone().lerp(an, (s - 0.5) / 0.5); if (s > 0.55 && s < 0.85) p.z -= 0.012 * Math.sin(((s - 0.55) / 0.3) * Math.PI); return p; });
      const legW = (i, v, raw) => {
        const s = lprof[raw.ring[i]][0];
        if (s < 0.06) return [[BI['thigh' + S], 0.6 + s * 6], [BI.hips, 0.4 - s * 6]];
        if (s < 0.43) return [[BI['thigh' + S], 1]];
        if (s < 0.57) return blend2('thigh' + S, 'shin' + S, (s - 0.43) / 0.14);
        return [[BI['shin' + S], 1]];
      };
      const leg = loft({ centers: lPts, rx: lprof.map(([, a]) => a * build * 1.08), rz: lprof.map(([, , c]) => c * build * 1.08), M: Mr, ref: new T.Vector3(0, 0, 1) });
      const legPart = finish(leg, MAT.skin, legW, skinC);
      b.add(legPart);
      // Socks (lower shin) and kneepads, as slightly larger shells.
      const sockRings = lprof.map((p, i) => i).filter((i) => lprof[i][0] >= 0.78);
      const sock = loft({ centers: sockRings.map((i) => lPts[i]), rx: sockRings.map((i) => lprof[i][1] * build + 0.005), rz: sockRings.map((i) => lprof[i][2] * build + 0.005), M: Mr });
      b.add(finish(sock, official ? MAT.shorts : MAT.sock, () => [[BI['shin' + S], 1]]));
      if (!official) {
        const padIdx = [3, 4, 5, 6, 7];
        const pad = loft({ centers: padIdx.map((i) => lPts[i].clone().add(new T.Vector3(0, 0, 0.006))), rx: padIdx.map((i) => lprof[i][1] * build + 0.016), rz: padIdx.map((i) => lprof[i][2] * build + 0.02), M: Mr });
        b.add(finish(pad, MAT.pad, (i, v, raw) => legW(i, v, { ring: raw.ring.map((r) => padIdx[r]) })));
      }
      // Shorts sleeve (or full trousers for officials).
      const sEnd = official ? 0.97 : 0.36;
      const sIdx = lprof.map((p, i) => i).filter((i) => lprof[i][0] <= sEnd);
      const sleeve = loft({ centers: sIdx.map((i) => lPts[i]), rx: sIdx.map((i, n) => lprof[i][1] * build + (official ? 0.012 : 0.016 + n * 0.004)), rz: sIdx.map((i, n) => lprof[i][2] * build + (official ? 0.012 : 0.016 + n * 0.004)), M: Mr });
      b.add(finish(sleeve, MAT.shorts, (i, v, raw) => legW(i, v, { ring: raw.ring.map((r) => sIdx[r]) })));
      // Shoe (rigid on the foot bone): upper and sole, flat on the floor in the bind pose.
      const fm = bones['foot' + S].matrixWorld;
      const zs = [-0.07, -0.05, -0.01, 0.04, 0.1, 0.15, 0.19, 0.215];
      const upper = loft({
        centers: zs.map((z) => new T.Vector3(g * 0.004, -0.04 + (z > 0.12 ? -(z - 0.12) * 0.35 : 0) + (z < -0.03 ? 0.01 : 0), z)),
        rx: [0.03, 0.042, 0.046, 0.05, 0.052, 0.048, 0.036, 0.018], rz: [0.045, 0.05, 0.056, 0.045, 0.034, 0.028, 0.022, 0.012], M: 14, ref: new T.Vector3(0, 1, 0), capStart: true, capEnd: true,
      });
      for (let i = 1; i < upper.pos.length; i += 3) upper.pos[i] = Math.max(upper.pos[i], -LEN.ankle + 0.014);
      b.add(finish(transformRaw(upper, fm), MAT.shoe, rigid('foot' + S)));
      const sole = loft({ centers: zs.map((z) => new T.Vector3(g * 0.004, -LEN.ankle + 0.009, z)), rx: [0.034, 0.046, 0.05, 0.054, 0.056, 0.052, 0.04, 0.02], rz: [0.012, 0.011, 0.01, 0.01, 0.01, 0.01, 0.009, 0.007], M: 12, ref: new T.Vector3(0, 1, 0), capStart: true, capEnd: true });
      for (let i = 1; i < sole.pos.length; i += 3) sole.pos[i] = Math.max(sole.pos[i], -LEN.ankle);
      b.add(finish(transformRaw(sole, fm), MAT.sole, rigid('foot' + S)));
    }

    // Head: one smooth sculpted surface (no pole spikes): skull, jaw, cheekbones, brow, eye sockets.
    const hc = new T.Vector3(0, Y.headCenter, 0.014), jaw = looks.jaw;
    const RX = 0.084, RY = 0.118, RZ = 0.1;
    const sculpt = (p, x, y, z) => {
      // Everything here is smooth (Gaussian or polynomial) so the surface never creases.
      const low = smooth((-y - 0.05) / 0.85);
      p.x *= 1 - 0.12 * low * jaw;                                  // narrower jaw
      p.z += 0.011 * low * Math.max(0, z) * jaw;                   // chin forward
      if (z > 0) p.z *= 1 - 0.07 * z * z;                          // flatter face plane
      if (z < 0) p.z *= 1 + 0.07 * -z * smooth((y + 0.3) / 0.6);   // fuller back of the skull
      const g = (cx, cy, cz, sg, a) => { const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2; return a * Math.exp(-d2 / (sg * sg)); };
      const k = g(0.55, -0.12, 0.78, 0.22, 0.035) + g(-0.55, -0.12, 0.78, 0.22, 0.035)   // cheekbones
        - g(0.36, 0.14, 0.92, 0.14, 0.05) - g(-0.36, 0.14, 0.92, 0.14, 0.05)              // eye sockets
        + g(0, 0.33, 0.95, 0.3, 0.018) + g(0, -0.82, 0.55, 0.22, 0.03 * jaw)              // brow ridge, chin
        + g(0, -0.42, 0.9, 0.2, 0.012);                                                     // upper lip
      p.multiplyScalar(1 + k);
    };
    const head = ellipsoid(hc.x, hc.y, hc.z, RX, RY, RZ, detail ? 30 : 20, detail ? 24 : 16, sculpt);
    const skinRGB = [1, 1, 1], beardRGB = [0.5, 0.42, 0.38], lipRGB = [0.82, 0.62, 0.6];
    const local = (v) => [v.x - hc.x, v.y - hc.y, v.z - hc.z];
    b.add(finish({ ...head, pos: head.pos.slice() }, MAT.skin, rigid('head'), skinRGB, (i, v) => {
      const [lx, ly, lz] = local(v);
      if (Math.abs(lx) < 0.022 && ly < -0.05 && ly > -0.066 && lz > 0.07) return lipRGB;
      if (looks.beard && ly < -0.03 && lz > -0.03 && Math.abs(lx) > 0.0 && !(Math.abs(lx) < 0.028 && ly > -0.072 && lz > 0.075)) return beardRGB;
      return skinRGB;
    }));
    // Hair = the scalp of the same surface pushed outward along its normal, so it can never clip.
    const style = looks.style;
    const thick = style === 'buzz' ? 0.003 : style === 'curly' ? 0.014 : style === 'fade' ? 0.009 : 0.007;
    const hairRaw = { pos: head.pos.slice(), uv: head.uv.slice(), idx: [], seams: head.seams };
    for (let i = 0; i < hairRaw.pos.length; i += 3) {
      const lx = hairRaw.pos[i] - hc.x, ly = hairRaw.pos[i + 1] - hc.y, lz = hairRaw.pos[i + 2] - hc.z;
      const n = Math.hypot(lx / RX ** 2, ly / RY ** 2, lz / RZ ** 2) || 1;
      let k = thick;
      if (style === 'curly' || style === 'wavy') k *= 1 + 0.45 * Math.sin(lx * 210) * Math.sin(ly * 190 + lz * 70);
      if (style === 'fade') k *= smooth((ly + 0.01) / 0.09) * 0.9 + 0.15;
      hairRaw.pos[i] += (lx / RX ** 2 / n) * k; hairRaw.pos[i + 1] += (ly / RY ** 2 / n) * k; hairRaw.pos[i + 2] += (lz / RZ ** 2 / n) * k;
    }
    const hairline = (lx, ly, lz) => {
      // Smooth hairline: high on the forehead, dropping behind the ears to the nape.
      const front = smooth((lz - 0.02) / 0.06), back = smooth((-lz - 0.02) / 0.06);
      return 0.056 - Math.abs(lx) * 0.25 * front - (0.06 + (style === 'fade' ? -0.03 : 0.02)) * (1 - front) - 0.05 * back;
    };
    for (let i = 0; i < head.idx.length; i += 3) {
      const ok = [0, 1, 2].every((k2) => { const j2 = head.idx[i + k2] * 3; const lx = head.pos[j2] - hc.x, ly = head.pos[j2 + 1] - hc.y, lz = head.pos[j2 + 2] - hc.z; return ly > hairline(lx, ly, lz) && !(Math.abs(lx) > 0.062 && ly < 0.035 && Math.abs(lz) < 0.035); });
      if (ok) hairRaw.idx.push(head.idx[i], head.idx[i + 1], head.idx[i + 2]);
    }
    b.add(finish(hairRaw, MAT.hair, rigid('head')));
    // Nose, ears, eyes, brows.
    const ns = looks.nose;
    const nose = loft({ centers: [[0, 0.038, 0.093], [0, 0.012, 0.104], [0, -0.012, 0.112], [0, -0.026, 0.106]].map((q) => new T.Vector3(q[0], hc.y + q[1], hc.z + q[2])), rx: [0.007, 0.009, 0.013, 0.012].map((r) => r * ns), rz: [0.006, 0.008, 0.011, 0.007].map((r) => r * ns), M: 10, ref: new T.Vector3(0, 0, 1), capEnd: true });
    b.add(finish(nose, MAT.skin, rigid('head'), skinRGB));
    for (const g of [1, -1]) {
      b.add(finish(ellipsoid(g * 0.083, hc.y - 0.004, hc.z - 0.012, 0.011, 0.027, 0.019, 10, 8), MAT.skin, rigid('head'), skinRGB));
      b.add(finish(ellipsoid(g * 0.032, hc.y + 0.022, hc.z + 0.079, 0.0125, 0.008, 0.0085, 12, 8), MAT.eye, rigid('head'), [0.92, 0.9, 0.88]));
      b.add(finish(ellipsoid(g * 0.032, hc.y + 0.022, hc.z + 0.0862, 0.0058, 0.0058, 0.0026, 10, 6), MAT.eye, rigid('head'), [0.1, 0.07, 0.05]));
      const brow = loft({ centers: [-0.013, 0.004, 0.021].map((dx, n) => new T.Vector3(g * (0.032 + dx * 1.1), hc.y + 0.043 + (n === 1 ? 0.004 : 0), hc.z + 0.084 - Math.abs(dx) * 0.28)), rx: [0.0028, 0.0038, 0.0024], rz: [0.003, 0.004, 0.003], M: 6, ref: new T.Vector3(0, 1, 0) });
      b.add(finish(brow, MAT.hair, rigid('head')));
    }
    if (looks.headband) {
      const hb = loft({ centers: [new T.Vector3(0, hc.y + 0.046, hc.z), new T.Vector3(0, hc.y + 0.07, hc.z - 0.004)], rx: [RX + 0.012, RX + 0.008], rz: [RZ + 0.012, RZ + 0.006], M: 24, ref: new T.Vector3(0, 0, 1) });
      b.add(finish(hb, MAT.sock, rigid('head')));
    }

    const geometry = b.merge(10);
    const nTex = noiseTexture(64, 26);
    const std = (o) => new T.MeshStandardMaterial({ skinning: true, ...o });
    const materials = [
      std({ color: looks.skin, roughness: 0.6, metalness: 0, vertexColors: true, bumpMap: nTex, bumpScale: 0.0012, envMapIntensity: 0.3 }),
      std({ map: jerseyTexture(official ? 'official' : team, official ? 0 : looks.number, detail), color: '#ffffff', roughness: 0.78, envMapIntensity: 0.4 }),
      std({ color: k.shorts, roughness: 0.74, envMapIntensity: 0.4 }),
      std({ color: k.sock, roughness: 0.85 }),
      std({ color: k.shoe, roughness: 0.42 }),
      std({ color: k.sole, roughness: 0.6 }),
      std({ color: looks.hair, roughness: 0.92 }),
      std({ color: '#ffffff', roughness: 0.18, vertexColors: true }),
      std({ color: '#20242a', roughness: 0.9 }),
      std({ color: k.trim === '#ffffff' ? '#f3f1ec' : k.trim, roughness: 0.8 }),
    ];
    const skel = buildSkeleton();
    const mesh = new T.SkinnedMesh(geometry, materials);
    mesh.add(skel.bones.hips);
    mesh.bind(new T.Skeleton(skel.list));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    return { mesh, bones: skel.bones, materials };
  }

  // ───────── IK and bone aiming ─────────
  const _v = Array.from({ length: 16 }, () => new T.Vector3());
  const _q = new T.Quaternion(), _pq = new T.Quaternion(), _m = new T.Matrix4();
  const AX = new T.Vector3(), AY = new T.Vector3(), AZ = new T.Vector3();
  // Rotate `bone` so its −Y axis points along `dir` (world) and its +Z leans toward `hint`.
  function aim(bone, dir, hint) {
    AY.copy(dir).normalize().negate();
    AZ.copy(hint).addScaledVector(AY, -hint.dot(AY));
    if (AZ.lengthSq() < 1e-8) { AZ.set(0, 0, 1).addScaledVector(AY, -AY.z); if (AZ.lengthSq() < 1e-8) AZ.set(1, 0, 0); }
    AZ.normalize();
    AX.crossVectors(AY, AZ);
    _m.makeBasis(AX, AY, AZ);
    _q.setFromRotationMatrix(_m);
    bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.copy(_pq.invert().multiply(_q));
    bone.updateMatrixWorld(true);
  }
  // Analytic two-bone IK: returns the clamped end and the middle joint in `mid`/`end`.
  function twoBone(root, target, a, b, pole, mid, end) {
    const d = _v[0].subVectors(target, root);
    let L = d.length();
    const dir = d.normalize();
    L = clamp(L, Math.abs(a - b) + 1e-3, (a + b) * 0.9995);
    const x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
    const pp = _v[1].copy(pole).addScaledVector(dir, -pole.dot(dir));
    if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1).addScaledVector(dir, -dir.z);
    pp.normalize();
    mid.copy(root).addScaledVector(dir, x).addScaledVector(pp, h);
    end.copy(root).addScaledVector(dir, L);
    return L;
  }

  // ───────── pose library ─────────
  // Hand targets are given either in chest space (metres, character axes) or in world space.
  const P0 = { crouch: 0, lean: 0, twist: 0, roll: 0, look: 0.85, headPitch: 0, shrug: 0 };

  class AthleteView {
    constructor(actor, opts = {}) {
      this.actor = actor;
      this.official = !!actor.official;
      const teamKey = this.official ? 'official' : actor.team;
      this.looks = { ...looksFor(teamKey, actor.idx, actor.number), number: actor.number };
      // Realistic MakeHuman-based body when the data file is present; procedural body as a fallback.
      let built = null;
      try { if (window.VolleyBody && window.VolleyBody.available()) built = window.VolleyBody.build({ team: actor.team, idx: actor.idx, number: actor.number, official: this.official }); }
      catch (e) { built = null; if (typeof console !== 'undefined') console.warn('VolleyBody failed, using procedural athlete', e); }
      if (!built) built = buildBody(teamKey === 'official' ? 'home' : teamKey, this.looks, opts.detail !== false, this.official);
      this.realistic = !!built.rig;
      this.mesh = built.mesh; this.bones = built.bones; this.materials = built.materials;
      this.rig = built.rig || { pelvis: new T.Vector3(0, Y.pelvis, 0), ankleY: LEN.ankle, chestY: Y.chest, headY: Y.head, lens: LEN };
      this.root = new T.Group();
      this.root.add(this.mesh);
      this.s = actor.height / H;
      this.root.scale.setScalar(this.s);
      this.root.userData.actorId = actor.id;
      const RL = this.rig.lens;
      this.lens = { thigh: RL.thigh * this.s, shin: RL.shin * this.s, upper: RL.upper * this.s, fore: RL.fore * this.s, palm: RL.palm * this.s };
      this.prevHead = { yaw: 0, pitch: 0 };
      this.stand = actor.stand || 0;
      if (this.official && (actor.name === 'lineA' || actor.name === 'lineB')) {
        // Line judge flag, held in the right hand.
        const flag = new T.Group();
        const stick = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.42, 6), new T.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6 }));
        stick.position.y = -0.12; flag.add(stick);
        const cloth = new T.Mesh(new T.PlaneGeometry(0.26, 0.2), new T.MeshStandardMaterial({ color: '#d21c2b', roughness: 0.8, side: T.DoubleSide }));
        cloth.position.set(0, -0.26, 0.13); cloth.rotation.y = Math.PI / 2; flag.add(cloth);
        flag.position.set(0, -0.09, 0.01);
        this.bones.handR.add(flag);
        this.flag = flag;
      }
      if (this.official && actor.name === 'first') {
        // Referee stand.
        const stand = new T.Group(), m = new T.MeshStandardMaterial({ color: '#5a6672', metalness: 0.6, roughness: 0.35 });
        const pad = new T.MeshStandardMaterial({ color: '#8a1538', roughness: 0.7 });
        const top = new T.Mesh(new T.BoxGeometry(0.75, 0.06, 0.7), m); top.position.y = this.stand - 0.03; stand.add(top);
        for (const [x, z] of [[-0.32, -0.3], [0.32, -0.3], [-0.32, 0.3], [0.32, 0.3]]) { const leg = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, this.stand, 8), m); leg.position.set(x, this.stand / 2, z); stand.add(leg); }
        const rail = new T.Mesh(new T.BoxGeometry(0.75, 0.5, 0.05), pad); rail.position.set(0, this.stand + 0.25, -0.33); stand.add(rail);
        for (let i = 0; i < 5; i++) { const step = new T.Mesh(new T.BoxGeometry(0.5, 0.04, 0.2), m); step.position.set(0, (i + 1) * this.stand / 6, 0.48 + i * 0.12); stand.add(step); }
        stand.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
        this.standMesh = stand;
      }
    }
    dispose() {
      this.mesh.geometry.dispose();
      this.materials.forEach((m) => { if (m.map && !textureCache.size) m.map.dispose(); m.dispose(); });
      this.mesh.skeleton.dispose();
    }
    // chest-space → world
    cw(p, out) { return out.set(p[0], p[1], p[2]).applyMatrix4(this.bones.chest.matrixWorld); }

    // Base pose: ready stance or locomotion (with arm swing driven by the footsteps).
    basePose(st, t) {
      const p = { ...P0 }, id = this.actor.id;
      const fwd = VR.fwdOf(st.face), v = st.speed;
      const along = v > 0.05 ? (st.vel[0] * fwd[0] + st.vel[1] * fwd[1]) / v : 0;
      const run = clamp((v - 1.6) / 2) * clamp(along * 2);
      p.crouch = 0.1 + 0.015 * Math.sin(t * 1.7 + id) + 0.04 * clamp(v / 4);
      p.lean = 0.26 + 0.12 * run - 0.12 * clamp(-along) * clamp(v / 2);
      p.roll = 0.015 * Math.sin(t * 0.9 + id * 1.3);
      // Arm swing phase from the swinging foot.
      let sw = 0;
      const L = st.feet.L, Rf = st.feet.R;
      if (!L.planted && !L.air) sw = -Math.cos(Math.PI * L.u);
      else if (!Rf.planted && !Rf.air) sw = Math.cos(Math.PI * Rf.u);
      const amp = 0.28 * run;
      const ready = [0.22, -0.2, 0.4];
      const rl = [0.2, -0.3 + 0.06 * Math.abs(sw), 0.1 + amp * -sw], rr = [-0.2, -0.3 + 0.06 * Math.abs(sw), 0.1 + amp * sw];
      p.hands = {
        L: { chest: run > 0.01 ? lerpArr([ready[0], ready[1], ready[2]], rl, run) : ready.slice(), pole: [0.5, -0.5, -0.7] },
        R: { chest: run > 0.01 ? lerpArr([-ready[0], ready[1], ready[2]], rr, run) : [-ready[0], ready[1], ready[2]], pole: [-0.5, -0.5, -0.7] },
      };
      p.pelvisYaw = 0.1 * sw * run; p.chestYaw = -0.14 * sw * run;
      return p;
    }
    actPose(st, t, ball, plan, base) {
      const a = st.act;
      if (!a) return null;
      const fn = ACTS[a.type];
      if (!fn) return null;
      const p = fn.call(this, { st, t, a, d: a.data || {}, ball, plan, base, view: this });
      if (!p) return null;
      // Blend in/out at the edges of the action window.
      p.w = p.w ?? Math.min(ramp(t, a.t0, a.t0 + 0.22), 1 - ramp(t, a.t1 - 0.3, a.t1));
      // Play stopped for a teacher review: the action relaxes instead of completing.
      if (a.data?.withhold) p.w *= 1 - ramp(t, a.data.tFreeze, a.data.tFreeze + 0.4);
      return p;
    }

    update(st, t, ball, plan) {
      const s = this.s, bones = this.bones;
      this.root.position.set(st.pos[0], this.stand, st.pos[1]);
      this.root.rotation.set(0, st.face, 0);
      const base = this.basePose(st, t);
      const ap = this.actPose(st, t, ball, plan, base);
      const w = ap ? clamp(ap.w) : 0;
      const pose = {};
      for (const k of Object.keys(P0).concat(['pelvisYaw', 'chestYaw'])) pose[k] = lerp(base[k] ?? 0, ap?.[k] ?? base[k] ?? 0, w);
      // Pelvis + torso.
      const hips = bones.hips;
      const rp = this.rig.pelvis;
      hips.position.set(rp.x, rp.y - pose.crouch + st.air / s, rp.z - pose.crouch * 0.35);
      hips.rotation.set(pose.lean * 0.32, pose.pelvisYaw || 0, pose.roll * 0.5, 'YXZ');
      bones.spine.rotation.set(pose.lean * 0.33, (pose.twist + (pose.chestYaw || 0)) * 0.4, pose.roll * 0.25, 'YXZ');
      bones.chest.rotation.set(pose.lean * 0.35, (pose.twist + (pose.chestYaw || 0)) * 0.6, pose.roll * 0.25, 'YXZ');
      this.root.updateMatrixWorld(true);
      // Feet targets (world). Planted feet are exact; swing feet arc; airborne feet tuck.
      const ankleH = this.rig.ankleY * s;
      const targets = {};
      for (const S of ['L', 'R']) {
        const f = st.feet[S], g = S === 'L' ? 1 : -1;
        const tg = new T.Vector3(f.p[0], ankleH + (f.h || 0), f.p[1]);
        if (f.air) {
          // Tucked under the pelvis in the air, easing from the take-off spot and onto the landing spot.
          const tuck = Math.sin(Math.PI * clamp(f.u)) ;
          const local = new T.Vector3(g * 0.12, this.rig.pelvis.y - pose.crouch + st.air / s - (0.9 - 0.2 * tuck), -0.14 * tuck);
          const fromAir = local.applyMatrix4(this.root.matrixWorld);
          const fromW = new T.Vector3(f.from[0], ankleH, f.from[1]), toW = new T.Vector3(f.to[0], ankleH, f.to[1]);
          const k0 = 1 - ramp(f.u, 0, 0.22), k1 = ramp(f.u, 0.75, 1);
          tg.copy(fromAir).lerp(fromW, k0 * (1 - k1)).lerp(toW, k1);
          tg.y = Math.max(tg.y, ankleH);
        }
        targets[S] = tg;
      }
      // Lower the pelvis if a planted foot would otherwise be out of reach (no hovering, no sliding).
      let drop = 0;
      for (const S of ['L', 'R']) {
        const hip = bones['thigh' + S].getWorldPosition(_v[2]), tg = targets[S];
        const Lmax = (this.lens.thigh + this.lens.shin) * 0.985, hz = Math.hypot(tg.x - hip.x, tg.z - hip.z);
        const need = hip.y - (tg.y + Math.sqrt(Math.max(0, Lmax * Lmax - hz * hz)));
        if (need > drop) drop = need;
      }
      if (drop > 0 && st.air < 0.02) { hips.position.y -= drop / s; this.root.updateMatrixWorld(true); }
      // Legs.
      const fwd = _v[3].set(Math.sin(st.face), 0, Math.cos(st.face));
      for (const S of ['L', 'R']) {
        const g = S === 'L' ? 1 : -1, thigh = bones['thigh' + S], shin = bones['shin' + S], foot = bones['foot' + S];
        const hip = thigh.getWorldPosition(_v[4]);
        const side = _v[5].set(Math.cos(st.face), 0, -Math.sin(st.face)).multiplyScalar(g); // character's left for g=1
        const pole = _v[6].copy(fwd).addScaledVector(side, 0.18).addScaledVector(_v[7].set(0, 1, 0), 0.1);
        const knee = _v[8], ankle = _v[9];
        twoBone(hip, targets[S], this.lens.thigh, this.lens.shin, pole, knee, ankle);
        aim(thigh, _v[10].subVectors(knee, hip), fwd);
        aim(shin, _v[10].subVectors(ankle, knee), fwd);
        // Foot flat, toes slightly out; toe-off pitch while the foot swings.
        const f = st.feet[S];
        const yaw = st.face - g * 0.08;
        const pitch = !f.planted && !f.air ? Math.sin(Math.PI * f.u) * 0.35 : 0;
        _q.setFromEuler(new T.Euler(pitch, yaw, 0, 'YXZ'));
        foot.parent.getWorldQuaternion(_pq);
        foot.quaternion.copy(_pq.invert().multiply(_q));
        foot.updateMatrixWorld(true);
      }
      // Arms.
      const hands = {};
      for (const S of ['L', 'R']) {
        const bh = base.hands[S], ah = ap?.hands?.[S];
        const pb = bh.world ? _v[11].copy(bh.world) : this.cw(bh.chest, _v[11]);
        let target = pb.clone(), pole = new T.Vector3(...bh.pole).transformDirection(bones.chest.matrixWorld);
        if (ah && w > 0) {
          const pa = ah.world ? new T.Vector3().copy(ah.world) : this.cw(ah.chest, new T.Vector3());
          const hw = w * (ah.w ?? 1);
          target.lerp(pa, hw);
          if (ah.pole) pole.lerp(new T.Vector3(...ah.pole).transformDirection(bones.chest.matrixWorld), hw).normalize();
          hands[S] = { palmDir: ah.palm, hw };
        }
        hands[S] = { ...(hands[S] || {}), target, pole };
      }
      // Shrug the clavicles when a hand goes overhead (adds the last few centimetres of reach).
      for (const S of ['L', 'R']) {
        const g = S === 'L' ? 1 : -1, clav = bones['clav' + S];
        const sh = bones['upper' + S].getWorldPosition(_v[12]);
        const up = clamp((hands[S].target.y - sh.y) / (0.5 * s));
        clav.rotation.set(0, 0, g * 0.3 * up);
      }
      this.root.updateMatrixWorld(true);
      for (const S of ['L', 'R']) {
        const upper = bones['upper' + S], fore = bones['fore' + S], hand = bones['hand' + S];
        const sh = upper.getWorldPosition(_v[12]);
        const h = hands[S];
        // Solve for the wrist so that the palm centre lands on the target.
        const reachDir = _v[13].subVectors(h.target, sh).normalize();
        const wrist = _v[14].copy(h.target).addScaledVector(reachDir, -this.lens.palm);
        // Anatomical limit: keep the wrist far enough from the shoulder that the elbow flexes ≤ ~150°.
        const minR = 0.62 * Math.abs(this.lens.upper - this.lens.fore) + 0.16 * this.s, dw = _v[13].subVectors(wrist, sh);
        if (dw.length() < minR) wrist.copy(sh).addScaledVector(dw.lengthSq() > 1e-8 ? dw.normalize() : reachDir, minR);
        const elbow = new T.Vector3(), end = new T.Vector3();
        twoBone(sh, wrist, this.lens.upper, this.lens.fore, h.pole, elbow, end);
        const foreDir = new T.Vector3().subVectors(end, elbow);
        const upperDir = new T.Vector3().subVectors(elbow, sh);
        // The front of the upper arm faces the forearm's bend; fall back to the pole when straight.
        const bend = foreDir.clone().addScaledVector(upperDir.clone().normalize(), -foreDir.dot(upperDir) / upperDir.length());
        const hint = bend.lengthSq() > 1e-5 ? bend : h.pole.clone().negate();
        aim(upper, upperDir, hint);
        aim(fore, foreDir, hint);
        const palm = h.palmDir ? new T.Vector3(...h.palmDir) : _v[15].copy(fwd);
        aim(hand, _v[13].subVectors(h.target, end).lengthSq() > 1e-6 ? _v[13].subVectors(h.target, end) : foreDir, palm);
      }
      // Head tracks the ball within anatomical limits.
      const headB = bones.head, neckB = bones.neck;
      const hp = headB.getWorldPosition(_v[12]);
      const inv = new T.Matrix4().copy(bones.chest.matrixWorld).invert();
      const local = new T.Vector3(...ball).applyMatrix4(inv).sub(new T.Vector3(0, this.rig.headY - this.rig.chestY, 0));
      let yaw = Math.atan2(local.x, local.z), pitch = -Math.atan2(local.y, Math.hypot(local.x, local.z));
      if (local.z < -0.2 && Math.abs(yaw) > 1.6) yaw = Math.sign(yaw) * 1.2;
      yaw = clamp(yaw, -1.2, 1.2); pitch = clamp(pitch, -0.75, 0.6);
      const lw = clamp(pose.look);
      yaw *= lw; pitch = lerp(pose.headPitch, pitch, lw);
      // Critically-damped follow so the head never snaps.
      const k = 0.35;
      this.prevHead.yaw += (yaw - this.prevHead.yaw) * k; this.prevHead.pitch += (pitch - this.prevHead.pitch) * k;
      neckB.rotation.set(this.prevHead.pitch * 0.4 - pose.lean * 0.15, this.prevHead.yaw * 0.4, 0, 'YXZ');
      headB.rotation.set(this.prevHead.pitch * 0.6, this.prevHead.yaw * 0.6, 0, 'YXZ');
      void hp;
      this.root.updateMatrixWorld(true);
      if (this.flag) this.flag.visible = true;
    }
    // Probes used by the test-suite and the camera director.
    palm(S) { return new T.Vector3(0, -this.rig.lens.palm, 0).applyMatrix4(this.bones['hand' + S].matrixWorld); }
    forearmPoint(S, k = 0.82) { const a = this.bones['fore' + S].getWorldPosition(new T.Vector3()), b = this.bones['hand' + S].getWorldPosition(new T.Vector3()); return a.lerp(b, k); }
    joint(name) { return this.bones[name].getWorldPosition(new T.Vector3()); }
    ankle(S) { return this.bones['foot' + S].getWorldPosition(new T.Vector3()); }
  }
  function lerpArr(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }

  // ───────── action poses ─────────
  // Each returns pose overrides + hand targets; `this` is the AthleteView.
  const side = (face) => { const r = VR.rightOf(face); return new T.Vector3(r[0], 0, r[1]); }; // character's right
  const fwdV = (face) => { const f = VR.fwdOf(face); return new T.Vector3(f[0], 0, f[1]); };
  const V3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  const ballHands = (ball, face, spread = R + 0.016, lift = 0) => {
    const rt = side(face), c = V3(ball);
    return { L: c.clone().addScaledVector(rt, -spread).add(new T.Vector3(0, lift, 0)), R: c.clone().addScaledVector(rt, spread).add(new T.Vector3(0, lift, 0)) };
  };
  const inwardPalms = (face) => { const rt = side(face); return { L: [rt.x, 0, rt.z], R: [-rt.x, 0, -rt.z] }; };

  const ACTS = {
    pass({ st, t, a, d }) {
      const tc = a.tc, C = V3(d.C), f = fwdV(st.face), rt = side(st.face);
      const k = ramp(t, tc - 0.5, tc - 0.18) * (1 - ramp(t, tc + 0.28, tc + 0.5));
      const follow = ramp(t, tc, tc + 0.25);
      const W = C.clone().addScaledVector(f, 0.1 * this.s).add(new T.Vector3(0, -(R + 0.032), 0));
      W.y += follow * 0.08;
      const pl = inwardPalms(st.face);
      return {
        crouch: 0.2 - follow * 0.08, lean: 0.48 - follow * 0.12, look: 0.95,
        hands: {
          L: { world: W.clone().addScaledVector(rt, -0.03), w: k, pole: [0.7, -0.7, 0.1], palm: pl.L },
          R: { world: W.clone().addScaledVector(rt, 0.03), w: k, pole: [-0.7, -0.7, 0.1], palm: pl.R },
        },
      };
    },
    dig(ctx) {
      const p = ACTS.pass.call(this, ctx);
      p.crouch = 0.36; p.lean = 0.7;
      if (ctx.d.shank && ctx.t > ctx.a.tc) p.roll = 0.25 * ramp(ctx.t, ctx.a.tc, ctx.a.tc + 0.3);
      return p;
    },
    set({ st, t, a, d, ball }) {
      const tc = a.tc, C = V3(d.C), f = fwdV(st.face);
      const up = ramp(t, a.t0, tc - 0.32), touch = ramp(t, tc - 0.32, tc - 0.04) * (1 - ramp(t, tc + 0.02, tc + 0.14)), follow = ramp(t, tc, tc + 0.3);
      const target = touch > 0 && t < tc + 0.14 ? V3(ball) : C;
      const hb = ballHands(target.toArray(), st.face, R * 0.72, -R * 0.42);
      for (const S of ['L', 'R']) hb[S].addScaledVector(f, -R * 0.45);
      const ft = d.back ? [0.12, 0.62, -0.08] : [0.12, 0.6, 0.3];
      const pre = [0.11, 0.42, 0.17];
      const mix = (S) => {
        const g = S === 'L' ? 1 : -1;
        const chestPos = lerpArr([g * 0.21, -0.27, 0.32], [g * pre[0], pre[1], pre[2]], up);
        const fl = lerpArr(chestPos, [g * ft[0], ft[1], ft[2]], follow);
        return touch > 0.001 ? { world: hb[S], w: 1, pole: [g * 0.9, -0.25, 0.25], palm: [0, -0.4, 0.9] } : { chest: fl, pole: [g * 0.9, -0.3, 0.3] };
      };
      return { crouch: 0.13 - 0.1 * follow, lean: d.back ? 0.1 - 0.3 * follow : 0.08, look: 1, hands: { L: mix('L'), R: mix('R') } };
    },
    spike(ctx) { return attackPose.call(this, ctx, false); },
    tip(ctx) { return attackPose.call(this, ctx, true); },
    serveJump(ctx) {
      const { t, d, a, st, ball } = ctx;
      if (t < d.tToss + 0.12) return holdPose.call(this, st, ball, 0.04);
      const p = attackPose.call(this, { ...ctx, d: { ...d, C: d.C }, a }, false);
      // Right-hand toss release blends out of the hold.
      const toss = ramp(t, d.tToss - 0.05, d.tToss + 0.25);
      p.hands.R.w = 1; if (toss < 1) p.hands.L.chest = lerpArr([0.15, 0.45, 0.35], p.hands.L.chest || [0.2, 0.4, 0.3], toss);
      return p;
    },
    serveFloat({ t, d, a, st, ball }) {
      if (t < d.tToss) return holdPose.call(this, st, ball, 0.02);
      const tc = a.tc, C = V3(d.C), f = fwdV(st.face);
      const draw = ramp(t, d.tToss, d.tToss + 0.35), strike = ramp(t, tc - 0.18, tc), follow = ramp(t, tc, tc + 0.2);
      const hitP = C.clone().addScaledVector(f, -(R + 0.005));
      const back = this.cw([-0.3, 0.34, -0.16], new T.Vector3());
      const R_ = back.clone().lerp(hitP, strike);
      if (follow > 0) R_.lerp(this.cw([-0.14, 0.3, 0.52], new T.Vector3()), follow);
      return {
        lean: 0.05 + 0.18 * strike, twist: -0.4 * draw * (1 - strike) + 0.2 * strike, crouch: 0.05, look: 1,
        hands: {
          L: { chest: lerpArr([0.14, 0.62, 0.36], [0.18, 0.0, 0.3], ramp(t, d.tToss + 0.3, tc)), pole: [0.6, -0.3, -0.5] },
          R: { world: R_, w: 1, pole: [-0.9, 0.3, -0.4], palm: [f.x, 0, f.z] },
        },
      };
    },
    dribble({ st, ball }) { return holdPose.call(this, st, ball, 0.02); },
    catch({ st, t, a, ball }) { const p = holdPose.call(this, st, ball, 0.02); const k = ramp(t, a.t0, a.tc); p.hands.L.w = p.hands.R.w = k; return p; },
    pickup({ st, t, a, ball }) {
      const bend = ramp(t, a.t0, a.tc) * (1 - ramp(t, a.tc + 0.1, a.t1 - 0.05));
      const p = holdPose.call(this, st, ball, 0);
      p.lean = 0.3 + 0.75 * bend; p.crouch = 0.1 + 0.26 * bend;
      p.hands.L.w = p.hands.R.w = ramp(t, a.t0, a.tc - 0.05);
      return p;
    },
    throw({ st, t, a, ball }) {
      if (t <= a.tc) return holdPose.call(this, st, ball, 0);
      const k = ramp(t, a.tc, a.tc + 0.2);
      return { lean: 0.2, crouch: 0.06, hands: { L: { chest: lerpArr([0.12, 0.02, 0.35], [0.12, 0.1, 0.62], k), pole: [0.6, -0.5, -0.4] }, R: { chest: lerpArr([-0.12, 0.02, 0.35], [-0.12, 0.1, 0.62], k), pole: [-0.6, -0.5, -0.4] } } };
    },
    block({ st, t, a, d, ball }) {
      const tJ = d.tJ ?? a.tc - 0.28, tL = d.tL ?? a.tc + 0.42;
      const load = ramp(t, tJ - 0.28, tJ - 0.05) * (1 - ramp(t, tJ - 0.05, tJ + 0.05));
      const reach = ramp(t, tJ, tJ + 0.25) * (1 - ramp(t, tL - 0.25, tL + 0.05));
      const rt = side(st.face), f = fwdV(st.face);
      const root = new T.Vector3(st.pos[0], 0, st.pos[1]);
      const press = (g) => root.clone().addScaledVector(rt, -g * 0.15).addScaledVector(f, 0.62).setY(3.25);
      let L = press(1), Rr = press(-1);
      if (d.touch && t > a.tc - 0.08) {
        const B = V3(d.touch), k = ramp(t, a.tc - 0.08, a.tc) * (1 - ramp(t, a.tc + 0.15, a.tc + 0.35));
        const hb = ballHands(B.toArray(), st.face, R * 0.85, 0);
        hb.L.addScaledVector(f, -R * 0.7); hb.R.addScaledVector(f, -R * 0.7);
        L.lerp(hb.L, k); Rr.lerp(hb.R, k);
      }
      const readyL = this.cw([0.23, 0.1, 0.32], new T.Vector3()), readyR = this.cw([-0.23, 0.1, 0.32], new T.Vector3());
      return {
        crouch: 0.08 + 0.12 * load, lean: 0.04 + 0.1 * reach, look: 1,
        hands: {
          L: { world: readyL.lerp(L, reach), w: 1, pole: [0.9, -0.2, -0.3], palm: [f.x, 0, f.z] },
          R: { world: readyR.lerp(Rr, reach), w: 1, pole: [-0.9, -0.2, -0.3], palm: [f.x, 0, f.z] },
        },
      };
    },
    cover() { return { crouch: 0.26, lean: 0.48, hands: { L: { chest: [0.24, -0.34, 0.38], pole: [0.6, -0.6, -0.4] }, R: { chest: [-0.24, -0.34, 0.38], pole: [-0.6, -0.6, -0.4] } } }; },
    defend() { return { crouch: 0.22, lean: 0.42, hands: { L: { chest: [0.24, -0.33, 0.4], pole: [0.6, -0.6, -0.4] }, R: { chest: [-0.24, -0.33, 0.4], pole: [-0.6, -0.6, -0.4] } } }; },
    dive({ st, t, a, d }) {
      const k = ramp(t, a.t0, a.tc) * (1 - ramp(t, a.tc + 0.45, a.t1));
      const dir = new T.Vector3(Math.sin(d.dir ?? st.face), 0, Math.cos(d.dir ?? st.face));
      const root = new T.Vector3(st.pos[0], 0, st.pos[1]);
      const tgt = root.clone().addScaledVector(dir, 0.95 * this.s).setY(0.42);
      const rt = side(st.face);
      return {
        crouch: 0.12 + 0.3 * k, lean: 0.35 + 0.5 * k, roll: 0.25 * k * Math.sign(-dir.dot(rt)), look: 1,
        hands: { L: { world: tgt.clone().addScaledVector(rt, -0.05), w: k, pole: [0.6, -0.7, 0] }, R: { world: tgt.clone().addScaledVector(rt, 0.05), w: k, pole: [-0.6, -0.7, 0] } },
      };
    },
    celebrate({ t, a, d }) {
      const pump = Math.sin(t * 9 + (d.k || 0)) * 0.07, arrived = ramp(t, a.tc - 0.1, a.tc + 0.2);
      const upL = [0.24, 0.6 + pump, 0.12], upR = [-0.24, 0.6 - pump, 0.12];
      const five = [[0.12, 0.55, 0.36], [-0.12, 0.55, 0.36]];
      return {
        crouch: 0.03 + Math.max(0, Math.sin(t * 8 + (d.k || 0))) * 0.05 * (1 - arrived), lean: 0.06, look: 0.3,
        hands: { L: { chest: lerpArr(upL, five[0], arrived * 0.7), pole: [0.9, 0, -0.4] }, R: { chest: lerpArr(upR, five[1], arrived * 0.7), pole: [-0.9, 0, -0.4] } },
      };
    },
    regroup() { return { crouch: 0.03, lean: 0.12, look: 0.25, headPitch: 0.35, hands: { L: { chest: [0.25, -0.22, -0.01], pole: [1, -0.1, -0.3] }, R: { chest: [-0.25, -0.22, -0.01], pole: [-1, -0.1, -0.3] } } }; },
    whistle({ t, a }) { const k = ramp(t, a.t0, a.tc) * (1 - ramp(t, a.tc + 0.3, a.t1)); return { crouch: 0, lean: 0.02, w: 1, hands: { R: { chest: [-0.03, 0.22, 0.13], w: k, pole: [-0.8, -0.5, 0] }, L: { chest: [0.2, -0.32, 0.05], pole: [0.5, -0.5, -0.7] } } }; },
    review({ t, a }) {
      // Referee signals a review: both hands draw a screen in front of the chest.
      const k = ramp(t, a.t0, a.tc) * (1 - ramp(t, a.t1 - 0.4, a.t1)), wig = Math.sin(t * 3) * 0.04;
      return { crouch: 0, lean: 0, w: 1, look: 0.4, hands: { L: { chest: [0.2, 0.18 + wig, 0.32], w: k, pole: [0.8, -0.4, -0.2] }, R: { chest: [-0.2, 0.18 - wig, 0.32], w: k, pole: [-0.8, -0.4, -0.2] } } };
    },
    signal({ t, a, d }) {
      const k = ramp(t, a.t0, a.tc + 0.2) * (1 - ramp(t, a.t1 - 0.4, a.t1));
      const sh = this.joint('upperR'), dir = new T.Vector3(0, 0.25, d.to === 'home' ? 1 : -1).normalize();
      return { crouch: 0, lean: 0, w: 1, hands: { R: { world: sh.clone().addScaledVector(dir, 0.68 * this.s), w: k, pole: [-0.3, -1, 0] }, L: { chest: [0.2, -0.32, 0.05], pole: [0.5, -0.5, -0.7] } } };
    },
    flag({ st, t, a, d }) {
      const k = ramp(t, a.t0, a.tc) * (1 - ramp(t, a.t1 - 0.4, a.t1));
      const sh = this.joint('upperR');
      const tgt = d.in ? sh.clone().add(fwdV(st.face).multiplyScalar(0.3)).setY(0.62 * this.s) : sh.clone().setY(sh.y + 0.66 * this.s);
      return { crouch: 0, lean: d.in ? 0.12 : 0, w: 1, hands: { R: { world: tgt, w: k, pole: [-0.8, 0, -0.4] }, L: { chest: [0.2, -0.32, 0.05], pole: [0.5, -0.5, -0.7] } } };
    },
  };
  // Hands on the ball (holding, dribbling, catching): both palms on its sides when it is close.
  function holdPose(st, ball, crouch) {
    const hold = this.cw([0, -0.33, 0.34], new T.Vector3());
    const near = 1 - clamp((V3(ball).distanceTo(hold) - 0.18) / 0.35);
    const hb = ballHands(ball, st.face, R + 0.014, 0.0);
    const pl = inwardPalms(st.face);
    return {
      crouch: 0.06 + crouch, lean: 0.14, look: 0.9,
      hands: { L: { world: hb.L, w: near, pole: [0.7, -0.6, -0.3], palm: pl.L }, R: { world: hb.R, w: near, pole: [-0.7, -0.6, -0.3], palm: pl.R } },
    };
  }
  // Approach, take-off, bow-and-arrow, strike and landing for spikes, tips and jump serves.
  function attackPose({ st, t, a, d, ball, base }, tip) {
    const tJ = d.tJ, tc = a.tc, tL = d.tL;
    const back = ramp(t, tJ - 0.42, tJ - 0.14) * (1 - ramp(t, tJ - 0.12, tJ + 0.06));
    const lift = ramp(t, tJ - 0.12, tJ + 0.1);
    const bow = ramp(t, tJ + 0.04, tc - 0.24);
    const strike = ramp(t, tc - (tip ? 0.26 : 0.2), tc);
    const follow = ramp(t, tc, tc + (tip ? 0.15 : 0.22));
    const land = ramp(t, tL - 0.08, tL + 0.12), recover = ramp(t, tL + 0.25, a.t1 - 0.05);
    const f = fwdV(st.face);
    const C = V3(d.C);
    const hitP = tip ? C.clone().add(new T.Vector3(0, -R * 0.75, 0)).addScaledVector(f, -R * 0.4) : C.clone().addScaledVector(f, -(R * 0.9)).add(new T.Vector3(0, R * 0.25, 0));
    // Chest-space keyframes.
    const kL = (arr) => this.cw(arr, new T.Vector3());
    const L = kL([0.2, -0.28, 0.3]).lerp(kL([0.22, -0.42, -0.42]), back).lerp(kL([0.25, 0.56, 0.32]), lift);
    const Rr = kL([-0.2, -0.28, 0.3]).lerp(kL([-0.22, -0.42, -0.42]), back).lerp(kL([-0.25, 0.56, 0.3]), lift);
    // Bow: the left arm points at the ball, the right elbow is drawn high and back.
    const shL = this.joint('upperL');
    const pointAt = shL.clone().addScaledVector(V3(ball).sub(shL).normalize(), 0.6 * this.s);
    L.lerp(pointAt, bow);
    Rr.lerp(kL([-0.3, 0.34, -0.24]), bow);
    // Strike: right palm meets the ball at the contact instant; left arm pulls down.
    Rr.lerp(hitP, strike);
    L.lerp(kL([0.12, 0.02, 0.26]), strike);
    if (follow > 0) { Rr.lerp(kL(tip ? [-0.1, 0.4, 0.5] : [0.14, -0.33, 0.36]), follow); L.lerp(kL([0.2, -0.2, 0.22]), follow); }
    if (land > 0) { Rr.lerp(kL([-0.25, -0.15, 0.38]), land); L.lerp(kL([0.25, -0.15, 0.38]), land); }
    if (recover > 0) { Rr.lerp(this.cw(base.hands.R.chest, new T.Vector3()), recover); L.lerp(this.cw(base.hands.L.chest, new T.Vector3()), recover); }
    const pre = 1 - ramp(t, tJ - 0.55, tJ - 0.4);
    const lean = lerp(lerp(lerp(lerp(0.32, 0.42, back), 0.12, lift), -0.16, bow), 0.42, strike);
    const p = {
      crouch: 0.06 + 0.12 * back * (1 - lift) + 0.2 * land * (1 - recover),
      lean: lerp(lerp(lean, 0.38, land), 0.26, recover), twist: (-0.55 * bow + 0.8 * strike * (tip ? 0.4 : 1)) * (1 - land), roll: 0.12 * bow * (1 - strike), look: 1,
      hands: {
        L: { world: L, w: 1 - pre, pole: [0.9, 0.2, -0.4] },
        R: { world: Rr, w: 1 - pre, pole: lerpArr([-0.6, -0.5, -0.6], [-0.9, 0.55, -0.5], Math.max(bow, strike) * (1 - land)), palm: strike > 0.5 && follow < 0.5 ? [f.x, -0.25, f.z] : undefined },
      },
    };
    return p;
  }

  window.VolleyAthletes = { AthleteView, buildSkeleton, LEN, Y, TEAM, looksFor, textureCache, _test: { twoBone, aim } };
})();
