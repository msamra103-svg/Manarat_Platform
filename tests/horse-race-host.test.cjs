'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{create,safeQuestions}=require('../js/horse-race-host.js');
const qs=Array.from({length:10},(_,i)=>({id:'q'+i,type:i%2?'true_false':'multiple_choice',text:'سؤال '+i,options:['صحيح','خطأ'],correct:0,answers:['private'],points:10}));
const sleep=()=>new Promise(r=>setImmediate(r));
function fixture(extra={}){
 let listener,open=true;const sent=[],calls={answer:[],finish:0,restart:0,grade:0,exit:0};
 const child={postMessage(m,origin){sent.push({m,origin})}},env={location:{origin:'https://school.test'},crypto:{randomUUID:()=> 'channel'},addEventListener(t,f){listener=f},removeEventListener(){listener=null}};
 const frame={contentWindow:child,isConnected:true};
 const originalAnswer=async p=>{calls.answer.push(p);return {correct:p.value===0,points:p.value===0&&(calls.answer.filter(x=>x.question===p.question).length===1)?10:0,pending:false,explanation:'test'}};
 const host=create({frame,questions:qs,environment:env,answer:extra.answer||originalAnswer,finish:async()=>{calls.finish++;return {score:50,group:false}},restart:async()=>{calls.restart++},exit:()=>{calls.exit++},onGrade:()=>{calls.grade++},isCurrent:()=>open,...extra});
 const raw=(x)=>listener?.(x);
 const send=async(type,payload={},rest={})=>{raw({origin:env.location.origin,source:child,data:{protocol:'qcr-bridge/1',gameId:'horse-jumping-race',sessionId:type==='game:ready'?null:'channel',type,payload,...rest}});await sleep();await sleep();};
 return {host,env,frame,child,sent,calls,send,raw,offline:()=>{open=false;frame.isConnected=false;host.dispose()}};
}
function answer(f,i,choice='0',n=1,aid='a'+i+'-'+n){return f.send('game:submitAnswer',{questionId:'q'+i,questionIndex:i,choiceId:choice,attemptNo:n,attemptId:aid,timedOut:false},{requestId:aid});}
test('school mode sends only sanitized 10 questions and never grade keys',async()=>{
 const f=fixture();await f.send('game:ready');const x=f.sent[0];assert.equal(x.m.payload.questions.length,10);assert.equal(x.m.payload.questions[1].type,'tf');assert(!JSON.stringify(x).includes('private'));assert.equal(x.origin,'https://school.test');assert.equal(x.m.payload.mode,'solo');
});
test('group uses classroom mode and no student name disclosure',async()=>{
 const f=fixture({mode:'group',studentName:'الاسم الخاص'});await f.send('game:ready');const s=JSON.stringify(f.sent[0]);assert(s.includes('classroom'));assert(!s.includes('الاسم الخاص'));
});
test('reject forged messages and unauthorized source',async()=>{
 const f=fixture();await f.send('game:ready');const legitimate={protocol:'qcr-bridge/1',gameId:'horse-jumping-race',sessionId:'channel',type:'game:submitAnswer',payload:{questionId:'q0',questionIndex:0,choiceId:'0',attemptNo:1,attemptId:'a0'},requestId:'a0'};
 for(const override of [{origin:'https://evil.test'},{source:{}},{source:null},{data:{...legitimate,sessionId:'wrong'}},{data:{...legitimate,gameId:'wrong'}},{data:{...legitimate,protocol:'wrong'}}])f.raw({origin:f.env.location.origin,source:f.child,data:legitimate,...override});await sleep();assert.equal(f.calls.answer.length,0);
});
test('correct first completes one question and duplicate is idempotent',async()=>{
 const f=fixture();await f.send('game:ready');await answer(f,0);await answer(f,0);assert.equal(f.calls.answer.length,1);assert.equal(f.calls.grade,1);assert.equal(f.host.state().index,1);await answer(f,1);assert.equal(f.host.state().index,2);
});
test('wrong answer refuses, next new attempt correct without fabricated score',async()=>{
 const f=fixture();await f.send('game:ready');await answer(f,0,'1');assert.equal(f.host.state().index,0);assert.equal(f.calls.grade,0);assert.equal(f.sent.at(-1).m.payload.correct,false);
 await answer(f,0,'0',2);assert.equal(f.host.state().index,1);assert.equal(f.sent.at(-1).m.payload.correct,true);assert.equal(f.sent.at(-1).m.payload.points,0);assert.equal(f.calls.answer.length,2);assert.equal(f.calls.grade,1);
});
test('repeat wrong option, skip attempt and mutate attemptId are blocked',async()=>{
 const f=fixture();await f.send('game:ready');await answer(f,0,'1');await answer(f,0,'1',2);assert.equal(f.sent.at(-1).m.type,'platform:error');await answer(f,0,'0',3);assert.equal(f.sent.at(-1).m.type,'platform:error');await answer(f,0,'0',1,'a0-1');assert.equal(f.sent.at(-1).m.type,'platform:error');assert.equal(f.calls.answer.length,1);
});
test('server error keeps the question ungraded and retries same attemptId',async()=>{
 let n=0;const f=fixture({answer:async()=>{if(++n===1)throw Error('network');return {correct:true,points:10,pending:false}}});await f.send('game:ready');await answer(f,0);assert.equal(f.host.state().index,0);assert.equal(f.sent.at(-1).m.type,'platform:error');await answer(f,0);assert.equal(f.host.state().index,1);assert.equal(n,2);
});
test('simultaneous duplicates call grading exactly once',async()=>{
 let done,n=0;const f=fixture({answer:async()=>{n++;return new Promise(r=>done=r)}});await f.send('game:ready');const req={questionId:'q0',questionIndex:0,choiceId:'0',attemptNo:1,attemptId:'a0',timedOut:false};
 f.raw({origin:f.env.location.origin,source:f.child,data:{protocol:'qcr-bridge/1',gameId:'horse-jumping-race',sessionId:'channel',type:'game:submitAnswer',payload:req,requestId:'a0'}});f.raw({origin:f.env.location.origin,source:f.child,data:{protocol:'qcr-bridge/1',gameId:'horse-jumping-race',sessionId:'channel',type:'game:submitAnswer',payload:req,requestId:'a0'}});
 await sleep();assert.equal(n,1);done({correct:true,points:10,pending:false});await sleep();assert.equal(f.host.state().index,1);
});
test('finish is only allowed after all barriers and score from server',async()=>{
 const f=fixture();await f.send('game:ready');await f.send('game:result',{resultId:'r',points:999},{requestId:'r'});assert.equal(f.calls.finish,0);
 for(let i=0;i<10;i++)await answer(f,i);await f.send('game:result',{resultId:'r',points:999},{requestId:'r'});await f.send('game:result',{resultId:'r',points:999},{requestId:'r'});assert.equal(f.calls.finish,1);assert.equal(f.sent.at(-1).m.payload.score,50);
});
test('reject manual grade pending, do not cache',async()=>{
 const f=fixture({answer:async()=>({correct:false,points:0,pending:true})});await f.send('game:ready');await answer(f,0);assert.equal(f.host.state().index,0);assert.equal(f.sent.at(-1).m.type,'platform:error');
});
test('reject unsupported question format and duplicate IDs',()=>{assert.throws(()=>safeQuestions([{id:'q',type:'open_text',text:'x',options:['a','b']}]));assert.throws(()=>safeQuestions([qs[0],qs[0]]));});
test('dispose suppresses late server updates and iframe events',async()=>{
 let done;const f=fixture({answer:async()=>new Promise(r=>done=r)});await f.send('game:ready');const req={questionId:'q0',questionIndex:0,choiceId:'0',attemptNo:1,attemptId:'a0',timedOut:false};f.raw({origin:f.env.location.origin,source:f.child,data:{protocol:'qcr-bridge/1',gameId:'horse-jumping-race',sessionId:'channel',type:'game:submitAnswer',payload:req,requestId:'a0'}});await sleep();const n=f.sent.length;f.offline();done({correct:true,points:10,pending:false});await sleep();assert.equal(f.sent.length,n);assert.equal(f.calls.grade,0);
});
