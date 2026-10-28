#!/usr/bin/env node
/* Builds a single self-contained HTML preview of صيد الأسماك V24 (standalone demo mode): all scripts, CSS and
 * the base64 GLB models are inlined; sounds are synthesised in the browser. For review / sharing only — the
 * platform integration uses games/fishing/index.html. Usage: node games/fishing/tools/build-preview.cjs [out.html]
 */
'use strict';
const fs = require('fs'), path = require('path');
const g = path.resolve(__dirname, '..'), repo = path.resolve(g, '..', '..'), out = path.resolve(process.argv[2] || path.join(repo, 'dist', 'fishing-v24-preview.html'));
let html = fs.readFileSync(path.join(g, 'index.html'), 'utf8');
const inline = (src) => { const clean = src.split('?')[0]; const file = clean.startsWith('../../') ? path.join(repo, clean.slice(6)) : clean.startsWith('../') ? path.join(repo, 'games', clean.slice(3)) : path.join(g, clean); return fs.readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script'); };
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (m, href) => '<style>' + fs.readFileSync(path.join(g, href.split('?')[0]), 'utf8') + '</style>');
{ const line = html.split('\n').find(l => l.includes("location.protocol === 'file:'")); html = html.replace(line, '<script>' + fs.readFileSync(path.join(g, 'assets/models/embedded-models.js'), 'utf8') + '</script>'); }
html = html.replace(/<script src="\.\.\/\.\.\/js\/platform-nav\.js[^"]*"><\/script>\n?/, '');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => '<script>' + inline(src) + '</script>');
html = html.replace('<title>صيد الأسماك</title>', '<title>صيد الأسماك</title>\n<meta name="description" content="معاينة مستقلة V24 — وضع تجريبي، لا تتصل بمنصة المدرسة">');
// hosted-page form: the host wraps the content in its own document skeleton
html = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '').replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<body[^>]*>/i, '<script>document.documentElement.lang="ar";document.documentElement.dir="rtl";document.body.dataset.phase="loading";</script>');
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
console.log('preview', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB');
