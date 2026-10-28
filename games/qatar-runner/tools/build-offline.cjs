#!/usr/bin/env node
/* عدّاء قطر — single-file offline build: inlines CSS (+ Tajawal fonts), three.js and all game scripts into one
 * HTML that runs by double-click from file:// with no network. Also enables the teacher's "student version"
 * export (the page keeps a pristine copy of itself, see js/teacher.js).
 *   node tools/build-offline.cjs [outDir]
 */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), outDir = path.resolve(process.argv[2] || path.join(root, 'dist'));
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const esc = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
let css = fs.readFileSync(path.join(root, 'css/runner.css'), 'utf8');
css = css.replace(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g, (m, f) => `url('data:font/woff2;base64,${fs.readFileSync(path.join(root, 'assets/fonts', f)).toString('base64')}')`);
html = html.replace('<link rel="stylesheet" href="css/runner.css">', () => '<style>' + css + '</style>');
let n = 0;
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8'); n++;
  if (src === 'js/game.js') return '<script>window.__QR_SINGLE__=true;window.__QR_PRISTINE__=document.documentElement.outerHTML;</script>\n<script id="qr-game">' + esc(code) + '</script>';
  return '<script data-src="' + src + '">' + esc(code) + '</script>';
});
if (/<script[^>]*\ssrc=|<link[^>]*rel="stylesheet"/.test(html)) throw new Error('external reference left in offline build');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'qatar-runner-offline.html'); fs.writeFileSync(out, html);
console.log('offline build:', out, (html.length / 1024 / 1024).toFixed(2) + ' MB,', n, 'scripts inlined');
// claude.ai artifact variant: the host supplies doctype/html/head/body, printing and downloads are unavailable there
let art = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '').replace(/<head>/i, '').replace(/<\/head>/i, '').replace(/<body[^>]*>/i, '').replace(/<\/body>/i, '');
art = art.replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
const titleM = art.match(/<title>[^<]*<\/title>/); art = art.replace(titleM[0], '');
art = titleM[0] + '\n<style>:root{color-scheme:dark}</style>\n<script>document.documentElement.lang="ar";document.documentElement.dir="rtl";document.body.dataset.phase="boot";window.__QR_ARTIFACT__=true;</script>\n' + art;
fs.writeFileSync(path.join(outDir, 'qatar-runner-artifact.html'), art); console.log('artifact build:', (art.length / 1048576).toFixed(2) + ' MB');
