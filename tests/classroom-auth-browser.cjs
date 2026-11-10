'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const teacher='22222222-2222-4222-8222-222222222222';
const user={id:teacher,email:'fixture@example.invalid',user_metadata:{name:'معلم الاختبار',educator_gender:'male'}};
const session=()=>({access_token:'fixture-teacher-token',refresh_token:'fixture-refresh',expires_at:9999999999,user});
const questions=[{id:'fixture-q',type:'multiple_choice',text:'سؤال اختبار التشغيل الصفي',options:['الإجابة الأولى','الإجابة الثانية'],points:10}];
const assignment={id:'fixture-assignment',code:'fixture-code',teacher_id:teacher,title:'اختبار تشغيل المهمة',game_id:'fixture-game',class_name:'السابع 1',active:true,settings:{templates:['classic'],types:['multiple_choice'],passing_score:70},types:['multiple_choice'],videos:[]};
const config={name:'مدرسة أبو عبيدة الإعدادية للبنين',subtitle:'منصة التعلم التفاعلي',primary:'#8a1538',background:'#f8f6f4',socials:[],sections:['games','videos','about']};
let browser;
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(file===root||pathname.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(body);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],starts=[];let refreshes=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.hostname==='127.0.0.1')return route.continue();
  if(url.pathname==='/auth/v1/token'){refreshes++;return route.fulfill({json:{...session(),access_token:'fixture-refreshed-token'}});}
  if(url.pathname.endsWith('/school-api')){
   const body=request.postDataJSON();let value={};
   if(body.action==='settings')value=config;
   else if(body.action==='profile')value={id:teacher,name:'معلم الاختبار',role:'teacher',admin:false};
   else if(body.action==='dashboard')value={profile:{id:teacher,name:'معلم الاختبار',role:'teacher',admin:false},games:[{id:'fixture-game',title:assignment.title,teacher_id:teacher,data:{questions}}],assignments:[assignment],sessions:[],teachers:[],videos:[]};
   else if(body.action==='open')value=assignment;
   else if(body.action==='start'){
    const auth=request.headers().authorization;starts.push({body,auth});
    if(['group','individual'].includes(body.mode)&&!['Bearer fixture-teacher-token','Bearer fixture-refreshed-token'].includes(auth))return route.fulfill({status:401,json:{error:'سجّل الدخول أولًا.'}});
    value={id:'fixture-session-'+starts.length,secret:'fixture-secret',questions,threshold:70};
   }else if(body.action==='answer')value={correct:true,pending:false,points:10,max:10,feedback:'أحسنت!',explanation:''};
   else if(body.action==='finish')value={score:100,pending:false,passed:true,group:starts.at(-1)?.body.mode==='group'};
   else if(body.action==='leaderboard')value=[];
   return route.fulfill({json:value});
  }
  return route.fulfill({json:[]});
 });
 await page.goto(base+'/?login=1');await page.locator('#authForm').waitFor();
 await page.evaluate(s=>localStorage.setItem(Manarat.AUTH_SESSION_KEY,JSON.stringify(s)),session());
 for(const mode of ['group','individual']){
  await page.goto(base+'/?dashboard=1');await page.locator('[data-action="tab"][data-id="assignments"]').click();await page.locator('[data-action="class"]').click();await page.locator('[data-action="'+(mode==='group'?'classGroup':'classIndividual')+'"]').click();await page.locator('#startForm').waitFor();
  if(mode==='individual')await page.locator('#studentName').fill('طالب الاختبار');else assert.equal(await page.locator('#studentName').count(),0);
  // Expire the actual application session immediately before pressing Start.
  await page.evaluate(()=>{const s=Manarat.authSession();s.expires_at=1;localStorage.setItem(Manarat.AUTH_SESSION_KEY,JSON.stringify(s));});
  const count=starts.length;await page.locator('#startForm button').last().click();await page.locator('[data-action="answer"]').first().waitFor();
  assert.equal(starts.length,count+1);assert.equal(starts.at(-1).body.mode,mode);assert.equal(starts.at(-1).auth,'Bearer fixture-refreshed-token');
  await page.evaluate(async()=>{const s=Manarat.authSession();s.expires_at=1;localStorage.setItem(Manarat.AUTH_SESSION_KEY,JSON.stringify(s));await ManaratGameControls.restart();});
  assert.equal(starts.length,count+2);assert.equal(starts.at(-1).body.mode,mode);assert.equal(starts.at(-1).auth,'Bearer fixture-refreshed-token');
  await page.locator('[data-action="answer"]').first().click();await page.locator('[data-action="next"]').click();await page.locator('.result-score').waitFor();
  assert((await page.locator('#app').innerText()).includes(assignment.title));console.log('PASS browser '+mode+' start, actual session refresh, restart, answer and finish');
 }
 await page.evaluate(()=>localStorage.removeItem(Manarat.AUTH_SESSION_KEY));const refreshBeforeHome=refreshes;
 await page.goto(base+'/?task=fixture-code');await page.locator('#studentName').fill('طالب الواجب');await page.locator('#startForm button').last().click();await page.locator('[data-action="answer"]').first().waitFor();assert.equal(starts.at(-1).body.mode,'home');assert.equal(starts.at(-1).auth,undefined);assert.equal(refreshes,refreshBeforeHome);
 await page.locator('[data-action="answer"]').first().click();await page.locator('[data-action="next"]').click();await page.locator('.result-score').waitFor();console.log('PASS browser anonymous homework start, answer and finish');
 assert.equal(refreshes,4);assert.deepEqual(errors,[]);console.log('CLASSROOM AUTH BROWSER ALL PASS');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
