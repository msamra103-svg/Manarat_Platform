/* صيد الأسماك V24.1 — runtime rig for the realistic skinned angler (MakeHuman CC0 skeleton, reduced to 66 bones).
 * All bones have identity rest rotations, so every rest direction is known in the character frame.
 * Arms and legs use analytic two-bone IK with explicit elbow/knee poles (knees always bend forward),
 * hands are oriented around the object they grip (rod, reel knob, net handle) and fingers curl around it.
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const V3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  const _m1 = new T.Matrix4(), _m2 = new T.Matrix4(), _q = new T.Quaternion();
  function frame(a, b) { const x = a.clone().normalize(); let y = b.clone().sub(x.clone().multiplyScalar(b.dot(x))); if (y.lengthSq() < 1e-10) y = new T.Vector3(0, 1, 0).cross(x); y.normalize(); const z = new T.Vector3().crossVectors(x, y); return new T.Matrix4().makeBasis(x, y, z); }
  /* world rotation that maps rest (dir, side) onto target (dir, side) */
  function mapFrames(restDir, restSide, dir, side) { _m1.copy(frame(dir, side)); _m2.copy(frame(restDir, restSide)).transpose(); return new T.Quaternion().setFromRotationMatrix(_m1.multiply(_m2)); }
  function setWorldQuat(bone, qWorld) { bone.parent.getWorldQuaternion(_q); bone.quaternion.copy(_q.invert().multiply(qWorld)); bone.updateMatrixWorld(true); }

  class SkinnedAnglerRig {
    constructor(model) {
      this.root = model; this.b = {};
      model.traverse(o => { if (o.isBone) this.b[o.name] = o; });
      const need = ['root', 'spine01', 'spine03', 'neck01', 'head', 'upperarm01_R', 'lowerarm01_R', 'wrist_R', 'upperarm01_L', 'lowerarm01_L', 'wrist_L', 'upperleg01_R', 'lowerleg01_R', 'foot_R', 'upperleg01_L', 'lowerleg01_L', 'foot_L'];
      const miss = need.filter(n => !this.b[n]); if (miss.length) throw new Error('skinned rig missing ' + miss.join(','));
      Object.values(this.b).forEach(bn => bn.quaternion.identity()); model.updateMatrixWorld(true);
      const inv = model.matrixWorld.clone().invert(); this.rest = {};
      for (const [n, bn] of Object.entries(this.b)) this.rest[n] = bn.getWorldPosition(new T.Vector3()).applyMatrix4(inv);
      const R = this.rest, d = (a, c) => R[c].clone().sub(R[a]);
      this.chain = {};
      for (const s of ['L', 'R']) {
        this.chain['arm' + s] = { up: this.b['upperarm01_' + s], low: this.b['lowerarm01_' + s], end: this.b['wrist_' + s], A: d('upperarm01_' + s, 'lowerarm01_' + s).length(), B: d('lowerarm01_' + s, 'wrist_' + s).length(), dUp: d('upperarm01_' + s, 'lowerarm01_' + s), dLow: d('lowerarm01_' + s, 'wrist_' + s), side: new T.Vector3(0, 0, -1) };
        this.chain['leg' + s] = { up: this.b['upperleg01_' + s], low: this.b['lowerleg01_' + s], end: this.b['foot_' + s], A: d('upperleg01_' + s, 'lowerleg01_' + s).length(), B: d('lowerleg01_' + s, 'foot_' + s).length(), dUp: d('upperleg01_' + s, 'lowerleg01_' + s), dLow: d('lowerleg01_' + s, 'foot_' + s), side: new T.Vector3(0, 0, 1) };
        // hand rest frame
        const fh = k => R[`finger${k}-1_${s}`] || R['wrist_' + s];
        const knuck = fh(2).clone().add(fh(3)).add(fh(4)).add(fh(5)).multiplyScalar(0.25);
        const hDir = knuck.clone().sub(R['wrist_' + s]).normalize();
        let lat = fh(2).clone().sub(fh(5)); lat.sub(hDir.clone().multiplyScalar(lat.dot(hDir))).normalize();
        let palm = new T.Vector3().crossVectors(hDir, lat); if (palm.dot(new T.Vector3(s === 'L' ? -1 : 1, 0, 0)) < 0) palm.negate();
        const handed = Math.sign(new T.Vector3().crossVectors(hDir, lat).dot(palm)) || 1;
        const centre = R['wrist_' + s].clone().lerp(knuck, 0.55).add(palm.clone().multiplyScalar(0.012));
        const fingers = [];
        for (let k = 1; k <= 5; k++) for (let j = 1; j <= 3; j++) { const bn = this.b[`finger${k}-${j}_${s}`]; if (bn) fingers.push({ bone: bn, k, j }); }
        // curl sign: rotating the middle finger about the lateral axis must move the fingertip towards the palm
        const tip = (R[`finger3-3_${s}`] || knuck).clone().sub(R[`finger3-1_${s}`] || R['wrist_' + s]);
        const curlSign = tip.clone().applyAxisAngle(lat, 0.4).sub(tip).dot(palm) > 0 ? 1 : -1;
        this.chain['hand' + s] = { hDir, lat, palm, handed, offset: centre.clone().sub(R['wrist_' + s]), fingers, curlSign };
      }
      this.look = new T.Vector3(0, 1.5, 5); this.headYaw = 0; this.headPitch = 0; this.t = 0; this.grip = { R: 1, L: 1 };
      this.feet = { R: R['foot_R'].clone().add(new T.Vector3(-0.015, 0, -0.06)), L: R['foot_L'].clone().add(new T.Vector3(0.02, 0, 0.06)) };
    }
    w(v) { return v.clone().applyQuaternion(this.rootQ); }                      // char → world direction
    p(v) { return v.clone().applyMatrix4(this.root.matrixWorld); }             // char → world point
    twoBone(c, target, pole) {
      const S = c.up.getWorldPosition(new T.Vector3()), toT = target.clone().sub(S), dist = Math.min(Math.max(toT.length(), 0.05), c.A + c.B - 1e-4), dir = toT.normalize();
      const cosA = Math.min(1, Math.max(-1, (c.A * c.A + dist * dist - c.B * c.B) / (2 * c.A * dist))), sinA = Math.sqrt(1 - cosA * cosA);
      let n = pole.clone().sub(S); n.sub(dir.clone().multiplyScalar(n.dot(dir))); if (n.lengthSq() < 1e-8) n = this.w(c.side); n.normalize();
      const E = S.clone().add(dir.clone().multiplyScalar(c.A * cosA)).add(n.clone().multiplyScalar(c.A * sinA)), Tp = S.clone().add(dir.clone().multiplyScalar(dist));
      setWorldQuat(c.up, mapFrames(this.w(c.dUp), this.w(c.side), E.clone().sub(S), n).multiply(this.rootQ));
      c.low.parent !== c.up && c.low.parent.quaternion.identity();
      c.low.parent.updateMatrixWorld(true);
      setWorldQuat(c.low, mapFrames(this.w(c.dLow), this.w(c.side), Tp.clone().sub(E), n).multiply(this.rootQ));
      return E;
    }
    /* place a hand around an object: grip point, object axis (index finger side), palm faces the object from direction `from` */
    hand(side, gripPoint, axis, from, pole, curl) {
      const H = this.chain['hand' + side], C = this.chain['arm' + side];
      const lat = axis.clone().normalize(); let palmD = from.clone().negate(); palmD.sub(lat.clone().multiplyScalar(palmD.dot(lat))).normalize();
      const hDir = new T.Vector3().crossVectors(lat, palmD).multiplyScalar(H.handed);
      const q = mapFrames(this.w(H.hDir), this.w(H.lat), hDir, lat);
      const centre = gripPoint.clone().sub(palmD.clone().multiplyScalar(0.026));
      const wrist = centre.clone().sub(this.w(H.offset).applyQuaternion(q));
      this.protract(side, C, wrist);
      this.twoBone(C, wrist, pole);
      setWorldQuat(C.end, q.clone().multiply(this.rootQ));
      this.curl(side, curl);
    }
    /* shoulder girdle: when the hand target is beyond the arm's reach, swing the clavicle towards it (protraction) */
    protract(side, C, wrist) {
      const cl = this.b['clavicle_' + side]; if (!cl) return;
      cl.quaternion.identity(); cl.updateMatrixWorld(true);
      const P = cl.getWorldPosition(new T.Vector3()), S = C.up.getWorldPosition(new T.Vector3()), need = wrist.distanceTo(S) - (C.A + C.B) * 0.96;
      if (need <= 0) return;
      const a = S.clone().sub(P), bb = wrist.clone().sub(P), axis = new T.Vector3().crossVectors(a, bb); if (axis.lengthSq() < 1e-10) return;
      const ang = Math.min(0.42, need / a.length(), a.angleTo(bb));
      setWorldQuat(cl, new T.Quaternion().setFromAxisAngle(axis.normalize(), ang).multiply(cl.getWorldQuaternion(new T.Quaternion())));
    }
    curl(side, amount) {
      const H = this.chain['hand' + side];
      for (const f of H.fingers) {
        let a = 0;
        if (f.k === 1) a = [0.25, 0.35, 0.3][f.j - 1] * amount;
        else a = [0.95, 1.15, 0.75][f.j - 1] * amount * (1 + (f.k - 3) * 0.06);
        f.bone.quaternion.setFromAxisAngle(f.k === 1 ? H.hDir : H.lat, a * H.curlSign * (f.k === 1 ? 0.6 : 1));
      }
    }
    update(sim, dt, reduced) {
      const b = this.b, pose = sim.pose, t = (this.t += dt), model = this.root;
      model.updateMatrixWorld(true); this.rootQ = model.getWorldQuaternion(new T.Quaternion());
      // pelvis: crouch, sway, keep upright against the boat roll
      const rootB = b.root, up = new T.Vector3(0, 1, 0), charUp = up.clone().applyQuaternion(this.rootQ), tilt = new T.Quaternion().setFromUnitVectors(charUp, up);
      rootB.position.copy(this.rest.root).add(new T.Vector3(reduced ? 0 : Math.sin(t * 0.7) * 0.01, -pose.crouch * 0.11, -pose.lean * 0.04));
      rootB.quaternion.copy(new T.Quaternion().slerp(this.rootQ.clone().invert().multiply(tilt).multiply(this.rootQ), 0.75)).multiply(new T.Quaternion().setFromAxisAngle(up, -pose.yaw * 0.25));
      const breathe = reduced ? 0 : Math.sin(t * 1.6) * 0.01;
      const lean = pose.lean, yaw = -pose.yaw + (['reel', 'butt'].includes(pose.left) ? -0.32 : 0); // shoulders turn into the rod when both hands are on it
      [['spine04', 0.15, 0.15], ['spine03', 0.3, 0.25], ['spine02', 0.3, 0.3], ['spine01', 0.25 + breathe, 0.3]].forEach(([n, kl, ky]) => { if (b[n]) b[n].quaternion.setFromEuler(new T.Euler(lean * kl * 1.2, yaw * ky * 0.6, 0)); });
      model.updateMatrixWorld(true);
      // head & neck look-at
      const target = this.lookTarget(sim), neckQ = b.neck01.parent.getWorldQuaternion(new T.Quaternion()), local = target.clone().sub(b.head.getWorldPosition(new T.Vector3())).applyQuaternion(neckQ.invert());
      const yawT = Math.max(-1.1, Math.min(1.1, Math.atan2(local.x, local.z))), pitchT = Math.max(-0.6, Math.min(0.45, Math.atan2(local.y, Math.hypot(local.x, local.z))));
      const k = Math.min(1, dt * (reduced ? 2.5 : 5)); this.headYaw += (yawT - this.headYaw) * k; this.headPitch += (pitchT - this.headPitch) * k;
      b.neck01.quaternion.setFromEuler(new T.Euler(-this.headPitch * 0.3, this.headYaw * 0.3, 0, 'YXZ')); if (b.neck02) b.neck02.quaternion.setFromEuler(new T.Euler(-this.headPitch * 0.2, this.headYaw * 0.25, 0, 'YXZ'));
      b.head.quaternion.setFromEuler(new T.Euler(-this.headPitch * 0.5, this.headYaw * 0.45, 0, 'YXZ'));
      model.updateMatrixWorld(true);
      // arms
      const D = V3(sim.rod.D), e1 = V3(sim.rod.e1), e2 = V3(sim.rod.e2);
      const right = this.w(new T.Vector3(-1, 0, 0)), fwd = this.w(new T.Vector3(0, 0, 1)), down = new T.Vector3(0, -1, 0), chest = b.spine01.getWorldPosition(new T.Vector3());
      const poleR = chest.clone().add(right.clone().multiplyScalar(0.6)).add(down.clone().multiplyScalar(0.55)).sub(fwd.clone().multiplyScalar(0.25));
      const poleL = chest.clone().sub(right.clone().multiplyScalar(0.6)).add(down.clone().multiplyScalar(0.55)).sub(fwd.clone().multiplyScalar(0.2));
      this.hand('R', V3(sim.gripW), D, e1.clone().multiplyScalar(-0.55).add(e2.clone().multiplyScalar(0.85)), poleR, 1);
      const mode = pose.left, lw = V3(sim.leftHandWorld());
      if (mode === 'reel') this.hand('L', lw, D.clone().negate(), D.clone().multiplyScalar(-0.2).add(e2.clone().multiplyScalar(-1)).add(e1.clone().multiplyScalar(-0.3)), poleL, 0.8);
      else if (mode === 'butt') this.hand('L', lw, D, e1.clone().multiplyScalar(-0.6).add(e2.clone().multiplyScalar(-0.8)), poleL, 1);
      else if (mode === 'net') { const hd = V3(sim.net.hand).sub(V3(sim.net.hoop)).normalize(); this.hand('L', lw, hd, down.clone().add(right.clone().multiplyScalar(-0.3)), poleL, 1); }
      else this.hand('L', lw, right.clone().negate(), fwd.clone().negate(), poleL, 1.05);
      // legs: feet planted, knees forward
      for (const s of ['L', 'R']) {
        const knee = this.p(new T.Vector3(s === 'R' ? -0.2 : 0.22, 0.5, 1.3));
        this.twoBone(this.chain['leg' + s], this.p(this.feet[s]), knee);
        setWorldQuat(b['foot_' + s], this.rootQ.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), s === 'R' ? -0.12 : 0.15)));
      }
    }
    lookTarget(sim) {
      const ph = sim.phase; let p;
      if (['ready', 'windup', 'stroke', 'prepare', 'idle'].includes(ph)) p = sim.aim.target ? [sim.aim.target[0], 0.2, sim.aim.target[2]] : [0, 0.3, -9];
      else if (ph === 'flight' && sim.cast) p = sim.rope.floatPos;
      else if (['net', 'onboard'].includes(ph)) p = sim.net.hoop;
      else if (ph === 'celebrate') p = sim.boat.toWorld([0.3, 1.0, -2.5]);
      else if (ph === 'rebait') p = sim.rope.hookPos;
      else if (sim.hooked && ['hookset', 'fight', 'surface'].includes(ph)) p = sim.hooked.pos;
      else p = sim.rope.floatPos;
      return this.look.lerp(V3(p), 0.15);
    }
  }
  root.FishingAnglerRig = { SkinnedAnglerRig, mapFrames };
})(window);
