/* Game modes on top of the match director (FB.Match):
 *   'penalties' — one shooter, one goalkeeper, the ball on the penalty spot; everyone else waits outside the area. aim -> run-up -> strike
 *                 -> flight -> FREEZE (question) -> resolve -> outcome. No passing, no build-up.
 *   'match'     — an interactive attacking phase: the student steers the ball carrier (dribbling), passes to AI teammates and shoots.
 *                 Defenders press and hold a line; a tackle or an interception is a turnover that restarts the attack WITHOUT using a
 *                 question. Only a shot leads to the question, and the received grade decides the physical outcome (goal / save / miss /
 *                 neutral) through the shared resolution planner — physics, defenders or difficulty can never contradict it.
 * The legacy scripted attack ('attack') stays available for compatibility. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, M = FB.math, { clamp, lerp } = M, G = FB.PITCH, GZ = G.goalZ, HW = G.goalHalf, GH = G.goalHeight;
  const Match = FB.Match, steer = FB.steer, P = Match.prototype;
  const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const _s = { x: 0, z: 0 };
  const SPOT_Z = GZ + 11, BOX_Z = GZ + G.penaltyDepth;

  const baseBegin = P.begin, baseUpdate = P.update, baseShoot = P.shoot, baseReceiverRun = P.receiverRun, baseAiDefenders = P.aiDefenders, baseAiReferee = P.aiReferee, baseOnTrap = P.onTrapContact;

  Object.assign(P, {
    /** gameMode: 'penalties' | 'match' | 'attack' (legacy scripted sequence) */
    setGameMode(gm) { this.gameMode = gm; },
    begin(round, mode, difficulty) {
      const gm = this.gameMode || 'attack';
      if (gm === 'penalties') return this.beginPenalty(round, difficulty);
      if (gm === 'match') return this.beginPlay(round, difficulty);
      return baseBegin.call(this, round, mode, difficulty);
    },
    _resetCommon(round, difficulty) {
      this.round = round; if (difficulty !== undefined) this.difficulty = difficulty; this.rng = M.rng((this.opts.seed || 1) * 7919 + round * 104729 + (this.attempt || 0) * 31 + 17);
      this.timeScale = 1; this.outcome = null; this.plan = null; this.lane = null; this.shooter = null; this.passN = 0; this.passReady = false; this.aimReady = false; this.fx = null;
      this.scored = false; this.reacted = false; this.ruPhase = null; this.sol = null; this.pass_ = null; this.owner = null; this.ctrl = null; this.turnoverWhy = null; this.input = { x: 0, z: 0, sprint: false };
      this.ball.parry = false; this.ball.held = null; this.ball.inGoal = false; if (this.net) this.net.reset(); this.keeper.held = false; this.keeper.holding = false;
      for (const p of this.players) { p.lookTarget = null; p.k = null; p.fx = null; p.mode = 'loco'; p.want.vx = p.want.vz = 0; p.want.yaw = null; p.maxSpeed = p.baseSpeed; p.accel = p === this.keeper ? 8 : 7; p.targetSpot = null; p.blendT = 1; }
    },
    _place(id, x, z, yaw) { const p = this.P[id]; p.teleport(x, z, yaw); p.crouch = id === 'K' ? 1 : 0; p.armsReady = id === 'K' ? 1 : 0; },

    /* ================= penalties ================= */
    beginPenalty(round, difficulty) {
      this._resetCommon(round, difficulty);
      const r = this.rng, j = a => (r() - 0.5) * a, back = Math.PI;
      this.ball.reset(0, 0.11, SPOT_Z); this.ball.resting = true; this.ball.v.set(0, 0, 0); this.ball.w.set(0, 0, 0);
      this.shooter = this.P.S; this._place('S', -0.85, SPOT_Z + 2.7, back - 0.25); this.P.S.lookTarget = this.ball.p;
      this._place('K', j(0.3), GZ + 0.35, 0); this.keeper.homeX = 0.2; this.keeper.ready();
      // everyone else waits outside the penalty area and the arc (>= 9.15 m from the spot), watching
      const spots = [['M', -5.5, 1.2], ['W1', -11.5, -2.0], ['W2', 11.0, -1.8], ['C', 4.5, 1.0], ['D1', -8.5, 0.2], ['D2', -2.0, 1.6], ['D3', 1.5, 1.8], ['D4', 8.0, -0.2]];
      for (const [id, x, z] of spots) { this._place(id, x + j(0.6), z + j(0.4), back + j(0.3)); this.P[id].lookTarget = this.ball.p; }
      this._place('R', 9.5, SPOT_Z + 3.5, angTo({ x: 9.5, z: SPOT_Z + 3.5 }, { x: 0, z: SPOT_Z })); this.P.R.lookTarget = this.ball.p;
      this.updateColliders(0); this.setState('aim'); this.aimReady = true; this.emit('whistle', { kind: 'start' }); this.emit('aimReady', { ball: { x: 0, z: SPOT_Z }, shooter: 'S', penalty: true });
    },

    /* ================= interactive match ================= */
    beginPlay(round, difficulty) {
      this._resetCommon(round, difficulty);
      const r = this.rng, j = a => (r() - 0.5) * a, up = Math.PI;
      this._place('M', j(3), 23, up); this._place('S', 2 + j(3), 9 + j(2), up); this._place('W1', -14, 15 + j(3), up); this._place('W2', 14, 15 + j(3), up); this._place('C', -4 + j(2), 30, up);
      this._place('D1', -12, 1 + j(1), 0); this._place('D2', -4, -1 + j(1), 0); this._place('D3', 4, -1 + j(1), 0); this._place('D4', 12, 1 + j(1), 0);
      this._place('K', 0, GZ + 0.9, 0); this.keeper.homeX = 0.2; this.keeper.ready(); this._place('R', -11, 34, up);
      this.owner = this.P.M; this.ctrl = this.P.M; this.holdBall(this.P.M, -0.55);
      this.pressT = 0; this.tackleT = 0; this.updateColliders(0); this.setState('play'); this.emit('whistle', { kind: 'start' }); this.emit('control', { who: 'M' });
    },
    /** world-space steering input for the controlled player, |(x,z)| <= 1 */
    setInput(x, z, sprint) { if (!this.input) this.input = { x: 0, z: 0, sprint: false }; const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } this.input.x = x; this.input.z = z; this.input.sprint = !!sprint; },
    /** can the controlled player shoot right now? (with the ball, inside ~32 m, not at a hopeless angle) */
    canShootPlay() {
      if (this.gameMode !== 'match' || this.state !== 'play' || !this.owner || this.owner !== this.ctrl || this.owner.kickBusy()) return false;
      const o = this.owner, d = Math.hypot(o.pos.x, o.pos.z - GZ); return d < 32 && o.pos.z > GZ + 4 && Math.abs(o.pos.x) < 22;
    },
    canPassPlay() { return this.gameMode === 'match' && this.state === 'play' && !!this.owner && this.owner === this.ctrl && !this.owner.kickBusy(); },
    shotDistance() { const o = this.owner; return o ? Math.hypot(o.pos.x, o.pos.z - GZ) : 99; },
    /** choose the teammate best aligned with (dx,dz) (or the most open one when there is no direction) */
    passTarget(dx, dz) {
      const o = this.owner; if (!o) return null; const l = Math.hypot(dx, dz); let best = null, bs = -1e9;
      for (const id of ['S', 'W1', 'W2', 'M', 'C']) {
        const p = this.P[id]; if (p === o) continue; const vx = p.pos.x - o.pos.x, vz = p.pos.z - o.pos.z, d = Math.hypot(vx, vz); if (d < 4 || d > 38) continue;
        let open = 9; for (const q of this.defs) open = Math.min(open, this.laneDist(q.pos, o.pos, p.pos));
        const align = l > 0.2 ? (vx * dx + vz * dz) / (d * l) : 0, fwd = -vz / d;
        const sc = (l > 0.2 ? align * 3 : 0) + Math.min(open, 3) * 0.6 + fwd * 0.8 - d * 0.02;
        if (sc > bs) { bs = sc; best = p; }
      }
      return best;
    },
    passPlay(dx, dz) {
      if (!this.canPassPlay()) return false; const to = this.passTarget(dx, dz); if (!to) return false;
      const from = this.owner, bp = this.ball.p; this.ball.v.set(0, 0, 0); this.ball.resting = true;
      this.passTo = to; this.passN++; this.setState('pass'); this.passPhase = 0; this.emit('passStart', { from: from.id, to: to.id });
      const inc = new V(to.pos.x - bp.x, 0, to.pos.z - bp.z).normalize(), lead = to.speed > 1 ? new V(to.vel.x, 0, to.vel.z).multiplyScalar(0.5) : new V();
      const arrive = new V(to.pos.x + lead.x - inc.x * 0.42, 0.11, to.pos.z + lead.z - inc.z * 0.42), dir = new V(arrive.x - bp.x, 0, arrive.z - bp.z), d = dir.length(); dir.normalize();
      let v0 = Math.sqrt(5.5 * 5.5 + 2 * 1.6 * d), tArr = 0;
      for (let it = 0; it < 10; it++) { const sim = new FB.Ball(); sim.enableFrame = false; sim.reset(bp.x, 0.11, bp.z); sim.v.set(dir.x * v0, 0, dir.z * v0); let t = 0; while (t < 4) { sim.step(FB.BALL_STEP); t += FB.BALL_STEP; if (Math.hypot(sim.p.x - bp.x, sim.p.z - bp.z) >= d) break; } const vs = sim.v.length(); tArr = t; if (Math.abs(vs - 5.5) < 0.12) break; v0 += (5.5 - vs) * 0.8; }
      this.pass_ = { from, to, dir, arrive, inc: dir.clone(), v0, tArr, bp: bp.clone(), play: true };
      this.lane = { a: { x: bp.x, z: bp.z }, b: { x: arrive.x, z: arrive.z } };
      from.setIntent(0, 0, null); from.startKick({ foot: this.footFor(from, dir), ball: bp.clone(), dir, power: 0.4, type: 'pass', onContact: info => this.onPassContact(info) });
      to.setIntent(0, 0, angTo(to.pos, bp)); to.lookTarget = this.ball.p; this.ctrl = to; this.emit('control', { who: to.id }); return true;
    },
    /** shot from open play: the carrier sets the ball and strikes it (aim x/y in [-1,1]/[0,1]) */
    shootPlay(aim) {
      if (!this.canShootPlay()) return false; const sh = this.owner;
      this.shooter = sh; this.state = 'aim';                                             // let the shared shoot() set up target, lane and anchor
      const b = this.ball; b.v.set(0, 0, 0); b.w.set(0, 0, 0); b.resting = true;         // a last touch sets the ball still in front of the shooter
      const ok = baseShoot.call(this, aim); if (!ok) { this.state = 'play'; return false; }
      this.ruPhase = 'run'; this.ruT = 0; sh.maxSpeed = 6.2; sh.accel = 9; this.owner = null; return true;
    },
    onTrapContact(info) {
      baseOnTrap.call(this, info);
      if (this.pass_ && this.pass_.play) { this.ctrl = this.pass_.to; }
    },
    update(rdt) {
      const st = this.state;
      if (st === 'play' || st === 'turnover' || (st === 'pass' && this.pass_ && this.pass_.play)) return this.updatePlay(rdt);
      return baseUpdate.call(this, rdt);
    },
    updatePlay(rdt) {
      const dt = rdt * this.timeScale; this.t += dt; this.stateT = (this.stateT || 0) + dt;
      const ball = this.ball, st = this.state;
      if (st === 'play') this.stPlay(dt); else if (st === 'pass') this.stPlayPass(dt); else this.stTurnover(dt);
      this.aiPlayDefenders(dt); this.aiKeeper(dt); baseAiReferee.call(this, dt); this.aiSupport(dt);
      this.updateColliders(dt);
      for (const p of this.players) { p.update(dt); for (const e of p.drainEvents()) if (e.type === 'step') this.emit('step', { who: p.id, speed: e.speed, x: p.pos.x, z: p.pos.z }); }
      if (this.owner && this.state === 'play') this.carry(dt); else ball.advance(dt);
      this.postBall(dt);
      if (this.state === 'play' || this.state === 'pass') this.checkBounds();
    },
    stPlay(dt) {
      const o = this.owner, c = this.ctrl || o; if (!c) return;
      const sp = (o === c ? 4.9 : 5.6) * (this.input.sprint ? 1.12 : 1), ix = this.input.x, iz = this.input.z;
      if (!c.kickBusy()) { c.maxSpeed = Math.max(c.baseSpeed, sp); c.setIntent(ix * sp, iz * sp, null); c.lookTarget = null; }
      // pressure and tackles: the presser wins the ball only by actually reaching it, more often when the carrier is standing still
      const pr = this.presser;
      if (o && pr && !o.kickBusy()) {
        const d = dist(pr.pos, ball_(this)); if (d < 0.72) this.tackleT += dt; else this.tackleT = Math.max(0, this.tackleT - dt);
        const rate = [0.35, 0.6, 0.9][this.difficulty | 0] * (o.speed < 1.5 ? 1.6 : 0.8) * (this.ease || 1);
        if (this.tackleT > 0.35 && this.rng() < rate * dt) this.turnover('tackle', pr);
      }
    },
    stPlayPass(dt) {
      const pp = this.pass_; if (!pp) { this.setState('play'); return; }
      // interception: a defender whose body is on the ball's path can cut it out (only if he really touches it)
      if (this.passPhase === 1) {
        const b = this.ball.p; for (const d of this.defs) { if (dist(d.pos, b) < 0.75 && b.y < 1.1 && !d.kickBusy()) { if (this.rng() < [0.35, 0.55, 0.75][this.difficulty | 0] * (this.ease || 1)) { this.turnover('intercept', d); return; } else d._missedPass = this.t; } }
      }
      if (this.passPhase === 2) { this.settleT += dt; if (this.settleT > 0.3) { this.lane = null; this.owner = pp.to; this.ctrl = pp.to; pp.to.lookTarget = null; this.setState('play'); this.emit('control', { who: pp.to.id }); } }
      if (!pp.from.kickBusy() && pp.from.mode === 'loco') pp.from.setIntent(0, 0, pp.from.yaw);
    },
    stTurnover(dt) { for (const p of this.atk) if (p.mode === 'loco' && !p.kickBusy()) p.setIntent(0, 0, angTo(p.pos, this.ball.p)); },
    turnover(why, by) {
      if (this.state === 'turnover') return; const b = this.ball, o = this.owner;
      if (o && o.kickBusy && o.kickBusy()) o.cancelKick(); if (this.pass_ && this.pass_.to && this.pass_.to.kickBusy()) this.pass_.to.cancelKick();
      this.owner = null; this.ctrl = null; this.lane = null; this.turnoverWhy = why;
      const dir = by ? new V(Math.sin(by.yaw), 0, Math.cos(by.yaw)) : new V(0, 0, 1);
      b.v.set(dir.x * 4.5, 0.4, dir.z * 4.5); b.resting = false; b.w.set(0, 0, 0);
      this.setState('turnover'); this.emit('turnover', { why, by: by ? by.id : null });
      this.ease = Math.max(0.45, (this.ease || 1) * 0.8);                                // each lost ball makes the next attack a little easier
    },
    checkBounds() {
      const b = this.ball.p; if (Math.abs(b.x) > G.width / 2 - 0.3 || b.z > G.centerZ + 8 || b.z < GZ + 0.2) { this.turnover('out', null); }
    },
    /** AI teammates offer passing options around the ball carrier: wide wingers, a striker running in behind, support from behind */
    aiSupport(dt) {
      const o = this.owner || (this.pass_ && this.pass_.to) || this.P.M, bx = this.ball.p.x, bz = this.ball.p.z;
      const spots = {
        W1: { x: -13.5, z: clamp(bz - 5, GZ + 9, 30) }, W2: { x: 13.5, z: clamp(bz - 5, GZ + 9, 30) },
        S: { x: clamp(bx * 0.35 + (bx > 0 ? -3 : 3), -8, 8), z: clamp(bz - 9, GZ + 7, 24) },
        M: { x: clamp(bx + (bx > 0 ? -6 : 6), -14, 14), z: clamp(bz + 5, GZ + 14, 34) }, C: { x: clamp(bx * 0.5, -10, 10), z: clamp(bz + 10, GZ + 18, 38) }
      };
      for (const id of ['S', 'W1', 'W2', 'M', 'C']) {
        const p = this.P[id]; if (p === this.ctrl || p === this.owner || p.kickBusy() || p.mode === 'pose') continue;
        if (this.pass_ && this.state === 'pass' && p === this.pass_.to) continue;
        let s = spots[id]; if (this.lane) { const [tx, tz] = this.clearLane(s.x, s.z, this.lane, 1.4); s = { x: tx, z: tz }; }
        const d = dist(p.pos, s), sep = this.separation(p, _s);
        steer(p, s.x, s.z, d > 3 ? p.baseSpeed * 0.92 : 2.2, d > 2.2 ? null : angTo(p.pos, this.ball.p), 2.0, sep);
      }
    },
    /** defenders: the nearest one presses the ball (jockeying goal-side), the others hold a compact zonal line and track runners */
    aiPlayDefenders(dt) {
      const b = this.ball.p, diff = this.difficulty, holder = this.owner || (this.pass_ && this.state === 'pass' ? this.pass_.to : null);
      let pr = null, pd = 1e9; for (const d of this.defs) { const dd = dist(d.pos, b); if (dd < pd) { pd = dd; pr = d; } }
      this.presser = this.state === 'play' || this.state === 'pass' ? pr : null;
      const lineZ = clamp(b.z - 7, GZ + 6, 6), shift = clamp(b.x * 0.35, -6, 6), xs = [-13, -4.5, 4.5, 13];
      for (let i = 0; i < this.defs.length; i++) {
        const p = this.defs[i]; if (p.mode === 'pose') continue; let tx, tz, face = angTo(p.pos, b), spd = p.baseSpeed * (0.82 + 0.08 * diff) * (this.ease || 1);
        if (p === this.presser && holder) {                                    // close down: stand ~1 m goal-side of the ball, facing it
          const gx = 0 - b.x, gz = GZ - b.z, gl = Math.hypot(gx, gz) || 1; tx = b.x + gx / gl * 1.0; tz = b.z + gz / gl * 1.0;
          spd *= 0.95;
        } else if (p === this.presser) { tx = b.x; tz = b.z; spd *= 0.8; }  // loose ball: go and get it
        else {
          tx = xs[i] + shift; tz = lineZ + Math.abs(xs[i]) * 0.08;
          // track the nearest attacking runner in this zone, staying goal-side
          let near = null, nd = 7; for (const a of this.atk) { const ad = Math.hypot(a.pos.x - tx, a.pos.z - tz); if (ad < nd) { nd = ad; near = a; } }
          if (near) { tx = lerp(tx, near.pos.x, 0.55); tz = Math.min(tz, near.pos.z - 1.6); }
        }
        tz = Math.max(tz, GZ + 2.5);
        if (this.lane) { [tx, tz] = this.clearLane(tx, tz, this.lane, 1.6); if (this.state !== 'pass') this.laneGuard(p, 1.15); }
        const far = Math.hypot(tx - p.pos.x, tz - p.pos.z) > 2.2;
        steer(p, tx, tz, spd, far ? null : face, 1.2, this.separation(p, _s));
      }
    },

    /* ---------------- shared hooks ---------------- */
    receiverRun(dt) {
      if (this.gameMode === 'penalties') { for (const p of this.players) if (p !== this.shooter && p !== this.keeper && p.mode === 'loco' && !p.kickBusy()) p.setIntent(0, 0, angTo(p.pos, this.ball.p)); return; }
      if (this.gameMode === 'match') return this.aiSupport(dt);
      return baseReceiverRun.call(this, dt);
    },
    aiDefenders(dt) {
      if (this.gameMode === 'penalties') return;                               // they wait outside the area
      if (this.gameMode === 'match') return this.aiPlayDefenders(dt);
      return baseAiDefenders.call(this, dt);
    },
    aiReferee(dt) { if (this.gameMode === 'penalties') { const r = this.P.R; r.setIntent(0, 0, angTo(r.pos, this.ball.p)); r.lookTarget = this.ball.p; return; } return baseAiReferee.call(this, dt); }
  });
  function ball_(m) { return m.ball.p; }
})(typeof window !== 'undefined' ? window : globalThis);
