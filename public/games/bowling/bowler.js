/* Bowling V20 bowler controller: applies the BowlingMotion plan to a BowlingAthlete rig and owns the
 * ball while it is in the bowler's hands.
 *
 * The ball is never placed on a predefined path: every frame it is derived from the rig itself.
 *   - held (stance/pushaway): anchored in the chest frame (Spine2 -> Neck), cradled by both palms;
 *   - pendulum (downswing -> release): hanging from the throwing shoulder at the planned swing angle,
 *     in the vertical plane of the ball line, in front of the throwing palm.
 * Hand IK targets are computed from the ball surface, so palms touch the ball and never pass through it.
 * Release is evaluated at the exact release time (not at a frame boundary) so the physics state is
 * the same at any frame rate; position and orientation are continuous by construction.
 */
(function (root) {
  'use strict';
  const T = root.THREE, M = root.BowlingMotion, PH = root.BowlingPhysics;
  const R = PH.R, clamp = M.clamp, lerp = M.lerp, smooth = M.smooth;
  const UP = new T.Vector3(0, 1, 0);
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const fromArr = (a, o = V()) => o.set(a[0], a[1], a[2]);
  const HANG = 0.045; // the ball hangs from the fingers slightly beyond the palm along the arm

  function create(lib, opts = {}) {
    const ath = lib.create({ variant: opts.variant || 'b', kitTexture: opts.kitTexture, name: 'bowler', shadows: opts.shadows });
    let hand = opts.hand === 'left' ? 'left' : 'right', lastInputs = { start: 0, angle: 0, power: 0.65, spin: 0 };
    let P = M.plan({ start: 0, angle: 0, power: 0.65, hand });
    let mode = 'stance', t = -1, modeTime = 0, react = null, recover = null;
    const ball = { pos: V(), quat: new T.Quaternion(), attached: true, vel: V() };
    const prevBall = V(), tmpM = new T.Matrix4();
    let req = null; // the current pose request (sample)
    let shuffle = null, stanceFrom = null;
    const lookTarget = V();
    const S = { held: V(), pend: V(), nT: V(), fT: V(), a: V(), n: V(), chestUp: V(), chestFwd: V(), right: V(), side: V() };
    const athPose = ath.pose;
    const supportState = { value: 1, reach: 0 };

    function setFoot(side, f, w = 1) {
      const F = athPose.foot[side];
      F.w = w; fromArr(f.toe, F.toe); F.lift = f.lift || 0; F.heel = f.heel || 0; F.turn = f.turn ?? 0.1; F.toeFlat = f.contact === 'swing' ? 0.25 : 1;
      F.kneeDir.set(0, 0, 0);
    }

    /** Hand targets from the rig (called by the athlete after the spine is posed). */
    ath.beforeArms = a => {
      const r = req; if (!r) return;
      const hs = P.hs, throwS = P.throwHand, otherS = P.otherHand;
      const sh = a.worldOf(throwS + '_UpperArm', V()), shO = a.worldOf(otherS + '_UpperArm', V());
      const sp2 = a.worldOf('Spine2', V()), neck = a.worldOf('Neck', V());
      const right = S.right.set(-1, 0, 0).applyAxisAngle(UP, a.yaw);                 // character's right
      const side = S.side.copy(right).multiplyScalar(hs);                             // toward the throwing side
      const up = S.chestUp.subVectors(neck, sp2).normalize();
      const fwd = S.chestFwd.crossVectors(up, right).normalize();
      const d = fromArr(P.d, V()), rl = fromArr(P.r, V());
      // held position (chest frame)
      const H = r.held, held = S.held.copy(sp2).addScaledVector(fwd, H.forward).addScaledVector(up, -H.down).addScaledVector(side, H.lateral);
      // pendulum position (ball line plane through the release line)
      let ballPos = held.clone(), nT, fT, poleT;
      const cT = V().copy(fwd).multiplyScalar(-0.40).addScaledVector(up, -0.72).addScaledVector(side, 0.45).normalize();
      const fHeld = V().copy(fwd).addScaledVector(cT, -fwd.dot(cT)).normalize();
      nT = cT.clone().negate(); fT = fHeld.clone();
      const theta = r.theta;
      let pend = r.pendulum;
      if (theta !== null) {
        const O = fromArr(P.O, V());
        const delta = clamp(O.clone().sub(sh).dot(rl), -0.17, 0.17);
        const armReach = a.armLength * r.reach + 0.052;
        const rho = Math.sqrt(Math.max(0.01, armReach * armReach - delta * delta));
        const av = S.a.copy(d).multiplyScalar(Math.sin(theta)).addScaledVector(UP, -Math.cos(theta));
        const nv = S.n.copy(d).multiplyScalar(Math.cos(theta)).addScaledVector(UP, Math.sin(theta));
        const palm = V().copy(sh).addScaledVector(rl, delta).addScaledVector(av, rho);
        const pendPos = S.pend.copy(palm).addScaledVector(nv, R + 0.006).addScaledVector(av, HANG);
        ballPos.lerp(pendPos, pend);
        nT.lerp(nv, pend).normalize(); fT.lerp(av, pend).normalize();
      }
      // the palm stays on the pendulum circle; only its orientation rolls for a hook release
      const palmPos = V().copy(ballPos).addScaledVector(nT, -(R + 0.006)).addScaledVector(fT, -HANG * pend);
      // a light roll of the palm toward the hook side late in the forward swing (visual only)
      const tRel = P.t.release;
      if (r.t > tRel - 0.25 * P.k && r.t < tRel + 0.3) {
        const k = smooth((r.t - (tRel - 0.25 * P.k)) / (0.25 * P.k)) * (1 - smooth((r.t - tRel) / 0.3));
        const roll = -hs * (opts.spin || 0) * 0.45 * k;
        nT.applyAxisAngle(fT, roll);
      }
      fT.sub(V().copy(nT).multiplyScalar(fT.dot(nT))).normalize();
      // floor safety (never needed with the planned poses, guarded anyway)
      if (ballPos.y < R + 0.012) ballPos.y = R + 0.012;
      poleT = V().copy(sh).addScaledVector(nT, -0.45).addScaledVector(side, 0.18).addScaledVector(UP, -0.1 * (1 - pend));
      if (pend < 0.5) poleT.addScaledVector(UP, -0.35).addScaledVector(fwd, -0.15);
      const released = !!r.released;
      const hT = athPose.hand[throwS];
      hT.w = 1; hT.pos.copy(palmPos);
      hT.ndir.copy(nT); hT.fdir.copy(fT); hT.pole.copy(poleT);
      hT.curl = released ? 0.18 : 0.62; hT.thumb = released ? 0.1 : 0.45;
      // support hand: under the inner side of the ball, then away to a balance position
      const hO = athPose.hand[otherS];
      const cS = V().copy(fwd).multiplyScalar(-0.10).addScaledVector(up, -0.70).addScaledVector(side, -0.70).normalize();
      const supPos = V().copy(ballPos).addScaledVector(cS, R + 0.006);
      const supN = cS.clone().negate(), supF = V().copy(fwd).addScaledVector(cS, -fwd.dot(cS)).normalize();
      const bal = smooth((r.t - P.t.backswing[0]) / (0.45 * P.k));
      const down = V().copy(shO).addScaledVector(side, -0.30).addScaledVector(fwd, 0.10).addScaledVector(UP, -0.50);
      const out = V().copy(shO).addScaledVector(side, -0.56).addScaledVector(d, 0.14).addScaledVector(UP, -0.10);
      const balPos = down.lerp(out, bal);
      // the support hand only stays on the ball while it can reach it comfortably (never floats beside it)
      const reachO = supPos.distanceTo(shO) / (a.armLength + 0.06);
      const sup = Math.min(r.support, smooth((1.02 - reachO) / 0.05));
      supportState.value = sup; supportState.reach = reachO;
      hO.w = 1;
      hO.pos.copy(balPos).lerp(supPos, sup);
      hO.ndir.copy(UP).negate().lerp(supN, sup).normalize();
      hO.fdir.copy(side).negate().lerp(supF, sup).normalize();
      hO.pole.copy(shO).addScaledVector(UP, -0.4).addScaledVector(side, -0.25).addScaledVector(fwd, -0.25);
      hO.curl = lerp(0.12, 0.3, sup); hO.thumb = 0.15;
      // ball orientation follows the throwing palm: finger holes (ball local +Z) face the palm
      if (!released) {
        const zb = nT.clone().negate(), xb = fT.clone().sub(zb.clone().multiplyScalar(fT.dot(zb))).normalize(), yb = V().crossVectors(zb, xb);
        tmpM.makeBasis(xb, yb, zb); ball.quat.setFromRotationMatrix(tmpM);
        ball.pos.copy(ballPos);
      }
    };

    function applyRequest(r, w = 1) {
      req = r;
      athPose.pelvisW = w; fromArr(r.pelvis, athPose.pelvisPos);
      athPose.tilt = r.tilt; athPose.bend = r.bend; athPose.side = r.side * P.hs; athPose.twist = r.twist * P.hs; athPose.roll = 0; athPose.turn = 0;
      for (const s of ['L', 'R']) setFoot(s, r.feet[s]);
      athPose.look = fromArr(r.look, lookTarget); athPose.lookW = 0.55;
      // throwing shoulder drops slightly into the release (set before the rig update: no one-frame lag)
      const drop = r.theta === null ? 0 : 0.16 * smooth((r.t - P.t.forward[0]) / (0.5 * P.k)) * (1 - smooth((r.t - P.t.follow) / 0.5));
      athPose.clavicle[P.throwHand] = drop ? { amount: drop, dir: V(0, -1, 0).addScaledVector(fromArr(P.d, V()), 0.3).normalize() } : null;
      athPose.clavicle[P.otherHand] = null;
    }

    function setPlan(inputs) {
      lastInputs = Object.assign({}, inputs);
      const next = M.plan({ start: inputs.start, angle: inputs.angle, power: inputs.power, hand });
      opts.spin = inputs.spin || 0;
      if (mode === 'stance' && (Math.abs(next.O[0] - P.O[0]) > 0.005 || Math.abs(next.angle - P.angle) > 1e-3)) {
        const from = M.sample(P, -0.5), to = M.sample(next, -0.5);
        shuffle = { from: shuffle ? currentStance() : from, to, u: 0, dir: Math.sign(to.pelvis[0] - from.pelvis[0]) || 1 };
      }
      P = next;
      ath.setTransform(0, 0, P.yaw);
    }
    function currentStance() { return shuffle && shuffle.cur ? shuffle.cur : M.sample(P, -0.5); }

    /** Side-step when the stance position changes: each foot steps (lifts) to its new spot, no sliding. */
    function shuffleSample(dt) {
      const sh = shuffle; sh.u = Math.min(1, sh.u + dt / 0.6);
      const first = sh.dir > 0 ? 'R' : 'L', second = first === 'R' ? 'L' : 'R';
      const r = JSON.parse(JSON.stringify(sh.to));
      const step = (side, a, b) => {
        const u = clamp((sh.u - a) / (b - a), 0, 1), e = M.smoother(u);
        const f0 = sh.from.feet[side], f1 = sh.to.feet[side];
        r.feet[side] = Object.assign({}, f1, { toe: [lerp(f0.toe[0], f1.toe[0], e), 0, lerp(f0.toe[2], f1.toe[2], e)], lift: 0.05 * Math.sin(Math.PI * u), contact: u > 0 && u < 1 ? 'swing' : 'planted', heel: 0.12 * Math.sin(Math.PI * u) });
      };
      step(first, 0, 0.55); step(second, 0.4, 1);
      const e = smooth(sh.u);
      r.pelvis = [lerp(sh.from.pelvis[0], sh.to.pelvis[0], e), sh.to.pelvis[1] - 0.012 * Math.sin(Math.PI * sh.u), lerp(sh.from.pelvis[2], sh.to.pelvis[2], e)];
      sh.cur = r;
      if (sh.u >= 1) shuffle = null;
      return r;
    }

    function startStance() {
      mode = 'stance'; t = -1; modeTime = 0; react = null; recover = null; shuffle = null; ball.attached = true;
      ath.setTransform(0, 0, P.yaw);
      ath.play('idle', { fade: 0.3, speed: 0.85 });
    }
    function startApproach() { if (mode !== 'stance') return false; shuffle = null; mode = 'approach'; t = 0; ath.stopClips(0.22); return true; }

    /** Pose at approach time tt, without advancing clips (used to read the exact release state). */
    function evaluate(tt) {
      applyRequest(M.sample(P, tt));
      ath.update(0);
      return { pos: ball.pos.clone(), quat: ball.quat.clone() };
    }

    function update(dt) {
      modeTime += dt;
      prevBall.copy(ball.pos);
      if (mode === 'stance') {
        const r = shuffle ? shuffleSample(dt) : M.sample(P, -0.5 + 0 * modeTime);
        r.bend += 0.012 * Math.sin(modeTime * 1.7); r.pelvis[1] += 0.004 * Math.sin(modeTime * 1.7);
        applyRequest(r);
      } else if (mode === 'approach' || mode === 'finish') {
        t += dt;
        const r = M.sample(P, t);
        if (t > P.end) { const b = Math.sin((t - P.end) * 1.6); r.bend += 0.01 * b; r.pelvis[1] += 0.004 * b; mode = 'finish'; }
        applyRequest(r);
        if (r.released) ball.attached = false;
      } else if (mode === 'recover') {
        recover.t += dt;
        const rs = M.recoverState(P, recover.t), base = M.sample(P, P.end + 1);
        base.pelvis = rs.pelvis; base.tilt = rs.tilt; base.bend = rs.bend; base.side = rs.side; base.twist = rs.twist; base.feet = rs.feet;
        base.theta = lerp(2.2, 0.15, smooth(recover.t / 0.8)); base.reach = 0.97; base.released = true; base.t = P.end + 1;
        applyRequest(base);
        if (rs.done) {
          mode = 'react'; modeTime = 0;
          const pel = fromArr(rs.pelvis, V());
          ath.setTransform(pel.x, pel.z, P.yaw);
          ath.root.position.set(pel.x, 0, pel.z);
          ath.play(react || 'idle', { fade: 0.45, loop: react === 'look' || react === 'idle' || react === 'clap', speed: 1 });
          recover.feet = rs.feet;
        }
      } else if (mode === 'react') {
        // clip drives the body; the feet stay planted where the recovery put them
        const w = smooth(modeTime / 0.45);
        athPose.pelvisW = 1 - w; athPose.tilt *= (1 - w); athPose.bend *= (1 - w); athPose.side *= (1 - w); athPose.twist *= (1 - w);
        for (const s of ['L', 'R']) setFoot(s, recover.feet[s]);
        athPose.hand.L.w = athPose.hand.R.w = 1 - w;
        athPose.clavicle.L = athPose.clavicle.R = null;
        req = w < 1 ? req : null;
        if (ath.current && !ath.current.loop && ath.current.time >= ath.current.getClip().duration - 0.05 && modeTime > 2) ath.play('idle', { fade: 0.6 });
      }
      ath.update(dt);
      if (dt > 0) ball.vel.subVectors(ball.pos, prevBall).divideScalar(dt);
    }

    function startRecover(kind) { if (mode === 'recover' || mode === 'react') return; mode = 'recover'; recover = { t: 0 }; react = kind; modeTime = 0; }

    function poseReport() {
      const b = ath.bones, w = n => ath.worldOf(n, V());
      const out = { knees: {}, elbows: {}, feet: {}, reach: Object.assign({}, ath.reach) };
      const fwd = fromArr(P.d, V());
      for (const s of ['L', 'R']) {
        const hip = w(s + '_Thigh'), knee = w(s + '_Calf'), ankle = w(s + '_Foot'), toe = w(s + '_Toe0');
        const mid = hip.clone().lerp(ankle, 0.5), kv = knee.clone().sub(mid);
        const axis = ankle.clone().sub(hip).normalize();
        kv.sub(axis.clone().multiplyScalar(kv.dot(axis)));
        // knee must bulge forward (in the character's facing direction projected on the leg plane)
        const sideAxis = V().crossVectors(axis, fwd).normalize(); const legFwd = V().crossVectors(sideAxis, axis).normalize();
        const bend = Math.PI - hip.clone().sub(knee).angleTo(ankle.clone().sub(knee));
        out.knees[s] = { bend: +bend.toFixed(3), forward: +kv.dot(legFwd).toFixed(4) };
        const sh = w(s + '_UpperArm'), el = w(s + '_Forearm'), wr = w(s + '_Hand');
        const ebend = Math.PI - sh.clone().sub(el).angleTo(wr.clone().sub(el));
        // elbow bends toward the front of the arm: the forearm swings toward the palm side
        out.elbows[s] = { bend: +ebend.toFixed(3) };
        // sole reference points: heel and toe joint/tip relative to the floor
        const fq = ath.quatOf(s + '_Foot', new T.Quaternion()), tq = ath.quatOf(s + '_Toe0', new T.Quaternion());
        const heel = ankle.clone().add(ath.rest[s + '_heelVec'].clone().applyQuaternion(fq.clone().multiply(ath.rest[s + '_Foot'].wq.clone().invert())));
        const tip = toe.clone().add(ath.rest[s + '_tipVec'].clone().applyQuaternion(tq.clone().multiply(ath.rest[s + '_Toe0'].wq.clone().invert())));
        out.feet[s] = { heel: +heel.y.toFixed(4), toe: +toe.y.toFixed(4), tip: +tip.y.toFixed(4), toeZ: +toe.z.toFixed(4), tipZ: +tip.z.toFixed(4), toeX: +toe.x.toFixed(4) };
      }
      out.ball = ball.pos.toArray().map(x => +x.toFixed(4));
      const palm = athPose.hand[P.throwHand];
      out.palmToBall = +ball.pos.distanceTo(w(P.throwHand + '_Hand')).toFixed(4);
      out.armReach = +ath.reach['arm' + P.throwHand].toFixed(4);
      out.support = { w: +supportState.value.toFixed(3), reach: +supportState.reach.toFixed(3), armReach: +ath.reach['arm' + P.otherHand].toFixed(3) };
      out.supportGap = +(ball.pos.distanceTo(athPose.hand[P.otherHand].pos) - R).toFixed(4);
      void palm; void b;
      return out;
    }

    /** Distance of the ball surface to body segments (capsules), hand excluded. */
    function clearance() {
      const w = n => ath.worldOf(n, V());
      const segs = [['L_Thigh', 'L_Calf', 0.075], ['R_Thigh', 'R_Calf', 0.075], ['L_Calf', 'L_Foot', 0.055], ['R_Calf', 'R_Foot', 0.055], ['Pelvis', 'Spine2', 0.14], ['Spine2', 'Neck', 0.13], ['Neck', 'Head', 0.1]];
      const othr = P.otherHand; segs.push([othr + '_UpperArm', othr + '_Forearm', 0.045]);
      let min = Infinity, which = '';
      const c = ball.pos;
      for (const [a, b, rad] of segs) {
        const A = w(a), B = w(b), AB = B.clone().sub(A), u = clamp(c.clone().sub(A).dot(AB) / AB.lengthSq(), 0, 1);
        const d = c.distanceTo(A.clone().addScaledVector(AB, u)) - rad - R;
        if (d < min) { min = d; which = a + '-' + b; }
      }
      return { min: +min.toFixed(4), which };
    }

    startStance();
    return {
      athlete: ath, ball, get plan() { return P; }, get mode() { return mode; }, get t() { return t; }, get request() { return req; },
      setHand(h) { hand = h === 'left' ? 'left' : 'right'; shuffle = null; P = M.plan(Object.assign({}, lastInputs, { hand })); startStance(); }, get hand() { return hand; },
      setPlan, startStance, startApproach, startRecover, evaluate, update, poseReport, clearance,
      dispose() { ath.dispose(); }
    };
  }

  root.BowlingBowler = { create };
})(typeof window !== 'undefined' ? window : globalThis);
