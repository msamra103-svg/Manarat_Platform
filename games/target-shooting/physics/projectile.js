/* Target Shooting 3D — deterministic arrow ballistics and continuous (swept) collision. Browser + Node.
 *
 * Model: point-mass arrow under gravity (g = 9.81 m/s², no drag), launched at 62 m/s (a typical Olympic recurve).
 * Integration is the exact closed form for constant acceleration, applied in fixed 1/240 s sub-steps, so a
 * trajectory is identical at any frame rate and the integrated path equals the analytic parabola used by the
 * launch solver: the reticle (aim point), the trajectory and the impact agree exactly for a stationary target.
 *
 * Collision is swept: each sub-step tests the arrow TIP's segment (previous -> current) against every target
 * in the target's own moving frame (relative motion: target start/end positions of the same sub-step), so a
 * fast arrow can never tunnel through a fast target. The earliest hit along the segment wins; a target can be
 * hit only once (the caller marks it), an arrow can hit only one target (it is then embedded or consumed).
 */
(function (root) {
  'use strict';
  const G = 9.81, SPEED = 62, STEP = 1 / 240, ARROW_LEN = 0.74;
  const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const sub = (a, b, o = v3()) => (o.x = a.x - b.x, o.y = a.y - b.y, o.z = a.z - b.z, o);
  const add = (a, b, o = v3()) => (o.x = a.x + b.x, o.y = a.y + b.y, o.z = a.z + b.z, o);
  const scale = (a, s, o = v3()) => (o.x = a.x * s, o.y = a.y * s, o.z = a.z * s, o);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const len = a => Math.sqrt(dot(a, a));
  const copy = (a, o = v3()) => (o.x = a.x, o.y = a.y, o.z = a.z, o);

  /** Low-arc launch velocity from `o` that passes exactly through `p`. Returns {v, t, angle} or null if out of range. */
  function solveLaunch(o, p, speed = SPEED, g = G) {
    const dx = p.x - o.x, dz = p.z - o.z, dy = p.y - o.y;
    const x = Math.hypot(dx, dz);
    if (x < 1e-6) return { v: v3(0, Math.sign(dy) * speed, 0), t: Math.abs(dy) / speed, angle: Math.sign(dy) * Math.PI / 2 };
    const s2 = speed * speed, disc = s2 * s2 - g * (g * x * x + 2 * dy * s2);
    if (disc < 0) return null;
    const ang = Math.atan2(s2 - Math.sqrt(disc), g * x);
    const c = Math.cos(ang), hx = dx / x, hz = dz / x;
    return { v: v3(speed * c * hx, speed * Math.sin(ang), speed * c * hz), t: x / (speed * c), angle: ang };
  }
  /** position at time t of a launch */
  function at(o, v, t, out = v3(), g = G) { out.x = o.x + v.x * t; out.y = o.y + v.y * t - 0.5 * g * t * t; out.z = o.z + v.z * t; return out; }

  /** Segment a0->a1 vs sphere moving c0->c1 (radius r). Returns the fraction in [0,1] of first contact, or -1. */
  function sweepSphere(a0, a1, c0, c1, r) {
    const p = sub(a0, c0), q = sub(a1, c1), d = sub(q, p);
    const A = dot(d, d), B = 2 * dot(p, d), C = dot(p, p) - r * r;
    if (C <= 0) return 0;                       // starts inside: immediate contact
    if (A < 1e-12) return -1;
    const disc = B * B - 4 * A * C; if (disc < 0) return -1;
    const t = (-B - Math.sqrt(disc)) / (2 * A);
    return t >= 0 && t <= 1 ? t : -1;
  }
  /** Segment vs a moving disc (centre c0->c1, unit normal n facing the shooter, radius r). Front-face crossing only. */
  function sweepDisc(a0, a1, c0, c1, n, r, out) {
    const p = sub(a0, c0), q = sub(a1, c1);
    const s0 = dot(p, n), s1 = dot(q, n);
    if (!(s0 > 0 && s1 <= 0)) return -1;
    const t = s0 / (s0 - s1);
    const hit = add(p, scale(sub(q, p), t));
    const radial = len(sub(hit, scale(n, dot(hit, n))));
    if (radial > r) return -1;
    if (out) { out.radial = radial; out.local = hit; }
    return t;
  }

  /** Olympic 10-ring face: ring score from the radial distance (rings are r/10 wide). 0 = outside the face. */
  function ringScore(radial, faceRadius) { if (radial > faceRadius) return 0; return Math.max(1, 10 - Math.floor(radial / (faceRadius / 10))); }

  /**
   * Flight of one arrow. Colliders are supplied by the caller each sub-step as objects
   *   { id, kind: 'sphere'|'disc'|'plane', c0, c1, r, n, ref }  (plane: point c0, normal n, static)
   * and the earliest contact along the tip segment is returned.
   */
  class Flight {
    constructor(origin, vel, id) {
      this.id = id; this.p = copy(origin); this.v = copy(vel); this.t = 0; this.alive = true;
      this.tip = this.tipOf(this.p, this.v, v3()); this.prevTip = copy(this.tip); this.hits = 0; this.result = null;
    }
    tipOf(p, v, out) { const s = len(v) || 1; out.x = p.x + v.x / s * ARROW_LEN; out.y = p.y + v.y / s * ARROW_LEN; out.z = p.z + v.z / s * ARROW_LEN; return out; }
    step(h, colliders) {
      if (!this.alive) return null;
      copy(this.tip, this.prevTip);
      this.p.x += this.v.x * h; this.p.y += this.v.y * h - 0.5 * G * h * h; this.p.z += this.v.z * h;
      this.v.y -= G * h; this.t += h;
      this.tipOf(this.p, this.v, this.tip);
      let best = null;
      for (const c of colliders) {
        let f = -1, info = {};
        if (c.kind === 'sphere') f = sweepSphere(this.prevTip, this.tip, c.c0, c.c1, c.r);
        else if (c.kind === 'disc') f = sweepDisc(this.prevTip, this.tip, c.c0, c.c1, c.n, c.r, info);
        else if (c.kind === 'plane') { const s0 = dot(sub(this.prevTip, c.c0), c.n), s1 = dot(sub(this.tip, c.c0), c.n); if (s0 > 0 && s1 <= 0) f = s0 / (s0 - s1); }
        if (f >= 0 && (!best || f < best.f)) best = { f, c, info };
      }
      if (best) {
        const pt = add(this.prevTip, scale(sub(this.tip, this.prevTip), best.f));
        // move the arrow back so its tip sits exactly at the contact point (no pass-through)
        const back = sub(pt, this.tip);
        add(this.p, back, this.p); copy(pt, this.tip);
        this.hits++;
        return { collider: best.c, point: pt, fraction: best.f, radial: best.info.radial, local: best.info.local, time: this.t - h * (1 - best.f) };
      }
      return null;
    }
  }

  const API = { G, SPEED, STEP, ARROW_LEN, solveLaunch, at, sweepSphere, sweepDisc, ringScore, Flight, v3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else { root.TS = root.TS || {}; root.TS.Physics = API; }
})(typeof window !== 'undefined' ? window : globalThis);
