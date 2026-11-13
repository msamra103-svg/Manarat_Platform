import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BONE_NAMES } from "./camelBuilder.mjs";
import { makeClothTexture } from "../scene/textures.mjs";
function requiredBoneNames() {
  const names = ["root", "body", "pelvis", "spine", "chest", ...BONE_NAMES.neck, "head", ...BONE_NAMES.tail];
  for (const id of ["FL", "FR", "HL", "HR"]) for (let i = 0; i < 5; i++) names.push(BONE_NAMES.leg(id, i));
  return names;
}
async function loadCamelTemplate(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const found = /* @__PURE__ */ new Set();
  gltf.scene.traverse((o) => {
    if (o.isBone) found.add(o.name);
  });
  const missing = requiredBoneNames().filter((n) => !found.has(n));
  if (missing.length) throw new Error(`نموذج الهجين ينقصه عظام: ${missing.slice(0, 6).join("، ")}${missing.length > 6 ? "…" : ""}`);
  return gltf;
}
function instantiateCamel(gltf, { coat, cloth, referenceCoat }) {
  const group = cloneSkinned(gltf.scene);
  group.name = "camel";
  const bones = {};
  const boneList = [];
  const materials = [];
  let body = null, clothMesh = null;
  const clothTex = makeClothTexture(cloth);
  const tint = new THREE.Color(coat.base);
  const ref = new THREE.Color(referenceCoat?.base || coat.base);
  const ratio = new THREE.Color(tint.r / Math.max(0.01, ref.r), tint.g / Math.max(0.01, ref.g), tint.b / Math.max(0.01, ref.b));
  group.traverse((o) => {
    if (o.isBone) {
      bones[o.name] = o;
      boneList.push(o);
    }
    if (o.isMesh) {
      o.material = o.material.clone();
      materials.push(o.material);
      o.castShadow = true;
      if (o.isSkinnedMesh) o.frustumCulled = false;
      if (o.name.includes("raceCloth")) {
        clothMesh = o;
        o.material.map = clothTex;
        o.material.color.set("#ffffff");
        o.material.side = THREE.DoubleSide;
      } else if (o.material.vertexColors || o.isSkinnedMesh) {
        o.material.color.multiply(ratio);
        if (!body && o.isSkinnedMesh) body = o;
      }
    }
  });
  for (const b of boneList) {
    b.userData.bindPos = b.position.clone();
    b.userData.bindQuat = b.quaternion.clone();
  }
  return {
    group,
    bones,
    boneList,
    materials,
    meshes: { body, cloth: clothMesh },
    clothTexture: clothTex,
    fromGLB: true,
    dispose() {
      group.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
      clothTex.dispose();
    }
  };
}
export {
  instantiateCamel,
  loadCamelTemplate,
  requiredBoneNames
};
