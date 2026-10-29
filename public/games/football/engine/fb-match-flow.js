/* Match director, part 2: the per-frame state machine, ball colliders and the physical resolution planner (goal / save / wide / pending). */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, M = FB.math, { clamp, lerp, smooth } = M, G = FB.PITCH, GZ = G.goalZ, HW = G.goalHalf, GH = G.goalHeight;
  const Match = FB.Match, steer = FB.steer, P = Match.prototype;
  const _s = { x: 0, z: 0 };
  const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

  Object.assign(P, {
    /* ---------- colliders ---------- */
    updateColliders(dt) {
      const out = this.ball.colliders; let n = 0;
      const solid = this.state === 'flight' || this.state === 'frozen' || this.state === 'resolve';
      const add = (p, set, e, kind, parry) => {
        const spheres = p.colliderSpheres(set, p._cs || (p._cs = []));
        const pool = this.colliders[p.id] || (this.colliders[p.id] = []);
        for (let i = 0; i < spheres.length; i++) {
          const s = spheres[i]; let c = pool[i];
          if (!c) { c = pool[i] = { p: new V(s.x, s.y, s.z), v: new V(), r: s.r, e, kind, owner: p.id, active: true, parry: false, onHit: null }; }
          if (dt > 0) c.v.set((s.x - c.p.x) / dt, (s.y - c.p.y) / dt, (s.z - c.p.z) / dt); c.v.clampLength(0, 12);
          c.p.set(s.x, s.y, s.z); c.r = s.r; c.e = e; c.kind = kind; c.active = solid && !(p.holding); out[n++] = c;
          if (set === 'keeper') { if (i >= spheres.length - 2) { c.kind = 'glove'; c.r = 0.13; } c.parry = !!parry; c.onHit = this._onGlove || (this._onGlove = b => this.onGloveHit(b)); } else c.onHit = null;
        }
      };
      for (const d of this.defs) add(d, 'body', 0.35, 'body');
      add(this.keeper, 'keeper', 0.3, 'body', this.plan && this.plan.parry);
      out.length = n;
    },
    onGloveHit(b) {
      const pl = this.plan; if (!pl || this.keeper.held || (pl.kind !== 'catch' && pl.kind !== 'parry')) return; pl.touched = true;
      this.emit('glove', { strength: b.v.length() });
      if (pl.kind === 'catch') { this.keeper.held = true; this.keeper.holding = true; this.ball.held = this.keeper; b.v.set(0, 0, 0); b.w.set(0, 0, 0); this.holdT = 0; this.emit('catch'); }
      else if (pl.kind === 'parry') { const sp = Math.max(6, b.v.length() * 0.35); b.v.set(pl.side * (2.2 + 0.1 * sp), 2.4 + 0.08 * sp, 3.0 + 0.3 * sp); this.emit('parry'); }
    },

    /* ---------- per-frame ---------- */
    update(rdt) {
      let dt = rdt * this.timeScale; if (this.state === 'frozen') dt = 0;
      this.t += dt; this.stateT = (this.stateT || 0) + dt;
      const ball = this.ball, st = this.state;
      if (dt > 0) {
        switch (st) {
          case 'build': this.stBuild(dt); break; case 'pass': this.stPass(dt); break; case 'prep': this.stPrep(dt); break; case 'aim': this.stAim(dt); break;
          case 'runup': this.stRunup(dt); break; case 'flight': this.stFlight(dt); break; case 'resolve': this.stResolve(dt); break; case 'outcome': this.stOutcome(dt); break;
        }
        if (this.state !== 'resolve' && this.state !== 'outcome') this.aiDefenders(dt); else this.aiDefendersLate(dt);
        if (!(this.keeper.mode === 'dive')) { if (this.state !== 'resolve') this.aiKeeper(dt); }
        this.aiReferee(dt);
        this.updateColliders(dt);
        for (const p of this.players) { p.update(dt); for (const e of p.drainEvents()) if (e.type === 'step') this.emit('step', { who: p.id, speed: e.speed, x: p.pos.x, z: p.pos.z }); else if (e.type === 'dive') this.emit('dive'); else if (e.type === 'contact' || e.type === 'trap') { /* handled via callbacks */ } }
        // ball
        if (this.keeper.holding && ball.held) { this.keeper.palmMid(ball.p); ball.v.set(0, 0, 0); ball.resting = true; ball.p.y = Math.max(ball.p.y, 0.11); }
        else if (this.owner && this.state === 'build' && this.owner.speed > 0.3) this.carry(dt);
        else if (this.owner && (this.state === 'prep' || this.state === 'aim' || this.state === 'runup') && false) { }
        else ball.advance(dt);
        this.postBall(dt);
      } else { for (const p of this.players) p.update(0); }
    },
    postBall() {
      const ball = this.ball;
      for (const e of ball.events) {
        if (e.type === 'net' && this.net) { this.net.hit(e.x, e.y, e.z, ball.v.x, ball.v.y, ball.v.z); }
        if (e.type === 'bounce' && e.strength < 2) continue; this.emit('ballHit', { kind: e.type, strength: e.strength, x: e.x, y: e.y, z: e.z });
      }
      ball.events.length = 0; ball.net.impacts.length = 0;
      if (ball.inGoal && !this.scored && (this.state === 'flight' || this.state === 'resolve')) { this.scored = true; this.emit('goalLine', { x: ball.p.x, y: ball.p.y }); }
    },

    /* ---------- states ---------- */
    stBuild(dt) {
      const o = this.owner, hp = this.holdPoint, r = this.rng;
      this.receiverRun(dt);
      // the carrier advances to the hold point, then stops with the ball at his feet
      const idle = o.speed < 0.25 && Math.hypot(hp.x - o.pos.x, hp.z - o.pos.z) < 0.4 && this.passN === 0 ? true : this.passN > 0;
      if (this.passN === 0 && !this.carrierStopped) { if (Math.hypot(hp.x - o.pos.x, hp.z - o.pos.z) > 0.4) { steer(o, hp.x, hp.z, 3.4, null, 2.0, this.separation(o, _s)); o.lookTarget = null; } else { o.setIntent(0, 0, Math.PI); if (o.speed < 0.25) { this.carrierStopped = true; this.holdBall(o, 0.5); this.ball.p.set(o.pos.x + Math.sin(o.yaw) * 0.5, 0.11, o.pos.z + Math.cos(o.yaw) * 0.5); } } }
      else if (this.passN > 0) { o.setIntent(0, 0, o.yaw); }
      const settled = (this.passN > 0 || this.carrierStopped);
      const arrived = ['S', 'W1', 'W2'].every(id => Math.hypot(this.P[id].pos.x - this.spot[id].x, this.P[id].pos.z - this.spot[id].z) < 1.3);
      if (!this.passReady && settled && ((arrived && this.stateT > 1.2) || this.stateT > 6)) { this.passReady = true; this.readyT = 0; this.emit('passReady', { options: this.passOptions() }); }
      if (this.passReady) { this.readyT += dt; if (this.mode === 'light' && this.readyT > 1.1) { const pick = this.passN === 0 ? (this.rng() < 0.5 ? 'S' : (this.rng() < 0.5 ? 'W1' : 'W2')) : 'S'; this.pass(pick); } }
      if (this.passN > 0) { const m = this.P.M; if (m !== o && !m.kickBusy()) { const s = this.supportSpot || (this.supportSpot = { x: 0, z: 10 }); steer(m, s.x, s.z, 4, angTo(m.pos, this.ball.p), 1.6, this.separation(m, _s)); } }
    },
    stPass(dt) {
      this.receiverRun(dt);
      const pp = this.pass_; if (this.passPhase === 2) {
        this.settleT += dt; const to = pp.to; to.lookTarget = null;
        if (this.settleT > 0.55) { this.lane = null; this.owner = to; if (this.passN < this.passesNeeded) { this.carrierStopped = true; this.passReady = true; this.setState('build'); this.passReady = true; this.readyT = 0; this.emit('passReady', { options: this.passOptions() }); } else { this.shooter = to; this.setState('prep'); } }
      }
      for (const q of [pp.from]) if (!q.kickBusy() && q.mode === 'loco') q.setIntent(0, 0, q.yaw);
    },
    stPrep(dt) {
      const sh = this.shooter, bp = this.ball.p; this.receiverRun(dt);
      // step round the ball to the run-up start (behind it, on the line to goal)
      const toGoal = _s; const gx = 0 - bp.x, gz = GZ - bp.z, l = Math.hypot(gx, gz), ux = gx / l, uz = gz / l;
      const px = bp.x - ux * 2.8, pz = bp.z - uz * 2.8; this.prepPoint = { x: px, z: pz };
      const d = Math.hypot(px - sh.pos.x, pz - sh.pos.z);
      steer(sh, px, pz, 2.6, d > 0.5 ? null : Math.atan2(ux, uz), 1.2, null); sh.lookTarget = this.ball.p;
      if ((d < 0.3 && sh.speed < 0.3 && this.stateT > 0.6) || this.stateT > 4) { this.setState('aim'); this.aimReady = true; this.emit('aimReady', { ball: { x: bp.x, z: bp.z }, shooter: sh.id }); }
    },
    stAim(dt) { const sh = this.shooter; this.receiverRun(dt); sh.setIntent(0, 0, angTo(sh.pos, { x: 0, z: GZ })); sh.lookTarget = this.ball.p; },
    stRunup(dt) {
      const sh = this.shooter, bp = this.ball.p; this.receiverRun(dt); this.aimReady = false;
      sh.lookTarget = this.ball.p;
      if (!this.ruPhase) this.ruPhase = 'back';
      const dStart = Math.hypot(this.runStart.x - sh.pos.x, this.runStart.z - sh.pos.z);
      const face = Math.atan2(this.shotDir.x, this.shotDir.z);
      if (this.ruPhase === 'back') { steer(sh, this.runStart.x, this.runStart.z, 3.0, face, 0.8, null); if (dStart < 0.45 || this.stateT > 1.6) { this.ruPhase = 'run'; this.ruT = 0; sh.maxSpeed = 6.2; sh.accel = 12; } }
      else {
        this.ruT += dt; steer(sh, this.anchor.x, this.anchor.z, 6.2, face, 0.2, null);
        const da = Math.hypot(this.anchor.x - sh.pos.x, this.anchor.z - sh.pos.z), need = Math.max(0.55, sh.speed * 0.26 * 0.9);
        if (da <= need + 0.02 || this.ruT > 1.4) { this.ruPhase = null; sh.maxSpeed = sh.baseSpeed; sh.accel = 10; sh.lookTarget = this.ball.p; const loft = clamp((this.target.y - 0.5) / 3, 0, 0.5);
          sh.startKick({ foot: this.shotFoot, ball: bp.clone().setY(0.11), dir: this.shotDir, power: this.aim.power, loft, type: 'shot', onContact: info => this.onShotContact(info) }); this.setState('strike'); this.emit('strikeStart'); }
      }
    },
    stFlight(dt) {
      const prog = this.progress(); this.shotT += dt; this.receiverRun(dt);
      const slow = smooth((prog - 0.36) / 0.16); this.timeScale = clamp(1 - slow * 0.96, 0.04, 1);
      if (prog >= 0.52 || (this.timeScale <= 0.045 && prog > 0.4)) { this.timeScale = 0; this.setState('frozen'); this.emit('freeze', { x: this.ball.p.x, y: this.ball.p.y, z: this.ball.p.z }); }
    },
    stResolve(dt) {
      const pl = this.plan, ball = this.ball, k = this.keeper; this.resumeT += dt;
      // safety net for a planned save: the ball is stopped when it passes within 25 cm of the diving keeper (the plan already aims the
      // hands at it; this only absorbs centimetre-level differences, so a wrong answer can never turn into a goal)
      if (pl && pl.outcome === 'save' && !pl.touched && !k.held && pl.diveStarted && ball.p.z > GZ - 0.2) {
        const sp = k.colliderSpheres('keeper', this._ssp || (this._ssp = []));
        for (const q of sp) if (Math.hypot(q.x - ball.p.x, q.y - ball.p.y, q.z - ball.p.z) < q.r + 0.11 + 0.25) { pl.touched = true; this.onGloveHit(ball); break; }
      }
      if (pl && pl.dive && !pl.diveStarted && this.resumeT >= pl.delay) { pl.diveStarted = true; k.ballRef = ball.p; k.startDive(pl.dive); }
      if (k.holding && ball.held) { this.holdT += dt; if (this.holdT > 1.5 && !k.diving()) { k.holding = false; k.held = false; ball.held = null; ball.v.set(0, 0, 0); ball.resting = false; } }
      if (this.stateT > 0.9 && !this.reacted) this.react();
      const calm = ball.v.length() < 0.35 && ball.resting; const done = this.stateT > 1.2 && (calm || this.stateT > 7) && !k.diving() && k.mode !== 'dive';
      if (done || (this.stateT > 2.2 && this.outcome === 'goal' && !k.diving() && ball.v.length() < 1.5)) { this.setState('outcome'); this.emit('outcomeReady', { outcome: this.outcome }); }
      this.receiverIdleAfter(dt);
    },
    stOutcome(dt) { this.receiverIdleAfter(dt); },
    receiverIdleAfter(dt) { for (const p of this.atk) { if (p.mode === 'loco' && !p.kickBusy()) { if (!p.fx && p.speed < 0.3) p.setIntent(0, 0, p.want.yaw === null ? p.yaw : p.want.yaw); } } },
    strikeDummy() { },
    aiDefendersLate(dt) { for (const p of this.defs) { if (p.mode === 'pose') continue; steer(p, p.pos.x, p.pos.z, 0, angTo(p.pos, this.ball.p), 1, null); } },
    react() {
      this.reacted = true; const o = this.outcome, sh = this.shooter;
      const pose = (p, kind, o2 = {}) => { if (p && p.mode !== 'kick' && p !== this.keeper) { p.setIntent(0, 0, null); p.startPose(kind, o2); } };
      if (o === 'goal') { pose(sh, this.rng() < 0.5 ? 'fist' : 'celebrate'); for (const id of ['S', 'W1', 'W2', 'C', 'M']) if (this.P[id] !== sh) { const p = this.P[id]; steer(p, sh.pos.x + (p.pos.x < sh.pos.x ? -2 : 2), sh.pos.z + 3, 4.5, null, 1); } for (const d of this.defs) pose(d, 'dejected', { dur: 99 }); }
      else if (o === 'save' || o === 'wide') { pose(sh, 'hands-head'); for (const d of this.defs) if (this.rng() < 0.3) pose(d, 'celebrate', { dur: 1.2 }); }
    },

    /* ---------- resolution planning ---------- */
    headlessKeeper() {
      if (this._shadow) return this._shadow;
      const sk = FB.Char.buildSkeleton(this.keeper.actor.man), root = new T.Group(); root.add(sk.hips);
      this._shadow = new FB.Keeper({ root, bones: sk.byName, boneList: sk.bones, man: this.keeper.actor.man, parts: {} });
      return this._shadow;
    },
    /** simulate a dive on a shadow keeper and measure how close the ball path (relative time from now) comes to its hands/body */
    simulateDive(spec, path, delay) {
      // the shadow keeper starts from the real keeper's exact state (position, velocity, feet, gait phase) and lives through the same
      // reaction delay, so the planned contact is the contact that will happen
      const sk = this.headlessKeeper(), k = this.keeper; sk.teleport(k.pos.x, k.pos.z, k.yaw); sk.crouch = k.crouch; sk.armsReady = k.armsReady;
      sk.vel.copy(k.vel); sk.speed = k.speed; sk.heading = k.heading; sk.gaitDir = k.gaitDir; sk.phase = k.phase; sk.cycleOn = k.cycleOn; sk.hipY = k.hipY;
      for (let i = 0; i < 2; i++) { const a = sk.feet[i], b = k.feet[i]; for (const key of ['swing', 'u', 'dur', 'y', 'pitch', 'yaw', 'lift', 'kick', 'liftPh', 'fromY', 'fromPitch']) a[key] = b[key]; a.p.copy(b.p); a.from.copy(b.from); a.to.copy(b.to); a.ax = b.ax; a.ay = b.ay; a.az = b.az; }
      sk.setIntent(0, 0, 0); for (let t = 0; t < delay - 1e-6; t += 1 / 120) sk.update(1 / 120);
      sk.ballRef = new V(path[0].x, path[0].y, path[0].z); sk.startDive(spec);
      let minC = 9, tMin = 0, pi = 0; const dt = 1 / 120, T1 = spec.tReach + (spec.hold || 0.28) + 0.9;
      for (let t = 0; t < T1; t += dt) {
        sk.update(dt); const tb = t + delay; while (pi < path.length - 1 && path[pi + 1].t <= tb) pi++;
        const b = path[Math.min(pi, path.length - 1)]; if (b.z > GZ + 6 || b.z < GZ - 3.5) continue;
        const sp = sk.colliderSpheres('keeper', []); for (let i = 0; i < sp.length; i++) { const s = sp[i], d = Math.hypot(s.x - b.x, s.y - b.y, s.z - b.z) - s.r - 0.11; if (d < minC) { minC = d; tMin = t; } }
      }
      return { minC, tMin };
    },
    planResolution(res) {
      const o = res.outcome, ball = this.ball, k = this.keeper, r = this.rng, delay = 0.1 + 0.05 * (2 - this.difficulty);
      const plan = { outcome: o, delay, dive: null, kind: null, parry: false, side: 1, variant: null };
      const pathNow = () => ball.predict(2.2, 1 / 120, null, true);
      const crossT = path => { for (const s of path) if (s.z <= GZ + 0.9) return s; return path[path.length - 1]; };
      const replan = (tx, ty) => { // new velocity so the ball (from its frozen state) crosses the goal plane at (tx, ty) in the remaining time, with the same physics
        const start = ball.p.clone(), speed = Math.max(10, Math.hypot(ball.v.x, ball.v.z)); const sol = FB.solveShot(start, new V(tx, ty, GZ), speed, null);
        ball.v.copy(sol.v); ball.resting = false; return sol; };
      if (o === 'pending') { // neutral: the ball loses its pace and simply rolls to a stop in front of the goal (no cheer, no groan)
        for (const f of [0.14, 0.09, 0.06, 0.04]) { const v0 = ball.v.clone(); ball.v.multiplyScalar(f); const s = ball.clone(); s.enableFrame = true; for (let i = 0; i < 4000 && (s.v.length() > 0.05); i++) s.step(FB.BALL_STEP); if (s.p.z > GZ + 3.5) break; ball.v.copy(v0); }
        ball.w.multiplyScalar(0.1); plan.variant = 'neutral'; return plan; }
      let path = pathNow(); const aim = this.target;
      if (o === 'goal') {
        // the finish must beat the keeper: try the aimed spot first, then move it progressively away from the keeper's body
        // (e.g. a central penalty with the keeper standing on the line) until a simulated dive the wrong way leaves it clear
        const kx = k.pos.x, away = Math.abs(aim.x - kx) > 0.05 ? Math.sign(aim.x - kx) : (r() < 0.5 ? 1 : -1);
        let best = null;
        for (const shift of [0, 0.6, 1.0, 1.4, 1.9, 2.4]) {
          const tx = clamp(aim.x + away * shift, -HW + 0.4, HW - 0.4), ty = clamp(aim.y, 0.3, GH - 0.35);
          const inGoal = (() => { const s = ball.clone(); s.enableFrame = true; for (let i = 0; i < 1500 && s.p.z > GZ - 3; i++) s.step(FB.BALL_STEP); return s.inGoal; })();
          if (shift > 0 || !inGoal) replan(tx, ty);
          path = pathNow(); const tb = crossT(path).t, sx = tx >= kx ? 1 : -1;
          const cands = [{ target: new V(kx - sx * 2.2, 0.95 + r() * 0.5, GZ + 0.55), tReach: Math.max(0.3, tb * 0.9) },
            { target: new V(kx - sx * 1.6, 1.2, GZ + 0.55), tReach: Math.max(0.3, tb * 0.85) }, { target: new V(tx + sx * 0.9, clamp(ty + 0.5, 0.5, 2.0), GZ + 0.5), tReach: tb + 0.2 }];
          let local = null;
          for (const c of cands) { const spec = Object.assign({ hold: 0.3 }, c), m = this.simulateDive(spec, path, delay); if (!local || m.minC > local.m.minC) local = { spec, m }; if (m.minC >= 0.14) break; }
          const still = { minC: 9 }; { const sp = k.colliderSpheres('keeper', []); for (const q of path) { if (q.z > GZ + 6 || q.z < GZ - 0.5) continue; for (const c of sp) still.minC = Math.min(still.minC, Math.hypot(c.x - q.x, c.y - q.y, c.z - q.z) - c.r - 0.11); } } // or the keeper simply stays
          if (still.minC > local.m.minC) local = { spec: null, m: still };
          if (!best || local.m.minC > best.m.minC) best = local;
          if (local.m.minC >= 0.14) { best = local; break; }
        }
        plan.dive = best.spec; plan.kind = 'beaten'; plan.clearance = best.m.minC; plan.variant = 'goal';
        if (best.spec && best.m.minC < 0.1) plan.dive = null;
        return plan;
      }
      if (o === 'save') {
        // keep the ball inside the keeper's reachable region; verify with the simulated dive and, if the hands would miss, bring the
        // shot progressively toward the keeper (small changes at the frozen moment are imperceptible). A wrong answer never scores.
        const cx = k.pos.x, tx0 = clamp(aim.x, cx - 2.2, cx + 2.2), ty0 = clamp(aim.y, 0.25, 1.9);
        let spec = null, m = null, cross = null, spd = 0;
        for (const f of [1, 0.8, 0.62, 0.45, 0.3, 0.15]) {
          const tx = cx + (tx0 - cx) * f, ty = lerp(1.0, ty0, Math.min(1, f + 0.2));
          if (f < 1 || Math.abs(tx - aim.x) > 0.02 || Math.abs(ty - aim.y) > 0.02) replan(tx, ty);
          path = pathNow(); cross = crossT(path); spd = Math.hypot(ball.v.x, ball.v.y, ball.v.z);
          const tReach = Math.max(0.28, cross.t - delay - 0.02), target = new V(cross.x, cross.y, GZ + 0.55);
          spec = { target, tReach, hold: 0.3, kind: 'dive' }; m = this.simulateDive(spec, path, delay);
          if (m.minC > -0.03) { const s2 = path.find(q => q.t >= tReach + delay) || cross; spec.target = new V(s2.x, s2.y, Math.max(GZ + 0.45, s2.z)); m = this.simulateDive(spec, path, delay); }
          if (m.minC <= -0.03) break;
        }
        plan.side = cross.x >= cx ? 1 : -1; plan.kind = (spd < 23.5 || (Math.abs(cross.x - cx) < 0.7 && cross.y < 1.6)) ? 'catch' : 'parry'; plan.parry = plan.kind === 'parry'; plan.variant = plan.kind;
        plan.dive = spec; plan.clearance = m.minC; return plan;
      }
      // wide
      const v = r(), sx = (Math.abs(aim.x) > 0.05 ? Math.sign(aim.x) : (r() < 0.5 ? 1 : -1));
      let variant = v < 0.4 ? 'side' : v < 0.7 ? 'over' : 'post', sol, tgt;
      const tryVariant = (name) => {
        tgt = name === 'side' ? new V(sx * (HW + 1.3 + r() * 1.2), 0.5 + r() * 1.3) : name === 'over' ? new V(clamp(aim.x, -2.4, 2.4), GH + 0.9 + r() * 1.1) : new V(sx * (HW + G.postR + 0.065), 0.9 + r() * 0.8);
        replan(tgt.x, tgt.y); const s = ball.clone(); s.enableFrame = true; let hitPost = false, scored = false; for (let i = 0; i < 2400; i++) { s.step(FB.BALL_STEP); if (s.events.some(e => e.type === 'post')) hitPost = true; s.events.length = 0; } scored = s.inGoal;
        return !scored && (name !== 'post' || hitPost);
      };
      if (!tryVariant(variant)) { variant = 'side'; tryVariant('side'); }
      plan.variant = variant; path = pathNow();
      if (variant === 'post' || (Math.abs(tgt.x) < HW + 2 && variant !== 'over')) {
        const cross = crossT(path), tReach = Math.max(0.3, cross.t + 0.15), target = new V(sx * Math.min(2.6, HW - 0.2), 1.2, GZ + 0.55), spec = { target, tReach, hold: 0.2 };
        const m = this.simulateDive(spec, path, delay); if (m.minC > 0.12) plan.dive = spec;
      }
      return plan;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
