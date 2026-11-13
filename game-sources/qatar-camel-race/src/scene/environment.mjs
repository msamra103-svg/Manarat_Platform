import * as THREE from "three";
import { getSandMaps, addMacroVariation, getSkyTexture } from "./textures.mjs";
import { createRng, createValueNoise2D } from "../core/random.mjs";
import { createSkyLighting } from "./lighting.mjs";
import { buildBuildings } from "./buildings.mjs";
function buildEnvironment(scene, { trackLength, quality, renderer }) {
  const group = new THREE.Group();
  group.name = "environment";
  scene.add(group);
  const disposables = [];
  const track = (o) => {
    disposables.push(o);
    return o;
  };
  const skyLight = createSkyLighting(renderer, scene, { elevation: 27, azimuth: 128, size: 3e3 });
  const sky = skyLight.sky;
  const sunOffset = skyLight.sunDir.clone().multiplyScalar(75);
  scene.fog = new THREE.FogExp2("#cbc4b6", 11e-4);
  const hemi = new THREE.HemisphereLight("#bcd3f2", "#b98d5a", 0.34);
  group.add(hemi);
  const sun = new THREE.DirectionalLight("#ffe3ba", 3.7);
  sun.position.copy(sunOffset);
  sun.castShadow = quality !== "low";
  const sm = quality === "high" ? 4096 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera;
  sc.left = -30;
  sc.right = 30;
  sc.top = 20;
  sc.bottom = -20;
  sc.near = 20;
  sc.far = 180;
  sun.shadow.bias = -4e-4;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2;
  group.add(sun);
  group.add(sun.target);
  const desert = getSandMaps("desert");
  const dMap = desert.map.clone();
  dMap.needsUpdate = true;
  dMap.repeat.set(230, 90);
  const dNorm = desert.normalMap.clone();
  dNorm.needsUpdate = true;
  dNorm.repeat.set(230, 90);
  track(dMap);
  track(dNorm);
  const groundGeo = track(new THREE.PlaneGeometry(trackLength + 1400, 900, 1, 1));
  const groundMat = addMacroVariation(track(new THREE.MeshStandardMaterial({ map: dMap, normalMap: dNorm, normalScale: new THREE.Vector2(1, 1), roughness: 1, color: "#f8ecd6" })), 1.3);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(trackLength / 2, -0.02, 0);
  ground.receiveShadow = true;
  ground.name = "desertGround";
  group.add(ground);
  const noise = createValueNoise2D(77);
  const duneMat = addMacroVariation(track(new THREE.MeshStandardMaterial({ map: dMap, color: "#f3dcb6", roughness: 1 })), 1);
  for (const side of [1, -1]) {
    const w = trackLength + 1200, d = 260;
    const seg = quality === "low" ? [80, 16] : [160, 26];
    const geo = new THREE.PlaneGeometry(w, d, seg[0], seg[1]);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const edge = (y + d / 2) / d;
      const h = Math.pow(edge, 1.3) * (9 + 34 * noise.fbm(x * 6e-3, y * 0.01, 4)) + Math.sin(x * 0.02 + y * 0.03) * 1.2 * edge;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    track(geo);
    const dune = new THREE.Mesh(geo, duneMat);
    dune.rotation.x = -Math.PI / 2;
    dune.position.set(trackLength / 2, -0.5, side * (95 + d / 2) + (side > 0 ? 12 : -10));
    if (side < 0) dune.rotation.z = Math.PI;
    dune.receiveShadow = false;
    group.add(dune);
  }
  const buildings = buildBuildings(scene, { trackLength, quality });
  const rng = createRng(4242);
  const shrubMat = track(new THREE.MeshStandardMaterial({ color: "#6f7a45", roughness: 1 }));
  const trunkMat = track(new THREE.MeshStandardMaterial({ color: "#6b5238", roughness: 1 }));
  const shrubGeo = track(new THREE.IcosahedronGeometry(1, 1));
  const count = quality === "low" ? 90 : 420;
  const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const side = rng.next() < 0.5 ? -1 : 1;
    const z = side * (34 + Math.pow(rng.next(), 1.6) * 170);
    const x = -150 + rng.next() * (trackLength + 400);
    const sc2 = 0.4 + rng.next() * 1;
    p.set(x, sc2 * 0.4, z);
    s.set(sc2 * (1 + rng.next() * 0.6), sc2 * 0.6, sc2 * (1 + rng.next() * 0.6));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.next() * 6.28);
    m4.compose(p, q, s);
    shrubs.setMatrixAt(i, m4);
  }
  shrubs.castShadow = false;
  group.add(shrubs);
  const canopyGeo = track(new THREE.SphereGeometry(1, 10, 6));
  const tGeo = track(new THREE.CylinderGeometry(0.25, 0.4, 3, 6));
  const nTrees = quality === "low" ? 24 : 80;
  const trunks = new THREE.InstancedMesh(tGeo, trunkMat, nTrees);
  const crowns = new THREE.InstancedMesh(canopyGeo, shrubMat, nTrees);
  for (let i = 0; i < nTrees; i++) {
    const side = rng.next() < 0.7 ? 1 : -1;
    const x = -150 + rng.next() * (trackLength + 400), z = side * (48 + rng.next() * 190);
    m4.compose(new THREE.Vector3(x, 1.5, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 3.4, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.next() * 6), new THREE.Vector3(3.5 + rng.next(), 1.6, 3 + rng.next()));
    crowns.setMatrixAt(i, m4);
  }
  group.add(trunks, crowns);
  return {
    group,
    sun,
    hemi,
    // ظلال الشمس تتبع منطقة الكاميرا
    followShadow(target) {
      sun.position.set(target.x + sunOffset.x, sunOffset.y, target.z + sunOffset.z);
      sun.target.position.set(target.x, 0, target.z);
      sun.target.updateMatrixWorld();
      skyLight.follow(target);
    },
    setShadowQuality(q2) {
      sun.castShadow = q2 !== "low";
      const size = q2 === "high" ? 4096 : 2048;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) {
          sun.shadow.map.dispose();
          sun.shadow.map = null;
        }
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose && d.dispose());
      skyLight.dispose();
      buildings.dispose();
      group.removeFromParent();
    }
  };
}
export {
  buildEnvironment
};
