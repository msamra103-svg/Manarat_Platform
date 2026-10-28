/* صيد الأسماك V24 — fishing action simulation (deterministic, fixed 120 Hz step, no THREE / DOM).
 * Owns the boat, rod, line, rig, fish, fight, landing net and the angler's high-level pose targets.
 * Educational contract: the sim never grades. resolve({correct,pending}) decides catch / escape / neutral review.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const P = node ? require('./fishing-physics.js') : root.FishingPhysics;
  const F = node ? require('./fishing-fish.js') : root.FishingFish;
  const { V, clamp, lerp, smooth, smoother, Sea, BoatMotion, Rod, Rope, Ballistic } = P;
  const STEP = 1 / 120;
  const FEET = [0.36, 0.02, 0.22];              // angler's feet in the boat frame (boat long axis = X, sea side = -Z)
  const COOLER = [-0.95, 0.0, -0.18];           // ice box on the boat floor (boat frame)
  const REEL = { s: 0.36, drop: 0.085, crank: 0.052, side: 0.072, perTurn: 0.72, ratio: 5.2 };

  /* angler poses in the character frame (+Z forward, +Y up, +X = angler's left). G = right-hand grip, e = rod elevation */
  const POSES = {
    idle: { G: [-0.17, 0.99, 0.24], e: 0.78, lean: 0.02, crouch: 0.0 },
    ready: { G: [-0.17, 1.03, 0.3], e: 0.56, lean: 0.05, crouch: 0.03 },
    wait: { G: [-0.17, 1.01, 0.31], e: 0.44, lean: 0.06, crouch: 0.04 },
    alert: { G: [-0.17, 1.05, 0.34], e: 0.34, lean: 0.12, crouch: 0.08 },
    windup: { G: [-0.27, 1.5, 0.02], e: 2.02, lean: -0.08, crouch: 0.05 },
    stroke: { G: [-0.2, 1.42, 0.42], e: 0.9, lean: 0.14, crouch: 0.08 },
    follow: { G: [-0.2, 1.1, 0.45], e: 0.2, lean: 0.16, crouch: 0.1 },
    hookset: { G: [-0.17, 1.34, 0.27], e: 1.22, lean: -0.1, crouch: 0.12 },
    fightHigh: { G: [-0.17, 1.22, 0.29], e: 1.08, lean: -0.08, crouch: 0.16 },
    fightLow: { G: [-0.17, 1.08, 0.33], e: 0.64, lean: 0.06, crouch: 0.14 },
    land: { G: [-0.13, 1.4, 0.17], e: 1.22, lean: 0.12, crouch: 0.12 },
    celebrate: { G: [-0.27, 1.24, 0.16], e: 1.32, lean: -0.04, crouch: 0.0 },
    sad: { G: [-0.17, 0.97, 0.3], e: 0.24, lean: 0.1, crouch: 0.05 },
    neutral: { G: [-0.17, 1.02, 0.3], e: 0.5, lean: 0.04, crouch: 0.03 },
    rebait: { G: [-0.15, 1.22, 0.22], e: 1.27, lean: 0.04, crouch: 0.02 }
  };
  const blendPose = (a, b, t) => ({ G: V.lerp(a.G, b.G, t), e: lerp(a.e, b.e, t), lean: lerp(a.lean, b.lean, t), crouch: lerp(a.crouch, b.crouch, t) });
  const charToBoat = c => [FEET[0] - c[0], FEET[1] + c[1], FEET[2] - c[2]];
  const rotY = (c, a) => [c[0] * Math.cos(a) + c[2] * Math.sin(a), c[1], -c[0] * Math.sin(a) + c[2] * Math.cos(a)];

  class FishingSim {
    constructor(opts = {}) {
      this.seed = P.hash(opts.seed || 'abu-ubaida-fishing'); this.rand = P.rng(this.seed);
      this.t = 0; this.acc = 0; this.phase = 'idle'; this.pt = 0; this.events = []; this.ripples = [];
      this.boat = new BoatMotion(); this.rod = new Rod(); this.rope = new Rope(20); this.rope.boat = this.boat;
      this.school = new F.School(this.seed ^ 0x51ed); this.fight = null; this.round = 0; this.catches = []; this.result = null;
      this.aim = { lane: 'center', power: 0.55, target: null, yaw: 0 }; this.pose = { ...POSES.idle, yaw: 0, action: 'idle', left: 'reel', expression: 'neutral' };
      this.prevPose = { ...this.pose }; this.poseFrom = POSES.idle; this.poseTo = POSES.idle; this.poseT = 1; this.poseDur = 0.5;
      this.reelAngle = 0; this.rotor = 0; this.bail = 0; this.tension = 0.05; this.reelInput = false; this.reelSpeed = 0; this.slip = 0;
      this.baitOn = true; this.target = null; this.hooked = null; this.net = { active: false, hand: [0, 0, 0], hoop: [0, 0, 0], ext: 1.05, dirB: [0, -1, 0], fish: null, lid: 0 };
      this.lookAt = [0, 0.4, -6]; this.cast = null; this.qa = { questions: 0, results: 0 };
      this.boat.step(0, 0); this.updateRod(0); this.rope.hangFrom(this.rod.tip); for (let i = 0; i < 240; i++) this.stepOnce(STEP);
      this.setPhase('idle');
    }
    /* ---------- public API ---------- */
    update(dt) { if (!(dt > 0)) return; dt = Math.min(dt, 0.1); this.acc += dt; let n = 0; while (this.acc >= STEP && n < 14) { this.stepOnce(STEP); this.acc -= STEP; n++; } if (n === 14) this.acc = 0; }
    setAim(lane, power) { if (!['ready', 'idle'].includes(this.phase)) return false; if (lane) this.aim.lane = lane; if (power != null) this.aim.power = clamp(power); this.aim.target = null; this.computeTarget(); return true; }
    setTarget(world) { if (!['ready', 'idle'].includes(this.phase)) return false; const fw = this.boat.toWorld(FEET), d = V.sub(world, fw); let yaw = clamp(Math.atan2(d[0], -d[2]) - this.boat.yaw, -0.8, 0.8); const dist = clamp(Math.hypot(d[0], d[2]), 6, 13.8); this.aim.lane = 'custom'; this.aim.power = (dist - 6.2) / 7.4; this.aim.target = [fw[0] + Math.sin(yaw + this.boat.yaw) * dist, 0, fw[2] - Math.cos(yaw + this.boat.yaw) * dist]; this.aim.yaw = yaw; return true; }
    computeTarget() {
      if (this.aim.lane === 'custom' && this.aim.target) return this.aim.target;
      const yaw = { left: -0.46, center: 0.02, right: 0.48 }[this.aim.lane] || 0, dist = 6.2 + 7.4 * this.aim.power, fw = this.boat.toWorld(FEET);
      this.aim.yaw = yaw; this.aim.target = [fw[0] + Math.sin(yaw) * dist, 0, fw[2] - Math.cos(yaw) * dist]; return this.aim.target;
    }
    ready() { if (this.phase === 'idle') { this.computeTarget(); this.setPhase('prepare'); } }
    startCast() { if (this.phase !== 'ready') return false; this.computeTarget(); this.setPhase('windup'); return true; }
    resolve(res) {
      if (this.phase !== 'question') return false;
      this.result = res.pending ? 'pending' : res.correct ? 'correct' : 'wrong'; this.qa.results++;
      this.setPhase(this.result === 'correct' ? 'hookset' : this.result === 'wrong' ? 'strike' : 'review'); return true;
    }
    nextCast() { if (this.phase !== 'done') return false; this.round++; this.setPhase('retrieve'); return true; }
    drain() { const e = this.events; this.events = []; return e; }
    get catchCount() { return this.catches.length; }

    /* ---------- internals ---------- */
    emit(type, extra = {}) { this.events.push({ type, t: this.t, ...extra }); }
    ripple(pos, amp, kind = 'ring') { this.ripples.push({ x: pos[0], z: pos[2], t0: this.t, amp, kind }); if (this.ripples.length > 10) this.ripples.shift(); }
    setPhase(p) { this.phase = p; this.pt = 0; this.onEnter(p); }
    poseTo_(name, dur, extra) { this.poseFrom = { G: this.pose.G, e: this.pose.e, lean: this.pose.lean, crouch: this.pose.crouch }; this.poseTo = typeof name === 'string' ? POSES[name] : name; this.poseT = 0; this.poseDur = Math.max(0.01, dur); this.pose.action = typeof name === 'string' ? name : this.pose.action; if (extra) Object.assign(this.pose, extra); }
    onEnter(p) {
      const s = this, R = s.rope, H = R.hookIndex;
      switch (p) {
        case 'idle': s.poseTo_('idle', 0.6, { left: 'reel', expression: 'neutral' }); break;
        case 'prepare': s.poseTo_('ready', 1.0, { left: 'reel', expression: 'focus' }); s.emit('prepare'); break;
        case 'ready': s.poseTo_('ready', 0.6, { left: 'reel', expression: 'focus' }); break;
        case 'windup': s.cast = null; s.poseTo_('windup', 0.72, { left: 'butt', expression: 'focus' }); s.bail = 1; s.emit('bail', { open: true }); break;
        case 'stroke': s.poseTo_('stroke', 0.24); s.emit('whoosh'); break;
        case 'flight': s.poseTo_('follow', 0.45); break;
        case 'settle': s.poseTo_('wait', 1.1, { left: 'reel' }); break;
        case 'approach': case 'inspect': case 'nibble': s.poseTo_('wait', 0.6); break;
        case 'bite': s.poseTo_('alert', 0.35, { expression: 'alert' }); s.emit('bite', { pos: R.floatPos }); break;
        case 'question': s.qa.questions++; s.emit('question'); if (s.target) { s.target.mode = 'held'; s.target.speed = 0; s.target.vel = [0, 0, 0]; } break;
        case 'hookset': {
          s.poseTo_('hookset', 0.22, { expression: 'effort' }); s.emit('hookset', { pos: s.target.pos });
          const f = s.target; f.mode = 'hooked'; s.hooked = f; s.fight = new F.Fight(f.sp, Math.max(5, V.dist(s.rod.tip, f.mouthPos) + 0.3), s.seed + s.round * 977); s.fight.landLength = 3.55; break;
        }
        case 'fight': s.poseTo_('fightHigh', 0.4, { left: 'reel' }); s.hooked.mode = 'hooked'; break;
        case 'surface': s.emit('surface', { pos: s.hooked.pos }); break;
        case 'net': s.poseTo_('land', 0.6, { left: 'net', expression: 'effort' }); s.net.active = true; s.net.fish = null; s.emit('net'); break;
        case 'onboard': s.emit('onboard'); break;
        case 'celebrate': s.poseTo_('celebrate', 0.5, { left: 'free', expression: 'happy' }); s.emit('celebrate'); break;
        case 'strike': s.poseTo_('hookset', 0.22, { expression: 'effort' }); s.emit('hookset', { pos: s.target.pos, miss: true }); s.target.mode = 'hooked'; s.target.goal = null; break;
        case 'shake': s.emit('shake'); break;
        case 'escape': {
          s.poseTo_('sad', 0.9, { expression: 'sad' }); const f = s.target; R.release(H); s.baitOn = false; s.emit('escape', { pos: f.pos }); s.ripple(R.floatPos, 0.6);
          const away = V.norm([f.pos[0] - s.boat.pos[0], 0, f.pos[2] - s.boat.pos[2]]); f.goal = { pos: V.add(f.pos, [away[0] * 9 + away[2] * 3, -0.9, away[2] * 9 - away[0] * 3]), speed: f.sp.burst, burst: true }; f.mode = 'escape'; f.face = null; break;
        }
        case 'review': {
          s.poseTo_('neutral', 0.8, { expression: 'neutral' }); const f = s.target; R.release(H); f.mode = 'review';
          const away = V.norm([f.pos[0] - s.boat.pos[0], 0, f.pos[2] - s.boat.pos[2]]); f.goal = { pos: V.add(f.pos, [away[0] * 2.4, -0.3, away[2] * 2.4]), speed: f.sp.cruise * 0.8 }; f.face = null; s.emit('review'); break;
        }
        case 'done': s.poseTo_('wait', 1.2, { left: 'reel', expression: s.result === 'correct' ? 'happy' : s.result === 'wrong' ? 'sad' : 'neutral' }); s.emit('done', { result: s.result, fish: s.result === 'correct' ? s.catches[s.catches.length - 1] : null }); break;
        case 'retrieve': s.poseTo_('wait', 0.6, { left: 'reel', expression: 'neutral' }); s.result = null; if (s.target && s.target.mode !== 'wander' && !s.target.landed) { s.target.mode = 'wander'; s.target.goal = null; s.target.face = null; } s.target = null; s.hooked = null; s.fight = null; s.emit('retrieve'); break;
        case 'rebait': s.poseTo_('rebait', 0.7, { left: 'free', expression: 'focus' }); s.emit('rebait'); break;
      }
    }
    poseNow() {
      this.poseT = Math.min(1, this.poseT + STEP / this.poseDur); const k = smoother(this.poseT), b = blendPose(this.poseFrom, this.poseTo, k);
      Object.assign(this.pose, b); return this.pose;
    }
    rodFrame() {
      const p = this.pose, e = p.e, side = 0.12 * Math.max(Math.cos(e), 0) - 0.06 * Math.max(-Math.cos(e), 0); // butt tucked along the right forearm / hip, tip slightly inboard
      let G = rotY(p.G, -p.yaw), D = V.norm(rotY([side, Math.sin(e), Math.cos(e)], -p.yaw));
      if (p.pump) { G = V.add(G, [0, p.pump * 0.05, 0]); }
      const Gb = charToBoat(G), Db = [-D[0], D[1], -D[2]];
      return { gripW: this.boat.toWorld(Gb), dirW: this.boat.dirToWorld(Db), gripB: Gb, dirB: Db };
    }
    updateRod(h) {
      const fr = this.rodFrame(); this.gripW = fr.gripW; this.rodDirW = fr.dirW;
      const butt = V.sub(fr.gripW, V.mul(fr.dirW, this.rod.grip + 0.0));
      const toLine = V.norm(V.sub(this.rope.p[1].x, this.rod.tip || fr.gripW));
      const force = V.mul(toLine, this.tension);
      this.rod.step(h, butt, fr.dirW, [0, 1, 0], force);
    }
    reelFrame() { // reel body + crank knob in world space (used for the left-hand IK and line rendering)
      const r = this.rod, c = V.add(V.add(r.butt, V.mul(r.D, REEL.s)), V.mul(r.e1, -REEL.drop));
      const a = this.reelAngle, axis = V.mul(r.e2, -1);
      const knob = V.add(V.add(c, V.mul(axis, REEL.side)), V.add(V.mul(r.D, Math.cos(a) * REEL.crank), V.mul(r.e1, Math.sin(a) * REEL.crank)));
      return { center: c, knob, axis };
    }
    leftHandWorld() {
      const p = this.pose, mode = p.left;
      if (mode === 'butt') return V.add(this.rod.butt, V.mul(this.rod.D, 0.05));
      if (mode === 'reel') return this.reelFrame().knob;
      if (mode === 'net') return this.net.hand;
      if (mode === 'hook') return this.rope.hookPos;
      if (mode === 'hook-held' && this.leftHand) return this.leftHand;
      return this.boat.toWorld(charToBoat(rotY(this.leftFree || [0.3, 1.0, 0.25], -p.yaw * 0.5)));
    }
    angler() { // capsule used for line collisions + camera framing
      const a = this.boat.toWorld(V.add(FEET, [0, 0.45, 0])), b = this.boat.toWorld(V.add(FEET, [0, 1.62, 0.02]));
      return { a, b, r: 0.21, head: this.boat.toWorld(V.add(FEET, [0, 1.66, 0])) };
    }
    retrieveLine(amount) { if (amount <= 0) return; this.reelAngle += amount / REEL.perTurn * Math.PI * 2; this.rotor = this.reelAngle * REEL.ratio; }

    stepOnce(h) {
      const s = this, R = s.rope; s.t += h; s.pt += h;
      s.boat.step(h, s.t); s.poseNow(); s.phaseLogic(h);
      s.updateRod(h); R.p[0].pin = s.rod.tip;
      const cap = s.angler(); R.colliders = [{ a: cap.a, b: cap.b, r: cap.r }];
      R.step(h, s.t, null); s.school.step(h, s.t, s.boat);
      if (s.target && s.target.mode === 'held') { /* frozen: fins only */ }
      s.ripples = s.ripples.filter(r => s.t - r.t0 < 6);
    }

    phaseLogic(h) {
      const s = this, R = s.rope, H = R.hookIndex, pt = s.pt, FI = R.floatIndex;
      const fl = R.p[FI];
      // default line tension: slight drift pull when the rig is in the water
      let tension = R.p[FI].wet ? 0.08 + Math.min(0.25, R.tipPull * 4) : 0.02 + Math.min(0.2, R.tipPull * 3);
      s.reelSpeed = 0; s.slip = 0;
      s.pose.yaw = lerp(s.pose.yaw, s.desiredYaw(), clamp(h * 3));
      switch (s.phase) {
        case 'idle': s.leftFree = null; break;
        case 'prepare': if (pt > 0.25 && pt < 0.55) s.bail = smooth((pt - 0.25) / 0.3); if (pt > 0.75 && pt < 1.05) s.bail = 1 - smooth((pt - 0.75) / 0.3); if (pt > 1.5) s.setPhase('ready'); break;
        case 'ready': R.mainLength = lerp(R.mainLength, 0.32, clamp(h * 2)); break;
        case 'windup': if (pt > 0.86) s.setPhase('stroke'); break;
        case 'stroke': if (!s.cast && pt > 0.14) { s.release(); s.setPhase('flight'); } break;
        case 'flight': {
          const c = s.cast; c.t += h; const p = Ballistic.at(c.from, c.v, Math.min(c.t, c.T));
          fl.pin = p; R.mainLength = Math.max(R.mainLength, R.straightToFloat() * 1.1 + 0.35); s.retrieveLine(0);
          const wh = Sea.height(p[0], p[2], s.t);
          if (c.t >= c.T || (c.t > 0.3 && p[1] <= wh)) { fl.pin = null; fl.o = V.sub(fl.x, V.mul(c.v, h * 0.15)); s.emit('splash', { pos: p, strength: 1 }); s.ripple(p, 1.0); s.setPhase('settle'); }
          tension = 0.02; break;
        }
        case 'settle': {
          if (pt > 0.25 && s.bail > 0) { s.bail = 0; s.emit('bail', { open: false }); }
          const want = R.straightToFloat() * 1.015 + 0.05; if (pt > 0.35 && R.mainLength > want) { const d = Math.min(R.mainLength - want, 1.4 * h); R.mainLength -= d; s.retrieveLine(d); s.reelSpeed = d / h; }
          if (pt > 0.5 && Math.floor((pt - h) / 0.4) !== Math.floor(pt / 0.4)) s.ripple(fl.x, 0.15);
          if (pt > 1.25) { s.chooseFish(); s.setPhase('approach'); }
          break;
        }
        case 'approach': {
          const f = s.target, B = R.hookPos, side = V.norm([f.pos[0] - B[0], 0, f.pos[2] - B[2]]);
          f.goal = { pos: V.add(B, [side[0] * 0.95, 0.05, side[2] * 0.95]), speed: Math.max(f.sp.cruise * 1.6, Math.min(f.sp.burst * 0.55, s.approachSpeed)), slow: 0.8 }; f.face = null;
          if (V.dist(f.pos, B) < 1.25 || pt > 4.2) s.setPhase('inspect');
          break;
        }
        case 'inspect': {
          const f = s.target, B = R.hookPos, a = s.orbit0 + pt * 0.55, r = 0.62 - 0.12 * Math.sin(pt * 1.7);
          f.goal = { pos: [B[0] + Math.sin(a) * r, B[1] + 0.04 * Math.sin(pt * 2), B[2] + Math.cos(a) * r], speed: f.sp.cruise * 0.9, slow: 0.5 }; f.face = V.sub(B, f.pos);
          if (pt > 1.3 * f.sp.wary) s.setPhase('nibble');
          break;
        }
        case 'nibble': {
          const f = s.target, B = R.hookPos, k = pt % 0.75, n = Math.floor(pt / 0.75), toB = V.norm(V.sub(B, f.pos));
          const mouthTarget = k < 0.32 ? V.sub(B, V.mul(toB, f.length * 0.5)) : V.sub(B, V.mul(toB, f.length * 0.5 + 0.22));
          f.goal = { pos: mouthTarget, speed: 0.75, slow: 0.25 }; f.face = toB;
          const contact = k > 0.24 && k < 0.36 && V.dist(f.mouthPos, B) < 0.2;
          if (contact) { R.p[H].pin = V.add(f.mouthPos, [0, -0.05, 0]); if (!s.nibbled[n]) { s.nibbled[n] = 1; s.emit('nibble', { pos: R.floatPos }); s.ripple(R.floatPos, 0.25); } tension = 0.22; }
          else if (R.p[H].pin) { R.p[H].pin = null; R.calm(0.4); }
          if (pt > 1.5) { R.p[H].pin = null; s.setPhase('bite'); }
          break;
        }
        case 'bite': {
          const f = s.target, B = R.hookPos;
          if (!s.biteAnchor) { s.biteAnchor = V.copy(B); s.biteDir = V.norm([f.fwd[0], 0, f.fwd[2]]); }
          const toB = V.norm(V.sub(s.biteAnchor, f.pos));
          if (pt < 0.22) { f.goal = { pos: V.sub(s.biteAnchor, V.mul(toB, f.length * 0.5)), speed: 1.1, slow: 0.15 }; f.face = toB; }
          else { f.goal = { pos: V.add(s.biteAnchor, [s.biteDir[0] * 0.28, -0.32, s.biteDir[2] * 0.28]), speed: 0.55, slow: 0.3 }; f.face = s.biteDir; R.p[H].pin = f.mouthPos; tension = 0.32 + 0.1 * Math.sin(pt * 40); f.mouth = 1; }
          if (pt > 0.2 && pt - h <= 0.2) s.ripple(R.floatPos, 0.5);
          if (pt > 0.62) { R.p[H].pin = f.mouthPos; f.goal = null; f.face = null; s.setPhase('question'); }
          break;
        }
        case 'question': { // frozen moment: fish + hook hold their exact position, sea and boat stay alive
          const f = s.target; R.p[H].pin = f.mouthPos; tension = 0.3; break;
        }
        case 'hookset': {
          const f = s.hooked; tension = 0.45 + 0.6 * Math.sin(Math.min(1, pt / 0.45) * Math.PI);
          s.fishFight(h, false, 0.35); if (pt > 0.45) s.setPhase('fight'); break;
        }
        case 'fight': {
          const fight = s.fight.step(h, s.reelInput), f = s.hooked; tension = 0.25 + fight.tension * 0.95;
          const pump = (Math.sin(s.t * 1.6) * 0.5 + 0.5); s.poseTo = blendPose(POSES.fightLow, POSES.fightHigh, pump * 0.8 + 0.2 * (1 - fight.stamina)); s.poseT = Math.min(s.poseT, 1);
          s.retrieveLine(Math.max(0, fight.retrieve * h)); s.reelSpeed = fight.retrieve; s.slip = fight.slip;
          s.fishFight(h, true);
          if (Math.floor((pt - h) / 0.55) !== Math.floor(pt / 0.55) && f.pos[1] > -0.9) { s.ripple(f.pos, 0.45); s.emit('thrash', { pos: f.pos, strength: 0.5 }); }
          if (fight.done) s.setPhase('surface');
          break;
        }
        case 'surface': {
          const f = s.hooked; tension = 0.55 + 0.1 * Math.sin(pt * 22); s.fishSurface(h);
          if (Math.floor((pt - h) / 0.28) !== Math.floor(pt / 0.28)) { s.ripple(f.pos, 0.6); s.emit('thrash', { pos: f.pos, strength: 0.9 }); }
          if (pt > 1.1) s.setPhase('net');
          break;
        }
        case 'net': { tension = 0.45; s.netLogic(h, pt); if (pt > 2.7) s.setPhase('onboard'); break; }
        case 'onboard': { tension = 0.1; s.onboardLogic(h, pt); if (pt > 1.4) s.setPhase('celebrate'); break; }
        case 'celebrate': { s.leftFree = [0.26, 1.72 + 0.05 * Math.sin(pt * 9), 0.22]; s.net.lid = Math.max(0, s.net.lid - h * 2); if (pt > 2.0) s.setPhase('done'); break; }
        case 'strike': { s.fishFight(h, false, 0.2, true); tension = 0.5 + 0.4 * Math.sin(Math.min(1, pt / 0.4) * Math.PI); R.p[H].pin = s.target.mouthPos; if (pt > 0.4) s.setPhase('shake'); break; }
        case 'shake': {
          const f = s.target, wob = Math.sin(pt * 26) * 0.9; s.fishFight(h, false, 0.05, true); f.face = V.rot(s.biteDir || f.fwd, [0, 1, 0], wob); s.school.orient(f, f.face, h);
          R.p[H].pin = f.mouthPos; tension = 0.55 + 0.25 * Math.abs(Math.sin(pt * 13));
          if (Math.floor((pt - h) / 0.2) !== Math.floor(pt / 0.2)) s.emit('thrash', { pos: f.pos, strength: 0.4 });
          if (pt > 0.85) s.setPhase('escape');
          break;
        }
        case 'escape': tension = 0.04; if (pt > 0.5) s.target.face = null; if (pt > 2.4) { s.target.mode = 'wander'; s.target.goal = null; s.setPhase('done'); } break;
        case 'review': tension = 0.08; if (pt > 1.2 && s.target.goal) { s.target.goal.speed = s.target.sp.cruise; } if (pt > 2.6) { s.target.mode = 'wander'; s.target.goal = null; s.setPhase('done'); } break;
        case 'done': tension = R.p[FI].wet ? 0.08 : 0.03; break;
        case 'retrieve': {
          const d = Math.min(Math.max(0, R.mainLength - 0.32), 2.3 * h); R.mainLength -= d; s.retrieveLine(d); s.reelSpeed = d / h;
          tension = 0.18 + (R.p[FI].wet ? 0.12 : 0);
          if (R.mainLength <= 0.3201 && pt > 0.4) { if (!s.baitOn) s.setPhase('rebait'); else s.setPhase('ready'); }
          break;
        }
        case 'rebait': {
          const hook = R.hookPos;
          if (pt < 0.9) s.leftFree = V.lerp([0.3, 1.0, 0.25], [0.12, 1.22, 0.5], smooth(pt / 0.9));
          if (pt >= 0.9 && pt < 1.9) { s.pose.left = 'hook-held'; const hw = s.boat.toWorld(charToBoat(rotY([0.1, 1.2, 0.48], -s.pose.yaw * 0.5))); R.p[H].pin = hw; s.leftHand = hw; if (!s.baitOn && pt > 1.35) { s.baitOn = true; s.emit('baited'); } }
          if (pt >= 1.9) { R.release(H); s.pose.left = 'free'; s.leftFree = V.lerp([0.12, 1.22, 0.5], [0.3, 1.0, 0.25], smooth((pt - 1.9) / 0.4)); }
          if (pt > 2.35) { s.pose.left = 'reel'; s.setPhase('ready'); }
          void hook; break;
        }
      }
      // spool drag: a pinned hook can never overstretch the line — line pays out instead of snapping
      const hp = R.p[H].pin; if (hp) { const need = V.dist(s.rod.tip, hp) - 1.5 + 0.03; if (R.mainLength < need) R.mainLength = need; }
      s.tension = lerp(s.tension, tension, clamp(h * 18));
    }
    desiredYaw() {
      const s = this; let target = null;
      if (['ready', 'windup', 'stroke', 'flight', 'idle', 'prepare', 'rebait'].includes(s.phase)) return s.aim.yaw || 0;
      if (s.hooked && ['hookset', 'fight', 'surface'].includes(s.phase)) target = s.hooked.pos; else target = s.rope.floatPos;
      const fw = s.boat.toWorld(FEET), d = V.sub(target, fw); return clamp(Math.atan2(d[0], -d[2]) - s.boat.yaw, -0.85, 0.85);
    }
    release() {
      const s = this, R = s.rope, fl = R.p[R.floatIndex], target = s.computeTarget(), from = V.copy(fl.x), dist = Math.hypot(target[0] - from[0], target[2] - from[2]);
      const T = Ballistic.flightTime(dist), land = [target[0], Sea.height(target[0], target[2], s.t + T) - 0.01, target[2]];
      s.cast = { from, to: land, T, v: Ballistic.launch(from, land, T), t: 0 };
      for (let i = R.floatIndex + 1; i < R.count; i++) { const q = R.p[i]; q.o = V.sub(q.x, V.mul(s.cast.v, STEP * 0.85)); } s.emit('release', { target: land, T });
    }
    chooseFish() {
      const s = this, B = s.rope.hookPos, prefer = F.ORDER[s.round % F.ORDER.length];
      let f = s.school.pick(B, prefer); if (!f) f = s.school.replenish(s.seed + s.round);
      s.target = f; f.mode = 'approach'; f.mouth = 0; s.nibbled = {}; s.biteAnchor = null; s.biteDir = null; s.orbit0 = Math.atan2(f.pos[0] - B[0], f.pos[2] - B[2]);
      s.approachSpeed = Math.max(0.4, V.dist(f.pos, B) / 2.4); s.emit('notice', { species: f.sp.id });
    }
    /* fish on the line: swim force + line-length constraint (never teleports) */
    fishFight(h, useFight, jolt = 0, missed = false) {
      const s = this, f = s.target || s.hooked, tip = s.rod.tip, R = s.rope;
      const away = V.norm([f.pos[0] - tip[0], 0, f.pos[2] - tip[2]]), sideV = [-away[2], 0, away[0]];
      let L, depthT, swim;
      if (useFight) {
        const fi = s.fight; L = fi.L; const tired = 1 - fi.stamina;
        depthT = lerp(f.sp.dive, -0.4, smooth(tired * 1.2)); const runAmt = fi.run;
        swim = V.add(V.mul(away, f.sp.burst * (0.25 + 0.55 * fi.stamina)), V.mul(sideV, runAmt * f.sp.burst * 0.6));
      } else { L = V.dist(tip, f.mouthPos) - jolt * h * 6; depthT = f.pos[1] - (missed ? 0 : 0.05); swim = V.mul(away, 0.4); }
      swim[1] = (depthT - f.pos[1]) * 1.6;
      f.vel = V.add(f.vel, V.mul(V.sub(swim, f.vel), clamp(h * 3.2)));
      let np = V.add(f.pos, V.mul(f.vel, h)); const mouth = V.add(np, V.mul(f.fwd, f.length * 0.5)), d = V.sub(mouth, tip), l = V.len(d);
      if (l > L) { const pull = Math.min(l - L, 2.2 * h); np = V.add(np, V.mul(d, -pull / l)); if (useFight && l - pull > s.fight.L) s.fight.L = l - pull; } // spool drag: never yank the fish faster than the reel can
      const moved = V.sub(np, f.pos); f.pos = np; f.speed = V.len(moved) / h + 0.25; f.vel = V.mul(moved, 1 / h);
      s.school.constrain(f, s.t, s.boat, false);
      f.mode = useFight ? 'fight' : f.mode; f.face = V.add(away, V.mul(sideV, (useFight ? s.fight.run : 0) * 0.8)); f.face[1] = clamp((depthT - f.pos[1]) * 0.5, -0.4, 0.4);
      s.school.orient(f, f.face, h); s.school.animate(f, h); f.tailAmp = Math.max(f.tailAmp, 0.13); f.mouth = 1;
      R.p[R.hookIndex].pin = f.mouthPos; R.mainLength = Math.max(0.3, Math.max(useFight ? s.fight.L : 0, V.dist(tip, f.mouthPos)) - 1.5 + 0.08);
      s.boat.extraRoll = lerp(s.boat.extraRoll, useFight ? -0.025 * s.fight.tension : 0, clamp(h * 2));
    }
    landingPoint() { // where the netted fish surfaces: in reach of the landing net (boat frame → world)
      const yaw = clamp(this.pose.yaw, -0.5, 0.5), c = rotY([0.18, 0, 1.78], -yaw), b = charToBoat(c); const w = this.boat.toWorld([b[0], 0, b[2]]); w[1] = Sea.height(w[0], w[2], this.t) - 0.08; return w;
    }
    fishSurface(h) {
      const s = this, f = s.hooked, goal = s.landingPoint();
      const d = V.sub(goal, f.pos), l = V.len(d), step = Math.min(l, 0.9 * h); f.pos = V.add(f.pos, l > 1e-6 ? V.mul(d, step / l) : [0, 0, 0]);
      f.mode = 'fight'; const tip = s.rod.tip; f.face = V.norm([f.pos[0] - tip[0], 0, f.pos[2] - tip[2]]); f.face = V.rot(f.face, [0, 1, 0], Math.sin(s.t * 14) * 0.6);
      s.school.orient(f, f.face, h); f.speed = 1.2; s.school.animate(f, h); f.tailAmp = 0.24; f.roll = Math.sin(s.t * 11) * 0.5;
      s.rope.p[s.rope.hookIndex].pin = f.mouthPos; s.rope.mainLength = Math.max(0.3, V.dist(tip, f.mouthPos) - 1.5 + 0.08); s.boat.extraRoll = lerp(s.boat.extraRoll, -0.03, clamp(h * 2));
    }
    netLogic(h, pt) {
      const s = this, n = s.net, f = s.hooked, yaw = clamp(s.pose.yaw, -0.5, 0.5);
      const toW = c => s.boat.toWorld(charToBoat(rotY(c, -yaw)));
      const handK = [[0, [0.32, 1.02, 0.22]], [0.7, [0.24, 1.22, 0.5]], [1.55, [0.22, 1.18, 0.55]], [2.15, [0.4, 1.35, 0.35]], [2.7, [0.48, 1.3, 0.3]]];
      const hand = toW(keyframes(handK, pt)), lp = s.landingPoint();
      const under = V.add(lp, [0, -0.32, 0]), lifted = V.add(lp, [0, 0.18, 0]), cooler = s.boat.toWorld(V.add(COOLER, [0, 0.78, 0]));
      const rest = toW([0.55, 0.35, 0.65]);
      let hoop; if (pt < 0.7) hoop = V.lerp(rest, under, smooth(pt / 0.7)); else if (pt < 1.15) hoop = V.lerp(under, under, 1); else if (pt < 1.55) hoop = V.lerp(under, lifted, smooth((pt - 1.15) / 0.4)); else hoop = V.lerp(lifted, cooler, smooth((pt - 1.55) / 1.1));
      n.hand = hand; n.hoop = hoop; n.ext = V.dist(hand, hoop); n.lid = Math.min(1.35, n.lid + h * 1.4);
      if (!n.fish && pt > 1.2) { n.fish = f; f.mode = 'netted'; s.emit('netted', { pos: f.pos }); s.ripple(f.pos, 0.8); s.emit('splash', { pos: f.pos, strength: 0.7 }); }
      if (n.fish) { f.pos = V.lerp(f.pos, V.add(hoop, [0, -0.1, 0]), clamp(h * 14)); f.face = V.norm(V.sub(cooler, hand)); f.face[1] = 0; s.school.orient(f, f.face, h); f.roll = 1.25 + Math.sin(s.t * 13) * 0.25; f.speed = 2; s.school.animate(f, h); s.rope.p[s.rope.hookIndex].pin = f.mouthPos; }
      else { s.fishSurface(h); }
      s.rope.mainLength = Math.max(0.3, V.dist(s.rod.tip, s.rope.hookPos) - 1.45);
    }
    onboardLogic(h, pt) {
      const s = this, n = s.net, f = s.hooked, inside = s.boat.toWorld(V.add(COOLER, [0, 0.2, 0]));
      const yaw = clamp(s.pose.yaw, -0.5, 0.5), toW = c => s.boat.toWorld(charToBoat(rotY(c, -yaw)));
      n.hand = toW(V.lerp([0.48, 1.3, 0.3], [0.32, 1.02, 0.22], smooth((pt - 0.6) / 0.8)));
      const coolerTop = s.boat.toWorld(V.add(COOLER, [0, 0.78, 0])), rest = toW([0.55, 0.35, 0.65]);
      n.hoop = pt < 0.6 ? coolerTop : V.lerp(coolerTop, rest, smooth((pt - 0.6) / 0.8)); n.ext = V.dist(n.hand, n.hoop);
      if (pt < 0.55) { f.pos = V.lerp(f.pos, inside, clamp(h * 7)); f.roll = 1.4 + Math.sin(s.t * 15) * 0.3; s.school.animate(f, h); if (pt > 0.3 && pt - h <= 0.3) s.emit('flop', { pos: inside }); s.rope.p[s.rope.hookIndex].pin = f.mouthPos; }
      else if (!f.landed) {
        s.rope.release(s.rope.hookIndex); f.landed = true; f.mode = 'landed'; f.visible = false; n.fish = null; s.baitOn = false;
        const rec = { species: f.sp.id, ar: f.sp.ar, en: f.sp.en, sci: f.sp.sci, length: f.length, weight: f.weight, round: s.round };
        s.catches.push(rec); s.emit('landed', { catch: rec }); s.emit('flop', { pos: inside });
        s.school.replenish(s.seed + 31 * (s.round + 1));
      }
      if (pt > 0.7) n.lid = Math.max(0, n.lid - h * 2.2);
      if (pt > 1.2) n.active = false;
      s.boat.extraRoll = lerp(s.boat.extraRoll, 0, clamp(h * 2));
    }
    /* compact state for tests / QA */
    snapshot() {
      const r = n => Math.round(n * 1e4) / 1e4, v = a => a.map(r), f = this.target;
      return { phase: this.phase, t: r(this.t), tip: v(this.rod.tip), float: v(this.rope.floatPos), hook: v(this.rope.hookPos), fish: f ? v(f.pos) : null, catches: this.catches.length, tension: r(this.tension), line: r(this.rope.mainLength) };
    }
  }
  function keyframes(k, t) { if (t <= k[0][0]) return k[0][1]; for (let i = 0; i < k.length - 1; i++) if (t <= k[i + 1][0]) return V.lerp(k[i][1], k[i + 1][1], smooth((t - k[i][0]) / (k[i + 1][0] - k[i][0]))); return k[k.length - 1][1]; }

  const api = { FishingSim, POSES, FEET, COOLER, REEL, STEP, charToBoat, rotY };
  if (node) module.exports = api; else root.FishingSimulation = api;
})(typeof window !== 'undefined' ? window : globalThis);
