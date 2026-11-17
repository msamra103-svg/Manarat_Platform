import * as THREE from 'three';
import { SPINE_JOINTS, TAIL_JOINTS, LEGS } from './horseAnatomy.js';
import { sculptGeometry, sculptClothGeometry, makeFurMaterial, SCULPT_HEAD, MANE_ROWS } from './horseSculpt.js';
import { getCoatMaps, makeClothTexture } from '../scene/textures.js';
import { mergeStaticChildren } from '../core/merge.js';

// يبني حصان سباق مجهّزًا بهيكل عظمي (Skeleton) وشبكات مكسوّة (SkinnedMesh): الجسم المنحوت، العُرف، الذيل، قماش السرج، اللجام.

const V = (a) => new THREE.Vector3(a[0], a[1], a[2] ?? 0);
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export const BONE_NAMES = {
  root: 'root', body: 'body', pelvis: 'pelvis', spine: 'spine', chest: 'chest',
  neck: ['neck0', 'neck1', 'neck2', 'neck3'], head: 'head',
  tail: ['tail0', 'tail1', 'tail2'],
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
  // الذيل
  let tp = pelvis;
  for (let i = 0; i < 3; i++) {
    const dir = V(TAIL_JOINTS[i + 1]).sub(V(TAIL_JOINTS[i])).normalize();
    tp = make(BONE_NAMES.tail[i], V(TAIL_JOINTS[i]), tp, new THREE.Quaternion().setFromUnitVectors(UP, dir));
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

// ----- شعر العُرف والذيل: شرائط شعر بخامة خصلات شفافة الأطراف -----
let hairTex = null;
function getHairTexture() {
  if (hairTex) return hairTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 256);
  // خصلات عمودية بأطوال متفاوتة (v=0 الجذر، v=1 الأطراف)
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1100; i++) {
    const x = rnd() * 128, len = 170 + rnd() * 86, w = 1.5 + rnd() * 3;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    const sh = 150 + Math.floor(rnd() * 105);
    g.addColorStop(0, `rgba(${sh},${sh},${sh},1)`);
    g.addColorStop(0.8, `rgba(${sh},${sh},${sh},0.95)`);
    g.addColorStop(1, `rgba(${sh},${sh},${sh},0)`);
    ctx.strokeStyle = g; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (rnd() - 0.5) * 8, len * 0.3, x + (rnd() - 0.5) * 12, len * 0.7, x + (rnd() - 0.5) * 14, len); ctx.stroke();
  }
  hairTex = new THREE.CanvasTexture(c);
  hairTex.colorSpace = THREE.SRGBColorSpace;
  hairTex.wrapS = THREE.RepeatWrapping;
  return hairTex;
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
      const [bi, bw] = boneFor(r, t);
      out.si.push(bi[0], bi[1], 0, 0); out.sw.push(bw, 1 - bw, 0, 0);
    }
    if (i > 0) for (let k = 0; k < segs; k++) {
      const a = base + (i - 1) * (segs + 1) + k, b = a + 1, c = base + i * (segs + 1) + k, d = c + 1;
      out.idx.push(a, c, b, b, c, d);
    }
  });
}

function buildHairGeometry(skel) {
  const { byName, bones } = skel;
  const bi = (n) => bones.indexOf(byName[n]);
  const out = { pos: [], uv: [], si: [], sw: [], idx: [] };
  // العُرف: من أعلى الرقبة يتدلى على الجانب الأيمن، وطبقة ثانية أقصر على الأيسر
  const crest = [[0.50, 1.665], [0.62, 1.745], [0.75, 1.835], [0.87, 1.93], [0.98, 2.03], [1.08, 2.125], [1.17, 2.2], [1.24, 2.235]];
  const neckNames = ['chest', 'neck0', 'neck1', 'neck2', 'neck3'];
  const neckX = [0.5, 0.72, 0.88, 1.03, 1.17];
  const neckBone = (x) => { let k = 0; for (let i = 0; i < neckX.length; i++) if (x >= neckX[i]) k = i; return bi(neckNames[k]); };
  // الشعر يتبع سطح الرقبة المنحوت (نقاط محسوبة مسبقًا): طبقة طويلة على اليمين وقصيرة على اليسار
  void crest;
  for (const [side, depth] of [[1, 3], [-1, 2]]) {
    const base = out.pos.length / 3;
    MANE_ROWS.forEach((row, i) => {
      const jag = 0.8 + 0.2 * Math.sin(i * 2.7);
      for (let k = 0; k <= depth; k++) {
        const p = row[k];
        const kk = k === depth ? jag : 1;
        out.pos.push(p[0], row[0][1] + (p[1] - row[0][1]) * kk, side * p[2]);
        out.uv.push(i * 0.37, 1 - k / depth);
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
  {
    const hb = bi('head');
    const rows = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6 - 0.5) * 1.6;
      rows.push({ root: new THREE.Vector3(1.325, 2.235, Math.sin(a) * 0.035), tip: new THREE.Vector3(1.45, 2.11, Math.sin(a) * 0.06), u: i * 0.4, b: hb });
    }
    ribbon(rows, 2, 0.01, out, (r) => [[r.b, r.b], 1]);
  }
  // الذيل: ثماني صفائح شعر طويلة حول عظام الذيل
  {
    const t0 = bi('tail0'), t1 = bi('tail1'), t2 = bi('tail2');
    const J = TAIL_JOINTS.map(V);
    const end = new THREE.Vector3(-1.2, 0.42, 0);
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      const rows = [];
      for (let i = 0; i <= 3; i++) {
        const a2 = ang + (i / 3 - 0.5) * 0.9;
        const dz = Math.sin(a2), dx = Math.cos(a2);
        rows.push({ root: new THREE.Vector3(J[0].x + dx * 0.02, J[0].y, dz * 0.03), tip: new THREE.Vector3(end.x + dx * 0.11, end.y + Math.sin(s * 1.7) * 0.06, dz * 0.12), u: s * 1.3 + i * 0.33 });
      }
      ribbon(rows, 6, -0.0, out, (r, t) => (t < 0.25 ? [[t0, t0], 1] : t < 0.55 ? [[t0, t1], 1 - (t - 0.25) / 0.3] : t < 0.8 ? [[t1, t2], 1 - (t - 0.55) / 0.25] : [[t2, t2], 1]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.sw, 4));
  g.setIndex(out.idx);
  g.computeVertexNormals();
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

  // العُرف والناصية والذيل
  const hairMat = new THREE.MeshStandardMaterial({ color: coat.mane, map: getHairTexture(), alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.5 });
  const hairMesh = new THREE.SkinnedMesh(buildHairGeometry(skel), hairMat);
  hairMesh.name = 'horseHair';
  hairMesh.castShadow = true;
  hairMesh.frustumCulled = false;
  group.add(hairMesh);
  hairMesh.bind(skeleton);

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
    materials: [furMat, clothMat, hairMat],
    meshes: { body: bodyMesh, cloth: clothMesh, hair: hairMesh },
    clothTexture: clothTex,
    bitLocal: new THREE.Vector3(SCULPT_HEAD.bit[0], SCULPT_HEAD.bit[1], SCULPT_HEAD.bit[2]),
    dispose() {
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((mm) => { if (mm !== furMat && mm !== clothMat && mm !== hairMat) mm.dispose(); });
      });
      furMat.dispose(); clothMat.dispose(); hairMat.dispose();
      clothTex.dispose();
      skeleton.dispose();
    },
  };
}
