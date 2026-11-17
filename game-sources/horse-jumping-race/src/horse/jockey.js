import * as THREE from 'three';
import DATA from './jockey.data.js';
import { SPINE_JOINTS } from './horseAnatomy.js';

// الفارس (الجوكي): نموذج منحوت بوضعية السباق — ركاب قصير، جذع منحنٍ فوق الحارك، يدان على العنان.
// يُثبَّت على عظمة العمود الفقري للحصان ويتأرجح مع العدو، ويميل للأمام عند القفز.

function b64(str, Type) {
  const bin = atob(str);
  const buf = new ArrayBuffer(bin.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(buf);
}
const cache = {};
function base(lod) {
  if (cache[lod]) return cache[lod];
  const L = DATA.lods[lod];
  const pos = b64(L.pos, Float32Array);
  // إلى فضاء عظمة العمود الفقري
  for (let i = 0; i < pos.length; i += 3) { pos[i] -= SPINE_JOINTS.spine[0]; pos[i + 1] -= SPINE_JOINTS.spine[1]; }
  cache[lod] = { count: L.count, pos, idx: b64(L.idx, Uint16Array), nrm: b64(L.nrm, Int8Array), part: b64(L.part, Uint8Array), ao: b64(L.ao, Uint8Array) };
  return cache[lod];
}

const FIXED = { 3: '#f1efe9', 4: '#141414', 6: '#20262c', 7: '#f1efe9', 8: '#3a2415', 9: '#c9ccd0' };
const SKINS = ['#c9976f', '#a9764f', '#d8a983', '#8a5c3e'];

export function buildJockey({ color, trim, quality = 'high', seed = 0 }) {
  const B = base(quality === 'low' ? 'low' : 'high');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(B.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(B.nrm, 3, true));
  g.setIndex(new THREE.BufferAttribute(B.idx, 1));
  const col = new Float32Array(B.count * 3);
  const c = new THREE.Color(), silk = new THREE.Color(color), tr = new THREE.Color(trim), skin = new THREE.Color(SKINS[seed % SKINS.length]);
  const pattern = seed % 3; // 0 سادة بأكمام مغايرة، 1 أطواق، 2 وشاح قطري
  for (let v = 0; v < B.count; v++) {
    const part = B.part[v];
    const x = B.pos[v * 3], y = B.pos[v * 3 + 1], z = B.pos[v * 3 + 2];
    if (part === 0) {
      c.copy(silk);
      if (pattern === 1 && Math.floor((x + 1) * 9) % 2 === 0) c.copy(tr);
      if (pattern === 2 && Math.abs(x * 0.8 + z - 0.1) < 0.06) c.copy(tr);
    } else if (part === 1) c.copy(pattern === 0 ? tr : silk);
    else if (part === 2) c.copy(Math.abs(z) < 0.03 || pattern === 0 ? tr : silk);
    else if (part === 5) c.copy(skin);
    else c.set(FIXED[part] || '#888888');
    void y;
    const a = B.ao[v] / 255;
    col[v * 3] = c.r * a; col[v * 3 + 1] = c.g * a; col[v * 3 + 2] = c.b * a;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48 }); // حرير لامع قليلًا
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  const root = new THREE.Group();
  root.name = 'jockey';
  // محور التأرجح عند الركبتين (نقطة ارتكاز الفارس على الركاب)
  const pivot = new THREE.Vector3(0.28, 0.22, 0);
  mesh.position.copy(pivot).negate();
  const swing = new THREE.Group();
  swing.position.copy(pivot);
  swing.add(mesh);
  root.add(swing);
  const hand = new THREE.Vector3(DATA.hand[0] - SPINE_JOINTS.spine[0], DATA.hand[1] - SPINE_JOINTS.spine[1], DATA.hand[2]);
  let pitch = 0, vel = 0, bob = 0, time = seed;
  return {
    root, swing,
    // موضع اليد في فضاء جذر الفارس (لشدّ العنان)
    handLocal(side, out) { return out.set(hand.x, hand.y, hand.z * side).sub(pivot).applyQuaternion(swing.quaternion).add(swing.position); },
    update(dt, { bodyPitchVel = 0, speed = 0, frozen = false, jumpLean = 0, phase = 0 }) {
      if (frozen) return;
      time += dt;
      // الفارس يمتص حركة الحصان: يتأرجح عكس ميل الجسم، ويدفع بيديه مع كل خطوة عدو
      const g2 = Math.min(1, speed / 6);
      const target = -bodyPitchVel * 0.05 + Math.sin(phase * Math.PI * 2) * 0.045 * g2 - jumpLean * 0.32;
      const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
      for (let i = 0; i < n; i++) { vel += (120 * (target - pitch) - 16 * vel) * h; pitch += vel * h; }
      pitch = Math.max(-0.5, Math.min(0.4, pitch));
      bob += ((Math.cos(phase * Math.PI * 2) * 0.018 * g2 + jumpLean * 0.05) - bob) * Math.min(1, dt * 14);
      swing.rotation.z = pitch;
      swing.position.y = pivot.y + bob;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}
