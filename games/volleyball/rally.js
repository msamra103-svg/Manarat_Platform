/* الكرة الطائرة V24 — deterministic rally engine.
 *
 * Pure math: no DOM, no THREE. The same module drives the 3D renderer, the 2D fallback renderer and
 * the Node regression suites, so whatever the tests verify is exactly what students see.
 *
 * Units are metres, seconds and radians. World axes: x runs across the court (sidelines at ±4.5),
 * y is up, z runs along the court (end lines at ±9) and the net plane is z = 0.
 * The student's team ("home") always defends the z > 0 half.
 *
 * Every rally is a pure function of (configuration, rally time). Nothing integrates per frame, so the
 * rally looks identical at 30, 60 or 120 FPS, can be frozen at any instant and replayed in slow motion.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VolleyRally = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ───────────────────────────── constants ─────────────────────────────
  const COURT = Object.freeze({
    halfWidth: 4.5, halfLength: 9, attackLine: 3, lineWidth: 0.05,
    netTop: 2.43, netBottom: 1.43, netHalfWidth: 4.95, antenna: 4.5, antennaHeight: 0.8, postX: 5.5,
  });
  const BALL = Object.freeze({ radius: 0.105, mass: 0.27 });
  // Drag: 0.5·ρ·Cd·A/m with ρ = 1.2, Cd ≈ 0.30, A = π·0.105². Magnus coefficient tuned for ~3 m/s² dip
  // on a 20 m/s topspin spike. Restitution and friction approximate a 0.29 bar FIVB ball on sports maple.
  const PHYS = Object.freeze({ g: 9.81, dt: 1 / 240, drag: 0.0231, magnus: 0.0045, restitution: 0.62, friction: 0.8, rolling: 0.65 });
  // Body proportions as fractions of standing height. Shared with athletes.js so contacts are reachable.
  const BODY = Object.freeze({
    ankle: 0.04, shin: 0.235, thigh: 0.235, hip: 0.51, hipWidth: 0.052, pelvis: 0.53, waist: 0.6, chest: 0.71,
    neck: 0.815, head: 0.895, shoulder: 0.8, shoulderWidth: 0.105, upperArm: 0.172, foreArm: 0.15, palm: 0.045,
    fingers: 0.1, heel: 0.03, toe: 0.11,
  });
  const FREEZE_LEAD = 0.07; // seconds before the decisive contact at which the question appears
  const R = BALL.radius;

  // ───────────────────────────── small math ─────────────────────────────
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return mul(a, 1 / l); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const dist = (a, b) => len(sub(a, b));
  const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul2 = (a, s) => [a[0] * s, a[1] * s];
  const len2 = (a) => Math.hypot(a[0], a[1]);
  const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
  const norm2 = (a) => { const l = len2(a) || 1; return [a[0] / l, a[1] / l]; };
  const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const angleLerp = (a, b, t) => a + wrap(b - a) * t;
  // Facing yaw θ: forward = (sin θ, cos θ) on the (x, z) ground plane; right = (−cos θ, sin θ).
  const fwdOf = (th) => [Math.sin(th), Math.cos(th)];
  const rightOf = (th) => [-Math.cos(th), Math.sin(th)];
  const yawOf = (d) => Math.atan2(d[0], d[1]);
  const ground = (p) => [p[0], p[2]];
  const at = (g, y) => [g[0], y, g[1]];

  function rng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(...parts) {
    let h = 2166136261;
    for (const c of parts.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

  // Quaternions [x, y, z, w] for ball orientation.
  const qmul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  function qexp(v) {
    const a = len(v);
    if (a < 1e-9) return [0, 0, 0, 1];
    const s = Math.sin(a / 2) / a;
    return [v[0] * s, v[1] * s, v[2] * s, Math.cos(a / 2)];
  }

  // Monotone cubic (Fritsch–Carlson) through [[t, value], …].
  function monotone(keys, t) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const slope = (k) => (keys[k + 1][1] - keys[k][1]) / (keys[k + 1][0] - keys[k][0]);
    const tangent = (k) => {
      if (k === 0) return slope(0);
      if (k === n - 1) return slope(n - 2);
      const a = slope(k - 1), b = slope(k);
      return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
    };
    const [t0, y0] = keys[i], [t1, y1] = keys[i + 1], h = t1 - t0, u = (t - t0) / h;
    const m0 = tangent(i) * h, m1 = tangent(i + 1) * h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1;
  }

  // ───────────────────────────── ball physics ─────────────────────────────
  function acceleration(v, w) {
    const s = len(v), m = cross(w, v);
    return [
      -PHYS.drag * s * v[0] + PHYS.magnus * m[0],
      -PHYS.g - PHYS.drag * s * v[1] + PHYS.magnus * m[1],
      -PHYS.drag * s * v[2] + PHYS.magnus * m[2],
    ];
  }
  // Second-order step (Heun on velocity, trapezoid on position). Fixed sub-step → fully deterministic.
  function step(p, v, w, h) {
    const a1 = acceleration(v, w);
    const a2 = acceleration(add(v, mul(a1, h)), w);
    const v2 = add(v, mul(add(a1, a2), h / 2));
    return [add(p, mul(add(v, v2), h / 2)), v2];
  }
  function integrate(p0, v0, w, T, keep) {
    const n = Math.max(1, Math.ceil(T / PHYS.dt - 1e-9)), h = T / n;
    let p = p0.slice(), v = v0.slice();
    const pts = keep ? new Float64Array((n + 1) * 6) : null;
    if (keep) pts.set([...p, ...v], 0);
    for (let i = 0; i < n; i++) {
      [p, v] = step(p, v, w, h);
      if (keep) pts.set([...p, ...v], (i + 1) * 6);
    }
    return { p, v, h, n, pts };
  }
  // Shooting method: initial velocity that reaches p1 exactly T seconds after leaving p0.
  function solveShot(p0, p1, T, w = [0, 0, 0]) {
    let v = [(p1[0] - p0[0]) / T, (p1[1] - p0[1]) / T + 0.5 * PHYS.g * T, (p1[2] - p0[2]) / T];
    for (let i = 0; i < 80; i++) {
      const e = sub(p1, integrate(p0, v, w, T).p);
      if (len(e) < 1e-4) break;
      v = add(v, mul(e, 1.1 / T));
    }
    return v;
  }
  // Smallest flight time ≥ T whose path crosses the net plane at least `margin` above the tape.
  function netClearTime(p0, p1, T, w = [0, 0, 0], margin = 0.2) {
    if (Math.sign(p0[2]) === Math.sign(p1[2])) return T;
    for (let k = 0; k < 24; k++) {
      const TT = T + k * 0.04, v = solveShot(p0, p1, TT, w), res = integrate(p0, v, w, TT, true);
      for (let i = 1; i <= res.n; i++) {
        const z0 = res.pts[(i - 1) * 6 + 2], z1 = res.pts[i * 6 + 2];
        if (Math.sign(z0) !== Math.sign(z1)) {
          const f = Math.abs(z0) / Math.abs(z1 - z0), y = lerp(res.pts[(i - 1) * 6 + 1], res.pts[i * 6 + 1], f);
          if (y >= COURT.netTop + R + margin) return TT;
          break;
        }
      }
    }
    return T + 0.96;
  }
  const inCourt = (p) => Math.abs(p[0]) <= COURT.halfWidth + 0.035 && Math.abs(p[2]) <= COURT.halfLength + 0.035;
  const sideOf = (z) => (z > 0 ? 'home' : 'away');

  /* Free flight with collisions: net (band, mesh and antennas), floor bounces, rolling, arena walls.
   * Returns sampled points plus discrete events used by rules, audio, camera and net deformation. */
  function simulateFree(t0, p0, v0, w0, tMax, opts = {}) {
    const h = PHYS.dt, events = [], pieces = [];
    let p = p0.slice(), v = v0.slice(), w = w0.slice(), t = t0, rolling = false, netTouched = false, crossed = false, resting = false;
    const pts = [];
    pts.push(...p, ...v);
    pieces.push({ t0, w: w.slice() });
    const n = Math.ceil(tMax / h);
    for (let i = 0; i < n; i++) {
      const prev = p;
      if (resting) { v = [0, 0, 0]; }
      else if (rolling) {
        const sp = Math.hypot(v[0], v[2]);
        const dec = Math.max(0, sp - PHYS.rolling * h);
        v = sp > 1e-6 ? [v[0] * dec / sp, 0, v[2] * dec / sp] : [0, 0, 0];
        p = [p[0] + v[0] * h, R, p[2] + v[2] * h];
        if (dec < 0.03) { resting = true; events.push({ type: 'rest', t: t + h, p: p.slice() }); }
      } else {
        [p, v] = step(p, v, w, h);
      }
      t += h;
      // Net plane crossing (ball centre enters |z| < r).
      const signChange = Math.sign(prev[2]) !== Math.sign(p[2]);
      if (!rolling && !resting && (signChange || (!netTouched && Math.abs(p[2]) < R && Math.abs(prev[2]) >= R))) {
        // Crossing: interpolate to the plane. Touching the mesh before crossing: the contact is the ball itself.
        const f = signChange ? clamp(Math.abs(prev[2]) / (Math.abs(prev[2] - p[2]) || 1)) : 1;
        const cx = lerp(prev[0], p[0], f), cy = lerp(prev[1], p[1], f);
        const inNetX = Math.abs(cx) <= COURT.netHalfWidth;
        if (!netTouched && inNetX && cy < COURT.netTop + R * 0.4 && cy > COURT.netBottom - R) {
          netTouched = true;
          const side = Math.sign(prev[2]) || 1;
          events.push({ type: 'net', t, p: [cx, cy, 0], v: v.slice(), side: sideOf(side) , tape: cy > COURT.netTop - 0.1 });
          // The mesh absorbs most energy; the ball drops back on the hitter's side.
          p = [cx, cy, signChange ? side * R * 0.35 : p[2]]; // the ball sinks into the bulging mesh, then drops
          v = [v[0] * 0.5, Math.min(v[1], 0) * 0.3 - 0.35, -v[2] * 0.1];
          w = mul(w, 0.25);
          pieces.push({ t0: t, w: w.slice() });
        } else if (signChange && !crossed) {
          crossed = true;
          const outside = Math.abs(cx) > COURT.antenna - R * 0.5;
          events.push({ type: outside ? 'outside-antenna' : 'cross', t, p: [cx, cy, 0], to: sideOf(p[2]) });
        }
      }
      // Floor.
      if (!rolling && !resting && p[1] < R && v[1] < 0) {
        const f = (prev[1] - R) / ((prev[1] - p[1]) || 1);
        const hit = lerp3(prev, p, clamp(f));
        hit[1] = R;
        const tt = t - h + h * clamp(f);
        const first = !events.some((e) => e.type === 'floor');
        events.push({ type: 'floor', t: tt, p: hit, vIn: v.slice(), in: inCourt(hit), side: sideOf(hit[2]), first, speed: len(v) });
        p = hit;
        v = [v[0] * PHYS.friction, -v[1] * PHYS.restitution, v[2] * PHYS.friction];
        // After a bounce the ball tends toward rolling spin.
        w = mul(cross([0, 1, 0], [v[0], 0, v[2]]), 0.8 / R);
        if (Math.abs(v[1]) < 0.45) { v[1] = 0; rolling = true; w = mul(cross([0, 1, 0], [v[0], 0, v[2]]), 1 / R); }
        pieces.push({ t0: tt, w: w.slice() });
      }
      // Arena boards and stands.
      if (Math.abs(p[0]) > 12.6 && Math.sign(v[0]) === Math.sign(p[0])) { v[0] *= -0.35; events.push({ type: 'wall', t, p: p.slice() }); }
      if (Math.abs(p[2]) > 15.6 && Math.sign(v[2]) === Math.sign(p[2])) { v[2] *= -0.35; events.push({ type: 'wall', t, p: p.slice() }); }
      if (rolling) w = mul(cross([0, 1, 0], [v[0], 0, v[2]]), 1 / R);
      pts.push(...p, ...v);
    }
    return { seg: { type: 'free', t0, t1: t0 + n * h, h, pts: Float64Array.from(pts), pieces }, events };
  }

  // ───────────────────────────── teams ─────────────────────────────
  // Rotation order at rotation 0 for a 5-1 system: positions 1…6 hold S, OH1, MB1, OPP, OH2, MB2.
  const ROSTER = Object.freeze({
    home: [
      { role: 'S', number: 3, height: 1.88 }, { role: 'OH', number: 7, height: 1.96 }, { role: 'MB', number: 11, height: 2.03 },
      { role: 'OPP', number: 9, height: 1.99 }, { role: 'OH', number: 4, height: 1.94 }, { role: 'MB', number: 15, height: 2.01 },
    ],
    away: [
      { role: 'S', number: 2, height: 1.87 }, { role: 'OH', number: 10, height: 1.95 }, { role: 'MB', number: 14, height: 2.02 },
      { role: 'OPP', number: 8, height: 1.98 }, { role: 'OH', number: 5, height: 1.93 }, { role: 'MB', number: 12, height: 2.0 },
    ],
  });
  // Team frame: u = lateral (team's right is +u), w = distance from the net into the team's own half.
  const toWorld = (team, uw) => (team === 'home' ? [uw[0], uw[1]] : [-uw[0], -uw[1]]);
  const toWorld3 = (team, u, y, w) => { const g = toWorld(team, [u, w]); return [g[0], y, g[1]]; };
  const toTeam = (team, xz) => (team === 'home' ? [xz[0], xz[1]] : [-xz[0], -xz[1]]);
  // Facing in team frame given as a direction (du, dw); world yaw.
  const teamYaw = (team, du, dw) => yawOf(toWorld(team, [du, dw]));
  const NET_YAW = { home: Math.PI, away: 0 };
  const other = (team) => (team === 'home' ? 'away' : 'home');
  const BASE = { 1: [3, 6.6], 2: [3, 2.2], 3: [0, 2.2], 4: [-3, 2.2], 5: [-3, 6.6], 6: [0, 7] };

  const positionOf = (rotation, idx) => ((((idx - rotation) % 6) + 6) % 6) + 1;
  const playerAt = (rotation, pos) => (((pos - 1 + rotation) % 6) + 6) % 6;
  function lineup(rotation) {
    const front = [2, 3, 4].map((p) => playerAt(rotation, p)), back = [1, 5, 6].map((p) => playerAt(rotation, p));
    const roleOf = (i) => ROSTER.home[i].role;
    const find = (list, roles) => list.find((i) => roles.includes(roleOf(i)));
    return {
      setter: 0, setterFront: front.includes(0),
      front: { left: find(front, ['OH']), middle: find(front, ['MB']), right: find(front, ['S', 'OPP']) },
      back: { left: find(back, ['OH']), middle: find(back, ['MB']), right: find(back, ['S', 'OPP']) },
      frontList: front, backList: back,
    };
  }

  // ───────────────────────────── actors ─────────────────────────────
  const SPRINT = 7.6; // peak m/s a volleyball player can plausibly reach over a few metres
  const LOCKING = ['pass', 'dig', 'set', 'serveFloat', 'pickup', 'throw'];
  class Actor {
    constructor(id, team, idx, def) {
      Object.assign(this, { id, team, idx, role: def.role, number: def.number, height: def.height, official: !!def.official });
      this.s = def.height / 1.95;
      this.segs = []; this.acts = []; this.steps = { L: [], R: [] };
      this.cursor = 0; this.pos = [0, 0]; this.face = 0; this.warnings = []; this.busy = -Infinity;
    }
    stance(pos, face, width = 0.16, stagger = 0) {
      const r = rightOf(face), f = fwdOf(face), w = width * this.s;
      return { L: add2(add2(pos, mul2(r, -w)), mul2(f, stagger)), R: add2(add2(pos, mul2(r, w)), mul2(f, -stagger)) };
    }
    place(pos, face, t = 0) {
      this.pos = pos.slice(); this.face = face; this.cursor = t;
      const st = this.stance(pos, face, 0.17, 0.04);
      this.steps.L = [{ land: -1e9, lift: Infinity, p: st.L }];
      this.steps.R = [{ land: -1e9, lift: Infinity, p: st.R }];
    }
    idleTo(t) {
      if (t > this.cursor + 1e-9) { this.segs.push({ type: 'idle', t0: this.cursor, t1: t, pos: this.pos.slice(), face: this.face }); this.cursor = t; }
    }
    lastPlant(foot) { const l = this.steps[foot]; return l[l.length - 1]; }
    plant(foot, land, p, opts = {}) {
      const prev = this.lastPlant(foot);
      if (land <= prev.land + 0.08) land = prev.land + 0.08;
      let lift = opts.lift ?? land - 0.3;
      lift = clamp(lift, prev.land + 0.05, land - 0.07);
      prev.lift = Math.min(prev.lift, lift);
      this.steps[foot].push({ land, lift: Infinity, p: p.slice(), air: !!opts.air, locked: !!opts.locked, liftPrev: opts.lift ?? land - 0.3 });
    }
    act(type, t0, tc, t1, data = {}) {
      if (this.floorT !== undefined && t0 < this.floorT) t0 = this.floorT;
      this.acts.push({ type, t0, tc, t1, data });
      if (LOCKING.includes(type)) this.busy = Math.max(this.busy, tc + (type === 'dig' ? 0.4 : 0.28));
      return this;
    }

    // Locomotion. Root moves on a straight path; footsteps are planted along it so feet never skate.
    move(t0, dest, face1, o = {}) {
      if (this.floorT !== undefined && t0 < this.floorT) t0 = this.floorT;
      if (t0 < this.cursor - 1e-6) { this.warnings.push({ type: 'overlap', t: t0, cursor: this.cursor, id: this.id }); t0 = this.cursor; }
      this.idleTo(t0);
      const from = this.pos.slice(), D = len2(sub2(dest, from));
      const dur = o.dur ?? Math.max(D < 0.12 ? 0.45 : 0.32, (1.5 * D) / (o.speed || 3.8));
      const dir = D > 1e-6 ? norm2(sub2(dest, from)) : fwdOf(face1);
      const travelYaw = yawOf(dir);
      let faceMode = o.faceMode || 'blend';
      if (!o.faceMode && D > 2.4 && Math.abs(wrap(travelYaw - face1)) > 1.2 && Math.abs(wrap(travelYaw - this.face)) > 0.3) faceMode = 'travel';
      const seg = { type: 'move', t0, t1: t0 + dur, from, to: dest.slice(), D, face0: this.face, face1, travelYaw, faceMode, ease: o.ease || 'inout', keys: o.keys || null, style: o.style || 'auto' };
      this.segs.push(seg);
      if (dur > 0 && D / dur * 1.5 > SPRINT && !o.keys) this.warnings.push({ t: t0, speed: (D / dur) * 1.5, id: this.id });
      this.cursor = seg.t1; this.pos = dest.slice(); this.face = face1;
      // Scripted footwork (approaches) is locked; all other footsteps come from the gait controller.
      if (o.steps) for (const st of o.steps) this.plant(st.foot, st.land, st.p, { ...st, locked: true });
      return seg;
    }
    // Arrive at dest exactly at time t, leaving as late as a natural pace allows.
    arriveBy(t, dest, face, o = {}) {
      const D = len2(sub2(dest, this.pos));
      const natural = Math.max(D < 0.12 ? 0.45 : 0.32, (1.5 * D) / (o.speed || 3.8));
      let start = Math.max(this.cursor, this.busy, t - natural);
      if (o.notBefore !== undefined) start = Math.max(start, o.notBefore);
      // Contact-critical arrivals (o.strict) may sprint; formation moves keep a natural pace.
      const dur = o.strict ? Math.max(0.2, t - start) : Math.max(t - start, natural);
      return this.move(start, dest, face, { ...o, dur });
    }
    jump(tJ, tL, to, h, o = {}) {
      if (this.cursor > tJ + 1e-6) this.warnings.push({ type: 'late-jump', id: this.id, by: this.cursor - tJ });
      this.idleTo(tJ);
      const seg = { type: 'jump', t0: tJ, t1: tL, from: this.pos.slice(), to: to.slice(), h, face: o.face ?? this.face };
      this.segs.push(seg);
      this.cursor = tL; this.pos = to.slice(); this.face = seg.face;
      const st = this.stance(to, seg.face, o.width ?? 0.17, o.stagger ?? 0.06);
      this.plant('L', tL, st.L, { lift: tJ, air: true, locked: true });
      this.plant('R', tL + (o.asym ?? 0.025), st.R, { lift: tJ, air: true, locked: true });
      return seg;
    }
    autoSteps(seg) {
      const { t0, t1, D } = seg, dur = t1 - t0;
      const final = this.stance(seg.to, seg.face1, 0.17, 0.04);
      const cur = { L: this.lastPlant('L').p, R: this.lastPlant('R').p };
      if (D < 0.14) {
        const need = (f) => len2(sub2(final[f], cur[f]));
        if (need('L') < 0.06 && need('R') < 0.06) return;
        const first = need('L') > need('R') ? 'L' : 'R', second = first === 'L' ? 'R' : 'L';
        this.plant(first, t0 + dur * 0.48, final[first], { lift: t0 + 0.04 });
        this.plant(second, t0 + dur * 0.95, final[second], { lift: t0 + dur * 0.5 });
        return;
      }
      const dir = norm2(sub2(seg.to, seg.from));
      const mid = faceAt(seg, 0.5), lateral = Math.abs(dot2(dir, fwdOf(mid))) < 0.5;
      const speed = D / dur;
      if (lateral) {
        const stepLen = 0.6 * this.s, n = Math.max(1, Math.ceil(D / stepLen));
        const lead = dot2(dir, rightOf(mid)) > 0 ? 'R' : 'L', trail = lead === 'R' ? 'L' : 'R';
        for (let k = 1; k <= n; k++) {
          const dk = (D * k) / n, last = k === n;
          const tl = last ? t1 - 0.06 : clamp(timeAtDistance(seg, dk - 0.12), t0 + 0.12, t1 - 0.08);
          const fy = faceAt(seg, (tl - t0) / dur), base = pathAt(seg, dk), r = rightOf(fy);
          const pl = last ? final[lead] : add2(base, mul2(r, (lead === 'R' ? 1 : -1) * 0.21 * this.s));
          const pt = last ? final[trail] : add2(base, mul2(r, (trail === 'R' ? 1 : -1) * 0.13 * this.s));
          this.plant(lead, tl, pl, { lift: tl - 0.2 });
          this.plant(trail, tl + 0.13, pt, { lift: tl - 0.02 });
        }
        return;
      }
      const stepLen = clamp(0.48 + 0.2 * speed, 0.48, 1.25) * this.s;
      const n = Math.max(2, Math.round(D / stepLen));
      const behind = (f) => dot2(sub2(cur[f], seg.from), dir);
      let foot = behind('L') < behind('R') ? 'L' : 'R';
      const lead = Math.min(0.26, stepLen * 0.3);
      let lastLand = t0;
      for (let k = 1; k <= n; k++) {
        const dk = (D * k) / n, last = k === n;
        let tl = last ? t1 - 0.04 : timeAtDistance(seg, Math.max(0.05, dk - lead));
        tl = Math.max(tl, lastLand + 0.1, t0 + 0.16);
        const fy = faceAt(seg, clamp((tl - t0) / dur));
        const p = last ? final[foot] : add2(pathAt(seg, dk), mul2(rightOf(fy), (foot === 'R' ? 1 : -1) * 0.11 * this.s));
        const gap = Math.max(0.12, tl - lastLand), swing = clamp(2 * gap * (gap < 0.36 ? 0.62 : 0.42), 0.14, 0.44);
        this.plant(foot, tl, p, { lift: k === 1 ? t0 + 0.03 : tl - swing });
        lastLand = tl;
        foot = foot === 'L' ? 'R' : 'L';
      }
      this.plant(foot, Math.max(t1 + 0.1, lastLand + 0.12), final[foot], { lift: lastLand - 0.02 });
    }
  }

  function easeOf(seg, u) {
    if (seg.ease === 'in') return u * u;
    if (seg.ease === 'out') return 1 - (1 - u) * (1 - u);
    if (seg.ease === 'linear') return u;
    return u * u * (3 - 2 * u);
  }
  function distanceAt(seg, t) {
    const dur = seg.t1 - seg.t0, u = clamp((t - seg.t0) / (dur || 1));
    if (seg.keys) return monotone(seg.keys, t - seg.t0);
    return seg.D * easeOf(seg, u);
  }
  function timeAtDistance(seg, s) {
    let a = seg.t0, b = seg.t1;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (distanceAt(seg, m) < s) a = m; else b = m; }
    return (a + b) / 2;
  }
  const pathAt = (seg, s) => (seg.D > 1e-9 ? lerp2(seg.from, seg.to, clamp(s / seg.D)) : seg.from.slice());
  function faceAt(seg, u) {
    if (seg.faceMode === 'travel') {
      if (u < 0.2) return angleLerp(seg.face0, seg.travelYaw, smooth(u / 0.2));
      if (u < 0.78) return seg.travelYaw;
      return angleLerp(seg.travelYaw, seg.face1, smooth((u - 0.78) / 0.22));
    }
    return angleLerp(seg.face0, seg.face1, smooth(u / 0.55));
  }

  // ───────────────────────────── planner ─────────────────────────────
  class Planner {
    constructor(cfg) {
      this.cfg = cfg;
      this.mode = cfg.mode || 'match';
      this.serving = cfg.serving || 'home';
      this.rotation = { home: cfg.rotation?.home || 0, away: cfg.rotation?.away || 0 };
      this.aim = ['left', 'center', 'right'].includes(cfg.aim) ? cfg.aim : 'center';
      this.shot = cfg.shot === 'tip' ? 'tip' : 'spike';
      this.outcome = cfg.outcome === 'correct' || cfg.outcome === 'wrong' ? cfg.outcome : null;
      this.neutral = cfg.outcome === 'neutral';
      this.seed = cfg.seed ?? hash(this.mode, this.serving, this.rotation.home, this.rotation.away, cfg.round || 0);
      this.r = rng(this.seed);
      this.rb = rng(this.seed ^ 0x5bd1e995);
      this.actors = []; this.officials = []; this.events = []; this.contacts = []; this.ball = { segs: [] };
      this.bt = 0; this.bp = null; this.bv = [0, 0, 0]; this.bq = [0, 0, 0, 1]; this.bw = [0, 0, 0];
      this.decisive = null; this.verdict = null; this.flightWarnings = []; this.lineups = { home: lineup(this.rotation.home), away: lineup(this.rotation.away) };
      for (const team of ['home', 'away']) ROSTER[team].forEach((def, idx) => this.actors.push(new Actor(this.actors.length, team, idx, def)));
      this.makeOfficials();
    }
    A(team, idx) { return this.actors[(team === 'home' ? 0 : 6) + idx]; }
    makeOfficials() {
      const defs = [
        { name: 'first', pos: [6.05, 0], face: -Math.PI / 2, stand: 1.25, height: 1.8 },
        { name: 'second', pos: [-5.9, 0.1], face: Math.PI / 2, stand: 0, height: 1.78 },
        { name: 'lineA', pos: [5.6, -9.9], face: -Math.PI * 0.72, stand: 0, height: 1.76 },
        { name: 'lineB', pos: [-5.6, 9.9], face: Math.PI * 0.28, stand: 0, height: 1.77 },
      ];
      defs.forEach((d, i) => {
        const a = new Actor(100 + i, 'official', i, { role: 'REF', number: 0, height: d.height, official: true });
        a.name = d.name; a.stand = d.stand; a.place(d.pos, d.face); this.officials.push(a);
      });
    }
    event(e) { this.events.push(e); return e; }
    contact(t, actor, kind, p) {
      const c = { t, actor: actor.id, team: actor.team, kind, p: p.slice() };
      this.contacts.push(c); this.event({ type: 'contact', ...c });
      return c;
    }
    // Ball path builders.
    ballStart(t, p) { this.bt = t; this.bp = p.slice(); this.bv = [0, 0, 0]; }
    ballHold(t1, p) {
      p = p || this.bp;
      this.ball.segs.push({ type: 'hold', t0: this.bt, t1, p: p.slice(), q0: this.bq.slice() });
      this.bt = t1; this.bp = p.slice(); this.bv = [0, 0, 0];
    }
    ballCarry(t1, fn) { // fn(t) → position; used for pick-up and carrying with the hands
      this.ball.segs.push({ type: 'carry', t0: this.bt, t1, fn, q0: this.bq.slice() });
      this.bt = t1; this.bp = fn(t1); this.bv = [0, 0, 0];
    }
    liftTo(t1, p1) { // both hands raise the ball smoothly (no jump between hold and release points)
      const t0 = this.bt, p0 = this.bp.slice();
      this.ballCarry(t1, (t) => lerp3(p0, p1, smooth((t - t0) / (t1 - t0))));
    }
    ballFly(t1, p1, w = [0, 0, 0]) {
      const T = t1 - this.bt, v0 = solveShot(this.bp, p1, T, w), res = integrate(this.bp, v0, w, T, true);
      // Scripted flights must never pass through the net.
      for (let i = 1; i <= res.n; i++) {
        const z0 = res.pts[(i - 1) * 6 + 2], z1 = res.pts[i * 6 + 2];
        if (Math.sign(z0) !== Math.sign(z1)) {
          const f = Math.abs(z0) / Math.abs(z1 - z0), x = lerp(res.pts[(i - 1) * 6], res.pts[i * 6], f), y = lerp(res.pts[(i - 1) * 6 + 1], res.pts[i * 6 + 1], f);
          if (y < COURT.netTop + R && Math.abs(x) < COURT.netHalfWidth) this.flightWarnings.push({ type: 'through-net', t: this.bt, y });
          break;
        }
      }
      const seg = { type: 'flight', t0: this.bt, t1, h: res.h, pts: res.pts, w: w.slice(), q0: this.bq.slice(), p0: this.bp.slice(), v0 };
      this.ball.segs.push(seg);
      this.bq = qmul(qexp(mul(w, T)), this.bq);
      this.bt = t1; this.bp = p1.slice(); this.bv = res.v; this.bw = w.slice();
      return seg;
    }
    ballFree(v0, w, tMax = 5) {
      const { seg, events } = simulateFree(this.bt, this.bp, v0, w, tMax);
      seg.q0 = this.bq.slice();
      // Pre-compute orientation at each spin piece boundary.
      let q = this.bq.slice();
      seg.pieces.forEach((pc, i) => { pc.q0 = q; const next = seg.pieces[i + 1]; const tEnd = next ? next.t0 : seg.t1; q = qmul(qexp(mul(pc.w, tEnd - pc.t0)), q); });
      this.ball.segs.push(seg);
      events.forEach((e) => this.event(e));
      this.bt = seg.t1;
      return { seg, events };
    }
    serverHold(a) { // ball held in front of the waist
      const f = fwdOf(a.face);
      return at(add2(a.pos, mul2(f, 0.3 * a.s)), 0.56 * a.height);
    }

    // ── formations (team frame [u, w]) ──
    preServeSpots(team) {
      if (this.attackDrill && team === 'away') return this.baseDefense(team);
      const rot = this.rotation[team], L = this.lineups[team], spots = {};
      const serving = this.serving === team;
      for (let i = 0; i < 6; i++) spots[i] = BASE[positionOf(rot, i)].slice();
      if (serving) {
        const server = playerAt(rot, 1);
        const s = ROSTER[team][server].height / 1.95;
        spots[server] = this.serveJump ? [2.2, 9.85 + 2.5 * s] : [2.4, 10.6];
        // Front row stands near the net, setter ready to penetrate.
      } else {
        // Three-person serve reception: front OH, back OH, back MB.
        // The front outside hitter receives on the left so he can open into his approach.
        spots[L.front.left] = [-2.6, 5.5];
        const order = [L.back.left, L.back.middle].sort((a, b) => BASE[positionOf(rot, a)][0] - BASE[positionOf(rot, b)][0]);
        spots[order[0]] = [0.1, 6.9]; spots[order[1]] = [2.6, 6.4];
        if (L.setterFront) spots[0] = [1.7, 1.2]; else spots[0] = [2.6, 4.8];
        spots[L.front.middle] = [0.2, 1.1];
        const right = L.setterFront ? L.back.right : L.front.right; // OPP
        spots[right] = L.setterFront ? [3.6, 8.0] : [3.3, 1.6];
      }
      return spots;
    }
    baseDefense(team) {
      const L = this.lineups[team], spots = {};
      spots[L.front.left] = [-2.8, 1.0]; spots[L.front.middle] = [0, 0.9]; spots[L.front.right] = [2.8, 1.0];
      spots[L.back.left] = [-2.7, 6.9]; spots[L.back.middle] = [0, 7.8]; spots[L.back.right] = [2.7, 6.9];
      return spots;
    }
    offense(team) {
      const L = this.lineups[team], spots = {};
      spots[L.front.left] = [-4.05, 4.1]; spots[L.front.middle] = [0.65, 3.2];
      spots[L.front.right] = L.front.right === 0 ? [0.95, 0.75] : [4.0, 4.1];
      spots[L.back.left] = [-2.6, 6.8]; spots[L.back.middle] = [0, 7.6];
      spots[L.back.right] = L.back.right === 0 ? [0.95, 0.75] : [2.6, 6.8];
      return spots;
    }
    // Move a set of team-frame spots, each player arriving by a given time, never interrupting an action.
    formation(team, spots, tStart, tArrive, skip = [], face = null) {
      for (const [idx, uw] of Object.entries(spots)) {
        const i = Number(idx); if (skip.includes(i)) continue;
        const a = this.A(team, i), dest = toWorld(team, uw);
        const yaw = face ?? NET_YAW[team];
        if (len2(sub2(dest, a.pos)) < 0.08 && Math.abs(wrap(a.face - yaw)) < 0.2) continue;
        a.arriveBy(Math.max(tArrive, a.cursor + 0.35), dest, yaw, { notBefore: Math.max(tStart, a.cursor) });
      }
    }

    // ── pre-rally: players walk into the rotation and the ball reaches the server ──
    preroll() {
      const prev = this.cfg.previous;
      const spots = { home: this.preServeSpots('home'), away: this.preServeSpots('away') };
      const server = this.ballOwner || this.A(this.serving, playerAt(this.rotation[this.serving], 1));
      const serveFace = NET_YAW[server.team];
      for (const a of this.actors) {
        const dest = toWorld(a.team, spots[a.team][a.idx]);
        const face = a === server ? serveFace : NET_YAW[a.team];
        const start = prev?.actors?.[a.id];
        if (start) { a.place([start[0], start[1]], start[2] ?? face); }
        else a.place(dest, face);
      }
      let tReady = 0.6;
      if (prev?.actors) {
        for (const a of this.actors) {
          const dest = toWorld(a.team, spots[a.team][a.idx]);
          const face = a === server ? serveFace : NET_YAW[a.team];
          if (len2(sub2(dest, a.pos)) > 0.05 || Math.abs(wrap(face - a.face)) > 0.1) {
            const D = len2(sub2(dest, a.pos));
            a.move(0.2 + (a.idx % 3) * 0.12, dest, face, { speed: 2.4, dur: Math.max(0.6, D / 1.9) });
          }
        }
        tReady = Math.max(tReady, ...this.actors.map((a) => a.cursor + 0.2));
      }
      // Ball to the server.
      const hold = () => this.serverHold(server);
      if (prev?.ball && prev.actors) {
        const restBall = prev.ball.slice();
        restBall[1] = R;
        // The nearest player of either team retrieves the ball and sends it on to the server.
        let best = null;
        for (const a of this.actors) {
          if (a === server) continue;
          const d = len2(sub2(ground(restBall), a.pos)) + (a.team === this.serving ? 0.3 : 0);
          if (!best || d < best.d) best = { a, d };
        }
        const ret = best.a, dir = norm2(sub2(ground(restBall), ret.pos));
        const pickRoot = sub2(ground(restBall), mul2(dir, 0.42 * ret.s));
        const pickFace = yawOf(dir);
        const t0 = 0.35;
        // Retriever detours to the ball before taking his rotation spot (re-plans his route).
        const rDest = toWorld(ret.team, spots[ret.team][ret.idx]);
        ret.segs = []; ret.cursor = 0; ret.place(prev.actors[ret.id].slice(0, 2), prev.actors[ret.id][2] ?? ret.face);
        ret.move(t0, pickRoot, pickFace, { speed: 3.2, dur: Math.max(0.5, len2(sub2(pickRoot, ret.pos)) / 2.3) });
        const tPick = ret.cursor + 0.15, tUp = tPick + 0.45;
        ret.act('pickup', ret.cursor - 0.1, tPick, tUp + 0.15, { ball: restBall });
        ret.idleTo(tUp + 0.1);
        const serverReady = Math.max(tReady, server.cursor) + 0.1;
        const throwFace = yawOf(sub2(server.pos, ret.pos));
        ret.move(tUp + 0.1, ret.pos, throwFace, { dur: 0.35 });
        const tThrow = ret.cursor + 0.05;
        const carryRoot = ret.pos, carryFace = throwFace;
        this.ballStart(0, restBall);
        this.ballHold(tPick);
        const carryPoint = (t) => {
          const k = smooth((t - tPick) / (tUp - tPick));
          const face = t < tUp + 0.1 ? pickFace : angleLerp(pickFace, carryFace, smooth((t - tUp - 0.1) / 0.35));
          const base = t < tUp + 0.1 ? pickRoot : carryRoot;
          const f = fwdOf(face);
          return at(add2(base, mul2(f, lerp(0.42, 0.3, k) * ret.s)), lerp(R, 1.12 * ret.s, k));
        };
        this.ballCarry(tThrow, carryPoint);
        ret.act('throw', tThrow - 0.35, tThrow, tThrow + 0.4, { to: server.id });
        const tCatch = Math.max(serverReady, tThrow + 0.95);
        // The server is in place long before the ball arrives; the ball is caught at the hold point.
        this.ballFly(tCatch, hold(), [0, 0, 0]);
        server.act('catch', tCatch - 0.35, tCatch, tCatch + 0.2, {});
        this.event({ type: 'catch', t: tCatch, actor: server.id });
        ret.arriveBy(Math.max(ret.cursor + 0.6, tCatch + 0.2), rDest, NET_YAW[ret.team], { notBefore: tThrow + 0.3, speed: 3 });
        tReady = Math.max(tReady, tCatch + 0.3, ret.cursor + 0.1);
      } else {
        this.ballStart(0, hold());
      }
      this.tHold = tReady;
      for (const a of this.actors) a.idleTo(this.tHold);
      this.ballHold(this.tHold);
      this.event({ type: 'ready', t: this.tHold });
      return this.tHold;
    }

    // ── serve ──
    serve(team, freeze = false) {
      const rot = this.rotation[team], server = this.A(team, playerAt(rot, 1)), s = server.s;
      const jump = this.serveJump;
      const t0 = this.tHold, fy = NET_YAW[team], f = fwdOf(fy), rt = rightOf(fy);
      this.officials[0].act('whistle', t0 + 0.05, t0 + 0.2, t0 + 0.75, {});
      this.event({ type: 'whistle', t: t0 + 0.2, kind: 'serve' });
      // Ritual: one bounce of the ball before the toss.
      const hold = this.serverHold(server);
      const tPush = t0 + 0.55, tFloor = t0 + 0.82, tBack = t0 + 1.16;
      this.ballHold(tPush);
      const floor = at(add2(add2(server.pos, mul2(f, 0.52 * s)), mul2(rt, 0.06)), R);
      this.ballFly(tFloor, floor, [0, 0, 0]);
      this.event({ type: 'bounce', t: tFloor, p: floor });
      this.ballFly(tBack, hold, [0, 0, 0]);
      server.act('dribble', t0 + 0.35, tFloor, tBack + 0.15, {});
      const tToss = t0 + 1.45;
      this.ballHold(tToss - 0.3);
      let C, tC, takeoff = null, land = null, tJ = 0, tL = 0, jumpH = 0;
      if (jump) {
        jumpH = 0.78 * Math.min(1.05, s);
        const air = Math.sqrt((2 * jumpH) / PHYS.g);
        const approach = 2.5 * s;
        const takeoffW = 9.85, startW = takeoffW + approach;
        // The server walked to the back of the zone during the pre-roll; move there now if needed.
        const spotU = toTeam(team, server.pos)[0];
        const startP = server.pos.slice();
        void startW;
        takeoff = toWorld(team, [spotU, takeoffW]);
        const carry = 0.75;
        const apex = add2(takeoff, mul2(f, carry / 2));
        land = add2(takeoff, mul2(f, carry));
        tC = tToss + 1.42;
        tJ = tC - air; tL = tC + air;
        C = at(add2(add2(apex, mul2(f, 0.3 * s)), mul2(rt, 0.16 * s)), 0.83 * server.height + 0.66 * s + jumpH);
        const release = at(add2(add2(startP, mul2(f, 0.38 * s)), mul2(rt, 0.1 * s)), 0.9 * server.height);
        this.liftTo(tToss, release);
        this.ballFly(tC, C, mul(cross([0, 1, 0], [f[0], 0, f[1]]), -6));
        this.event({ type: 'toss', t: tToss, actor: server.id });
        // Three-step approach (R small, L long, R-L close) for a right-handed server.
        const tA = tToss + 0.3, tau = tJ - tA;
        const D = len2(sub2(takeoff, startP));
        const pathP = (d, side) => add2(add2(startP, mul2(f, d)), mul2(rt, side * 0.12 * s));
        server.move(tA, takeoff, fy, {
          dur: tau, keys: [[0, 0], [tau * 0.3, D * 0.1], [tau * 0.6, D * 0.42], [tau * 0.86, D * 0.82], [tau * 0.95, D * 0.95], [tau, D]],
          steps: [
            { foot: 'R', land: tA + tau * 0.3, p: pathP(D * 0.22, 1), lift: tA + 0.03 },
            { foot: 'L', land: tA + tau * 0.6, p: pathP(D * 0.55, -1), lift: tA + tau * 0.32 },
            { foot: 'R', land: tA + tau * 0.86, p: add2(takeoff, mul2(rt, 0.15 * s)), lift: tA + tau * 0.62 },
            { foot: 'L', land: tA + tau * 0.95, p: add2(add2(takeoff, mul2(rt, -0.15 * s)), mul2(f, 0.08)), lift: tA + tau * 0.88 },
          ],
        });
        server.jump(tJ, tL, land, jumpH, { face: fy });
        server.act('serveJump', tToss - 0.2, tC, tL + 0.5, { C, release, tToss, tJ, tL, takeoff, land, jumpH });
      } else {
        const step = 0.4 * s;
        const stepTo = add2(server.pos, mul2(f, step));
        tC = tToss + 0.84;
        const release = at(add2(add2(server.pos, mul2(f, 0.3 * s)), mul2(rt, 0.12 * s)), 0.86 * server.height);
        C = at(add2(add2(stepTo, mul2(f, 0.26 * s)), mul2(rt, 0.15 * s)), 0.83 * server.height + 0.62 * s);
        this.liftTo(tToss, release);
        this.ballFly(tC, C, [0, 0, 0]);
        this.event({ type: 'toss', t: tToss, actor: server.id });
        server.move(tToss + 0.3, stepTo, fy, {
          dur: tC - 0.05 - (tToss + 0.3), ease: 'inout',
          steps: [{ foot: 'L', land: tC - 0.1, p: add2(stepTo, mul2(rt, -0.12 * s)), lift: tToss + 0.32 }],
        });
        server.act('serveFloat', tToss - 0.2, tC, tC + 0.75, { C, release, tToss });
      }
      const sv = { t: tC, p: C, actor: server, team, jump, land, tL };
      if (freeze) { this.markDecisive('serve', sv); return sv; }
      this.contact(tC, server, 'serve', C);
      return sv;
    }
    // Serving team (and server) transition into base defence after the serve.
    afterServe(sv) {
      const team = sv.team, spots = this.baseDefense(team);
      const t = sv.t + 0.1;
      this.formation(team, spots, t, sv.t + 1.4);
    }

    // ── receive (pass) ──
    chooseReceiver(team, target) {
      const L = this.lineups[team], options = [L.front.left, L.back.left, L.back.middle];
      let best = null;
      for (const i of options) { const a = this.A(team, i), d = len2(sub2(a.pos, target)); if (!best || d < best.d) best = { a, d }; }
      return best.a;
    }
    receive(team, sv, opts = {}) {
      const zone = opts.zone || pick(this.r, [[-2.4, 6.2], [0.2, 6.7], [2.5, 6.0], [-1.2, 5.4], [1.3, 7.1]]);
      const target = toWorld(team, zone);
      const rec = this.chooseReceiver(team, target);
      const incoming = norm2(sub2(target, ground(sv.p)));
      const face = yawOf(mul2(incoming, -1));
      const root = target, f = fwdOf(face);
      const C = at(add2(root, mul2(f, 0.42 * rec.s)), 0.4 * rec.height);
      const spin = sv.jump ? mul(cross([0, 1, 0], [incoming[0], 0, incoming[1]]), -28) : [0, 0, 0];
      // Flight time: physical serve speed, but never shorter than the receiver needs to get there.
      const reach = Math.max(rec.cursor, rec.busy, sv.t - 0.15) + 0.32 + (1.5 * len2(sub2(root, rec.pos))) / (SPRINT - 0.6) - sv.t;
      const T = netClearTime(sv.p, C, Math.max(sv.free ? 1.55 : sv.jump ? 0.98 : 1.28, sv.free ? reach : 0), spin, 0.22);
      const tR = sv.t + T;
      this.ballFly(tR, C, spin);
      rec.arriveBy(Math.max(rec.cursor + 0.4, tR - 0.32), root, face, { notBefore: sv.t - 0.15, speed: 4, strict: true });
      const out = norm(sub(toWorld3(team, 0.95, 2, 0.75), C));
      rec.act('pass', tR - 0.6, tR, tR + 0.5, { C, out });
      const rc = { t: tR, p: C, actor: rec, team, kind: 'pass' };
      if (opts.freeze) { this.markDecisive('receive', rc); return rc; }
      this.contact(tR, rec, 'pass', C);
      return rc;
    }
    // ── set ──
    set(team, prev, slot, T = 1.38) {
      const setter = this.A(team, 0), s = setter.s;
      const spot = toWorld(team, [0.95, 0.75]);
      const need = Math.max(setter.cursor, setter.busy, prev.t - 0.6) + 0.42 + (1.5 * len2(sub2(spot, setter.pos))) / (SPRINT - 0.8) - prev.t;
      T = Math.max(T, need);
      const face = teamYaw(team, -1, 0);
      const C = at(add2(spot, mul2(fwdOf(face), 0.1)), 1.04 * setter.height);
      const tS = prev.t + T;
      this.ballFly(tS, C, mul(cross([0, 1, 0], [prev.p[0] - C[0], 0, prev.p[2] - C[2]]), 0.4));
      setter.arriveBy(Math.max(setter.cursor + 0.3, tS - 0.42), spot, face, { notBefore: prev.t - 0.6, speed: 4.2, strict: true });
      setter.act('set', tS - 0.55, tS, tS + 0.45, { C, back: slot === 'right', quick: slot === 'middle' });
      this.contact(tS, setter, 'set', C);
      return { t: tS, p: C, actor: setter, team, kind: 'set', slot };
    }
    // ── attack approach (the hit itself is either decisive or followed by dig()) ──
    // Choose the first slot whose hitter can reach the approach start in time.
    feasibleSlot(team, tSet, prefs) {
      for (const want of prefs) {
        const { a, slot } = this.attackerFor(team, want);
        const T = slot === 'middle' ? 0.52 : slot === 'right' ? 1.08 : 1.18, tau = slot === 'middle' ? 0.62 : 0.98;
        const jumpH = (a.role === 'MB' ? 0.74 : 0.8) * Math.min(1.04, a.s), air = Math.sqrt((2 * jumpH) / PHYS.g);
        const tA = tSet + T - air - tau;
        const spot = toWorld(team, this.offense(team)[a.idx] || [0, 3]);
        const ready = Math.max(a.cursor, a.busy) + Math.max(0.32, (1.5 * len2(sub2(spot, a.pos))) / 5);
        if (ready <= tA - 0.12) return slot;
      }
      return this.attackerFor(team, 'left').slot;
    }
    attackerFor(team, slot) {
      const L = this.lineups[team];
      if (slot === 'right' && L.front.right === 0) slot = 'left';
      return { a: this.A(team, L.front[slot]), slot };
    }
    attack(team, set, wanted) {
      const { a, slot } = this.attackerFor(team, wanted);
      const s = a.s, fy = NET_YAW[team], f = fwdOf(fy), rt = rightOf(fy);
      const jumpH = (a.role === 'MB' ? 0.74 : 0.8) * Math.min(1.04, s);
      const air = Math.sqrt((2 * jumpH) / PHYS.g);
      const lane = slot === 'left' ? -3.05 : slot === 'right' ? 3.05 : 0.4;
      const contactW = slot === 'middle' ? 0.45 : 0.58;
      const T = slot === 'middle' ? 0.52 : slot === 'right' ? 1.08 : 1.18;
      const tC = set.t + T, tJ = tC - air, tL = tC + air;
      const C = toWorld3(team, lane, 0.83 * a.height + 0.66 * s + jumpH, contactW);
      const apex = sub2(sub2(ground(C), mul2(f, 0.28 * s)), mul2(rt, 0.16 * s));
      const carry = 0.5;
      const takeoff = sub2(apex, mul2(f, carry / 2)), land = add2(apex, mul2(f, carry / 2));
      // Outside hitters approach from wide; the middle uses a short two-step approach.
      const approachLen = (slot === 'middle' ? 2.0 : 3.0) * s;
      const tw = toTeam(team, takeoff);
      const startUW = slot === 'middle' ? [tw[0] + 0.25, tw[1] + approachLen] :
        [tw[0] + Math.sign(lane) * 1.05, tw[1] + Math.sqrt(approachLen * approachLen - 1.05 * 1.05)];
      const start = toWorld(team, startUW);
      const adir = norm2(sub2(takeoff, start)), ay = yawOf(adir), ar = rightOf(ay);
      let tau = slot === 'middle' ? 0.62 : 0.98, tA = tJ - tau;
      a.arriveBy(Math.max(a.cursor + 0.3, tA - 0.1), start, ay, { notBefore: set.t - 1.6, speed: 4, strict: true });
      if (a.cursor > tA - 0.01) { tA = a.cursor + 0.01; tau = tJ - tA; if (tau < 0.45) a.warnings.push({ type: 'late-approach', id: a.id, tau }); }
      a.idleTo(tA);
      const D = len2(sub2(takeoff, start));
      const pathP = (d, side) => add2(add2(start, mul2(adir, d)), mul2(ar, side * 0.12 * s));
      const steps = slot === 'middle' ? [
        { foot: 'L', land: tA + tau * 0.4, p: pathP(D * 0.48, -1), lift: tA + 0.03 },
        { foot: 'R', land: tA + tau * 0.82, p: add2(takeoff, mul2(ar, 0.15 * s)), lift: tA + tau * 0.12 },
        { foot: 'L', land: tA + tau * 0.93, p: add2(add2(takeoff, mul2(ar, -0.15 * s)), mul2(adir, 0.08)), lift: tA + tau * 0.84 },
      ] : [
        { foot: 'R', land: tA + tau * 0.28, p: pathP(D * 0.2, 1), lift: tA + 0.03 },
        { foot: 'L', land: tA + tau * 0.58, p: pathP(D * 0.53, -1), lift: tA + tau * 0.3 },
        { foot: 'R', land: tA + tau * 0.85, p: add2(takeoff, mul2(ar, 0.15 * s)), lift: tA + tau * 0.6 },
        { foot: 'L', land: tA + tau * 0.94, p: add2(add2(takeoff, mul2(ar, -0.15 * s)), mul2(adir, 0.08)), lift: tA + tau * 0.87 },
      ];
      const keys = slot === 'middle'
        ? [[0, 0], [tau * 0.4, D * 0.4], [tau * 0.82, D * 0.88], [tau * 0.93, D * 0.97], [tau, D]]
        : [[0, 0], [tau * 0.28, D * 0.12], [tau * 0.58, D * 0.42], [tau * 0.85, D * 0.86], [tau * 0.94, D * 0.96], [tau, D]];
      a.move(tA, takeoff, ay, { dur: tau, keys, steps });
      a.jump(tJ, tL, land, jumpH, { face: fy });
      const shot = team === 'home' && this.decisiveTeamIsHome ? this.shot : 'spike';
      a.act(shot === 'tip' ? 'tip' : 'spike', tA - 0.05, tC, tL + 0.55, { C, tJ, tL, takeoff, land, jumpH, start, slot });
      this.ballFly(tC, C, mul(cross([0, 1, 0], [set.p[0] - C[0], 0, set.p[2] - C[2]]), 0.6));
      const hit = { t: tC, p: C, actor: a, team, slot, kind: shot, tL };
      // Teammates cover the hitter; opponents form the block and the defence.
      this.cover(team, hit);
      hit.blockers = this.block(other(team), hit, set);
      return hit;
    }
    cover(team, hit) {
      const tw = toTeam(team, ground(hit.p)), sgn = Math.sign(tw[0]) || 1;
      const ring = [[tw[0] - sgn * 1.2, 2.2], [tw[0] + sgn * 0.3, 3.4], [tw[0] - sgn * 2.6, 4.2]];
      const L = this.lineups[team];
      const helpers = [0, L.front.middle, L.back.left, L.back.middle].filter((i) => i !== hit.actor.idx && this.A(team, i).cursor < hit.t - 0.4).slice(0, 3);
      helpers.forEach((i, k) => {
        const a = this.A(team, i), dest = toWorld(team, [clamp(ring[k][0], -4, 4), ring[k][1]]);
        a.arriveBy(hit.t - 0.05, dest, yawOf(sub2(ground(hit.p), dest)), { notBefore: hit.t - 1.0, speed: 3.6 });
        a.act('cover', Math.max(a.cursor - 0.3, hit.t - 0.5), hit.t, hit.t + 0.7, {});
      });
    }
    // Opponent block (two blockers when possible) leaving a realistic seam.
    block(team, hit, set) {
      const L = this.lineups[team];
      const hu = toTeam(team, ground(hit.p))[0]; // hitter's lateral position in the blocking team's frame
      const outerSlot = hu > 1.2 ? 'right' : hu < -1.2 ? 'left' : 'middle';
      const outer = this.A(team, L.front[outerSlot]);
      const mid = this.A(team, L.front.middle);
      const blockers = [];
      const jumpH = 0.62, tJ = hit.t - 0.28, air = Math.sqrt((2 * jumpH) / PHYS.g), tL = tJ + 2 * air;
      const fy = NET_YAW[team];
      const place = (a, u, late) => {
        const dest = toWorld(team, [u, 0.3]);
        const free = Math.max(a.cursor, a.busy, set.t - 0.25), D = len2(sub2(dest, a.pos));
        // A blocker who cannot get set in time jumps a little later, as real late blockers do.
        let tJb = tJ + (late ? 0.06 : 0);
        tJb += clamp(free + Math.max(0.2, (1.5 * D) / 6.0) + 0.18 - tJb, 0, late ? 0.15 : 0.08);
        const h = jumpH * (late ? 0.86 : 1), tLb = tJb + 2 * Math.sqrt((2 * h) / PHYS.g);
        const tArr = Math.min(tJb - 0.05, Math.max(tJb - 0.16, free + Math.max(0.2, (1.5 * D) / 7.0)));
        a.arriveBy(tArr, dest, fy, { notBefore: set.t - 0.25, speed: 4.6, faceMode: 'blend', strict: true });
        a.jump(tJb, tLb, dest, h, { face: fy, stagger: 0 });
        a.act('block', tJb - 0.45, hit.t + (late ? 0.06 : 0), tLb + 0.5, { u, late, team, tJ: tJb, tL: tLb, net: Math.sign(dest[1]) });
        blockers.push({ actor: a, u, x: dest[0], z: dest[1], late, tJ: tJb, jumpH: h });
      };
      if (outerSlot === 'middle') place(mid, clamp(hu, -2.5, 2.5) + 0.35, false);
      else {
        place(outer, clamp(hu + Math.sign(hu) * 0.15, -4.1, 4.1), false);
        place(mid, hu - Math.sign(hu) * 1.3, true);
      }
      // Back-row defenders and the off-blocker.
      const sgn = Math.sign(hu) || 1;
      const spots = {};
      spots[L.back.left] = sgn > 0 ? [-2.6, 5.8] : [-3.3, 6.9];
      spots[L.back.right] = sgn > 0 ? [3.3, 6.9] : [2.6, 5.8];
      spots[L.back.middle] = [0.4 * sgn, 8.1];
      if (outerSlot !== 'middle') {
        const off = ['left', 'right'].find((sl) => sl !== outerSlot);
        spots[L.front[off]] = [Math.sign(-hu) * 2.9, 3.2];
      } else { spots[L.front.left] = [-2.9, 2.9]; spots[L.front.right] = [2.9, 2.9]; }
      const busy = blockers.map((b) => b.actor.idx);
      this.formation(team, spots, set.t - 0.4, hit.t - 0.25, busy);
      for (const [i] of Object.entries(spots)) { const a = this.A(team, Number(i)); if (!busy.includes(Number(i))) a.act('defend', hit.t - 0.6, hit.t, hit.t + 0.6, {}); }
      return blockers;
    }
    // Pick a spike target whose net crossing avoids the block columns (|Δx| ≥ gap).
    clearShot(C, targets, blockers, T, w, gap = 0.62) {
      for (const tgt of targets) {
        const v = solveShot(C, tgt, T, w), res = integrate(C, v, w, T, true);
        let cross = null;
        for (let i = 1; i <= res.n; i++) {
          const z0 = res.pts[(i - 1) * 6 + 2], z1 = res.pts[i * 6 + 2];
          if (Math.sign(z0) !== Math.sign(z1)) { const f = Math.abs(z0) / Math.abs(z1 - z0); cross = [lerp(res.pts[(i - 1) * 6], res.pts[i * 6], f), lerp(res.pts[(i - 1) * 6 + 1], res.pts[i * 6 + 1], f)]; break; }
        }
        if (!cross || cross[1] < COURT.netTop + 0.2) continue;
        if (blockers.every((b) => Math.abs(cross[0] - b.x) >= gap || cross[1] > 3.3)) return { target: tgt, v, cross };
      }
      return null;
    }
    // Defensive dig in the prefix (opponent spike → our dig).
    dig(team, hit) {
      const L = this.lineups[team];
      const candidates = [];
      const sgnHit = Math.sign(toTeam(team, ground(hit.p))[0]) || 1;
      for (const u of [-2.6 * sgnHit, -2.1 * sgnHit, -1.4 * sgnHit, 2.9 * sgnHit, 0.3]) for (const w of [5.6, 6.2, 5.0]) candidates.push(toWorld3(team, u, 0.66, w));
      let T = 0.56; const spin = (tgt) => mul(cross([0, 1, 0], norm([tgt[0] - hit.p[0], 0, tgt[2] - hit.p[2]])), -30);
      // Defenders (never the setter, never a blocker in the air).
      const defenders = [L.back.left, L.back.middle, L.back.right, L.front.left, L.front.right].filter((i) => i !== 0).map((i) => this.A(team, i)).filter((a) => !hit.blockers?.some((b) => b.actor === a));
      // Prefer a target that clears the block AND that some defender can physically reach in time.
      const reachable = (a, tgt) => {
        const start = Math.max(a.cursor, a.busy, hit.t - 0.55), avail = hit.t + T - 0.22 - start;
        const D = len2(sub2(a.pos, ground(tgt))) - 0.5 * a.s;
        return avail > 0.2 && (1.5 * Math.max(0, D)) / avail <= SPRINT - 0.4;
      };
      const byDist = (tgt) => (a, b) => len2(sub2(a.pos, ground(tgt))) - len2(sub2(b.pos, ground(tgt)));
      let shot = null, dfd = null;
      // If nobody can get there against a full-speed hit, the attacker took pace off (roll shot).
      for (const TT of [0.56, 0.64, 0.74, 0.86, 1.0]) {
        T = TT;
        for (const c of candidates) {
          const cand = this.clearShot(hit.p, [c], hit.blockers, T, spin(c));
          if (!cand) continue;
          const who = defenders.filter((a) => reachable(a, c)).sort(byDist(c))[0];
          if (who) { shot = cand; dfd = who; break; }
        }
        if (shot) break;
      }
      if (!shot) { shot = { target: candidates[0] }; dfd = defenders.slice().sort(byDist(candidates[0]))[0]; }
      const C0 = shot.target;
      const incoming = norm2(sub2(ground(C0), ground(hit.p)));
      const face = yawOf(mul2(incoming, -1));
      const C = at(ground(C0), 0.34 * dfd.height);
      const root = sub2(ground(C), mul2(fwdOf(face), 0.5 * dfd.s));
      const tD = hit.t + T;
      this.contact(hit.t, hit.actor, 'spike', hit.p);
      this.ballFly(tD, C, spin(C));
      dfd.arriveBy(Math.max(dfd.cursor + 0.3, tD - 0.22), root, face, { notBefore: hit.t - 0.55, speed: 5.5, strict: true });
      dfd.act('dig', tD - 0.45, tD, tD + 0.7, { C });
      this.contact(tD, dfd, 'dig', C);
      // Digging team transitions to offence.
      this.formation(team, this.offense(team), tD + 0.05, tD + 1.2, [dfd.idx, 0]);
      // Attacking team recovers to base defence.
      this.formation(hit.team, this.baseDefense(hit.team), hit.tL + 0.35, hit.tL + 1.6);
      return { t: tD, p: C, actor: dfd, team, kind: 'dig' };
    }
    markDecisive(kind, info) {
      this.decisive = { kind, t: info.t, p: info.p.slice(), actor: info.actor.id, team: info.team };
      this.tContact = info.t;
      this.tFreeze = info.t - FREEZE_LEAD;
      this.decisiveInfo = info;
      for (const a of this.actors.concat(this.officials)) a.floorT = this.tFreeze;
    }

    // ── branch helpers ──
    spikeSpin(from, to, k = -30) { return mul(cross([0, 1, 0], norm([to[0] - from[0], 0, to[2] - from[2]])), k); }
    deadBall(tDead, pointTo, reason, extra = {}) {
      this.tDead = tDead;
      this.verdict = { pointTo, reason, ...extra };
      const tw = tDead + 0.28;
      this.event({ type: 'whistle', t: tw, kind: 'point' });
      this.officials[0].act('signal', tw - 0.1, tw, tw + 2.4, { to: pointTo });
      this.officials[1].act('whistle', tw - 0.05, tw + 0.05, tw + 0.8, {});
      const landing = this.events.find((e) => e.type === 'floor' && e.first);
      if (landing) {
        const lj = landing.p[2] < 0 ? this.officials[2] : this.officials[3];
        lj.act('flag', landing.t + 0.15, landing.t + 0.4, landing.t + 2.3, { in: landing.in });
      }
      this.celebrate(pointTo, tDead + 0.45);
    }
    celebrate(winner, t) {
      if (!winner) return;
      const hub = toWorld(winner, [0, 3.4]);
      this.actors.filter((a) => a.team === winner).forEach((a, k) => {
        const ang = (k / 6) * Math.PI * 2, dest = add2(hub, [Math.cos(ang) * 0.85, Math.sin(ang) * 0.85]);
        const face = yawOf(sub2(hub, dest));
        const start = Math.max(a.cursor, t + (k % 3) * 0.08);
        a.arriveBy(Math.max(start + 0.5, start + len2(sub2(dest, a.pos)) / 3.2), dest, face, { notBefore: start, speed: 3.2 });
        a.act('celebrate', start, a.cursor + 0.2, a.cursor + 2.6, { k });
        a.idleTo(a.cursor + 2.7);
      });
      this.actors.filter((a) => a.team === other(winner)).forEach((a, k) => {
        const start = Math.max(a.cursor, t + 0.1 + (k % 4) * 0.1);
        a.idleTo(start);
        a.act('regroup', start, start + 0.5, start + 2.8, { k });
      });
    }
    // Defenders who reach late for a ball they cannot get (for kills and aces).
    lateReach(team, target, tLand) {
      const L = this.lineups[team];
      const pool = [L.back.left, L.back.middle, L.back.right, L.front.left, L.front.right].map((i) => this.A(team, i)).filter((a) => a.cursor < tLand - 0.35);
      let best = null;
      for (const a of pool) { const d = len2(sub2(a.pos, ground(target))); if (!best || d < best.d) best = { a, d }; }
      if (!best) return;
      const a = best.a, dir = norm2(sub2(ground(target), a.pos));
      const reach = Math.min(Math.max(0, best.d - 1.15), 1.6);
      const dest = add2(a.pos, mul2(dir, reach));
      const tStart = Math.max(a.cursor, tLand - 0.55);
      if (reach > 0.1) a.move(tStart, dest, yawOf(dir), { dur: Math.max(0.3, tLand - tStart - 0.02, (1.5 * reach) / (SPRINT - 0.4)), speed: 6 });
      a.act('dive', tStart, tLand, tLand + 1.1, { dir: yawOf(dir) });
    }
  }

  // ───────────────────────────── scripts ─────────────────────────────
  // Decisive home attack (match & attack modes): branch outcomes after the freeze.
  // Highest point a blocker's hands reach at time t (standing shoulder + jump height at t + arm), so a
  // block touch is always physically reachable for that particular player.
  function blockReach(b, t) {
    const a = b.actor, air = Math.sqrt((2 * b.jumpH) / PHYS.g), u = clamp((t - b.tJ) / (2 * air));
    return BODY.shoulder * a.height + 4 * b.jumpH * u * (1 - u) + 0.33 * a.height - 0.035;
  }
  const touchY = (b, t, want) => Math.max(COURT.netTop + R + 0.05, Math.min(want, blockReach(b, t)));
  function homeAttackBranch(P, hit) {
    const away = 'away', blockers = hit.blockers || [];
    const r = P.rb, aimX = { left: -2.75, center: 0, right: 2.75 }[P.aim];
    const shot = P.shot;
    const C = hit.p;
    let variant;
    if (P.outcome === 'correct') variant = shot === 'tip' ? 'tip' : pick(r, ['kill', 'kill', 'tool', 'kill', 'shank']);
    else variant = shot === 'tip' ? pick(r, ['counter', 'stuff']) : pick(r, ['stuff', 'net', 'out', 'counter', 'stuff']);
    P.variant = variant;
    if (variant === 'kill' || variant === 'shank') {
      const targets = [];
      for (const dz of [-5.6, -4.6, -6.6, -3.8, -7.4]) for (const dx of [0, 0.6, -0.6, 1.2, -1.2]) targets.push([clamp(aimX + dx, -4.1, 4.1), R, dz]);
      let res = null;
      for (const tgt of targets) { res = P.clearShot(C, [tgt], blockers, 0.48, P.spikeSpin(C, tgt)); if (res) break; }
      if (!res) { const tgt = targets[0]; res = { target: tgt, v: solveShot(C, tgt, 0.48, P.spikeSpin(C, tgt)) }; }
      P.contact(hit.t, hit.actor, 'spike', C);
      if (variant === 'shank') {
        // A defender gets an arm on it but the ball flies off out of play: point to the attacker.
        const tgt = res.target, defP = [tgt[0], 0.62, tgt[2] + 0.9];
        const T = 0.4;
        const L = P.lineups.away;
        const pool = [L.back.left, L.back.middle, L.back.right].map((i) => P.A(away, i));
        let best = null;
        for (const a of pool) { const d = len2(sub2(a.pos, ground(defP))); if (!best || d < best.d) best = { a, d }; }
        const dfd = best.a, face = yawOf(sub2(ground(C), ground(defP)));
        const root = sub2(ground(defP), mul2(fwdOf(face), 0.5 * dfd.s));
        P.ballFly(hit.t + T, defP, P.spikeSpin(C, defP));
        dfd.arriveBy(Math.max(dfd.cursor + 0.25, hit.t + T - 0.1), root, face, { notBefore: hit.t - 0.3, speed: 6, strict: true });
        dfd.act('dig', hit.t + T - 0.35, hit.t + T, hit.t + T + 0.8, { C: defP, shank: true });
        P.contact(hit.t + T, dfd, 'dig', defP);
        const side = Math.sign(defP[0]) || 1;
        const out = [side * 7.2, R, defP[2] - 2.5];
        const v = solveShot(defP, out, 1.05, [0, 0, 0]);
        const { events } = P.ballFree(v, [4, 0, 0], 5);
        const land = events.find((e) => e.type === 'floor');
        P.deadBall(land.t, 'home', 'shank');
        return;
      }
      P.lateReach(away, res.target, hit.t + 0.5);
      const { events } = P.ballFree(res.v, P.spikeSpin(C, res.target), 5);
      const land = events.find((e) => e.type === 'floor');
      P.deadBall(land.t, 'home', 'kill');
      return;
    }
    if (variant === 'tip') {
      const tgt = [clamp(aimX * 0.6, -3, 3), R, -2.4];
      P.contact(hit.t, hit.actor, 'tip', C);
      const v = solveShot(C, tgt, 0.95, [0, 0, 0]);
      P.lateReach(away, tgt, hit.t + 0.95);
      const { events } = P.ballFree(v, [-3, 0, 0], 5);
      const land = events.find((e) => e.type === 'floor');
      P.deadBall(land.t, 'home', 'tip');
      return;
    }
    if (variant === 'tool' || variant === 'stuff') {
      // Ball meets the outer blocker's hands just over the net.
      const b = blockers[0];
      const bx = variant === 'tool' ? b.x + Math.sign(b.x || 1) * 0.2 : b.x - Math.sign(b.x || 1) * 0.05;
      const B = [bx, touchY(b, hit.t + 0.035, variant === 'tool' ? 2.86 : 2.8), 0.07];
      P.contact(hit.t, hit.actor, 'spike', C);
      P.ballFly(hit.t + 0.035, B, P.spikeSpin(C, B));
      P.contact(hit.t + 0.035, b.actor, 'block', B);
      b.actor.acts[b.actor.acts.length - 1].data.touch = B;
      if (variant === 'tool') {
        // Deflects off the fingertips and lands out behind/wide of the court: point to the attacker.
        const out = [Math.sign(bx || 1) * 6.4, R, 9.8 * -1 + 0.2];
        const v = solveShot(B, [out[0], 0.9, -6.0], 0.62, [0, 0, 0]);
        const { events } = P.ballFree(v, [6, 0, 0], 5);
        const land = events.find((e) => e.type === 'floor');
        P.deadBall(land.t, 'home', 'block-out');
      } else {
        // Roof block straight down on the attacker's side.
        const tgt = [bx * 0.9, R, 1.35];
        const v = solveShot(B, tgt, 0.36, [0, 0, 0]);
        P.lateReach('home', tgt, hit.t + 0.4);
        const { events } = P.ballFree(v, [-8, 0, 0], 5);
        const land = events.find((e) => e.type === 'floor');
        P.deadBall(land.t, 'away', 'stuff');
      }
      return;
    }
    if (variant === 'net') {
      const tgt = [clamp(aimX * 0.5 + C[0] * 0.5, -4, 4), 1.95, 0];
      P.contact(hit.t, hit.actor, 'spike', C);
      const netAim = [tgt[0], tgt[1], -0.25], v = solveShot(C, netAim, Math.max(0.09, dist(C, netAim) / 21), [0, 0, 0]);
      const { events } = P.ballFree(v, P.spikeSpin(C, tgt), 5);
      const land = events.find((e) => e.type === 'floor');
      P.deadBall(land.t, 'away', 'net');
      return;
    }
    if (variant === 'out') {
      const long = r() < 0.6;
      const tgt = long ? [clamp(aimX, -3.5, 3.5), R, -10.6] : [Math.sign(aimX || C[0] || 1) * 5.4, R, -6.2];
      P.contact(hit.t, hit.actor, 'spike', C);
      const v = solveShot(C, tgt, 0.62, P.spikeSpin(C, tgt, -12));
      const { events } = P.ballFree(v, P.spikeSpin(C, tgt, -12), 5);
      const land = events.find((e) => e.type === 'floor');
      P.deadBall(land.t, 'away', 'out');
      return;
    }
    // counter: the opponent digs, sets and kills the ball on our floor.
    const dig = P.dig(away, hit);
    const set = P.set(away, dig, P.feasibleSlot(away, dig.t + 1.4, ['left', 'right']), 1.4);
    const counter = P.attack(away, set, 'left');
    const targets = [];
    for (const dz of [5.8, 4.8, 6.8]) for (const dx of [-2.6, -1.8, -3.2, 2.8, 0.5]) targets.push([dx, R, dz]);
    let res = null;
    for (const tgt of targets) { res = P.clearShot(counter.p, [tgt], counter.blockers, 0.5, P.spikeSpin(counter.p, tgt)); if (res) break; }
    if (!res) { const tgt = targets[0]; res = { target: tgt, v: solveShot(counter.p, tgt, 0.5, P.spikeSpin(counter.p, tgt)) }; }
    P.contact(counter.t, counter.actor, 'spike', counter.p);
    P.lateReach('home', res.target, counter.t + 0.5);
    const { events } = P.ballFree(res.v, P.spikeSpin(counter.p, res.target), 5);
    const land = events.find((e) => e.type === 'floor');
    P.deadBall(land.t, 'away', 'counter');
  }

  function preHomeAttack(P) {
    const slots = ['left', 'left', 'right', 'middle', 'left'];
    P.decisiveTeamIsHome = false;
    let home;
    if (P.mode === 'attack') {
      // Practice: the opponent sends an easy free ball, we pass, set and attack.
      const a = P.ballOwner;
      const t0 = P.tHold + 0.45;
      const hold = P.serverHold(a);
      // The free-baller already holds the ball (pre-roll gives it to him) — toss and bump over.
      const C = at(add2(a.pos, mul2(fwdOf(a.face), 0.42 * a.s)), 0.42 * a.height);
      P.ballHold(t0, hold);
      P.ballFly(t0 + 0.55, C, [0, 0, 0]);
      a.act('pass', t0 + 0.05, t0 + 0.55, t0 + 1.0, { C, out: [0, 0.6, 1] });
      P.contact(t0 + 0.55, a, 'pass', C);
      const fb = { t: t0 + 0.55, p: C, actor: a, team: 'away', jump: false, free: true };
      P.formation('home', P.offense('home'), t0, t0 + 1.2, [0]);
      home = P.receive('home', { ...fb, jump: false }, { zone: pick(P.r, [[-1.6, 6.0], [0.6, 6.4], [1.8, 5.6]]) });
    } else if (P.serving === 'home') {
      const sv = P.serve('home');
      P.afterServe(sv);
      const rec = P.receive('away', sv);
      P.formation('away', P.offense('away'), sv.t + 0.15, rec.t + 0.9, [rec.actor.idx, 0]);
      const want = pick(P.r, ['left', 'left', 'right']);
      const set = P.set('away', rec, P.feasibleSlot('away', rec.t + 1.38, [want, 'left']));
      const hit = P.attack('away', set, set.slot);
      const dig = P.dig('home', hit);
      home = dig;
    } else {
      const sv = P.serve('away');
      P.afterServe(sv);
      home = P.receive('home', sv);
      P.formation('home', P.offense('home'), sv.t + 0.15, home.t + 0.9, [home.actor.idx, 0]);
    }
    const want = P.aim === 'center' && P.r() < 0.5 ? 'middle' : pick(P.r, slots);
    const T = home.kind === 'dig' ? 1.45 : 1.38;
    const slot = P.feasibleSlot('home', home.t + T, [want, 'left', 'right']);
    const set = P.set('home', home, slot, T);
    P.decisiveTeamIsHome = true;
    const hit = P.attack('home', set, set.slot);
    P.markDecisive('attack', hit);
    if (P.outcome) homeAttackBranch(P, hit);
  }

  function serveScript(P) {
    const sv = P.serve('home', true);
    // Opponent waits in reception.
    if (!P.outcome) return;
    const aimX = { left: -2.6, center: 0, right: 2.6 }[P.aim];
    P.contact(sv.t, sv.actor, 'serve', sv.p);
    if (P.outcome === 'correct') {
      const tgt = [aimX, R, -6.9 + P.rb() * 1.2];
      const w = sv.jump ? mul(cross([0, 1, 0], norm([tgt[0] - sv.p[0], 0, tgt[2] - sv.p[2]])), -24) : [0, 0, 0];
      const T = netClearTime(sv.p, tgt, sv.jump ? 0.98 : 1.32, w, 0.18);
      const v = solveShot(sv.p, tgt, T, w);
      P.lateReach('away', tgt, sv.t + T);
      P.afterServe(sv);
      const { events } = P.ballFree(v, w, 5);
      const land = events.find((e) => e.type === 'floor');
      P.variant = 'ace';
      P.deadBall(land.t, 'home', 'ace');
    } else {
      const intoNet = P.rb() < 0.55;
      P.afterServe(sv);
      if (intoNet) {
        const v = solveShot(sv.p, [aimX * 0.5, 1.9, -0.3], sv.jump ? 0.62 : 0.8, [0, 0, 0]);
        const { events } = P.ballFree(v, [0, 0, 0], 5);
        P.variant = 'serve-net';
        P.deadBall(events.find((e) => e.type === 'floor').t, 'away', 'serve-net');
      } else {
        const tgt = [aimX, R, -10.7];
        const v = solveShot(sv.p, tgt, netClearTime(sv.p, tgt, sv.jump ? 1.0 : 1.38, [0, 0, 0], 0.3), [0, 0, 0]);
        const { events } = P.ballFree(v, [0, 0, 0], 5);
        P.variant = 'serve-out';
        P.deadBall(events.find((e) => e.type === 'floor').t, 'away', 'serve-out');
      }
    }
  }

  function receiveScript(P) {
    const sv = P.serve('away');
    P.afterServe(sv);
    const rc = P.receive('home', sv, { freeze: true, zone: pick(P.r, [[-1.8, 6.2], [0.3, 6.8], [2.2, 6.0]]) });
    P.formation('home', P.offense('home'), sv.t + 0.15, rc.t + 0.9, [rc.actor.idx, 0]);
    if (!P.outcome) return;
    if (P.outcome === 'correct') {
      P.contact(rc.t, rc.actor, 'pass', rc.p);
      const set = P.set('home', rc, P.feasibleSlot('home', rc.t + 1.38, ['left', 'right', 'middle']));
      const hit = P.attack('home', set, set.slot);
      P.decisiveTeamIsHome = true;
      P.outcome = 'correct';
      const aim = P.aim; P.aim = aim;
      // Reuse the attack branch with a guaranteed kill.
      const saved = P.shot; P.shot = 'spike';
      const r0 = P.rb; P.rb = () => 0.01; // first option = clean kill
      homeAttackBranch(P, hit);
      P.rb = r0; P.shot = saved;
      P.variant = 'pass-kill';
    } else {
      // Shank: the ball ricochets off the forearms out of the court.
      P.contact(rc.t, rc.actor, 'pass', rc.p);
      const side = rc.p[0] >= 0 ? 1 : -1;
      const out = [side * 6.8, R, rc.p[2] + 1.8];
      const v = solveShot(rc.p, out, 0.95, [0, 0, 0]);
      const { events } = P.ballFree(v, [0, 0, 7], 5);
      P.variant = 'shank';
      P.deadBall(events.find((e) => e.type === 'floor').t, 'away', 'shank');
    }
  }

  function blockScript(P) {
    // Our serve, their pass-set-spike; the question freezes the moment their hitter strikes.
    const sv = P.serve('home');
    P.afterServe(sv);
    const rec = P.receive('away', sv);
    P.formation('away', P.offense('away'), sv.t + 0.15, rec.t + 0.9, [rec.actor.idx, 0]);
    const want = pick(P.r, ['left', 'right']);
    const set = P.set('away', rec, P.feasibleSlot('away', rec.t + 1.38, [want, 'left']));
    const hit = P.attack('away', set, set.slot);
    P.markDecisive('block', hit);
    if (!P.outcome) return;
    const b = hit.blockers[0];
    P.contact(hit.t, hit.actor, 'spike', hit.p);
    if (P.outcome === 'correct') {
      const B = [b.x, touchY(b, hit.t + 0.035, 2.8), -0.07];
      P.ballFly(hit.t + 0.035, B, P.spikeSpin(hit.p, B));
      P.contact(hit.t + 0.035, b.actor, 'block', B);
      b.actor.acts[b.actor.acts.length - 1].data.touch = B;
      const tgt = [b.x * 0.9, R, -1.4];
      const v = solveShot(B, tgt, 0.36, [0, 0, 0]);
      P.lateReach('away', tgt, hit.t + 0.4);
      const { events } = P.ballFree(v, [8, 0, 0], 5);
      P.variant = 'stuff-block';
      P.deadBall(events.find((e) => e.type === 'floor').t, 'home', 'block');
    } else {
      // Ball off our block's fingertips and out: their point.
      const B = [b.x + Math.sign(b.x || 1) * 0.2, touchY(b, hit.t + 0.035, 2.86), -0.07];
      P.ballFly(hit.t + 0.035, B, P.spikeSpin(hit.p, B));
      P.contact(hit.t + 0.035, b.actor, 'block', B);
      b.actor.acts[b.actor.acts.length - 1].data.touch = B;
      const v = solveShot(B, [Math.sign(b.x || 1) * 6.0, 0.9, 6.5], 0.62, [0, 0, 0]);
      const { events } = P.ballFree(v, [6, 0, 0], 5);
      P.variant = 'block-out';
      P.deadBall(events.find((e) => e.type === 'floor').t, 'away', 'tool');
    }
  }

  /* Neutral branch for answers awaiting teacher review: the referee stops play for a review, the
   * decisive player holds off, the ball simply falls under gravity and NO point is awarded. */
  function neutralBranch(P) {
    const d = P.decisive, a = P.actors[d.actor];
    const act = a.acts.filter((x) => x.tc >= d.t - 1e-6 && ['spike', 'tip', 'serveJump', 'serveFloat', 'pass'].includes(x.type)).sort((x, y) => x.t0 - y.t0)[0];
    if (act) { act.data.withhold = true; act.data.tFreeze = P.tFreeze; }
    const tw = P.tFreeze + 0.12;
    P.event({ type: 'whistle', t: tw, kind: 'review' });
    P.officials[0].act('review', tw - 0.1, tw + 0.2, tw + 2.6, {});
    P.officials[1].act('whistle', tw - 0.05, tw + 0.05, tw + 0.8, {});
    const { events } = P.ballFree(P.bv, P.bw, 4);
    const land = events.find((e) => e.type === 'floor');
    P.tDead = land ? land.t : P.tFreeze + 1;
    P.verdict = { pointTo: null, reason: 'review' };
    P.variant = 'review';
  }

  // ───────────────────────────── public API ─────────────────────────────
  const MODES = ['match', 'serve', 'receive', 'attack', 'block'];
  function create(cfg = {}) {
    const P = new Planner(cfg);
    const mode = MODES.includes(P.mode) ? P.mode : 'match';
    P.mode = mode;
    // Practice modes fix the serving team so the freeze lands on the practised skill.
    if (mode === 'serve' || mode === 'block') P.serving = 'home';
    if (mode === 'receive') P.serving = 'away';
    if (mode === 'attack') P.serving = 'away';
    P.lineups = { home: lineup(P.rotation.home), away: lineup(P.rotation.away) };
    const srv = ROSTER[P.serving][playerAt(P.rotation[P.serving], 1)];
    P.serveJump = ['OH', 'OPP'].includes(srv.role) ? P.r() < 0.8 : P.r() < 0.2;
    if (mode === 'attack') {
      // Attack drill: the opponent's back-middle player holds the ball and sends an easy free ball.
      P.attackDrill = true;
      P.ballOwner = P.A('away', P.lineups.away.back.middle);
    }
    P.preroll();
    if (mode === 'serve') serveScript(P);
    else if (mode === 'receive') receiveScript(P);
    else if (mode === 'block') blockScript(P);
    else preHomeAttack(P);
    if (P.neutral) neutralBranch(P);
    const tail = P.tDead !== undefined ? P.tDead + 4.6 : P.tFreeze + 0.5;
    for (const a of P.actors.concat(P.officials)) a.idleTo(Math.max(tail, a.cursor + 0.01));
    for (const a of P.actors) regenerateGait(a, tail, P.tFreeze ?? Infinity);
    P.events.sort((a, b) => a.t - b.t);
    for (const a of P.actors.concat(P.officials)) a.acts.sort((x, y) => x.t0 - y.t0);
    const plan = {
      version: 24, mode, serving: P.serving, rotation: { ...P.rotation }, aim: P.aim, shot: P.shot, seed: P.seed, outcome: P.outcome,
      neutral: P.neutral, variant: P.variant || null, tHold: P.tHold, tFreeze: P.tFreeze, tContact: P.tContact, tDead: P.tDead ?? null, tEnd: tail,
      decisive: P.decisive, verdict: P.verdict, ball: P.ball, actors: P.actors, officials: P.officials, events: P.events, contacts: P.contacts,
      warnings: P.actors.flatMap((a) => a.warnings).concat(P.flightWarnings),
    };
    if (P.outcome) plan.judged = judge(plan);
    return plan;
  }

  /* Gait controller. Footsteps are planned from the root trajectory: each planted foot stays exactly
   * where it landed; a foot steps when it drifts from its ideal stance spot (Raibert-style placement,
   * slightly ahead in the direction of travel); at sprint speed a planted foot may lift while the other
   * swings (a flight phase) so no leg is ever over-stretched. Scripted approach and jump footwork is kept
   * verbatim. Decisions before the freeze look ahead no further than the freeze, so every outcome branch
   * shows an identical frozen frame. */
  function regenerateGait(actor, tEnd, floorT) {
    const s = actor.s, dt = 1 / 60;
    const locked = [];
    for (const foot of ['L', 'R']) for (const st of actor.steps[foot]) if (st.locked) locked.push({ ...st, foot });
    locked.sort((a, b) => a.land - b.land);
    const windows = [];
    for (const st of locked) {
      const start = Math.min(st.liftPrev, st.land - 0.12) - 0.04, w = windows[windows.length - 1];
      if (w && start <= w.end + 0.2) { w.end = Math.max(w.end, st.land); w.steps.push(st); }
      else windows.push({ start, end: st.land, steps: [st] });
    }
    const out = { L: [{ ...actor.steps.L[0], lift: Infinity }], R: [{ ...actor.steps.R[0], lift: Infinity }] };
    const last = (f) => out[f][out[f].length - 1];
    const plantAt = (f, land, p, liftPrev, extra = {}) => {
      const prev = last(f);
      if (land < prev.land + 0.12) land = prev.land + 0.12;
      prev.lift = Math.min(prev.lift, clamp(liftPrev, prev.land + 0.05, land - 0.07));
      out[f].push({ land, lift: Infinity, p: p.slice(), air: !!extra.air, locked: !!extra.locked, liftPrev });
    };
    let retargeted = !(floorT < tEnd);
    const root = (t) => actorAt(actor, t);
    const ahead = (t, tt) => root(t < floorT ? Math.min(tt, floorT) : tt);
    const ideal = (f, st) => {
      const g = f === 'R' ? 1 : -1, r = rightOf(st.face);
      const v = st.vel, sp = len2(v), lead = sp > 0.05 ? mul2(v, Math.min(0.12, (0.3 * s) / sp)) : [0, 0];
      return add2(add2(st.pos, mul2(r, g * 0.14 * s)), lead);
    };
    let wi = 0, t = 0;
    const swingEnd = { L: -1, R: -1 }, landed = { L: -1e9, R: -1e9 };
    while (t < tEnd) {
      const w = windows[wi];
      if (w && t >= w.start) {
        for (const st of w.steps) plantAt(st.foot, st.land, st.p, st.liftPrev, { air: st.air, locked: true });
        t = Math.max(t, w.end) + dt; wi++;
        swingEnd.L = Math.max(swingEnd.L, last('L').land); swingEnd.R = Math.max(swingEnd.R, last('R').land);
        landed.L = last('L').land; landed.R = last('R').land;
        continue;
      }
      if (!retargeted && t >= floorT) {
        // Swings in flight at the freeze keep their pre-freeze path (via point) and then re-aim using the
        // real post-freeze motion, so the frozen frame is identical in every branch.
        retargeted = true;
        for (const f of ['L', 'R']) {
          const list = out[f], N = list[list.length - 1], P = list[list.length - 2];
          if (!P || N.locked || N.air || !(P.lift < floorT && N.land > floorT)) continue;
          const u = smooth((floorT - P.lift) / (N.land - P.lift));
          N.via = lerp2(P.p, N.p, u); N.tVia = floorT; N.uVia = u; N.dOrig = len2(sub2(N.p, P.p));
          N.p = ideal(f, root(N.land));
        }
      }
      const st = root(t);
      if (st.airborne) { t += dt; continue; }
      const nextStart = w && (w.start <= floorT || t >= floorT) ? w.start : Infinity;
      const sp = st.speed, Tsw = clamp(0.34 - 0.03 * sp, 0.17, 0.34);
      const planted = (f) => swingEnd[f] <= t;
      const err = (f) => len2(sub2(last(f).p, ideal(f, st)));
      const reach = (f) => len2(sub2(last(f).p, st.pos));
      const step = (f) => {
        let land = t + Tsw;
        if (land > nextStart + 0.02) land = nextStart + 0.02;
        if (land - t < 0.09) return false;
        const fut = ahead(t, land), target = ideal(f, fut);
        if (len2(sub2(target, last(f).p)) < 0.03) return false;
        plantAt(f, land, target, t);
        swingEnd[f] = land; landed[f] = land;
        return true;
      };
      const minStance = 0.05 + 0.12 * (1 - clamp(sp / 3.5));
      const moving = sp > 0.25;
      const thr = moving ? 0.13 * s : 0.06 * s;
      if (planted('L') && planted('R')) {
        // Try the foot that is furthest from its ideal spot first, then the other one.
        for (const f of err('L') >= err('R') ? ['L', 'R'] : ['R', 'L']) {
          const fresh = (moving ? 0.03 : 0.12) + (f === (landed.L > landed.R ? 'L' : 'R') ? minStance - 0.03 : 0);
          if (err(f) > thr && t - landed[f] >= Math.max(minStance, fresh) && t - Math.max(landed.L, landed.R) >= (moving ? 0.03 : 0.12) && step(f)) break;
        }
      } else {
        // One foot swinging: the planted one may also lift (flight phase) if the body has run past it.
        const f = planted('L') ? 'L' : planted('R') ? 'R' : null;
        if (f && reach(f) > 0.5 * s && t - landed[f] >= 0.05) step(f);
      }
      t += dt;
    }
    // Toe-off: a planted foot leaves the floor once the body has run past it (no over-stretched legs).
    for (const f of ['L', 'R']) {
      const list = out[f];
      for (let i = 0; i < list.length - 1; i++) {
        const P = list[i], N = list[i + 1];
        if (N.air) continue;
        for (let tt = Math.max(0, P.land) + 0.05; tt < Math.min(P.lift, tEnd); tt += 1 / 120) {
          const st = root(tt);
          if (st.airborne) break;
          if (len2(sub2(P.p, st.pos)) > 0.56 * s) {
            // Never move a lift to before the freeze unless it was already before it (prefix identity).
            const at = tt < floorT && P.lift >= floorT ? floorT : tt;
            P.lift = Math.max(P.land + 0.05, Math.min(P.lift, at));
            break;
          }
        }
      }
    }
    actor.steps = out;
  }

  // Rule engine: decides the point from what the ball actually did, independent of the script.
  function judge(plan) {
    const tc = plan.tContact;
    const landing = plan.events.find((e) => e.type === 'floor' && e.t > tc);
    if (!landing) return { pointTo: null, reason: 'no-landing' };
    const before = plan.contacts.filter((c) => c.t <= landing.t + 1e-9);
    const last = before[before.length - 1];
    const antenna = plan.events.find((e) => e.type === 'outside-antenna' && e.t > tc && e.t < landing.t);
    if (antenna) return { pointTo: other(last.team), reason: 'outside-antenna', landing };
    if (landing.in) return { pointTo: other(landing.side), reason: 'in', landing, lastTouch: last.team };
    return { pointTo: other(last.team), reason: 'out', landing, lastTouch: last.team };
  }
  // Touch count per possession (blocks do not count, per the rules).
  function touchCounts(plan) {
    const out = []; let team = null, n = 0;
    for (const c of plan.contacts) {
      if (c.kind === 'block') { team = null; n = 0; continue; }
      if (c.team !== team) { if (team) out.push({ team, n }); team = c.team; n = 0; }
      n++;
    }
    if (team) out.push({ team, n });
    return out;
  }

  // ───────────────────────────── sampling ─────────────────────────────
  function findSeg(segs, t) {
    let lo = 0, hi = segs.length - 1;
    if (t <= segs[0].t0) return segs[0];
    if (t >= segs[hi].t0) return segs[hi];
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].t0 <= t) lo = m; else hi = m - 1; }
    return segs[lo];
  }
  function samplePts(seg, t) {
    const n = seg.pts.length / 6 - 1, x = clamp((t - seg.t0) / seg.h, 0, n);
    const i = Math.min(n - 1, Math.floor(x)), u = x - i, h = seg.h, P = seg.pts;
    const a = i * 6, b = (i + 1) * 6;
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    // Collisions make velocity discontinuous between two samples: fall back to linear there.
    const va = [P[a + 3], P[a + 4], P[a + 5]], vb = [P[b + 3], P[b + 4], P[b + 5]];
    const smoothSpan = dot(va, vb) > 0.9 * Math.max(dot(va, va), dot(vb, vb)) || len(sub(va, vb)) < 0.5;
    const p = smoothSpan
      ? [0, 1, 2].map((k) => h00 * P[a + k] + h10 * h * P[a + 3 + k] + h01 * P[b + k] + h11 * h * P[b + 3 + k])
      : [0, 1, 2].map((k) => lerp(P[a + k], P[b + k], u));
    const v = [0, 1, 2].map((k) => lerp(P[a + 3 + k], P[b + 3 + k], u));
    return { p, v };
  }
  function ballAt(plan, t) {
    const segs = plan.ball.segs, seg = findSeg(segs, t);
    const tt = clamp(t, seg.t0, seg.t1);
    if (seg.type === 'hold') return { p: seg.p.slice(), v: [0, 0, 0], q: seg.q0.slice(), held: true, seg: 'hold' };
    if (seg.type === 'carry') return { p: seg.fn(tt), v: [0, 0, 0], q: seg.q0.slice(), held: true, seg: 'carry' };
    const { p, v } = samplePts(seg, tt);
    let q;
    if (seg.type === 'flight') q = qmul(qexp(mul(seg.w, tt - seg.t0)), seg.q0);
    else {
      let pc = seg.pieces[0];
      for (const x of seg.pieces) if (x.t0 <= tt) pc = x;
      q = qmul(qexp(mul(pc.w, tt - pc.t0)), pc.q0);
    }
    return { p, v, q, held: false, seg: seg.type };
  }
  function footAt(list, t) {
    let i = 0;
    while (i < list.length - 1 && list[i + 1].land <= t) i++;
    const P = list[i], N = list[i + 1];
    if (!N || t < P.lift) return { planted: true, p: P.p, h: 0, u: 0, since: t - P.land };
    const u = clamp((t - P.lift) / (N.land - P.lift));
    if (N.air) return { planted: false, air: true, p: lerp2(P.p, N.p, u), from: P.p, to: N.p, u, h: 0 };
    const d = N.via ? N.dOrig : len2(sub2(N.p, P.p));
    let p = lerp2(P.p, N.p, smooth(u));
    if (N.via) {
      if (t <= N.tVia) p = lerp2(P.p, N.via.map((v, k) => P.p[k] + (v - P.p[k]) / (N.uVia || 1)), smooth(u)); // the pre-freeze path
      else { const u2 = clamp((t - N.tVia) / (N.land - N.tVia)); p = lerp2(N.via, N.p, smooth(u2)); }
    }
    return { planted: false, air: false, p, from: P.p, to: N.p, u, h: Math.sin(Math.PI * u) * Math.min(0.16, 0.05 + d * 0.12) };
  }
  function actorAt(actor, t) {
    const seg = findSeg(actor.segs, t);
    const tt = clamp(t, seg.t0, seg.t1);
    let pos, face, air = 0, vel = [0, 0], airborne = false, jumpU = 0;
    if (!seg || seg.type === 'idle') { pos = seg.pos.slice(); face = seg.face; }
    else if (seg.type === 'move') {
      const u = clamp((tt - seg.t0) / ((seg.t1 - seg.t0) || 1));
      const s = distanceAt(seg, tt), ds = (distanceAt(seg, tt + 0.01) - distanceAt(seg, tt - 0.01)) / 0.02;
      pos = pathAt(seg, s); face = faceAt(seg, u);
      vel = seg.D > 1e-6 ? mul2(norm2(sub2(seg.to, seg.from)), tt >= seg.t1 || tt <= seg.t0 ? 0 : ds) : [0, 0];
    } else if (seg.type === 'jump') {
      const u = clamp((tt - seg.t0) / (seg.t1 - seg.t0));
      pos = lerp2(seg.from, seg.to, u); face = seg.face; air = 4 * seg.h * u * (1 - u); airborne = u > 0 && u < 1; jumpU = u;
      vel = mul2(sub2(seg.to, seg.from), 1 / (seg.t1 - seg.t0));
    }
    let act = null;
    for (const a of actor.acts) if (a.t0 <= t && t <= a.t1) act = a;
    return {
      id: actor.id, team: actor.team, pos, face, air, airborne, jumpU, vel, speed: len2(vel),
      feet: { L: footAt(actor.steps.L, t), R: footAt(actor.steps.R, t) },
      act: act ? { type: act.type, t0: act.t0, tc: act.tc, t1: act.t1, u: clamp((t - act.t0) / ((act.t1 - act.t0) || 1)), dt: t - act.tc, data: act.data } : null,
    };
  }
  // Rally state handed back to the next rally so players walk (not teleport) into the new rotation.
  function endState(plan, t = plan.tEnd) {
    const actors = {};
    for (const a of plan.actors) { const s = actorAt(a, t); actors[a.id] = [s.pos[0], s.pos[1], s.face]; }
    return { actors, ball: ballAt(plan, t).p };
  }
  // Rotation/serve bookkeeping after a point (side-out rotates the team that wins the serve back).
  function nextServe(state, pointTo) {
    const s = { serving: state.serving, rotation: { ...state.rotation } };
    if (!pointTo) return s;
    if (pointTo !== s.serving) { s.rotation[pointTo] = (s.rotation[pointTo] + 1) % 6; s.serving = pointTo; }
    return s;
  }

  return {
    COURT, BALL, PHYS, BODY, ROSTER, FREEZE_LEAD, MODES,
    create, judge, touchCounts, ballAt, actorAt, endState, nextServe, positionOf, playerAt, lineup,
    solveShot, integrate, simulateFree, netClearTime, inCourt, toWorld, toTeam, fwdOf, rightOf, hash, rng, monotone,
    _math: { add, sub, mul, dot, cross, len, norm, dist, clamp, smooth, lerp, wrap, len2, sub2, add2 },
  };
});
