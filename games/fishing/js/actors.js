/* صيد الأسماك V24 — runtime actors: angler IK rig, rod/reel/line/float/hook rendering, landing net,
 * swimming fish instances and the boat. Everything reads the deterministic FishingSim state each frame.
 */
(function (root) {
  'use strict';
  const T = root.THREE, W = root.FishingWater, S = root.FishingSimulation;
  const v3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _m = new T.Matrix4(), _v = new T.Vector3(), _v2 = new T.Vector3();

  /* ---------- helpers ---------- */
  function basisQuat(x, y, z, out = new T.Quaternion()) { _m.makeBasis(x, y, z); return out.setFromRotationMatrix(_m); }
  function setWorldQuat(obj, qWorld) { obj.parent.getWorldQuaternion(_q2); obj.quaternion.copy(_q2.invert().multiply(qWorld)); obj.updateMatrixWorld(true); }
  /* aim a joint's -Y axis along dir (world), with its +Z axis towards hint */
  function aimBone(bone, dir, hint) {
    const y = dir.clone().normalize().negate(); let z = hint.clone().sub(y.clone().multiplyScalar(hint.dot(y))); if (z.lengthSq() < 1e-8) z.set(0, 0, 1); z.normalize(); const x = new T.Vector3().crossVectors(y, z);
    setWorldQuat(bone, basisQuat(x, y, z));
  }
  function twoBone(upper, lower, end, target, pole, A, B, zSign) {
    const S0 = upper.getWorldPosition(new T.Vector3()), d0 = target.clone().sub(S0), dist = Math.min(Math.max(d0.length(), 0.02), A + B - 1e-4), dir = d0.normalize();
    const cosA = Math.min(1, Math.max(-1, (A * A + dist * dist - B * B) / (2 * A * dist))), sinA = Math.sqrt(1 - cosA * cosA);
    let n = pole.clone().sub(S0); n.sub(dir.clone().multiplyScalar(n.dot(dir))); if (n.lengthSq() < 1e-8) n.set(0, -1, 0); n.normalize();
    const E = S0.clone().add(dir.clone().multiplyScalar(A * cosA)).add(n.clone().multiplyScalar(A * sinA)), Tp = S0.clone().add(dir.clone().multiplyScalar(dist));
    const hint = n.clone().multiplyScalar(zSign);
    aimBone(upper, E.clone().sub(S0), hint); aimBone(lower, Tp.clone().sub(E), hint);
    return { elbow: E, reached: d0.length() <= A + B };
  }

  /* ---------- angler ---------- */
  class AnglerRig {
    constructor(model) {
      this.root = model; this.b = {}; model.traverse(o => { if (o.name) this.b[o.name] = o; });
      const need = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArm_R', 'foreArm_R', 'hand_R', 'upperArm_L', 'foreArm_L', 'hand_L', 'thigh_R', 'shin_R', 'foot_R', 'thigh_L', 'shin_L', 'foot_L'];
      this.missing = need.filter(n => !this.b[n]); if (this.missing.length) throw new Error('rig missing ' + this.missing.join(','));
      const L = n => Math.abs(this.b[n].position.y);
      this.len = { arm: L('foreArm_R'), fore: L('hand_R'), thigh: L('shin_R'), shin: L('foot_R') };
      this.hips0 = this.b.hips.position.clone(); this.look = new T.Vector3(0, 1.5, 5); this.blinkT = 2; this.headYaw = 0; this.headPitch = 0; this.t = 0; this.expr = { brow: 0, smile: 0 };
      this.feet = { R: new T.Vector3(-0.12, 0.072, -0.03), L: new T.Vector3(0.13, 0.072, 0.07) };
      this.grip = new T.Vector3(0, -0.086, 0.022);
    }
    update(sim, dt, reduced) {
      const b = this.b, pose = sim.pose, t = (this.t += dt), rootObj = this.root;
      rootObj.updateMatrixWorld(true);
      const rootQ = rootObj.getWorldQuaternion(new T.Quaternion());
      // hips: crouch, lean back/forward, counter the boat tilt so the angler stays upright
      const sway = reduced ? 0 : Math.sin(t * 0.7) * 0.012;
      b.hips.position.set(this.hips0.x + sway, this.hips0.y - pose.crouch * 0.12 - Math.abs(Math.sin(t * 1.9)) * 0.0, this.hips0.z - pose.lean * 0.05);
      const up = new T.Vector3(0, 1, 0), charUp = up.clone().applyQuaternion(rootQ), tilt = new T.Quaternion().setFromUnitVectors(charUp, up);
      b.hips.quaternion.copy(new T.Quaternion().slerp(new T.Quaternion().copy(rootQ).invert().multiply(tilt).multiply(rootQ), 0.75));
      b.hips.rotateY(-pose.yaw * 0.2);
      b.spine.rotation.set(pose.lean * 0.45, -pose.yaw * 0.25, 0); b.chest.rotation.set(pose.lean * 0.35 + Math.sin(t * 1.6) * 0.012, -pose.yaw * 0.3, 0);
      rootObj.updateMatrixWorld(true);
      // head look-at
      const target = this.lookTarget(sim), neckQ = b.neck.getWorldQuaternion(new T.Quaternion()), local = target.clone().sub(b.head.getWorldPosition(new T.Vector3())).applyQuaternion(neckQ.clone().invert());
      const yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(local.x, local.z))), pitch = Math.max(-0.55, Math.min(0.5, Math.atan2(local.y, Math.hypot(local.x, local.z))));
      const k = Math.min(1, dt * (reduced ? 2.5 : 5)); this.headYaw += (yaw - this.headYaw) * k; this.headPitch += (pitch - this.headPitch) * k;
      b.neck.rotation.set(-this.headPitch * 0.35, this.headYaw * 0.35, 0); b.head.rotation.set(-this.headPitch * 0.65, this.headYaw * 0.65, 0);
      rootObj.updateMatrixWorld(true);
      // right hand on the rod grip
      const D = v3(sim.rod.D), e1 = v3(sim.rod.e1), gripW = v3(sim.gripW), charRight = new T.Vector3(-1, 0, 0).applyQuaternion(rootQ), charFwd = new T.Vector3(0, 0, 1).applyQuaternion(rootQ), down = new T.Vector3(0, -1, 0);
      this.solveArm('R', gripW, D, e1.clone().negate(), b.chest.getWorldPosition(new T.Vector3()).add(charRight.clone().multiplyScalar(0.5)).add(down.clone().multiplyScalar(0.5)).sub(charFwd.clone().multiplyScalar(0.15)));
      // left hand: reel knob / rod butt / net handle / free
      const mode = pose.left, lw = v3(sim.leftHandWorld()); let axis = D.clone(), palm = e1.clone().negate();
      if (mode === 'reel') { axis = v3(sim.rod.e2); palm = D.clone().negate(); }
      else if (mode === 'net') { axis = v3(sim.net.hand).sub(v3(sim.net.hoop)).normalize(); palm = new T.Vector3(0, -1, 0); }
      else if (mode === 'free' || mode === 'hook-held') { axis = charRight.clone().negate(); palm = charFwd.clone(); }
      const leftPole = b.chest.getWorldPosition(new T.Vector3()).sub(charRight.clone().multiplyScalar(0.55)).add(down.clone().multiplyScalar(0.55)).sub(charFwd.clone().multiplyScalar(0.1));
      this.solveArm('L', lw, axis.multiplyScalar(-1), palm, leftPole);
      // legs: feet planted on the deck, knees forward
      for (const side of ['R', 'L']) {
        const ft = this.feet[side].clone().applyMatrix4(rootObj.matrixWorld), knee = rootObj.localToWorld(new T.Vector3(side === 'R' ? -0.16 : 0.18, 0.5, 1.2));
        twoBone(b['thigh_' + side], b['shin_' + side], b['foot_' + side], ft, knee, this.len.thigh, this.len.shin, 1);
        const footQ = rootQ.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0, side === 'R' ? -0.18 : 0.22, 0))); setWorldQuat(b['foot_' + side], footQ);
      }
      this.face(sim, dt, reduced);
    }
    solveArm(side, gripPoint, axisX, palmDir, pole) {
      const b = this.b, up = b['upperArm_' + side], fore = b['foreArm_' + side], hand = b['hand_' + side];
      const shoulder = up.getWorldPosition(new T.Vector3()), approx = gripPoint.clone().sub(shoulder).normalize();
      const x = axisX.clone().normalize(); let y = approx.clone().negate(); y.sub(x.clone().multiplyScalar(y.dot(x))); if (y.lengthSq() < 1e-6) y = palmDir.clone(); y.normalize();
      const z = new T.Vector3().crossVectors(x, y), hq = basisQuat(x, y, z);
      const wrist = gripPoint.clone().sub(this.grip.clone().applyQuaternion(hq));
      twoBone(up, fore, hand, wrist, pole, this.len.arm, this.len.fore, -1);
      setWorldQuat(hand, hq);
    }
    lookTarget(sim) {
      const ph = sim.phase; let p;
      if (['ready', 'windup', 'stroke', 'prepare', 'idle'].includes(ph)) p = sim.aim.target ? [sim.aim.target[0], 0.2, sim.aim.target[2]] : [0, 0.3, -9];
      else if (ph === 'flight' && sim.cast) p = sim.rope.floatPos;
      else if (['net', 'onboard'].includes(ph)) p = sim.net.hoop;
      else if (ph === 'celebrate') p = v3(sim.boat.toWorld([0.3, 1.0, -2.5])).toArray();
      else if (ph === 'rebait') p = sim.rope.hookPos;
      else if (sim.hooked && ['hookset', 'fight', 'surface'].includes(ph)) p = sim.hooked.pos;
      else p = sim.rope.floatPos;
      return this.look.lerp(v3(p), 0.15);
    }
    face(sim, dt, reduced) {
      const b = this.b; this.blinkT -= dt; let lid = -0.35;
      if (this.blinkT < 0) { lid = 0.75; if (this.blinkT < -0.12) this.blinkT = 2.2 + Math.random() * 3; }
      const ex = sim.pose.expression, sq = ex === 'effort' ? 0.25 : ex === 'focus' ? 0.12 : 0;
      ['L', 'R'].forEach(s => { if (b['eyelid_' + s]) b['eyelid_' + s].rotation.x = Math.max(lid, -0.35 + sq); if (b['eye_' + s]) { b['eye_' + s].rotation.y = -Math.PI / 2 + this.headYaw * 0.25; b['eye_' + s].rotation.z = this.headPitch * 0.2; } });
      const target = { happy: [0.6, 0.004], sad: [-0.6, -0.003], effort: [-0.2, -0.004], alert: [0.2, 0.004], focus: [-0.1, -0.002], neutral: [0, 0] }[ex] || [0, 0];
      this.expr.smile += (target[0] - this.expr.smile) * Math.min(1, dt * 4); this.expr.brow += (target[1] - this.expr.brow) * Math.min(1, dt * 4);
      const m = b.mouth && b.mouth.children[0]; if (m) { const sm = this.expr.smile; m.scale.set(1 + Math.max(0, sm) * 0.2, 0.3 + Math.abs(sm) * 0.45, 0.4); m.rotation.z = sm >= 0 ? Math.PI * 1.2 : Math.PI * 0.2; m.position.y = sm >= 0 ? 0.0045 : -0.006; }
      ['L', 'R'].forEach((s, i) => { const br = b['brow_' + s]; if (br) { if (br.userData.y0 === undefined) br.userData.y0 = br.position.y; br.position.y = br.userData.y0 + this.expr.brow; br.rotation.z = (i ? 1 : -1) * (0.08 + (ex === 'sad' ? -0.25 : ex === 'effort' ? 0.2 : 0)); } });
    }
  }

  /* ---------- tackle (rod blank, guides, reel, line, float, sinker, hook, net) ---------- */
  class TackleView {
    constructor(scene, parts) {
      this.scene = scene; const g = this.group = new T.Group(); g.name = 'tackle-live'; scene.add(g);
      this.base = new T.Group(); g.add(this.base); this.base.add(parts.grip); this.reel = parts.reel; this.reel.position.set(0, S.REEL.s, 0); this.base.add(this.reel);
      this.rotor = this.reel.getObjectByName('reel-rotor'); this.bail = this.reel.getObjectByName('reel-bail'); this.crank = this.reel.getObjectByName('reel-crank');
      // blank
      this.ringN = 7; this.n = 20; const verts = this.n * this.ringN, geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(verts * 3), 3)); geo.setAttribute('normal', new T.BufferAttribute(new Float32Array(verts * 3), 3));
      const idx = []; for (let i = 0; i < this.n - 1; i++) for (let j = 0; j < this.ringN; j++) { const a = i * this.ringN + j, b2 = i * this.ringN + (j + 1) % this.ringN, c = a + this.ringN, d = b2 + this.ringN; idx.push(a, c, b2, b2, c, d); } geo.setIndex(idx);
      this.blank = new T.Mesh(geo, new T.MeshStandardMaterial({ color: '#1e2c38', roughness: 0.28, metalness: 0.35 })); this.blank.castShadow = true; this.blank.frustumCulled = false; g.add(this.blank);
      this.guides = (S && root.FishingPhysics ? new root.FishingPhysics.Rod().guides : []).map((f, i, a) => { const m = parts.guide.clone(); m.userData.f = f; m.userData.s = 0.011 - 0.0075 * i / (a.length - 1); g.add(m); return m; });
      // line ribbons
      const lineMat = new T.MeshBasicMaterial({ color: '#e6efe9', side: T.DoubleSide }); this.lineMat = lineMat;
      this.ribbon = this.makeRibbon(80, lineMat); g.add(this.ribbon.mesh);
      this.float = parts.float; g.add(this.float); this.sinker = parts.sinker; g.add(this.sinker); this.hook = parts.hook; g.add(this.hook); this.bait = this.hook.getObjectByName('bait');
      [this.float, this.sinker, this.hook].forEach(o => o.traverse(m => { if (m.isMesh) W.patchOptics(m.material); }));
      this.net = parts.net; g.add(this.net); this.netTube = this.net.getObjectByName('net-tube'); this.netGrip = this.net.getObjectByName('net-grip-pivot'); this.netHandle = this.net.getObjectByName('net-handle');
      this.net.traverse(m => { if (m.isMesh) { m.castShadow = true; } });
    }
    makeRibbon(max, mat) { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(max * 2 * 3), 3)); const idx = []; for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx); geo.setDrawRange(0, 0); const mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; return { mesh, geo, max }; }
    fillRibbon(r, pts, cam) {
      const p = r.geo.attributes.position.array, n = Math.min(pts.length, r.max), cp = cam.position;
      for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)], q = pts[i]; _v.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _v2.set(cp.x - q[0], cp.y - q[1], cp.z - q[2]); const dist = _v2.length(); const side = _v.cross(_v2).normalize().multiplyScalar(Math.min(0.012, Math.max(0.00055, dist * 0.0012)) * 0.5); if (!Number.isFinite(side.x)) side.set(0, 0, 0); p[i * 6] = q[0] + side.x; p[i * 6 + 1] = q[1] + side.y; p[i * 6 + 2] = q[2] + side.z; p[i * 6 + 3] = q[0] - side.x; p[i * 6 + 4] = q[1] - side.y; p[i * 6 + 5] = q[2] - side.z; }
      r.geo.attributes.position.needsUpdate = true; r.geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
    }
    update(sim, cam, dt) {
      const rod = sim.rod, D = v3(rod.D), e1 = v3(rod.e1), e2 = v3(rod.e2);
      this.base.position.copy(v3(rod.butt)); basisQuat(e2, D, e1, this.base.quaternion); this.base.updateMatrixWorld(true);
      // blank tube along the bent rod (parallel transported frame)
      const pts = rod.points, pos = this.blank.geometry.attributes.position.array, nor = this.blank.geometry.attributes.normal.array, Lr = rod.length; let ref = e1.clone();
      for (let i = 0; i < this.n; i++) {
        const s = i / (this.n - 1), q = pts[i], tn = v3(pts[Math.min(this.n - 1, i + 1)]).sub(v3(pts[Math.max(0, i - 1)])).normalize();
        ref.sub(tn.clone().multiplyScalar(ref.dot(tn))).normalize(); const bn = new T.Vector3().crossVectors(tn, ref);
        const r = s * Lr < 0.62 ? 0.0075 : 0.0068 - (s * Lr - 0.62) / (Lr - 0.62) * 0.0055;
        for (let j = 0; j < this.ringN; j++) { const a = j / this.ringN * Math.PI * 2, nx = ref.x * Math.cos(a) + bn.x * Math.sin(a), ny = ref.y * Math.cos(a) + bn.y * Math.sin(a), nz = ref.z * Math.cos(a) + bn.z * Math.sin(a), k = (i * this.ringN + j) * 3; pos[k] = q[0] + nx * r; pos[k + 1] = q[1] + ny * r; pos[k + 2] = q[2] + nz * r; nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz; }
      }
      this.blank.geometry.attributes.position.needsUpdate = true; this.blank.geometry.attributes.normal.needsUpdate = true; this.blank.geometry.computeBoundingSphere();
      // guides
      const guidePts = [];
      for (const gd of this.guides) { const f = gd.userData.f, p = v3(rod.pointAt(f)), p2 = v3(rod.pointAt(Math.min(1, f + 0.01))), p1 = v3(rod.pointAt(Math.max(0, f - 0.01))), tn = p2.sub(p1).normalize(); let dn = e1.clone().sub(tn.clone().multiplyScalar(e1.dot(tn))).normalize(); const x = new T.Vector3().crossVectors(tn, dn); gd.position.copy(p); basisQuat(x, tn, dn, gd.quaternion); gd.scale.setScalar(gd.userData.s); guidePts.push(p.clone().sub(dn.clone().multiplyScalar(1.6 * gd.userData.s)).toArray()); }
      // reel animation
      if (this.crank) this.crank.rotation.x = sim.reelAngle; if (this.rotor) this.rotor.rotation.y = -sim.rotor; if (this.bail) this.bail.rotation.y = sim.bail * 1.6;
      // line: spool → guides → tip → rope particles
      const spool = this.reel.localToWorld(new T.Vector3(0, 0.07, -0.085 + 0.027)).toArray(), linePts = [spool, ...guidePts.slice(0, -1)];
      const rp = sim.rope.p, FI = sim.rope.floatIndex; linePts.push(rod.tip); for (let i = 1; i < rp.length; i++) linePts.push(rp[i].x);
      this.fillRibbon(this.ribbon, linePts, cam);
      // float, sinker, hook
      const fp = v3(rp[FI].x), above = v3(rp[FI - 1].x), below = v3(rp[FI + 1].x); let upv = above.clone().sub(below); if (upv.lengthSq() < 1e-6) upv.set(0, 1, 0); upv.normalize(); if (rp[FI].wet) upv.lerp(new T.Vector3(0, 1, 0), 0.55).normalize();
      this.float.position.copy(fp); this.float.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), upv);
      this.sinker.position.copy(v3(rp[sim.rope.sinkerIndex].x));
      const hp = v3(rp[sim.rope.hookIndex].x), hd = v3(rp[sim.rope.hookIndex - 1].x).sub(hp).normalize(); this.hook.position.copy(hp); this.hook.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), hd.lengthSq() > 0 ? hd : new T.Vector3(0, 1, 0));
      this.hook.scale.setScalar(1.6); if (this.bait) this.bait.visible = sim.baitOn;
      // landing net (rest on the boat when unused)
      this.updateNet(sim);
    }
    updateNet(sim) {
      let hand, hoop; if (sim.net.active) { hand = v3(sim.net.hand); hoop = v3(sim.net.hoop); }
      else { hand = v3(sim.boat.toWorld([-0.45, 0.62, -0.62])); hoop = v3(sim.boat.toWorld([-1.6, 0.25, -0.55])); }
      const u = hand.clone().sub(hoop).normalize(), up = new T.Vector3(0, 1, 0); let X = new T.Vector3().crossVectors(u, up); if (X.lengthSq() < 1e-6) X.set(1, 0, 0); X.normalize();
      let w = new T.Vector3().crossVectors(X, u).normalize(); const s = 0.5, c = Math.sqrt(0.75); let Y = u.clone().multiplyScalar(s).add(w.clone().multiplyScalar(c)), Z = u.clone().multiplyScalar(c).sub(w.clone().multiplyScalar(s));
      if (Y.y < 0) { w.negate(); Y = u.clone().multiplyScalar(s).add(w.clone().multiplyScalar(c)); Z = u.clone().multiplyScalar(c).sub(w.clone().multiplyScalar(s)); }
      const Xr = new T.Vector3().crossVectors(Y, Z); this.net.position.copy(hoop); basisQuat(Xr, Y, Z, this.net.quaternion);
      const rim = hoop.clone().add(Z.clone().multiplyScalar(0.27)), len = Math.max(0.5, hand.distanceTo(rim)); if (this.netTube) { this.netTube.scale.y = len; this.netTube.position.y = len / 2; } if (this.netGrip) this.netGrip.position.y = len;
    }
  }

  /* ---------- fish instances ---------- */
  class FishView {
    constructor(scene, templates, boatGroup) { this.scene = scene; this.templates = templates; this.items = new Map(); this.boatGroup = boatGroup; this.coolerFish = []; }
    make(f) {
      const tpl = this.templates[f.sp.id], obj = tpl.clone(true), swim = { value: new T.Vector4(0, 0.1, 0, 1) };
      obj.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); W.patchOptics(m.material, { swim }); m.castShadow = true; } });
      obj.userData.swim = swim; obj.userData.pec = ['fin-pectoral-L', 'fin-pectoral-R'].map(n => obj.getObjectByName(n)).filter(Boolean); this.scene.add(obj); return obj;
    }
    update(sim) {
      for (const f of sim.school.fish) {
        let o = this.items.get(f.id); if (!o) { o = this.make(f); this.items.set(f.id, o); }
        if (f.landed) { if (o.visible) { o.visible = false; this.toCooler(f); } continue; }
        o.visible = f.visible; o.position.set(f.pos[0], f.pos[1], f.pos[2]); o.rotation.set(-f.pitch, f.yaw, f.roll || 0, 'YXZ'); o.scale.setScalar(f.length);
        o.userData.swim.value.set(f.tail, f.tailAmp, f.bend, 1);
        o.userData.pec.forEach((p, i) => { p.rotation.y = (i ? -1 : 1) * (0.5 + 0.35 * Math.sin(f.gill * 1.3 + i)); });
      }
    }
    toCooler(f) { // a static copy rests on the ice inside the cooler (catches accumulate)
      const cooler = this.boatGroup.getObjectByName('cooler'); if (!cooler) return; const tpl = this.templates[f.sp.id].clone(true); tpl.traverse(m => { if (m.isMesh) m.castShadow = false; });
      const n = this.coolerFish.length; tpl.scale.setScalar(Math.min(f.length, 0.5)); tpl.position.set(-0.08 + (n % 2) * 0.12, 0.12 + Math.floor(n / 2) * 0.05, -0.04 + (n % 3) * 0.04); tpl.rotation.set(0, Math.PI / 2 + (n % 2 ? 0.2 : -0.15), Math.PI / 2);
      cooler.add(tpl); this.coolerFish.push(tpl);
    }
  }

  /* ---------- boat ---------- */
  class BoatView {
    constructor(model) { this.group = model; this.lid = model.getObjectByName('cooler-lid'); this.prop = model.getObjectByName('propeller'); model.traverse(m => { if (m.isMesh) W.patchOptics(m.material, { caustics: false }); }); }
    update(sim) { const b = sim.boat; this.group.position.set(b.pos[0], b.pos[1], b.pos[2]); _m.set(b.R[0], b.R[1], b.R[2], 0, b.R[3], b.R[4], b.R[5], 0, b.R[6], b.R[7], b.R[8], 0, 0, 0, 0, 1); this.group.quaternion.setFromRotationMatrix(_m); if (this.lid) this.lid.rotation.x = sim.net.lid; }
  }

  root.FishingActors = { AnglerRig, TackleView, FishView, BoatView, aimBone, twoBone, basisQuat };
})(window);
