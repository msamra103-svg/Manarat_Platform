/* صيد الأسماك V24 — procedural model of a 5.4 m fibreglass fishing skiff (original design).
 * Built once in the browser; tools/build-assets.cjs exports it to assets/models/boat.glb which the
 * game loads at runtime (this builder is the offline fallback). Boat frame: X = length (bow -X),
 * Y up (waterline 0), Z = beam (sea / casting side -Z).
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const SECTIONS = [[2.62, 0.86, 0.56, -0.17], [2.0, 0.95, 0.56, -0.24], [1.2, 1.0, 0.57, -0.28], [0.2, 1.0, 0.6, -0.3], [-0.8, 0.94, 0.64, -0.3], [-1.6, 0.8, 0.69, -0.27], [-2.2, 0.56, 0.76, -0.2], [-2.55, 0.3, 0.82, -0.08], [-2.76, 0.03, 0.88, 0.15]];
  const Y0 = -0.3, YH = 1.18;
  function cr(a, b, c, d, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); }
  function station(x) { // interpolated [B, S, K] at length position x
    const S = SECTIONS; let i = 0; while (i < S.length - 2 && x < S[i + 1][0]) i++;
    const a = S[Math.max(0, i - 1)], b = S[i], c = S[i + 1], d = S[Math.min(S.length - 1, i + 2)], t = (x - b[0]) / (c[0] - b[0]);
    return [1, 2, 3].map(k => cr(a[k], b[k], c[k], d[k], Math.max(0, Math.min(1, t))));
  }
  function section(x, inset = 0) { // returns function v∈[-1,1] → [y, z]
    let [B, S, K] = station(x); B = Math.max(0.004, B - inset); K = K + inset * 1.3; const C = K + 0.19;
    return v => { const a = Math.abs(v), sg = Math.sign(v) || 1; if (a <= 0.45) { const t = a / 0.45; return [K + (C - K) * Math.pow(t, 1.25), sg * B * 0.78 * t]; } const t = (a - 0.45) / 0.55; return [C + (S - C) * t, sg * (0.78 * B + 0.22 * B * Math.sin(t * Math.PI / 2))]; };
  }
  function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }
  function hullTexture() {
    const xs = SECTIONS[0][0], xe = SECTIONS[SECTIONS.length - 1][0];
    return tex(1024, 512, (g, w, h) => {
      const vy = y => h - (y - Y0) / YH * h; // canvas y for a hull height
      g.fillStyle = '#ecebe3'; g.fillRect(0, 0, w, h);
      for (let px = 0; px < w; px++) {
        const x = xs + (xe - xs) * px / (w - 1), [, S] = station(x);
        g.fillStyle = '#5b2621'; g.fillRect(px, vy(-0.005), 1, h);                  // antifouling
        g.fillStyle = '#1d3346'; g.fillRect(px, vy(0.045), 1, vy(-0.005) - vy(0.045)); // boot stripe
        g.fillStyle = '#8A1538'; g.fillRect(px, vy(S - 0.085), 1, vy(S - 0.135) - vy(S - 0.085)); // sheer stripe (school maroon)
        g.fillStyle = '#c9a24d'; g.fillRect(px, vy(S - 0.145), 1, 2);
      }
      for (let i = 0; i < 5000; i++) { g.fillStyle = Math.random() < 0.5 ? '#00000008' : '#ffffff10'; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 1); }
      // weathering: faint drip streaks under the rub rail and fittings, sun-chalked gelcoat, salt line above the boot stripe
      let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 140; i++) { const px = rnd() * w, len = 20 + rnd() * 150, top = vy(0.62) + rnd() * 30; const gr = g.createLinearGradient(0, top, 0, top + len); const a = (0.03 + rnd() * 0.07).toFixed(3); gr.addColorStop(0, `rgba(92,78,58,${a})`); gr.addColorStop(1, 'rgba(92,78,58,0)'); g.fillStyle = gr; g.fillRect(px, top, 1 + rnd() * 2.5, len); }
      for (let i = 0; i < 26; i++) { const px = rnd() * w, len = 30 + rnd() * 90, top = vy(0.6) + rnd() * 40; const gr = g.createLinearGradient(0, top, 0, top + len); gr.addColorStop(0, 'rgba(120,70,40,0.12)'); gr.addColorStop(1, 'rgba(120,70,40,0)'); g.fillStyle = gr; g.fillRect(px, top, 2, len); }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '120,110,95'},${(0.008 + rnd() * 0.016).toFixed(3)})`; const r = 4 + rnd() * 26; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, r * 1.8, r, 0, 0, 7); g.fill(); }
      { const salt = g.createLinearGradient(0, vy(0.11), 0, vy(0.05)); salt.addColorStop(0, 'rgba(240,238,228,0)'); salt.addColorStop(1, 'rgba(214,210,196,0.55)'); g.fillStyle = salt; g.fillRect(0, vy(0.11), w, vy(0.05) - vy(0.11)); }
      const grime = g.createLinearGradient(0, vy(0.12), 0, vy(0.0)); grime.addColorStop(0, '#6b5a3c00'); grime.addColorStop(1, '#6b5a3c2a'); g.fillStyle = grime; g.fillRect(0, vy(0.12), w, vy(0.0) - vy(0.12));
    });
  }
  function plankTexture() {
    return tex(512, 512, (g, w, h) => { g.fillStyle = '#9b7046'; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const y = i * 64; g.fillStyle = ['#a57a4e', '#93673f', '#a9804f', '#8e6640'][i % 4]; g.fillRect(0, y + 2, w, 60); for (let k = 0; k < 60; k++) { g.strokeStyle = '#5d3f2440'; g.beginPath(); const yy = y + 4 + Math.random() * 56; g.moveTo(0, yy); for (let x = 0; x < w; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + k) * 2); g.stroke(); } g.fillStyle = '#2b1d12'; g.fillRect(0, y, w, 2); } for (let i = 0; i < 40; i++) { g.fillStyle = '#3a2a1a'; g.fillRect(Math.random() * w, Math.floor(Math.random() * 8) * 64 + 10, 3, 3); } });
  }
  function nonSlipTexture() { return tex(256, 256, (g, w, h) => { g.fillStyle = '#e4e2da'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 4; x < w; x += 8) { g.fillStyle = '#cfccc2'; g.fillRect(x, y, 3, 3); } }); }

  function loft(stations, M, inset, flip, uvFn) {
    const pos = [], uv = [], idx = [], cols = 2 * M + 1;
    stations.forEach((x, i) => { const sec = section(x, inset); for (let j = 0; j < cols; j++) { const v = -1 + 2 * j / (cols - 1), [y, z] = sec(v); pos.push(x, y, z); uv.push(...uvFn(x, y, z, i, j)); } });
    for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function innerHalfWidth(x, y) { const sec = section(x, 0.045); let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (sec(m)[0] < y) lo = m; else hi = m; } return Math.abs(sec((lo + hi) / 2)[1]); }

  function build() {
    const boat = new T.Group(); boat.name = 'boat';
    const xs = SECTIONS[0][0], xe = SECTIONS[SECTIONS.length - 1][0], N = 46, stations = Array.from({ length: N }, (_, i) => xs + (xe - xs) * i / (N - 1));
    const hullMat = new T.MeshStandardMaterial({ map: hullTexture(), roughness: 0.42, metalness: 0.0, name: 'hull-gelcoat' });
    const outer = new T.Mesh(loft(stations, 14, 0, true, (x, y) => [(x - xs) / (xe - xs), (y - Y0) / YH]), hullMat); outer.name = 'hull'; boat.add(outer);
    const innerMat = new T.MeshStandardMaterial({ map: nonSlipTexture(), roughness: 0.7, color: '#f2f0e8', name: 'hull-inner', side: T.DoubleSide }); innerMat.map.wrapS = innerMat.map.wrapT = T.RepeatWrapping; innerMat.map.repeat.set(8, 3);
    const inner = new T.Mesh(loft(stations.slice(0, N - 2), 12, 0.045, true, (x, y, z) => [x * 0.5, z * 0.5 + y]), innerMat); inner.name = 'hull-inner'; boat.add(inner);
    // gunwale cap + rub rails
    const capMat = new T.MeshStandardMaterial({ color: '#9a6a3c', roughness: 0.55, name: 'teak', side: T.DoubleSide }), rubMat = new T.MeshStandardMaterial({ color: '#2c3238', roughness: 0.6, name: 'rub-rail' });
    [-1, 1].forEach(side => {
      const pos = [], idx = []; stations.slice(0, N - 1).forEach((x, i) => { const o = section(x, 0)(side), n = section(x, 0.045)(side); pos.push(x, o[0], o[1], x, n[0] + 0.0, n[1]); if (i) { const a = (i - 1) * 2; side > 0 ? idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) : idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const cap = new T.Mesh(g, capMat); cap.name = 'gunwale-cap'; boat.add(cap);
      const pts = stations.map(x => { const o = section(x, 0)(side); return new T.Vector3(x, o[0] - 0.035, o[1] + side * 0.012); });
      const rail = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 90, 0.028, 8, false), rubMat); rail.name = 'rub-rail'; boat.add(rail);
    });
    // transom (closes outer → inner at the stern)
    { const so = section(xs, 0), si = section(xs, 0.045), pos = [], idx = [], M = 29; for (let j = 0; j < M; j++) { const v = -1 + 2 * j / (M - 1), a = so(v), b = si(v); pos.push(xs, a[0], a[1], xs, b[0], b[1]); if (j) { const k = (j - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const tr = new T.Mesh(g, new T.MeshStandardMaterial({ color: '#efede6', roughness: 0.4, side: T.DoubleSide })); tr.name = 'transom'; boat.add(tr);
      const plate = new T.Mesh(new T.PlaneGeometry(1.5, 0.62), new T.MeshStandardMaterial({ color: '#ecebe4', roughness: 0.5, side: T.DoubleSide })); plate.position.set(xs + 0.002, 0.18, 0); plate.rotation.y = Math.PI / 2; boat.add(plate); }
    // floor (sole) with teak planks
    { const pos = [], uv = [], idx = [], xa = 2.48, xb = -1.95, n = 30, y = 0.02; for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n, w = innerHalfWidth(x, y) - 0.012; pos.push(x, y, -w, x, y, w); uv.push(x * 0.5, -w * 0.5, x * 0.5, w * 0.5); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new T.MeshStandardMaterial({ map: plankTexture(), roughness: 0.7, name: 'deck-teak', side: T.DoubleSide }); m.map.wrapS = m.map.wrapT = T.RepeatWrapping; const floor = new T.Mesh(g, m); floor.name = 'deck'; floor.receiveShadow = true; boat.add(floor); if (g.index) { /* ensure upward normals */ const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0); } }
    // thwart seats
    const seatMat = new T.MeshStandardMaterial({ color: '#a8784a', roughness: 0.6, name: 'seat-teak' }), cushion = new T.MeshStandardMaterial({ color: '#2e4f6a', roughness: 0.85, name: 'cushion' });
    [1.45, -1.25].forEach((x, i) => { const w = innerHalfWidth(x, 0.38) * 2 - 0.01; const s = new T.Mesh(new T.BoxGeometry(0.32, 0.045, w), seatMat); s.position.set(x, 0.38, 0); s.name = 'seat'; s.castShadow = true; boat.add(s); if (i === 0) { const c = new T.Mesh(new T.BoxGeometry(0.3, 0.05, 0.62), cushion); c.position.set(x, 0.425, 0.28); boat.add(c); } const leg = new T.Mesh(new T.BoxGeometry(0.06, 0.36, 0.06), seatMat); leg.position.set(x, 0.2, 0); boat.add(leg); });
    // outboard motor (unbranded)
    { const m = new T.Group(); m.name = 'outboard'; const dark = new T.MeshStandardMaterial({ color: '#30353b', roughness: 0.35, metalness: 0.2 }), light = new T.MeshStandardMaterial({ color: '#b8bec4', roughness: 0.3, metalness: 0.5 });
      const prof = new T.Shape(); // side profile of an engine cowling: flat bottom, sloped front, rounded back/top
      prof.moveTo(-0.2, 0); prof.lineTo(0.22, 0); prof.quadraticCurveTo(0.27, 0.0, 0.27, 0.06); prof.lineTo(0.25, 0.26); prof.quadraticCurveTo(0.23, 0.36, 0.12, 0.37); prof.lineTo(-0.1, 0.35); prof.quadraticCurveTo(-0.2, 0.33, -0.22, 0.22); prof.lineTo(-0.23, 0.05); prof.quadraticCurveTo(-0.23, 0.0, -0.2, 0);
      const cg = new T.ExtrudeGeometry(prof, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.035, bevelSegments: 5, curveSegments: 10 }); cg.translate(0, 0, -0.11); cg.computeVertexNormals();
      const cowlMat = new T.MeshStandardMaterial({ color: '#2b2f34', roughness: 0.28, metalness: 0.15, name: 'outboard-cowl' });
      const cowl = new T.Mesh(cg, cowlMat); cowl.position.set(0.28, 0.66, 0); m.add(cowl);
      const vent = new T.Mesh(new T.BoxGeometry(0.16, 0.012, 0.2), dark); vent.position.set(0.16, 1.035, 0); m.add(vent);
      const band = new T.Mesh(new T.CylinderGeometry(0.205, 0.215, 0.05, 24), light); band.position.set(0.28, 0.68, 0); band.scale.set(1.25, 1, 0.95); m.add(band);
      const shaft = new T.Mesh(new T.BoxGeometry(0.1, 0.95, 0.09), dark); shaft.position.set(0.3, 0.17, 0); m.add(shaft);
      const plate = new T.Mesh(new T.BoxGeometry(0.34, 0.015, 0.2), dark); plate.position.set(0.33, -0.18, 0); m.add(plate);
      const gear = new T.Mesh(new T.CylinderGeometry(0.05, 0.045, 0.3, 12), dark); gear.rotation.z = Math.PI / 2; gear.position.set(0.3, -0.36, 0); m.add(gear);
      const hub = new T.Group(); hub.position.set(0.48, -0.36, 0); hub.name = 'propeller'; for (let k = 0; k < 3; k++) { const b = new T.Mesh(new T.BoxGeometry(0.012, 0.13, 0.07), light); b.position.y = 0.065; const p = new T.Group(); p.rotation.x = k * 2.094; b.rotation.y = 0.5; p.add(b); hub.add(p); } m.add(hub);
      const bracket = new T.Mesh(new T.BoxGeometry(0.14, 0.18, 0.2), light); bracket.position.set(0.08, 0.5, 0); m.add(bracket);
      const tiller = new T.Mesh(new T.CylinderGeometry(0.025, 0.03, 0.55, 10), dark); tiller.rotation.z = Math.PI / 2 - 0.25; tiller.position.set(-0.12, 0.74, 0); m.add(tiller);
      m.position.set(xs, 0, 0); boat.add(m); }
    // ice box (cooler) with hinged lid — catches are placed inside
    { const c = new T.Group(); c.name = 'cooler'; c.position.set(-0.95, 0.02, -0.18); const white = new T.MeshStandardMaterial({ color: '#f4f6f6', roughness: 0.45, name: 'cooler-white' }), blue = new T.MeshStandardMaterial({ color: '#2b6f9e', roughness: 0.45, name: 'cooler-lid' }), ice = new T.MeshStandardMaterial({ color: '#dff4ff', roughness: 0.1, transparent: true, opacity: 0.85, name: 'ice' });
      const W = 0.62, H = 0.4, D = 0.42, t = 0.035; [[W, t, D, 0, t / 2, 0], [t, H, D, -W / 2 + t / 2, H / 2, 0], [t, H, D, W / 2 - t / 2, H / 2, 0], [W, H, t, 0, H / 2, -D / 2 + t / 2], [W, H, t, 0, H / 2, D / 2 - t / 2]].forEach(([a, b, d, x, y, z]) => { const m = new T.Mesh(new T.BoxGeometry(a, b, d), white); m.position.set(x, y, z); m.castShadow = true; c.add(m); });
      for (let i = 0; i < 26; i++) { const m = new T.Mesh(new T.BoxGeometry(0.06, 0.05, 0.06), ice); m.position.set(-0.24 + (i % 7) * 0.08, 0.06 + Math.floor(i / 14) * 0.04, -0.15 + (Math.floor(i / 7) % 2) * 0.16 + (i % 3) * 0.03); m.rotation.set(i, i * 2, 0); c.add(m); }
      const lidPivot = new T.Group(); lidPivot.name = 'cooler-lid'; lidPivot.position.set(0, H, D / 2); const lid = new T.Mesh(new T.BoxGeometry(W + 0.02, 0.06, D + 0.02), blue); lid.position.set(0, 0.03, -D / 2); lidPivot.add(lid);
      const handle = new T.Mesh(new T.BoxGeometry(0.22, 0.03, 0.04), white); handle.position.set(0, 0.07, -D + 0.04); lidPivot.add(handle); c.add(lidPivot); boat.add(c); }
    // tackle box
    { const t = new T.Group(); t.name = 'tackle-box'; t.position.set(1.15, 0.02, -0.5); t.rotation.y = 0.3; const body = new T.MeshStandardMaterial({ color: '#3d5a4f', roughness: 0.55 }), latch = new T.MeshStandardMaterial({ color: '#d9a43a', roughness: 0.4, metalness: 0.4 });
      const b = new T.Mesh(new T.BoxGeometry(0.42, 0.18, 0.24), body); b.position.y = 0.09; b.castShadow = true; t.add(b); const l = new T.Mesh(new T.BoxGeometry(0.43, 0.06, 0.25), body); l.position.y = 0.21; t.add(l); const h = new T.Mesh(new T.TorusGeometry(0.06, 0.012, 6, 14, Math.PI), latch); h.position.y = 0.24; t.add(h); [-0.12, 0.12].forEach(x => { const k = new T.Mesh(new T.BoxGeometry(0.04, 0.04, 0.01), latch); k.position.set(x, 0.17, 0.125); t.add(k); }); boat.add(t); }
    // bait bucket with shrimp
    { const b = new T.Group(); b.name = 'bait-bucket'; b.position.set(-0.32, 0.02, 0.58); const bm = new T.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.5, side: T.DoubleSide }); const body = new T.Mesh(new T.CylinderGeometry(0.15, 0.12, 0.3, 20, 1, true), bm); body.position.y = 0.15; b.add(body); const bot = new T.Mesh(new T.CircleGeometry(0.12, 20), bm); bot.rotation.x = -Math.PI / 2; bot.position.y = 0.01; b.add(bot);
      const water = new T.Mesh(new T.CircleGeometry(0.14, 20), new T.MeshStandardMaterial({ color: '#4b7d7a', roughness: 0.1 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.22; b.add(water);
      const shrimp = new T.MeshStandardMaterial({ color: '#e7a08a', roughness: 0.5 }); for (let i = 0; i < 7; i++) { const s = new T.Mesh(new T.TorusGeometry(0.025, 0.009, 6, 10, Math.PI * 1.2), shrimp); s.position.set(Math.cos(i) * 0.07, 0.225, Math.sin(i * 1.7) * 0.07); s.rotation.set(Math.PI / 2, 0, i); b.add(s); }
      const handle = new T.Mesh(new T.TorusGeometry(0.15, 0.006, 6, 20, Math.PI), new T.MeshStandardMaterial({ color: '#777', metalness: 0.6, roughness: 0.4 })); handle.position.y = 0.3; handle.rotation.y = 0.4; b.add(handle); boat.add(b); }
    // fuel tank, rope coil, anchor, fenders, rod holders with spare rod, lights, life ring
    { const red = new T.MeshStandardMaterial({ color: '#b62f22', roughness: 0.5 }); const f = new T.Mesh(new T.BoxGeometry(0.42, 0.22, 0.28), red); f.position.set(2.15, 0.13, 0.48); f.castShadow = true; boat.add(f); const cap = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.03, 10), new T.MeshStandardMaterial({ color: '#222' })); cap.position.set(2.05, 0.255, 0.5); boat.add(cap); }
    { const rope = new T.MeshStandardMaterial({ color: '#d8c79c', roughness: 0.95 }); for (let i = 0; i < 4; i++) { const r = new T.Mesh(new T.TorusGeometry(0.15 - i * 0.012, 0.016, 6, 24), rope); r.rotation.x = Math.PI / 2; r.position.set(-1.9, 0.05 + i * 0.03, 0.05); boat.add(r); } const an = new T.Mesh(new T.ConeGeometry(0.06, 0.25, 4), new T.MeshStandardMaterial({ color: '#555b60', metalness: 0.7, roughness: 0.35 })); an.position.set(-1.7, 0.08, -0.25); an.rotation.z = Math.PI / 2; boat.add(an); }
    { const fm = new T.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.4 }); [0.9, -0.6].forEach(x => { const s = section(x, 0)(1), f = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.36, 14), fm); f.position.set(x, s[0] - 0.28, s[1] + 0.09); boat.add(f); const l = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.2), new T.MeshStandardMaterial({ color: '#ddd' })); l.position.set(x, s[0] - 0.05, s[1] + 0.08); boat.add(l); }); }
    { const metal = new T.MeshStandardMaterial({ color: '#c3c8cc', metalness: 0.85, roughness: 0.25 }), blank = new T.MeshStandardMaterial({ color: '#1f2a33', roughness: 0.3, metalness: 0.2 }), cork = new T.MeshStandardMaterial({ color: '#b48a5a', roughness: 0.9 });
      [[2.05, 1]].forEach(([x, side]) => { const s = section(x, 0)(side * 0.98); const holder = new T.Group(); holder.position.set(x, s[0], s[1] - side * 0.04); holder.rotation.x = side * 0.5; holder.rotation.z = 0.75; const tube = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.22, 12, 1, true), metal); holder.add(tube); const rod = new T.Mesh(new T.CylinderGeometry(0.003, 0.009, 1.7, 6), blank); rod.position.y = 0.9; holder.add(rod); const grip = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.35, 8), cork); grip.position.y = 0.08; holder.add(grip); boat.add(holder); }); }
    { const post = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.5, 8), new T.MeshStandardMaterial({ color: '#d0d4d8', metalness: 0.8, roughness: 0.3 })); post.position.set(2.45, 0.8, -0.6); boat.add(post); const lamp = new T.Mesh(new T.SphereGeometry(0.03, 12, 8), new T.MeshStandardMaterial({ color: '#fff', emissive: '#fff4d6', emissiveIntensity: 0.6 })); lamp.position.set(2.45, 1.06, -0.6); boat.add(lamp); }
    { const ring = new T.Mesh(new T.TorusGeometry(0.2, 0.05, 10, 26), new T.MeshStandardMaterial({ color: '#e5602a', roughness: 0.6 })); ring.position.set(1.65, 0.38, 0.82); ring.rotation.y = Math.PI / 2 + 0.2; ring.rotation.x = 0.25; ring.name = 'life-ring'; boat.add(ring); }
    boat.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow || o.name === 'seat'; o.receiveShadow = true; } });
    return boat;
  }
  root.FishingBoatModel = { build, section, station, innerHalfWidth, SECTIONS };
})(typeof window !== 'undefined' ? window : globalThis);
