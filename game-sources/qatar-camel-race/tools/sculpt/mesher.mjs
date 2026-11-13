import { MeshoptSimplifier } from "meshoptimizer";
function gradient(f, x, y, z, e = 15e-4) {
  const gx = f(x + e, y, z) - f(x - e, y, z);
  const gy = f(x, y + e, z) - f(x, y - e, z);
  const gz = f(x, y, z + e) - f(x, y, z - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l, l / (2 * e)];
}
function meshSDF(f, { min, max, h, block = 8, log = () => {
} }) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1;
  const ny = Math.ceil((max[1] - min[1]) / h) + 1;
  const nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const N = nx * ny * nz;
  const idx = (i, j, k) => (k * ny + j) * nx + i;
  const val = new Float32Array(N).fill(NaN);
  const bx = Math.ceil((nx - 1) / block), by = Math.ceil((ny - 1) / block), bz = Math.ceil((nz - 1) / block);
  const halfDiag = Math.sqrt(3) * block * h / 2;
  let active = 0;
  const blockSign = new Int8Array(bx * by * bz);
  const blockActive = new Uint8Array(bx * by * bz);
  for (let K = 0; K < bz; K++) for (let J = 0; J < by; J++) for (let I = 0; I < bx; I++) {
    const cx = min[0] + (I + 0.5) * block * h, cy = min[1] + (J + 0.5) * block * h, cz = min[2] + (K + 0.5) * block * h;
    const d = f(cx, cy, cz);
    const b = (K * by + J) * bx + I;
    blockSign[b] = d < 0 ? -1 : 1;
    if (Math.abs(d) < halfDiag * 1.25 + 2 * h) {
      blockActive[b] = 1;
      active++;
    }
  }
  log(`blocks active ${active}/${bx * by * bz}`);
  for (let K = 0; K < bz; K++) for (let J = 0; J < by; J++) for (let I = 0; I < bx; I++) {
    const b = (K * by + J) * bx + I;
    const i0 = I * block, j0 = J * block, k0 = K * block;
    const i1 = Math.min(nx - 1, i0 + block), j1 = Math.min(ny - 1, j0 + block), k1 = Math.min(nz - 1, k0 + block);
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const q = idx(i, j, k);
      if (blockActive[b]) {
        if (Number.isNaN(val[q]) || Math.abs(val[q]) === 1e3) val[q] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
      } else if (Number.isNaN(val[q])) val[q] = blockSign[b] * 1e3;
    }
  }
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = val[idx(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
      cv[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if (va < 0 === vb < 0) continue;
      const t = va / (va - vb);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    cellVert[cidx(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * h, min[1] + (j + sy / n) * h, min[2] + (k + sz / n) * h);
  }
  const tris = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, c, b, a, d, c);
    else tris.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = val[idx(i, j, k)], v1 = val[idx(i + 1, j, k)];
    if (v0 < 0 === v1 < 0) continue;
    quad(cellVert[cidx(i, j - 1, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j - 1, k)], v0 < 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = val[idx(i, j, k)], v1 = val[idx(i, j + 1, k)];
    if (v0 < 0 === v1 < 0) continue;
    quad(cellVert[cidx(i - 1, j, k - 1)], cellVert[cidx(i - 1, j, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j, k - 1)], v0 < 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = val[idx(i, j, k)], v1 = val[idx(i, j, k + 1)];
    if (v0 < 0 === v1 < 0) continue;
    quad(cellVert[cidx(i - 1, j - 1, k)], cellVert[cidx(i, j - 1, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], v0 < 0);
  }
  log(`raw verts ${pos.length / 3} tris ${tris.length / 3}`);
  const P = new Float32Array(pos);
  for (let v = 0; v < P.length; v += 3) {
    let x = P[v], y = P[v + 1], z = P[v + 2];
    for (let it = 0; it < 3; it++) {
      const d = f(x, y, z);
      if (Math.abs(d) < 1e-5) break;
      const g = gradient(f, x, y, z, h * 0.25);
      const step = Math.max(-h, Math.min(h, d / Math.max(0.3, g[3])));
      x -= g[0] * step;
      y -= g[1] * step;
      z -= g[2] * step;
    }
    P[v] = x;
    P[v + 1] = y;
    P[v + 2] = z;
  }
  return { positions: P, indices: Uint32Array.from(tris) };
}
async function simplify(positions, indices, targetTris, errorLimit = 2e-3, attrs = null, weights = null) {
  await MeshoptSimplifier.ready;
  const [out] = attrs ? MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attrs, weights.length, weights, null, targetTris * 3, errorLimit, ["LockBorder"]) : MeshoptSimplifier.simplify(indices, positions, 3, targetTris * 3, errorLimit, ["LockBorder"]);
  const remap = new Int32Array(positions.length / 3).fill(-1);
  const np = [];
  const ni = new Uint32Array(out.length);
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (remap[v] < 0) {
      remap[v] = np.length / 3;
      np.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    }
    ni[i] = remap[v];
  }
  return { positions: new Float32Array(np), indices: ni };
}
function relax(f, positions, indices, iters = 2, h = 0.01) {
  const n = positions.length / 3;
  const adj = Array.from({ length: n }, () => /* @__PURE__ */ new Set());
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    adj[a].add(b);
    adj[a].add(c);
    adj[b].add(a);
    adj[b].add(c);
    adj[c].add(a);
    adj[c].add(b);
  }
  for (let it = 0; it < iters; it++) {
    const np = new Float32Array(positions);
    for (let v = 0; v < n; v++) {
      let sx = 0, sy = 0, sz = 0;
      for (const u of adj[v]) {
        sx += positions[u * 3];
        sy += positions[u * 3 + 1];
        sz += positions[u * 3 + 2];
      }
      const k = adj[v].size;
      if (!k) continue;
      let x = positions[v * 3] * 0.5 + sx / k * 0.5, y = positions[v * 3 + 1] * 0.5 + sy / k * 0.5, z = positions[v * 3 + 2] * 0.5 + sz / k * 0.5;
      for (let r = 0; r < 2; r++) {
        const d = f(x, y, z);
        const g = gradient(f, x, y, z, h * 0.25);
        x -= g[0] * d;
        y -= g[1] * d;
        z -= g[2] * d;
      }
      np[v * 3] = x;
      np[v * 3 + 1] = y;
      np[v * 3 + 2] = z;
    }
    positions.set(np);
  }
  return adj;
}
export {
  gradient,
  meshSDF,
  relax,
  simplify
};
