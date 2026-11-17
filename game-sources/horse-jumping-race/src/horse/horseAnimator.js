import * as THREE from 'three';
import { LEGS, SPINE_JOINTS, FOOT_SOLE } from './horseAnatomy.js';
import { BONE_NAMES } from './horseBuilder.js';
import { JUMP } from '../race/raceModel.js';

export { FOOT_SOLE };

// محرك حركة الحصان الإجرائي (عدو + قفز الحواجز).
// المبدأ الأساسي لمنع انزلاق الأقدام: طور الدورة يتقدم بالمسافة المقطوعة فعليًا
// (phase += distance / strideLength). أثناء الارتكاز يتحرك الحافر للخلف بالنسبة للجسم
// بنفس سرعة الجسم تمامًا، فيبقى ثابتًا على الأرض.
//
// المرجع الحركي: عدو الخيل السريع (gallop) — الخلفيتان ثم الأماميتان بفارق زمني قصير،
// مع مرحلة طيران قصيرة، وتمايل الجسم للأمام عند ارتكاز الأماميتين، وتعويض الرقبة لثبات الرأس.

const UP = new THREE.Vector3(0, 1, 0);
const TMP_Q = new THREE.Quaternion();
const TMP_M = new THREE.Matrix4();
const LEG_IDS = ['HL', 'HR', 'FL', 'FR'];

const SPRING_STEP = 1 / 120; // خطوة تكامل النوابض (ثابتة لضمان الاستقرار)

// إزاحات طور كل رجل في دورة العدو (عدو مستعرض)
const GALLOP_OFFSETS = { HL: 0.0, HR: 0.12, FL: 0.33, FR: 0.45 }; // عدو الخيل: خلفيتان ثم أماميتان ثم طيران
const JUMP_RISE = 0.95; // أقصى ارتفاع لجسم الحصان فوق الحاجز
const lerp = (a, b, t) => a + (b - a) * t;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function wrap01(x) { return x - Math.floor(x); }

// طول الخطوة الكاملة (دورة) ونسبة زمن الارتكاز بحسب السرعة.
// عند 12 م/ث: خطوة ≈ 4.7م وتردد ≈ 2.5 دورة/ث ونسبة ارتكاز ≈ 0.17 (عدو سريع).
export function strideLengthFor(speed) {
  return Math.min(7.0, Math.max(1.6, 0.9 + 0.38 * speed));
}
export function dutyFactorFor(speed) {
  return 0.5 - 0.3 * smoothstep(1.5, 12, speed);
}

export class HorseAnimator {
  constructor(rig, { seed = 1, variation = 0 } = {}) {
    this.rig = rig;
    this.b = rig.bones;
    this.phase = wrap01(seed * 0.6180339);
    this.var = variation; // -1..1 تنويع بسيط بين الخيل
    this.strideScale = 1 + variation * 0.04;
    this.neckPhase = seed * 1.7;
    this.time = seed * 3.1;
    this.gaitWeight = 0;
    this.pitch = 0; this.pitchVel = 0;
    this.bob = 0;
    this.tailAngle = 0; this.tailVel = 0;
    this.footEvents = []; // لحظات ملامسة الأرض (للغبار والآثار والصوت)
    this.legState = {};
    this.boost = 0;
    const invGroup = new THREE.Matrix4();
    this._invGroup = invGroup;
    this._groupQ = new THREE.Quaternion();
    this._invGroupQ = new THREE.Quaternion();
    // معلومات الأرجل الثابتة
    this.legs = {};
    for (const id of LEG_IDS) {
      const L = LEGS[id];
      const j = L.joints.map((p) => new THREE.Vector3(p[0], p[1], L.z * L.side));
      const bones = [0, 1, 2, 3, 4].map((i) => this.b[BONE_NAMES.leg(id, i)]);
      this.legs[id] = {
        id, front: L.front, side: L.side, z: L.z * L.side,
        bones,
        parent: this.b[L.parent],
        lenUpper: j[0].distanceTo(j[1]),
        lenA: j[1].distanceTo(j[2]),
        lenB: j[2].distanceTo(j[3]),
        bindS: j[0].clone(),
        bindB0Pos: null,
        slideMax: L.front ? 0.11 : 0.07,
        pastern: new THREE.Vector3().subVectors(j[3], j[4]), // من الحافر إلى الحافر
        bindUpper: new THREE.Vector3().subVectors(j[1], j[0]),
        bindFootFromShoulder: new THREE.Vector3(j[4].x - j[0].x, FOOT_SOLE - j[0].y, 0),
        neutralX: j[4].x,
        wasStance: true,
        offset: GALLOP_OFFSETS[id] + (variation * 0.015),
      };
      this.legState[id] = { foot: new THREE.Vector3(j[4].x, FOOT_SOLE, L.z * L.side), stance: true, load: 0 };
    }
    this._v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  }

  // speed: م/ث، distanceDelta: المسافة المقطوعة في هذا الإطار، frozen: تجميد (سؤال)
  update(dt, { speed = 0, distanceDelta = 0, frozen = false, boost = 0, lateralVel = 0, jump = null } = {}) {
    this.footEvents.length = 0;
    this.time += dt;
    const targetGait = smoothstep(0.05, 0.9, speed);
    if (!frozen) this.gaitWeight += (targetGait - this.gaitWeight) * (1 - Math.exp(-dt * 10));
    const S = strideLengthFor(speed) * this.strideScale;
    const D = dutyFactorFor(speed);
    if (!frozen && distanceDelta > 0) this.phase = wrap01(this.phase + distanceDelta / S);
    this.boost += (boost - this.boost) * (1 - Math.exp(-dt * 3));

    const g = this.gaitWeight;
    const A = (D * S) / 2; // نصف طول مسار الارتكاز

    // --- حساب أهداف الأقدام وأحمالها ---
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
        if (leg.front) frontLoad += load; else hindLoad += load;
        // دحرجة خفيفة للخف عند الدفع
        flex = -0.35 * smoothstep(0.75, 1, s);
      } else {
        stance = false;
        const q = (p - D) / (1 - D);
        // منحنى أفقي ناعم مع سرعة ابتدائية ونهائية قريبة من سرعة الأرض
        const e = q * q * (3 - 2 * q);
        const tangent = -0.18 * (q - q * q) * 4;
        x = baseX - A + 2 * A * (e + tangent * 0.5);
        const lift = (leg.front ? 0.44 : 0.32) * Math.min(1, S / 3.6);
        // ارتفاع غير متماثل: يرتفع سريعًا ثم يهبط بهدوء
        y = FOOT_SOLE + lift * Math.pow(Math.sin(Math.PI * Math.pow(q, 0.8)), 1.3);
        flex = -(leg.front ? 1.25 : 0.95) * Math.sin(Math.PI * Math.min(1, q * 1.1));
      }
      // الوقوف: جميع الأقدام على الأرض في الوضع المحايد
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

    // --- القفز: يطغى على دورة العدو من الارتقاء حتى اكتمال الهبوط ---
    // u: 0 عند الارتقاء، ≈0.97 هبوط الأماميتين، ≈1.08 هبوط الخلفيتين، 1.15 عودة العدو
    let rise = 0, jumpW = 0, jumpPitch = 0;
    this.jumpLean = 0;
    if (jump !== null) {
      const u = jump;
      jumpW = smoothstep(0, 0.05, u) * (1 - smoothstep(1.08, 1.15, u));
      const ur = Math.min(1, Math.max(0, (u - 0.08) / 0.92));
      rise = JUMP_RISE * Math.sin(Math.PI * ur) ** 2;
      jumpPitch = u < 1 ? -0.36 * Math.sin(2 * Math.PI * u) : 0;
      this.jumpLean = Math.sin(Math.PI * Math.min(1, u)) * (u < 0.6 ? 1 : 0.4);
      for (const id of LEG_IDS) {
        const leg = this.legs[id];
        const nx = leg.neutralX;
        let x, y, flex, stance = false;
        const lag = leg.side > 0 ? 0 : 0.025; // فارق بسيط بين اليمنى واليسرى
        const v = u - lag;
        if (leg.front) {
          if (v < 0.1) { const k = Math.max(0, v / 0.1); x = nx + 0.1; y = FOOT_SOLE + k * 0.35; flex = -1.2 * k; }
          else if (v < 0.68) { x = nx + 0.16; y = FOOT_SOLE + rise + 0.5; flex = -1.75; }
          else if (v < 0.97) { const k = (v - 0.68) / 0.29, e = k * k * (3 - 2 * k); x = nx + 0.16 + 0.36 * e; y = lerp(FOOT_SOLE + rise + 0.5, FOOT_SOLE, e); flex = -1.75 * (1 - e); }
          else { x = nx + 0.52 - (v - 0.97) * JUMP.span; y = FOOT_SOLE; flex = 0; stance = true; }
        } else if (v < 0.16) { x = nx + 0.12 - Math.max(0, v) * JUMP.span; y = FOOT_SOLE; flex = -0.3 * Math.max(0, v / 0.16); stance = true; }
        else if (v < 0.85) { const k = (v - 0.16) / 0.69, e = k * k * (3 - 2 * k); x = lerp(nx + 0.12 - 0.16 * JUMP.span, nx - 0.05, e); y = FOOT_SOLE + rise + 0.12 + 0.3 * Math.sin(Math.PI * Math.min(1, k * 1.2)); flex = -1.2 * Math.sin(Math.PI * k); }
        else if (v < 1.08) { const k = (v - 0.85) / 0.23, e = k * k * (3 - 2 * k); x = lerp(nx - 0.05, nx + 0.32, e); y = lerp(FOOT_SOLE + rise + 0.12, FOOT_SOLE, e); flex = 0; }
        else { x = nx + 0.32 - (v - 1.08) * JUMP.span; y = FOOT_SOLE; flex = 0; stance = true; }
        const t = footTargets[id];
        t.x = lerp(t.x, x, jumpW); t.y = lerp(t.y, y, jumpW); t.flex = lerp(t.flex, flex, jumpW);
        if (jumpW > 0.5) {
          const st = this.legState[id];
          if (!frozen && stance && st.jumpAir) this.footEvents.push({ id, front: leg.front, x: t.x, z: leg.z, landing: true });
          if (!frozen) st.jumpAir = !stance;
          st.stance = stance;
          leg.wasStance = stance;
        }
      }
      // عند اكتمال الهبوط نضبط طور العدو ليتابع بسلاسة (الخلفيتان في بداية الارتكاز)
      if (!frozen && u > 1.08 && !this._jumpSynced) { this.phase = wrap01(GALLOP_OFFSETS.HL + 0.04); this._jumpSynced = true; }
    } else this._jumpSynced = false;

    // --- انزلاق لوح الكتف/الحوض مع اتجاه الرجل (يزيد المدى الأفقي طبيعيًا) ---
    for (const id of LEG_IDS) {
      const leg = this.legs[id];
      const t = footTargets[id];
      const dx = t.x - leg.neutralX;
      t.slide = Math.max(-leg.slideMax, Math.min(leg.slideMax, dx * (leg.front ? 0.3 : 0.2)));
    }
    // --- هبوط الجسم إذا لزم حتى تلامس كل رجل مرتكزة الأرض (لا جري في الهواء) ---
    let sink = 0;
    for (const id of LEG_IDS) {
      const leg = this.legs[id];
      if (!this.legState[id].stance && g > 0.5) continue;
      const t = footTargets[id];
      const fx = t.x + leg.pastern.x, fy = t.y + leg.pastern.y;
      const sx = leg.bindS.x + t.slide, sy = leg.bindS.y + this.bob + rise - (jumpW > 0 ? (leg.front ? -1 : 1) * Math.sin(jumpPitch) * 0.55 : 0);
      const R = (leg.lenUpper * (leg.front ? 0.97 : 0.93) + leg.lenA + leg.lenB) * 0.975;
      const dx = fx - sx;
      const need = Math.sqrt(Math.max(0, R * R - dx * dx)); // أقصى فرق ارتفاع ممكن
      const deficit = (sy - fy) - need;
      if (deficit > sink) sink = deficit;
    }
    sink = Math.min(0.12, sink);
    this.sink = (this.sink || 0) + (sink - (this.sink || 0)) * (1 - Math.exp(-dt * 30));
    if (sink > this.sink) this.sink = sink;

    // --- حركة الجسم: هبوط عند التحميل، وميل أمامي/خلفي حسب الأرجل المرتكزة ---
    const bobTarget = g * (0.03 - 0.05 * (frontLoad + hindLoad) * 0.5) * Math.min(1, S / 3.5);
    const pitchTarget = g * (frontLoad - hindLoad) * 0.055 * Math.min(1, S / 3.5) - g * 0.02;
    if (!frozen) {
      this.bob += (bobTarget - this.bob) * (1 - Math.exp(-dt * 18));
      // نابض للميل حتى يكون متزنًا وغير حاد — بخطوات فرعية ثابتة حتى يبقى مستقرًا مهما كان معدل الإطارات
      const k = 90, c = 14;
      const n = Math.max(1, Math.ceil(dt / SPRING_STEP)), h = dt / n;
      for (let i = 0; i < n; i++) {
        this.pitchVel += (k * (pitchTarget - this.pitch) - c * this.pitchVel) * h;
        this.pitch += this.pitchVel * h;
      }
      this.pitch = Math.max(-0.4, Math.min(0.4, this.pitch));
    }
    const breath = Math.sin(this.time * (frozen ? 1.6 : 2.2)) * 0.004;
    const body = this.b.body;
    body.position.copy(body.userData.bindPos);
    if (jumpW > 0) { this.pitch = lerp(this.pitch, jumpPitch, jumpW); this.pitchVel *= 1 - jumpW; }
    body.position.y += this.bob + breath - this.sink + rise;
    body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -this.pitch);
    // ميل جانبي خفيف مع الانعطاف
    body.quaternion.multiply(TMP_Q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -lateralVel * 0.04));

    // --- الرقبة والرأس ---
    const neckSwing = frozen ? 0 : Math.sin((this.phase + 0.1) * Math.PI * 2) * 0.045 * g;
    const neckTilt = g * (0.16 + this.boost * 0.06) + this.jumpLean * 0.22; // الرقبة تمتد للأمام أثناء العدو وفوق الحاجز
    const breathNeck = Math.sin(this.time * 1.3 + this.neckPhase) * 0.01;
    const neckBones = BONE_NAMES.neck.map((n) => this.b[n]);
    let accum = -this.pitch;
    for (let i = 0; i < neckBones.length; i++) {
      const nb = neckBones[i];
      const a = (i < 2 ? -neckTilt * 0.5 : neckTilt * 0.35) + this.pitch * 0.35 + neckSwing * (i + 1) * 0.35 + breathNeck;
      nb.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
      accum += a;
    }
    // تثبيت الرأس: يعوّض معظم دوران ما فوقه
    const head = this.b.head;
    const headTarget = -0.04 * g + Math.sin(this.time * 0.9 + this.neckPhase) * 0.02;
    head.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), headTarget - accum * 0.75);

    // --- الذيل: يتأخر عن حركة الجسم ---
    if (!frozen) {
      const tailTarget = 0.55 * g + this.pitchVel * 0.25 + Math.sin(this.phase * Math.PI * 2) * 0.12 * g;
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
        TMP_Q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.tailAngle * (i === 0 ? 0.6 : 0.3)),
      ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tailSway));
    }

    // --- تحديث مصفوفات الجسم قبل حل الأرجل ---
    const group = this.rig.group;
    group.updateMatrixWorld(true);
    this._invGroup.copy(group.matrixWorld).invert();
    group.getWorldQuaternion(this._groupQ);
    this._invGroupQ.copy(this._groupQ).invert();

    for (const id of LEG_IDS) this._solveLeg(this.legs[id], footTargets[id]);
  }

  _horseSpaceQuat(obj, out) {
    obj.getWorldQuaternion(out);
    return out.premultiply(this._invGroupQ);
  }

  _solveLeg(leg, tgt) {
    const [vS, vE, vK, vF, vP] = this._v;
    const [b0, b1, b2, b3, b4] = leg.bones;
    // موضع الكتف/الورك في فضاء الحصان بعد انزلاق لوح الكتف
    const parentQ = this._horseSpaceQuat(leg.parent, new THREE.Quaternion());
    if (!leg.bindB0Pos) leg.bindB0Pos = b0.userData.bindPos.clone();
    const slideLocal = new THREE.Vector3(tgt.slide || 0, -Math.abs(tgt.slide || 0) * 0.25, 0).applyQuaternion(parentQ.clone().invert());
    b0.position.copy(leg.bindB0Pos).add(slideLocal);
    b0.updateMatrixWorld(false);
    vS.setFromMatrixPosition(b0.matrixWorld).applyMatrix4(this._invGroup);

    // الحافر والحافر
    vP.set(tgt.x, tgt.y, leg.z);
    const past = leg.pastern.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), tgt.flex);
    vF.copy(vP).add(past);

    // عظمة الكتف/الفخذ: تتبع اتجاه الرجل نحو الهدف جزئيًا
    const bindUp = leg.bindUpper.clone().applyQuaternion(parentQ);
    const bindLeg = leg.bindFootFromShoulder.clone().applyQuaternion(parentQ);
    const toF = vF.clone().sub(vS);
    const dAng = Math.atan2(toF.y, toF.x) - Math.atan2(bindLeg.y, bindLeg.x);
    const k = leg.front ? 0.85 : 0.7;
    const upper = bindUp.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), dAng * k);
    vE.copy(vS).add(upper);

    // حل ثنائي العظام من المرفق إلى الحافر
    const a = leg.lenA, b = leg.lenB;
    const dv = vF.clone().sub(vE);
    let d = dv.length();
    const dir = dv.clone().divideScalar(d || 1);
    const dMax = a + b - 0.002, dMin = Math.abs(a - b) + 0.05;
    if (d > dMax) {
      // إن لم تصل الرجل نرفع الحافر عموديًا فقط (بلا انزلاق أفقي ولا اختراق للأرض)
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
    const perp = new THREE.Vector3(-dir.y, dir.x, 0); // اتجاه للأمام عندما تكون الرجل عمودية
    const bendSign = leg.front ? 1 : -1;
    vK.copy(vE).addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA * bendSign);

    // ضبط اتجاهات العظام
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
    // الأطوال ثابتة، لكن نصحح مواضع العظام الفرعية لضمان الدقة
    b1.position.set(0, leg.lenUpper, 0);
    b2.position.set(0, a, 0);
    b3.position.set(0, b, 0);
    this.legState[leg.id].foot.copy(vP);
    void TMP_M;
  }

  // موضع منتصف ظهر الحصان خلف السنام (لتثبيت الراكب الآلي)
  static saddleLocal() {
    return new THREE.Vector3(-0.42 - SPINE_JOINTS.spine[0], 0.28, 0);
  }
}
