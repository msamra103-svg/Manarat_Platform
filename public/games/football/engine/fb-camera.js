/* Broadcast camera director. Every shot is a function of the live match state (ball, striker, keeper, goal) so it never needs hand-keyed paths;
 * cuts snap, moves are critically damped. Reduced-motion removes sweeps, dollies, shake and FOV kicks (static, still readable framing). */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, M = FB.math, { clamp, lerp, damp, smooth } = M, G = FB.PITCH;
  const GZ = G.goalZ, HW = G.goalHalf;
  const DEG = Math.PI / 180;
  const _u = new V(), _s = new V(), _p = new V(), _l = new V();

  /** vertical FOV (deg) that gives the requested horizontal FOV on this aspect ratio, clamped to a comfortable range */
  const fovFor = (hfovDeg, aspect, lo = 26, hi = 64) => clamp(2 * Math.atan(Math.tan(hfovDeg * DEG / 2) / aspect) / DEG, lo, hi);

  class CameraDirector {
    constructor(camera, opts = {}) {
      this.cam = camera; this.reduced = !!opts.reduced; this.pos = new V(0, 9, 30); this.look = new V(0, 1, -10); this.fov = 40; this.t = 0; this.shot = 'orbit'; this.shotT = 0;
      this.want = { pos: new V(), look: new V(), fov: 40, kp: 4, kl: 6, kf: 3 }; this.shake = 0; this.dur = 0; this.onDone = null; this.aspect = 16 / 9; this.seed = 1;
      this.roll = 0; this.slowDolly = 0;
    }
    setReduced(r) { this.reduced = !!r; }
    setAspect(a) { this.aspect = a; this.cam.aspect = a; this.cam.updateProjectionMatrix(); }
    /** switch shot. snap = true -> instant cut */
    cut(name, snap = true, dur = 0, onDone = null) { this.shot = name; this.shotT = 0; this.dur = dur; this.onDone = onDone; this.snapNext = !!snap; }
    skip() { if (this.shot === 'establish') { this.shotT = this.dur; } }
    kick(a = 0.05) { if (!this.reduced) this.shake = Math.max(this.shake, a); }

    /** compute the desired camera for the current shot */
    plan(ctx, dt) {
      const w = this.want, a = this.aspect, sh = this.shot, t = this.shotT, red = this.reduced;
      const ball = ctx.ball, gx = 0, goalC = _l.set(0, 1.2, GZ);
      w.kp = 4; w.kl = 7; w.kf = 3;
      const pull = clamp(0.62 / a, 1, 1.7);          // narrow (portrait) screens pull back so the action still fits
      switch (sh) {
        case 'orbit': { // welcome screen: very slow drift in front of the goal mouth
          const k = red ? 0 : Math.sin(this.t * 0.11);
          w.pos.set(9 * k + 8, 6.2, GZ + 27 * pull); w.look.set(1 + 2 * k, 1.4, GZ + 3); w.fov = fovFor(52, a); w.kp = 1.2; w.kl = 1.2; break;
        }
        case 'establish': { // fly-in from behind the near end over the pitch to the broadcast framing
          const d = this.dur || 4, k = red ? 1 : smooth(t / d), k2 = M.smoother(clamp(t / d));
          w.pos.set(lerp(-26, 8, k2), lerp(24, 6.8, k2), lerp(68, 30 + 6 * (pull - 1), k2)); w.look.set(lerp(2, 0, k2), lerp(1, 1.2, k2), lerp(8, 14, k2)); w.fov = fovFor(lerp(64, 50, k2), a, 28, 66); w.kp = 30; w.kl = 30; w.kf = 30; break;
        }
        case 'attack': { // broadcast 3/4 view behind the play, looking up the pitch towards the goal
          const f = ctx.focus || ball;
          w.pos.set(f.x * 0.55 + 7.5, 5.0 + 0.4 * (pull - 1), f.z + 12.5 * pull); w.look.set(f.x * 0.72 - 0.5, 1.0, f.z - 9.5); w.fov = fovFor(56, a); w.kp = 2.6; w.kl = 4.2; break;
        }
        case 'aim': { // striker's view: behind the ball, goal framed
          const b = ctx.shooterBall || ball; _u.set(-b.x, 0, GZ - b.z).normalize(); _s.set(_u.z, 0, -_u.x);
          const back = (ctx.penalty ? 7.4 : 8.2) * pull, side = ctx.penalty ? -1.9 : 1.0;  // penalties: lens on the open side so the kicker never hides the ball
          w.pos.set(b.x - _u.x * back + _s.x * side, (ctx.penalty ? 2.2 : 2.5) + 0.7 * (pull - 1), b.z - _u.z * back + _s.z * side);
          w.look.set(b.x * 0.3, 1.15, GZ + 0.5); w.fov = fovFor(46, a, 28, 62); w.kp = 2.4; w.kl = 3.2; break;
        }
        case 'runup': { // push in slightly and drop lower as the striker runs through the ball
          const b = ctx.shooterBall || ball; _u.set(-b.x, 0, GZ - b.z).normalize(); _s.set(_u.z, 0, -_u.x);
          const k = red ? 0 : smooth(t / 1.6), back = lerp((ctx.penalty ? 7.4 : 8.2) * pull, 5.2 * pull, k), side = ctx.penalty ? lerp(-1.9, -2.2, k) : lerp(1.0, 1.6, k);
          w.pos.set(b.x - _u.x * back + _s.x * side, lerp(2.5, 1.5, k), b.z - _u.z * back + _s.z * side);
          w.look.set(b.x + _u.x * 6, 1.0, b.z + _u.z * 6); w.fov = fovFor(lerp(46, 40, k), a, 28, 62); w.kp = 3.2; w.kl = 5; break;
        }
        case 'flight': { // chase the ball; as the shot slows the framing opens onto ball + keeper + goal mouth
          const slow = clamp(ctx.slow || 0, 0, 1), v = _u.copy(ctx.ballV || _u.set(0, 0, -1)); v.y = 0; if (v.lengthSq() < 0.25) v.set(0, 0, -1); v.normalize();
          const s = _s.set(v.z, 0, -v.x);
          const back = lerp(4.6, 6.2, slow) * pull, side = lerp(0.9, 2.1, slow) * (ball.x > 0 ? -1 : 1) * 0.8 + 0.5, h = lerp(1.35, 1.85, slow);
          w.pos.set(ball.x - v.x * back + s.x * side, Math.max(1.0, ball.y * 0.4 + h), ball.z - v.z * back + s.z * side);
          const gl = lerp(0.18, 0.7, slow); w.look.set(lerp(ball.x, ball.x * 0.5, slow), lerp(ball.y * 0.6 + 0.5, 1.15, slow), lerp(ball.z - v.z * 3, GZ + 0.4, gl * slow + 0.0));
          w.fov = fovFor(lerp(54, 46, slow), a, 28, 62) - (red ? 0 : slow * 2); w.kp = 7; w.kl = 7; w.kf = 3; break;
        }
        case 'frozen': { // held frame: tiny parallax drift is the only motion (none in reduced-motion)
          const d = red ? 0 : Math.sin(this.t * 0.35) * 0.18; w.kp = 1.5; w.kl = 1.5; w.pos.copy(this.frozenPos || this.pos); w.pos.x += d; w.look.copy(this.frozenLook || this.look); w.fov = this.fov; break;
        }
        case 'goalside': { // low, beside the near post, looking out at the keeper and the ball coming in (saves, near misses)
          const sx = (ctx.ball.x >= 0 ? -1 : 1);
          w.pos.set(sx * (HW + 2.6), 1.15, GZ - 0.6); w.look.set(lerp(ball.x, 0, 0.35), 1.1, Math.max(GZ + 1.2, ball.z)); w.fov = fovFor(58, a, 28, 66); w.kp = 8; w.kl = 5; break;
        }
        case 'behindGoal': { // from behind the net: the shot arrives and the net bulges
          w.pos.set(clamp(ball.x * 0.5, -3.2, 3.2) + 1.2, 1.5, GZ - 5.2); w.look.set(ball.x * 0.35, 1.2, Math.max(GZ - 1.0, ball.z + 0.5)); w.fov = fovFor(56, a, 30, 66); w.kp = 6; w.kl = 4.5; break;
        }
        case 'play': { // interactive match: behind and above the controlled player, looking up the pitch; damped, never cuts while in control
          const c = ctx.ctrl || ball, h = 9.2 + 1.6 * (pull - 1), back = 12.5 * pull;
          w.pos.set(c.x * 0.75, h, c.z + back); w.look.set(c.x * 0.88, 0.6, c.z - 7.5); w.fov = fovFor(62, a, 34, 70); w.kp = 2.4; w.kl = 3.2; w.kf = 2; break;
        }
        case 'follow': { // gentle follow for wide / neutral outcomes
          w.pos.set(ball.x * 0.5 + 6, 3.2, Math.max(ball.z + 11 * pull, GZ + 11)); w.look.set(ball.x * 0.7, 0.8, ball.z - 2); w.fov = fovFor(58, a); w.kp = 2.5; w.kl = 4; break;
        }
        case 'react': { // medium shot of the person the moment is about (striker / keeper)
          const who = ctx.reactTo || ctx.shooter || { x: 0, z: 0, yaw: 0 }, p = who.pos || who, yaw = who.yaw || 0, fx = Math.sin(yaw), fz = Math.cos(yaw);
          const dr = red ? 0 : Math.sin(this.t * 0.4) * 0.5, others = ctx.others || [];
          // choose the camera bearing (relative to where the subject faces) with the clearest sight line: nobody between lens and subject
          const clear = (ang) => {
            const cx = p.x + Math.sin(yaw + ang) * 5.3 * pull, cz = p.z + Math.cos(yaw + ang) * 5.3 * pull; let m = 9;
            for (const o of others) { if (o === p) continue; const dx = cx - p.x, dz = cz - p.z, l2 = dx * dx + dz * dz || 1, t = clamp(((o.x - p.x) * dx + (o.z - p.z) * dz) / l2, 0, 1.15); m = Math.min(m, Math.hypot(o.x - (p.x + dx * t), o.z - (p.z + dz * t))); }
            return m;
          };
          if (this._rcFor !== who || this._rcK === undefined || clear(this._rcK) < 1.1) {
            let best = 0.5, bs = -1; for (const a0 of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 0, 2.0, -2.0, 2.6, -2.6]) { const sc = Math.min(clear(a0), 3) - Math.abs(a0) * 0.12; if (sc > bs) { bs = sc; best = a0; } }
            this._rcFor = who; this._rcK = best;
          }
          const ang = this._rcK + (red ? 0 : dr * 0.08);
          w.pos.set(p.x + Math.sin(yaw + ang) * 5.3 * pull, 1.6, p.z + Math.cos(yaw + ang) * 5.3 * pull); w.look.set(p.x, 1.3, p.z); w.fov = fovFor(30, a, 22, 50); w.kp = 6; w.kl = 7; break;
        }
        case 'replayA': { // side-on, low tracking shot along the ball's path
          const sx = ctx.replaySide || 1; w.pos.set(ball.x + sx * 10.5, 1.4, clamp(ball.z + 1.0, GZ + 3.5, 60)); w.look.set(ball.x, 0.9, ball.z - 1.5); w.fov = fovFor(44, a, 26, 60); w.kp = 4; w.kl = 6; break;
        }
        case 'replayB': { // behind the goal: the finish
          w.pos.set(clamp(ball.x * 0.4, -3, 3) + 1.4, 1.6, GZ - 5.6); w.look.set(ball.x * 0.4, 1.2, Math.max(GZ - 0.5, ball.z)); w.fov = fovFor(56, a, 30, 66); w.kp = 5; w.kl = 5; break;
        }
        default: w.pos.copy(this.pos); w.look.copy(this.look);
      }
    }

    update(dt, ctx) {
      this.t += dt; this.shotT += dt; this.plan(ctx, dt); const w = this.want;
      if (this.snapNext) { this.pos.copy(w.pos); this.look.copy(w.look); this.fov = w.fov; this.snapNext = false; if (this.shot !== 'frozen') this.frozenPos = null; }
      else { const kp = this.reduced && this.shot !== 'establish' ? w.kp * 1.6 : w.kp; this.pos.x = damp(this.pos.x, w.pos.x, kp, dt); this.pos.y = damp(this.pos.y, w.pos.y, kp, dt); this.pos.z = damp(this.pos.z, w.pos.z, kp, dt);
        this.look.x = damp(this.look.x, w.look.x, w.kl, dt); this.look.y = damp(this.look.y, w.look.y, w.kl, dt); this.look.z = damp(this.look.z, w.look.z, w.kl, dt); this.fov = damp(this.fov, w.fov, w.kf, dt); }
      if (this.shot === 'establish' && this.dur && this.shotT >= this.dur) { const cb = this.onDone; this.onDone = null; this.dur = 0; if (cb) cb(); }
      else if (this.dur && this.shotT >= this.dur && this.onDone) { const cb = this.onDone; this.onDone = null; cb(); }
      // keep the lens above the grass and inside the bowl
      this.pos.y = Math.max(0.55, this.pos.y);
      const c = this.cam; c.position.copy(this.pos);
      if (this.shake > 0.0005) { const s = this.shake; c.position.x += Math.sin(this.t * 71) * s; c.position.y += Math.sin(this.t * 59 + 1) * s * 0.7; this.shake *= Math.exp(-dt * 9); }
      c.lookAt(this.look); if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
    }
    /** remember the current framing for the frozen hold */
    hold() { this.frozenPos = this.pos.clone(); this.frozenLook = this.look.clone(); this.cut('frozen', false); }
  }
  FB.CameraDirector = CameraDirector; FB.fovFor = fovFor;
})(typeof window !== 'undefined' ? window : globalThis);
