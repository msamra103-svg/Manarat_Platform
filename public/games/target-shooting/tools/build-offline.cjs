#!/usr/bin/env node
/* Builds the offline package of «التصويب على الهدف»:
 *   <out>/التصويب-على-الهدف-نسخة-المعلم.html   teacher version (control panel + question editor + student export)
 *   <out>/التصويب-على-الهدف-نسخة-الطالب.html   student version (no admin controls; demo questions until the teacher exports one)
 *   <out>/اقرأني.txt                            Arabic instructions
 *   <out>.zip                                  the same files zipped (when the `zip` tool is available)
 * Each HTML is fully self-contained (scripts, CSS, fonts, 3D model and textures inline): it opens from file://
 * with no network at all. Usage: node games/target-shooting/tools/build-offline.cjs [outDir]
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const GAME = path.resolve(__dirname, '..');
const Exporter = require(path.join(GAME, 'ui/export.js'));
const DEFAULT_OUT = path.join(GAME, '..', '..', 'dist', 'target-shooting-offline');

function build(outDir) {
  const out = path.resolve(outDir || DEFAULT_OUT);
  const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
  const markup = html.match(/<template id="app-markup">([\s\S]*?)<\/template>/)[1];
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].split('?')[0]).filter(s => !/platform-nav\.js$/.test(s));
  const scripts = srcs.map(s => fs.readFileSync(path.resolve(GAME, s), 'utf8'));
  const css = fs.readFileSync(path.join(GAME, 'style.css'), 'utf8');
  require(path.join(GAME, 'core/assets.js'));
  const manifest = globalThis.TS.assets.MANIFEST;
  const bundle = {};
  for (const name of [...manifest, ...Exporter.FONTS]) bundle[name] = fs.readFileSync(path.join(GAME, 'assets', name)).toString('base64');
  fs.mkdirSync(out, { recursive: true });
  const C = require(path.join(GAME, 'core/config.js'));
  const files = {
    'التصويب-على-الهدف-نسخة-المعلم.html': Exporter.assemble({ css, markup, scripts, bundle, preset: { role: 'teacher', config: null }, role: 'teacher', title: C.GAME_NAME + ' — نسخة المعلم' }),
    'التصويب-على-الهدف-نسخة-الطالب.html': Exporter.assemble({ css, markup, scripts, bundle, preset: { role: 'student', config: C.sanitize({}) }, role: 'student', title: C.GAME_NAME + ' — نسخة الطالب' })
  };
  files['اقرأني.txt'] = [
    'التصويب على الهدف — النسخة التي تعمل دون إنترنت',
    '',
    '١) نسخة المعلم: افتح «التصويب-على-الهدف-نسخة-المعلم.html» في متصفح حديث (Chrome أو Edge أو Safari أو Firefox).',
    '   اضغط «لوحة المعلم» لتعديل اسم المدرسة والدرس والتحدي والمستوى والأسئلة، ثم «حفظ وتطبيق».',
    '   من تبويب «التصدير» اضغط «تنزيل نسخة الطالب» لإنشاء ملف واحد يحمل أسئلتك وإعداداتك.',
    '٢) نسخة الطالب: ملف HTML واحد يُرسل للطلاب أو يُفتح على جهاز الصف؛ لا يحتوي لوحة المعلم.',
    '٣) لا يحتاج أي ملف إلى اتصال بالإنترنت: النموذج ثلاثي الأبعاد والصور والخطوط والأصوات مضمّنة.',
    '٤) نتائج النسخة غير المتصلة محلية للتدريب، ولا تُرسل إلى المنصة.',
    '',
    'الشخصية: Microsoft Rocketbox (MIT). المحرك: three.js (MIT). الخط: Tajawal (SIL OFL 1.1).',
    'المشاهد والأهداف والأصوات والموسيقى: عمل أصلي مولَّد برمجيًا لهذه اللعبة.'
  ].join('\r\n');
  for (const [n, c] of Object.entries(files)) fs.writeFileSync(path.join(out, n), c);
  let zip = null;
  try { zip = out + '.zip'; if (fs.existsSync(zip)) fs.unlinkSync(zip); cp.execFileSync('zip', ['-q', '-j', '-9', zip, ...Object.keys(files).map(n => path.join(out, n))]); } catch (e) { zip = null; }
  const sizes = Object.fromEntries(Object.keys(files).map(n => [n, fs.statSync(path.join(out, n)).size]));
  return { out, zip, sizes };
}

if (require.main === module) { const r = build(process.argv[2]); console.log('offline package:', r.out, r.zip ? '(+ ' + path.basename(r.zip) + ')' : ''); console.log(r.sizes); }
module.exports = { build };
