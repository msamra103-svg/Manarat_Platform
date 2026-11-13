import * as THREE from "three";
import { LEGS, SPINE_JOINTS } from "./camelAnatomy.mjs";
import { BONE_NAMES } from "./camelBuilder.mjs";
const UP = new THREE.Vector3(0, 1, 0);
const TMP_Q = new THREE.Quaternion();
const TMP_M = new THREE.Matrix4();
const LEG_IDS = ["HL", "HR", "FL", "FR"];
const FOOT_SOLE = 0.026;
const SPRING_STEP = 1 / 120;
const GALLOP_OFFSETS = { HL: 0, HR: 0.11, FL: 0.43, FR: 0.54 };
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function wrap01(x) {
  return x - Math.floor(x);
}
function strideLengthFor(speed) {
  return Math.min(4.9, Math.max(1.3, 0.75 + 0.33 * speed));
}
function dutyFactorFor(speed) {
  return 0.52 - 0.35 * smoothstep(1.5, 11, speed);
}
class CamelAnimator {
  constructor(rig, { seed = 1, variation = 0 } = {}) {
    this.rig = rig;
    this.b = rig.bones;
    this.phase = wrap01(seed * 0.6180339);
    this.var = variation;
    this.strideScale = 1 + variation * 0.04;
    this.neckPhase = seed * 1.7;
    this.time = seed * 3.1;
    this.gaitWeight = 0;
    this.pitch = 0;
    this.pitchVel = 0;
    this.bob = 0;
    this.tailAngle = 0;
    this.tailVel = 0;
    this.footEvents = [];
    this.legState = {};
    this.boost = 0;
    const invGroup = new THREE.Matrix4();
    this._invGroup = invGroup;
    this._groupQ = new THREE.Quaternion();
    this._invGroupQ = new THREE.Quaternion();
    this.legs = {};
    for (const id of LEG_IDS) {
      const L = LEGS[id];
      const j = L.joints.map((p) => new THREE.Vector3(p[0], p[1], L.z * L.side));
      const bones = [0, 1, 2, 3, 4].map((i) => this.b[BONE_NAMES.leg(id, i)]);
      this.legs[id] = {
        id,
        front: L.front,
        side: L.side,
        z: L.z * L.side,
        bones,
        parent: this.b[L.parent],
        lenUpper: j[0].distanceTo(j[1]),
        lenA: j[1].distanceTo(j[2]),
        lenB: j[2].distanceTo(j[3]),
        bindS: j[0].clone(),
        bindB0Pos: null,
        slideMax: L.front ? 0.11 : 0.07,
        pastern: new THREE.Vector3().subVectors(j[3], j[4]),
        // من الخف إلى الحافر
        bindUpper: new THREE.Vector3().subVectors(j[1], j[0]),
        bindFootFromShoulder: new THREE.Vector3(j[4].x - j[0].x, FOOT_SOLE - j[0].y, 0),
        neutralX: j[4].x,
        wasStance: true,
        offset: GALLOP_OFFSETS[id] + variation * 0.015
      };
      this.legState[id] = { foot: new THREE.Vector3(j[4].x, FOOT_SOLE, L.z * L.side), stance: true, load: 0 };
    }
    this._v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  }
  // speed: م/ث، distanceDelta: المسافة المقطوعة في هذا الإطار، frozen: تجميد (سؤال)
  update(dt, { speed = 0, distanceDelta = 0, frozen = false, boost = 0, lateralVel = 0 } = {}) {
    this.footEvents.length = 0;
    this.time += dt;
    const targetGait = smoothstep(0.05, 0.9, speed);
    if (!frozen) this.gaitWeight += (targetGait - this.gaitWeight) * (1 - Math.exp(-dt * 10));
    const S = strideLengthFor(speed) * this.strideScale;
    const D = dutyFactorFor(speed);
    if (!frozen && distanceDelta > 0) this.phase = wrap01(this.phase + distanceDelta / S);
    this.boost += (boost - this.boost) * (1 - Math.exp(-dt * 3));
    const g = this.gaitWeight;
    const A = D * S / 2;
    let frontLoad = 0, hindLoad = 0;
    const footTargets = {};
    for (const id of LEG_IDS) {
      const leg = this.legs[id];
      const p = wrap01(this.phase - leg.offset);
      let x, y, flex = 0, stance;
      const baseX = leg.neutralX + (leg.front ? 0.05 : -0.02) * g;
      if (p < D) {
        stance = true;
        const s = p / D;
        x = baseX + A - 2 * A * s;
        y = FOOT_SOLE;
        const load = Math.sin(Math.PI * s);
        if (leg.front) frontLoad += load;
        else hindLoad += load;
        flex = -0.35 * smoothstep(0.75, 1, s);
      } else {
        stance = false;
        const q = (p - D) / (1 - D);
        const e = q * q * (3 - 2 * q);
        const tangent = -0.18 * (q - q * q) * 4;
        x = baseX - A + 2 * A * (e + tangent * 0.5);
        const lift = (leg.front ? 0.4 : 0.3) * Math.min(1, S / 3.2);
        y = FOOT_SOLE + lift * Math.pow(Math.sin(Math.PI * Math.pow(q, 0.8)), 1.3);
        flex = -(leg.front ? 1.25 : 0.95) * Math.sin(Math.PI * Math.min(1, q * 1.1));
      }
      const standX = leg.neutralX;
      x = standX + (x - standX) * g;
      y = FOOT_SOLE + (y - FOOT_SOLE) * g;
      flex *= g;
      const st = this.legState[id];
      if (!frozen && g > 0.3 && stance && !leg.wasStance) {
        this.footEvents.push({ id, front: leg.front, x, z: leg.z });
      }
      if (!frozen) leg.wasStance = stance;
      st.stance = stance;
      footTargets[id] = { x, y, flex };
    }
    for (const id of LEG_IDS) {
      const leg = this.legs[id];
      const t = footTargets[id];
      const dx = t.x - leg.neutralX;
      t.slide = Math.max(-leg.slideMax, Math.min(leg.slideMax, dx * (leg.front ? 0.3 : 0.2)));
    }
    let sink = 0;
    for (const id of LEG_IDS) {
      const leg = this.legs[id];
      if (!this.legState[id].stance && g > 0.5) continue;
      const t = footTargets[id];
      const fx = t.x + leg.pastern.x, fy = t.y + leg.pastern.y;
      const sx = leg.bindS.x + t.slide, sy = leg.bindS.y + this.bob;
      const R = (leg.lenUpper * (leg.front ? 0.97 : 0.93) + leg.lenA + leg.lenB) * 0.975;
      const dx = fx - sx;
      const need = Math.sqrt(Math.max(0, R * R - dx * dx));
      const deficit = sy - fy - need;
      if (deficit > sink) sink = deficit;
    }
    sink = Math.min(0.12, sink);
    this.sink = (this.sink || 0) + (sink - (this.sink || 0)) * (1 - Math.exp(-dt * 30));
    if (sink > this.sink) this.sink = sink;
    const bobTarget = g * (0.03 - 0.05 * (frontLoad + hindLoad) * 0.5) * Math.min(1, S / 3.5);
    const pitchTarget = g * (frontLoad - hindLoad) * 0.055 * Math.min(1, S / 3.5) - g * 0.02;
    if (!frozen) {
      this.bob += (bobTarget - this.bob) * (1 - Math.exp(-dt * 18));
      const k = 90, c = 14;
      const n = Math.max(1, Math.ceil(dt / SPRING_STEP)), h = dt / n;
      for (let i = 0; i < n; i++) {
        this.pitchVel += (k * (pitchTarget - this.pitch) - c * this.pitchVel) * h;
        this.pitch += this.pitchVel * h;
      }
      this.pitch = Math.max(-0.25, Math.min(0.25, this.pitch));
    }
    const breath = Math.sin(this.time * (frozen ? 1.6 : 2.2)) * 4e-3;
    const body = this.b.body;
    body.position.copy(body.userData.bindPos);
    body.position.y += this.bob + breath - this.sink;
    body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -this.pitch);
    body.quaternion.multiply(TMP_Q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -lateralVel * 0.04));
    const neckSwing = frozen ? 0 : Math.sin((this.phase + 0.1) * Math.PI * 2) * 0.045 * g;
    const neckTilt = g * (0.07 + this.boost * 0.05);
    const breathNeck = Math.sin(this.time * 1.3 + this.neckPhase) * 0.01;
    const neckBones = BONE_NAMES.neck.map((n) => this.b[n]);
    let accum = -this.pitch;
    for (let i = 0; i < neckBones.length; i++) {
      const nb = neckBones[i];
      const a = (i < 2 ? -neckTilt * 0.5 : neckTilt * 0.35) + this.pitch * 0.35 + neckSwing * (i + 1) * 0.35 + breathNeck;
      nb.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
      accum += a;
    }
    const head = this.b.head;
    const headTarget = -0.04 * g + Math.sin(this.time * 0.9 + this.neckPhase) * 0.02;
    head.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), headTarget - accum * 0.75);
    if (!frozen) {
      const tailTarget = 0.35 * g + this.pitchVel * 0.25 + Math.sin(this.phase * Math.PI * 2) * 0.12 * g;
      const n = Math.max(1, Math.ceil(dt / SPRING_STEP)), h = dt / n;
      for (let i = 0; i < n; i++) {
        this.tailVel += (40 * (tailTarget - this.tailAngle) - 6 * this.tailVel) * h;
        this.tailAngle += this.tailVel * h;
      }
      this.tailAngle = Math.max(-0.6, Math.min(1.2, this.tailAngle));
    }
    const tailSway = Math.sin(this.time * 1.1 + this.neckPhase) * 0.05;
    for (let i = 0; i < 3; i++) {
      const tb = this.b[BONE_NAMES.tail[i]];
      tb.quaternion.copy(tb.userData.bindQuat).multiply(
        TMP_Q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.tailAngle * (i === 0 ? 0.6 : 0.3))
      ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tailSway));
    }
    const group = this.rig.group;
    group.updateMatrixWorld(true);
    this._invGroup.copy(group.matrixWorld).invert();
    group.getWorldQuaternion(this._groupQ);
    this._invGroupQ.copy(this._groupQ).invert();
    for (const id of LEG_IDS) this._solveLeg(this.legs[id], footTargets[id]);
  }
  _camelSpaceQuat(obj, out) {
    obj.getWorldQuaternion(out);
    return out.premultiply(this._invGroupQ);
  }
  _solveLeg(leg, tgt) {
    const [vS, vE, vK, vF, vP] = this._v;
    const [b0, b1, b2, b3, b4] = leg.bones;
    const parentQ = this._camelSpaceQuat(leg.parent, new THREE.Quaternion());
    if (!leg.bindB0Pos) leg.bindB0Pos = b0.userData.bindPos.clone();
    const slideLocal = new THREE.Vector3(tgt.slide || 0, -Math.abs(tgt.slide || 0) * 0.25, 0).applyQuaternion(parentQ.clone().invert());
    b0.position.copy(leg.bindB0Pos).add(slideLocal);
    b0.updateMatrixWorld(false);
    vS.setFromMatrixPosition(b0.matrixWorld).applyMatrix4(this._invGroup);
    vP.set(tgt.x, tgt.y, leg.z);
    const past = leg.pastern.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), tgt.flex);
    vF.copy(vP).add(past);
    const bindUp = leg.bindUpper.clone().applyQuaternion(parentQ);
    const bindLeg = leg.bindFootFromShoulder.clone().applyQuaternion(parentQ);
    const toF = vF.clone().sub(vS);
    const dAng = Math.atan2(toF.y, toF.x) - Math.atan2(bindLeg.y, bindLeg.x);
    const k = leg.front ? 0.85 : 0.7;
    const upper = bindUp.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), dAng * k);
    vE.copy(vS).add(upper);
    const a = leg.lenA, b = leg.lenB;
    const dv = vF.clone().sub(vE);
    let d = dv.length();
    const dir = dv.clone().divideScalar(d || 1);
    const dMax = a + b - 2e-3, dMin = Math.abs(a - b) + 0.05;
    if (d > dMax) {
      const hx = vF.x - vE.x;
      if (Math.abs(hx) < dMax) {
        vF.y = vE.y - Math.sqrt(dMax * dMax - hx * hx);
      } else {
        vF.copy(vE).addScaledVector(dir, dMax);
      }
      vP.copy(vF).sub(past);
      dv.subVectors(vF, vE);
      d = dv.length();
      dir.copy(dv).divideScalar(d);
    }
    if (d < dMin) d = dMin;
    const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    const perp = new THREE.Vector3(-dir.y, dir.x, 0);
    const bendSign = leg.front ? 1 : -1;
    vK.copy(vE).addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA * bendSign);
    const q0 = new THREE.Quaternion().setFromUnitVectors(UP, vE.clone().sub(vS).normalize());
    const q1 = new THREE.Quaternion().setFromUnitVectors(UP, vK.clone().sub(vE).normalize());
    const q2 = new THREE.Quaternion().setFromUnitVectors(UP, vF.clone().sub(vK).normalize());
    const q3 = new THREE.Quaternion().setFromUnitVectors(UP, vP.clone().sub(vF).normalize());
    const q4 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tgt.flex * 0.8);
    b0.quaternion.copy(parentQ.clone().invert().multiply(q0));
    b1.quaternion.copy(q0.clone().invert().multiply(q1));
    b2.quaternion.copy(q1.clone().invert().multiply(q2));
    b3.quaternion.copy(q2.clone().invert().multiply(q3));
    b4.quaternion.copy(q3.clone().invert().multiply(q4));
    b1.position.set(0, leg.lenUpper, 0);
    b2.position.set(0, a, 0);
    b3.position.set(0, b, 0);
    this.legState[leg.id].foot.copy(vP);
    void TMP_M;
  }
  // موضع منتصف ظهر الهجين خلف السنام (لتثبيت الراكب الآلي)
  static saddleLocal() {
    return new THREE.Vector3(-0.42 - SPINE_JOINTS.spine[0], 0.28, 0);
  }
}
export {
  CamelAnimator,
  FOOT_SOLE,
  dutyFactorFor,
  strideLengthFor
};
