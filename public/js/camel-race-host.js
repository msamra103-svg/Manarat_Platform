/* Camel race adapter: grades and student identity remain owned by school-api. */
(function(root){'use strict';
const GAME='qatar-camel-race',PROTOCOL='qcr-bridge/1';
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const str=x=>typeof x==='string'&&x.length>0&&x.length<=160;
function safeQuestions(questions){
 if(!Array.isArray(questions)||!questions.length||questions.length>100)throw new Error('عدد أسئلة السباق غير صالح.');
 const seen=new Set();
 return questions.map(q=>{
  if(!q||!str(q.id)||seen.has(q.id)||!['multiple_choice','true_false'].includes(q.type)||!Array.isArray(q.options)||q.options.length<2)throw new Error('سباق الهجن يدعم الاختيار من متعدد والصواب والخطأ.');
  seen.add(q.id);
  return {id:q.id,text:String(q.text||''),type:q.type==='true_false'?'tf':'mcq',subject:String(q.subject||''),points:Math.max(1,Math.min(100,Number(q.points)||10)),choices:q.options.map((s,i)=>({id:String(i),text:String(s)})),media:q.image?{image:String(q.image),alt:'صورة السؤال'}:null};
 });
}
function create({frame,questions,mode='home',isDemo=false,answer,finish,restart,exit,onGrade=()=>{},onFinished=()=>{},onBusy=()=>{},isCurrent=()=>true,environment=root,channelId}){
 const origin=environment.location.origin,sid=channelId||environment.crypto.randomUUID(),qs=safeQuestions(questions);
 const grades=new Map(),bindings=new Map(),attempts=new Map(),inFlight=new Map();
 let disposed=false,started=false,next=0,finishJob=null,finalAck=null,restarting=false;
 const live=()=>!disposed&&isCurrent()&&frame.isConnected!==false;
 const send=(type,payload,requestId)=>{if(live())frame.contentWindow.postMessage({protocol:PROTOCOL,gameId:GAME,sessionId:sid,type,requestId,payload},origin);};
 const error=(m,e)=>send('platform:error',{code:'platform_error',message:e?.message||'تعذر الاتصال بالمنصة. أعد المحاولة.',retryable:true},m.requestId);
 const busy=()=>inFlight.size>0||!!finishJob||restarting;
 const status=()=>{if(live())onBusy(busy());};
 async function submit(m,p){
  if(!str(m.requestId)||m.requestId!==p.attemptId||!Number.isInteger(p.questionIndex))throw new Error('طلب إجابة غير صالح.');
  const i=p.questionIndex,q=qs[i];if(!q||q.id!==p.questionId||i>next)throw new Error('ترتيب السؤال غير صالح.');
  const timedOut=p.timedOut===true;
  if(!timedOut&&(!str(p.choiceId)||!q.choices.some(c=>c.id===p.choiceId)))throw new Error('اختر إجابة متاحة.');
  if(timedOut&&p.choiceId!==null&&p.choiceId!==undefined)throw new Error('طلب انتهاء الوقت غير صالح.');
  const signature=JSON.stringify([p.attemptId,timedOut?null:p.choiceId,timedOut]);
  if(bindings.has(q.id)&&bindings.get(q.id)!==signature)throw new Error('لا يمكن تغيير الإجابة المسجلة.');
  if(attempts.has(p.attemptId)&&attempts.get(p.attemptId)!==q.id)throw new Error('معرّف محاولة مكرر.');
  if(finalAck&&!grades.has(q.id))throw new Error('انتهى السباق.');
  if(!bindings.has(q.id)){bindings.set(q.id,signature);attempts.set(p.attemptId,q.id);}
  if(grades.has(q.id)){send('platform:grade',grades.get(q.id),m.requestId);return;}
  if(!inFlight.has(q.id)){
   // Defer execution one microtask so reentrant duplicates see the in-flight map.
   const job=Promise.resolve().then(()=>answer({question:q.id,value:timedOut?null:Number(p.choiceId)})).then(r=>{
    if(!object(r)||typeof r.correct!=='boolean'||!Number.isFinite(r.points))throw new Error('رد التصحيح غير صالح.');
    if(r.pending)throw new Error('هذه الإجابة تحتاج مراجعة المعلم؛ لم يكتمل تصحيح السؤال.');
    const g={status:'graded',questionId:q.id,attemptId:p.attemptId,correct:r.correct,points:r.points,explanation:String(r.explanation||'')};
    if(!grades.has(q.id)){grades.set(q.id,g);next++;if(live())onGrade(r,q,i);}
    return g;
   }).finally(()=>{inFlight.delete(q.id);status();});
   inFlight.set(q.id,job);status();
  }
  const g=await inFlight.get(q.id);send('platform:grade',g,m.requestId);
 }
 async function result(m,p){
  if(!str(m.requestId)||m.requestId!==p.resultId)throw new Error('طلب نتيجة غير صالح.');
  if(finalAck){send('platform:ack',finalAck,m.requestId);return;}
  if(next!==qs.length||inFlight.size)throw new Error('أكمل جميع أسئلة السباق قبل حفظ النتيجة.');
  if(!finishJob){
   finishJob=Promise.resolve().then(()=>finish()).then(r=>{
    if(!object(r)||!Number.isFinite(r.score))throw new Error('تعذر التحقق من النتيجة النهائية.');
    finalAck={status:'saved',score:r.score,pending:!!r.pending,group:!!r.group,demo:!!isDemo};
    if(live())onFinished(r);return finalAck;
   }).finally(()=>{finishJob=null;status();});status();
  }
  const ack=await finishJob;send('platform:ack',ack,m.requestId);
 }
 async function receive(e){
  if(!live()||e.origin!==origin||e.source!==frame.contentWindow)return;
  const m=e.data;if(!object(m)||m.protocol!==PROTOCOL||m.gameId!==GAME||typeof m.type!=='string'||!object(m.payload))return;
  const p=m.payload;
  if(m.type==='game:ready'){
   if(m.sessionId!==null&&m.sessionId!==undefined)return;
   started=true;
   send('platform:init',{sessionId:sid,mode:mode==='group'?'classroom':'solo',player:{name:'شهاب'},settings:{segmentSeconds:6,answerTimerSeconds:0},questions:qs});return;
  }
  if(!started||m.sessionId!==sid)return;
  try{
   if(m.type==='game:requestQuestions'){if(str(m.requestId))send('platform:questions',{questions:qs},m.requestId);}
   else if(m.type==='game:submitAnswer')await submit(m,p);
   else if(m.type==='game:result')await result(m,p);
   else if(m.type==='game:restart'){
    if(!str(m.requestId)||busy())throw new Error('انتظر اكتمال حفظ الإجابة أو النتيجة أولًا.');
    restarting=true;status();
    try{await restart();send('platform:ack',{status:'restarting'},m.requestId);}finally{restarting=false;status();}
   }else if(m.type==='game:exit'){
    if(busy())throw new Error('انتظر اكتمال حفظ الإجابة أو النتيجة أولًا.');
    exit(!!finalAck);
   }
  }catch(err){error(m,err);}
 }
 const listener=e=>{receive(e).catch(err=>error(e.data||{},err));};
 environment.addEventListener('message',listener);
 return {dispose(){disposed=true;environment.removeEventListener('message',listener);},state(){return {count:qs.length,completed:next,finished:!!finalAck,busy:busy(),channel:sid};}};
}
let active;
const api={create,safeQuestions,mount(o){api.dispose();active=create(o);return active;},dispose(){active?.dispose();active=null;}};
root.ManaratCamelHost=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
