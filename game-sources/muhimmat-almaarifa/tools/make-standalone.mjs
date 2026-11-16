#!/usr/bin/env node
// يصنع ملف HTML واحدًا يعمل بالنقر المزدوج بلا خادم ولا إنترنت:
//   node tools/make-standalone.mjs   →  standalone/muhimmat-almaarifa-offline.html
// يضمّن الشيفرة والأنماط والخطوط والنموذج وخامات المقاس 512 داخل الملف نفسه.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const dist = 'dist', out = 'standalone/muhimmat-almaarifa-offline.html';
const b64 = (file, mime) => `data:${mime};base64,${readFileSync(file).toString('base64')}`;
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const cssTag = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
const jsTag = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
if (!cssTag || !jsTag) throw new Error('لم أجد ملفات الشيفرة في dist/index.html — نفّذ npm run build أولًا');

const cssFile = join(dist, cssTag[1]);
let css = readFileSync(cssFile, 'utf8').replace(/url\(([^)]+)\)/g, (m, u) => {
  const p = u.replace(/["']/g, '');
  if (p.startsWith('data:')) return m;
  if (p.endsWith('.woff2')) return `url(${b64(join(dirname(cssFile), p), 'font/woff2')})`;
  return 'url(data:,)';                       // صيغة woff القديمة غير لازمة هنا
});
const js = readFileSync(join(dist, jsTag[1]), 'utf8').replace(/<\/script/gi, '<\\/script');

const inline = {};
for (const f of readdirSync(join(dist, 'assets/textures/512'))) inline[`assets/textures/512/${f}`] = b64(join(dist, 'assets/textures/512', f), 'image/webp');
inline['assets/models/soldier.glb'] = b64(join(dist, 'assets/models/soldier.glb'), 'model/gltf-binary');
inline['assets/models/trees.bin'] = b64(join(dist, 'assets/models/trees.bin'), 'application/octet-stream');

html = html.replace(cssTag[0], () => `<style>${css}</style>`)
  .replace(jsTag[0], () => `<script>window.__MM_INLINE=${JSON.stringify(inline)};</script>\n<script type="module">${js}</script>`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}  ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB`);
