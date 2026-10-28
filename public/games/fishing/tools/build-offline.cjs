#!/usr/bin/env node
/* Builds the independent offline exports of صيد الأسماك V24 (double-click index.html, no server, no internet):
 *   <out>/fishing-v24-offline-student/   — game with the 3 labelled demo questions
 *   <out>/fishing-v24-offline-teacher/   — same + teacher.html to type local practice questions
 * Neither export can reach the school platform's question banks, grading or official reports.
 * Usage: node games/fishing/tools/build-offline.cjs [outDir]   (default: ./dist)
 */
'use strict';
const fs = require('fs'), path = require('path');
const repo = path.resolve(__dirname, '..', '..', '..'), out = path.resolve(process.argv[2] || path.join(repo, 'dist'));
const copy = (src, dst, skip) => { const s = fs.statSync(src); if (skip && skip.test(src)) return; if (s.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src)) copy(path.join(src, e), path.join(dst, e), skip); } else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); } };
function build(kind) {
  const dir = path.join(out, 'fishing-v24-offline-' + kind); fs.rmSync(dir, { recursive: true, force: true });
  const g = path.join(repo, 'games', 'fishing');
  for (const f of ['index.html', 'fishing.css']) copy(path.join(g, f), path.join(dir, 'games/fishing', f));
  for (const d of ['js', 'vendor', 'assets']) copy(path.join(g, d), path.join(dir, 'games/fishing', d), /\.(glb|wav)$/); // file:// uses the embedded GLB copy + locally synthesised audio
  if (kind === 'teacher') copy(path.join(g, 'teacher.html'), path.join(dir, 'games/fishing/teacher.html'));
  copy(path.join(repo, 'games/vendor/three.min.js'), path.join(dir, 'games/vendor/three.min.js'));
  copy(path.join(repo, 'js/platform-nav.js'), path.join(dir, 'js/platform-nav.js'));
  const links = kind === 'teacher' ? '<a class="b" href="games/fishing/teacher.html">إعداد أسئلة تدريبية للصف ←</a><a class="b q" href="games/fishing/index.html">تشغيل الأسئلة التجريبية</a>' : '<a class="b" href="games/fishing/index.html">ابدأ اللعب ←</a>';
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>صيد الأسماك</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b2733;color:#f4f1e8;font-family:"Noto Kufi Arabic","Segoe UI",Tahoma,sans-serif}main{max-width:560px;padding:28px;background:#0f3442;border-radius:20px;border:1px solid #ffffff2a}h1{margin:0 0 4px}p{line-height:1.8;color:#d7e3e3}.s{color:#f0c35a;font-weight:700}.b{display:block;text-align:center;margin-top:12px;padding:14px;border-radius:12px;background:#8A1538;color:#fff;text-decoration:none;font-weight:700}.q{background:#25505e}small{color:#9fb6b9}</style></head>
<body><main><h1>صيد الأسماك</h1><div class="s">مدرسة أبو عبيدة الإعدادية للبنين</div><p>نسخة ${kind === 'teacher' ? 'المعلم' : 'الطالب'} المستقلة — تعمل دون اتصال بالإنترنت. ${kind === 'teacher' ? 'يمكن كتابة أسئلة تدريبية محلية وعرضها على السبورة.' : 'تتضمن ثلاثة أسئلة تجريبية.'}</p>${links}
<p><small>هذه النسخة لا تتصل بمنصة المدرسة: لا تصل إلى بنوك الأسئلة ولا تُسجّل الدرجات أو التقارير الرسمية. للمهام الرسمية استخدم المنصة.</small></p></main></body></html>`);
  fs.writeFileSync(path.join(dir, 'README_OFFLINE_AR.txt'), `صيد الأسماك V24 — نسخة ${kind === 'teacher' ? 'المعلم' : 'الطالب'} دون اتصال\n\n1) افتح الملف index.html بمتصفح حديث (Chrome / Edge / Safari / Firefox).\n2) لا يلزم خادم ولا إنترنت. النماذج ثلاثية الأبعاد محمّلة من assets/models/embedded-models.js، والأصوات تُولَّد محليًا.\n3) القيود: لا اتصال بمنصة المدرسة، لا بنوك أسئلة، لا درجات رسمية، لا تقارير. النتائج تدريبية فقط وتُمسح عند إغلاق الصفحة.\n`);
  return dir;
}
fs.mkdirSync(out, { recursive: true });
for (const k of ['student', 'teacher']) console.log('built', build(k));
