/* Procedural player animation on top of FB.Rig: foot-planted stepping locomotion (exact planting, turning/strafing/stopping),
 * kick / pass with a contact event (IK foot path through the ball), reactions (celebrate, dejected, jump). No assets, no clips:
 * every pose is solved from the player's world state, so feet never slide and contact timing is exact. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, Q = T.Quaternion, M = FB.math;
  const { clamp, lerp, smooth } = M;
  const _v = new V(), _w = new V(), _q = new Q(), _qa = new Q(), _hh = new V(), _gA = new V(), _gB = new V(), _gC = new V(), _gD = new V();
  const UP = new V(0, 1, 0);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const BALL = 0.135, TOE_OUT = 0.07;
  const KICK_C = { back: 0.22, up: 0.1, pitch: 1.0 };
  const ARM_T = { walkAmp: 0.3, runAmp: 0.7, sprintAmp: 0.25, walkBias: -0.12, runBias: -0.45, walkElbow: 0.15, runElbow: 1.6, walkElbowSw: 0.15, runElbowSw: 0.15, walkAbd: 0.17, runAbd: 0.3, runRot: -0.15, walkCurl: 0.42 };   // arm swing (rad), tuned to human hand paths
  /** piecewise-linear lookup [[x,y],...] */
  const tbl = (t, x) => { if (x <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return t[t.length - 1][1]; };
  // human gait reference (speed m/s -> value). Cadence in steps/s, stance time in s, swing ankle lift in m.
  const FWD_CAD = [[0, 1.6], [1.4, 1.85], [2.1, 2.15], [3, 2.6], [5, 2.85], [7.5, 3.4]];
  const FWD_ST = [[0, 0.7], [1.4, 0.64], [2.1, 0.45], [3, 0.26], [5, 0.175], [7.5, 0.1]];
  const FWD_LIFT = [[0, 0.05], [1.4, 0.07], [2.1, 0.12], [3, 0.2], [5, 0.3], [7.5, 0.4]];
  const SIDE_CAD = [[0, 2.4], [1, 3.0], [2.4, 4.0]], SIDE_ST = [[0, 0.3], [1, 0.22], [2.4, 0.15]];
  const BACK_CAD = [[0, 2.2], [1.2, 2.8], [3, 3.4]], BACK_ST = [[0, 0.35], [1.2, 0.26], [3, 0.18]];

  class Player {
    constructor(actor, o = {}) {
      this.actor = actor; this.root = actor.root; this.rig = new FB.Rig(actor); this.o = o;
      const r = this.rig; this.homeX = o.homeX || 0.13; this.L = r.legLength;
      this.pos = new V(); this.yaw = 0; this.vel = new V(); this.want = { vx: 0, vz: 0, yaw: null };
      this.maxSpeed = o.maxSpeed || 6.2; this.accel = o.accel || 7; this.turn = o.turn || 7; this.turnInPlace = o.turnInPlace || 5;
      this.sideMax = o.sideMax || 2.1; this.backMax = o.backMax || 2.5; this.heading = 0; this.gaitDir = 'fwd'; this.gait = 'idle'; this.phase = 0; this.cycleOn = false;
      this.t = Math.random() * 10; this.mode = 'loco'; this.modeT = 0; this.rand = M.rng(o.seed || 7);
      this.feet = [this._foot('L'), this._foot('R')]; this.lastStep = 1;
      this.hipY = r.hipsRest.y; this.air = 0; this.rootY = 0;
      this.snap = actor.boneList.map(() => new Q()); this.snapPos = new V(); this.blendT = 1; this.blendDur = 0.15;
      this.k = null; this.fx = null; this.armPose = { L: new V(), R: new V() };
      this.lookTarget = null; this.lookK = 0; this.ballRef = null;
      this.speed = 0; this.stepCount = 0; this.events = [];
      this.teleport(0, 0, 0);
    }
    _foot(S) { return { S, p: new V(), from: new V(), to: new V(), yaw: 0, swing: false, u: 0, dur: 0.25, y: this.rig.ankleHeight, pitch: 0, lift: 0.1, fromY: this.rig.ankleHeight, fromPitch: 0, kick: 0 }; }
    homeWorld(i, out) { const x = (i === 0 ? 1 : -1) * this.homeX, c = Math.cos(this.yaw), s = Math.sin(this.yaw); return out.set(this.pos.x + x * c, 0, this.pos.z - x * s); }
    teleport(x, z, yaw) {
      this.pos.set(x, 0, z); this.yaw = yaw; this.vel.set(0, 0, 0); this.mode = 'loco'; this.k = null; this.fx = null; this.modeT = 0; this.rootY = 0;
      for (let i = 0; i < 2; i++) { const f = this.feet[i]; this.homeWorld(i, f.p); f.yaw = yaw; f.swing = false; f.u = 0; f.y = this.rig.ankleHeight; f.pitch = 0; f.ax = f.p.x; f.az = f.p.z; f.ay = f.y; }
      this.heading = yaw; this.cycleOn = false; this.gaitDir = 'fwd'; this.speed = 0; this.leanSm = 0; this.accelSm = 0;
      this.hipY = this.rig.hipsRest.y; this.blendT = 1; this.root.position.set(x, 0, z); this.root.quaternion.setFromAxisAngle(UP, yaw); this.root.updateMatrixWorld(true);
    }
    setIntent(vx, vz, yaw) { this.want.vx = vx; this.want.vz = vz; this.want.yaw = yaw === undefined ? null : yaw; }
    setMode(mode, blend = 0.15) {
      const bl = this.actor.boneList; for (let i = 0; i < bl.length; i++) this.snap[i].copy(bl[i].quaternion);
      this.snapPos.copy(this.actor.bones.hips.position); this.blendT = 0; this.blendDur = blend; this.mode = mode; this.modeT = 0;
    }
    _blend(dt) {
      if (this.blendT >= 1) return; this.blendT = Math.min(1, this.blendT + dt / Math.max(1e-3, this.blendDur));
      const w = smooth(this.blendT), bl = this.actor.boneList;
      for (let i = 0; i < bl.length; i++) { _q.copy(this.snap[i]); bl[i].quaternion.copy(_q.slerp(bl[i].quaternion, w)); }
      const h = this.actor.bones.hips; h.position.lerpVectors(this.snapPos, h.position, w);
    }
    drainEvents() { const e = this.events; this.events = []; return e; }

    /* ---------- root motion ----------
     * One coherent strategy: gameplay owns the root (pos/vel/yaw are integrated here from the intent); the legs never add displacement,
     * they only plant feet in world space under that root. Facing policy:
     *  - no facing request  -> the body faces the travel direction ("forward" gait) and the heading turns with a speed-dependent radius;
     *  - facing request     -> forward gait while travel is within ~50° of it, lateral shuffle up to ~125°, backpedal beyond;
     *  - shuffle/backpedal are only used up to their natural top speeds; a faster request turns the body and runs forward instead,
     *    so nobody sprints backwards or sideways. */
    _integrate(dt) {
      const w = this.want, req = Math.hypot(w.vx, w.vz), maxS = this.maxSpeed;
      const sd = Math.min(req, maxS), dirW = req > 1e-4 ? Math.atan2(w.vx, w.vz) : (this.speed > 0.05 ? Math.atan2(this.vel.x, this.vel.z) : this.yaw);
      let face = w.yaw;
      // gait selection (with hysteresis) from the angle between requested facing and requested travel
      let g = 'fwd';
      if (face !== null && sd > 0.25) {
        const a = Math.abs(wrap(face - dirW)), prev = this.gaitDir || 'fwd', hy = 0.12;
        g = a < (prev === 'fwd' ? 0.9 + hy : 0.9 - hy) ? 'fwd' : a < (prev === 'back' ? 2.2 - hy : 2.2 + hy) ? 'side' : 'back';
        const cap = g === 'side' ? this.sideMax : g === 'back' ? this.backMax : Infinity;
        if (sd > cap + (this.gaitDir === g ? 0.25 : 0)) { g = 'fwd'; face = null; }   // too fast to shuffle/backpedal: turn and run
      } else if (face !== null && sd <= 0.25) g = this.gaitDir === 'fwd' || !this.gaitDir ? 'fwd' : this.gaitDir;
      this.gaitDir = g; this.faceReq = face;
      const acc = this.accel * (this.boost || 1), dec = this.accel * 1.25;
      if (g === 'fwd') {
        // heading follows the requested direction with a speed-dependent turn rate; sharp turns bleed speed first (plant and turn)
        let s = this.speed, h = this.heading;
        if (s < 0.35 || h === undefined) h = dirW;
        const e = wrap(dirW - h), rate = Math.min(this.turn * 0.75, 9.5 / Math.max(0.7, s));
        h += clamp(e, -rate * dt, rate * dt);
        let st = sd; if (Math.abs(e) > 0.55 && s > 1.2) st = Math.min(sd, Math.max(1.0, sd * Math.max(0, Math.cos(e)) * 1.1));
        s += clamp(st - s, -dec * dt, acc * dt);
        this.heading = h; this.vel.set(Math.sin(h) * s, 0, Math.cos(h) * s);
      } else {
        const cap = g === 'side' ? this.sideMax : this.backMax, k = Math.min(sd, cap) / Math.max(req, 1e-6);
        const tx = w.vx * k, tz = w.vz * k; let dx = tx - this.vel.x, dz = tz - this.vel.z; const dl = Math.hypot(dx, dz), mx = acc * 0.9 * dt;
        if (dl > mx) { dx *= mx / dl; dz *= mx / dl; } this.vel.x += dx; this.vel.z += dz; this.heading = Math.atan2(this.vel.x, this.vel.z);
      }
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const prevSp = this.speed; this.speed = Math.hypot(this.vel.x, this.vel.z); this.accelSm = M.damp(this.accelSm || 0, (this.speed - prevSp) / Math.max(dt, 1e-4), 6, dt);
      // body yaw: forward gait faces the heading (or the requested facing when strafing within 50°); other gaits face the request
      let want = face !== null ? face : (this.speed > 0.35 ? this.heading : this.yaw);
      if (g === 'fwd' && face === null && this.speed > 0.35) want = this.heading;
      const d = wrap(want - this.yaw), rate = (this.speed < 0.5 ? this.turnInPlace : this.turn) * (g === 'fwd' ? 1 : 0.8);
      const yawRate = clamp(d, -rate * dt, rate * dt); this.yaw += yawRate; this.yawRate = yawRate / Math.max(dt, 1e-4);
    }
    _applyRoot() { this.root.position.set(this.pos.x, this.rootY, this.pos.z); this.root.quaternion.setFromAxisAngle(UP, this.yaw); this.root.updateMatrixWorld(true); }
    _local(wp, out) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw), dx = wp.x - this.pos.x, dz = wp.z - this.pos.z; return out.set(dx * c - dz * s, wp.y, dx * s + dz * c); }

    /** hips height (bone-local y) so that every grounded foot stays within the leg's reach */
    _hipHeight(grounded, off) {
      const r = this.rig, Lr = this.L * 0.985; let best = r.hipsRest.y + 0.0;
      for (const f of grounded) {
        this._local(_hh.set(f.ax === undefined ? f.p.x : f.ax, 0, f.az === undefined ? f.p.z : f.az), _v); // own scratch: callers keep targets in _w
        const fy = f.ay === undefined ? f.y : f.ay;
        const tx = (f.S === 'L' ? 1 : -1) * 0.109 + off.x, dx = _v.x - tx, dz = _v.z - (-0.004 + off.z);
        const h = fy + Math.sqrt(Math.max(0.05, Lr * Lr - dx * dx - dz * dz));
        best = Math.min(best, h);
      }
      return best;
    }

    update(dt) {
      this.t += dt; this.modeT += dt;
      if (this.mode !== 'loco') for (const f of this.feet) f.ax = f.ay = f.az = undefined; // pivot data belongs to locomotion only
      switch (this.mode) {
        case 'kick': if (this.k && this.k.trap) this._trap(dt); else this._kick(dt); break;
        case 'pose': this._pose(dt); break;
        default: this._loco(dt);
      }
      this._blend(dt);
      this.actor.root.updateMatrixWorld(true);
    }

    /* ================= locomotion =================
     * Phase-driven gait. One stride cycle = two steps; each foot alternates stance (planted, fixed in world space) and swing.
     * Cadence, stance time and swing height follow measured human gait (walk ~1.85 steps/s at 1.4 m/s, run ~2.9 steps/s at 5 m/s,
     * stance 0.2 s and a flight phase when running). Feet land ahead of the pelvis and push off behind it, so the body visibly
     * travels forward over the planted foot. Lateral shuffles never cross the feet; backpedals take short quick steps. */
    _gaitParams(sp, g) {
      if (g === 'side') { const c = tbl(SIDE_CAD, sp); return { cad: c, stance: tbl(SIDE_ST, sp), lift: 0.05 + 0.02 * clamp(sp / 2), width: 0.2, land: 0, kick: 0 }; }
      if (g === 'back') { const c = tbl(BACK_CAD, sp); return { cad: c, stance: tbl(BACK_ST, sp), lift: 0.07 + 0.03 * clamp(sp / 2.5), width: 0.12, land: -0.22, kick: 0 }; }
      return { cad: tbl(FWD_CAD, sp), stance: tbl(FWD_ST, sp), lift: tbl(FWD_LIFT, sp), width: lerp(0.105, 0.07, clamp((sp - 1.5) / 4)), land: 0, kick: clamp((sp - 2.2) / 3.5) };
    }
    /** world ankle position where foot i should land if it touches down `rem` seconds from now */
    _landing(i, rem, gp, out) {
      const sp = this.speed, f = this.feet[i], side = i === 0 ? 1 : -1;
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      let hx = 0, hz = 0; if (sp > 0.05) { hx = this.vel.x / sp; hz = this.vel.z / sp; }
      const travel = sp * gp.stance;                                     // ground distance the body covers while this foot is planted
      const ahead = this.gaitDir === 'fwd' ? Math.min(0.36, 0.45 * travel) : travel * 0.5; // forward gait lands ~0.3 m ahead and pushes off behind
      const w = gp.width;
      out.set(this.pos.x + this.vel.x * rem + hx * ahead + side * w * c, 0, this.pos.z + this.vel.z * rem + hz * ahead - side * w * s);
      return out;
    }
    _loco(dt) {
      this._integrate(dt); this._applyRoot();
      const r = this.rig, sp = this.speed, F = this.feet, g = this.gaitDir || 'fwd', gp = this._gaitParams(sp, g);
      this.gait = sp < 0.3 && !F[0].swing && !F[1].swing ? 'idle' : g === 'fwd' ? (sp < 2.1 ? 'walk' : sp < 3.6 ? 'jog' : sp < 5.6 ? 'run' : 'sprint') : g === 'side' ? 'shuffle' : 'backpedal';
      const moving = sp > 0.3 || this.cycleOn;
      // ---- phase-driven stepping while moving
      if (moving) {
        const fC = gp.cad / 2, cycle = 1 / fC, duty = clamp(gp.stance / cycle, 0.2, 0.68);
        if (!this.cycleOn) {                                            // start: the foot that is further behind (relative to travel) lifts first
          const hx = sp > 0.05 ? this.vel.x / sp : Math.sin(this.yaw), hz = sp > 0.05 ? this.vel.z / sp : Math.cos(this.yaw);
          const behind = i => (F[i].p.x - this.pos.x) * hx + (F[i].p.z - this.pos.z) * hz;
          const first = behind(0) < behind(1) ? 0 : 1; this.cycleOn = true;
          this.phase = ((first === 0 ? duty : duty - 0.5) + 1) % 1;       // phase of the left foot; right = phase + 0.5
        }
        const prevPh = this.phase; this.phase = (this.phase + fC * dt) % 1;
        for (let i = 0; i < 2; i++) {
          const f = F[i], ph = (this.phase + (i === 0 ? 0 : 0.5)) % 1, ph0 = (prevPh + (i === 0 ? 0 : 0.5)) % 1, wrapped = ph < ph0;
          if (f.swing) {
            if (wrapped || ph < f.liftPh) { this._touchdown(f, i); continue; }       // the cycle came round: touch down
            const u = clamp((ph - f.liftPh) / Math.max(0.05, 1 - f.liftPh)); f.u = u; f.dur = (1 - f.liftPh) * cycle; this._landing(i, (1 - u) * f.dur, gp, f.to);
            if (u >= 0.999) this._touchdown(f, i);
          } else {
            const other = F[1 - i];
            const due = ph >= duty && !wrapped;                                       // normal lift-off at the end of stance
            const forced = (!other.swing || (sp > 1.0 && other.u > 0.6)) && ph > duty * 0.45 && this._overReach(f); // overstretched / over-twisted / crossed planted leg: step now
            const flight = sp > (g === 'fwd' ? 2.2 : 1.0);                             // running gaits (and quick shuffles) have a flight phase
            if ((due && (!other.swing || flight)) || forced) this._liftoff(f, i, ph, gp);
          }
        }
        const homeOK = i => { this.homeWorld(i, _w); return Math.hypot(_w.x - F[i].p.x, _w.z - F[i].p.z) < 0.2; };
        if (sp < 0.3 && !F[0].swing && !F[1].swing && homeOK(0) && homeOK(1)) { this.cycleOn = false; }
      } else if (this.cycleOn) { this.cycleOn = false; }
      // ---- standing: corrective steps keep the feet under the body (turning in place, small shuffles)
      if (!this.cycleOn) {
        const sw = F.find(f => f.swing);
        if (sw) { sw.u = Math.min(1, sw.u + dt / sw.dur); if (sw.u >= 1) this._touchdown(sw, F.indexOf(sw)); else this.homeWorld(F.indexOf(sw), sw.to); }
        else {
          let pick = -1, worst = 0;
          for (let i = 0; i < 2; i++) { this.homeWorld(i, _w); const e = Math.hypot(_w.x - F[i].p.x, _w.z - F[i].p.z) + 0.25 * Math.abs(wrap(this.yaw - F[i].yaw)); if (e > worst) { worst = e; pick = i; } }
          if (worst > 0.14) { const f = F[pick]; f.swing = true; f.u = 0; f.from.set(f.p.x, 0, f.p.z); f.fromY = f.y; f.fromPitch = f.pitch; f.dur = 0.28; f.lift = 0.06; f.kick = 0; this.homeWorld(pick, f.to); }
        }
      }
      // ---- foot poses (planted feet roll over the ball of the foot before push-off; swing feet follow a human ankle path)
      const grounded = [];
      for (let i = 0; i < 2; i++) {
        const f = F[i];
        if (f.swing) {
          const u = f.u, e = u * u * (3 - 2 * u), hz = lerp(u, e, 0.75);    // horizontal: slow start (toe-off), fast mid swing, slow landing
          f.p.x = f.from.x + (f.to.x - f.from.x) * hz; f.p.z = f.from.z + (f.to.z - f.from.z) * hz;
          const peakU = 0.38 - 0.1 * f.kick, bump = u < peakU ? Math.sin(0.5 * Math.PI * u / peakU) : Math.cos(0.5 * Math.PI * (u - peakU) / (1 - peakU));
          const base = lerp(f.fromY, r.ankleHeight, smooth(u * 1.6));
          f.y = base + f.lift * Math.pow(Math.max(0, bump), 1.15);
          // toes point down after push-off, level out, then lift slightly for a heel-first (walk) or flat (run) landing
          const land = g === 'fwd' ? lerp(-0.22, -0.05, f.kick) : -0.05;
          f.pitch = u < 0.45 ? lerp(f.fromPitch, 0.25 + 0.35 * f.kick, smooth(u / 0.45)) : lerp(0.25 + 0.35 * f.kick, land, smooth((u - 0.45) / 0.55));
          f.yaw += wrap(this.yaw - f.yaw) * Math.min(1, dt * 10);
          f.ax = f.p.x; f.az = f.p.z; f.ay = f.y;
        } else {
          // heel lift: once the foot is behind the hips, it pivots about the ball of the foot (ball stays fixed: no sliding toes)
          this._local(f.p, _v); const behind = -_v.z, g2 = g === 'fwd' ? 1 : g === 'back' ? 0.25 : 0.4;
          const roll = sp > 0.3 ? clamp((behind - 0.08) / 0.45) * (0.35 + 0.4 * clamp(sp / 5)) * g2 : 0;
          f.pitch = M.damp(f.pitch, roll, 25, dt);
          const fy = f.yaw, bx = Math.sin(fy) * BALL, bz = Math.cos(fy) * BALL;  // ankle -> ball of foot, horizontal
          f.ax = f.p.x + bx - bx * Math.cos(f.pitch); f.az = f.p.z + bz - bz * Math.cos(f.pitch); f.ay = r.ankleHeight + BALL * Math.sin(f.pitch);
          f.y = r.ankleHeight;
          grounded.push(f);
        }
      }
      // ---- pelvis: height from gait (walk vaults over the stance leg, run sinks into it) limited by the planted legs' reach
      const off = this._locoOff || (this._locoOff = new V());
      const lz = i => { this._local(_w.set(F[i].ax, 0, F[i].az), _v); return _v.z; };
      const zL = lz(0), zR = lz(1), plantedSide = grounded.length === 1 ? (grounded[0].S === 'L' ? 1 : -1) : 0;
      off.x = M.damp(off.x, plantedSide * (g === 'side' ? 0.0 : 0.025) * clamp(sp / 2 + 0.3), 9, dt); off.z = 0;
      const crouch = (this.crouch || 0), run = clamp((sp - 2) / 3);
      let target = r.hipsRest.y - 0.012 - lerp(0.015, 0.055, run) * clamp(sp / 1.5) - (g === 'side' ? 0.07 : g === 'back' ? 0.04 : 0) * clamp(sp / 1.2) - 0.17 * crouch;
      if (this.cycleOn) {
        const ph = this.phase, st = gp.stance * gp.cad / 2;                   // stance fraction of the cycle
        const mid = (p0) => { const u = ((ph - p0 + 1) % 1); return u < st ? Math.sin(Math.PI * u / st) : 0; };
        const sup = Math.max(mid(0), mid(0.5));                               // 1 at mid-stance of either foot
        target += run > 0.3 ? -0.035 * sup * run + 0.02 * (1 - sup) * run : 0.012 * sup * (1 - run);
      }
      const reach = grounded.length ? this._hipHeight(grounded, off) : r.hipsRest.y;
      if (!grounded.length) { this.air += dt; } else this.air = 0;
      const hy = Math.max(Math.min(target, reach), target - 0.06);       // never squat to chase a far foot: that foot steps instead
      this.hipY = M.damp(this.hipY, hy, grounded.length ? 18 : 8, dt);
      if (grounded.length) this.hipY = Math.min(this.hipY, reach);     // reach is a hard limit (no stretched leg at heel strike)
      // ---- upper body: lean with speed and acceleration, into turns; restrained hip/shoulder counter-rotation; stable head
      const acc = clamp((this.accelSm || 0) / 6, -1, 1), latA = clamp(sp * (this.yawRate || 0) / 9, -1, 1);
      const leanT = (g === 'fwd' ? lerp(0.03, 0.17, clamp(sp / 6.5)) + 0.16 * Math.max(0, acc) - 0.08 * Math.max(0, -acc) : g === 'back' ? 0.1 : 0.12) + 0.22 * crouch;
      this.leanSm = M.damp(this.leanSm || 0, leanT, 6, dt); const lean = this.leanSm;
      const sw = g === 'fwd' ? clamp(sp / 4) : 0.25 * clamp(sp / 2);
      const pyaw = clamp((zR - zL) * 0.26, -0.13, 0.13) * sw, roll = -latA * 0.07 - plantedSide * 0.025 * clamp(sp / 3);
      const breath = Math.sin(this.t * 1.9) * 0.008, idle = clamp(1 - sp / 1.0);
      r.hips({ x: off.x, y: this.hipY - r.hipsRest.y, z: 0.012 * lean }, pyaw, lean * 0.55, roll);
      r.spine(lean * 0.45 + breath, roll * -0.6 + 0.012 * Math.sin(this.t * 0.6) * idle, -pyaw * 1.7);
      this._head(dt, 0.25, lean);
      for (let i = 0; i < 2; i++) this._planted(F[i], F[i].S, i);
      // ---- arms (V22.1): pendulum swing in the sagittal plane, opposite to the legs, passing the hips in both directions.
      // Human reference: walking ~+20°/-15° shoulder with a nearly straight elbow (hands swing past the thighs, not in front of the shorts);
      // running ~+35°/-40° with the elbow near 90° (hands from chest height in front to behind the hip); sprinting larger. The swing amplitude
      // follows the actual step length, so the arms move as much as the legs do. No inward humeral twist (that folded the forearm across the body).
      const AT = FB.ARM_T || ARM_T, cad = tbl(FWD_CAD, Math.max(sp, 0.5)), stepLen = Math.max(0.25, sp / cad);
      const swingL = g === 'fwd' ? clamp((zR - zL) / (stepLen * 0.68), -1, 1) : clamp((zR - zL) / 0.35, -1, 1), swingR = -swingL;   // left arm forward when the right leg is forward
      const mv = clamp(sp / 1.2), spr = clamp((sp - 5.5) / 2);
      const amp = g === 'fwd' ? lerp(AT.walkAmp, AT.runAmp, run) + AT.sprintAmp * spr : g === 'back' ? 0.25 : 0.1;
      const bias = g === 'fwd' ? lerp(AT.walkBias, AT.runBias, run) : 0.05;
      const elb0 = lerp(AT.walkElbow, AT.runElbow, clamp((sp - 1.6) / 2.2)), elbSw = lerp(AT.walkElbowSw, AT.runElbowSw, run);
      const abd = lerp(AT.walkAbd, AT.runAbd, run), rot = AT.runRot * run, ar = this.armsReady || 0, rd = this.o.readyArm || { flex: 0.95, abd: 0.5, elbow: 1.2 };
      const arm = (S, sw, ph) => { const sh = (bias + sw * amp) * mv + 0.03 * Math.sin(this.t * 1.2 + ph) * idle, el = elb0 * Math.max(mv, 0.35) + elbSw * Math.max(0, sw) * mv;
        r.armFK(S, lerp(sh, rd.flex + 0.06 * Math.sin(this.t * 2.1 + ph), ar), lerp(abd, rd.abd, ar), lerp(el, rd.elbow, ar), lerp(rot, 0, ar)); };
      arm('L', swingL, 0); arm('R', swingR, 1);
      const curl = lerp(AT.walkCurl, 0.55, run); r.hand('L', lerp(curl, 0.15, ar), 0.05, 0.45).hand('R', lerp(curl, 0.15, ar), 0.05, 0.45); r.clavicle('L', 0, 0).clavicle('R', 0, 0);
    }
    _liftoff(f, i, ph, gp) {
      f.swing = true; f.u = 0; f.liftPh = ph; f.from.set(f.p.x, 0, f.p.z); f.fromY = f.ay === undefined ? f.y : f.ay; f.fromPitch = f.pitch; f.lift = gp.lift; f.kick = gp.kick;
    }
    /** a planted foot must step when the leg can no longer reach it comfortably or the body has turned too far over it */
    _overReach(f) {
      const hip = this.rig.joint('thigh' + f.S, _v), ax = f.ax === undefined ? f.p.x : f.ax, az = f.az === undefined ? f.p.z : f.az, ay = f.ay === undefined ? f.y : f.ay;
      const d = Math.hypot(hip.x - ax, hip.y - ay, hip.z - az), twist = Math.abs(wrap(this.yaw - f.yaw));
      const lx = this._local(_w.set(ax, 0, az), _v).x * (f.S === 'L' ? 1 : -1);    // lateral position on its own side (+) or crossed (-)
      return d > this.L * 0.975 || twist > 0.8 || lx < -0.02;
    }
    _touchdown(f, i) {
      f.swing = false; f.u = 1; f.p.set(f.to.x, 0, f.to.z); f.y = this.rig.ankleHeight; f.pitch = 0; f.yaw = this.yaw + (i === 0 ? 1 : -1) * TOE_OUT;
      f.ax = f.p.x; f.az = f.p.z; f.ay = f.y;
      this.events.push({ type: 'step', side: f.S, speed: this.speed }); this.stepCount++; this.lastStep = i;
    }
    _planted(f, S, i) {
      const wp = _w.set(f.ax === undefined ? f.p.x : f.ax, f.ay === undefined ? f.y : f.ay, f.az === undefined ? f.p.z : f.az);
      if (f.swing) { // a swinging foot that would leave the leg's reach rises instead (the heel kicks up behind, as in a real recovery)
        const hip = this.rig.joint('thigh' + S, _v), dx = wp.x - hip.x, dz = wp.z - hip.z, h2 = dx * dx + dz * dz, R = this.L * 0.965;
        if (h2 + (hip.y - wp.y) ** 2 > R * R) { if (h2 < R * R) wp.y = Math.max(wp.y, hip.y - Math.sqrt(R * R - h2)); else { const k = R * 0.98 / Math.sqrt(h2); wp.x = hip.x + dx * k; wp.z = hip.z + dz * k; wp.y = hip.y - R * 0.2; } }
      }
      (f.ik || (f.ik = new V())).copy(wp);
      this.rig.leg(S, wp, { footYaw: wrap(f.yaw - this.yaw) + this.yawOffsetLegs(), footPitch: f.pitch, toes: f.swing ? 0.15 : -Math.max(0, f.pitch) * 0.9, knee: 0.1 });
    }
    yawOffsetLegs() { return 0; }
    _head(dt, k, lean = 0) {
      if (this.lookTarget) { this.rig.lookAt(this.lookTarget, 1.05, 0.6, k); }
      else this.rig.look(0.05 * Math.sin(this.t * 0.37) * clamp(1 - this.speed / 2), -lean * 0.55 + 0.04 + 0.02 * Math.sin(this.t * 0.5), 0); // keep the gaze level
    }

    /* ================= kicking ================= */
    /** Ideal root position for a kick of the ball at ballPos towards direction dir (unit, horizontal) with the given foot. */
    kickAnchor(ballPos, dir, foot = 'R', out = new V()) {
      const side = foot === 'R' ? -1 : 1;                       // kicking side lateral sign in the player's frame (L = +x)
      const lx = -dir.z * -1, lz = dir.x * -1;                  // left vector of dir: (dir.z, -dir.x) for +Z facing -> (+x)
      const left = _w.set(dir.z, 0, -dir.x);
      return out.set(ballPos.x - dir.x * 0.02 + left.x * (-side) * -0.0 + left.x * side * 0.12 - left.x * side * 0.0, 0, ballPos.z - dir.z * 0.02 + left.z * side * 0.12);
    }
    /** spec: {foot:'L'|'R', ball:V3, dir:V3 (unit, xz), power:0..1, loft:0..1, type:'shot'|'pass', curve:-1..1, onContact:fn} */
    startKick(spec) {
      const dir = _v.copy(spec.dir); dir.y = 0; dir.normalize();
      const foot = spec.foot || 'R', pw = clamp(spec.power === undefined ? 0.7 : spec.power), loft = clamp(spec.loft || 0), pass = spec.type === 'pass';
      const side = foot === 'R' ? -1 : 1, left = new V(dir.z, 0, -dir.x);
      const k = this.k = { foot, side, dir: dir.clone(), left, ball: spec.ball.clone(), pw, loft, pass, curve: spec.curve || 0, t: 0, fired: false, onContact: spec.onContact || null,
        tA: pass ? 0.2 : 0.26, tSw: (pass ? 0.11 : 0.14) - 0.045 * pw, tF: pass ? 0.26 : 0.36, plant: new V(), anchor: new V(), startPos: this.pos.clone(), startYaw: this.yaw, carry: this.vel.clone().multiplyScalar(0.85),
        B: new V(), C: new V(), F: new V(), vC: new V(), pitchC: 0.75 - 0.5 * loft, support: foot === 'R' ? 0 : 1, kickIdx: foot === 'R' ? 1 : 0, yawAim: Math.atan2(dir.x, dir.z) };
      const supSide = -side;                                                        // lateral sign of the support foot
      k.plant.copy(k.ball).addScaledVector(left, supSide * 0.24 * -1 * -1).addScaledVector(dir, -0.04 - 0.05 * pw * 0); k.plant.y = 0;
      k.plant.copy(k.ball).addScaledVector(left, -side * 0.23).addScaledVector(dir, -0.03); k.plant.y = 0;
      k.anchor.copy(k.plant).addScaledVector(left, side * 0.12);
      // contact point: ankle target
      // ankle at the contact frame: placed so the boot's instep just meets the back of the ball (measured: no boot/ball overlap before
      // contact, boot tip above the grass). V21 used 0.13 m from the ball centre, which put the boot ~14 cm inside the ball.
      const KC = FB.KICK_C || KICK_C; k.pitchC = KC.pitch - 0.5 * loft;
      k.C.copy(k.ball).addScaledVector(dir, -KC.back); k.C.y = k.ball.y + KC.up;
      k.C.y = Math.max(k.C.y, this.rig.ankleHeight + 0.02);
      k.B.copy(k.ball).addScaledVector(dir, -(0.5 + 0.22 * pw)).addScaledVector(left, side * 0.04); k.B.y = 0.26 + 0.24 * pw + 0.12 * loft;
      const fl = 0.55 + 0.25 * pw; k.F.copy(k.C).addScaledVector(dir, fl).addScaledVector(left, k.curve * 0.18 * -1); k.F.y = k.C.y + 0.2 + 0.32 * loft + 0.1 * pw;
      // contact velocity of the foot along the swing path (m/s), reported to the caller
      const s = 1, d = k.C.clone().sub(k.B); k.vC.copy(d).multiplyScalar(2.2 / k.tSw);
      this.setMode('kick', 0.12);
      this.lookTarget = k.ball;
      return k;
    }
    /** distance between the boot surface (capsule from the ankle to the boot tip) and the ball surface; < 0 = overlap */
    bootGap(S, ball, R = 0.11) {
      const r = this.rig, a = r.joint('foot' + S, _gA), toe = r.joint('toes' + S, _gB), tip = _gC.copy(toe).sub(a).normalize().multiplyScalar(0.06).add(toe);
      const ab = tip.sub(a), tt = clamp(_gD.copy(ball).sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()), 0, 1);
      return _gD.copy(a).addScaledVector(ab, tt).distanceTo(ball) - R - 0.045;
    }
    _fireContact(t) {
      const k = this.k; if (!k || k.fired) return; k.fired = true; k.tContact = t;
      const fv = new V().copy(k.vC), info = { foot: k.foot, footVel: fv, footSpeed: fv.length(), ball: k.ball.clone(), dir: k.dir.clone(), power: k.pw, loft: k.loft, curve: k.curve, time: t, gap: k.gap === undefined ? null : k.gap };
      this.events.push({ type: 'contact', info }); if (k.onContact) k.onContact(info);
    }
    cancelKick() { this.k = null; this.lookTarget = null; this.setMode('loco', 0.2); }
    _kick(dt) {
      const k = this.k, r = this.rig; if (!k) { this.setMode('loco', 0.1); return; }
      k.t += dt; const t = k.t, tC = k.tA + k.tSw, tEnd = tC + k.tF + 0.12;
      // root: glide to the anchor during the approach, then carry momentum
      const a = smooth(t / (k.tA * 0.9));
      const tx = lerp(k.startPos.x, k.anchor.x, a), tz = lerp(k.startPos.z, k.anchor.z, a);
      const carry = 1 - smooth((t - 0.05) / 0.5);
      this.pos.x = tx + k.carry.x * Math.max(0, t - k.tA * 0.9) * carry * 0.5; this.pos.z = tz + k.carry.z * Math.max(0, t - k.tA * 0.9) * carry * 0.5;
      let dy = k.yawAim - k.startYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw = k.startYaw + dy * smooth(t / (k.tA * 0.8));
      this.vel.copy(k.carry).multiplyScalar(carry); this.speed = this.vel.length();
      this._applyRoot();
      const S = k.foot, sup = S === 'R' ? 'L' : 'R', supF = this.feet[k.support], kickF = this.feet[k.kickIdx];
      // support foot plants early and stays planted; the other foot swings through the ball
      const pU = smooth(t / (k.tA * 0.75));
      const sFrom = k.supFrom || (k.supFrom = supF.p.clone()), sDist = Math.hypot(k.plant.x - sFrom.x, k.plant.z - sFrom.z);
      supF.swing = pU < 1 && sDist > 0.05; supF.p.lerpVectors(sFrom, k.plant, pU); supF.yaw = this.yaw; supF.y = this.rig.ankleHeight + Math.min(0.14, 0.04 + 0.08 * sDist) * Math.sin(Math.PI * Math.min(1, pU)) * (pU < 1 ? 1 : 0); // the plant is a real step onto the ground beside the ball
      supF.pitch = pU < 1 ? 0.2 * (1 - pU) : 0;
      // kicking foot ankle path
      const tmp = _w; let pitch = 0.1, toes = 0.1;
      if (t < k.tA) { const u = smooth(t / k.tA); const from = k.kickFrom || (k.kickFrom = kickF.p.clone().setY(kickF.y)); tmp.lerpVectors(from, k.B, u); tmp.y += Math.sin(Math.PI * Math.min(1, u)) * 0.04; pitch = lerp(kickF.pitch, 0.25, u); }
      else if (t < tC) { const s = (t - k.tA) / k.tSw, e = Math.pow(s, 2.2); tmp.lerpVectors(k.B, k.C, e); const arc = Math.sin(Math.PI * Math.min(1, e)) * 0.10; tmp.y += arc * (1 - e); pitch = lerp(0.25, k.pitchC, smooth(s)); }
      else { const u = t - tC, tau = 0.075; const dist = tau * (1 - Math.exp(-u / tau)); const vh = Math.hypot(k.vC.x, k.vC.z); tmp.copy(k.C).addScaledVector(k.dir, vh * dist); tmp.addScaledVector(k.left, k.curve * -0.2 * smooth(u / 0.3)); tmp.y += (0.2 + 0.32 * k.loft) * smooth(u / 0.3) + 0.1 * k.pw * smooth(u / 0.3); pitch = lerp(k.pitchC, 0.45, smooth(u / 0.3)); toes = 0.3; }
      if (!k.fired && t >= tC + 0.035) this._fireContact(t);          // fallback only: normally the boot's actual touch fires it (below)
      // body
      const off = this._kOff || (this._kOff = new V());
      const bw = smooth(t / k.tA), sw = t < tC ? smooth((t - k.tA * 0.6) / (tC - k.tA * 0.6)) : 1, fin = smooth((t - tC) / 0.35), rec = smooth((t - tEnd + 0.25) / 0.25);
      off.set(-k.side * 0.045 * bw, 0, 0.0);
      let hy = this._hipHeight([supF], off) - 0.035 * bw - 0.02 * sw * (1 + k.pw);
      this.hipY = hy; const yawBack = -k.side * -0.28 * bw * (1 - sw) , yawSwing = k.side * -0.32 * sw * (1 - fin * 0.2);
      const pelvisYaw = (-k.side * 0.2 * (bw - sw) * -1) * -1 + (-k.side) * 0.0;
      const pyaw = k.side * (-0.30 * bw * (1 - sw) + 0.32 * sw) * (1 - fin * 0.35) * -1;
      const roll = k.side * -0.06 * bw + k.side * 0.05 * sw;
      const flex = lerp(0.04, 0.12 + 0.12 * k.pw - 0.2 * k.loft, sw) - 0.14 * bw * (1 - sw) + 0.1 * fin;
      r.hips({ x: off.x, y: hy - r.hipsRest.y, z: 0.03 * sw }, pyaw, 0.06 * (k.pw) * sw - 0.05 * k.loft * sw, roll);
      r.spine(flex + 0.05, -k.side * 0.16 * sw * (1 + k.loft * 0.4), -pyaw * 0.9);
      const fb = clamp(1 - rec);
      if (t < tC + 0.12) this.rig.lookAt(_v.copy(k.ball).setY(0.11), 1.2, 0.8, 1); else r.look(0, 0.15 + 0.3 * smooth((t - tC - 0.12) / 0.25), 0);
      // legs
      this.rig.leg(sup, _v.set(supF.p.x, supF.y, supF.p.z), { footYaw: supF.yaw - this.yaw, footPitch: supF.pitch, knee: 0.1 });
      this.rig.leg(S, tmp, { footYaw: (k.curve * -0.15 * (t > k.tA ? 1 : 0)) * k.side, footPitch: pitch, toes, knee: 0.05 });
      // contact = the frame the boot really touches the ball (capsule ankle -> boot tip vs. ball sphere), so the ball never leaves early
      // and the boot never sinks into a ball that is still waiting for a scripted time
      if (!k.fired && t >= k.tA) { const g = this.bootGap(S, k.ball); k.gap = g; if (g <= 0.008) this._fireContact(t); }
      // arms: the arm opposite to the kicking leg swings forward-across, the other flares out for balance
      const aw = bw * (1 - 0.6 * fin);
      const opp = S === 'R' ? 'L' : 'R', same = S;
      r.armFK(opp, 0.25 + 0.5 * sw, 0.35 + 0.75 * bw, 0.45, 0).armFK(same, -0.15 * sw, 0.5 + 0.5 * bw * (1 - sw) + 0.25 * sw, 0.35, 0);
      r.hand('L', 0.2).hand('R', 0.2);
      // keep the 'kicking foot' record in sync so the following locomotion starts planted where the foot ended
      kickF.p.set(tmp.x, 0, tmp.z); kickF.y = tmp.y; kickF.pitch = pitch; kickF.yaw = this.yaw;
      if (t >= tEnd) this._endKick();
    }
    _endKick() {
      const k = this.k; this.k = null; this.lookTarget = null;
      // put both feet to ground positions beside the body so locomotion can resume with a normal step
      for (let i = 0; i < 2; i++) { const f = this.feet[i]; f.swing = false; f.yaw = this.yaw; f.pitch = 0; f.y = this.rig.ankleHeight; if (i === k.kickIdx) { this.homeWorld(i, _v); f.p.copy(_v); f.p.addScaledVector(k.dir, 0.08); } }
      this.events.push({ type: 'kickEnd' }); this.setMode('loco', 0.22);
    }
    /** body collision spheres in world space: [{x,y,z,r}] (used for ball-vs-player contact). set: 'body' | 'keeper' */
    colliderSpheres(set = 'body', out = this._cs || (this._cs = [])) {
      const r = this.rig, j = n => r.joint(n, _v), sc = this.root.scale.x || 1; let i = 0;
      const put = (x, y, z, rad) => { const o = out[i] || (out[i] = { x: 0, y: 0, z: 0, r: 0 }); o.x = x; o.y = y; o.z = z; o.r = rad * sc; i++; };
      const mid = (a, b, rad, k = 0.5) => { const A = j(a).clone(), B = j(b); put(A.x + (B.x - A.x) * k, A.y + (B.y - A.y) * k, A.z + (B.z - A.z) * k, rad); };
      mid('hips', 'spine2', 0.2, 0.2); mid('spine2', 'spine3', 0.2, 0.6); mid('spine3', 'neck', 0.17, 0.8); mid('neck', 'head', 0.13, 1.0);
      for (const S of ['L', 'R']) { mid('thigh' + S, 'shin' + S, 0.115); mid('shin' + S, 'foot' + S, 0.085); mid('upperarm' + S, 'lowerarm' + S, 0.075); mid('lowerarm' + S, 'hand' + S, 0.07); }
      if (set === 'keeper') for (const S of ['L', 'R']) { r.palm(S, _w); put(_w.x, _w.y, _w.z, 0.12); }
      out.length = i; return out;
    }
    kickBusy() { return this.mode === 'kick' && !!this.k; }


    /* ================= receiving (first touch) ================= */
    /** spec: {foot:'L'|'R', arrive:V3 (ball centre when it reaches the foot), inc:V3 (ball direction, unit xz), tArrive:s from now, onContact:fn} */
    startTrap(spec) {
      const inc = _v.copy(spec.inc); inc.y = 0; inc.normalize();
      const foot = spec.foot || 'R', side = foot === 'R' ? -1 : 1, left = new V(inc.z, 0, -inc.x);
      const t = this.k = { trap: true, foot, side, inc: inc.clone(), left, t: 0, fired: false, onContact: spec.onContact || null, tArr: Math.max(0.2, spec.tArrive), C: new V(), H: new V(), F: new V(),
        kickIdx: foot === 'R' ? 1 : 0, support: foot === 'R' ? 0 : 1, startYaw: this.yaw, from: null, ball: spec.arrive.clone() };
      t.C.copy(spec.arrive).addScaledVector(inc, 0.13 * 0.75); t.C.y = Math.max(this.rig.ankleHeight + 0.03, spec.arrive.y + 0.1);
      t.H.copy(t.C).addScaledVector(inc, -0.12).addScaledVector(left, side * 0.02); t.H.y = t.C.y + 0.2;
      t.F.copy(t.C).addScaledVector(inc, 0.16); t.F.y = this.rig.ankleHeight + 0.02;
      this.setMode('kick', 0.12); this.lookTarget = spec.arrive.clone();
      return t;
    }
    _trap(dt) {
      const k = this.k, r = this.rig; k.t += dt; const t = k.t, tArr = k.tArr, S = k.foot, sup = S === 'R' ? 'L' : 'R', supF = this.feet[k.support], kF = this.feet[k.kickIdx];
      this.vel.multiplyScalar(Math.exp(-6 * dt)); this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.speed = this.vel.length(); this._applyRoot();
      supF.swing = false; supF.y = r.ankleHeight; supF.pitch = 0;
      const from = k.from || (k.from = kF.p.clone().setY(kF.y)), tmp = _w;
      const t1 = Math.max(0.05, tArr - 0.14);
      if (t < t1) { tmp.lerpVectors(from, k.H, smooth(t / t1)); }
      else if (t < tArr) { tmp.lerpVectors(k.H, k.C, smooth((t - t1) / (tArr - t1))); }
      else { const u = clamp((t - tArr) / 0.3); tmp.lerpVectors(k.C, k.F, smooth(u)); }
      if (!k.fired && t >= tArr) { k.fired = true; const info = { foot: S, trap: true, ball: k.ball.clone(), inc: k.inc.clone(), time: t }; this.events.push({ type: 'trap', info }); if (k.onContact) k.onContact(info); }
      const off = this._kOff || (this._kOff = new V()); off.set(0, 0, 0);
      const dip = Math.sin(Math.PI * clamp(t / (tArr + 0.3))) * 0.025;
      this.hipY = this._hipHeight([supF], off) - 0.05 - dip;
      r.hips({ x: 0, y: this.hipY - r.hipsRest.y, z: 0.02 }, 0, 0.06, 0); r.spine(0.18 + dip * 3, 0, 0);
      r.lookAt(_v.copy(k.ball).setY(0.11), 1.2, 0.8, 1);
      r.leg(sup, _v.set(supF.p.x, supF.y, supF.p.z), { footYaw: supF.yaw - this.yaw, footPitch: 0, knee: 0.1 });
      r.leg(S, tmp, { footYaw: 0, footPitch: lerp(0.15, 0.05, clamp(t / tArr)), toes: 0, knee: 0.1 });
      const opp = S === 'R' ? 'L' : 'R'; r.armFK(opp, 0.2, 0.8, 0.5, 0).armFK(S, 0.1, 0.55, 0.4, 0); r.hand('L', 0.2).hand('R', 0.2);
      kF.p.set(tmp.x, 0, tmp.z); kF.y = tmp.y; kF.pitch = 0.05; kF.yaw = this.yaw;
      if (t >= tArr + 0.42) { this.k = null; this.lookTarget = null; for (const f of this.feet) { f.swing = false; f.y = r.ankleHeight; f.pitch = 0; f.yaw = this.yaw; } this.homeWorld(k.kickIdx, _v); kF.p.copy(_v); this.events.push({ type: 'trapEnd' }); this.setMode('loco', 0.2); }
    }

    /* ================= reactions ================= */
    /** kind: 'celebrate' | 'fist' | 'dejected' | 'hands-head' | 'jump' | 'cheer' | 'idle' */
    startPose(kind, o = {}) { this.fx = { kind, t: 0, dur: o.dur || 99, o }; this.setMode('pose', o.blend || 0.18); this.vel.set(0, 0, 0); this.speed = 0; }
    endPose() { this.fx = null; this.rootY = 0; this.setMode('loco', 0.25); }
    _pose(dt) {
      const f = this.fx; if (!f) { this.setMode('loco', 0.1); return; }
      f.t += dt; const t = f.t, r = this.rig, kind = f.kind;
      this._integrate(dt); this._applyRoot();
      const grounded = this.feet; for (const ft of grounded) { ft.swing = false; ft.y = r.ankleHeight; }
      const settle = clamp(f.t / 0.3);
      let off = this._pOff || (this._pOff = new V()); off.set(0, 0, 0);
      let hipsYaw = 0, hy = r.hipsRest.y, flex = 0.03, side = 0, twist = 0, headY = 0, headP = 0;
      // keep the feet where they are unless the pose wants a stance
      const stance = () => { for (let i = 0; i < 2; i++) { const ft = this.feet[i]; this.homeWorld(i, _v); ft.p.x += (_v.x - ft.p.x) * Math.min(1, dt * 6); ft.p.z += (_v.z - ft.p.z) * Math.min(1, dt * 6); ft.yaw = this.yaw; ft.pitch = 0; } };
      if (kind === 'celebrate' || kind === 'fist' || kind === 'cheer') {
        const bounce = Math.max(0, Math.sin(t * (kind === 'cheer' ? 9 : 7))), air = bounce * (kind === 'cheer' ? 0.1 : 0.18) * settle;
        this.rootY = air; stance(); hy = r.hipsRest.y - 0.06 * (1 - bounce) * settle; flex = -0.12 * settle; headP = -0.25;
        r.hips({ x: 0, y: hy - r.hipsRest.y, z: 0 }, 0.08 * Math.sin(t * 3.5), -0.04, 0.03 * Math.sin(t * 3.5)); r.spine(flex, 0.05 * Math.sin(t * 3.5), 0.1 * Math.sin(t * 3.5));
        r.look(0.2 * Math.sin(t * 2), headP, 0);
        for (const ft of this.feet) this.rig.leg(ft.S, _v.set(ft.p.x, ft.y + (air > 0.02 ? air * 0.35 : 0), ft.p.z), { footYaw: 0, footPitch: air > 0.02 ? 0.5 : 0, knee: 0.15 });
        if (kind === 'fist') { r.armFK('R', 2.7, 0.35, 1.9, 0).armFK('L', 0.4, 0.25, 0.5, 0); r.hand('R', 1, 0, 0.8).hand('L', 0.3); }
        else { const w = Math.sin(t * 7); r.armFK('L', 2.45 + 0.15 * w, 0.55, 0.35, 0).armFK('R', 2.45 - 0.15 * w, 0.55, 0.35, 0); r.hand('L', 0.1, 0, 0.1).hand('R', 0.1, 0, 0.1); }
      } else if (kind === 'dejected' || kind === 'hands-head') {
        stance(); const s = settle; hy = r.hipsRest.y - 0.05 * s;
        r.hips({ x: 0, y: hy - r.hipsRest.y, z: 0 }, 0, 0.05 * s, 0); r.spine(0.28 * s + 0.01 * Math.sin(t * 1.6), 0, 0); r.look(0.15 * Math.sin(t * 0.7) * s, 0.5 * s, 0);
        for (const ft of this.feet) this.rig.leg(ft.S, _v.set(ft.p.x, ft.y, ft.p.z), { footYaw: 0, footPitch: 0, knee: 0.1 });
        if (kind === 'hands-head') { const hp = r.joint('head', _w).clone(); for (const S of ['L', 'R']) { const sg = S === 'L' ? 1 : -1; const tg = hp.clone().add(_v.set(sg * 0.17, 0.02, 0.02).applyQuaternion(this.root.quaternion)); const sh = r.joint('upperarm' + S, new V()); r.arm(S, sh.lerp(tg, s), { pole: _v.set(sg * 0.8, 0.0, -0.5).applyQuaternion(this.root.quaternion) }); } r.hand('L', 0.8, 0, 0.5).hand('R', 0.8, 0, 0.5); }
        else { r.armFK('L', 0.12 * s, 0.14, 0.2, 0).armFK('R', 0.12 * s, 0.14, 0.2, 0); r.hand('L', 0.4).hand('R', 0.4); }
      } else if (kind === 'jump') {
        const jt = f.o.t0 || 0, u = (t - jt) / (f.o.air || 0.5), h = u > 0 && u < 1 ? 4 * u * (1 - u) * (f.o.h || 0.42) : 0;
        const crouch = u < 0 ? clamp(1 + u * 4, 0, 1) * 0.12 : 0;
        this.rootY = h; stance(); r.hips({ x: 0, y: -crouch - (u > 0.75 && u < 1 ? 0.04 : 0), z: 0 }, 0, 0, 0); r.spine(-0.1 * clamp(h * 5), 0, 0); r.look(0, -0.1, 0);
        const tuck = clamp(h / 0.2);
        for (const S of ['L', 'R']) { this.rig.legFK(S, 0.35 * tuck, 0.04, 0.8 * tuck + crouch * 3, -0.2 * tuck); }
        r.armFK('L', 2.9 - 0.2 * clamp(h * 8), 0.35, 0.3, 0).armFK('R', 2.9 - 0.2 * clamp(h * 8), 0.35, 0.3, 0); r.hand('L', 0.1).hand('R', 0.1);
        if (u >= 1.15 && f.o.autoEnd !== false) { this.endPose(); return; }
      } else {                                                                         // 'idle' / default: relaxed stance with hands on hips
        stance(); r.hips(null, 0, 0, 0); r.spine(0.02, 0, 0); r.look(0, 0, 0);
        for (const ft of this.feet) this.rig.leg(ft.S, _v.set(ft.p.x, ft.y, ft.p.z), { footYaw: 0, footPitch: 0 });
        r.armFK('L', 0.1, 0.12, 0.2, 0).armFK('R', 0.1, 0.12, 0.2, 0);
      }
      if (t > f.dur) this.endPose();
    }
  }

  FB.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
