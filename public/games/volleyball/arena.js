/* الكرة الطائرة V24 — indoor arena.
 *
 * FIVB-dimension court (18 × 9 m, 5 cm lines, attack lines with dashed extensions), 2.43 m men's net
 * that deforms where the ball strikes it, padded posts, antennas, scorer's table, team benches,
 * electronic scoreboards, animated LED perimeter boards, stepped stands with an instanced, responsive
 * crowd, roof lighting and an image-based environment for floor reflections.
 * Everything is generated in code (canvas textures and primitives): no downloaded assets.
 */
(function () {
  'use strict';
  const T = THREE;
  const VR = typeof VolleyRally !== 'undefined' ? VolleyRally : window.VolleyRally;
  const C = VR.COURT;
  const SCHOOL = 'مدرسة أبو عبيدة الإعدادية للبنين';
  const MAROON = '#8a1538';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  function canvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function texFrom(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
    if (!c) return null;
    const t = new T.CanvasTexture(c);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  function box(w, h, d, mat, x, y, z, parent) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }

  // ───────── floor (court + free zone) ─────────
  function floorTexture(pxPerM) {
    const W = 22, L = 30, c = canvas(Math.round(W * pxPerM), Math.round(L * pxPerM));
    if (!c) return null;
    const x = c.getContext('2d');
    if (!x.fillRect) return texFrom(c);
    const X = (m) => (m + W / 2) * pxPerM, Z = (m) => (m + L / 2) * pxPerM, S = (m) => m * pxPerM;
    const rnd = VR.rng(777);
    // Free zone: deep maroon sports surface.
    x.fillStyle = '#4e0a22'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${0.012 + rnd() * 0.02})`; x.fillRect(rnd() * c.width, rnd() * c.height, S(0.6 + rnd() * 2), 1); }
    // Playing court: maple-toned boards running lengthwise.
    const cx0 = X(-C.halfWidth), cz0 = Z(-C.halfLength), cw = S(2 * C.halfWidth), cl = S(2 * C.halfLength);
    x.fillStyle = '#d8a066'; x.fillRect(cx0, cz0, cw, cl);
    const board = S(0.075);
    for (let i = 0; i * board < cw; i++) {
      x.fillStyle = `rgba(${120 + rnd() * 40},${60 + rnd() * 30},${20 + rnd() * 20},${0.05 + rnd() * 0.08})`;
      x.fillRect(cx0 + i * board, cz0, board - 1, cl);
      let z = cz0 - rnd() * S(2);
      while (z < cz0 + cl) { const seg = S(1.2 + rnd() * 2.4); x.fillStyle = 'rgba(70,35,15,0.18)'; x.fillRect(cx0 + i * board, Math.max(cz0, z), board, 1); z += seg; }
    }
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(90,45,15,${rnd() * 0.07})`; x.fillRect(cx0 + rnd() * cw, cz0 + rnd() * cl, 1, S(0.2 + rnd() * 0.6)); }
    // Lines (5 cm, white). Lines are part of the court: outer edges at ±4.5 and ±9.
    x.fillStyle = '#fbfaf6';
    const lw = S(C.lineWidth);
    x.fillRect(X(-C.halfWidth), Z(-C.halfLength), lw, cl);
    x.fillRect(X(C.halfWidth) - lw, Z(-C.halfLength), lw, cl);
    x.fillRect(X(-C.halfWidth), Z(-C.halfLength), cw, lw);
    x.fillRect(X(-C.halfWidth), Z(C.halfLength) - lw, cw, lw);
    x.fillRect(X(-C.halfWidth), Z(0) - lw / 2, cw, lw); // centre line under the net
    for (const sgn of [-1, 1]) {
      // Attack lines: rear edge 3 m from the centre line axis.
      const zr = sgn * C.attackLine;
      x.fillRect(X(-C.halfWidth), sgn > 0 ? Z(zr) - lw : Z(zr), cw, lw);
      // Dashed extensions: five 15 cm dashes, 20 cm apart, beyond each sideline.
      for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
        const x0 = side > 0 ? C.halfWidth + 0.2 + k * 0.35 : -C.halfWidth - 0.35 - k * 0.35;
        x.fillRect(X(x0), sgn > 0 ? Z(zr) - lw : Z(zr), S(0.15), lw);
      }
      // Service-zone marks behind the end lines.
      for (const side of [-1, 1]) x.fillRect(side > 0 ? X(C.halfWidth) - lw : X(-C.halfWidth), sgn > 0 ? Z(9.2) : Z(-9.35), lw, S(0.15));
    }
    // School identity in the free zone behind both end lines and along a sideline.
    x.save();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.78)';
    x.font = `bold ${Math.round(S(0.62))}px Tahoma, Arial, sans-serif`;
    x.fillText(SCHOOL, X(0), Z(12.2));
    x.save(); x.translate(X(0), Z(-12.2)); x.rotate(Math.PI); x.fillText(SCHOOL, 0, 0); x.restore();
    x.font = `bold ${Math.round(S(0.5))}px Tahoma, Arial, sans-serif`;
    x.fillStyle = 'rgba(255,255,255,0.5)';
    x.save(); x.translate(X(7.4), Z(0)); x.rotate(-Math.PI / 2); x.fillText('الكرة الطائرة · منصة ألعاب أبو عبيدة', 0, 0); x.restore();
    // A simple original roundel logo at both service areas.
    for (const z of [11.0, -11.0]) {
      x.beginPath(); x.arc(X(-7.6), Z(z), S(0.7), 0, Math.PI * 2); x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = S(0.06); x.stroke();
      x.beginPath(); x.arc(X(-7.6), Z(z), S(0.42), 0, Math.PI * 2); x.stroke();
    }
    x.restore();
    return texFrom(c, { aniso: 16 });
  }

  // ───────── LED boards and scoreboard canvases ─────────
  function ledCanvas() {
    const c = canvas(2048, 64);
    if (!c) return null;
    const x = c.getContext('2d');
    if (!x.fillRect) return c;
    const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#2a0712'); g.addColorStop(1, '#0d0206');
    x.fillStyle = g; x.fillRect(0, 0, 2048, 64);
    x.textBaseline = 'middle'; x.textAlign = 'center';
    const items = [SCHOOL, 'الكرة الطائرة', 'روح الفريق · احترام · تعلّم', 'منصة ألعاب أبو عبيدة'];
    items.forEach((s, i) => {
      const cx = 256 + i * 512;
      x.fillStyle = i % 2 ? '#ffffff' : '#ffd9a8';
      x.font = 'bold 34px Tahoma, Arial, sans-serif';
      x.fillText(s, cx, 34);
      x.fillStyle = MAROON; x.fillRect(cx + 240, 8, 6, 48);
    });
    for (let i = 0; i < 2048; i += 4) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i, 0, 1, 64); }
    return c;
  }
  function drawScoreboard(c, s) {
    if (!c) return;
    const x = c.getContext('2d');
    if (!x.fillRect) return;
    const W = c.width, H = c.height;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1420'); g.addColorStop(1, '#05080d');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = s.flash ? `rgba(138,21,56,${0.35 * s.flash})` : 'rgba(0,0,0,0)'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#8a1538'; x.lineWidth = 10; x.strokeRect(5, 5, W - 10, H - 10);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ffffff'; x.font = 'bold 40px Tahoma, Arial, sans-serif'; x.fillText(SCHOOL, W / 2, 46);
    x.fillStyle = '#d9c39a'; x.font = 'bold 30px Tahoma, Arial, sans-serif'; x.fillText(`الكرة الطائرة · ${s.mode || 'مباراة'}`, W / 2, 92);
    const panel = (cx, name, score, color, serving) => {
      x.fillStyle = color; x.fillRect(cx - 210, 128, 420, 230);
      x.fillStyle = '#ffffff'; x.font = 'bold 40px Tahoma, Arial, sans-serif'; x.fillText(name, cx, 166);
      x.font = 'bold 150px Arial, sans-serif'; x.fillText(String(score), cx, 280);
      if (serving) { x.beginPath(); x.arc(cx + 180, 166, 13, 0, Math.PI * 2); x.fillStyle = '#ffd36b'; x.fill(); }
    };
    // RTL: the student's team on the right.
    panel(W - 260, 'أبو عبيدة', s.home ?? 0, '#8a1538', s.serving === 'home');
    panel(260, 'المنافس', s.away ?? 0, '#1d3f66', s.serving === 'away');
    x.fillStyle = '#ffffff'; x.font = 'bold 34px Tahoma, Arial, sans-serif';
    x.fillText(`الجولة ${s.round ?? 1} / ${s.total ?? 1}`, W / 2, 215);
    x.fillStyle = s.status === 'review' ? '#ffd36b' : '#9fb3c8'; x.font = 'bold 28px Tahoma, Arial, sans-serif';
    x.fillText(s.statusText || '', W / 2, 290);
  }

  // ───────── crowd ─────────
  function makeCrowd(parent, seats, count, rnd) {
    const bodyG = new T.LatheGeometry([[0, 0], [0.18, 0.03], [0.2, 0.3], [0.17, 0.5], [0.07, 0.6], [0, 0.6]].map(([r, y]) => new T.Vector2(r, y)), 7);
    const headG = new T.SphereGeometry(0.1, 7, 5);
    const armG = new T.BoxGeometry(0.06, 0.5, 0.06); armG.translate(0, 0.25, 0);
    const mat = new T.MeshStandardMaterial({ roughness: 0.9 });
    const hmat = new T.MeshStandardMaterial({ roughness: 0.75 });
    const n = Math.min(count, seats.length);
    const bodies = new T.InstancedMesh(bodyG, mat, n), heads = new T.InstancedMesh(headG, hmat, n), arms = new T.InstancedMesh(armG, mat, n * 2);
    bodies.castShadow = false; bodies.receiveShadow = true;
    const skins = ['#8a5a3c', '#b07650', '#c99068', '#6a4331', '#d2a27d', '#7c4b33', '#5b3a29'].map((c) => new T.Color(c));
    const homeCols = ['#8a1538', '#8a1538', '#ffffff', '#a3214b', '#f2e8e0', '#6d0f2c'].map((c) => new T.Color(c));
    const awayCols = ['#1d3f66', '#ffffff', '#2b5d92', '#d9dde3'].map((c) => new T.Color(c));
    const neutral = ['#3a4a5c', '#d9d2c3', '#2f3b2f', '#6b5a4a', '#c9c2b2', '#46344f', '#e5e1d8', '#8a1538'].map((c) => new T.Color(c));
    // Shuffle seats deterministically, then fill.
    const order = seats.map((s, i) => [rnd(), i]).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, i]) => seats[i]);
    const people = order.map((s, i) => {
      const team = s.section === 'away' ? 'away' : s.section === 'home' ? 'home' : 'neutral';
      const pal = team === 'home' ? homeCols : team === 'away' ? awayCols : neutral;
      const col = pal[Math.floor(rnd() * pal.length)];
      bodies.setColorAt(i, col); heads.setColorAt(i, skins[Math.floor(rnd() * skins.length)]);
      arms.setColorAt(i * 2, col); arms.setColorAt(i * 2 + 1, col);
      return { ...s, team, phase: rnd() * Math.PI * 2, energy: 0.6 + rnd() * 0.8, scale: 0.9 + rnd() * 0.2, delay: rnd() * 0.35 };
    });
    [bodies, heads, arms].forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; parent.add(m); });
    const M = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), Sc = new T.Vector3(), E = new T.Euler();
    const mood = { home: 0, away: 0, tension: 0, wave: 0 };
    let tick = 0;
    function update(t, dt, every = 1) {
      for (const k of ['home', 'away']) mood[k] = Math.max(0, mood[k] - dt * 0.28);
      if (++tick % every) return;
      people.forEach((p, i) => {
        const fan = p.team === 'neutral' ? Math.max(mood.home, mood.away) * 0.6 : mood[p.team];
        const gloom = p.team === 'home' ? mood.away : p.team === 'away' ? mood.home : 0;
        const excite = clamp(fan * p.energy - p.delay * 0.4);
        // Mexican wave around the arena during the intro.
        const ang = Math.atan2(p.x, p.z);
        const wave = mood.wave > 0 ? Math.max(0, Math.cos(ang * 1 - t * 2.2)) ** 12 * mood.wave : 0;
        const stand = clamp(Math.max(excite > 0.35 ? excite : 0, wave));
        const bounce = stand > 0 ? Math.abs(Math.sin(t * (7 + p.energy * 2) + p.phase)) * 0.13 * stand : 0;
        const sway = Math.sin(t * (1.1 + mood.tension * 2.5) + p.phase) * (0.02 + mood.tension * 0.03);
        const y = p.y + stand * 0.42 + bounce - gloom * 0.03;
        P.set(p.x + sway * Math.cos(p.yaw), y, p.z - sway * Math.sin(p.yaw));
        Q.setFromEuler(E.set(gloom * 0.25, p.yaw + sway * 0.5, 0));
        Sc.set(p.scale, p.scale * (1 - gloom * 0.06), p.scale);
        M.compose(P, Q, Sc); bodies.setMatrixAt(i, M);
        P.y += 0.68 * p.scale; Sc.setScalar(p.scale);
        M.compose(P, Q, Sc); heads.setMatrixAt(i, M);
        // Arms raised when cheering; otherwise tucked (scaled away).
        const raise = clamp((stand - 0.25) * 1.6);
        for (const sd of [-1, 1]) {
          const ax = p.x + Math.cos(p.yaw) * 0.17 * sd, az = p.z - Math.sin(p.yaw) * 0.17 * sd;
          P.set(ax, y + 0.48 * p.scale, az);
          Q.setFromEuler(E.set(0, p.yaw, sd * (0.25 + 0.2 * Math.sin(t * 9 + p.phase))));
          Sc.set(1, raise < 0.02 ? 0.001 : raise, 1);
          M.compose(P, Q, Sc); arms.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), M);
        }
      });
      bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = arms.instanceMatrix.needsUpdate = true;
    }
    update(0, 0);
    return {
      update, mood, count: n,
      dispose() { [bodies, heads, arms].forEach((m) => { m.geometry.dispose(); m.dispose?.(); }); mat.dispose(); hmat.dispose(); },
      snapshot: () => ({ count: n, standing: people.filter((p) => mood[p.team] > 0.4).length, home: mood.home, away: mood.away }),
    };
  }

  // ───────── main ─────────
  function create(scene, renderer, opts = {}) {
    const q = opts.quality || 'medium', rnd = VR.rng(2024);
    const root = new T.Group(); root.name = 'arena'; scene.add(root);
    const disposables = [];
    const own = (x) => { disposables.push(x); return x; };
    const std = (o) => own(new T.MeshStandardMaterial(o));

    // Hall: walls, roof, trusses and light fixtures.
    const hallMat = std({ color: '#121a24', roughness: 0.95, side: T.BackSide });
    const hall = new T.Mesh(own(new T.BoxGeometry(56, 24, 64)), hallMat); hall.position.y = 11.5; root.add(hall);
    const truss = std({ color: '#2c3644', roughness: 0.6, metalness: 0.5 });
    for (let z = -20; z <= 20; z += 5) box(40, 0.25, 0.25, truss, 0, 17.6, z, root).castShadow = false;
    for (const x of [-12, -4, 4, 12]) box(0.25, 0.25, 44, truss, x, 17.4, 0, root).castShadow = false;
    const lampMat = own(new T.MeshBasicMaterial({ color: '#fff6e8' }));
    for (const x of [-6.5, -2.2, 2.2, 6.5]) for (let z = -12; z <= 12; z += 4) {
      const m = new T.Mesh(own(new T.BoxGeometry(1.2, 0.08, 0.6)), lampMat); m.position.set(x, 17.2, z); root.add(m);
    }
    // Floors.
    const outer = new T.Mesh(own(new T.PlaneGeometry(56, 64)), std({ color: '#1d242c', roughness: 0.9 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.002; outer.receiveShadow = true; root.add(outer);
    const ft = own(floorTexture(q === 'low' ? 28 : q === 'high' ? 72 : 48));
    const floorMat = own(new T.MeshPhysicalMaterial({ map: ft, color: ft ? '#ffffff' : '#c98e58', roughness: 0.42, metalness: 0, clearcoat: q === 'low' ? 0 : 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.65 }));
    const floor = new T.Mesh(own(new T.PlaneGeometry(22, 30)), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);

    // Net, bands, antennas, posts, cables.
    const netGroup = new T.Group(); root.add(netGroup);
    const netW = 2 * C.netHalfWidth, nx = q === 'low' ? 50 : 99, ny = 10;
    const netGeo = own(new T.PlaneGeometry(netW, C.netTop - C.netBottom, nx, ny));
    netGeo.translate(0, (C.netTop + C.netBottom) / 2, 0);
    const netBase = Float32Array.from(netGeo.attributes.position.array);
    const nc = canvas(64, 64);
    let netTex = null;
    if (nc) {
      const x = nc.getContext('2d');
      if (x.fillRect) { x.clearRect(0, 0, 64, 64); x.fillStyle = '#0e0f12'; x.fillRect(0, 0, 64, 6); x.fillRect(0, 0, 6, 64); }
      netTex = own(texFrom(nc, { srgb: true, repeat: [netW / 0.1, 10], aniso: 4 }));
    }
    const netMat = std({ color: netTex ? '#ffffff' : '#111', map: netTex, alphaMap: null, transparent: false, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.8 });
    if (netTex) { netMat.alphaMap = netTex; netMat.map = null; netMat.color.set('#121316'); }
    const net = new T.Mesh(netGeo, netMat); net.castShadow = true; netGroup.add(net);
    const white = std({ color: '#f4f2ec', roughness: 0.55 });
    const topBand = box(netW, 0.07, 0.012, white, 0, C.netTop - 0.035, 0, netGroup);
    box(netW, 0.05, 0.01, white, 0, C.netBottom + 0.025, 0, netGroup);
    for (const s of [-1, 1]) box(0.05, C.netTop - C.netBottom, 0.014, white, s * (C.halfWidth - 0.025), (C.netTop + C.netBottom) / 2, 0, netGroup);
    const antC = canvas(8, 64);
    let antTex = null;
    if (antC) { const x = antC.getContext('2d'); if (x.fillRect) for (let i = 0; i < 18; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#d51e2b'; x.fillRect(0, i * 64 / 18, 8, 64 / 18); } antTex = own(texFrom(antC, { aniso: 1 })); }
    const antMat = std({ map: antTex, color: antTex ? '#ffffff' : '#d51e2b', roughness: 0.4 });
    for (const s of [-1, 1]) {
      const a = new T.Mesh(own(new T.CylinderGeometry(0.005, 0.005, 1.8, 8)), antMat);
      a.position.set(s * (C.halfWidth + 0.005), C.netBottom + 0.9, 0); netGroup.add(a);
    }
    const postMat = std({ color: '#7a8794', roughness: 0.3, metalness: 0.8 });
    const padC = canvas(256, 512);
    if (padC) { const x = padC.getContext('2d'); if (x.fillRect) { x.fillStyle = MAROON; x.fillRect(0, 0, 256, 512); x.fillStyle = '#fff'; x.save(); x.translate(128, 256); x.rotate(-Math.PI / 2); x.font = 'bold 54px Tahoma, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('أبو عبيدة', 0, 0); x.restore(); } }
    const padMat = std({ map: own(texFrom(padC)), color: padC ? '#ffffff' : MAROON, roughness: 0.75 });
    for (const s of [-1, 1]) {
      const post = new T.Mesh(own(new T.CylinderGeometry(0.055, 0.055, 2.56, 16)), postMat); post.position.set(s * C.postX, 1.28, 0); post.castShadow = true; netGroup.add(post);
      const pad = new T.Mesh(own(new T.CylinderGeometry(0.17, 0.17, 1.95, 24)), padMat); pad.position.set(s * C.postX, 0.975, 0); pad.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; pad.castShadow = true; netGroup.add(pad);
      const base = new T.Mesh(own(new T.CylinderGeometry(0.32, 0.36, 0.06, 24)), postMat); base.position.set(s * C.postX, 0.03, 0); netGroup.add(base);
      const cable = new T.Mesh(own(new T.CylinderGeometry(0.004, 0.004, C.postX - C.netHalfWidth, 6)), postMat);
      cable.rotation.z = Math.PI / 2; cable.position.set(s * (C.netHalfWidth + (C.postX - C.netHalfWidth) / 2), C.netTop - 0.02, 0); netGroup.add(cable);
    }

    // Scorer's table and team benches (second-referee side, x < 0).
    const furn = std({ color: '#232c37', roughness: 0.6 });
    const tblC = canvas(1024, 160);
    if (tblC) { const x = tblC.getContext('2d'); if (x.fillRect) { x.fillStyle = '#12080c'; x.fillRect(0, 0, 1024, 160); x.fillStyle = MAROON; x.fillRect(0, 0, 1024, 14); x.fillRect(0, 146, 1024, 14); x.fillStyle = '#fff'; x.font = 'bold 54px Tahoma, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('طاولة التسجيل · ' + SCHOOL, 512, 82); } }
    const tbl = new T.Group(); tbl.position.set(-8.0, 0, 0); root.add(tbl);
    box(0.75, 0.04, 3.4, furn, 0, 0.76, 0, tbl);
    const front = new T.Mesh(own(new T.PlaneGeometry(3.4, 0.7)), own(new T.MeshBasicMaterial({ map: own(texFrom(tblC)), color: tblC ? '#ffffff' : '#3a0a18' })));
    front.position.set(0.38, 0.4, 0); front.rotation.y = Math.PI / 2; tbl.add(front);
    for (const z of [-1, 0, 1]) { box(0.45, 0.45, 0.45, furn, -0.55, 0.23, z, tbl); box(0.06, 0.3, 0.2, std({ color: '#0b0f14', roughness: 0.3, metalness: 0.4 }), 0.1, 0.92, z, tbl); }
    const benchMat = std({ color: '#3b4654', roughness: 0.6 });
    for (const s of [-1, 1]) {
      box(0.5, 0.45, 4.2, benchMat, -8.3, 0.225, s * 5.4, root);
      box(0.08, 0.5, 4.2, benchMat, -8.55, 0.7, s * 5.4, root);
    }
    // Substitutes and coaches: low-poly seated figures in team colours.
    const subG = own(new T.LatheGeometry([[0, 0], [0.17, 0.02], [0.2, 0.3], [0.18, 0.5], [0.06, 0.58], [0, 0.6]].map(([r, y]) => new T.Vector2(r, y)), 12));
    const headG = own(new T.SphereGeometry(0.1, 12, 10));
    const skin = std({ color: '#9a6644', roughness: 0.6 });
    const subs = [];
    for (const [team, s] of [['home', 1], ['away', -1]]) {
      const jm = std({ color: team === 'home' ? MAROON : '#e9edf2', roughness: 0.8 });
      for (let i = 0; i < 4; i++) {
        const g = new T.Group(); g.position.set(-8.25, 0.45, s * (3.8 + i * 1.0)); g.rotation.y = Math.PI / 2;
        const b = new T.Mesh(subG, jm); b.castShadow = true; g.add(b);
        const h = new T.Mesh(headG, skin); h.position.y = 0.72; g.add(h);
        root.add(g); subs.push({ g, team, phase: rnd() * 6 });
      }
      const coach = new T.Group(); coach.position.set(-7.4, 0, s * 7.9); coach.rotation.y = Math.PI / 2 + s * 0.3;
      const cb = new T.Mesh(subG, std({ color: '#1b1f26', roughness: 0.7 })); cb.scale.set(1, 2.4, 1); cb.castShadow = true; coach.add(cb);
      const chh = new T.Mesh(headG, skin); chh.position.y = 1.58; coach.add(chh);
      root.add(coach); subs.push({ g: coach, team, coach: true, phase: rnd() * 6 });
    }

    // LED perimeter boards.
    const led = ledCanvas();
    const ledTex = led ? own(texFrom(led, { aniso: 4 })) : null;
    if (ledTex) { ledTex.wrapS = T.RepeatWrapping; }
    const ledMat = own(new T.MeshBasicMaterial({ map: ledTex, color: ledTex ? '#ffffff' : '#5a0d22', toneMapped: false }));
    const boards = [];
    const addBoard = (w, x, z, ry) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
      box(w, 0.9, 0.18, furn, 0, 0.45, -0.1, g);
      const tx = ledTex ? ledTex.clone() : null;
      if (tx) { tx.needsUpdate = true; tx.repeat.set(w / 14, 1); own(tx); }
      const m = new T.Mesh(own(new T.PlaneGeometry(w, 0.8)), own(new T.MeshBasicMaterial({ map: tx, color: '#ffffff', toneMapped: false })));
      m.position.set(0, 0.45, 0.001); g.add(m); boards.push({ m, tx, speed: 0.012 + boards.length * 0.002 });
    };
    addBoard(28, 10.2, 0, -Math.PI / 2); addBoard(28, -10.2, 0, Math.PI / 2);
    addBoard(20, 0, -15.2, 0); addBoard(20, 0, 15.2, Math.PI);
    void ledMat;

    // Stands with seats (both sides and both ends), recorded for the crowd.
    const standMat = std({ color: '#262f3a', roughness: 0.85 });
    const seatMat = std({ color: '#5e0f27', roughness: 0.7 });
    const seats = [];
    const rows = q === 'low' ? 6 : 9;
    const seatG = own(new T.BoxGeometry(0.46, 0.1, 0.42));
    const seatPositions = [];
    const addStand = (axis, sgn, from, to, startD) => {
      for (let r = 0; r < rows; r++) {
        const d = startD + r * 0.85, y = 0.55 + r * 0.42;
        const len = to - from;
        if (axis === 'x') box(0.85, y, len, standMat, sgn * (d + 0.42), y / 2, (from + to) / 2, root);
        else box(len, y, 0.85, standMat, (from + to) / 2, y / 2, sgn * (d + 0.42), root);
        for (let u = from + 0.3; u < to - 0.2; u += 0.55) {
          const x = axis === 'x' ? sgn * (d + 0.35) : u, z = axis === 'x' ? u : sgn * (d + 0.35);
          const yaw = axis === 'x' ? (sgn > 0 ? -Math.PI / 2 : Math.PI / 2) : (sgn > 0 ? Math.PI : 0);
          // Sections: the student's fans fill the home end and most of the sidelines; visitors one corner.
          const section = (axis === 'z' && sgn > 0) || (axis === 'x' && z > 1.5) ? 'home' : (axis === 'z' && sgn < 0 && x > 2) || (axis === 'x' && sgn < 0 && z < -6) ? 'away' : 'mixed';
          seats.push({ x, y: y + 0.05, z, yaw, section });
          seatPositions.push([x, y + 0.05, z, yaw]);
        }
      }
    };
    addStand('x', 1, -14, 14, 10.8); addStand('x', -1, -14, 14, 10.8);
    addStand('z', 1, -9.5, 9.5, 15.8); addStand('z', -1, -9.5, 9.5, 15.8);
    const seatInst = new T.InstancedMesh(seatG, seatMat, seatPositions.length);
    const M = new T.Matrix4(), Qn = new T.Quaternion(), E = new T.Euler();
    seatPositions.forEach(([x, y, z, yaw], i) => { M.compose(new T.Vector3(x, y, z), Qn.setFromEuler(E.set(0, yaw, 0)), new T.Vector3(1, 1, 1)); seatInst.setMatrixAt(i, M); });
    seatInst.receiveShadow = true; root.add(seatInst); own(seatInst);
    const crowdCount = { low: 650, medium: 1300, high: 2100 }[q] || 1300;
    const crowd = makeCrowd(root, seats, crowdCount, rnd);

    // Banners above the end stands.
    const banC = canvas(1024, 256);
    if (banC) { const x = banC.getContext('2d'); if (x.fillRect) { x.fillStyle = MAROON; x.fillRect(0, 0, 1024, 256); x.fillStyle = '#fff'; x.fillRect(0, 20, 1024, 8); x.fillRect(0, 228, 1024, 8); x.font = 'bold 76px Tahoma, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(SCHOOL, 512, 128); } }
    const banMat = std({ map: own(texFrom(banC)), color: banC ? '#ffffff' : MAROON, roughness: 0.8, side: T.DoubleSide });
    for (const [x, z, ry] of [[0, 23.0, Math.PI], [-17, 0, Math.PI / 2]]) { const b = new T.Mesh(own(new T.PlaneGeometry(12, 3)), banMat); b.position.set(x, 11.5, z); b.rotation.y = ry; root.add(b); }

    // Electronic scoreboards at both ends.
    const sbC = canvas(1024, 410);
    const sbTex = sbC ? own(texFrom(sbC, { aniso: 4 })) : null;
    const sbMat = own(new T.MeshBasicMaterial({ map: sbTex, color: sbTex ? '#ffffff' : '#0b1420', toneMapped: false }));
    const scoreboards = [];
    for (const [z, ry] of [[-22.5, 0], [22.5, Math.PI]]) {
      const g = new T.Group(); g.position.set(0, 9.2, z); g.rotation.y = ry; root.add(g);
      box(8.6, 3.8, 0.3, furn, 0, 0, -0.16, g);
      const scr = new T.Mesh(own(new T.PlaneGeometry(8.2, 3.3)), sbMat); scr.position.z = 0.001; g.add(scr);
      scoreboards.push(g);
    }
    let sbState = { home: 0, away: 0, round: 1, total: 1, serving: 'home', mode: 'مباراة', statusText: '' }, sbDirty = true, flash = 0;
    function setScore(s) { sbState = { ...sbState, ...s }; sbDirty = true; }

    // Lighting: warm key with shadows, cool fill, hemisphere bounce, plus cue lights.
    const hemi = new T.HemisphereLight('#f1eee8', '#2a1c18', 0.5); root.add(hemi);
    const key = new T.DirectionalLight('#fff3e2', q === 'low' ? 1.6 : 1.35);
    key.position.set(-6, 22, 9); key.target.position.set(0, 0, 0); root.add(key, key.target);
    if (q !== 'low') {
      key.castShadow = true;
      const ms = q === 'high' ? 2048 : 1024;
      key.shadow.mapSize.set(ms, ms);
      Object.assign(key.shadow.camera, { left: -13, right: 13, top: 15, bottom: -15, near: 4, far: 50 });
      key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    }
    const fill = new T.DirectionalLight('#cfe1ff', 0.42); fill.position.set(8, 14, -12); root.add(fill);
    const cue = new T.PointLight('#ff3366', 0, 40, 2); cue.position.set(0, 9, 4); root.add(cue);
    const spot = new T.SpotLight('#ffffff', 0, 45, 0.32, 0.6, 1.2); spot.position.set(0, 16, 8); root.add(spot, spot.target);

    // Environment map for PBR reflections (lights and boards reflect on the lacquered floor).
    if (renderer && T.PMREMGenerator) {
      try {
        const env = new T.Scene();
        env.add(new T.Mesh(new T.BoxGeometry(50, 22, 60), new T.MeshBasicMaterial({ color: '#141b25', side: T.BackSide })));
        const lm = new T.MeshBasicMaterial({ color: '#ffffff' });
        for (const x of [-6.5, -2.2, 2.2, 6.5]) for (let z = -12; z <= 12; z += 4) { const m = new T.Mesh(new T.BoxGeometry(1.4, 0.1, 0.8), lm); m.position.set(x, 10, z); env.add(m); }
        const bm = new T.MeshBasicMaterial({ color: '#7a1030' });
        for (const [x, z, w, d] of [[10, 0, 0.2, 28], [-10, 0, 0.2, 28], [0, 15, 20, 0.2], [0, -15, 20, 0.2]]) { const m = new T.Mesh(new T.BoxGeometry(w, 0.9, d), bm); m.position.set(x, -0.5, z); env.add(m); }
        const pm = new T.PMREMGenerator(renderer);
        const rt = pm.fromScene(env, 0.035);
        scene.environment = rt.texture;
        own(rt); pm.dispose();
        env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      } catch (e) { /* environment is a nicety; keep going without it */ }
    }

    // Net deformation from ball impacts (a pure function of rally time, so replays match).
    let netImpacts = [];
    function setNetImpacts(list) { netImpacts = list || []; }
    function updateNet(t) {
      const p = netGeo.attributes.position, a = p.array;
      for (let i = 0; i < p.count; i++) {
        const x = netBase[i * 3], y = netBase[i * 3 + 1];
        const pin = Math.sin(Math.PI * clamp((y - C.netBottom) / (C.netTop - C.netBottom))) ** 0.7 * (1 - clamp((Math.abs(x) - 4.6) / 0.35));
        let z = Math.sin(x * 0.9 + t * 0.8) * 0.004 * pin + 0.012 * pin; // slight sag of a tensioned net
        for (const e of netImpacts) {
          const dt = t - e.t;
          if (dt < 0 || dt > 2.5) continue;
          const g = Math.exp(-(((x - e.p[0]) / 0.55) ** 2) - (((y - e.p[1]) / 0.32) ** 2));
          z += e.dir * 0.16 * g * pin * Math.exp(-3.2 * dt) * Math.cos(11 * dt);
        }
        a[i * 3 + 2] = z;
      }
      p.needsUpdate = true;
      topBand.position.z = netImpacts.reduce((s, e) => { const dt = t - e.t; return dt < 0 || dt > 2 || !e.tape ? s : s + e.dir * 0.03 * Math.exp(-4 * dt) * Math.cos(12 * dt); }, 0);
    }

    // Light cues for points, questions and the intro.
    const cues = { point: 0, team: 'home', question: 0, intro: 0 };
    function cueLights(type, team) {
      if (type === 'point') { cues.point = 1; cues.team = team; flash = 1; crowd.mood[team] = 1; }
      if (type === 'question') cues.question = 1;
      if (type === 'resume') cues.question = 0;
      if (type === 'intro') { cues.intro = 1; crowd.mood.wave = 1; }
      if (type === 'introEnd') { cues.intro = 0; crowd.mood.wave = 0; }
      if (type === 'spike') crowd.mood.tension = 0.6;
    }
    let ledT = 0;
    function update(t, dt, ctx = {}) {
      ledT += dt;
      for (const b of boards) if (b.tx) b.tx.offset.x = (ledT * b.speed) % 1;
      cues.point = Math.max(0, cues.point - dt * 0.55);
      flash = Math.max(0, flash - dt * 0.8);
      crowd.mood.tension += ((cues.question ? 1 : 0.15) - crowd.mood.tension) * Math.min(1, dt * 1.5);
      const pulse = cues.point * (0.6 + 0.4 * Math.sin(ledT * 14));
      cue.color.set(cues.team === 'home' ? '#ff2a5c' : '#4a8bff');
      cue.intensity = pulse * 2.4;
      spot.intensity = cues.question ? 1.6 + 0.3 * Math.sin(ledT * 3) : 0;
      if (ctx.focus) { spot.target.position.set(ctx.focus[0], 0, ctx.focus[2]); spot.target.updateMatrixWorld(); }
      hemi.intensity = 0.5 - cues.question * 0.1;
      for (const b of boards) b.m.material.color.setRGB(1 + pulse * 0.3, 1 - pulse * (cues.team === 'home' ? 0.5 : 0.2), 1 - pulse * (cues.team === 'home' ? 0.3 : 0));
      if (flash > 0 || sbDirty) { drawScoreboard(sbC, { ...sbState, flash }); if (sbTex) sbTex.needsUpdate = true; sbDirty = false; }
      updateNet(t);
      crowd.update(ledT, dt, ctx.crowdEvery || 1);
      for (const s of subs) s.g.position.y = (s.coach ? 0 : 0.45) + (crowd.mood[s.team] > 0.5 ? Math.abs(Math.sin(ledT * 8 + s.phase)) * 0.25 * crowd.mood[s.team] : 0);
    }
    function dispose() {
      crowd.dispose();
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      disposables.forEach((d) => d && d.dispose && d.dispose());
      scene.remove(root);
      if (scene.environment) { scene.environment = null; }
    }
    return { root, update, setScore, cueLights, setNetImpacts, dispose, crowd, key, snapshot: () => ({ crowd: crowd.snapshot(), seats: seats.length, boards: boards.length, net: netImpacts.length }) };
  }

  window.VolleyArena = { create, SCHOOL };
})();
