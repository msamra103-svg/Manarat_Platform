/* Basketball athletes: licensed rigged humans (Microsoft Rocketbox, MIT) driven by
 * motion-capture clips (AnimationMixer) plus a procedural layer: two-bone IK for
 * arms/legs, palm orientation + finger curl for ball grip, spine/head aim, blinking.
 * Basketball-only file. Requires THREE r128, GLTFLoader, SkeletonUtils, MeshoptDecoder.
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const UP = new T.Vector3(0, 1, 0);
  const _v = Array.from({ length: 12 }, () => new T.Vector3());   // caller scratch
  const _q = Array.from({ length: 8 }, () => new T.Quaternion());
  const _s = Array.from({ length: 10 }, () => new T.Vector3());   // solver scratch
  const _sq = Array.from({ length: 5 }, () => new T.Quaternion());
  const _w1 = new T.Vector3(), _w2 = new T.Vector3(), _wq = new T.Quaternion(), _wq2 = new T.Quaternion(), _wq3 = new T.Quaternion();
  const _m = new T.Matrix4();

  // ---------- world-space bone helpers (axis-agnostic) ----------
  function worldPos(o, out) { return out.setFromMatrixPosition(o.matrixWorld); }
  function worldQuat(o, out) { o.matrixWorld.decompose(_w1, out, _w2); return out; }
  function setWorldQuat(bone, qWorld) {
    const p = worldQuat(bone.parent, _wq).invert();
    bone.quaternion.copy(p.multiply(qWorld));
    bone.updateMatrixWorld(true);
  }
  function rotateWorld(bone, dq) { // pre-multiply a world-space rotation
    const w = worldQuat(bone, _wq2);
    setWorldQuat(bone, _wq3.copy(dq).multiply(w));
  }

  /** Analytic two-bone IK: a (root) -> b (mid) -> c (end). */
  function solveTwoBone(a, b, c, target, pole, weight) {
    if (weight <= 0.001) return;
    const qa0 = _sq[0].copy(a.quaternion), qb0 = _sq[1].copy(b.quaternion);
    const A = worldPos(a, _s[0]), B = worldPos(b, _s[1]), C = worldPos(c, _s[2]);
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const AT = _s[3].subVectors(target, A);
    const d = clamp(AT.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
    // 1. bend the middle joint to reach distance d
    const BA = _s[4].subVectors(A, B).normalize(), BC = _s[5].subVectors(C, B).normalize();
    const cur = Math.acos(clamp(BA.dot(BC), -1, 1));
    const want = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    let axis = _s[6].crossVectors(BA, BC);
    if (axis.lengthSq() < 1e-8) { // straight limb: bend toward pole
      axis.crossVectors(BA, _s[7].subVectors(pole, B)).normalize();
      if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0);
    }
    axis.normalize();
    rotateWorld(b, _sq[2].setFromAxisAngle(axis, want - cur));
    // 2. swing the root so the end reaches the target direction
    worldPos(c, C);
    const AC = _s[4].subVectors(C, A).normalize();
    const ATn = _s[5].copy(AT).normalize();
    rotateWorld(a, _sq[3].setFromUnitVectors(AC, ATn));
    // 3. twist around A->T so the middle joint points at the pole
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
      a.quaternion.copy(_sq[0].slerp(a.quaternion, weight));
      a.updateMatrixWorld(true);
      // recompute b with weighted a would need another pass; blend b locally
      b.quaternion.copy(_sq[1].slerp(b.quaternion, weight));
      b.updateMatrixWorld(true);
    }
  }

  // ---------- loading ----------
  const FILES = { a: 'athlete_a.glb', b: 'athlete_b.glb', c: 'athlete_c.glb' };
  const HEADS = { a: 'head_a', b: 'head_b', c: 'head_c' };

  function load(base, manager, quality) {
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
    const jobs = Object.entries(FILES).map(([k, f]) => loader.loadAsync(base + 'models/' + f).then(g => { models[k] = g; }, fileError(f)));
    let clips = [], clipInfo = {};
    jobs.push(loader.loadAsync(base + 'models/clips.glb').then(g => { clips = g.animations; }, fileError('clips.glb')));
    jobs.push(fetch(base + 'models/clips.json').then(r => r.ok ? r.json() : {}).then(j => { clipInfo = j; }).catch(() => {}));
    // pre-touch shared textures so the manager counts them
    ['body_normal.jpg', 'body_rough.jpg'].forEach(n => tex(n, false));
    // pre-create every kit/head texture used by the squad so loading is complete before play
    for (const k of (quality.kits || [])) tex(k);
    ['head_a', 'head_b', 'head_c'].forEach(h => { tex(h + '.jpg'); tex(h + '_normal.jpg', false); tex(h + '_rough.jpg', false); });
    tex('hair_c.png');
    return Promise.all(jobs).then(() => Promise.all(texJobs)).then(() => ({
      clips, clipInfo, textures: texCache,
      create: opts => new Athlete(models[opts.variant || 'a'], clips, tex, opts)
    }));
  }

  // ---------- athlete ----------
  const FINGERS = ['0', '1', '2', '3', '4'];

  class Athlete {
    constructor(gltf, clips, tex, opts) {
      this.opts = opts;
      this.root = root.THREE.SkeletonUtils.clone(gltf.scene);
      this.root.name = 'athlete-' + (opts.name || opts.number);
      const variant = opts.variant || 'a';
      const kit = `kit_${opts.kit || 'home'}_${opts.number}.jpg`;
      const matBody = new T.MeshStandardMaterial({ skinning: true, map: tex(kit), normalMap: tex('body_normal.jpg', false), roughnessMap: tex('body_rough.jpg', false), roughness: 1, metalness: 0, normalScale: new T.Vector2(1, -1) });
      const h = HEADS[variant];
      const matHead = new T.MeshStandardMaterial({ skinning: true, map: tex(h + '.jpg'), normalMap: tex(h + '_normal.jpg', false), roughnessMap: tex(h + '_rough.jpg', false), roughness: 1, metalness: 0, normalScale: new T.Vector2(1, -1) });
      const matHair = new T.MeshStandardMaterial({ skinning: true, map: tex('hair_c.png'), alphaTest: 0.45, transparent: false, side: T.DoubleSide, roughness: 0.75, metalness: 0 });
      this.meshes = [];
      this.root.traverse(o => {
        if (o.isSkinnedMesh) {
          const n = o.material.name || '';
          o.material = n.includes('opacity') ? matHair : n.includes('head') ? matHead : matBody;
          o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
          this.meshes.push(o);
        }
      });
      this.materials = [matBody, matHead, matHair];
      this.bones = {};
      this.root.traverse(o => { if (o.isBone || /^Bip01/.test(o.name)) this.bones[o.name.replace(/^Bip01_/, '')] = o; });
      this.mixer = new T.AnimationMixer(this.root);
      this.clipMap = {}; clips.forEach(c => { this.clipMap[c.name] = c; });
      this.actions = {}; this.current = null;
      this.captureRest();
      // procedural pose request (written by choreography every frame)
      this.pose = {
        pelvis: new T.Vector3(), tilt: 0, bend: 0, twist: 0, side: 0,
        look: null, lookW: 0,
        hand: { L: hand(), R: hand() },
        foot: { L: foot(), R: foot() }
      };
      this.blink = { t: 1 + Math.random() * 3, phase: 0 };
      this.position = this.root.position; this.yaw = 0;
    }

    captureRest() {
      // reset pose to bind pose (clone keeps bind transforms) and record world-space references
      this.root.updateMatrixWorld(true);
      const b = this.bones, rest = this.rest = {};
      for (const [k, o] of Object.entries(b)) rest[k] = { q: o.quaternion.clone(), p: o.position.clone(), wq: worldQuat(o, new T.Quaternion()), wp: worldPos(o, new T.Vector3()) };
      for (const s of ['L', 'R']) {
        const H = rest[`${s}_Hand`].wp, M = rest[`${s}_Finger2`].wp, I = rest[`${s}_Finger1`].wp, P = rest[`${s}_Finger4`].wp;
        const f = new T.Vector3().subVectors(M, H).normalize();
        const across = new T.Vector3().subVectors(I, P).normalize();
        let n = new T.Vector3().crossVectors(f, across).normalize();
        // palm normal must point toward the thumb-side curl direction: verify with thumb tip below palm plane
        const thumb = rest[`${s}_Finger02`] ? rest[`${s}_Finger02`].wp : rest[`${s}_Finger0`].wp;
        const tipMid = rest[`${s}_Finger22`] ? rest[`${s}_Finger22`].wp : M;
        // fingers curl toward the palm side: the palm normal points the way finger tips bend.
        // In the bind pose fingers are slightly curled, so the tip lies on the palm side of the H-M line.
        const curlDir = new T.Vector3().subVectors(tipMid, H).sub(f.clone().multiplyScalar(new T.Vector3().subVectors(tipMid, H).dot(f)));
        if (curlDir.lengthSq() > 1e-6 && curlDir.dot(n) < 0) n.negate();
        const hq = rest[`${s}_Hand`].wq;
        const inv = hq.clone().invert();
        rest[`${s}_palm`] = { f: f.clone().applyQuaternion(inv), n: n.clone().applyQuaternion(inv), len: H.distanceTo(M), across: across.clone().applyQuaternion(inv) };
        // finger bend axes (in each finger bone's local frame): bend around (n x f) i.e. lateral axis
        const lat = new T.Vector3().crossVectors(f, n).normalize();
        for (const fi of FINGERS) for (const seg of ['', '1', '2']) {
          const key = `${s}_Finger${fi}${seg}`; if (!rest[key]) continue;
          const lq = rest[key].wq.clone().invert();
          let ax = lat.clone();
          if (fi === "0") ax = f.clone().negate(); // thumb opposes: curl around finger direction
          rest[key].bendAxis = ax.applyQuaternion(lq).normalize();
        }
        void thumb;
      }
      // legs: lengths for jump/IK clamp
      this.legLength = rest['L_Thigh'].wp.distanceTo(rest['L_Calf'].wp) + rest['L_Calf'].wp.distanceTo(rest['L_Foot'].wp);
      this.ankleHeight = rest['L_Foot'].wp.y;
      this.pelvisHeight = rest['Pelvis'].wp.y;
      // head forward in head-local frame (character faces +Z at rest)
      this.headFwd = new T.Vector3(0, 0, 1).applyQuaternion(rest['Head'].wq.clone().invert());
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

    setTransform(x, z, yaw) { this.root.position.set(x, 0, z); this.yaw = yaw; this.root.rotation.set(0, yaw, 0); }

    /** advance mocap, then apply the procedural layer */
    update(dt) {
      // start from the bind pose every frame: bones without animation tracks (constant tracks are
      // stripped by compression) must not accumulate the procedural layer from previous frames
      for (const k in this.bones) { const o = this.bones[k], r = this.rest[k]; o.quaternion.copy(r.q); o.position.copy(r.p); }
      this.mixer.update(dt);
      this.root.updateMatrixWorld(true);
      const b = this.bones, p = this.pose, rest = this.rest;
      const yawQ = _q[0].setFromAxisAngle(UP, this.yaw);
      const fwd = _v[0].set(0, 0, 1).applyQuaternion(yawQ).clone();
      const right = _v[1].set(-1, 0, 0).applyQuaternion(yawQ).clone(); // character's right side
      // pelvis offset (character space) + tilt
      if (p.pelvis.lengthSq() > 0 || p.tilt || p.side) {
        const off = _v[2].copy(p.pelvis).applyQuaternion(yawQ);
        const pel = b.Pelvis;
        const wp = worldPos(pel, _v[3]).add(off);
        pel.parent.worldToLocal(wp); pel.position.copy(wp);
        pel.updateMatrixWorld(true);
        if (p.tilt) rotateWorld(pel, _q[1].setFromAxisAngle(right, -p.tilt));
        if (p.side) rotateWorld(pel, _q[1].setFromAxisAngle(fwd, p.side));
      }
      // spine bend / twist distributed (counter-tilt so torso keeps its own lean)
      const bendTotal = p.bend - p.tilt * 0.85;
      if (bendTotal || p.twist) {
        for (const [k, s] of [['Spine', .3], ['Spine1', .35], ['Spine2', .35]]) {
          if (!b[k]) continue;
          if (bendTotal) rotateWorld(b[k], _q[1].setFromAxisAngle(right, -bendTotal * s));
          if (p.twist) rotateWorld(b[k], _q[1].setFromAxisAngle(UP, p.twist * s));
        }
      }
      // legs
      for (const s of ['L', 'R']) {
        const f = p.foot[s]; if (f.w <= 0) continue;
        const knee = _v[4].copy(fwd).applyAxisAngle(UP, (s === 'L' ? 1 : -1) * 0.12).multiplyScalar(2);
        const pole = knee.add(f.pos).setY(f.pos.y + 0.5);
        solveTwoBone(b[`${s}_Thigh`], b[`${s}_Calf`], b[`${s}_Foot`], f.pos, pole, f.w);
        // foot orientation: rest flat orientation yawed + toe-out + pitch (plantar flexion)
        const qf = _q[2].setFromAxisAngle(UP, this.yaw + (s === 'L' ? 1 : -1) * f.toeOut);
        const desired = _q[3].copy(qf).multiply(rest[`${s}_Foot`].wq);
        if (f.pitch) desired.premultiply(_q[4].setFromAxisAngle(_v[5].copy(right), f.pitch));
        const cur = worldQuat(b[`${s}_Foot`], _q[5]);
        setWorldQuat(b[`${s}_Foot`], cur.slerp(desired, f.w));
      }
      // arms + hands
      for (const s of ['L', 'R']) {
        const h = p.hand[s]; if (h.w <= 0) continue;
        // wrist target from palm target: palm centre = wrist + f*len*0.55 + n*0.025
        const pal = rest[`${s}_palm`];
        const fW = _v[6].copy(h.fdir).normalize(), nW = _v[7].copy(h.ndir).normalize();
        // re-orthogonalise f against n
        fW.sub(_v[8].copy(nW).multiplyScalar(fW.dot(nW))).normalize();
        const wrist = _v[9].copy(h.pos).addScaledVector(fW, -pal.len * 0.55).addScaledVector(nW, -0.028);
        const elbowPole = _v[10].copy(h.pole);
        solveTwoBone(b[`${s}_UpperArm`], b[`${s}_Forearm`], b[`${s}_Hand`], wrist, elbowPole, h.w);
        // hand orientation: map rest (f,n) to desired (f,n)
        const hq = worldQuat(b[`${s}_Hand`], _q[2]);
        const fCur = _v[2].copy(pal.f).applyQuaternion(hq), nCur = _v[3].copy(pal.n).applyQuaternion(hq);
        const q1 = _q[3].setFromUnitVectors(fCur, fW);
        nCur.applyQuaternion(q1);
        const nProj = nCur.sub(_v[4].copy(fW).multiplyScalar(nCur.dot(fW))).normalize();
        let ang = Math.acos(clamp(nProj.dot(nW), -1, 1));
        if (_v[5].crossVectors(nProj, nW).dot(fW) < 0) ang = -ang;
        const q2 = _q[4].setFromAxisAngle(fW, ang).multiply(q1);
        const desired = q2.multiply(hq);
        const curq = worldQuat(b[`${s}_Hand`], _q[5]);
        setWorldQuat(b[`${s}_Hand`], curq.slerp(desired, h.w));
        // finger curl
        if (h.curl !== null) {
          for (const fi of FINGERS) for (const [seg, k] of [['', 1], ['1', 1.15], ['2', .9]]) {
            const key = `${s}_Finger${fi}${seg}`; const bone = b[key]; const r = rest[key]; if (!bone || !r) continue;
            const amt = (fi === '0' ? h.thumb : h.curl) * k * (fi === '4' ? 1.12 : 1) * (s === 'L' ? 1 : 1);
            bone.quaternion.copy(r.q).multiply(_q[6].setFromAxisAngle(r.bendAxis, amt));
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
          // limit
          const angle = 2 * Math.acos(clamp(dq.w, -1, 1));
          const lim = 1.1;
          const scale = (angle > lim ? lim / angle : 1) * share * p.lookW;
          rotateWorld(bone, _q[4].identity().slerp(dq, scale));
        }
      }
      // blinking (eyelid bones), independent per athlete
      this.blink.t -= dt;
      if (this.blink.t <= 0) { this.blink.phase = 0.16; this.blink.t = 2 + Math.random() * 4; }
      if (this.blink.phase > 0) {
        this.blink.phase = Math.max(0, this.blink.phase - dt);
        const k = Math.sin((1 - this.blink.phase / 0.16) * Math.PI);
        for (const s of ['L', 'R']) {
          const top = b[`${s}EyeBlinkTop`]; if (top) { top.position.copy(this.rest[`${s}EyeBlinkTop`].p); top.position.y -= 0.0; top.rotation.x += 0; top.quaternion.multiply(_q[6].setFromAxisAngle(_v[5].set(0, 0, 1), -0.45 * k)); }
        }
      }
    }

    worldOf(name, out) { return worldPos(this.bones[name], out); }

    dispose() {
      this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root);
      this.materials.forEach(m => m.dispose());
      // geometries are shared with the template; textures shared via cache
    }
  }

  function hand() { return { w: 0, pos: new T.Vector3(), fdir: new T.Vector3(0, 1, 0), ndir: new T.Vector3(0, 0, 1), pole: new T.Vector3(), curl: null, thumb: 0 }; }
  function foot() { return { w: 0, pos: new T.Vector3(), toeOut: 0.12, pitch: 0 }; }

  root.BasketballAthletes = { load, solveTwoBone, Athlete, smooth };
})(typeof window !== 'undefined' ? window : globalThis);
