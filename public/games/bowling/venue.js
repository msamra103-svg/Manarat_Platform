/* Bowling venue (bowling-only, procedural, no external images): approach, lanes, gutters,
 * capping, pin deck, pit and cushion, kickbacks, masking units with school signage, pinsetter
 * spotting table and sweep bar, ball return, overhead score monitors, settee area, tiered
 * spectator seating, walls, ceiling and light fittings. Dimensions follow the nominal values in
 * physics.js (see CREDITS.md); this is an illustrative hall, not a model of a specific real venue.
 *
 *   BowlingVenue.build(scene, { quality, font, lanes, schoolName, platformName }) ->
 *     { seats, update(dt), setMonitor(data), sweep: {...}, deck: {...}, neighborPins, dispose() }
 */
(function (root) {
  'use strict';
  const T = root.THREE, P = root.BowlingPhysics;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const MAROON = '#8a1538', GOLD = '#c9a24d', WHITE = '#ffffff';
  const PITCH = P.WIDTH + 2 * P.GUTTER_W + 0.18; // lane centre spacing (1.70 m)
  const BOARD = P.WIDTH / 39;

  // ---------------------------------------------------------------- geometry merging (static parts)
  function mergeInto(list) {
    // list of BufferGeometry already in world space, non-indexed or indexed; attributes position/normal/uv
    let nv = 0, ni = 0;
    const geos = list;
    for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0, oi = 0;
    for (const g of geos) {
      const a = g.attributes, n = a.position.count;
      pos.set(a.position.array, ov * 3); nor.set(a.normal.array, ov * 3);
      if (a.uv) uv.set(a.uv.array, ov * 2);
      if (g.index) { for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov; oi += g.index.count; }
      else { for (let i = 0; i < n; i++) idx[oi + i] = ov + i; oi += n; }
      ov += n;
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    out.setIndex(new T.BufferAttribute(idx, 1)); out.computeBoundingSphere();
    return out;
  }

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, srgb = true, rep) {
    const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

  // maple/pine boards: 39 boards across, grain along the lane
  function boardTexture(seed, tone, len) {
    const W = 312, H = 2048, c = canvas(W, H), x = c.getContext('2d'), r = rng(seed);
    for (let b = 0; b < 39; b++) {
      const x0 = Math.round(b * W / 39), x1 = Math.round((b + 1) * W / 39);
      let y = 0;
      while (y < H) {
        const seg = 300 + r() * 900, v = (r() - 0.5) * 18;
        x.fillStyle = `rgb(${tone[0] + v | 0},${tone[1] + v * 0.85 | 0},${tone[2] + v * 0.6 | 0})`;
        x.fillRect(x0, y, x1 - x0, seg);
        x.fillStyle = 'rgba(70,40,10,0.35)'; x.fillRect(x0, y, x1 - x0, 1.2); // board end joint
        y += seg;
      }
      x.fillStyle = 'rgba(60,35,10,0.28)'; x.fillRect(x0, 0, 1, H);
      // grain streaks
      for (let k = 0; k < 26; k++) {
        const gx = x0 + 1 + r() * (x1 - x0 - 2), gy = r() * H, gl = 60 + r() * 380;
        x.strokeStyle = `rgba(${90 + r() * 30 | 0},${55 + r() * 20 | 0},${20},${0.06 + r() * 0.09})`; x.lineWidth = 0.6 + r() * 0.8;
        x.beginPath(); x.moveTo(gx, gy); x.bezierCurveTo(gx + (r() - 0.5) * 2, gy + gl * 0.33, gx + (r() - 0.5) * 2, gy + gl * 0.66, gx + (r() - 0.5) * 1.5, gy + gl); x.stroke();
      }
    }
    const t = tex(c, true); t.wrapT = T.RepeatWrapping; t.repeat.set(1, len / 4.6);
    return t;
  }
  // roughness: oiled front part shinier than the dry back end (restrained, no mirror)
  function oilRoughness() {
    const c = canvas(32, 512), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    const oilEnd = P.OIL_END / (P.LENGTH + 0.868);
    g.addColorStop(0, '#3c3c3c'); g.addColorStop(oilEnd * 0.9, '#404040'); g.addColorStop(Math.min(1, oilEnd * 1.06), '#6a6a6a'); g.addColorStop(1, '#707070');
    x.fillStyle = g; x.fillRect(0, 0, 32, 512);
    // slightly less oil on the outside boards
    const e = x.createLinearGradient(0, 0, 32, 0); e.addColorStop(0, 'rgba(110,110,110,0.45)'); e.addColorStop(0.25, 'rgba(110,110,110,0)'); e.addColorStop(0.75, 'rgba(110,110,110,0)'); e.addColorStop(1, 'rgba(110,110,110,0.45)');
    x.fillStyle = e; x.fillRect(0, 0, 32, 512 * oilEnd);
    const t = tex(c, false); return t;
  }
  function carpetTexture() {
    const c = canvas(256, 256), x = c.getContext('2d'), r = rng(31);
    x.fillStyle = '#3b1424'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${120 + r() * 60 | 0},${30 + r() * 20 | 0},${50 + r() * 20 | 0},${0.15 + r() * 0.2})`; x.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
    x.strokeStyle = 'rgba(201,162,77,0.35)'; x.lineWidth = 2;
    for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(128, 128, 30 + k * 26, 0, Math.PI * 2); x.stroke(); }
    return tex(c, true, [6, 4]);
  }

  // ---------------------------------------------------------------- Arabic text helpers (canvas)
  function fitText(x, text, maxW, size, weight, family) {
    let s = size; x.font = `${weight} ${s}px ${family}`;
    while (x.measureText(text).width > maxW && s > 10) { s -= 2; x.font = `${weight} ${s}px ${family}`; }
    return s;
  }

  function build(scene, opts = {}) {
    const Q = opts.quality || {}, font = opts.font || 'Tajawal, Tahoma, Arial, sans-serif';
    const lanes = opts.lanes || (Q.tier === 'low' ? 2 : 3); // lanes on each side of ours
    const group = new T.Group(); group.name = 'venue'; scene.add(group);
    const disposables = [];
    const M = (o) => { const m = new T.MeshStandardMaterial(o); disposables.push(m); return m; };
    const buckets = new Map();
    function add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      const m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
      const g = geo.clone(); g.applyMatrix4(m);
      if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(g);
    }
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const flush = (castShadow = false) => {
      for (const [mat, list] of buckets) {
        const mesh = new T.Mesh(mergeInto(list), mat); mesh.receiveShadow = true; mesh.castShadow = castShadow && !!mat.userData.cast;
        mesh.matrixAutoUpdate = false; mesh.updateMatrix(); group.add(mesh); disposables.push(mesh.geometry);
        list.forEach(g => g.dispose());
      }
      buckets.clear();
    };

    // ---------------------------------------------------------- materials
    const LEN = -P.DECK_END; // foul line -> pit edge
    const laneTex = boardTexture(11, [204, 156, 102], LEN), approachTex = boardTexture(23, [212, 168, 114], 4.6);
    const deckTex = boardTexture(37, [214, 174, 122], 1.6);
    const rough = oilRoughness();
    const envI = Q.tier === 'low' ? 0.35 : 0.55;
    const env = opts.env || null;
    const laneMat = M({ map: laneTex, roughnessMap: rough, roughness: 1, metalness: 0, envMap: env, envMapIntensity: envI });
    const approachMat = M({ map: approachTex, roughness: 0.42, metalness: 0, envMap: env, envMapIntensity: 0.3 });
    const deckMat = M({ map: deckTex, roughness: 0.38, metalness: 0, envMap: env, envMapIntensity: 0.4 });
    const gutterMat = M({ color: '#2a2d33', roughness: 0.35, metalness: 0.35, side: T.DoubleSide, envMap: env, envMapIntensity: 0.6 });
    const cappingMat = M({ color: '#1b1d22', roughness: 0.5, metalness: 0.1 });
    const kickMat = M({ color: '#23171c', roughness: 0.6 });
    const darkMat = M({ color: '#0b0c0f', roughness: 0.95 });
    const pitMat = M({ color: '#050506', roughness: 1 });
    const curtainMat = M({ color: '#0a0a0c', roughness: 1 });
    const metalMat = M({ color: '#8b9097', roughness: 0.32, metalness: 0.75, envMap: env, envMapIntensity: 0.8 });
    const wallMat = M({ color: '#2c2a30', roughness: 0.85 });
    const wallMaroon = M({ color: '#5d1027', roughness: 0.8 });
    const ceilMat = M({ color: '#1d1e22', roughness: 0.9 });
    const carpetMat = M({ map: carpetTexture(), roughness: 0.95 });
    const seatMat = M({ color: '#7a1633', roughness: 0.7 }); seatMat.userData.cast = true;
    const seatFrame = M({ color: '#3a3d44', roughness: 0.5, metalness: 0.5 });
    const tierMat = M({ color: '#3a3438', roughness: 0.9 });
    const lightPanel = new T.MeshBasicMaterial({ color: '#fff6e6' }); disposables.push(lightPanel);
    const goldMat = M({ color: GOLD, roughness: 0.4, metalness: 0.6, envMap: env, envMapIntensity: 0.8 });
    const foulMat = M({ color: '#111', roughness: 0.6 });
    const markMat = M({ color: '#3a2412', roughness: 0.5 });
    const spotMat = M({ color: '#5a3a1a', roughness: 0.5 });

    const laneXs = []; for (let i = -lanes; i <= lanes; i++) laneXs.push(i * PITCH);
    const halfHall = (lanes + 0.5) * PITCH + 1.3;

    // ---------------------------------------------------------- lanes, gutters, capping, deck, pit
    for (const cx of laneXs) {
      // main lane (foul line -> start of pin deck), pin deck, approach
      const deckStart = -P.LENGTH + 0.6;
      add(new T.PlaneGeometry(P.WIDTH, -deckStart), laneMat, cx, 0, deckStart / 2, -Math.PI / 2);
      add(new T.PlaneGeometry(P.WIDTH, deckStart - P.DECK_END), deckMat, cx, 0.0005, (deckStart + P.DECK_END) / 2, -Math.PI / 2);
      add(new T.PlaneGeometry(PITCH, 4.75), approachMat, cx, 0, 4.75 / 2, -Math.PI / 2);
      add(box(P.WIDTH, 0.0015, 0.0095), foulMat, cx, 0.0008, -0.005); // foul line 3/8 in
      // gutters: concave channels (arc) on both sides
      for (const sd of [-1, 1]) {
        const gx = cx + sd * (P.WIDTH / 2 + P.GUTTER_W / 2);
        const rad = 0.169, sag = P.GUTTER_D, half = Math.asin((P.GUTTER_W / 2) / rad);
        const g = new T.CylinderGeometry(rad, rad, -P.DECK_END + 0.02, 18, 1, true, -half, 2 * half);
        // cylinder axis along Y -> rotate to Z; the arc opens upward with its lowest line at -GUTTER_D
        add(g, gutterMat, gx, rad - sag, P.DECK_END / 2, Math.PI / 2, 0, 0);
        add(box(0.06, 0.012, -P.DECK_END), cappingMat, cx + sd * (P.WIDTH / 2 + P.GUTTER_W + 0.03), 0.006, P.DECK_END / 2);
      }
      // capping/division between lanes
      add(box(0.06, 0.03, -P.DECK_END), cappingMat, cx + PITCH / 2, 0.012, P.DECK_END / 2);
      // pin spots on the deck
      for (const s of P.rack()) { add(new T.CircleGeometry(0.03, 20), spotMat, cx + s.x, 0.0011, s.z, -Math.PI / 2); }
      // kickbacks (side boards along the deck and pit)
      for (const sd of [-1, 1]) add(box(0.08, 0.62, 3.2), kickMat, cx + sd * (P.KICK_X + 0.05), 0.24, -P.LENGTH - 0.65);
      // pit (dark) and the black cushion curtain
      add(box(PITCH, 0.02, 1.25), pitMat, cx, -0.3, P.DECK_END - 0.62);
      add(box(PITCH - 0.02, 0.9, 0.06), curtainMat, cx, 0.15, P.DECK_END - 1.12);
      add(box(PITCH, 0.32, 0.03), darkMat, cx, -0.15, P.DECK_END - 0.015); // deck front face into the pit
      // markings: arrows (~15-16 ft, centre farthest), guide dots (7 ft), approach dots (12 and 15 ft)
      for (let k = -3; k <= 3; k++) {
        const board = 20 + k * 5; const x = cx + (board - 20) * BOARD;
        const z = -(16 - Math.abs(k) * 0.33) * 0.3048;
        const shape = new T.Shape(); shape.moveTo(-0.013, 0.07); shape.lineTo(0.013, 0.07); shape.lineTo(0, -0.07); shape.closePath();
        add(new T.ShapeGeometry(shape), markMat, x, 0.0012, z, -Math.PI / 2);
      }
      for (const b of [3, 5, 8, 11, 14, 26, 29, 32, 35, 37]) add(new T.CircleGeometry(0.009, 12), markMat, cx + (b - 20) * BOARD, 0.0012, -7 * 0.3048, -Math.PI / 2);
      for (const ft of [12, 15]) for (let k = -3; k <= 3; k++) add(new T.CircleGeometry(k === 0 ? 0.016 : 0.011, 14), markMat, cx + k * 5 * BOARD, 0.0012, ft * 0.3048, -Math.PI / 2);
    }
    // approach floor beyond lanes, settee area carpet, concourse
    add(new T.PlaneGeometry(halfHall * 2, 6.5), carpetMat, 0, -0.001, 4.75 + 3.25, -Math.PI / 2);
    add(new T.PlaneGeometry(halfHall * 2, 6), M({ color: '#2b2427', roughness: 0.9 }), 0, -0.002, 14, -Math.PI / 2);
    // floor under the lanes outside our lane set
    add(new T.PlaneGeometry(1.4, 26), wallMat, -halfHall + 0.7, -0.05, -9, -Math.PI / 2);
    add(new T.PlaneGeometry(1.4, 26), wallMat, halfHall - 0.7, -0.05, -9, -Math.PI / 2);

    // ---------------------------------------------------------- masking units, back wall, pinsetters
    const maskY = 0.82, maskH = 1.25, maskZ = -P.LENGTH - 0.15;
    const maskW = (lanes * 2 + 1) * PITCH;
    add(box(maskW + 2.6, 4.0, 0.3), M({ color: '#141216', roughness: 0.95 }), 0, maskY + maskH + 2.0, maskZ - 0.3); // wall above masking
    add(box(maskW + 2.6, 0.9, 0.3), darkMat, 0, maskY - 0.45, P.DECK_END - 1.6);   // behind the pit
    // pinsetter machines (dark boxes) behind masking
    for (const cx of laneXs) {
      add(box(PITCH - 0.12, 1.4, 1.6), darkMat, cx, maskY + 0.7, maskZ - 1.05);
      add(box(0.05, 0.75, 1.5), metalMat, cx + PITCH / 2 - 0.06, 0.38 + 0.05, maskZ - 0.95);
    }

    // ---------------------------------------------------------- ball returns between lane pairs
    const returnX = [];
    for (let i = -lanes; i < lanes; i += 2) returnX.push((i + 0.5) * PITCH);
    const hoodGeo = new T.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const hoodMat = M({ color: '#6c1029', roughness: 0.35, metalness: 0.2, envMap: env, envMapIntensity: 0.6 });
    for (const x of returnX) {
      add(hoodGeo, hoodMat, x, 0.0, 3.4, 0, 0, 0, 0.62, 0.75, 1.0);
      add(box(0.38, 0.06, 1.55), metalMat, x, 0.56, 4.4); // rack rails
      add(box(0.42, 0.55, 1.6), M({ color: '#2a2c31', roughness: 0.6 }), x, 0.27, 4.4);
    }

    // ---------------------------------------------------------- settee area: sofas + score consoles
    const sofaMat = M({ color: '#4a0d20', roughness: 0.65 }); sofaMat.userData.cast = true;
    const seats = [];
    for (const x of returnX) {
      for (const sd of [-1, 1]) {
        // curved settee facing the lanes
        const sx = x + sd * 0.62;
        add(box(0.9, 0.42, 0.62), sofaMat, sx, 0.21, 6.25);
        add(box(0.9, 0.5, 0.14), sofaMat, sx, 0.6, 6.58);
        seats.push({ x: sx - 0.22, y: 0.0, z: 6.2, yaw: Math.PI, priority: 1.0, dist: 8 }, { x: sx + 0.22, y: 0.0, z: 6.2, yaw: Math.PI, priority: 0.8, dist: 8 });
      }
      add(box(0.55, 0.75, 0.4), M({ color: '#202227', roughness: 0.5 }), x, 0.375, 5.35); // scoring console
    }
    // tiered spectator seating facing the lanes
    const rows = Q.tier === 'low' ? 2 : 3;
    for (let r = 0; r < rows; r++) {
      const z = 8.8 + r * 0.95, y = r * 0.36;
      add(box(halfHall * 2 - 1.5, y + 0.02, 0.95), tierMat, 0, (y + 0.02) / 2 - 0.01, z + 0.1);
      for (let x = -halfHall + 1.2; x <= halfHall - 1.2; x += 0.62) {
        add(box(0.5, 0.06, 0.46), seatMat, x, y + 0.44, z);
        add(box(0.5, 0.48, 0.06), seatMat, x, y + 0.7, z + 0.24);
        add(box(0.05, 0.42, 0.05), seatFrame, x, y + 0.21, z);
        seats.push({ x, y, z: z - 0.02, yaw: Math.PI, priority: 0.6 - r * 0.12 + (Math.abs(x) < 3 ? 0.25 : 0), dist: 10 + r });
      }
    }

    // ---------------------------------------------------------- walls and ceiling
    add(box(0.3, 6, 36), wallMat, -halfHall - 0.15, 3, -6);
    add(box(0.3, 6, 36), wallMat, halfHall + 0.15, 3, -6);
    add(box(halfHall * 2 + 0.6, 6, 0.3), wallMat, 0, 3, 12.6);
    add(box(halfHall * 2 + 0.6, 1.2, 0.05), wallMaroon, 0, 2.4, 12.44);
    add(box(halfHall * 2 + 0.6, 0.2, 40), ceilMat, 0, 5.1, -6);
    // side-wall maroon wainscot with a gold rail
    for (const sd of [-1, 1]) {
      add(box(0.04, 1.1, 34), wallMaroon, sd * (halfHall - 0.02), 0.55, -6);
      add(box(0.05, 0.03, 34), goldMat, sd * (halfHall - 0.03), 1.12, -6);
    }
    // light panels (emissive) in the ceiling over the approach and the lanes
    for (let z = 10; z > -16; z -= 3.2) for (const cx of laneXs.filter((_, i) => i % 2 === 0)) add(box(1.1, 0.03, 0.5), lightPanel, cx + PITCH / 2, 4.98, z);
    // deck light fascia under the masking
    add(box(maskW + 2, 0.06, 0.12), lightPanel, 0, maskY - 0.03, maskZ + 0.12);

    flush(true);

    // ---------------------------------------------------------- masking unit signage (canvas)
    const famReady = font;
    {
      const c = canvas(4096, 512), x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#5b0e27'); g.addColorStop(0.55, MAROON); g.addColorStop(1, '#4a0b20');
      x.fillStyle = g; x.fillRect(0, 0, 4096, 512);
      x.fillStyle = GOLD; x.fillRect(0, 40, 4096, 6); x.fillRect(0, 466, 4096, 6);
      // lane numbers over each lane, school name centred above ours
      const per = 4096 / (lanes * 2 + 1);
      x.textAlign = 'center'; x.direction = 'rtl'; x.fillStyle = WHITE;
      for (let i = 0; i < lanes * 2 + 1; i++) {
        const cxp = per * (i + 0.5);
        x.globalAlpha = 0.95; x.font = `800 ${150}px ${famReady}`; x.fillStyle = 'rgba(255,255,255,0.13)'; x.fillText(String(i + 7), cxp, 330);
        x.globalAlpha = 1; x.fillStyle = GOLD; x.font = `700 46px ${famReady}`; x.fillText('المسار ' + (i + 7), cxp, 120);
      }
      const mid = per * (lanes + 0.5);
      x.fillStyle = WHITE; fitText(x, opts.schoolName, per * 2.6, 92, 800, famReady); x.fillText(opts.schoolName, mid, 270);
      x.fillStyle = 'rgba(255,255,255,0.86)'; fitText(x, opts.platformName, per * 2.6, 54, 400, famReady); x.fillText(opts.platformName, mid, 370);
      const t = tex(c); disposables.push(t);
      const m = new T.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.32 }); disposables.push(m);
      const mesh = new T.Mesh(new T.PlaneGeometry(maskW, maskH), m); mesh.position.set(0, maskY + maskH / 2, maskZ + 0.01); group.add(mesh); disposables.push(mesh.geometry);
    }
    // back wall banner over the spectators (visible in the reaction camera)
    {
      const c = canvas(2048, 256), x = c.getContext('2d');
      x.fillStyle = MAROON; x.fillRect(0, 0, 2048, 256); x.fillStyle = GOLD; x.fillRect(0, 18, 2048, 5); x.fillRect(0, 233, 2048, 5);
      x.fillStyle = WHITE; x.textAlign = 'center'; x.direction = 'rtl'; fitText(x, opts.platformName + ' · ' + opts.schoolName, 1900, 84, 700, famReady); x.fillText(opts.platformName + ' · ' + opts.schoolName, 1024, 158);
      const t = tex(c); disposables.push(t);
      const mesh = new T.Mesh(new T.PlaneGeometry(halfHall * 1.6, halfHall * 0.2), new T.MeshBasicMaterial({ map: t })); mesh.position.set(0, 3.6, 12.44); mesh.rotation.y = Math.PI; group.add(mesh); disposables.push(mesh.geometry, mesh.material);
    }

    // ---------------------------------------------------------- overhead score monitors (our pair)
    const monC = canvas(768, 432), monX = monC.getContext('2d'), monT = tex(monC); disposables.push(monT);
    const monMat = new T.MeshBasicMaterial({ map: monT, toneMapped: false }); disposables.push(monMat);
    const monitors = new T.Group(); group.add(monitors);
    const frameMat = M({ color: '#111216', roughness: 0.4, metalness: 0.4 });
    for (const [x, ry] of [[-0.55, 0.06], [0.55, -0.06]]) {
      const f = new T.Mesh(new T.BoxGeometry(1.0, 0.6, 0.06), frameMat); f.position.set(x, 3.35, 0.9); f.rotation.set(-0.3, ry, 0);
      const s = new T.Mesh(new T.PlaneGeometry(0.94, 0.53), monMat); s.position.set(0, 0, 0.032); f.add(s);
      monitors.add(f); disposables.push(f.geometry, s.geometry);
    }
    const arms = new T.Mesh(new T.BoxGeometry(0.04, 1.8, 0.04), metalMat); arms.position.set(0, 4.35, 0.9); monitors.add(arms); disposables.push(arms.geometry);
    function setMonitor(d = {}) {
      const x = monX; x.clearRect(0, 0, 768, 432);
      const g = x.createLinearGradient(0, 0, 0, 432); g.addColorStop(0, '#16070d'); g.addColorStop(1, '#2a0b17'); x.fillStyle = g; x.fillRect(0, 0, 768, 432);
      x.fillStyle = MAROON; x.fillRect(0, 0, 768, 70); x.fillStyle = GOLD; x.fillRect(0, 70, 768, 4);
      x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = WHITE; x.font = `700 34px ${famReady}`; x.fillText('المسار ' + (lanes + 7), 740, 48);
      x.textAlign = 'left'; x.direction = 'ltr'; x.font = `700 30px ${famReady}`; x.fillStyle = GOLD; x.fillText((d.round || '—'), 28, 48);
      x.direction = 'rtl'; x.textAlign = 'center';
      x.fillStyle = 'rgba(255,255,255,0.75)'; x.font = `400 30px ${famReady}`; x.fillText(d.caption || 'القوارير الساقطة في الرمية', 384, 132);
      x.fillStyle = WHITE; x.font = `800 150px ${famReady}`; x.fillText(d.big == null ? '—' : String(d.big), 384, 290);
      x.fillStyle = GOLD; x.font = `700 32px ${famReady}`; fitText(x, d.footer || '', 700, 32, 700, famReady); x.fillText(d.footer || '', 384, 380);
      // pin diagram
      if (d.pins) {
        const base = [96, 250];
        P.rack().forEach((s, i) => { const px = base[0] + (s.x / P.PIN_SPACING) * 34, py = base[1] + (s.z + P.LENGTH) / P.ROW * 30; x.beginPath(); x.arc(px, py, 12, 0, Math.PI * 2); x.fillStyle = d.pins[i] ? 'rgba(255,255,255,0.18)' : WHITE; x.fill(); });
      }
      monT.needsUpdate = true;
    }
    setMonitor({ round: '', big: null, footer: opts.schoolName });

    // ---------------------------------------------------------- neighbour racks (instanced pins)
    const pinGeo = opts.pinGeometry, pinMat = opts.pinMaterial;
    let neighborPins = null;
    if (pinGeo && pinMat) {
      const others = laneXs.filter(x => Math.abs(x) > 0.1);
      neighborPins = new T.InstancedMesh(pinGeo, pinMat, others.length * 10);
      const m = new T.Matrix4(); let k = 0;
      for (const cx of others) for (const s of P.rack()) { m.makeTranslation(cx + s.x, 0, s.z); neighborPins.setMatrixAt(k++, m); }
      neighborPins.castShadow = false; neighborPins.receiveShadow = true; group.add(neighborPins);
    }

    // ---------------------------------------------------------- our pinsetter: spotting table and sweep bar
    const sweep = new T.Group(); group.add(sweep);
    const sweepBar = new T.Mesh(new T.BoxGeometry(P.WIDTH + 0.3, 0.16, 0.05), M({ color: '#d9dde2', roughness: 0.45, metalness: 0.3 }));
    sweepBar.castShadow = true; sweep.add(sweepBar);
    for (const sd of [-1, 1]) { const arm = new T.Mesh(new T.BoxGeometry(0.04, 0.9, 0.04), metalMat); arm.position.set(sd * (P.WIDTH / 2 + 0.12), 0.48, 0); sweep.add(arm); disposables.push(arm.geometry); }
    disposables.push(sweepBar.geometry);
    const SWEEP_UP = 1.15, SWEEP_DOWN = 0.11, SWEEP_FRONT = -P.LENGTH + 0.32, SWEEP_BACK = P.DECK_END + 0.05, SWEEP_REST = maskZ - 0.3;
    sweep.position.set(0, SWEEP_UP, SWEEP_REST); // at rest the sweep hides behind the masking unit
    const table = new T.Mesh(new T.BoxGeometry(P.WIDTH + 0.1, 0.06, 1.25), M({ color: '#2b2e34', roughness: 0.55, metalness: 0.3 }));
    table.position.set(0, 1.05, -P.LENGTH - 0.42); table.castShadow = true; group.add(table); disposables.push(table.geometry);
    const TABLE_UP = 1.05, TABLE_DOWN = 0.43;

    // sweep/table animation driver: reset() runs ~2.4 s, callbacks at clear and at respot
    let anim = null;
    function reset(onCleared, onSpotted, fast = false) {
      anim = { t: 0, onCleared, onSpotted, cleared: false, spotted: false, k: fast ? 2.2 : 1 };
    }
    function update(dt) {
      if (!anim) return null;
      anim.t += dt * anim.k;
      const t = anim.t;
      // 0-0.35 down, 0.35-0.95 sweep back, 0.95-1.25 return front (raised), 1.0-1.7 table down/up
      let y = SWEEP_UP, z = SWEEP_FRONT;
      if (t < 0.35) y = 0.78 + (SWEEP_DOWN - 0.78) * smooth(t / 0.35);   // drops out from under the masking
      else if (t < 0.95) { y = SWEEP_DOWN; z = SWEEP_FRONT + (SWEEP_BACK - SWEEP_FRONT) * smooth((t - 0.35) / 0.6); }
      else if (t < 1.35) { y = SWEEP_DOWN + 0.5 * smooth((t - 0.95) / 0.2); z = SWEEP_BACK + (SWEEP_FRONT - SWEEP_BACK) * smooth((t - 0.95) / 0.4); }
      else { y = Math.min(SWEEP_UP, SWEEP_DOWN + 0.5 + (SWEEP_UP - SWEEP_DOWN - 0.5) * smooth((t - 1.35) / 0.3)); z = SWEEP_FRONT; }
      if (y > 0.74) z = SWEEP_REST;                                       // above the masking edge: back behind it
      sweep.position.set(0, y + 0.08, z);
      let ty = TABLE_UP;
      if (t > 1.0 && t < 2.3) { const u = (t - 1.0) / 1.3; ty = TABLE_UP + (TABLE_DOWN - TABLE_UP) * Math.sin(Math.PI * clamp(u, 0, 1)); }
      table.position.y = ty;
      const ev = { sweepZ: z, sweepY: y, tableY: ty, pinsDrop: t > 1.0 && t < 1.65 ? (TABLE_DOWN - 0.03 - ty) : 0, pinsVisible: t > 1.0 };
      if (!anim.cleared && t >= 0.95) { anim.cleared = true; anim.onCleared && anim.onCleared(); }
      if (!anim.spotted && t >= 1.65) { anim.spotted = true; anim.onSpotted && anim.onSpotted(); }
      if (t >= 2.4) { anim = null; table.position.y = TABLE_UP; sweep.position.set(0, SWEEP_UP, SWEEP_REST); ev.done = true; }
      return ev;
    }
    function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

    function dispose() {
      group.traverse(o => { if (o.isMesh || o.isInstancedMesh) { o.geometry && o.geometry.dispose(); } });
      disposables.forEach(d => d.dispose && d.dispose());
      scene.remove(group);
    }
    return { group, seats, setMonitor, reset, update, get resetting() { return !!anim; }, sweep, table, neighborPins, laneXs, PITCH, returnX, halfHall, maskY, maskZ, dispose };
  }

  root.BowlingVenue = { build, PITCH, BOARD, mergeInto };
})(typeof window !== 'undefined' ? window : globalThis);
