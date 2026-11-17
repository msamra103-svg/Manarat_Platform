import * as THREE from 'three';
import DATA from './horseSculpt.data.js';

// فك بيانات الحصان المنحوت (مولّدة مسبقًا بأدوات tools/sculpt) وبناء الهندسة والمادة.

function b64(str, Type) {
  const bin = atob(str);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(buf);
}

const cache = {};
// الخصائص المشتركة بين كل الخيل (مواضع، عموديات، فهارس، أوزان) — تُفك مرة واحدة
function baseLOD(name) {
  if (cache[name]) return cache[name];
  const L = DATA.lods[name];
  const q = b64(L.pos, Uint16Array);
  const pos = new Float32Array(L.count * 3);
  for (let v = 0; v < L.count; v++) for (let c = 0; c < 3; c++) pos[v * 3 + c] = L.min[c] + (q[v * 3 + c] / 65535) * (L.max[c] - L.min[c]);
  const nq = b64(L.nrm, Int8Array);
  const nrm = new Float32Array(L.count * 3);
  for (let i = 0; i < nrm.length; i++) nrm[i] = nq[i] / 127;
  cache[name] = {
    count: L.count,
    position: new THREE.BufferAttribute(pos, 3),
    normal: new THREE.BufferAttribute(nrm, 3),
    index: new THREE.BufferAttribute(L.index32 ? b64(L.idx, Uint32Array) : b64(L.idx, Uint16Array), 1),
    skinIndex: new THREE.BufferAttribute(b64(L.si, Uint8Array), 4),
    skinWeight: new THREE.BufferAttribute(b64(L.sw, Uint8Array), 4, true),
    tone: b64(L.tone, Int8Array), ao: b64(L.ao, Uint8Array), mask: b64(L.mask, Uint8Array),
  };
  return cache[name];
}

// يعيد خريطة أسماء العظام في البيانات إلى فهارسها في الهيكل العظمي الفعلي
function remapSkin(attr, skeletonBones) {
  const names = DATA.bones;
  const map = names.map((n) => skeletonBones.findIndex((b) => b.name === n));
  const src = attr.array;
  const out = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = Math.max(0, map[src[i]]);
  return new THREE.BufferAttribute(out, 4);
}

const SKIN = {
  hoofDark: new THREE.Color('#1f1a17'), hoofLight: new THREE.Color('#a8977d'), nose: new THREE.Color('#161211'), sole: new THREE.Color('#2a231e'),
  white: new THREE.Color('#e8e3d8'), pink: new THREE.Color('#b98f84'),
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// colors: { base, belly, dark, points, socks: Set('FL','HR',...), blaze: bool }
export function sculptGeometry(lodName, skeletonBones, colors) {
  const B = baseLOD(lodName);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', B.position);
  g.setAttribute('normal', B.normal);
  g.setIndex(B.index);
  if (!B.skinIndexMapped) B.skinIndexMapped = remapSkin(B.skinIndex, skeletonBones);
  g.setAttribute('skinIndex', B.skinIndexMapped);
  g.setAttribute('skinWeight', B.skinWeight);
  // ألوان الرؤوس: لون الحصان × الانسداد المخبوز، سواد القوائم أو تحجيلها، الغُرّة، الحوافر، الخطم
  const col = new Float32Array(B.count * 3);
  const c = new THREE.Color();
  const P = B.position.array;
  const muzzle = colors.dark.clone().lerp(SKIN.nose, 0.6);
  for (let v = 0; v < B.count; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const t = B.tone[v] / 127;
    c.copy(colors.base);
    if (t > 0) c.lerp(colors.belly, Math.min(1, t)); else c.lerp(colors.dark, Math.min(1, -t));
    const m = B.mask[v];
    const leg = (x > 0 ? 'F' : 'H') + (z > 0 ? 'R' : 'L');
    const sock = colors.socks.has(leg);
    if (m === 6) {
      if (sock) c.lerp(SKIN.white, smooth(0.36, 0.3, y));
      c.lerp(sock && y < 0.33 ? SKIN.white : colors.points, sock ? 0 : smooth(0.56, 0.36, y));
    } else if (m === 2) c.copy(sock ? SKIN.hoofLight : SKIN.hoofDark);
    else if (m === 3) c.copy(muzzle).lerp(colors.blaze ? SKIN.pink : muzzle, 0.25);
    else if (m === 4) c.copy(SKIN.nose);
    else if (m === 5) c.copy(SKIN.sole);
    else if (m === 7 && colors.blaze) c.lerp(SKIN.white, 0.92);
    const a = B.ao[v] / 255;
    col[v * 3] = c.r * a; col[v * 3 + 1] = c.g * a; col[v * 3 + 2] = c.b * a;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.4, 1.2, 0), 2.6);
  return g;
}

export function sculptClothGeometry(skeletonBones) {
  const C = DATA.cloth;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(b64(C.pos, Float32Array), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(b64(C.uv, Float32Array), 2));
  g.setIndex(new THREE.BufferAttribute(b64(C.idx, Uint16Array), 1));
  g.setAttribute('skinIndex', remapSkin(new THREE.BufferAttribute(b64(C.si, Uint8Array), 4), skeletonBones));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(b64(C.sw, Uint8Array), 4, true));
  g.computeVertexNormals();
  return g;
}

export const SCULPT_HEAD = DATA.head;
export const SADDLE_TOP = DATA.saddleTop;
export const MANE_ROWS = DATA.mane;

// مادة الوبر: إسقاط ثلاثي المحاور لخامة الشعيرات في فضاء وضع الربط (تلتصق بالجلد أثناء الحركة)
// مع نتوءات مشتقة من الخامة نفسها، ولمعان مخملي على الحواف.
export function makeFurMaterial(furMap, colors, { scale = 9, bump = 0.18 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: furMap, vertexColors: true, roughness: 0.52, metalness: 0, // شعر قصير لامع
    sheen: 0.25, sheenRoughness: 0.45, sheenColor: colors.base.clone().lerp(colors.belly, 0.6),
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.furScale = { value: scale };
    sh.uniforms.furBump = { value: bump };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRestP;\nvarying vec3 vRestN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestP = position;\nvRestN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRestP;\nvarying vec3 vRestN;\nuniform float furScale;\nuniform float furBump;\nfloat qcrFurH;')
      .replace('#include <map_fragment>', `
        vec3 bw = pow(abs(normalize(vRestN)), vec3(4.0));
        bw /= (bw.x + bw.y + bw.z + 1e-5);
        vec3 rp = vRestP * furScale;
        vec4 fx = texture2D(map, rp.zy * vec2(1.0, 0.55));
        vec4 fy = texture2D(map, rp.xz);
        vec4 fz = texture2D(map, rp.xy * vec2(0.55, 1.0));
        vec4 fur = fx * bw.x + fy * bw.y + fz * bw.z;
        qcrFurH = dot(fur.rgb, vec3(0.3333));
        // تبقّع طبيعي واسع في لون الوبر (فروق تعرّض للشمس وكثافة شعر) + خطوط شعيرات دقيقة
        float mA = texture2D(map, vRestP.xy * 0.42 + vRestP.z * 0.3).r;
        float mB = texture2D(map, vRestP.zy * 0.57 + vRestP.x * 0.21 + 0.37).g;
        float mott = clamp((mA - mB) * 0.9, -0.07, 0.07);
        diffuseColor.rgb *= mix(vec3(1.0), fur.rgb * 1.06, 0.1) * (0.97 + mott);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 0.97, 0.9), clamp(mott * 4.0, 0.0, 1.0));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 dH = vec2(dFdx(qcrFurH), dFdy(qcrFurH)) * furBump * 0.02;
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1);
          vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  mat.customProgramCacheKey = () => 'hjr-coat';
  return mat;
}
