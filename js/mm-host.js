/* Educational combat arena school adapter — no answer keys are shipped to the iframe. */
(function(root){'use strict';
const TYPE='mm-school/1', ID='muhimmat-almaarifa';
const valid=x=>x&&typeof x==='object'&&!Array.isArray(x);
const fail=s=>{throw Error(s)};
function cleanQuestions(questions){
 if(!Array.isArray(questions)||!questions.length||questions.length>10)fail('عدد الأسئلة غير صالح.');
 const seen=new Set();
 return questions.map(q=>{
  if(!valid(q)||typeof q.id!=='string'||!q.id||seen.has(q.id)||!['multiple_choice','true_false'].includes(q.type))fail('مهمة المعرفة تدعم الاختيار من متعدد والصواب والخطأ فقط.');
  const options=Array.isArray(q.options)&&q.options.length?q.options:q.type==='true_false'?['صح','خطأ']:[];
  if(!String(q.text||'').trim()||String(q.text).length>240||options.length<2||options.length>4||options.some(o=>!String(o).trim()||String(o).length>90))fail('السؤال أو خياراته أطول من قدرة اللوحات أو غير مكتملة.');
  seen.add(q.id);
  return {id:q.id,text:String(q.text||'').slice(0,240),type:q.type,options:options.map((v,i)=>({id:String(i),text:String(v)})),points:Math.max(1,Math.min(100,Number(q.points)||10))};
 });
}
function create(opts){
 const {frame,questions,answer,finish,restart,exit,onGrade=()=>{},onFinished=()=>{},onBusy=()=>{},isCurrent=()=>true,environment=root}=opts;
 const qs=cleanQuestions(questions),channel=environment.crypto.randomUUID(),origin=environment.location.origin;
 const answered=new Set(),pending=new Map();let started=false,disposed=false,index=0,finishing=null,finished=false,restarting=false;
 const active=()=>!disposed&&isCurrent()&&frame.isConnected!==false;
 const send=(type,payload={})=>{if(active())frame.contentWindow.postMessage({protocol:TYPE,game:ID,channel,type,...payload},origin);};
 const busy=()=>pending.size>0||!!finishing||restarting;
 const status=()=>{if(active())onBusy(busy());};
 async function onMessage(e){
  if(!active()||e.origin!==origin||e.source!==frame.contentWindow)return;
  const m=e.data;if(!valid(m)||m.protocol!==TYPE||m.game!==ID)return;
  if(m.type==='ready'){
   if(started)return;started=true;send('config',{questions:qs,title:String(opts.title||'مهمّة المعرفة'),student:String(opts.student||''),mode:opts.mode||'home'});return;
  }
  if(!started||m.channel!==channel)return;
  try{
   if(m.type==='answer'){
    const i=m.index,q=qs[i],key=String(m.requestId||'');
    if(!Number.isInteger(i)||i!==index||!q||m.questionId!==q.id||!/^\d{1,2}$/.test(String(m.value))||!q.options.some(o=>o.id===String(m.value))||key.length<6||key.length>90)fail('طلب إجابة غير صالح أو بترتيب خاطئ.');
    if(answered.has(q.id))fail('انتهى تصحيح هذا السؤال.');
    if(pending.size){send('error',{requestId:key,message:'يجري تصحيح الاختيار السابق.'});return;}
    if(!pending.has(key)){
     const job=Promise.resolve().then(()=>answer({question:q.id,value:Number(m.value)})).then(r=>{
      if(!valid(r)||typeof r.correct!=='boolean'||r.pending||!Number.isFinite(Number(r.points)))fail('رد التصحيح غير صالح.');
      const data={requestId:key,index:i,questionId:q.id,correct:r.correct,points:Number(r.points)||0,feedback:String(r.feedback||''),explanation:String(r.explanation||'')};
      if(r.correct){answered.add(q.id);index++;onGrade(r,q,i);}return data;
     }).finally(()=>{pending.delete(key);status();});
     pending.set(key,job);status();
    }
    send('grade',await pending.get(key));
   }else if(m.type==='finish'){
    if(!finished&&index!==qs.length)fail('أكمل الأسئلة قبل إنهاء المهمة.');
    if(!finishing&&!finished){finishing=Promise.resolve().then(()=>finish()).then(r=>{if(!valid(r)||!Number.isFinite(Number(r.score)))fail('تعذّر حفظ النتيجة.');finished=true;onFinished(r);return {score:Number(r.score),group:!!r.group,pending:!!r.pending,passed:!!r.passed};}).finally(()=>{finishing=null;status();});status();}
    if(finished)send('finishAck',{score:Number(opts.getSavedScore?.()??0),saved:true});else send('finishAck',{...(await finishing),saved:true});
   }else if(m.type==='restart'){
    if(busy())fail('انتظر حفظ التصحيح أولًا.');restarting=true;status();try{await restart();}finally{restarting=false;status();}
   }else if(m.type==='exit'){
    if(busy())fail('انتظر حفظ الإجابة أولًا.');exit(finished);
   }
  }catch(err){send('error',{requestId:String(m.requestId||''),message:err.message||'تعذر تنفيذ الطلب.'});}
 }
 const handler=e=>{onMessage(e).catch(err=>send('error',{message:err.message}));};environment.addEventListener('message',handler);
 return {dispose(){disposed=true;environment.removeEventListener('message',handler);},state(){return {index,finished,busy:busy(),count:qs.length}}};
}
let current;
const api={create,cleanQuestions,mount(x){api.dispose();current=create(x);return current;},dispose(){current?.dispose();current=null;}};
root.ManaratMissionHost=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
