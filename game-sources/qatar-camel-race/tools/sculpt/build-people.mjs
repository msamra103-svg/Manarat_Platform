import { writeFileSync } from "node:fs";
import { Sculpt, ellipsoid as E, roundCone as RC, torus, roundBox } from "./sdf.mjs";
import { meshSDF, simplify, gradient } from "./mesher.mjs";
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1e3).toFixed(1)}s]`, ...a);
const SKINS = ["#c08d66", "#a77650", "#d0a07a", "#8d5f41"];
const COL = {
  cloth: "#f3f2ed",
  ghutra: "#fbfbf8",
  hair: "#221912",
  grey: "#8a8580",
  agal: "#121212",
  shoe: "#3d2b1e",
  bisht: "#2c2119",
  bishtBrown: "#4a3524",
  trim: "#c9a24b",
  eye: "#17110d",
  lips: "#8a5a48"
};
function head(S, y0, o) {
  const y = (v) => v + y0;
  S.add(E([0, y(1.705), -8e-3], [0.104, 0.104, 0.117]), 0.01, "ghutra");
  S.add(RC([0, y(1.7), -0.03], [0, y(1.355), -0.055], 0.1, 0.228, 0.6), 0.03, "ghutra");
  S.add(E([0, y(1.8), 0.035], [0.062, 0.022, 0.055]), 0.02, "ghutra");
  for (const s of [1, -1]) S.add(roundBox([s * 0.118, y(1.31), 0.085], [0.05, 0.16, 7e-3], 4e-3, { z: s * 0.08, x: -0.12 }), 0.03, "ghutra");
  S.sub(E([0, y(1.585), 0.13], [0.076, 0.16, 0.112]), 0.016);
  S.add(RC([0, y(1.44), 5e-3], [0, y(1.57), 0.012], 0.05, 0.046), 0.02, "skin");
  S.add(E([0, y(1.675), -4e-3], [0.08, 0.104, 0.096]), 0.01, "skin");
  S.add(E([0, y(1.603), 0.028], [0.069, 0.07, 0.072]), 0.03, "skin");
  for (const s of [1, -1]) S.add(E([s * 0.045, y(1.642), 0.062], [0.03, 0.022, 0.028]), 0.02, "skin");
  S.add(E([0, y(1.69), 0.074], [0.066, 0.016, 0.028]), 0.015, "skin");
  S.add(RC([0, y(1.668), 0.083], [0, y(1.62), 0.104], 0.011, 0.017), 0.012, "skin");
  for (const s of [1, -1]) {
    S.sub(E([s * 0.031, y(1.666), 0.089], [0.016, 0.01, 0.012]), 5e-3);
    S.add(E([s * 0.031, y(1.665), 0.084], [9e-3, 6e-3, 6e-3]), 2e-3, "eye");
  }
  S.add(E([0, y(1.598), 0.093], [0.024, 8e-3, 0.01]), 6e-3, "lips");
  if (o.beard) S.add(E([0, y(1.578), 0.046], [0.071, 0.062, 0.071]), 0.014, o.greyBeard ? "grey" : "hair");
  S.add(E([0, y(1.613), 0.096], [0.033, 9e-3, 0.012]), 6e-3, o.greyBeard ? "grey" : "hair");
  if (o.agal) {
    S.add(torus([0, y(1.768), -0.012], 0.093, 0.0115, { x: 0.12 }), 4e-3, "agal");
    S.add(torus([0, y(1.792), -0.016], 0.089, 0.011, { x: 0.12 }), 4e-3, "agal");
  }
}
function standingBody(S, o) {
  for (const s of [1, -1]) {
    S.add(E([s * 0.09, 0.035, 0.065], [0.045, 0.032, 0.11]), 0.01, "shoe");
    S.add(RC([s * 0.09, 0.04, 0.02], [s * 0.09, 0.13, 0], 0.036, 0.034), 0.01, "skin");
  }
  S.add(RC([0, 0.1, 0], [0, 0.92, 0], 0.205, 0.18, 0.66), 0.02, "cloth");
  S.add(E([0, 0.98, 0], [0.18, 0.14, 0.13]), 0.06, "cloth");
  S.add(E([0, 1.24, 0.012], [0.19, 0.22, 0.125]), 0.07, "cloth");
  S.add(E([0, 1.31, -0.04], [0.17, 0.16, 0.1]), 0.05, "cloth");
  for (const s of [1, -1]) S.add(E([s * 0.168, 1.415, -4e-3], [0.075, 0.055, 0.075]), 0.06, "cloth");
  S.add(torus([0, 1.468, 0.012], 0.052, 8e-3, { x: 0.25 }), 4e-3, "cloth");
  S.displace((x, y, z, d) => {
    if (y > 0.95 || Math.abs(d) > 0.02) return 0;
    const a = Math.atan2(x, z);
    return 35e-4 * Math.sin(a * 9 + y * 3) * Math.min(1, (0.95 - y) / 0.4);
  });
  if (o.bisht) bisht(S, 0);
}
function seatedBody(S, o) {
  for (const s of [1, -1]) {
    S.add(RC([s * 0.1, 0.5, 0], [s * 0.1, 0.49, 0.42], 0.092, 0.08), 0.03, "cloth");
    S.add(RC([s * 0.1, 0.47, 0.43], [s * 0.1, 0.09, 0.47], 0.075, 0.085, 0.8), 0.03, "cloth");
    S.add(E([s * 0.1, 0.035, 0.53], [0.045, 0.032, 0.105]), 0.01, "shoe");
  }
  S.add(E([0, 0.56, 0], [0.19, 0.12, 0.15]), 0.05, "cloth");
  S.add(E([0, 0.8, 0.012], [0.19, 0.22, 0.125]), 0.07, "cloth");
  S.add(E([0, 0.87, -0.04], [0.17, 0.16, 0.1]), 0.05, "cloth");
  for (const s of [1, -1]) S.add(E([s * 0.168, 0.975, -4e-3], [0.075, 0.055, 0.075]), 0.06, "cloth");
  S.add(torus([0, 1.028, 0.012], 0.052, 8e-3, { x: 0.25 }), 4e-3, "cloth");
  S.displace((x, y, z, d) => {
    if (z < 0.1 || y > 0.55 || Math.abs(d) > 0.02) return 0;
    return 3e-3 * Math.sin(x * 70 + z * 9);
  });
  if (o.bisht) bisht(S, -0.44);
}
function bisht(S, dy) {
  S.add(RC([0, 1.43 + dy, -0.012], [0, 0.32 + Math.max(dy * 0.2, -0.1), -0.03], 0.232, 0.29, 0.66), 0.03, "bisht");
  for (const s of [1, -1]) S.add(E([s * 0.19, 1.415 + dy, -4e-3], [0.088, 0.066, 0.088]), 0.05, "bisht");
  S.sub(roundBox([0, 0.9 + dy, 0.24], [0.075, 0.62, 0.09], 0.02, { x: -0.06 }), 0.02, "opening");
}
function arm(S, o) {
  const tag = o.bisht ? "bisht" : "cloth";
  S.add(RC([0, 0, 0], [0, -0.285, 0.012], 0.058, 0.05), 0.02, tag);
  S.add(RC([0, -0.285, 0.012], [0, -0.5, 0.07], 0.05, 0.047), 0.02, tag);
  S.add(E([0, -0.505, 0.073], [0.05, 0.02, 0.05]), 0.01, tag);
  S.add(E([0, -0.575, 0.085], [0.028, 0.055, 0.022], { x: -0.25 }), 0.012, "skin");
  S.add(E([0.022, -0.555, 0.098], [9e-3, 0.026, 0.01], { x: -0.4, z: 0.3 }), 6e-3, "skin");
}
const TYPES = [
  { key: "whiteBeard", skin: 0, agal: true, beard: true },
  { key: "shemaghBeard", skin: 1, agal: true, beard: true, shemagh: true },
  { key: "whiteYoung", skin: 2, agal: true, beard: false },
  { key: "bishtElder", skin: 3, agal: true, beard: true, greyBeard: true, bisht: COL.bisht },
  { key: "seatedWhite", skin: 1, agal: true, beard: true, seated: true },
  { key: "seatedShemagh", skin: 0, agal: true, beard: false, seated: true, shemagh: true },
  { key: "shemaghYoung", skin: 2, agal: true, beard: false, shemagh: true },
  { key: "bishtBrown", skin: 0, agal: true, beard: true, bisht: COL.bishtBrown }
];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
async function meshPart(S, f, box, h, lods, colorOf) {
  let { positions, indices } = meshSDF(f, { min: box[0], max: box[1], h });
  let agree = 0;
  for (let i = 0; i < indices.length; i += 30) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const g = gradient(f, positions[a], positions[a + 1], positions[a + 2]);
    agree += Math.sign((uy * vz - uz * vy) * g[0] + (uz * vx - ux * vz) * g[1] + (ux * vy - uy * vx) * g[2]);
  }
  if (agree < 0) for (let i = 0; i < indices.length; i += 3) {
    const t = indices[i + 1];
    indices[i + 1] = indices[i + 2];
    indices[i + 2] = t;
  }
  const nv = positions.length / 3;
  const attrs = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    let best = "cloth", bd = 1e9;
    for (const tag of Object.keys(S.tags)) {
      if (tag === "opening") continue;
      const d = Math.abs(S.tagDist(tag, x, y, z));
      if (d < bd) {
        bd = d;
        best = tag;
      }
    }
    const c = colorOf(best, x, y, z).rgb;
    for (let k = 0; k < 3; k++) attrs[v * 3 + k] = c[k] / 255;
  }
  const out2 = [];
  for (const [k, tris] of lods.entries()) {
    const s = await simplify(positions, indices, tris, k === 0 ? 6e-3 : 0.03, attrs, [0.35, 0.35, 0.35]);
    out2.push(pack(S, f, s.positions, s.indices, colorOf));
  }
  return out2;
}
function pack(S, f, P, I, colorOf) {
  const n = P.length / 3;
  const nrm = new Int8Array(n * 3), col = new Uint8Array(n * 3), tint = new Uint8Array(n), pat = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const g = gradient(f, x, y, z, 2e-3);
    for (let c2 = 0; c2 < 3; c2++) nrm[v * 3 + c2] = Math.round(g[c2] * 127);
    let occ = 0;
    for (let i = 1; i <= 4; i++) {
      const dd = i * 0.02;
      occ += (dd - f(x + g[0] * dd, y + g[1] * dd, z + g[2] * dd)) / 2 ** i;
    }
    const ao = Math.max(0.45, Math.min(1, 1 - 2.4 * Math.max(0, occ)));
    let best = "cloth", bd = 1e9;
    for (const tag of Object.keys(S.tags)) {
      if (tag === "opening") continue;
      const d = Math.abs(S.tagDist(tag, x, y, z));
      if (d < bd) {
        bd = d;
        best = tag;
      }
    }
    const c = colorOf(best, x, y, z);
    for (let k = 0; k < 3; k++) col[v * 3 + k] = Math.round(c.rgb[k] * ao);
    tint[v] = c.tint ? 255 : 0;
    pat[v] = c.pattern ? 255 : 0;
  }
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
  const min = [0, 1, 2].map((c) => Math.min(...Array.from({ length: n }, (_, v) => P[v * 3 + c])));
  const max = [0, 1, 2].map((c) => Math.max(...Array.from({ length: n }, (_, v) => P[v * 3 + c])));
  const q = new Uint16Array(n * 3);
  for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) q[v * 3 + c] = Math.round((P[v * 3 + c] - min[c]) / (max[c] - min[c] || 1) * 65535);
  return { count: n, min, max, pos: b64(q), idx: b64(Uint16Array.from(I)), nrm: b64(nrm), col: b64(col), tint: b64(tint), pat: b64(pat) };
}
const SCULPTS = { current: null };
const H = Number(process.argv[2] || 65e-4);
const out = { types: [] };
for (const T of TYPES) {
  const skin = hex(SKINS[T.skin]);
  const colorOf = (tag, x, y, z) => {
    switch (tag) {
      case "skin":
        return { rgb: skin };
      case "eye":
        return { rgb: hex(COL.eye) };
      case "lips":
        return { rgb: hex(COL.lips) };
      case "hair":
        return { rgb: hex(COL.hair) };
      case "grey":
        return { rgb: hex(COL.grey) };
      case "agal":
        return { rgb: hex(COL.agal) };
      case "shoe":
        return { rgb: hex(COL.shoe) };
      case "ghutra":
        return { rgb: hex(COL.ghutra), pattern: !!T.shemagh };
      case "bisht": {
        const S2 = SCULPTS.current;
        const edge = Math.abs(S2.tagDist("opening", x, y, z));
        return { rgb: hex(edge < 0.03 && z > 0 ? COL.trim : T.bisht) };
      }
      default:
        return { rgb: hex(COL.cloth), tint: true };
    }
  };
  const S = new Sculpt();
  if (T.seated) seatedBody(S, T);
  else standingBody(S, T);
  head(S, T.seated ? -0.44 : 0, T);
  SCULPTS.current = S;
  const f = (x, y, z) => Math.max(S.d(x, y, z), -y);
  const top = T.seated ? 1.42 : 1.86;
  const body = await meshPart(S, f, [[-0.32, -0.01, -0.25], [0.32, top, T.seated ? 0.66 : 0.3]], H, [1250, 400], colorOf);
  const A = new Sculpt();
  arm(A, T);
  SCULPTS.current = A;
  const fa = (x, y, z) => A.d(x, y, z);
  const armM = await meshPart(A, fa, [[-0.08, -0.65, -0.08], [0.08, 0.07, 0.14]], H * 0.9, [150, 56], colorOf);
  const shoulderY = (T.seated ? 1.415 - 0.44 : 1.415) - 0.01;
  out.types.push({ key: T.key, seated: !!T.seated, bisht: !!T.bisht, shemagh: !!T.shemagh, shoulderY, shoulderX: 0.205, body, arm: armM });
  log(T.key, "body", body.map((b) => b.count).join("/"), "arm", armM.map((b) => b.count).join("/"));
}
const js = `// ملف مولَّد آليًا بواسطة tools/sculpt/build-people.mjs — لا تعدّله يدويًا.
// نماذج المتفرجين (رجال بالثوب والغترة/الشماغ والعقال والبشت) بمستويي تفاصيل.
export default ${JSON.stringify(out)};
`;
writeFileSync(new URL("../../src/scene/people.data.mjs", import.meta.url), js);
log("written", (js.length / 1024).toFixed(0), "KB");
export {
  TYPES
};
