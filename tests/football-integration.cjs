const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,'http://x').pathname);if(file.endsWith('/'))file+='index.html';fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);return res.end('not found')}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(d);});});
const teacher='22222222-2222-4222-8222-222222222222',questions=[{id:'q1',type:'multiple_choice',text:'ما العنصر الذي يحتاجه النبات؟',options:['الماء','البلاستيك'],points:10},{id:'q2',type:'open_text',text:'اشرح أهمية الماء.',points:10}];
const config={name:'مدرسة أبو عبيدة الإعدادية للبنين',subtitle:'منصة التعلّم التفاعلي',primary:'#8a1538',background:'#f8f6f4',hero:'تعلّم بطريقتك. وتقدّم كل يوم.',description:'ألعاب تعليمية ومهمات صفية وواجبات منزلية، في مساحة واحدة تجمع معلمي المدرسة وطلابها.',socials:[],sections:['games','videos','about']};
const assignment={id:'as',code:'code',teacher_id:teacher,title:'لعبة النباتات المائية',game_id:'g',class_name:'سابع 1',active:true,settings:{templates:['race','football','basketball','volleyball','bowling','fishing','puzzle','classic'],types:['multiple_choice','open_text']},types:['multiple_choice','open_text'],videos:[]};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let answers=0,starts=0;
await page.addInitScript(()=>{window.__FOOTBALL_MANUAL=true;if(window===top){window.__qmsg=0;window.addEventListener('message',e=>{if(e.data&&e.data.type==='school-football-question')window.__qmsg++;});}window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='school-football-config')window.__footballTestConfig=e.data;});});await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1')return r.continue();if(u.pathname.endsWith('/school-api')){const b=r.request().postDataJSON();let j={};switch(b.action){case'settings':j=config;break;case'dashboard':j={profile:{id:teacher,name:'معلم الاختبار',admin:true},games:[{id:'g',title:'لعبة النباتات المائية',teacher_id:teacher,data:{questions}}],assignments:[assignment],videos:[],sessions:[],teachers:[]};break;case'open':j=assignment;break;case'start':starts++;j={id:'s',secret:'secret',questions,threshold:70};break;case'answer':answers++;j={correct:b.question==='q1',pending:b.question==='q2',feedback:'تم تسجيل إجابتك',explanation:''};break;case'finish':j={score:50,pending:true,group:false};break;case'settingsHistory':case'leaderboard':case'saveSettings':j=[];break;case'assignment':j=assignment;break;}return r.fulfill({json:j});}return r.fulfill({json:[]});});
const shots=process.env.FOOTBALL_SHOTS||'';const snap=async(p,n)=>{if(shots)try{await p.screenshot({path:path.join(shots,n+'.png'),timeout:90000})}catch(e){console.log('screenshot skipped',n)}};
const until=async(fr,cond,max=40)=>{for(let t=0;t<=max;t+=1){const ok=await fr.evaluate(c=>{const f=new Function('return ('+c+')');if(!f()){for(let i=0;i<4&&!f();i++)Football.step(0.25,false)}return f()},cond);if(ok){await fr.evaluate(()=>Football.render());return true;}await new Promise(r=>setTimeout(r,20));}return false;};
const key=(fr,type,k,code)=>fr.evaluate(([t,k,c])=>document.dispatchEvent(new KeyboardEvent(t,{key:k,code:c,bubbles:true})),[type,k,code]);
/* penalties: aim -> shoot -> question (no passing, no build-up) */
const toQuestionPenalty=async fr=>{assert(await until(fr,'Football.phase==="ready"',40),'penalty aim phase reached');assert.equal(await fr.evaluate(()=>Football.match.passN),0,'no pass in penalties');await fr.evaluate(()=>Football.step(0.5,false));await fr.locator('#shoot').click();assert(await until(fr,'Football.phase==="question"',30),'question phase reached');};
/* interactive match: move with the keyboard, pass with E, shoot with Space when in range */
const toQuestionMatch=async fr=>{assert(await until(fr,'Football.phase==="play"',40),'match play phase reached');await key(fr,'keydown','w','KeyW');await fr.evaluate(()=>Football.step(0.8,false));
 await key(fr,'keydown','e','KeyE');await key(fr,'keyup','e','KeyE');assert(await until(fr,'Football.state==="play"&&Football.controlled!=="M"',10),'pass received');
 assert(await until(fr,'Football.canShoot&&Football.match.shotDistance()<20',20),'reached shooting range');await key(fr,'keyup','w','KeyW');await key(fr,'keydown',' ','Space');await key(fr,'keyup',' ','Space');
 assert(await until(fr,'Football.phase==="question"',30),'question phase reached');};
const open=async()=>{await page.goto('about:blank',{waitUntil:'commit',timeout:180000});await page.goto(base+'/?task=code',{timeout:180000});await page.locator('#studentName').fill('طالب كرة القدم');await page.locator('[data-action=selectTemplate][data-id=football]').click();await page.locator('#startForm button').last().click();await page.locator('#footballGame').waitFor();let F=null;for(let i=0;i<200&&!F;i++){F=page.frames().find(f=>f.url().includes('/games/football/'));if(!F)await page.waitForTimeout(100);}const fl=page.frameLocator('#footballGame');const fr=Object.assign(F,{locator:s=>fl.locator(s)});await fr.waitForFunction(()=>window.Football&&Football.phase==='welcome',null,{timeout:300000});return fr;};
const hostile=async fr=>{ // wrong token / other sport / untrusted origin / foreign source / wrong index must not move the game
 await page.evaluate(()=>{const w=document.getElementById('footballGame').contentWindow;w.postMessage({type:'school-football-result',token:'not-the-session-token',index:0,correct:true,pending:false,feedback:'x'},location.origin);w.postMessage({type:'school-basketball-result',token:'x',index:0,correct:true},location.origin);});
 await page.waitForTimeout(300);
 await fr.evaluate(()=>{const c=window.__footballTestConfig;if(!c)throw Error('missing test config');const data={type:'school-football-result',token:c.token,index:Football.round,correct:true,pending:false};for(const overrides of [{origin:'https://untrusted.invalid'},{source:window},{data:{...data,index:99}}])window.dispatchEvent(new MessageEvent('message',{data,origin:location.origin,source:parent,...overrides}));});
 assert.equal(await fr.evaluate(()=>Football.phase),'question','hostile messages ignored');};
const title='لعبة النباتات المائية';

/* ===== session 1: penalties ===== */
let fr=await open();
await snap(page,'int_welcome');
assert.equal(await page.evaluate(()=>window.__qmsg),0);assert.equal(starts,1,'one session started');
assert.deepEqual(await fr.evaluate(()=>[...document.querySelectorAll('[data-game-mode]')].map(b=>[b.dataset.gameMode,b.disabled])),[['penalties',false],['match',false]],'both modes offered');
assert.equal(await fr.evaluate(()=>document.getElementById('taskTitle').textContent),title,'assignment title shown in the game');
await fr.locator('#modePenalties').click();await fr.locator('#skip').click();
assert.equal(await fr.evaluate(()=>Football.gameMode),'penalties');assert.equal(starts,1,'choosing a mode does not start another session');assert.equal(answers,0,'choosing a mode does not answer');assert.equal(await page.evaluate(()=>window.__qmsg),0,'choosing a mode does not consume a question');
await toQuestionPenalty(fr);
assert.equal(await fr.evaluate(()=>Football.flight),.5);assert.equal(await page.evaluate(()=>window.__qmsg),1);
await page.locator('#modal [data-action=answer]').first().waitFor({timeout:60000});await snap(page,'int_question');
await hostile(fr);assert.equal(await fr.evaluate(()=>Football.goals),0);console.log('PASS hostile messages ignored: wrong token, other sport, untrusted origin, foreign source, wrong index');
await fr.evaluate(()=>Football.step(0.5));assert.equal(await fr.evaluate(()=>Football.flight),.5);
await page.locator('#modal [data-action=answer]').first().click();
await page.locator('#modal').waitFor({state:'hidden'});
assert(await until(fr,'Football.phase==="outcome"',30));
await fr.locator('#momentTitle').filter({hasText:'جــــــــول'}).waitFor();assert.equal(answers,1);assert.equal(await fr.evaluate(()=>Football.goals),1);
// the same result delivered again (duplicate) is ignored
await fr.evaluate(()=>{const c=window.__footballTestConfig;window.dispatchEvent(new MessageEvent('message',{data:{type:'school-football-result',token:c.token,index:0,correct:true,pending:false},origin:location.origin,source:parent}));});
await fr.evaluate(()=>Football.step(0.5));assert.equal(await fr.evaluate(()=>Football.goals),1,'duplicate result does not add a goal');assert.equal(await fr.evaluate(()=>Football.phase),'outcome');
console.log('PASS penalties: no passing, correct answer → server grading → goal; duplicate result ignored');
await fr.locator('#next').click();await toQuestionPenalty(fr);
await page.locator('#answerText').fill('الماء ضروري للنمو');await page.locator('[data-action=textAnswer]').click();
assert(await until(fr,'Football.phase==="outcome"',30));
await fr.locator('#momentTitle').filter({hasText:'وصلت إجابتك'}).waitFor();
assert.equal(await fr.evaluate(()=>Football.goals),1);assert.equal(await fr.evaluate(()=>Football.outcome),'pending');
assert.equal(await fr.evaluate(()=>document.getElementById('feedback').classList.contains('miss')),false);console.log('PASS pending essay stays neutral (no goal, no miss styling)');
await snap(page,'int_pending');
await fr.locator('#next').click();await page.waitForFunction(()=>!!document.querySelector('.result-score'),null,{polling:250,timeout:240000});assert.equal(answers,2);const rep=await page.locator('#app').innerText();assert(rep.includes('الدرجة مبدئية'));assert(rep.includes(title),'final report shows the assignment title');assert.equal(await page.evaluate(()=>window.__qmsg),2,'each question asked exactly once');console.log('PASS penalties final report with the assignment title; each question processed once');

/* ===== session 2: interactive match ===== */
answers=0;fr=await open();await page.evaluate(()=>{window.__qmsg=0;});
await fr.locator('#modeMatch').click();await fr.locator('#skip').click();assert.equal(await fr.evaluate(()=>Football.gameMode),'match');
// lost possession before the shot: the attack is rebuilt, no question is used, nothing is answered
assert(await until(fr,'Football.phase==="play"',40));
await fr.evaluate(()=>{const m=Football.match;m.turnover('tackle',m.defs[1]);});
assert(await until(fr,'Football.phase==="play"&&Football.attempt===1&&Football.state==="play"',10),'attack rebuilt after a turnover');
assert.equal(await fr.evaluate(()=>Football.round),0,'same question index after a turnover');assert.equal(await page.evaluate(()=>window.__qmsg),0,'turnover did not consume a question');assert.equal(answers,0);
console.log('PASS match: lost possession rebuilds the attack without consuming the question');
await toQuestionMatch(fr);assert.equal(await page.evaluate(()=>window.__qmsg),1);
await page.locator('#modal [data-action=answer]').first().waitFor({timeout:60000});await snap(page,'int_match_question');
await hostile(fr);
await page.locator('#modal [data-action=answer]').first().click();await page.locator('#modal').waitFor({state:'hidden'});
assert(await until(fr,'Football.phase==="outcome"',30));assert.equal(await fr.evaluate(()=>Football.outcome),'goal');assert.equal(await fr.evaluate(()=>Football.goals),1);assert.equal(answers,1);
console.log('PASS match: move, pass, shoot, question, correct answer → goal');
await fr.locator('#next').click();await toQuestionMatch(fr);
await page.locator('#answerText').fill('الماء ضروري للنمو');await page.locator('[data-action=textAnswer]').click();
assert(await until(fr,'Football.phase==="outcome"',30));assert.equal(await fr.evaluate(()=>Football.outcome),'pending');assert.equal(await fr.evaluate(()=>Football.goals),1);
await fr.locator('#next').click();await page.waitForFunction(()=>!!document.querySelector('.result-score'),null,{polling:250,timeout:240000});assert.equal(answers,2);assert((await page.locator('#app').innerText()).includes(title));
console.log('PASS match final report');

/* very long RTL question + long options: the panel must scroll internally, never the page; targets >= 44px; every option reachable */
{const longText='اقرأ النص التالي بعناية ثم أجب: '+'تُعدّ المحافظة على البيئة المائية مسؤولية مشتركة بين جميع أفراد المجتمع، ويبدأ ذلك من ترشيد الاستهلاك وعدم رمي المخلفات في المجاري والسواحل، '.repeat(14)+'فما أهم عنصر يحتاجه النبات المائي لينمو؟';
questions[0]={...questions[0],text:longText,options:['الماء النقي والضوء الكافي وثاني أكسيد الكربون مع توفر المغذيات '.repeat(3),'البلاستيك والمعادن الثقيلة '.repeat(4),'الرمل الجاف فقط دون أي ماء '.repeat(4),'الظلام الدائم وانعدام الأكسجين '.repeat(4),'لا شيء مما سبق على الإطلاق '.repeat(4),'جميع ما سبق صحيح '.repeat(5)]};
for(const vp of [{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1366,height:768}]){
 await page.setViewportSize(vp);const f2=await open();await f2.locator('#modePenalties').click();await f2.locator('#skip').click();await toQuestionPenalty(f2);
 const m=page.locator('dialog#modal.football-question');await m.waitFor({timeout:60000});
 const info=await page.evaluate(()=>{const d=document.getElementById('modal'),c=document.getElementById('modalContent'),r=d.getBoundingClientRect(),bs=[...d.querySelectorAll('.answers button')].map(b=>b.getBoundingClientRect().height);return{r:{l:r.left,t:r.top,rr:r.right,b:r.bottom},vw:innerWidth,vh:innerHeight,scrolls:c.scrollHeight>c.clientHeight,pageScroll:document.documentElement.scrollWidth>innerWidth+1,minBtn:Math.min(...bs),n:bs.length}});
 assert(info.r.l>=-1&&info.r.t>=-1&&info.r.rr<=info.vw+1&&info.r.b<=info.vh+1,'modal inside viewport '+JSON.stringify(info));assert(!info.pageScroll,'no horizontal page scroll');assert(info.minBtn>=44,'touch targets >=44px '+info.minBtn);assert.equal(info.n,6);
 await page.locator('#modal [data-action=answer]').last().scrollIntoViewIfNeeded();const last=await page.locator('#modal [data-action=answer]').last().boundingBox();assert(last.y>=info.r.t-1&&last.y+last.height<=info.r.b+1,'last option reachable inside panel');
 await snap(page,'int_long_'+vp.width+'x'+vp.height);
 await page.locator('#modal [data-action=answer]').last().click();await page.locator('#modal').waitFor({state:'hidden'});
 assert(await until(f2,'Football.phase==="outcome"',40));}
console.log('PASS very long RTL question: internal scroll only, >=44px targets, 4 viewports');}
assert.deepEqual(errors,[]);await browser.close();server.close();console.log('PASS embedded football (both modes): server grading, hostile messages, duplicates, turnovers, manual-review neutrality, titles and final reports');})().catch(e=>{console.error(e);server.close();process.exit(1)});
