/* Target Shooting 3D — the archer: animation state machine + procedural pose (single writer).
 *
 * States (only the listed transitions are legal; anything else is rejected and counted as a conflict):
 *   IDLE -> TARGET_ACQUIRE | TURN | MODE_TRANSITION
 *   TARGET_ACQUIRE -> RAISE_BOW | IDLE
 *   RAISE_BOW -> DRAW_BOW | RECOVER
 *   DRAW_BOW -> AIM_HOLD | RELEASE | RECOVER
 *   AIM_HOLD -> RELEASE | RECOVER
 *   RELEASE -> FOLLOW_THROUGH
 *   FOLLOW_THROUGH -> RECOVER
 *   RECOVER -> IDLE | RAISE_BOW
 *   TURN -> IDLE
 *   MODE_TRANSITION -> IDLE
 *
 * Pose model. Every frame the rig starts from the bind pose and receives ONE set of parameters:
 *   - stance: pelvis + two planted toe points (feet never move unless the TURN state steps them),
 *   - torso: twist (shoulder line follows the aim yaw), side-bend (T-form tilts with aim pitch), small bend,
 *   - bow: a rigid frame computed from the anchor and the aim direction (the bow is the reference; the bow hand
 *     is solved onto its grip, so the bow can never rotate independently of the hand),
 *   - draw hand: blend of key poses (idle, quiver, string at brace, anchor, follow-through); while hooked the
 *     string nocking point IS the hook point, so string, fingers and arrow stay aligned.
 * Key-pose weights change only through eased tweens that start from the current weights, so interrupting a
 * motion (question opens mid-draw, mode change) never jumps. Aim direction is smoothed outside (critically
 * damped), and the hand keyposes are recomputed from the current skeleton every frame (no feedback loop:
 * they depend on the chest/head joints, which are final before the arms are solved).
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util, BOW = TS.Gear.BOW;
  const UP = new T.Vector3(0, 1, 0);
  const STATES = ['IDLE', 'TARGET_ACQUIRE', 'RAISE_BOW', 'DRAW_BOW', 'AIM_HOLD', 'RELEASE', 'FOLLOW_THROUGH', 'RECOVER', 'TURN', 'MODE_TRANSITION'];
  const NEXT = {
    IDLE: ['TARGET_ACQUIRE', 'TURN', 'MODE_TRANSITION'],
    TARGET_ACQUIRE: ['RAISE_BOW', 'IDLE'],
    RAISE_BOW: ['DRAW_BOW', 'RECOVER'],
    DRAW_BOW: ['AIM_HOLD', 'RELEASE', 'RECOVER'],
    AIM_HOLD: ['RELEASE', 'RECOVER'],
    RELEASE: ['FOLLOW_THROUGH'],
    FOLLOW_THROUGH: ['RECOVER'],
    RECOVER: ['IDLE', 'RAISE_BOW'],
    TURN: ['IDLE'],
    MODE_TRANSITION: ['IDLE']
  };
  const DUR = { TARGET_ACQUIRE: 0.32, RAISE_BOW: 1.2, DRAW_BOW: 0.75, RELEASE: 0.07, FOLLOW_THROUGH: 0.55, RECOVER: 1.05, TURN: 1.0, MODE_TRANSITION: 0.6 };
  const KEYS = ['idle', 'quiver', 'string', 'anchor', 'follow'];
  const BOW_REST = new T.Vector3(0, BOW.gripToShelf + 0.004, 0);

  /** One critically damped spring step (closed form, exact for a constant target over dt). */
  function cd(x, v, target, w, dt) { const e = Math.exp(-w * dt), x0 = x - target, c = v + w * x0; return [target + (x0 + c * dt) * e, (v - w * c * dt) * e]; }
  /**
   * Key-pose weights driven by TWO cascaded critically damped springs per weight (closed form, any dt).
   * Unlike an eased tween that restarts from rest, the cascade keeps both velocity AND acceleration continuous
   * when the target changes: an interrupted motion (draw cancelled, question opens, next shot during recovery)
   * bends smoothly into the new one — no hitch, no velocity jump, no jolt at the start, no overshoot.
   */
  class Blend {
    constructor(keys, start) {
      this.keys = keys; this.w = {}; this.v = {}; this.m = {}; this.mv = {}; this.to = {};
      keys.forEach(k => { this.w[k] = this.m[k] = this.to[k] = k === start ? 1 : 0; this.v[k] = this.mv[k] = 0; });
      this.omega = 10; this.target = start; this.t = 0; this.d = 0; this.exact = null;
    }
    go(key, dur, exact = false) {
      this.keys.forEach(k => this.to[k] = k === key ? 1 : 0); this.omega = 7.6 / Math.max(0.05, dur); this.target = key; this.t = 0; this.d = dur;
      // exact: a timed smootherstep from the current weights that lands precisely at `dur` (used for the draw, so the
      // full-draw hold is reached at a known instant and is then perfectly still)
      this.exact = exact ? { from: Object.assign({}, this.w), d: Math.max(1e-3, dur) } : null;
      if (exact) this.keys.forEach(k => { this.v[k] = this.mv[k] = 0; this.m[k] = this.w[k]; });
    }
    snap(key) { this.keys.forEach(k => { this.w[k] = this.m[k] = this.to[k] = k === key ? 1 : 0; this.v[k] = this.mv[k] = 0; }); this.target = key; this.exact = null; }
    update(dt) {
      if (!(dt > 0)) return;
      this.t += dt;
      if (this.exact) {
        const e = U.smoother(Math.min(1, this.t / this.exact.d));
        for (const k of this.keys) { this.w[k] = this.m[k] = this.exact.from[k] + (this.to[k] - this.exact.from[k]) * e; }
        if (this.t >= this.exact.d) this.exact = null;
        return;
      }
      let sum = 0;
      for (const k of this.keys) {
        [this.m[k], this.mv[k]] = cd(this.m[k], this.mv[k], this.to[k], this.omega, dt);
        [this.w[k], this.v[k]] = cd(this.w[k], this.v[k], this.m[k], this.omega, dt);
        if (this.w[k] < 0) { this.w[k] = 0; this.v[k] = Math.max(0, this.v[k]); }
        sum += this.w[k];
      }
      if (sum > 1e-6) for (const k of this.keys) this.w[k] /= sum;
    }
    get busy() { return this.keys.some(k => Math.abs(this.w[k] - this.to[k]) > 0.002); }
  }
  /** scalar tween with an explicit easing (used for the deliberately fast string snap / release slide) */
  class Tween {
    constructor(v = 0) { this.v = v; this.a = v; this.b = v; this.t = 0; this.d = 0; }
    go(b, d, ease = U.smoother) { this.a = this.v; this.b = b; this.t = 0; this.d = Math.max(1e-3, d); this.ease = ease; }
    snap(v) { this.v = this.a = this.b = v; this.d = 0; }
    update(dt) { if (this.d <= 0) return this.v; this.t = Math.min(this.d, this.t + dt); this.v = this.a + (this.b - this.a) * this.ease(this.t / this.d); if (this.t >= this.d) this.d = 0; return this.v; }
  }
  /** scalar cascaded critically damped spring with a "duration" interface (C2-continuous retargeting) */
  class Smooth {
    constructor(v = 0) { this.v = this.m = this.b = v; this.vel = this.mv = 0; this.omega = 10; this.d = 0; }
    go(b, d) { this.b = b; this.omega = 7.6 / Math.max(0.05, d); this.d = d; }
    snap(v) { this.v = this.m = this.b = v; this.vel = this.mv = 0; this.d = 0; }
    update(dt) {
      if (!(dt > 0)) return this.v;
      [this.m, this.mv] = cd(this.m, this.mv, this.b, this.omega, dt);
      [this.v, this.vel] = cd(this.v, this.vel, this.m, this.omega, dt);
      if (Math.abs(this.v - this.b) < 1e-5 && Math.abs(this.vel) < 1e-4 && Math.abs(this.m - this.b) < 1e-5) { this.v = this.m = this.b; this.vel = this.mv = 0; this.d = 0; }
      return this.v;
    }
  }

  class Archer {
    constructor(rigFactory, scene, opts = {}) {
      this.rig = rigFactory.create();
      this.scene = scene;
      scene.add(this.rig.root);
      this.mats = TS.Gear.mats(opts.accent || '#8A1538');
      this.bow = new TS.Gear.Bow(opts.accent || '#8A1538');
      scene.add(this.bow.group);
      TS.Gear.equip(this.rig, this.mats);
      TS.World.linearize(this.bow.group); TS.World.linearize(this.rig.root);
      Object.values(this.mats).forEach(m => { if (!m.userData.lin) { m.color.convertSRGBToLinear(); m.userData.lin = true; } });
      this.arrow = TS.Gear.makeArrow(this.mats); this.arrow.visible = false; scene.add(this.arrow);
      this.state = 'IDLE'; this.stateT = 0; this.conflicts = 0; this.log = [];
      this.hand = new Blend(KEYS, 'idle');
      this.raise = new Smooth(0);        // bow arm: 0 = carried low, 1 = aimed
      this.look = new Smooth(0.55);      // head look weight
      this.stringK = new Tween(0);       // string draw when not hooked (snap back after release)
      this.arrowNock = new Tween(0);     // 0 = arrow in the hand, 1 = arrow on the string
      this.bowTip = new Smooth(0);       // follow-through bow drop (rotates bow AND hand together)
      this.ft = new Tween(0);            // follow-through hand slide
      this.hooked = false; this.arrowState = 'none';  // none | hand | nocked
      this.vib = { a: 0, t: 0 };
      this.breath = 0; this.shotCount = 0;
      this.onRelease = null;              // (pose) => void — called exactly once per release
      // stance
      this.stance = { pos: new T.Vector3(), dir: new T.Vector3(0, 0, -1), yaw: 0 };
      this.feet = { L: new T.Vector3(), R: new T.Vector3() };
      this.step = null;
      // aim (set by the aim system each frame, already smoothed)
      this.aimDir = new T.Vector3(0, 0, -1); this.lookPoint = new T.Vector3(0, 1.5, -30);
      // scratch
      this.v = Array.from({ length: 24 }, () => new T.Vector3());
      this.q = Array.from({ length: 6 }, () => new T.Quaternion());
      this.m4 = new T.Matrix4(); this.m4b = new T.Matrix4();
      this.bowFrame = { pos: new T.Vector3(), quat: new T.Quaternion(), basis: new T.Matrix4() };
      this.out = { anchor: new T.Vector3(), rest: new T.Vector3(), nock: new T.Vector3(), tip: new T.Vector3(), dir: new T.Vector3(), drawLen: 0.7, draw: 0 };
      this.diag = null;
      this.rig.beforeArms = r => this.solveUpper(r);
      this.setStance(new T.Vector3(0, 0, 0), new T.Vector3(0, 0, -1), true);
      this.update(0);
    }

    // ------------------------------------------------------------ state machine
    can(next) { return (NEXT[this.state] || []).includes(next); }
    go(next) {
      if (!this.can(next)) { this.conflicts++; this.log.push('reject ' + this.state + '->' + next); if (this.log.length > 50) this.log.shift(); return false; }
      this.state = next; this.stateT = 0; this.enter(next); return true;
    }
    enter(s) {
      switch (s) {
        case 'IDLE':
          this.hand.go('idle', 0.6); this.raise.go(0, 0.8); this.look.go(0.55, 0.6); this.bowTip.go(0, 0.5);
          if (this.arrowState === 'hand') this.arrowState = 'none';
          break;
        case 'TARGET_ACQUIRE': this.look.go(1, DUR.TARGET_ACQUIRE); break;
        case 'RAISE_BOW': {
          // starting from the face (next shot during recovery) the hand has further to travel: shift the timeline
          const hw = this.hand.w; this.rOff = (hw.string + hw.anchor + hw.follow) > 0.4 ? 0.45 : 0;
          this.hand.go('quiver', 0.5 + this.rOff); this.raise.go(1, DUR.RAISE_BOW * 0.92); this.look.go(1, 0.4); this.bowTip.go(0, 0.4);
          this.arrowState = 'none'; this.hooked = false; this.arrowNock.snap(0); this.stringK.go(0, 0.2);
          break;
        }
        case 'DRAW_BOW': this.hand.go('anchor', DUR.DRAW_BOW, true); break;
        case 'AIM_HOLD': break;
        case 'RELEASE':
          this.release();
          this.ft.go(1, 0.16, t => 1 - Math.pow(1 - t, 3));
          break;
        case 'FOLLOW_THROUGH': this.bowTip.go(1, 0.45); break;
        case 'RECOVER':
          // carry what we hold back to a relaxed ready position; an un-shot arrow is returned (never fired)
          this.hooked = false; this.stringK.go(0, 0.25);
          if (this.arrowState === 'nocked') { this.arrowState = 'hand'; this.arrowNock.snap(0); }
          // an un-shot arrow is carried back to the quiver before the hand relaxes (no arrow popping out of existence)
          this.returning = this.arrowState === 'hand'; this.recoverDur = this.returning ? 1.25 : DUR.RECOVER;
          this.hand.go(this.returning ? 'quiver' : 'idle', this.returning ? 0.5 : DUR.RECOVER); this.raise.go(0.15, DUR.RECOVER); this.bowTip.go(0, DUR.RECOVER);
          break;
        case 'TURN': this.hand.go('idle', 0.4); this.raise.go(0, 0.5); break;
        case 'MODE_TRANSITION': this.hand.go('idle', 0.5); this.raise.go(0, 0.5); this.look.go(0.4, 0.5); this.arrowState = 'none'; this.hooked = false; break;
      }
    }

    /** Begin the shot cycle (from IDLE or RECOVER). Returns false if not possible now. */
    ready() {
      if (this.state === 'IDLE') return this.go('TARGET_ACQUIRE');
      if (this.state === 'RECOVER') return this.go('RAISE_BOW');
      return ['TARGET_ACQUIRE', 'RAISE_BOW', 'DRAW_BOW', 'AIM_HOLD'].includes(this.state);
    }
    /** Hold input: start drawing as soon as the arrow is on the string. */
    draw() {
      this.wantDraw = true;
      if (['IDLE', 'RECOVER'].includes(this.state)) this.ready();
      return true;
    }
    /** Release input. Fires if the draw is at least 35 %; otherwise lets down safely. */
    loose() {
      this.wantDraw = false;
      if (this.state === 'AIM_HOLD') return this.go('RELEASE');
      if (this.state === 'DRAW_BOW') { if (this.drawAmount() >= 0.35) return this.go('RELEASE'); return this.go('RECOVER'); }
      this.wantRelease = ['TARGET_ACQUIRE', 'RAISE_BOW'].includes(this.state) ? false : this.wantRelease;
      return false;
    }
    /** Lower the bow (question opens, round ends). Never leaves the character frozen in a draw. */
    standDown() {
      this.wantDraw = false;
      if (['DRAW_BOW', 'AIM_HOLD', 'RAISE_BOW'].includes(this.state)) this.go('RECOVER');
      else if (this.state === 'TARGET_ACQUIRE') this.go('IDLE');
      this.pendingIdle = true;
    }
    drawAmount() { const w = this.hand.w; const s = w.string + w.anchor; return s > 1e-3 ? w.anchor / s : 0; }
    get busy() { return !['IDLE', 'AIM_HOLD'].includes(this.state); }

    release() {
      if (this.arrowState !== 'nocked') return;
      const o = this.out;
      const draw = this.drawAmount();
      this.hooked = false; this.arrowState = 'none';
      this.stringK.snap(draw); this.stringK.go(0, 0.035, t => t);
      this.vib.a = 0.012 * draw; this.vib.t = 0;
      this.shotCount++;
      // exact world pose of the arrow that leaves the string (the flying arrow starts from this very transform)
      const pose = { nock: this.arrow.position.clone(), quat: this.arrow.quaternion.clone(), dir: o.dir.clone(), draw, tip: o.tip.clone() };
      this.arrow.visible = false;
      if (this.onRelease) this.onRelease(pose);
    }

    // ------------------------------------------------------------ stance / turning
    setStance(pos, dir, snap) {
      const d = this.v[0].copy(dir).setY(0).normalize();
      const chest = this.v[1].crossVectors(d, UP).normalize();      // archer faces his chest side, left shoulder to the target
      const yaw = Math.atan2(chest.x, chest.z);
      if (snap || !this.stance.set) {
        this.stance.pos.copy(pos); this.stance.dir.copy(d); this.stance.yaw = yaw; this.stance.set = true;
        this.placeFeet(this.feet.L, this.feet.R);
        this.rig.setTransform(pos.x, pos.z, yaw);
        return;
      }
      // a real turn: step the feet (TURN state)
      if (this.state !== 'IDLE') return;
      const from = { yaw: this.stance.yaw, L: this.feet.L.clone(), R: this.feet.R.clone() };
      this.stance.pos.copy(pos); this.stance.dir.copy(d); this.stance.yaw = yaw;
      const toL = new T.Vector3(), toR = new T.Vector3(); this.placeFeet(toL, toR);
      this.step = { from, toL, toR, yaw0: from.yaw, yaw1: yaw };
      this.go('TURN');
    }
    placeFeet(L, R) {
      const d = this.stance.dir, chest = this.v[2].crossVectors(d, UP).normalize();
      L.copy(this.stance.pos).addScaledVector(d, 0.27).addScaledVector(chest, 0.105);
      R.copy(this.stance.pos).addScaledVector(d, -0.27).addScaledVector(chest, 0.125);
    }

    // ------------------------------------------------------------ per frame
    setAim(dir, lookPoint) { this.aimDir.copy(dir).normalize(); if (lookPoint) this.lookPoint.copy(lookPoint); }

    update(dt) {
      this.stateT += dt;
      // timeline-driven transitions
      const s = this.state, t = this.stateT;
      if (s === 'TARGET_ACQUIRE' && t >= DUR.TARGET_ACQUIRE) this.go('RAISE_BOW');
      else if (s === 'RAISE_BOW') {
        const o = this.rOff || 0;
        if (this.arrowState === 'none' && t >= 0.45 + o) { this.arrowState = 'hand'; this.arrowNock.snap(0); }
        if (this.hand.target === 'quiver' && t >= 0.5 + o) this.hand.go('string', 0.6);
        if (this.arrowState === 'hand' && t >= 0.73 + o && this.arrowNock.d === 0 && this.arrowNock.v === 0) this.arrowNock.go(1, 0.32);
        if (t >= DUR.RAISE_BOW + o) { this.arrowState = 'nocked'; this.hooked = true; if (this.wantDraw !== false) this.go('DRAW_BOW'); else this.go('RECOVER'); }
      } else if (s === 'DRAW_BOW' && t >= DUR.DRAW_BOW) this.go('AIM_HOLD');
      else if (s === 'RELEASE' && t >= DUR.RELEASE) this.go('FOLLOW_THROUGH');
      else if (s === 'FOLLOW_THROUGH' && t >= DUR.FOLLOW_THROUGH) this.go('RECOVER');
      else if (s === 'RECOVER' && this.returning && t >= 0.5) { this.returning = false; this.arrowState = 'none'; this.hand.go('idle', 0.75); }
      else if (s === 'RECOVER' && t >= (this.recoverDur || DUR.RECOVER)) {
        if (this.wantDraw && !this.pendingIdle) this.go('RAISE_BOW'); else { this.pendingIdle = false; this.go('IDLE'); }
      } else if (s === 'TURN') {
        if (t >= DUR.TURN) { this.step = null; this.rig.setTransform(this.stance.pos.x, this.stance.pos.z, this.stance.yaw); this.go('IDLE'); }
      } else if (s === 'MODE_TRANSITION' && t >= DUR.MODE_TRANSITION) this.go('IDLE');
      if (s === 'DRAW_BOW' && this.wantDraw === false && t > 0.05) { /* released early: handled in loose() */ }

      // a draw request that arrived during a transition starts as soon as the archer is free
      if (this.state === 'IDLE' && this.wantDraw && this.stateT > 0) this.go('TARGET_ACQUIRE');
      // the follow-through slide only matters while the anchor pose has weight; reset it once that weight is gone
      // (never animated backwards, so the hand cannot reverse direction when the next motion starts)
      if (this.ft.v > 0 && this.hand.w.anchor < 0.002 && this.state !== 'RELEASE') this.ft.snap(0);
      this.hand.update(dt); this.raise.update(dt); this.look.update(dt); this.stringK.update(dt);
      this.arrowNock.update(dt); this.bowTip.update(dt); this.ft.update(dt);
      this.vib.t += dt;
      this.breath += dt;

      this.applyLower(dt);
      this.rig.update(dt);
      this.finishBow();
      if (this.diag) this.diag.sample(this, dt);
    }

    /** pelvis, spine, legs (before the rig solves) */
    applyLower() {
      const p = this.rig.pose, st = this.stance;
      // TURN: interpolate yaw and step the feet one after the other (lifted arcs, no sliding contact)
      let yaw = st.yaw;
      if (this.state === 'TURN' && this.step) {
        const k = U.smoother(this.stateT / DUR.TURN), sp = this.step;
        yaw = sp.yaw0 + U.wrapAngle(sp.yaw1 - sp.yaw0) * k;
        const kL = U.smoother((this.stateT / DUR.TURN - 0.05) / 0.45), kR = U.smoother((this.stateT / DUR.TURN - 0.5) / 0.45);
        this.feet.L.lerpVectors(sp.from.L, sp.toL, kL); this.feet.R.lerpVectors(sp.from.R, sp.toR, kR);
        p.foot.L.lift = Math.sin(Math.PI * kL) * 0.07; p.foot.R.lift = Math.sin(Math.PI * kR) * 0.07;
        this.rig.setTransform(st.pos.x, st.pos.z, yaw);
      } else { p.foot.L.lift = 0; p.foot.R.lift = 0; this.rig.yaw = yaw; }
      const yawQ = this.q[0].setFromAxisAngle(UP, yaw);
      const chest = this.v[3].set(0, 0, 1).applyQuaternion(yawQ);          // the archer's front
      const toTarget = this.v[4].set(1, 0, 0).applyQuaternion(yawQ);       // the archer's left (target side)
      // aim yaw/pitch relative to the stance
      const d = this.aimDir;
      const dh = this.v[5].copy(d).setY(0); const hl = dh.length(); if (hl > 1e-5) dh.multiplyScalar(1 / hl); else dh.copy(toTarget);
      const yawRel = Math.atan2(this.v[6].crossVectors(toTarget, dh).y, toTarget.dot(dh));
      const pitch = Math.asin(U.clamp(d.y, -1, 1));
      const r = this.raise.v;
      const ar = U.clamp(yawRel, -1.05, 1.05) * r, ap = U.clamp(pitch, -0.6, 0.95) * r;
      // pelvis between the planted feet, knees soft
      const mid = this.v[7].addVectors(this.feet.L, this.feet.R).multiplyScalar(0.5);
      mid.addScaledVector(chest, -0.115);
      const breathe = Math.sin(this.breath * Math.PI * 2 * 0.23) * (0.0025 + 0.002 * (1 - r));
      p.pelvisPos.set(mid.x, this.rig.pelvisHeight - 0.03 - 0.006 * r, mid.z); p.pelvisW = 1;   // soft knees: legs stay in the exact IK range
      p.turn = 0.08 * r + ar * 0.28;
      p.tilt = 0.02 * r; p.roll = -0.012 * r;
      p.twist = ar * 0.72 + 0.04 * r;                 // the shoulder line follows the aim
      p.side = ap * 0.82;                              // T-form tilts as a unit
      p.bend = 0.035 + 0.02 * (1 - r) + breathe;
      for (const s of ['L', 'R']) {
        const f = p.foot[s]; f.w = 1; f.toe.copy(this.feet[s]); f.heel = 0; f.toeFlat = 1;
        f.turn = s === 'L' ? 0.26 : 0.1;
        f.kneeDir.copy(chest).addScaledVector(s === 'L' ? toTarget : this.v[8].copy(toTarget).negate(), 0.25).normalize();
      }
      // clavicles: bow shoulder set down, draw shoulder slightly back (only while raised)
      p.clavicle.L.amount = 0.06 * r; p.clavicle.L.dir.set(0, -1, 0);
      p.clavicle.R.amount = 0.05 * r; p.clavicle.R.dir.copy(chest).negate().addScaledVector(UP, -0.3).normalize();
      // head
      p.look.copy(this.lookPoint); p.lookW = this.look.v; p.lookLimit = 1.6;
    }

    /** Called by the rig once the chest/head are final: compute bow frame and both hand targets. */
    solveUpper(rig) {
      const v = this.v, p = rig.pose, o = this.out;
      const H = rig.worldOf('Head', v[9]);
      const SL = rig.worldOf('L_UpperArm', v[10]), SR = rig.worldOf('R_UpperArm', v[11]);
      const yawQ = this.q[0].setFromAxisAngle(UP, rig.yaw);
      const chestH = v[12].set(0, 0, 1).applyQuaternion(yawQ);
      const tgtH = v[13].set(1, 0, 0).applyQuaternion(yawQ);
      // aim frame
      const d = v[14].copy(this.aimDir);
      const u = v[15].copy(UP).addScaledVector(d, -UP.dot(d)).normalize();
      const c = v[16].crossVectors(d, u).normalize();               // archer's chest side
      // ---- aimed key frame (raise = 1)
      const A = o.anchor.copy(H).addScaledVector(d, 0.098).addScaledVector(u, -0.052).addScaledVector(c, 0.004);
      // draw length limited by the bow arm: the wrist stays inside the exact IK range (no soft-IK shortfall)
      let L = 0.70;
      const wristOff = 0.06;
      for (let i = 0; i < 3; i++) {
        const G = v[17].copy(A).addScaledVector(d, L - 0.02).addScaledVector(u, -0.065).addScaledVector(c, 0.012);
        const dist = G.distanceTo(SL) - wristOff;
        if (dist > rig.armLength * 0.928) L -= (dist - rig.armLength * 0.928); else break;   // stay inside the exact (non-soft) IK range
      }
      L = U.clamp(L, 0.52, 0.72); o.drawLen = L;
      const R = o.rest.copy(A).addScaledVector(d, L);
      // aimed bow frame: X = c, Y = u, Z = -d, origin so that the arrow rest (local (0, shelf, 0)) is R
      const qAim = this.q[1].setFromRotationMatrix(this.m4.makeBasis(c, u, v[18].copy(d).negate()));
      const posAim = v[19].copy(R).addScaledVector(u, -(BOW.gripToShelf + 0.004));
      // ---- low carry frame (raise = 0): bow in the relaxed left hand, lower limb forward
      const pel = rig.worldOf('Pelvis', v[20]);
      // carry: elbow bent ~90°, forearm forward at waist height, bow upright in the fist (slight forward lean)
      const lowGrip = v[21].copy(pel).addScaledVector(tgtH, 0.19).addScaledVector(chestH, 0.31).addScaledVector(UP, 0.02);
      const bowUpLow = v[22].copy(UP).multiplyScalar(0.96).addScaledVector(chestH, 0.22).addScaledVector(tgtH, 0.1).normalize();
      const bowZLow = v[23].copy(chestH).negate().addScaledVector(tgtH, -0.25);
      bowZLow.addScaledVector(bowUpLow, -bowZLow.dot(bowUpLow)).normalize();
      const bowXLow = this.v[5].crossVectors(bowUpLow, bowZLow).normalize();
      const qLow = this.q[2].setFromRotationMatrix(this.m4b.makeBasis(bowXLow, bowUpLow, bowZLow));
      // grip centre in bow-local space
      const GL = this.GL || (this.GL = new T.Vector3().fromArray(BOW.grip));
      const posLow = this.v[6].copy(GL).applyQuaternion(qLow).negate().add(lowGrip);
      // blend aimed <-> low (rigid frame), then the follow-through drop about the grip
      const r = U.smoother(this.raise.v);
      const bf = this.bowFrame;
      bf.quat.copy(qLow).slerp(qAim, r);
      bf.pos.copy(posLow).lerp(posAim, r);
      if (this.bowTip.v > 0) {
        const gw = this.v[7].copy(GL).applyQuaternion(bf.quat).add(bf.pos);
        const dq = this.q[3].setFromAxisAngle(c, -0.28 * this.bowTip.v * r);
        bf.quat.premultiply(dq);
        bf.pos.sub(gw).applyQuaternion(dq).add(gw);
      }
      this.bow.group.position.copy(bf.pos); this.bow.group.quaternion.copy(bf.quat); this.bow.group.updateMatrixWorld(true);
      const bowX = this.v[8].set(1, 0, 0).applyQuaternion(bf.quat), bowY = this.v[0].set(0, 1, 0).applyQuaternion(bf.quat), bowZ = this.v[1].set(0, 0, 1).applyQuaternion(bf.quat);
      // ---- bow hand: a fist around the grip, thumb up, palm toward the bow's +X side, fingers wrapping it
      //      (defined in bow space, so the hand and bow are one rigid unit in every state)
      const gripW = this.v[2].copy(GL).applyQuaternion(bf.quat).add(bf.pos);
      const hL = p.hand.L; hL.w = 1;
      hL.pos.copy(gripW).addScaledVector(bowX, -0.026).addScaledVector(bowZ, 0.008).addScaledVector(bowY, 0.004);
      hL.fdir.copy(bowZ).multiplyScalar(-1).addScaledVector(bowY, -0.12).addScaledVector(bowX, 0.12).normalize();
      hL.ndir.copy(bowX).addScaledVector(bowZ, 0.15).normalize();
      hL.pole.copy(SL).addScaledVector(bowX, -0.55).addScaledVector(bowY, -0.3);
      hL.curl = null; hL.fingers = [1.15, 1.25, 1.3, 1.35]; hL.thumb = 0.55;
      // ---- draw hand key poses
      const w = this.hand.w;
      const nockBrace = this.v[3].set(0, BOW.gripToShelf + 0.004, BOW.brace).applyQuaternion(bf.quat).add(bf.pos);
      const nockFull = A;
      // hook point (where the fingers hold the string)
      const sw = w.string + w.anchor;
      const kHook = sw > 1e-4 ? w.anchor / sw : 0;
      const hookPt = this.v[4].copy(nockBrace).lerp(nockFull, kHook);
      const KP = this.keyposes || (this.keyposes = {});
      const kp = (name) => (KP[name] || (KP[name] = { pos: new T.Vector3(), f: new T.Vector3(), n: new T.Vector3(), pole: new T.Vector3(), curl: [0, 0, 0, 0], thumb: 0 }));
      // idle: relaxed at the right thigh
      {
        const k = kp('idle');
        k.pos.copy(pel).addScaledVector(tgtH, -0.215).addScaledVector(chestH, 0.035).addScaledVector(UP, -0.17);
        k.f.copy(UP).negate().addScaledVector(chestH, 0.18).normalize(); k.n.copy(tgtH).addScaledVector(chestH, 0.2).normalize();
        k.pole.copy(SR).addScaledVector(chestH, -0.5).addScaledVector(tgtH, -0.15).addScaledVector(UP, -0.1);
        k.curl = [0.32, 0.38, 0.42, 0.48]; k.thumb = 0.2;
      }
      // quiver: fingers at the top of the hip quiver, pinching a nock
      {
        const k = kp('quiver');
        const qTop = rig.quiver ? rig.quiver.getWorldPosition(this.v[5]).addScaledVector(UP, 0.14) : this.v[5].copy(pel).addScaledVector(tgtH, -0.2).addScaledVector(UP, 0.12);
        k.pos.copy(qTop).addScaledVector(UP, 0.03).addScaledVector(chestH, 0.0);
        k.f.copy(UP).negate().addScaledVector(chestH, 0.3).normalize(); k.n.copy(tgtH).normalize();
        k.pole.copy(SR).addScaledVector(chestH, -0.5).addScaledVector(tgtH, -0.22);
        k.curl = [0.75, 0.8, 1.2, 1.3]; k.thumb = 0.55;
      }
      // string / anchor / follow-through: hand hooked on the string, palm toward the neck, fingers toward the target
      const hookPose = (k, pt) => {
        k.pos.copy(pt).addScaledVector(d, -0.058).addScaledVector(c, 0.024).addScaledVector(u, -0.012);
        k.f.copy(d).addScaledVector(c, -0.18).normalize(); k.n.copy(c).negate().addScaledVector(u, -0.18).normalize();
        k.pole.copy(SR).addScaledVector(c, -0.6).addScaledVector(d, -0.22).addScaledVector(u, -0.04);
        k.curl = [1.25, 1.3, 1.3, 1.6]; k.thumb = 0.65;
      };
      hookPose(kp('string'), nockBrace);
      hookPose(kp('anchor'), nockFull);
      {
        const k = kp('follow');
        hookPose(k, nockFull);
        k.pos.addScaledVector(d, -0.045).addScaledVector(c, 0.06).addScaledVector(u, -0.01);   // released fingers drift back and away from the face
        k.curl = [0.35, 0.4, 0.45, 0.7]; k.thumb = 0.3;
      }
      // follow-through slides the anchor pose back (ft tween) — blend 'anchor' toward 'follow'
      const ft = this.ft.v;
      const hR = p.hand.R; hR.w = 1;
      hR.pos.set(0, 0, 0); hR.fdir.set(0, 0, 0); hR.ndir.set(0, 0, 0); hR.pole.set(0, 0, 0);
      const fingers = hR.fingers || (hR.fingers = [0, 0, 0, 0]); fingers.fill(0); hR.thumb = 0; hR.curl = null;
      beginPoses();
      for (const name of KEYS) {
        let wt = w[name]; if (!wt) continue;
        let k = KP[name];
        if (name === 'anchor' && ft > 0) {
          // anchor <-> follow mix
          const a = KP.anchor, b = KP.follow;
          addPose(hR, a, wt * (1 - ft)); addPose(hR, b, wt * ft); continue;
        }
        addPose(hR, k, wt);
      }
      // arcs instead of straight lines between key poses: the hand travels in front of the body (never through
      // the shoulder), which keeps the elbow swivel slow and continuous
      const low = w.idle + w.quiver, high = w.string + w.anchor + w.follow;
      const bHL = Math.pow(4 * low * high, 2), bIQ = Math.pow(4 * w.idle * w.quiver, 2);   // squared: arcs start and end gently
      if (bHL > 0) hR.pos.addScaledVector(chestH, 0.17 * bHL).addScaledVector(tgtH, 0.04 * bHL);
      if (bIQ > 0) hR.pos.addScaledVector(chestH, 0.05 * bIQ).addScaledVector(tgtH, -0.04 * bIQ);
      endPoses(hR);
      // ---- string + arrow
      const bowInv = this.m4b.copy(this.bow.group.matrixWorld).invert();
      this.bow.setFlex(this.hooked ? kHook : this.stringK.v);
      let nockW;
      if (this.hooked) { nockW = hookPt; }
      else {
        // free string: between brace and the last hooked point, plus a short damped vibration after release
        nockW = this.v[6].copy(nockBrace).lerp(nockFull, this.stringK.v);
        const va = this.vib.a * Math.exp(-this.vib.t * 18) * Math.sin(this.vib.t * 2 * Math.PI * 38);
        nockW.addScaledVector(d, va);
      }
      const nockLocal = this.v[7].copy(nockW).applyMatrix4(bowInv);
      this.bow.setString(nockLocal);
      o.nock.copy(nockW);
      o.draw = this.hooked ? kHook : 0;
      // arrow placement needs the solved hand bones: stored here, applied in finishBow() after the rig update
      this.pendingArrow = { hook: (this.pendingArrow && this.pendingArrow.hook || new T.Vector3()).copy(hookPt), rest: (this.pendingArrow && this.pendingArrow.rest || new T.Vector3()).copy(BOW_REST).applyQuaternion(bf.quat).add(bf.pos) };
    }
    /** After the rig is final: put the arrow on the string or between the fingers (exactly on the hand bones). */
    finishBow() {
      const o = this.out, rig = this.rig, pa = this.pendingArrow;
      if (!pa || !(this.arrowState === 'nocked' || this.arrowState === 'hand')) { this.arrow.visible = false; return; }
      const hookPt = pa.hook, restW = pa.rest;
      const dirOn = this.v[9].subVectors(restW, hookPt).normalize();
      o.dir.copy(dirOn);
      const qOn = this.q[4].setFromUnitVectors(this.v[10].set(0, 0, 1), dirOn);
      const pos = this.v[11].copy(hookPt), quat = this.q[5].copy(qOn);
      if (this.arrowState === 'hand' || this.arrowNock.v < 1) {
        // pinched between thumb and index: nock at the thumb/index contact, shaft along the hand's pinch line
        const thumb = rig.worldOf('R_Finger01', this.v[12]), index = rig.worldOf('R_Finger11', this.v[13]);
        const handNock = this.v[14].addVectors(thumb, index).multiplyScalar(0.5);
        const handQ = rig.quatOf('R_Hand', this.q[3]);
        const across = this.v[15].copy(rig.rest.R_palm.n).applyQuaternion(handQ);       // palm normal
        const along = this.v[16].copy(rig.rest.R_palm.f).applyQuaternion(handQ);        // finger direction
        // out of the quiver the shaft hangs down along the fingers; then it swings onto the bow
        const shaftHand = this.v[17].copy(along).multiplyScalar(0.6).addScaledVector(across, 0.25).addScaledVector(UP, -0.75).normalize();
        const blendTo = this.state === 'RAISE_BOW' ? U.smoother((this.stateT - 0.55 - (this.rOff || 0)) / 0.45) : 1;
        const shaftDir = this.v[18].copy(shaftHand).lerp(dirOn, blendTo).normalize();
        // the nock leads the shaft: the arrow origin is the nock, offset back along the shaft by the pinch grip
        const k = this.arrowNock.v;
        pos.copy(handNock).addScaledVector(shaftDir, -0.012).lerp(hookPt, k);
        const qHand = this.q[3].setFromUnitVectors(this.v[19].set(0, 0, 1), shaftDir);
        quat.copy(qHand).slerp(qOn, k);
      }
      this.arrow.position.copy(pos); this.arrow.quaternion.copy(quat); this.arrow.visible = true;
      this.arrow.updateMatrixWorld(true);
      o.tip.copy(this.v[20].set(0, 0, BOW.arrowLen).applyQuaternion(quat).add(pos));
    }

    /** Reference point from which the aim system solves the launch (stable: depends on the stance only). */
    aimOrigin(out) {
      const st = this.stance, chest = this.v[20].crossVectors(st.dir, UP).normalize();
      return out.copy(st.pos).addScaledVector(UP, 1.47).addScaledVector(st.dir, 0.55).addScaledVector(chest, 0.1);
    }
    headPos(out) { return this.rig.worldOf('Head', out); }
    dispose() { this.scene.remove(this.rig.root, this.bow.group, this.arrow); this.bow.dispose(); this.rig.dispose(); Object.values(this.mats).forEach(m => m.dispose()); }
  }
  // Hand orientation is blended as quaternions (sign-aligned weighted average), never as raw direction vectors:
  // blending finger/palm vectors of two poses can make them nearly parallel mid-way, and re-orthogonalising them
  // then flips the hand. The quaternion blend is well conditioned for any pair of key poses.
  const _qb = new T.Quaternion(), _qacc = new T.Vector4(), _mb = new T.Matrix4(), _x = new T.Vector3(), _y = new T.Vector3(), _z = new T.Vector3();
  let _qref = null;
  function poseQuat(k, out) {
    _x.copy(k.f).normalize(); _y.copy(k.n).addScaledVector(_x, -k.n.dot(_x)).normalize(); _z.crossVectors(_x, _y);
    return out.setFromRotationMatrix(_mb.makeBasis(_x, _y, _z));
  }
  function addPose(h, k, w) {
    h.pos.addScaledVector(k.pos, w); h.pole.addScaledVector(k.pole, w);
    poseQuat(k, _qb);
    if (!_qref) _qref = _qb.clone();
    const sgn = (_qb.x * _qref.x + _qb.y * _qref.y + _qb.z * _qref.z + _qb.w * _qref.w) < 0 ? -1 : 1;
    _qacc.x += _qb.x * w * sgn; _qacc.y += _qb.y * w * sgn; _qacc.z += _qb.z * w * sgn; _qacc.w += _qb.w * w * sgn;
    for (let i = 0; i < 4; i++) h.fingers[i] += k.curl[i] * w; h.thumb += k.thumb * w;
  }
  function beginPoses() { _qacc.set(0, 0, 0, 0); _qref = null; }
  function endPoses(h) {
    const q = _qb.set(_qacc.x, _qacc.y, _qacc.z, _qacc.w).normalize();
    h.fdir.set(1, 0, 0).applyQuaternion(q); h.ndir.set(0, 1, 0).applyQuaternion(q);
  }

  TS.Archer = { Archer, STATES, NEXT, DUR, Blend, Tween, Smooth };
})(typeof window !== 'undefined' ? window : globalThis);
