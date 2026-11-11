#!/usr/bin/env python3
import json,hashlib,zipfile,sys,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
baseline=json.loads((root/'baseline.sha256.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for rel,digest in baseline.items():
 p=root/rel
 if not p.is_file() or sha(p)!=digest:raise SystemExit('Read-only reference or preview infrastructure changed: '+rel)
for p in (root/'project').rglob('*'):
 if p.is_symlink():raise SystemExit('Symlinks are not allowed')
 if p.is_file() and p.relative_to(root).as_posix() not in baseline and not p.relative_to(root).as_posix().startswith('project/ui-redesign/'):
  raise SystemExit('New file outside UI scope: '+p.relative_to(root).as_posix())
files=[];changes=[]
initial=json.loads((root/'ui-initial.sha256.json').read_text())
for p in sorted((root/'project/ui-redesign').rglob('*')):
 if not p.is_file():continue
 rel=p.relative_to(root/'project').as_posix()
 if p.is_symlink() or p.suffix.lower() in ('.woff','.woff2','.ttf','.otf','.eot','.exe','.zip') or any(s.startswith('.') for s in p.relative_to(root/'project').parts):raise SystemExit('Forbidden file: '+rel)
 if p.suffix in ('.js','.css','.html','.json','.md','.txt','.svg'):
  text=p.read_text(encoding='utf8')
  if re.search(r'(?:sb_secret_|sb_publishable_|github_pat_|ghp_[A-Za-z0-9]{20}|AIza[A-Za-z0-9_-]{25}|SUPABASE_SERVICE_ROLE_KEY)',text):raise SystemExit('Potential key in '+rel)
  if re.search(r'(?:/dev/(?:mock|after-core)|local-preview-not-a-token)',text):raise SystemExit('Preview adapter leaked into UI candidate: '+rel)
 files.append((p,'candidate/'+rel))
 if initial.get(rel)!=sha(p):changes.append({'path':rel,'before_sha256':initial.get(rel),'after_sha256':sha(p)})
for p in (root/'proposals').rglob('*'):
 if p.is_file() and p.suffix in ('.md','.diff','.patch'):
  files.append((p,'REVIEW_ONLY/'+p.relative_to(root).as_posix()))
report={'source_commit':json.loads((root/'handoff.json').read_text())['source_commit'],'production_authorized':False,'safe_direct_candidate_scope':'ui-redesign/ only','changes':changes,'review_only_proposals':True,'removed':[r for r in initial if not (root/'project'/r).exists()],'note':'No authentication, data, server or game engine changes are included. Human review is mandatory.'}
if '--check' in sys.argv:print('PASS source isolation, immutable infrastructure and UI scope');raise SystemExit(0)
out=root/'AbuUbaida_UI_RETURN_FOR_REVIEW.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p,r in files:z.write(p,r)
 z.writestr('CHANGES.json',json.dumps(report,ensure_ascii=False,indent=2))
 for f in ('handoff.json','INTEGRATION_CONTRACT_AR.md','CHANGELOG.md','TEST_RESULTS.md','ASSET_LICENSES.md','KNOWN_ISSUES.md'):
  if (root/f).exists():z.write(root/f,f)
print('Created',out.name,'with',len(changes),'UI changes. No upload or deployment.')
