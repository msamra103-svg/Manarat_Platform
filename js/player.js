(function(){
const M=Manarat,$=id=>document.getElementById(id);
let s=M.store(),params=new URLSearchParams(location.search),game=s.games.find(g=>g.id===params.get('game'))||s.games[0];
let state={puzzleOrder:[],selectedPuzzle:null,puzzleSolvedFx:false,started:false,done:false,i:0,score:0,correct:0,name:'',players:[],start:0,answered:false,waitingRetry:false,selected:null,matches:{},set:[],tries:0,currentOrder:[],dragText:null,playMode:'',answerLog:[],classItems:[],classBuckets:[],selectedClass:'',flowMode:'sequential',answeredIndexes:[],lastChosenIndex:-1};
let timer=null,clockTimer=null,timeLeft=0,dragEl=null;
function gnum(...vals){for(const v of vals){const n=Number(v);if(Number.isFinite(n)&&n>0)return n}return 0}
function audienceGender(){return M.normalizedGender(game?.audience_gender||s.platform?.uiGender||'female')}
window.ManaratCurrentGameGender=audienceGender();
function pack(){return M.genderPack(audienceGender())}
function T(v){return M.genderizeText(v,audienceGender())}
function labelStudent(){return game?.student_label?T(game.student_label):pack().student}
function phrase(k){return pack()[k]||k}
function gamePhrase(key,fallbackKey){
  const defaults=pack();
  const raw=game && game[key] ? game[key] : (defaults[fallbackKey||key]||'');
  return T(raw);
}
function chooseArabicVoice(){try{const voices=window.speechSynthesis?.getVoices?.()||[];const ar=voices.filter(v=>/^ar/i.test(v.lang||'')||/arabic|عربي|arabia/i.test((v.name||'')+' '+(v.voiceURI||'')));const femaleKeys=/female|woman|hoda|salma|layla|laila|mariam|zeina|amira|nora|fatima|sara|sarah|سلمى|ليلى|مريم|نورة|فاطمة|سارة/i;const maleKeys=/male|man|maged|tarik|tariq|naayf|nayf|youssef|omar|ali|ماجد|طارق|نايف|عمر|علي/i;const re=audienceGender()==='female'?femaleKeys:maleKeys;return ar.find(v=>re.test((v.name||'')+' '+(v.voiceURI||'')))||ar[0]||null}catch(e){return null}}
function speakText(text){if(game.enable_sound===false)return;try{if(!('speechSynthesis' in window)||!text)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(T(text));u.lang='ar-SA';u.rate=audienceGender()==='female'?.94:.9;u.pitch=audienceGender()==='female'?1.35:.82;const voice=chooseArabicVoice();if(voice)u.voice=voice;window.speechSynthesis.speak(u)}catch(e){}}
function pickVoice(list,fallback){if(Array.isArray(list)&&list.length){return String(list[Math.floor(Math.random()*list.length)]||fallback)}return fallback}
function speak(kind){
  const defaults=pack();
  const list=kind==='good'?defaults.correctVoicePhrases:(kind==='puzzle'?defaults.puzzleVoicePhrases:defaults.wrongVoicePhrases);
  const fallback=kind==='good'?defaults.excellent:(kind==='puzzle'?defaults.puzzleDone:defaults.wrong);
  speakText(pickVoice(list,fallback));
}
function mode(){return state.playMode||game?.mode||'individual'}
function typeName(t){return{multiple_choice:'اختيار من متعدد',true_false:'صح أو خطأ',matching:'مطابقة',connecting:'توصيل بالأسهم',ordering:'ترتيب',classification:'تصنيف',open_text:'نص مفتوح',short_answer:'نص مفتوح',puzzle_image:'بازل صورة'}[t]||'سؤال'}
window.toggleFull=function(){const d=document;if(!d.fullscreenElement)d.documentElement.requestFullscreen?.();else d.exitFullscreen?.()}
function refresh(){s=M.store();game=s.games.find(g=>g.id===params.get('game'))||s.games[0];window.ManaratCurrentGameGender=audienceGender()}
function groupByType(qs){return qs.reduce((a,q)=>{const t=q.type||'multiple_choice';(a[t]||(a[t]=[])).push(q);return a},{})}
function clone(q,extra={}){return JSON.parse(JSON.stringify({...q,...extra}))}
function selectedCount(kind){
  const total=(game.questions||[]).length||1;
  const id=kind==='competition'?'playCompetitionCount':'playIndividualCount';
  const fallback=kind==='competition'?gnum(game.competition_question_count,game.competitionQuestionCount,5):gnum(game.individual_question_count,game.individualQuestionCount,game.question_count,total);
  const n=Number($(id)?.value||fallback||total);
  return Math.max(1,Math.min(total,Number.isFinite(n)?n:total));
}
function selectedFlow(){return $('playFlowMode')?.value||state.flowMode||'sequential'}
function buildIndividualSet(){let qs=[...(game.questions||[])];if(game.shuffle_questions!==false)qs=M.shuffle(qs);const count=selectedCount('individual');return qs.slice(0,Math.min(count,qs.length)).map((q,i)=>clone(q,{playIndex:i,boardNumber:i+1}))}
function buildCompetitionSet(){const qs=[...(game.questions||[])],groups=groupByType(qs),types=Object.keys(groups);if(!types.length)return[];const count=selectedCount('competition');let out=[],used=[new Set(),new Set()];for(let r=0;r<count;r++){const t=types[r%types.length];for(let p=0;p<2;p++){let pool=(groups[t]||qs).filter(q=>!used[p].has(String(q.id)));if(!pool.length)pool=groups[t]||qs;const q=pool[Math.floor(Math.random()*pool.length)];if(q){used[p].add(String(q.id));out.push(clone(q,{playerIndex:p,roundIndex:r+1,boardNumber:out.length+1}))}}}return out}
function resetSet(){state.flowMode=selectedFlow();if(mode()==='competition'){state.players=[{name:(($('studentSelect1')?.value||$('studentName1')?.value||'').trim()||phrase('first')),score:0,correct:0},{name:(($('studentSelect2')?.value||$('studentName2')?.value||'').trim()||phrase('second')),score:0,correct:0}];state.set=buildCompetitionSet()}else{state.name=(($('studentSelect')?.value||$('studentName')?.value||'').trim()||labelStudent());state.players=[];state.set=buildIndividualSet()}state.answeredIndexes=[];state.lastChosenIndex=-1}
function start(){if(!game||!(game.questions||[]).length){return M.toast('لا توجد أسئلة في هذه اللعبة','error')}state.started=true;state.done=false;state.i=0;state.score=0;state.correct=0;state.answerLog=[];state.start=Date.now();resetSet();startClock();if(state.flowMode==='board')renderQuestionBoard();else if(state.flowMode==='random')renderRandomPicker();else renderQuestion()}
window.startGame=start;
window.choosePlayMode=function(m){state.playMode=(m==='competition'?'competition':'individual');renderStart();M.playTone('click')};
window.setPlayFlowMode=function(m){state.flowMode=['sequential','board','random'].includes(m)?m:'sequential';M.playTone('click')};
function current(){return state.set[state.i]}
function currentPlayer(){const q=current();return mode()==='competition'?state.players[q?.playerIndex||0]:null}
function totalPoints(){return state.set.reduce((a,q)=>a+Number(q.points||10),0)||1}
function progress(){const done=state.flowMode==='sequential'?state.i:(state.answeredIndexes||[]).length;return Math.round((done/Math.max(1,state.set.length))*100)}
function elapsed(){return Math.floor((Date.now()-state.start)/1000)}
function startClock(){clearInterval(clockTimer);clockTimer=setInterval(()=>{const el=$('timeBox');if(el)el.textContent=M.seconds(elapsed())},1000)}
function header(){const p=currentPlayer();return`<div class="progress-wrap"><div class="progress-bar" style="width:${progress()}%"></div></div><div class="meta-row"><div class="meta"><span>السؤال</span><strong>${Math.min(state.i+1,state.set.length)} / ${state.set.length}</strong></div><div class="meta"><span>الدرجة</span><strong>${mode()==='competition'?(p?.score||0):state.score}</strong></div><div class="meta"><span>الوقت</span><strong id="timeBox">${M.seconds(elapsed())}</strong></div><div class="meta"><span>${mode()==='competition'?'الدور الحالي':labelStudent()}</span><strong>${M.esc(mode()==='competition'?(p?.name||'لاعب'):state.name)}</strong></div></div>`}
function startTimer(){clearInterval(timer);const t=Number(game.per_question_timer||0);if(!t)return;timeLeft=t;timer=setInterval(()=>{timeLeft--;const el=$('qTimer');if(el)el.textContent=timeLeft;if(timeLeft<=0){clearInterval(timer);submit(null,true)}},1000)}
function resetQuestionState(){state.answered=false;state.waitingRetry=false;state.selected=null;state.selectedMatch='';state.selectedConn='';state.matches={};state.matchAnswers=[];state.matchOptions=[];state.connAnswers=[];state.connOptions=[];state.classItems=[];state.classBuckets=[];state.selectedClass='';state.tries=0;state.currentOrder=[];state.dragText=null;clearInterval(timer)}
function attemptsFor(q){return Math.max(1,Number(q.attempts||game.default_attempts||1)||1)}

function remainingIndexes(){return state.set.map((_,idx)=>idx).filter(idx=>!(state.answeredIndexes||[]).includes(idx))}
function markCurrentAnswered(){if(!(state.answeredIndexes||[]).includes(state.i))state.answeredIndexes.push(state.i)}
function flowTitle(){return state.flowMode==='board'?'لوحة اختيار الأسئلة':(state.flowMode==='random'?'الاختيار العشوائي السينمائي':'الأسئلة بالترتيب')}
function renderQuestionBoard(){
  clearInterval(timer);
  if(!remainingIndexes().length)return end();
  $('gameApp').innerHTML=header()+`<section class="card question-board-card"><div class="board-head"><div><div class="kicker">🎯 ${flowTitle()}</div><h1>اختر رقم السؤال</h1><p class="muted">بعد الإجابة سيختفي السؤال من اللوحة وتعود لاختيار سؤال جديد.</p></div><button class="btn dark" onclick="toggleFull()">⛶ ملء الشاشة</button></div><div class="question-number-grid">${state.set.map((q,idx)=>{const done=(state.answeredIndexes||[]).includes(idx);const player=mode()==='competition'?state.players[q.playerIndex||0]?.name:'';return `<button class="question-number-card ${done?'done':''}" ${done?'disabled':''} onclick="selectBoardQuestion(${idx})"><b>${idx+1}</b><span>${M.esc(typeName(q.type))}</span>${player?`<small>دور: ${M.esc(player)}</small>`:''}</button>`}).join('')}</div></section>`;
}
window.selectBoardQuestion=function(idx){if((state.answeredIndexes||[]).includes(idx))return;state.i=idx;state.lastChosenIndex=idx;M.playTone('click');renderQuestion()}
function renderRandomPicker(){
  clearInterval(timer);
  const remain=remainingIndexes();
  if(!remain.length)return end();
  $('gameApp').innerHTML=header()+`<section class="card random-picker-card"><div class="random-glow"></div><div class="kicker">🎲 اختيار عشوائي سينمائي</div><h1>اضغط لاختيار السؤال التالي</h1><p class="muted">سيتم اختيار سؤال من الأسئلة المتبقية بشكل عشوائي وتفاعلي.</p><div class="random-orb" id="randomOrb">؟</div><div class="hero-pills"><span class="pill">المتبقي: ${remain.length}</span><span class="pill">المجاب: ${(state.answeredIndexes||[]).length}</span></div><div class="next-row"><button class="btn" onclick="chooseRandomQuestion()">اختيار سؤال عشوائي ✨</button><button class="btn dark" onclick="toggleFull()">⛶ ملء الشاشة</button></div></section>`;
}
window.chooseRandomQuestion=function(){
  const remain=remainingIndexes();if(!remain.length)return end();
  const orb=$('randomOrb');let n=0;const spin=setInterval(()=>{n++;if(orb)orb.textContent=remain[Math.floor(Math.random()*remain.length)]+1;M.playTone('hover');if(n>12){clearInterval(spin);const idx=remain[Math.floor(Math.random()*remain.length)];state.i=idx;state.lastChosenIndex=idx;if(orb)orb.textContent=idx+1;setTimeout(()=>renderQuestion(),450)}},75);
}
function renderQuestion(){resetQuestionState();const q=current();if(!q)return end();const timerHTML=Number(game.per_question_timer||0)?`<span class="pill">⏱️ <b id="qTimer">${game.per_question_timer}</b> ثانية</span>`:'';const p=currentPlayer();$('gameApp').innerHTML=header()+`<section class="card question-card"><div class="row" style="justify-content:space-between"><div><div class="type-badge">${typeName(q.type)}</div>${timerHTML}</div><span class="pill attempts-pill">المحاولات: <b id="tryBox">0</b> / ${attemptsFor(q)}</span></div>${p?`<div class="turn-banner">🎯 الدور الآن: ${M.esc(p.name)}</div>`:''}<div class="question-box">${M.esc((q.emoji||'')+' '+T(q.text))}${(q.image&&q.type!=='puzzle_image')?`<br><img class="question-img" src="${M.attr(q.image)}">`:''}</div><div id="answerArea">${renderAnswerArea(q)}</div><div id="feedbackBox"></div><div class="next-row"><button class="btn next-question" id="nextBtn" style="display:none" onclick="nextQuestion()">${state.flowMode==='board'?'العودة للوحة الأرقام ⬅':(state.flowMode==='random'?'اختيار سؤال آخر 🎲':'السؤال التالي ⬅')}</button><button class="btn dark" onclick="toggleFull()">⛶ ملء الشاشة</button></div></section>`;attachInteractions();startTimer()}
function renderAnswerArea(q){if(q.type==='multiple_choice'||q.type==='true_false'){let opts=(q.options||[]).map((o,i)=>({o,i}));if(game.shuffle_options!==false)opts=M.shuffle(opts);return`<div class="choice-grid">${opts.map((x,n)=>`<button class="answer" data-original="${x.i}" onclick="submit(${x.i})"><span class="letter">${['أ','ب','ج','د','هـ','و'][n]||n+1}</span><span class="option-text">${M.esc(T(x.o))}</span></button>`).join('')}</div>`}if(q.type==='open_text'||q.type==='short_answer'){const manual=q.manual_grade!==false;return`<div class="short-answer-box open-manual-play"><p class="helper-note">${manual?T('اكتب الإجابة، ثم يختار المعلم هل الإجابة صحيحة أم خاطئة وفق تقديره.'):T('اكتب الإجابة في المربع ثم اضغط تحقق.')}</p><textarea id="openAnswer" class="input" placeholder="${M.attr(T('اكتب الإجابة هنا...'))}"></textarea>${manual?`<div class="manual-grade-panel"><button class="btn manual-grade-btn" onclick="submit({__manualOpen:true,text:document.getElementById('openAnswer').value,good:true})">✅ الإجابة صحيحة</button><button class="btn bad manual-grade-btn" onclick="submit({__manualOpen:true,text:document.getElementById('openAnswer').value,good:false})">❌ الإجابة خاطئة</button></div>`:`<div class="next-row"><button class="btn" onclick="submit(document.getElementById('openAnswer').value)">تحقق من الإجابة</button></div>`}</div>`}if(q.type==='ordering'){state.currentOrder=M.shuffle(q.items||[]);return`<div class="order-instructions">${T('رتّب المستطيلات بسحبها إلى المكان الصحيح أو استخدم أزرار ↑ و ↓ بوضوح.')}</div><div class="order-area" id="orderArea">${state.currentOrder.map((it,i)=>orderItem(it,i)).join('')}</div><div class="next-row"><button class="btn" onclick="submit(getOrder())">تثبيت الترتيب</button></div>`}if(q.type==='matching')return renderMatching(q);if(q.type==='connecting')return renderConnecting(q);if(q.type==='classification')return renderClassification(q);if(q.type==='puzzle_image')return renderPuzzle(q);return''}
function orderItem(text,i){return`<div class="order-item" draggable="true" data-text="${M.attr(text)}"><div class="order-num">${i+1}</div><div class="order-text"><span class="order-handle">↕</span>${M.esc(T(text))}</div><div class="order-actions"><button class="mini-btn" onclick="moveOrder(this,-1)">↑</button><button class="mini-btn" onclick="moveOrder(this,1)">↓</button></div></div>`}
window.moveOrder=function(btn,d){const item=btn.closest('.order-item'),area=$('orderArea'),items=[...area.children],i=items.indexOf(item),j=i+d;if(j<0||j>=items.length)return;area.insertBefore(item,d<0?items[j]:items[j].nextSibling);renumberOrder();M.playTone('click')};function renumberOrder(){[...$('orderArea').children].forEach((x,i)=>x.querySelector('.order-num').textContent=i+1)}window.getOrder=function(){return[...$('orderArea').children].map(x=>x.dataset.text)}


function renderPuzzle(q){
  const n=Math.max(2,Math.min(5,Number(q.puzzle_grid||3)||3));
  const total=n*n;
  state.puzzleOrder=M.shuffle(Array.from({length:total},(_,i)=>i));
  if(state.puzzleOrder.every((v,i)=>v===i)&&total>1){[state.puzzleOrder[0],state.puzzleOrder[1]]=[state.puzzleOrder[1],state.puzzleOrder[0]]}
  state.selectedPuzzle=null;
  state.puzzleSolvedFx=false;
  setTimeout(()=>drawPuzzle(q),0);
  return`<div class="puzzle-area"><div class="puzzle-status" id="puzzleStatusText">${T('اسحب كل قطعة بالماوس أو اللمس إلى المكان المناسب. عند الإفلات ستثبت القطعة في مكانها الصحيح بتأثير بصري واضح، ولن تظهر الصورة الكاملة إلا بعد اكتمال التجميع.')}</div><div id="puzzleBoard" class="puzzle-board jigsaw-board" dir="ltr" style="--puzzleN:${n}"></div><div class="puzzle-tools"><button class="btn dark" onclick="shufflePuzzle()">خلط القطع</button><button class="btn" onclick="submit(getPuzzle())">تحقق من البازل</button></div></div>`
}
function puzzleStatusText(txt,done=false){const el=$('puzzleStatusText');if(el){el.textContent=txt;el.classList.toggle('done',!!done)}}
function buildPuzzleEdges(n){
  const key=`edges_${n}`;
  if(state[key]) return state[key];
  const edges=new Array(n*n);
  const sign=(r,c,k)=>((r*7+c*11+(k==='h'?3:5))%2===0?1:-1);
  for(let r=0;r<n;r++){
    for(let c=0;c<n;c++){
      const idx=r*n+c;
      const top=r===0?0:-edges[(r-1)*n+c].bottom;
      const left=c===0?0:-edges[idx-1].right;
      const right=c===n-1?0:sign(r,c,'h');
      const bottom=r===n-1?0:sign(r,c,'v');
      edges[idx]={top,right,bottom,left};
    }
  }
  state[key]=edges;
  return edges;
}
function piecePath(e){
  const tab=18;
  const s1=30,s2=70;
  let d='M 0 0 ';
  if(e.top===0){d+='L 100 0 ';}else{const y=e.top===1?-tab:tab;d+=`L ${s1} 0 C 38 0 38 ${y*.35} 44 ${y*.7} C 48 ${y} 52 ${y} 56 ${y*.7} C 62 ${y*.35} 62 0 ${s2} 0 L 100 0 `;}
  if(e.right===0){d+='L 100 100 ';}else{const x=e.right===1?100+tab:100-tab;const c=e.right===1?100+tab*1.1:100-tab*1.1;d+=`L 100 ${s1} C 100 38 ${x*.98} 38 ${x} 44 C ${c} 48 ${c} 52 ${x} 56 C ${x*.98} 62 100 62 100 ${s2} L 100 100 `;}
  if(e.bottom===0){d+='L 0 100 ';}else{const y=e.bottom===1?100+tab:100-tab;const c=e.bottom===1?100+tab*1.1:100-tab*1.1;d+=`L ${s2} 100 C 62 100 62 ${y*.98} 56 ${y} C 52 ${c} 48 ${c} 44 ${y} C 38 ${y*.98} 38 100 ${s1} 100 L 0 100 `;}
  if(e.left===0){d+='L 0 0 ';}else{const x=e.left===1?-tab:tab;const c=e.left===1?-tab*1.1:tab*1.1;d+=`L 0 ${s2} C 0 62 ${x*.98} 62 ${x} 56 C ${c} 52 ${c} 48 ${x} 44 C ${x*.98} 38 0 38 0 ${s1} L 0 0 `;}
  return d+'Z';
}
function renderPuzzleSvg(q,tile,pos,n){
  const r=Math.floor(tile/n),c=tile%n;
  const edges=buildPuzzleEdges(n)[tile]||{top:0,right:0,bottom:0,left:0};
  const path=piecePath(edges);
  const id=`pz_${state.i}_${pos}_${tile}_${n}`;
  const img=M.attr(q.image||'');
  return `<svg class="puzzle-svg" viewBox="-22 -22 144 144" aria-hidden="true"><defs><clipPath id="clip_${id}"><path d="${path}"></path></clipPath></defs><g clip-path="url(#clip_${id})"><image href="${img}" x="${-c*100}" y="${-r*100}" width="${n*100}" height="${n*100}" preserveAspectRatio="none"></image><rect x="-22" y="-22" width="144" height="144" fill="rgba(255,255,255,.06)"></rect></g><path class="piece-outline" d="${path}"></path></svg>`;
}
function onPuzzlePlacement(correctNow=false){if(game.enable_sound!==false){M.playTone(correctNow?'success':'click')}if(correctNow){puzzleStatusText(phrase('piecePlaced'),false)}}
function checkPuzzleSolvedFx(){if(state.puzzleSolvedFx)return;const solved=Array.isArray(state.puzzleOrder)&&state.puzzleOrder.every((tile,pos)=>Number(tile)===pos);if(!solved)return;state.puzzleSolvedFx=true;drawPuzzle();puzzleStatusText(game.puzzleCompleteText||phrase('puzzleDone'),true);if(game.enable_sound!==false){M.playTone('finish');speak('puzzle')}if(game.enable_fx!==false){M.burst('good',gamePhrase('correctMsg','correctMsg'))}}
function drawPuzzle(q=current()){
  const board=$('puzzleBoard');if(!board||!q)return;
  const n=Math.max(2,Math.min(5,Number(q.puzzle_grid||3)||3));
  const solved=Array.isArray(state.puzzleOrder)&&state.puzzleOrder.every((tile,pos)=>Number(tile)===pos);
  board.style.setProperty('--puzzleN',n);
  board.classList.toggle('solved',solved);
  const pieces=state.puzzleOrder.map((tile,pos)=>`<div class="puzzle-slot ${tile===pos?'correct-slot':''}" data-pos="${pos}"><button type="button" class="puzzle-piece jigsaw-piece ${state.selectedPuzzle===pos?'selected':''} ${tile===pos?'snapped':''}" data-pos="${pos}" data-tile="${tile}" aria-label="قطعة بازل ${pos+1}">${renderPuzzleSvg(q,tile,pos,n)}</button></div>`).join('');
  const overlay=solved?`<div class="puzzle-solved-overlay"><img src="${M.attr(q.image||'')}" alt="الصورة المكتملة"></div>`:'';
  board.innerHTML=overlay+pieces;
  attachPuzzleDrag();
}

function applyPuzzleSwap(a,b){
  const beforeA=state.puzzleOrder[a]===a,beforeB=state.puzzleOrder[b]===b;
  [state.puzzleOrder[a],state.puzzleOrder[b]]=[state.puzzleOrder[b],state.puzzleOrder[a]];
  const afterA=state.puzzleOrder[a]===a,afterB=state.puzzleOrder[b]===b;
  const gained=(afterA&&!beforeA)||(afterB&&!beforeB);
  state.selectedPuzzle=null;
  drawPuzzle();
  const target=document.querySelector(`.puzzle-slot[data-pos="${b}"]`)||document.querySelector(`.puzzle-slot[data-pos="${a}"]`);
  if(target){target.classList.add('snap-pop');setTimeout(()=>target.classList.remove('snap-pop'),420)}
  onPuzzlePlacement(gained);checkPuzzleSolvedFx();
}
function selectPuzzle(pos){if(state.answered)return;if(state.selectedPuzzle===null){state.selectedPuzzle=pos;drawPuzzle();return}if(state.selectedPuzzle===pos){state.selectedPuzzle=null;drawPuzzle();return}applyPuzzleSwap(state.selectedPuzzle,pos)}
function shufflePuzzle(){state.puzzleOrder=M.shuffle(state.puzzleOrder);state.selectedPuzzle=null;state.puzzleSolvedFx=false;puzzleStatusText(T('اسحب كل قطعة بالماوس أو اللمس إلى المكان المناسب. عند الإفلات ستثبت القطعة في مكانها الصحيح بتأثير بصري واضح، ولن تظهر الصورة الكاملة إلا بعد اكتمال التجميع.'),false);drawPuzzle();if(game.enable_sound!==false)M.playTone('click')}
function getPuzzle(){return state.puzzleOrder.slice()}
function clearPuzzleTargets(){M.qsa('.puzzle-slot.drag-target').forEach(el=>el.classList.remove('drag-target'))}
function slotFromPoint(x,y){const el=document.elementFromPoint(x,y);return el?el.closest('.puzzle-slot'):null}
function attachPuzzleDrag(){
  M.qsa('.puzzle-piece').forEach(piece=>{
    piece.onpointerdown=e=>{
      if(state.answered)return;
      if(e.button!==undefined&&e.button!==0)return;
      e.preventDefault();
      const from=Number(piece.dataset.pos);
      const rect=piece.getBoundingClientRect();
      const ghost=piece.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.width=`${rect.width}px`;
      ghost.style.height=`${rect.height}px`;
      ghost.style.left=`${e.clientX}px`;
      ghost.style.top=`${e.clientY}px`;
      document.body.appendChild(ghost);
      piece.classList.add('dragging-source');
      const drag={from,piece,ghost,startX:e.clientX,startY:e.clientY,moved:false};
      const move=ev=>{
        ghost.style.left=`${ev.clientX}px`;
        ghost.style.top=`${ev.clientY}px`;
        if(Math.abs(ev.clientX-drag.startX)>6||Math.abs(ev.clientY-drag.startY)>6)drag.moved=true;
        clearPuzzleTargets();
        const slot=slotFromPoint(ev.clientX,ev.clientY);
        if(slot)slot.classList.add('drag-target');
      };
      const end=ev=>{
        window.removeEventListener('pointermove',move);
        window.removeEventListener('pointerup',end);
        window.removeEventListener('pointercancel',end);
        clearPuzzleTargets();
        piece.classList.remove('dragging-source');
        ghost.remove();
        if(!drag.moved){selectPuzzle(from);return;}
        const slot=slotFromPoint(ev.clientX,ev.clientY);
        if(slot){
          const to=Number(slot.dataset.pos);
          if(Number.isFinite(to)&&to!==from){applyPuzzleSwap(from,to);return;}
        }
        if(game.enable_sound!==false)M.playTone('click');
      };
      window.addEventListener('pointermove',move,{passive:true});
      window.addEventListener('pointerup',end,{once:true});
      window.addEventListener('pointercancel',end,{once:true});
    };
  });
}

function classItemKey(it){return String(it?.id||it?.key||it?.text||it?.image||'')}
function renderClassItem(it){
  const kind=(it?.kind==='image'||(!it?.text&&!!it?.image))?'image':'text';
  const img=String(it?.image||'').trim();
  const txt=String(it?.text||'').trim();
  if(kind==='image'&&img)return `<span class="class-media"><img src="${M.attr(img)}" alt="${M.attr(txt||'عنصر تصنيف')}"></span>`;
  return `<span>${M.esc(T(txt))}</span>`;
}
function ensureClassState(q){
  const cats=Array.isArray(q.categories)?q.categories:[];
  const all=[];
  cats.forEach((c,ci)=>(c.items||[]).forEach((it,ii)=>all.push({id:`${ci}:${ii}`,cat:ci,kind:it.kind||((!it.text&&it.image)?'image':'text'),text:it.text||'',image:it.image||''})));
  if(!Array.isArray(state.classItems)||state.classItems.length!==all.length)state.classItems=M.shuffle(all);
  if(!Array.isArray(state.classBuckets)||state.classBuckets.length!==cats.length)state.classBuckets=cats.map(()=>[]);
}
function renderClassification(q){
  ensureClassState(q);
  const cats=q.categories||[];
  const placed=new Set((state.classBuckets||[]).flat());
  const pool=(state.classItems||[]).filter(it=>!placed.has(it.id));
  const count=Math.max(2,Math.min(4,Number(q.column_count||cats.length)||cats.length||2));
  return `<div class="classification-game" style="--classCols:${count}">
    <p class="helper-note class-help-pill">اسحب العناصر النصية أو المصورة من أعلى الجدول وضع كل عنصر في العمود المناسب. يمكنك أيضًا الضغط على العنصر ثم الضغط داخل العمود.</p>
    <div class="class-pool">${pool.length?pool.map(it=>`<div class="class-item-card class-card ${state.selectedClass===it.id?'selected':''}" draggable="${!state.answered}" data-id="${M.attr(it.id)}">${renderClassItem(it)}</div>`).join(''):`<div class="match-empty">تم وضع كل العناصر في الجدول</div>`}</div>
    <div class="class-table polished-class-table">${cats.map((c,ci)=>{const ids=state.classBuckets[ci]||[];const colOk=state.answered&&ids.length&&ids.every(id=>String(id).split(':')[0]===String(ci));const colWrong=state.answered&&ids.some(id=>String(id).split(':')[0]!==String(ci));const cls=state.answered?(colWrong?'wrong':(colOk?'correct':'')):'';return `<div class="class-drop ${cls}" data-col="${ci}"><div class="class-drop-head"><h3>${M.esc(T(c.title))}</h3></div><div class="class-drop-zone">${ids.length?ids.map(id=>{const it=(state.classItems||[]).find(x=>x.id===id)||{};const itemOk=String(id).split(':')[0]===String(ci);return `<div class="class-placed-card ${state.answered?(itemOk?'correct':'wrong'):''}" data-id="${M.attr(id)}">${renderClassItem(it)}${!state.answered?`<button class="match-remove" onclick="removeClassItemFromBucket('${M.attr(id)}');event.stopPropagation()">×</button>`:''}</div>`}).join(''):`<span class="class-drop-placeholder">${phrase('dropHere')}</span>`}</div></div>`}).join('')}</div>
    <div class="next-row"><button class="btn" onclick="submit(getClassification())">تثبيت التصنيف</button></div>
  </div>`;
}
window.selectClassItem=function(id){state.selectedClass=id;M.qsa('.class-item-card').forEach(x=>x.classList.toggle('selected',x.dataset.id===id));M.playTone('click')};
window.placeClassItem=function(col){if(!state.selectedClass)return;state.classBuckets=(state.classBuckets||[]).map(arr=>arr.filter(id=>id!==state.selectedClass));state.classBuckets[col]=state.classBuckets[col]||[];state.classBuckets[col].push(state.selectedClass);state.selectedClass='';const q=current();$('answerArea').innerHTML=renderAnswerArea(q);attachInteractions();M.playTone('click')};
window.removeClassItemFromBucket=function(id){state.classBuckets=(state.classBuckets||[]).map(arr=>arr.filter(x=>x!==id));const q=current();$('answerArea').innerHTML=renderAnswerArea(q);attachInteractions();M.playTone('click')};
window.getClassification=function(){const out={};(state.classBuckets||[]).forEach((arr,i)=>out[i]=arr.slice());return out}
function classificationScore(q,v){
  const cats=q.categories||[];
  const total=cats.reduce((a,c)=>a+(c.items||[]).length,0);
  const placed=Object.values(v||{}).flat();
  let correctPlaced=0,wrongPlaced=0;
  Object.entries(v||{}).forEach(([ci,ids])=>(ids||[]).forEach(id=>{if(String(id).split(':')[0]===String(ci))correctPlaced++;else wrongPlaced++}));
  const net=Math.max(0,correctPlaced-wrongPlaced);
  const full=Number(q.points||10);
  const earned=total?Math.round((full*net/total)*10)/10:0;
  const good=placed.length===total&&wrongPlaced===0&&correctPlaced===total;
  const summary=`تم احتساب ${earned} من ${full} درجة. الصحيح: ${correctPlaced}، الخطأ: ${wrongPlaced}، غير موزع: ${Math.max(0,total-placed.length)}`;
  return {good,earned,correctPlaced,wrongPlaced,total,summary};
}

function ensureMatchState(q){
  state.matchAnswers=Array.isArray(state.matchAnswers)&&state.matchAnswers.length===(q.pairs||[]).length?state.matchAnswers:Array((q.pairs||[]).length).fill('');
  state.matchOptions=Array.isArray(state.matchOptions)&&state.matchOptions.length?state.matchOptions:M.shuffle((q.pairs||[]).map(p=>p.right));
  state.selectedMatch=state.selectedMatch||'';
}
function renderMatching(q){
  ensureMatchState(q);
  const used=state.matchAnswers||[];
  const remaining=(state.matchOptions||[]).filter(r=>!used.includes(r));
  return `<div class="answer-area"><p class="helper-note">${phrase('matchingHelp')}</p>
  <div class="match-game" id="matchingBoard">
    <div class="match-column"><h3>🧩 العبارات</h3>
      ${(q.pairs||[]).map((p,i)=>{const ans=used[i]||'';const stateCls=state.answered?(ans===p.right?'correct':'wrong'):(ans?'filled':'');return `<div class="match-row" id="matchRow${i}"><div class="match-left">${M.esc(T(p.left))}</div><div class="match-arrow">⇐</div><div class="match-drop ${stateCls}" data-index="${i}" data-left="${M.attr(p.left)}">${ans?`<span>${M.esc(T(ans))}</span>${!state.answered?`<button class="match-remove" onclick="removeMatch(${i});event.stopPropagation()">×</button>`:''}`:phrase('dropHere')}</div></div>`}).join('')}
    </div>
    <div class="match-column"><h3>📌 الإجابات المتحركة</h3><div id="matchPool">
      ${remaining.length?remaining.map(r=>`<div class="match-answer-card ${state.selectedMatch===r?'selected':''}" draggable="${!state.answered}" data-value="${M.attr(r)}">${M.esc(T(r))}</div>`).join(''):`<div class="match-empty">تم وضع كل الإجابات</div>`}
    </div></div>
  </div><div class="next-row"><button class="btn" onclick="submit(getMatches())">تثبيت المطابقة</button></div></div>`;
}
window.selectMatchCard=function(v){state.selectedMatch=v;state.selected=v;M.qsa('.match-answer-card').forEach(x=>x.classList.toggle('selected',x.dataset.value===v));M.playTone('click')};
window.placeSelectedMatch=function(i){if(!state.selectedMatch)return;state.matchAnswers[i]=state.selectedMatch;state.matches={};const q=current();(q.pairs||[]).forEach((p,idx)=>{if(state.matchAnswers[idx])state.matches[p.left]=state.matchAnswers[idx]});state.selectedMatch='';$('answerArea').innerHTML=renderAnswerArea(q);attachInteractions();M.playTone('click')};
window.removeMatch=function(i){const q=current();state.matchAnswers[i]='';state.matches={};(q.pairs||[]).forEach((p,idx)=>{if(state.matchAnswers[idx])state.matches[p.left]=state.matchAnswers[idx]});$('answerArea').innerHTML=renderAnswerArea(q);attachInteractions();M.playTone('click')};
window.getMatches=function(){const q=current();state.matches={};(q.pairs||[]).forEach((p,idx)=>{if(state.matchAnswers&&state.matchAnswers[idx])state.matches[p.left]=state.matchAnswers[idx]});return state.matches};

function ensureConnState(q){
  state.connAnswers=Array.isArray(state.connAnswers)&&state.connAnswers.length===(q.pairs||[]).length?state.connAnswers:Array((q.pairs||[]).length).fill('');
  state.connOptions=Array.isArray(state.connOptions)&&state.connOptions.length?state.connOptions:M.shuffle((q.pairs||[]).map(p=>p.right));
  state.selectedConn=state.selectedConn||'';
}
function renderConnecting(q){
  ensureConnState(q);
  const used=state.connAnswers||[];
  const options=state.connOptions||[];
  return `<div class="connection-board fixed-connection-board" id="connectionBoard">
    <svg class="conn-lines" id="connLines" aria-hidden="true"><defs><marker id="arrowHead" markerWidth="14" markerHeight="14" refX="11" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,10 L12,5 z" fill="#facc15"></path></marker></defs></svg>
    <div class="connection-note">${phrase('connectingHelp')}</div>
    <div class="connection-columns">
      <div class="connection-stack conn-questions-stack"><div class="connection-title">🧩 الأسئلة</div>${(q.pairs||[]).map((p,i)=>{const ans=used[i]||'';const stateCls=state.answered?(ans===p.right?'correct':'wrong'):(ans?'connected':'');return `<div class="conn-card conn-question ${stateCls}" data-index="${i}" data-left="${M.attr(p.left)}"><span class="conn-badge">${i+1}</span><span class="conn-main-text">${M.esc(T(p.left))}</span><span class="conn-slot">${ans?phrase('connectedTo')+M.esc(T(ans)):phrase('clickAfterAnswer')}</span></div>`}).join('')}</div>
      <div class="connection-stack conn-answers-stack"><div class="connection-title">📌 الإجابات</div>${options.length?options.map(r=>{const linked=used.includes(r);return `<div class="conn-card conn-answer ${state.selectedConn===r?'selected':''} ${linked?'linked':''}" draggable="${!state.answered}" data-value="${M.attr(r)}">${M.esc(T(r))}</div>`}).join(''):`<div class="match-empty">لا توجد إجابات</div>`}</div>
    </div>
    <div class="next-row"><button class="btn" onclick="submit(getConnections())">تثبيت التوصيل</button></div>
  </div>`;
}
window.selectConnCard=function(v){state.selectedConn=v;state.selected=v;M.qsa('.conn-answer').forEach(x=>x.classList.toggle('selected',x.dataset.value===v));M.playTone('click')};
window.placeSelectedConn=function(i){if(!state.selectedConn)return;const chosen=state.selectedConn;state.connAnswers=(state.connAnswers||[]).map(v=>v===chosen?'':v);state.connAnswers[i]=chosen;state.matches={};const q=current();(q.pairs||[]).forEach((p,idx)=>{if(state.connAnswers[idx])state.matches[p.left]=state.connAnswers[idx]});state.selectedConn='';$('answerArea').innerHTML=renderAnswerArea(q);attachInteractions();setTimeout(drawConnectionLines,40);M.playTone('click')};
window.getConnections=function(){const q=current();state.matches={};(q.pairs||[]).forEach((p,idx)=>{if(state.connAnswers&&state.connAnswers[idx])state.matches[p.left]=state.connAnswers[idx]});return state.matches};
function drawConnectionLines(){try{const board=document.getElementById('connectionBoard'),svg=document.getElementById('connLines');if(!board||!svg)return;svg.querySelectorAll('path.conn-path,circle.conn-dot').forEach(p=>p.remove());const rect=board.getBoundingClientRect();svg.setAttribute('width',Math.max(1,Math.round(rect.width)));svg.setAttribute('height',Math.max(1,Math.round(rect.height)));svg.setAttribute('viewBox',`0 0 ${Math.max(1,Math.round(rect.width))} ${Math.max(1,Math.round(rect.height))}`);(state.connAnswers||[]).forEach((ans,i)=>{if(!ans)return;const qEl=board.querySelector(`.conn-question[data-index="${i}"]`);const aEl=[...board.querySelectorAll('.conn-answer')].find(x=>x.dataset.value===ans)||null;if(!qEl||!aEl)return;const qRect=qEl.getBoundingClientRect();const aRect=aEl.getBoundingClientRect();const qCenter=qRect.left+qRect.width/2;const aCenter=aRect.left+aRect.width/2;const x1=(qCenter<aCenter?qRect.right:qRect.left)-rect.left;const y1=qRect.top+qRect.height/2-rect.top;const x2=(qCenter<aCenter?aRect.left:aRect.right)-rect.left;const y2=aRect.top+aRect.height/2-rect.top;const dx=Math.max(90,Math.abs(x2-x1)*0.50);const c1=qCenter<aCenter?x1+dx:x1-dx;const c2=qCenter<aCenter?x2-dx:x2+dx;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.classList.add('conn-path');path.setAttribute('d',`M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`);path.setAttribute('marker-end','url(#arrowHead)');const correct=(current().pairs||[])[i]?.right===ans;if(state.answered)path.classList.add(correct?'correct':'wrong');svg.appendChild(path);[ [x1,y1], [x2,y2] ].forEach(([cx,cy])=>{const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.classList.add('conn-dot');if(state.answered)dot.classList.add(correct?'correct':'wrong');dot.setAttribute('cx',cx);dot.setAttribute('cy',cy);dot.setAttribute('r','5');svg.appendChild(dot)})})}catch(e){console.warn(e)}}
window.addEventListener('resize',()=>{try{drawConnectionLines()}catch(e){}});
function attachInteractions(){
  M.qsa('.class-item-card').forEach(el=>{el.addEventListener('click',()=>selectClassItem(el.dataset.id));el.addEventListener('dragstart',e=>{state.selectedClass=el.dataset.id;el.classList.add('dragging');M.playTone('click')});el.addEventListener('dragend',()=>el.classList.remove('dragging'))});
  M.qsa('.class-drop').forEach(el=>{el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over')});el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');placeClassItem(Number(el.dataset.col))});el.addEventListener('click',()=>placeClassItem(Number(el.dataset.col)))});
  M.qsa('.match-answer-card').forEach(el=>{el.addEventListener('click',()=>selectMatchCard(el.dataset.value));el.addEventListener('dragstart',e=>{state.selectedMatch=el.dataset.value;el.classList.add('dragging');M.playTone('click')});el.addEventListener('dragend',()=>el.classList.remove('dragging'))});
  M.qsa('.match-drop').forEach(el=>{el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over')});el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');placeSelectedMatch(Number(el.dataset.index))});el.addEventListener('click',()=>placeSelectedMatch(Number(el.dataset.index)))});
  M.qsa('.conn-answer').forEach(el=>{el.addEventListener('click',()=>selectConnCard(el.dataset.value));el.addEventListener('dragstart',e=>{state.selectedConn=el.dataset.value;el.classList.add('dragging');M.playTone('click')});el.addEventListener('dragend',()=>el.classList.remove('dragging'))});
  M.qsa('.conn-question').forEach(el=>{el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over')});el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');placeSelectedConn(Number(el.dataset.index))});el.addEventListener('click',()=>placeSelectedConn(Number(el.dataset.index)))});
  setTimeout(drawConnectionLines,30);
  let dragged=null;M.qsa('.order-item').forEach(el=>{el.addEventListener('dragstart',()=>{dragged=el;el.classList.add('dragging')});el.addEventListener('dragend',()=>{el.classList.remove('dragging');dragged=null});el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over')});el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');if(!dragged||dragged===el)return;const area=$('orderArea');const items=[...area.children];const from=items.indexOf(dragged),to=items.indexOf(el);area.insertBefore(dragged,from<to?el.nextSibling:el);renumberOrder();M.playTone('click')})})
}
function check(q,v){if(q.type==='multiple_choice'||q.type==='true_false')return Number(v)===Number(q.correct);if((q.type==='open_text'||q.type==='short_answer')&&v&&v.__manualOpen)return !!v.good;if(q.type==='open_text'||q.type==='short_answer')return(q.answers||q.accepted||[]).some(a=>M.norm(a)===M.norm(v));if(q.type==='ordering')return JSON.stringify(v||[])===JSON.stringify(q.items||[]);if(q.type==='puzzle_image')return Array.isArray(v)&&v.every((tile,pos)=>Number(tile)===pos);if(q.type==='classification')return classificationScore(q,v).good;if(q.type==='matching'||q.type==='connecting'){let map={};(q.pairs||[]).forEach(p=>map[p.left]=p.right);return Object.keys(map).length&&Object.entries(map).every(([l,r])=>v[l]===r)}return false}
function disableAll(){M.qsa('.answer,.match-answer-card,.match-drop,.conn-card,.class-item-card,.class-drop,.mini-btn,.manual-grade-btn').forEach(b=>{b.style.pointerEvents='none';if('disabled'in b)b.disabled=true})}
function markVisual(q,v,good,finalMark=true){if(q.type==='multiple_choice'||q.type==='true_false'){M.qsa('.answer').forEach(b=>{const idx=Number(b.dataset.original);if(finalMark)b.disabled=true;if(finalMark&&idx===Number(q.correct))b.classList.add('correct');else if(idx===Number(v))b.classList.add('wrong')})}if(finalMark&&q.type==='matching'){M.qsa('.match-drop').forEach(d=>{const pair=(q.pairs||[]).find(p=>p.left===d.dataset.left);d.classList.add(pair&&state.matches[d.dataset.left]===pair.right?'correct':'wrong')})}if(finalMark&&q.type==='connecting'){M.qsa('.conn-question').forEach(d=>{const pair=(q.pairs||[]).find(p=>p.left===d.dataset.left);d.classList.add(pair&&state.matches[d.dataset.left]===pair.right?'correct':'wrong')});drawConnectionLines()}if(finalMark&&q.type==='ordering')$('orderArea')?.classList.add(good?'correct':'wrong');if(finalMark&&q.type==='classification'){M.qsa('.class-placed-card').forEach(card=>{const id=card.dataset.id||'',col=card.closest('.class-drop')?.dataset.col||'';card.classList.add(String(id).split(':')[0]===String(col)?'correct':'wrong')});M.qsa('.class-drop').forEach(d=>{const ci=Number(d.dataset.col);const ids=(state.classBuckets||[])[ci]||[];const wrong=ids.some(id=>String(id).split(':')[0]!==String(ci));const ok=ids.length&&ids.every(id=>String(id).split(':')[0]===String(ci));d.classList.add(wrong?'wrong':(ok?'correct':'wrong'))})};if(finalMark&&q.type==='puzzle_image')M.qsa('.puzzle-piece').forEach((el,pos)=>{el.classList.add(state.puzzleOrder[pos]===pos?'correct':'wrong')})}
function correctSummary(q){
  if(q.type==='multiple_choice'||q.type==='true_false')return T((q.options||[])[q.correct]||'');
  if(q.type==='open_text'||q.type==='short_answer')return q.manual_grade!==false?T('التصحيح تقديري حسب حكم المعلم'):(q.answers||q.accepted||[]).map(T).join(' / ');
  if(q.type==='ordering')return (q.items||[]).map(T).join(' ← ');
  if(q.type==='puzzle_image')return T('تركيب الصورة بشكل صحيح');
  if(q.type==='classification')return(q.categories||[]).map(c=>T(c.title)+': '+(c.items||[]).map(it=>it.kind==='image'&&it.image?'[صورة]':T(it.text||'')).join('، ')).join(' | ');
  return(q.pairs||[]).map(p=>T(p.left)+' ⇐ '+T(p.right)).join(' | ')
}
function answerToText(q,v){
  try{
    if(q.type==='multiple_choice'||q.type==='true_false')return T((q.options||[])[Number(v)]||String(v??''));
    if(q.type==='ordering')return Array.isArray(v)?v.map(T).join(' ← '):T(String(v??''));
    if(q.type==='puzzle_image')return Array.isArray(v)?T('ترتيب القطع: ')+v.map(x=>Number(x)+1).join('، '):T(String(v??''));
    if(q.type==='classification')return Object.entries(v||{}).map(([ci,ids])=>T((q.categories||[])[Number(ci)]?.title||ci)+': '+(ids||[]).map(id=>{const [c,i]=String(id).split(':').map(Number);const it=(q.categories?.[c]?.items||[])[i]||{};return it.kind==='image'&&it.image?'[صورة]':T(it.text||id)}).join('، ')).join(' | ');
    if(q.type==='matching'||q.type==='connecting')return Object.entries(v||{}).map(([a,b])=>T(a)+' ⇐ '+T(b)).join(' | ');
    if(v&&v.__manualOpen)return T(String(v.text||''))+' — '+(v.good?T('اعتمدها المعلم صحيحة'):T('اعتمدها المعلم خاطئة'));
    return T(String(v??''));
  }catch(e){return T(String(v??''))}
}
window.retryCurrentQuestion=function(){
  if(!state.waitingRetry||state.answered)return;
  const q=current();
  state.waitingRetry=false;
  state.selected=null;state.selectedMatch='';state.selectedConn='';state.matches={};
  state.matchAnswers=[];state.matchOptions=[];state.connAnswers=[];state.connOptions=[];state.classItems=[];state.classBuckets=[];state.selectedClass='';state.currentOrder=[];state.dragText=null;
  const fb=$('feedbackBox');if(fb)fb.innerHTML='';
  const area=$('answerArea');if(area)area.innerHTML=renderAnswerArea(q);
  const tryBox=$('tryBox');if(tryBox)tryBox.textContent=state.tries;
  attachInteractions();startTimer();M.playTone('click');
};
window.submit=function(v,timeout=false){if(state.answered||state.waitingRetry)return;const q=current();state.tries++;const tryBox=$('tryBox');if(tryBox)tryBox.textContent=state.tries;const classCalc=q.type==='classification'?classificationScore(q,v):null;const good=!timeout&&(classCalc?classCalc.good:check(q,v));const max=attemptsFor(q);const isManualOpen=v&&v.__manualOpen;const canRetry=!good&&!classCalc&&!isManualOpen&&!timeout&&game.allow_retry!==false&&game.show_retry_button!==false&&state.tries<max;if(canRetry){clearInterval(timer);state.waitingRetry=true;M.playTone('fail');markVisual(q,v,false,false);disableAll();$('feedbackBox').innerHTML=`<div class="feedback bad">${phrase('tryAgain')}. المتبقي: ${max-state.tries}<div class="retry-zone"><button class="btn retry-button" onclick="retryCurrentQuestion()">إعادة المحاولة</button></div></div>`;return}state.answered=true;clearInterval(timer);const earned=classCalc?classCalc.earned:(good?Number(q.points||10):0);state.answerLog.push({question_id:q.id||'',question_text:T(q.text||''),type:q.type||'',student_answer:answerToText(q,v),correct_answer:correctSummary(q),is_correct:!!good,tries:state.tries,player:mode()==='competition'?(currentPlayer()?.name||''):(state.name||''),points:earned,created_at:new Date().toISOString()});if(good||classCalc){state.score+=earned;if(good)state.correct++;const p=currentPlayer();if(p){p.score+=earned;if(good)p.correct++}if(game.enable_sound!==false){if(good&&q.type==='puzzle_image'){M.playTone('finish');speak('puzzle')}else{M.playTone(earned>0?'success':'fail');speak(earned>0?'good':'bad')}}if(good&&game.enable_fx!==false)M.burst('good',gamePhrase('correctMsg','correctMsg'))}else{if(game.enable_sound!==false){M.playTone('fail');speak('bad')}}markVisual(q,v,good,true);disableAll();const fb=$('feedbackBox');const showAnswer=(!good&&!classCalc&&!(v&&v.__manualOpen)&&(game.show_answer!==false||game.answer_after_attempts!==false));const classMsg=classCalc?`<br><small>${M.esc(classCalc.summary)}</small>`:'';fb.innerHTML=`<div class="feedback ${good?'ok':(classCalc&&earned>0?'ok':'bad')}">${good?(q.type==='puzzle_image'?(game.puzzleCompleteText||phrase('puzzleDone')):gamePhrase('correctMsg','correctMsg')):(classCalc?'تم تثبيت التصنيف مع احتساب الدرجة الجزئية':(timeout?'انتهى الوقت':gamePhrase('wrongMsg','wrongMsg')))}${classMsg}${showAnswer?'<br><small>الإجابة الصحيحة: '+M.esc(correctSummary(q))+'</small>':''}${q.explanation?'<br><small>'+M.esc(T(q.explanation))+'</small>':''}${good&&q.type==='puzzle_image'?'<div class="puzzle-complete"><div class="puzzle-complete-label">الصورة بعد اكتمال التجميع</div><img src="'+M.attr(q.image||'')+'" class="puzzle-complete-image"></div>':''}</div>`;$('nextBtn').style.display='inline-flex'}
window.nextQuestion=function(){if(state.flowMode==='board'){markCurrentAnswered();return renderQuestionBoard()}if(state.flowMode==='random'){markCurrentAnswered();return renderRandomPicker()}state.i++;renderQuestion()}
function saveAttempt(pct,spent){try{let s=M.store();const attempt={id:M.uuid(),game_id:game.id,student_name:mode()==='competition'?state.players.map(p=>p.name).join(' / '):state.name,score:pct,total:100,correct_count:state.correct,total_questions:state.set.length,time_spent:spent,mode:mode(),players:state.players,answers:state.answerLog,created_at:new Date().toISOString()};s.attempts.push(attempt);M.saveStore(s);M.cloudInsertAttempt?.(attempt).catch(e=>console.warn('cloud attempt failed',e))}catch(e){console.warn(e)}}
function stars(pct){return '⭐'.repeat(Math.max(1,Math.min(5,Math.round(pct/20))))}
function end(){state.done=true;clearInterval(timer);clearInterval(clockTimer);const pct=Math.round(state.score/totalPoints()*100),spent=elapsed();saveAttempt(pct,spent);if(game.enable_sound!==false)M.playTone('finish');if(game.enable_fx!==false)M.burst('good',gamePhrase('correctMsg','correctMsg'));if(mode()==='competition'){const rows=state.players.map(p=>`<div class="rank-row"><span class="rank-number">🏅</span><span class="rank-name">${M.esc(p.name)}</span><span>${p.correct} إجابات</span><span>${p.score} نقطة</span><span>${stars(Math.round(p.score/Math.max(1,totalPoints()/2)*100))}</span></div>`).join('');$('gameApp').innerHTML=`<section class="card final-card"><h1>انتهت المنافسة 🎉</h1><div class="leaderboard">${rows}</div><p class="muted">الوقت: ${M.seconds(spent)}</p><div class="next-row"><button class="btn" onclick="location.reload()">إعادة اللعب</button><button class="btn dark" onclick="print()">طباعة النتيجة</button><a class="btn ghost" href="../index.html">العودة للرئيسية</a></div></section>`;return} $('gameApp').innerHTML=`<section class="card final-card"><h1>${pct>=Number(game.passing_score||70)?gamePhrase('finalExcellent','finish'):gamePhrase('finalTry','tryAgain')} يا ${M.esc(state.name)}!</h1><div class="score-big">${pct}%</div><div class="stars">${stars(pct)}</div><p class="muted">الإجابات الصحيحة: ${state.correct} / ${state.set.length} · الوقت: ${M.seconds(spent)}</p><div class="certificate" id="cert"><img src="${M.relAsset(s.platform.markImage||s.platform.logoImage)}"><h2>شهادة إنجاز</h2><p>تمنح هذه الشهادة إلى</p><div class="name">${M.esc(state.name)}</div><p>${phrase('completeVerb')} ${M.esc(game.title)} بدرجة ${pct}%</p></div><div class="next-row"><button class="btn" onclick="location.reload()">إعادة اللعب</button><button class="btn dark" onclick="print()">طباعة الشهادة</button><a class="btn ghost" href="../index.html">العودة للرئيسية</a></div></section>`}

function rosterOptions(){const list=Array.isArray(game.students)?game.students.filter(Boolean):[];return list.map(n=>`<option value="${M.attr(n)}">${M.esc(n)}</option>`).join('')}
function renderStudentInputs(comp){const opts=rosterOptions();if(comp){return opts?`<div class="field-grid"><label><select id="studentSelect1" class="input"><option value="">${phrase('first')}</option>${opts}</select></label><label><select id="studentSelect2" class="input"><option value="">${phrase('second')}</option>${opts}</select></label></div><div class="field-grid"><input id="studentName1" class="input" placeholder="${phrase('first')} يدويًا"><input id="studentName2" class="input" placeholder="${phrase('second')} يدويًا"></div>`:`<div class="field-grid"><input id="studentName1" class="input" placeholder="${phrase('first')}"><input id="studentName2" class="input" placeholder="${phrase('second')}"></div>`}return opts?`<select id="studentSelect" class="input"><option value="">اختيار ${labelStudent()} من القائمة</option>${opts}</select><input id="studentName" class="input" placeholder="أو ${phrase('placeholder')} يدويًا" style="margin-top:10px">`:`<input id="studentName" class="input" placeholder="${phrase('placeholder')}">`}

function renderStart(){refresh();if(!game){$('gameApp').innerHTML='<section class="card"><h2>لا توجد لعبة متاحة</h2></section>';return}if(!state.playMode)state.playMode=game.mode||'individual';const p=s.platform||{};const comp=mode()==='competition';const total=(game.questions||[]).length||1;const indDefault=Math.min(total,gnum(game.individual_question_count,game.individualQuestionCount,game.question_count,total)||total);const compDefault=Math.min(total,gnum(game.competition_question_count,game.competitionQuestionCount,5)||Math.min(5,total));const flow=state.flowMode||'sequential';const modeChooser=`<div class="play-mode-chooser"><button class="mode-card ${!comp?'active':''}" onclick="choosePlayMode('individual')"><b>👤 فردي</b><span>${M.esc(phrase('individualDesc'))}</span></button><button class="mode-card ${comp?'active':''}" onclick="choosePlayMode('competition')"><b>⚔️ منافسة</b><span>${M.esc(phrase('competitionDesc'))}</span></button></div>`;const playControls=`<div class="play-start-controls"><div class="field-grid"><label>عدد أسئلة الفردي<input id="playIndividualCount" class="input" type="number" min="1" max="${total}" value="${indDefault}"></label><label>عدد جولات المنافسة لكل لاعب<input id="playCompetitionCount" class="input" type="number" min="1" max="${total}" value="${compDefault}"></label></div><div class="play-flow-cards"><label class="flow-card"><input type="radio" name="playFlowMode" value="sequential" ${flow==='sequential'?'checked':''} onchange="setPlayFlowMode(this.value)"><b>📋 ترتيب عادي</b><span>تظهر الأسئلة واحدًا بعد الآخر.</span></label><label class="flow-card"><input type="radio" name="playFlowMode" value="board" ${flow==='board'?'checked':''} onchange="setPlayFlowMode(this.value)"><b>🔢 لوحة أرقام</b><span>يختار الطالب رقم السؤال ثم يعود للوحة.</span></label><label class="flow-card"><input type="radio" name="playFlowMode" value="random" ${flow==='random'?'checked':''} onchange="setPlayFlowMode(this.value)"><b>🎲 اختيار عشوائي</b><span>اختيار سينمائي تفاعلي من الأسئلة المتبقية.</span></label></div></div>`;$('gameApp').innerHTML=`<section class="hero"><div class="card"><div class="kicker">🎮 ${M.esc(game.subject||'لعبة تعليمية')}</div><h1>${M.esc(game.title)}</h1><p class="muted">${M.esc(T(game.description||'استعد لتجربة تعليمية ممتعة.'))}</p><div class="hero-pills"><span class="pill">${comp?phrase('competitionPill'):phrase('individualPill')}</span><span class="pill">${(game.questions||[]).length} سؤال</span><span class="pill">${game.per_question_timer?game.per_question_timer+' ثانية لكل سؤال':'بدون مؤقت سؤال'}</span></div>${game.coverImage?`<img class="hero-cover" src="${M.attr(game.coverImage)}" alt="صورة اللعبة">`:''}${modeChooser}${playControls}${renderStudentInputs(comp)}<div class="next-row"><button class="btn" onclick="startGame()">${M.esc(T(game.startButton||phrase('startButton')))} ⭐</button><button class="btn dark" onclick="toggleFull()">⛶ ملء الشاشة</button></div></div><div class="logo-card"><img src="${M.relAsset(p.logoImage)}"></div></section>`}
window.selectPuzzle=selectPuzzle;window.shufflePuzzle=shufflePuzzle;window.getPuzzle=getPuzzle;
document.addEventListener('DOMContentLoaded',async()=>{await M.cloudSyncTables?.();renderStart()});document.addEventListener('manarat:store-updated',()=>{refresh();if(!state.started)renderStart()});
})();

