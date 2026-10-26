/* Football (standalone page) browser test, V22: mode selection, penalties, interactive match, controls, settings, viewports, resilience.
 * The simulation is advanced with the deterministic Football.step() hook (?manual=1), so results do not depend on how fast the machine
 * renders WebGL (software GL in CI is ~1 fps). FOOTBALL_SHOTS=<dir> also saves screenshots. */
const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),shots=process.env.FOOTBALL_SHOTS||'';
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.json':'application/json','.bin':'application/octet-stream','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));if(!file.startsWith(root)){res.writeHead(403);return res.end();}if(file.endsWith('/'))file+='index.html';fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/games/football/';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const errors=[];let context,page;
const newPage=async(opts={})=>{if(context)await context.close();context=await browser.newContext(Object.assign({viewport:{width:1366,height:768}},opts));page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return page;};
const snap=async n=>{if(shots)try{await page.screenshot({path:path.join(shots,n+'.png'),timeout:90000})}catch(e){console.log('screenshot skipped',n)}};
const until=async(cond,max=40)=>{for(let t=0;t<=max;t++){const ok=await page.evaluate(c=>{const f=new Function('return ('+c+')');for(let i=0;i<4&&!f();i++)Football.step(.25,false);return f()},cond);if(ok){await page.evaluate(()=>Football.render());return true;}}return false;};
const load=async(q='?manual=1')=>{await page.goto(base+q,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.Football&&Football.phase==='welcome',null,{timeout:300000,polling:250});};
const key=(type,k,code)=>page.evaluate(([t,k,c])=>document.dispatchEvent(new KeyboardEvent(t,{key:k,code:c,bubbles:true})),[type,k,code]);
const choose=async i=>{await page.locator('#choices button').nth(i).click();assert(await until('Football.phase==="outcome"',40),'outcome phase');};
const penaltyToQuestion=async()=>{assert(await until('Football.phase==="ready"',40),'penalty aim');assert.equal(await page.evaluate(()=>Football.match.passN),0,'penalties never need a pass');await page.evaluate(()=>Football.step(.5,false));await page.locator('#shoot').click();assert(await until('Football.phase==="question"',30),'question');};

/* ---------- 1. mode selection ---------- */
await newPage();await load();await snap('welcome');
assert.equal(await page.locator('#modePenalties b').textContent(),'ضربات الجزاء');assert.equal(await page.locator('#modeMatch b').textContent(),'مباراة تفاعلية');
assert.equal((await page.locator('#modePenalties small').textContent()).trim(),'سدّد نحو المرمى، وأجب عن السؤال لتسجّل الهدف.');assert.equal((await page.locator('#modeMatch small').textContent()).trim(),'تحرّك ومرّر وسدّد ضمن مباراة تعليمية تفاعلية.');
assert.equal(await page.evaluate(()=>Football.gameMode),null,'no mode before the student chooses');
console.log('PASS mode selection screen: two explicit modes, separate from difficulty/quality');

/* ---------- 2. penalties ---------- */
await page.locator('#modePenalties').click();await page.locator('#skip').click();assert.equal(await page.evaluate(()=>Football.gameMode),'penalties');
assert(await until('Football.phase==="ready"',40));await snap('penalty_aim');
// only the shooter and the keeper are in the penalty area; the ball is on the spot
const pk=await page.evaluate(()=>{const m=Football.match,GZ=-20;return{ball:m.ball.p.toArray(),inside:m.players.filter(p=>p!==m.shooter&&p!==m.keeper&&p.id!=='R'&&p.pos.z<GZ+16.5&&Math.abs(p.pos.x)<20.16).map(p=>p.id)};});
assert(Math.abs(pk.ball[0])<0.01&&Math.abs(pk.ball[2]-(-9))<0.05,'ball on the penalty spot '+pk.ball);assert.deepEqual(pk.inside,[],'only shooter and keeper inside the area');
await page.locator('[data-aim=left]').click();assert((await page.evaluate(()=>Football.aim)).x<0);await page.locator('[data-aim=right]').click();assert((await page.evaluate(()=>Football.aim)).x>0);
await page.keyboard.press('ArrowLeft');const kx=(await page.evaluate(()=>Football.aim)).x;assert(kx<.68&&kx>.5,'keyboard nudges the aim');
const cb=await page.locator('#pitch').boundingBox();await page.mouse.move(cb.x+cb.width*.5,cb.y+cb.height*.45);await page.mouse.down();await page.mouse.move(cb.x+cb.width*.35,cb.y+cb.height*.4,{steps:4});await page.mouse.up();assert.notEqual((await page.evaluate(()=>Football.aim)).x,kx,'drag on the pitch aims');
await page.locator('#power').fill('85');assert.equal(Math.round((await page.evaluate(()=>Football.aim)).power*100),85);
await page.locator('#shoot').click();assert(await until('Football.phase==="question"',30));assert.equal(await page.evaluate(()=>Football.flight),.5);await page.evaluate(()=>Football.step(.6));assert.equal(await page.evaluate(()=>Football.flight),.5,'the ball stays frozen while the question is open');
await snap('penalty_question');await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'goal');assert.equal(await page.evaluate(()=>Football.goals),1);await snap('penalty_goal');
await page.locator('#next').click();await penaltyToQuestion();await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'wide');assert.equal(await page.evaluate(()=>Football.goals),1);
await page.locator('#next').click();await penaltyToQuestion();await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'save');assert.equal(await page.evaluate(()=>Football.goals),1);await snap('penalty_save');
await page.locator('#next').click();assert.equal(await page.evaluate(()=>Football.phase),'finished');await page.locator('#next').click();await page.evaluate(()=>Football.step(.6));assert.equal(await page.evaluate(()=>Football.goals),0);assert.equal(await page.evaluate(()=>Football.gameMode),'penalties');
console.log('PASS penalties: ball on the spot, area clear, no passing; aim by buttons/keys/drag; freeze at half-way; goal only for a correct answer; save/miss otherwise; restart');

/* ---------- 3. interactive match ---------- */
await load();await page.locator('#modeMatch').click();await page.locator('#skip').click();assert(await until('Football.phase==="play"',40));assert.equal(await page.evaluate(()=>Football.gameMode),'match');
for(const s of ['#stick','#passBtn','#shootBtn'])assert(await page.locator(s).isVisible(),s+' visible');const p0=await page.evaluate(()=>Football.match.ctrl.pos.z);
await key('keydown','w','KeyW');await page.evaluate(()=>Football.step(1.2,false));const p1=await page.evaluate(()=>Football.match.ctrl.pos.z);assert(p1<p0-2.5,'W moves the controlled player toward goal ('+p0.toFixed(1)+' -> '+p1.toFixed(1)+')');
await snap('match_move');
assert.equal(await page.locator('#shootBtn').getAttribute('aria-disabled'),'true','shoot unavailable far from goal');
await key('keydown','e','KeyE');await key('keyup','e','KeyE');assert(await until('Football.state==="play"&&Football.controlled!=="M"',10),'E passes and control follows the ball');
assert(await until('Football.phase==="play"&&Football.match.canPassPlay()',10),'receiver ready for another pass');
await page.locator('#passBtn').click();await key('keydown','a','KeyA');await page.evaluate(()=>Football.step(0.3,false));await key('keyup','a','KeyA');   // keys still work after a pad click
assert(await until('Football.canShoot&&Football.match.shotDistance()<20',20),'reached shooting range');await key('keyup','w','KeyW');
assert.equal(await page.locator('#shootBtn').getAttribute('aria-disabled'),'false','shoot available in range');await snap('match_range');
await key('keydown',' ','Space');await key('keyup',' ','Space');assert(await until('Football.phase==="question"',30));assert.equal(await page.evaluate(()=>Football.flight),.5);await snap('match_question');
await choose(1);assert.equal(await page.evaluate(()=>Football.outcome),'save');assert.equal(await page.evaluate(()=>Football.goals),0,'wrong answer never scores in a match');
await page.locator('#next').click();assert(await until('Football.phase==="play"',40));
await page.evaluate(()=>{const m=Football.match;m.turnover('intercept',m.defs[2]);});assert(await until('Football.phase==="play"&&Football.attempt===1&&Football.state==="play"',10),'attack rebuilt after losing the ball');assert.equal(await page.evaluate(()=>Football.round),1,'same question after a turnover');
// touch joystick moves the player too
const s0=await page.evaluate(()=>Football.match.ctrl.pos.toArray());const sb=await page.locator('#stick').boundingBox();await page.mouse.move(sb.x+sb.width/2,sb.y+sb.height/2);await page.mouse.down();await page.mouse.move(sb.x+sb.width/2,sb.y+sb.height/2-45,{steps:3});await page.evaluate(()=>Football.step(1,false));await page.mouse.up();
const s1=await page.evaluate(()=>Football.match.ctrl.pos.toArray());assert(Math.hypot(s1[0]-s0[0],s1[2]-s0[2])>2,'joystick drag moves the controlled player');
console.log('PASS interactive match: keyboard + joystick movement, pass, contextual shoot, freeze, wrong answer saved, turnover rebuilds the attack without a question');

/* ---------- 4. sound: visible, persistent mute; playable in silence ---------- */
await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');await load();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false','mute persists');
await page.locator('#modePenalties').click();await page.locator('#skip').click();await penaltyToQuestion();await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'goal','playable while muted');
await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');console.log('PASS sound toggle persists; game plays muted');

/* ---------- 5. settings are separate from the mode; difficulty never changes correctness ---------- */
await load();await page.locator('#settingsBtn').click();assert.equal(await page.locator('#settings [data-game-mode]').count(),0,'settings do not contain the game mode');await page.locator('[data-assist="simple"]').click();await page.locator('[data-diff="2"]').click();await page.locator('#settingsClose').click();
await page.locator('#modePenalties').click();await page.locator('#skip').click();assert(await until('Football.phase==="ready"',40));assert(await page.locator('#powerBox').isHidden(),'simple aiming hides power');await page.locator('#shoot').click();assert(await until('Football.phase==="question"',30));await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'goal','hard difficulty: correct answer still scores');
await page.evaluate(()=>localStorage.clear());console.log('PASS settings (aiming help, difficulty) separate from the mode; correct answer still scores on hard');

/* ---------- 6. viewports: desktop, phone portrait/landscape, tablet, classroom touchscreen ---------- */
for(const [w,h,touch,mode] of [[1366,768,false,'penalties'],[390,844,true,'penalties'],[844,390,true,'match'],[768,1024,true,'match'],[1920,1080,true,'match'],[1920,1080,false,'penalties']]){
 await newPage({viewport:{width:w,height:h},hasTouch:touch,isMobile:touch&&w<1000});await load();
 await page.locator(mode==='match'?'#modeMatch':'#modePenalties').click();await page.locator('#skip').click();assert(await until(mode==='match'?'Football.phase==="play"':'Football.phase==="ready"',40));await page.evaluate(()=>Football.step(.3));
 const r=await page.evaluate(()=>{const bad=[];for(const b of document.querySelectorAll('button,input[type=range],select')){const c=b.getBoundingClientRect();if(!c.width||!c.height||b.closest('[hidden]')||getComputedStyle(b).visibility==='hidden'||b.classList.contains('pass-marker'))continue;if(Math.min(c.width,c.height)<43.5)bad.push((b.id||b.textContent.trim()).slice(0,20)+' '+Math.round(c.width)+'x'+Math.round(c.height));
   if(c.right>innerWidth+1||c.bottom>innerHeight+1||c.left<-1||c.top<-1)bad.push('outside: '+(b.id||b.textContent.trim()).slice(0,20));}
  return{bad,sx:document.documentElement.scrollWidth,sy:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight};});
 assert(r.sx<=r.iw&&r.sy<=r.ih,w+'x'+h+' no page scroll '+JSON.stringify(r));assert.deepEqual(r.bad,[],w+'x'+h+' '+mode+': targets >= 44 px and inside the viewport');await snap(`vp_${w}x${h}_${mode}`);}
console.log('PASS viewports 1366x768, 390x844, 844x390, 768x1024, 1920x1080 (touch + mouse): no scroll, controls inside the screen, >= 44 px');

/* ---------- 7. resilience ---------- */
await newPage();await load();
await page.evaluate(()=>{const c=document.getElementById('pitch'),g=c.getContext('webgl2')||c.getContext('webgl');window.__lc=g.getExtension('WEBGL_lose_context');window.__lc.loseContext();});
await page.locator('#loadingError').waitFor({state:'visible',timeout:20000});await page.evaluate(()=>window.__lc.restoreContext());await page.locator('#loadingError').waitFor({state:'hidden',timeout:60000});console.log('PASS WebGL context loss message and recovery');
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));Football.step(.5,false);Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
await newPage({reducedMotion:'reduce'});await load();await page.locator('#settingsBtn').click();assert(await page.locator('#optReduced').isChecked(),'reduced-motion preference is on by default');console.log('PASS reduced-motion preference honoured');
await newPage();await page.route('**/characters/*.bin',r=>r.fulfill({status:404,body:''}));await page.goto(base+'?manual=1',{waitUntil:'domcontentloaded',timeout:180000});await page.locator('#loadingError').waitFor({state:'visible',timeout:120000});
assert((await page.locator('#loadingError').innerText()).includes('تعذر'),'Arabic error message');assert(await page.locator('#errLite').isVisible(),'simplified mode offered');errors.length=0;
await page.locator('#errLite').click();assert(await page.locator('#modeMatch').isDisabled(),'interactive match needs 3D: disabled with an explanation in the simplified mode');assert((await page.locator('#loadStatus').innerText()).includes('WebGL'));await page.locator('#modePenalties').click();await page.evaluate(()=>Football.step(.5,false));await page.locator('#shoot').click();assert(await until('Football.phase==="question"',30));await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'goal');
console.log('PASS asset-loading failure: Arabic message, simplified mode completes a round');
assert.deepEqual(errors.filter(e=>!/\.bin/.test(e)),[]);await browser.close();server.close();console.log('PASS football standalone browser suite (V22)');})().catch(e=>{console.error(e);server.close();process.exit(1)});
