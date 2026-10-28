/* Target Shooting 3D — aiming, aim assistance and the cinematic over-the-shoulder camera.
 *
 * Aim model
 *   raw input -> a line of sight (LOS) from a fixed aim origin O (stance-dependent only):
 *     mouse/touch position -> ray from the NEUTRAL camera (not the moving one: no feedback between the
 *     camera and the aim) -> first hit in the mode's scene (targets, ground, backstop, far range) -> LOS.
 *   assist (optional) bends the raw LOS toward the nearest target (with lead for moving targets).
 *   LOS yaw / pitch / range are smoothed by critically damped springs (no overshoot, no oscillation).
 *   The aim point P = O + LOS · range. The archer's arrow direction is the exact ballistic launch from O to P,
 *   and at release the launch is solved again from the real arrow position to the same P — so the reticle,
 *   the drawn trajectory and the impact agree (exact for stationary targets; for moving ones the reticle
 *   marks where the arrow crosses the line of sight at the smoothed range — see DEVELOPMENT.md).
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util, PH = TS.Physics;
  const UP = new T.Vector3(0, 1, 0);

  class Aim {
    constructor() {
      this.origin = new T.Vector3(); this.base = new T.Vector3(0, 0, -1);
      this.raw = { yaw: 0, pitch: 0.02, range: 30 };
      this.yaw = new U.Spring(0, 20); this.pitch = new U.Spring(0.02, 20); this.range = new U.Spring(30, 12);
      // yaw > 0 turns toward the archer's back (closing the stance: ~35° anatomically), yaw < 0 toward his chest (opening: ~60°)
      this.limits = { yawMin: -1.0, yawMax: 0.62, pitchMin: -0.12, pitchMax: 0.85 };
      this.los = new T.Vector3(0, 0, -1); this.point = new T.Vector3(0, 1.5, -30); this.launch = new T.Vector3(0, 0, -1);
      this.assist = 0; this.speed = PH.SPEED; this.solution = null; this.maxRate = 2.6;
      this._v = Array.from({ length: 8 }, () => new T.Vector3());
    }
    setStance(origin, baseDir) { this.origin.copy(origin); this.base.copy(baseDir).setY(0).normalize(); }
    /** yaw/pitch of a direction relative to the stance base direction */
    anglesOf(dir) {
      const b = this.base, h = this._v[0].copy(dir).setY(0); const l = h.length(); if (l < 1e-6) return { yaw: 0, pitch: Math.sign(dir.y) * 1.2 };
      h.multiplyScalar(1 / l);
      return { yaw: Math.atan2(this._v[1].crossVectors(b, h).y, b.dot(h)), pitch: Math.atan2(dir.y, l) };
    }
    dirOf(yaw, pitch, out) {
      const q = this._q || (this._q = new T.Quaternion());
      out.copy(this.base).applyQuaternion(q.setFromAxisAngle(UP, yaw));
      const side = this._v[2].crossVectors(out, UP).normalize();
      return out.applyAxisAngle(side, pitch).normalize();
    }
    /** set the raw aim to look at a world point (range = its distance) */
    lookAtPoint(p) {
      const d = this._v[3].subVectors(p, this.origin); const r = d.length(); d.normalize();
      const a = this.anglesOf(d);
      this.raw.yaw = U.clamp(a.yaw, this.limits.yawMin, this.limits.yawMax);
      this.raw.pitch = U.clamp(a.pitch, this.limits.pitchMin, this.limits.pitchMax);
      this.raw.range = U.clamp(r, 3, 120);
    }
    nudge(dyaw, dpitch, rayHit) {
      this.raw.yaw = U.clamp(this.raw.yaw + dyaw, this.limits.yawMin, this.limits.yawMax);
      this.raw.pitch = U.clamp(this.raw.pitch + dpitch, this.limits.pitchMin, this.limits.pitchMax);
      if (rayHit) { const d = this.dirOf(this.raw.yaw, this.raw.pitch, this._v[4]); const h = rayHit(this.origin, d); if (h) this.raw.range = U.clamp(h, 3, 120); }
    }
    snap() { this.yaw.set(this.raw.yaw); this.pitch.set(this.raw.pitch); this.range.set(this.raw.range); this.lim = { y: this.raw.yaw, p: this.raw.pitch }; this.update(0); }
    /**
     * targets: [{pos, vel, r}] alive targets (for assistance + lead); returns nothing, updates los/point/launch.
     */
    update(dt, targets) {
      let ty = this.raw.yaw, tp = this.raw.pitch, tr = this.raw.range;
      if (this.assist > 0 && targets && targets.length) {
        const rawDir = this.dirOf(ty, tp, this._v[4]);
        let best = null, bestAng = 0.16 + 0.12 * this.assist;
        for (const t of targets) {
          const lead = this.leadPoint(t, this._v[5]);
          const dir = this._v[6].subVectors(lead, this.origin); const dist = dir.length(); dir.normalize();
          const ang = dir.angleTo(rawDir);
          if (ang < bestAng) { bestAng = ang; best = { dir: dir.clone(), dist }; }
        }
        if (best) {
          const a = this.anglesOf(best.dir), k = this.assist * (1 - bestAng / (0.16 + 0.12 * this.assist));
          ty = U.lerp(ty, a.yaw, k); tp = U.lerp(tp, a.pitch, k); tr = U.lerp(tr, best.dist, Math.min(1, k * 1.5));
          this.assisted = k;
        } else this.assisted = 0;
      }
      // assistance never pushes the aim outside the archer's range (no pumping against the limit)
      ty = U.clamp(ty, this.limits.yawMin, this.limits.yawMax); tp = U.clamp(tp, this.limits.pitchMin, this.limits.pitchMax);
      if (dt > 0) {
        // a drawn bow is a heavy, two-handed object: the aim TARGET swings at most ~2.6 rad/s, then the springs
        // follow it (rate-limiting the target, not the output, keeps the system linear: no alternating clamp)
        if (this.lim === undefined) this.lim = { y: this.yaw.x, p: this.pitch.x };
        const dy = ty - this.lim.y, dp = tp - this.lim.p, m = Math.hypot(dy, dp), step = this.maxRate * dt;
        if (m > step) { this.lim.y += dy * step / m; this.lim.p += dp * step / m; } else { this.lim.y = ty; this.lim.p = tp; }
        this.yaw.update(this.lim.y, dt); this.pitch.update(this.lim.p, dt); this.range.update(tr, dt);
      }
      this.dirOf(this.yaw.x, this.pitch.x, this.los);
      this.point.copy(this.origin).addScaledVector(this.los, this.range.x);
      const s = PH.solveLaunch(this.origin, this.point, this.speed);
      this.solution = s;
      if (s) this.launch.set(s.v.x, s.v.y, s.v.z).normalize(); else this.launch.copy(this.los).addScaledVector(UP, 0.4).normalize();
    }
    /** point where an arrow launched now would meet the target (iterated flight-time lead) */
    leadPoint(t, out) {
      out.copy(t.pos);
      if (t.predict) {            // exact future position supplied by the mode (spline path / drag ballistics)
        let tt = out.distanceTo(this.origin) / this.speed;
        for (let i = 0; i < 4; i++) { t.predict(tt, out); tt = (out.distanceTo(this.origin) - 0.6) / (this.speed * 0.98); }
        return out;
      }
      if (!t.vel || t.vel.lengthSq() < 1e-6) return out;
      let tt = out.distanceTo(this.origin) / this.speed;
      for (let i = 0; i < 3; i++) { out.copy(t.pos).addScaledVector(t.vel, tt); if (t.acc) out.addScaledVector(t.acc, 0.5 * tt * tt); tt = out.distanceTo(this.origin) / this.speed; }
      return out;
    }
  }

  /** Over-the-shoulder camera: smooth, damped, no shake; follows a fraction of the aim; zooms with the draw. */
  class CameraRig {
    constructor(camera) {
      this.cam = camera;
      this.pos = new T.Vector3(1.0, 1.8, 2.4); this.look = new T.Vector3(0, 1.5, -10);
      this.yaw = new U.Spring(0, 5); this.pitch = new U.Spring(0, 5); this.zoom = new U.Spring(0, 4);
      this.mode = 'play'; this.orbit = 0; this.blend = new U.Spring(1, 2.2);
      this.stance = { pos: new T.Vector3(), dir: new T.Vector3(0, 0, -1) };
      this._v = Array.from({ length: 6 }, () => new T.Vector3()); this._q = new T.Quaternion();
      this.fov = 42; this.frame0 = { side: 1.0, back: 2.45, height: 1.82, lookDist: 14, lookHeight: 1.35, fovK: 1, orbitArc: 0 }; this.frame = Object.assign({}, this.frame0);
      this.neutral = new T.PerspectiveCamera(50, 16 / 9, 0.05, 1600);
    }
    setStance(pos, dir) { this.stance.pos.copy(pos); this.stance.dir.copy(dir).setY(0).normalize(); this.updateNeutral(); }
    setFraming(f) { this.frame = Object.assign({}, this.frame0, f); this.updateNeutral(); }   // per mode, nothing leaks between modes
    /** the camera used to map screen input to aim (play framing, no follow) */
    updateNeutral() {
      const n = this.neutral; this.place(n, 0, 0, 0, 0);
      n.aspect = this.cam.aspect; n.updateProjectionMatrix(); n.updateMatrixWorld(true);
    }
    place(cam, yaw, pitch, zoom, orbitT) {
      const s = this.stance, f = this.frame, d = this._v[0].copy(s.dir);
      const chest = this._v[1].crossVectors(d, UP).normalize();
      const q = this._q.setFromAxisAngle(UP, yaw);
      const back = f.back * (1 - 0.18 * zoom), side = f.side * (1 - 0.12 * zoom);
      // position: behind the archer (away from the target) and to his chest side, at head height
      const off = this._v[2].copy(d).multiplyScalar(-back).addScaledVector(chest, side).applyQuaternion(q);
      const pos = this._v[3].copy(s.pos).add(off); pos.y = f.height - 0.06 * zoom;
      const lookDir = this._v[4].copy(d).applyQuaternion(q);
      const look = this._v[5].copy(s.pos).addScaledVector(lookDir, f.lookDist).addScaledVector(chest, side * 0.25); look.y = f.lookHeight + Math.tan(pitch) * f.lookDist;
      if (orbitT !== undefined && orbitT > 0) {
        // menu: slow cinematic orbit around the archer
        // orbitArc (optional, per mode): swing on the open front side instead of a full circle (e.g. under a shelter roof)
        const a = f.orbitArc ? Math.PI + f.orbitArc * Math.sin(this.orbit * 1.6) : this.orbit, rad = 4.2;
        const op = this._v[2].set(Math.sin(a) * rad, 1.65 + 0.15 * Math.sin(a * 0.7), Math.cos(a) * rad).add(s.pos);
        const ol = this._v[4].copy(s.pos).setY(1.2);
        pos.lerp(op, orbitT); look.lerp(ol, orbitT);
      }
      cam.position.copy(pos); cam.lookAt(look);
      return cam;
    }
    update(dt, aim, draw) {
      if (this.mode === 'menu') this.orbit += dt * 0.12;
      const follow = aim ? aim : { yaw: 0, pitch: 0 };
      this.yaw.update(follow.yaw * 0.45, dt); this.pitch.update(U.clamp(follow.pitch, -0.1, 0.8) * 0.32, dt);
      this.zoom.update(draw || 0, dt);
      this.blend.update(this.mode === 'menu' ? 1 : 0, dt);
      this.place(this.cam, this.yaw.x, this.pitch.x, this.zoom.x, this.blend.x);
      this.cam.fov = this.fov * (this.frame.fovK || 1) - 7 * this.zoom.x; this.cam.updateProjectionMatrix();
    }
    snap() { this.yaw.set(0); this.pitch.set(0); this.zoom.set(0); }
  }

  TS.Aim = { Aim, CameraRig };
})(typeof window !== 'undefined' ? window : globalThis);
