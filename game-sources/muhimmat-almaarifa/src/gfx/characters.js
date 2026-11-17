// شخصيات اللاعب: ثلاثة أزياء للمقاتل (نموذج جاهز بألوان مختلفة) وطالب خليجي بالثوب والغترة والعقال.
// الطالب شخصية أصلية مبنية بالشيفرة على هيكل عظمي جاهز (الهيكل والحركة نفسيهما)، بأسلوب مبسّط لا ادّعاء فيه للواقعية التامة.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const CHARACTERS = [
  { id: 'ranger-desert', name: 'مقاتل الصحراء', kind: 'vanguard', tint: 0xffffff },
  { id: 'ranger-forest', name: 'مقاتل الغابة', kind: 'vanguard', tint: 0x93ad74 },
  { id: 'ranger-night', name: 'مقاتل الظل', kind: 'vanguard', tint: 0x6b7480 },
  { id: 'student', name: 'الطالب الخليجي', kind: 'student', scale: 0.9 }
];
export const characterById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];

/** نسخة مستقلة من الهيكل العظمي للنموذج في وضعية T. */
export function makeRig(gltf) {
  const root = cloneSkinned(gltf.scene);
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  const body = meshes.find(m => !/visor/i.test(m.name)) || meshes[0];
  const bones = body.skeleton.bones, byName = {}, index = {};
  // byName يشمل عُقد الأطراف (نهايات الأصابع والرأس) التي ليست عظامًا مؤثرة لكن نحتاج مواضعها
  root.traverse(o => { if (o.name && o.name.startsWith('mixamorig')) byName[o.name.replace('mixamorig', '')] = o; });
  bones.forEach((b, i) => { index[b.name.replace('mixamorig', '')] = i; });
  return { root, meshes, body, bones, byName, index };
}

// ---------- باني هندسة مربوطة بالعظام ----------
class SkinGeo {
  constructor(index) { this.index = index; this.p = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; this.seams = []; }

  v(pos, uv, w) {
    const n = this.p.length / 3;
    this.p.push(pos.x, pos.y, pos.z); this.uv.push(uv[0], uv[1]);
    const e = Object.entries(w).slice(0, 4), sum = e.reduce((a, x) => a + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) { this.si.push(e[k] ? this.index[e[k][0]] : 0); this.sw.push(e[k] ? e[k][1] / sum : 0); }
    return n;
  }

  /**
   * سطح ممدود بين حلقات. كل حلقة: { c مركز، a و b نصفا القطر (متجهان)، w أوزان العظام، arc اختياري [زاوية البداية، النهاية]، k(زاوية) اختياري لتمويج القماش }.
   */
  loft(rings, segs, o = {}) {
    const cols = segs + 1, start = this.p.length / 3, uS = o.uScale || 1, vS = o.vScale || 1;
    let vAcc = 0;
    rings.forEach((r, ri) => {
      if (ri) vAcc += r.c.distanceTo(rings[ri - 1].c) + 0.0001;
      const arc = r.arc || o.arc || [0, Math.PI * 2];
      for (let s = 0; s < cols; s++) {
        const t = s / segs, ang = arc[0] + (arc[1] - arc[0]) * t, k = r.k ? r.k(ang) : 1;
        this.v(r.c.clone().addScaledVector(r.a, Math.cos(ang) * k).addScaledVector(r.b, Math.sin(ang) * k), [t * uS, vAcc * vS], r.w);
      }
      if (!r.arc && !o.arc) this.seams.push([start + ri * cols, start + ri * cols + segs]);
    });
    // اتجاه الأوجه إلى الخارج مهما كان ترتيب الحلقات
    const dir = rings[1].c.clone().sub(rings[0].c);
    if (dir.lengthSq() < 1e-9 && rings[2]) dir.copy(rings[2].c).sub(rings[0].c);
    const flip = new THREE.Vector3().crossVectors(rings[0].a, rings[0].b).dot(dir) < 0;
    for (let ri = 0; ri < rings.length - 1; ri++) for (let s = 0; s < segs; s++) {
      const A = start + ri * cols + s, B = A + 1, D = start + (ri + 1) * cols + s, C = D + 1;
      if (flip) this.idx.push(A, C, B, A, D, C); else this.idx.push(A, B, C, A, C, D);
    }
    for (const [end, on] of [[0, o.capStart], [rings.length - 1, o.capEnd]]) {
      if (!on) continue;
      const r = rings[end], c = this.v(r.c, [0.5, 0], r.w), base = start + end * cols, rev = (end === 0) !== flip;
      for (let s = 0; s < segs; s++) { if (rev) this.idx.push(c, base + s + 1, base + s); else this.idx.push(c, base + s, base + s + 1); }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    const n = g.attributes.normal;       // توحيد الإضاءة عند درزة الالتفاف
    for (const [i, j] of this.seams) {
      const x = n.getX(i) + n.getX(j), y = n.getY(i) + n.getY(j), z = n.getZ(i) + n.getZ(j), l = Math.hypot(x, y, z) || 1;
      n.setXYZ(i, x / l, y / l, z / l); n.setXYZ(j, x / l, y / l, z / l);
    }
    return g;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function basis(d, r1, r2 = r1) {       // نصفا قطر متعامدان على الاتجاه d
  const ref = Math.abs(d.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
  const a = new THREE.Vector3().crossVectors(d, ref).normalize(), b = new THREE.Vector3().crossVectors(d, a).normalize();
  return { a: a.multiplyScalar(r1), b: b.multiplyScalar(r2) };
}

function faceTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const X = x => (0.5 + x / 0.22) * S, Y = y => (0.5 - y / 0.28) * S, L = m => m / 0.22 * S;
  const grd = g.createRadialGradient(X(0), Y(0.0), 20, X(0), Y(-0.01), 300);
  grd.addColorStop(0, '#d39b74'); grd.addColorStop(0.6, '#c68d68'); grd.addColorStop(1, '#a8734f');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  // شعر داكن عند أعلى الجبهة والسالفين (يظهر إن انكشف شيء تحت الغترة)
  g.fillStyle = '#1d140f'; g.fillRect(0, 0, S, Y(0.088));
  g.fillRect(0, 0, X(-0.08), S); g.fillRect(X(0.08), 0, S, S);
  // تورّد خفيف وظل تحت الحاجبين
  for (const sx of [-1, 1]) {
    let r = g.createRadialGradient(X(sx * 0.045), Y(-0.03), 2, X(sx * 0.045), Y(-0.03), L(0.03));
    r.addColorStop(0, 'rgba(190,105,85,0.28)'); r.addColorStop(1, 'rgba(190,105,85,0)'); g.fillStyle = r; g.fillRect(0, 0, S, S);
    r = g.createRadialGradient(X(sx * 0.033), Y(0.024), 2, X(sx * 0.033), Y(0.024), L(0.026));
    r.addColorStop(0, 'rgba(90,50,30,0.3)'); r.addColorStop(1, 'rgba(90,50,30,0)'); g.fillStyle = r; g.fillRect(0, 0, S, S);
  }
  for (const sx of [-1, 1]) {
    const ex = X(sx * 0.033), ey = Y(0.017);
    g.fillStyle = '#f6f1ea'; g.beginPath(); g.ellipse(ex, ey, L(0.0135), L(0.0068), 0, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.ellipse(ex, ey, L(0.0135), L(0.0068), 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#3d2413'; g.beginPath(); g.arc(ex, ey - 1, L(0.0066), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0c0705'; g.beginPath(); g.arc(ex, ey - 1, L(0.003), 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(ex - 4, ey - 5, 2.6, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = '#22140d'; g.lineWidth = 4.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ex - L(0.0145), ey + 1); g.quadraticCurveTo(ex, ey - L(0.0105), ex + L(0.0145), ey + 1); g.stroke();
    g.strokeStyle = 'rgba(70,40,25,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ex - L(0.012), ey + L(0.006)); g.quadraticCurveTo(ex, ey + L(0.0085), ex + L(0.012), ey + L(0.006)); g.stroke();
    // الحاجب
    g.strokeStyle = '#1f130d'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(X(sx * 0.014), Y(0.037)); g.quadraticCurveTo(X(sx * 0.034), Y(0.044), X(sx * 0.052), Y(0.036)); g.stroke();
    // فتحة الأنف
    g.fillStyle = 'rgba(70,35,22,0.55)'; g.beginPath(); g.ellipse(X(sx * 0.0075), Y(-0.031), L(0.0038), L(0.0022), sx * 0.4, 0, Math.PI * 2); g.fill();
  }
  // الفم: ابتسامة هادئة
  g.strokeStyle = '#7d4034'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(X(-0.021), Y(-0.056)); g.quadraticCurveTo(X(0), Y(-0.064), X(0.021), Y(-0.056)); g.stroke();
  g.strokeStyle = 'rgba(165,95,80,0.6)'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(X(-0.013), Y(-0.0655)); g.quadraticCurveTo(X(0), Y(-0.071), X(0.013), Y(-0.0655)); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

let studentMats = null;
function studentMaterials(assets) {
  if (studentMats) return studentMats;
  const fabric = assets.tex('fabric_normal');
  const cloth = o => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, normalMap: fabric, normalScale: new THREE.Vector2(0.28, 0.28), side: THREE.DoubleSide, ...o });
  studentMats = {
    thobe: cloth({ color: 0xf1efe7 }), ghutra: cloth({ color: 0xfbfaf6 }), trim: cloth({ color: 0xcfcabd }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc68d68, roughness: 0.62, metalness: 0 }),
    face: new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.6, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.75, metalness: 0 }),
    shoe: new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.7, metalness: 0 })
  };
  return studentMats;
}

/**
 * يبني أجزاء الطالب الخليجي ويربطها بهيكل rig. armsOnly: الكُمّان واليدان فقط (لمنظور الشخص الأول).
 * يعيد مصفوفة SkinnedMesh مضافة إلى rig.root.
 */
export function buildStudent(rig, assets, armsOnly = false) {
  const M = studentMaterials(assets);
  // بعض عُقد الأطراف (مثل آخر مفصل في الخنصر) ليست عظامًا مؤثرة في النموذج: نربط رؤوسها بأقرب عظمة أب مؤثرة
  const I = new Proxy(rig.index, { get: (t, k) => { let o = rig.byName[k]; while (o && t[o.name.replace('mixamorig', '')] === undefined) o = o.parent; return o ? t[o.name.replace('mixamorig', '')] : 0; } });
  const P = n => rig.byName[n].getWorldPosition(new THREE.Vector3());
  const cloth = new SkinGeo(I), skin = new SkinGeo(I);
  const X = V(1, 0, 0), Yv = V(0, 1, 0), Z = V(0, 0, 1);

  for (const S of ['Left', 'Right']) {
    const sh = P(S + 'Arm'), el = P(S + 'ForeArm'), wr = P(S + 'Hand'), d = wr.clone().sub(sh).normalize();
    // الكُمّ: واسع عند الكتف ويضيق قليلًا عند الرسغ
    const slim = armsOnly ? 0.66 : 1;      // في منظور الشخص الأول الكُمّ قريب جدًا من الكاميرا فيُضيَّق حتى لا يحجب الأهداف
    const ring = (p, r, w) => ({ c: p, a: Yv.clone().multiplyScalar(r * slim), b: Z.clone().multiplyScalar(r * slim), w });
    const at = (a, b, t) => a.clone().lerp(b, t);
    // في منظور الشخص الأول يبدأ الكُمّ من منتصف العضد ويتبع عظام الذراع وحدها (عظام الجسم ليست في موضعها هناك)
    const upper = armsOnly ? [ring(at(sh, el, 0.3), 0.08, { [S + 'Arm']: 1 })]
      : [ring(sh.clone().addScaledVector(d, -0.05), 0.088, { Spine2: 0.6, [S + 'Arm']: 0.4 }), ring(at(sh, el, 0.14), 0.083, { [S + 'Arm']: 1 })];
    cloth.loft([
      ...upper,
      ring(at(sh, el, 0.6), 0.074, { [S + 'Arm']: 1 }),
      ring(el.clone(), 0.068, { [S + 'Arm']: 0.5, [S + 'ForeArm']: 0.5 }),
      ring(at(el, wr, 0.5), 0.061, { [S + 'ForeArm']: 1 }),
      ring(at(el, wr, 0.93), 0.056, { [S + 'ForeArm']: 1 }),
      ring(at(el, wr, 0.96), 0.05, { [S + 'ForeArm']: 1 })
    ], 16, { uScale: 3, vScale: 9 });
    // الرسغ وراحة اليد
    const k1 = ['Index', 'Middle', 'Ring', 'Pinky'].map(f => P(`${S}Hand${f}1`));
    const K = k1.reduce((a, p) => a.add(p), V(0, 0, 0)).multiplyScalar(0.25), hd = K.clone().sub(wr).normalize();
    const palm = (p, hw, ht, w) => ({ c: p, a: Z.clone().multiplyScalar(hw), b: Yv.clone().multiplyScalar(ht), w });
    skin.loft([
      palm(at(el, wr, 0.8), 0.026, 0.023, { [S + 'ForeArm']: 1 }),
      palm(wr.clone(), 0.029, 0.02, { [S + 'ForeArm']: 0.5, [S + 'Hand']: 0.5 }),
      palm(at(wr, K, 0.5), 0.042, 0.017, { [S + 'Hand']: 1 }),
      palm(K.clone(), 0.046, 0.014, { [S + 'Hand']: 1 }),
      palm(K.clone().addScaledVector(hd, 0.012), 0.04, 0.008, { [S + 'Hand']: 1 })
    ], 14, { capEnd: true });
    // الأصابع: سطح واحد لكل إصبع ينثني عند المفاصل
    for (const [F, R] of [['Thumb', 0.0125], ['Index', 0.0105], ['Middle', 0.0108], ['Ring', 0.0102], ['Pinky', 0.009]]) {
      const j = [1, 2, 3, 4].map(n => P(`${S}Hand${F}${n}`)), b = n => `${S}Hand${F}${n}`;
      const fr = (p, dir, r, w) => ({ c: p, ...basis(dir, r), w });
      const d1 = j[1].clone().sub(j[0]).normalize(), d2 = j[2].clone().sub(j[1]).normalize(), d3 = j[3].clone().sub(j[2]).normalize();
      skin.loft([
        fr(j[0].clone().addScaledVector(d1, -0.012), d1, R * 1.05, { [S + 'Hand']: 0.5, [b(1)]: 0.5 }),
        fr(j[0], d1, R * 1.05, { [b(1)]: 1 }),
        fr(j[1], d1.clone().add(d2).normalize(), R, { [b(1)]: 0.5, [b(2)]: 0.5 }),
        fr(j[2], d2.clone().add(d3).normalize(), R * 0.92, { [b(2)]: 0.5, [b(3)]: 0.5 }),
        fr(at(j[2], j[3], 0.8), d3, R * 0.82, { [b(3)]: 1 }),
        fr(j[3], d3, R * 0.5, { [b(3)]: 1 })
      ], 8, { capEnd: true });
    }
  }

  const parts = [];
  const skel = new THREE.Skeleton(rig.bones);
  const add = (geo, mat) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.bind(skel, new THREE.Matrix4()); m.frustumCulled = false; m.castShadow = !armsOnly; m.receiveShadow = !armsOnly;
    rig.root.add(m); parts.push(m); return m;
  };

  if (!armsOnly) {
    const hips = P('Hips'), sp2 = P('Spine2'), neck = P('Neck'), head = P('Head'), top = P('HeadTop_End'), shY = P('RightArm').y, shX = Math.abs(P('RightArm').x);
    const cz = y => THREE.MathUtils.lerp(hips.z, neck.z, THREE.MathUtils.clamp((y - hips.y) / (neck.y - hips.y), 0, 1));
    const body = (y, rx, rz, w) => ({ c: V(0, y, cz(y)), a: Z.clone().multiplyScalar(rz), b: X.clone().multiplyScalar(rx), w });
    // الثوب: من الحاشية فوق الكاحل إلى الياقة
    cloth.loft([
      body(0.1, 0.218, 0.162, { Hips: 1 }), body(0.45, 0.205, 0.152, { Hips: 1 }), body(hips.y - 0.06, 0.192, 0.14, { Hips: 1 }),
      body(hips.y + 0.12, 0.176, 0.126, { Hips: 0.5, Spine: 0.5 }), body(sp2.y - 0.07, 0.196, 0.134, { Spine1: 0.5, Spine2: 0.5 }),
      body(shY - 0.04, shX + 0.012, 0.124, { Spine2: 1 }), body(shY + 0.03, 0.155, 0.104, { Spine2: 1 }),
      body(neck.y + 0.012, 0.068, 0.066, { Spine2: 0.4, Neck: 0.6 }), body(neck.y + 0.05, 0.06, 0.06, { Neck: 1 })
    ], 28, { uScale: 8, vScale: 9, capStart: true });
    // صفّ الأزرار والجيب (تفاصيل الثوب)
    const front = y => cz(y) - (y > sp2.y - 0.07 ? 0.128 : 0.132);
    const detail = new SkinGeo(I);
    for (const y of [shY - 0.01, shY - 0.075, shY - 0.14]) detail.loft([{ c: V(0, y, front(y) - 0.004), a: X.clone().multiplyScalar(0.007), b: Yv.clone().multiplyScalar(0.007), w: { Spine2: 1 } }, { c: V(0, y, front(y) - 0.011), a: X.clone().multiplyScalar(0.005), b: Yv.clone().multiplyScalar(0.005), w: { Spine2: 1 } }], 8, { capEnd: true });
    // الحذاءان
    const shoes = new SkinGeo(I);
    for (const S of ['Left', 'Right']) {
      const f = P(S + 'Foot'), t = P(S + 'ToeBase'), e = rig.byName[S + 'Toe_End'] ? P(S + 'Toe_End') : t.clone().add(V(0, 0, -0.08));
      const sr = (z, hw, hh, w) => ({ c: V(f.x, hh, z), a: X.clone().multiplyScalar(hw), b: Yv.clone().multiplyScalar(hh), w });
      shoes.loft([sr(f.z + 0.075, 0.03, 0.03, { [S + 'Foot']: 1 }), sr(f.z + 0.05, 0.047, 0.045, { [S + 'Foot']: 1 }), sr(f.z - 0.03, 0.052, 0.05, { [S + 'Foot']: 1 }),
        sr(t.z, 0.054, 0.036, { [S + 'Foot']: 0.5, [S + 'ToeBase']: 0.5 }), sr(e.z + 0.012, 0.046, 0.028, { [S + 'ToeBase']: 1 }), sr(e.z - 0.02, 0.02, 0.016, { [S + 'ToeBase']: 1 })], 10, { capStart: true, capEnd: true });
    }
    // الرقبة والرأس
    const cy = (head.y + top.y) / 2 + 0.004, hz = head.z - 0.012, RX = 0.086, RY = (top.y - head.y) / 2 + 0.002, RZ = 0.1;
    skin.loft([{ c: V(0, neck.y - 0.01, neck.z), a: Z.clone().multiplyScalar(0.05), b: X.clone().multiplyScalar(0.05), w: { Neck: 1 } }, { c: V(0, cy - RY * 0.72, hz + 0.012), a: Z.clone().multiplyScalar(0.047), b: X.clone().multiplyScalar(0.047), w: { Neck: 0.4, Head: 0.6 } }], 14);
    const hg = new SkinGeo(I), LON = 48, LAT = 34;
    for (let la = 0; la <= LAT; la++) for (let lo = 0; lo <= LON; lo++) {
      const phi = la / LAT * Math.PI, th = lo / LON * Math.PI * 2, yn = Math.cos(phi);
      let x = Math.sin(phi) * Math.sin(th) * RX, y = yn * RY, z = -Math.sin(phi) * Math.cos(th) * RZ;
      if (yn < -0.1) { const t = Math.pow((-yn - 0.1) / 0.9, 1.4); x *= 1 - 0.36 * t; z *= 1 - 0.14 * t; }      // الفك
      if (z < 0) {
        z *= 0.94;
        const G = (cx, cy2, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy2) / sy) ** 2));
        z -= 0.02 * G(0, -0.02, 0.013, 0.02) + 0.007 * G(0, 0.004, 0.009, 0.03);                                  // الأنف
        z += 0.0055 * (G(0.033, 0.017, 0.017, 0.012) + G(-0.033, 0.017, 0.017, 0.012));                           // محجرا العينين
        z -= 0.004 * G(0, -0.06, 0.024, 0.009) + 0.007 * G(0, -0.105, 0.022, 0.02);                               // الشفتان والذقن
      }
      hg.v(V(x, cy + y, hz + z), [THREE.MathUtils.clamp(0.5 + x / 0.22, 0, 1), THREE.MathUtils.clamp(0.5 + y / 0.28, 0, 1)], { Head: 1 });
    }
    for (let la = 0; la < LAT; la++) for (let lo = 0; lo < LON; lo++) {
      const A = la * (LON + 1) + lo, B = A + 1, D = A + LON + 1, C = D + 1;
      hg.idx.push(A, C, D, A, B, C);
    }
    for (let la = 0; la <= LAT; la++) hg.seams.push([la * (LON + 1), la * (LON + 1) + LON]);
    // الغترة: قبّة فوق الرأس ثم قماش منسدل على الكتفين مع فتحة للوجه، والعقال حلقتان سوداوان
    const gh = new SkinGeo(I), back = Z.clone(), side = X.clone();
    const g = (dy, rx, rz, open, w, fold = 0) => ({ c: V(0, cy + dy, hz + 0.008), a: back.clone().multiplyScalar(rz), b: side.clone().multiplyScalar(rx), w,
      arc: [-(Math.PI - open), Math.PI - open], k: fold ? a => 1 + fold * Math.sin(a * 9) : null });
    gh.loft([
      g(RY + 0.012, 0.012, 0.012, 0, { Head: 1 }), g(RY - 0.004, 0.062, 0.068, 0, { Head: 1 }), g(0.088, 0.094, 0.108, 0, { Head: 1 }), g(0.058, 0.099, 0.116, 0, { Head: 1 }),
      g(0.045, 0.101, 0.116, 0.62, { Head: 1 }), g(0.0, 0.103, 0.114, 0.93, { Head: 1 }), g(-0.06, 0.105, 0.112, 0.9, { Head: 1 }),
      g(-0.115, 0.113, 0.118, 0.8, { Head: 0.6, Neck: 0.4 }, 0.012), g(-0.185, 0.165, 0.138, 0.7, { Neck: 0.4, Spine2: 0.6 }, 0.022),
      g(-0.27, 0.212, 0.156, 0.62, { Spine2: 1 }, 0.03), g(-0.41, 0.205, 0.152, 0.55, { Spine2: 1 }, 0.04)
    ], 40, { uScale: 9, vScale: 9 });
    const agal = new SkinGeo(I);
    for (const [dy, rx, rz] of [[0.086, 0.096, 0.11], [0.066, 0.1, 0.116]]) {
      const rings = [];
      for (let s = 0; s <= 28; s++) {
        const a = s / 28 * Math.PI * 2, out = V(Math.sin(a), 0, Math.cos(a));
        rings.push({ c: V(Math.sin(a) * rx, cy + dy, hz + 0.008 + Math.cos(a) * rz), a: out.clone().multiplyScalar(0.0088), b: Yv.clone().multiplyScalar(0.0088), w: { Head: 1 } });
      }
      agal.loft(rings, 8);
    }
    add(hg.build(), M.face); add(gh.build(), M.ghutra); add(agal.build(), M.dark); add(detail.build(), M.trim); add(shoes.build(), M.shoe);
  }
  add(cloth.build(), M.thobe); add(skin.build(), M.skin);
  return parts;
}

/** الشخصية الكاملة للشاشات (بداية / نهاية) بحركة وقوف هادئة. */
export class Character {
  constructor(scene, assets) {
    this.scene = scene; this.assets = assets; this.ok = !!assets.models.soldier; this.root = null; this.mixer = null; this.pose = null;
  }

  set(def) {
    if (!this.ok || (this.def && this.def.id === def.id)) return;
    const shown = this.root && this.root.visible ? this.pose : null;
    this.dispose();
    this.def = def;
    const gltf = this.assets.models.soldier, rig = makeRig(gltf);
    if (def.kind === 'student') {
      rig.meshes.forEach(m => { m.visible = false; });
      this.parts = buildStudent(rig, this.assets);
    } else {
      this.parts = [];
      rig.meshes.forEach(o => {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); this.parts.push(o);
        if (!/visor/i.test(o.name)) { o.material.metalness = 0.12; o.material.roughness = 0.62; o.material.color.set(def.tint); }
      });
    }
    this.root = rig.root; this.root.scale.setScalar(def.scale || 1);
    this.mixer = new THREE.AnimationMixer(this.root);
    const idle = gltf.animations.find(a => a.name === 'Idle') || gltf.animations[0];
    if (idle) this.mixer.clipAction(idle).play();
    this.root.visible = false; this.scene.add(this.root);
    if (shown) this.show(...shown);
  }

  dispose() {
    if (!this.root) return;
    this.scene.remove(this.root);
    if (this.def && this.def.kind === 'student') this.parts.forEach(m => m.geometry.dispose()); else this.parts.forEach(m => m.material.dispose());
    this.root = null; this.mixer = null;
  }

  show(x, z, facing) { if (!this.root) return; this.pose = [x, z, facing]; this.root.position.set(x, 0, z); this.root.rotation.y = facing; this.root.visible = true; }
  hide() { if (this.root) this.root.visible = false; }
  update(dt) { if (this.root && this.root.visible && this.mixer) this.mixer.update(dt); }
}
