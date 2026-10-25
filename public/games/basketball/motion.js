/* Basketball motion + physics (basketball-only, no rendering; runs in the browser and in Node).
 *
 * One clock drives everything: the shot clock (seconds since the shot started) positions the
 * shooter's body, the ball in the hands, the release, the flight and every contact sound.
 *
 *  - Court geometry in metres (FIBA): rim 3.05 m, 45 cm ring, board face 1.20 m from the baseline.
 *  - Ball: deterministic fixed-step simulation with exact ballistic sub-steps, continuous collision
 *    against the rim torus, glass board, floor, padded walls and the stanchion pad; restitution,
 *    friction and spin coupling for a hollow sphere; net drag; rolling.
 *  - Educational outcome: a make is planned so it always scores cleanly; a miss is planned (several
 *    variants) so it never scores. Both share the exact same displayed path up to the question; after
 *    a wrong answer the ball leaves the make path with a C1 blend (position + velocity continuous) and
 *    then follows the simulated miss exactly.
 *  - Dribble: analytic hand-ball-floor cycle; floor contact and hand contact times are exact.
 *  - Jump shot: pelvis height curve with ballistic flight between take-off and landing.
 */
(function (root) {
  'use strict';
  const G = 9.81, R = 0.12;
  const RIM = { x: 0, y: 3.05, z: -12.425, major: 0.234, tube: 0.009 };
  const BOARD = { x0: -0.9, x1: 0.9, y0: 2.9, y1: 3.95, z: -12.8, thick: 0.03 };
  const COURT = {
    width: 15, length: 28, baselineZ: -14, rim: RIM, board: BOARD,
    // padded obstacles the ball can meet after a shot (axis-aligned boxes and planes)
    pad: { x0: -0.66, x1: 0.66, y0: 0, y1: 0.88, z0: -17.25, z1: -15.1 },
    walls: { zBack: -16.66, xSide: 10.3, zFront: 14.5 },
    net: { depth: 0.42, bottom: 0.15 }
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // ------------------------------------------------------------------ shot timing (shooter)
  const JUMP_H = 0.27, TOE = 0.06, V0 = Math.sqrt(2 * G * JUMP_H), AIR = 2 * V0 / G;
  const SHOT = {
    gather: 0.28,           // catch from the dribble -> two-hand gather at the belly
    dip: 0.52,              // lowest point of the knee bend
    takeoff: 0.68,          // feet leave the floor
    jump: JUMP_H, toe: TOE, v0: V0,
    release: 0.68 + 0.19,   // ball leaves the hand, slightly before the apex (apex = takeoff + 0.235)
    land: 0.68 + AIR,       // feet back on the floor
    absorb: 0.68 + AIR + 0.22,
    recover: 0.68 + AIR + 0.72,
    dipDepth: 0.14, landDepth: 0.10
  };
  SHOT.apex = SHOT.takeoff + V0 / G;

  function hermite(p0, m0, p1, m1, s) { // cubic Hermite (m already scaled by the interval)
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
  }
  const smooth = s => { s = clamp(s, 0, 1); return s * s * (3 - 2 * s); };

  /** pelvis vertical offset (m) from the standing height, t = shot clock */
  function pelvisShot(t) {
    const S = SHOT;
    if (t <= 0) return 0;
    if (t < S.gather) return -0.03 * smooth(t / S.gather);
    if (t < S.dip) return -0.03 + (-S.dipDepth + 0.03) * smooth((t - S.gather) / (S.dip - S.gather));
    if (t < S.takeoff) { const d = S.takeoff - S.dip; return hermite(-S.dipDepth, 0, S.toe, S.v0 * d, (t - S.dip) / d); }
    if (t < S.land) { const u = t - S.takeoff; return S.toe + S.v0 * u - 0.5 * G * u * u; }
    if (t < S.absorb) { const d = S.absorb - S.land; return hermite(S.toe, -S.v0 * d, -S.landDepth, 0, (t - S.land) / d); }
    if (t < S.recover) return -S.landDepth * (1 - smooth((t - S.absorb) / (S.recover - S.absorb)));
    return 0;
  }
  /** height of the feet above the floor (0 while any part of the foot is planted) */
  function feetLift(t) {
    if (t <= SHOT.takeoff || t >= SHOT.land) return 0;
    return Math.max(0, pelvisShot(t) - SHOT.toe);
  }
  /** heel raise (m) while pushing off on the toes / landing on the toes */
  function heelRaise(t) {
    const S = SHOT;
    if (t > S.dip && t < S.takeoff) return S.toe * smooth((t - S.dip) / (S.takeoff - S.dip));
    if (t >= S.takeoff && t <= S.land) return S.toe;
    if (t > S.land && t < S.land + 0.1) return S.toe * (1 - smooth((t - S.land) / 0.1));
    return 0;
  }

  // ------------------------------------------------------------------ dribble (analytic)
  const DRIBBLE = (() => {
    const yCatch = 0.80, vPush = 3.6, e = 0.82, tc = 0.22;
    const drop = yCatch - R;
    const t1 = (-vPush + Math.sqrt(vPush * vPush + 2 * G * drop)) / G;
    const vImpact = vPush + G * t1, vOut = e * vImpact;
    const vUp = Math.sqrt(vOut * vOut - 2 * G * drop);
    const t2 = (vOut - vUp) / G;
    return { yCatch, vPush, e, tc, t1, t2, vImpact, vOut, vUp, period: t1 + t2 + tc, side: 0.27, fwd: 0.33 };
  })();
  const mod = (t, p) => ((t % p) + p) % p;
  /** ball centre height and vertical velocity; t = dribble clock (0 = ball leaves the hand going down) */
  function dribbleAt(t) {
    const D = DRIBBLE, u = mod(t, D.period);
    if (u < D.t1) return { y: D.yCatch - D.vPush * u - 0.5 * G * u * u, vy: -D.vPush - G * u, phase: 'down' };
    if (u < D.t1 + D.t2) { const s = u - D.t1; return { y: R + D.vOut * s - 0.5 * G * s * s, vy: D.vOut - G * s, phase: 'up' }; }
    const s = (u - D.t1 - D.t2) / D.tc;
    return { y: hermite(D.yCatch, D.vUp * D.tc, D.yCatch, -D.vPush * D.tc, s), vy: dHermite(D.yCatch, D.vUp * D.tc, D.yCatch, -D.vPush * D.tc, s) / D.tc, phase: 'hand' };
  }
  function dHermite(p0, m0, p1, m1, s) { const s2 = s * s; return (6 * s2 - 6 * s) * p0 + (3 * s2 - 4 * s + 1) * m0 + (-6 * s2 + 6 * s) * p1 + (3 * s2 - 2 * s) * m1; }
  /** dribbling hand (palm) height: on top of the ball during contact, follows smoothly otherwise */
  function dribbleHand(t) {
    const D = DRIBBLE, u = mod(t, D.period), top = D.yCatch + R, free = D.t1 + D.t2;
    if (u >= free) { const b = dribbleAt(t); return { y: b.y + R, vy: b.vy, contact: true }; }
    // follow-through after the push, then rise to meet the ball (velocity matched at both ends)
    const s = u / free;
    return { y: hermite(top, -D.vPush * free * 0.55, top, D.vUp * free, s), vy: dHermite(top, -D.vPush * free * 0.55, top, D.vUp * free, s) / free, contact: false };
  }

  // ------------------------------------------------------------------ ballistics
  function ballistic(p0, v, t) { return [p0[0] + v[0] * t, p0[1] + v[1] * t - 0.5 * G * t * t, p0[2] + v[2] * t]; }
  /** launch velocity so the ball centre reaches `tgt` descending at `angDeg` below horizontal */
  function solveShot(p0, tgt, angDeg) {
    const dx = tgt[0] - p0[0], dz = tgt[2] - p0[2], dy = tgt[1] - p0[1], D = Math.hypot(dx, dz);
    const ta = Math.tan(angDeg * Math.PI / 180);
    const T = Math.sqrt(2 * (dy + D * ta) / G);
    const vh = D / T, vy = (dy + 0.5 * G * T * T) / T;
    return { v: [dx / D * vh, vy, dz / D * vh], T, ang: angDeg };
  }

  // ------------------------------------------------------------------ simulation
  const DT = 1 / 480;
  function rimDist(p) { // distance from the ball centre to the rim tube centre-line
    const dx = p[0] - RIM.x, dz = p[2] - RIM.z, h = Math.hypot(dx, dz) || 1e-9;
    const qx = RIM.x + dx / h * RIM.major, qz = RIM.z + dz / h * RIM.major;
    const d = [p[0] - qx, p[1] - RIM.y, p[2] - qz];
    return { d: len(d), n: norm(d), q: [qx, RIM.y, qz] };
  }
  function boxDist(p, b) { // b: {x0,x1,y0,y1,z0,z1}
    const q = [clamp(p[0], b.x0, b.x1), clamp(p[1], b.y0, b.y1), clamp(p[2], b.z0, b.z1)];
    const d = sub(p, q), l = len(d);
    if (l > 1e-9) return { d: l, n: mul(d, 1 / l), q };
    // centre inside the box (cannot happen with small steps): push out through the nearest face
    return { d: 0, n: [0, 0, 1], q };
  }
  const BOARD_BOX = { x0: BOARD.x0, x1: BOARD.x1, y0: BOARD.y0, y1: BOARD.y1, z0: BOARD.z - BOARD.thick, z1: BOARD.z };
  const MAT = {
    floor: { e: 0.8, mu: 0.55 }, rim: { e: 0.6, mu: 0.3 }, board: { e: 0.64, mu: 0.22 }, wall: { e: 0.45, mu: 0.4 }
  };
  /** all contacts the ball would make at position p: [{type, d (penetration > 0), n}] */
  function contacts(p) {
    const out = [];
    if (p[1] < R) out.push({ type: 'floor', pen: R - p[1], n: [0, 1, 0] });
    const rd = rimDist(p); if (rd.d < R + RIM.tube) out.push({ type: 'rim', pen: R + RIM.tube - rd.d, n: rd.n });
    if (Math.abs(p[2] - BOARD.z) < 0.4 && p[1] > 2.4) { const bd = boxDist(p, BOARD_BOX); if (bd.d < R) out.push({ type: 'board', pen: R - bd.d, n: bd.n }); }
    const W = COURT.walls;
    if (p[2] < W.zBack + R) out.push({ type: 'wall', pen: W.zBack + R - p[2], n: [0, 0, 1] });
    if (p[2] > W.zFront - R) out.push({ type: 'wall', pen: p[2] - (W.zFront - R), n: [0, 0, -1] });
    if (p[0] > W.xSide - R) out.push({ type: 'wall', pen: p[0] - (W.xSide - R), n: [-1, 0, 0] });
    if (p[0] < -W.xSide + R) out.push({ type: 'wall', pen: -W.xSide + R - p[0], n: [1, 0, 0] });
    if (p[2] < COURT.pad.z1 + R && p[1] < COURT.pad.y1 + R) { const pd = boxDist(p, COURT.pad); if (pd.d < R) out.push({ type: 'wall', pen: R - pd.d, n: pd.n }); }
    return out;
  }
  function netRadius(y) { return RIM.major - RIM.tube - (RIM.y - y) / COURT.net.depth * (RIM.major - RIM.tube - COURT.net.bottom); }
  function inNet(p) {
    if (p[1] > RIM.y || p[1] < RIM.y - COURT.net.depth - R * 0.5) return false;
    return Math.hypot(p[0] - RIM.x, p[2] - RIM.z) < RIM.major - 0.005;
  }
  /** acceleration at a state (gravity, net drag, rolling resistance) */
  function accel(p, v, rolling, through) {
    if (rolling) {
      const sp = Math.hypot(v[0], v[2]); if (sp < 1e-6) return [0, 0, 0];
      const dec = 0.32 + 0.06 * sp; return [-v[0] / sp * dec, 0, -v[2] / sp * dec];
    }
    if (through && inNet(p)) {
      // the net squeezes and slows the ball and centres it on the hoop axis
      const kh = 14, kv = 4.2, kc = 60;
      return [-kh * v[0] - kc * (p[0] - RIM.x), -G - kv * v[1], -kh * v[2] - kc * (p[2] - RIM.z)];
    }
    return [0, -G, 0];
  }
  function resolve(v, w, n, m) {
    const vn = dot(v, n); if (vn >= 0) return null;
    const e = m.e * (Math.abs(vn) < 0.6 ? 0.6 + 0.4 * Math.abs(vn) / 0.6 : 1); // softer at very low speed
    const jn = -(1 + e) * vn;
    const vt = sub(v, mul(n, vn));
    const u = add(vt, cross(w, mul(n, -R)));                 // slip of the contact point
    let dvt = mul(u, -0.4);                                  // hollow sphere: removes slip
    const lim = m.mu * jn, l = len(dvt); if (l > lim) dvt = mul(dvt, lim / l);
    const v2 = add(add(v, mul(n, jn)), dvt);
    const w2 = add(w, mul(cross(n, dvt), -1.5 / R));
    return { v: v2, w: w2, speed: -vn };
  }
  /** simulate from p0 with velocity v0 and spin w0; deterministic; returns a sampled history */
  function simulate(p0, v0, w0, opts = {}) {
    const tEnd = opts.tEnd || 7.5;
    const S = { t: [0], p: [p0.slice()], v: [v0.slice()], a: [], w: [w0.slice()], roll: [false], events: [], scoredAt: -1, firstContact: -1, minRimGap: Infinity, tEnd };
    let t = 0, p = p0.slice(), v = v0.slice(), w = w0.slice(), rolling = false, through = false, entered = false, prevY = p0[1], restT = -1;
    let lastFloor = -1;
    const W = COURT.walls; void W;
    let a = accel(p, v, rolling, through); S.a.push(a);
    let guard = 0;
    while (t < tEnd && guard++ < 40000) {
      let dt = DT;
      let p1 = [p[0] + v[0] * dt + 0.5 * a[0] * dt * dt, p[1] + v[1] * dt + 0.5 * a[1] * dt * dt, p[2] + v[2] * dt + 0.5 * a[2] * dt * dt];
      let hit = contacts(p1).filter(c => !(rolling && c.type === 'floor'));
      if (hit.length) {
        // time of impact by bisection on the exact sub-step polynomial
        let lo = 0, hi = dt;
        for (let k = 0; k < 30; k++) {
          const m = (lo + hi) / 2, pm = [p[0] + v[0] * m + 0.5 * a[0] * m * m, p[1] + v[1] * m + 0.5 * a[1] * m * m, p[2] + v[2] * m + 0.5 * a[2] * m * m];
          const c = contacts(pm).filter(c => !(rolling && c.type === 'floor'));
          if (c.length) hi = m; else lo = m;
        }
        dt = lo;
        p1 = [p[0] + v[0] * dt + 0.5 * a[0] * dt * dt, p[1] + v[1] * dt + 0.5 * a[1] * dt * dt, p[2] + v[2] * dt + 0.5 * a[2] * dt * dt];
        hit = contacts([p[0] + v[0] * hi + 0.5 * a[0] * hi * hi, p[1] + v[1] * hi + 0.5 * a[1] * hi * hi, p[2] + v[2] * hi + 0.5 * a[2] * hi * hi]).filter(c => !(rolling && c.type === 'floor'));
      }
      let v1 = [v[0] + a[0] * dt, v[1] + a[1] * dt, v[2] + a[2] * dt];
      t += dt; p = p1; v = v1;
      if (rolling) { // keep the rolling spin consistent with the speed
        w = [v[2] / R, 0, -v[0] / R];
      }
      // rim gap bookkeeping (before scoring and before any contact)
      if (S.scoredAt < 0) { const g = rimDist(p).d - (R + RIM.tube); if (g < S.minRimGap) S.minRimGap = g; }
      // through the ring from above
      const r = Math.hypot(p[0] - RIM.x, p[2] - RIM.z);
      if (!entered && prevY >= RIM.y && p[1] < RIM.y && v[1] < 0 && r < RIM.major - RIM.tube - 0.02) {
        entered = true; through = true;
        S.events.push({ t, type: 'net', p: p.slice(), speed: Math.abs(v[1]) });
      }
      if (entered && S.scoredAt < 0 && p[1] < RIM.y - R * 1.25 && r < RIM.major) S.scoredAt = t;
      if (through && p[1] < RIM.y - COURT.net.depth - R) through = false;
      prevY = p[1];
      for (const c of hit) {
        const m = MAT[c.type] || MAT.wall;
        const res = resolve(v, w, c.n, m); if (!res) continue;
        v = res.v; w = res.w;
        if ((c.type === 'rim' || c.type === 'board') && S.firstContact < 0) S.firstContact = t;
        if (c.type === 'floor') {
          if (res.speed < 0.35) { rolling = true; v[1] = 0; p[1] = R; }
          if (res.speed > 0.25 && t - lastFloor > 0.05) S.events.push({ t, type: 'floor', p: p.slice(), speed: res.speed });
          lastFloor = t;
        } else if (res.speed > 0.12) S.events.push({ t, type: c.type, p: p.slice(), speed: res.speed });
      }
      if (rolling && Math.hypot(v[0], v[2]) < 0.02) { v = [0, 0, 0]; w = [0, 0, 0]; if (restT < 0) restT = t; }
      a = accel(p, v, rolling, through);
      S.t.push(t); S.p.push(p.slice()); S.v.push(v.slice()); S.a.push(a); S.w.push(w.slice()); S.roll.push(rolling);
      if (restT >= 0 && t > restT + 0.2) break;
    }
    S.restAt = restT; S.tEnd = t;
    return S;
  }
  function findIndex(sim, t) { // last state index with sim.t[i] <= t
    const T = sim.t; let lo = 0, hi = T.length - 1;
    if (t >= T[hi]) return hi;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
    return lo;
  }
  /** exact state of a simulation at time t (sub-steps are exact polynomials) */
  function sampleSim(sim, t) {
    const i = findIndex(sim, Math.max(0, t)), last = i === sim.t.length - 1;
    const p = sim.p[i], v = sim.v[i], a = sim.a[i], w = sim.w[i];
    if (last) return { p: p.slice(), v: [0, 0, 0], w: [0, 0, 0], rolling: sim.roll[i] };
    const u = Math.max(0, t) - sim.t[i];
    return {
      p: [p[0] + v[0] * u + 0.5 * a[0] * u * u, p[1] + v[1] * u + 0.5 * a[1] * u * u, p[2] + v[2] * u + 0.5 * a[2] * u * u],
      v: [v[0] + a[0] * u, v[1] + a[1] * u, v[2] + a[2] * u], w: w.slice(), rolling: sim.roll[i]
    };
  }

  // ------------------------------------------------------------------ shot planning
  function backspin(v, revPerSec) {
    const d = norm([v[0], 0, v[2]]), ax = cross(d, [0, 1, 0]);
    return mul(ax, revPerSec * 2 * Math.PI);
  }
  function makeAngle(p0) {
    const D = Math.hypot(RIM.x - p0[0], RIM.z - p0[2]), dy = RIM.y - p0[1];
    const need = Math.atan(Math.max(0, (0.5 * G * 0.92 * 0.92 - dy)) / D) * 180 / Math.PI; // flight >= 0.92 s
    return clamp(Math.max(46, need), 44, 56);
  }
  /** plan a clean make from the release point p0 */
  function planMake(p0) {
    const base = makeAngle(p0);
    const dir = norm([RIM.x - p0[0], 0, RIM.z - p0[2]]);
    for (const [da, depth] of [[0, 0.015], [2, 0.015], [-1.5, 0.03], [4, 0], [6, 0.02]]) {
      const tgt = [RIM.x + dir[0] * depth, RIM.y, RIM.z + dir[2] * depth];
      const s = solveShot(p0, tgt, base + da);
      const w0 = backspin(s.v, 1.9);
      const sim = simulate(p0, s.v, w0);
      if (sim.scoredAt > 0 && (sim.firstContact < 0 || sim.firstContact > sim.scoredAt) && sim.minRimGap > 0.006) return { v: s.v, T: s.T, ang: s.ang, w0, sim, tgt, release: p0.slice() };
    }
    return null;
  }
  const questionTime = mk => mk.T * 0.5;
  function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const MISS_KINDS = ['front', 'back', 'side', 'board'];
  /** plan a believable miss that shares the make's displayed path up to the question */
  function planMiss(p0, mk, seed = 1) {
    const rnd = mulberry(seed * 7919 + 13), tq = questionTime(mk);
    const dir = norm([RIM.x - p0[0], 0, RIM.z - p0[2]]), lat = [-dir[2], 0, dir[0]];
    const first = (seed - 1) % MISS_KINDS.length;
    for (let attempt = 0; attempt < 48; attempt++) {
      const kind = MISS_KINDS[(first + Math.floor(attempt / 12)) % MISS_KINDS.length];
      const j = () => rnd() * 2 - 1;
      let tgt, ang = mk.ang + j() * 1.5;
      if (kind === 'front') { const o = -(RIM.major - 0.035 + rnd() * 0.07); tgt = [RIM.x + dir[0] * o + lat[0] * j() * 0.06, RIM.y + 0.02, RIM.z + dir[2] * o + lat[2] * j() * 0.06]; }
      else if (kind === 'back') { const o = RIM.major - 0.02 + rnd() * 0.06; tgt = [RIM.x + dir[0] * o + lat[0] * j() * 0.06, RIM.y + 0.02, RIM.z + dir[2] * o + lat[2] * j() * 0.06]; }
      else if (kind === 'side') { const s = rnd() < 0.5 ? -1 : 1, o = RIM.major + 0.0 + rnd() * 0.05; tgt = [RIM.x + lat[0] * o * s + dir[0] * j() * 0.05, RIM.y + 0.02, RIM.z + lat[2] * o * s + dir[2] * j() * 0.05]; }
      else { // glass first, then rim / out
        const s = rnd() < 0.5 ? -1 : 1;
        tgt = [RIM.x + s * (0.16 + rnd() * 0.16), RIM.y + 0.2 + rnd() * 0.16, BOARD.z + R + 0.004]; ang = mk.ang - 3 - rnd() * 3;
      }
      const s = solveShot(p0, tgt, ang);
      const dv = sub(s.v, mk.v), along = dot(dv, norm(mk.v));
      if (len(dv) > 0.5 || len(sub(dv, mul(norm(mk.v), along))) > 0.32) continue; // keep the deviation subtle, mostly along the arc
      const w0 = backspin(s.v, 1.9);
      const sim = simulate(p0, s.v, w0);
      if (sim.scoredAt >= 0 || sim.firstContact < 0) continue;
      const tc = sim.firstContact;
      if (tc < tq + 0.16) continue;
      const tb = tq + (tc - tq) * 0.72;
      const floor = sim.events.find(e => e.type === 'floor');
      if (!floor || floor.t > tc + 3.0) continue;               // must come off the rim and drop
      const plan = { release: p0, make: mk, tq, miss: { v: s.v, tc, tb, sim } };
      let ok = true;
      for (let t = tq; t < tc; t += 1 / 240) {
        const p = shotBall(plan, t, 'miss').p;
        if (rimDist(p).d < R + RIM.tube - 0.002) { ok = false; break; }
        if (p[1] < R) { ok = false; break; }
      }
      if (!ok) continue;
      return { v: s.v, tc, tb, sim, kind, w0, tgt };
    }
    return null;
  }
  /** ball position + velocity for the shot plan at shot-flight time t (0 = release) */
  function shotBall(plan, t, outcome) {
    const mk = plan.make, ms = plan.miss;
    if (outcome !== 'miss' || !ms || t <= plan.tq) return sampleSim(mk.sim, t);
    if (t >= ms.tb) return sampleSim(ms.sim, t);
    const A = sampleSim(mk.sim, t), B = sampleSim(ms.sim, t), d = ms.tb - plan.tq;
    const s = (t - plan.tq) / d, w = s * s * (3 - 2 * s), dw = 6 * s * (1 - s) / d;
    const p = [0, 1, 2].map(i => A.p[i] + w * (B.p[i] - A.p[i]));
    const v = [0, 1, 2].map(i => A.v[i] + w * (B.v[i] - A.v[i]) + dw * (B.p[i] - A.p[i]));
    return { p, v, w: B.w };
  }
  /** events of the outcome path after time t0 (sounds, outcome timing) */
  function shotEvents(plan, outcome) {
    if (outcome === 'miss' && plan.miss) return plan.miss.sim.events.filter(e => e.t >= plan.miss.tb);
    return plan.make.sim.events;
  }

  const api = {
    G, R, COURT, SHOT, DRIBBLE,
    pelvisShot, feetLift, heelRaise, dribbleAt, dribbleHand,
    ballistic, solveShot, simulate, sampleSim, planMake, planMiss, questionTime, shotBall, shotEvents, rimDist, backspin,
    hermite, smooth, mulberry
  };
  root.BasketballMotion = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
