import * as THREE from "three";
import { getQatarFlagTexture } from "./textures.mjs";
function buildFlags(scene, positions, { quality }) {
  const group = new THREE.Group();
  group.name = "flags";
  scene.add(group);
  const uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
  const tex = getQatarFlagTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.75 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWind;").replace("#include <begin_vertex>", `#include <begin_vertex>
        float along = uv.x; // 0 عند السارية
        vec4 wp = modelMatrix * vec4(0.0,0.0,0.0,1.0);
        float ph = wp.x * 0.37 + wp.z * 0.61;
        float w = sin(along * 7.0 - uTime * 6.0 + ph) * 0.11 + sin(along * 13.0 - uTime * 9.0 + ph * 1.7) * 0.035;
        transformed.z += w * along * uWind;
        transformed.y -= along * along * 0.08 * (1.2 - uWind);`);
  };
  mat.customProgramCacheKey = () => "qatarFlagWave";
  const seg = quality === "low" ? [10, 2] : [24, 6];
  const flagGeo = new THREE.PlaneGeometry(2.8, 1.1, seg[0], seg[1]);
  flagGeo.translate(1.4, 0, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: "#f2f2ef", roughness: 0.4, metalness: 0.5 });
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.07, 1, 8);
  const capGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const capMat = new THREE.MeshStandardMaterial({ color: "#d9b45a", metalness: 0.8, roughness: 0.3 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, positions.length);
  const caps = new THREE.InstancedMesh(capGeo, capMat, positions.length);
  const m = new THREE.Matrix4();
  poles.castShadow = quality === "high";
  group.add(poles, caps);
  positions.forEach((p, i) => {
    const h = p.h || 7;
    m.compose(new THREE.Vector3(p.x, h / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
    poles.setMatrixAt(i, m);
    m.makeTranslation(p.x, h + 0.05, p.z);
    caps.setMatrixAt(i, m);
    const flag = new THREE.Mesh(flagGeo, mat);
    flag.position.set(p.x, h - 0.65, p.z);
    flag.rotation.y = p.rot ?? 0;
    flag.castShadow = quality === "high";
    group.add(flag);
  });
  return {
    group,
    update(t, wind = 1) {
      uniforms.uTime.value = t;
      uniforms.uWind.value = wind;
    },
    dispose() {
      mat.dispose();
      flagGeo.dispose();
      poleMat.dispose();
      poleGeo.dispose();
      capGeo.dispose();
      capMat.dispose();
      group.removeFromParent();
    }
  };
}
export {
  buildFlags
};
