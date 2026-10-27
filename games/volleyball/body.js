/* الكرة الطائرة V24 — realistic athlete bodies from MakeHuman CC0 data (assets/athlete-data.js).
 *
 * Per athlete: blend body build, ethnicity and facial-feature targets (deterministic from team + number),
 * fit our 19-bone skeleton to the morphed body, skin it with the MakeHuman weights mapped to those bones,
 * then derive fitted cloth (jersey, shorts / trousers, shoes, knee pads) and hair from the body surface,
 * paint lips, eyebrows, stubble and crease shading as vertex colours, and add the MakeHuman eye meshes.
 * The result is a single SkinnedMesh with material groups, driven by athletes.js exactly like before.
 */
(function () {
  'use strict';
  const T = THREE;
  const H = 1.95, SOLE = 0.016;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  let D = null; // decoded shared data

  function decode() {
    if (D) return D;
    const src = window.VolleyAthleteData;
    if (!src) return null;
    const h = src.header;
    const bin = typeof atob === 'function' ? atob(src.data) : Buffer.from(src.data, 'base64').toString('binary');
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const buf = u8.buffer;
    const view = (name, C) => { const e = h[name]; return new C(buf, e.offset, e.bytes / C.BYTES_PER_ELEMENT); };
    const K = h.base.count, B = h.bodyCount, R = h.renderBase.count;
    D = {
      h, K, B, R, base: view('base', Float32Array), renderBase: view('renderBase', Uint16Array), uv: view('uv', Float32Array), index: view('index', Uint16Array),
      skinIndex: view('skinIndex', Uint8Array), skinWeight: view('skinWeight', Uint8Array), regions: view('regions', Uint16Array), brow: view('brow', Uint8Array), cavity: view('cavity', Uint8Array),
      corners: [0, 1, 2, 3].map((i) => view('corner' + i, Int16Array)), races: [0, 1, 2].map((i) => view('race' + i, Int16Array)),
      face: h.face.map((f) => ({ name: f.name, idx: new Uint16Array(buf, f.idx, f.count), delta: new Int16Array(buf, f.delta, f.count * 3) })),
      eyePos: view('eyePos', Float32Array), eyeUV: view('eyeUV', Float32Array), eyeIndex: view('eyeIndex', Uint16Array),
      bits: h.regionBits, unit: h.deltaUnit,
    };
    // Shared topology in the base-vertex domain: triangles and one-ring adjacency (CSR).
    const tb = new Uint32Array(D.index.length);
    for (let i = 0; i < tb.length; i++) tb[i] = D.renderBase[D.index[i]];
    D.triBase = tb;
    const sets = Array.from({ length: B }, () => new Set());
    for (let i = 0; i < tb.length; i += 3) for (let k = 0; k < 3; k++) { const a = tb[i + k], b = tb[i + (k + 1) % 3]; sets[a].add(b); sets[b].add(a); }
    D.adjStart = new Uint32Array(B + 1); let n = 0;
    for (let v = 0; v < B; v++) { D.adjStart[v] = n; n += sets[v].size; }
    D.adjStart[B] = n; D.adj = new Uint32Array(n);
    for (let v = 0, o = 0; v < B; v++) for (const w of sets[v]) D.adj[o++] = w;
    return D;
  }

  // ───────── morph + normalise ─────────
  function morph(p) {
    const d = decode(), K = d.K, pos = new Float32Array(d.base), u = d.unit;
    const tm = clamp(p.muscle), tw = clamp(p.lean);
    const cw = [(1 - tm) * (1 - tw), tm * (1 - tw), (1 - tm) * tw, tm * tw];
    for (let c = 0; c < 4; c++) { const w = cw[c] * u, a = d.corners[c]; if (w) for (let i = 0; i < K * 3; i++) pos[i] += a[i] * w; }
    for (let r = 0; r < 3; r++) { const w = p.race[r] * u, a = d.races[r]; if (w) for (let i = 0; i < K * 3; i++) pos[i] += a[i] * w; }
    (p.face || []).forEach((w, f) => {
      if (!w) return; const t = d.face[f], s = w * u;
      for (let j = 0; j < t.idx.length; j++) { const v = t.idx[j] * 3; pos[v] += t.delta[j * 3] * s; pos[v + 1] += t.delta[j * 3 + 1] * s; pos[v + 2] += t.delta[j * 3 + 2] * s; }
    });
    const rawEye = { L: joint(pos, 'eyeL'), R: joint(pos, 'eyeR') };
    let minY = Infinity, maxY = -Infinity;
    for (let v = 0; v < d.B; v++) { const y = pos[v * 3 + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const k = (H - SOLE) / (maxY - minY);
    for (let v = 0; v < K; v++) { pos[v * 3] *= k; pos[v * 3 + 1] = (pos[v * 3 + 1] - minY) * k + SOLE; pos[v * 3 + 2] *= k; }
    return { pos, k, minY, rawEye };
  }
  function joint(pos, name) {
    const ids = decode().h.joints[name], j = new T.Vector3();
    for (const i of ids) j.x += pos[i * 3], j.y += pos[i * 3 + 1], j.z += pos[i * 3 + 2];
    return j.multiplyScalar(1 / ids.length);
  }
  function normalsK(pos) {
    const d = decode(), n = new Float32Array(d.K * 3), t = d.triBase, a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i < t.length; i += 3) {
      const i0 = t[i] * 3, i1 = t[i + 1] * 3, i2 = t[i + 2] * 3;
      a.set(pos[i1] - pos[i0], pos[i1 + 1] - pos[i0 + 1], pos[i1 + 2] - pos[i0 + 2]);
      b.set(pos[i2] - pos[i0], pos[i2 + 1] - pos[i0 + 1], pos[i2 + 2] - pos[i0 + 2]);
      c.crossVectors(a, b);
      for (const o of [i0, i1, i2]) { n[o] += c.x; n[o + 1] += c.y; n[o + 2] += c.z; }
    }
    for (let v = 0; v < d.K; v++) { const l = Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]) || 1; n[v * 3] /= l; n[v * 3 + 1] /= l; n[v * 3 + 2] /= l; }
    return n;
  }

  // ───────── skeleton fitted to the body ─────────
  const ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'upperL', 'foreL', 'handL', 'clavR', 'upperR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
  const PARENT = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', clavL: 'chest', upperL: 'clavL', foreL: 'upperL', handL: 'foreL', clavR: 'chest', upperR: 'clavR', foreR: 'upperR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
  function alongSpine(J, y) {
    const pts = [J.pelvis, J.spine03, J.spine02, J.spine01, J.neck];
    for (let i = 0; i < pts.length - 1; i++) if (y <= pts[i + 1].y) return pts[i].clone().lerp(pts[i + 1], clamp((y - pts[i].y) / (pts[i + 1].y - pts[i].y)));
    return pts[pts.length - 1].clone();
  }
  const _m = new T.Matrix4(), X = new T.Vector3(), Y = new T.Vector3(), Z = new T.Vector3();
  function aimQuat(dir, hint) {
    Y.copy(dir).normalize().negate();
    Z.copy(hint).addScaledVector(Y, -hint.dot(Y)); if (Z.lengthSq() < 1e-8) Z.set(0, 0, 1); Z.normalize();
    X.crossVectors(Y, Z);
    return new T.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z));
  }
  function buildRig(pos) {
    const names = ['pelvis', 'spine03', 'spine02', 'spine01', 'neck', 'head', 'headTop', 'jaw', 'lipUpper', 'lipLower'];
    for (const S of ['L', 'R']) names.push('clav' + S, 'shoulder' + S, 'elbow' + S, 'wrist' + S, 'knuckle' + S, 'index' + S, 'pinky' + S, 'hip' + S, 'knee' + S, 'ankle' + S, 'toe' + S, 'eye' + S);
    const J = {}; for (const n of names) J[n] = joint(pos, n);
    const W = {}, Q = {}, fwd = new T.Vector3(0, 0, 1), I = new T.Quaternion();
    W.hips = J.pelvis.clone(); W.spine = alongSpine(J, 0.6 * H); W.chest = alongSpine(J, 0.71 * H); W.neck = J.neck.clone(); W.head = J.head.clone();
    for (const k of ['hips', 'spine', 'chest', 'neck', 'head']) Q[k] = I.clone();
    for (const [S, g] of [['L', 1], ['R', -1]]) {
      W['clav' + S] = J['clav' + S].clone(); Q['clav' + S] = I.clone();
      W['upper' + S] = J['shoulder' + S].clone(); Q['upper' + S] = aimQuat(J['elbow' + S].clone().sub(J['shoulder' + S]), fwd);
      W['fore' + S] = J['elbow' + S].clone(); Q['fore' + S] = aimQuat(J['wrist' + S].clone().sub(J['elbow' + S]), fwd);
      // Hand: −Y toward the knuckles, +Z out of the palm.
      const a = J['index' + S].clone().sub(J['wrist' + S]), b = J['pinky' + S].clone().sub(J['wrist' + S]);
      const palm = new T.Vector3().crossVectors(a, b).multiplyScalar(g).normalize();
      W['hand' + S] = J['wrist' + S].clone(); Q['hand' + S] = aimQuat(J['knuckle' + S].clone().sub(J['wrist' + S]), palm);
      W['thigh' + S] = J['hip' + S].clone(); Q['thigh' + S] = aimQuat(J['knee' + S].clone().sub(J['hip' + S]), fwd);
      W['shin' + S] = J['knee' + S].clone(); Q['shin' + S] = aimQuat(J['ankle' + S].clone().sub(J['knee' + S]), fwd);
      W['foot' + S] = J['ankle' + S].clone(); Q['foot' + S] = I.clone();
    }
    const bones = {}, list = [];
    for (const n of ORDER) {
      const b = new T.Bone(); b.name = n; bones[n] = b; list.push(b);
      const p = PARENT[n];
      if (!p) { b.position.copy(W[n]); b.quaternion.copy(Q[n]); continue; }
      const qi = Q[p].clone().invert();
      b.position.copy(W[n]).sub(W[p]).applyQuaternion(qi);
      b.quaternion.copy(qi.multiply(Q[n]));
      bones[p].add(b);
    }
    bones.hips.updateMatrixWorld(true);
    const L = (a, b) => J[a].distanceTo(J[b]);
    const rig = {
      pelvis: W.hips.clone(), chestY: W.chest.y, headY: W.head.y, ankleY: (J.ankleL.y + J.ankleR.y) / 2,
      lens: { thigh: (L('hipL', 'kneeL') + L('hipR', 'kneeR')) / 2, shin: (L('kneeL', 'ankleL') + L('kneeR', 'ankleR')) / 2, upper: (L('shoulderL', 'elbowL') + L('shoulderR', 'elbowR')) / 2, fore: (L('elbowL', 'wristL') + L('elbowR', 'wristR')) / 2, palm: 0.55 * (L('wristL', 'knuckleL') + L('wristR', 'knuckleR')) / 2 },
      J,
    };
    return { bones, list, rig };
  }

  // ───────── fitted cloth / hair shells ─────────
  function shell(ctx, sel, o) {
    const d = decode(), { pos, nrm } = ctx, B = d.B;
    const inSel = new Uint8Array(B); for (let v = 0; v < B; v++) inSel[v] = sel(v) ? 1 : 0;
    const tris = [];
    for (let i = 0; i < d.triBase.length; i += 3) { const a = d.triBase[i], b = d.triBase[i + 1], c = d.triBase[i + 2]; if (inSel[a] && inSel[b] && inSel[c]) tris.push(a, b, c); }
    const used = new Map(); for (const v of tris) if (!used.has(v)) used.set(v, used.size);
    const ids = [...used.keys()], n = ids.length, P = new Float32Array(n * 3);
    const off = typeof o.offset === 'function' ? o.offset : () => o.offset;
    ids.forEach((v, i) => { const t = off(v, pos, nrm); for (let k = 0; k < 3; k++) P[i * 3 + k] = pos[v * 3 + k] + nrm[v * 3 + k] * t; });
    // Laplacian smoothing within the region (bridges muscle detail like real cloth), boundary held.
    const boundary = new Uint8Array(n);
    ids.forEach((v, i) => { for (let j = d.adjStart[v]; j < d.adjStart[v + 1]; j++) if (!inSel[d.adj[j]]) { boundary[i] = 1; break; } });
    const tmp = new Float32Array(n * 3);
    for (let it = 0; it < (o.smooth || 0); it++) {
      ids.forEach((v, i) => {
        if (boundary[i] && !o.smoothBoundary) { for (let k = 0; k < 3; k++) tmp[i * 3 + k] = P[i * 3 + k]; return; }
        let cx = 0, cy = 0, cz = 0, c = 0;
        for (let j = d.adjStart[v]; j < d.adjStart[v + 1]; j++) { const w = used.get(d.adj[j]); if (w === undefined) continue; cx += P[w * 3]; cy += P[w * 3 + 1]; cz += P[w * 3 + 2]; c++; }
        const m = c ? 0.5 : 0;
        tmp[i * 3] = P[i * 3] * (1 - m) + (c ? cx / c : 0) * m; tmp[i * 3 + 1] = P[i * 3 + 1] * (1 - m) + (c ? cy / c : 0) * m; tmp[i * 3 + 2] = P[i * 3 + 2] * (1 - m) + (c ? cz / c : 0) * m;
      });
      P.set(tmp);
    }
    // Straighten the cut edge (it follows mesh quads): 1-D smoothing along the boundary loop only.
    for (let it = 0; it < (o.edgeSmooth ?? 8); it++) {
      ids.forEach((v, i) => {
        if (!boundary[i]) return;
        let cx = 0, cy = 0, cz = 0, c = 0;
        for (let j = d.adjStart[v]; j < d.adjStart[v + 1]; j++) { const w = used.get(d.adj[j]); if (w === undefined || !boundary[w]) continue; cx += P[w * 3]; cy += P[w * 3 + 1]; cz += P[w * 3 + 2]; c++; }
        if (c < 2) return;
        tmp[i * 3] = P[i * 3] * 0.5 + (cx / c) * 0.5; tmp[i * 3 + 1] = P[i * 3 + 1] * 0.5 + (cy / c) * 0.5; tmp[i * 3 + 2] = P[i * 3 + 2] * 0.5 + (cz / c) * 0.5;
      });
      ids.forEach((v, i) => { if (boundary[i]) for (let k = 0; k < 3; k++) P[i * 3 + k] = tmp[i * 3 + k] || P[i * 3 + k]; });
    }
    if (o.taper) ids.forEach((v, i) => { if (boundary[i]) for (let k = 0; k < 3; k++) P[i * 3 + k] -= nrm[v * 3 + k] * o.taper; });
    // Never sink below the skin.
    const minOff = o.minOffset ?? 0.003;
    ids.forEach((v, i) => {
      const dx = P[i * 3] - pos[v * 3], dy = P[i * 3 + 1] - pos[v * 3 + 1], dz = P[i * 3 + 2] - pos[v * 3 + 2];
      const along = dx * nrm[v * 3] + dy * nrm[v * 3 + 1] + dz * nrm[v * 3 + 2];
      if (along < minOff) for (let k = 0; k < 3; k++) P[i * 3 + k] += nrm[v * 3 + k] * (minOff - along);
    });
    if (o.post) o.post(ids, P);
    return { ids, P, tris, used };
  }

  // ───────── textures ─────────
  const texCache = new Map();
  function canvas(w, h) { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, srgb = true, rep) { if (!c) return null; const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); } return t; }
  function jerseyTexture(team, number, k) {
    const key = 'j' + team + number;
    if (texCache.has(key)) return texCache.get(key);
    const W = 1024, Hh = 512, c = canvas(W, Hh);
    let t = null;
    if (c) {
      const x = c.getContext('2d');
      if (x.fillRect) {
        x.fillStyle = k.jersey; x.fillRect(0, 0, W, Hh);
        for (let y = 0; y < Hh; y += 2) { x.fillStyle = y % 4 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; x.fillRect(0, y, W, 1); }
        // Side panels with trim at u = 0, 0.5, 1 (the sides of the body).
        for (const u of [0, 0.5, 1]) { x.fillStyle = k.panel; x.fillRect(u * W - 46, 0, 92, Hh); x.fillStyle = k.trim; x.fillRect(u * W - 50, 0, 5, Hh); x.fillRect(u * W + 45, 0, 5, Hh); }
        x.fillStyle = k.trim; x.fillRect(0, 0, W, 10); x.fillRect(0, Hh - 14, W, 14); // collar (top) and hem (bottom)
        x.textAlign = 'center'; x.textBaseline = 'middle';
        if (team !== 'official') {
          x.fillStyle = k.text; x.lineWidth = 6; x.strokeStyle = k.outline;
          x.font = 'bold 190px Arial, sans-serif'; x.strokeText(String(number), 0.75 * W, Hh * 0.5); x.fillText(String(number), 0.75 * W, Hh * 0.5);
          x.font = 'bold 40px Tahoma, Arial, sans-serif'; x.fillText(k.name, 0.75 * W, Hh * 0.16);
          x.font = 'bold 120px Arial, sans-serif'; x.strokeText(String(number), 0.25 * W, Hh * 0.47); x.fillText(String(number), 0.25 * W, Hh * 0.47);
          x.beginPath(); x.arc(0.25 * W + 82, Hh * 0.2, 17, 0, Math.PI * 2); x.fillStyle = k.trim; x.fill();
          x.beginPath(); x.arc(0.25 * W + 82, Hh * 0.2, 11, 0, Math.PI * 2); x.fillStyle = k.jersey; x.fill();
        } else {
          for (let i = 0; i < W; i += 64) { x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(i, 0, 14, Hh); }
          x.fillStyle = '#111'; x.font = 'bold 34px Tahoma, Arial, sans-serif'; x.fillText('حكم', 0.25 * W + 80, Hh * 0.25);
        }
      }
      t = tex(c);
    }
    texCache.set(key, t);
    return t;
  }
  function stripeTexture(base, trim) {
    const key = 's' + base + trim;
    if (texCache.has(key)) return texCache.get(key);
    const c = canvas(512, 128); let t = null;
    if (c) {
      const x = c.getContext('2d');
      if (x.fillRect) {
        x.fillStyle = base; x.fillRect(0, 0, 512, 128);
        for (let y = 0; y < 128; y += 2) { x.fillStyle = 'rgba(0,0,0,0.05)'; x.fillRect(0, y, 512, 1); }
        x.fillStyle = trim; for (const u of [0, 0.5, 1]) x.fillRect(u * 512 - 12, 0, 24, 128);
        x.fillRect(0, 118, 512, 10);
      }
      t = tex(c);
    }
    texCache.set(key, t);
    return t;
  }
  function hairTexture() {
    if (texCache.has('hair')) return texCache.get('hair');
    const c = canvas(256, 256); let t = null;
    if (c) {
      const x = c.getContext('2d');
      if (x.fillRect && x.createImageData) {
        const img = x.createImageData(256, 256), rnd = (window.VolleyRally || {}).rng ? window.VolleyRally.rng(77) : Math.random;
        const line = new Float32Array(256);
        for (let i = 0; i < 256; i++) line[i] = rnd();
        for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) {
          const s = 0.55 + 0.45 * Math.sin(xx * 0.9 + line[(y * 7 + xx) & 255] * 6) * line[xx] + (rnd() - 0.5) * 0.25;
          const v = Math.round(clamp(s * 0.5 + 0.5) * 255), o = (y * 256 + xx) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
        }
        x.putImageData(img, 0, 0);
      }
      t = tex(c, false, 6);
    }
    texCache.set('hair', t);
    return t;
  }
  function poreTexture() {
    if (texCache.has('pores')) return texCache.get('pores');
    const c = canvas(128, 128); let t = null;
    if (c) {
      const x = c.getContext('2d');
      if (x.createImageData) {
        const img = x.createImageData(128, 128), rnd = window.VolleyRally ? window.VolleyRally.rng(4242) : Math.random;
        for (let i = 0; i < 128 * 128; i++) { const v = 128 + (rnd() - 0.5) * 60 - (rnd() < 0.05 ? 40 : 0); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
        x.putImageData(img, 0, 0);
      }
      t = tex(c, false, 40);
    }
    texCache.set('pores', t);
    return t;
  }
  let faceTex = null;
  function faceTexture() {
    if (faceTex || typeof Image === 'undefined') return faceTex;
    const img = new Image(); img.src = decode().h.faceMask;
    faceTex = new T.Texture(img); faceTex.flipY = true; faceTex.generateMipmaps = true;
    img.onload = () => { faceTex.needsUpdate = true; };
    if (img.complete) faceTex.needsUpdate = true;
    return faceTex;
  }
  // Skin shader: eyebrows, beard/stubble and lips come from the baked face texture, coloured per athlete.
  function skinMaterial(p, std) {
    const mat = std({ color: p.skin, vertexColors: true, roughness: 0.58, metalness: 0, bumpMap: poreTexture(), bumpScale: 0.0008, envMapIntensity: 0.35, emissive: new T.Color(p.skin).multiplyScalar(0.035) });
    const ft = faceTexture();
    if (!ft) return mat;
    const skin = new T.Color(p.skin);
    const u = {
      faceMask: { value: ft }, hairColor: { value: new T.Color(p.hair) }, beardAmt: { value: p.beard ? 0.92 : p.stubble },
      lipColor: { value: new T.Color(skin.r * 0.78, skin.g * 0.5, skin.b * 0.5) },
    };
    mat.userData.skinUniforms = u;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      // Own varying: three's vUv is pre-transformed by the tiled pore bump map's repeat.
      sh.vertexShader = 'varying vec2 vFaceUv;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vFaceUv = uv;');
      sh.fragmentShader = 'uniform sampler2D faceMask; uniform vec3 hairColor; uniform float beardAmt; uniform vec3 lipColor; varying vec2 vFaceUv;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 fm = texture2D(faceMask, vFaceUv).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, lipColor, fm.b * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, hairColor, clamp(fm.g * beardAmt, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, hairColor, fm.r * 0.94); }`);
    };
    mat.customProgramCacheKey = () => 'volley-skin-v2';
    return mat;
  }
  let eyeTex = null;
  function eyeTexture() {
    if (eyeTex || typeof Image === 'undefined') return eyeTex;
    const img = new Image(); img.src = decode().h.eyeTexture;
    eyeTex = new T.Texture(img); eyeTex.encoding = T.sRGBEncoding;
    img.onload = () => { eyeTex.needsUpdate = true; };
    if (img.complete) eyeTex.needsUpdate = true;
    return eyeTex;
  }

  // ───────── build one athlete ─────────
  const KIT = {
    home: { jersey: '#8a1538', panel: '#6a0f2b', trim: '#ffffff', text: '#ffffff', outline: '#3d0716', name: 'أبو عبيدة', shorts: '#f4f2ee', shortsTrim: '#8a1538', sock: '#ffffff', shoe: '#f6f4f0', sole: '#8a1538' },
    away: { jersey: '#eef1f5', panel: '#d5dce5', trim: '#1d3f66', text: '#1d3f66', outline: '#ffffff', name: 'المنافس', shorts: '#1d3f66', shortsTrim: '#ffffff', sock: '#1d3f66', shoe: '#eef2f6', sole: '#1d3f66' },
    official: { jersey: '#f4f4f2', panel: '#e8e8e4', trim: '#222222', text: '#111111', outline: '#ffffff', name: 'حكم', shorts: '#1c1e23', shortsTrim: '#1c1e23', sock: '#1c1e23', shoe: '#1b1b1b', sole: '#0d0d0d' },
  };
  const SKIN = ['#8d5a3b', '#a8704c', '#c68d66', '#6b4430', '#d6a585', '#7a4a32', '#b27b56', '#5a3828', '#c99572', '#9a6545'];
  const HAIR = ['#0f0c0b', '#16110f', '#1f1712', '#0b0a0a', '#2a1d14'];
  function paramsFor(team, idx, number, official) {
    const h = (window.VolleyRally || { hash: () => 1 }).hash(team, idx, number, 'body');
    const r = (window.VolleyRally && window.VolleyRally.rng) ? window.VolleyRally.rng(h) : Math.random;
    const dominant = Math.floor(r() * 3), race = [0.15 * r(), 0.15 * r(), 0.15 * r()]; race[dominant] += 0.7;
    const sum = race[0] + race[1] + race[2]; for (let i = 0; i < 3; i++) race[i] /= sum;
    const skinIdx = dominant === 0 ? [0, 3, 5, 7, 9][Math.floor(r() * 5)] : dominant === 1 ? [2, 6, 8, 1][Math.floor(r() * 4)] : [4, 8, 2, 6][Math.floor(r() * 4)];
    const face = decode().face.map(() => (r() < 0.45 ? 0 : Math.round(r() * 80) / 100));
    const style = ['crop', 'buzz', 'fade', 'curly', 'crop', 'wavy'][Math.floor(r() * 6)];
    return {
      muscle: official ? 0.15 : 0.5 + r() * 0.5, lean: official ? 0.05 : 0.35 + r() * 0.6, race, face,
      skin: SKIN[skinIdx], hair: HAIR[Math.floor(r() * HAIR.length)], style: dominant === 0 && style === 'wavy' ? 'curly' : style,
      beard: r() < (official ? 0.6 : 0.35), stubble: 0.15 + r() * 0.25,
    };
  }
  function build(o) {
    const d = decode();
    if (!d) return null;
    const team = o.official ? 'official' : o.team, kit = KIT[team];
    const p = paramsFor(team, o.idx, o.number, o.official);
    const m = morph(p), pos = m.pos, nrm = normalsK(pos), bits = d.bits, reg = d.regions;
    const { bones, list, rig } = buildRig(pos);
    const B = d.B;
    const interior = (bit) => { const a = new Uint8Array(B); for (let v = 0; v < B; v++) { if (!(reg[v] & bit)) continue; let ok = 1; for (let j = d.adjStart[v]; j < d.adjStart[v + 1]; j++) if (!(reg[d.adj[j]] & bit)) { ok = 0; break; } a[v] = ok; } return a; };
    const clothBits = o.official ? (bits.JERSEY | bits.TROUSERS) : (bits.JERSEY | bits.SHORTS);
    const hideCloth = interior(clothBits), hideShoe = interior(bits.SHOE);
    // Geometry buffers (body render verts first, then shells, then eyes).
    const P = [], N = [], UV = [], C = [], SI = [], SW = [], groups = [];
    let vcount = 0;
    const push = (x, y, z, nx, ny, nz, u, v, col, base) => {
      P.push(x, y, z); N.push(nx, ny, nz); UV.push(u, v); C.push(col[0], col[1], col[2]);
      let ws = 0; for (let k = 0; k < 4; k++) ws += d.skinWeight[base * 4 + k];
      for (let k = 0; k < 4; k++) { SI.push(d.skinIndex[base * 4 + k]); SW.push(ws ? d.skinWeight[base * 4 + k] / ws : (k ? 0 : 1)); }
      return vcount++;
    };
    const idx = [];
    const group = (mat, from) => groups.push({ start: from, count: idx.length - from, mat });
    // Body colours: crease shading, lips, brows, stubble/beard, scalp, palms, sole of socks.
    const skin = new T.Color(p.skin), hair = new T.Color(p.hair);
    const rel = (c) => [clamp(c.r / Math.max(0.05, skin.r), 0, 1.4), clamp(c.g / Math.max(0.05, skin.g), 0, 1.4), clamp(c.b / Math.max(0.05, skin.b), 0, 1.4)];
    const hairRel = rel(hair), lipRel = rel(new T.Color(skin.r * 0.82, skin.g * 0.58, skin.b * 0.58));
    const palmRel = rel(new T.Color().setRGB(Math.min(1, skin.r * 1.25 + 0.05), Math.min(1, skin.g * 1.18 + 0.04), Math.min(1, skin.b * 1.12 + 0.04)));
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const bodyCol = new Float32Array(B * 3);
    for (let v = 0; v < B; v++) {
      const cav = d.cavity[v] / 255 * 2 - 1;
      let c = [1, 1, 1].map(() => 1 - 0.16 * Math.max(0, cav) + 0.04 * Math.max(0, -cav));
      if (reg[v] & bits.PALM) c = mix(c, palmRel, 0.6);
      bodyCol[v * 3] = c[0]; bodyCol[v * 3 + 1] = c[1]; bodyCol[v * 3 + 2] = c[2];
    }
    // Body faces; faces hidden under cloth, socks or shoes are dropped (socks and shoes are separate meshes).
    const hideSock = interior(bits.SOCK | bits.SHOE), footTop = rig.ankleY + 0.004;
    const inShoe = (v) => (reg[v] & (bits.SHOE | bits.SOCK)) && pos[v * 3 + 1] < footTop;
    const bodyStart = idx.length;
    for (let r = 0; r < d.R; r++) { const b = d.renderBase[r]; push(pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2], nrm[b * 3], nrm[b * 3 + 1], nrm[b * 3 + 2], d.uv[r * 2], d.uv[r * 2 + 1], [bodyCol[b * 3], bodyCol[b * 3 + 1], bodyCol[b * 3 + 2]], b); }
    for (let i = 0; i < d.index.length; i += 3) {
      const a = d.triBase[i], b = d.triBase[i + 1], c = d.triBase[i + 2];
      if ((hideCloth[a] && hideCloth[b] && hideCloth[c]) || (hideShoe[a] && hideShoe[b] && hideShoe[c]) || (hideSock[a] && hideSock[b] && hideSock[c]) || (inShoe(a) && inShoe(b) && inShoe(c))) continue;
      idx.push(d.index[i], d.index[i + 1], d.index[i + 2]);
    }
    group(0, bodyStart);
    // Shells.
    const ctx = { pos, nrm };
    const addShell = (sh, mat, uvFn, colFn) => {
      const start = idx.length, map = new Map();
      const vtx = (i, wrap) => {
        const key = i * 2 + wrap; if (map.has(key)) return map.get(key);
        const b = sh.ids[i], x = sh.P[i * 3], y = sh.P[i * 3 + 1], z = sh.P[i * 3 + 2];
        const uv = uvFn ? uvFn(x, y, z) : [0, 0]; if (wrap) uv[0] += 1;
        const id = push(x, y, z, nrm[b * 3], nrm[b * 3 + 1], nrm[b * 3 + 2], uv[0], uv[1], colFn ? colFn(x, y, z, b) : [1, 1, 1], b);
        map.set(key, id); return id;
      };
      for (let t = 0; t < sh.tris.length; t += 3) {
        const li = [sh.used.get(sh.tris[t]), sh.used.get(sh.tris[t + 1]), sh.used.get(sh.tris[t + 2])];
        let wrap = [0, 0, 0];
        if (uvFn) {
          const us = li.map((i) => uvFn(sh.P[i * 3], sh.P[i * 3 + 1], sh.P[i * 3 + 2])[0]);
          if (Math.max(...us) - Math.min(...us) > 0.5) wrap = us.map((u) => (u < 0.5 ? 1 : 0));
        }
        idx.push(vtx(li[0], wrap[0]), vtx(li[1], wrap[1]), vtx(li[2], wrap[2]));
      }
      group(mat, start);
    };
    const chest = rig.J.spine01, pel = rig.J.pelvis;
    const cyl = (y0, y1) => (x, y, z) => [((0.25 + Math.atan2(x, z - chest.z) / (Math.PI * 2)) % 1 + 1) % 1, clamp((y - y0) / (y1 - y0), -0.2, 1.2)];
    // Jersey / referee shirt.
    const jer = shell(ctx, (v) => reg[v] & bits.JERSEY, { offset: 0.009, smooth: 6, minOffset: 0.005 });
    let jy0 = Infinity, jy1 = -Infinity; for (let i = 0; i < jer.ids.length; i++) { const y = jer.P[i * 3 + 1]; if (Math.abs(jer.P[i * 3]) < 0.16) { jy0 = Math.min(jy0, y); jy1 = Math.max(jy1, y); } }
    addShell(jer, 2, cyl(jy0, jy1));
    // Shorts or trousers.
    const leg = o.official ? bits.TROUSERS : bits.SHORTS;
    const pelY = rig.J.pelvis.y;                                    // shorts hang a little looser toward the hem
    const sho = shell(ctx, (v) => reg[v] & leg, { offset: o.official ? 0.011 : (v, pp) => 0.013 + 0.011 * clamp((pelY - 0.06 - pp[v * 3 + 1]) / 0.2), smooth: o.official ? 4 : 7, minOffset: 0.006 });
    addShell(sho, 3, (x, y, z) => [((0.25 + Math.atan2(x, z - pel.z) / (Math.PI * 2)) % 1 + 1) % 1, clamp((y - (pel.y - 0.35)) / 0.5, 0, 1)]);
    // Socks: a thin fitted shell so the cuff is a clean line, not the mesh's zig-zag.
    addShell(shell(ctx, (v) => (reg[v] & (bits.SOCK | bits.SHOE)) && pos[v * 3 + 1] > rig.ankleY - 0.03, { offset: 0.0022, smooth: 2, minOffset: 0.0016, taper: 0.0012, edgeSmooth: 12 }), 1);
    // Shoes: a real lasted shoe (toe box, rounded heel, flat outsole, collar), lofted around each
    // foot's measured footprint and rigid on the foot bone, so no toes show through.
    const ankleY = rig.ankleY;
    for (const S of ['L', 'R']) addShoe(S);
    function addShoe(S) {
      const A = rig.J['ankle' + S], Tt = rig.J['toe' + S], side = Math.sign(A.x) || (S === 'L' ? 1 : -1);
      const f = new T.Vector3(Tt.x - A.x, 0, Tt.z - A.z).normalize(), s = new T.Vector3(f.z, 0, -f.x); // s points to the foot's outside for L
      const footB = list.indexOf(bones['foot' + S]), shinB = list.indexOf(bones['shin' + S]);
      // Footprint: the foot's body vertices below the ankle.
      const pts = [];
      for (let v = 0; v < B; v++) {
        if (!(reg[v] & (bits.SHOE | bits.SOCK))) continue;
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        if (Math.sign(x) !== side || y > ankleY + 0.03) continue;
        const dx = x - A.x, dz = z - A.z;
        pts.push([dx * f.x + dz * f.z, dx * s.x + dz * s.z, y]);
      }
      let a0 = Infinity, a1 = -Infinity; for (const q of pts) { if (q[2] < ankleY - 0.01) { a0 = Math.min(a0, q[0]); a1 = Math.max(a1, q[0]); } }
      a0 -= 0.012; a1 += 0.016;                                     // heel counter and toe room
      const NS = 18, NR = 24, lo = new Float32Array(NS + 1).fill(-0.03), hi = new Float32Array(NS + 1).fill(0.03), top = new Float32Array(NS + 1).fill(0.05);
      const seen = new Uint8Array(NS + 1);
      for (const q of pts) {
        const i = Math.round(clamp((q[0] - a0) / (a1 - a0)) * NS);
        if (q[2] > ankleY + 0.005 && (q[0] - a0) / (a1 - a0) > 0.45) continue; // shin above the instep is not shoe
        if (!seen[i]) { lo[i] = q[1]; hi[i] = q[1]; top[i] = q[2]; seen[i] = 1; continue; }
        lo[i] = Math.min(lo[i], q[1]); hi[i] = Math.max(hi[i], q[1]); top[i] = Math.max(top[i], q[2]);
      }
      for (let i = 0; i <= NS; i++) if (!seen[i]) { let j = i; while (j > 0 && !seen[j]) j--; let k = i; while (k < NS && !seen[k]) k++; const src = seen[j] ? j : k; lo[i] = lo[src]; hi[i] = hi[src]; top[i] = top[src]; }
      for (let it = 0; it < 3; it++) for (const arr of [lo, hi, top]) { const c = arr.slice(); for (let i = 1; i < NS; i++) arr[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4; }
      const soleC = new T.Color(kit.sole), upC = new T.Color(kit.shoe), rel = (c) => [clamp(c.r / Math.max(0.04, upC.r), 0, 6), clamp(c.g / Math.max(0.04, upC.g), 0, 6), clamp(c.b / Math.max(0.04, upC.b), 0, 6)];
      const soleRel = rel(soleC), collarRel = rel(new T.Color(0.12, 0.12, 0.13));
      const vert = (along, across, y, col, t) => {
        const x = A.x + f.x * along + s.x * across, z = A.z + f.z * along + s.z * across;
        const id = push(x, y, z, 0, 1, 0, 0, 0, col, d.renderBase[0]);
        const w = t === undefined ? 0 : clamp((y - (ankleY - 0.01)) / 0.05) * 0.35 * (t < 0.55 ? 1 : 0); // collar follows the shin a little
        SI[id * 4] = footB; SW[id * 4] = 1 - w; SI[id * 4 + 1] = shinB; SW[id * 4 + 1] = w; SI[id * 4 + 2] = SI[id * 4 + 3] = 0; SW[id * 4 + 2] = SW[id * 4 + 3] = 0;
        return id;
      };
      const station = (i) => {
        const t = i / NS, along = a0 + (a1 - a0) * t;
        const endT = t > 0.78 ? (t - 0.78) / 0.22 : t < 0.12 ? (0.12 - t) / 0.12 : 0, round = Math.sqrt(Math.max(0.02, 1 - endT * endT));
        const w0 = lo[i] - 0.006, w1 = hi[i] + 0.006;
        let yTop = top[i] + 0.009; if (t < 0.42) yTop = Math.max(yTop, ankleY + 0.032 - 0.04 * t); if (t > 0.78) yTop = 0.02 + (yTop - 0.02) * (0.5 + 0.5 * round);
        return { t, along, round, cx: (w0 + w1) / 2, hw: (w1 - w0) / 2, yTop, spring: t > 0.84 ? 0.007 * (t - 0.84) / 0.16 : 0 };
      };
      // One closed loft (rings + heel/toe caps) per layer: the upper, then the outsole as its own slab, so
      // the colour edge between them is sharp.
      const loft = (ringAt, colAt) => {
        const ring = [];
        for (let i = 0; i <= NS; i++) { const st = station(i), r = []; for (let j = 0; j < NR; j++) { const q = ringAt(st, j / NR); r.push(vert(st.along, q[0], q[1], colAt(st, q[1]), st.t)); } ring.push(r); }
        for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
          const a = ring[i][j], b = ring[i][(j + 1) % NR], c = ring[i + 1][j], e = ring[i + 1][(j + 1) % NR];
          idx.push(a, b, c, b, e, c);                                // (s, up, f) is right-handed for both feet → outward
        }
        for (const [i, toe] of [[0, 0], [NS, 1]]) {
          const r = ring[i]; let cx = 0, cy = 0, cz = 0; for (const id of r) { cx += P[id * 3]; cy += P[id * 3 + 1]; cz += P[id * 3 + 2]; }
          const cen = push(cx / NR, cy / NR, cz / NR, 0, 1, 0, 0, 0, [C[r[0] * 3], C[r[0] * 3 + 1], C[r[0] * 3 + 2]], d.renderBase[0]);
          for (let k = 0; k < 4; k++) { SI[cen * 4 + k] = k ? 0 : footB; SW[cen * 4 + k] = k ? 0 : 1; }
          for (let j = 0; j < NR; j++) { const a = r[j], b = r[(j + 1) % NR]; if (toe) idx.push(cen, a, b); else idx.push(cen, b, a); }
        }
      };
      const start = idx.length;
      const pw = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
      loft((st, u) => {                                              // upper: domed, slightly drawn in at the top
        const th = u * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), y0 = 0.018 + st.spring;
        const y = y0 + (st.yTop - y0) * (0.5 + 0.5 * pw(sn, sn < 0 ? 0.3 : 0.85));
        return [st.cx + st.hw * st.round * pw(c, 0.5) * (sn > 0 ? 1 - 0.1 * sn : 1), y];
      }, (st, y) => (y > ankleY + 0.008 && st.t < 0.5 ? collarRel.map((c) => c * 0.6 + 0.4) : [1, 1, 1]));
      loft((st, u) => {                                              // outsole + midsole: a flat slab a little wider than the upper
        const th = u * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        return [st.cx + (st.hw * st.round + 0.0035) * pw(c, 0.3), st.spring + 0.013 * (1 + pw(sn, 0.3)) + 0.0005];
      }, () => soleRel);
      group(4, start);
    }
    // Knee pads (players).
    if (!o.official) addShell(shell(ctx, (v) => reg[v] & bits.KNEEPAD, { offset: 0.013, smooth: 3, minOffset: 0.008 }), 5);
    // Hair (style-dependent thickness, tapered at the hairline).
    const th = { buzz: 0.0012, crop: 0.0032, fade: 0.003, curly: 0.0075, wavy: 0.0045 }[p.style] || 0.003;
    if (p.style !== 'buzz') { // buzz cuts are painted on the scalp only
      const headC = rig.J.head.clone().lerp(rig.J.headTop, 0.55);
      const hairShell = shell(ctx, (v) => reg[v] & bits.HAIR, {
        offset: (v, pp) => { let tt = th; if (p.style === 'fade') tt *= smooth((pp[v * 3 + 1] - (rig.J.eyeL.y + 0.03)) / 0.06) * 0.9 + 0.1; if (p.style === 'curly') tt *= 1 + 0.35 * Math.sin(pp[v * 3] * 260) * Math.sin(pp[v * 3 + 1] * 240 + pp[v * 3 + 2] * 90); return tt; },
        smooth: p.style === 'curly' ? 1 : 0, minOffset: 0.0006, taper: th * 0.9, edgeSmooth: 10,
      });
      addShell(hairShell, 6, (x, y, z) => [Math.atan2(x - headC.x, z - headC.z) / (Math.PI * 2) + 0.5, (y - headC.y) * 6]);
    }
    // Eyes (MakeHuman high-poly eyes, rigid on the head).
    const eyeStart = idx.length, ep = d.eyePos, refEye = d.h.refEye, eyeBase = [];
    const headBase = d.h.joints.head[0];
    for (let i = 0; i < ep.length / 3; i++) {
      const side = ep[i * 3] > 0 ? 'L' : 'R', re = refEye[side], me = m.rawEye[side];
      const rx = ep[i * 3] + (me.x - re[0]), ry = ep[i * 3 + 1] + (me.y - re[1]), rz = ep[i * 3 + 2] + (me.z - re[2]);
      const x = rx * m.k, y = (ry - m.minY) * m.k + SOLE, z = rz * m.k;
      const id = push(x, y, z, 0, 0, 1, d.eyeUV[i * 2], d.eyeUV[i * 2 + 1], [1, 1, 1], headBase);
      for (let k = 0; k < 4; k++) { SI[id * 4 + k] = k ? 0 : 4; SW[id * 4 + k] = k ? 0 : 1; }
      eyeBase.push(id);
    }
    for (let i = 0; i < d.eyeIndex.length; i++) idx.push(eyeBase[d.eyeIndex[i]]);
    group(7, eyeStart);
    // Assemble.
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(SI, 4));
    g.setAttribute('skinWeight', new T.Float32BufferAttribute(SW, 4));
    g.setIndex(vcount > 65535 ? new T.Uint32BufferAttribute(idx, 1) : new T.Uint16BufferAttribute(idx, 1));
    // Recompute normals for the shells and eyes only (body keeps its seam-free normals).
    const tmpG = g.clone(); tmpG.computeVertexNormals();
    const nb = g.attributes.normal, nt = tmpG.attributes.normal;
    for (let i = d.R; i < vcount; i++) nb.setXYZ(i, nt.getX(i), nt.getY(i), nt.getZ(i));
    tmpG.dispose();
    for (const gr of groups) if (gr.count) g.addGroup(gr.start, gr.count, gr.mat);
    g.computeBoundingSphere();
    const std = (x) => new T.MeshStandardMaterial({ skinning: true, ...x });
    const materials = [
      skinMaterial(p, std),
      std({ color: kit.sock, roughness: 0.92, envMapIntensity: 0.2 }),
      std({ map: jerseyTexture(team, o.number, kit), color: '#ffffff', roughness: 0.82, envMapIntensity: 0.35 }),
      std({ map: stripeTexture(kit.shorts, kit.shortsTrim), color: '#ffffff', roughness: 0.8, envMapIntensity: 0.3 }),
      std({ color: kit.shoe, vertexColors: true, roughness: 0.45, envMapIntensity: 0.5 }),
      std({ color: '#1d2126', roughness: 0.9 }),
      std({ color: p.hair, map: hairTexture(), bumpMap: hairTexture(), bumpScale: 0.0015, roughness: 0.85, envMapIntensity: 0.15 }),
      std({ map: eyeTexture(), color: '#ffffff', roughness: 0.12, alphaTest: 0.3, envMapIntensity: 0.8 }),
    ];
    const mesh = new T.SkinnedMesh(g, materials);
    mesh.add(bones.hips);
    mesh.bind(new T.Skeleton(list));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    return { mesh, bones, materials, rig, params: p };
  }

  window.VolleyBody = { available: () => !!decode(), build, decode, KIT, _test: { morph, buildRig, paramsFor } };
})();
