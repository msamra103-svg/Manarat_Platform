'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const C=require('../js/classroom.js');
function fixture(){
 const elements=new Map(),handlers={},intervals=new Set();let requests=0;
 const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',textContent:'',style:{},classList:{toggle(){}},querySelector:()=>null,querySelectorAll:()=>[],contentWindow:{postMessage(){}},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);};
 const c={crypto:webcrypto,URL,URLSearchParams,structuredClone,Date,setTimeout:()=>1,clearTimeout(){},setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn),location:{href:'https://school.test/',origin:'https://school.test',search:''},localStorage:{getItem:()=>''},document:{body:{classList:{toggle(){},contains:()=>true}},getElementById:get,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(type,fn)=>{(handlers[type]||=[]).push(fn);}},window:{Manarat:{esc:s=>String(s??'').replace(/</g,'&lt;')},scrollTo(){},addEventListener(){}},fetch:async()=>{requests++;throw Error('Demo contacted production');}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/classroom.js','utf8'),c);
 const src=fs.readFileSync('js/school.js','utf8');
 vm.runInContext(src.slice(0,src.lastIndexOf('(async()=>{if(!adminPanel)navigation();'))+'window.test={startDemo,answer,finish,enterClassroom,restartSession,gameHUD,toggleDiscussion,play:()=>play,assignment:()=>assignment,advance:()=>{play.index++;play.answered=false;renderQuestion();}};})();',c);
 return {...c.window.test,get,handlers,intervals,requests:()=>requests};
}
for(const game of Object.keys(C.presets))test(game+' completes a classroom demo using only local grades',async()=>{
 const f=fixture();f.startDemo(game,{quick:true,teams:['فريق أ','فريق ب']});
 for(let i=0;i<f.play().questions.length;i++){
  const q=f.play().questions[i];await f.answer(game==='puzzle'?Array.from({length:9},(_,i)=>i):q.correct);
  assert.equal(f.play().completed,i+1);assert.equal(f.play().points,(i+1)*10);
  await f.answer(q.correct);assert.equal(f.play().points,(i+1)*10,'double-click must not award points');
  if(i<f.play().questions.length-1)f.advance();
 }
 await f.finish();assert.match(f.get('app').innerHTML,/100%/);assert.match(f.get('app').innerHTML,/ماذا تعلّمنا/);assert.equal(f.requests(),0);
});
test('accuracy is about attempted questions, and final grade includes the whole assignment',async()=>{
 const f=fixture();f.startDemo('classic',{quick:true});await f.answer(1);assert.match(f.gameHUD(),/100%/);assert.doesNotMatch(f.gameHUD(),/33%/);
 f.advance();await f.answer(2);f.advance();await f.answer(2);await f.finish();assert.match(f.get('app').innerHTML,/67%/);assert.match(f.get('app').innerHTML,/الأرض/);
});
for(const game of C.retryGames)test(game+' keeps first-attempt points while allowing a corrected answer',async()=>{
 const f=fixture();f.startDemo(game,{quick:true,teams:['أ','ب']});await f.answer(0);assert.equal(f.play().completed,0);assert.equal(C.team(f.play()),'أ');
 await f.answer(1);assert.equal(f.play().completed,1);assert.equal(f.play().points,0);assert.equal(C.stats(f.play()).assisted,1);assert.equal(C.stats(f.play()).accuracy,0);
 f.advance();assert.equal(C.team(f.play()),'ب');await f.answer(0);f.advance();await f.answer(2);await f.finish();assert.match(f.get('app').innerHTML,/67%/);
});
test('moving from a full game to classroom continues at the next unsaved question',async()=>{
 const f=fixture();f.startDemo('football');await f.answer(1);assert.equal(f.play().points,10);await f.enterClassroom();assert.equal(f.play().index,1);assert.equal(f.play().points,10);assert.equal(f.play().quick,true);
 await f.answer(0);f.advance();await f.answer(2);await f.finish();assert.match(f.get('app').innerHTML,/100%/);
});
test('switch is blocked while saving and a completed game is not graded twice',async()=>{
 const f=fixture();f.startDemo('classic');f.play().answerPending=true;await f.enterClassroom();assert.equal(f.play().quick,false);f.play().answerPending=false;
 for(let i=0;i<3;i++){await f.answer(f.play().questions[i].correct);if(i<2)f.advance();}
 await f.enterClassroom();assert.equal(f.play().finished,true);assert.equal(f.play().points,30);await f.finish();assert.equal(f.play().points,30);
});
test('discussion stops answer submission and review timer, then resumes without a new session',async()=>{
 const f=fixture();f.startDemo('classic',{quick:true});const s=f.play();s.reviewEnds=Date.now()+60000;
 f.toggleDiscussion();await f.answer(1);assert.equal(s.completed,0);assert.equal(f.intervals.size,0);
 s.discussionAt-=5000;const oldEnd=s.reviewEnds;f.toggleDiscussion();assert(s.reviewEnds>=oldEnd+5000);assert.equal(f.intervals.size,1);await f.answer(1);assert.equal(s.completed,1);
});
test('restart preserves classroom preferences and clears previous learning records',async()=>{
 const f=fixture();f.startDemo('classic',{quick:true,teams:['أ','ب'],reflection:'فكرة الدرس'});await f.answer(0);await f.restartSession();assert.equal(f.play().quick,true);assert.equal(f.play().reflection,'فكرة الدرس');assert.equal(C.stats(f.play()).answered,0);assert.equal(f.play().completed,0);
});
test('review escapes question text and separates pending marks from first-attempt accuracy',()=>{
 const s={template:'classic',questions:[{id:'q',text:'<script>x</script>'},{id:'e',text:'مقال'}],teams:['<img>'],reflection:'<iframe>'};
 C.record(s,s.questions[0],1,{correct:false,pending:false,points:0,explanation:'<svg onload=x>'});C.record(s,s.questions[1],'answer',{pending:true,points:0});
 assert.equal(C.stats(s).graded,1);assert.equal(C.stats(s).pending,1);assert.equal(C.stats(s).accuracy,0);assert.doesNotMatch(C.review(s),/<script>|<img>|<svg onload|<iframe>/);
});
test('resuming retry games retains the unresolved question and does not re-award a saved grade',()=>{
 const s={template:'horse-jumping-race',questions:[{id:'a',text:'a'},{id:'b',text:'b'}]};
 C.record(s,s.questions[0],0,{correct:true,points:10});C.record(s,s.questions[1],1,{correct:false,points:0});
 assert.equal(C.resume(s),true);assert.equal(s.index,1);assert.equal(s.completed,1);assert.equal(s.points,10);
 C.record(s,s.questions[1],0,{correct:true,points:0});assert.equal(C.resume(s),false);assert.equal(s.points,10);assert.equal(C.stats(s).assisted,1);
});

test('failed grading leaves the question available for a later successful save',async()=>{
 const f=fixture();f.startDemo('classic',{quick:true});f.play().demo=false;
 await assert.rejects(f.answer(1),/Demo contacted production/);assert.equal(f.play().completed,0);assert.equal(f.play().points,0);assert.equal(f.play().answerPending,false);assert.equal(C.stats(f.play()).answered,0);
 f.play().demo=true;await f.answer(1);assert.equal(f.play().completed,1);assert.equal(f.play().points,10);
});
test('question identifiers are treated as data rather than object properties',()=>{
 const s={template:'classic',questions:[{id:'__proto__',text:'سؤال'}]};C.record(s,s.questions[0],0,{correct:true,points:10});assert.equal(C.stats(s).first,1);assert.equal(C.resume(s),false);assert.equal(s.points,10);assert.equal({}.correct,undefined);
});
