// Automated pose sanity check over six rounds (make/miss/pending): pelvis/head height, torso tilt, feet above the floor, for every athlete every frame.
// node tests/browser/pose-check.cjs   (static server on :8099)
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:320,height:180}});p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto((process.env.BASE||'http://localhost:8099')+'/tests/browser/scene-harness.html?tier=low');await p.waitForFunction('window.ready||window.loadError',null,{timeout:120000});
const res=await p.evaluate(()=>{const bad=[];const r=sc.renderer.render;sc.renderer.render=()=>{};let clock=0;
 const chk=(label)=>{const pc=sc.poseCheck();for(const [n,m] of Object.entries(pc)){if(m.pelvis<0.5||m.pelvis>1.35||m.head<1.0||m.tilt>55||m.foot<0.03)bad.push([+clock.toFixed(2),label,sc.state.mode,sc.state.passPhase||'',n,m]);}};
 const run=(sec,label)=>{for(let t=0;t<sec;t+=1/60){sc.update(1/60);clock+=1/60;chk(label);}};
 const until=(c,max,label)=>{let t=0;while(t<max&&!c(sc.state)){sc.update(1/60);t+=1/60;clock+=1/60;chk(label);}};
 run(3.5,'intro');
 for(const res of ['make','miss','pending','miss','make','miss']){sc.shoot();until(s=>s.mode==='frozen',6,'shot-'+res);run(0.5,'q');sc.resolve(res);until(s=>s.mode==='post'||s.pendingDone,8,'resolve-'+res);run(3,'post-'+res);sc.nextRound();until(s=>s.mode==='ready',15,'pass-'+res);run(1,'ready');}
 sc.renderer.render=r;return {bad:bad.slice(0,60),count:bad.length,clock};});
console.log(JSON.stringify(res.count),res.clock);const seen=new Set();for(const x of res.bad){const k=x[1]+x[4];if(seen.has(k))continue;seen.add(k);console.log(JSON.stringify(x));}
await b.close();})();
