/* Target Shooting 3D — archer rig.
 * Forked from games/bowling/athlete.js (V20, itself from basketball athletes.js V23.1) and reduced to a
 * fully procedural, single-writer pipeline:
 *
 *   every frame:  bind pose  ->  pelvis/spine  ->  legs (IK, feet planted)  ->  clavicles  ->  head look
 *                 ->  beforeArms hook  ->  arms (IK + palm orientation + fingers)  ->  blink  ->  one matrix update
 *
 * There is no animation mixer and no mocap clip on this character: no second system can write the same
 * bones, nothing is blended with stale clip data, and the result is a pure function of the pose
 * parameters (which the archer controller smooths). Starting from the bind pose every frame removes any
 * frame-to-frame accumulation, so the skeleton can never drift, scale or wobble.
 *
 * Asset: Microsoft Rocketbox adult male avatar (MIT, see assets/LICENSES/Rocketbox-MIT.txt).
 * Rig facts: Biped skeleton, bind pose faces +Z, character's left at +X, knee/elbow bend chosen by pole vectors.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const UP = new T.Vector3(0, 1, 0);
  const _v = Array.from({ length: 16 }, () => new T.Vector3());
  const _q = Array.from({ length: 10 }, () => new T.Quaternion());
  const _s = Array.from({ length: 10 }, () => new T.Vector3());
  const _sq = Array.from({ length: 5 }, () => new T.Quaternion());
  const _m = new T.Matrix4();
  const _w1 = new T.Vector3(), _w2 = new T.Vector3(), _wq = new T.Quaternion(), _wq2 = new T.Quaternion(), _wq3 = new T.Quaternion();

  function worldPos(o, out) { return out.setFromMatrixPosition(o.matrixWorld); }
  function worldQuat(o, out) { o.matrixWorld.decompose(_w1, out, _w2); return out; }
  function setWorldQuat(bone, qWorld) {
    const p = worldQuat(bone.parent, _wq).invert();
    bone.quaternion.copy(p.multiply(qWorld)).normalize();
    bone.updateMatrixWorld(true);
  }
  function rotateWorld(bone, dq) { const w = worldQuat(bone, _wq2); setWorldQuat(bone, _wq3.copy(dq).multiply(w)); }

  /**
   * Constructive two-bone IK: a (root) -> b (mid) -> c (end).
   * The elbow/knee position is built from the law of cosines in the plane chosen by the pole vector, and each
   * bone's world orientation is then constructed from (bone direction, hinge axis) — the hinge being the mid
   * bone's local Z. Nothing is accumulated or applied incrementally, so the result is a pure, continuous
   * function of (target, pole): no path dependence, no sudden roll of the upper bone, no feedback.
   * `sign` (+1/−1) is the anatomical flexion sense measured on the bind pose (see captureRest).
   */
  const _Z = new T.Vector3(0, 0, 1), _m1 = new T.Matrix4(), _m2 = new T.Matrix4();
  function frameRot(u0, h0, u1, h1, out) {
    const w0 = _s[8].crossVectors(u0, h0), w1 = _s[9].crossVectors(u1, h1);
    _m1.makeBasis(u0, h0, w0); _m2.makeBasis(u1, h1, w1);
    return out.setFromRotationMatrix(_m2.multiply(_m1.transpose()));
  }
  function solveTwoBone(a, b, c, target, pole, weight, sign = 1, memo = null, softStart = 0.93) {
    if (weight <= 0.001) return 0;
    const qa0 = _sq[0].copy(a.quaternion), qb0 = _sq[1].copy(b.quaternion);
    const A = worldPos(a, _s[0]), B = worldPos(b, _s[1]), C = worldPos(c, _s[2]);
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const AT = _s[3].subVectors(target, A);
    const want0 = AT.length();
    // soft IK: near full extension the elbow angle has an infinite derivative (acos at 1) — a reach that
    // crosses the limit would make the elbow pop. Reach is remapped smoothly so the limb approaches straight
    // asymptotically (the end effector may fall short by a few millimetres; it never snaps).
    const dMax = (l1 + l2) * 0.999, dSoft = (l1 + l2) * softStart;
    let d = Math.max(want0, Math.abs(l1 - l2) + 1e-3);
    if (d > dSoft) d = dSoft + (dMax - dSoft) * (1 - Math.exp(-(d - dSoft) / (dMax - dSoft)));
    const n = AT.lengthSq() > 1e-10 ? AT.normalize() : AT.set(0, -1, 0);
    // pole direction perpendicular to the reach axis (fallback keeps the current bend plane)
    const pp = _s[4].subVectors(pole, A); pp.addScaledVector(n, -pp.dot(n));
    if (pp.lengthSq() < 1e-8) { pp.subVectors(B, A).addScaledVector(n, -_s[5].subVectors(B, A).dot(n)); if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1).addScaledVector(n, -n.z); }
    pp.normalize();
    // swivel continuity: when the pole is nearly (anti)parallel to the reach axis its projection is ill-defined
    // and the elbow could spin; in that zone the previous swivel direction (re-projected) takes over smoothly
    if (memo) {
      const raw = _s[8].subVectors(pole, A); const L = raw.length() || 1;
      const sinP = Math.sqrt(Math.max(0, 1 - Math.pow(raw.dot(n) / L, 2)));
      if (memo.has) {
        const prev = _s[9].copy(memo.dir).addScaledVector(n, -memo.dir.dot(n));
        if (prev.lengthSq() > 1e-8 && sinP < 0.5) { prev.normalize(); const k = sinP / 0.5; pp.multiplyScalar(k).addScaledVector(prev, 1 - k).normalize(); }
      }
      memo.dir.copy(pp); memo.has = true;
    }
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const E = _s[5].copy(A).addScaledVector(n, l1 * cosA).addScaledVector(pp, l1 * sinA);
    const Tg = _s[6].copy(A).addScaledVector(n, d);
    const u = _s[7].subVectors(E, A).normalize();
    const v = _s[2].subVectors(Tg, E).normalize();
    // desired hinge axis (mid bone local Z in world): ∝ −(n × pp) for flexion toward the pole
    const hz = _s[1].crossVectors(n, pp).multiplyScalar(-sign).normalize();
    // current (unsolved) frames
    const qa = worldQuat(a, _sq[2]).clone(), qb = worldQuat(b, _sq[3]).clone();
    const Bc = worldPos(b, _s[0].clone()), Ac = worldPos(a, new T.Vector3()), Cc = worldPos(c, new T.Vector3());
    const uc = Bc.clone().sub(Ac).normalize(), vc = Cc.sub(Bc).normalize();
    const hc = _Z.clone().applyQuaternion(qb);
    const hcu = hc.clone().addScaledVector(uc, -hc.dot(uc)).normalize(), hcv = hc.clone().addScaledVector(vc, -hc.dot(vc)).normalize();
    const hzu = hz.clone().addScaledVector(u, -hz.dot(u)).normalize(), hzv = hz.clone().addScaledVector(v, -hz.dot(v)).normalize();
    const Ra = frameRot(uc, hcu, u, hzu, new T.Quaternion());
    const Rb = frameRot(vc, hcv, v, hzv, new T.Quaternion());
    if (root.TS_IKDBG) (root.TS_IKDBG[a.name] = { u: u.clone(), hz: hz.clone(), n: n.clone(), pp: pp.clone(), t: target.clone(), A: A.clone(), d });
    setWorldQuat(a, Ra.multiply(qa));
    setWorldQuat(b, Rb.multiply(qb));
    if (weight < 0.999) {
      a.quaternion.copy(qa0.slerp(a.quaternion, weight)); a.updateMatrixWorld(true);
      b.quaternion.copy(qb0.slerp(b.quaternion, weight)); b.updateMatrixWorld(true);
    }
    return want0 / (l1 + l2);
  }

  async function load(quality = {}) {
    const A = TS.assets, aniso = quality.anisotropy || 4;
    const loader = new T.GLTFLoader();
    if (root.MeshoptDecoder) loader.setMeshoptDecoder(root.MeshoptDecoder);
    const buf = await A.buffer('models/archer.glb');
    const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, e => rej(new Error('model: ' + (e && e.message || e)))));
    const names = ['archer_kit.jpg', 'body_normal.jpg', 'body_rough.jpg', 'head_a.jpg', 'head_a_normal.jpg', 'head_a_rough.jpg'];
    const tex = {};
    await Promise.all(names.map(n => A.texture('textures/' + n, { srgb: !/normal|rough/.test(n), anisotropy: aniso }).then(t => { tex[n] = t; })));
    return { gltf, tex, create: () => new Rig(gltf, tex), dispose() { Object.values(tex).forEach(t => t.dispose()); } };
  }

  const FINGERS = ['0', '1', '2', '3', '4'];

  class Rig {
    constructor(gltf, tex) {
      this.root = T.SkeletonUtils.clone(gltf.scene);
      this.root.name = 'archer';
      const matBody = new T.MeshStandardMaterial({ skinning: true, map: tex['archer_kit.jpg'], normalMap: tex['body_normal.jpg'], roughnessMap: tex['body_rough.jpg'], roughness: 1, metalness: 0, normalScale: new T.Vector2(1, -1) });
      const matHead = new T.MeshStandardMaterial({ skinning: true, map: tex['head_a.jpg'], normalMap: tex['head_a_normal.jpg'], roughnessMap: tex['head_a_rough.jpg'], roughness: 1, metalness: 0, normalScale: new T.Vector2(1, -1) });
      this.meshes = [];
      this.root.traverse(o => {
        if (o.isSkinnedMesh) {
          o.material = (o.material.name || '').includes('head') ? matHead : matBody;
          o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
          this.meshes.push(o);
        }
      });
      this.materials = [matBody, matHead];
      this.bones = {};
      this.root.traverse(o => { if (o.isBone || /^Bip01/.test(o.name)) this.bones[o.name.replace(/^Bip01_/, '')] = o; });
      this.captureRest();
      this.pose = {
        pelvisPos: new T.Vector3(), pelvisW: 0, tilt: 0, roll: 0, turn: 0,
        bend: 0, side: 0, twist: 0, look: new T.Vector3(), lookW: 0, lookLimit: 1.15,
        clavicle: { L: { amount: 0, dir: new T.Vector3(0, -1, 0) }, R: { amount: 0, dir: new T.Vector3(0, -1, 0) } },
        hand: { L: hand(), R: hand() },
        foot: { L: foot(), R: foot() }
      };
      const r = TS.util.rng(1234);
      this.blink = { t: 1.5, phase: 0, rng: r };
      this.twist = { L: 0, R: 0 }; this.twistPrev = { L: null, R: null };
      this.swivel = { L: { dir: new T.Vector3(), has: false }, R: { dir: new T.Vector3(), has: false } }; this.yaw = 0; this.reach = { L: 0, R: 0, armL: 0, armR: 0 };
      this.beforeArms = null;
    }

    captureRest() {
      this.root.updateMatrixWorld(true);
      const b = this.bones, rest = this.rest = {};
      for (const [k, o] of Object.entries(b)) rest[k] = { q: o.quaternion.clone(), p: o.position.clone(), s: o.scale.clone(), wq: worldQuat(o, new T.Quaternion()), wp: worldPos(o, new T.Vector3()) };
      for (const s of ['L', 'R']) {
        const H = rest[`${s}_Hand`].wp, M = rest[`${s}_Finger2`].wp, I = rest[`${s}_Finger1`].wp, P = rest[`${s}_Finger4`].wp;
        const f = new T.Vector3().subVectors(M, H).normalize();
        const across = new T.Vector3().subVectors(I, P).normalize();
        const n = new T.Vector3().crossVectors(f, across).normalize();
        const tipMid = rest[`${s}_Finger22`] ? rest[`${s}_Finger22`].wp : M;
        const curlDir = new T.Vector3().subVectors(tipMid, H).sub(f.clone().multiplyScalar(new T.Vector3().subVectors(tipMid, H).dot(f)));
        if (curlDir.lengthSq() > 1e-6 && curlDir.dot(n) < 0) n.negate();
        const inv = rest[`${s}_Hand`].wq.clone().invert();
        rest[`${s}_palm`] = { f: f.clone().applyQuaternion(inv), n: n.clone().applyQuaternion(inv), len: H.distanceTo(M) };
        const lat = new T.Vector3().crossVectors(f, n).normalize();
        for (const fi of FINGERS) for (const seg of ['', '1', '2']) {
          const key = `${s}_Finger${fi}${seg}`; if (!rest[key]) continue;
          const lq = rest[key].wq.clone().invert();
          rest[key].bendAxis = (fi === '0' ? f.clone().negate() : lat.clone()).applyQuaternion(lq).normalize();
        }
        rest[`${s}_footVec`] = new T.Vector3().subVectors(rest[`${s}_Toe0`].wp, rest[`${s}_Foot`].wp);
        const toeDir = new T.Vector3(1, 0, 0).applyQuaternion(rest[`${s}_Toe0`].wq).setY(0).normalize();
        rest[`${s}_tipVec`] = toeDir.multiplyScalar(0.065).add(new T.Vector3(0, -0.002, 0));
        rest[`${s}_heelVec`] = new T.Vector3(0, -rest[`${s}_Foot`].wp.y, -0.06);
      }
      // anatomical flexion sense of each hinge, measured on the (slightly bent) bind pose
      this.hingeSign = {};
      for (const [k, a, m, e] of [['armL', 'L_UpperArm', 'L_Forearm', 'L_Hand'], ['armR', 'R_UpperArm', 'R_Forearm', 'R_Hand'], ['L', 'L_Thigh', 'L_Calf', 'L_Foot'], ['R', 'R_Thigh', 'R_Calf', 'R_Foot']]) {
        const u0 = rest[m].wp.clone().sub(rest[a].wp), v0 = rest[e].wp.clone().sub(rest[m].wp);
        const z = new T.Vector3(0, 0, 1).applyQuaternion(rest[m].wq);
        this.hingeSign[k] = u0.cross(v0).dot(z) >= 0 ? 1 : -1;
      }
      for (const s of ['L', 'R']) rest[`${s}_handRel`] = rest[`${s}_Forearm`].wq.clone().invert().multiply(rest[`${s}_Hand`].wq);
      this.legLength = rest.L_Thigh.wp.distanceTo(rest.L_Calf.wp) + rest.L_Calf.wp.distanceTo(rest.L_Foot.wp);
      this.upperArm = rest.L_UpperArm.wp.distanceTo(rest.L_Forearm.wp);
      this.foreArm = rest.L_Forearm.wp.distanceTo(rest.L_Hand.wp);
      this.armLength = this.upperArm + this.foreArm;
      this.pelvisHeight = rest.Pelvis.wp.y;
      this.headFwd = new T.Vector3(0, 0, 1).applyQuaternion(rest.Head.wq.clone().invert());
    }

    setTransform(x, z, yaw) { this.root.position.set(x, 0, z); this.yaw = yaw; this.root.rotation.set(0, yaw, 0); }

    /** Character frame vectors for the current yaw. */
    frame(out = {}) {
      const q = _q[9].setFromAxisAngle(UP, this.yaw);
      out.fwd = (out.fwd || new T.Vector3()).set(0, 0, 1).applyQuaternion(q);
      out.left = (out.left || new T.Vector3()).set(1, 0, 0).applyQuaternion(q);
      return out;
    }

    update(dt) {
      const b = this.bones, p = this.pose, rest = this.rest;
      // 1) bind pose — the only base. Positions AND scales are restored so nothing can accumulate.
      for (const k in b) { const o = b[k], r = rest[k]; o.quaternion.copy(r.q); o.position.copy(r.p); o.scale.copy(r.s); }
      this.root.updateMatrixWorld(true);
      const yawQ = _q[0].setFromAxisAngle(UP, this.yaw);
      const fwd = _v[0].set(0, 0, 1).applyQuaternion(yawQ).clone();
      const right = _v[1].set(-1, 0, 0).applyQuaternion(yawQ).clone();
      // 2) pelvis placement + tilt / roll / turn
      const pel = b.Pelvis;
      if (p.pelvisW > 0) {
        const cur = worldPos(pel, _v[2]);
        const wp = _v[3].copy(cur).lerp(p.pelvisPos, p.pelvisW);
        pel.parent.worldToLocal(wp); pel.position.copy(wp); pel.updateMatrixWorld(true);
      }
      if (p.tilt) rotateWorld(pel, _q[1].setFromAxisAngle(right, -p.tilt));
      if (p.roll) rotateWorld(pel, _q[1].setFromAxisAngle(fwd, p.roll));
      if (p.turn) rotateWorld(pel, _q[1].setFromAxisAngle(UP, p.turn));
      // 3) spine: bend / side / twist distributed over three vertebrae (no single joint takes it all)
      const bendTotal = p.bend - p.tilt * 0.85;
      if (bendTotal || p.twist || p.side) {
        for (const [k, s] of [['Spine', .28], ['Spine1', .36], ['Spine2', .36]]) {
          if (!b[k]) continue;
          if (bendTotal) rotateWorld(b[k], _q[1].setFromAxisAngle(right, -bendTotal * s));
          if (p.side) rotateWorld(b[k], _q[1].setFromAxisAngle(fwd, p.side * s));
          if (p.twist) rotateWorld(b[k], _q[1].setFromAxisAngle(UP, p.twist * s));
        }
      }
      // 4) legs: planted feet from toe-joint ground points (sole never below the floor)
      for (const s of ['L', 'R']) {
        const f = p.foot[s]; if (f.w <= 0) continue;
        const heading = this.yaw + (s === 'L' ? 1 : -1) * f.turn;
        const qYaw = _q[2].setFromAxisAngle(UP, heading);
        const hf = _v[4].set(Math.sin(heading), 0, Math.cos(heading));
        const pitchAxis = _v[5].crossVectors(UP, hf).normalize();
        const qPitch = _q[3].setFromAxisAngle(pitchAxis, f.heel);
        const qFoot = _q[4].copy(qPitch).multiply(qYaw);
        const ankle = _v[6].copy(rest[`${s}_footVec`]).applyQuaternion(qFoot).negate().add(f.toe);
        ankle.y += f.lift;
        const keepPitch = f.heel > 0 ? f.heel - f.toeFlat * Math.min(f.heel, 0.8) : f.heel;
        const qToe = _q[5].setFromAxisAngle(pitchAxis, keepPitch).multiply(qYaw);
        const toeJointY = f.toe.y + f.lift;
        const tipY = toeJointY + _v[8].copy(rest[`${s}_tipVec`]).applyQuaternion(qToe).y;
        const heelY = ankle.y + _v[8].copy(rest[`${s}_heelVec`]).applyQuaternion(qFoot).y;
        const sink = Math.min(tipY, heelY, toeJointY - 0.002);
        if (sink < 0) ankle.y -= sink;
        f.ankle.copy(ankle);
        const pole = _v[7].copy(f.kneeDir.lengthSq() > 0 ? f.kneeDir : hf).multiplyScalar(1.5).add(ankle); pole.y += 0.55;
        this.reach[s] = solveTwoBone(b[`${s}_Thigh`], b[`${s}_Calf`], b[`${s}_Foot`], ankle, pole, f.w, this.hingeSign[s], null, 0.975);
        const desired = _q[5].copy(qFoot).multiply(rest[`${s}_Foot`].wq);
        const cur = worldQuat(b[`${s}_Foot`], _q[6]);
        setWorldQuat(b[`${s}_Foot`], cur.slerp(desired, f.w));
        const toe = b[`${s}_Toe0`];
        if (toe && f.heel > 0) {
          const qT = _q[7].setFromAxisAngle(pitchAxis, keepPitch).multiply(qYaw).multiply(rest[`${s}_Toe0`].wq);
          setWorldQuat(toe, worldQuat(toe, _q[8]).slerp(qT, f.w));
        }
      }
      // 5) clavicles (shoulder set: bow shoulder down, draw shoulder back)
      for (const s of ['L', 'R']) {
        const c = p.clavicle[s]; if (!c || !c.amount) continue;
        const cl = b[`${s}_Clavicle`], ua = b[`${s}_UpperArm`]; if (!cl || !ua) continue;
        const C0 = worldPos(cl, _v[8]), U0 = worldPos(ua, _v[9]);
        const v = _v[10].subVectors(U0, C0).normalize();
        const axis = _v[11].crossVectors(v, c.dir); if (axis.lengthSq() < 1e-8) continue;
        rotateWorld(cl, _q[1].setFromAxisAngle(axis.normalize(), c.amount));
      }
      // 6) head look (bounded total rotation, shared between neck and head). The clavicles hang from the Neck
      //    bone in this skeleton; anatomically they belong to the chest, so their world transforms are kept
      //    while the neck turns (otherwise turning the head would swing both shoulders and arms).
      if (p.lookW > 0) {
        const keep = ['L_Clavicle', 'R_Clavicle'].map(k => b[k]).filter(Boolean).map(o => [o, o.matrixWorld.clone()]);
        for (const [k, share] of [['Neck', .4], ['Head', 1]]) {
          const bone = b[k]; if (!bone) continue;
          const hp = worldPos(b.Head, _v[2]);
          const want = _v[3].subVectors(p.look, hp).normalize();
          const hq = worldQuat(b.Head, _q[2]);
          const cur = _v[4].copy(this.headFwd).applyQuaternion(hq);
          const dq = _q[3].setFromUnitVectors(cur, want);
          const angle = 2 * Math.acos(clamp(dq.w, -1, 1)), lim = p.lookLimit;
          const scale = (angle > lim ? lim / angle : 1) * share * p.lookW;
          rotateWorld(bone, _q[4].identity().slerp(dq, scale));
          if (k === 'Neck') for (const [o, Mw] of keep) {
            const local = _m.copy(o.parent.matrixWorld).invert().multiply(Mw);
            local.decompose(o.position, o.quaternion, _w1);
            o.updateMatrixWorld(true);
          }
        }
      }
      // 7) controller hook: chest, shoulders and head joint are final here
      if (this.beforeArms) this.beforeArms(this);
      // 8) arms + palms + fingers
      for (const s of ['L', 'R']) {
        const h = p.hand[s]; if (h.w <= 0) continue;
        const pal = rest[`${s}_palm`];
        const fW = _v[6].copy(h.fdir).normalize(), nW = _v[7].copy(h.ndir).normalize();
        fW.sub(_v[8].copy(nW).multiplyScalar(fW.dot(nW))).normalize();
        const wrist = _v[9].copy(h.pos).addScaledVector(fW, -pal.len * 0.55).addScaledVector(nW, -0.028);
        this.reach['arm' + s] = solveTwoBone(b[`${s}_UpperArm`], b[`${s}_Forearm`], b[`${s}_Hand`], wrist, h.pole, h.w, this.hingeSign['arm' + s], this.swivel[s]);
        const hq = worldQuat(b[`${s}_Hand`], _q[2]);
        const fCur = _v[2].copy(pal.f).applyQuaternion(hq), nCur = _v[3].copy(pal.n).applyQuaternion(hq);
        const q1 = _q[3].setFromUnitVectors(fCur, fW);
        nCur.applyQuaternion(q1);
        const nProj = nCur.sub(_v[4].copy(fW).multiplyScalar(nCur.dot(fW))).normalize();
        let ang = Math.acos(clamp(nProj.dot(nW), -1, 1));
        if (_v[5].crossVectors(nProj, nW).dot(fW) < 0) ang = -ang;
        const desired = _q[4].setFromAxisAngle(fW, ang).multiply(q1).multiply(hq);
        setWorldQuat(b[`${s}_Hand`], worldQuat(b[`${s}_Hand`], _q[5]).slerp(desired, h.w));
        // forearm roll: the Biped rig has no twist bones, so half of the hand's pronation/supination is given to
        // the forearm (radius/ulna roll) instead of being taken entirely at the wrist (prevents candy-wrapping)
        {
          const fa = b[`${s}_Forearm`], hb = b[`${s}_Hand`];
          const handW = worldQuat(hb, _q[6]).clone();
          const qF = worldQuat(fa, _q[7]);
          const rel = _q[8].copy(qF).invert().multiply(handW);                       // hand in forearm space
          const delta = _q[9].copy(rest[`${s}_handRel`]).invert().multiply(rel);    // change from the bind relation
          let tw = 2 * Math.atan2(delta.x, delta.w);                                // twist about the bone axis (local +X)
          if (tw > Math.PI) tw -= 2 * Math.PI; if (tw < -Math.PI) tw += 2 * Math.PI;
          // keep the measured twist continuous across ±π (no sign flip of the forearm roll between frames)
          const prev = this.twistPrev[s];
          if (prev !== null) { let dd = tw - prev; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI; tw = prev + dd; }
          this.twistPrev[s] = tw;
          const share = clamp(tw * 0.55, -1.2, 1.2);
          if (Math.abs(share) > 1e-4) {
            fa.quaternion.multiply(_q[8].setFromAxisAngle(_v[10].set(1, 0, 0), share)); fa.updateMatrixWorld(true);
            setWorldQuat(hb, handW);
          }
          this.twist[s] = tw;
        }
        // fingers: per-finger curl (index / middle / ring / little can differ — a draw hook or a bow grip)
        for (const fi of FINGERS) {
          const amt0 = fi === '0' ? h.thumb : (h.fingers ? h.fingers[+fi - 1] : h.curl);
          for (const [seg, k] of [['', 1], ['1', 1.15], ['2', .9]]) {
            const key = `${s}_Finger${fi}${seg}`; const bone = b[key]; const r = rest[key]; if (!bone || !r) continue;
            const target = _q[6].copy(r.q).multiply(_q[7].setFromAxisAngle(r.bendAxis, amt0 * k * (fi === '4' ? 1.08 : 1)));
            bone.quaternion.slerp(target, h.w);
          }
        }
        b[`${s}_Hand`].updateMatrixWorld(true);
      }
      // 9) blink (eyelids only; seeded timing)
      this.blink.t -= dt;
      if (this.blink.t <= 0) { this.blink.phase = 0.16; this.blink.t = 2.2 + this.blink.rng() * 3.5; }
      if (this.blink.phase > 0) {
        this.blink.phase = Math.max(0, this.blink.phase - dt);
        const k = Math.sin((1 - this.blink.phase / 0.16) * Math.PI);
        for (const s of ['L', 'R']) { const top = b[`${s}EyeBlinkTop`]; if (top) top.quaternion.multiply(_q[6].setFromAxisAngle(_v[5].set(0, 0, 1), -0.45 * k)); }
      }
      this.root.updateMatrixWorld(true);
    }

    worldOf(name, out) { return worldPos(this.bones[name], out); }
    quatOf(name, out) { return worldQuat(this.bones[name], out); }
    dispose() { this.materials.forEach(m => m.dispose()); }
  }

  function hand() { return { w: 0, pos: new T.Vector3(), fdir: new T.Vector3(0, -1, 0), ndir: new T.Vector3(0, 0, 1), pole: new T.Vector3(), curl: 0, fingers: null, thumb: 0 }; }
  function foot() { return { w: 0, toe: new T.Vector3(), ankle: new T.Vector3(), lift: 0, heel: 0, turn: 0.1, toeFlat: 1, kneeDir: new T.Vector3() }; }

  TS.Rig = { load, solveTwoBone, Rig, worldPos, worldQuat };
})(typeof window !== 'undefined' ? window : globalThis);
