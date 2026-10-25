/* Procedural player animation on top of FB.Rig: foot-planted stepping locomotion (exact planting, turning/strafing/stopping),
 * kick / pass with a contact event (IK foot path through the ball), reactions (celebrate, dejected, jump). No assets, no clips:
 * every pose is solved from the player's world state, so feet never slide and contact timing is exact. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, Q = T.Quaternion, M = FB.math;
  const { clamp, lerp, smooth } = M;
  const _v = new V(), _w = new V(), _q = new Q(), _qa = new Q();
  const UP = new V(0, 1, 0);

  class Player {
    constructor(actor, o = {}) {
      this.actor = actor; this.root = actor.root; this.rig = new FB.Rig(actor); this.o = o;
      const r = this.rig; this.homeX = o.homeX || 0.13; this.L = r.legLength;
      this.pos = new V(); this.yaw = 0; this.vel = new V(); this.want = { vx: 0, vz: 0, yaw: null };
      this.maxSpeed = o.maxSpeed || 6.2; this.accel = o.accel || 10; this.turn = o.turn || 10;
      this.t = Math.random() * 10; this.mode = 'loco'; this.modeT = 0; this.rand = M.rng(o.seed || 7);
      this.feet = [this._foot('L'), this._foot('R')]; this.lastStep = 1;
      this.hipY = r.hipsRest.y; this.air = 0; this.rootY = 0;
      this.snap = actor.boneList.map(() => new Q()); this.snapPos = new V(); this.blendT = 1; this.blendDur = 0.15;
      this.k = null; this.fx = null; this.armPose = { L: new V(), R: new V() };
      this.lookTarget = null; this.lookK = 0; this.ballRef = null;
      this.speed = 0; this.stepCount = 0; this.events = [];
      this.teleport(0, 0, 0);
    }
    _foot(S) { return { S, p: new V(), from: new V(), to: new V(), yaw: 0, swing: false, u: 0, dur: 0.25, y: this.rig.ankleHeight, pitch: 0, lift: 0.1 }; }
    homeWorld(i, out) { const x = (i === 0 ? 1 : -1) * this.homeX, c = Math.cos(this.yaw), s = Math.sin(this.yaw); return out.set(this.pos.x + x * c, 0, this.pos.z - x * s); }
    teleport(x, z, yaw) {
      this.pos.set(x, 0, z); this.yaw = yaw; this.vel.set(0, 0, 0); this.mode = 'loco'; this.k = null; this.fx = null; this.modeT = 0; this.rootY = 0;
      for (let i = 0; i < 2; i++) { const f = this.feet[i]; this.homeWorld(i, f.p); f.yaw = yaw; f.swing = false; f.u = 0; f.y = this.rig.ankleHeight; f.pitch = 0; }
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

    /* ---------- root motion ---------- */
    _integrate(dt) {
      const w = this.want, sp = Math.hypot(w.vx, w.vz), k = Math.min(1, this.accel * dt);
      const tx = sp > this.maxSpeed ? w.vx * this.maxSpeed / sp : w.vx, tz = sp > this.maxSpeed ? w.vz * this.maxSpeed / sp : w.vz;
      let dx = tx - this.vel.x, dz = tz - this.vel.z; const dl = Math.hypot(dx, dz), maxD = this.accel * dt * (sp > 0.1 ? 1 : 1.5);
      if (dl > maxD) { dx *= maxD / dl; dz *= maxD / dl; }
      this.vel.x += dx; this.vel.z += dz; this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      this.speed = Math.hypot(this.vel.x, this.vel.z);
      let want = w.yaw; if (want === null) want = this.speed > 0.4 ? Math.atan2(this.vel.x, this.vel.z) : this.yaw;
      let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const rate = this.turn * (0.5 + Math.min(1, this.speed / 3) * 0.5); this.yaw += clamp(d, -rate * dt, rate * dt);
    }
    _applyRoot() { this.root.position.set(this.pos.x, this.rootY, this.pos.z); this.root.quaternion.setFromAxisAngle(UP, this.yaw); this.root.updateMatrixWorld(true); }
    _local(wp, out) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw), dx = wp.x - this.pos.x, dz = wp.z - this.pos.z; return out.set(dx * c - dz * s, wp.y, dx * s + dz * c); }

    /** hips height (bone-local y) so that every grounded foot stays within the leg's reach */
    _hipHeight(grounded, off) {
      const r = this.rig, Lr = this.L * 0.985; let best = r.hipsRest.y + 0.0;
      for (const f of grounded) {
        this._local(f.p, _v);
        const tx = (f.S === 'L' ? 1 : -1) * 0.109 + off.x, dx = _v.x - tx, dz = _v.z - (-0.004 + off.z);
        const h = f.y + Math.sqrt(Math.max(0.05, Lr * Lr - dx * dx - dz * dz)) - 0.0;
        best = Math.min(best, h);
      }
      return best;
    }

    update(dt) {
      this.t += dt; this.modeT += dt;
      switch (this.mode) {
        case 'kick': if (this.k && this.k.trap) this._trap(dt); else this._kick(dt); break;
        case 'pose': this._pose(dt); break;
        default: this._loco(dt);
      }
      this._blend(dt);
      this.actor.root.updateMatrixWorld(true);
    }

    /* ================= locomotion ================= */
    _swingTarget(i, rem, out) {
      const sp = this.speed, ts = this.feet[i].dur;
      const x = (i === 0 ? 1 : -1) * this.homeX * (1 - 0.35 * clamp(sp / 5)), c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      let hx = 0, hz = 0; if (sp > 0.3) { hx = this.vel.x / sp; hz = this.vel.z / sp; }
      const lead = sp * ts * 0.42;
      return out.set(this.pos.x + this.vel.x * rem + x * c + hx * lead, 0, this.pos.z + this.vel.z * rem - x * s + hz * lead);
    }
    _loco(dt) {
      this._integrate(dt); this._applyRoot();
      const r = this.rig, sp = this.speed, F = this.feet;
      const gait = sp > 0.9, ts = clamp(0.55 - 0.08 * sp, 0.15, 0.45), overlap = Math.max(sp > 3.6 ? clamp((sp - 3.6) * 0.12, 0, 0.35) : 0, sp > 2.4 ? clamp((sp - 2.4) * 0.25, 0, 0.18) : 0);
      // advance swings
      for (const f of F) if (f.swing) { f.u += dt / f.dur; if (f.u >= 1) { f.swing = false; f.u = 1; f.p.copy(f.to); f.yaw = this.yaw; this.events.push({ type: 'step', side: f.S, speed: sp }); this.stepCount++; } }
      const sw = F.filter(f => f.swing);
      const canStart = sw.length === 0 || (sp > 2.4 && sw.length === 1 && sw[0].u > 1 - overlap);
      if (canStart) {
        let pick = -1;
        const err = [0, 0];
        for (let i = 0; i < 2; i++) { if (F[i].swing) continue; this._swingTarget(i, ts, _w); err[i] = Math.hypot(_w.x - F[i].p.x, _w.z - F[i].p.z); }
        if (gait) { const other = 1 - this.lastStep; if (!F[other].swing) pick = other; }
        else {
          const yawErr = Math.abs(Math.atan2(Math.sin(this.yaw - F[0].yaw), Math.cos(this.yaw - F[0].yaw)));
          const thr = 0.17 - Math.min(0.06, yawErr * 0.05);
          const a = F[0].swing ? -1 : err[0], b = F[1].swing ? -1 : err[1];
          if (Math.max(a, b) > thr) pick = a > b ? 0 : 1;
        }
        if (pick >= 0 && !F[pick].swing) { const f = F[pick]; f.swing = true; f.u = 0; f.from.copy(f.p); f.dur = gait ? ts : 0.26; f.lift = 0.045 + Math.min(0.2, sp * 0.032) + (gait ? 0.02 : 0); this._swingTarget(pick, f.dur, f.to); this.lastStep = pick; }
      }
      // foot poses
      const grounded = [];
      for (let i = 0; i < 2; i++) {
        const f = F[i]; let pitch, y;
        if (f.swing) {
          const u = f.u; this._swingTarget(i, (1 - u) * f.dur, f.to);
          const e = u * u * (3 - 2 * u), e2 = lerp(u, e, 0.7);
          f.p.x = f.from.x + (f.to.x - f.from.x) * e2; f.p.z = f.from.z + (f.to.z - f.from.z) * e2;
          y = r.ankleHeight + f.lift * Math.pow(Math.sin(Math.PI * u), 0.85);
          pitch = lerp(0.55, -0.3, smooth(u * 1.15)); f.yaw += (this.yaw - f.yaw) * Math.min(1, dt * 14);
        } else {
          this._local(f.p, _v);
          const trail = clamp((-_v.z - 0.12) * 1.5, 0, 0.55); pitch = trail; y = r.ankleHeight + Math.sin(trail) * 0.13;
          grounded.push(f);
        }
        f.pitch += (pitch - f.pitch) * Math.min(1, dt * 30); f.y = y;
      }
      // pelvis
      const off = this._locoOff || (this._locoOff = new V());
      const fz = i => { this._local(F[i].p, _v); return _v.z; };
      const zL = fz(0), zR = fz(1), plantedSide = grounded.length === 1 ? (grounded[0].S === 'L' ? 1 : -1) : 0;
      off.x = M.damp(off.x, plantedSide * 0.035 * clamp(sp / 2 + 0.2), 0.01, 1) ; off.x = M.damp(off.x, plantedSide * 0.03, 10, dt); off.z = 0.0;
      let hy = grounded.length ? this._hipHeight(grounded, off) : this.rig.hipsRest.y - 0.02;
      if (!grounded.length) { this.air += dt; hy = Math.min(this.hipY, this.rig.hipsRest.y) - 0.0; } else this.air = 0;
      hy -= 0.012 + 0.012 * clamp(sp / 5) + 0.17 * (this.crouch || 0);
      const k = grounded.length ? (hy < this.hipY ? 22 : 12) : 3; this.hipY = M.damp(this.hipY, Math.min(hy, this.rig.hipsRest.y), k, dt);
      const lean = clamp(sp / 6.5) * 0.24 + 0.22 * (this.crouch || 0), breath = Math.sin(this.t * 1.9) * 0.012, sway = Math.sin(this.t * 0.6);
      const idle = clamp(1 - sp / 1.5);
      r.hips({ x: off.x, y: this.hipY - r.hipsRest.y, z: 0.01 * lean }, clamp((zR - zL) * 0.32, -0.3, 0.3) * clamp(sp / 3), lean * 0.7, -plantedSide * 0.03 * clamp(sp / 3));
      r.spine(lean * 0.35 + breath + 0.02 * idle, 0.02 * sway * idle, clamp((zL - zR) * 0.38, -0.3, 0.3) * clamp(sp / 3));
      this._head(dt, 0.25);
      for (let i = 0; i < 2; i++) { const f = F[i]; this._planted(f, f.S, i); }
      // arms: counter-swing with the legs
      const swing = clamp(sp / 4.5), A = 0.85 * swing, el = 0.25 + 1.15 * swing;
      const aL = clamp(zR / 0.55, -1, 1) * A, aR = clamp(zL / 0.55, -1, 1) * A;
      const ar = this.armsReady || 0, rd = this.o.readyArm || { flex: 0.95, abd: 0.5, elbow: 1.2 };
      r.armFK('L', lerp(aL + 0.03 * Math.sin(this.t * 1.3) * idle, rd.flex + 0.06 * Math.sin(this.t * 2.1), ar), lerp(0.11 + 0.05 * swing, rd.abd, ar), lerp(el, rd.elbow, ar), 0)
        .armFK('R', lerp(aR + 0.03 * Math.sin(this.t * 1.1 + 1) * idle, rd.flex + 0.06 * Math.sin(this.t * 2.3), ar), lerp(0.11 + 0.05 * swing, rd.abd, ar), lerp(el, rd.elbow, ar), 0);
      r.hand('L', lerp(0.35, 0.1, ar), 0, 0.3).hand('R', lerp(0.35, 0.1, ar), 0, 0.3); r.clavicle('L', 0, 0).clavicle('R', 0, 0);
    }
    _planted(f, S, i) {
      const wp = _w.set(f.p.x, f.y, f.p.z);
      this.rig.leg(S, wp, { footYaw: f.yaw - this.yaw + this.yawOffsetLegs(), footPitch: f.pitch, toes: f.swing ? 0.2 : 0, knee: 0.2 });
    }
    yawOffsetLegs() { return 0; }
    /** world yaw relative to the root: the IK foot orientation is given in the foot parent's frame; root yaw is already inherited */
    _head(dt, k) {
      if (this.lookTarget) { this.rig.lookAt(this.lookTarget, 1.05, 0.6, k); } else this.rig.look(0.06 * Math.sin(this.t * 0.37), 0.04 + 0.03 * Math.sin(this.t * 0.5), 0);
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
      const cp = k.pitchC, reach = 0.13;
      k.C.copy(k.ball).addScaledVector(dir, -reach * Math.cos(cp)); k.C.y = k.ball.y + reach * Math.sin(cp) - 0.045 * loft * 0 + (pass ? 0.0 : 0.0);
      k.C.y = Math.max(k.C.y, this.rig.ankleHeight + 0.02);
      k.B.copy(k.ball).addScaledVector(dir, -(0.5 + 0.22 * pw)).addScaledVector(left, side * 0.04); k.B.y = 0.26 + 0.24 * pw + 0.12 * loft;
      const fl = 0.55 + 0.25 * pw; k.F.copy(k.C).addScaledVector(dir, fl).addScaledVector(left, k.curve * 0.18 * -1); k.F.y = k.C.y + 0.2 + 0.32 * loft + 0.1 * pw;
      // contact velocity of the foot along the swing path (m/s), reported to the caller
      const s = 1, d = k.C.clone().sub(k.B); k.vC.copy(d).multiplyScalar(2.2 / k.tSw);
      this.setMode('kick', 0.12);
      this.lookTarget = k.ball;
      return k;
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
      supF.swing = false; supF.p.lerpVectors(k.supFrom || (k.supFrom = supF.p.clone()), k.plant, pU); supF.yaw = this.yaw; supF.y = this.rig.ankleHeight + 0.05 * Math.sin(Math.PI * Math.min(1, pU)) * (pU < 1 ? 1 : 0);
      supF.pitch = pU < 1 ? 0.2 * (1 - pU) : 0;
      // kicking foot ankle path
      const tmp = _w; let pitch = 0.1, toes = 0.1;
      if (t < k.tA) { const u = smooth(t / k.tA); const from = k.kickFrom || (k.kickFrom = kickF.p.clone().setY(kickF.y)); tmp.lerpVectors(from, k.B, u); tmp.y += Math.sin(Math.PI * Math.min(1, u)) * 0.04; pitch = lerp(kickF.pitch, 0.25, u); }
      else if (t < tC) { const s = (t - k.tA) / k.tSw, e = Math.pow(s, 2.2); tmp.lerpVectors(k.B, k.C, e); const arc = Math.sin(Math.PI * Math.min(1, e)) * 0.10; tmp.y += arc * (1 - e); pitch = lerp(0.25, k.pitchC, smooth(s)); }
      else { const u = t - tC, tau = 0.075; const dist = tau * (1 - Math.exp(-u / tau)); const vh = Math.hypot(k.vC.x, k.vC.z); tmp.copy(k.C).addScaledVector(k.dir, vh * dist); tmp.addScaledVector(k.left, k.curve * -0.2 * smooth(u / 0.3)); tmp.y += (0.2 + 0.32 * k.loft) * smooth(u / 0.3) + 0.1 * k.pw * smooth(u / 0.3); pitch = lerp(k.pitchC, 0.45, smooth(u / 0.3)); toes = 0.3; }
      if (!k.fired && t >= tC) {
        k.fired = true; const fv = new V().copy(k.vC), info = { foot: S, footVel: fv, footSpeed: fv.length(), ball: k.ball.clone(), dir: k.dir.clone(), power: k.pw, loft: k.loft, curve: k.curve, time: t };
        this.events.push({ type: 'contact', info }); if (k.onContact) k.onContact(info);
      }
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
