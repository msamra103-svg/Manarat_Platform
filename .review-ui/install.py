"""Apply reviewed appearance files to real source, never the sanitized handoff."""
from pathlib import Path
import json,lzma,hashlib,re,subprocess,zipfile,urllib.request
ROOT=Path.cwd(); V='21.13-qatari-ui-20261111'
packed=b''.join((ROOT/f'.review-ui/source-{i}.part').read_bytes() for i in range(4))
assert hashlib.sha256(packed).hexdigest()=='d2e659f2e1503aeb64e9a2cd1973a2b11a06f74a5bd2683e883caa5ba42eeb0b'
files=json.loads(lzma.decompress(packed));names={'tokens.css','public.css','admin.css','teacher.css','studio.css','components.js'}
assert set(files)==names
ui=ROOT/'ui-redesign';ui.mkdir(exist_ok=True)
for name,content in files.items():(ui/name).write_text(content)
p=ui/'components.js';s=p.read_text()
a=s.index('  const save=studio.querySelector(');b=s.index('  for(const b of $$(".ds-tabs',a)
s=s[:a]+s[b:]
s=s.replace('function start(){\n  if(isGame())return;','function start(){\n  if(!body()||/\\/games\\//.test(location.pathname))return;')
s=s.replace('version:"1.1.0"','version:"1.1.1-reviewed"')
s=s.replace('مدرسة أبو عبيدة · استوديو التصميم والهوية','مدرسة أبو عبيدة الإعدادية للبنين · استوديو التصميم والهوية')
p.write_text(s)
def replace(path,before,after):
 p=ROOT/path;s=p.read_text();assert s.count(before)==1,(path,before[:100],s.count(before));p.write_text(s.replace(before,after))
replace('js/design-runtime.js',"a.average+'%'","((typeof a.average==='number'||typeof a.average==='string'&&a.average.trim()!=='')&&Number.isFinite(Number(a.average))?a.average+'%':'—')")
replace('js/design-studio.js','MANARAT · DESIGN STUDIO','مدرسة أبو عبيدة الإعدادية للبنين · استوديو التصميم والهوية')
slot='<span class="abu-ministry" data-ministry hidden><img data-ministry-img alt="شعار وزارة التربية والتعليم والتعليم العالي - دولة قطر" decoding="async"></span>'
for path in ['admin/admin.html','teacher/create-game.html']:
 replace(path,'<img data-mark src="../assets/school-mark.svg">',slot+'<img data-mark src="../assets/school-mark.svg">')
replace('js/school-bridge.js',"c.logo||'assets/manarat-mark.svg'","c.logo||'school-mark.svg'")
replace('js/school-bridge.js','window.ManaratDesignRuntime?.apply(c);',"window.ManaratDesignRuntime?.apply(c);document.querySelectorAll('[data-ministry]').forEach(slot=>{const img=slot.querySelector('[data-ministry-img]');const show=!!c.ministryLogo&&c.showMinistryLogo!==false;if(img&&show)img.src=c.ministryLogo;if(img&&!show)img.removeAttribute('src');slot.hidden=!show;slot.closest('a.brand')?.classList.toggle('abu-has-ministry',show);});")
for path in ['index.html','admin/admin.html','teacher/create-game.html']:
 p=ROOT/path;s=p.read_text();prefix='../' if '/' in path else ''
 tags=''.join(f'<link rel="stylesheet" href="{prefix}ui-redesign/{n}.css?v={V}">' for n in ['tokens','public','admin','teacher','studio'])+f'<script defer src="{prefix}ui-redesign/components.js?v={V}"></script>'
 assert 'ui-redesign/' not in s
 s=s.replace('</head>',tags+'</head>')
 s=re.sub(r'(js/(?:school-bridge|design-studio|design-runtime)\.js\?v=)[^"\x27]+',lambda m:m[1]+V,s)
 p.write_text(s)
replace('scripts/sync-public.js',"'player', 'games'","'player', 'games', 'ui-redesign'")
replace('scripts/smoke-check.js',"'player','games'","'player','games','ui-redesign'")
# Fixture code is extracted strictly for test injection and never copied to public.
url='https://raw.githubusercontent.com/msamra103-svg/Manarat_Platform/6a95123afa6e249ed6b6092f1a19267ded84a1dc/packages/AbuUbaida_Platform_UI_Claude_20261111.zip'
data=urllib.request.urlopen(url,timeout=40).read();assert hashlib.sha256(data).hexdigest()=='12fec1e4756a8f7dd76e85db3f3226d75a560cb599c812c870e7f06d41443010'
import io
with zipfile.ZipFile(io.BytesIO(data)) as z:
 for name in ['mock.js','after-core.js']:
  value=z.read('AbuUbaida_Platform_UI_Claude/project/dev/'+name).decode()
  if name=='mock.js':value=value.replace("u.hostname==='ui-preview.invalid'","['ui-preview.invalid','yltlzogrhwvnmxcnaesu.supabase.co'].includes(u.hostname)")
  (ROOT/'.review-ui'/name).write_text(value)
# Critical logic is outside the change set.
for path in ['js/core.js','js/school.js','js/create-game.js','js/admin.js','js/admin-requests.js','supabase/functions/school-api/index.ts']:
 assert (ROOT/path).read_bytes()==subprocess.check_output(['git','show','070fedaefed768135c58cb3d25c95a03fa64c01a:'+path]),path
print('PASS: six exact appearance files unpacked; reviewed corrections; production authentication and data logic byte-identical.')
