/* School presentation bridge. The grading authority is always the parent server. */
(()=>{'use strict';
const P='mm-school/1', G='muhimmat-almaarifa', params=new URLSearchParams(location.search);
if(params.get('school')!=='1'||window.parent===window)return;
let game=null,channel='',questions=[],pending=null,finished=false,configured=false;
const origin=location.origin;
const send=(type,rest={})=>window.parent.postMessage({protocol:P,game:G,channel,type,...rest},origin);
function patch(g){
 game=g;document.body.classList.add('mm-school-mode');
 const teacher=document.getElementById('btnTeacher');if(teacher)teacher.remove();
 const label=document.getElementById('playerName');if(label){label.disabled=true;label.closest('label')?.classList.add('hidden');}
 const baseStart=g.startSession.bind(g),baseFinish=g.finish.bind(g),baseMenu=g.enterMenu.bind(g);
 g.notifyHost=function(){}; // No wildcard postMessage revealing answer summaries.
 const originalRenderEnd=g.ui.renderEnd.bind(g.ui);
 g.ui.renderEnd=function(r,n){
  originalRenderEnd(r,n);
  const review=document.getElementById('endReview');
  if(review)review.innerHTML='<li>تم حفظ التصحيح والنتيجة من منصة المدرسة. يمكنك مراجعة إجاباتك مع المعلم.</li>';
  if(g.mmMode==='group'){
   const cards=document.getElementById('endCards');if(cards)cards.innerHTML='<div class="card"><b>اكتملت الجلسة</b><span>لعب جماعي دون درجة فردية</span></div>';
   const name=document.getElementById('endName');if(name)name.textContent='اكتملت الجلسة الجماعية في مهمّة المعرفة.';
  }
 };
 g.startSession=function(){
  if(!configured){g.ui.toast('جارٍ الاتصال بالمنصة…');return;}
  if(finished||g.state==='done'){send('restart');return;}
  return baseStart();
 };
 g.enterMenu=function(...args){if(finished){send('exit');return;}return baseMenu(...args);};
 g.finish=function(){
  if(pending)return;if(!configured)return baseFinish();
  pending={kind:'finish'};send('finish');
 };
 g.evaluate=function(board){
  if(!configured||pending||g.state!=='question'||!g.session)return;
  const i=g.session.index,m=g.session.missions[i],q=questions[i];
  if(!m||!q||m.id!==q.id||m.solved||m.wrong.includes(board.optionId))return;
  const requestId=crypto.randomUUID();pending={kind:'answer',requestId,i,board};g.controls.enabled=false;
  send('answer',{index:i,questionId:q.id,value:board.optionId,requestId});
 };
 function correct(r,entry){
  const s=g.session,m=s.missions[entry.i],board=entry.board,ui=g.ui;
  m.solved=true;m.solvedAttempt=m.wrong.length+1;m.points=r.points;m.question.correctOptionId=String(board.optionId);s.score+=r.points;
  g.state='feedback';g.controls.enabled=false;board.setState('correct');g.fx.successPulse(board.face);g.audio.play('correct');
  ui.setScore(s.score);ui.aimed(null);g.targets.setHover(null);
  const msg='أحسنت! '+(r.points?'+'+r.points:'يمكنك المتابعة');ui.feedback('ok',msg,r.explanation||'');
  g.audio.speak([msg,r.explanation||'']);
  const solved=s.missions.filter(m=>m.solved).length,hold=Math.max(1,Number(g.rules.feedbackSeconds)||2.2),i=s.index;
  g.world.setProgress(solved);g.world.prepare(Math.min(i+1,s.missions.length));
  g.after(0.2,()=>{g.world.openGate(i);g.audio.play('gate');});
  g.after(Math.max(0.8,hold-0.75),()=>{g.targets.retract();g.audio.play('boardUp');});
  g.after(hold,()=>g.goNext());
 }
 function wrong(r,entry){
  const s=g.session,m=s.missions[entry.i],board=entry.board,ui=g.ui;
  if(m.wrong.includes(board.optionId))return;
  m.wrong.push(board.optionId);s.health=Math.max(0,s.health-(Number(g.rules.wrongPenalty)||20));
  board.setState('wrong');g.audio.play('wrong');ui.setHealth(s.health,s.maxHealth,true);
  ui.feedback('no','الإجابة غير صحيحة',r.feedback||'جرّب خيارًا آخر.');
  if(!s.health){s.status='failed';g.state='failed';g.controls.enabled=false;g.after(1,()=>g.showFail());}
  else{g.state='question';g.controls.enabled=true;}
 }
 g.mmSchoolReceive=function(m){
  if(m.type==='config'&&!configured){
   if(!Array.isArray(m.questions)||!m.questions.length||m.questions.length>10)return;
   channel=m.channel;questions=m.questions;g.mmMode=m.mode;
   const qs=questions.map(q=>({id:String(q.id),text:String(q.text),options:q.options.map(o=>({id:String(o.id),text:String(o.text)})),correctOptionId:String(q.options[0].id),explanation:'',hint:'',speech:''}));
   g.bank={title:String(m.title||'مهمّة المعرفة'),questions:qs};
   g.rules.shuffleQuestions=false;g.rules.questionLimit=0;g.rules.shuffleOptions=true;g.rules.points=[100,0,0,0];
   configured=true;g.prefs.playerName=String(m.student||'').slice(0,30);
   if(label)label.value=g.prefs.playerName;
   const b=document.getElementById('btnStart');if(b)b.disabled=false;
   const bankNote=document.getElementById('bankNote');if(bankNote)bankNote.textContent='الأسئلة والتصحيح من منصة المدرسة.';
   return;
  }
  if(m.channel!==channel||!configured)return;
  if(m.type==='grade'&&pending?.kind==='answer'&&m.requestId===pending.requestId&&m.index===pending.i){
   const entry=pending;pending=null;
   if(m.correct)correct(m,entry);else wrong(m,entry);
  }else if(m.type==='finishAck'&&pending?.kind==='finish'){
   pending=null;finished=true;
   if(Number.isFinite(Number(m.score))&&g.session){const maximum=g.session.missions.length*100;g.session.score=Math.round(maximum*Number(m.score)/100);}
   baseFinish();
  }else if(m.type==='error'){
   pending=null;g.controls.enabled=true;g.ui.toast(String(m.message||'تعذر الاتصال بالمنصة؛ أعد المحاولة.'),6000);
  }
 };
 send('ready');
}
window.addEventListener('message',e=>{
 if(e.source!==window.parent||e.origin!==origin||!e.data||e.data.protocol!==P||e.data.game!==G||!game)return;
 game.mmSchoolReceive(e.data);
});
const timer=setInterval(()=>{const g=window.__mmSchoolGame;if(g&&!game){clearInterval(timer);patch(g);}},50);
setTimeout(()=>clearInterval(timer),30000);
})();
