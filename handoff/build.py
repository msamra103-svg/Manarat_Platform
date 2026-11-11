#!/usr/bin/env python3
import json,re,shutil,hashlib,zipfile,sys,subprocess
from pathlib import Path
SRC=Path('source');ROOT=Path('work/AbuUbaida_Platform_UI_Claude');OUT=Path('packages');COMMIT='070fedaefed768135c58cb3d25c95a03fa64c01a'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,s):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8')
def js(p,v):write(p,json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def prepare():
 if ROOT.exists():shutil.rmtree(ROOT)
 project=ROOT/'project';project.mkdir(parents=True);upstream={};redactions=[]
 candidates=[]
 for rel in ('index.html','auth.html','auth-legacy.html'):
  if (SRC/rel).is_file():candidates.append(SRC/rel)
 for rel in ('js','css','admin','teacher','src'):
  candidates.extend(p for p in (SRC/rel).rglob('*') if p.is_file() and p.suffix in ('.html','.js','.mjs','.css','.jsx','.json'))
 candidates.extend(p for p in (SRC/'assets/game-covers').rglob('*') if p.is_file() and p.suffix.lower() in ('.svg','.png','.jpg','.jpeg','.webp'))
 candidates.extend(p for p in (SRC/'assets').glob('*.svg') if p.name in ('school-mark.svg','school-logo.svg'))
 for p in sorted(set(candidates)):
  rel=p.relative_to(SRC).as_posix();q=project/rel;upstream[rel]=sha(p)
  if p.suffix in ('.html','.js','.mjs','.css','.jsx','.json','.svg'):
   text=p.read_text();old=text
   text=re.sub(r'https://[a-z0-9-]+\.supabase\.co','https://ui-preview.invalid',text)
   text=re.sub(r'sb_publishable_[A-Za-z0-9_-]+','LOCAL_UI_PREVIEW_NO_KEY',text)
   text=text.replace('yltlzogrhwvnmxcnaesu','LOCAL_UI_PREVIEW')
   text=re.sub(r'[A-Za-z0-9._%+-]+@(?:gmail|hotmail|outlook)\.com','redacted@preview.invalid',text)
   text=re.sub(r'@import\s+(?:url\()?\s*[\"\x27]?https?://[^;]+;','/* External font/style import removed in isolated preview. */',text)
   text=re.sub(r'@font-face\s*\{[^}]*\}','/* Use system fonts in the handoff. */',text,flags=re.S)
   text=re.sub(r'<link\b[^>]*href=[\"\x27]https://fonts\.[^>]+>','',text,flags=re.I)
   if re.search(r'(?:sb_secret_[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{25,}|sk-proj-[A-Za-z0-9_-]{20,})',text):raise RuntimeError('Possible secret in '+rel)
   write(q,text)
   if text!=old:redactions.append(rel)
  else:q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
 for a,b in [('mock.js','project/dev/mock.js'),('after-core.js','project/dev/after-core.js'),('serve.cjs','tools/serve.cjs'),('export_return.py','tools/export_return.py')]:
  target=ROOT/b;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(Path('handoff')/a,target)
 for d in ('screenshots','proposals'): (ROOT/d).mkdir()
 ui=project/'ui-redesign';ui.mkdir()
 write(ui/'tokens.css','/* Editable design tokens. Keep the school identity: burgundy #8A1538 and white. */\n:root{--abu-brand:#8a1538;--abu-white:#fff;--abu-gold:#ba965a;}\n')
 for f,scope in [('public','body.school-app:not(.admin-embedded):not(.playing-game)'),('admin','body.admin-page'),('teacher','body.school-app .teacher-workspace'),('studio','body.admin-embedded .design-studio')]:write(ui/(f+'.css'),'/* Claude: build the new '+f+' visual system here. Scope styles to '+scope+'. Do not override gameplay. */\n')
 write(ui/'components.js','/* UI presentation enhancements only. No auth, cloud writes, grading, API replacements or game engine changes. Preserve IDs and event hooks. */\n(()=>{\"use strict\";})();\n')
 nav=[('الرئيسية','/index.html?previewRole=guest'),('دخول المعلم','/index.html?login=1&previewRole=guest'),('مساحة المعلم','/index.html?dashboard=1&previewRole=teacher'),('منشئ الألعاب والأسئلة','/teacher/create-game.html?previewRole=teacher'),('لوحة الإدارة الكاملة','/admin/admin.html?previewRole=admin')]+[(v,'/index.html?adminPanel='+k+'&previewRole=admin') for k,v in [('settings','استوديو التصميم'),('teachers','المستخدمون والصلاحيات'),('students','الطلاب'),('assignments','المهمات والواجبات'),('videos','الفيديوهات'),('reports','النتائج والتصحيح')]]
 write(project/'dev/start.html','<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>حزمة واجهة أبو عبيدة</title><style>body{font:18px/1.8 Tahoma,Arial;background:#f6f3ef;color:#30212a;max-width:1000px;margin:40px auto;padding:24px}h1{color:#8a1538}nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}a{padding:16px;background:white;border:1px solid #e5d5da;border-radius:12px;color:#8a1538;text-decoration:none}button{padding:12px;font:inherit}</style></head><body><h1>واجهة المنصة ولوحات التحكم</h1><p>نسخة محلية فقط، ببيانات اصطناعية. هذه الحزمة أساس للتطوير وليست التصميم النهائي الجديد.</p><nav>'+''.join('<a href="'+url+'">'+title+'</a>' for title,url in nav)+'</nav><p>البيانات تحفظ في متصفح المعاينة فقط. لا تدخل بيانات أو كلمات مرور حقيقية.</p><button onclick="localStorage.clear();location.reload()">إعادة البيانات التجريبية</button></body></html>')
 write(ROOT/'START_WINDOWS.cmd','@echo off\r\ncd /d "%~dp0"\r\nnode tools\\serve.cjs\r\npause\r\n')
 write(ROOT/'START_MAC_LINUX.sh','#!/bin/sh\ncd "$(dirname "$0")" || exit 1\nexec node tools/serve.cjs\n')
 js(ROOT/'package.json',{'name':'abu-ubaida-platform-ui-handoff','private':True,'version':'1.0.0','scripts':{'start':'node tools/serve.cjs','check':'python3 tools/export_return.py --check','export':'python3 tools/export_return.py'}})
 js(ROOT/'UPSTREAM_HASHES.json',upstream)
 js(ROOT/'SANITIZATION_REPORT.json',{'source_commit':COMMIT,'modified_for_local_preview_only':redactions,'production_service_keys_removed':True,'real_account_emails_redacted':True,'database_export_included':False,'fonts_included':False,'game_engines_included':False,'source_is_not_drop_in_production':True})
 js(ROOT/'handoff.json',{'source_repository':'msamra103-svg/Manarat_Platform','source_commit':COMMIT,'date':'2026-11-11','scope':'Homepage, teacher workspace, admin shell, embedded school management panels, design studio and question editor appearance','editable':'project/ui-redesign/','review_only':'proposals/','immutable':'Everything else under project/ and tools/','production_access_granted':False,'deploy_authorized':False,'preview_port':8766,'source_uses_sanitized_placeholders':True,'direct_return_includes':'UI overlay files only; never dev adapters or full platform source'})
 active={'homepage':['index.html','js/school.js','js/homepage-hub-logic.js','js/game-covers.js','js/design-runtime.js'],'teacher':['index.html?dashboard=1','js/school.js','js/student-analytics.js'],'admin':['admin/admin.html','js/admin.js','js/admin-unified.js','js/admin-requests.js'],'embedded_panels':['index.html?adminPanel=settings','index.html?adminPanel=teachers','index.html?adminPanel=students','index.html?adminPanel=assignments','index.html?adminPanel=videos','index.html?adminPanel=reports'],'studio':['js/design-schema.js','js/design-studio.js','js/design-runtime.js'],'editor':['teacher/create-game.html','js/create-game.js'],'readonly_core':['js/core.js','js/admin-requests.js'],'warning':'Legacy home.js/dashboard.js may remain in source but current homepage and teacher workspace use school.js. Do not redesign only an inactive legacy route.'}
 js(ROOT/'ACTIVE_UI_MAP.json',active)
 hooks={}
 for p in project.rglob('*'):
  if p.is_file() and p.suffix in ('.js','.html') and '/dev/' not in str(p):
   t=p.read_text();ids=sorted(set(re.findall(r'\bid=[\"\x27]([A-Za-z][\w-]*)[\"\x27]',t)));attrs=sorted(set(re.findall(r'\b(data-(?:action|tab|studio-cmd|design-path|module|school-panel|jump-tab))',t)))
   if ids or attrs:hooks[p.relative_to(project).as_posix()]={'ids':ids,'data_attributes':attrs}
 js(ROOT/'DOM_HOOKS_READ_ONLY.json',hooks)
 write(ROOT/'START_HERE_AR.md',f'''# حزمة تطوير الشكل العام ولوحات التحكم — مدرسة أبو عبيدة

هذه حزمة مصدر ومعاينة مستقلة لتسليمها لكلود، وليست تحديثًا منشورًا ولا تصميمًا جديدًا جاهزًا. مصدرها النسخة {COMMIT}. لا تمنح أي صلاحية إلى GitHub أو Vercel أو Supabase ولا تتضمن بيانات الطلاب الحقيقية.

## العمل مع كلود
أرفق هذا ZIP في محادثة تطوير مستقلة. اطلب قراءة CLAUDE_PROMPT_AR.md وDESIGN_BRIEF_AR.md وINTEGRATION_CONTRACT_AR.md وQA_REPORT.json قبل التعديل. التعديلات المباشرة داخل project/ui-redesign فقط، وتغييرات قوالب HTML العميقة تقدم كمقترحات منفصلة في proposals للمراجعة.

## المعاينة
يتطلب التشغيل Node.js. من مجلد الحزمة شغّل: node tools/serve.cjs
ثم افتح: http://127.0.0.1:8766/
لا يحتاج التشغيل إلى npm install ولا مفاتيح ولا حساب مدرسة. لا تفتح ملف HTML عبر file://. شاشة البداية تحتوي روابط الرئيسية والمعلم والإدارة والمستخدمين والطلاب والإسنادات والفيديوهات والتقارير واستوديو التصميم ومنشئ الأسئلة.

## فصل المصدر عن التجربة
project يحتوي المصدر الحالي بعد إزالة عناوين الخدمة والمفاتيح العامة والبريد الشخصي وإيقاف الخطوط الخارجية. جميع هذه الملفات مرجع للقراءة والتشغيل لا للاستبدال في الإنتاج. خادم المعاينة يضيف أدوات dev تلقائيًا أثناء العرض فقط؛ لا يحفظها في HTML المرشح للإنتاج. ألعاب ثلاثية الأبعاد والبث والفيديو الفعلي وخدمات AI غير مرفقة؛ مواضعها خارج نطاق التصميم.

الحفظ وتغيير البيانات هنا محاكاة محلية، وليسا اتصالًا بقاعدة البيانات. الصور الرسمية أو صور المبنى المخزنة خارج مستودع الشيفرة ليست ضمن الحزمة؛ لا نختلق شعارًا رسميًا أو مبنى بديلًا. يستخدم المصمم المساحة المخصصة ويحتفظ بمرجع إدراج الأصل الحقيقي عند الدمج.

## التسليم
اطلب تشغيل python3 tools/export_return.py --check ثم python3 tools/export_return.py. أرسل ملف AbuUbaida_UI_RETURN_FOR_REVIEW.zip إلى شات لمراجعة المرشحات والاختبارات وإعادة الدمج عند طلبك. لا تنسخ project فوق المنصة ولا تعطي كلود صلاحية النشر.
''')
 write(ROOT/'DESIGN_BRIEF_AR.md','''# موجز التصميم المعتمد

الهوية: مدرسة أبو عبيدة الإعدادية للبنين. العنابي #8A1538 والأبيض #FFFFFF أساس الواجهة، رمادي دافئ للخلفيات، ذهبي محدود للجوائز. لوحة التحكم فاتحة بنصوص داكنة وتباين واضح، لا خلفيات قديمة داكنة ولا هيمنة الأزرق والسماوي والنيون. لا يظهر اسم منارة التعلم أو MANARAT في الهوية المرئية؛ لا تغيّر المعرفات البرمجية الداخلية لمجرد حملها الاسم.

المطلوب تطوير فعلي للتخطيط وتجربة الاستخدام: رأس وتنقل واضح، عرض رئيسي منظم، بطاقات ألعاب جميلة بصورها الحالية، مؤشرات مرتبة، نجوم الأسبوع، الفيديوهات والتذييل. الإدارة بقائمة جانبية واضحة قابلة للطي وبحث وعناوين وتسلسل موحد؛ جداول ذات مساحة مناسبة وفلاتر وبحث وحالات فارغة ورسائل نجاح وفشل وتحميل؛ أزرار الحذف والتعليق منفصلة عن الأزرار العادية. لا حذف وظائف أو استبدال أزرار حقيقية بأزرار شكلية.

لوحة المعلم: الألعاب والإسنادات والفيديوهات والنتائج والتحليلات. منشئ الأسئلة: حقول بعرض كاف وتباين ممتاز لجميع أنواع السؤال وأدوات الإضافة والنسخ والاستيراد؛ ممنوع كسر JSON أو تغيير schema. استوديو التصميم: الأدوات والحقول وترتيب الأقسام ومعاينة iframe والأجهزة والحفظ والتراجع والتاريخ.

تصميم عربي RTL كامل، أرقام ومحاذاة مقروءة، خطوط نظامية عربية مناسبة دون ملفات خطوط مرفقة. حجم الأهداف اللمسية مناسب للسبورة؛ دعم 390 و768 و1440 و1920 بكسل. دعم لوحة المفاتيح والتركيز المرئي وتقليل الحركة. استهدف متطلبات WCAG 2.2 AA للتباين: 4.5:1 للنص العادي و3:1 للنص الكبير، مع قياس الفعلي وعدم الاكتفاء بادعاء المطابقة. لا صور أشخاص افتراضية ولا بيانات مدرسية حقيقية.

لا تغيّر طريقة اللعب أو شاشات المحرك أو احتساب الدرجات أو التسجيل أو الصلاحيات أو الحفظ الحقيقي. امنع وصول CSS العام إلى iframes الألعاب أو body.playing-game. نسخة واجهات الإدارة داخل iframe تحتاج نفس لغة التصميم؛ لا تصلح الغلاف وتترك محتوى الأقسام قديمًا.

قدّم قبل/بعد وسجلًا للمكونات والألوان والمسافات وأحجام الخطوط، وفسّر القيود الباقية. لا تدّع أن الحزمة هي النسخة المنشورة أو أن المعاينة تثبت صحة قاعدة البيانات.
''')
 write(ROOT/'CLAUDE_PROMPT_AR.md','''أنت مهندس واجهات وتجربة استخدام خبير في المنصات التعليمية ولوحات التحكم العربية. طوّر الشكل العام ولوحة المعلم ولوحة مدير منصة ألعاب مدرسة أبو عبيدة الإعدادية للبنين اعتمادًا على هذه الحزمة، لا تبنِ منصة جديدة ولا تغيّر بياناتها أو خدماتها.

ابدأ بفك الحزمة وقراءة START_HERE_AR.md وDESIGN_BRIEF_AR.md وACTIVE_UI_MAP.json وDOM_HOOKS_READ_ONLY.json وINTEGRATION_CONTRACT_AR.md وQA_REPORT.json. شغّل المعاينة المحلية واقرأ الملفات التي تستخدمها المسارات الفعلية، لا تنشغل بواجهة legacy غير نشطة.

أريد تغييرًا واضحًا ومدروسًا في التخطيط والبطاقات والجداول والنماذج والتنقل والتباين والتجاوب، لا مجرد تبديل ألوان أو صورة تصميم. احتفظ بالعنابي والأبيض والاسم الصحيح للمدرسة، ولوحة تحكم فاتحة واضحة. أزل الاسم المرئي القديم MANARAT أو منارة من الواجهة المقترحة دون تغيير أسماء الدوال والمعرفات الداخلية. لا تنشئ شعار وزارة أو مدرسة مزيفًا.

نفّذ التعديلات المعزولة في project/ui-redesign/. خادم المعاينة يحمّل tokens.css وpublic.css وadmin.css وteacher.css وstudio.css وcomponents.js في الصفحات والأقسام المضمنة. تستطيع إضافة ملفات وأصول داخل ذلك المجلد واستدعاءها منه. استخدم نطاقات CSS واضحة ولا تلمس body.playing-game أو محركات الألعاب. يمكنك إعادة تنظيم العناصر باستخدام DOM مع الحفاظ على nodes الحالية وIDs وdata attributes والأحداث وقيم النماذج. لا تعِد رسم النماذج في كل تحديث بما يضيّع التركيز أو المدخلات. عند الحاجة لتغيير قالب عرض في ملفات الأصل، ضع patch عرض فقط في proposals/ مع سبب التغيير وتعليمات دمج واختبار، ولا تعدّل ملفات الأصل المقفلة ولا تعتمد على patch غير مطبق في المعاينة.

ثوابت ممنوع كسرها: تسجيل الدخول وتجديد الجلسة وإصلاح التشغيل الجماعي؛ الصلاحيات والملكية؛ واجهات API والـpayloads؛ أسماء الحقول والجداول؛ رفع الصور والفيديو؛ حفظ التصميم والمراجعات؛ بنوك الأسئلة وJSON؛ منع تكرار تسجيل النتائج؛ postMessage للمعاينة والألعاب وفحوص origin/source/token/index. لا تُدخل بيانات وهمية في ملفات المرشح للإنتاج؛ البيانات التجريبية يجب أن تظل في dev فقط. لا تعتمد على session التجريبية أو bypass صلاحيات بعد الدمج.

لا تدخل إلى GitHub أو Vercel أو Supabase، لا تطلب مفاتيح أو حسابات، لا push ولا نشر ولا تغيير main. لا تعدّل ملفات dev أو tools أو baseline لتجاوز الاختبارات. لا تستخدم مكتبات CDN أو خطوط مرفقة، ولا تحمل ملفات من المنصة الحية. اعمل على المصدر المحلي فقط. أي مكتبة جديدة يجب أن تكون محلية مرخصة ومعزولة ومبررة، وبدون سلسلة بناء معقدة غير لازمة.

اختبر الرئيسية والدخول والمعلم والإدارة وجميع الأقسام المضمنة واستوديو التصميم ومنشئ الأسئلة، والبحث والطي والحقول والنوافذ والحالات الفارغة والحفظ المحلي والتراجع والتاريخ. اختبر 390/768/1440/1920 بكسل واللمس ولوحة المفاتيح وتقليل الحركة. قِس التباين والأداء واكتب ما اختبرته فعلًا وما بقي، ولا تدّع اختبار حسابات أو خدمات حقيقية؛ هذه حزمة محاكاة فقط.

سلّم المصدر المعدل داخل نطاقه، CHANGELOG.md وTEST_RESULTS.md وASSET_LICENSES.md وKNOWN_ISSUES.md، ولقطات قبل/بعد من المسارات الفعلية. شغّل python3 tools/export_return.py --check ثم python3 tools/export_return.py، وسلّم AbuUbaida_UI_RETURN_FOR_REVIEW.zip. لا تسلّم ملف HTML يستبدل المنصة ولا خطة فقط ولا تنشر أي شيء.
''')
 write(ROOT/'INTEGRATION_CONTRACT_AR.md','''# عقد إعادة الدمج الآمن

هذا المصدر منقّح للمعاينة المحلية؛ يُمنع نسخه كاملًا إلى المنصة. جميع ملفات project الأصلية وdev وtools للقراءة والتشغيل فقط. المرشح المباشر الوحيد هو ui-redesign/؛ أدوات التصدير ترفض تغيير الملفات المقفلة وإضافة ملفات خارج النطاق.

يحمل ملف العودة candidate/ui-redesign/ وCHANGES.json وتوثيق التسليم فقط. proposals/ مقترحات قراءة ومراجعة بشرية وليست patch ينفذ تلقائيًا. لا يتضمن الملف mock.js أو after-core.js أو core.js أو مفاتيح أو جلسات أو إعدادات نشر.

قبل الدمج: قارن commit وبصمات المصدر مع أحدث نسخة، راجع شيفرة components.js وCSS والأصول. أضف تحميل ملفات CSS والـJS إلى الصفحات المطلوبة فقط، مع تحميلها داخل إطارات adminPanel أيضًا. لا تستخدم خادم المعاينة في الإنتاج. أبقِ استوديو الهوية مصدرًا للإعدادات؛ لا تُثبت الألوان inline بطريقة تلغي تحكم المدير. لا تنسخ التعديلات إلى public يدويًا قبل مزامنة المصدر عبر build المشروع الحالي.

اختبارات ما قبل النشر: الدخول والصلاحيات؛ الرئيسية؛ كل تبويب أدمن؛ حفظ/تراجع/استعادة التصميم؛ إضافة سؤال وإسناد؛ تشغيل جماعي وفردي وواجب منزلي؛ تحميل الألعاب الحالية دون أن تتأثر أنماطها؛ تقارير ودرجات وتصدير. الاختبار المحلي هنا لا يغني عن اختبار تكامل مأذون في بيئة مراجعة. لا نشر حتى طلب المستخدم الصريح.

العودة سهلة لأن طبقة التصميم منفصلة مع بصمات أصل وملف تغييرات. السهولة ليست ضمانًا للدمج التلقائي: أي إعادة هيكلة عميقة تتطلب مراجعة patch القالب. أبقِ نسخة رجوع من تحميل الطبقة؛ عدم تحميلها يعيد التصميم السابق.

مراجع تقنية عامة: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src
https://www.w3.org/TR/WCAG22/#contrast-minimum
''')
 write(ROOT/'proposals/README.md','# مقترحات تغيير القوالب\nضع هنا فقط diff أو patch أو شرحًا لتغيير طبقة العرض، دون تنفيذ تلقائي ودون تعديل بيانات أو auth أو API. ملفات المصدر المنقحة ليست صالحة للاستبدال في الإنتاج.\n')
 write(ROOT/'ASSET_LICENSES.md','# الأصول والتراخيص\nصور أغلفة الألعاب والشعار الثابت من مستودع المشروع. لم تُجلب صور المدرسة أو شعاراتها من قاعدة البيانات. احتفظ بإشعارات تراخيص المكتبات الأصلية، ووثّق أي أصل جديد. لا ملفات خطوط.\n')
 js(ROOT/'ui-initial.sha256.json',{p.relative_to(project).as_posix():sha(p) for p in ui.rglob('*') if p.is_file()})
 baseline={p.relative_to(ROOT).as_posix():sha(p) for folder in (project,ROOT/'tools') for p in folder.rglob('*') if p.is_file() and not p.is_relative_to(ui)}
 js(ROOT/'baseline.sha256.json',baseline)
 js(ROOT/'QA_REPORT.json',{'status':'PENDING','scope':'Local UI verification has not run yet.'})
 print('PREPARED',len(upstream),'upstream files;',len(redactions),'sanitized; no production changes')
def finalize():
 subprocess.run([sys.executable,str(ROOT/'tools/export_return.py'),'--check'],check=True)
 subprocess.run([sys.executable,str(ROOT/'tools/export_return.py')],check=True)
 result=ROOT/'AbuUbaida_UI_RETURN_FOR_REVIEW.zip'
 with zipfile.ZipFile(result) as z:
  assert z.testzip() is None
  assert not any('/dev/' in n or '/js/core.js' in n for n in z.namelist())
 result.unlink()
 # Negative check: changing fixture auth must be rejected by the exporter.
 p=ROOT/'project/dev/after-core.js';original=p.read_bytes();p.write_bytes(original+b'\n// rejected mutation\n')
 r=subprocess.run([sys.executable,str(ROOT/'tools/export_return.py'),'--check'],capture_output=True,text=True);p.write_bytes(original);assert r.returncode!=0
 qa=json.loads((ROOT/'QA_REPORT.json').read_text());qa['export_boundaries_verified']=True;qa['fixture_auth_mutation_rejected']=True;js(ROOT/'QA_REPORT.json',qa)
 OUT.mkdir(exist_ok=True);dest=OUT/'AbuUbaida_Platform_UI_Claude_20261111.zip'
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for f in sorted(ROOT.rglob('*')):
   if f.is_file() and '__pycache__' not in f.parts:z.write(f,ROOT.name+'/'+f.relative_to(ROOT).as_posix())
 with zipfile.ZipFile(dest) as z:assert z.testzip() is None;assert not any(Path(n).suffix in ('.woff','.woff2','.ttf','.otf','.eot') for n in z.namelist())
 for f in ('QA_REPORT.json','START_HERE_AR.md','CLAUDE_PROMPT_AR.md','ACTIVE_UI_MAP.json'):shutil.copy2(ROOT/f,OUT/f)
 js(OUT/'SUMMARY.json',{'file':dest.name,'bytes':dest.stat().st_size,'sha256':sha(dest),'source_commit':COMMIT,'qa_status':qa['status'],'routes':len(qa.get('routes',[])),'production_modified':False,'claude_access_granted':False,'source_files':len(json.loads((ROOT/'UPSTREAM_HASHES.json').read_text())),'scope':'Platform public interface, teacher workspace and admin/dashboard appearance only','read_qa_before_editing':True})
 print((OUT/'SUMMARY.json').read_text())
if __name__=='__main__':globals()[sys.argv[1]]()
