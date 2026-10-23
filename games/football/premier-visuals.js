/* Abu Ubaida Premier Football V21 — offline-only procedural broadcast stadium.
 * Attached to the existing Three.js sporting scene; never grades student answers.
 * Uses only the Three.js already bundled by the school platform.
 */
(()=>{'use strict';
const MODE=['broadcast','pitchside','goalkeeper'];
const PF=window.PremierFootball={cameraMode:'broadcast',quality:'auto',
 setCamera(mode){this.cameraMode=MODE.includes(mode)?mode:'broadcast';return this.cameraMode;},
 nextCamera(){const i=MODE.indexOf(this.cameraMode);return this.setCamera(MODE[(i+1)%MODE.length]);},
 attach({THREE:T,scene,camera,renderer,player,keeper,teammates,defenders,ball,goalZ}){
   const medium=(navigator.hardwareConcurrency||4)<=4 || (window.devicePixelRatio||1)>2.3;
   const performance=medium || innerWidth<780 || /HeadlessChrome|SwiftShader/i.test(navigator.userAgent);
   const standMat=new T.MeshStandardMaterial({color:0x344451,roughness:.91,metalness:.13});
   const seatMat=new T.MeshStandardMaterial({color:0x661b39,roughness:.91});
   const edgeMat=new T.MeshStandardMaterial({color:0xd2c5a4,roughness:.45,metalness:.55});
   const nightMat=new T.MeshBasicMaterial({color:0x060c15});
   const ledMat=new T.MeshBasicMaterial({color:0xcff7f4});
   const goldMat=new T.MeshBasicMaterial({color:0xf6d698});
   const concrete=new T.MeshStandardMaterial({color:0x828b90,roughness:.98});
   const metal=new T.MeshStandardMaterial({color:0xabb8bb,metalness:.78,roughness:.32});
   const glass=new T.MeshBasicMaterial({color:0xbacbd5,transparent:true,opacity:.23,side:T.DoubleSide,depthWrite:false});
   const root=new T.Group();root.name='Abu-Ubaida-Broadcast-Stadium';scene.add(root);
   const make=(geo,mat,x,y,z,parent=root)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.receiveShadow=true;parent.add(o);return o;};
   const box=(x,y,z,sx,sy,sz,mat,parent=root)=>make(new T.BoxGeometry(sx,sy,sz),mat,x,y,z,parent);
   const line=(a,b,r,material)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const mesh=make(new T.CylinderGeometry(r,r,d.length(),8),material,...av.clone().add(bv).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return mesh;};
   const random=(seed=>()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;})(412719);
   // Stadium superstructure: covered double-tier bowl and structural beams.
   for(let level=0;level<2;level++){
      const radius=performance?25.5+level*4:26+level*4.5;
      const baseY=level?5.75:1.1;
      const bands=performance?18:36;
      for(let j=0;j<bands;j++){
        const a=j*Math.PI*2/bands,b=(j+1)*Math.PI*2/bands,m=(a+b)/2;
        const center=new T.Vector3(Math.sin(m)*radius,baseY+1.35,Math.cos(m)*radius-7);
        const panel=make(new T.BoxGeometry(2*Math.PI*radius/bands*.94,2.85,.22),level?concrete:standMat,center.x,center.y,center.z);
        panel.rotation.y=-m;
        if(j%7===0){const support=line([Math.sin(m)*radius,.5,Math.cos(m)*radius-7],[Math.sin(m)*(radius+1),baseY+4,Math.cos(m)*(radius+1)-7],.11,edgeMat);support.castShadow=false;}
      }
      const ring=make(new T.TorusGeometry(radius,.3,8,100),level?edgeMat:seatMat,0,baseY+3,-7);ring.rotation.x=Math.PI/2;
   }
   const roofOuter=make(new T.TorusGeometry(performance?33:35.5,.48,12,96),metal,0,12.5,-7);roofOuter.rotation.x=Math.PI/2;
   const roofInner=make(new T.TorusGeometry(performance?28:30.5,.24,10,96),edgeMat,0,12.2,-7);roofInner.rotation.x=Math.PI/2;
   for(let a=0;a<Math.PI*2;a+=Math.PI/(performance?7:12)){
      line([Math.sin(a)*30,12.2,Math.cos(a)*30-7],[Math.sin(a)*35,12.6,Math.cos(a)*35-7],.12,metal);
   }
   // Actual seating silhouettes, with stable instancing and maroon/ivory colors.
   const count=performance?380:1700;
   const seatGeo=new T.BoxGeometry(.30,.075,.32);
   const seatMesh=new T.InstancedMesh(seatGeo,seatMat,count);
   const personGeo=new T.SphereGeometry(.15,8,6);
   const persons=new T.InstancedMesh(personGeo,new T.MeshStandardMaterial({color:0xffffff,roughness:.9}),count);
   seatMesh.name='Stadium-Seating';persons.name='Crowd';
   const dummy=new T.Object3D(),colors=[0xffffff,0x8a1538,0xcfc3ab,0x1d4559,0xf4dbb4,0x9ca8b3];
   const crowdPositions=[];
   for(let i=0;i<count;i++){
      const ringIndex=Math.floor(i/(count/2)),row=Math.floor(random()*6);
      const radius=(ringIndex?30.5:25.1)+row*.57;
      const angle=i*2.399963229728653;
      const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius-7,y=(ringIndex?7.5:2.8)+row*.18;
      dummy.position.set(x,y,z);dummy.rotation.set(0,-angle,0);dummy.scale.setScalar(.94);dummy.updateMatrix();seatMesh.setMatrixAt(i,dummy.matrix);
      dummy.position.y+=.20+(random()-.5)*.06;dummy.scale.set(.82,.7+random()*.5,.78);dummy.updateMatrix();persons.setMatrixAt(i,dummy.matrix);
      persons.setColorAt(i,new T.Color(colors[Math.floor(random()*colors.length)]));
      crowdPositions.push([x,y,z]);
   }
   seatMesh.instanceMatrix.needsUpdate=true;persons.instanceMatrix.needsUpdate=true;
   persons.frustumCulled=false;seatMesh.frustumCulled=false;root.add(seatMesh,persons);
   // Electrified lower-tier advertising with animated textured LEDs.
   const advert=new T.Group();root.add(advert);
   const words=['ABU UBAIDA','QATAR FOOTBALL','PLAY • THINK • SCORE','LEARN TO WIN'];
   function ledTexture(text){const c=document.createElement('canvas');c.width=768;c.height=112;const g=c.getContext('2d');g.fillStyle='#431225';g.fillRect(0,0,c.width,c.height);g.fillStyle='#f0d6a1';g.textAlign='center';g.textBaseline='middle';g.font='700 54px Arial';g.fillText(text,384,59,730);const tx=new T.CanvasTexture(c);tx.encoding=T.sRGBEncoding;return tx;}
   const banners=words.map(w=>new T.MeshBasicMaterial({map:ledTexture(w),side:T.DoubleSide}));
   for(let j=0;j<28;j++){
       const a=(j+.5)*Math.PI*2/28,r=21.5;
       const w=2*Math.PI*r/28*.97;
       const o=make(new T.PlaneGeometry(w,.55),banners[j%4],Math.sin(a)*r,.56,Math.cos(a)*r-7);
       o.rotation.y=a+Math.PI;
       advert.add(o);
   }
   // Four light pylons + canopy spot banks. Glow meshes are emissive but shadow-free.
   const lampGlow=new T.MeshBasicMaterial({color:0xfff2d2});
   for(const [x,z] of [[-27,-30],[27,-30],[-27,18],[27,18]]){
       line([x,0,z],[x,15.5,z],.15,metal);
       box(x,15.55,z,2.9,.28,.7,nightMat);
       for(let a=-2;a<=2;a++)box(x+a*.5,15.6,z+.39,.36,.17,.09,lampGlow);
       if(!performance&&x<0&&z<0){const light=new T.PointLight(0xe8f4ff,.48,24,2);light.position.set(x,14,z);scene.add(light);}
   }
   // Broadcast gantry, glass press boxes and perimeter fencing.
   for(let i=0;i<20;i++){
       const a=i*Math.PI/10,x=Math.sin(a)*32,z=Math.cos(a)*32-7;
       const panel=box(x,9,z,3.2,1.2,.45,glass);panel.rotation.y=-a;
   }
   const goalRibbon=make(new T.BoxGeometry(9.1,.16,.24),goldMat,0,2.9,goalZ-1.95);
   // Ground micro-detail (small batches; keep clear of players and critical goal lines).
   const grassGeo=new T.PlaneGeometry(.045,.16),grassMat=new T.MeshStandardMaterial({color:0x729b48,roughness:1,side:T.DoubleSide});
   const ngrass=performance?120:650;
   const blades=new T.InstancedMesh(grassGeo,grassMat,ngrass);
   for(let i=0;i<ngrass;i++){
       const x=(random()-.5)*37,z=(random()-.5)*47-7;
       dummy.position.set(x,.067,z);dummy.rotation.set(-Math.PI/6,(random()-.5)*Math.PI*2,0);dummy.scale.setScalar(.65+random()*.55);dummy.updateMatrix();blades.setMatrixAt(i,dummy.matrix);
   }
   blades.frustumCulled=false;blades.instanceMatrix.needsUpdate=true;root.add(blades);
   // Player identity upgrades: boot studs, kit accents and keeper gloves; no real-player likenesses.
   const bootTrim=new T.MeshStandardMaterial({color:0xf7d48f,roughness:.38,metalness:.12});
   const maroon=new T.MeshStandardMaterial({color:0x8a1538,roughness:.87});
   function kit(actor,isKeeper=false){
     if(!actor||!actor.userData?.joints)return;
     const j=actor.userData.joints;
     for(const s of ['L','R']){
        const ankle=j['ankle'+s];if(!ankle)continue;
        const sole=make(new T.BoxGeometry(.108,.022,.18),bootTrim,0,-.063,.067,ankle);
        sole.rotation.y=0;
        for(let k=0;k<3;k++)make(new T.CylinderGeometry(.011,.012,.028,6),bootTrim,(k-1)*.035,-.078,.04,ankle);
     }
     if(isKeeper){for(const s of ['L','R']){
        const hand=j['wrist'+s];if(hand)make(new T.BoxGeometry(.09,.038,.044),bootTrim,0,-.04,.024,hand);
     }}
     else if(j.torso){const stripe=make(new T.BoxGeometry(.018,.36,.012),maroon,-.112,.20,.136,j.torso);stripe.castShadow=false;}
   }
   kit(player);kit(keeper,true);
   teammates.forEach(e=>kit(e.m));defenders.forEach(e=>kit(e.m));
   // Dynamic camera director: smooth tracking, approach, impact and replay-like goal hold.
   const eye=new T.Vector3(),aim=new T.Vector3(),targetEye=new T.Vector3(),targetAim=new T.Vector3();
   const view={mode:PF.cameraMode,shot:0,flash:0,phase:'',time:0};
   const indicators=new T.Group();root.add(indicators);
   const spotlightMat=new T.MeshBasicMaterial({color:0xffe1a0,transparent:true,opacity:.35,depthWrite:false});
   const spotlight=make(new T.RingGeometry(.20,.27,32),spotlightMat,0,.17,goalZ+1.6,indicators);
   spotlight.rotation.x=-Math.PI/2;
   const hdrLight=new T.PointLight(0xc0dafb,.32,14);hdrLight.position.set(0,6,-6);scene.add(hdrLight);
   scene.fog=new T.FogExp2(0x11202b,.012);
   renderer.toneMapping=T.ACESFilmicToneMapping;
   renderer.toneMappingExposure=1.13;
   if(renderer.outputEncoding!==undefined)renderer.outputEncoding=T.sRGBEncoding;
   const key=scene.children.find(e=>e.type==='DirectionalLight');if(key){key.intensity=1.7;key.position.set(-10,24,12);}
   function frame(S,dt){
     view.time+=dt;
     if(view.phase!==S.phase){if(S.phase==='flight')view.shot++;if(S.phase==='outcome'&&S.correct)view.flash=1;view.phase=S.phase;}
     view.flash=Math.max(0,view.flash-dt*1.25);
     const side=S.aim==='left'?-1:S.aim==='right'?1:0;
     const inFlight=['flight','resolve','outcome','question'].includes(S.phase);
     const completion=S.pending?.5:Math.min(1,Number(S.flight)||0);
     const follow=inFlight?completion:0;
     view.mode=PF.cameraMode;
     if(view.mode==='goalkeeper'){
       targetEye.set(-.15+side*.28,1.9,goalZ-2.65);
       targetAim.set(ball.position.x*.4,1.25,Math.max(-7,ball.position.z));
     }else if(view.mode==='pitchside'){
       targetEye.set(-5.7+follow*1.1,1.88,4.0-follow*2.6);
       targetAim.set(ball.position.x*.47,1.1,-5.4-follow*2.1);
     }else{
       targetEye.set(4.8-follow*.7,3.3+follow*.65,7.25-follow*1.1);
       targetAim.set(ball.position.x*.21,1.1+follow*.25,-5.8-follow*1.0);
       if(S.phase==='outcome'&&!S.pending){targetEye.set(3.6,2.65,4.1);targetAim.set(0,1.5,goalZ+1.2);}
     }
     if(S.phase==='welcome'){targetEye.set(6.8,5.0,10.8);targetAim.set(0,1.35,-5.8);}
     const k=Math.min(1,Math.max(.01,dt*3.6));
     eye.copy(camera.position).lerp(targetEye,k);
     // Avoid initial-position snap and keep tracking continuous through questions.
     if(aim.lengthSq()===0)aim.copy(targetAim);else aim.lerp(targetAim,k);
     camera.position.copy(eye);
     camera.lookAt(aim);
     const targetFov=(S.phase==='outcome'&&S.correct)?43:PF.cameraMode==='goalkeeper'?59:PF.cameraMode==='pitchside'?51:45;
     const aspect=innerWidth/Math.max(1,innerHeight);
     const vfov=aspect<.88?Math.max(55,targetFov):targetFov;
     camera.fov+=(vfov-camera.fov)*Math.min(1,dt*2.1);camera.updateProjectionMatrix();
     const heartbeat=1+Math.sin(view.time*3.1)*.12;
     spotlight.scale.setScalar(heartbeat+view.flash*.42);
     spotlight.visible=S.phase==='ready'||S.phase==='runup';
     goalRibbon.material=view.flash>.1?goldMat:edgeMat;
     hdrLight.intensity=.32+view.flash*.85;
     persons.material.emissive.setHex(S.phase==='outcome'&&S.correct?0x371326:0x080b11);
     persons.material.emissiveIntensity=.22+view.flash*.75;
     if(S.phase==='outcome'&&!S.correct)spotlight.visible=false;
   }
   return {frame,stats:{people:count,grass:ngrass,cameras:MODE.slice(),offline:true},dispose(){root.traverse(n=>{if(n.geometry?.dispose)n.geometry.dispose();});}};
 }
};
})();