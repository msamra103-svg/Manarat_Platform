/* Procedural football kits (fictional teams, school colours). Textures are drawn on canvases using the character's cylindrical UV layout:
 * u = angle around the limb/torso (0.5 = front), v = height / stature. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};

  const KITS = {
    home: { id: 'home', name: 'أبو عبيدة', jersey: '#8a1538', jersey2: '#6e102d', trim: '#f7f2e8', accent: '#cfa95a', shorts: '#f4efe4', shortsStripe: '#8a1538', socks: '#8a1538', sockBand: '#f7f2e8', boots: '#15181b', numberColor: '#f7f2e8', numberOutline: '#cfa95a', crestA: '#8a1538' },
    away: { id: 'away', name: 'الضيوف', jersey: '#ece6d6', jersey2: '#d9d1bd', trim: '#16505b', accent: '#c9a24f', shorts: '#16505b', shortsStripe: '#ece6d6', socks: '#ece6d6', sockBand: '#16505b', boots: '#1b1f22', numberColor: '#16505b', numberOutline: '#c9a24f', crestA: '#16505b' },
    ref: { id: 'ref', name: 'حكم', jersey: '#f2c230', jersey2: '#d9a91c', trim: '#161616', accent: '#161616', shorts: '#161616', shortsStripe: '#2a2a2a', socks: '#161616', sockBand: '#f2c230', boots: '#101010', numberColor: '#161616', numberOutline: 'rgba(0,0,0,0)' },
    keeperHome: { id: 'keeperHome', name: 'حارس', jersey: '#2cb862', jersey2: '#1f8f4a', trim: '#0f1a14', accent: '#e8ff7a', shorts: '#101a14', shortsStripe: '#2cb862', socks: '#101a14', sockBand: '#2cb862', boots: '#101010', numberColor: '#0f1a14', numberOutline: '#e8ff7a', glove: '#e8ff4d' },
    keeperAway: { id: 'keeperAway', name: 'حارس', jersey: '#f08a24', jersey2: '#c96a10', trim: '#1b1b1b', accent: '#fff1c4', shorts: '#1b1b1b', shortsStripe: '#f08a24', socks: '#1b1b1b', sockBand: '#f08a24', boots: '#101010', numberColor: '#1b1b1b', numberOutline: '#fff1c4', glove: '#ffe14a' }
  };

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, repeatU = true) {
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; if (repeatU) t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; return t;
  }
  /** canvas y for a vertical texture coordinate v (0 = ground) */
  const Y = (v, h) => (1 - v) * h;

  /* Qatar-inspired lattice: faint diamond (sadu) weave repeated around the garment. */
  function lattice(ctx, w, h, color, alpha, cells) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    const cw = w / cells, ch = cw * 0.9;
    for (let y = -ch; y < h + ch; y += ch) for (let i = 0; i <= cells; i++) {
      const x = i * cw + ((Math.round(y / ch) % 2) ? cw / 2 : 0);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw / 2, y + ch / 2); ctx.lineTo(x, y + ch); ctx.lineTo(x - cw / 2, y + ch / 2); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  function weave(ctx, w, h, a = 0.05) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    ctx.restore();
  }

  /** erase everything below/above the given v (so hems are perfectly straight lines) */
  function cut(x, w, h, belowV, aboveV) {
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000';
    if (belowV != null) x.fillRect(0, Y(belowV, h), w, h - Y(belowV, h) + 2);
    if (aboveV != null) x.fillRect(0, -2, w, Y(aboveV, h) + 2);
    x.restore();
  }
  function jerseyTexture(k, L, sleeve) {
    const w = 1024, h = 1024, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = k.jersey; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, Y(L.jerseyHem, h), 0, Y(L.collarV, h)); g.addColorStop(0, k.jersey2); g.addColorStop(0.5, k.jersey); g.addColorStop(1, k.jersey);
    x.globalAlpha = 0.55; x.fillStyle = g; x.fillRect(0, Y(L.collarV, h), w, Y(L.jerseyHem, h) - Y(L.collarV, h)); x.globalAlpha = 1;
    x.fillStyle = k.jersey2; x.globalAlpha = 0.30; for (const u of [0.25, 0.75]) x.fillRect((u - 0.045) * w, 0, 0.09 * w, h); x.globalAlpha = 1;
    lattice(x, w, h, k.trim, 0.045, 14);
    weave(x, w, h, 0.02);
    // trim sits inside the garment edge (hems are cut by alpha)
    // crew-neck rib: a thin band in the darker body colour with a fine accent line (a wide light band read as a ragged ruff on the shoulders)
    x.fillStyle = k.collar || k.jersey2; x.fillRect(0, Y(L.collarV, h), w, 0.006 * h);
    x.fillStyle = k.accent; x.globalAlpha = 0.85; x.fillRect(0, Y(L.collarV - 0.006, h), w, 0.0018 * h); x.globalAlpha = 1;
    x.fillStyle = k.collar || k.jersey2; x.fillRect(0, Y(L.jerseyHem + 0.008, h), w, 0.008 * h);
    x.fillStyle = k.accent; x.globalAlpha = 0.8; x.fillRect(0, Y(L.jerseyHem + 0.010, h), w, 0.002 * h); x.globalAlpha = 1;
    if (sleeve) { x.fillStyle = k.trim; x.fillRect(0, Y(L.sleeveV + 0.026, h), w, 0.026 * h); x.fillStyle = k.accent; x.fillRect(0, Y(L.sleeveV + 0.028, h), w, 0.004 * h); cut(x, w, h, L.sleeveV, null); }
    else cut(x, w, h, L.jerseyHem, L.collarV);
    return x.canvas;
  }
  function shortsTexture(k, L) {
    const w = 512, h = 1024, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = k.shorts; x.fillRect(0, 0, w, h);
    weave(x, w, h, 0.025);
    x.fillStyle = k.shortsStripe;
    for (const u of [0.25, 0.75]) x.fillRect((u - 0.022) * w, 0, 0.044 * w, h);
    x.fillStyle = k.accent || k.shortsStripe; x.globalAlpha = 0.9; for (const u of [0.25, 0.75]) x.fillRect((u - 0.03) * w, 0, 0.006 * w, h); x.globalAlpha = 1;
    x.fillStyle = k.trim || k.shortsStripe; x.globalAlpha = 0.9; x.fillRect(0, Y(L.waistV, h), w, 0.014 * h); x.globalAlpha = 1;
    x.fillStyle = k.shortsStripe; x.fillRect(0, Y(L.shortsHemV + 0.014, h), w, 0.014 * h);
    cut(x, w, h, L.shortsHemV, null);
    return x.canvas;
  }
  function socksTexture(k, L) {
    const w = 256, h = 1024, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = k.socks; x.fillRect(0, 0, w, h);
    x.globalAlpha = 0.10; x.fillStyle = '#000'; for (let i = 0; i < w; i += 3) x.fillRect(i, 0, 1, h); x.globalAlpha = 1;
    x.fillStyle = k.sockBand; x.fillRect(0, Y(L.sockTopV, h), w, 0.020 * h); x.fillRect(0, Y(L.sockTopV - 0.040, h), w, 0.012 * h);
    cut(x, w, h, null, L.sockTopV);
    return x.canvas;
  }
  function bootsTexture(k, L) {
    const w = 64, h = 1024, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = k.boots; x.fillRect(0, 0, w, h);
    x.fillStyle = k.accent; x.globalAlpha = 0.7; x.fillRect(0, Y(L.bootTopV, h), w, 0.006 * h); x.globalAlpha = 1;
    // sole edge and a side flash so the boot reads as a football boot at match distance
    const soleV = 0.016 / L.H; x.fillStyle = k.sole || '#d8d4cc'; x.fillRect(0, Y(soleV, h), w, h - Y(soleV, h));
    x.fillStyle = k.accent; x.globalAlpha = 0.9; x.fillRect(0, Y(soleV + 0.022 / L.H, h), w, 0.006 * h); x.globalAlpha = 1;
    cut(x, w, h, null, L.bootTopV);
    return x.canvas;
  }

  const cache = new Map();
  /** Shared materials for a kit (one set per kit id). Order of the kit mesh groups: jersey, sleeves, shorts, socks, boots. */
  function materials(kitId, landmarks) {
    const key = kitId; if (cache.has(key)) return cache.get(key);
    const k = KITS[kitId], H = landmarks.stature;
    const L = { H, collarV: landmarks.collarY / H, sleeveV: landmarks.sleeveEnd / H, jerseyHem: landmarks.jerseyHem / H, waistV: landmarks.waistY / H, shortsHemV: landmarks.shortsHem / H, sockTopV: landmarks.sockTop / H, bootTopV: landmarks.bootTop / H };
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.82, metalness: 0, vertexColors: true }, o));
    const cutMat = (canvasEl, o) => std(Object.assign({ map: tex(canvasEl), alphaTest: 0.5, side: THREE.DoubleSide }, o));
    const m = {
      jersey: cutMat(jerseyTexture(k, L, false), { roughness: 0.78 }),
      sleeve: cutMat(jerseyTexture(k, L, true), { roughness: 0.78 }),
      shorts: cutMat(shortsTexture(k, L), { roughness: 0.8 }),
      socks: cutMat(socksTexture(k, L), { roughness: 0.9 }),
      boots: cutMat(bootsTexture(k, L), { roughness: 0.38, metalness: 0.05 }),
      glove: std({ color: FB.color(k.glove || '#e8ff4d'), roughness: 0.55 }),
      flat: { jersey: std({ color: FB.color(k.jersey) }), shorts: std({ color: FB.color(k.shorts) }), socks: std({ color: FB.color(k.socks) }), boots: std({ color: FB.color(k.boots), roughness: 0.4 }), glove: std({ color: FB.color(k.glove || '#e8ff4d') }) }
    };
    cache.set(key, m); return m;
  }

  /** number / name decal textures */
  function numberTexture(k, number, mode) {
    const c = canvas(256, 256), x = c.getContext('2d');
    x.clearRect(0, 0, 256, 256); x.textAlign = 'center'; x.textBaseline = 'middle';
    if (mode === 'number') {
      x.font = 'bold 190px Arial, "DejaVu Sans", sans-serif'; x.lineWidth = 12; x.strokeStyle = k.numberOutline; x.fillStyle = k.numberColor;
      x.strokeText(String(number), 128, 140); x.fillText(String(number), 128, 140);
    } else if (mode === 'name') {
      x.font = 'bold 54px Arial, "DejaVu Sans", sans-serif'; x.fillStyle = k.numberColor; x.fillText(String(number).toUpperCase(), 128, 128);
    } else if (mode === 'crest') {
      // school crest: crescent-and-star in a shield, original geometric design
      x.fillStyle = k.accent; x.beginPath(); x.moveTo(40, 30); x.lineTo(216, 30); x.lineTo(216, 130); x.quadraticCurveTo(216, 220, 128, 236); x.quadraticCurveTo(40, 220, 40, 130); x.closePath(); x.fill();
      x.fillStyle = k.crestA || k.jersey; x.beginPath(); x.moveTo(52, 42); x.lineTo(204, 42); x.lineTo(204, 128); x.quadraticCurveTo(204, 208, 128, 224); x.quadraticCurveTo(52, 208, 52, 128); x.closePath(); x.fill();
      x.fillStyle = '#f7f2e8'; x.beginPath(); x.arc(128, 120, 46, 0, Math.PI * 2); x.fill(); x.fillStyle = k.crestA || k.jersey; x.beginPath(); x.arc(142, 120, 40, 0, Math.PI * 2); x.fill();
      x.fillStyle = k.accent; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5, r = 16; i ? x.lineTo(150 + Math.cos(a) * r, 120 + Math.sin(a) * r) : (x.beginPath(), x.moveTo(150 + Math.cos(a) * r, 120 + Math.sin(a) * r)); } x.closePath(); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }

  FB.Kit = { KITS, materials, numberTexture, clearCache() { cache.clear(); } };
})(typeof window !== 'undefined' ? window : globalThis);
