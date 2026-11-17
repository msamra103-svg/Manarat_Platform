import * as THREE from 'three';
import { SPINE_JOINTS, TAIL_CHAIN, TAIL_DOCK_SEGMENTS, LEGS } from './horseAnatomy.js';
import { sculptGeometry, sculptClothGeometry, makeFurMaterial, SCULPT_HEAD, MANE_ROWS } from './horseSculpt.js';
import { getCoatMaps, makeClothTexture } from '../scene/textures.js';
import { mergeStaticChildren } from '../core/merge.js';

// يبني حصان سباق مجهّزًا بهيكل عظمي (Skeleton) وشبكات مكسوّة (SkinnedMesh): الجسم المنحوت، العُرف، الذيل، قماش السرج، اللجام.

const V = (a) => new THREE.Vector3(a[0], a[1], a[2] ?? 0);
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const DOWN = new THREE.Vector3(0, -1, 0);

export const BONE_NAMES = {
  root: 'root', body: 'body', pelvis: 'pelvis', spine: 'spine', chest: 'chest',
  neck: ['neck0', 'neck1', 'neck2', 'neck3'], head: 'head',
  tail: TAIL_CHAIN.slice(0, -1).map((_, i) => `tail${i}`), // 0..2 عظم الذيل، 3..8 خصل الشعر
  leg: (id, i) => `leg_${id}_${i}`, // i: 0 كتف/ورك، 1 مرفق/ركبة، 2 رسغ/عرقوب، 3 حافر، 4 خف
};

const LEG_IDS = ['FL', 'FR', 'HL', 'HR'];


// ----- الهيكل العظمي -----
function buildSkeleton() {
  const bones = [];
  const byName = {};
  const make = (name, worldPos, parent, worldQuat = null) => {
    const b = new THREE.Bone();
    b.name = name;
    b.userData.bindWorldPos = worldPos.clone();
    b.userData.bindWorldQuat = worldQuat ? worldQuat.clone() : new THREE.Quaternion();
    if (parent) {
      // تحويل الموضع إلى فضاء الأب
      const pq = parent.userData.bindWorldQuat;
      const local = worldPos.clone().sub(parent.userData.bindWorldPos).applyQuaternion(pq.clone().invert());
      b.position.copy(local);
      b.quaternion.copy(pq.clone().invert().multiply(b.userData.bindWorldQuat));
      parent.add(b);
    } else {
      b.position.copy(worldPos);
      b.quaternion.copy(b.userData.bindWorldQuat);
    }
    bones.push(b);
    byName[name] = b;
    return b;
  };

  const root = make('root', new THREE.Vector3(0, 0, 0), null);
  const body = make('body', V(SPINE_JOINTS.body), root);
  const pelvis = make('pelvis', V(SPINE_JOINTS.pelvis), body);
  const spine = make('spine', V(SPINE_JOINTS.spine), body);
  const chest = make('chest', V(SPINE_JOINTS.chest), spine);
  let prev = chest;
  for (const n of BONE_NAMES.neck) prev = make(n, V(SPINE_JOINTS[n]), prev);
  make('head', V(SPINE_JOINTS.head), prev);
  // الذيل: كل عظام السلسلة أبناء مباشرون للجذر، ويضعها المحرك كل إطار في فضاء الحصان
  // من محاكاة فيزيائية (الطرف الأول مثبت بالحوض). محور -Y لكل عظمة يتجه على طول قطعتها.
  void pelvis;
  for (let i = 0; i < TAIL_CHAIN.length - 1; i++) {
    const dir = V(TAIL_CHAIN[i + 1]).sub(V(TAIL_CHAIN[i])).normalize();
    make(BONE_NAMES.tail[i], V(TAIL_CHAIN[i]), root, new THREE.Quaternion().setFromUnitVectors(DOWN, dir));
  }
  // الأرجل: كل عظمة محورها Y يتجه نحو المفصل التالي
  for (const id of LEG_IDS) {
    const L = LEGS[id];
    const pts = L.joints.map((j) => new THREE.Vector3(j[0], j[1], L.z * L.side));
    let parent = byName[L.parent];
    for (let i = 0; i < 5; i++) {
      let q;
      if (i < 4) {
        const dir = pts[i + 1].clone().sub(pts[i]).normalize();
        q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      } else {
        q = new THREE.Quaternion(); // الحافر: اتجاه أفقي محايد
      }
      parent = make(BONE_NAMES.leg(id, i), pts[i], parent, q);
    }
  }
  return { bones, byName, root };
}

// ----- الذيل -----
// طول السلسلة التراكمي ومعامل الموضع s∈[0,1] على طولها
const TAIL_PTS = TAIL_CHAIN.map(V);
const TAIL_SEG = TAIL_PTS.slice(0, -1).map((p, i) => p.distanceTo(TAIL_PTS[i + 1]));
const TAIL_LEN = TAIL_SEG.reduce((a, b) => a + b, 0);
const DOCK_S = TAIL_SEG.slice(0, TAIL_DOCK_SEGMENTS).reduce((a, b) => a + b, 0) / TAIL_LEN;
function tailAt(s) {
  let d = Math.min(0.99999, Math.max(0, s)) * TAIL_LEN, j = 0;
  while (j < TAIL_SEG.length - 1 && d > TAIL_SEG[j]) { d -= TAIL_SEG[j]; j++; }
  const f = Math.min(1, d / TAIL_SEG[j]);
  const p = TAIL_PTS[j].clone().lerp(TAIL_PTS[j + 1], f);
  const t = TAIL_PTS[j + 1].clone().sub(TAIL_PTS[j]).normalize();
  return { p, t, j, f };
}
// أوزان عظام سلسلة الذيل عند s: مزج ناعم بين القطعة الحالية والمجاورة
function tailWeights(s, boneOf) {
  const { j, f } = tailAt(s);
  const last = TAIL_SEG.length - 1;
  if (f >= 0.5 && j < last) { const w = (f - 0.5); return [[boneOf(j), boneOf(j + 1)], 1 - w]; }
  if (f < 0.5 && j > 0) { const w = (0.5 - f); return [[boneOf(j), boneOf(j - 1)], 1 - w]; }
  return [[boneOf(j), boneOf(j)], 1];
}
// نصف قطر كتلة الشعر على طول الذيل: رفيع عند المنبت، ممتلئ في الوسط، مستدق بأطراف غير منتظمة
function tailRadius(s) {
  const pts = [[0, 0.03], [0.1, 0.055], [0.28, 0.082], [0.5, 0.1], [0.75, 0.096], [0.92, 0.078], [1, 0.06]];
  for (let i = 1; i < pts.length; i++) if (s <= pts[i][0]) { const k = (s - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); const e = k * k * (3 - 2 * k); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * e; }
  return 0.06;
}
// كتلة شعر الذيل: ١٤ صفيحة شعر متقاطعة حول خط المنتصف بأطوال وإزاحات متفاوتة (حجم حقيقي من كل الزوايا)
function buildTailHair(out, boneOf) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const CARDS = 14, ROWS = 26;
  for (let c = 0; c < CARDS; c++) {
    const ang = (c / CARDS) * Math.PI + (rnd() - 0.5) * 0.25;
    const sEnd = c < 3 ? 0.8 + rnd() * 0.08 : 0.9 + rnd() * 0.1;
    const sStart = rnd() * 0.04;
    const off = [(rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5];
    const wMul = 0.85 + rnd() * 0.3;
    const base = out.pos.length / 3;
    for (let r = 0; r <= ROWS; r++) {
      const s = sStart + (sEnd - sStart) * (r / ROWS);
      const { p, t } = tailAt(s);
      const n1 = new THREE.Vector3(0, 0, 1);
      const n2 = new THREE.Vector3().crossVectors(t, n1).normalize();
      const R = tailRadius(s);
      const dir = n1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(n2, Math.sin(ang));
      const nrm = n1.clone().multiplyScalar(-Math.sin(ang)).addScaledVector(n2, Math.cos(ang));
      const center = p.clone().addScaledVector(n1, off[0] * R).addScaledVector(n2, off[1] * R);
      const [bi, bw] = tailWeights(s, boneOf);
      const shade = 0.78 + 0.32 * smooth01(s / 0.6) + 0.12 * smooth01((s - 0.7) / 0.3);
      for (let k = 0; k < 5; k++) {
        const x = (k - 2) / 2 * R * wMul;
        const v = center.clone().addScaledVector(dir, x).addScaledVector(nrm, k === 2 ? R * 0.15 : 0);
        out.pos.push(v.x, v.y, v.z);
        out.uv.push(c * 0.41 + k * 0.16, 1 - (s - sStart) / (sEnd - sStart));
        const edge = [0.25, 0.85, 1, 0.85, 0.25][k];
        out.col.push(shade, shade * 0.97, shade * 0.94, edge);
        // عمودي «حجمي»: من خط المنتصف نحو الرأس (تظليل أسطواني بدل صفائح مسطحة)
        const rad = v.clone().sub(p);
        if (rad.lengthSq() < 1e-6) rad.copy(nrm);
        rad.normalize().addScaledVector(t, -0.15).normalize();
        out.nrm.push(rad.x, rad.y, rad.z);
        out.si.push(bi[0], bi[1], 0, 0); out.sw.push(bw, 1 - bw, 0, 0);
      }
      if (r > 0) for (let k = 0; k < 4; k++) {
        const a = base + (r - 1) * 5 + k, b = a + 1, cc = base + r * 5 + k, d = cc + 1;
        out.idx.push(a, cc, b, b, cc, d);
      }
    }
  }
}
const smooth01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
// عظم الذيل نفسه: أنبوب مستدق مكسوّ بلون الشعر تحت الصفائح (يعطي الذيل جذرًا متصلًا بالكفل)
function buildTailDockGeometry(boneOf) {
  const pos = [], si = [], sw = [], idx = [];
  const ROWS = 12, SEG = 10;
  for (let r = 0; r <= ROWS; r++) {
    const s = (r / ROWS) * DOCK_S * 1.05;
    const { p, t } = tailAt(s);
    const n1 = new THREE.Vector3(0, 0, 1);
    const n2 = new THREE.Vector3().crossVectors(t, n1).normalize();
    const R = 0.05 - 0.024 * (r / ROWS);
    const [bi, bw] = tailWeights(s, boneOf);
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      const v = p.clone().addScaledVector(n1, Math.cos(a) * R).addScaledVector(n2, Math.sin(a) * R * 1.1);
      pos.push(v.x, v.y, v.z);
      si.push(bi[0], bi[1], 0, 0); sw.push(bw, 1 - bw, 0, 0);
    }
    if (r > 0) for (let k = 0; k < SEG; k++) {
      const a = (r - 1) * SEG + k, b = (r - 1) * SEG + (k + 1) % SEG, c = r * SEG + k, d = r * SEG + (k + 1) % SEG;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// رفرفة دقيقة لأطراف الشعر (العُرف والذيل) في مُظلّل الرؤوس: تزداد مع السرعة ونحو الأطراف
function addHairFlutter(mat) {
  mat.userData.uniforms = { uTime: { value: 0 }, uFlutter: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uFlutter;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float tip = 1.0 - uv.y;
          float ph = position.x * 9.0 + position.y * 5.0 + position.z * 23.0;
          float w = uFlutter * tip * tip;
          transformed += vec3(sin(uTime * 2.1 + ph * 0.3) * 0.01, sin(uTime * 13.0 + ph) * 0.022, cos(uTime * 11.0 + ph * 1.3) * 0.03) * w;
        }`);
    // الشعر مضاء من الجهتين بنفس العمودي الحجمي (لا قلب للعمودي على الوجه الخلفي)
    sh.fragmentShader = sh.fragmentShader.replace('normal *= faceDirection;', '');
  };
  mat.customProgramCacheKey = () => 'hjr-hair';
  void 0;
}

// ----- شعر العُرف والذيل: شرائط شعر بخامة خصلات شفافة الأطراف -----
const hairTex = {};
// dense: العُرف (خصلات متراصة)، sparse: الذيل (فجوات بين الخصلات تعطي حوافّ شعرية)
function getHairTexture(dense = false) {
  const key = dense ? 'dense' : 'sparse';
  if (hairTex[key]) return hairTex[key];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 256);
  // خصلات عمودية بأطوال متفاوتة (v=0 الجذر، v=1 الأطراف)
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < (dense ? 1100 : 420); i++) {
    const x = rnd() * 128, len = 150 + rnd() * 106, w = 1.2 + rnd() * 2.6;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    const sh = 140 + Math.floor(rnd() * 115);
    const al = dense ? 1 : 0.45 + rnd() * 0.55;
    g.addColorStop(0, `rgba(${sh},${sh},${sh},${al})`);
    g.addColorStop(0.75, `rgba(${sh},${sh},${sh},${al * 0.95})`);
    g.addColorStop(1, `rgba(${sh},${sh},${sh},0)`);
    ctx.strokeStyle = g; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (rnd() - 0.5) * 8, len * 0.3, x + (rnd() - 0.5) * 12, len * 0.7, x + (rnd() - 0.5) * 14, len); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  hairTex[key] = tex;
  return tex;
}

// يبني شريطًا مكسوًّا: rows = [{ root: Vector3, tip: Vector3, bone: index, u }]
function ribbon(rows, segs, sag, out, boneFor) {
  const base = out.pos.length / 3;
  rows.forEach((r, i) => {
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const p = r.root.clone().lerp(r.tip, t);
      p.y -= sag * t * t; // انحناء الشعر بثقله
      out.pos.push(p.x, p.y, p.z);
      out.uv.push(r.u, 1 - t);
      out.col.push(1, 1, 1, 1); out.nrm.push(0, 0, 0);
      const [bi, bw] = boneFor(r, t);
      out.si.push(bi[0], bi[1], 0, 0); out.sw.push(bw, 1 - bw, 0, 0);
    }
    if (i > 0) for (let k = 0; k < segs; k++) {
      const a = base + (i - 1) * (segs + 1) + k, b = a + 1, c = base + i * (segs + 1) + k, d = c + 1;
      out.idx.push(a, c, b, b, c, d);
    }
  });
}

function buildHairGeometry(skel, part) {
  const { byName, bones } = skel;
  const bi = (n) => bones.indexOf(byName[n]);
  const out = { pos: [], uv: [], si: [], sw: [], idx: [], col: [], nrm: [] };
  // العُرف: من أعلى الرقبة يتدلى على الجانب الأيمن، وطبقة ثانية أقصر على الأيسر
  const crest = [[0.50, 1.665], [0.62, 1.745], [0.75, 1.835], [0.87, 1.93], [0.98, 2.03], [1.08, 2.125], [1.17, 2.2], [1.24, 2.235]];
  const neckNames = ['chest', 'neck0', 'neck1', 'neck2', 'neck3'];
  const neckX = [0.5, 0.72, 0.88, 1.03, 1.17];
  const neckBone = (x) => { let k = 0; for (let i = 0; i < neckX.length; i++) if (x >= neckX[i]) k = i; return bi(neckNames[k]); };
  // الشعر يتبع سطح الرقبة المنحوت (نقاط محسوبة مسبقًا): طبقة طويلة على اليمين وقصيرة على اليسار
  void crest;
  if (part === 'mane') for (const [side, depth] of [[1, 3], [-1, 2]]) {
    const base = out.pos.length / 3;
    MANE_ROWS.forEach((row, i) => {
      const jag = 0.8 + 0.2 * Math.sin(i * 2.7);
      for (let k = 0; k <= depth; k++) {
        const p = row[k];
        const kk = k === depth ? jag : 1;
        out.pos.push(p[0], row[0][1] + (p[1] - row[0][1]) * kk, side * p[2]);
        out.uv.push(i * 0.37, 1 - k / depth);
        out.col.push(1, 1, 1, 1); out.nrm.push(0, 0, 0);
        const b = neckBone(row[0][0]);
        out.si.push(b, b, 0, 0); out.sw.push(1, 0, 0, 0);
      }
      if (i > 0) for (let k = 0; k < depth; k++) {
        const a2 = base + (i - 1) * (depth + 1) + k, b2 = a2 + 1, c2 = base + i * (depth + 1) + k, d2 = c2 + 1;
        out.idx.push(a2, c2, b2, b2, c2, d2);
      }
    });
  }
  // الناصية بين الأذنين
  if (part === 'mane') {
    const hb = bi('head');
    const rows = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6 - 0.5) * 1.6;
      rows.push({ root: new THREE.Vector3(1.325, 2.235, Math.sin(a) * 0.035), tip: new THREE.Vector3(1.45, 2.11, Math.sin(a) * 0.06), u: i * 0.4, b: hb });
    }
    ribbon(rows, 2, 0.01, out, (r) => [[r.b, r.b], 1]);
  }
  if (part === 'tail') buildTailHair(out, (j) => bi(BONE_NAMES.tail[j]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.sw, 4));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 4));
  g.setIndex(out.idx);
  g.computeVertexNormals();
  // للذيل عموديات حجمية محسوبة مسبقًا؛ وللعُرف والناصية عموديات السطح موجّهة للخارج
  const n = g.attributes.normal, P = g.attributes.position;
  for (let i = 0; i < n.count; i++) {
    const cx = out.nrm[i * 3], cy = out.nrm[i * 3 + 1], cz = out.nrm[i * 3 + 2];
    if (cx || cy || cz) { n.setXYZ(i, cx, cy, cz); continue; }
    const side = Math.sign(P.getZ(i)) || 1;
    if (n.getZ(i) * side < 0 && Math.abs(P.getZ(i)) > 0.01) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    else if (Math.abs(P.getZ(i)) <= 0.01 && n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return g;
}

// ----- تفاصيل الرأس (مثبتة على عظمة الرأس): عينان، رموش، أذنان، لجام بحلقة الشكيمة -----
function buildHeadDetails(headBone, colors, furMat) {
  const group = new THREE.Group();
  group.name = 'headDetails';
  const H = SCULPT_HEAD;
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x150c07, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x120d0a, roughness: 0.9 });
  const earGeo = new THREE.LatheGeometry([[0, 0], [0.024, 0.008], [0.031, 0.045], [0.026, 0.095], [0.011, 0.142], [0, 0.152]].map(([r, y]) => new THREE.Vector2(r, y)), 12, 0, Math.PI);
  const earInGeo = new THREE.LatheGeometry([[0, 0.012], [0.019, 0.018], [0.024, 0.05], [0.019, 0.095], [0.007, 0.134], [0, 0.14]].map(([r, y]) => new THREE.Vector2(r, y)), 10, 0, Math.PI);
  const earInMat = new THREE.MeshStandardMaterial({ color: colors.dark.clone().multiplyScalar(0.5), roughness: 1, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(H.eyeR, 16, 12), eyeMat);
    eye.position.set(H.eye[0] + 0.003, H.eye[1], s * (H.eye[2] - 0.006));
    group.add(eye);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(H.eyeR * 1.05, 0.0022, 4, 14, Math.PI * 0.9), lashMat);
    lash.position.set(H.eye[0] + 0.005, H.eye[1] + 0.004, s * (H.eye[2] + 0.004));
    lash.rotation.set(0, s * 1.25, -0.25);
    lash.scale.set(1.15, 0.8, 1);
    group.add(lash);
    // أذن مدببة منتصبة تتجه للأمام (حصان متيقظ)
    const ear = new THREE.Mesh(earGeo, furMat);
    ear.position.set(H.ear[0], H.ear[1], s * H.ear[2]);
    const tip = new THREE.Vector3(0.22, 0.95, s * 0.16).normalize();
    const open = new THREE.Vector3(0.75, -0.1, s * 0.62);
    const xAxis = open.clone().addScaledVector(tip, -open.dot(tip)).normalize().negate();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, tip);
    ear.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, tip, zAxis));
    group.add(ear);
    const earIn = new THREE.Mesh(earInGeo, earInMat);
    earIn.position.copy(ear.position).addScaledVector(xAxis, -0.003);
    earIn.quaternion.copy(ear.quaternion);
    group.add(earIn);
  }
  // اللجام الجلدي: حزام الأنف، سير الرأس خلف الأذنين، سير الحلق، سيرا الخدين، وحلقتا الشكيمة المعدنيتان
  const leather = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.25, metalness: 0.9 });
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const ring = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v3), true), 56, r, 6, true), leather);
  if (H.halter.nose.length > 6) group.add(ring(H.halter.nose, 0.006));
  if (H.halter.poll.length > 6) group.add(ring(H.halter.poll, 0.0055));
  if (H.halter.brow && H.halter.brow.length > 6) group.add(ring(H.halter.brow, 0.005));
  for (const strap of H.halter.cheek) group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strap.map(v3)), 14, 0.0052, 5), leather));
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0032, 6, 16), steel);
    m.position.set(H.bit[0], H.bit[1], s * (H.bit[2] + 0.004));
    m.rotation.y = 0.15 * s;
    group.add(m);
  }
  mergeStaticChildren(group, { castShadow: true });
  headBone.add(group);
  return group;
}

// يبني حصانًا كاملًا. يعيد كائنًا فيه المجموعة والعظام والمواد.
export function buildHorse({ coat, cloth, quality = 'high', socksSeed = 0 }) {
  const lod = quality === 'low' ? 'low' : 'high';
  const legOrder = ['HL', 'FR', 'HR', 'FL'];
  const colors = {
    base: new THREE.Color(coat.base), belly: new THREE.Color(coat.belly), dark: new THREE.Color(coat.dark),
    points: new THREE.Color(coat.points), blaze: !!coat.blaze,
    socks: new Set(legOrder.slice(socksSeed % 4).concat(legOrder).slice(0, coat.socks || 0)),
  };
  const group = new THREE.Group();
  group.name = 'horse';
  const skel = buildSkeleton();
  group.add(skel.root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(skel.bones);

  const fur = getCoatMaps();
  const furMat = makeFurMaterial(fur.map, colors);
  const bodyMesh = new THREE.SkinnedMesh(sculptGeometry(lod, skel.bones, colors), furMat);
  bodyMesh.name = 'horseBody';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.frustumCulled = false;
  group.add(bodyMesh);
  bodyMesh.bind(skeleton);

  // العُرف والناصية (خامة متراصة) والذيل (خامة متفرقة الخصلات)
  const maneMat = new THREE.MeshStandardMaterial({ color: coat.mane, map: getHairTexture(true), alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.55, vertexColors: true });
  addHairFlutter(maneMat);
  const hairMat = new THREE.MeshStandardMaterial({ color: coat.mane, map: getHairTexture(false), alphaTest: 0.32, side: THREE.DoubleSide, roughness: 0.55, vertexColors: true });
  addHairFlutter(hairMat);
  const maneMesh = new THREE.SkinnedMesh(buildHairGeometry(skel, 'mane'), maneMat);
  maneMesh.name = 'horseMane';
  const hairMesh = new THREE.SkinnedMesh(buildHairGeometry(skel, 'tail'), hairMat);
  hairMesh.name = 'horseTail';
  for (const m of [maneMesh, hairMesh]) {
    m.castShadow = true;
    m.frustumCulled = false;
    group.add(m);
    m.bind(skeleton);
  }

  // عظم الذيل المكسوّ
  const dockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(coat.mane).lerp(new THREE.Color(coat.dark), 0.35), roughness: 0.7 });
  const dockMesh = new THREE.SkinnedMesh(buildTailDockGeometry((j) => skel.bones.indexOf(skel.byName[BONE_NAMES.tail[j]])), dockMat);
  dockMesh.name = 'tailDock';
  dockMesh.castShadow = true;
  dockMesh.frustumCulled = false;
  group.add(dockMesh);
  dockMesh.bind(skeleton);

  // قماش السرج المرقّم
  const clothTex = makeClothTexture(cloth);
  const clothMat = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.8, side: THREE.DoubleSide });
  const clothMesh = new THREE.SkinnedMesh(sculptClothGeometry(skel.bones), clothMat);
  clothMesh.name = 'saddleCloth';
  clothMesh.castShadow = true;
  clothMesh.frustumCulled = false;
  group.add(clothMesh);
  clothMesh.bind(skeleton);

  buildHeadDetails(skel.byName.head, colors, furMat);

  for (const b of skel.bones) {
    b.userData.bindPos = b.position.clone();
    b.userData.bindQuat = b.quaternion.clone();
  }

  return {
    group, skeleton, bones: skel.byName, boneList: skel.bones,
    materials: [furMat, clothMat, hairMat, maneMat, dockMat],
    hairMaterials: [hairMat, maneMat],
    meshes: { body: bodyMesh, cloth: clothMesh, hair: hairMesh, mane: maneMesh },
    clothTexture: clothTex,
    bitLocal: new THREE.Vector3(SCULPT_HEAD.bit[0], SCULPT_HEAD.bit[1], SCULPT_HEAD.bit[2]),
    dispose() {
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((mm) => { if (mm !== furMat && mm !== clothMat && mm !== hairMat && mm !== maneMat && mm !== dockMat) mm.dispose(); });
      });
      furMat.dispose(); clothMat.dispose(); hairMat.dispose(); maneMat.dispose(); dockMat.dispose();
      clothTex.dispose();
      skeleton.dispose();
    },
  };
}
