/* Match director: squads, AI (spacing, supporting runs, marking, goalkeeper), and the scripted-but-physical attack sequence
 *   build-up -> pass(es) -> first touch -> set-up -> aim -> run-up -> strike -> flight -> FREEZE (question) -> resolve (goal / save / wide / pending)
 * Everything visible is caused by something physical: feet strike the ball at the contact event, the ball obeys FB.Ball, the keeper's hands
 * are collision spheres. The *result* of the sequence (goal / save / wide) is chosen from the server-confirmed grading, never decided here. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, M = FB.math, { clamp, lerp } = M, G = FB.PITCH;
  const GZ = G.goalZ, HW = G.goalHalf, GH = G.goalHeight;
  const _a = new V(), _b = new V(), _c = new V();
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  /** steer a player towards (tx,tz) with arrival slow-down; face = yaw or null (face the velocity) */
  function steer(p, tx, tz, speed, face = null, arrive = 1.6, avoid = null) {
    let dx = tx - p.pos.x, dz = tz - p.pos.z; const d = Math.hypot(dx, dz);
    let vx = 0, vz = 0; if (d > 0.04) { const v = speed * Math.min(1, d / arrive); vx = dx / d * v; vz = dz / d * v; }
    if (avoid) { vx += avoid.x; vz += avoid.z; }
    p.setIntent(vx, vz, face);
  }

  const ROLES = {
    M: { team: 'home', kit: 'home', build: 'athlete', number: 8, speed: 4.2 }, S: { team: 'home', kit: 'home', build: 'athlete', number: 9, speed: 5.6 },
    W1: { team: 'home', kit: 'home', build: 'runner', number: 11, speed: 5.6 }, W2: { team: 'home', kit: 'home', build: 'runner', number: 7, speed: 5.6 },
    C: { team: 'home', kit: 'home', build: 'athlete', number: 6, speed: 5 },
    D1: { team: 'away', kit: 'away', build: 'athlete', number: 4, speed: 4.8 }, D2: { team: 'away', kit: 'away', build: 'runner', number: 5, speed: 4.8 },
    D3: { team: 'away', kit: 'away', build: 'athlete', number: 3, speed: 4.8 }, D4: { team: 'away', kit: 'away', build: 'runner', number: 2, speed: 4.8 },
    K: { team: 'away', kit: 'keeperAway', build: 'keeper', number: 1, speed: 3.4, keeper: true }, R: { team: 'ref', kit: 'ref', build: 'runner', number: 0, speed: 4.6 }
  };
  const TONES = [2, 3, 1, 4, 2, 1, 3, 4, 0, 2, 1];
  const HAIR = ['crop', 'short', 'buzz', 'curly', 'crop', 'short', 'long', 'buzz', 'short', 'crop', 'short'];

  class Match {
    /** opts: {makeActor(spec)->actor, seed, difficulty:0..2, mode:'light'|'standard'|'pro', net, onEvent} */
    constructor(opts) {
      this.opts = opts; this.ball = new FB.Ball(); this.net = opts.net || null; this.rng = M.rng(opts.seed || 1); this.events = []; this.t = 0; this.timeScale = 1;
      this.players = []; this.P = {}; let i = 0;
      for (const [id, r] of Object.entries(ROLES)) {
        const spec = Object.assign({ id, tone: FB.Char.SKIN_TONES[TONES[i % TONES.length]], hair: HAIR[i % HAIR.length], seed: i + 3, stubble: i % 3 === 0 }, r), actor = opts.makeActor(spec);
        const pl = r.keeper ? new FB.Keeper(actor, { seed: i + 1 }) : new FB.Player(actor, { seed: i + 1 });
        pl.id = id; pl.role = id; pl.team = r.team; pl.baseSpeed = r.speed; pl.maxSpeed = r.speed; pl.spec = spec; this.P[id] = pl; this.players.push(pl); i++;
      }
      this.keeper = this.P.K; this.defs = [this.P.D1, this.P.D2, this.P.D3, this.P.D4]; this.atk = [this.P.M, this.P.S, this.P.W1, this.P.W2, this.P.C];
      this.colliders = {}; this.ball.colliders = [];
      this.state = 'idle'; this.mode = opts.mode || 'standard'; this.difficulty = opts.difficulty === undefined ? 1 : opts.difficulty; this.round = 0;
      this.owner = null; this.shooter = null; this.lane = null; this.passReady = false; this.aimReady = false; this.outcome = null; this.plan = null;
      this.ball.reset(0, 0.11, 24);
    }
    emit(type, o = {}) { const e = Object.assign({ type, t: this.t }, o); this.events.push(e); if (this.opts.onEvent) this.opts.onEvent(e); return e; }
    drain() { const e = this.events; this.events = []; return e; }
    setState(s) { this.state = s; this.stateT = 0; this.emit('state', { state: s }); }

    /* ---------------- round setup ---------------- */
    begin(round, mode, difficulty) {
      this.round = round; if (mode) this.mode = mode; if (difficulty !== undefined) this.difficulty = difficulty; this.rng = M.rng((this.opts.seed || 1) * 7919 + round * 104729 + 17);
      const r = this.rng, j = (a) => (r() - 0.5) * a;
      this.timeScale = 1; this.outcome = null; this.plan = null; this.lane = null; this.shooter = null; this.passN = 0; this.passesNeeded = this.mode === 'pro' ? 2 : 1; this.passReady = false; this.aimReady = false; this.fx = null;
      const place = (id, x, z, yaw = Math.PI) => { const p = this.P[id]; p.teleport(x, z, yaw); p.crouch = id === 'K' ? 1 : 0; p.armsReady = id === 'K' ? 1 : 0; p.lookTarget = null; p.k = null; p.fx = null; p.mode = 'loco'; p.want.vx = p.want.vz = 0; p.want.yaw = null; p.maxSpeed = p.baseSpeed; p.targetSpot = null; };
      this.spot = { S: { x: 2 + j(5), z: -4 + j(1.2) }, W1: { x: -10 + j(2), z: -2 + j(1.5) }, W2: { x: 10 + j(2), z: -2 + j(1.5) }, C: { x: 4 + j(3), z: 12 + j(2) } };
      place('M', -2 + j(3), 28); place('S', 3 + j(4), 16); place('W1', -17, 22 + j(3)); place('W2', 16, 24 + j(3)); place('C', 7 + j(2), 36);
      const lineZ = -6.5;
      place('D1', -14, lineZ + 3); place('D2', -5, lineZ + 2); place('D3', 4, lineZ + 2); place('D4', 13, lineZ + 3);
      place('K', 0.3 * j(2), GZ + 0.9, 0); place('R', -10, 38, 0);
      this.keeper.homeX = 0.2; this.keeper.ready();
      this.ball.reset(this.P.M.pos.x, 0.11, this.P.M.pos.z - 0.5); this.ball.parry = false; this.ball.held = null; if (this.net) this.net.reset();
      this.owner = this.P.M; this.holdBall(this.P.M, -0.5); this.holdPoint = { x: this.P.M.pos.x * 0.5, z: 22 + j(2) };
      this.updateColliders(0); this.setState('build'); this.emit('whistle', { kind: 'start' });
    }
    /** ball sits at rest in front of the owner (distance d along the owner's facing, negative = toward -z world) */
    holdBall(p, d = 0.5) { const y = p.yaw; this.ball.reset(p.pos.x + Math.sin(y) * Math.abs(d), 0.11, p.pos.z + Math.cos(y) * Math.abs(d)); }

    /* ---------------- helpers ---------------- */
    passOptions() { return ['W1', 'S', 'W2'].concat(this.mode === 'pro' && this.passN === 1 ? ['M'] : []).map(id => this.P[id]).filter(p => p !== this.owner).map(p => ({ id: p.id, number: p.spec.number, x: p.pos.x, z: p.pos.z })); }
    ballSpeed() { return this.ball.v.length(); }
    laneDist(pt, a, b) { // distance from pt to segment a-b on the pitch plane
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = clamp(((pt.x - a.x) * dx + (pt.z - a.z) * dz) / l2, 0, 1);
      return Math.hypot(pt.x - (a.x + dx * t), pt.z - (a.z + dz * t));
    }
    /** push a defender target sideways so its body is >= margin from the active lane */
    clearLane(tx, tz, lane, margin) {
      if (!lane) return [tx, tz]; const d = this.laneDist({ x: tx, z: tz }, lane.a, lane.b); if (d >= margin) return [tx, tz];
      const dx = lane.b.x - lane.a.x, dz = lane.b.z - lane.a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      const side = ((tx - lane.a.x) * nx + (tz - lane.a.z) * nz) >= 0 ? 1 : -1; const push = margin - d + 0.15;
      return [tx + nx * side * push, tz + nz * side * push];
    }
    /** hard guarantee: a defender body never sits inside the active lane (nudged kinematically if steering/separation drifted it in) */
    laneGuard(p, margin) {
      const lane = this.lane; if (!lane) return; const d = this.laneDist(p.pos, lane.a, lane.b); if (d >= margin) return;
      const dx = lane.b.x - lane.a.x, dz = lane.b.z - lane.a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      const side = ((p.pos.x - lane.a.x) * nx + (p.pos.z - lane.a.z) * nz) >= 0 ? 1 : -1, push = Math.min(margin - d, 0.08);
      p.pos.x += nx * side * push; p.pos.z += nz * side * push; if (p.vel) { p.vel.x += nx * side * 0.5; p.vel.z += nz * side * 0.5; }
    }
    separation(p, out) {
      out.x = out.z = 0;
      for (const q of this.players) { if (q === p) continue; const dx = p.pos.x - q.pos.x, dz = p.pos.z - q.pos.z, d = Math.hypot(dx, dz); if (d < 1.05 && d > 1e-3) { const k = (1.05 - d) * 3.2 / d; out.x += dx * k; out.z += dz * k; } }
      return out;
    }

    /* ---------------- AI ---------------- */
    aiDefenders(dt) {
      const b = this.ball.p, M = this.P.M; const diff = this.difficulty;
      const marks = [this.P.W1, this.P.S, this.P.W2];
      const slots = [this.P.D1, this.P.D2, this.P.D3, this.P.D4];
      const targets = [];
      // outer defenders mark the wingers goal-side, middle two cover the striker and the space behind the ball
      const mk = (att, off) => [att.pos.x * 0.92 + off, Math.min(att.pos.z - 2.3, -3.2)];
      targets[0] = mk(this.P.W1, 0.9); targets[3] = mk(this.P.W2, -0.9);
      targets[1] = mk(this.P.S, -1.4 + 0); targets[2] = [clamp(b.x * 0.45, -7, 7) + 1.4, clamp(-5.5 + (b.z - 10) * 0.06, -8, -3.5)];
      for (let i = 0; i < 4; i++) {
        const p = slots[i]; let [tx, tz] = targets[i]; tz = Math.max(tz, GZ + 6.5);
        { // never stand inside the cone between the ball and the goal mouth (they cut the angle from the sides instead)
          const B = b, tt = (B.z - tz) / (B.z - GZ), m = 1.0;
          if (tt > 0.04 && tt < 1.02) { const xl = B.x + (-HW - B.x) * tt - m, xr = B.x + (HW - B.x) * tt + m; if (tx > xl && tx < xr) tx = (tx - xl < xr - tx) ? xl : xr; }
        }
        if (this.lane) { [tx, tz] = this.clearLane(tx, tz, this.lane, 1.6); this.laneGuard(p, 1.15); }
        const sep = this.separation(p, _a); const face = angTo(p.pos, { x: b.x, z: b.z });
        steer(p, tx, tz, p.baseSpeed * (0.8 + 0.1 * diff), face, 1.4, sep);
      }
    }
    aiKeeper(dt) {
      const k = this.keeper, b = this.ball.p; if (k.mode === 'dive') return;
      const bz = Math.max(b.z, GZ + 2), dz = bz - GZ, x = clamp(b.x * (3.4 / Math.max(6, dz)) * 1.5, -2.4, 2.4);
      const zOff = GZ + clamp(0.7 + (28 - dz) * 0.02, 0.7, 1.3);
      steer(k, x, zOff, 2.4 + 0.5 * this.difficulty, angTo(k.pos, b), 1.0, null);
      k.lookTarget = this.ball.p;
    }
    aiReferee(dt) { const r = this.P.R, b = this.ball.p; steer(r, b.x + (b.x > 0 ? -11 : 11), b.z + 12, 4.2, angTo(r.pos, b), 4, this.separation(r, _a)); r.lookTarget = this.ball.p; }

    /* ---------------- ball ownership ---------------- */
    carry(dt) { // kinematic dribble: the owner pushes the ball a short way ahead with every stride
      const o = this.owner, b = this.ball, sp = o.speed; if (sp < 0.3) return;
      const hx = o.vel.x / sp, hz = o.vel.z / sp, ph = (o.stepCount * 0.5 + o.feet[0].u * 0.5) % 1, push = 0.42 + 0.22 * (0.5 + 0.5 * Math.sin(ph * Math.PI * 2));
      b.p.set(o.pos.x + hx * push, 0.11, o.pos.z + hz * push); b.v.set(o.vel.x, 0, o.vel.z); b.w.set(o.vel.z / 0.11, 0, -o.vel.x / 0.11); b.resting = true;
    }
    receiverRun(dt) { // teammates make runs to their spots and wait there facing the ball
      const bz = this.ball.p;
      for (const id of ['S', 'W1', 'W2', 'C']) {
        const p = this.P[id]; if (p === this.owner || p === this.shooter || p.kickBusy() || p.mode === 'pose') continue;
        const s = this.spot[id], sep = this.separation(p, _a);
        steer(p, s.x, s.z, p.baseSpeed, p.pos.z > s.z + 3 ? null : angTo(p.pos, this.owner ? this.owner.pos : bz), 1.8, sep);
      }
    }

    /* ---------------- public: pass / shoot / resolve ---------------- */
    canPass() { return this.state === 'build' && this.passReady; }
    pass(id) {
      if (!this.canPass()) return false; const to = this.P[id], from = this.owner; if (!to || to === from) return false;
      this.passTo = to; this.passN++; this.setState('pass'); this.passPhase = 0; this.emit('passStart', { from: from.id, to: id });
      // geometry: ball at rest in front of the passer; arrival point 0.42 m in front of the receiver (who faces the ball)
      const bp = this.ball.p, inc = _a.set(to.pos.x - bp.x, 0, to.pos.z - bp.z).normalize();
      const arrive = new V(to.pos.x - inc.x * 0.42, 0.11, to.pos.z - inc.z * 0.42), dir = new V(arrive.x - bp.x, 0, arrive.z - bp.z), d = dir.length(); dir.normalize();
      // pass speed such that the ball arrives with ~3.5 m/s (solved with the real rolling model)
      let v0 = Math.sqrt(5.0 * 5.0 + 2 * 1.6 * d), tArr = 0;
      for (let it = 0; it < 10; it++) { const sim = new FB.Ball(); sim.enableFrame = false; sim.reset(bp.x, 0.11, bp.z); sim.v.set(dir.x * v0, 0, dir.z * v0); let t = 0; while (t < 4) { sim.step(FB.BALL_STEP); t += FB.BALL_STEP; if (Math.hypot(sim.p.x - bp.x, sim.p.z - bp.z) >= d) break; } const vs = sim.v.length(); tArr = t; if (Math.abs(vs - 5.0) < 0.12) break; v0 += (5.0 - vs) * 0.8; }
      this.pass_ = { from, to, dir, arrive, inc: dir.clone(), v0, tArr, bp: bp.clone() };
      this.lane = { a: { x: bp.x, z: bp.z }, b: { x: arrive.x, z: arrive.z } };
      const foot = this.footFor(from, dir);
      from.maxSpeed = from.baseSpeed; from.setIntent(0, 0, null);
      from.startKick({ foot, ball: bp, dir, power: 0.35, type: 'pass', onContact: info => this.onPassContact(info) });
      to.setIntent(0, 0, angTo(to.pos, bp)); to.lookTarget = this.ball.p; return true;
    }
    footFor(p, dir) { const c = Math.cos(p.yaw), s = Math.sin(p.yaw), lx = dir.x * c - dir.z * s; return lx > 0.25 ? 'L' : 'R'; }
    onPassContact(info) {
      const P = this.pass_, b = this.ball; b.p.copy(info.ball); b.p.y = 0.11; b.v.set(P.dir.x * P.v0, 0, P.dir.z * P.v0); b.w.set(P.dir.z * P.v0 / 0.11, 0, -P.dir.x * P.v0 / 0.11); b.resting = true;
      this.emit('kick', { kind: 'pass', power: 0.4 }); this.owner = null;
      P.to.startTrap({ foot: this.footFor(P.to, new V(-P.inc.x, 0, -P.inc.z)) === 'L' ? 'L' : 'R', arrive: P.arrive, inc: P.inc, tArrive: Math.max(0.3, P.tArr - 0.0), onContact: i => this.onTrapContact(i) });
      this.passPhase = 1; this.emit('passFlight', { tArrive: P.tArr });
    }
    onTrapContact(info) {
      const b = this.ball; b.v.multiplyScalar(0.06); b.w.multiplyScalar(0.1); b.resting = true; this.owner = this.pass_.to; this.emit('touch', { kind: 'trap', strength: 3 });
      this.holdPos = b.p.clone(); this.passPhase = 2; this.settleT = 0;
    }
    /** aim: x in [-1,1] (left..right across the goal), y in [0,1] (low..high), power in [0,1]. returns false when not ready */
    shoot(aim) {
      if (this.state !== 'aim') return false; const a = this.aim = { x: clamp(aim.x, -1, 1), y: clamp(aim.y, 0, 1), power: clamp(aim.power === undefined ? 0.7 : aim.power, 0.2, 1) };
      this.target = new V(a.x * (HW - 0.4), 0.28 + a.y * (GH - 0.62), GZ);
      const sh = this.shooter, bp = this.ball.p; this.shotDir = new V(this.target.x - bp.x, 0, this.target.z - bp.z).normalize();
      this.shotFoot = this.footFor(sh, this.shotDir) === 'L' ? 'L' : 'R';
      this.shotSpeed = 18 + 10 * a.power; this.lane = { a: { x: bp.x, z: bp.z }, b: { x: this.target.x, z: GZ } };
      // run-up start: behind the ball on the line to the goal, slightly offset to the kicking side
      const back = this.shotDir.clone().multiplyScalar(-1), side = new V(this.shotDir.z, 0, -this.shotDir.x).multiplyScalar(this.shotFoot === 'R' ? -1 : 1);
      this.runStart = new V(bp.x + back.x * 2.8 + side.x * 0.9, 0, bp.z + back.z * 2.8 + side.z * 0.9);
      this.anchor = sh.kickAnchor(bp, this.shotDir, this.shotFoot, new V());
      this.recStart = this.t; this.setState('runup'); this.emit('runupStart'); this.emit('whistle', { kind: 'shot' }); return true;
    }
    solveAim() {
      const bp = this.ball.p; return FB.solveShot(new V(bp.x, 0.11, bp.z), this.target, this.shotSpeed, null);
    }
    onShotContact(info) {
      const b = this.ball, sh = this.shooter; b.p.copy(info.ball); b.p.y = 0.11;
      const sol = FB.solveShot(b.p.clone(), this.target, this.shotSpeed, null); this.sol = sol;
      b.v.copy(sol.v); b.w.set(-sol.v.z * 0.7, 0, sol.v.x * 0.7); b.resting = false; b.enableFrame = true; this.owner = null;
      this.shotStartZ = b.p.z; this.shotT = 0; this.emit('kick', { kind: 'shot', power: this.aim.power, speed: sol.v.length() }); this.setState('flight');
      // keeper anticipates: a small read step toward the aimed side (purely visual; the result is decided at resolve)
      this.keeper.armsReady = 1;
    }
    progress() { const z0 = this.shotStartZ, z = this.ball.p.z; return clamp((z0 - z) / (z0 - GZ), 0, 1.2); }

    /** result: {outcome:'goal'|'save'|'wide'|'pending', variant?} -> plan the physical resolution of the frozen shot */
    resolve(res) {
      if (this.state !== 'frozen') return false; this.outcome = res.outcome; this.variant = res.variant || null; this.plan = this.planResolution(res); this.timeScale = 1; this.resumeT = 0; this.setState('resolve');
      this.emit('resolve', { outcome: res.outcome, variant: this.plan && this.plan.variant }); return true;
    }
  }
  FB.Match = Match; FB.steer = steer;
})(typeof window !== 'undefined' ? window : globalThis);
