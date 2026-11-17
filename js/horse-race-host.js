/* Horse jumping race host adapter. The school-api is the sole grading authority. */
(function(root){'use strict';
const GAME='horse-jumping-race',PROTOCOL='qcr-bridge/1';
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.length>0&&x.length<=180;
function safeQuestions(list){
 if(!Array.isArray(list)||!list.length||list.length>100)throw Error('عدد أسئلة سباق الخيل غير صالح.');
 const seen=new Set();
 return list.map(q=>{
  const options=q?.type==='true_false'&&(!Array.isArray(q?.options)||q.options.length<2)?['صح','خطأ']:q?.options;
  if(!object(q)||!nonempty(q.id)||seen.has(q.id)||!['multiple_choice','true_false'].includes(q.type)||!Array.isArray(options)||options.length<2||options.length>8||!String(q.text||'').trim())throw Error('سباق الخيل يدعم أسئلة الاختيار من متعدد والصواب والخطأ فقط.');
  seen.add(q.id);
  return {id:q.id,text:String(q.text).slice(0,2400),type:q.type==='true_false'?'tf':'mcq',subject:String(q.subject||'').slice(0,120),points:Math.max(1,Math.min(100,Number(q.points)||10)),choices:options.map((v,i)=>({id:String(i),text:String(v).slice(0,1200)})),media:typeof q.image==='string'&&/^(?:https:\/\/|\.{0,2}\/|[\w-])/.test(q.image)?{image:String(q.image),alt:'صورة السؤال'}:null};
 });
}
function create({frame,questions,mode='home',isDemo=false,answer,finish,restart,exit,onGrade=()=>{},onFinished=()=>{},onBusy=()=>{},isCurrent=()=>true,environment=root,channelId,studentName=''}){
 if(!frame||typeof answer!=='function'||typeof finish!=='function'||typeof restart!=='function'||typeof exit!=='function')throw Error('إعداد المضيف غير مكتمل.');
 const origin=environment.location.origin,sid=channelId||environment.crypto.randomUUID(),qs=safeQuestions(questions);
 const signatures=new Map(),cached=new Map(),inFlight=new Map(),attempts=new Map(),usedChoices=new Map(),cleared=new Set();
 let disposed=false,started=false,next=0,finishJob=null,finalAck=null,restarting=false;
 const live=()=>!disposed&&isCurrent()&&frame.isConnected!==false;
 const send=(type,payload={},requestId)=>{if(live())frame.contentWindow.postMessage({protocol:PROTOCOL,gameId:GAME,sessionId:sid,type,requestId,payload},origin);};
 const error=(m,e)=>send('platform:error',{code:e?.code||'platform_error',message:e?.message||'تعذر الاتصال بالمنصة. أعد المحاولة.',retryable:e?.retryable!==false},m?.requestId);
 const busy=()=>inFlight.size>0||!!finishJob||restarting;
 const status=()=>{if(live())onBusy(busy());};
 async function submit(m,p){
  if(!nonempty(m.requestId)||p.attemptId!==m.requestId||!Number.isInteger(p.questionIndex)||!Number.isInteger(p.attemptNo)||p.attemptNo<1)throw Error('طلب إجابة غير صالح.');
  const i=p.questionIndex,q=qs[i];if(!q||q.id!==p.questionId||i!==next||cleared.has(q.id)||finalAck)throw Error('ترتيب السؤال غير صالح.');
  const timedOut=p.timedOut===true,choiceId=p.choiceId===null?null:String(p.choiceId??'');
  if(!timedOut&&(!nonempty(choiceId)||!q.choices.some(c=>c.id===choiceId)))throw Error('اختر إجابة متاحة.');
  if(timedOut&&choiceId!==null)throw Error('طلب انتهاء الوقت غير صالح.');
  const signature=JSON.stringify([q.id,i,choiceId,timedOut,p.attemptNo]);
  if(signatures.has(m.requestId)&&signatures.get(m.requestId)!==signature)throw Error('لا يمكن تغيير محاولة محفوظة.');
  if(cached.has(m.requestId)){send('platform:grade',cached.get(m.requestId),m.requestId);return;}
  if(inFlight.has(m.requestId)){send('platform:grade',await inFlight.get(m.requestId),m.requestId);return;}
  if(p.attemptNo!==(attempts.get(q.id)||0)+1)throw Error('ترتيب المحاولات غير صالح.');
  if(choiceId!==null&&usedChoices.get(q.id)?.has(choiceId))throw Error('هذه الإجابة جُرّبت من قبل.');
  if(inFlight.size||restarting||finishJob)throw Error('انتظر حفظ الإجابة الجارية.');
  signatures.set(m.requestId,signature);
  const job=Promise.resolve().then(()=>answer({question:q.id,value:timedOut?null:Number(choiceId)})).then(r=>{
   if(!object(r)||typeof r.correct!=='boolean'||!Number.isFinite(Number(r.points))||r.pending)throw Error('لم يكتمل تصحيح السؤال من الخادم. أعد المحاولة.');
   // A retry must never award credit that the school server did not authorize.
   const grade={status:'graded',attemptId:m.requestId,questionId:q.id,correct:r.correct,points:Number(r.points),explanation:r.correct?String(r.explanation||''):''};
   cached.set(m.requestId,grade);attempts.set(q.id,p.attemptNo);
   if(!r.correct){if(choiceId!==null){if(!usedChoices.has(q.id))usedChoices.set(q.id,new Set());usedChoices.get(q.id).add(choiceId);}}
   else{cleared.add(q.id);next++;if(live())onGrade(r,q,i);}
   return grade;
  }).finally(()=>{inFlight.delete(m.requestId);status();});
  inFlight.set(m.requestId,job);status();
  send('platform:grade',await job,m.requestId);
 }
 async function result(m,p){
  if(!nonempty(m.requestId)||p.resultId!==m.requestId)throw Error('طلب حفظ غير صالح.');
  if(finalAck){send('platform:ack',finalAck,m.requestId);return;}
  if(next!==qs.length||inFlight.size||restarting)throw Error('أكمل كل الحواجز قبل حفظ النتيجة.');
  if(!finishJob){finishJob=Promise.resolve().then(()=>finish()).then(r=>{
   if(!object(r)||!Number.isFinite(Number(r.score)))throw Error('تعذر حفظ النتيجة النهائية.');
   finalAck={status:'saved',score:Number(r.score),group:!!r.group,pending:!!r.pending};if(live())onFinished(r);return finalAck;
  }).finally(()=>{finishJob=null;status();});status();}
  send('platform:ack',await finishJob,m.requestId);
 }
 async function receive(e){
  if(!live()||e.origin!==origin||e.source!==frame.contentWindow)return;
  const m=e.data;if(!object(m)||m.protocol!==PROTOCOL||m.gameId!==GAME||typeof m.type!=='string'||!object(m.payload))return;
  const p=m.payload;
  if(m.type==='game:ready'){
   if(m.sessionId!=null||started)return;
   started=true;
   send('platform:init',{sessionId:sid,mode:mode==='group'?'classroom':'solo',player:{name:mode==='group'?'فريق الصف':String(studentName||'متسابق').slice(0,80),teamName:mode==='group'?'فريق الصف':'',students:[]},settings:{segmentSeconds:6,answerTimerSeconds:0},questions:qs});return;
  }
  if(!started||m.sessionId!==sid)return;
  try{
   if(m.type==='game:requestQuestions'){if(nonempty(m.requestId))send('platform:questions',{questions:qs},m.requestId);}
   else if(m.type==='game:submitAnswer')await submit(m,p);
   else if(m.type==='game:result')await result(m,p);
   else if(m.type==='game:restart'){
    if(!nonempty(m.requestId)||busy())throw Error('انتظر حفظ الإجابات قبل إعادة السباق.');
    restarting=true;status();try{await restart();send('platform:ack',{status:'restarting'},m.requestId);}finally{restarting=false;status();}
   }else if(m.type==='game:exit'){if(busy())throw Error('انتظر حفظ الإجابة أولًا.');exit(!!finalAck);}
  }catch(err){error(m,err);}
 }
 const listener=e=>{receive(e).catch(err=>error(e.data||{},err));};
 environment.addEventListener('message',listener);
 return {dispose(){disposed=true;environment.removeEventListener('message',listener);},state(){return {index:next,finished:!!finalAck,attempts:new Map(attempts),busy:busy(),count:qs.length}}};
}
let current;
const api={create,safeQuestions,mount(opts){api.dispose();current=create(opts);return current;},dispose(){current?.dispose();current=null;}};
root.ManaratHorseRaceHost=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
