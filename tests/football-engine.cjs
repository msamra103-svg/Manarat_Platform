/* Football engine unit tests (Node, no browser/WebGL): ball physics, rig + locomotion + kick contact, and the match director's
 * outcome guarantees. The director only *receives* an outcome (goal/save/wide/pending) from the host; grading stays server-side. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),eng=f=>path.join(root,'games/football/engine',f+'.js');
const THREE=require(path.join(root,'games/vendor/three.min.js'));global.THREE=THREE;global.window=undefined;
for(const f of ['fb-core','fb-kit','fb-char','fb-rig','fb-anim','fb-keeper','fb-ball','fb-match','fb-match-flow','fb-modes'])(0,eval)(fs.readFileSync(eng(f),'utf8').replace(/\}\)\(typeof window.*$/s,'})(globalThis);'));
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

/* ---- rig / locomotion / kick contact (regression tests for the owner's reported defects) ---- */
{const mk=(build='athlete')=>{const sk=FB.Char.buildSkeleton(mans[build]),g=new THREE.Group();g.add(sk.hips);return new FB.Player({root:g,bones:sk.byName,boneList:sk.bones,man:mans[build],parts:{}});};
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)), fwdOf=p=>new V(Math.sin(p.yaw),0,Math.cos(p.yaw));
 const knee=(p,S)=>{const r=p.rig,h=r.joint('thigh'+S,new V()),k=r.joint('shin'+S,new V()),a=r.joint('foot'+S,new V()),ax=a.clone().sub(h),t=k.clone().sub(h).dot(ax)/ax.lengthSq(),b=k.clone().sub(h.clone().addScaledVector(ax,t));return b.length()<0.004?1:b.normalize().dot(fwdOf(p));};
 const toes=(p,S)=>{const d=p.rig.joint('toes'+S,new V()).sub(p.rig.joint('foot'+S,new V()));return Math.abs(wrap(Math.atan2(d.x,d.z)-p.yaw));};
 // 1) knees bend forward and boots point forward wherever the player stands and whichever way he faces (V21: pole = hips world position; boots in world space)
 for(const [x,z,yaw] of [[0,0,0],[0,-15,0],[0,-15,Math.PI],[12,30,Math.PI/2],[-8,-12,-Math.PI/2]]){const p=mk();p.teleport(x,z,yaw);for(let i=0;i<60;i++){p.setIntent(0,0,yaw);p.update(1/60);}
  for(const S of ['L','R']){assert(knee(p,S)>0.3,`knee ${S} bends forward at (${x},${z}) facing ${yaw.toFixed(2)}`);assert(toes(p,S)<0.25,`boot ${S} points forward at (${x},${z}) facing ${yaw.toFixed(2)}`);}}
 // 2) gaits: planted feet fixed, stance IK exact, knees forward, believable cadence, landing ahead / push-off behind
 const gait=(label,fn,T=5,yaw0=Math.PI,check={})=>{const p=mk();p.teleport(2,5,yaw0);let slide=0,ik=0,kb=0,nan=0,back=0,mov=0,land=[],prev=[null,null],was=[false,false];
  for(let i=0;i<T*60;i++){const t=i/60,it=fn(t);p.setIntent(it[0],it[1],it[2]);p.update(1/60);if(!isFinite(p.pos.x)||!isFinite(p.hipY))nan++;
   for(let j=0;j<2;j++){const f=p.feet[j];if(t>1&&!f.swing&&f.ik)ik=Math.max(ik,p.rig.joint('foot'+f.S,new V()).distanceTo(f.ik));if(!f.swing&&prev[j]&&t>1)slide=Math.max(slide,Math.hypot(f.p.x-prev[j].x,f.p.z-prev[j].z));
    if(!f.swing&&was[j]&&t>1)land.push(p._local(new V(f.p.x,0,f.p.z),new V()).z);prev[j]=f.swing?null:f.p.clone();was[j]=f.swing;if(t>1&&knee(p,f.S)<-0.2)kb++;}
   if(p.speed>1.2){mov++;if(Math.abs(wrap(p.yaw-Math.atan2(p.vel.x,p.vel.z)))>2.1)back++;}}
  const steps=p.stepCount/T,avg=land.length?land.reduce((a,b)=>a+b,0)/land.length:0;
  assert.equal(nan,0,label+': no NaN');assert(slide<1e-4,label+': planted feet do not slide ('+slide+')');assert(ik<0.025,label+': planted-leg IK within 2.5 cm ('+ik.toFixed(3)+')');assert.equal(kb,0,label+': knees never bend backward');
  if(check.cad)assert(steps>check.cad[0]&&steps<check.cad[1],label+': cadence '+steps.toFixed(2)+' steps/s');if(check.ahead)assert(avg>check.ahead[0]&&avg<check.ahead[1],label+': feet land ahead of the pelvis ('+avg.toFixed(2)+' m)');
  if(check.back!==undefined)assert(mov===0||back/mov<=check.back,label+': moving backwards '+(mov?(100*back/mov).toFixed(0):0)+'%');return p;};
 gait('walk 1.4 m/s',()=>[0,-1.4],5,Math.PI,{cad:[1.6,2.1],ahead:[0.2,0.45],back:0});
 gait('jog 3 m/s',()=>[0,-3],5,Math.PI,{cad:[2.2,2.9],ahead:[0.2,0.45],back:0});
 gait('run 5 m/s',()=>[0,-5],5,Math.PI,{cad:[2.4,3.2],ahead:[0.2,0.45],back:0});
 gait('sprint',()=>[0,-7],5,Math.PI,{back:0});
 gait('90° turn at speed',t=>t<2?[0,-5]:[-5,0],5,Math.PI,{back:0});
 gait('curved run',t=>{const a=t*0.8+Math.PI;return [Math.sin(a)*4,Math.cos(a)*4];},5,Math.PI,{back:0});
 gait('lateral shuffle (facing kept)',t=>[Math.floor(t/1.5)%2?2:-2,0,Math.PI]);
 gait('intended backpedal',()=>[0,2.4,Math.PI]);
 gait('start → run → stop',t=>[0,t>0.5&&t<3?-5:0]);
 const p5=gait('backward request at 5 m/s',()=>[0,5,Math.PI],5,Math.PI,{back:0.02});      // too fast to backpedal: the player turns and runs forward
 assert(Math.abs(wrap(p5.yaw-0))<0.3,'fast backward request ends facing the travel direction');
 // 3) kick: approach, plant, back-swing, contact at the ball, follow-through
 const p=mk(),ball=new V(0,0.11,0);p.teleport(-0.35,-3.2,0.12);let ev=null,cT=-1,foot=null,t=0,maxH=0,started=false;
 for(let i=0;i<400&&cT<0;i++){t+=1/120;if(!started){if(p.pos.z<-1.6)p.setIntent(0,3);else{started=t;p.startKick({foot:'R',ball:ball.clone(),dir:new V(0,0,1),power:.85,loft:.08,type:'shot',onContact:i=>{ev=i;}});}}
  p.update(1/120);if(started)maxH=Math.max(maxH,p.rig.joint('footR',new V()).y);if(ev&&cT<0){cT=t-started;foot=p.rig.joint('footR',new V());}}
 assert(ev&&cT>.25&&cT<.6,'kick makes contact in a believable window ('+cT+')');assert(ev.footSpeed>8&&ev.footSpeed<22,'foot speed at contact '+ev.footSpeed);
 assert(foot.distanceTo(ball)<.2,'ankle is at the ball at contact ('+foot.distanceTo(ball).toFixed(3)+' m)');assert(maxH>0.35,'visible back-swing: kicking ankle rises to '+maxH.toFixed(2)+' m');
 // 4) keeper dive: pushes off from planted feet, then flies; the body tilts toward a wide ball instead of gliding upright
 {const sk=FB.Char.buildSkeleton(mans.keeper),g=new THREE.Group();g.add(sk.hips);const k=new FB.Keeper({root:g,bones:sk.byName,boneList:sk.bones,man:mans.keeper,parts:{}});k.teleport(0,0,0);for(let i=0;i<30;i++){k.setIntent(0,0,0);k.update(1/60);}
  const tgt=new V(2.3,0.9,0.15);k.startDive({target:tgt,tReach:0.55});let maxTh=0,upTravel=0;for(let i=0;i<66;i++){k.update(1/120);const d=k.dv;if(!d)break;maxTh=Math.max(maxTh,d.curTheta||0);if((d.curTheta||0)<0.3)upTravel=Math.max(upTravel,Math.abs((d.curX||0)));}
  assert(maxTh>1.0,'wide mid-height save is a real dive (tilt '+maxTh.toFixed(2)+' rad)');assert(upTravel<0.6,'keeper does not glide sideways upright ('+upTravel.toFixed(2)+' m before tilting)');}

 // 5) frame-rate independence, U-turn, no teleport: same scripted run at 20/30/60/120 fps
 for(const fps of [20,30,60,120]){const p=mk();p.teleport(0,-6,Math.PI);let jump=0,kb=0,nan=0,prev=p.pos.clone(),steps0=0;const dt=1/fps;
  for(let i=0;i<Math.round(6*fps);i++){const t=i*dt;const v=t<2.2?[0,-5]:t<4.5?[0,4.5]:[0,0];p.setIntent(v[0],v[1]);p.update(dt);
   if(!isFinite(p.pos.x)||!isFinite(p.yaw))nan++;jump=Math.max(jump,p.pos.distanceTo(prev)/dt);prev.copy(p.pos);for(const S of ['L','R'])if(knee(p,S)<-0.2)kb++;}
  assert.equal(nan,0,fps+' fps: no NaN');assert.equal(kb,0,fps+' fps: knees never bend backward through a U-turn');assert(jump<7.6,fps+' fps: no teleport (max root speed '+jump.toFixed(2)+' m/s)');}
 // 6) kick contact is geometric: the boot never overlaps the ball before contact, the ball leaves at the touch, boot tip stays above the grass,
 //    support foot is planted beside the ball (V21 fired on a timer with the boot ~14 cm inside the ball)
 for(const [pw,loft,type] of [[0.85,0.08,'shot'],[0.4,0,'shot'],[1,0.4,'shot'],[0.4,0,'pass']]){const yaw=Math.PI,dir=new V(0,0,-1),bl=new V(5,0.11,-8),p=mk();p.teleport(5.35,-4.8,yaw);
  let started=false,ev=null,minGap=9,tip=9,sup=null;for(let i=0;i<500&&!ev;i++){const lz=(p.pos.z-bl.z)*dir.z;if(!started){if(lz<-1.6)p.setIntent(0,-3);else{started=true;p.startKick({foot:'R',ball:bl.clone(),dir,power:pw,loft,type,onContact:x=>{ev=x;}});}}
   p.update(1/120);if(started&&!ev){minGap=Math.min(minGap,p.bootGap('R',bl));const a=p.rig.joint('footR',new V()),t2=p.rig.joint('toesR',new V());tip=Math.min(tip,t2.clone().add(t2.clone().sub(a).normalize().multiplyScalar(0.06)).y);}
   if(ev)sup=p.rig.joint('footL',new V());}
  assert(ev&&ev.gap!==null&&ev.gap<=0.008,type+' pw '+pw+': contact fired by the boot touching the ball');assert(minGap>0,type+' pw '+pw+': no boot/ball overlap before contact ('+minGap.toFixed(3)+')');
  assert(tip>-0.005,type+' pw '+pw+': boot tip above the grass ('+tip.toFixed(3)+')');const lat=Math.abs(sup.x-bl.x),along=(sup.z-bl.z)*dir.z;assert(lat>0.15&&lat<0.32&&Math.abs(along)<0.12,'support foot beside the ball ('+lat.toFixed(2)+','+along.toFixed(2)+')');}
 // 8) arm swing (owner report: hands looked like they held the shorts / only the hands moved): the hands swing past the hips in both
 //    directions, stay clear of the body's midline in front, walk at thigh height and run at waist-to-chest height
 for(const [sp,lo,hi,hMax] of [[1.4,[-0.2,-0.06],[0.12,0.34],1.0],[5,[-0.15,0.02],[0.25,0.45],1.3]]){const p=mk();p.teleport(0,-12,Math.PI);let fmin=9,fmax=-9,hmax=0,latF=9;
  for(let i=0;i<300;i++){p.setIntent(0,-sp);p.update(1/60);if(i<120)continue;const hj=p._local(p.rig.joint('thighL',new V()).add(p.rig.joint('thighR',new V())).multiplyScalar(0.5),new V());
   for(const S of ['L','R']){const pw=p.rig.palm(S,new V()),h=p._local(pw,new V()),f=h.z-hj.z,lat=(S==='L'?1:-1)*(h.x-hj.x);fmin=Math.min(fmin,f);fmax=Math.max(fmax,f);hmax=Math.max(hmax,pw.y);if(f>0.1)latF=Math.min(latF,lat);}}
  assert(fmin>lo[0]&&fmin<lo[1],sp+' m/s: hand swings back past the hip ('+fmin.toFixed(2)+')');assert(fmax>hi[0]&&fmax<hi[1],sp+' m/s: hand swings forward ('+fmax.toFixed(2)+')');
  assert(hmax<hMax,sp+' m/s: hand height '+hmax.toFixed(2));assert(latF>0.18,sp+' m/s: hand stays clear of the shorts/belly in front ('+latF.toFixed(2)+' m from the midline)');}
 // 7) keeper: ready stance knees forward wherever he stands; after a dive he lands, gets up and is standing again
 {const sk=FB.Char.buildSkeleton(mans.keeper),g=new THREE.Group();g.add(sk.hips);const k=new FB.Keeper({root:g,bones:sk.byName,boneList:sk.bones,man:mans.keeper,parts:{}});k.teleport(0.4,P.goalZ+0.6,0);
  for(let i=0;i<90;i++){k.setIntent(Math.sin(i/20)*1.2,0,0);k.update(1/60);for(const S of ['L','R'])assert(knee(k,S)>0.3,'keeper ready knees bend forward');}
  k.startDive({target:new V(2.6,0.6,P.goalZ+0.75),tReach:0.5});let t=0;for(;t<5&&k.mode==='dive';t+=1/60)k.update(1/60);
  for(let i=0;i<60;i++){k.setIntent(0,0,0);k.update(1/60);}const hy=k.rig.joint('hips',new V()).y;
  assert(k.mode==='loco'&&t<4.5,'keeper recovers from the dive ('+t.toFixed(2)+' s)');assert(hy>0.75,'keeper is standing again (hips '+hy.toFixed(2)+' m)');for(const S of ['L','R'])assert(knee(k,S)>0.3,'keeper knees forward after recovery');}
 console.log('PASS animation: knees/boots oriented from any position, 9 gaits (no slide, exact stance IK, cadence, no fast backward running), kick phases, keeper dive; 20-120 fps U-turn without NaN/teleport/knee inversion; geometric boot-ball contact; keeper stance and recovery; natural arm swing (past the hips, clear of the shorts)');}

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
{const GZ=FB.PITCH.goalZ;const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function runPenalty(outcome,aim,round){const m=new FB.Match({makeActor,seed:3,difficulty:1});m.setGameMode('penalties');m.begin(round,null,1);const dt=1/60,to=(c,mx)=>{for(let s=0;!c()&&s<mx/dt;s++){m.update(dt);for(const p of m.players){if(p===m.shooter||p===m.keeper||p.id==='R')continue;const inBox=p.pos.z<GZ+16.5&&Math.abs(p.pos.x)<20.16, inArc=Math.hypot(p.pos.x,p.pos.z-(GZ+11))<9.15;if(inBox||inArc)bad.push(p.id+'@'+p.pos.x.toFixed(1)+','+p.pos.z.toFixed(1));}}};
 const bad=[];if(m.state!=='aim')return{err:'no aim'};m.update(dt);const ok=m.shoot(aim);if(!ok)return{err:'shoot refused'};to(()=>m.state==='frozen',10);if(m.state!=='frozen')return{err:'no freeze '+m.state};
 const prog=m.progress();m.resolve({outcome});to(()=>m.state==='outcome',10);return{state:m.state,inGoal:m.ball.inGoal,variant:m.plan&&m.plan.variant,prog,bad:[...new Set(bad.map(b=>b.split('@')[0]))]};}
let pk=0,pkBad=[];for(let i=0;i<20;i++){const oc=['goal','save','wide','pending'][i%4];const r=runPenalty(oc,{x:Math.sin(i*1.7)*0.9,y:0.2+0.6*((i*0.37)%1),power:0.5+0.5*((i*0.61)%1)},i);const ok=!r.err&&r.state==='outcome'&&((oc==='goal')===!!r.inGoal)&&Math.abs(r.prog-.52)<.08&&r.bad.length===0;if(ok)pk++;else pkBad.push([oc,r]);}
assert.equal(pk,20,'penalties: '+JSON.stringify(pkBad.slice(0,3)));console.log('PASS penalties: 20 kicks (no passing), others stay outside the area/arc, freeze at ~52%, goal only for a correct answer');
// interactive match with a bot: dribble toward goal, pass when pressed, shoot in range
function runMatch(outcome,round,diff){const m=new FB.Match({makeActor,seed:11+round,difficulty:diff});m.setGameMode('match');m.attempt=0;m.begin(round,null,diff);const dt=1/60;let t=0,turnovers=0,passes=0,shots=0,lastPass=-9;
 for(let s=0;s<60*60;s++){t+=dt;
  if(m.state==='play'&&m.ctrl){const c=m.ctrl;const gx=0-c.pos.x+(m.owner? Math.sin(t*0.7)*6:0),gz=(GZ+10)-c.pos.z,l=Math.hypot(gx,gz)||1;m.setInput(gx/l,gz/l,false);
   if(m.canShootPlay()&&m.shotDistance()<19){m.shootPlay({x:Math.sin(round*2.1)*0.8,y:0.35,power:0.75});shots++;}
   else if(m.canPassPlay()&&m.presser&&Math.hypot(m.presser.pos.x-m.ball.p.x,m.presser.pos.z-m.ball.p.z)<2.0&&t-lastPass>1.5){if(m.passPlay(0,-1)){passes++;lastPass=t;}}}
  m.update(dt);
  if(m.state==='turnover'&&m.stateT>1.5){turnovers++;m.attempt++;m.begin(round,null,diff);}            // restart the attack: same question index
  if(m.state==='frozen'){m.resolve({outcome});}
  if(m.state==='outcome')return{ok:true,inGoal:m.ball.inGoal,turnovers,passes,shots,t:t.toFixed(1),variant:m.plan&&m.plan.variant};}
 return{ok:false,state:m.state,turnovers,passes,shots,t:t.toFixed(1)};}
let turn=0,passes=0;for(let i=0;i<12;i++){const oc=['goal','save','wide','pending'][i%4];const r=runMatch(oc,i,i%3);assert(r.ok,'match round '+i+' reached the outcome '+JSON.stringify(r));assert.equal(!!r.inGoal,oc==='goal','match round '+i+' outcome '+oc);assert.equal(r.shots,1,'exactly one shot (one question) per round');turn+=r.turnovers;passes+=r.passes;}
assert(passes>0&&turn>0,'bot exercised passing and lost possession');console.log('PASS interactive match: 12 rounds, '+passes+' passes, '+turn+' turnovers recovered without using a question, one shot = one question, outcome as instructed');
}
