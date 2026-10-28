/* صيد الأسماك V24 — deterministic physics core (no THREE, no DOM).
 * Shared by the browser renderer, the GLB asset tool and the Node test suites.
 * Units: metres, seconds, radians. World: Y up, mean sea level y = 0.
 */
(function (root) {
  'use strict';
  const G = 9.81, TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const smoother = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };

  /* ---------- vectors ([x,y,z] arrays) ---------- */
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    copy: a => [a[0], a[1], a[2]],
    finite: a => Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]),
    /* rotate vector v around unit axis k by angle a (Rodrigues) */
    rot(v, k, a) { const c = Math.cos(a), s = Math.sin(a), d = V.dot(k, v) * (1 - c), x = V.cross(k, v); return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d]; }
  };

  /* ---------- 3x3 rotation matrices (row-major arrays of 9) ---------- */
  const M3 = {
    euler(yaw, pitch, roll) { // R = Ry(yaw) * Rz(pitch) * Rx(roll)
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], Rz = [cp, -sp, 0, sp, cp, 0, 0, 0, 1], Rx = [1, 0, 0, 0, cr, -sr, 0, sr, cr];
      return M3.mul(M3.mul(Ry, Rz), Rx);
    },
    mul(a, b) { const r = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return r; },
    apply: (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]],
    applyT: (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]
  };

  /* ---------- deterministic random ---------- */
  function hash(str) { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- Gerstner sea (identical parameters are uploaded to the water shader) ---------- */
  const WAVES = [
    { dir: [0.91, 0.41], length: 9.0, amp: 0.075, steep: 0.55 },
    { dir: [0.62, -0.78], length: 5.6, amp: 0.045, steep: 0.5 },
    { dir: [-0.28, 0.96], length: 3.2, amp: 0.026, steep: 0.45 },
    { dir: [0.98, -0.19], length: 1.9, amp: 0.013, steep: 0.4 },
    { dir: [-0.72, -0.69], length: 1.15, amp: 0.007, steep: 0.35 }
  ].map(w => { const l = Math.hypot(w.dir[0], w.dir[1]); const k = TAU / w.length; return { ...w, dir: [w.dir[0] / l, w.dir[1] / l], k, omega: Math.sqrt(G * k) }; });

  const Sea = {
    waves: WAVES,
    scale: 1,               // sea-state multiplier (calm classroom default 1)
    displace(x, z, t) {     // Gerstner displacement of the rest point (x,z)
      let dx = 0, dy = 0, dz = 0; const s = Sea.scale;
      for (const w of WAVES) {
        const a = w.amp * s, ph = w.k * (w.dir[0] * x + w.dir[1] * z) - w.omega * t, c = Math.cos(ph), q = w.steep / (w.k * a * WAVES.length || 1);
        dx += q * a * w.dir[0] * c; dz += q * a * w.dir[1] * c; dy += a * Math.sin(ph);
      }
      return [dx, dy, dz];
    },
    height(x, z, t) {       // surface height above a world point (inverts the horizontal drift)
      let px = x, pz = z;
      for (let i = 0; i < 3; i++) { const d = Sea.displace(px, pz, t); px = x - d[0]; pz = z - d[2]; }
      return Sea.displace(px, pz, t)[1];
    },
    velocity(x, z, t) {     // orbital surface velocity (for drifting floats)
      const e = 1 / 120, a = Sea.displace(x, z, t), b = Sea.displace(x, z, t + e);
      return [(b[0] - a[0]) / e, (b[1] - a[1]) / e, (b[2] - a[2]) / e];
    },
    normal(x, z, t) { const e = 0.05, hx = Sea.height(x + e, z, t) - Sea.height(x - e, z, t), hz = Sea.height(x, z + e, t) - Sea.height(x, z - e, t); return V.norm([-hx / (2 * e), 1, -hz / (2 * e)]); }
  };

  /* ---------- seabed (shared with the renderer so fish never clip the floor) ---------- */
  function seabed(x, z) {
    const shelf = -6.2 + 0.035 * z + 0.9 * Math.exp(-((x + 7) ** 2 + (z + 12) ** 2) / 30) + 0.7 * Math.exp(-((x - 8) ** 2 + (z + 6) ** 2) / 22);
    return shelf + 0.25 * Math.sin(x * 0.31 + z * 0.17) + 0.16 * Math.sin(x * 0.11 - z * 0.37) + 0.05 * Math.sin(x * 1.7 + z * 0.9);
  }
  const ROCKS = [[-6.5, -11.5, 1.3], [-8.2, -9.6, 0.8], [7.4, -6.8, 1.1], [5.6, -12.8, 0.9], [-2.2, -15.5, 1.2], [2.6, -4.6, 0.55], [9.6, -10.6, 1.0], [-4.4, -6.1, 0.65]]
    .map(([x, z, r]) => ({ c: [x, seabed(x, z) + r * 0.35, z], r }));

  /* ---------- boat motion: hydrostatic sampling + damped springs ---------- */
  class BoatMotion {
    constructor() { this.heave = 0; this.pitch = 0; this.roll = 0; this.yaw = 0.0; this.v = [0, 0, 0]; this.extraRoll = 0; this.extraPitch = 0; this.R = M3.euler(0, 0, 0); this.pos = [0, 0, 0]; }
    sample(t) {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), P = (lx, lz) => [lx * cy + lz * sy, -lx * sy + lz * cy];
      const h = (lx, lz) => { const p = P(lx, lz); return Sea.height(p[0], p[1], t); };
      const bow = h(-2.3, 0), stern = h(2.1, 0), port = h(0, 0.85), star = h(0, -0.85), mid = h(0, 0);
      return { heave: (bow + stern + port + star + mid * 2) / 6, pitch: Math.atan2(stern - bow, 4.4) * 0.75, roll: Math.atan2(port - star, 1.7) * 0.6 };
    }
    step(dt, t) {
      const s = this.sample(t);
      const springs = [['heave', s.heave - 0.015, 2 * Math.PI * 0.62, 0.5], ['pitch', s.pitch + this.extraPitch, 2 * Math.PI * 0.5, 0.42], ['roll', s.roll + this.extraRoll, 2 * Math.PI * 0.48, 0.32]];
      springs.forEach(([k, target, w, z], i) => { const a = w * w * (target - this[k]) - 2 * z * w * this.v[i]; this.v[i] += a * dt; this[k] += this.v[i] * dt; });
      this.yaw = 0.05 * Math.sin(t * 0.045) + 0.02 * Math.sin(t * 0.13 + 1.3);
      this.R = M3.euler(this.yaw, this.pitch, this.roll); this.pos = [0.06 * Math.sin(t * 0.07), this.heave, 0.05 * Math.sin(t * 0.05 + 2)];
    }
    toWorld(p) { return V.add(this.pos, M3.apply(this.R, p)); }
    dirToWorld(d) { return M3.apply(this.R, d); }
    toLocal(p) { return M3.applyT(this.R, V.sub(p, this.pos)); }
  }

  /* ---------- tapered rod: tension-dependent curvature with second-order lag ---------- */
  class Rod {
    constructor(opts = {}) {
      this.length = opts.length || 2.4; this.grip = opts.grip || 0.42; this.n = opts.n || 20;
      this.theta = [0, 0]; this.omega = [0, 0]; this.prevDir = null; this.points = []; this.tip = [0, 0, 0]; this.tipDir = [0, 1, 0];
      this.compliance = opts.compliance || 1.9; this.maxBend = 1.75; this.w0 = TAU * 2.7; this.zeta = 0.2; this.inertia = 0.09;
      this.guides = [0.53, 0.62, 0.71, 0.79, 0.86, 0.92, 0.965, 1.0];
    }
    /* butt: world position of the butt cap; dir: unit rod axis; up: world up hint; force: world vector acting on the tip (tension units, ~0..1.4) */
    step(dt, butt, dir, up, force) {
      const D = V.norm(dir); let e1 = V.sub(up, V.mul(D, V.dot(up, D))); if (V.len(e1) < 1e-4) e1 = [1, 0, 0]; e1 = V.norm(e1); const e2 = V.cross(D, e1);
      const f = [V.dot(force, e1), V.dot(force, e2)], fm = Math.hypot(f[0], f[1]);
      const sat = fm > 1e-6 ? this.maxBend * Math.tanh(this.compliance * fm / this.maxBend) / fm : this.compliance;
      const target = [f[0] * sat, f[1] * sat];
      if (this.prevDir && dt > 0) { // inertial lag: tip trails the swing direction
        const w = V.mul(V.cross(this.prevDir, D), 1 / dt), tipVel = V.cross(w, D);
        target[0] -= this.inertia * V.dot(tipVel, e1); target[1] -= this.inertia * V.dot(tipVel, e2);
      }
      const tm = Math.hypot(target[0], target[1]); if (tm > this.maxBend) { target[0] *= this.maxBend / tm; target[1] *= this.maxBend / tm; }
      for (let i = 0; i < 2; i++) { const a = this.w0 * this.w0 * (target[i] - this.theta[i]) - 2 * this.zeta * this.w0 * this.omega[i]; this.omega[i] += a * dt; this.theta[i] += this.omega[i] * dt; }
      this.prevDir = D; this.D = D; this.e1 = e1; this.e2 = e2; this.butt = butt;
      this.build();
    }
    build() {
      const { D, e1, e2, butt } = this, L = this.length, g = this.grip, th = this.theta, mag = Math.hypot(th[0], th[1]);
      const b = mag > 1e-7 ? V.norm(V.add(V.mul(e1, th[0] / mag), V.mul(e2, th[1] / mag))) : e1;
      const pts = [], steps = this.n - 1; let p = V.copy(butt); pts.push(V.copy(p));
      const tangent = s => { const xi = clamp((s - g) / (L - g)); const a = mag * Math.pow(xi, 2.6); return V.add(V.mul(D, Math.cos(a)), V.mul(b, Math.sin(a))); };
      for (let i = 1; i <= steps; i++) { const s0 = L * (i - 1) / steps, s1 = L * i / steps, t = tangent((s0 + s1) / 2); p = V.add(p, V.mul(t, s1 - s0)); pts.push(p); }
      this.points = pts; this.tip = pts[pts.length - 1]; this.tipDir = tangent(L); this.bendDir = b; this.bend = mag;
      return pts;
    }
    pointAt(f) { const x = clamp(f) * (this.points.length - 1), i = Math.min(this.points.length - 2, Math.floor(x)); return V.lerp(this.points[i], this.points[i + 1], x - i); }
  }

  /* ---------- fishing line: position-based (Verlet) rope with inequality constraints ---------- */
  const LEADER = [0.35, 0.45, 0.45, 0.25]; // float → mid → sinker → mid → hook  (1.5 m at the stop knot)
  const SLIDE_MIN = 0.09;                   // sliding float: out of the water it rests on the sinker swivel
  class Rope {
    constructor(nMain = 20) {
      this.nMain = nMain; this.floatIndex = nMain; this.sinkerIndex = nMain + 2; this.hookIndex = nMain + LEADER.length;
      this.count = this.hookIndex + 1; this.mainLength = 0.35; this.leader = LEADER.slice();
      this.p = []; for (let i = 0; i < this.count; i++) this.p.push({ x: [0, 0, 0], o: [0, 0, 0], w: 1, pin: null, wet: false });
      this.p[0].w = 0; this.p[this.floatIndex].w = 0.25; this.p[this.sinkerIndex].w = 0.3; this.p[this.hookIndex].w = 0.5;
      this.tipPull = 0; this.colliders = []; this.boat = null; this.iterations = 28; this.slide = 1;
    }
    rest(i) { return i < this.nMain ? this.mainLength / this.nMain : this.leader[i - this.nMain] * (i < this.sinkerIndex ? this.slide : 1); }
    setSlide(v) { this.slide = clamp(v, SLIDE_MIN, 1); }
    place(points) { this.p.forEach((q, i) => { q.x = V.copy(points[i]); q.o = V.copy(points[i]); }); }
    hangFrom(tip) { // deterministic initial hang straight down (float resting on the sinker)
      this.slide = SLIDE_MIN;
      let y = tip[1]; this.p.forEach((q, i) => { if (i) y -= this.rest(i - 1); q.x = [tip[0], y, tip[2]]; q.o = V.copy(q.x); });
    }
    calm(k = 0.7) { for (const q of this.p) q.o = V.lerp(q.o, q.x, k); }
    release(i) { if (this.p[i].pin) { this.p[i].pin = null; this.calm(0.75); } }
    get floatPos() { return this.p[this.floatIndex].x; }
    get hookPos() { return this.p[this.hookIndex].x; }
    straightToFloat() { return V.dist(this.p[0].x, this.p[this.floatIndex].x); }
    step(h, t, env) {
      const P = this.p, g = -G;
      { // sliding float: in the water the sinker draws line through the float down to the stop knot; lifted out, the float slides back onto the sinker
        const fl = P[this.floatIndex], sk = P[this.sinkerIndex], wet = Sea.height(fl.x[0], fl.x[2], t) - fl.x[1] > -0.03;
        const span = this.leader[0] + this.leader[1], rate = wet ? (sk.x[1] < fl.x[1] - 0.02 ? 0.85 : 0.25) : -1.6;
        this.slide = clamp(this.slide + rate * h / span, SLIDE_MIN, 1);
      }
      for (let i = 0; i < P.length; i++) {
        const q = P[i]; if (q.pin || q.w === 0) continue;
        const wh = Sea.height(q.x[0], q.x[2], t); const depth = wh - q.x[1]; q.wet = depth > 0;
        let vx = q.x[0] - q.o[0], vy = q.x[1] - q.o[1], vz = q.x[2] - q.o[2], ay = g, ax = 0, az = 0;
        const isFloat = i === this.floatIndex, isWeight = i === this.sinkerIndex || i === this.hookIndex;
        if (q.wet) {
          const k = isFloat ? 7 : isWeight ? 5.5 : 9, damp = Math.exp(-k * h); vx *= damp; vy *= damp; vz *= damp;
          if (isFloat) { const sub = clamp((depth + 0.035) / 0.11); ay = g + G * 3.1 * sub; const sv = Sea.velocity(q.x[0], q.x[2], t), f = 1 - Math.exp(-3 * h); vx += (sv[0] * h - vx) * f; vz += (sv[2] * h - vz) * f; }
          else if (isWeight) ay = g * 0.55; else ay = g * 0.08;
        } else { const damp = Math.exp(-(isFloat || isWeight ? 0.05 : 0.9) * h); vx *= damp; vy *= damp; vz *= damp; if (!isFloat && !isWeight) ay = g * 0.2; }
        const sp = Math.hypot(vx, vy, vz), vmax = 28 * h; if (sp > vmax) { vx *= vmax / sp; vy *= vmax / sp; vz *= vmax / sp; }
        if (env && env.wind && !q.wet) { ax += env.wind[0]; az += env.wind[2]; }
        q.o = q.x; q.x = [q.x[0] + vx + ax * h * h, q.x[1] + vy + ay * h * h, q.x[2] + vz + az * h * h];
      }
      let pull = 0;
      for (let it = 0; it < this.iterations; it++) {
        for (let i = 0; i < P.length; i++) if (P[i].pin) P[i].x = V.copy(P[i].pin);
        const fwd = (it & 1) === 0;
        for (let j = 0; j < P.length - 1; j++) {
          const i = fwd ? j : P.length - 2 - j, a = P[i], b = P[i + 1], wa = a.pin ? 0 : a.w, wb = b.pin ? 0 : b.w, ws = wa + wb; if (!ws) continue;
          const d = V.sub(b.x, a.x), l = V.len(d), r = this.rest(i); if (l <= r || l < 1e-9) continue;
          const c = (l - r) / l; a.x = V.add(a.x, V.mul(d, c * wa / ws)); b.x = V.sub(b.x, V.mul(d, c * wb / ws));
          if (i === 0) pull = l - r;
        }
        if (it % 4 === 3) this.collide();
      }
      for (let i = 0; i < P.length; i++) if (P[i].pin) P[i].x = V.copy(P[i].pin);
      this.tipPull = pull;
    }
    collide() {
      for (let i = 1; i < this.p.length; i++) {
        const q = this.p[i]; if (q.pin) continue;
        for (const c of this.colliders) { // capsules {a,b,r}
          const ab = V.sub(c.b, c.a), t = clamp(V.dot(V.sub(q.x, c.a), ab) / (V.dot(ab, ab) || 1)), cp = V.add(c.a, V.mul(ab, t)), d = V.sub(q.x, cp), l = V.len(d);
          if (l < c.r && l > 1e-6) q.x = V.add(cp, V.mul(d, c.r / l));
        }
        if (this.boat) { // keep slack line on the deck / outside the hull
          const L = this.boat.toLocal(q.x), e = (L[0] / 2.75) ** 2 + (L[2] / 0.98) ** 2;
          if (e < 1 && L[1] < 0.06 && L[1] > -0.45) {
            const prev = this.boat.toLocal(q.o);
            if (prev[1] >= 0.02 || ((prev[0] / 2.75) ** 2 + (prev[2] / 0.98) ** 2) < 1) { L[1] = 0.06; }
            else { const s = 1 / Math.sqrt(e); L[0] *= s * 1.01; L[2] *= s * 1.01; }
            q.x = this.boat.toWorld(L);
          }
        }
      }
    }
    lengthOK(tol = 0.04) { // every segment within its rest length (+tolerance) → line is never broken/teleported
      for (let i = 0; i < this.p.length - 1; i++) if (V.dist(this.p[i].x, this.p[i + 1].x) > this.rest(i) * (1 + tol) + 0.004) return false; return true;
    }
  }

  /* ---------- ballistic casting ---------- */
  const Ballistic = {
    flightTime: dist => 0.62 + 0.075 * dist,
    launch(from, to, T) { return [(to[0] - from[0]) / T, (to[1] - from[1]) / T + 0.5 * G * T, (to[2] - from[2]) / T]; },
    at(from, v, t) { return [from[0] + v[0] * t, from[1] + v[1] * t - 0.5 * G * t * t, from[2] + v[2] * t]; }
  };

  const api = { G, TAU, clamp, lerp, smooth, smoother, V, M3, hash, rng, Sea, seabed, ROCKS, BoatMotion, Rod, Rope, Ballistic, LEADER, SLIDE_MIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FishingPhysics = api;
})(typeof window !== 'undefined' ? window : globalThis);
