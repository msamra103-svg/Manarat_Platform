'use strict';
const cfg=window.HANDOFF_CONFIG,frame=document.getElementById('game'),statusEl=document.getElementById('status'),logEl=document.getElementById('log');
const token=crypto.randomUUID(),prefix='school-'+cfg.id+'-';let index=0,answered=false,outcome=false,waiting=false;
window.__handoff={ready:false,configured:false,messages:[],finished:false};
function log(s){logEl.textContent=(s+'\n'+logEl.textContent).slice(0,6000);}
function send(data){frame.contentWindow.postMessage(data,location.origin);log('HOST '+data.type);}
function controls(v){document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=!v);}
function config(){let data={type:prefix+'config',token,count:3,title:cfg.title,school:'مدرسة أبو عبيدة الإعدادية للبنين',teacher:'معلم تجريبي',student:'طالب تجريبي',subject:'تجربة محلية',logo:'',images:Array(3).fill(location.origin+'/dev/fixture.svg')};if(cfg.id==='puzzle')Object.assign(data,{image:location.origin+'/dev/fixture.svg',pieces:9,gender:'male',showReference:true});if(cfg.id==='target-shooting')data.shooting={mode:'choice',difficulty:'beginner',arrowsPerQuestion:3,aimAssist:'auto'};send(data);window.__handoff.configured=true;statusEl.textContent='اتصلت اللعبة بالمحاكي المحلي — لا توجد بيانات حقيقية';}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||!e.data||typeof e.data!=='object')return;const b=e.data;if(typeof b.type!=='string'||!b.type.startsWith(prefix))return;window.__handoff.messages.push(b.type);log('GAME '+b.type);
 if(b.type===prefix+'ready'){window.__handoff.ready=true;config();return;}if(b.token!==token)return;
 if(b.type===prefix+'fullscreen'){frame.requestFullscreen?.();return;}
 if(cfg.id==='puzzle'&&b.type===prefix+'complete'){window.__handoff.finished=true;statusEl.textContent='اكتمل البازل محليًا دون إرسال نتيجة إلى المنصة';return;}
 if(cfg.id==='race'&&b.type===prefix+'finished'){window.__handoff.finished=true;statusEl.textContent='اكتمل السباق التجريبي';return;}
 if(b.type===prefix+'question'){if(cfg.id==='race'&&Number.isInteger(b.index)&&b.index>=index&&b.index<3){index=b.index;answered=false;}if(b.index!==index||answered)return;waiting=true;controls(true);statusEl.textContent='توقف للسؤال '+(index+1)+' — اختر محاكاة إجابة صحيحة أو خاطئة';return;}
 if(b.type===prefix+'outcome'&&b.index===index&&answered)outcome=true;
 if(cfg.id==='qatar-hero'){if(b.type===prefix+'next'&&b.index===index+1&&answered){index++;answered=false;}if(b.type===prefix+'finish'&&b.index===3&&answered)window.__handoff.finished=true;return;}
 if(b.type===prefix+'next'&&b.index===index&&answered&&outcome){const old=index;if(index===2){window.__handoff.finished=true;statusEl.textContent='انتهت تجربة الجلسة المحلية';return;}index++;answered=false;outcome=false;send({type:prefix+'advance',token,index:old});}
});
document.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>{if(!waiting)return;const correct=b.dataset.answer==='true';waiting=false;answered=cfg.id==='qatar-hero'?!(!correct):true;controls(false);send({type:cfg.id==='race'?'school-race-continue':prefix+'result',token,index,correct,pending:false,feedback:correct?'إجابة صحيحة تجريبية':'إجابة خاطئة تجريبية'});statusEl.textContent='استكمل اللعب؛ التصحيح هنا محاكاة فقط';}));
document.getElementById('reset').onclick=()=>location.reload();controls(false);frame.src=cfg.entry;
