const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);
function frame(rz = 0, ry = 0, rx = 0) {
  const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const mul = (A, B) => {
    const o = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return o;
  };
  return mul(mul(Ry, Rz), Rx);
}
function ellipsoid(c, r, rot = {}) {
  const R = frame(rot.z, rot.y, rot.x);
  const [rx, ry, rz] = r;
  const bound = Math.max(rx, ry, rz);
  return {
    c,
    bound,
    d(x, y, z) {
      const px = x - c[0], py = y - c[1], pz = z - c[2];
      const lx = R[0] * px + R[3] * py + R[6] * pz;
      const ly = R[1] * px + R[4] * py + R[7] * pz;
      const lz = R[2] * px + R[5] * py + R[8] * pz;
      const k0 = Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2 + (lz / rz) ** 2);
      const k1 = Math.sqrt((lx / (rx * rx)) ** 2 + (ly / (ry * ry)) ** 2 + (lz / (rz * rz)) ** 2);
      return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
    }
  };
}
function roundCone(a, b, r1, r2, sz = 1) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = (b[2] - a[2]) / sz;
  const l2 = bx * bx + by * by + bz * bz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const bound = Math.sqrt(l2) / 2 + Math.max(r1, r2);
  return {
    c,
    bound,
    d(x, y, z) {
      const px = x - a[0], py = y - a[1], pz = (z - a[2]) / sz;
      const yv = px * bx + py * by + pz * bz;
      const zv = yv - l2;
      const qx = px * l2 - bx * yv, qy = py * l2 - by * yv, qz = pz * l2 - bz * yv;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = yv * yv * l2;
      const z2 = zv * zv * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      let d;
      if (Math.sign(zv) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - r2;
      else if (Math.sign(yv) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - r1;
      else d = (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - r1;
      return sz < 1 ? d * (0.5 + 0.5 * sz) : d;
    }
  };
}
function tube(points, k = 0.02, sz = 1) {
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i], q = points[i + 1];
    parts.push(roundCone([p[0], p[1], p[2]], [q[0], q[1], q[2]], p[3], q[3], sz));
  }
  let cx = 0, cy = 0, cz = 0;
  for (const p of parts) {
    cx += p.c[0];
    cy += p.c[1];
    cz += p.c[2];
  }
  const c = [cx / parts.length, cy / parts.length, cz / parts.length];
  let bound = 0;
  for (const p of parts) bound = Math.max(bound, Math.hypot(p.c[0] - c[0], p.c[1] - c[1], p.c[2] - c[2]) + p.bound);
  return {
    c,
    bound,
    d(x, y, z) {
      let d = 1e9;
      for (const p of parts) d = smin(d, p.d(x, y, z), k);
      return d;
    }
  };
}
function torus(c, R, r, rot = {}) {
  const F = frame(rot.z, rot.y, rot.x);
  return {
    c,
    bound: R + r,
    d(x, y, z) {
      const px = x - c[0], py = y - c[1], pz = z - c[2];
      const lx = F[0] * px + F[3] * py + F[6] * pz;
      const ly = F[1] * px + F[4] * py + F[7] * pz;
      const lz = F[2] * px + F[5] * py + F[8] * pz;
      const q = Math.hypot(lx, lz) - R;
      return Math.hypot(q, ly) - r;
    }
  };
}
function roundBox(c, h, rad = 0, rot = {}) {
  const F = frame(rot.z, rot.y, rot.x);
  return {
    c,
    bound: Math.hypot(h[0], h[1], h[2]) + rad,
    d(x, y, z) {
      const px = x - c[0], py = y - c[1], pz = z - c[2];
      const lx = Math.abs(F[0] * px + F[3] * py + F[6] * pz) - h[0];
      const ly = Math.abs(F[1] * px + F[4] * py + F[7] * pz) - h[1];
      const lz = Math.abs(F[2] * px + F[5] * py + F[8] * pz) - h[2];
      const o = Math.hypot(Math.max(lx, 0), Math.max(ly, 0), Math.max(lz, 0));
      return o + Math.min(Math.max(lx, ly, lz), 0) - rad;
    }
  };
}
class Sculpt {
  constructor({ mirrorZ = false } = {}) {
    this.ops = [];
    this.mirrorZ = mirrorZ;
    this.tags = {};
  }
  add(prim, k = 0.02, tag = null) {
    this.ops.push({ t: 0, p: prim, k });
    if (tag) (this.tags[tag] ||= []).push(prim);
    return prim;
  }
  sub(prim, k = 0.01, tag = null) {
    this.ops.push({ t: 1, p: prim, k });
    if (tag) (this.tags[tag] ||= []).push(prim);
    return prim;
  }
  // إزاحة سطحية (تموجات خفيفة كالأضلاع) تُطبّق داخل منطقة
  displace(fn) {
    this.ops.push({ t: 2, fn });
  }
  d(x, y, z) {
    if (this.mirrorZ) z = Math.abs(z);
    let d = 1e9;
    for (const op of this.ops) {
      if (op.t === 2) {
        d += op.fn(x, y, z, d);
        continue;
      }
      const p = op.p;
      const lb = Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) - p.bound;
      if (op.t === 0) {
        if (lb > d + op.k) continue;
        d = smin(d, p.d(x, y, z), op.k);
      } else {
        if (lb > op.k) continue;
        d = smax(d, -p.d(x, y, z), op.k);
      }
    }
    return d;
  }
  // مسافة أقرب كتلة موسومة (للتلوين)
  tagDist(tag, x, y, z) {
    if (this.mirrorZ) z = Math.abs(z);
    let d = 1e9;
    for (const p of this.tags[tag] || []) d = Math.min(d, p.d(x, y, z));
    return d;
  }
}
export {
  Sculpt,
  clamp,
  ellipsoid,
  roundBox,
  roundCone,
  smax,
  smin,
  torus,
  tube
};
