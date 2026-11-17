import * as THREE from 'three';
import { LEGS, SPINE_JOINTS, FOOT_SOLE, TAIL_CHAIN, TAIL_DOCK_SEGMENTS } from './horseAnatomy.js';
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

// منحنى Catmull-Rom عبر نقاط مفتاحية [q, قيمة...] (q تصاعدي من 0 إلى 1)
function keyCurve(keys, q, out) {
  let i = 1;
  while (i < keys.length - 1 && q > keys[i][0]) i++;
  const k0 = keys[Math.max(0, i - 2)], k1 = keys[i - 1], k2 = keys[i], k3 = keys[Math.min(keys.length - 1, i + 1)];
  const t = (q - k1[0]) / Math.max(1e-6, k2[0] - k1[0]);
  const t2 = t * t, t3 = t2 * t;
  for (let c = 1; c < k1.length; c++) {
    const p0 = k0[c], p1 = k1[c], p2 = k2[c], p3 = k3[c];
    out[c - 1] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  return out;
}

// مسار الحافر أثناء الأرجحة (مرجعه فيديوهات عدو خيل السباق بالحركة البطيئة).
// القيم: [q, x نسبةً لمسار الارتكاز (-1 نهاية الارتكاز خلفًا، +1 بدايته أمامًا) + إزاحة بالأمتار, ارتفاع (م), زاوية الرسغ/الحافر]
// الأمامية: بعد الدفع ينثني الرسغ بقوة فيرتفع الحافر للخلف نحو الساعد، تُحمل الرجل مطوية تحت الصدر،
// ثم تنبسط وتمتد بعيدًا للأمام (المدّ) وتتراجع قليلًا قبل أن تلمس الأرض (مطابقة سرعة الأرض).
const FORE_SWING = [
  [0.00, -1.0, 0.00, 0.00, -0.35],
  [0.16, -1.0, -0.10, 0.27, -1.45],
  [0.36, -0.35, -0.05, 0.47, -1.75],
  [0.58, 0.25, 0.10, 0.44, -1.05],
  [0.80, 1.0, 0.30, 0.20, -0.05],
  [0.93, 1.0, 0.12, 0.06, 0.12],
  [1.00, 1.0, 0.00, 0.00, 0.10],
];
// الخلفية: ترتفع خلفًا بعد الدفع مع انثناء العرقوب، تتأرجح للأمام تحت البطن، وتمتد قبل الهبوط.
const HIND_SWING = [
  [0.00, -1.0, 0.00, 0.00, -0.30],
  [0.18, -1.0, -0.06, 0.2, -0.95],
  [0.42, -0.3, 0.00, 0.34, -1.05],
  [0.66, 0.4, 0.08, 0.25, -0.5],
  [0.86, 1.0, 0.16, 0.10, 0.0],
  [1.00, 1.0, 0.00, 0.00, 0.08],
];
const KEY_OUT = [0, 0, 0, 0];

// محاكاة الذيل
const TAIL_N = TAIL_CHAIN.length;
const TAIL_SUB = 1 / 240;
const GRAVITY = new THREE.Vector3(0, -9.8, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

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
    this.strideLen = S;
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
      const baseX = leg.neutralX + (leg.front ? 0.06 : -0.02) * g;
      const amp = Math.min(1, S / 5.2); // مدى الحركة يكبر مع طول الخطوة
      if (p < D) {
        stance = true;
        const s = p / D;
        x = baseX + A - 2 * A * s;
        y = FOOT_SOLE;
        const load = Math.sin(Math.PI * s);
        if (leg.front) frontLoad += load; else hindLoad += load;
        // تحت الحمل تنخفض الرمانة (فرط بسط طبيعي في العدو)، ثم ينقلب الحافر على مقدمته عند الدفع
        flex = (leg.front ? 0.42 : 0.32) * load * amp + 0.1 * (1 - smoothstep(0, 0.2, s)) - 0.45 * smoothstep(0.78, 1, s);
      } else {
        stance = false;
        const q = (p - D) / (1 - D);
        const k = keyCurve(leg.front ? FORE_SWING : HIND_SWING, q, KEY_OUT);
        x = baseX + A * k[0] + k[1] * amp;
        y = FOOT_SOLE + k[2] * amp;
        flex = k[3] * (0.55 + 0.45 * amp);
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

    // --- مرونة الظهر: ينثني القطَن عند تقدم الخلفيتين تحت البطن وينبسط عند الدفع ---
    const pelvis = this.b.pelvis;
    const flexPh = Math.cos(2 * Math.PI * (this.phase - 0.93));
    pelvis.quaternion.copy(pelvis.userData.bindQuat).multiply(TMP_Q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), g * 0.075 * flexPh * (1 - (this.jumpLean || 0) * 0.5)));

    // --- الرقبة والرأس: تضخّ الرقبة مع الخطوة (تنخفض أثناء ارتكاز الأماميتين وترتفع في الطيران) ---
    const foreMid = (GALLOP_OFFSETS.FL + GALLOP_OFFSETS.FR) / 2 + D / 2;
    const neckSwing = frozen ? 0 : -Math.cos(2 * Math.PI * (this.phase - foreMid)) * 0.065 * g * (1 - (this.jumpLean || 0));
    const neckTilt = g * (0.16 + this.boost * 0.06) + this.jumpLean * 0.22; // في الوقوف تُحمل الرقبة أخفض قليلًا (وضعية مسترخية) // الرقبة تمتد للأمام أثناء العدو وفوق الحاجز
    const breathNeck = Math.sin(this.time * 1.3 + this.neckPhase) * 0.01;
    const neckBones = BONE_NAMES.neck.map((n) => this.b[n]);
    let accum = -this.pitch;
    for (let i = 0; i < neckBones.length; i++) {
      const nb = neckBones[i];
      const a = (i < 2 ? -neckTilt * 0.5 : neckTilt * 0.35) - (i < 3 ? (1 - g) * 0.075 : 0) + this.pitch * 0.35 + neckSwing * (i === 0 ? 1.0 : i === 1 ? 0.7 : 0.35) + breathNeck;
      nb.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
      accum += a;
    }
    // تثبيت الرأس: يعوّض معظم دوران ما فوقه
    const head = this.b.head;
    const headTarget = -0.04 * g + Math.sin(this.time * 0.9 + this.neckPhase) * 0.02;
    head.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), headTarget - accum * 0.75);

    // --- تحديث مصفوفات الجسم قبل حل الأرجل ---
    const group = this.rig.group;
    group.updateMatrixWorld(true);
    this._invGroup.copy(group.matrixWorld).invert();
    group.getWorldQuaternion(this._groupQ);
    this._invGroupQ.copy(this._groupQ).invert();

    for (const id of LEG_IDS) this._solveLeg(this.legs[id], footTargets[id]);
    this._updateTail(dt, frozen, speed);
    // رفرفة أطراف الشعر الدقيقة
    for (const m of this.rig.hairMaterials || []) {
      const hu = m.userData.uniforms;
      hu.uTime.value = this.time; hu.uFlutter.value = 0.25 + Math.min(1, speed / 12) * 1.1;
    }
  }

  // ---- الذيل: سلسلة Verlet في فضاء العالم ----
  // النقطة 0 مثبتة بالحوض. عظم الذيل (0..3) شبه صلب يتبع وضعية «الذيل المرفوع» أثناء العدو مع تأخر بسيط،
  // والشعر (3..9) حر تحت الجاذبية ومقاومة الهواء (الهواء ساكن؛ فالحصان المسرع يدفع الشعر للخلف)
  // مع اضطراب خفيف، وقيود أطوال وانحناء، ومنع اختراق الأرض والكفل والأرجل الخلفية.
  _initTail() {
    const n = TAIL_N;
    this.tail = {
      p: [], prev: [], len: [], bindDir: [], bindQ: [],
      bones: [], pelvisAnchor: null, restLocalDir: [],
      tmp: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      acc: 0, lift: 0,
    };
    const T = this.tail;
    const pts = TAIL_CHAIN.map((a) => new THREE.Vector3(a[0], a[1], a[2] || 0));
    for (let i = 0; i < n; i++) { T.p.push(new THREE.Vector3()); T.prev.push(new THREE.Vector3()); }
    for (let i = 0; i < n - 1; i++) {
      T.len.push(pts[i].distanceTo(pts[i + 1]));
      T.restLocalDir.push(pts[i + 1].clone().sub(pts[i]).normalize());
      const bone = this.b[BONE_NAMES.tail[i]];
      T.bones.push(bone);
      T.bindDir.push(T.restLocalDir[i].clone());
      T.bindQ.push(bone.userData.bindQuat.clone());
    }
    // نقطة التثبيت في فضاء الحوض (عظمة الحوض بلا دوران في وضع الربط)
    const pel = this.b.pelvis;
    T.pelvisAnchor = pts[0].clone().sub(pel.userData.bindWorldPos);
    T.restPts = pts;
    T.reset = true;
  }

  _updateTail(dt, frozen, speed) {
    if (!this.tail) this._initTail();
    const T = this.tail;
    // أثناء السؤال يتجمد السباق كله في منتصف الخطوة: يتجمد الذيل معه (لا يسقط بالجاذبية).
    // أما الحصان الواقف (قبل الانطلاق) فيتدلى ذيله ويتأرجح طبيعيًا.
    if (frozen && this.gaitWeight > 0.3 && !T.reset) return;
    const group = this.rig.group;
    const pel = this.b.pelvis;
    pel.updateMatrixWorld(true);
    const gm = group.matrixWorld;
    const anchor = T.tmp[0].copy(T.pelvisAnchor).applyMatrix4(pel.matrixWorld);
    const pelQ = pel.getWorldQuaternion(new THREE.Quaternion());
    // رفع الذيل مع العدو: يرتفع المنبت ويُحمل الذيل بعيدًا عن الكفل
    const g = this.gaitWeight;
    const liftTarget = g * (0.42 + 0.14 * this.boost) + Math.sin(2 * Math.PI * (this.phase - 0.1)) * 0.06 * g + (this.jumpLean || 0) * 0.25;
    T.lift += (liftTarget - T.lift) * (1 - Math.exp(-dt * 4));

    // إعادة الضبط عند أول إطار أو بعد انتقال مفاجئ (إعادة السباق)
    if (T.reset || T.p[0].distanceTo(anchor) > 1.5) {
      for (let i = 0; i < TAIL_N; i++) {
        T.p[i].copy(T.restPts[i]).applyMatrix4(gm);
        T.prev[i].copy(T.p[i]);
      }
      T.reset = false;
    }
    const dirs = [];
    for (let j = 0; j < TAIL_DOCK_SEGMENTS; j++) {
      const lj = T.lift * (1 - j * 0.12);
      dirs.push(T.restLocalDir[j].clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -lj).applyQuaternion(pelQ));
    }
    const prevAnchor = T.tmp[1].copy(T.p[0]);
    const n = Math.min(12, Math.max(1, Math.ceil(dt / TAIL_SUB)));
    const h = dt / n;
    const drag = 0.95; // مقاومة الهواء لكل م/ث
    const t0 = this.time - dt;
    const side = new THREE.Vector3(0, 0, 1).transformDirection(gm);
    for (let it = 0; it < n; it++) {
      const tt = t0 + h * (it + 1);
      // النقطة 0 تتبع الحوض (استيفاء داخل الإطار)
      T.p[0].lerpVectors(prevAnchor, anchor, (it + 1) / n);
      T.prev[0].copy(T.p[0]);
      // تكامل Verlet
      for (let i = 1; i < TAIL_N; i++) {
        const p = T.p[i], q = T.prev[i];
        const vx = (p.x - q.x) / h, vy = (p.y - q.y) / h, vz = (p.z - q.z) / h;
        const tipK = i / (TAIL_N - 1);
        // اضطراب الهواء + تأرجح جانبي خفيف حتى في الوقوف (طرد الذباب)
        const gust = Math.sin(tt * 7.3 + i * 0.9) * 1.6 + Math.sin(tt * 3.1 - i * 0.5) * 1.1;
        const swish = frozen || g < 0.3 ? Math.sin(tt * 1.3 + this.neckPhase) * Math.max(0, Math.sin(tt * 0.37 + this.neckPhase)) * 2.2 : 0;
        const ax = -drag * vx, ay = GRAVITY.y - drag * vy + gust * 0.12 * tipK * g, az = -drag * vz;
        const lat = (gust * 0.6 * g + swish) * tipK;
        q.copy(p);
        p.x += vx * h * 0.995 + (ax + side.x * lat) * h * h;
        p.y += vy * h * 0.995 + (ay + side.y * lat) * h * h;
        p.z += vz * h * 0.995 + (az + side.z * lat) * h * h;
      }
      // عظم الذيل: يقترب بقوة من وضعيته المستهدفة (شبه صلب)
      for (let j = 0; j < TAIL_DOCK_SEGMENTS; j++) {
        const target = T.tmp[2].copy(T.p[j]).addScaledVector(dirs[j], T.len[j]);
        T.p[j + 1].lerp(target, 0.5);
      }
      // قيود الطول والانحناء
      for (let k = 0; k < 4; k++) {
        for (let i = 0; i < TAIL_N - 1; i++) {
          const a = T.p[i], b = T.p[i + 1];
          const d = T.tmp[2].subVectors(b, a);
          const L = d.length() || 1e-6;
          const diff = (L - T.len[i]) / L;
          if (i === 0) b.addScaledVector(d, -diff);
          else { a.addScaledVector(d, diff * 0.3); b.addScaledVector(d, -diff * 0.7); }
        }
        // صلابة انحناء خفيفة: المسافة بين i و i+2 لا تقل كثيرًا عن مجموع القطعتين
        for (let i = TAIL_DOCK_SEGMENTS - 1; i < TAIL_N - 2; i++) {
          const a = T.p[i], c = T.p[i + 2];
          const d = T.tmp[2].subVectors(c, a);
          const L = d.length() || 1e-6;
          const min = (T.len[i] + T.len[i + 1]) * 0.86;
          if (L < min) { const corr = (min - L) / L * 0.5; a.addScaledVector(d, -corr * 0.3); c.addScaledVector(d, corr * 0.7); }
        }
      }
      // تصادمات بسيطة في فضاء الحصان: الأرض، والكفل/الأرجل الخلفية (الشعر يبقى خلف الفخذين)
      for (let i = 2; i < TAIL_N; i++) {
        const p = T.p[i];
        const l = T.tmp[2].copy(p).applyMatrix4(this._invGroup);
        let changed = false;
        if (l.y < 0.06) { l.y = 0.06; changed = true; }
        if (l.y > 0.25 && l.y < 1.35 && l.x > -1.02 && Math.abs(l.z) < 0.28) { l.x = -1.02; changed = true; }
        if (changed) p.copy(l.applyMatrix4(gm));
      }
    }
    // وضع العظام في فضاء الحصان: كل عظمة عند نقطتها، ودورانها = (اتجاه الربط ← الاتجاه الحالي) × دوران الربط
    const inv = this._invGroup;
    const qd = new THREE.Quaternion();
    for (let j = 0; j < TAIL_N - 1; j++) {
      const a = T.tmp[0].copy(T.p[j]).applyMatrix4(inv);
      const b = T.tmp[1].copy(T.p[j + 1]).applyMatrix4(inv);
      const bone = T.bones[j];
      bone.position.copy(a);
      const dir = b.sub(a).normalize();
      qd.setFromUnitVectors(T.bindDir[j], dir);
      bone.quaternion.copy(qd).multiply(T.bindQ[j]);
    }
    void speed; void DOWN;
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
    // الفخذ ينثني للأمام (يتقدم الرضفة) عندما ترتفع الرجل الخلفية وتتقدم تحت البطن، كما في العدو الحقيقي؛
    // بدونه يُجبر الحل العرقوبَ على الارتداد بعيدًا للخلف فتصبح الساق أفقية ويتمطط الجلد.
    let extra = 0;
    if (!leg.front) {
      const lift = Math.max(0, tgt.y - FOOT_SOLE);
      const fwd = smoothstep(-0.45, 0.15, tgt.x - leg.neutralX);
      extra = Math.min(0.75, lift * 2.2) * fwd;
    }
    const upper = bindUp.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), dAng * k + extra);
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
