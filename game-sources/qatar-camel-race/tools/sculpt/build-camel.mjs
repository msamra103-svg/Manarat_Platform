import { writeFileSync } from "node:fs";
import { buildCamelSculpt, HEAD_FEATURES } from "./camelSculpt.mjs";
import { meshSDF, simplify, gradient, relax } from "./mesher.mjs";
import { LEGS, SPINE_JOINTS, TAIL_JOINTS } from "../../src/camel/camelAnatomy.mjs";
const H = Number(process.argv[2] || 8e-3);
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1e3).toFixed(1)}s]`, ...a);
const { S, f } = buildCamelSculpt();
let { positions, indices } = meshSDF(f, { min: [-1.06, -0.012, -0.37], max: [2.56, 2.1, 0.37], h: H, log });
{
  let agree = 0;
  for (let i = 0; i < indices.length; i += 300) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const g = gradient(f, positions[a], positions[a + 1], positions[a + 2]);
    agree += Math.sign(nx * g[0] + ny * g[1] + nz * g[2]);
  }
  if (agree < 0) for (let i = 0; i < indices.length; i += 3) {
    const t = indices[i + 1];
    indices[i + 1] = indices[i + 2];
    indices[i + 2] = t;
  }
  log("winding agree", agree);
}
const BONES = ["root", "body", "pelvis", "spine", "chest", "neck0", "neck1", "neck2", "neck3", "head", "tail0", "tail1", "tail2"];
for (const id of ["FL", "FR", "HL", "HR"]) for (let i = 0; i < 5; i++) BONES.push(`leg_${id}_${i}`);
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
const J = SPINE_JOINTS;
const spineChain = [["pelvis", J.pelvis], ["spine", J.spine], ["chest", J.chest], ["neck0", J.neck0], ["neck1", J.neck1], ["neck2", J.neck2], ["neck3", J.neck3], ["head", J.head], ["head", J.headTip]];
function nearestOnChain(p, pts) {
  let best = { d: 1e9, i: 0, t: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const ab = [b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)];
    const ap = [p[0] - a[0], p[1] - a[1], p[2] - (a[2] || 0)];
    const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2));
    const d = Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
    if (d < best.d) best = { d, i, t, len: Math.sqrt(l2) };
  }
  return best;
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function bodyWeights(p) {
  const w = /* @__PURE__ */ new Map();
  if (p[0] < J.pelvis[0]) {
    w.set(BI.pelvis, 1);
    return w;
  }
  const pts = spineChain.map((c) => c[1]);
  const n = nearestOnChain([p[0], p[1], 0], pts);
  const names = spineChain.map((c) => c[0]);
  const s = n.t * n.len, remain = n.len - s;
  const blend = p[0] < 0.75 ? 0.24 : 0.12;
  const a = BI[names[n.i]];
  if (remain < blend && n.i + 1 < names.length - 1) {
    const k = 0.5 * (1 - remain / blend);
    w.set(a, 1 - k);
    w.set(BI[names[n.i + 1]], (w.get(BI[names[n.i + 1]]) || 0) + k);
  } else if (s < blend && n.i > 0) {
    const k = 0.5 * (1 - s / blend);
    w.set(a, 1 - k);
    w.set(BI[names[n.i - 1]], (w.get(BI[names[n.i - 1]]) || 0) + k);
  } else w.set(a, 1);
  return w;
}
const LEG_R = { front: [0.11, 0.07, 0.05, 0.045, 0.07], hind: [0.15, 0.075, 0.05, 0.045, 0.07] };
function legWeights(p) {
  const side = p[2] >= 0 ? "R" : "L";
  let best = null;
  for (const fr of ["F", "H"]) {
    const id2 = fr + side;
    const L = LEGS[id2];
    const pts = L.joints.map((j3) => [j3[0], j3[1], L.z * L.side]);
    const n = nearestOnChain(p, pts);
    const j2 = n.i + n.t;
    const R = LEG_R[fr === "F" ? "front" : "hind"];
    const r = R[Math.floor(j2)] + (R[Math.min(4, Math.floor(j2) + 1)] - R[Math.floor(j2)]) * (j2 - Math.floor(j2));
    let m2 = 1 - smooth(1.15 * r, 1.9 * r, n.d);
    if (j2 < 1) m2 *= smooth(-0.15, 0.55, j2) * 0.85 + 0.15 * smooth(0, 0.3, j2);
    m2 *= 1 - smooth(pts[0][1] - 0.02, pts[0][1] + 0.12, p[1]);
    if (!best || m2 > best.m) best = { m: m2, id: id2, j: j2, pts };
  }
  if (!best || best.m < 0.01) return null;
  const { id, j, m } = best;
  const w = /* @__PURE__ */ new Map();
  const seg = Math.min(3, Math.floor(j)), frac = j - seg;
  const bn = (i) => BI[`leg_${id}_${i}`];
  if (p[1] < 0.095 && seg >= 3) {
    w.set(bn(4), 1);
    return { w, m };
  }
  const blend = 0.16;
  if (frac > 1 - blend && seg < 3) {
    const k = 0.5 * (frac - (1 - blend)) / blend;
    w.set(bn(seg), 1 - k);
    w.set(bn(seg + 1), k);
  } else if (frac < blend && seg > 0) {
    const k = 0.5 * (1 - frac / blend);
    w.set(bn(seg), 1 - k);
    w.set(bn(seg - 1), k);
  } else w.set(bn(seg), 1);
  return { w, m };
}
function vertexWeights(p) {
  const body = bodyWeights(p);
  const leg = legWeights(p);
  const w = /* @__PURE__ */ new Map();
  const m = leg ? leg.m : 0;
  for (const [b, v] of body) w.set(b, (w.get(b) || 0) + v * (1 - m));
  if (leg) for (const [b, v] of leg.w) w.set(b, (w.get(b) || 0) + v * m);
  const tr = Math.hypot(p[0] - TAIL_JOINTS[0][0], p[1] - TAIL_JOINTS[0][1], p[2]);
  if (tr < 0.07 && p[0] < -0.88) {
    const k = 0.5 * (1 - tr / 0.07);
    for (const [b, v] of w) w.set(b, v * (1 - k));
    w.set(BI.tail0, (w.get(BI.tail0) || 0) + k);
  }
  return w;
}
function finishWeights(wmaps) {
  const n = wmaps.length;
  const si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4);
  for (let v = 0; v < n; v++) {
    const arr = [...wmaps[v]].filter((e) => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = arr.reduce((s, e) => s + e[1], 0) || 1;
    let acc = 0;
    for (let k = 0; k < 4; k++) {
      if (!arr[k]) {
        si[v * 4 + k] = 0;
        sw[v * 4 + k] = 0;
        continue;
      }
      si[v * 4 + k] = arr[k][0];
      const q = Math.floor(arr[k][1] / sum * 255);
      sw[v * 4 + k] = q;
      acc += q;
    }
    sw[v * 4] += 255 - acc;
  }
  return { si, sw };
}
function bakeAttributes(P, N) {
  const n = P.length / 3;
  const tone = new Int8Array(n), ao = new Uint8Array(n), mask = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
    let occ = 0;
    for (let i = 1; i <= 5; i++) {
      const dd = i * 0.018;
      occ += (dd - f(x + nx * dd, y + ny * dd, z + nz * dd)) / 2 ** i;
    }
    let occ2 = 0;
    for (let i = 1; i <= 4; i++) {
      const dd = i * 0.07;
      occ2 += (dd - f(x + nx * dd, y + ny * dd, z + nz * dd)) / 2 ** i;
    }
    let a = 1 - 2.2 * Math.max(0, occ) - 0.9 * Math.max(0, occ2);
    if (y < 0.25) a *= 0.85 + 0.15 * (y / 0.25);
    ao[v] = Math.round(Math.max(0.35, Math.min(1, a)) * 255);
    let t = 0;
    const isBody = y > 1 && x > -1 && x < 0.75;
    if (isBody && ny < -0.2) t += 0.09 * Math.min(1, (-ny - 0.2) / 0.6);
    if (isBody && ny > 0.3) t -= 0.06 * (ny - 0.3) / 0.7;
    if (y > 1.75 && x > -0.45 && x < 0.4) t -= 0.12 * Math.min(1, (y - 1.75) / 0.25);
    if (x > 0.5 && x < 1.6 && ny > 0.4) t -= 0.05;
    if (y < 0.6 && y > 0.08) t += 0.05 * (1 - y / 0.6);
    if (x > 2.2) t -= 0.06 * Math.min(1, (x - 2.2) / 0.2);
    tone[v] = Math.round(Math.max(-1, Math.min(1, t * 4)) * 127);
    let m = 0;
    if (S.tagDist("callus", x, y, z) < 8e-3) m = 1;
    if (S.tagDist("lips", x, y, z) < 6e-3) m = 3;
    if (S.tagDist("nose", x, y, z) < 7e-3) m = 4;
    if (S.tagDist("nail", x, y, z) < 5e-3) m = 2;
    if (y < 0.012) m = 5;
    mask[v] = m;
  }
  return { tone, ao, mask };
}
function normalsOf(P) {
  const N = new Float32Array(P.length);
  for (let v = 0; v < P.length; v += 3) {
    const g = gradient(f, P[v], P[v + 1], P[v + 2], 2e-3);
    N[v] = g[0];
    N[v + 1] = g[1];
    N[v + 2] = g[2];
  }
  return N;
}
function surfaceAlong(ox, oy, oz, dx, dy, dz) {
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    const d = f(x, y, z);
    if (d < 2e-4) return [x, y, z];
    t += Math.max(d * 0.9, 1e-4);
    if (t > 2) break;
  }
  return null;
}
function buildCloth() {
  const x0 = -0.86, x1 = -0.22, nx = 22, na = 14, phiMax = 1.62, yc = 1.45;
  const pos = [], uv = [], idx = [], wm = [];
  for (const side of [1, -1]) {
    const start = pos.length / 3;
    for (let r = 0; r <= nx; r++) {
      const x = x0 + (x1 - x0) * (r / nx);
      for (let i = 0; i <= na; i++) {
        const a = i / na;
        const phi = side * a * phiMax;
        const dy = Math.cos(phi), dz = Math.sin(phi);
        const s = surfaceAlong(x, yc + dy * 1, dz * 1, 0, -dy, -dz) || [x, yc + dy * 0.3, dz * 0.3];
        const g = gradient(f, s[0], s[1], s[2]);
        const off = 0.011 + 0.03 * a ** 3;
        const ox = g[0] * 0.6, oy = g[1] * 0.6 + dy * 0.4, oz = g[2] * 0.6 + dz * 0.4;
        const l = Math.hypot(ox, oy, oz);
        pos.push(s[0] + ox / l * off, s[1] + oy / l * off, s[2] + oz / l * off);
        const xf = r / nx;
        uv.push(side > 0 ? xf : 1 - xf, side > 0 ? 1 - 0.5 * a : 0.5 - 0.5 * a);
        wm.push(bodyWeights([s[0], s[1], s[2]]));
      }
    }
    for (let r = 0; r < nx; r++) for (let i = 0; i < na; i++) {
      const a = start + r * (na + 1) + i, b = a + 1, c = a + na + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const { si, sw } = finishWeights(wm);
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint16Array(idx), si, sw };
}
function headRing(cx, cy, axis, off = 5e-3, n = 28) {
  const [ax, ay] = axis;
  const l = Math.hypot(ax, ay);
  const tx = ax / l, ty = ay / l;
  const ux = -ty, uy = tx;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = i / n * Math.PI * 2;
    const dx = ux * Math.cos(th), dy = uy * Math.cos(th), dz = Math.sin(th);
    const s = surfaceAlong(cx + dx * 0.4, cy + dy * 0.4, dz * 0.4, -dx, -dy, -dz);
    if (!s) continue;
    const g = gradient(f, s[0], s[1], s[2]);
    pts.push([s[0] + g[0] * off - J.head[0], s[1] + g[1] * off - J.head[1], s[2] + g[2] * off]);
  }
  return pts;
}
function surfaceToward(px, py, pz, dir, off) {
  const s = surfaceAlong(px + dir[0] * 0.4, py + dir[1] * 0.4, pz + dir[2] * 0.4, -dir[0], -dir[1], -dir[2]);
  const g = gradient(f, s[0], s[1], s[2]);
  return [s[0] + g[0] * off - J.head[0], s[1] + g[1] * off - J.head[1], s[2] + g[2] * off];
}
function packMesh(P, I) {
  const n = P.length / 3;
  const N = normalsOf(P);
  const { tone, ao, mask } = bakeAttributes(P, N);
  const wm = [];
  for (let v = 0; v < n; v++) wm.push(vertexWeights([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]));
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i], b = I[i + 1], c = I[i + 2];
    adj[a].push(b, c);
    adj[b].push(a, c);
    adj[c].push(a, b);
  }
  let cur = wm;
  for (let it = 0; it < 3; it++) {
    const next = cur.map((w, v) => {
      const out2 = /* @__PURE__ */ new Map();
      for (const [b, x] of w) out2.set(b, x * 0.5);
      const k = 0.5 / Math.max(1, adj[v].length);
      for (const u of adj[v]) for (const [b, x] of cur[u]) out2.set(b, (out2.get(b) || 0) + x * k);
      return out2;
    });
    for (let v = 0; v < n; v++) if (P[v * 3 + 1] < 0.06) next[v] = cur[v];
    cur = next;
  }
  const { si, sw } = finishWeights(cur);
  const nq = new Int8Array(n * 3);
  for (let i = 0; i < n * 3; i++) nq[i] = Math.round(N[i] * 127);
  return { P, I, nq, tone, ao, mask, si, sw };
}
const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString("base64");
function encodeMesh(m) {
  const n = m.P.length / 3;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) {
    min[c] = Math.min(min[c], m.P[v * 3 + c]);
    max[c] = Math.max(max[c], m.P[v * 3 + c]);
  }
  const q = new Uint16Array(n * 3);
  for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) q[v * 3 + c] = Math.round((m.P[v * 3 + c] - min[c]) / (max[c] - min[c]) * 65535);
  const idx = n < 65536 ? Uint16Array.from(m.I) : Uint32Array.from(m.I);
  return {
    count: n,
    min,
    max,
    index32: n >= 65536,
    pos: b64(q),
    idx: b64(idx),
    nrm: b64(m.nq),
    tone: b64(m.tone),
    ao: b64(m.ao),
    mask: b64(m.mask),
    si: b64(m.si),
    sw: b64(m.sw)
  };
}
log("relax");
relax(f, positions, indices, 1, H);
const lods = {};
for (const [name, tris] of [["high", 24e3], ["low", 1e4]]) {
  const s = await simplify(positions, indices, tris, 3e-3);
  log(name, "verts", s.positions.length / 3, "tris", s.indices.length / 3);
  lods[name] = encodeMesh(packMesh(s.positions, s.indices));
  log(name, "packed");
}
const cloth = buildCloth();
const saddle = surfaceAlong(-0.53, 2.5, 0, 0, -1, 0);
const headAxis = [J.headTip[0] - J.head[0], J.headTip[1] - J.head[1]];
const lerpAxis = (t) => [J.head[0] + headAxis[0] * t, J.head[1] + headAxis[1] * t];
const nb = lerpAxis(0.6), tl = lerpAxis(0.06);
const halter = {
  nose: headRing(nb[0], nb[1] - 0.015, headAxis, 4e-3),
  poll: headRing(tl[0] + 0.02, tl[1] + 0.01, [1, -0.05], 5e-3),
  cheek: [1, -1].map((s) => [surfaceToward(1.885, 1.84, 0, [0, 0, s], 5e-3), surfaceToward(2.02, 1.8, 0, [0.1, -0.15, s], 5e-3), surfaceToward(2.17, 1.755, 0, [0, -0.1, s], 5e-3)])
};
const eye = HEAD_FEATURES.eye;
const out = {
  version: 1,
  voxel: H,
  bones: BONES,
  lods,
  cloth: { count: cloth.pos.length / 3, pos: b64(cloth.pos), uv: b64(cloth.uv), idx: b64(cloth.idx), si: b64(cloth.si), sw: b64(cloth.sw) },
  saddleTop: saddle[1],
  head: {
    eye: [eye[0] - J.head[0], eye[1] - J.head[1], eye[2]],
    eyeR: HEAD_FEATURES.eyeR,
    ear: [HEAD_FEATURES.ear[0] - J.head[0], HEAD_FEATURES.ear[1] - J.head[1], HEAD_FEATURES.ear[2]],
    nostril: [HEAD_FEATURES.nostril[0] - J.head[0], HEAD_FEATURES.nostril[1] - J.head[1], HEAD_FEATURES.nostril[2]],
    halter
  }
};
const js = `// ملف مولَّد آليًا بواسطة tools/sculpt/build-camel.mjs — لا تعدّله يدويًا.
// شبكة الهجين المنحوتة (مستويا تفاصيل) + أوزان العظام + التلوين المخبوز + قماش السباق + نقاط الرسن.
export default ${JSON.stringify(out)};
`;
writeFileSync(new URL("../../src/camel/camelSculpt.data.mjs", import.meta.url), js);
log("written", (js.length / 1024).toFixed(0), "KB; saddleTop", saddle[1].toFixed(3));
