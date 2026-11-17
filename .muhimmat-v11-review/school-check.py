#!/usr/bin/env python3
"""Real WebGL game iframe and fake school grading, on localhost only."""
import asyncio, os, json
from playwright.async_api import async_playwright
BASE=os.environ.get('MM_PLATFORM_URL','http://127.0.0.1:3001')
HTML="""<!doctype html><html lang="ar"><meta charset="utf-8">
<iframe id="game" src="/games/muhimmat-almaarifa/index.html?school=1&v=20261117-v11" style="width:1250px;height:830px"></iframe>
<script>
const channel='isolated-school-channel',frame=document.getElementById('game');
window.testState={ready:0,answers:[],finishes:0,errors:[],messages:[]};
const qs=[0,1].map(n=>({id:'unit-q-'+n,type:'multiple_choice',text:'السؤال التجريبي '+n,options:[{id:'0',text:'الجواب الأول'},{id:'1',text:'الجواب الثاني'}]}));
function reply(type,more={}){frame.contentWindow.postMessage({protocol:'mm-school/1',game:'muhimmat-almaarifa',channel,type,...more},location.origin);}
addEventListener('message',e=>{
 if(e.source!==frame.contentWindow||e.origin!==location.origin)return;
 const v=e.data||{};if(v.protocol!=='mm-school/1'||v.game!=='muhimmat-almaarifa')return;
 testState.messages.push(v.type);
 if(v.type==='ready'){testState.ready++;reply('config',{questions:qs,title:'تكليف تجريبي',student:'طالب تجريبي',mode:new URLSearchParams(location.search).get('mode')||'home'});return;}
 if(v.channel!==channel)return;
 if(v.type==='answer'){testState.answers.push({index:v.index,questionId:v.questionId,value:v.value});reply('grade',{requestId:v.requestId,index:v.index,questionId:v.questionId,correct:String(v.value)==='0',points:String(v.value)==='0'?10:0,feedback:'نتيجة تجريبية',explanation:''});}
 if(v.type==='finish'){testState.finishes++;reply('finishAck',{score:100,group:new URLSearchParams(location.search).get('mode')==='group'});}
 if(v.type==='error')testState.errors.push(v.message);
});
</script></html>"""
async def run():
 report={'status':'FAIL','cases':[],'pageErrors':[],'missing':[],'external':[]}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROME') or None,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
  try:
   for mode in ('group','individual','home'):
    ctx=await browser.new_context(viewport={'width':1380,'height':950})
    page=await ctx.new_page()
    page.on('pageerror',lambda e: report['pageErrors'].append(str(e)))
    page.on('response',lambda r: report['missing'].append(r.url) if r.status==404 else None)
    async def intercept(route):
     url=route.request.url
     if url.startswith(BASE+'/__test'):await route.fulfill(body=HTML,content_type='text/html; charset=utf-8')
     elif url.startswith(BASE) or url.startswith(('data:','blob:')):await route.continue_()
     else:report['external'].append(url);await route.abort()
    await page.route('**/*',intercept)
    await page.goto(BASE+'/__test?mode='+mode)
    await page.wait_for_function('window.testState.ready===1',timeout=90000)
    f=page.frame_locator('#game')
    await f.locator('#scrStart:not(.hidden)').wait_for(timeout=90000)
    assert await f.locator('#btnTeacher').count()==0
    assert await f.locator('[data-env]').count()==2
    assert await f.locator('[data-char]').count()==4
    if mode=='group':
     await f.locator('[data-char="student"]').click()
     await f.locator('[data-char="student"][aria-pressed="true"]').wait_for()
     await f.locator('[data-env="forest"]').click()
     await f.locator('[data-env="forest"][aria-pressed="true"]').wait_for(timeout=60000)
    await f.locator('#btnStart').click()
    frm=[x for x in page.frames if '/games/muhimmat-almaarifa/' in x.url][0]
    await frm.wait_for_function("window.__mmSchoolGame?.state==='question'",timeout=90000)
    if mode=='group':
     await frm.evaluate("""() => {const g=window.__mmSchoolGame,b=g.targets.current.find(x=>String(x.optionId)==='1');if(!b)throw Error('Missing incorrect target');g.evaluate(b);}""")
     await page.wait_for_function('window.testState.answers.length===1',timeout=10000)
     assert await frm.evaluate('window.__mmSchoolGame.session.index')==0
    for i in range(2):
     await frm.wait_for_function('(i)=>window.__mmSchoolGame?.state==="question" && window.__mmSchoolGame.session.index===i',arg=i,timeout=60000)
     await frm.evaluate("""() => {const g=window.__mmSchoolGame,b=g.targets.current.find(x=>String(x.optionId)==='0');if(!b)throw Error('Missing correct target');g.evaluate(b);}""")
    await page.wait_for_function('window.testState.finishes===1',timeout=60000)
    await frm.wait_for_function('window.__mmSchoolGame?.state==="done"',timeout=15000)
    state=await page.evaluate('window.testState')
    assert state['errors']==[],state
    assert len(state['answers'])==(3 if mode=='group' else 2),state
    assert [v['index'] for v in state['answers'] if v['value']=='0']==[0,1]
    if mode=='group':
     done=await f.locator('#scrEnd').inner_text()
     assert 'الجماعية' in done or 'دون درجة فردية' in done
    report['cases'].append({'mode':mode,'status':'PASS','answers':len(state['answers']),'finishCount':state['finishes']})
    print('PASS integrated real WebGL school iframe',mode,flush=True)
    await ctx.close()
   assert report['pageErrors']==[],report['pageErrors']
   assert report['missing']==[],report['missing']
   assert report['external']==[],report['external']
   report['status']='PASS'
  finally:
   await browser.close()
 os.makedirs('.muhimmat-v11-review/results',exist_ok=True)
 with open('.muhimmat-v11-review/results/school-iframe.json','w') as f:json.dump(report,f,ensure_ascii=False,indent=2)
 print(json.dumps(report,ensure_ascii=False),flush=True)
asyncio.run(run())
