/* Bowling athlete rig — forked from games/basketball/athletes.js (V23.1) for bowling only.
 * Licensed Microsoft Rocketbox humans (MIT) + local mocap clips, driven by a procedural layer:
 *   - absolute pelvis placement and pelvis tilt/roll/twist,
 *   - spine bend/side-bend/twist distributed over Spine, Spine1, Spine2,
 *   - analytic two-bone IK for legs with pole vectors, foot orientation from heading + heel raise
 *     about the toe joint, and a toe bone that stays flat on the floor while the heel rises,
 *   - two-bone IK for arms with palm orientation and finger curl, clavicle drop,
 *   - head look and blinking.
 *
 * Rig facts (measured, see DEVELOPMENT.md): Biped skeleton, bind pose faces +Z, character's left
 * at +X, bones' local +X runs along the bone toward the child, knee/elbow hinge = local Z.
 * The solver never assumes an axis convention: everything is done with world-space vectors,
 * and the knee/elbow bend direction is chosen only by pole vectors.
 * Requires THREE r128, GLTFLoader, SkeletonUtils, MeshoptDecoder (local vendor copies).
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const UP = new T.Vector3(0, 1, 0);
  const _v = Array.from({ length: 16 }, () => new T.Vector3());
  const _q = Array.from({ length: 10 }, () => new T.Quaternion());
  const _s = Array.from({ length: 10 }, () => new T.Vector3());
  const _sq = Array.from({ length: 5 }, () => new T.Quaternion());
  const _w1 = new T.Vector3(), _w2 = new T.Vector3(), _wq = new T.Quaternion(), _wq2 = new T.Quaternion(), _wq3 = new T.Quaternion();

  function worldPos(o, out) { return out.setFromMatrixPosition(o.matrixWorld); }
  function worldQuat(o, out) { o.matrixWorld.decompose(_w1, out, _w2); return out; }
  function setWorldQuat(bone, qWorld) {
    const p = worldQuat(bone.parent, _wq).invert();
    bone.quaternion.copy(p.multiply(qWorld));
    bone.updateMatrixWorld(true);
  }
  function rotateWorld(bone, dq) { const w = worldQuat(bone, _wq2); setWorldQuat(bone, _wq3.copy(dq).multiply(w)); }

  /** Analytic two-bone IK: a (root) -> b (mid) -> c (end); returns the reach ratio. */
  function solveTwoBone(a, b, c, target, pole, weight) {
    if (weight <= 0.001) return 0;
    const qa0 = _sq[0].copy(a.quaternion), qb0 = _sq[1].copy(b.quaternion);
    const A = worldPos(a, _s[0]), B = worldPos(b, _s[1]), C = worldPos(c, _s[2]);
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const AT = _s[3].subVectors(target, A);
    const want0 = AT.length();
    const d = clamp(want0, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
    const BA = _s[4].subVectors(A, B).normalize(), BC = _s[5].subVectors(C, B).normalize();
    const cur = Math.acos(clamp(BA.dot(BC), -1, 1));
    const want = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    const axis = _s[6].crossVectors(BA, BC);
    if (axis.lengthSq() < 1e-8) { axis.crossVectors(BA, _s[7].subVectors(pole, B)); if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0); }
    axis.normalize();
    rotateWorld(b, _sq[2].setFromAxisAngle(axis, want - cur));
    worldPos(c, C);
    const AC = _s[4].subVectors(C, A).normalize(), ATn = _s[5].copy(AT).normalize();
    rotateWorld(a, _sq[3].setFromUnitVectors(AC, ATn));
    worldPos(b, B);
    const n = ATn;
    const pb = _s[6].subVectors(B, A); pb.sub(_s[8].copy(n).multiplyScalar(pb.dot(n)));
    const pp = _s[7].subVectors(pole, A); pp.sub(_s[8].copy(n).multiplyScalar(pp.dot(n)));
    if (pb.lengthSq() > 1e-8 && pp.lengthSq() > 1e-8) {
      pb.normalize(); pp.normalize();
      let ang = Math.acos(clamp(pb.dot(pp), -1, 1));
      if (_s[9].crossVectors(pb, pp).dot(n) < 0) ang = -ang;
      rotateWorld(a, _sq[4].setFromAxisAngle(n, ang));
    }
    if (weight < 0.999) {
      a.quaternion.copy(_sq[0].slerp(a.quaternion, weight)); a.updateMatrixWorld(true);
      b.quaternion.copy(_sq[1].slerp(b.quaternion, weight)); b.updateMatrixWorld(true);
    }
    return want0 / (l1 + l2);
  }

  // ---------- loading ----------
  const FILES = { a: 'athlete_a.glb', b: 'athlete_b.glb', c: 'athlete_c.glb' };
  const HEADS = { a: 'head_a', b: 'head_b', c: 'head_c' };

  function load(base, manager, quality, needed = ['a', 'b', 'c']) {
    manager = manager || T.DefaultLoadingManager;
    const loader = new T.GLTFLoader(manager);
    if (root.MeshoptDecoder) loader.setMeshoptDecoder(root.MeshoptDecoder);
    const tl = new T.TextureLoader(manager);
    const texCache = new Map(), texJobs = [];
    const tex = (name, srgb = true) => {
      if (texCache.has(name)) return texCache.get(name);
      let t; texJobs.push(new Promise((res, rej) => { t = tl.load(base + 'textures/' + name, res, undefined, () => rej(new Error('texture ' + name))); }));
      t.flipY = false; if (srgb) t.encoding = T.sRGBEncoding;
      t.anisotropy = quality.anisotropy || 4;
      texCache.set(name, t); return t;
    };
    const models = {};
    const fileError = f => () => { throw new Error('missing or unreadable file: ' + base + 'models/' + f); };
    const jobs = needed.map(k => loader.loadAsync(base + 'models/' + FILES[k]).then(g => { models[k] = g; }, fileError(FILES[k])));
    let clips = [];
    jobs.push(loader.loadAsync(base + 'models/clips.glb').then(g => { clips = g.animations; }, fileError('clips.glb')));
    ['body_normal.jpg', 'body_rough.jpg'].forEach(n => tex(n, false));
    for (const k of (quality.kits || [])) tex(k);
    for (const k of needed) { const h = HEADS[k]; tex(h + '.jpg'); tex(h + '_normal.jpg', false); tex(h + '_rough.jpg', false); }
    tex('hair_c.png');
    return Promise.all(jobs).then(() => Promise.all(texJobs)).then(() => ({
      clips, textures: texCache,
      create: opts => new Athlete(models[opts.variant || 'a'], clips, tex, opts),
      dispose() { texCache.forEach(t => t.dispose()); }
    }));
  }

  const FINGERS = ['0', '1', '2', '3', '4'];

  class Athlete {
    constructor(gltf, clips, tex, opts) {
      this.opts = opts;
      this.root = root.THREE.SkeletonUtils.clone(gltf.scene);
      this.root.name = 'athlete-' + (opts.name || 'bowler');
      const variant = opts.variant || 'a';
      const map = opts.kitTexture || tex(opts.kit || 'bowler_kit.jpg');
      const matBody = new T.MeshStandardMaterial({ skinning: true, map, normalMap: tex('body_normal.jpg', false), roughnessMap: tex('body_rough.jpg', false), roughness: 1, metalness: 0, normalScale: new T.Vector2(1, -1) });
      const h = HEADS[variant];
      const matHead = new T.MeshStandardMaterial({ skinning: true, map: tex(h + '.jpg'), normalMap: tex(h + '_normal.jpg', false), roughnessMap: tex(h + '_rough.jpg', false), roughness: 1, metalness: 0, normalScale: new T.Vector2(1, -1) });
      const matHair = new T.MeshStandardMaterial({ skinning: true, map: tex('hair_c.png'), alphaTest: 0.45, side: T.DoubleSide, roughness: 0.75, metalness: 0 });
      this.meshes = [];
      this.root.traverse(o => {
        if (o.isSkinnedMesh) {
          const n = o.material.name || '';
          o.material = n.includes('opacity') ? matHair : n.includes('head') ? matHead : matBody;
          o.castShadow = opts.shadows !== false; o.receiveShadow = true; o.frustumCulled = false;
          this.meshes.push(o);
        }
      });
      this.materials = [matBody, matHead, matHair];
      this.bones = {};
      this.root.traverse(o => { if (o.isBone || /^Bip01/.test(o.name)) this.bones[o.name.replace(/^Bip01_/, '')] = o; });
      this.mixer = new T.AnimationMixer(this.root);
      this.clipMap = {}; clips.forEach(c => { this.clipMap[c.name] = c; });
      this.actions = {}; this.current = null; this.currentName = '';
      this.captureRest();
      this.pose = {
        pelvisPos: new T.Vector3(), pelvisW: 0, tilt: 0, roll: 0, turn: 0,
        bend: 0, side: 0, twist: 0, look: null, lookW: 0,
        clavicle: { L: null, R: null },
        hand: { L: hand(), R: hand() },
        foot: { L: foot(), R: foot() }
      };
      this.blink = { t: 1 + Math.random() * 3, phase: 0 };
      this.yaw = 0; this.reach = { L: 0, R: 0, armL: 0, armR: 0 };
    }

    captureRest() {
      this.root.updateMatrixWorld(true);
      const b = this.bones, rest = this.rest = {};
      for (const [k, o] of Object.entries(b)) rest[k] = { q: o.quaternion.clone(), p: o.position.clone(), wq: worldQuat(o, new T.Quaternion()), wp: worldPos(o, new T.Vector3()) };
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
        // foot geometry in the bind pose (character facing +Z): toe joint relative to the ankle
        rest[`${s}_footVec`] = new T.Vector3().subVectors(rest[`${s}_Toe0`].wp, rest[`${s}_Foot`].wp);
        // sole reference points (bind pose, world): toe tip from the toe joint along the toes, heel from the ankle
        const toeDir = new T.Vector3(1, 0, 0).applyQuaternion(rest[`${s}_Toe0`].wq).setY(0).normalize();
        rest[`${s}_tipVec`] = toeDir.multiplyScalar(0.065).add(new T.Vector3(0, -0.002, 0));
        rest[`${s}_heelVec`] = new T.Vector3(0, -rest[`${s}_Foot`].wp.y, -0.06);
      }
      this.legLength = rest.L_Thigh.wp.distanceTo(rest.L_Calf.wp) + rest.L_Calf.wp.distanceTo(rest.L_Foot.wp);
      this.armLength = rest.R_UpperArm.wp.distanceTo(rest.R_Forearm.wp) + rest.R_Forearm.wp.distanceTo(rest.R_Hand.wp);
      this.pelvisHeight = rest.Pelvis.wp.y;
      this.headFwd = new T.Vector3(0, 0, 1).applyQuaternion(rest.Head.wq.clone().invert());
    }

    play(name, { fade = 0.35, loop = true, speed = 1, offset = 0, weight = 1 } = {}) {
      const clip = this.clipMap[name]; if (!clip) return null;
      let a = this.actions[name];
      if (!a) { a = this.mixer.clipAction(clip); this.actions[name] = a; }
      if (this.current === a) return a;
      a.reset(); a.setLoop(loop ? T.LoopRepeat : T.LoopOnce, Infinity); a.clampWhenFinished = !loop;
      a.timeScale = speed; a.time = offset * clip.duration; a.setEffectiveWeight(weight);
      a.play();
      if (this.current) this.current.crossFadeTo(a, fade, false); else a.fadeIn(fade);
      this.current = a; this.currentName = name;
      return a;
    }
    /** Fade every clip out: the base becomes the bind pose (fully procedural, deterministic). */
    stopClips(fade = 0.25) {
      if (this.current) { if (fade > 0) this.current.fadeOut(fade); else this.current.stop(); }
      this.current = null; this.currentName = '';
    }
    setTransform(x, z, yaw) { this.root.position.set(x, 0, z); this.yaw = yaw; this.root.rotation.set(0, yaw, 0); }

    update(dt) {
      for (const k in this.bones) { const o = this.bones[k], r = this.rest[k]; o.quaternion.copy(r.q); o.position.copy(r.p); }
      this.mixer.update(dt);
      this.root.updateMatrixWorld(true);
      const b = this.bones, p = this.pose, rest = this.rest;
      const yawQ = _q[0].setFromAxisAngle(UP, this.yaw);
      const fwd = _v[0].set(0, 0, 1).applyQuaternion(yawQ).clone();
      const right = _v[1].set(-1, 0, 0).applyQuaternion(yawQ).clone();   // character's right side
      // pelvis: absolute world placement + tilt (forward), roll (toward the right side), turn (about up)
      const pel = b.Pelvis;
      if (p.pelvisW > 0) {
        const cur = worldPos(pel, _v[2]);
        const wp = _v[3].copy(cur).lerp(p.pelvisPos, p.pelvisW);
        pel.parent.worldToLocal(wp); pel.position.copy(wp); pel.updateMatrixWorld(true);
      }
      if (p.tilt) rotateWorld(pel, _q[1].setFromAxisAngle(right, -p.tilt));
      if (p.roll) rotateWorld(pel, _q[1].setFromAxisAngle(fwd, p.roll));
      if (p.turn) rotateWorld(pel, _q[1].setFromAxisAngle(UP, p.turn));
      // spine: bend (forward), side (toward the right side), twist (+ toward the character's left)
      const bendTotal = p.bend - p.tilt * 0.85;
      if (bendTotal || p.twist || p.side) {
        for (const [k, s] of [['Spine', .3], ['Spine1', .35], ['Spine2', .35]]) {
          if (!b[k]) continue;
          if (bendTotal) rotateWorld(b[k], _q[1].setFromAxisAngle(right, -bendTotal * s));
          if (p.side) rotateWorld(b[k], _q[1].setFromAxisAngle(fwd, p.side * s));
          if (p.twist) rotateWorld(b[k], _q[1].setFromAxisAngle(UP, p.twist * s));
        }
      }
      // legs: ankle from the toe-joint ground point, heading and heel raise (rigid foot about the toe joint)
      for (const s of ['L', 'R']) {
        const f = p.foot[s]; if (f.w <= 0) continue;
        const heading = this.yaw + (s === 'L' ? 1 : -1) * f.turn;
        const qYaw = _q[2].setFromAxisAngle(UP, heading);
        const hf = _v[4].set(Math.sin(heading), 0, Math.cos(heading));
        const pitchAxis = _v[5].crossVectors(UP, hf).normalize();
        const qPitch = _q[3].setFromAxisAngle(pitchAxis, f.heel);
        const qFoot = _q[4].copy(qPitch).multiply(qYaw);                     // world delta from the bind foot
        const ankle = _v[6].copy(rest[`${s}_footVec`]).applyQuaternion(qFoot).negate().add(f.toe);
        ankle.y += f.lift;
        // sole constraint: neither the heel nor the toe tip may go below the floor. Toes stay flat while the
        // heel rises (up to the toes' bending limit); in the swing they follow the foot. If a point would
        // sink, the whole foot is lifted by that amount (it then pivots on that point, as a real foot does).
        const keepPitch = f.toeFlat >= 0.5 ? Math.max(0, f.heel - 0.8) : f.heel;
        const qToe = _q[5].setFromAxisAngle(pitchAxis, keepPitch).multiply(qYaw);
        const toeJointY = f.toe.y + f.lift;
        const tipY = toeJointY + _v[8].copy(rest[`${s}_tipVec`]).applyQuaternion(qToe).y;
        const heelY = ankle.y + _v[8].copy(rest[`${s}_heelVec`]).applyQuaternion(qFoot).y;
        const sink = Math.min(tipY, heelY, toeJointY - 0.002);
        if (sink < 0) ankle.y -= sink;
        f.ankle.copy(ankle);
        const pole = _v[7].copy(f.kneeDir.lengthSq() > 0 ? f.kneeDir : hf).multiplyScalar(1.5).add(ankle); pole.y += 0.55;
        this.reach[s] = solveTwoBone(b[`${s}_Thigh`], b[`${s}_Calf`], b[`${s}_Foot`], ankle, pole, f.w);
        const desired = _q[5].copy(qFoot).multiply(rest[`${s}_Foot`].wq);
        const cur = worldQuat(b[`${s}_Foot`], _q[6]);
        setWorldQuat(b[`${s}_Foot`], cur.slerp(desired, f.w));
        // toes stay flat on the floor while the heel rises (limited dorsiflexion)
        const toe = b[`${s}_Toe0`];
        if (toe && f.toeFlat > 0 && f.heel > 0) {
          const keep = Math.max(0, f.heel - 0.8);
          const qT = _q[7].setFromAxisAngle(pitchAxis, keep).multiply(qYaw).multiply(rest[`${s}_Toe0`].wq);
          const curT = worldQuat(toe, _q[8]);
          setWorldQuat(toe, curT.slerp(qT, f.toeFlat * f.w));
        }
      }
      // clavicles: move the shoulder joint toward a direction (e.g. drop the throwing shoulder)
      for (const s of ['L', 'R']) {
        const c = p.clavicle[s]; if (!c || !c.amount) continue;
        const cl = b[`${s}_Clavicle`], ua = b[`${s}_UpperArm`]; if (!cl || !ua) continue;
        const C0 = worldPos(cl, _v[8]), U0 = worldPos(ua, _v[9]);
        const v = _v[10].subVectors(U0, C0).normalize();
        const axis = _v[11].crossVectors(v, c.dir); if (axis.lengthSq() < 1e-8) continue;
        rotateWorld(cl, _q[1].setFromAxisAngle(axis.normalize(), c.amount));
      }
      // hook for the controller: shoulders and chest are final here, hand targets can be derived from them
      if (this.beforeArms) this.beforeArms(this);
      // arms + hands
      for (const s of ['L', 'R']) {
        const h = p.hand[s]; if (h.w <= 0) continue;
        const pal = rest[`${s}_palm`];
        const fW = _v[6].copy(h.fdir).normalize(), nW = _v[7].copy(h.ndir).normalize();
        fW.sub(_v[8].copy(nW).multiplyScalar(fW.dot(nW))).normalize();
        const wrist = _v[9].copy(h.pos).addScaledVector(fW, -pal.len * 0.55).addScaledVector(nW, -0.028);
        this.reach['arm' + s] = solveTwoBone(b[`${s}_UpperArm`], b[`${s}_Forearm`], b[`${s}_Hand`], wrist, h.pole, h.w);
        const hq = worldQuat(b[`${s}_Hand`], _q[2]);
        const fCur = _v[2].copy(pal.f).applyQuaternion(hq), nCur = _v[3].copy(pal.n).applyQuaternion(hq);
        const q1 = _q[3].setFromUnitVectors(fCur, fW);
        nCur.applyQuaternion(q1);
        const nProj = nCur.sub(_v[4].copy(fW).multiplyScalar(nCur.dot(fW))).normalize();
        let ang = Math.acos(clamp(nProj.dot(nW), -1, 1));
        if (_v[5].crossVectors(nProj, nW).dot(fW) < 0) ang = -ang;
        const desired = _q[4].setFromAxisAngle(fW, ang).multiply(q1).multiply(hq);
        const curq = worldQuat(b[`${s}_Hand`], _q[5]);
        setWorldQuat(b[`${s}_Hand`], curq.slerp(desired, h.w));
        if (h.curl !== null) {
          for (const fi of FINGERS) for (const [seg, k] of [['', 1], ['1', 1.15], ['2', .9]]) {
            const key = `${s}_Finger${fi}${seg}`; const bone = b[key]; const r = rest[key]; if (!bone || !r) continue;
            const amt = (fi === '0' ? h.thumb : h.curl) * k * (fi === '4' ? 1.1 : 1);
            const target = _q[6].copy(r.q).multiply(_q[7].setFromAxisAngle(r.bendAxis, amt));
            bone.quaternion.slerp(target, h.w);
          }
          b[`${s}_Hand`].updateMatrixWorld(true);
        }
      }
      // head look
      if (p.look && p.lookW > 0) {
        for (const [k, share] of [['Neck', .35], ['Head', 1]]) {
          const bone = b[k]; if (!bone) continue;
          const hp = worldPos(b.Head, _v[2]);
          const want = _v[3].subVectors(p.look, hp).normalize();
          const hq = worldQuat(b.Head, _q[2]);
          const cur = _v[4].copy(this.headFwd).applyQuaternion(hq);
          const dq = _q[3].setFromUnitVectors(cur, want);
          const angle = 2 * Math.acos(clamp(dq.w, -1, 1)), lim = 1.0;
          const scale = (angle > lim ? lim / angle : 1) * share * p.lookW;
          rotateWorld(bone, _q[4].identity().slerp(dq, scale));
        }
      }
      // blinking
      this.blink.t -= dt;
      if (this.blink.t <= 0) { this.blink.phase = 0.16; this.blink.t = 2 + Math.random() * 4; }
      if (this.blink.phase > 0) {
        this.blink.phase = Math.max(0, this.blink.phase - dt);
        const k = Math.sin((1 - this.blink.phase / 0.16) * Math.PI);
        for (const s of ['L', 'R']) { const top = b[`${s}EyeBlinkTop`]; if (top) top.quaternion.multiply(_q[6].setFromAxisAngle(_v[5].set(0, 0, 1), -0.45 * k)); }
      }
      this.root.updateMatrixWorld(true);
    }

    worldOf(name, out) { return worldPos(this.bones[name], out); }
    quatOf(name, out) { return worldQuat(this.bones[name], out); }

    dispose() {
      this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root);
      this.materials.forEach(m => m.dispose());
    }
  }

  function hand() { return { w: 0, pos: new T.Vector3(), fdir: new T.Vector3(0, -1, 0), ndir: new T.Vector3(0, 0, 1), pole: new T.Vector3(), curl: null, thumb: 0 }; }
  function foot() { return { w: 0, toe: new T.Vector3(), ankle: new T.Vector3(), lift: 0, heel: 0, turn: 0.1, toeFlat: 1, kneeDir: new T.Vector3() }; }

  root.BowlingAthlete = { load, solveTwoBone, Athlete };
})(typeof window !== 'undefined' ? window : globalThis);
