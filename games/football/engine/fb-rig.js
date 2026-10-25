/* World-space rig control: two-bone IK for legs and arms (feet plant exactly, hands reach the ball), FK helpers for spine/neck/head.
 * Works on any FB.Char skeleton, with or without meshes (so it is unit-testable in Node). */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, Q = T.Quaternion;
  const _v1 = new V(), _v2 = new V(), _v3 = new V(), _v4 = new V(), _q1 = new Q(), _q2 = new Q(), _q3 = new Q(), _s = new V(), _e = new T.Euler();
  const UP = new V(0, 1, 0), RIGHT = new V(1, 0, 0), FWD = new V(0, 0, 1);

  function worldPos(bone, out) { bone.updateWorldMatrix(true, false); return out.setFromMatrixPosition(bone.matrixWorld); }
  function worldQuat(bone, out) { bone.updateWorldMatrix(true, false); bone.matrixWorld.decompose(_v4, out, _s); return out; }

  class Rig {
    constructor(actor) {
      this.actor = actor; this.root = actor.root; this.b = actor.bones;
      const rest = {}; for (const bn of actor.man.bones) rest[bn.name] = new V(bn.pos[0], bn.pos[1], bn.pos[2]);
      this.rest = rest;
      const len = (a, b) => rest[a].distanceTo(rest[b]);
      const dir = (a, b) => rest[b].clone().sub(rest[a]).normalize();
      this.sides = ['L', 'R'];
      this.len = {}; this.dir = {};
      for (const S of this.sides) {
        this.len['thigh' + S] = len('thigh' + S, 'shin' + S); this.len['shin' + S] = len('shin' + S, 'foot' + S);
        this.len['upperarm' + S] = len('upperarm' + S, 'lowerarm' + S); this.len['lowerarm' + S] = len('lowerarm' + S, 'hand' + S);
        this.dir['thigh' + S] = dir('thigh' + S, 'shin' + S); this.dir['shin' + S] = dir('shin' + S, 'foot' + S);
        this.dir['upperarm' + S] = dir('upperarm' + S, 'lowerarm' + S); this.dir['lowerarm' + S] = dir('lowerarm' + S, 'hand' + S);
      }
      this.hipsRest = rest.hips.clone();
      this.ankleHeight = rest.footL.y;            // ankle joint height above the sole in the rest pose
      this.legLength = this.len.thighL + this.len.shinL;
      this.standHipY = rest.hips.y;               // hips joint height when standing straight
      this.scale = actor.root.scale.x || 1;
      this.reset();
    }
    reset() { for (const bn of this.actor.boneList) bn.quaternion.identity(); this.b.hips.position.copy(this.hipsRest); this.root.updateMatrixWorld(true); }

    /** Place the pelvis: offset (metres, character space, relative to the rest pose) and an orientation (yaw/pitch/roll). */
    hips(off, yaw = 0, pitch = 0, roll = 0) {
      const h = this.b.hips;
      h.position.set(this.hipsRest.x + (off ? off.x : 0), this.hipsRest.y + (off ? off.y : 0), this.hipsRest.z + (off ? off.z : 0));
      h.quaternion.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ'));
      return this;
    }
    /** Spine flex (forward +), side bend (towards +x +) and twist (positive turns the chest to the character's left) spread over the three spine bones. */
    spine(flex = 0, side = 0, twist = 0) {
      const w = [0.30, 0.35, 0.35], names = ['spine1', 'spine2', 'spine3'];
      for (let i = 0; i < 3; i++) this.b[names[i]].quaternion.setFromEuler(_e.set(flex * w[i], twist * w[i], -side * w[i], 'YXZ'));
      return this;
    }
    /** Head look: yaw, pitch (down +) and roll shared by neck and head. */
    look(yaw = 0, pitch = 0, roll = 0) {
      this.b.neck.quaternion.setFromEuler(_e.set(pitch * 0.4, yaw * 0.4, -roll * 0.4, 'YXZ'));
      this.b.head.quaternion.setFromEuler(_e.set(pitch * 0.6, yaw * 0.6, -roll * 0.6, 'YXZ'));
      return this;
    }
    /** Make the head look toward a world point, limited to a human range. */
    lookAt(p, limitYaw = 1.0, limitPitch = 0.6, k = 1) {
      const hp = worldPos(this.b.head, _v1), d = _v2.copy(p).sub(hp);
      const base = worldQuat(this.b.spine3, _q1).clone();
      d.applyQuaternion(_q2.copy(base).invert());
      const yaw = Math.atan2(d.x, d.z), pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
      return this.look(FB.math.clamp(yaw, -limitYaw, limitYaw) * k, FB.math.clamp(pitch, -limitPitch, limitPitch) * k, 0);
    }

    /** swing a bone so that its rest direction points along dirWorld; the reference orientation provides the (minimal-twist) frame */
    _aim(bone, restDirLocal, dirWorld, refQ, twist) {
      const rd = _v3.copy(restDirLocal).applyQuaternion(refQ);
      const qa = _q2.setFromUnitVectors(rd, dirWorld).multiply(refQ);
      if (twist) qa.premultiply(_q3.setFromAxisAngle(dirWorld, twist));
      const pq = worldQuat(bone.parent, _q3).invert();
      bone.quaternion.copy(pq).multiply(qa);
      bone.updateMatrixWorld(true);
      return qa;
    }

    /** Generic two-bone IK. a/b/c = upper bone name, lower bone name, end bone name (world target for the end joint). Returns reach (0..1). */
    _ik2(upper, lower, S, target, pole, twist = 0) {
      const U = this.b[upper + S], Lw = this.b[lower + S];
      const l1 = this.len[upper + S] * this.scale, l2 = this.len[lower + S] * this.scale;
      this.root.updateMatrixWorld(true);
      const o = worldPos(U, _v1).clone();
      const d = _v2.copy(target).sub(o); let D = d.length();
      const maxR = l1 + l2 - 1e-4, minR = Math.abs(l1 - l2) + 1e-3;
      const reach = D / (l1 + l2);
      D = Math.max(minR, Math.min(maxR, D)); d.normalize();
      const cosA = (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), A = Math.acos(Math.max(-1, Math.min(1, cosA))), sinA = Math.sin(A);
      const p = _v3.copy(pole); p.addScaledVector(d, -p.dot(d)); if (p.lengthSq() < 1e-8) p.set(0, 0, 1); p.normalize();
      const dirU = new V().copy(d).multiplyScalar(cosA).addScaledVector(p, sinA).normalize();
      const knee = new V().copy(o).addScaledVector(dirU, l1);
      const end = new V().copy(o).addScaledVector(d, D);
      const dirL = end.sub(knee).normalize();
      const parentQ = worldQuat(U.parent, new Q());
      const qU = this._aim(U, this.dir[upper + S], dirU, parentQ, twist);
      const qUw = qU.clone();
      this._aim(Lw, this.dir[lower + S], dirL, qUw, 0);
      return reach;
    }

    /** Leg IK to a world-space ankle target. footYaw/footPitch are world angles of the foot (pitch: toes down +). */
    leg(S, ankleWorld, opts = {}) {
      const fwd = opts.pole || _v4.set(0, 0, 1).applyQuaternion(worldQuat(this.b.hips, _q1));
      const pole = new V().copy(fwd).addScaledVector(new V(S === 'L' ? 1 : -1, 0, 0).applyQuaternion(_q1), opts.knee === undefined ? 0.25 : opts.knee);
      const reach = this._ik2('thigh', 'shin', S, ankleWorld, pole, opts.twist || 0);
      const foot = this.b['foot' + S];
      const q = _q2.setFromEuler(_e.set(opts.footPitch || 0, opts.footYaw || 0, opts.footRoll || 0, 'YXZ'));
      const pq = worldQuat(foot.parent, _q3).invert();
      foot.quaternion.copy(pq).multiply(q); foot.updateMatrixWorld(true);
      const toes = this.b['toes' + S]; toes.quaternion.setFromEuler(_e.set(opts.toes || 0, 0, 0)); toes.updateMatrixWorld(true);
      return reach;
    }
    /** Arm IK to a world-space wrist target (hand follows the forearm). pole defaults to elbow back/out. */
    arm(S, wristWorld, opts = {}) {
      const sgn = S === 'L' ? 1 : -1;
      this.root.updateMatrixWorld(true);
      const bq = worldQuat(this.b.spine3, _q1);
      const pole = opts.pole ? new V().copy(opts.pole) : new V(sgn * 0.7, -0.2, -0.7).applyQuaternion(bq);
      return this._ik2('upperarm', 'lowerarm', S, wristWorld, pole, opts.twist || 0);
    }
    /** FK arm in the shoulder's parent frame (angles in radians): flex (forward +), abd (outward +), elbow flex (forward +). */
    armFK(S, flex = 0, abd = 0, elbow = 0, rot = 0) {
      const sgn = S === 'L' ? 1 : -1;
      this.b['upperarm' + S].quaternion.setFromEuler(_e.set(-flex, rot * sgn, sgn * abd, 'XZY'));
      this.b['lowerarm' + S].quaternion.setFromEuler(_e.set(-elbow, 0, 0));
      return this;
    }
    legFK(S, flex = 0, abd = 0, knee = 0, ankle = 0) {
      const sgn = S === 'L' ? 1 : -1;
      this.b['thigh' + S].quaternion.setFromEuler(_e.set(-flex, 0, sgn * abd, 'XZY'));
      this.b['shin' + S].quaternion.setFromEuler(_e.set(knee, 0, 0));
      this.b['foot' + S].quaternion.setFromEuler(_e.set(ankle, 0, 0));
      return this;
    }
    /** hand: curl 0 (open) .. 1 (fist); wrist flex */
    hand(S, curl = 0.3, wrist = 0, thumb = 0.3) {
      const sgn = S === 'L' ? 1 : -1;
      this.b['fingers' + S].quaternion.setFromEuler(_e.set(0, 0, -sgn * curl * 1.45));
      this.b['thumb' + S].quaternion.setFromEuler(_e.set(0, 0, -sgn * thumb * 0.9));
      this.b['hand' + S].quaternion.setFromEuler(_e.set(-wrist, 0, 0));
      return this;
    }
    clavicle(S, up = 0, fwd = 0) { const sgn = S === 'L' ? 1 : -1; this.b['clavicle' + S].quaternion.setFromEuler(_e.set(-fwd, 0, sgn * up)); return this; }

    /** world position of a named joint (for contact tests, camera targets…) */
    joint(name, out = new V()) { return worldPos(this.b[name], out); }
    /** world position of a point 'depth' metres beyond the wrist along the forearm — the palm centre */
    palm(S, out = new V()) {
      const w = worldPos(this.b['hand' + S], out); const f = worldPos(this.b['fingers' + S], _v2);
      return out.lerp(f, 0.55);
    }
    ballOfFoot(S, out = new V()) { const t = worldPos(this.b['toes' + S], out); const a = worldPos(this.b['foot' + S], _v2); return out.lerp(a, 0.25); }
  }
  FB.Rig = Rig;
  FB.RigV = { UP, RIGHT, FWD };
})(typeof window !== 'undefined' ? window : globalThis);
