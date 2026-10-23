/* Football V22: licensed skeletal footballers; no assessment logic.
 * Assets: GameplayFootball / Google Research Football, Unlicense;
 * adapted glTF from soccerviewer (MIT). Bundled locally at build time.
 * The original procedural athletes remain inert as a fallback only on error.
 */
(()=>{
'use strict';
if(!window.PremierFootball || !window.THREE) return;
const T=THREE;
const oldAttach=window.PremierFootball.attach;
const audit=window.RealFootballRig={status:'initializing',count:0,source:'soccerviewer/GameplayFootball',error:null};
const SRC_MOTION='assets/real-football-motion.glb';
const SRC_SCULPT='assets/real-football-sculpt.glb';
const clipNames={
 idle:'movement/idle/000_idlelevel1',
 run:'movement/sprint/000_idlelevel1',
 jog:'ballcontrol/walk/000',
 kick:'shot/idle/020',
 block:'pass/idle/special/000_throw',
 celebrate:'pass/idle/nonbase/000_header_jump_forwards'
};
function load(url){
 return new Promise((resolve,reject)=>{
   new T.GLTFLoader().load(url,resolve,undefined,reject);
 });
}
function tuneClothing(actor,type){
 const color=type==='home'?0x891638:type==='away'?0xefede8:0x146b59;
 actor.traverse(o=>{
   if(!o.isMesh) return;
   o.castShadow=true;o.receiveShadow=true;
   if(!o.material)return;
   const mats=Array.isArray(o.material)?o.material:[o.material];
   const replace=m=>{
     const nm=String(m.name||'').toLowerCase();
     if(nm==='kit'||nm==='shirt'||nm==='pants'){
       const clone=m.clone();clone.color.setHex(color);
       if(clone.map && nm==='kit')clone.map=null;
       clone.roughness=.78;clone.metalness=.02;
       clone.needsUpdate=true;
       return clone;
     }
     return m;
   };
   o.material=Array.isArray(o.material)?mats.map(replace):replace(o.material);
 });
}
function sculptInto(clips,sculpt){
 // Both public-domain models share a named 13-bone skeleton. Remap sculpt
 // vertices and skin indices into the motion model's bind pose.
 const bodies={};
 clips.scene.updateMatrixWorld(true);
 sculpt.scene.updateMatrixWorld(true);
 clips.scene.traverse(o=>{if(o.isSkinnedMesh&&o.material)bodies[o.material.name]=o;});
 const first=Object.values(bodies)[0];
 if(!first||!first.skeleton)return;
 const named=new Map(first.skeleton.bones.map((b,i)=>[b.name,i]));
 const v=new T.Vector3();
 sculpt.scene.traverse(o=>{
   if(!o.isSkinnedMesh||!o.material||!o.geometry||!o.skeleton)return;
   const dst=bodies[o.material.name],g=o.geometry;
   const ref=o.skeleton.bones.findIndex(b=>b.name===first.skeleton.bones[0].name);
   if(ref<0)return;
   const matrix=new T.Matrix4().copy(first.skeleton.boneInverses[0]).invert().multiply(o.skeleton.boneInverses[ref]);
   const normal=new T.Matrix3().getNormalMatrix(matrix);
   const pos=g.attributes.position,nrm=g.attributes.normal;
   for(let i=0;i<pos.count;i++){
     v.fromBufferAttribute(pos,i).applyMatrix4(matrix);pos.setXYZ(i,v.x,v.y,v.z);
     if(nrm){v.fromBufferAttribute(nrm,i).applyMatrix3(normal).normalize();nrm.setXYZ(i,v.x,v.y,v.z);}
   }
   const ids=g.attributes.skinIndex;
   if(ids)for(let i=0;i<ids.array.length;i++)ids.array[i]=named.get(o.skeleton.bones[ids.array[i]]?.name)??0;
   pos.needsUpdate=true;
   if(nrm)nrm.needsUpdate=true;
   if(ids)ids.needsUpdate=true;
   g.computeBoundingSphere();
   if(dst)dst.geometry=g;
 });
}
window.PremierFootball.attach=function(args){
 const prior=oldAttach.call(this,args);
 const {scene,player,keeper,teammates,defenders}=args;
 const entries=[
   {actor:player,role:'home',kind:'striker',phase:0},
   ...teammates.map((e,i)=>({actor:e.m,role:'home',kind:'team',phase:i*.7})),
   ...defenders.map((e,i)=>({actor:e.m,role:'away',kind:'defender',phase:i*.95})),
   {actor:keeper,role:'keeper',kind:'keeper',phase:1.5}
 ].filter(e=>e.actor);
 let real=[],elapsed=0,lastPhase='',wasDisabled=false;
 audit.status='loading';
 // Keep the game active while the two local assets are being downloaded.
 Promise.all([load(SRC_MOTION),load(SRC_SCULPT)]).then(([motion,sculpt])=>{
   if(wasDisabled)return;
   try{sculptInto(motion,sculpt);}catch(error){console.warn('Sculpt upgrade skipped:',error);}
   const body=motion.scene;
   const bounds=new T.Box3().setFromObject(body);
   const height=bounds.max.y-bounds.min.y;
   if(!Number.isFinite(height)||height<.1)throw Error('Invalid 3D athlete geometry');
   const scale=1.78/height;
   const clips={};
   for(const [alias,fullName] of Object.entries(clipNames)){
     clips[alias]=motion.animations.find(x=>x.name===fullName)||null;
   }
   if(!clips.idle)throw Error('Missing humanoid skeletal animation: idle');
   const skeletonCloner=T.SkeletonUtils;
   if(!skeletonCloner?.clone)throw Error('SkeletonUtils is unavailable');
   real=entries.map(item=>{
     const node=skeletonCloner.clone(body);
     tuneClothing(node,item.role);
     const holder=new T.Group();
     holder.name='PhotorealFootballer-'+item.kind;
     const fitted=new T.Group();
     fitted.position.y=-bounds.min.y*scale;
     fitted.scale.setScalar(scale);
     fitted.add(node);
     holder.add(fitted);
     scene.add(holder);
     // Animation mixer targets only this player's independent clone.
     const mixer=new T.AnimationMixer(node),actions={};
     for(const [key,clip]of Object.entries(clips))if(clip)actions[key]=mixer.clipAction(clip);
     const current=actions.idle;current.play();
     return {...item,holder,mixer,actions,current,key:'idle'};
   });
   // Do not change the original athlete scene graph or the classroom physics.
   // Hide only old triangle-based visual primitives once all GLB players exist.
   for(const item of entries)item.actor.traverse(o=>{if(o.isMesh)o.visible=false;});
   audit.count=real.length;audit.status='ready';
   document.getElementById('realModelNote')?.remove();
   document.body.dataset.realPlayers='ready';
 }catch(error){
   audit.status='error';audit.error=String(error);
   console.error('Real football players could not be initialized:',error);
   showFailure();
 }
 }).catch(error=>{audit.status='error';audit.error=String(error);showFailure();});
 function showFailure(){
   document.body.dataset.realPlayers='error';
   if(document.getElementById('realModelNote'))return;
   const label=document.createElement('aside');label.id='realModelNote';
   label.setAttribute('role','alert');
   label.textContent='تعذّر تحميل نماذج اللاعبين الواقعية؛ يعرض المتصفح النسخة الأساسية. تحقّق من ملفات اللعبة.';
   Object.assign(label.style,{position:'absolute',top:'22%',left:'3%',right:'3%',zIndex:'25',padding:'12px',textAlign:'center',background:'#721b39',color:'white',borderRadius:'12px',fontSize:'13px'});
   document.getElementById('stadium')?.append(label);
 }
 function action(item,name){
   const target=item.actions[name]||item.actions.idle;
   if(target===item.current)return;
   item.current?.fadeOut(.13);
   target.reset().fadeIn(.13).play();
   if(['kick','block','celebrate'].includes(name)){target.setLoop(T.LoopOnce,1);target.clampWhenFinished=true;}
   else {target.setLoop(T.LoopRepeat,Infinity);target.clampWhenFinished=false;}
   item.current=target;item.key=name;
 }
 function frame(S,dt){
   prior.frame(S,dt);
   if(audit.status!=='ready')return;
   elapsed+=dt;
   for(const item of real){
     item.holder.position.copy(item.actor.position);
     item.holder.rotation.y=item.actor.rotation.y;
     let want='idle';
     if(item.kind==='striker'){
       if(S.phase==='runup')want=S.elapsed>.58?'kick':'run';
       if(S.phase==='outcome'&&S.correct)want='celebrate';
     }else if(item.kind==='keeper'){
       if(S.phase==='resolve'&&!S.pending)want='block';
       else if(S.phase==='outcome'&&!S.pending)want='block';
     }else if(item.kind==='team'){
       if(S.phase==='runup')want='jog';
       else if(S.phase==='outcome'&&S.correct)want='celebrate';
     }else if(item.kind==='defender'){
       if(S.phase==='runup')want='jog';
       else if(S.phase==='resolve')want='run';
     }
     // Preserve single-shot action progress; don't restart each frame.
     action(item,want);
     item.mixer.update(Math.max(0,Math.min(.05,dt)));
   }
 }
 return {
   ...prior,
   frame,
   dispose(){
     wasDisabled=true;
     real.forEach(item=>{item.mixer.stopAllAction();scene.remove(item.holder);});
     if(typeof prior.dispose==='function')prior.dispose();
   },
   stats:{...prior.stats,realRig:true,assetSource:'GameplayFootball (Unlicense)'}
 };
};
})();