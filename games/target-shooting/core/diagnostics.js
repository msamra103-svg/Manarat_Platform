/* Target Shooting 3D — animation quality diagnostics (QA tool; also usable live with ?qa=1).
 *
 * Measured every frame on the final, rendered skeleton:
 *   - per-bone world angular velocity (rad/s) and its frame-to-frame change (angular acceleration);
 *   - tremble: angular velocity that reverses direction twice within 8 frames (oscillation) with at least
 *     0.2 rad/s (~11°/s) on both sides — the visible signature of jitter / IK fighting; single reversals and
 *     slow settling are only counted (`reversals`);
 *   - hand / head positional second difference (positional jitter, m/s²);
 *   - root teleports, planted-foot sliding, sole below the floor;
 *   - joint ranges (elbow, knee, neck rotation from bind, wrist bend), skeletal scale drift;
 *   - camera angular / linear spikes; rejected state transitions.
 * The report never changes the simulation; it only observes.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS;
  const BONES = ['Pelvis', 'Spine2', 'Neck', 'Head', 'L_Clavicle', 'R_Clavicle', 'L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm', 'L_Hand', 'R_Hand', 'L_Thigh', 'R_Thigh', 'L_Foot', 'R_Foot'];
  const LIMITS = { elbowMin: 0.05, kneeMin: 0.0, neckMax: 1.75, wristMax: 1.25 };

  class Diagnostics {
    constructor() { this.reset(); this.q = new T.Quaternion(); this.v = new T.Vector3(); this.v2 = new T.Vector3(); this.s = new T.Vector3(); }
    reset() {
      this.frames = 0; this.prev = null; this.bones = {};
      for (const b of BONES) this.bones[b] = { maxW: 0, maxAcc: 0, tremble: 0, wPrev: null, qPrev: null };
      this.pos = { L_Hand: { maxAcc: 0, p1: null, p2: null }, R_Hand: { maxAcc: 0, p1: null, p2: null }, Head: { maxAcc: 0, p1: null, p2: null } };
      this.root = { maxStep: 0, prev: null }; this.feet = { maxSlide: 0, minSole: Infinity, prev: {} };
      this.joints = { minElbow: Infinity, minKnee: Infinity, maxNeck: 0, maxWrist: 0 };
      this.scale = { maxDev: 0 }; this.cam = { maxW: 0, maxV: 0, qPrev: null, pPrev: null, spikes: 0 };
      this.conflicts = 0; this.states = {}; this.bow = { maxGripErr: 0 };
    }
    sample(archer, dt) {
      if (!(dt > 0)) return;
      const rig = archer.rig, b = rig.bones;
      this.frames++;
      this.states[archer.state] = (this.states[archer.state] || 0) + 1;
      for (const name of BONES) {
        const o = b[name]; if (!o) continue; const s = this.bones[name];
        const q = o.getWorldQuaternion(new T.Quaternion());
        if (s.qPrev) {
          const dq = s.qPrev.clone().invert().premultiply(q);   // world delta  q = dq * qPrev
          if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
          // well-conditioned near zero (float32 matrices): angle from atan2(|xyz|, w), not acos(w)
          const sn = Math.hypot(dq.x, dq.y, dq.z), ang = 2 * Math.atan2(sn, dq.w);
          const w = sn > 1e-12 ? new T.Vector3(dq.x / sn, dq.y / sn, dq.z / sn).multiplyScalar(ang / dt) : new T.Vector3();
          const mag = w.length(); if (mag > s.maxW) { s.maxW = mag; s.at = archer.state + '@' + archer.stateT.toFixed(3); }
          if (s.wPrev) {
            s.maxAcc = Math.max(s.maxAcc, w.clone().sub(s.wPrev).length() / dt);
            // a single direction change is a normal motion; tremble = oscillation: a second reversal of the same bone
            // within 8 frames (velocity flipping back and forth), above a 0.06 rad/s noise floor
            if (mag > 0.06 && s.wPrev.length() > 0.06 && w.dot(s.wPrev) < -0.2 * mag * s.wPrev.length()) {
              s.reversals = (s.reversals || 0) + 1;
              const strong = Math.min(mag, s.wPrev.length()) > 0.2;   // oscillation of at least ~11°/s on both sides
              if (strong && s.lastRev !== undefined && this.frames - s.lastRev <= 8) { s.tremble++; s.trembleAt = archer.state + '@' + archer.stateT.toFixed(3) + ' |w| ' + mag.toFixed(3) + '/' + s.wPrev.length().toFixed(3); }
              if (strong) s.lastRev = this.frames;
            }
          }
          s.wPrev = w;
        }
        s.qPrev = q;
        o.getWorldScale(this.s); this.scale.maxDev = Math.max(this.scale.maxDev, Math.abs(this.s.x - 1), Math.abs(this.s.y - 1), Math.abs(this.s.z - 1));
      }
      for (const name of Object.keys(this.pos)) {
        const s = this.pos[name], p = b[name].getWorldPosition(new T.Vector3());
        if (s.p1 && s.p2) { const acc = p.clone().sub(s.p1.clone().multiplyScalar(2)).add(s.p2).length() / (dt * dt); if (archer.state !== 'RELEASE') s.maxAcc = Math.max(s.maxAcc, acc); }
        s.p2 = s.p1; s.p1 = p;
      }
      const rp = rig.root.position.clone();
      if (this.root.prev) this.root.maxStep = Math.max(this.root.maxStep, rp.distanceTo(this.root.prev));
      this.root.prev = rp;
      for (const s of ['L', 'R']) {
        const toe = b[s + '_Toe0'].getWorldPosition(new T.Vector3()), foot = b[s + '_Foot'].getWorldPosition(new T.Vector3());
        const planted = rig.pose.foot[s].lift === 0;
        if (planted && this.feet.prev[s]) this.feet.maxSlide = Math.max(this.feet.maxSlide, toe.distanceTo(this.feet.prev[s]));
        this.feet.prev[s] = planted ? toe : null;
        this.feet.minSole = Math.min(this.feet.minSole, toe.y, foot.y - 0.099);
        // joints
        const el = jointAngle(b[s + '_UpperArm'], b[s + '_Forearm'], b[s + '_Hand']); this.joints.minElbow = Math.min(this.joints.minElbow, el);
        const kn = jointAngle(b[s + '_Thigh'], b[s + '_Calf'], b[s + '_Foot']); this.joints.minKnee = Math.min(this.joints.minKnee, kn);
        const wr = relAngle(b[s + '_Forearm'], b[s + '_Hand'], rig.rest[s + '_Forearm'].wq, rig.rest[s + '_Hand'].wq); this.joints.maxWrist = Math.max(this.joints.maxWrist, wr);
      }
      this.joints.maxNeck = Math.max(this.joints.maxNeck, relAngle(b.Spine2, b.Head, rig.rest.Spine2.wq, rig.rest.Head.wq));
      this.conflicts = archer.conflicts;
    }
    sampleCamera(cam, dt) {
      if (!(dt > 0)) return;
      const q = cam.quaternion.clone(), p = cam.position.clone();
      if (this.cam.qPrev) {
        const w = 2 * Math.acos(Math.min(1, Math.abs(this.cam.qPrev.dot(q)))) / dt, v = p.distanceTo(this.cam.pPrev) / dt;
        this.cam.maxW = Math.max(this.cam.maxW, w); this.cam.maxV = Math.max(this.cam.maxV, v);
        if (w > 3 || v > 12) this.cam.spikes++;
      }
      this.cam.qPrev = q; this.cam.pPrev = p;
    }
    report() {
      const bones = {}; let tremble = 0, maxW = 0, maxAcc = 0;
      for (const [k, s] of Object.entries(this.bones)) { bones[k] = { maxW: +s.maxW.toFixed(3), at: s.at || '', maxAcc: +s.maxAcc.toFixed(1), tremble: s.tremble, reversals: s.reversals || 0, trembleAt: s.trembleAt || '' }; tremble += s.tremble; maxW = Math.max(maxW, s.maxW); maxAcc = Math.max(maxAcc, s.maxAcc); }
      return {
        frames: this.frames, tremble, maxBoneAngularVelocity: +maxW.toFixed(3), maxBoneAngularAcceleration: +maxAcc.toFixed(1), bones,
        handAcc: { L: +this.pos.L_Hand.maxAcc.toFixed(2), R: +this.pos.R_Hand.maxAcc.toFixed(2), head: +this.pos.Head.maxAcc.toFixed(2) },
        rootMaxStep: +this.root.maxStep.toFixed(4), footSlide: +this.feet.maxSlide.toFixed(5), minSole: +this.feet.minSole.toFixed(4),
        joints: { minElbow: +this.joints.minElbow.toFixed(3), minKnee: +this.joints.minKnee.toFixed(3), maxNeck: +this.joints.maxNeck.toFixed(3), maxWrist: +this.joints.maxWrist.toFixed(3) },
        scaleDrift: +this.scale.maxDev.toExponential(2), camera: { maxW: +this.cam.maxW.toFixed(3), maxV: +this.cam.maxV.toFixed(3), spikes: this.cam.spikes },
        conflicts: this.conflicts, states: this.states
      };
    }
  }
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3();
  /** interior angle at the middle joint minus π => 0 straight, larger = more bent; returns bend (rad) */
  function jointAngle(a, b, c) {
    a.getWorldPosition(_a); b.getWorldPosition(_b); c.getWorldPosition(_c);
    const u = _a.sub(_b).normalize(), v = _c.sub(_b).normalize();
    return Math.PI - Math.acos(Math.max(-1, Math.min(1, u.dot(v))));
  }
  function relAngle(parent, child, restP, restC) {
    const qp = parent.getWorldQuaternion(new T.Quaternion()), qc = child.getWorldQuaternion(new T.Quaternion());
    const rel = qp.clone().invert().multiply(qc), relRest = restP.clone().invert().multiply(restC);
    const d = relRest.clone().invert().multiply(rel);
    return 2 * Math.acos(Math.min(1, Math.abs(d.w)));
  }
  TS.Diagnostics = { Diagnostics, LIMITS };
})(typeof window !== 'undefined' ? window : globalThis);
