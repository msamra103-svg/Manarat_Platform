import * as THREE from "three";
import DATA from "./people.data.mjs";
function b64(str, Type) {
  const bin = atob(str);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(buf);
}
function decode(m) {
  const q = b64(m.pos, Uint16Array);
  const pos = new Float32Array(m.count * 3);
  const uv = new Float32Array(m.count * 2);
  for (let v = 0; v < m.count; v++) {
    for (let c = 0; c < 3; c++) pos[v * 3 + c] = m.min[c] + q[v * 3 + c] / 65535 * (m.max[c] - m.min[c]);
    uv[v * 2] = (Math.atan2(pos[v * 3], pos[v * 3 + 2]) / (2 * Math.PI) + 0.5) * 16;
    uv[v * 2 + 1] = pos[v * 3 + 1] * 26;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(b64(m.nrm, Int8Array), 3, true));
  g.setAttribute("color", new THREE.BufferAttribute(b64(m.col, Uint8Array), 3, true));
  g.setAttribute("tintMask", new THREE.BufferAttribute(b64(m.tint, Uint8Array), 1, true));
  g.setAttribute("patternMask", new THREE.BufferAttribute(b64(m.pat, Uint8Array), 1, true));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(b64(m.idx, Uint16Array), 1));
  g.computeBoundingSphere();
  return g;
}
const PERSON_TYPES = DATA.types.map((t) => ({
  key: t.key,
  seated: t.seated,
  bisht: t.bisht,
  shemagh: t.shemagh,
  shoulderY: t.shoulderY,
  shoulderX: t.shoulderX
}));
function buildPersonGeometry(typeIndex, lod = 0) {
  return decode(DATA.types[typeIndex].body[lod]);
}
function buildArmGeometry(typeIndex, lod = 0) {
  return decode(DATA.types[typeIndex].arm[lod]);
}
const THOBE_TINTS = [
  ["#ffffff", 0.5],
  ["#f3ecdc", 0.14],
  ["#cfcfcc", 0.11],
  ["#b9a586", 0.08],
  ["#8f8a84", 0.06],
  ["#5b6372", 0.05],
  ["#7a6652", 0.06]
];
let patternTex = null;
function getShemaghTexture() {
  if (patternTex) return patternTex;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f6f2ef";
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "rgba(176,28,44,0.9)";
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * 16 + 3, j * 16 + 3, 10, 10);
  ctx.fillStyle = "rgba(176,28,44,0.6)";
  for (let i = 0; i < 2; i++) {
    ctx.fillRect(i * 16 + 7, 0, 2, 32);
    ctx.fillRect(0, i * 16 + 7, 32, 2);
  }
  patternTex = new THREE.CanvasTexture(c);
  patternTex.colorSpace = THREE.SRGBColorSpace;
  patternTex.wrapS = patternTex.wrapT = THREE.RepeatWrapping;
  patternTex.anisotropy = 4;
  return patternTex;
}
function makePeopleMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: getShemaghTexture(), roughness: 0.84, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float tintMask;\nattribute float patternMask;\nvarying float vPattern;").replace("#include <color_vertex>", `
        vColor = vec4(1.0);
        vColor.rgb *= color.rgb;
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, tintMask);
        #endif
        vPattern = patternMask;`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vPattern;").replace("#include <map_fragment>", `
        #ifdef USE_MAP
          vec4 pt = texture2D(map, vMapUv);
          diffuseColor.rgb *= mix(vec3(1.0), pt.rgb, vPattern);
        #endif`);
  };
  mat.customProgramCacheKey = () => "qcr-people";
  return mat;
}
function disposePeopleShared() {
  patternTex?.dispose();
  patternTex = null;
}
export {
  PERSON_TYPES,
  THOBE_TINTS,
  buildArmGeometry,
  buildPersonGeometry,
  disposePeopleShared,
  makePeopleMaterial
};
