import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
function mergeStaticChildren(group, { keep = [], castShadow = true, receiveShadow = false } = {}) {
  group.updateMatrix();
  const byMat = /* @__PURE__ */ new Map();
  const toRemove = [];
  for (const child of group.children) {
    if (!child.isMesh || child.isSkinnedMesh || child.isInstancedMesh || keep.includes(child)) continue;
    child.updateMatrix();
    const g = child.geometry.index ? child.geometry.clone() : child.geometry.clone();
    g.applyMatrix4(child.matrix);
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const ng = g.index ? g : g;
    if (!byMat.has(child.material)) byMat.set(child.material, []);
    byMat.get(child.material).push(ng.index ? ng : ng);
    toRemove.push(child);
  }
  for (const c of toRemove) {
    group.remove(c);
    c.geometry.dispose();
  }
  for (const [mat, geos] of byMat) {
    const allIndexed = geos.every((g) => g.index);
    const list = allIndexed ? geos : geos.map((g) => g.index ? g.toNonIndexed() : g);
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = castShadow;
    m.receiveShadow = receiveShadow;
    group.add(m);
  }
  return group;
}
function makeTwoSided(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    const n = a.count, size = a.itemSize;
    const arr = new Float32Array(n * size * 2);
    arr.set(a.array, 0);
    for (let t = 0; t < n; t += 3) {
      for (const [dst, src] of [[0, 0], [1, 2], [2, 1]]) {
        for (let c = 0; c < size; c++) arr[(n + t + dst) * size + c] = a.array[(t + src) * size + c];
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
export {
  makeTwoSided,
  mergeStaticChildren
};
