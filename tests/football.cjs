/* Football (standalone page) browser test. The sim is advanced with the deterministic Football.step() hook (?manual=1) so the result does not
 * depend on how fast the machine renders WebGL (software GL in CI is ~1 fps). Set FOOTBALL_SHOTS=<dir> to also save screenshots. */
const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),shots=process.env.FOOTBALL_SHOTS||'';
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.json':'application/json','.bin':'application/octet-stream'};
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));if(file.endsWith('/'))file+='index.html';fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/games/football/';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const snap=async n=>{if(shots)try{await page.screenshot({path:path.join(shots,n+'.png'),timeout:90000})}catch(e){console.log('screenshot skipped',n)}};
const until=async(cond,max=40)=>{for(let t=0;t<=max;t++){const ok=await page.evaluate(c=>{const f=new Function('return ('+c+')');for(let i=0;i<4&&!f();i++)Football.step(.25,false);return f()},cond);if(ok){await page.evaluate(()=>Football.render());return true;}}return false;};
const load=async(q='?manual=1')=>{await page.goto(base+q);await page.waitForFunction(()=>window.Football&&Football.phase==='welcome',null,{timeout:300000});};
const toReady=async()=>{assert(await until('Football.match.passReady||Football.phase==="ready"',30),'pass phase');if(await page.evaluate(()=>Football.phase!=='ready'))await page.locator('#passButtons button').first().click();assert(await until('Football.phase==="ready"',40),'aim phase');await page.evaluate(()=>Football.step(2.5,false));};
const toQuestion=async()=>{await page.locator('#shoot').click();assert(await until('Football.phase==="question"',30),'question phase');};
const choose=async i=>{await page.locator('#choices button').nth(i).click();assert(await until('Football.phase==="outcome"',40),'outcome phase');};

await load();await snap('welcome');await page.waitForFunction(()=>!document.getElementById('start').disabled);
await page.locator('#start').click();await page.locator('#skip').click();await toReady();await snap('ready');
/* controls: large buttons, keyboard, pointer drag on the pitch */
await page.locator('[data-aim=left]').click();assert((await page.evaluate(()=>Football.aim)).x<0);
await page.locator('[data-aim=right]').click();assert((await page.evaluate(()=>Football.aim)).x>0);
await page.keyboard.press('ArrowLeft');const kx=(await page.evaluate(()=>Football.aim)).x;assert(kx<.68&&kx>.5,'keyboard nudges the aim');
const cb=await page.locator('#pitch').boundingBox();await page.mouse.move(cb.x+cb.width*.5,cb.y+cb.height*.45);await page.mouse.down();await page.mouse.move(cb.x+cb.width*.3,cb.y+cb.height*.4,{steps:4});await page.mouse.up();
const dx=(await page.evaluate(()=>Football.aim)).x;assert(dx!==kx,'dragging on the pitch sets the aim');
await page.locator('#power').fill('85');assert.equal(Math.round((await page.evaluate(()=>Football.aim)).power*100),85);
await page.locator('[data-aim=left]').click();console.log('PASS controls: large buttons, keyboard, drag aim, power');
await toQuestion();assert.equal(await page.evaluate(()=>Football.flight),.5);await page.evaluate(()=>Football.step(.6));assert.equal(await page.evaluate(()=>Football.flight),.5);assert.equal(await page.evaluate(()=>Football.phase),'question');
await snap('question');assert(await page.locator('#choices button').first().isVisible());
await choose(0);assert.equal(await page.evaluate(()=>Football.goals),1);assert.equal(await page.evaluate(()=>Football.outcome),'goal');await snap('goal');console.log('PASS kick → freeze at half-way → correct answer → goal');
await page.locator('#next').click();await toReady();await toQuestion();await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'wide');assert.equal(await page.evaluate(()=>Football.goals),1);console.log('PASS wrong answer → wide, no goal');
await page.locator('#next').click();await toReady();await toQuestion();await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'save');await snap('save');console.log('PASS wrong answer → goalkeeper save, no goal');
await page.locator('#next').click();assert.equal(await page.evaluate(()=>Football.phase),'finished');await page.locator('#next').click();assert.equal(await page.evaluate(()=>Football.goals),0);console.log('PASS final screen and clean restart');

/* mute is visible and persistent; playable in silence */
await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');await load();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false','mute persists across reloads');
await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');console.log('PASS sound toggle persists');

/* light mode: automatic pass, one tap to shoot; difficulty does not change correctness */
await page.locator('#settingsBtn').click();await page.locator('[data-mode=light]').click();await page.locator('[data-diff="2"]').click();await page.locator('#settingsClose').click();await load();
await page.locator('#start').click();await page.locator('#skip').click();assert(await until('Football.phase==="ready"',40));await page.evaluate(()=>Football.step(2.5,false));assert(await page.locator('#passButtons').isHidden(),'no pass buttons in light mode');
await toQuestion();await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'goal');console.log('PASS light mode + hard difficulty: correct answer still scores');
await page.evaluate(()=>localStorage.clear());

/* viewports: no page scroll, touch targets >= 44 px, shoot reachable */
await load();await page.locator('#start').click();await page.locator('#skip').click();await toReady();
for(const [w,h] of [[390,844],[844,390],[768,1024],[1366,768],[1920,1080]]){await page.setViewportSize({width:w,height:h});await page.evaluate(()=>Football.step(.3));
 const r=await page.evaluate(()=>{const bad=[];for(const b of document.querySelectorAll('button,input[type=range],select')){const c=b.getBoundingClientRect();if(!c.width||!c.height||b.closest('[hidden]')||getComputedStyle(b).visibility==='hidden'||b.classList.contains('pass-marker'))continue;if(Math.min(c.width,c.height)<43.5)bad.push((b.id||b.textContent.trim()).slice(0,20)+' '+Math.round(c.width)+'x'+Math.round(c.height));}
  const s=document.getElementById('shoot').getBoundingClientRect();return{bad,sx:document.documentElement.scrollWidth,sy:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,shoot:[s.left,s.top,s.right,s.bottom]};});
 assert(r.sx<=r.iw&&r.sy<=r.ih,w+'x'+h+' no page scroll '+JSON.stringify(r));assert.deepEqual(r.bad,[],w+'x'+h+' touch targets');assert(r.shoot[0]>=0&&r.shoot[1]>=0&&r.shoot[2]<=r.iw&&r.shoot[3]<=r.ih,w+'x'+h+' shoot button inside viewport '+r.shoot);await snap('vp_'+w+'x'+h);}
console.log('PASS viewports 390x844, 844x390, 768x1024, 1366x768, 1920x1080: no scroll, >=44px targets');
await page.setViewportSize({width:1366,height:768});

/* WebGL context loss: a calm message, then recovery */
await page.evaluate(()=>{const c=document.getElementById('pitch'),g=c.getContext('webgl2')||c.getContext('webgl');window.__lc=g.getExtension('WEBGL_lose_context');window.__lc.loseContext();});
await page.locator('#loadingError').waitFor({state:'visible',timeout:20000});await page.evaluate(()=>window.__lc.restoreContext());await page.locator('#loadingError').waitFor({state:'hidden',timeout:60000});console.log('PASS WebGL context loss message and recovery');
/* hidden tab: pausing must not throw */
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));Football.step(.5,false);Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});

/* reduced motion is honoured */
const rm=await browser.newContext({viewport:{width:1000,height:700},reducedMotion:'reduce'}),p2=await rm.newPage();p2.on('pageerror',e=>errors.push(e.message));await p2.goto(base+'?manual=1');await p2.waitForFunction(()=>window.Football&&Football.phase==='welcome',null,{timeout:300000});await p2.locator('#settingsBtn').click();assert(await p2.locator('#optReduced').isChecked(),'reduced-motion preference is on by default');await rm.close();console.log('PASS reduced-motion preference honoured');

/* no-WebGL fallback (lite) still completes a round */
await load('?lite=1&manual=1');await page.locator('#start').click();await page.evaluate(()=>Football.step(.5,false));await page.locator('#shoot').click();assert(await until('Football.phase==="question"',30),'lite question');await choose(0);assert.equal(await page.evaluate(()=>Football.outcome),'goal');console.log('PASS lite (no WebGL) fallback round');
assert.deepEqual(errors,[]);await browser.close();server.close();console.log('PASS football standalone browser suite');})().catch(e=>{console.error(e);server.close();process.exit(1)});
