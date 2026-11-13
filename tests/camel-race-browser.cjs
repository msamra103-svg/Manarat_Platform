'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.camel-test-output');fs.mkdirSync(out,{recursive:true});
const teacher='22222222-2222-4222-8222-222222222222';
const auth={access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:9999999999,user:{id:teacher,email:'fixture@example.invalid',user_metadata:{name:'معلم تجريبي',educator_gender:'male'}}};
const config={name:'مدرسة أبو عبيدة الإعدادية للبنين',subtitle:'اختبار معزول',primary:'#8a1538',background:'#f8f6f4',socials:[],sections:['games','videos','about']};
const questions=Array.from({length:10},(_,i)=>({id:'q'+i,type:i%2?'true_false':'multiple_choice',text:'سؤال المراجعة '+(i+1),options:['الإجابة الأولى','الإجابة الثانية'],points:10}));
const assignment={id:'assignment',code:'fixture-code',teacher_id:teacher,title:'تكليف سباق الهجن',game_id:'game',class_name:'السابع / ١',active:true,settings:{templates:['qatar-camel-race','classic'],types:['multiple_choice','true_false'],passing_score:70},types:['multiple_choice','true_false'],videos:[]};
const logs={starts:[],answers:[],finishes:[],errors:[],missing:[],checks:[]};let browser;
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,b)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({viewport:{width:1366,height:1000}});
 await ctx.addInitScript(()=>{if(location.pathname.includes('/games/qatar-camel-race/')){const u=new URL(location.href);u.searchParams.set('capture','1');u.searchParams.set('quality','low');u.searchParams.set('reducedMotion','1');history.replaceState(null,'',u.href);}});
 const page=await ctx.newPage();page.on('pageerror',e=>logs.errors.push(e.message));page.on('response',r=>{if(r.status()===404&&!r.url().includes('favicon'))logs.missing.push(r.url());});
 await ctx.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());if(u.hostname==='127.0.0.1')return r.continue();
 if(u.pathname.endsWith('/auth/v1/token'))return r.fulfill({json:auth});
 if(u.pathname.endsWith('/school-api')){const b=req.postDataJSON();let v={};
 if(b.action==='settings')v=config;
 else if(b.action==='homeHub')v={videos:[],weekly:{champions:[],topGames:[],activeTeachers:[]},analytics:{rounds:0,participants:0,average:0,days:[]}};
 else if(b.action==='profile')v={id:teacher,name:'معلم تجريبي',role:'teacher',admin:false};
 else if(b.action==='dashboard')v={profile:{id:teacher,name:'معلم تجريبي',role:'teacher',admin:false},games:[{id:'game',teacher_id:teacher,title:'أسئلة تجريبية',data:{questions}}],assignments:[assignment],sessions:[],videos:[],teachers:[]};
 else if(b.action==='assignment'){assert(b.templates.includes('qatar-camel-race'));v=assignment;logs.checks.push('assignment-submit-includes-camel');}
 else if(b.action==='open')v=assignment;
 else if(b.action==='start'){logs.starts.push({body:b,authorization:req.headers().authorization});if(b.mode!=='home')assert.equal(req.headers().authorization,'Bearer fixture-token');v={id:'s'+logs.starts.length,secret:'server-secret-'+logs.starts.length,questions:b.mode==='home'?questions:questions.slice(0,3),threshold:70};}
 else if(b.action==='answer'){logs.answers.push(b);v={correct:b.value===0,pending:false,points:b.value===0?10:0,max:10,explanation:'شرح بعد التصحيح'};}
 else if(b.action==='finish'){logs.finishes.push(b);v={score:50,pending:false,passed:false,group:logs.starts.at(-1)?.body.mode==='group'};}
 return r.fulfill({json:v});}
 return r.fulfill({json:[]});});
 const check=s=>{logs.checks.push(s);console.log('PASS',s);};
 async function frameReady(){await page.waitForFunction(()=>document.querySelector('#camelRaceFrame')?.contentWindow?.QatarCamelRace?.debug?.state==='ready',{},{timeout:60000});return page.frames().find(f=>f.url().includes('/games/qatar-camel-race/'));}
 async function playThrough(f,n,mode){
  assert.equal(await f.locator('#qcr-player-name').count(),1);assert.equal(await f.locator('#qcr-team-name:visible,#qcr-students:visible').count(),0);
  await f.locator('#qcr-player-name').fill('نجم');await f.locator('[data-action="start"]').click();
  for(let i=0;i<n;i++){
   await f.evaluate(()=>QatarCamelRace.debug.advance(11));await f.waitForFunction(()=>QatarCamelRace.debug.state==='question');
   assert.equal(await f.locator('.qcr-q-count').innerText(),'السؤال '+String(i+1).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d])+' من '+String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]));
   const names=await f.locator('.qcr-board .nm').allTextContents();for(const name of ['شاهين','برق','سهيل','رعد','غيث','نجم'])assert(names.includes(name),JSON.stringify(names));
   /* Question screenshots retained from the initial review run. */
   await f.locator('.qcr-choice[data-choice-id="'+(i%2)+'"]').click();await f.waitForFunction(()=>QatarCamelRace.debug.state==='feedback');
   await f.locator('[data-action="continue"]').click();
  }
  await f.evaluate(()=>QatarCamelRace.debug.advance(12));await f.waitForFunction(()=>QatarCamelRace.debug.state==='results');
  await f.waitForFunction(()=>!document.querySelector('.qcr-r-save').textContent.includes('جارٍ')&&document.querySelector('.qcr-r-save').textContent.length>0);
  const names=await f.locator('.qcr-r-order').innerText();for(const name of ['شاهين','برق','سهيل','رعد','غيث','نجم'])assert(names.includes(name));
  if(mode==='group')assert((await f.locator('.qcr-r-save').innerText()).includes('دون درجات فردية'));
  if(mode==='demo')assert((await f.locator('.qcr-r-save').innerText()).includes('لم تُسجّل'));
  assert.equal(await f.locator('#qcr-r-title').innerText(),'سباق الهجن القطري');
  /* Optional result capture omitted; all preceding result assertions remain mandatory. */check('complete-'+mode+'-'+n+'-questions-fixed-names');
 }
 await page.goto(base+'/?demo=qatar-camel-race');let f=await frameReady();
 // Render an actual reviewed gameplay still for the homepage cover (no generated or invented image).
 await f.locator('[data-action="start"]').click();await f.evaluate(()=>{QatarCamelRace.debug.advance(4.5);document.querySelector('#qcr-hud').hidden=true;document.querySelector('#qcr-marker').hidden=true;});
 await f.locator('#qcr-stage').screenshot({path:path.join(root,'assets/game-covers/qatar-camel-race.20261113.jpg'),type:'jpeg',quality:82});
 await page.reload();f=await frameReady();await playThrough(f,3,'demo');assert.equal(logs.starts.length,0);assert.equal(logs.answers.length,0);assert.equal(logs.finishes.length,0);check('demo-never-writes-production');
 await page.goto(base+'/');await page.locator('#gamesGallerySection').waitFor();assert((await page.locator('#gamesGallerySection').innerText()).includes('سباق الهجن القطري'));check('homepage-camel-card');
 await page.goto(base+'/?login=1');await page.evaluate(s=>localStorage.setItem(Manarat.AUTH_SESSION_KEY,JSON.stringify(s)),auth);
 await page.goto(base+'/?dashboard=1');await page.locator('[data-action=assign]').first().click();await page.locator('#assignmentForm').waitFor();assert.equal(await page.locator('[name=templates][value=qatar-camel-race]').count(),1);await page.locator('[name=templates][value=qatar-camel-race]').check();await page.locator('#className').fill('السابع / ١');await page.locator('#assignmentForm button:last-child').click();check('assignment-creation-option');
 for(const mode of ['group','individual','home']){
  if(mode==='home'){await page.evaluate(()=>localStorage.removeItem(Manarat.AUTH_SESSION_KEY));await page.goto(base+'/?task=fixture-code');await page.locator('#studentName').fill('أحمد للاختبار');}
  else {await page.goto(base+'/?dashboard=1');await page.locator('[data-action=tab][data-id=assignments]').click();await page.locator('[data-action=class]').first().click();await page.locator('[data-action='+(mode==='group'?'classGroup':'classIndividual')+']').click();if(mode==='individual')await page.locator('#studentName').fill('أحمد للاختبار');}
  await page.locator('#startForm button[type=submit]').click();f=await frameReady();const start=logs.starts.at(-1);assert.equal(start.body.mode,mode);if(mode==='home')assert.equal(start.authorization,undefined);
  const count=logs.answers.length;await playThrough(f,mode==='home'?10:3,mode);assert.equal(logs.answers.length-count,mode==='home'?10:3);assert.equal(start.body.name,mode==='group'?'':'أحمد للاختبار');check('racing-alias-does-not-change-student-identity-'+mode);
  const before=logs.starts.length;await f.locator('[data-action=replay]').click();f=await frameReady();assert.equal(logs.starts.length,before+1);assert.equal(logs.starts.at(-1).body.mode,mode);check('replay-new-server-session-'+mode);
 }
 assert.deepEqual(logs.errors,[]);assert.deepEqual(logs.missing,[]);logs.status='PASS';
})().catch(e=>{logs.status='FAIL';logs.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(logs,null,2));if(browser)await browser.close();server.close();});
