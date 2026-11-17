'use strict';
/* Interactive real WebGL horse race; synthetic school grading, no network/write to production. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),artifact=path.join(root,'.horse-review/results');
fs.mkdirSync(artifact,{recursive:true});
const fixture=String.raw`<!doctype html><html lang="ar"><meta charset="utf-8"><title>Horse host test</title>
<iframe id="horse" title="سباق الخيل" style="width:1250px;height:800px" src="/games/horse-jumping-race/index.html?school=1&capture=1&debug=1"></iframe>
<script src="/js/horse-race-host.js"></script><script>
window.fixture={calls:[],finished:0,grades:0,errors:[],ready:false};
const frame=document.querySelector('#horse');const questions=[{id:'one',type:'multiple_choice',text:'السؤال الأول من المعلم',options:['الخيار الصحيح','الخيار غير الصحيح'],points:10},{id:'two',type:'true_false',text:'السؤال الثاني من المعلم',options:['صح','خطأ'],points:10}];
const attempts=[];
const handler=window.ManaratHorseRaceHost.create({frame,questions,mode:new URLSearchParams(location.search).get('mode')||'home',studentName:'طالب تجريبي',
 answer:async p=>{window.fixture.calls.push(p);const previous=window.fixture.calls.filter(x=>x.question===p.question).length-1;const correct=p.value===0;return {correct,points:correct&&previous===0?10:0,pending:false,explanation:correct?'أحسنت':''};},
 finish:async()=>{window.fixture.finished++;return {score:50,group:false,pending:false};},
 restart:async()=>{},exit:()=>{},onGrade:()=>window.fixture.grades++,onFinished:()=>window.fixture.ready=true});
</script></html>`;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');if(u.pathname==='/__horse_e2e'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fixture);}
 let file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(err,b)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(b);});
});
async function run(){let browser;const report={status:'RUNNING',error:null,modes:[],pageErrors:[],missingFiles:[],externalRequests:[]};
 try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const mode of ['home','group','individual']){
   const context=await browser.newContext({viewport:{width:1460,height:900}}),page=await context.newPage();
   page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missingFiles.push(r.url());});
   await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base||['data:','blob:'].includes(u.protocol))return route.continue();report.externalRequests.push(u.href);return route.abort();});
   await page.goto(base+'/__horse_e2e?mode='+mode,{waitUntil:'domcontentloaded'});
   const frame=page.frameLocator('#horse');
   await frame.locator('#qcr-start:not([hidden])').waitFor({timeout:120000});
   const iframe=page.frames().find(f=>f!==page.mainFrame()&&f.url().includes('/games/horse-jumping-race/'));
   assert(iframe,'Game frame missing');
   await iframe.waitForFunction(()=>window.HorseJumpingRace?.debug?.state==='ready',{timeout:10000});
   const qLen=await iframe.evaluate(()=>window.HorseJumpingRace.debug.model().fences.length);
   assert.equal(qLen,2,'Student task question count must equal fence count');
   const br=await iframe.evaluate(()=>window.HorseJumpingRace.debug.settings().mode);assert.equal(br,mode==='group'?'classroom':'solo');
   await frame.locator('[data-action="start"]').click();
   await iframe.evaluate(()=>window.HorseJumpingRace.debug.advance(15));
   await iframe.waitForFunction(()=>window.HorseJumpingRace?.debug?.state==='question'&&window.HorseJumpingRace.debug.current()?.index===0,{timeout:10000});
   if(mode==='home'){
    await iframe.evaluate(()=>{const g=window.HorseJumpingRace.debug._c;const choice=g.current.question.choices.find(c=>c.id==='1');g._choose(choice.id);});
    await iframe.waitForFunction(()=>window.HorseJumpingRace.debug.state==='feedback',{timeout:10000});
    assert.equal((await page.evaluate(()=>window.fixture.calls)).length,1);
    await iframe.evaluate(()=>window.HorseJumpingRace.debug.advance(13));
    await iframe.waitForFunction(()=>window.HorseJumpingRace.debug.state==='question'&&window.HorseJumpingRace.debug._c.current?.attempt===2,{timeout:10000});
   }
   for(let i=0;i<2;i++){
    await iframe.evaluate(i=>{const g=window.HorseJumpingRace.debug._c;if(g.current?.index!==i)throw Error('Unexpected stage '+g.current?.index);g._choose('0');},i);
    await iframe.waitForFunction(()=>window.HorseJumpingRace.debug.state==='feedback',{timeout:10000});
    if(mode==='group')await iframe.evaluate(()=>window.HorseJumpingRace.debug._c._continueAfterFeedback());
    await iframe.evaluate(()=>window.HorseJumpingRace.debug.advance(10));
    if(i===0)await iframe.waitForFunction(()=>window.HorseJumpingRace.debug.state==='question'&&window.HorseJumpingRace.debug.current()?.index===1,{timeout:10000});
   }
   await iframe.evaluate(()=>window.HorseJumpingRace.debug.advance(16));
   await page.waitForFunction(()=>window.fixture?.finished===1,{timeout:20000});
   const state=await page.evaluate(()=>window.fixture);
   assert.equal(state.grades,2);assert.equal(state.calls.length,mode==='home'?3:2);assert.equal(state.finished,1);
   await iframe.waitForFunction(()=>window.HorseJumpingRace.debug.state==='results',{timeout:10000});
   report.modes.push({mode,status:'PASS',questionCount:qLen,answers:state.calls.length,graded:state.grades,finish:state.finished});
   if(mode==='group')await page.screenshot({path:path.join(artifact,'horse-classroom.png')});
   await context.close();
  }
  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.missingFiles,[]);assert.deepEqual(report.externalRequests,[]);
  report.status='PASS';console.log(JSON.stringify(report));
 }catch(e){report.status='FAIL';report.error=String(e.stack||e);console.error(e);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(artifact,'browser.json'),JSON.stringify(report,null,2));if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
run();
