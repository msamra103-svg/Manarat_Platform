/* Original articulated athlete. Local geometry; no model downloads or pose sprites. */
(()=>{'use strict';const T=THREE;
const sphere=new T.SphereGeometry(1,20,14);
function material(color,roughness=.65){return new T.MeshStandardMaterial({color,roughness,metalness:0});}
function oval(parent,mat,x,y,z,sx,sy,sz){const m=new T.Mesh(sphere,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function segment(parent,mat,length,top,bottom,zscale=1){const g=new T.LatheGeometry(Array.from({length:13},(_,i)=>{const t=i/12;return new T.Vector2((top+(bottom-top)*t)*(1+Math.sin(t*Math.PI)*.1),length/2-length*t);}).reverse(),24),m=new T.Mesh(g,mat);m.position.y=-length/2;m.scale.z=zscale;m.castShadow=true;parent.add(m);return m;}
function pivot(parent,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
function fabric(color){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,256,256);for(let y=0;y<256;y+=2){x.fillStyle=y%4?'#ffffff09':'#0000000b';x.fillRect(0,y,256,1);}for(let i=0;i<12;i++){x.strokeStyle=i%2?'#ffffff0c':'#00000018';x.lineWidth=1+(i%3);x.beginPath();x.moveTo(i*23,0);x.bezierCurveTo(i*21+12,65,i*25-7,180,i*23,256);x.stroke();}const tex=new T.CanvasTexture(c);tex.encoding=T.sRGBEncoding;tex.wrapS=tex.wrapT=T.RepeatWrapping;return new T.MeshStandardMaterial({map:tex,roughness:.9});}
function create({keeper=false,basket=false,jerseyColor,shortsColor,skinColor,number:shirtNumber,detail=false}={}){const root=new T.Group(),rig=pivot(root,0,.97,0),skin=material(skinColor||'#b98161',.63),jersey=fabric(jerseyColor||(keeper?'#17604b':'#831738')),shorts=fabric(shortsColor||(keeper?'#18282b':basket?'#831738':'#e8e7df')),sock=material(keeper?'#205741':basket?'#f1ede5':'#64122c'),shoe=material('#f1e8ce',.42),dark=material('#171b1b'),white=material('#f8f3e4');
// Anatomical proportions: pelvis, tapered trunk, neck and detailed head.
oval(rig,shorts,0,-.035,0,.19,.15,.13);
const torso=pivot(rig,0,.13,0);const trunk=new T.Mesh(new T.CylinderGeometry(.225,.17,.43,28,6),jersey);trunk.scale.z=.59;trunk.position.y=.16;trunk.castShadow=true;torso.add(trunk);
oval(torso,jersey,0,.325,0,.225,.105,.135);oval(torso,skin,0,.415,0,.068,.085,.065);
const head=pivot(torso,0,.53,0);oval(head,skin,0,0,0,.103,.135,.096);oval(head,skin,0,-.067,.025,.079,.07,.076);
const hair=material('#211b18',.95);oval(head,hair,0,.064,-.015,.106,.084,.092);oval(head,skin,-.104,0,0,.018,.038,.024);oval(head,skin,.104,0,0,.018,.038,.024);oval(head,skin,0,-.012,.095,.018,.028,.026);
for(const s of [-1,1]){oval(head,white,s*.038,.021,.086,.016,.006,.005);oval(head,dark,s*.038,.02,.094,.005,.006,.004);const brow=oval(head,hair,s*.039,.045,.087,.026,.005,.006);brow.rotation.z=s*.09;}
oval(head,material('#744d3c'),0,-.053,.095,.029,.004,.005);
// Player number in geometry-backed texture; no external typefaces required.
const c=document.createElement('canvas');c.width=128;c.height=128;const cx=c.getContext('2d');cx.clearRect(0,0,128,128);cx.fillStyle='#f4e5c6';cx.textAlign='center';cx.font='bold 92px Arial';cx.fillText(String(shirtNumber??(keeper?'1':basket?'23':'10')),64,100);const number=new T.Mesh(new T.PlaneGeometry(.15,.15),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));number.position.set(0,.19,-.135);number.rotation.y=Math.PI;torso.add(number);
const joints={torso,head},hands={};
for(const [label,s]of [['L',-1],['R',1]]){
 const hip=pivot(rig,s*.105,-.055,0);segment(hip,shorts,.24,.105,.095,.9);segment(pivot(hip,0,-.23,0),skin,.20,.078,.064,.91);const knee=pivot(hip,0,-.43,0);oval(knee,skin,0,0,.015,.064,.071,.065);segment(knee,skin,.42,.065,.039,.9);segment(pivot(knee,0,-.13,0),sock,.29,.061,.037,.95);const ankle=pivot(knee,0,-.42,0);const boot=oval(ankle,shoe,0,-.025,.065,.061,.049,.135);oval(ankle,dark,0,-.064,.061,.062,.013,.136);for(let n=0;n<4;n++)oval(ankle,white,0,.008,.04+n*.017,.046,.003,.003);
 const shoulder=pivot(torso,s*.225,.31,0);oval(shoulder,jersey,0,0,0,.077,.085,.08);if(!basket){segment(shoulder,jersey,.135,.078,.071);segment(pivot(shoulder,0,-.13,0),skin,.16,.059,.048);}else segment(shoulder,skin,.29,.067,.048);const elbow=pivot(shoulder,0,-.29,0);oval(elbow,skin,0,0,0,.049,.05,.047);segment(elbow,skin,.27,.05,.031);const wrist=pivot(elbow,0,-.27,0);oval(wrist,keeper?white:skin,0,-.047,.005,.042,.067,.024);for(let n=0;n<4;n++)oval(wrist,keeper?white:skin,(n-1.5)*.018,-.108,.01,.009,.034,.012);oval(wrist,keeper?white:skin,-s*.046,-.045,.015,.018,.036,.019);
 Object.assign(joints,{['hip'+label]:hip,['knee'+label]:knee,['ankle'+label]:ankle,['arm'+label]:shoulder,['elbow'+label]:elbow,['wrist'+label]:wrist});hands[label]=wrist;
}
if(detail){
 const seam=material('#ffffff',.8);for(const side of [-1,1]){const trim=oval(torso,seam,side*.205,.19,0,.009,.19,.12);trim.scale.z=.8;}
 const front=number.clone();front.material=number.material;front.position.z=.14;front.rotation.y=0;front.scale.setScalar(.72);torso.add(front);
 const kneepad=material('#222931',.85);for(const label of ['L','R'])oval(joints['knee'+label],kneepad,0,.005,.049,.067,.075,.035);
 // Cloth folds and skin pores remain local and deterministic.
 const bump=document.createElement('canvas');bump.width=bump.height=128;const bc=bump.getContext('2d');bc.fillStyle='#808080';bc.fillRect(0,0,128,128);for(let n=0;n<700;n++){const x=(n*47)%128,y=(n*71)%128;bc.fillStyle=n%2?'#898989':'#777777';bc.fillRect(x,y,1,1);}skin.bumpMap=new T.CanvasTexture(bump);skin.bumpScale=.002;
}root.userData={joints,hands,rig};return root;}
const neutral={hipL:0,hipR:0,kneeL:0,kneeR:0,armL:.08,armR:.08,elbowL:-.12,elbowR:-.12,wristL:0,wristR:0,lean:0,twist:0,spreadL:-.08,spreadR:.08,crouch:0,jump:0,roll:0};
function pose(actor,p={}){p={...neutral,...p};const {joints:j,rig}=actor.userData;rig.position.y=.97+p.crouch+p.jump;rig.rotation.z=p.roll;for(const k of ['hipL','hipR','kneeL','kneeR','armL','armR','elbowL','elbowR','wristL','wristR'])j[k].rotation.x=p[k];j.armL.rotation.z=p.spreadL;j.armR.rotation.z=p.spreadR;j.torso.rotation.x=p.lean;j.torso.rotation.y=p.twist;}
function mix(a,b,t){t=Math.max(0,Math.min(1,t));t=t*t*(3-2*t);const p={};for(const k of Object.keys(neutral))p[k]=(a[k]??neutral[k])+((b[k]??neutral[k])-(a[k]??neutral[k]))*t;return p;}
window.SportAthlete={create,pose,mix,neutral};})();
