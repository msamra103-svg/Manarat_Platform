/* عدّاء قطر — procedural textures (canvas, generated offline at start-up; no image files, no network). */
(function (root) {
  'use strict';
  const T = root.THREE;
  let seed = 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const reseed = s => { seed = (s >>> 0) % 2147483646 + 1; };
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function tex(c, { srgb = true, repeat = true, aniso = 8, mips = true } = {}) {
    const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = aniso; if (!mips) { t.generateMipmaps = false; t.minFilter = T.LinearFilter; } return t;
  }
  function speckle(x, w, h, n, colors, rmin, rmax) { for (let i = 0; i < n; i++) { x.fillStyle = colors[(rnd() * colors.length) | 0]; const r = rmin + rnd() * (rmax - rmin); x.fillRect(rnd() * w, rnd() * h, r, r); } }
  function grain(x, w, h, amt) { const im = x.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const k = 1 + (rnd() - 0.5) * amt; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } x.putImageData(im, 0, 0); }
  function blotch(x, w, h, n, color, rmin, rmax, alpha) { for (let i = 0; i < n; i++) { const cx = rnd() * w, cy = rnd() * h, r = rmin + rnd() * (rmax - rmin); const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, color.replace('A', alpha)); g.addColorStop(1, color.replace('A', 0)); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); } }

  // 3-lane asphalt road, 7.8 m wide × 20 m long (u across, v along)
  function road() {
    reseed(11); const W = 512, H = 1024, [c, x] = canvas(W, H);
    x.fillStyle = '#3b3e42'; x.fillRect(0, 0, W, H);
    blotch(x, W, H, 40, 'rgba(20,22,25,A)', 30, 120, 0.22); blotch(x, W, H, 25, 'rgba(90,92,96,A)', 20, 90, 0.12);
    speckle(x, W, H, 22000, ['#4c4f53', '#2f3236', '#55585c', '#43464a', '#5e6165'], 0.6, 1.6);
    const mx = m => (m + 3.9) / 7.8 * W, mz = m => m / 20 * H;
    // tyre-polished bands in each lane
    for (const lc of [-2.5, 0, 2.5]) for (const o of [-0.75, 0.75]) { const g = x.createLinearGradient(mx(lc + o - 0.35), 0, mx(lc + o + 0.35), 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(15,16,18,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(mx(lc + o - 0.35), 0, mx(lc + o + 0.35) - mx(lc + o - 0.35), H); }
    x.fillStyle = 'rgba(240,240,236,0.92)';
    for (const ex of [-3.62, 3.62]) x.fillRect(mx(ex) - 4, 0, 8, H);
    for (const lx of [-1.25, 1.25]) for (let z = 1; z < 20; z += 10) x.fillRect(mx(lx) - 3.5, mz(z), 7, mz(4));
    grain(x, W, H, 0.12);
    return tex(c);
  }
  function curb() { const [c, x] = canvas(64, 64); for (let i = 0; i < 2; i++) { x.fillStyle = i ? '#f2f2ee' : '#1c1d1f'; x.fillRect(0, i * 32, 64, 32); } grain(x, 64, 64, 0.15); return tex(c); }
  function pavers(base = '#b9ab95', alt = '#a8977f', accent = '#9c5b4a') { // 2 m × 2 m tile
    reseed(23); const S = 512, [c, x] = canvas(S, S); x.fillStyle = '#8f8676'; x.fillRect(0, 0, S, S);
    const bw = S / 8, bh = S / 16;
    for (let r = 0; r < 16; r++) for (let k = -1; k < 9; k++) { const off = (r % 2) * bw / 2; const col = rnd() < 0.08 ? accent : rnd() < 0.5 ? base : alt; x.fillStyle = col; x.fillRect(k * bw + off + 1.5, r * bh + 1.5, bw - 3, bh - 3); }
    speckle(x, S, S, 9000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], 1, 2); grain(x, S, S, 0.1); return tex(c);
  }
  function stone() { // Souq Waqif limestone slabs (grey-blue), 3 m × 3 m tile
    reseed(31); const S = 512, [c, x] = canvas(S, S); x.fillStyle = '#5d6266'; x.fillRect(0, 0, S, S);
    const rows = [0, 110, 190, 320, 400, 512];
    for (let r = 0; r < rows.length - 1; r++) { let px = -rnd() * 100; while (px < S) { const w = 90 + rnd() * 140; const l = 112 + rnd() * 26; x.fillStyle = `rgb(${l - 6 + rnd() * 10},${l - 2 + rnd() * 10},${l + 4 + rnd() * 10})`; x.fillRect(px + 2, rows[r] + 2, w - 4, rows[r + 1] - rows[r] - 4); px += w; } }
    blotch(x, S, S, 30, 'rgba(60,60,55,A)', 20, 80, 0.12); speckle(x, S, S, 14000, ['rgba(0,0,0,0.09)', 'rgba(255,255,255,0.09)'], 0.7, 1.6); grain(x, S, S, 0.12);
    return tex(c);
  }
  function plaster(tone = [186, 156, 118]) { // mud plaster of Souq Waqif walls, 4 m tile
    reseed(41); const S = 512, [c, x] = canvas(S, S); x.fillStyle = `rgb(${tone.join(',')})`; x.fillRect(0, 0, S, S);
    blotch(x, S, S, 60, 'rgba(120,92,62,A)', 20, 90, 0.18); blotch(x, S, S, 50, 'rgba(225,200,160,A)', 20, 80, 0.16);
    for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(${90 + rnd() * 60},${70 + rnd() * 40},40,0.25)`; x.lineWidth = 1; const a = rnd() * 6.28, l = 3 + rnd() * 6, px = rnd() * S, py = rnd() * S; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    grain(x, S, S, 0.16); return tex(c);
  }
  function bark() {
    reseed(51); const W = 128, H = 512, [c, x] = canvas(W, H); x.fillStyle = '#7a6750'; x.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 14) for (let k = 0; k < 5; k++) { const px = (k + (y / 14) % 2 * 0.5) * W / 4; x.fillStyle = `rgba(${60 + rnd() * 30},${48 + rnd() * 24},${34 + rnd() * 18},0.9)`; x.beginPath(); x.ellipse(px, y, W / 8, 9, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(40,30,20,0.6)'; x.stroke(); }
    grain(x, W, H, 0.2); return tex(c);
  }
  function frond() { // palm leaf: rachis + leaflets, alpha-cut (u across, v along the frond)
    reseed(61); const W = 256, H = 512, [c, x] = canvas(W, H); x.clearRect(0, 0, W, H);
    for (let i = 0; i < 96; i++) {
      const v = i / 96, y = H * (0.04 + v * 0.94), len = W * 0.48 * Math.sin(Math.PI * (0.15 + v * 0.8)) * (0.85 + rnd() * 0.2);
      for (const s of [-1, 1]) {
        const g = 78 + rnd() * 36; x.strokeStyle = `rgb(${34 + rnd() * 22},${g},${30 + rnd() * 18})`; x.lineWidth = 4.2 - v * 1.8; x.lineCap = 'round';
        x.beginPath(); x.moveTo(W / 2, y); x.quadraticCurveTo(W / 2 + s * len * 0.6, y - 12, W / 2 + s * len, y - 26 - rnd() * 10); x.stroke();
      }
    }
    x.strokeStyle = '#8a8a4a'; x.lineWidth = 5; x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke();
    return tex(c, { repeat: false });
  }
  function facade(kind, opts = {}) { // world-unit tile: one panel wide × one floor tall (see world facade material)
    reseed(71 + kind.length * 7 + (opts.seed || 0)); const S = 256, [c, x] = canvas(S, S), [ce, xe] = canvas(S, S);
    xe.fillStyle = '#000'; xe.fillRect(0, 0, S, S);
    if (kind === 'stone') { // white/beige stone with tall windows
      x.fillStyle = opts.base || '#e7e0d2'; x.fillRect(0, 0, S, S); grain(x, S, S, 0.06);
      x.fillStyle = '#2b3a46'; x.fillRect(S * 0.3, S * 0.18, S * 0.4, S * 0.66); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(S * 0.3, S * 0.18, S * 0.4, S * 0.08);
      x.fillStyle = 'rgba(0,0,0,0.14)'; x.fillRect(0, S - 6, S, 6);
      xe.fillStyle = '#ffd9a0'; xe.globalAlpha = 0.9; xe.fillRect(S * 0.3, S * 0.18, S * 0.4, S * 0.66);
    } else if (kind === 'glass') {
      const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, opts.top || '#4f7fa8'); g.addColorStop(1, opts.bottom || '#244a6d'); x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.fillStyle = 'rgba(220,235,245,0.75)'; x.fillRect(0, 0, S, 5); x.fillRect(0, 0, 4, S); x.fillRect(S / 2 - 1, 0, 2, S);
      xe.fillStyle = '#fff2d8'; xe.globalAlpha = 0.75; xe.fillRect(6, 8, S / 2 - 10, S - 14); xe.fillRect(S / 2 + 4, 8, S / 2 - 10, S - 14);
    } else if (kind === 'mashrabiya') { // beige wall with a lattice screen
      x.fillStyle = opts.base || '#d8c7a6'; x.fillRect(0, 0, S, S); grain(x, S, S, 0.08);
      x.fillStyle = '#3c3022'; x.fillRect(S * 0.18, S * 0.14, S * 0.64, S * 0.7);
      x.strokeStyle = '#cdb68f'; x.lineWidth = 4; for (let i = -S; i < S * 2; i += 22) { x.beginPath(); x.moveTo(S * 0.18 + i, S * 0.14); x.lineTo(S * 0.18 + i + S * 0.7, S * 0.84); x.moveTo(S * 0.18 + i + S * 0.7, S * 0.14); x.lineTo(S * 0.18 + i, S * 0.84); x.stroke(); }
      x.clearRect(0, 0, S * 0.18, S); x.fillStyle = opts.base || '#d8c7a6'; x.fillRect(0, 0, S * 0.18, S); x.fillRect(S * 0.82, 0, S * 0.18, S); x.fillRect(0, 0, S, S * 0.14); x.fillRect(0, S * 0.84, S, S * 0.16);
      xe.fillStyle = '#ffcf8a'; xe.globalAlpha = 0.55; xe.fillRect(S * 0.2, S * 0.16, S * 0.6, S * 0.66);
    }
    return [tex(c), tex(ce)];
  }
  function lattice(color = '#ffffff', line = 7, bg = null) { // 8-point star (khatam) lattice for the question gate
    const S = 256, [c, x] = canvas(S, S); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, S, S); } else x.clearRect(0, 0, S, S);
    x.strokeStyle = color; x.lineWidth = line; x.lineJoin = 'round';
    const star = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + Math.PI / 8, rr = i % 2 ? r * 0.62 : r; const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); };
    for (const [cx, cy] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) star(cx, cy, S * 0.3);
    x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S * 0.2); x.moveTo(S / 2, S); x.lineTo(S / 2, S * 0.8); x.moveTo(0, S / 2); x.lineTo(S * 0.2, S / 2); x.moveTo(S, S / 2); x.lineTo(S * 0.8, S / 2); x.stroke();
    return tex(c, { srgb: true });
  }
  function glow(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') { const S = 128, [c, x] = canvas(S, S); const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, inner); g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.45)')); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, S, S); return tex(c, { repeat: false }); }
  function qatarFlag() { // maroon with a white band and nine serrations (11:28)
    const W = 560, H = 220, [c, x] = canvas(W, H); x.fillStyle = '#8a1538'; x.fillRect(0, 0, W, H); x.fillStyle = '#ffffff';
    x.beginPath(); x.moveTo(0, 0); const band = W * 0.25, tip = W * 0.36; for (let i = 0; i < 9; i++) { const y0 = i * H / 9; x.lineTo(band, y0); x.lineTo(tip, y0 + H / 18); } x.lineTo(band, H); x.lineTo(0, H); x.closePath(); x.fill();
    return tex(c, { repeat: false });
  }
  function sign(text, { w = 512, h = 128, bg = '#2a2018', fg = '#f1d9a4', font = 'Tajawal, Arial', size = 64, border = '#b88a4a' } = {}) {
    const [c, x] = canvas(w, h); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = border; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = fg; x.font = `800 ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText(text, w / 2, h / 2 + 4); return tex(c, { repeat: false });
  }
  function waterNormal() { // tiling normal map from summed waves
    const S = 256, [c, x] = canvas(S, S), im = x.createImageData(S, S), d = im.data;
    const waves = []; reseed(81); for (let i = 0; i < 14; i++) waves.push([((rnd() * 8) | 0) + 1, ((rnd() * 8) | 0) - 4, rnd() * 6.28, 0.6 + rnd()]);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      let dx = 0, dy = 0; for (const [kx, ky, ph, a] of waves) { const arg = (kx * i + ky * j) / S * 6.283 + ph; const cs = Math.cos(arg) * a; dx += cs * kx; dy += cs * ky; }
      const nx = -dx * 0.03, ny = -dy * 0.03, nz = 1, l = Math.hypot(nx, ny, nz); const k = (j * S + i) * 4;
      d[k] = (nx / l * 0.5 + 0.5) * 255; d[k + 1] = (ny / l * 0.5 + 0.5) * 255; d[k + 2] = (nz / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
    x.putImageData(im, 0, 0); return tex(c, { srgb: false });
  }
  function sand() { reseed(91); const S = 256, [c, x] = canvas(S, S); x.fillStyle = '#c9b48e'; x.fillRect(0, 0, S, S); blotch(x, S, S, 40, 'rgba(170,140,100,A)', 10, 60, 0.2); speckle(x, S, S, 6000, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.1)'], 1, 2); return tex(c); }
  function grass() { reseed(101); const S = 256, [c, x] = canvas(S, S); x.fillStyle = '#5f8c3c'; x.fillRect(0, 0, S, S); speckle(x, S, S, 16000, ['#4f7a30', '#6e9c48', '#7fae55', '#3f6826'], 1, 2.5); return tex(c); }
  function diagrid(top = '#5d7f9e', bottom = '#2d4c68') { const S = 256, [c, x] = canvas(S, S); const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, S, S); x.strokeStyle = 'rgba(210,225,235,0.8)'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, 0); x.lineTo(S, S); x.moveTo(S, 0); x.lineTo(0, S); x.stroke(); x.lineWidth = 2; x.strokeStyle = 'rgba(200,215,225,0.4)'; for (let y = 0; y < S; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke(); } return tex(c); }
  function mashrabiyaSkin() { // Doha-tower-like screen: dark glass behind a fine geometric lattice
    const S = 256, [c, x] = canvas(S, S); x.fillStyle = '#1f2f3e'; x.fillRect(0, 0, S, S); x.strokeStyle = 'rgba(214,214,206,0.85)'; x.lineWidth = 3;
    const r = 32; for (let yy = 0; yy <= S; yy += r) for (let xx = 0; xx <= S; xx += r) { x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const px = xx + Math.cos(a) * r * 0.48, py = yy + Math.sin(a) * r * 0.48; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); }
    return tex(c);
  }
  root.QRTex = { road, curb, pavers, stone, plaster, bark, frond, facade, lattice, glow, qatarFlag, sign, waterNormal, sand, grass, diagrid, mashrabiyaSkin, reseed, rnd: () => rnd() };
})(typeof window !== 'undefined' ? window : globalThis);
