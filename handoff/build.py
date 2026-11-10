#!/usr/bin/env python3
"""Prepare read-only source snapshots and isolated Claude handoffs; never deploy."""
import sys, re, json, shutil, hashlib, zipfile, subprocess, html
from pathlib import Path
from urllib.parse import unquote, urlsplit
ROOT=Path.cwd(); SRC=ROOT/'source'; WORK=ROOT/'work'; OUT=ROOT/'packages'
COMMIT='070fedaefed768135c58cb3d25c95a03fa64c01a'
REPO='msamra103-svg/Manarat_Platform'; BRANCH='handoff/claude-games-20261111'
GAMES=[
 ('football','كرة القدم','games/football/index.html','ملامح اللاعبين وتناسب الأجسام، حركة الجري والقدمين ومنع انزلاقهما، التصادم والكرة والشباك والحارس، المدرجات والإضاءة. أبقِ وضعَي ضربات الجزاء والمباراة التفاعلية.'),
 ('basketball','كرة السلة','games/basketball/index.html','تناسق الأذرع والرؤوس دون اهتزاز، مسك الكرة والتنطيط والقفز والرمي، قوس الكرة وارتدادها والشبكة والملعب والجمهور.'),
 ('volleyball','الكرة الطائرة','games/volleyball/index.html','تمركز الفريق وتداول الكرة، الإرسال والاستقبال والإعداد والضرب الساحق والصد، تزامن لمس اليد والكرة، الشبكة والقفز والهبوط.'),
 ('bowling','البولينج','games/bowling/index.html','خطوات الاقتراب وتأرجح الذراع والإفلات، دوران الكرة واحتكاك المسار واصطدام القوارير، الصوت والممر والانعكاسات دون ادعاء محاكاة احترافية كاملة.'),
 ('fishing','صيد الأسماك','games/fishing/index.html','الماء والتموج والانعكاس، حركة السمك والزعانف، خيط السنارة وشدّه وانحناؤه، حركة اليد والقارب، المؤثرات البحرية دون عنف أو إيذاء مصوّر.'),
 ('target-shooting','التصويب على الهدف','games/target-shooting/index.html?guided=2','حركة القوس والخيط والسهم والمسار والتصادم، المنظور والعمق، تحسين أوضاع الأسهم والطيور والبالونات والأطباق الأربعة مع طابع تعليمي غير عنيف.'),
 ('qatar-runner','عدّاء قطر','games/qatar-runner/index.html','دورة جري طبيعية وثبات القدمين وتوازن الجسم، القفز والهبوط وتجنب العوائق، معالم قطر والإضاءة والظلال والمسار؛ الحفاظ على الهوية القطرية.'),
 ('qatar-hero','مغامرات بطل قطر','games/qatar-hero/index.html','حركة البطل والقفز والهبوط والاصطدام، البيئة القطرية والعمق والإضاءة، ومنع اختراق العناصر؛ الإبقاء على تكرار السؤال الخاطئ حتى الإجابة الصحيحة.'),
 ('race','سباق السيارات — سباق الأبطال','games/champions-race/index.html?school=1','نماذج السيارات والمواد والإطارات والتوجيه والتعليق والانجراف المتزن، الطريق والكاميرا والإضاءة؛ الحفاظ على نقاط التوقف للأسئلة ونموذج السباق الحالي.'),
 ('puzzle','بازل الصور','games/puzzle.html','ملمس القطع وحوافها والظل وعمق بسيط واقعي والتقاطعة الدقيقة والسحب السلس، دون تشويه الصورة التعليمية أو تغيير تقسيمها أو مساحة التفاعل.'),
 ('classic','تحدّي المعرفة','games/classic/index.html','استوديو مسابقات جذاب وإضاءة وخامات وعمق بصري اختياري، مع بقاء السؤال العربي والاختيارات واضحة؛ الواقعية لا تعني تحويل المسابقة إلى رياضة أو تغيير أنواع الأسئلة.')]
TEXT={'.html','.htm','.js','.mjs','.cjs','.css','.json','.md','.txt','.svg','.xml','.ts','.jsx','.yml','.yaml'}
EXCLUDE={'.woff','.woff2','.ttf','.otf','.eot','.zip','.gz','.tar','.map','.log'}
BAD_NAMES={'.git','node_modules','public','dist','.env','.vercel','.github','coverage','test-results','playwright-report'}
REF_RE=re.compile(r'''["'`]([^"'`\n\r<>]+?\.(?:js|mjs|css|json|png|jpe?g|webp|svg|wav|mp3|ogg|m4a|glb|gltf|bin|wasm|ktx2|hdr)(?:\?[^"'`\s<>]*)?)["'`]''',re.I)
def write(p,s):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8')
def jd(p,o):write(p,json.dumps(o,ensure_ascii=False,indent=2)+'\n')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def permitted(p):return not any(x in BAD_NAMES for x in p.parts) and not p.name.startswith('.env') and p.suffix.lower() not in EXCLUDE

def copyrel(rel,dest,seen):
 p=SRC/rel
 if not p.exists():return
 if p.is_dir():
  for f in sorted(p.rglob('*')):
   if permitted(f.relative_to(SRC)) and f.is_file():copyrel(f.relative_to(SRC).as_posix(),dest,seen)
  return
 if not permitted(p.relative_to(SRC)):return
 if rel in seen:return
 q=dest/rel;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q);seen.add(rel)

def dependencies(dest,seen,entry):
 # Keep exact upstream paths; dependencies outside the owning game are immutable.
 done=set();base=(SRC/entry.split('?')[0]).parent
 while True:
  todo=seen-done
  if not todo:break
  for rel in sorted(todo):
   done.add(rel);p=SRC/rel
   if p.suffix.lower() not in TEXT:continue
   text=p.read_text(encoding='utf8',errors='replace')
   for raw in REF_RE.findall(text):
    if len(raw)>260 or any(x in raw for x in ('${','\\n','data:',':','<','>')):continue
    raw=unquote(raw.split('?')[0].split('#')[0])
    candidates=[p.parent/raw,base/raw,SRC/raw.lstrip('/')]
    for candidate in candidates:
     try:r=candidate.resolve().relative_to(SRC.resolve()).as_posix()
     except ValueError:continue
     if not (SRC/r).is_file():continue
     if r.startswith(('games/','assets/game-covers/')):copyrel(r,dest,seen)
     # Presentation-only navigation assets are included, never core/auth/cloud code.
     elif r in ('js/game-navigation.js','js/game-nav.js','css/game-navigation.css','css/game-nav.css'):copyrel(r,dest,seen)
     break

SERVE=r'''const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'../project'),port=Number(process.env.PORT)||8765;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.wasm':'application/wasm'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}if(name==='/')name='/dev/index.html';let file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' data: blob:; font-src 'none'; worker-src 'self' blob:; object-src 'none'; frame-src 'self'; form-action 'none'");fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end('Not found');}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(b);});}).listen(port,'127.0.0.1',()=>console.log('Local sandbox: http://127.0.0.1:'+port+'/dev/index.html'));
'''
EXPORT=r'''#!/usr/bin/env python3
import json, hashlib, zipfile, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];m=json.loads((root/'handoff.json').read_text());base=json.loads((root/'baseline.sha256.json').read_text());project=root/'project'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def allowed(s):return any(s.startswith(x) if x.endswith('/') else s==x for x in m['editable_paths'])
for rel,h in base.items():
 if not allowed(rel):
  p=project/rel
  if not p.is_file() or sha(p)!=h:raise SystemExit('Read-only shared dependency changed: '+rel+' — copy it into your own game folder instead.')
changes=[];files=[]
for p in sorted(project.rglob('*')):
 if p.is_symlink():raise SystemExit('Symlinks are not allowed')
 if not p.is_file():continue
 rel=p.relative_to(project).as_posix()
 if not allowed(rel):continue
 if any(x in p.parts for x in ('.git','.env','node_modules','.vercel')):raise SystemExit('Unexpected private file: '+rel)
 files.append((p,rel));h=sha(p)
 if base.get(rel)!=h:changes.append({'path':rel,'before_sha256':base.get(rel),'after_sha256':h})
removed=[r for r in base if allowed(r) and not (project/r).exists()]
report={'game':m['id'],'source_commit':m['source_commit'],'changes':changes,'removed':removed,'production_authorized':False,'note':'Human review and integration tests are mandatory. This tool never uploads or deploys.'}
out=root/(m['id']+'-RETURN-FOR-REVIEW.zip')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p,r in files:z.write(p,'candidate/'+r)
 z.writestr('CHANGES.json',json.dumps(report,ensure_ascii=False,indent=2))
 z.write(root/'handoff.json','handoff.json')
 for name in ('CHANGELOG.md','TEST_RESULTS.md','ASSET_LICENSES.md','KNOWN_ISSUES.md'):
  if (root/name).exists():z.write(root/name,name)
print('Created',out.name,'with',len(files),'candidate files;',len(changes),'changed and',len(removed),'removed. No deployment performed.')
'''
CHECK=r'''#!/usr/bin/env python3
import json,hashlib,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];m=json.loads((root/'handoff.json').read_text());b=json.loads((root/'baseline.sha256.json').read_text());fail=[]
for r,h in b.items():
 editable=any(r.startswith(x) if x.endswith('/') else r==x for x in m['editable_paths'])
 p=root/'project'/r
 if not editable and (not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=h):fail.append(r)
if fail:raise SystemExit('Read-only files changed: '+', '.join(fail))
print('PASS: shared dependencies unchanged; editable scope:',', '.join(m['editable_paths']))
'''
FIXTURE='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#e6f1f4"/><path d="M0 430Q220 300 450 430T900 430V600H0" fill="#8ab887"/><circle cx="730" cy="100" r="58" fill="#efc24d"/><path d="M180 400V220H380V400M160 220L280 120L400 220" fill="#8a1538" stroke="#fff" stroke-width="8"/><rect x="245" y="300" width="70" height="100" fill="#fff"/><path d="M540 420V230M470 270Q540 100 610 270" stroke="#546b42" fill="#83ac69" stroke-width="12"/></svg>'

def classic(project,seen,source):
 # Extract the active UI, not the unused legacy games/classic scene.
 def between(a,b):
  start=source.index(a);end=source.index(b,start);return source[start:end]
 parts=[between('function gameHUD()','\nfunction controlsBusy'),between('function questionUI(q)','\nasync function answer(')]
 write(project/'games/classic/current-renderer.js','// Exact current UI functions extracted from js/school.js at '+COMMIT+'\n'+'\n'.join(parts))
 shim=r'''const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M={shuffle:a=>a.slice()},games={classic:['','تحدّي المعرفة']},types={multiple_choice:'اختيار من متعدد',true_false:'صح وخطأ',open_text:'مقالي',matching:'مطابقة',connecting:'توصيل',ordering:'ترتيب',classification:'تصنيف',puzzle_image:'بازل الصور'};
let config={name:'مدرسة أبو عبيدة الإعدادية للبنين'},assignment={title:'تحدّي المعرفة',subject:'تجربة محلية',mode:'home'},play={id:'local-only',template:'classic',demo:true,index:0,points:0,completed:0,questions:[{id:'q1',type:'multiple_choice',text:'أيُّ هذه الخيارات يحافظ على الماء؟',options:['إغلاق الصنبور بعد الاستخدام','ترك الصنبور مفتوحًا'],points:10},{id:'q2',type:'true_false',text:'نحافظ على نظافة مدرستنا.',options:['صح','خطأ'],points:10},{id:'q3',type:'open_text',text:'اكتب فكرة للمحافظة على البيئة.',points:10}]};
function button(text,action,id='',cls=''){return `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;}
function show(s){$('app').innerHTML=s;}function dialog(s){show(s);}function arena(){return '';}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;if(a==='answer'||a==='textAnswer'){if(play.answered)return;play.answered=true;play.completed++;if(a==='answer'&&b.dataset.id==='0')play.points+=10;$('feedback').innerHTML='<p>إجابة تدريبية محلية؛ لا توجد درجات حقيقية.</p>'+button('التالي','next');}else if(a==='next'){if(play.index===play.questions.length-1){show('<h1>تحدّي المعرفة</h1><p>اكتملت التجربة المحلية</p>');return;}play.index++;play.answered=false;renderQuestion();}});
'''
 write(project/'dev/classic-shim.js',shim)
 styles=[]
 for rel in ('css/school.css','css/game-session.css','css/puzzle-immersive.css'):
  if (SRC/rel).exists():copyrel(rel,project,seen);styles.append('<link rel="stylesheet" href="/'+rel+'">')
 write(project/'games/classic/index.html','<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+''.join(styles)+'</head><body><main id="app"></main><script src="/dev/classic-shim.js"></script><script src="current-renderer.js"></script><script>renderQuestion()</script></body></html>')

def prepare():
 WORK.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
 school=(SRC/'js/school.js').read_text()
 actual=re.search(r'const games=\{(.*?)\};',school,re.S).group(1)
 keys=set(re.findall(r"(?:^|,)\s*(?:'([^']+)'|([\w-]+))\s*:\[",actual));keys={a or b for a,b in keys}
 assert keys=={g[0] for g in GAMES},'Active game catalog changed: '+str(keys)
 inventory=[]
 for number,(gid,title,entry,targets) in enumerate(GAMES,1):
  folder=f'{number:02d}_{gid.replace("-","_")}_Claude';root=WORK/folder
  if root.exists():shutil.rmtree(root)
  project=root/'project';project.mkdir(parents=True);seen=set()
  own='games/champions-race/' if gid=='race' else f'games/{gid}/'
  editable=[own] if gid!='puzzle' else ['games/puzzle.html','games/puzzle/']
  if gid=='classic':classic(project,seen,school)
  else:
   copyrel(own.rstrip('/'),project,seen)
   if gid=='puzzle':copyrel('games/puzzle.html',project,seen)
  # Shared third-party runtime, including original upstream license notices.
  copyrel('games/vendor',project,seen)
  dependencies(project,seen,entry)
  # Any shared engine selected by an entrypoint is copied as a complete dependency directory.
  for dep in ('games/sports/','games/experiences/','games/shared/'):
   if any(r.startswith(dep) for r in seen):copyrel(dep.rstrip('/'),project,seen)
  dependencies(project,seen,entry)
  for f in (SRC/'assets/game-covers').glob(gid+'.*'):
   copyrel(f.relative_to(SRC).as_posix(),project,seen)
  reference=root/'reference';reference.mkdir()
  protocol=school[school.index('function renderSport()'):school.index("window.addEventListener('message',e=>{const params=")]
  write(reference/'platform-bridge.READ_ONLY.js.txt',protocol)
  write(reference/'question-result.READ_ONLY.js.txt',school[school.index('async function answer('):school.index('function exportCSV(')])
  if gid=='classic':write(reference/'classic-source-note.txt','The current classic game is rendered directly by js/school.js, not games/classic/index.html. current-renderer.js contains exact extracted rendering functions. Integration must be reviewed as a UI-only refactor; do not replace the platform school.js with the local shim.\n')
  if gid=='race':
   shutil.copy2(SRC/'scripts/unpack-champions-race.js',reference/'unpack-champions-race.READ_ONLY.js')
  for test in sorted((SRC/'tests').glob('*')):
   match=gid in test.name or (gid=='race' and 'champions-race' in test.name) or (gid=='classic' and test.name in ('game-modes.cjs','game-session.cjs'))
   if match and test.is_file() and test.suffix in ('.js','.cjs','.mjs'):
    q=reference/'upstream-tests'/test.name;q.parent.mkdir(exist_ok=True);shutil.copy2(test,q)
  write(project/'dev/fixture.svg',FIXTURE)
  shutil.copy2(ROOT/'handoff/host.js',project/'dev/host.js')
  cfg={'id':gid,'title':title,'entry':'/'+entry}
  write(project/'dev/index.html','<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(title)+' — محاكي محلي</title><style>body{margin:0;font-family:Arial,sans-serif;background:#10141d;color:#fff}header{padding:12px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}button{padding:9px 14px;font:inherit;cursor:pointer}iframe{display:block;width:100%;height:82vh;border:0;background:#fff}details{padding:10px}pre{direction:ltr;text-align:left;max-height:140px;overflow:auto}</style></head><body><header><b>'+html.escape(title)+'</b><span id="status">نسخة تطوير محلية — لا تتصل بالمنصة</span><button data-answer="true">محاكاة إجابة صحيحة</button><button data-answer="false">محاكاة إجابة خاطئة</button><button id="reset">إعادة التجربة</button></header><iframe id="game" title="'+html.escape(title)+'" allow="fullscreen; autoplay" sandbox="allow-scripts allow-same-origin allow-pointer-lock" allowfullscreen></iframe><details><summary>سجل بروتوكول التكامل</summary><pre id="log"></pre></details><script>window.HANDOFF_CONFIG='+json.dumps(cfg,ensure_ascii=False)+'</script><script src="host.js"></script></body></html>')
  write(root/'tools/serve.cjs',SERVE);write(root/'tools/check_package.py',CHECK);write(root/'tools/export_return.py',EXPORT)
  write(root/'START_WINDOWS.cmd','@echo off\r\ncd /d "%~dp0"\r\nnode tools\\serve.cjs\r\npause\r\n')
  write(root/'START_MAC_LINUX.sh','#!/bin/sh\ncd "$(dirname "$0")" || exit 1\nexec node tools/serve.cjs\n')
  jd(root/'package.json',{'name':'abu-ubaida-'+gid+'-claude-handoff','private':True,'version':'1.0.0','scripts':{'start':'node tools/serve.cjs','check':'python3 tools/check_package.py','export':'python3 tools/export_return.py'}})
  baseline={p.relative_to(project).as_posix():digest(p) for p in sorted(project.rglob('*')) if p.is_file() and not p.relative_to(project).as_posix().startswith('dev/')}
  jd(root/'baseline.sha256.json',baseline)
  shared=[r for r in baseline if not any(r.startswith(x) if x.endswith('/') else r==x for x in editable)]
  manifest={'id':gid,'title_ar':title,'source_repository':REPO,'source_commit':COMMIT,'entry':entry,'local_preview':'http://127.0.0.1:8765/dev/index.html','editable_paths':editable,'read_only_dependency_paths':shared,'production_access':False,'backend_credentials_included':False,'integration_type':'active-ui-extraction' if gid=='classic' else 'existing-iframe-contract','copy_mirrors_only_at_integration':True,'gameplay_rules_unchanged':True}
  jd(root/'handoff.json',manifest)
  missing_note='\nهذه اللعبة حاليًا واجهة أسئلة مدمجة في school.js. أُرفقت وظائف العرض الحالية حرفيًا، مع محاكي محلي. ليست نسخة iframe معتمدة بعد؛ أعد تغييرات الواجهة منفصلة ولا تستبدل ملف school.js الكامل.\n' if gid=='classic' else ''
  race_note='\nمهم للسباق: نماذج السيارات والمكتبات الأصلية فُك ضغطها بالفعل وأُدرجت كاملة. بعض هذه الملفات يعاد توليدها عند بناء المنصة من bundles/champions-race-v8. لا تعدّل الملفات التي يعيد سكربت unpack إنشاءها؛ ضع النماذج المطورة بأسماء ومسارات جديدة داخل مجلد اللعبة وحدث مراجعها، أو قدم اقتراح تحديث الحزمة ليعتمده المدمج.\n' if gid=='race' else ''
  write(root/'START_HERE_AR.md',f'''# حزمة {title} — تطوير مستقل لكلود

المصدر: {REPO}، النسخة الثابتة `{COMMIT}`. تاريخ التجهيز: 11 نوفمبر 2026.

## البداية
ارفع هذا ZIP وحده إلى مشروع مستقل في كلود، ثم انسخ نص `CLAUDE_PROMPT_AR.md` كاملًا. لا تربط حساب GitHub ولا Vercel ولا Supabase، ولا ترسل كلمة مرور أو مفتاح API. الحزمة لا تمنح أي صلاحية من هذه الصلاحيات.

للتشغيل المحلي بعد فك الضغط: ثبّت Node.js في جهاز التطوير ثم شغّل `node tools/serve.cjs` من مجلد الحزمة، وافتح `http://127.0.0.1:8765/dev/index.html`. لا يحتاج تشغيل اللعبة إلى npm install؛ مكتبات العرض الحالية مرفقة. المحاكي يغلق الاتصالات الخارجية من المتصفح ويستخدم بيانات تجريبية فقط. لا تُفتح الصفحة مباشرة بطريقة file://.

## الملفات
`project/` يحتوي ملفات اللعبة الحالية والتبعيات اللازمة. `project/dev/` محاكي للمنصة لا يُدمج في الموقع. `reference/` عقد الربط ومقتطفات من المنصة للقراءة فقط. `handoff.json` يحدد المسارات المسموحة. `baseline.sha256.json` يوثق الملفات الأصلية. `QA_REPORT.json` يوثق الاختبارات المنفذة وحدودها.

مسار الدخول الحالي: `{entry}`. المسارات المسموحة للتطوير: {', '.join(editable)}.

{missing_note}{race_note}
## العودة بعد التطوير
اطلب من كلود تشغيل الفحوص ثم `python3 tools/export_return.py`. أرسل إلينا ملف `{gid}-RETURN-FOR-REVIEW.zip` ليُراجع ويُختبر قبل أي تركيب أو نشر. لا ترفع مجلد project كاملًا فوق المنصة. الملفات المشتركة لا تُستبدل.

المعاينة ليست واجبًا حقيقيًا ولا تحفظ نتائج ولا تسجل الدخول إلى خادم. الأداء والواقعية بعد تطوير كلود يحتاجان اختبارًا مستقلًا؛ هذا تجهيز مصدر وليس وعدًا بنسبة واقعية محددة.
''')
  write(root/'CLAUDE_PROMPT_AR.md',f'''أنت مطوّر ألعاب ويب ثلاثية الأبعاد ومخرج حركة وواقعية. المطلوب تطوير لعبة «{title}» من الحزمة المرفقة فقط، لا إعادة بناء المنصة.

ابدأ بقراءة START_HERE_AR.md وhandoff.json وINTEGRATION_CONTRACT_AR.md وQA_REPORT.json ثم تتبع نقطة الدخول {entry} والملفات التي تستدعيها. لا تعمل على ملف قديم غير مستخدم. استخدم النسخة الحالية {COMMIT} كأساس. لا تغيّر اسم اللعبة أو نوعها.

حدود إلزامية: لا دخول إلى GitHub أو Vercel أو Supabase، لا طلب كلمات مرور أو مفاتيح، لا push أو نشر أو تغيير main، ولا اتصال ببيانات الطلاب والمعلمين. لا تعديل تسجيل الدخول أو حل مشكلة الجلسة أو درجات الطلاب أو school-api أو لوحة التحكم. لا تعطيل حماية المتصفح المحلية. لا تحميل أي محتوى من المنصة الحية أثناء التطوير.

نطاق الكتابة داخل project هو {', '.join(editable)} فقط. أي ملف مشترك خارج ذلك للقراءة والتشغيل فقط: عند الحاجة لتطويره انسخ الجزء اللازم إلى مجلد خاص باللعبة وغيّر مراجع هذه اللعبة وحدها. لا تغير games/vendor المشترك. لا تنشئ ملفات بديلة تحمل أسماء محرك لعبة أخرى. لا تنسخ project/dev أو أدوات التجهيز إلى المنصة.

أولويات الواقعية لهذه اللعبة: {targets}

حافظ على شكل الواجهة العربية واتجاه RTL وسلامة الحروف، وهوية المدرسة والعمر التعليمي المناسب. لا تستبدل الشخصيات بأشكال بدائية، ولا تزعم واقعية فائقة بتغيير الألوان فقط. حسّن النماذج والخامات والضوء والظل والحركة والفيزياء والكاميرا فعلًا. امنع اهتزاز الأطراف وتغيّر النسب والتداخل والانزلاق. حافظ على قابلية القراءة وعلى الأزرار واللمس ولوحة المفاتيح. لا تسارع الحركة لإخفاء العيوب. وفّر مستويات جودة منخفضة ومتوسطة وعالية وتقليل حركة، مع أهداف أداء قابلة للقياس وليس ضمانات مختلقة؛ استهدف 60 إطارًا على حاسوب مناسب و30 على جهاز متوسط واذكر الجهاز والقياس الفعلي.

حافظ حرفيًا على بروتوكول رسائل اللعبة في INTEGRATION_CONTRACT_AR.md وreference؛ لا تغيّر type أو token أو index أو ترتيب أحداث السؤال والنتيجة والتقدم والنهاية. تحقق من origin وsource ولا ترسل الأسرار مع الرسائل. لا تجعل النتيجة التعليمية من حساب المحرك أو الفيزياء؛ المنصة وحدها تصحح وتحتسب. الإجابة الخاطئة لا تتحول إلى صحيحة لتحسين المشهد. نمط الجماعي لا ينشئ درجات فردية. أبقِ جميع أنماط اللعب الحالية وأدوات التحكم والصوت مع إمكانية كتم الكلام منفصلًا عن المؤثرات عند وجودهما.

{missing_note}{race_note}
استخدم أصولًا قانونية مرخصة وسجّل مصدر وترخيص كل أصل في ASSET_LICENSES.md. لا تضع مفاتيح API أو روابط CDN لازمة لتشغيل اللعبة، ولا ملفات خطوط مرفقة؛ استخدم الخطوط النظامية. أرفق الأصول المطلوبة محليًا. لا تدّع إجراء اختبار لم تُجره.

اختبر: التشغيل، التوافق مع المحاكي، السؤال الصحيح والخاطئ، إعادة الجولة، إنهاء الجلسة مرة واحدة، منع تكرار النتائج، 3 أسئلة و10 أسئلة وصورة تعليمية عند دعمها، تغيير الحجم واللمس، انخفاض معدل الإطارات، فقدان WebGL، الأداء والذاكرة والصوت. احفظ مقارنة قبل/بعد ونتائج فعلية ومشكلات باقية. لا تكتف بخطة أو مقتطفات أو ملف HTML بديل ينفصل عن بروتوكول المنصة.

المخرجات المطلوبة: المصدر كاملًا بتعديلاته والأصول، CHANGELOG.md، TEST_RESULTS.md، ASSET_LICENSES.md، KNOWN_ISSUES.md. شغّل python3 tools/check_package.py ثم python3 tools/export_return.py وسلّم ZIP العودة الذي أنشأته الأداة، مع نسخة كاملة قابلة للتشغيل للمراجعة. لا تنشر شيئًا. عند وجود عائق وثّقه بوضوح دون تغيير العقد أو حذف ميزة لتجاوز الاختبار.
''')
  write(root/'INTEGRATION_CONTRACT_AR.md',f'''# عقد إعادة الدمج: {title}

المعرّف الثابت: `{gid}`. الاسم: {title}. المصدر {COMMIT}. نقطة الدخول `{entry}`.

`reference/platform-bridge.READ_ONLY.js.txt` مقتطف حرفي من المضيف الحالي وهو المرجع الدقيق، و`reference/question-result.READ_ONLY.js.txt` يوضح رجوع الإجابة والنتيجة. لا تعدّل هذه المراجع. المحاكي يتبع شكل الرسائل ولكنه ليس خادم تصحيح.

للألعاب الرياضية المعتادة: ready → config(token,count,title,images) → question(index,token) → result(correct,pending,index,token,feedback) → outcome(index,token) → next(index,token) → advance(index السابق,token). في النهاية تنهي المنصة الجلسة ولا تستخرج درجة من الفيزياء.

لعدّاء قطر والقفز أضف حقول المدرسة والمعلم والطالب كما بالمصدر. لمغامرات بطل قطر عقد خاص: next يحمل الفهرس الجديد وfinish يحمل العدد، والخاطئ يظل نفس السؤال. للسباق: school-race-ready/config/question/continue/finished مع token والفهرس؛ لا تستبدل continue بـresult. للبازل: school-puzzle-ready/config/complete؛ الصورة والقطع من المضيف ولا تولّد صورة بديلة. للتحدي الكلاسيكي: وظائف عرض مدمجة وليست قناة iframe قائمة؛ قدّم تغييرات العرض معزولة للمراجعة ولا تدّع أن منصة الإنتاج تستخدم iframe لهذه اللعبة.

## الدمج بيد المسؤول فقط
1. قارن CHANGES.json والهاش مع المصدر الفعلي وقت الدمج؛ لا تنسخ فوق تحديث أحدث تلقائيًا.
2. انقل مرشحات المسارات المسموحة فقط. أي تعديل ملفات مشتركة يستلزم مراجعة منفصلة؛ لا تدمجه تلقائيًا.
3. شغّل اختبارات اللعبة والعقد في نسخة مراجعة؛ اختبر الأسئلة والإجابات والجماعي والفردي والواجب المنزلي.
4. تظل الجلسات والتصحيح وبيانات الطلاب على الخادم الحالي. الحزمة لا تحتوي مفاتيح أو حسابات حقيقية.
5. عند الدمج يُشغّل بناء المنصة ومزامنة public من المصدر؛ لا تنقل project/dev ولا overwrite كامل لمجلد public.
6. لا نشر إلا بطلب صريح وبعد اختبار ونسخة رجوع.

{race_note}
المرجع الأمني العام للرسائل: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
''')
  write(root/'RETURN_CHECKLIST_AR.md','# التسليم\n\nلا نشر ولا صلاحيات. مصدر كامل داخل نطاق اللعبة؛ سجل تغييرات ومسارات وهاش؛ أصول مرخصة؛ تقرير اختبارات فعلي؛ مقارنة مرئية؛ قائمة عيوب متبقية. شغّل أدوات check_package وexport_return. ملف العودة للمراجعة وليس للنشر التلقائي.\n')
  write(root/'ASSET_LICENSES.md','# تراخيص الأصول\n\nتُحفظ إشعارات الترخيص الموجودة مع المصدر والمكتبات. الحزمة ليست تدقيق ملكية قانونيًا للأصول القديمة. على كلود توثيق مصدر وترخيص كل أصل جديد وعدم إدخال أصل غير واضح الحقوق. لا تُرفق ملفات خطوط.\n')
  jd(root/'QA_REPORT.json',{'status':'PENDING','scope':'Waiting for isolated package browser startup tests.'})
  # No source credentials/configuration files enter the handoff.
  forbidden=[]
  for p in project.rglob('*'):
   if p.is_file() and p.suffix.lower() in TEXT:
    t=p.read_text(encoding='utf8',errors='replace')
    if re.search(r'(?:sb_secret_[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{25,}|sk-proj-[A-Za-z0-9_-]{20,})',t):forbidden.append(p.relative_to(project).as_posix())
  assert not forbidden,'Potential credentials in '+str(forbidden)
  row={**manifest,'folder':folder,'package_dir':str(root.relative_to(ROOT)),'zip':folder+'.zip','source_file_count':len(baseline),'source_bytes':sum(p.stat().st_size for p in project.rglob('*') if p.is_file())}
  inventory.append(row)
  print('PREPARED',gid,len(baseline),'files; shared dependencies',len(shared),flush=True)
 jd(WORK/'inventory.json',inventory)

def finalize():
 inventory=json.loads((WORK/'inventory.json').read_text());rows=[]
 for g in inventory:
  root=ROOT/g['package_dir'];subprocess.run([sys.executable,str(root/'tools/check_package.py')],check=True)
  qa=json.loads((root/'QA_REPORT.json').read_text());dest=OUT/g['zip']
  with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
   for p in sorted(root.rglob('*')):
    if p.is_file():z.write(p,g['folder']+'/'+p.relative_to(root).as_posix())
  with zipfile.ZipFile(dest) as z:assert z.testzip() is None
  row={'id':g['id'],'title_ar':g['title_ar'],'file':g['zip'],'bytes':dest.stat().st_size,'sha256':digest(dest),'source_files':g['source_file_count'],'qa':qa['status'],'url':f'https://raw.githubusercontent.com/{REPO}/refs/heads/{BRANCH}/packages/{g["zip"]}'};rows.append(row)
  print('PACKAGE',json.dumps(row,ensure_ascii=False),flush=True)
 guide='# حزم ألعاب أبو عبيدة لكلود — 11 نوفمبر 2026\n\nكل ZIP مستقل. ارفع حزمة لعبة واحدة إلى كلود وانسخ CLAUDE_PROMPT_AR.md من داخلها. لا تمنحه وصولًا إلى المنصة. أعد ZIP العودة إلينا للمراجعة والدمج.\n\nالمصدر الثابت: '+COMMIT+'\n\n| اللعبة | التحميل | الحجم | تحقق البداية |\n|---|---|---|---|\n'
 for r in rows:guide+=f'| {r["title_ar"]} | [{r["file"]}]({r["url"]}) | {r["bytes"]/1048576:.2f} MB | {r["qa"]} |\n'
 guide+='\nالتحقق المرفق يختبر بدء الحزمة وربط المحاكي والأصول، وليس مراجعة كاملة للعب أو ضمانًا للواقعية. اقرأ QA_REPORT.json في كل حزمة. تحدّي المعرفة مستخرج من واجهة المنصة الحالية ويحتاج مراجعة دمج واجهة، لا استبدالًا مباشرًا بملف قديم. أصول سباق الأبطال المفكوكة كاملة ضمن حزمته.\n'
 write(OUT/'START_HERE_AR.md',guide)
 jd(OUT/'SUMMARY.json',{'source_commit':COMMIT,'production_modified':False,'claude_access_granted':False,'games':rows})
 write(OUT/'SHA256SUMS.txt',''.join(r['sha256']+'  '+r['file']+'\n' for r in rows))
 master=OUT/'AbuUbaida_All_11_Games_Claude_20261111.zip'
 with zipfile.ZipFile(master,'w',zipfile.ZIP_STORED) as z:
  for r in rows:z.write(OUT/r['file'],r['file'])
  for name in ('START_HERE_AR.md','SUMMARY.json','SHA256SUMS.txt'):z.write(OUT/name,name)
 assert master.stat().st_size<95000000,'Master archive exceeds safe GitHub file size'
 print('MASTER',master.name,master.stat().st_size,digest(master),flush=True)

if __name__=='__main__':
 if len(sys.argv)!=2 or sys.argv[1] not in ('prepare','finalize'):raise SystemExit('Use prepare or finalize')
 globals()[sys.argv[1]]()
