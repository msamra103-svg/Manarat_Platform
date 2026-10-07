(function(){
const M=Manarat,$=id=>document.getElementById(id);
let profileEditing=false;
function teacherId(){return M.currentTeacherId()}
function profileGender(){return M.normalizedGender((M.store().profile||{}).educator_gender||(M.store().platform||{}).uiGender||'female')}
function teacherAvatarMarkup(p){
  const avatar=String(p.avatar||'').trim();
  const g=M.normalizedGender(p.educator_gender||profileGender());
  const icon=String(p.icon||'').trim() || (g==='male'?'👨‍🏫':'👩‍🏫');
  if(avatar) return `<img src="${M.attr(avatar)}" alt="الصورة التعريفية">`;
  return `<div class="emoji">${M.esc(icon)}</div>`;
}
function resizeAvatarFile(file,maxSize=520,quality=.86){
  return new Promise(resolve=>{
    try{if(!file||!String(file.type||'').startsWith('image/'))return resolve(null);const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{try{let w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;const scale=Math.min(1,maxSize/Math.max(w,h));w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',quality));}catch(e){URL.revokeObjectURL(url);resolve(null)}};img.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};img.src=url;}catch(e){resolve(null)}
  })
}
async function persistProfileMetadata(p){
  try{
    const sess=M.authSession&&M.authSession(),cloud=((M.store().platform||{}).cloud)||{};
    if(!(sess&&sess.access_token&&cloud.supabaseUrl&&cloud.publishableKey))return;
    const url=String(cloud.supabaseUrl||'').replace(/\/$/,'')+'/auth/v1/user';
    const payload={data:{name:p.name||'',school:p.school||'',avatar:p.avatar||'',icon:p.icon||'',educator_gender:p.educator_gender||'female'}};
    const res=await fetch(url,{method:'PUT',headers:{apikey:String(cloud.publishableKey||''),Authorization:'Bearer '+sess.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!res.ok){const j=await res.json().catch(()=>({}));throw new Error(j.msg||j.message||'تعذر تحديث بيانات الحساب')}
    const j=await res.json().catch(()=>({}));
    if(j&&j.user&&sess){sess.user=j.user;localStorage.setItem(M.AUTH_SESSION_KEY,JSON.stringify(sess))}
  }catch(err){console.warn('persistProfileMetadata',err)}
}
async function saveTeacherProfile(){
  const s=M.store(),p=s.profile||{};
  const name=($('profileNameInput')?.value||'').trim();
  const school=($('profileSchoolInput')?.value||'').trim();
  const gender=M.normalizedGender($('profileGenderSelect')?.value||p.educator_gender||'female');
  const icon=($('profileIconInput')?.value||'').trim() || (gender==='male'?'👨‍🏫':'👩‍🏫');
  if(!name)return M.toast('اكتب اسم '+(gender==='male'?'المعلم':'المعلمة'),'error');
  p.name=name;p.school=school;p.icon=icon;p.educator_gender=gender;
  s.profile=p;s.platform=s.platform||{};s.platform.uiGender=gender;s.platform.educatorGender=gender;
  s.teachers=(s.teachers||[]).map(t=>(t.id===p.id||String(t.email||'').toLowerCase()===String(p.email||'').toLowerCase())?{...t,...p}:t);
  if(!s.teachers.some(t=>t.id===p.id||String(t.email||'').toLowerCase()===String(p.email||'').toLowerCase()))s.teachers.unshift({...p,status:'نشط'});
  s.games=(s.games||[]).map(g=>(g.teacher_id===p.id||String(g.teacher_email||'').toLowerCase()===String(p.email||'').toLowerCase())?{...g,teacher:p.name,school:p.school,teacher_gender:gender}:g);
  M.saveStore(s);await persistProfileMetadata(p);await M.cloudUpsertProfile?.(p).catch(e=>console.warn('profile table sync failed',e));await M.cloudSyncTables?.().catch(e=>console.warn('profile cloud refresh failed',e));profileEditing=false;render();M.toast('تم حفظ الملف التعريفي وتحديث صيغة المنصة بنجاح');
}
async function handleTeacherAvatarUpload(ev){
  const file=ev?.target?.files?.[0];if(!file)return;let url='';
  try{url=await M.cloudUploadFile(file,{bucket:'manarat-assets',folder:'avatars'});M.toast('تم رفع الصورة إلى التخزين السحابي')}catch(e){console.warn('cloud avatar upload failed',e);url=(await resizeAvatarFile(file))||await M.fileToDataURL(file);M.toast('تعذر الرفع السحابي، فتم حفظ الصورة محليًا مؤقتًا.','warn')}
  const s=M.store(),p=s.profile||{};p.avatar=url;s.profile=p;s.teachers=(s.teachers||[]).map(t=>(t.id===p.id||String(t.email||'').toLowerCase()===String(p.email||'').toLowerCase())?{...t,...p}:t);M.saveStore(s);await persistProfileMetadata(p);await M.cloudUpsertProfile?.(p).catch(e=>console.warn('profile avatar sync failed',e));render();ev.target.value='';M.toast('تم تحديث الصورة التعريفية')
}
async function clearTeacherAvatar(){const s=M.store(),p=s.profile||{};p.avatar='';s.profile=p;s.teachers=(s.teachers||[]).map(t=>(t.id===p.id||String(t.email||'').toLowerCase()===String(p.email||'').toLowerCase())?{...t,...p}:t);M.saveStore(s);await persistProfileMetadata(p);await M.cloudUpsertProfile?.(p).catch(e=>console.warn('profile avatar clear sync failed',e));render();M.toast('تم حذف الصورة التعريفية')}
function ownsGame(g,s=M.store()){const p=s.profile||{},tid=teacherId(),email=String(p.email||'').toLowerCase();return String(g.teacher_id||'')===String(tid)||String(g.teacher_email||'').toLowerCase()===email||(!g.teacher_id&&!g.teacher_email)}
function visibleGames(s){return (s.games||[]).filter(g=>ownsGame(g,s))}
function sharedGames(s){return (s.games||[]).filter(g=>g.share_with_teachers===true&&!ownsGame(g,s)&&(g.sharing_status==='approved'||g.shared_approved===true||(s.platform&&s.platform.publicLibraryRequiresApproval===false)))}
function renderTeacherMessages(s){const p=s.profile||{},email=String(p.email||'').toLowerCase(),id=p.id;const msgs=(s.messages||[]).filter(m=>m.to==='all'||m.to===id||String(m.to||'').toLowerCase()===email||String(m.from||'').toLowerCase()===email).slice().reverse().slice(0,12);const box=$('teacherMessages');if(!box)return;box.innerHTML=msgs.map(m=>`<div class="card" style="margin-top:10px"><h3>${M.esc(m.subject||'رسالة')}</h3><p class="muted">من: ${M.esc(m.from_name||m.from||'')} · ${new Date(m.created_at).toLocaleString('ar')}</p><p>${M.esc(m.body||'')}</p></div>`).join('')||'<p class="muted">لا توجد رسائل بعد.</p>'}
function renderSharedLibrary(s){const box=$('sharedGamesGrid');if(!box)return;const term=($('sharedSearch')?.value||'').trim();const subj=($('sharedSubjectFilter')?.value||'').trim();const grade=($('sharedGradeFilter')?.value||'').trim();const list=sharedGames(s).filter(g=>(!term||String(g.title||'').includes(term)||String(g.subject||'').includes(term)||String(g.grade||'').includes(term)||String(g.teacher||'').includes(term))&&(!subj||String(g.subject||'').includes(subj))&&(!grade||String(g.grade||'').includes(grade))); box.innerHTML=list.map(g=>`<div class="card game-card premium-game-card shared-premium-card"><div class="game-card-head"><div class="badge">🤝</div><div><h3>${M.esc(g.title)}</h3><p class="muted">${M.esc(g.subject||'')} · ${M.esc(g.grade||'')}</p></div></div><div class="game-meta-row"><span>${Number((g.questions||[]).length)} سؤال</span><span>منشئها: ${M.esc(g.teacher||g.teacher_email||'')}</span></div><div class="q-actions"><a class="btn dark small" target="_blank" href="../player/game.html?game=${encodeURIComponent(g.id)}">معاينة</a><button class="btn small" onclick="copySharedGame('${M.attr(g.id)}')">نسخ إلى مكتبتي</button></div></div>`).join('')||'<div class="card empty-state-premium"><div class="badge">🤝</div><h3>لا توجد ألعاب مشتركة الآن</h3><p class="muted">ستظهر هنا الألعاب التي يتيحها المعلمون للمشاركة بعد اعتمادها.</p></div>'}
window.copySharedGame=async function(id){const s=M.store(),p=s.profile||{};const src=(s.games||[]).find(g=>String(g.id)===String(id));if(!src)return M.toast('لم يتم العثور على اللعبة','error');const copy=JSON.parse(JSON.stringify(src));copy.id=M.uuid();copy.title='نسخة من '+(src.title||'لعبة');copy.teacher_id=p.id||M.currentTeacherId();copy.teacher_email=p.email||'';copy.teacher=p.name||'';copy.school=p.school||'';copy.show_in_home_public=false;copy.share_with_teachers=false;copy.created_at=new Date().toISOString();copy.updated_at=new Date().toISOString();s.games.unshift(copy);M.saveStore(s);try{await M.cloudUpsertGame?.(copy);await M.cloudSyncTables?.()}catch(e){console.warn(e);M.toast('تم النسخ محليًا، وتعذرت المزامنة مؤقتًا','warn')}render();M.toast('تم نسخ اللعبة إلى مكتبتك ويمكنك تعديلها الآن')}
window.sendTeacherMessage=function(){const s=M.store(),p=s.profile||{};const body=($('teacherMsgBody')?.value||'').trim();if(!body)return M.toast('اكتب نص الرسالة','error');s.messages=s.messages||[];s.messages.push({id:M.uuid(),from:p.email||p.id,from_name:p.name||(p.educator_gender==='male'?'المعلم':'المعلمة'),to:'admins',to_name:'إدارة المنصة',subject:($('teacherMsgSubject')?.value||'رسالة من '+(p.educator_gender==='male'?'المعلم':'المعلمة')).trim(),body,read:false,created_at:new Date().toISOString()});M.saveStore(s);$('teacherMsgBody').value='';$('teacherMsgSubject').value='';renderTeacherMessages(M.store());M.toast('تم إرسال الرسالة للأدمن')}
window.toggleTeacherProfileEdit=function(show=true){profileEditing=!!show;render();setTimeout(()=>{if(profileEditing)$('profileNameInput')?.focus()},60)};
window.saveTeacherProfile=saveTeacherProfile;
window.clearTeacherAvatar=clearTeacherAvatar;
function render(){
  const s=M.store(),term=($('search')?.value||'').trim(),p=s.profile||{},gender=M.normalizedGender(p.educator_gender||s.platform?.uiGender||'female'),pack=M.genderPack(gender);
  if($('teacherNameBadge'))$('teacherNameBadge').innerHTML=`<span class="teacher-nav-avatar">${p.avatar?`<img src="${M.attr(p.avatar)}" alt="">`:`<span>${M.esc(p.icon||(gender==='male'?'👨‍🏫':'👩‍🏫'))}</span>`}</span><span class="teacher-nav-text"><span class="teacher-nav-title">${M.esc(p.name||pack.teacher)}</span><span class="teacher-nav-school">${M.esc(p.school||'اسم المدرسة')}</span></span>`;
  if($('teacherProfileTitle'))$('teacherProfileTitle').textContent=p.name||pack.teacher;if($('teacherProfileSchool'))$('teacherProfileSchool').textContent=p.school||'اسم المدرسة';
  if($('profileNameInput'))$('profileNameInput').value=p.name||'';if($('profileSchoolInput'))$('profileSchoolInput').value=p.school||'';if($('profileIconInput'))$('profileIconInput').value=p.icon||(gender==='male'?'👨‍🏫':'👩‍🏫');if($('profileGenderSelect'))$('profileGenderSelect').value=gender;
  if($('teacherAvatarBox'))$('teacherAvatarBox').innerHTML=teacherAvatarMarkup(p);if($('teacherProfileForm'))$('teacherProfileForm').style.display=profileEditing?'grid':'none';if($('teacherProfileActions'))$('teacherProfileActions').style.display=profileEditing?'flex':'flex';
  let games=visibleGames(s).filter(g=>!term||String(g.title||'').includes(term)||String(g.subject||'').includes(term));const ids=new Set(games.map(g=>g.id));const attempts=(s.attempts||[]).filter(a=>ids.has(a.game_id));
  if($('gamesCount'))$('gamesCount').textContent=games.length;if($('questionsCount'))$('questionsCount').textContent=games.reduce((a,g)=>a+((g.questions||[]).length||0),0);if($('attemptsCount'))$('attemptsCount').textContent=attempts.length;const avg=attempts.length?Math.round(attempts.reduce((a,b)=>a+Number(b.score||0),0)/attempts.length):0;if($('avgScore'))$('avgScore').textContent=avg+'%';
  if($('gamesGrid'))$('gamesGrid').innerHTML=games.map(g=>`<div class="card game-card premium-game-card"><div class="game-card-head"><div class="badge">🎮</div><div><h3>${M.esc(g.title)}</h3><p class="muted">${M.esc(g.subject||'بدون مادة')} · ${M.esc(g.grade||'بدون صف')}</p></div></div><div class="game-meta-row"><span>${(g.questions||[]).length||0} سؤال</span><span>${g.show_in_home_public?'ظاهر في الرئيسية':'خاص'}</span><span>${g.share_with_teachers?'متاح للمشاركة':'غير مشارك'}</span></div><div class="q-actions"><a class="btn small" href="create-game.html?edit=${encodeURIComponent(g.id)}">تعديل</a><a class="btn dark small" target="_blank" href="../player/game.html?game=${encodeURIComponent(g.id)}">تشغيل</a><button class="btn small" onclick="Manarat.copyText(Manarat.getGameLink('${g.id}'))">نسخ الرابط</button><button class="btn small" onclick="exportGame('${g.id}')">تصدير</button></div></div>`).join('')||`<div class="card empty-state-premium"><div class="badge">✨</div><h3>لا توجد ألعاب بعد</h3><p class="muted">ابدأ بإنشاء أول لعبة تعليمية تفاعلية من الزر بالأعلى.</p><a class="btn" href="create-game.html">+ إنشاء لعبة</a></div>`;
  const rows=attempts.slice().reverse().slice(0,20).map(a=>`<tr><td>${M.esc(a.student_name)}</td><td>${M.esc((s.games.find(g=>g.id===a.game_id)||{}).title||a.game_id)}</td><td>${a.score}%</td><td>${M.seconds(a.time_spent)}</td><td>${new Date(a.created_at).toLocaleString('ar')}</td></tr>`).join('');
  renderTeacherMessages(s);renderSharedLibrary(s);if($('attemptsTable'))$('attemptsTable').innerHTML=`<table class="table"><thead><tr><th>الاسم</th><th>اللعبة</th><th>الدرجة</th><th>الوقت</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table>`;M.applyGenderQuickText(document);M.applyAdminVisibility?.();
}
window.exportGame=function(id){const g=M.store().games.find(x=>x.id===id);if(g)M.exportStandalone(g)};
document.addEventListener('DOMContentLoaded',async()=>{await M.authRefreshSession();if(!M.requireTeacherAuth())return;await M.cloudSyncTables?.();render();$('search')?.addEventListener('input',render);$('sharedSearch')?.addEventListener('input',()=>renderSharedLibrary(M.store()));$('sharedSubjectFilter')?.addEventListener('input',()=>renderSharedLibrary(M.store()));$('sharedGradeFilter')?.addEventListener('input',()=>renderSharedLibrary(M.store()));$('teacherAvatarFile')?.addEventListener('change',handleTeacherAvatarUpload)});
document.addEventListener('manarat:store-updated',render);document.addEventListener('manarat:auth-updated',render);
})();
