/* Indoor arena (procedural, local, no external images). FIBA court geometry,
 * maple floor, glass backboard, tiered stands with seats, LED ribbons, roof
 * lighting, end-wall scoreboard. Arabic identity text is rendered by the
 * browser's own text engine onto canvases (properly shaped, editable here).
 * Basketball-only file.
 */
(function (root) {
  'use strict';
  const T = root.THREE, M = root.BasketballMotion;
  const C = M.COURT;
  const MAROON = '#8a1538', GOLD = '#c9a45c';

  // ---------- geometry builder (merges many boxes/quads per material) ----------
  class Builder {
    constructor() { this.parts = new Map(); }
    get(key) { if (!this.parts.has(key)) this.parts.set(key, { p: [], n: [], u: [] }); return this.parts.get(key); }
    quad(key, a, b, c, d, uvScale = 1) { // a,b,c,d counter-clockwise (front face)
      const P = this.get(key), n = new T.Vector3().subVectors(b, a).cross(new T.Vector3().subVectors(d, a)).normalize();
      const w = a.distanceTo(b) * uvScale, h = a.distanceTo(d) * uvScale;
      for (const [v, uu, vv] of [[a, 0, 0], [b, w, 0], [c, w, h], [a, 0, 0], [c, w, h], [d, 0, h]]) { P.p.push(v.x, v.y, v.z); P.n.push(n.x, n.y, n.z); P.u.push(uu, vv); }
    }
    box(key, cx, cy, cz, sx, sy, sz, rotY = 0, uvScale = 1) {
      const hx = sx / 2, hy = sy / 2, hz = sz / 2, c = Math.cos(rotY), s = Math.sin(rotY);
      const V = (x, y, z) => new T.Vector3(cx + x * c + z * s, cy + y, cz - x * s + z * c);
      const v = [V(-hx, -hy, -hz), V(hx, -hy, -hz), V(hx, hy, -hz), V(-hx, hy, -hz), V(-hx, -hy, hz), V(hx, -hy, hz), V(hx, hy, hz), V(-hx, hy, hz)];
      const f = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]];
      for (const q of f) this.quad(key, v[q[0]], v[q[1]], v[q[2]], v[q[3]], uvScale);
    }
    build(materials, parent, shadow = { cast: false, receive: true }) {
      for (const [key, P] of this.parts) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(P.p, 3));
        g.setAttribute('normal', new T.Float32BufferAttribute(P.n, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(P.u, 2));
        g.computeBoundingSphere();
        const m = new T.Mesh(g, materials[key]); m.castShadow = shadow.cast; m.receiveShadow = shadow.receive; m.name = 'arena-' + key;
        parent.add(m);
      }
    }
  }

  // ---------- canvas textures ----------
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

  function woodTexture(size, anisotropy) {
    const c = canvas(size, size), x = c.getContext('2d'), r = rng(9127);
    const strips = 48; // strips across the tile (tile = 2.74 m -> ~5.7 cm strips)
    const sw = size / strips;
    for (let i = 0; i < strips; i++) {
      let y = -r() * size;
      while (y < size) {
        const len = size * (0.18 + r() * 0.42);
        const base = 178 + (r() - 0.5) * 34, warm = r() * 14;
        const g = x.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
        g.addColorStop(0, `rgb(${base + 22 + warm},${base - 12 + warm * .5},${base - 70})`);
        g.addColorStop(0.5, `rgb(${base + 30 + warm},${base - 4 + warm * .5},${base - 60})`);
        g.addColorStop(1, `rgb(${base + 18 + warm},${base - 16 + warm * .5},${base - 74})`);
        x.fillStyle = g; x.fillRect(i * sw, y, sw, len);
        // grain: thin wavy lines along the strip
        for (let k = 0; k < 7; k++) {
          x.strokeStyle = r() > .5 ? 'rgba(90,50,20,0.10)' : 'rgba(255,230,190,0.08)';
          x.lineWidth = 0.6 + r() * 1.2; x.beginPath();
          const gx = i * sw + r() * sw; x.moveTo(gx, y);
          for (let s = 0; s <= 6; s++) x.lineTo(gx + Math.sin(s * 1.3 + r() * 2) * sw * 0.18, y + len * s / 6);
          x.stroke();
        }
        // occasional knot / mineral streak
        if (r() < 0.06) { x.fillStyle = 'rgba(80,45,20,0.18)'; x.beginPath(); x.ellipse(i * sw + sw / 2, y + len * r(), sw * .28, sw * .9, 0, 0, Math.PI * 2); x.fill(); }
        // end joint
        x.fillStyle = 'rgba(60,35,15,0.45)'; x.fillRect(i * sw, y + len - 1, sw, 1.4);
        y += len;
      }
      x.fillStyle = 'rgba(55,30,12,0.32)'; x.fillRect(i * sw, 0, 1, size);
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = anisotropy;
    // roughness variation (wear) from a blurred noise
    const rc = canvas(256, 256), rx = rc.getContext('2d'), rr = rng(77);
    rx.fillStyle = 'rgb(92,92,92)'; rx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const v = 70 + rr() * 60; rx.fillStyle = `rgba(${v},${v},${v},0.25)`; rx.beginPath(); rx.arc(rr() * 256, rr() * 256, 2 + rr() * 14, 0, Math.PI * 2); rx.fill(); }
    const rt = new T.CanvasTexture(rc); rt.wrapS = rt.wrapT = T.RepeatWrapping;
    return { map: t, rough: rt };
  }

  function textCanvas(w, h, draw) { const c = canvas(w, h); draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; }
  const FONT = '"Tajawal","Segoe UI",Tahoma,Arial,sans-serif';

  // ---------- court markings as ribbons ----------
  function ribbon(builder, key, pts, width, y) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const d = new T.Vector2(b[0] - a[0], b[1] - a[1]).normalize(), n = new T.Vector2(-d.y, d.x).multiplyScalar(width / 2);
      builder.quad(key, new T.Vector3(a[0] - n.x, y, a[1] - n.y), new T.Vector3(a[0] + n.x, y, a[1] + n.y), new T.Vector3(b[0] + n.x, y, b[1] + n.y), new T.Vector3(b[0] - n.x, y, b[1] - n.y));
    }
  }
  function arc(cx, cz, r, a0, a1, n = 48) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return p; }
  function fan(builder, key, cx, cz, r, a0, a1, y, n = 48) {
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n;
      const P = builder.get(key);
      for (const [px, pz] of [[cx, cz], [cx + Math.cos(b) * r, cz + Math.sin(b) * r], [cx + Math.cos(a) * r, cz + Math.sin(a) * r]]) { P.p.push(px, y, pz); P.n.push(0, 1, 0); P.u.push(px, pz); }
    }
  }

  function build(scene, opts) {
    const Q = opts.quality, group = new T.Group(); group.name = 'arena'; scene.add(group);
    const disposables = [];
    const lin = c => (typeof c === 'string' ? new T.Color(c).convertSRGBToLinear() : c);
    const std = (o) => { if (o.color) o.color = lin(o.color); const m = new T.MeshStandardMaterial(o); disposables.push(m); return m; };
    // ---------- floor ----------
    const wood = woodTexture(Q.tier === 'low' ? 1024 : 2048, Q.anisotropy);
    wood.map.repeat.set(36 / 2.74, 26 / 2.74); wood.rough.repeat.set(4, 3);
    disposables.push(wood.map, wood.rough);
    const floorMat = std({ map: wood.map, roughnessMap: wood.rough, roughness: 0.62, metalness: 0.0, envMap: opts.env, envMapIntensity: 0.5 });
    const floor = new T.Mesh(new T.PlaneGeometry(36, 26), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.rotation.z = Math.PI / 2; floor.position.set(0, 0, -4); floor.receiveShadow = true; floor.name = 'floor';
    group.add(floor);
    // apron & outer floor (darker, matte)
    const outer = new T.Mesh(new T.PlaneGeometry(60, 60), std({ color: '#2b2326', roughness: 0.9 }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(0, -0.004, -6); outer.receiveShadow = true; group.add(outer);

    // ---------- paint + lines ----------
    const zb = C.baselineZ, rimZ = C.rim.z;
    const paint = new Builder(), lines = new Builder();
    const Y = 0.003;
    // painted key (maroon) and centre circle
    paint.quad('key', new T.Vector3(-2.45, Y, zb), new T.Vector3(2.45, Y, zb), new T.Vector3(2.45, Y, -8.2), new T.Vector3(-2.45, Y, -8.2));
    paint.quad('key', new T.Vector3(-2.45, Y, 14), new T.Vector3(2.45, Y, 14), new T.Vector3(2.45, Y, 8.2), new T.Vector3(-2.45, Y, 8.2));
    fan(paint, 'key', 0, 0, 1.8, 0, Math.PI * 2, Y, 64);
    // apron border band (maroon) outside the boundary lines
    for (const s of [-1, 1]) paint.quad('band', new T.Vector3(s * 7.55, Y, -14.05), new T.Vector3(s * 9.0, Y, -14.05), new T.Vector3(s * 9.0, Y, 14.05), new T.Vector3(s * 7.55, Y, 14.05));
    paint.quad('band', new T.Vector3(-9.0, Y, -14.05), new T.Vector3(9.0, Y, -14.05), new T.Vector3(9.0, Y, -15.8), new T.Vector3(-9.0, Y, -15.8));
    const LW = 0.05, LY = 0.005;
    const W2 = C.width / 2, L2 = C.length / 2;
    ribbon(lines, 'line', [[-W2, -L2], [W2, -L2], [W2, L2], [-W2, L2], [-W2, -L2]], LW, LY);
    ribbon(lines, 'line', [[-W2, 0], [W2, 0]], LW, LY);
    ribbon(lines, 'line', arc(0, 0, 1.8, 0, Math.PI * 2, 72), LW, LY);
    for (const end of [-1, 1]) {
      const bz = end * L2, rz = end * (L2 - 1.575), ftz = end * (L2 - 5.8);
      ribbon(lines, 'line', [[-2.45, bz], [-2.45, ftz], [2.45, ftz], [2.45, bz]], LW, LY);
      ribbon(lines, 'line', end < 0 ? arc(0, ftz, 1.8, 0, Math.PI, 40) : arc(0, ftz, 1.8, Math.PI, Math.PI * 2, 40), LW, LY);
      // three-point: straight parts at 0.9 m from sidelines, then 6.75 m arc
      const r3 = 6.75, xs = W2 - 0.9, a = Math.asin(xs / r3), zc = rz + end * Math.cos(a) * r3;
      ribbon(lines, 'line', [[-xs, bz], [-xs, zc]], LW, LY); ribbon(lines, 'line', [[xs, bz], [xs, zc]], LW, LY);
      const arcPts = []; for (let i = 0; i <= 80; i++) { const t = -a + 2 * a * i / 80; arcPts.push([Math.sin(t) * r3, rz + end * Math.cos(t) * r3]); }
      ribbon(lines, 'line', arcPts, LW, LY);
      // no-charge semicircle 1.25 m
      const nc = []; for (let i = 0; i <= 30; i++) { const t = -Math.PI / 2 + Math.PI * i / 30; nc.push([Math.sin(t) * 1.25, rz + end * Math.cos(t) * 1.25]); }
      ribbon(lines, 'line', nc, LW, LY);
      // lane space marks
      for (const zz of [1.75, 2.6, 3.45, 4.3]) for (const s of [-1, 1]) ribbon(lines, 'line', [[s * 2.45, bz - end * zz], [s * 2.6, bz - end * zz]], LW, LY);
    }
    const paintMat = { key: std({ color: '#64102a', roughness: 0.62, envMap: opts.env, envMapIntensity: 0.12, polygonOffset: true, polygonOffsetFactor: -1, side: T.DoubleSide }), band: std({ color: '#5a0e25', roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, side: T.DoubleSide }) };
    paint.build(paintMat, group);
    lines.build({ line: std({ color: '#f2eee6', roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2, side: T.DoubleSide }) }, group);
    // centre-court identity text (Arabic, browser-shaped)
    const centerTex = textCanvas(1024, 1024, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 10; x.beginPath(); x.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = GOLD; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, w * 0.33, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.font = `700 92px ${FONT}`; x.fillText('أبو عبيدة', w / 2, h / 2 - 40);
      x.font = `500 46px ${FONT}`; x.fillStyle = '#f3e3c3'; x.fillText('الإعدادية للبنين', w / 2, h / 2 + 52);
    });
    disposables.push(centerTex);
    const center = new T.Mesh(new T.PlaneGeometry(3.4, 3.4), std({ map: centerTex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false }));
    center.rotation.x = -Math.PI / 2; center.rotation.z = Math.PI / 2; center.position.y = 0.006; center.receiveShadow = true; group.add(center);
    // baseline apron text behind the basket (readable from the shooting end)
    const apronTex = textCanvas(2048, 256, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.92)'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.font = `700 120px ${FONT}`; x.fillText('مدرسة أبو عبيدة الإعدادية للبنين', w / 2, h / 2 + 6);
    });
    disposables.push(apronTex);
    const apron = new T.Mesh(new T.PlaneGeometry(9, 1.1), std({ map: apronTex, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.006, -14.95); group.add(apron);

    // ---------- basket support, backboard, rim ----------
    const hoop = new T.Group(); hoop.name = 'hoop'; group.add(hoop);
    const padMat = std({ color: '#5c0f27', roughness: 0.75 }), steel = std({ color: '#23282d', roughness: 0.42, metalness: 0.7 });
    const base = new T.Mesh(new T.BoxGeometry(1.25, 0.85, 1.9), padMat); base.position.set(0, 0.425, -16.25); base.castShadow = base.receiveShadow = true; hoop.add(base);
    const baseFront = new T.Mesh(new T.BoxGeometry(1.25, 0.5, 0.4), padMat); baseFront.position.set(0, 0.25, -15.15); baseFront.rotation.x = -0.35; hoop.add(baseFront);
    const mast = new T.Mesh(new T.BoxGeometry(0.26, 2.7, 0.26), padMat); mast.position.set(0, 2.15, -16.55); mast.castShadow = true; hoop.add(mast);
    const armGeo = new T.BoxGeometry(0.16, 0.16, 3.1); const arm = new T.Mesh(armGeo, steel); arm.position.set(0, 3.55, -14.4); arm.rotation.x = 0.17; arm.castShadow = true; hoop.add(arm);
    const brace = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 2.6), steel); brace.position.set(0, 3.15, -14.6); brace.rotation.x = -0.12; hoop.add(brace);
    const B = C.board, bw = B.x1 - B.x0, bh = B.y1 - B.y0, bcy = (B.y0 + B.y1) / 2;
    const glass = new T.Mesh(new T.BoxGeometry(bw, bh, B.thick), new T.MeshPhysicalMaterial({ color: lin('#dfeef5'), roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, envMap: opts.env, envMapIntensity: 1.0, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05 }));
    disposables.push(glass.material);
    glass.position.set(0, bcy, B.z - B.thick / 2); glass.renderOrder = 2; hoop.add(glass);
    const frame = std({ color: '#f4f4f4', roughness: 0.35, metalness: 0.2 });
    const fr = new Builder(); const t = 0.05;
    fr.box('f', 0, B.y1 - t / 2, B.z + 0.002, bw, t, 0.01); fr.box('f', 0, B.y0 + t / 2, B.z + 0.002, bw, t, 0.01);
    fr.box('f', B.x0 + t / 2, bcy, B.z + 0.002, t, bh, 0.01); fr.box('f', B.x1 - t / 2, bcy, B.z + 0.002, t, bh, 0.01);
    // shooter's square 0.59 x 0.45, bottom at rim height + 0.15
    const sq0 = 3.2, sw = 0.59, sh = 0.45;
    fr.box('f', 0, sq0 + sh - t / 2, B.z + 0.003, sw, t, 0.008); fr.box('f', 0, sq0 + t / 2, B.z + 0.003, sw, t, 0.008);
    fr.box('f', -sw / 2 + t / 2, sq0 + sh / 2, B.z + 0.003, t, sh, 0.008); fr.box('f', sw / 2 - t / 2, sq0 + sh / 2, B.z + 0.003, t, sh, 0.008);
    fr.build({ f: frame }, hoop, { cast: false, receive: false });
    const pad = new T.Mesh(new T.BoxGeometry(bw + 0.06, 0.08, 0.07), padMat); pad.position.set(0, B.y0 - 0.02, B.z - 0.015); hoop.add(pad);
    const mount = new T.Mesh(new T.BoxGeometry(0.7, 0.55, 0.12), steel); mount.position.set(0, bcy, B.z - 0.12); hoop.add(mount);
    const rimMat = std({ color: '#e0521c', roughness: 0.38, metalness: 0.55, envMap: opts.env, envMapIntensity: 0.6 });
    const rim = new T.Mesh(new T.TorusGeometry(C.rim.major, C.rim.tube, 10, 64), rimMat); rim.rotation.x = Math.PI / 2; rim.position.set(C.rim.x, C.rim.y, C.rim.z); rim.castShadow = true; hoop.add(rim);
    const bracket = new T.Mesh(new T.BoxGeometry(0.1, 0.035, B.z - (C.rim.z - C.rim.major) > 0 ? 0.16 : 0.16), rimMat);
    bracket.position.set(0, C.rim.y - 0.01, (B.z + C.rim.z - C.rim.major) / 2 - 0.005); bracket.scale.z = Math.abs(B.z - (C.rim.z - C.rim.major)) / 0.16; hoop.add(bracket);

    // ---------- stands + seats ----------
    const stand = new Builder();
    const seats = [];
    const ROW_D = 0.86, RISE = 0.42, SEAT_W = 0.52;
    const rows = Q.tier === 'low' ? 11 : 15;
    // sections: [type, origin, dir] -- baseline behind basket; two sides
    const seatPos = (x, y, z, yaw, prio, dist) => seats.push({ x, y, z, yaw, priority: prio, dist });
    function section(kind) {
      for (let r = 0; r < rows; r++) {
        const y = 0.55 + r * RISE;               // tread height
        if (kind === 'base') {
          const z = -17.3 - r * ROW_D, x0 = -15, x1 = 15;
          stand.box('tread', 0, y - RISE / 2 - 0.0, z - 0.02, x1 - x0 + 4, RISE + 0.02, ROW_D + 0.02);
          stand.box('riser', 0, y + 0.01, z + ROW_D / 2 - 0.01, x1 - x0 + 4, 0.02, 0.03);
          for (let x = x0 + 0.3; x < x1; x += SEAT_W) {
            if (Math.abs(((x - x0) % 7.3) - 3.6) < 0.45) continue; // aisles
            seatPos(x, y, z + 0.08, 0, 1 - r * 0.02 - Math.abs(x) * 0.012, Math.hypot(x, z + 6));
          }
        } else {
          const s = kind === 'left' ? -1 : 1, x = s * (11.0 + r * ROW_D), z0 = -16.4, z1 = 7.5;
          stand.box('tread', x + s * 0.02, y - RISE / 2, (z0 + z1) / 2, ROW_D + 0.02, RISE + 0.02, z1 - z0);
          stand.box('riser', x - s * (ROW_D / 2 - 0.01), y + 0.01, (z0 + z1) / 2, 0.03, 0.02, z1 - z0);
          for (let z = z0 + 0.3; z < z1; z += SEAT_W) {
            if (Math.abs(((z - z0) % 7.3) - 3.6) < 0.45) continue;
            seatPos(x - s * 0.08, y, z, -s * Math.PI / 2, 0.92 - r * 0.02 - Math.max(0, z + 4) * 0.025, Math.hypot(x, z + 6));
          }
        }
      }
    }
    section('base'); section('left'); section('right');
    // corner fill blocks + back walls
    for (const s of [-1, 1]) {
      for (let r = 0; r < rows; r++) {
        const y = 0.55 + r * RISE;
        stand.box('tread', s * (11.0 + r * ROW_D + 2.0), y - RISE / 2, -17.3 - r * ROW_D * 0.6 + 0.3, 4.5, RISE, ROW_D * 2.2);
      }
    }
    const topY = 0.55 + rows * RISE;
    stand.box('wall', 0, topY + 2.6, -17.3 - rows * ROW_D - 0.3, 40, 5.4, 0.4);
    for (const s of [-1, 1]) stand.box('wall', s * (11.0 + rows * ROW_D + 0.3), topY + 2.6, -4.5, 0.4, 5.4, 30);
    // front rails / LED ribbon fascia
    stand.box('fascia', 0, 0.55, -16.8, 30, 1.1, 0.25);
    for (const s of [-1, 1]) stand.box('fascia', s * 10.45, 0.55, -4.5, 0.25, 1.1, 24);
    const standMat = { tread: std({ color: '#2a2629', roughness: 0.92 }), riser: std({ color: '#3d1220', roughness: 0.85 }), wall: std({ color: '#1b171b', roughness: 0.95 }), fascia: std({ color: '#100d10', roughness: 0.6 }) };
    stand.build(standMat, group);
    // seats (instanced): pan + back, alternating maroon / grey blocks
    const seatGeo = (() => {
      const b = new Builder(); b.box('s', 0, 0.44, -0.02, 0.46, 0.06, 0.42); b.box('s', 0, 0.72, -0.24, 0.46, 0.5, 0.05); b.box('s', 0, 0.22, -0.05, 0.08, 0.42, 0.08);
      const P = b.get('s'); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(P.n, 3)); return g;
    })();
    const seatMesh = new T.InstancedMesh(seatGeo, std({ color: '#ffffff', roughness: 0.6 }), seats.length);
    const dm = new T.Object3D(), cA = lin('#6e1230'), cB = lin('#3a363a'), cG = lin('#8f7444');
    seats.forEach((s, i) => {
      dm.position.set(s.x, s.y, s.z); dm.rotation.set(0, s.yaw, 0); dm.updateMatrix(); seatMesh.setMatrixAt(i, dm.matrix);
      const band = Math.floor((s.y - 0.55) / RISE + 0.01);
      seatMesh.setColorAt(i, band === 6 ? cG : (band < 6 ? cA : cB));
    });
    seatMesh.instanceMatrix.needsUpdate = true; seatMesh.instanceColor.needsUpdate = true; seatMesh.receiveShadow = true; group.add(seatMesh);
    disposables.push(seatGeo);

    // LED ribbon boards (fascia faces), animated scroll
    const ribbonCanvas = canvas(2048, 128), rctx = ribbonCanvas.getContext('2d');
    const ribbonTex = new T.CanvasTexture(ribbonCanvas); ribbonTex.encoding = T.sRGBEncoding; ribbonTex.wrapS = T.RepeatWrapping; disposables.push(ribbonTex);
    function drawRibbon(mode) {
      const x = rctx, w = 2048, h = 128;
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5b0e27'); g.addColorStop(1, '#8a1538');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 2, h);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      const items = mode === 'make' ? ['سلّة!', '+٢', 'أحسنت', 'سلّة!'] : ['مدرسة أبو عبيدة الإعدادية للبنين', 'منصة التعلّم التفاعلي والألعاب التعليمية'];
      x.font = `700 ${mode === 'make' ? 84 : 58}px ${FONT}`;
      items.forEach((s, i) => { x.fillStyle = i % 2 ? '#f3dfb5' : '#ffffff'; x.fillText(s, w * (i + 0.5) / items.length, h / 2 + 4); });
      ribbonTex.needsUpdate = true;
    }
    let ribbonMode = 'idle'; drawRibbon('idle');
    const ribbonMat = new T.MeshBasicMaterial({ map: ribbonTex, toneMapped: false }); disposables.push(ribbonMat);
    const rb1 = new T.Mesh(new T.PlaneGeometry(30, 0.8), ribbonMat); rb1.position.set(0, 0.62, -16.67); group.add(rb1);
    for (const s of [-1, 1]) { const rb = new T.Mesh(new T.PlaneGeometry(24, 0.8), ribbonMat); rb.position.set(s * 10.32, 0.62, -4.5); rb.rotation.y = -s * Math.PI / 2; group.add(rb); }

    // ---------- end-wall scoreboard ----------
    const sbCanvas = canvas(1024, 384), sbTex = new T.CanvasTexture(sbCanvas); sbTex.encoding = T.sRGBEncoding; disposables.push(sbTex);
    const sbMat = new T.MeshBasicMaterial({ map: sbTex, toneMapped: false }); disposables.push(sbMat);
    const sb = new T.Group(); sb.position.set(0, topY + 4.0, -17.3 - rows * ROW_D - 0.05); group.add(sb);
    const sbFrame = new T.Mesh(new T.BoxGeometry(10.6, 4.2, 0.5), std({ color: '#0d0b0d', roughness: 0.5 })); sbFrame.position.z = -0.2; sb.add(sbFrame);
    const sbScreen = new T.Mesh(new T.PlaneGeometry(10, 3.75), sbMat); sbScreen.position.z = 0.06; sb.add(sbScreen);
    function scoreboard(s) {
      const x = sbCanvas.getContext('2d'), w = 1024, h = 384;
      x.fillStyle = '#07080a'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#12161b'; for (let i = 0; i < w; i += 4) x.fillRect(i, 0, 1, h);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.fillStyle = MAROON; x.fillRect(560, 40, 420, 70); x.fillStyle = '#e9e6df'; x.fillRect(44, 40, 420, 70);
      x.font = `700 40px ${FONT}`; x.fillStyle = '#fff'; x.fillText('أبو عبيدة', 770, 78); x.fillStyle = '#1d2b3b'; x.fillText('الضيوف', 254, 78);
      x.font = `800 150px ${FONT}`; x.fillStyle = '#ffd98a'; x.fillText(String(s.home ?? 0), 770, 220); x.fillStyle = '#ffffff'; x.fillText(String(s.away ?? 0), 254, 220);
      x.font = `600 38px ${FONT}`; x.fillStyle = '#c9c5bd';
      x.fillText(s.label || '', w / 2, 340);
      x.fillStyle = s.flash ? '#ffd98a' : '#3a3f45'; x.fillRect(w / 2 - 6, 150, 12, 12); x.fillRect(w / 2 - 6, 200, 12, 12);
      sbTex.needsUpdate = true;
    }
    scoreboard({ home: 0, away: 0, label: 'التحدّي التعليمي' });

    // ---------- premium details: glass suites band + hanging banners ----------
    const suiteTex = textCanvas(2048, 128, (x, w, h) => {
      x.fillStyle = '#0c0a0d'; x.fillRect(0, 0, w, h);
      const r = rng(55);
      for (let i = 0; i < 64; i++) {
        const x0 = i * 32 + 2, lit = r() < 0.82;
        const g = x.createLinearGradient(0, 10, 0, h - 10);
        g.addColorStop(0, lit ? `rgba(255,${206 + r() * 30 | 0},${150 + r() * 40 | 0},0.92)` : 'rgba(40,36,44,0.9)');
        g.addColorStop(1, lit ? 'rgba(160,110,70,0.85)' : 'rgba(20,18,22,0.9)');
        x.fillStyle = g; x.fillRect(x0, 12, 28, h - 24);
        if (lit && r() < 0.6) { x.fillStyle = 'rgba(20,12,10,0.55)'; const px = x0 + 4 + r() * 14; x.beginPath(); x.ellipse(px + 4, h - 30, 6, 14, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(px + 4, h - 50, 5, 0, Math.PI * 2); x.fill(); }
      }
      x.fillStyle = '#2a0711'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
    });
    disposables.push(suiteTex);
    const suiteMat = new T.MeshBasicMaterial({ map: suiteTex, toneMapped: true, color: lin('#c9bfb6') }); disposables.push(suiteMat);
    const suiteY = topY + 1.15, backZ = -17.3 - rows * ROW_D - 0.08;
    const suiteBack = new T.Mesh(new T.PlaneGeometry(34, 1.5), suiteMat); suiteBack.position.set(0, suiteY, backZ); group.add(suiteBack);
    for (const sd of [-1, 1]) { const sw = new T.Mesh(new T.PlaneGeometry(28, 1.5), suiteMat); sw.position.set(sd * (11.0 + rows * ROW_D + 0.08), suiteY, -4.5); sw.rotation.y = -sd * Math.PI / 2; group.add(sw); }
    const bannerTex = textCanvas(256, 640, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#5f0f28'); g.addColorStop(0.5, '#8a1538'); g.addColorStop(1, '#6a1130');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      // white band with nine serrations (decorative, not an official emblem)
      x.fillStyle = '#f7f3ee'; x.beginPath(); x.moveTo(0, 0); x.lineTo(70, 0);
      for (let i = 0; i < 9; i++) { const y0 = i * (h - 60) / 9, y1 = (i + 0.5) * (h - 60) / 9, y2 = (i + 1) * (h - 60) / 9; x.lineTo(96, y1); x.lineTo(70, y2); }
      x.lineTo(70, h); x.lineTo(0, h); x.closePath(); x.fill();
      x.fillStyle = '#d6b36a'; x.fillRect(0, h - 60, w, 6); x.fillRect(0, 0, w, 4);
      x.beginPath(); x.moveTo(0, h - 54); x.lineTo(w / 2, h); x.lineTo(w, h - 54); x.closePath(); x.fillStyle = '#5f0f28'; x.fill();
    });
    disposables.push(bannerTex);
    const bannerMat = std({ map: bannerTex, roughness: 0.85, side: T.DoubleSide });
    for (const bx of [-12.5, -9.0, 9.0, 12.5]) { const b = new T.Mesh(new T.PlaneGeometry(1.5, 3.75), bannerMat); b.position.set(bx, topY + 4.6, backZ + 0.6); group.add(b); }

    // ---------- roof, light grid, catwalk ----------
    const roofY = topY + 9;
    const roof = new T.Mesh(new T.PlaneGeometry(70, 70), std({ color: '#121014', roughness: 1 })); roof.rotation.x = Math.PI / 2; roof.position.set(0, roofY, -6); group.add(roof);
    const truss = new Builder();
    for (let z = -26; z <= 12; z += 4) truss.box('t', 0, roofY - 1.2, z, 44, 0.18, 0.18);
    for (let x = -20; x <= 20; x += 5) truss.box('t', x, roofY - 1.0, -7, 0.14, 0.14, 40);
    truss.build({ t: std({ color: '#2c2a2e', roughness: 0.7, metalness: 0.4 }) }, group, { cast: false, receive: false });
    const lampGeo = new T.BoxGeometry(1.4, 0.12, 0.7), lampMat = new T.MeshBasicMaterial({ color: lin('#fff7e8'), toneMapped: false }); disposables.push(lampGeo, lampMat);
    const lampPos = []; for (let z = -24; z <= 8; z += 4) for (let x = -12; x <= 12; x += 4) lampPos.push([x, z]);
    const lamps = new T.InstancedMesh(lampGeo, lampMat, lampPos.length);
    lampPos.forEach(([x, z], i) => { dm.position.set(x, roofY - 1.35, z); dm.rotation.set(0, 0, 0); dm.updateMatrix(); lamps.setMatrixAt(i, dm.matrix); });
    group.add(lamps);

    // ---------- courtside: benches, scorer's table, ball cart ----------
    const cs = new Builder();
    for (const zc of [-9.5, -5.5]) { cs.box('bench', -9.6, 0.23, zc, 0.5, 0.06, 3.4); for (let k = 0; k < 6; k++) cs.box('chair', -9.62, 0.5, zc - 1.4 + k * 0.56, 0.45, 0.5, 0.06, 0); }
    cs.box('table', 9.4, 0.45, -1.5, 0.8, 0.9, 6); cs.box('tableTop', 9.4, 0.92, -1.5, 0.9, 0.05, 6.1);
    // ball cart frame
    const cart = { x: 4.6, z: -14.9 };
    cs.box('cart', cart.x, 0.5, cart.z, 0.9, 0.04, 0.5); cs.box('cart', cart.x, 0.9, cart.z, 0.9, 0.04, 0.5);
    for (const [dx, dz] of [[-.43, -.23], [.43, -.23], [-.43, .23], [.43, .23]]) cs.box('cart', cart.x + dx, 0.5, cart.z + dz, 0.03, 1.0, 0.03);
    cs.build({ bench: std({ color: '#1f2226', roughness: 0.6 }), chair: std({ color: MAROON, roughness: 0.6 }), table: std({ color: '#141216', roughness: 0.5 }), tableTop: std({ color: '#d9d4cb', roughness: 0.4 }), cart: std({ color: '#2b3036', roughness: 0.4, metalness: 0.6 }) }, group, { cast: true, receive: true });
    const tableTex = textCanvas(1024, 128, (x, w, h) => { x.fillStyle = '#5b0e27'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.font = `700 64px ${FONT}`; x.fillText('طاولة التسجيل', w / 2, h / 2 + 4); });
    disposables.push(tableTex);
    const tableFace = new T.Mesh(new T.PlaneGeometry(5.6, 0.7), new T.MeshBasicMaterial({ map: tableTex, toneMapped: false })); tableFace.position.set(8.98, 0.5, -1.5); tableFace.rotation.y = -Math.PI / 2; group.add(tableFace);

    return {
      group, seats, cart, floorMat, ribbon: { set: m => { if (m !== ribbonMode) { ribbonMode = m; drawRibbon(m); } }, tex: ribbonTex },
      scoreboard, rim, hoopGroup: hoop, roofY, topY,
      update(dt) { ribbonTex.offset.x = (ribbonTex.offset.x + dt * 0.035) % 1; },
      dispose() { group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); disposables.forEach(d => d.dispose && d.dispose()); }
    };
  }

  root.BasketballArena = { build, Builder };
})(typeof window !== 'undefined' ? window : globalThis);
