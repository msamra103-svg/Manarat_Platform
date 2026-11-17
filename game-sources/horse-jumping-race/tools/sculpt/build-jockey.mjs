// يولّد نموذج الفارس (جوكي) بوضعية السباق المنحنية فوق الحارك + السرج وسيور الركاب.
// الإحداثيات في فضاء الحصان (وضع الربط). الناتج: src/horse/jockey.data.js
import { writeFileSync } from 'node:fs';
import { Sculpt, ellipsoid as E, roundCone as RC, torus } from './sdf.mjs';
import { meshSDF, simplify, gradient } from './mesher.mjs';

const S = new Sculpt({ mirrorZ: true });
// أجزاء: 0 حرير الجسم، 1 حرير الأكمام، 2 غطاء الخوذة، 3 سروال أبيض، 4 حذاء أسود، 5 بشرة، 6 نظارة، 7 قفاز، 8 جلد السرج، 9 معدن الركاب
const TAGS = ['silk', 'sleeve', 'cap', 'breeches', 'boot', 'skin', 'goggle', 'glove', 'leather', 'metal'];

// السرج الخفيف وحزامه
S.add(E([0.0, 1.655, 0], [0.22, 0.03, 0.12]), 0.01, 'leather');
S.add(E([-0.17, 1.675, 0], [0.06, 0.035, 0.1]), 0.02, 'leather');   // مؤخرة السرج
S.add(E([0.03, 1.52, 0.2], [0.11, 0.14, 0.012], { x: 0.25 }), 0.01, 'leather'); // رفرف السرج
S.add(RC([0.1, 1.62, 0.17], [0.19, 1.3, 0.275], 0.012, 0.01), 0.004, 'leather'); // سير الركاب
S.add(torus([0.2, 1.245, 0.28], 0.05, 0.007, { x: Math.PI / 2, y: 0.0 }), 0.002, 'metal'); // الركاب
// الحذاء والساق (ركاب قصير: الركبة مرتفعة قرب الحارك)
S.add(E([0.215, 1.225, 0.28], [0.105, 0.035, 0.04], { z: -0.12 }), 0.012, 'boot');
S.add(RC([0.14, 1.26, 0.275], [0.30, 1.6, 0.24], 0.043, 0.058), 0.02, 'boot');
S.add(E([0.31, 1.635, 0.235], [0.065, 0.068, 0.06]), 0.02, 'breeches'); // الركبة
S.add(RC([0.30, 1.63, 0.235], [-0.1, 1.86, 0.115], 0.066, 0.085), 0.03, 'breeches'); // الفخذ
S.add(E([-0.13, 1.875, 0], [0.13, 0.105, 0.155]), 0.04, 'breeches'); // الحوض (مرفوع عن السرج)
// الجذع المنحني للأمام بالحرير
S.add(RC([-0.1, 1.9, 0], [0.3, 2.02, 0], 0.125, 0.14, 0.82), 0.04, 'silk');
S.add(E([0.3, 2.03, 0.15], [0.07, 0.065, 0.07]), 0.04, 'silk'); // الكتف
S.add(RC([0.33, 2.0, 0.18], [0.41, 1.81, 0.2], 0.05, 0.042), 0.02, 'sleeve'); // العضد
S.add(RC([0.41, 1.81, 0.2], [0.6, 1.765, 0.09], 0.042, 0.034), 0.02, 'sleeve'); // الساعد
S.add(E([0.635, 1.76, 0.075], [0.04, 0.03, 0.032]), 0.012, 'glove'); // القبضة على العنان
// الرقبة والرأس: ينظر للأمام من تحت حافة الخوذة
S.add(RC([0.38, 2.05, 0], [0.47, 2.1, 0], 0.045, 0.042), 0.02, 'skin');
S.add(E([0.52, 2.13, 0], [0.085, 0.095, 0.078], { z: -0.25 }), 0.015, 'skin');
S.add(E([0.575, 2.075, 0], [0.04, 0.045, 0.05]), 0.02, 'skin'); // الفك
S.add(RC([0.595, 2.13, 0], [0.615, 2.1, 0], 0.012, 0.015), 0.008, 'skin'); // الأنف
S.add(E([0.505, 2.165, 0], [0.108, 0.09, 0.098], { z: -0.25 }), 0.006, 'cap'); // الخوذة بغطائها الحريري
S.add(E([0.605, 2.185, 0], [0.05, 0.012, 0.07], { z: -0.3 }), 0.006, 'cap'); // الحافة الأمامية
S.add(E([0.585, 2.142, 0], [0.03, 0.026, 0.07]), 0.006, 'goggle'); // النظارة الواقية
S.add(RC([0.49, 2.06, 0.075], [0.55, 2.035, 0.02], 0.007, 0.007), 0.003, 'leather'); // رباط الذقن

const f = (x, y, z) => S.d(x, y, z);
let { positions, indices } = meshSDF(f, { min: [-0.36, 1.14, -0.4], max: [0.76, 2.32, 0.4], h: 0.0065 });
let agree = 0;
for (let i = 0; i < indices.length; i += 60) {
  const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
  const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
  const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
  const g = gradient(f, positions[a], positions[a + 1], positions[a + 2]);
  agree += Math.sign((uy * vz - uz * vy) * g[0] + (uz * vx - ux * vz) * g[1] + (ux * vy - uy * vx) * g[2]);
}
if (agree < 0) for (let i = 0; i < indices.length; i += 3) { const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t; }
const partOf = (x, y, z) => { let best = 0, bd = 1e9; TAGS.forEach((t, i) => { const d = Math.abs(S.tagDist(t, x, y, z)); if (d < bd) { bd = d; best = i; } }); return best; };
const nv = positions.length / 3;
const attrs = new Float32Array(nv * 3);
for (let v = 0; v < nv; v++) { const p = partOf(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); attrs[v * 3] = (p % 3) / 2; attrs[v * 3 + 1] = (Math.floor(p / 3) % 3) / 2; attrs[v * 3 + 2] = Math.floor(p / 9); }
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const out = { parts: TAGS, lods: {} };
for (const [name, tris, err] of [['high', 5200, 0.004], ['low', 1800, 0.02]]) {
  const s = await simplify(positions, indices, tris, err, attrs, [0.5, 0.5, 0.5]);
  const P = s.positions, n = P.length / 3;
  const nrm = new Int8Array(n * 3), part = new Uint8Array(n), ao = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const g = gradient(f, x, y, z, 0.002);
    for (let c = 0; c < 3; c++) nrm[v * 3 + c] = Math.round(g[c] * 127);
    let occ = 0;
    for (let i = 1; i <= 4; i++) { const dd = i * 0.02; occ += (dd - f(x + g[0] * dd, y + g[1] * dd, z + g[2] * dd)) / 2 ** i; }
    ao[v] = Math.round(Math.max(0.45, Math.min(1, 1 - 2.2 * Math.max(0, occ))) * 255);
    part[v] = partOf(x, y, z);
  }
  out.lods[name] = { count: n, pos: b64(Float32Array.from(P)), idx: b64(Uint16Array.from(s.indices)), nrm: b64(nrm), part: b64(part), ao: b64(ao) };
  console.log(name, n, s.indices.length / 3);
}
out.hand = [0.655, 1.755, 0.07];
const js = `// ملف مولَّد آليًا بواسطة tools/sculpt/build-jockey.mjs — لا تعدّله يدويًا.\nexport default ${JSON.stringify(out)};\n`;
writeFileSync(new URL('../../src/horse/jockey.data.js', import.meta.url), js);
console.log('written', (js.length / 1024).toFixed(0), 'KB');
