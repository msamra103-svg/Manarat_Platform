/* Football-only interface: camera director, shot power, and touch aiming.
 * Does not access questions or answer keys. The school platform grades on server.
 */
(()=>{'use strict';
if(document.body.dataset.sport!=='football')return;
const PF=window.PremierFootball;if(!PF)return;
const $=id=>document.getElementById(id);
const camera=$('viewCamera'),power=$('shotPower'),meter=$('powerOutput'),pitch=$('pitch'),label=$('cameraLabel');
const names={broadcast:'بث تلفزيوني',pitchside:'الكاميرا الجانبية',goalkeeper:'من خلف الحارس'};
PF.shotPower=.72;PF.shotCurve=0;PF.shotType='balanced';
function view(){if(!camera)return;const next=PF.nextCamera();camera.setAttribute('aria-label','زاوية الكاميرا: '+names[next]);camera.textContent='الكاميرا: '+names[next];if(label)label.textContent=names[next];}
if(camera){camera.addEventListener('click',view);camera.textContent='الكاميرا: '+names[PF.cameraMode];}
const types=document.querySelectorAll('[data-shot-style]');
for(const b of types){b.addEventListener('click',()=>{
  const s=b.dataset.shotStyle;
  PF.shotType=s;PF.shotCurve=s==='curl'?.7:s==='power'?-.1:0;
  types.forEach(n=>{n.classList.toggle('active',n===b);n.setAttribute('aria-pressed',String(n===b));});
});}
function setPower(){if(!power||!meter)return;PF.shotPower=Number(power.value)/100;meter.textContent=power.value+'٪';power.setAttribute('aria-valuetext',power.value+' بالمئة');}
if(power){power.addEventListener('input',setPower);setPower();}
// A single tap anywhere over the pitch selects the shot lane.
// Do not shoot on tap: classroom touch displays require an explicit action.
if(pitch)pitch.addEventListener('pointerup',e=>{
  if(window.Football?.phase!=='ready')return;
  const r=pitch.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;
  if(!Number.isFinite(x))return;
  const side=x<.36?'left':x>.64?'right':'center';
  const btn=document.querySelector('[data-aim="'+side+'"]');
  if(btn){btn.click();const aim=$('targetNotice');if(aim){aim.textContent='التوجيه: '+({left:'يسار المرمى',right:'يمين المرمى',center:'وسط المرمى'}[side]);aim.hidden=false;}}
});
// Broadcast score updates read existing live state, no duplicate score authority.
const topScore=$('broadcastScore');
let lastScore='';
function repaint(){
  if(!document.body.contains(topScore))return;
  const goals=window.Football?.goals??0;
  const viewScore=''+goals;
  if(topScore&&viewScore!==lastScore){topScore.textContent=viewScore;lastScore=viewScore;}
  window.requestAnimationFrame(repaint);
}
if(topScore)requestAnimationFrame(repaint);
})();