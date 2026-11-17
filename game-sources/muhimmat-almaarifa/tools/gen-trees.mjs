#!/usr/bin/env node
// يولّد مجسّمات أشجار الغابة مرة واحدة وقت التجهيز بمكتبة ez-tree (MIT) ويحفظها في ملف ثنائي مضغوط الحجم:
//   node tools/gen-trees.mjs   →  public/assets/models/trees.bin
// هكذا لا تُحمَّل المكتبة (٤ ميغابايت) مع اللعبة، ويُعاد استخدام كل شجرة عشرات المرات.
import { writeFileSync } from 'node:fs';

// المكتبة تنشئ خاماتها عند الاستيراد وتتوقع متصفحًا؛ يكفيها هذا البديل لأننا نأخذ الهندسة فقط
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
const { Tree } = await import('@dgreenheck/ez-tree');

const SPECS = [
  { name: 'oak', preset: 'Oak Medium', seed: 11, height: 9.5, bark: 'oak', leaf: 'oak',
    tweak: o => { Object.assign(o.branch.sections, { 0: 6, 1: 4, 2: 3, 3: 1 }); Object.assign(o.branch.segments, { 0: 6, 1: 4, 2: 3, 3: 3 }); Object.assign(o.branch.children, { 0: 5, 1: 3, 2: 2 }); o.leaves.count = 14; } },
  { name: 'ash', preset: 'Ash Medium', seed: 29, height: 11, bark: 'oak', leaf: 'ash',
    tweak: o => { Object.assign(o.branch.sections, { 0: 7, 1: 4, 2: 3, 3: 2 }); Object.assign(o.branch.segments, { 0: 6, 1: 4, 2: 3, 3: 3 }); Object.assign(o.branch.children, { 0: 5, 1: 3, 2: 2 }); o.leaves.count = 12; } },
  { name: 'pine', preset: 'Pine Medium', seed: 5, height: 13, bark: 'pine', leaf: 'pine',
    tweak: o => { Object.assign(o.branch.sections, { 0: 8, 1: 3 }); Object.assign(o.branch.segments, { 0: 6, 1: 3 }); o.branch.children[0] = 44; o.leaves.count = 14; } }
];

const chunks = []; let offset = 0; const header = { trees: [] };
const push = (typed) => { const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); const at = offset; chunks.push(b); offset += b.length; const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; } return { at, n: typed.length }; };

for (const s of SPECS) {
  const tree = new Tree();
  tree.loadPreset(s.preset); tree.options.seed = s.seed; s.tweak(tree.options);
  tree.generate();
  const entry = { name: s.name, bark: s.bark, leaf: s.leaf };
  let minY = Infinity, maxY = -Infinity;
  for (const [key, mesh] of [['branches', tree.branchesMesh], ['leaves', tree.leavesMesh]]) {
    const g = mesh.geometry, p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { minY = Math.min(minY, p.getY(i)); maxY = Math.max(maxY, p.getY(i)); }
    const idx = g.index.array, wide = p.count > 65535;
    entry[key] = { position: push(new Float32Array(p.array)), normal: push(new Float32Array(g.attributes.normal.array)), uv: push(new Float32Array(g.attributes.uv.array)),
      index: push(wide ? new Uint32Array(idx) : new Uint16Array(idx)), wide, triangles: idx.length / 3 };
  }
  entry.scale = s.height / (maxY - minY);          // إلى الأمتار
  header.trees.push(entry);
  console.log(s.name, 'مثلثات الأغصان', entry.branches.triangles, 'مثلثات الأوراق', entry.leaves.triangles, 'المقياس', entry.scale.toFixed(4));
}
const head = Buffer.from(JSON.stringify(header));
const pad = (4 - ((4 + head.length) % 4)) % 4;
const len = Buffer.alloc(4); len.writeUInt32LE(head.length + pad);
writeFileSync('public/assets/models/trees.bin', Buffer.concat([len, head, Buffer.alloc(pad, 0x20), ...chunks]));
console.log('public/assets/models/trees.bin', ((4 + head.length + pad + offset) / 1024).toFixed(0), 'KB');
