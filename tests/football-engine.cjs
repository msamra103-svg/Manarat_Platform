/* Football engine unit tests (Node, no browser/WebGL): ball physics, rig + locomotion + kick contact, and the match director's
 * outcome guarantees. The director only *receives* an outcome (goal/save/wide/pending) from the host; grading stays server-side. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),eng=f=>path.join(root,'games/football/engine',f+'.js');
const THREE=require(path.join(root,'games/vendor/three.min.js'));global.THREE=THREE;global.window=undefined;
for(const f of ['fb-core','fb-kit','fb-char','fb-rig','fb-anim','fb-keeper','fb-ball','fb-match','fb-match-flow'])(0,eval)(fs.readFileSync(eng(f),'utf8').replace(/\}\)\(typeof window.*$/s,'})(globalThis);'));
const V=THREE.Vector3,P=FB.PITCH,mans={};
for(const b of ['athlete','runner','keeper'])mans[b]=JSON.parse(fs.readFileSync(path.join(root,'games/football/assets/characters/'+b+'.json'),'utf8'));
const makeActor=spec=>{const man=mans[spec.build],sk=FB.Char.buildSkeleton(man),g=new THREE.Group();g.add(sk.hips);return{root:g,bones:sk.byName,boneList:sk.bones,man,parts:{}};};

/* ---- ball physics ---- */
{let goals=0,n=0;for(const [tx,ty,sp] of [[0,1.2,22],[2.8,0.4,24],[-3,2,26],[3.4,2.2,30],[-2.5,.3,18],[0,2.3,28]]){
  const start=new V(0,.11,-2),sol=FB.solveShot(start,new V(tx,ty,P.goalZ),sp,null),b=new FB.Ball();b.p.copy(start);b.v.copy(sol.v);
  for(let t=0;t<4;t+=1/120){b.advance(1/120);if(b.inGoal&&b.v.length()<.5)break;}n++;if(b.inGoal)goals++;}
  assert.equal(goals,n,'every solved on-target shot ends in the net');
  const c=new FB.Ball();c.p.set(P.goalHalf+P.postR,1,-8);c.v.set(0,0,-35);for(let t=0;t<.5;t+=1/120)c.advance(1/120);
  assert(c.p.z>P.goalZ,'35 m/s shot does not tunnel through the post');
  const d=new FB.Ball();d.p.set(0,.11,-2);d.v.set(0,0,-22);let seenNet=false;for(let t=0;t<3;t+=1/120){d.advance(1/120);if(d.events.some(e=>e.type==='net'))seenNet=true;}
  assert(seenNet&&d.inGoal,'ball reports net contact and stays in the goal');console.log('PASS ball: solver, goal-line, post collision, no tunnelling, net events');}

/* ---- rig / locomotion / kick contact ---- */
{const mk=()=>{const sk=FB.Char.buildSkeleton(mans.athlete),g=new THREE.Group();g.add(sk.hips);return new FB.Player({root:g,bones:sk.byName,boneList:sk.bones,man:mans.athlete,parts:{}});};
 for(const [speed,label,turn] of [[0,'idle'],[1.2,'walk'],[3,'jog'],[5,'run'],[6.2,'sprint'],[4,'curve',.9]]){
  const p=mk();p.teleport(0,0,0);const dt=1/60;let slide=0,over=0,prev=[null,null];
  for(let i=0;i<360;i++){const t=i*dt;let vx=0,vz=speed;if(turn){vx=Math.sin(t*turn)*speed;vz=Math.cos(t*turn)*speed;}p.setIntent(vx,vz);p.update(dt);
   for(let j=0;j<2;j++){const f=p.feet[j],fj=p.rig.joint('foot'+f.S,new V());if(i>60&&fj.distanceTo(new V(f.p.x,f.y,f.p.z))>.025)over++;
    if(!f.swing&&prev[j]&&i>60)slide=Math.max(slide,Math.hypot(f.p.x-prev[j].x,f.p.z-prev[j].z));prev[j]=f.swing?null:f.p.clone();}}
  assert(slide<1e-4,label+': planted feet do not slide ('+slide+')');assert(over===0,label+': foot IK stays within 2.5 cm ('+over+' frames over)');
  if(speed>0)assert(Math.abs(p.speed-speed)<.5,label+': reaches commanded speed');}
 const p=mk(),ball=new V(0,.11,1.2);p.teleport(0,-.6,0);let ev=null;p.setIntent(0,0);
 p.startKick({foot:'R',ball,dir:new V(0,0,1),power:.9,loft:.1,onContact:i=>{ev=i;}});let cT=-1,foot=null,t=0;
 for(let i=0;i<200&&cT<0;i++){p.update(1/120);t+=1/120;if(ev){cT=t;foot=p.rig.joint('footR',new V());}}
 assert(ev&&cT>.25&&cT<.6,'kick makes contact in a believable window ('+cT+')');assert(ev.footSpeed>8&&ev.footSpeed<22,'foot speed at contact '+ev.footSpeed);
 assert(foot.distanceTo(ball)<.2,'ankle is at the ball at contact ('+foot.distanceTo(ball).toFixed(3)+' m)');console.log('PASS rig: stepping IK, planted feet, kick contact timing/position');}

/* ---- match director ---- */
function run(outcome,aim,mode,round,difficulty=1){
  const m=new FB.Match({makeActor,seed:5,mode,difficulty});m.begin(round,mode,difficulty);const dt=1/60,to=(c,mx)=>{for(let s=0;!c()&&s<mx/dt;s++)m.update(dt);};
  to(()=>m.passReady,12);if(!m.passReady)return{err:'no passReady'};if(mode!=='light')m.pass(['S','W1','W2'][round%3]);
  to(()=>(m.state==='build'&&m.passN>=1&&mode==='pro')||m.state==='aim',20);if(mode==='pro'&&m.state==='build'){m.pass('S');to(()=>m.state==='aim',20);}
  if(m.state!=='aim')return{err:'no aim '+m.state};m.shoot(aim);to(()=>m.state==='frozen',8);if(m.state!=='frozen')return{err:'no freeze '+m.state};
  const prog=m.progress();m.resolve({outcome});to(()=>m.state==='outcome',10);return{state:m.state,inGoal:m.ball.inGoal,variant:m.plan&&m.plan.variant,prog};}
{const rnd=FB.math.rng(42);let bad=[],n=0;const N=+process.env.FOOTBALL_SWEEP||90;
 for(let i=0;i<N;i++){const oc=['goal','goal','save','wide','pending'][i%5],mode=['standard','light','pro'][i%3],aim={x:rnd()*2-1,y:rnd(),power:.2+rnd()*.8},r=run(oc,aim,mode,i,i%3);n++;
  const ok=!r.err&&r.state==='outcome'&&((oc==='goal')===!!r.inGoal)&&Math.abs(r.prog-.52)<.08;if(!ok)bad.push([oc,mode,aim,r]);}
 assert.equal(bad.length,0,'match sweep failures: '+JSON.stringify(bad.slice(0,3)));console.log('PASS match director: '+n+' randomized shots freeze at ~52% and resolve exactly as instructed (goal only for goal)');}
/* difficulty and mode never change whether a correct answer scores */
{for(const diff of [0,1,2])for(const mode of ['light','standard','pro']){const r=run('goal',{x:.6,y:.4,power:.7},mode,2,diff);assert(!r.err&&r.inGoal,'correct answer scores at difficulty '+diff+' in '+mode);}
 for(const diff of [0,1,2]){const r=run('save',{x:0,y:.5,power:.9},'standard',3,diff);assert(!r.err&&!r.inGoal,'save never becomes a goal at difficulty '+diff);}
 console.log('PASS difficulty/mode parity: a correct answer always scores; a wrong one never does');}
