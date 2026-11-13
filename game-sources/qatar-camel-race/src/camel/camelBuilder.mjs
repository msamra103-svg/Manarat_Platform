import * as THREE from "three";
import { SPINE_JOINTS, TAIL_JOINTS, LEGS } from "./camelAnatomy.mjs";
import { sculptGeometry, sculptClothGeometry, makeFurMaterial, SCULPT_HEAD, SADDLE_TOP } from "./camelSculpt.mjs";
import { getCamelFurMaps, makeClothTexture } from "../scene/textures.mjs";
import { mergeStaticChildren } from "../core/merge.mjs";
const V = (a) => new THREE.Vector3(a[0], a[1], a[2] ?? 0);
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const BONE_NAMES = {
  root: "root",
  body: "body",
  pelvis: "pelvis",
  spine: "spine",
  chest: "chest",
  neck: ["neck0", "neck1", "neck2", "neck3"],
  head: "head",
  tail: ["tail0", "tail1", "tail2"],
  leg: (id, i) => `leg_${id}_${i}`
  // i: 0 كتف/ورك، 1 مرفق/ركبة، 2 رسغ/عرقوب، 3 حافر، 4 خف
};
const LEG_IDS = ["FL", "FR", "HL", "HR"];
function buildSkeleton() {
  const bones = [];
  const byName = {};
  const make = (name, worldPos, parent, worldQuat = null) => {
    const b = new THREE.Bone();
    b.name = name;
    b.userData.bindWorldPos = worldPos.clone();
    b.userData.bindWorldQuat = worldQuat ? worldQuat.clone() : new THREE.Quaternion();
    if (parent) {
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
  const root = make("root", new THREE.Vector3(0, 0, 0), null);
  const body = make("body", V(SPINE_JOINTS.body), root);
  const pelvis = make("pelvis", V(SPINE_JOINTS.pelvis), body);
  const spine = make("spine", V(SPINE_JOINTS.spine), body);
  const chest = make("chest", V(SPINE_JOINTS.chest), spine);
  let prev = chest;
  for (const n of BONE_NAMES.neck) prev = make(n, V(SPINE_JOINTS[n]), prev);
  make("head", V(SPINE_JOINTS.head), prev);
  let tp = pelvis;
  for (let i = 0; i < 3; i++) {
    const dir = V(TAIL_JOINTS[i + 1]).sub(V(TAIL_JOINTS[i])).normalize();
    tp = make(BONE_NAMES.tail[i], V(TAIL_JOINTS[i]), tp, new THREE.Quaternion().setFromUnitVectors(UP, dir));
  }
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
        q = new THREE.Quaternion();
      }
      parent = make(BONE_NAMES.leg(id, i), pts[i], parent, q);
    }
  }
  return { bones, byName, root };
}
function buildTailGeometry(skel, colors) {
  const { byName, bones } = skel;
  const pts = TAIL_JOINTS.map(V);
  const idx = (i) => bones.indexOf(byName[BONE_NAMES.tail[Math.min(2, i)]]);
  const radial = 10, n = 16;
  const pos = [], col = [], si = [], sw = [], ind = [];
  const c = new THREE.Color();
  for (let r = 0; r <= n; r++) {
    const f = r / n * 3;
    const i = Math.min(2, Math.floor(f));
    const t = f - i;
    const center = pts[i].clone().lerp(pts[i + 1], t);
    const T = pts[i + 1].clone().sub(pts[i]).normalize();
    const N = Z.clone().cross(T).normalize();
    const rad = 0.045 * (1 - f / 3) + 0.016 + (f > 2.3 ? (f - 2.3) * 0.03 : 0);
    const wts = r === 0 ? [[bones.indexOf(byName.pelvis), 0.5], [idx(0), 0.5]] : t < 0.2 && i > 0 ? [[idx(i), 0.6 + t * 2], [idx(i - 1), 0.4 - t * 2]] : [[idx(i), 1]];
    c.copy(colors.base).lerp(colors.dark, 0.25 + f * 0.15);
    for (let k = 0; k <= radial; k++) {
      const phi = k / radial * Math.PI * 2;
      const p = center.clone().addScaledVector(N, Math.cos(phi) * rad).addScaledVector(Z, Math.sin(phi) * rad * 0.82);
      pos.push(p.x, p.y, p.z);
      col.push(c.r, c.g, c.b);
      for (let q = 0; q < 4; q++) {
        si.push(wts[q] ? wts[q][0] : 0);
        sw.push(wts[q] ? wts[q][1] : 0);
      }
    }
  }
  for (let r = 0; r < n; r++) for (let k = 0; k < radial; k++) {
    const a = r * (radial + 1) + k, b = a + 1, cc = a + radial + 1, d = cc + 1;
    ind.push(a, cc, b, b, cc, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(ind);
  g.computeVertexNormals();
  return g;
}
function buildHeadDetails(headBone, colors, furMat, trimColor) {
  const group = new THREE.Group();
  group.name = "headDetails";
  const H = SCULPT_HEAD;
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 1839113, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 });
  const lashMat = new THREE.MeshStandardMaterial({ color: 1708556, roughness: 0.9 });
  const skinDark = new THREE.MeshStandardMaterial({ color: 2366229, roughness: 0.75 });
  const earGeo = new THREE.LatheGeometry([[0, 0], [0.022, 4e-3], [0.033, 0.026], [0.031, 0.05], [0.019, 0.07], [0, 0.077]].map(([r, y]) => new THREE.Vector2(r, y)), 12, 0, Math.PI);
  const earInGeo = new THREE.LatheGeometry([[0, 6e-3], [0.018, 0.01], [0.025, 0.03], [0.022, 0.05], [0.011, 0.064], [0, 0.068]].map(([r, y]) => new THREE.Vector2(r, y)), 10, 0, Math.PI);
  const earInMat = new THREE.MeshStandardMaterial({ color: colors.dark.clone().multiplyScalar(0.55), roughness: 1, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(H.eyeR, 16, 12), eyeMat);
    eye.position.set(H.eye[0] + 4e-3, H.eye[1], s * (H.eye[2] - 6e-3));
    group.add(eye);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(H.eyeR * 1.05, 28e-4, 4, 14, Math.PI * 0.9), lashMat);
    lash.position.set(H.eye[0] + 6e-3, H.eye[1] + 4e-3, s * (H.eye[2] + 4e-3));
    lash.rotation.set(0, s * 1.25, 0.12);
    lash.scale.set(1.15, 0.85, 1);
    group.add(lash);
    const ear = new THREE.Mesh(earGeo, furMat);
    ear.position.set(H.ear[0], H.ear[1], s * H.ear[2]);
    const tip = new THREE.Vector3(-0.42, 0.82, s * 0.38).normalize();
    const open = new THREE.Vector3(0.55, 0.1, s * 0.83);
    const xAxis = open.clone().addScaledVector(tip, -open.dot(tip)).normalize().negate();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, tip);
    ear.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, tip, zAxis));
    group.add(ear);
    const earIn = new THREE.Mesh(earInGeo, earInMat);
    earIn.position.copy(ear.position).addScaledVector(xAxis, -3e-3);
    earIn.quaternion.copy(ear.quaternion);
    group.add(earIn);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), skinDark);
    nostril.scale.set(0.017, 32e-4, 45e-4);
    nostril.position.set(H.nostril[0] + 2e-3, H.nostril[1] + 3e-3, s * (H.nostril[2] + 4e-3));
    nostril.rotation.set(0, s * -0.4, -0.75);
    group.add(nostril);
  }
  const ropeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#2b1d13").lerp(trimColor, 0.14), roughness: 0.55 });
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const ring = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v3), true), 56, r, 6, true), ropeMat);
  if (H.halter.nose.length > 6) group.add(ring(H.halter.nose, 52e-4));
  if (H.halter.poll.length > 6) group.add(ring(H.halter.poll, 55e-4));
  for (const strap of H.halter.cheek) group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strap.map(v3)), 14, 5e-3, 5), ropeMat));
  const ringMat = new THREE.MeshStandardMaterial({ color: 12165754, roughness: 0.35, metalness: 0.8 });
  for (const strap of H.halter.cheek) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.011, 25e-4, 5, 12), ringMat);
    m.position.copy(v3(strap[2]));
    m.rotation.y = Math.PI / 2;
    group.add(m);
  }
  mergeStaticChildren(group, { castShadow: true });
  headBone.add(group);
  return group;
}
function buildCamel({ coat, cloth, quality = "high" }) {
  const lod = quality === "low" ? "low" : "high";
  const colors = {
    base: new THREE.Color(coat.base),
    belly: new THREE.Color(coat.belly),
    dark: new THREE.Color(coat.dark)
  };
  const group = new THREE.Group();
  group.name = "camel";
  const skel = buildSkeleton();
  group.add(skel.root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(skel.bones);
  const fur = getCamelFurMaps();
  const furMat = makeFurMaterial(fur.map, colors);
  const bodyMesh = new THREE.SkinnedMesh(sculptGeometry(lod, skel.bones, colors), furMat);
  bodyMesh.name = "camelBody";
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.frustumCulled = false;
  group.add(bodyMesh);
  bodyMesh.bind(skeleton);
  const tailMesh = new THREE.SkinnedMesh(buildTailGeometry(skel, colors), furMat);
  tailMesh.name = "camelTail";
  tailMesh.castShadow = true;
  tailMesh.frustumCulled = false;
  group.add(tailMesh);
  tailMesh.bind(skeleton);
  const clothTex = makeClothTexture(cloth);
  const clothMat = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.78, side: THREE.DoubleSide });
  const clothMesh = new THREE.SkinnedMesh(sculptClothGeometry(skel.bones), clothMat);
  clothMesh.name = "raceCloth";
  clothMesh.castShadow = true;
  clothMesh.frustumCulled = false;
  group.add(clothMesh);
  clothMesh.bind(skeleton);
  const tuftMat = new THREE.MeshStandardMaterial({ color: colors.dark.clone().multiplyScalar(0.6), roughness: 1 });
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 8), tuftMat);
  tuft.position.set(0, V(TAIL_JOINTS[3]).distanceTo(V(TAIL_JOINTS[2])) + 0.04, 0);
  tuft.rotation.x = Math.PI;
  tuft.castShadow = true;
  skel.byName.tail2.add(tuft);
  const detailMat = new THREE.MeshStandardMaterial({ color: colors.base.clone().multiplyScalar(0.8), roughness: 0.9 });
  buildHeadDetails(skel.byName.head, colors, furMat, new THREE.Color(cloth.trim));
  for (const b of skel.bones) {
    b.userData.bindPos = b.position.clone();
    b.userData.bindQuat = b.quaternion.clone();
  }
  void detailMat;
  return {
    group,
    skeleton,
    bones: skel.byName,
    boneList: skel.bones,
    materials: [furMat, clothMat],
    meshes: { body: bodyMesh, cloth: clothMesh },
    clothTexture: clothTex,
    // ارتفاع مقعد الراكب الآلي نسبةً إلى عظمة العمود الفقري
    saddleY: SADDLE_TOP - SPINE_JOINTS.spine[1] - 0.01,
    dispose() {
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((mm) => {
          if (mm !== furMat && mm !== clothMat) mm.dispose();
        });
      });
      furMat.dispose();
      clothMat.dispose();
      detailMat.dispose();
      tuftMat.dispose();
      clothTex.dispose();
      skeleton.dispose();
    }
  };
}
export {
  BONE_NAMES,
  buildCamel
};
