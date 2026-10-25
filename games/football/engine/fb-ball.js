/* Deterministic football physics: gravity, drag, Magnus (spin), turf bounce & roll, goal frame (posts + crossbar capsules), goal net,
 * and moving sphere colliders (keeper hands/body). No rendering dependencies; unit-tested in Node. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const V = THREE.Vector3, Q = THREE.Quaternion;
  const P = () => FB.PITCH;
  const G_Z = FB.PITCH.goalZ;
  const STEP = 1 / 480;                       // physics sub-step (s)
  const RHO = 1.2, CD = 0.25, MASS = 0.43;

  const _a = new V(), _b = new V(), _c = new V(), _n = new V();

  class Ball {
    constructor() {
      this.r = P().ballR; this.p = new V(0, this.r, 0); this.v = new V(); this.w = new V(); this.q = new Q();
      this.colliders = []; this.events = []; this.t = 0;
      this.net = { impacts: [] };
      this.lastTouch = null; this.inGoal = false; this.resting = true; this.parry = false;
      this.mu = 0.45; this.eGround = 0.62; this.postE = 0.58;
      this.enableFrame = true;
    }
    reset(x, y, z) { this.p.set(x, y === undefined ? this.r : y, z); this.v.set(0, 0, 0); this.w.set(0, 0, 0); this.events.length = 0; this.inGoal = false; this.crossed = false; this.crossInside = false; this.resting = true; this.parry = false; this.lastTouch = null; this.net.impacts.length = 0; }
    clone() { const b = new Ball(); b.p.copy(this.p); b.v.copy(this.v); b.w.copy(this.w); b.t = this.t; b.inGoal = this.inGoal; b.crossed = this.crossed; b.crossInside = this.crossInside; b.enableFrame = this.enableFrame; b.colliders = this.colliders; return b; }

    emit(type, strength, pos) { this.events.push({ type, strength, x: pos ? pos.x : this.p.x, y: pos ? pos.y : this.p.y, z: pos ? pos.z : this.p.z, t: this.t }); }

    /** advance by an arbitrary dt using fixed sub-steps; returns the number of sub-steps performed */
    advance(dt) { let n = 0, left = dt; while (left > 1e-9) { const h = Math.min(STEP, left); this.step(h); left -= h; n++; if (n > 2000) break; } return n; }

    step(dt) {
      const p = this.p, v = this.v, w = this.w, r = this.r;
      this.t += dt; const pz0 = this.p.z, px0 = this.p.x, py0 = this.p.y;
      if (!(this.resting && v.lengthSq() < 1e-6)) {
        const sp = v.length();
        // acceleration: gravity + quadratic drag + Magnus
        let ax = 0, ay = -FB.PITCH.gravity, az = 0;
        if (sp > 1e-4) {
          const k = 0.5 * RHO * Math.PI * r * r / MASS;
          const dragK = k * CD * sp; ax -= dragK * v.x; ay -= dragK * v.y; az -= dragK * v.z;
          const wl = w.length();
          if (wl > 1e-3) {
            const S = r * wl / sp, Cl = Math.min(0.32, 0.55 * S);
            _a.crossVectors(w, v); const ml = _a.length();
            if (ml > 1e-6) { const f = k * Cl * sp * sp / ml; ax += _a.x * f; ay += _a.y * f; az += _a.z * f; }
          }
        }
        if (!this.resting) { v.x += ax * dt; v.y += ay * dt; v.z += az * dt; } else { v.x += ax * dt; v.z += az * dt; }
        p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
        w.multiplyScalar(Math.exp(-0.06 * dt));
      }
      this._ground(dt);
      if (this.enableFrame) { this._frame(); this._net(); this._bounds(); }
      this._colliders();
      // goal-line crossing: counted only when the ball crosses the goal plane between the posts and under the bar
      if (pz0 > G_Z && this.p.z <= G_Z && !this.crossed) { const k = (pz0 - G_Z) / ((pz0 - this.p.z) || 1), cx = px0 + (this.p.x - px0) * k, cy = py0 + (this.p.y - py0) * k; this.crossed = true; this.crossInside = Math.abs(cx) < FB.PITCH.goalHalf - 0.02 && cy < FB.PITCH.goalHeight - 0.02 && cy > 0; if (this.crossInside) this.inGoal = true; }
      // orientation
      const wl = w.length(); if (wl > 1e-4) { _b.copy(w).multiplyScalar(1 / wl); this.q.premultiply(_c2.setFromAxisAngle(_b, wl * dt)); }
    }

    _ground(dt) {
      const p = this.p, v = this.v, w = this.w, r = this.r;
      if (p.y > r + 1e-4) { this.resting = false; return; }
      p.y = r;
      if (v.y < -0.9) {                                   // bounce
        const vn = -v.y; v.y = vn * this.eGround;
        // contact-point slip -> Coulomb friction impulse
        const cx = v.x + w.z * r, cz = v.z - w.x * r, sl = Math.hypot(cx, cz);
        if (sl > 1e-4) {
          const Jn = vn * (1 + this.eGround), Jt = Math.min(this.mu * Jn, 0.4 * sl);
          const tx = cx / sl, tz = cz / sl;
          v.x -= tx * Jt; v.z -= tz * Jt;
          w.z -= (Jt * tx) * 2.5 / r * 0.4; w.x += (Jt * tz) * 2.5 / r * 0.4;
        }
        this.emit('bounce', vn);
        this.resting = false;
      } else {                                            // rolling / resting on the turf
        v.y = 0; this.resting = true;
        const sp = Math.hypot(v.x, v.z);
        if (sp > 1e-4) {
          const dec = (0.75 + 0.16 * sp) * dt, ns = Math.max(0, sp - dec);
          v.x *= ns / sp; v.z *= ns / sp;
          // spin follows rolling without slip
          const tw = 1 - Math.exp(-14 * dt); w.x += (v.z / r - w.x) * tw; w.z += (-v.x / r - w.z) * tw; w.y *= (1 - 3 * dt);
        } else { v.x = v.z = 0; w.multiplyScalar(Math.max(0, 1 - 4 * dt)); }
      }
    }

    _segment(ax, ay, az, bx, by, bz, rad, e, kind) {
      const p = this.p, v = this.v;
      _a.set(ax, ay, az); _b.set(bx, by, bz).sub(_a);
      const t = Math.max(0, Math.min(1, _c.copy(p).sub(_a).dot(_b) / _b.lengthSq()));
      _c.copy(_a).addScaledVector(_b, t);                  // closest point on segment
      _n.copy(p).sub(_c); const d = _n.length(), need = this.r + rad;
      if (d >= need) return false;
      if (d < 1e-6) _n.set(0, 0, 1); else _n.multiplyScalar(1 / d);
      p.copy(_c).addScaledVector(_n, need);
      const vn = v.dot(_n);
      if (vn < 0) {
        v.addScaledVector(_n, -(1 + e) * vn);
        // friction on the tangential component
        const sp = -vn; if (sp > 0.5) { const vt = _a.copy(v).addScaledVector(_n, -v.dot(_n)); v.addScaledVector(vt, -0.12); }
        this.emit(kind, -vn, _c);
      }
      this.resting = false; this.lastTouch = kind;
      return true;
    }

    _frame() {
      const g = FB.PITCH, hw = g.goalHalf, H = g.goalHeight, z = g.goalZ, pr = g.postR, p = this.p;
      if (p.z > z + 1.0 || p.z < z - 0.6 || Math.abs(p.x) > hw + 1.0 || p.y > H + 1.0) return;
      this._segment(-(hw + pr), 0, z, -(hw + pr), H + pr, z, pr, this.postE, 'post');
      this._segment(hw + pr, 0, z, hw + pr, H + pr, z, pr, this.postE, 'post');
      this._segment(-(hw + pr), H + pr, z, hw + pr, H + pr, z, pr, this.postE, 'bar');
    }

    /** net surfaces: back (sloping), top and the two sides. The ball is damped and the impact is reported so the visual net can bulge. */
    _net() {
      const g = FB.PITCH, hw = g.goalHalf, H = g.goalHeight, z0 = g.goalZ, p = this.p, v = this.v, r = this.r;
      if (p.z > z0 + r || p.y > H + r + 0.05 || Math.abs(p.x) > hw + r + 0.05) { return; }
      
      const nT = g.netDepthTop, nB = g.netDepthBottom;
      const hit = (nx, ny, nz, dist, kind) => {
        if (dist >= r) return;
        p.x += nx * (r - dist); p.y += ny * (r - dist); p.z += nz * (r - dist);
        const vn = v.x * nx + v.y * ny + v.z * nz;
        if (vn < 0) {
          const e = 0.04; v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny; v.z -= (1 + e) * vn * nz;
          const f = 0.45; const tx = v.x - (v.x * nx + v.y * ny + v.z * nz) * nx; // tangential damping
          v.multiplyScalar(1 - 0.30);
          if (-vn > 0.4) { this.net.impacts.push({ x: p.x, y: p.y, z: p.z, s: -vn, kind }); this.emit('net', -vn); }
        }
        this.resting = false;
      };
      if (this.inGoal) {
        // back plane (inside normal): n = (0, -dz, dy)/|.| with t = (dz = nB - nT, dy = H)
        const dz = nB - nT, len = Math.hypot(dz, H), ny = -dz / len, nz = H / len;
        const zb = z0 - nB, dist = ((p.y - 0) * ny + (p.z - zb) * nz);     // distance to plane through (y=0, z=z0-nB)
        if (p.y < H + 0.1) hit(0, ny, nz, dist, 'back');
        // top plane
        if (p.z > z0 - nT - 0.1) hit(0, -1, 0, H - p.y, 'top');
        // sides
        hit(-1, 0, 0, hw - p.x, 'sideR'); hit(1, 0, 0, p.x + hw, 'sideL');
      }
    }

    /** advertising boards (low wall) and the front of the stands + side stands: the ball bounces back instead of leaving the stadium */
    _bounds() {
      const p = this.p, v = this.v, r = this.r, bz = G_Z - 5.14, sz = G_Z - 6.9, sx = 43.4;
      if (p.y < 0.95 && p.z < bz + r && p.z > bz - 0.3 && v.z < 0 && Math.abs(p.x) < 38) { p.z = bz + r; v.z = -v.z * 0.45; v.x *= 0.8; this.emit('board', -v.z); this.resting = false; }
      else if (p.z < sz + r && v.z < 0) { p.z = sz + r; v.z = -v.z * 0.22; v.x *= 0.6; v.y *= 0.6; this.emit('stand', -v.z); this.resting = false; }
      if (Math.abs(p.x) > sx - r && p.x * v.x > 0) { p.x = Math.sign(p.x) * (sx - r); v.x = -v.x * 0.22; this.emit('stand', Math.abs(v.x)); this.resting = false; }
      if (p.z > G_Z + 105 + 6.9 - r && v.z > 0) { p.z = G_Z + 105 + 6.9 - r; v.z = -v.z * 0.22; this.resting = false; }
      if (p.y > 38) { p.y = 38; if (v.y > 0) v.y = -v.y * 0.3; }
    }
    _colliders() {
      const p = this.p, v = this.v, r = this.r;
      for (const c of this.colliders) {
        if (!c.active) continue;
        _n.copy(p).sub(c.p); const d = _n.length(), need = r + c.r;
        if (d >= need || d < 1e-6) continue;
        _n.multiplyScalar(1 / d); p.copy(c.p).addScaledVector(_n, need);
        const vrelN = (v.x - c.v.x) * _n.x + (v.y - c.v.y) * _n.y + (v.z - c.v.z) * _n.z;
        if (vrelN < 0) {
          v.addScaledVector(_n, -(1 + c.e) * vrelN);
          if (c.parry && v.z < 1.8) v.z = 1.8 + Math.random() * 0 ;      // a parried ball always leaves the goal mouth
          this.emit(c.kind || 'hand', -vrelN); this.lastTouch = c.owner || 'hand';
          if (c.onHit) c.onHit(this);
        }
        this.resting = false;
      }
    }

    /** Predict the trajectory with the same physics: returns array of {t,x,y,z} samples every 'every' seconds until z passes stopZ or maxT. */
    predict(maxT = 3, every = 1 / 60, stopZ = null, frame = true) {
      const b = this.clone(); b.colliders = []; b.enableFrame = frame; const out = [{ t: 0, x: b.p.x, y: b.p.y, z: b.p.z, vx: b.v.x, vy: b.v.y, vz: b.v.z }];
      let acc = 0;
      for (let t = 0; t < maxT; t += STEP) {
        b.step(STEP); acc += STEP;
        if (acc >= every - 1e-9) { acc = 0; out.push({ t: b.t - this.t, x: b.p.x, y: b.p.y, z: b.p.z, vx: b.v.x, vy: b.v.y, vz: b.v.z }); }
        if (stopZ !== null && b.p.z < stopZ) break;
      }
      return out;
    }
  }
  const _c2 = new Q();

  /** Solve the launch velocity so that the (full-physics) ball crosses the goal plane at target (x,y). speed = horizontal launch speed guess (m/s). */
  function solveShot(start, target, speed, spin) {
    const z = FB.PITCH.goalZ, ball = new Ball();
    const dx = target.x - start.x, dz = target.z - start.z, dist = Math.hypot(dx, dz);
    let t = dist / speed; const v = new V(dx / t, 0, dz / t); v.y = (target.y - start.y + 0.5 * 9.81 * t * t) / t;
    for (let it = 0; it < 12; it++) {
      ball.reset(start.x, start.y, start.z); ball.p.copy(start); ball.v.copy(v); if (spin) ball.w.copy(spin); ball.enableFrame = false;
      let tt = 0, prev = ball.p.clone(), hit = null;
      while (tt < 4) {
        prev.copy(ball.p); ball.step(STEP); tt += STEP;
        if (ball.p.z <= target.z) { const k = (prev.z - target.z) / (prev.z - ball.p.z || 1); hit = { x: prev.x + (ball.p.x - prev.x) * k, y: prev.y + (ball.p.y - prev.y) * k, t: tt }; break; }
        if (ball.p.y < 0.0 && ball.v.y < 0 && ball.p.y <= ball.r + 1e-3 && tt > 0.05) { /* grounded before the goal */ }
      }
      if (!hit) break;
      const ex = target.x - hit.x, ey = target.y - hit.y;
      if (Math.abs(ex) < 0.01 && Math.abs(ey) < 0.01) { return { v: v.clone(), time: hit.t, err: Math.hypot(ex, ey) }; }
      v.x += ex / hit.t * 0.9; v.y += ey / hit.t * 0.9;
      // horizontal speed correction along z so the flight time matches
    }
    return { v: v.clone(), time: dist / speed, err: 1 };
  }

  FB.Ball = Ball; FB.solveShot = solveShot; FB.BALL_STEP = STEP;
})(typeof window !== 'undefined' ? window : globalThis);
