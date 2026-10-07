(function(){
const M=Manarat,$=id=>document.getElementById(id);let store=M.store(),editId=new URLSearchParams(location.search).get('edit'),game=null,questions=[],editingIndex=-1,tempPuzzleImage='',tempCoverImage='';
function fresh(){store=M.store();return store}
function selectedGender(){return M.normalizedGender($('audience_gender')?.value||game?.audience_gender||fresh().platform?.uiGender||'female')}
function selectedPack(){return M.genderPack(selectedGender())}
function adjustGenderText(v){return M.genderizeText(v,selectedGender())}
function applyPackToGameFields(target,pack){
  target.student_label=pack.student;
  target.startButton=pack.startButton;
  target.correctMsg=pack.correctMsg;
  target.wrongMsg=pack.wrongMsg;
  target.finalExcellent=pack.finalExcellent;
  target.finalTry=pack.finalTry;
  target.correctVoicePhrases=pack.correctVoicePhrases;
  target.wrongVoicePhrases=pack.wrongVoicePhrases;
  target.puzzleVoicePhrases=pack.puzzleVoicePhrases;
  target.puzzleCompleteText=pack.puzzleDone;
  return target;
}

async function refreshAIFileList(){const el=$('aiFileList');if(!el)return;const files=[...($('aiFiles')?.files||[])];if(!files.length){el.textContent='لم يتم اختيار ملفات بعد.';return}el.innerHTML=files.map(f=>`<div class="file-pill">📎 ${M.esc(f.name)} <small>${Math.round((f.size||0)/1024)} KB · ${M.esc(f.type||'ملف')}</small></div>`).join('')+'<p class="muted">تم اختيار الملفات. اضغط توليد ليتم تحليل المحتوى وإنشاء أسئلة حقيقية من الدرس فقط.</p>';}

function getGame(){const s=fresh();const g=editId?s.games.find(g=>String(g.id)===String(editId)):null;if(g&&!M.teacherOwnsGame(g)&&!M.isAdmin()){M.toast('لا يمكن تعديل لعبة معلم/معلمة أخرى من هذه اللوحة','error');editId=null;history.replaceState(null,'','create-game.html');return null}return g}
function fill(){game=getGame()||{id:M.uuid(),title:'',subject:'',grade:'',folder:'',description:'',teacher_id:fresh().profile.id,teacher_email:fresh().profile.email||'',teacher:fresh().profile.name,school:fresh().profile.school,timer:90,per_question_timer:0,passing_score:70,mode:'individual',audience_gender:(fresh().platform?.uiGender||'female'),individual_question_count:20,competition_question_count:10,startButton:'ابدأ اللعبة',student_label:'الطالبة',correctMsg:'إجابة صحيحة! 🎉',wrongMsg:'إجابة غير صحيحة',correctVoicePhrases:['أَحْسَنْتِ، إِجَابَةٌ صَحِيحَة.','مُمْتَازَةٌ، واصِلِي التَّقَدُّم.','رائِعَةٌ، اخْتِيارُكِ صَحِيح.','أَبْدَعْتِ يا بَطَلَة.'],wrongVoicePhrases:['لا بَأْسَ، حاوِلِي مَرَّةً أُخْرَى.','إِجَابَةٌ غَيْرُ صَحِيحَة، راجِعِي السُّؤال.','اقْتَرَبْتِ مِنَ الصَّواب، فَكِّرِي قَلِيلًا.'],puzzleVoicePhrases:['رائع جدًا! اكتمل البازل بنجاح.','أحسنتِ، اكتملت الصورة بشكل صحيح.'],finalExcellent:'أداء رائع جدًا',finalTry:'راجعي الدرس جيدًا وستتقدمين',show_answer:true,allow_retry:true,show_retry_button:true,shuffle_questions:true,shuffle_options:true,enable_sound:true,enable_fx:true,show_in_home_public:false,share_with_teachers:false,student_roster_scope:'game',students:[],coverImage:'',questions:[]};if(!game.audience_gender)game.audience_gender=(fresh().platform?.uiGender||'female');const __pack=M.genderPack(game.audience_gender);game=applyPackToGameFields(game,__pack);questions=JSON.parse(JSON.stringify(game.questions||[]));tempCoverImage=game.coverImage||'';$('pageTitle').textContent=editId?'تعديل اللعبة':'إنشاء لعبة جديدة';['title','subject','grade','folder','description','timer','per_question_timer','passing_score','mode','audience_gender','individual_question_count','competition_question_count','startButton','student_label','correctMsg','wrongMsg','finalExcellent','finalTry'].forEach(id=>{if($(id))$(id).value=game[id]??''});['show_answer','allow_retry','show_retry_button','shuffle_questions','shuffle_options','enable_sound','enable_fx'].forEach(id=>{if($(id))$(id).checked=game[id]!==false});['show_in_home_public','share_with_teachers'].forEach(id=>{if($(id))$(id).checked=game[id]===true});if($('students_text'))$('students_text').value=(game.students||[]).join('\n');if($('student_roster_scope'))$('student_roster_scope').value=game.student_roster_scope||'game';renderSavedRosters();renderQuestions();renderCoverPreview()}
function readGame(){
  const gp=selectedPack();
  return {
    ...game,
    title:$('title').value.trim()||'لعبة جديدة',
    subject:$('subject').value.trim(),
    grade:$('grade').value.trim(),
    folder:$('folder').value.trim(),
    description:$('description').value.trim(),
    coverImage:tempCoverImage||'',
    timer:Number($('timer').value||90),
    per_question_timer:Number($('per_question_timer').value||0),
    passing_score:Number($('passing_score').value||70),
    mode:$('mode')?.value||'individual',
    audience_gender:selectedGender(),
    individual_question_count:Number($('individual_question_count')?.value||20),
    competition_question_count:Number($('competition_question_count')?.value||10),
    startButton:adjustGenderText($('startButton')?.value.trim()||gp.startButton),
    student_label:adjustGenderText($('student_label')?.value.trim()||gp.student),
    student_roster_scope:$('student_roster_scope')?.value||'game',
    students:($('students_text')?.value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean),
    correctMsg:adjustGenderText($('correctMsg')?.value.trim()||gp.correctMsg),
    wrongMsg:adjustGenderText($('wrongMsg')?.value.trim()||gp.wrongMsg),
    correctVoicePhrases:gp.correctVoicePhrases,
    wrongVoicePhrases:gp.wrongVoicePhrases,
    puzzleVoicePhrases:gp.puzzleVoicePhrases,
    puzzleCompleteText:gp.puzzleDone,
    correctVoice:gp.excellent,
    wrongVoice:gp.wrong,
    puzzleCompleteVoice:gp.puzzleDone,
    finalExcellent:adjustGenderText($('finalExcellent')?.value.trim()||gp.finalExcellent),
    finalTry:adjustGenderText($('finalTry')?.value.trim()||gp.finalTry),
    show_answer:$('show_answer').checked,
    answer_after_attempts:$('show_answer').checked,
    allow_retry:$('allow_retry').checked,
    show_retry_button:$('show_retry_button')?.checked!==false,
    shuffle_questions:$('shuffle_questions').checked,
    shuffle_options:$('shuffle_options').checked,
    enable_sound:$('enable_sound')?.checked!==false,
    enable_fx:$('enable_fx')?.checked!==false,
    show_in_home_public:$('show_in_home_public')?.checked===true,
    share_with_teachers:$('share_with_teachers')?.checked===true,
    public_status:$('show_in_home_public')?.checked===true ? ((game.public_status==='approved'||!(M.store().platform||{}).publicLibraryRequiresApproval||M.isAdmin())?'approved':'pending') : 'private',
    sharing_status:$('share_with_teachers')?.checked===true ? ((game.sharing_status==='approved'||!(M.store().platform||{}).publicLibraryRequiresApproval||M.isAdmin())?'approved':'pending') : 'private',
    public_approved:$('show_in_home_public')?.checked===true && (game.public_status==='approved'||!(M.store().platform||{}).publicLibraryRequiresApproval||M.isAdmin()),
    shared_approved:$('share_with_teachers')?.checked===true && (game.sharing_status==='approved'||!(M.store().platform||{}).publicLibraryRequiresApproval||M.isAdmin()),
    teacher_id:fresh().profile.id,
    teacher_email:fresh().profile.email||'',
    teacher:fresh().profile.name,
    school:fresh().profile.school,
    questions:questions.map((q,i)=>({...q,text:adjustGenderText(q.text||''),explanation:adjustGenderText(q.explanation||''),order:i})),
    updated_at:new Date().toISOString(),
    created_at:game.created_at||new Date().toISOString()
  }
}

function renderCoverPreview(){const el=$('coverPreview');if(!el)return;el.innerHTML=tempCoverImage?`<img class="preview-img" src="${M.attr(tempCoverImage)}" alt="صورة واجهة اللعبة"><button type="button" class="btn bad small" onclick="clearCoverImage()">حذف الصورة</button>`:'لم يتم رفع صورة واجهة بعد.'}
window.handleCoverImage=async function(){const f=$('coverImageFile')?.files?.[0];if(!f)return;tempCoverImage=await M.compressImageFile(f,1100,.82);renderCoverPreview();M.toast('تم رفع صورة واجهة اللعبة')}
window.clearCoverImage=function(){tempCoverImage='';if($('coverImageFile'))$('coverImageFile').value='';renderCoverPreview();M.toast('تم حذف صورة واجهة اللعبة')}

window.applyAudiencePreset=function(){const g=selectedGender();const p=M.genderPack(g);if($('student_label'))$('student_label').value=p.student;if($('startButton'))$('startButton').value=p.startButton;if($('correctMsg'))$('correctMsg').value=p.correctMsg;if($('wrongMsg'))$('wrongMsg').value=p.wrongMsg;if($('finalExcellent'))$('finalExcellent').value=p.finalExcellent;if($('finalTry'))$('finalTry').value=p.finalTry;if(game){game.audience_gender=g;applyPackToGameFields(game,p)}M.toast(g==='male'?'تم ضبط كل عبارات اللعبة وأصواتها بصيغة المذكر':'تم ضبط كل عبارات اللعبة وأصواتها بصيغة المؤنث')}


async function optimizeGameImages(g){
  for(const q of (g.questions||[])){
    if((q.type==='puzzle_image'||q.image) && String(q.image||'').startsWith('data:image/')){
      q.image=await M.compressImageDataURL(q.image,900,.78);
    }
  }
  return g;
}
function storeSizeInfo(s){try{return Math.round(JSON.stringify(s).length/1024)}catch(e){return 0}}
window.saveGame=async function(){
  const s=fresh();
  const p=s.profile||{};
  const g=await optimizeGameImages({...readGame(),teacher_id:p.id||M.currentTeacherId(),teacher_email:p.email||'',teacher:p.name||'',school:p.school||'',status:'published'});
  s.games=Array.isArray(s.games)?s.games:[];
  const idx=s.games.findIndex(x=>String(x.id)===String(g.id));
  if(idx>=0)s.games[idx]=g;else s.games.unshift(g);
  s.teachers=Array.isArray(s.teachers)?s.teachers:[];
  if(p.email||p.id){
    const ti=s.teachers.findIndex(t=>String(t.id)===String(p.id)||String(t.email||'').toLowerCase()===String(p.email||'').toLowerCase());
    const teacherRecord={id:p.id||g.teacher_id,name:p.name||g.teacher||'معلم/معلمة',school:p.school||g.school||'',email:p.email||g.teacher_email||'',status:'نشط',avatar:p.avatar||'',icon:p.icon||'',educator_gender:p.educator_gender||fresh().platform?.uiGender||'female'};
    if(ti>=0)s.teachers[ti]={...s.teachers[ti],...teacherRecord}; else s.teachers.unshift(teacherRecord)
  }
  try{M.saveStore(s)}catch(e){
    console.error('local save failed',e);
    return M.toast('تعذر حفظ اللعبة محليًا. غالبًا حجم الصور كبير. صغّر الصور أو احذف بعض صور البازل ثم احفظ مرة أخرى. حجم البيانات الحالي تقريبًا: '+storeSizeInfo(s)+'KB','error')
  }
  try{await M.cloudUpsertGame?.(g)}catch(e){console.warn('cloudUpsertGame failed',e);M.toast('حُفظت محليًا، لكن تعذر رفعها للسحابة: '+(e.message||''),'warn')}
  editId=g.id; game=g; history.replaceState(null,'','?edit='+encodeURIComponent(g.id));
  await M.cloudSyncTables?.();
  const verify=M.store().games.some(x=>String(x.id)===String(g.id));
  if(verify){M.toast('تم حفظ اللعبة بنجاح وظهرت في لوحة المعلم والأدمن')}
  else{M.toast('لم يتم تأكيد الحفظ. اضغط حفظ مرة أخرى أو تحقق من إعدادات Supabase.','error')}
}

function cleanRosterFromText(v){return [...new Set(String(v||'').split(/\n+/).map(x=>x.trim()).filter(Boolean))]}
function currentRoster(){return cleanRosterFromText($('students_text')?.value||'')}
function rosterOwnerMatch(r){const p=fresh().profile||{};return !r.teacher_id || r.teacher_id===p.id || String(r.teacher_email||'').toLowerCase()===String(p.email||'').toLowerCase()}
window.renderSavedRosters=function(){const sel=$('savedRosterSelect');if(!sel)return;const s=fresh();const rosters=(s.studentRosters||[]).filter(rosterOwnerMatch);sel.innerHTML='<option value="">اختاري قائمة محفوظة</option>'+rosters.map(r=>`<option value="${M.attr(r.id)}">${M.esc(r.title)} — ${Number((r.students||[]).length)} اسم</option>`).join('');}
window.saveRosterAsShared=function(){const names=currentRoster();if(!names.length)return M.toast('اكتب أسماء هذه اللعبة أولًا','error');const title=prompt('اسم القائمة المحفوظة:', game.title?('قائمة '+game.title):'قائمة طلاب')||'';if(!title.trim())return;const s=fresh();const p=s.profile||{};s.studentRosters=s.studentRosters||[];s.studentRosters.unshift({id:M.uuid(),title:title.trim(),students:names,teacher_id:p.id,teacher_email:p.email||'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});M.saveStore(s);renderSavedRosters();M.toast('تم حفظ القائمة كقائمة مستقلة، ولن تُضاف لأي لعبة أخرى إلا عند الاستيراد')}
window.importSavedRoster=function(mode='replace'){const id=$('savedRosterSelect')?.value;if(!id)return M.toast('اختر قائمة محفوظة أولًا','warn');const s=fresh();const r=(s.studentRosters||[]).find(x=>x.id===id);if(!r)return M.toast('لم يتم العثور على القائمة','error');const old=mode==='append'?currentRoster():[];const merged=[...new Set([...old,...(r.students||[])].map(x=>String(x||'').trim()).filter(Boolean))];$('students_text').value=merged.join('\n');M.toast(mode==='append'?'تمت إضافة الأسماء إلى قائمة هذه اللعبة فقط':'تم استبدال أسماء هذه اللعبة بالقائمة المختارة')}
window.importRosterFromAnotherGame=function(){const s=fresh();const p=s.profile||{};const games=(s.games||[]).filter(g=>g.id!==(game&&game.id)&&((g.teacher_id===p.id)||String(g.teacher_email||'').toLowerCase()===String(p.email||'').toLowerCase())&&Array.isArray(g.students)&&g.students.length);if(!games.length)return M.toast('لا توجد لعبة أخرى بها أسماء للاستيراد','warn');const list=games.map((g,i)=>`${i+1}- ${g.title} (${g.students.length} اسم)`).join('\n');const n=Number(prompt('اختَر رقم اللعبة التي تريد نسخ أسمائها إلى هذه اللعبة فقط:\n'+list));const g=games[n-1];if(!g)return;const old=currentRoster();const merged=[...new Set([...old,...g.students].map(x=>String(x||'').trim()).filter(Boolean))];$('students_text').value=merged.join('\n');M.toast('تم نسخ الأسماء إلى هذه اللعبة فقط، ولم يتم تعديل اللعبة الأصلية')}
window.clearGameRoster=function(){if(!confirm('مسح أسماء الطلاب/الطالبات من هذه اللعبة فقط؟'))return;$('students_text').value='';M.toast('تم مسح أسماء هذه اللعبة فقط')}
function typeName(t){return{multiple_choice:'اختيار من متعدد',true_false:'صح أو خطأ',matching:'مطابقة',connecting:'توصيل',ordering:'ترتيب',classification:'تصنيف داخل جدول',open_text:'نص مفتوح',puzzle_image:'بازل صورة'}[t]||t}

function updatePuzzleControls(qForRender){
  const type=$('qType')?.value;
  const isPuzzle=type==='puzzle_image';
  if($('puzzleControls'))$('puzzleControls').style.display=isPuzzle?'block':'none';
  if($('qData'))$('qData').style.display='none';
  if($('qCorrect'))$('qCorrect').style.display='none';
  if($('qStructuredEditor'))$('qStructuredEditor').style.display=isPuzzle?'none':'block';
  if(isPuzzle&&!$('qText').value.trim())$('qText').value='رتّب قطع الصورة حتى تكتمل بشكل صحيح';
  if(isPuzzle&&!$('qEmoji').value.trim())$('qEmoji').value='🧩';
  if(!isPuzzle)renderStructuredEditor(qForRender||{type});
  renderPuzzlePreview()
}
function renderPuzzlePreview(){const box=$('qPuzzlePreview');if(!box)return;const img=tempPuzzleImage;if(img)box.innerHTML=`<img src="${M.attr(img)}"><span>الصورة جاهزة للبازل · الشبكة: ${$('qPuzzleGrid')?.value||3}×${$('qPuzzleGrid')?.value||3}</span>`;else box.innerHTML='لم يتم رفع صورة بعد.'}
async function handlePuzzleUpload(){const f=$('qPuzzleFile')?.files?.[0];if(!f)return;tempPuzzleImage=await M.compressImageFile(f,1000,.82);renderPuzzlePreview();M.toast('تم رفع صورة البازل وضغطها تلقائيًا حتى تُحفظ بدون مشكلة')}
function normalizeEditorType(type){return M.normalizeQuestion({type,text:'سؤال مؤقت',options:['أ','ب'],pairs:[{left:'أ',right:'ب'},{left:'ج',right:'د'}],items:['أ','ب'],answers:['أ']})?.type||type||'multiple_choice'}
function ensureRows(arr,min,empty){arr=Array.isArray(arr)?arr.slice():[];while(arr.length<min)arr.push(typeof empty==='function'?empty(arr.length):empty);return arr}
function optionRowHTML(v='',i=0,checked=false){return `<div class="structured-row option-row"><label class="correct-radio"><input type="radio" name="qCorrectOption" ${checked?'checked':''}><span>الإجابة الصحيحة</span></label><input class="input q-option-input" value="${M.attr(v||'')}" placeholder="الخيار ${i+1}"><button type="button" class="btn bad small" onclick="removeQOption(${i})">حذف</button></div>`}
function pairRowHTML(pair={},i=0,type='matching'){
  const leftLabel=type==='connecting'?'السؤال / العبارة':'العبارة الأولى';
  const rightLabel=type==='connecting'?'الإجابة التي توصل إليها':'العبارة المقابلة';
  return `<div class="structured-row pair-editor-row"><div class="row-number">${i+1}</div><input class="input q-pair-left" value="${M.attr(pair.left||'')}" placeholder="${leftLabel} ${i+1}"><input class="input q-pair-right" value="${M.attr(pair.right||'')}" placeholder="${rightLabel} ${i+1}"><button type="button" class="btn bad small" onclick="removeQPair(${i})">حذف</button></div>`
}
function orderRowHTML(v='',i=0){return `<div class="structured-row order-editor-row"><div class="row-number">${i+1}</div><input class="input q-order-input" value="${M.attr(v||'')}" placeholder="العبارة رقم ${i+1}"><button type="button" class="btn bad small" onclick="removeQOrder(${i})">حذف</button></div>`}
function answerRowHTML(v='',i=0){return `<div class="structured-row answer-editor-row"><div class="row-number">${i+1}</div><input class="input q-open-answer" value="${M.attr(v||'')}" placeholder="إجابة مقبولة ${i+1}"><button type="button" class="btn bad small" onclick="removeQAnswer(${i})">حذف</button></div>`}
function classItemRowHTML(item={},ci=0,ii=0){
  item=typeof item==='object'?item:{text:String(item||''),image:'',kind:'text'};
  const kind=(item.kind==='image'||(item.image&&!item.text))?'image':'text';
  const hasImg=!!String(item.image||'').trim();
  return `<div class="structured-row class-item-row" data-col="${ci}" data-row="${ii}">
    <div class="row-number">${ii+1}</div>
    <select class="input q-class-item-kind" onchange="changeClassItemKind(${ci},${ii},this.value)">
      <option value="text" ${kind==='text'?'selected':''}>نص يُسحب</option>
      <option value="image" ${kind==='image'?'selected':''}>صورة تُسحب</option>
    </select>
    <input class="input q-class-item-text" value="${M.attr(item.text||'')}" placeholder="النص الذي سيتم سحبه" style="${kind==='text'?'':'display:none'}">
    <div class="class-image-tools" style="${kind==='image'?'':'display:none'}">
      <div class="q-actions">
        <label class="btn small class-upload-btn">رفع صورة<input type="file" accept="image/*" hidden onchange="handleClassItemImageUpload(event,${ci},${ii})"></label>
        <button type="button" class="btn dark small" onclick="clearClassItemImage(${ci},${ii})">مسح الصورة</button>
      </div>
      <input class="input q-class-item-image" value="${M.attr(item.image||'')}" placeholder="سيظهر رابط الصورة هنا بعد الرفع، ويمكن لصق رابط صورة أيضًا">
      <div class="class-image-preview ${hasImg?'':'empty'}">${hasImg?`<img src="${M.attr(item.image)}" alt=""><span>الصورة جاهزة للسحب</span>`:'لم يتم رفع صورة بعد'}</div>
    </div>
    <button type="button" class="btn bad small" onclick="removeClassItem(${ci},${ii})">حذف</button>
  </div>`;
}
function classColumnHTML(col={},ci=0){
  const items=ensureRows((col.items||[]).map(it=>typeof it==='object'?it:{text:String(it||''),image:'',kind:'text'}),2,()=>({text:'',image:'',kind:'text'}));
  return `<div class="classification-editor-col" data-col="${ci}"><div class="structured-head"><h3>عمود ${ci+1}</h3><button type="button" class="btn small" onclick="addClassItem(${ci})">+ عنصر</button></div><input class="input q-class-title" value="${M.attr(col.title||'')}" placeholder="عنوان العمود ${ci+1}"><p class="muted">اختر لكل عنصر: نص يُسحب أو صورة تُسحب. عند اختيار صورة سيظهر زر رفع الصورة.</p>${items.map((it,ii)=>classItemRowHTML(it,ci,ii)).join('')}</div>`;
}
function readClassPayloadFromEditor(){
  return [...document.querySelectorAll('.classification-editor-col')].map(col=>{
    const title=col.querySelector('.q-class-title')?.value.trim()||'';
    const items=[...col.querySelectorAll('.class-item-row')].map(row=>{
      const kind=row.querySelector('.q-class-item-kind')?.value==='image'?'image':'text';
      const text=row.querySelector('.q-class-item-text')?.value.trim()||'';
      const image=row.querySelector('.q-class-item-image')?.value.trim()||'';
      return {kind,text:kind==='text'?text:'',image:kind==='image'?image:''};
    }).filter(it=>(it.kind==='text'&&it.text)||(it.kind==='image'&&it.image));
    return {title,items};
  }).filter(c=>c.title&&c.items.length);
}
function findClassItemRow(ci,ii){return document.querySelector(`.class-item-row[data-col="${ci}"][data-row="${ii}"]`)}
function updateClassImagePreview(row){
  if(!row)return; const input=row.querySelector('.q-class-item-image'), box=row.querySelector('.class-image-preview'); if(!box)return;
  const url=(input?.value||'').trim();
  if(url){box.classList.remove('empty');box.innerHTML=`<img src="${M.attr(url)}" alt=""><span>الصورة جاهزة للسحب</span>`}
  else{box.classList.add('empty');box.textContent='لم يتم رفع صورة بعد'}
}
window.changeClassItemKind=function(ci,ii,kind){
  const row=findClassItemRow(ci,ii); if(!row)return;
  const isImage=kind==='image';
  const text=row.querySelector('.q-class-item-text'), tools=row.querySelector('.class-image-tools');
  if(text){text.style.display=isImage?'none':''; if(isImage)text.value=''}
  if(tools){tools.style.display=isImage?'':'none'}
  if(!isImage){const img=row.querySelector('.q-class-item-image'); if(img)img.value=''; updateClassImagePreview(row)}
}
window.handleClassItemImageUpload=async function(ev,ci,ii){
  const file=ev?.target?.files?.[0]; if(!file)return;
  const row=findClassItemRow(ci,ii); if(!row)return;
  try{
    const data=await M.compressImageFile(file,900,.82);
    const input=row.querySelector('.q-class-item-image'); if(input)input.value=data;
    updateClassImagePreview(row);
    M.toast('تم رفع صورة عنصر التصنيف بنجاح');
  }catch(e){M.toast('تعذر رفع الصورة: '+(e.message||e),'error')}
  try{ev.target.value=''}catch(e){}
}
window.clearClassItemImage=function(ci,ii){const row=findClassItemRow(ci,ii); if(!row)return; const input=row.querySelector('.q-class-item-image'); if(input)input.value=''; updateClassImagePreview(row)}
function renderStructuredEditor(q={}){
  const box=$('qStructuredEditor');if(!box)return;
  const type=$('qType')?.value||q.type||'multiple_choice';
  if(type==='puzzle_image'){box.innerHTML='';return}
  if(type==='true_false'){
    const correct=Number(q.correct||0);
    box.innerHTML=`<div class="structured-editor-card"><h3>✅ اختر الإجابة الصحيحة</h3><div class="tf-editor"><label class="tf-choice"><input type="radio" name="qTFCorrect" value="0" ${correct!==1?'checked':''}><span>صح</span></label><label class="tf-choice"><input type="radio" name="qTFCorrect" value="1" ${correct===1?'checked':''}><span>خطأ</span></label></div></div>`;
    return;
  }
  if(type==='matching'||type==='connecting'){
    const pairs=ensureRows((q.pairs||[]).map(p=>({left:p.left||'',right:p.right||''})),3,()=>({left:'',right:''}));
    box.innerHTML=`<div class="structured-editor-card"><div class="structured-head"><h3>${type==='connecting'?'🧵 عناصر التوصيل':'🔗 عناصر المطابقة'}</h3><button type="button" class="btn small" onclick="addQPair()">+ إضافة صف</button></div><p class="muted">كل صف مستقل: العبارة في صندوق، والمقابل الصحيح لها في الصندوق المواجه.</p><div class="pair-editor-head"><span>رقم</span><span>${type==='connecting'?'السؤال / العبارة':'العبارة الأولى'}</span><span>${type==='connecting'?'الإجابة المقابلة':'العبارة المقابلة'}</span><span></span></div>${pairs.map((p,i)=>pairRowHTML(p,i,type)).join('')}</div>`;
    return;
  }
  if(type==='ordering'){
    const items=ensureRows(q.items||[],3,'');
    box.innerHTML=`<div class="structured-editor-card"><div class="structured-head"><h3>🔢 عبارات الترتيب</h3><button type="button" class="btn small" onclick="addQOrder()">+ إضافة عبارة</button></div><p class="muted">اكتب العبارات بالترتيب الصحيح من 1 إلى النهاية. الرقم الظاهر أمام كل عبارة هو ترتيبها الصحيح.</p>${items.map((v,i)=>orderRowHTML(v,i)).join('')}</div>`;
    return;
  }
  if(type==='classification'){
    const count=Math.max(2,Math.min(4,Number(q.column_count||q.categories?.length||2)||2));
    let categories=Array.isArray(q.categories)?q.categories.slice(0,count):[];
    while(categories.length<count)categories.push({title:'',items:[]});
    box.innerHTML=`<div class="structured-editor-card classification-editor-card"><div class="structured-head"><h3>🗂️ جدول التصنيف</h3><label>عدد الأعمدة <select id="qClassColumnCount" class="input" onchange="changeClassColumnCount(this.value)"><option value="2" ${count===2?'selected':''}>عمودان</option><option value="3" ${count===3?'selected':''}>3 أعمدة</option><option value="4" ${count===4?'selected':''}>4 أعمدة</option></select></label></div><p class="muted">كل عمود له عنوان. اختر لكل عنصر هل هو نص يُسحب أم صورة تُسحب. عند اختيار صورة يمكنك رفع الصورة مباشرة.</p><div class="classification-editor-grid" style="--classCols:${count}">${categories.map((c,i)=>classColumnHTML(c,i)).join('')}</div></div>`;
    return;
  }
  if(type==='open_text'){
    const answers=ensureRows(q.answers||[],2,'');
    const manual=q.manual_grade!==false;
    box.innerHTML=`<div class="structured-editor-card"><div class="structured-head"><h3>✍️ إعدادات السؤال المفتوح / المقالي</h3><button type="button" class="btn small" onclick="addQAnswer()">+ إضافة إجابة نموذجية</button></div>
    <label class="switch-card open-manual-switch"><span>تصحيح يدوي بتقدير المعلم أثناء اللعب</span><input id="qOpenManualGrade" type="checkbox" ${manual?'checked':''}></label>
    <p class="muted">عند تفعيل التصحيح اليدوي تظهر للمعلم أثناء عرض السؤال أزرار: الإجابة صحيحة / الإجابة خاطئة، وتحسب الدرجة بناءً على اختيار المعلم وليس مطابقة النص. الإجابات النموذجية اختيارية وتظهر كمرجع فقط.</p>
    ${answers.map((v,i)=>answerRowHTML(v,i)).join('')}</div>`;
    return;
  }
  const options=ensureRows(q.options||['','','',''],4,'');
  let correct=Number(q.correct||0); if(!Number.isFinite(correct)||correct<0||correct>=options.length)correct=0;
  box.innerHTML=`<div class="structured-editor-card"><div class="structured-head"><h3>📖 خيارات الإجابة</h3><button type="button" class="btn small" onclick="addQOption()">+ إضافة خيار</button></div><p class="muted">كل خيار في مربع مستقل. اختر المربع أمام الخيار الصحيح.</p>${options.map((v,i)=>optionRowHTML(v,i,i===correct)).join('')}</div>`;
}
function structuredPayload(type){
  if(type==='true_false')return{options:['صح','خطأ'],correct:Number(document.querySelector('input[name="qTFCorrect"]:checked')?.value||0)};
  if(type==='matching'||type==='connecting')return{pairs:[...document.querySelectorAll('.pair-editor-row')].map(r=>({left:r.querySelector('.q-pair-left')?.value.trim()||'',right:r.querySelector('.q-pair-right')?.value.trim()||''})).filter(p=>p.left&&p.right)};
  if(type==='classification'){const categories=readClassPayloadFromEditor();return{categories,column_count:Math.max(2,Math.min(4,Number(document.getElementById('qClassColumnCount')?.value||categories.length||2)||2))};}
  if(type==='ordering')return{items:[...document.querySelectorAll('.q-order-input')].map(x=>x.value.trim()).filter(Boolean)};
  if(type==='open_text')return{manual_grade:document.getElementById('qOpenManualGrade')?.checked!==false,answers:[...document.querySelectorAll('.q-open-answer')].map(x=>x.value.trim()).filter(Boolean)};
  const rows=[...document.querySelectorAll('.option-row')];
  const filled=rows.map(r=>({value:r.querySelector('.q-option-input')?.value.trim()||'',checked:!!r.querySelector('input[type="radio"]')?.checked})).filter(x=>x.value);
  const options=filled.map(x=>x.value);
  let correct=filled.findIndex(x=>x.checked);
  if(correct<0)correct=0;
  correct=Math.min(correct,Math.max(0,options.length-1));
  return{options,correct};
}
window.addQOption=function(){const p=structuredPayload('multiple_choice');p.options.push('');renderStructuredEditor({type:'multiple_choice',options:p.options,correct:p.correct})}
window.removeQOption=function(i){const p=structuredPayload('multiple_choice');if(p.options.length<=2)return M.toast('يجب أن يبقى خياران على الأقل','warn');p.options.splice(i,1);if(p.correct>=p.options.length)p.correct=0;renderStructuredEditor({type:'multiple_choice',options:p.options,correct:p.correct})}
window.addQPair=function(){const type=$('qType')?.value||'matching';const p=structuredPayload(type);p.pairs.push({left:'',right:''});renderStructuredEditor({type,pairs:p.pairs})}
window.removeQPair=function(i){const type=$('qType')?.value||'matching';const p=structuredPayload(type);if(p.pairs.length<=2)return M.toast('يجب أن يبقى صفان على الأقل','warn');p.pairs.splice(i,1);renderStructuredEditor({type,pairs:p.pairs})}
window.addQOrder=function(){const p=structuredPayload('ordering');p.items.push('');renderStructuredEditor({type:'ordering',items:p.items})}
window.removeQOrder=function(i){const p=structuredPayload('ordering');if(p.items.length<=2)return M.toast('يجب أن تبقى عبارتان على الأقل','warn');p.items.splice(i,1);renderStructuredEditor({type:'ordering',items:p.items})}
window.addQAnswer=function(){const p=structuredPayload('open_text');p.answers.push('');renderStructuredEditor({type:'open_text',answers:p.answers})}
window.removeQAnswer=function(i){const p=structuredPayload('open_text');if(p.answers.length<=1)return M.toast('يجب أن تبقى إجابة واحدة على الأقل','warn');p.answers.splice(i,1);renderStructuredEditor({type:'open_text',answers:p.answers})}
window.changeClassColumnCount=function(n){const p=structuredPayload('classification');let cats=p.categories||[];n=Math.max(2,Math.min(4,Number(n)||2));while(cats.length<n)cats.push({title:'',items:[]});cats=cats.slice(0,n);renderStructuredEditor({type:'classification',categories:cats,column_count:n})}
window.addClassItem=function(ci){const p=structuredPayload('classification');while(p.categories.length<=ci)p.categories.push({title:'',items:[]});p.categories[ci].items.push({kind:'text',text:'',image:''});renderStructuredEditor({type:'classification',categories:p.categories,column_count:p.column_count||p.categories.length})}
window.removeClassItem=function(ci,ii){const p=structuredPayload('classification');if(!p.categories[ci])return;if(p.categories[ci].items.length<=1)return M.toast('يجب أن يبقى عنصر واحد على الأقل في كل عمود','warn');p.categories[ci].items.splice(ii,1);renderStructuredEditor({type:'classification',categories:p.categories,column_count:p.column_count||p.categories.length})}
window.changeClassItemKind=function(ci,ii,kind){const p=structuredPayload('classification');if(!p.categories[ci]||!p.categories[ci].items[ii])return;p.categories[ci].items[ii].kind=kind==='image'?'image':'text';if(kind==='image')p.categories[ci].items[ii].text='';else p.categories[ci].items[ii].image='';renderStructuredEditor({type:'classification',categories:p.categories,column_count:p.column_count||p.categories.length})}
function renderQuestions(){ $('questionsList').innerHTML=questions.map((q,i)=>`<div class="q-admin-card"><div><b>${i+1}. ${M.esc(q.emoji||'')} ${M.esc(q.text)}</b><p class="muted">${typeName(q.type)} · ${q.points||10} نقاط · ${q.attempts||1} محاولة</p></div><div class="q-actions"><button class="btn small" onclick="moveQ(${i},-1)">↑</button><button class="btn small" onclick="moveQ(${i},1)">↓</button><button class="btn small" onclick="openQuestionModal(${i})">تعديل</button><button class="btn bad small" onclick="deleteQ(${i})">حذف</button></div></div>`).join('')||'<p class="muted">لا توجد أسئلة بعد.</p>'}
window.openQuestionModal=function(i=-1){editingIndex=i;const q=i>=0?questions[i]:{type:'multiple_choice',emoji:'📖',text:'',options:['','','',''],correct:0,points:10,attempts:1,explanation:''};tempPuzzleImage=q.type==='puzzle_image'?(q.image||''):'';$('qModalTitle').textContent=i>=0?'تعديل السؤال':'إضافة سؤال';$('qType').value=q.type||'multiple_choice';$('qEmoji').value=q.emoji||'📖';$('qText').value=q.text||'';$('qPoints').value=q.points||10;$('qAttempts').value=q.attempts||1;if($('qCorrect'))$('qCorrect').value=q.correct||0;$('qExplanation').value=q.explanation||'';if($('qPuzzleGrid'))$('qPuzzleGrid').value=q.puzzle_grid||3;if($('qPuzzleShowReference'))$('qPuzzleShowReference').checked=q.show_reference!==false;if($('qData'))$('qData').value='';updatePuzzleControls(q);$('qModal').classList.add('show')}
window.closeQuestionModal=function(){$('qModal').classList.remove('show')}

function validateQuestionDraft(q){
  if(!q||!String(q.text||'').trim())return 'اكتب نص السؤال';
  if(q.type==='multiple_choice'){
    const opts=(q.options||[]).map(x=>String(x||'').trim()).filter(Boolean);
    if(opts.length<2)return 'سؤال الاختيار يحتاج خيارين على الأقل';
    if(Number(q.correct)<0||Number(q.correct)>=opts.length)return 'اختر الإجابة الصحيحة من الخيارات';
  }
  if(q.type==='true_false' && ![0,1].includes(Number(q.correct)))return 'اختر صح أو خطأ كإجابة صحيحة';
  if((q.type==='matching'||q.type==='connecting')&&(!(q.pairs||[]).length||(q.pairs||[]).some(p=>!String(p.left||'').trim()||!String(p.right||'').trim())))return 'أكمل كل أزواج المطابقة/التوصيل';
  if(q.type==='ordering'&&(!(q.items||[]).length||(q.items||[]).length<2))return 'أضف عبارتين على الأقل في الترتيب';
  if(q.type==='classification'&&(!(q.categories||[]).length||(q.categories||[]).length<2||(q.categories||[]).some(c=>!String(c.title||'').trim()||!(c.items||[]).length)))return 'أكمل عناوين أعمدة التصنيف وأضف عنصرًا واحدًا على الأقل لكل عمود';
  if(q.type==='open_text'&&(!(q.answers||[]).length))return 'أضف إجابة مقبولة واحدة على الأقل';
  return '';
}

window.saveQuestionFromModal=function(){const type=$('qType').value;const text=$('qText').value.trim();if(!text)return M.toast('اكتب نص السؤال','error');let q={id:editingIndex>=0?questions[editingIndex].id:M.uuid(),type,emoji:$('qEmoji').value||'📖',text,points:Number($('qPoints').value||10),attempts:Number($('qAttempts').value||1),explanation:$('qExplanation').value.trim()};if(type==='puzzle_image'){if(!tempPuzzleImage)return M.toast('ارفع صورة البازل أولًا','error');q.image=tempPuzzleImage;q.puzzle_grid=Number($('qPuzzleGrid')?.value||3);q.show_reference=$('qPuzzleShowReference')?.checked!==false}else{Object.assign(q,structuredPayload(type))}const validationError=validateQuestionDraft(q);if(validationError)return M.toast(validationError,'error');q=M.normalizeQuestion(q);if(!q)return M.toast(type==='puzzle_image'?'بيانات البازل غير مكتملة':'بيانات السؤال غير مكتملة','error');if(editingIndex>=0)questions[editingIndex]=q;else questions.push(q);closeQuestionModal();renderQuestions();M.toast('تم حفظ السؤال')}
window.deleteQ=function(i){questions.splice(i,1);renderQuestions()};window.moveQ=function(i,d){let j=i+d;if(j<0||j>=questions.length)return;[questions[i],questions[j]]=[questions[j],questions[i]];renderQuestions()};
window.deleteAllQuestions=function(){if(!confirm('حذف كل أسئلة هذه اللعبة؟'))return;questions=[];renderQuestions();M.toast('تم حذف كل الأسئلة')}

window.importQuestionsJSON=async function(file){if(!file)return;try{const txt=await file.text();const data=JSON.parse(txt);const raw=Array.isArray(data)?data:(data&&Array.isArray(data.questions)?data.questions:(data&&data.questionBank&&Array.isArray(data.questionBank.questions)?data.questionBank.questions:(data&&data.type?[data]:[])));const qs=M.normalizeQuestions(data);if(!qs.length)return M.toast('لم يتم العثور على أسئلة صالحة داخل ملف JSON. تأكد أن الملف يحتوي على questions وأن النصوص ليست قوالب أو JSON داخل السؤال.','error');questions.push(...qs);renderQuestions();const skipped=Math.max(0,(raw.length||qs.length)-qs.length);M.toast('تم استيراد '+qs.length+' سؤالًا صالحًا من ملف JSON'+(skipped?'، وتم تجاهل '+skipped+' عنصر غير صالح أو يحتوي على كود JSON داخل السؤال.':''))}catch(e){M.toast('تعذر قراءة ملف JSON: '+(e.message||e),'error')}}

window.importBankToGame=function(){const s=fresh();if(!s.questionBanks.length)return M.toast('لا توجد بنوك أسئلة','warn');const names=s.questionBanks.map((b,i)=>`${i+1}- ${b.title} (${b.questions.length})`).join('\n');const n=Number(prompt('اختر رقم البنك:\n'+names));const b=s.questionBanks[n-1];if(b){questions.push(...JSON.parse(JSON.stringify(b.questions)));renderQuestions();M.toast('تم استيراد البنك إلى اللعبة')}}
function exportQuestionBody(q,i){
  const title=`<h3>${i+1}. ${M.esc(q.emoji||'')} ${M.esc(q.text||'')}</h3>`;
  if(q.type==='multiple_choice'||q.type==='true_false')return title+`<ol>${(q.options||[]).map((o,idx)=>`<li${idx===Number(q.correct)?' class="correct"':''}>${M.esc(o)}${idx===Number(q.correct)?' ✓':''}</li>`).join('')}</ol>${q.explanation?`<p><b>الشرح:</b> ${M.esc(q.explanation)}</p>`:''}`;
  if(q.type==='matching'||q.type==='connecting')return title+`<table><thead><tr><th>العبارة</th><th>المقابل الصحيح</th></tr></thead><tbody>${(q.pairs||[]).map(p=>`<tr><td>${M.esc(p.left)}</td><td>${M.esc(p.right)}</td></tr>`).join('')}</tbody></table>${q.explanation?`<p><b>الشرح:</b> ${M.esc(q.explanation)}</p>`:''}`;
  if(q.type==='classification')return title+`<table><thead><tr>${(q.categories||[]).map(c=>`<th>${M.esc(c.title)}</th>`).join('')}</tr></thead><tbody><tr>${(q.categories||[]).map(c=>`<td>${(c.items||[]).map(it=>it.kind==='image'&&it.image?'<span>🖼 صورة</span>':M.esc(it.text||'')).join('<br>')}</td>`).join('')}</tr></tbody></table>${q.explanation?`<p><b>الشرح:</b> ${M.esc(q.explanation)}</p>`:''}`;
  if(q.type==='ordering')return title+`<ol>${(q.items||[]).map(x=>`<li>${M.esc(x)}</li>`).join('')}</ol>${q.explanation?`<p><b>الشرح:</b> ${M.esc(q.explanation)}</p>`:''}`;
  if(q.type==='open_text')return title+`<p><b>الإجابات المقبولة:</b> ${(q.answers||[]).map(M.esc).join('، ')}</p>${q.explanation?`<p><b>الشرح:</b> ${M.esc(q.explanation)}</p>`:''}`;
  if(q.type==='puzzle_image')return title+`<p>سؤال بازل صورة — الشبكة: ${q.puzzle_grid||3}×${q.puzzle_grid||3}</p>`;
  return title;
}
function questionsExportHTML(){const g=readGame();const body=(questions||[]).map(exportQuestionBody).join('<hr>');return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${M.esc(g.title)} - بنك الأسئلة</title><style>body{direction:rtl;font-family:Arial,Tahoma,sans-serif;line-height:1.8;padding:28px;color:#111}h1{color:#0f172a}h3{background:#eef2ff;padding:10px;border-radius:10px}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{border:1px solid #999;padding:8px;text-align:right}.correct{font-weight:bold;color:#047857}hr{border:0;border-top:1px dashed #aaa;margin:22px 0}.meta{color:#555}</style></head><body><h1>${M.esc(g.title||'بنك أسئلة')}</h1><p class="meta">المادة: ${M.esc(g.subject||'')} — الصف: ${M.esc(g.grade||'')} — عدد الأسئلة: ${questions.length}</p>${body||'<p>لا توجد أسئلة.</p>'}</body></html>`}
window.exportQuestionsWord=function(){if(!questions.length)return M.toast('لا توجد أسئلة للتصدير','warn');const g=readGame();M.downloadFile(M.sanitizeFilename((g.title||'بنك أسئلة')+' - الأسئلة')+'.doc','\ufeff'+questionsExportHTML(),'application/msword;charset=utf-8');M.toast('تم تصدير الأسئلة كملف Word')}
window.exportQuestionsPDF=function(){if(!questions.length)return M.toast('لا توجد أسئلة للتصدير','warn');const w=window.open('','_blank');if(!w)return M.toast('اسمح بالنوافذ المنبثقة لتصدير PDF','warn');w.document.open();w.document.write(questionsExportHTML()+`<script>setTimeout(function(){window.print()},450)<\/script>`);w.document.close();M.toast('اختر حفظ كـ PDF من نافذة الطباعة')}
window.exportQuestionsBankFile=function(){if(!questions.length)return M.toast('لا توجد أسئلة للتصدير','warn');const g=readGame();const bank={id:M.uuid(),title:g.title||'بنك أسئلة',subject:g.subject||'',grade:g.grade||'',questions:questions.map(M.normalizeQuestion).filter(Boolean),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};M.downloadFile(M.sanitizeFilename(bank.title)+'-question-bank.json',JSON.stringify(bank,null,2),'application/json;charset=utf-8');M.toast('تم تصدير بنك الأسئلة كملف JSON')}
window.saveQuestionsAsBank=async function(){if(!questions.length)return M.toast('لا توجد أسئلة لحفظها كبنك','warn');const g=readGame();const title=prompt('اسم بنك الأسئلة:',g.title?('بنك '+g.title):'بنك أسئلة')||'';if(!title.trim())return;const s=fresh();const p=s.profile||{};const bank={id:M.uuid(),title:title.trim(),subject:g.subject||'',grade:g.grade||'',teacher_id:p.id||M.currentTeacherId(),teacher_email:p.email||'',questions:questions.map(M.normalizeQuestion).filter(Boolean),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};s.questionBanks=Array.isArray(s.questionBanks)?s.questionBanks:[];s.questionBanks.unshift(bank);M.saveStore(s);try{await M.cloudUpsertBank?.(bank);await M.cloudSyncTables?.()}catch(e){console.warn('bank sync failed',e);M.toast('تم حفظ البنك محليًا، وتعذرت مزامنته: '+(e.message||''),'warn');return}M.toast('تم حفظ الأسئلة كبنك أسئلة في المنصة')}
function showAIRetry(show){const b=$('aiRetryBtn');if(b)b.style.display=show?'inline-flex':'none'}
window.retryAIQuestions=function(){return window.generateAIQuestions(true)}
window.generateAIQuestions=async function(isRetry=false){showAIRetry(false);const files=[...($('aiFiles')?.files||[])];const types=[...document.querySelectorAll('.aiType:checked')].map(x=>x.value);$('aiStatus').textContent=isRetry?(files.length?'جاري إعادة المحاولة من الملف نفسه...':'جاري إعادة المحاولة من النص...'):(files.length?`جاري تحليل الملف واستخراج أسئلة حقيقية من محتواه...`:'جاري توليد الأسئلة من النص...');try{const qs=await M.aiGenerateQuestions({text:$('aiText').value,files,count:Math.min(Number($('aiCount').value||10),Number((M.store().platform||{}).maxAIQuestions||50)),types});if(!qs.length){$('aiStatus').textContent='لم يتم توليد أسئلة حقيقية من الملف. يمكنك الضغط على زر إعادة المحاولة أو لصق نص الدرس يدويًا.';showAIRetry(true);return M.toast('لم يتم توليد أسئلة صالحة','error')}questions.push(...qs);renderQuestions();showAIRetry(false);$('aiStatus').textContent=`تمت إضافة ${qs.length} سؤالًا حقيقيًا من محتوى الدرس.`;M.toast('تم توليد وإضافة الأسئلة')}catch(e){console.error(e);const msg=e.message||'خطأ غير معروف';M.toast('حدث خطأ أثناء التوليد: '+msg,'error');showAIRetry(true);$('aiStatus').textContent='فشل التوليد: '+msg+' — يمكنك الضغط على إعادة المحاولة أو لصق نص الدرس مباشرة.'}}
window.buildAIPrompt=function(){const types=[...document.querySelectorAll('.aiType:checked')].map(x=>x.value).join(', ');const prompt=`ولّد بنك أسئلة عربي بصيغة JSON فقط من النص المرفق. الأنواع المطلوبة: ${types}. العدد: ${$('aiCount').value}. الصيغة: {"questions":[{"type":"multiple_choice","emoji":"📖","text":"...","options":["..."],"correct":0,"explanation":"..."},{"type":"matching","pairs":[{"left":"...","right":"..."}]},{"type":"ordering","items":["..."]},{"type":"classification","text":"صنّف العناصر الآتية","categories":[{"title":"عنوان العمود","items":[{"text":"كلمة","image":""}]}]},{"type":"open_text","answers":["..."]}]}. النص:\n${$('aiText').value}`;M.copyText(prompt)}
window.previewGame=async function(){await saveGame();window.open('../player/game.html?game='+encodeURIComponent(game.id),'_blank')};window.exportCurrentGame=function(){const g=readGame();M.exportStandalone(g)}
M.qsa('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{M.qsa('.builder-tab').forEach(x=>x.style.display='none');M.qsa('.tab-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('tab-'+btn.dataset.tab).style.display='block'}));document.addEventListener('DOMContentLoaded',async()=>{await M.authRefreshSession();if(!M.requireTeacherAuth())return;await M.cloudSyncTables?.();fill();M.applyGenderQuickText(document);renderSavedRosters();$('aiFiles')?.addEventListener('change',refreshAIFileList);$('questionsJSONFile')?.addEventListener('change',e=>{importQuestionsJSON(e.target.files?.[0]);e.target.value=''});$('qType')?.addEventListener('change',updatePuzzleControls);$('qPuzzleFile')?.addEventListener('change',handlePuzzleUpload);$('qPuzzleGrid')?.addEventListener('change',renderPuzzlePreview);refreshAIFileList();});document.addEventListener('manarat:store-updated',()=>{if(editingIndex<0){fill();M.applyGenderQuickText(document);renderSavedRosters();}});
})();
