import * as THREE from "three";
import { createRng } from "../core/random.mjs";
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function tileNoise(grid, period, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const idx = (ix, iy) => grid[(iy % period + period) % period * period + (ix % period + period) % period];
  const a = idx(xi, yi), b = idx(xi + 1, yi), c = idx(xi, yi + 1), d = idx(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function makeTileFbm(seed, baseCells, octaves) {
  const rng = createRng(seed);
  const layers = [];
  for (let o = 0; o < octaves; o++) {
    const period = baseCells * (1 << o);
    const grid = new Float32Array(period * period);
    for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
    layers.push({ period, grid, amp: Math.pow(0.5, o) });
  }
  return (u, v) => {
    let s = 0, n = 0;
    for (const L of layers) {
      s += L.amp * tileNoise(L.grid, L.period, u * L.period, v * L.period);
      n += L.amp;
    }
    return s / n;
  };
}
function heightToNormalCanvas(height, w, h, strength) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const H = (x, y) => height[(y + h) % h * w + (x + w) % w];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function toTexture(canvas, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}
const cache = /* @__PURE__ */ new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}
function disposeTextureCache() {
  for (const v of cache.values()) {
    if (v && v.dispose) v.dispose();
    else if (v && typeof v === "object") for (const k in v) v[k]?.dispose?.();
  }
  cache.clear();
}
function getCamelFurMaps() {
  return cached("camelFur", () => {
    const W = 512, Hh = 512;
    const rng = createRng(5);
    const fbm = makeTileFbm(11, 8, 4);
    const colorC = makeCanvas(W, Hh), heightC = makeCanvas(W, Hh);
    const cc = colorC.getContext("2d"), hc = heightC.getContext("2d");
    const img = cc.createImageData(W, Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const n = fbm(x / W, y / Hh);
      const t = 0.9 + (n - 0.5) * 0.12;
      const i = (y * W + x) * 4;
      img.data[i] = t * 255;
      img.data[i + 1] = t * 0.985 * 255;
      img.data[i + 2] = t * 0.955 * 255;
      img.data[i + 3] = 255;
    }
    cc.putImageData(img, 0, 0);
    hc.fillStyle = "#808080";
    hc.fillRect(0, 0, W, Hh);
    const strand = (ctx, x, y, len, ang, style, width) => {
      for (const ox of [0, -W, W]) for (const oy of [0, -Hh, Hh]) {
        const sx = x + ox, sy = y + oy;
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > Hh + 20) continue;
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + Math.sin(ang) * len * 0.5 + 1, sy + Math.cos(ang) * len * 0.5, sx + Math.sin(ang) * len, sy + Math.cos(ang) * len);
        ctx.stroke();
      }
    };
    for (let k = 0; k < 14e3; k++) {
      const x = rng.next() * W, y = rng.next() * Hh;
      const len = 5 + rng.next() * 11, ang = (rng.next() - 0.5) * 0.5;
      const light = rng.next() < 0.5;
      strand(cc, x, y, len, ang, light ? "rgba(255,248,235,0.22)" : "rgba(60,40,20,0.16)", 1);
      strand(hc, x, y, len, ang, light ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)", 1.2);
    }
    const hd = hc.getImageData(0, 0, W, Hh).data;
    const height = new Float32Array(W * Hh);
    for (let i = 0; i < W * Hh; i++) height[i] = hd[i * 4] / 255;
    const normal = heightToNormalCanvas(height, W, Hh, 1.6);
    return {
      map: toTexture(colorC, { repeat: [3, 6], aniso: 8 }),
      normalMap: toTexture(normal, { repeat: [3, 6], srgb: false, aniso: 8 })
    };
  });
}
function getSandMaps(kind = "track") {
  return cached("sand_" + kind, () => {
    const W = 1024, Hh = 1024;
    const track = kind === "track";
    const fbm = makeTileFbm(track ? 31 : 37, 5, 6);
    const mid = makeTileFbm(track ? 53 : 59, 24, 4);
    const fine = makeTileFbm(41, 128, 2);
    const rng = createRng(track ? 9 : 13);
    const height = new Float32Array(W * Hh);
    const shade = new Float32Array(W * Hh);
    for (let y = 0; y < Hh; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / Hh;
        const n = fbm(u, v), m = mid(u, v), f = fine(u, v);
        let hgt = n * 0.5 + m * 0.28 + f * 0.14 + rng.next() * 0.08;
        if (!track) hgt += Math.sin((v * 34 + n * 2.4 + m * 0.6) * Math.PI * 2) * 0.07 * (0.4 + n);
        height[y * W + x] = hgt;
        shade[y * W + x] = 0.9 + (n - 0.5) * 0.22 + (m - 0.5) * 0.14 + (f - 0.5) * 0.1 + (rng.next() - 0.5) * 0.09;
      }
    }
    if (track) {
      for (let y = 0; y < Hh; y++) {
        const g1 = Math.sin(y / Hh * Math.PI * 2 * 84 + Math.sin(y * 0.031) * 0.9);
        const g2 = Math.sin(y / Hh * Math.PI * 2 * 19);
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const wob = fbm(x / W * 2, y / Hh * 0.5) - 0.35;
          const f = (g1 * 0.5 + g2 * 0.2) * Math.max(0, wob + 0.25);
          height[i] += f * 0.085;
          shade[i] += f * 0.012;
        }
      }
      for (let k = 0; k < 900; k++) {
        const cx = Math.floor(rng.next() * W), cy = Math.floor(rng.next() * Hh);
        const rx = 7 + rng.next() * 4, ry = 6 + rng.next() * 3, depth = 0.1 + rng.next() * 0.14;
        for (let dy = -12; dy <= 12; dy++) for (let dx = -14; dx <= 14; dx++) {
          const xx = (cx + dx + W) % W, yy = (cy + dy + Hh) % Hh;
          const d = Math.sqrt(dx * dx / (rx * rx) + dy * dy / (ry * ry));
          const i = yy * W + xx;
          if (d < 1) {
            height[i] -= (1 - d * d) * depth;
            shade[i] -= (1 - d) * 0.035;
          } else if (d < 1.35) height[i] += (1.35 - d) * depth * 0.6;
        }
      }
    }
    const c = makeCanvas(W, Hh);
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(W, Hh);
    const base = track ? [203, 172, 130] : [214, 187, 146];
    for (let i = 0; i < W * Hh; i++) {
      const k = shade[i];
      const speck = rng.next();
      const sp = speck > 0.992 ? 1.18 : speck < 0.012 ? 0.72 : 1;
      img.data[i * 4] = Math.min(255, base[0] * k * sp);
      img.data[i * 4 + 1] = Math.min(255, base[1] * k * sp);
      img.data[i * 4 + 2] = Math.min(255, base[2] * k * (sp > 1 ? sp : sp * 0.98));
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const normal = heightToNormalCanvas(height, W, Hh, track ? 4.2 : 3);
    return {
      map: toTexture(c, { aniso: 8 }),
      normalMap: toTexture(normal, { srgb: false, aniso: 8 })
    };
  });
}
function addMacroVariation(material, strength = 1) {
  material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      #ifdef USE_MAP
        float qmA = texture2D(map, vMapUv * 0.043 + 0.17).r;
        float qmB = texture2D(map, vMapUv * 0.0119 + 0.53).g;
        float qmC = texture2D(map, vMapUv * 0.31 + 0.71).r;
        diffuseColor.rgb *= 1.0 + ${strength.toFixed(2)} * ((qmA - 0.68) * 0.9 + (qmB - 0.6) * 0.8 + (qmC - 0.68) * 0.35);
      #endif`);
  };
  material.customProgramCacheKey = () => "qcr-macro-" + strength;
  return material;
}
const QATAR_MAROON = "#8a1538";
function getQatarFlagTexture() {
  return cached("qatarFlag", () => {
    const W = 560, Hh = 220;
    const c = makeCanvas(W, Hh);
    const ctx = c.getContext("2d");
    ctx.fillStyle = QATAR_MAROON;
    ctx.fillRect(0, 0, W, Hh);
    const bandW = W * (8 / 28);
    const toothDepth = W * (3 / 28) * 0.72;
    const teeth = 9;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bandW, 0);
    for (let i = 0; i < teeth; i++) {
      const y0 = i / teeth * Hh;
      const y1 = (i + 0.5) / teeth * Hh;
      const y2 = (i + 1) / teeth * Hh;
      ctx.lineTo(bandW + toothDepth, y1);
      ctx.lineTo(bandW, y2);
      void y0;
    }
    ctx.lineTo(0, Hh);
    ctx.closePath();
    ctx.fill();
    const t = toTexture(c, { aniso: 4 });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}
function makeClothTexture({ color, trim, number, isPlayer = false }) {
  const W = 512, Hh = 512, half = 256;
  const c = makeCanvas(W, Hh);
  const ctx = c.getContext("2d");
  const rng = createRng(number * 97 + 3);
  for (let s = 0; s < 2; s++) {
    const y0 = s * half;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, W, half);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(0, y0, W, half);
    ctx.globalAlpha = 0.07;
    for (let y = 0; y < half; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? "#000" : "#fff";
      ctx.fillRect(0, y0 + y, W, 1);
    }
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = rng.next() < 0.5 ? "#000" : "#fff";
      ctx.fillRect(rng.next() * W, y0 + rng.next() * half, 2, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = trim;
    ctx.fillRect(0, y0 + half - 30, W, 30);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let x = 4; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y0 + half - 30);
      ctx.lineTo(x + 9, y0 + half - 16);
      ctx.lineTo(x + 18, y0 + half - 30);
      ctx.fill();
    }
    ctx.fillStyle = trim;
    ctx.fillRect(0, y0, 14, half);
    ctx.fillRect(W - 14, y0, 14, half);
    const cx = W * 0.5, cy = y0 + half * 0.47;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 78, 74, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = trim;
    ctx.stroke();
    ctx.fillStyle = isPlayer ? QATAR_MAROON : "#141414";
    ctx.font = '800 118px "QCR Cairo", Cairo, Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), cx, cy + 6);
    ctx.restore();
  }
  const t = toTexture(c, { aniso: 8 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function makeSilkTexture(color, trim) {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = trim;
  ctx.fillRect(0, 54, 128, 20);
  ctx.globalAlpha = 0.1;
  for (let y = 0; y < 128; y += 3) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, y, 128, 1);
  }
  ctx.globalAlpha = 1;
  const t = toTexture(c);
  return t;
}
function getSoftParticleTexture() {
  return cached("softParticle", () => {
    const c = makeCanvas(64, 64);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.35, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
function getContactShadowTexture() {
  return cached("contactShadow", () => {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.5, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    return t;
  });
}
function getFootprintTexture() {
  return cached("footprint", () => {
    const c = makeCanvas(96, 96);
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 96, 96);
    const g = ctx.createRadialGradient(44, 46, 3, 48, 48, 40);
    g.addColorStop(0, "rgba(84,66,46,0.5)");
    g.addColorStop(0.6, "rgba(96,76,54,0.3)");
    g.addColorStop(1, "rgba(120,96,70,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(48, 48, 40, 33, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,244,222,0.3)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(48, 48, 38, 31, 0, -0.4, Math.PI * 0.75);
    ctx.stroke();
    ctx.strokeStyle = "rgba(60,44,28,0.38)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(48, 48, 36, 29, 0, Math.PI * 0.95, Math.PI * 1.75);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(82, 48);
    ctx.lineTo(60, 48);
    ctx.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
function getSkyTexture() {
  return cached("sky", () => {
    const c = makeCanvas(16, 512);
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#5f97cf");
    g.addColorStop(0.42, "#9cc3e0");
    g.addColorStop(0.5, "#d9dfd6");
    g.addColorStop(0.53, "#ecd9b6");
    g.addColorStop(1, "#e8cfa2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
function makeTextBanner(text, { bg = QATAR_MAROON, fg = "#fff", w = 1024, h = 160, font = '800 92px "QCR Cairo", Arial' } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillText(text, w / 2, h / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function bleedTransparent(canvas, hex) {
  const ctx = canvas.getContext("2d");
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const c = new THREE.Color(hex);
  for (let i = 0; i < d.data.length; i += 4) {
    const a = d.data[i + 3];
    if (a < 255) {
      const k = a / 255;
      d.data[i] = d.data[i] * k + c.r * 255 * (1 - k);
      d.data[i + 1] = d.data[i + 1] * k + c.g * 255 * (1 - k);
      d.data[i + 2] = d.data[i + 2] * k + c.b * 255 * (1 - k);
    }
  }
  ctx.putImageData(d, 0, 0);
}
export {
  QATAR_MAROON,
  addMacroVariation,
  bleedTransparent,
  disposeTextureCache,
  getCamelFurMaps,
  getContactShadowTexture,
  getFootprintTexture,
  getQatarFlagTexture,
  getSandMaps,
  getSkyTexture,
  getSoftParticleTexture,
  makeClothTexture,
  makeSilkTexture,
  makeTextBanner
};
