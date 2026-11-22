(function(){
const M=window.Manarat,$=id=>document.getElementById(id);let current=M.store();
function fresh(){current=M.store();return current} function p(){return fresh().platform}
function val(id,v){const el=$(id);if(el)el.value=v??''} function chk(id,v){const el=$(id);if(el)el.checked=!!v}
function parseJSON(value,fallback){try{return JSON.parse(value)}catch{M.toast('صيغة JSON غير صحيحة','error');return fallback}}
function readPlatform(){const old=p();return {...old,questionSize:Number($('questionSize')?.value||old.questionSize),answerSize:Number($('answerSize')?.value||old.answerSize),cardRadius:Number($('cardRadius')?.value||old.cardRadius),uiGender:$('uiGender')?.value||old.uiGender||'female',educatorGender:$('educatorGender')?.value||old.educatorGender||'female',playerFx:!!$('playerFx')?.checked,playerSounds:!!$('playerSounds')?.checked,hoverSounds:!!$('hoverSounds')?.checked,intro:!!$('intro')?.checked,maxAIQuestions:Number($('maxAIQuestions')?.value||old.maxAIQuestions||20),cloud:{...old.cloud,enabled:!!$('cloudEnabled')?.checked,supabaseUrl:$('supabaseUrl')?.value||old.cloud?.supabaseUrl||'',publishableKey:$('supabaseKey')?.value||old.cloud?.publishableKey||'',syncMode:$('cloudSyncMode')?.value||old.cloud?.syncMode||'supabase_first'},ai:{...old.ai,endpoint:$('aiEndpoint')?.value||'',apiKey:'',model:$('aiModel')?.value||'gemini-2.5-flash',temperature:Number($('aiTemperature')?.value||old.ai?.temperature||0.3),useEdgeFunction:!!$('aiUseEdge')?.checked,edgeFunctionName:$('aiEdgeFunctionName')?.value||old.ai?.edgeFunctionName||'dynamic-handler'}}}
function fill(){
  const platform=fresh().platform;
  for(const key of ['questionSize','answerSize','cardRadius','uiGender','educatorGender','maxAIQuestions'])val(key,platform[key]);
  for(const key of ['playerFx','playerSounds','hoverSounds','intro'])chk(key,platform[key]!==false);
  val('supabaseUrl',platform.cloud?.supabaseUrl);val('supabaseKey',platform.cloud?.publishableKey);
  val('cloudSyncMode',platform.cloud?.syncMode||'supabase_first');chk('cloudEnabled',platform.cloud?.enabled!==false);
  val('aiEndpoint',platform.ai?.endpoint);val('aiKey',platform.ai?.apiKey);val('aiModel',platform.ai?.model);
  val('aiTemperature',platform.ai?.temperature??0.3);val('aiEdgeFunctionName',platform.ai?.edgeFunctionName||'dynamic-handler');
  chk('aiUseEdge',platform.ai?.useEdgeFunction!==false);
  renderAll();
}
window.savePlatform=async function(){
  const s=fresh();
  const nextPlatform={...readPlatform(),updated_at:new Date().toISOString()};
  s.platform=nextPlatform;
  addAudit('تحديث إعدادات المنصة','platform',{
    section:'platform',
    logo:!!nextPlatform.logoImage,
    mark:!!nextPlatform.markImage
  });
  M.saveStore(s);
  M.applyPlatform();
  M.renderSiteFooter?.();
  try{
    // حفظ مباشر وقسري لإعدادات المنصة في platform_state قبل أي دمج أو قراءة.
    await M.cloudForceSavePlatform?.(s);
    await M.cloudSyncTables?.();
    fill();
    M.toast('تم حفظ إعدادات المنصة في السحابة وتحديثها بنجاح');
  }catch(e){
    M.toast('تعذر الحفظ السحابي: '+(e.message||e),'error')
  }
}
window.setGeminiPreset=function(){
  $('aiEndpoint').value='https://generativelanguage.googleapis.com/v1beta/models';
  $('aiModel').value='gemini-2.5-flash';
  $('aiKey').value='';
  if($('aiUseEdge')) $('aiUseEdge').checked=true;
  M.toast('تم ضبط Gemini عبر Edge Function الآمنة. مفتاح Gemini يبقى داخل Supabase Secrets فقط.');
}

window.copySupabaseSetupText=function(){
  const txt=`Supabase Project URL:\nhttps://yltlzogrhwvnmxcnaesu.supabase.co\n\nSupabase publishable / anon key:\nsb_publishable_W-XxH2FTvSZq66b-eHt-TQ_a8ZuqGRD\n\nSQL لتحديث قاعدة قائمة:\nsupabase/01_UPGRADE_V17_1.sql\nSQL لمشروع جديد فقط:\nsupabase/00_START_HERE_CREATE_DATABASE.sql\n\nبعد النشر أضف رابط الموقع المنشور في:\nAuthentication → URL Configuration → Site URL + Redirect URLs`;
  M.copyText(txt);
}
window.copyGeminiSetupText=function(){
  const txt=`إعداد Gemini الآمن عبر Supabase Edge Function:\n\nEdge Function name:\ndynamic-handler\n\nSupabase Secret name:\nGEMINI_API_KEY\n\nModel:\ngemini-2.5-flash\n\nاترك API Key فارغًا في الواجهة عند استخدام Edge Function.`;
  M.copyText(txt);
}

window.testAIProvider=async function(){await savePlatform();await M.testAIConnection();}

window.testSupabaseProvider=async function(){await savePlatform();await M.testCloudConnection();}
window.syncCloudTablesNow=async function(){await M.syncCloudNow?.();renderAll();}
window.forceReloadPlatformFromCloud=async function(){try{await M.cloudSyncTables?.();fill();M.applyPlatform?.();M.renderSiteFooter?.();M.toast('تم سحب إعدادات المنصة من السحابة')}catch(e){M.toast('تعذر سحب إعدادات المنصة: '+(e.message||e),'error')}}

document.addEventListener('manarat:store-updated',()=>{fill();});

async function saveAdminState(s,msg='تم الحفظ والمزامنة',opts={}){
  M.saveStore(s);
  try{
    if(!await M.syncCloudNow())throw new Error('تعذر تأكيد المزامنة');
    await M.cloudSyncTables?.();
  }catch(e){
    console.warn('admin cloud sync failed',e);
    if(opts.warn!==false)M.toast('تم الحفظ محليًا، وتعذرت المزامنة السحابية: '+(e.message||e),'warn');if(opts.render!==false)renderAll();return false;
  }
  if(opts.render!==false)renderAll();
  if(msg)M.toast(msg);
}

function addAudit(action,target='',details={}){
  const s=current||fresh();
  const p=M.currentProfile?.()||{};
  s.auditLogs=Array.isArray(s.auditLogs)?s.auditLogs:[];
  s.auditLogs.unshift({id:M.uuid(),action,target,details,admin_email:p.email||'',admin_name:p.name||'الأدمن',created_at:new Date().toISOString()});
  s.auditLogs=s.auditLogs.slice(0,500);
  M.cloudInsertAudit?.(s.auditLogs[0]).catch?.(e=>console.warn('cloud audit insert failed',e));
}
function renderAudit(){
  const s=fresh();
  const logs=(s.auditLogs||[]).slice(0,120);
  const el=$('auditList'); if(!el)return;
  el.innerHTML=logs.map(l=>`<div class="card"><div class="toolbar"><div><h3>${M.esc(l.action||'عملية')}</h3><p class="muted">${M.esc(l.target||'')} · ${M.esc(l.admin_name||l.admin_email||'')} · ${new Date(l.created_at).toLocaleString('ar')}</p></div></div>${l.details?`<pre class="mini-code">${M.esc(JSON.stringify(l.details,null,2)).slice(0,800)}</pre>`:''}</div>`).join('')||'<p class="muted">لا توجد عمليات مسجلة بعد.</p>';
}
window.exportAuditLog=function(){const s=fresh();M.downloadFile('abu-ubaida-audit-log.json',JSON.stringify(s.auditLogs||[],null,2),'application/json;charset=utf-8')}
window.clearAuditLog=async function(){if(!confirm('مسح سجل العمليات؟'))return;const s=fresh();s.auditLogs=[];M.saveStore(s);try{await M.syncCloudNow?.()}catch(e){}renderAudit();M.toast('تم مسح سجل العمليات محليًا ومزامنة الحالة')}
function renderBanks(){const s=fresh();$('banksList').innerHTML=(s.questionBanks||[]).map(b=>`<div class="card"><h3>${M.esc(b.title)}</h3><p class="muted">${M.esc(b.subject||'')} · ${b.questions?.length||0} سؤال</p><button class="btn small" onclick="exportBank('${b.id}')">تصدير</button><button class="btn bad small" onclick="deleteBank('${b.id}')">حذف</button></div>`).join('')||'<p class="muted">لا توجد بنوك بعد.</p>'}
window.addBank=async function(){const s=fresh();const q=M.normalizeQuestions(parseJSON($('bankJSON').value,{questions:[]}));if(!q.length)return M.toast('لم يتم العثور على أسئلة صحيحة','error');s.questionBanks.push({id:M.uuid(),title:$('bankTitle').value||'بنك جديد',subject:$('bankSubject').value||'',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),questions:q});addAudit('إضافة بنك أسئلة','bank',{title:$('bankTitle').value||'بنك جديد'});$('bankJSON').value='';await saveAdminState(s,'تمت إضافة بنك الأسئلة ومزامنته')}
window.deleteAllBanks=async function(){if(!confirm('حذف كل بنوك الأسئلة؟'))return;const s=fresh();s.questionBanks=[];addAudit('حذف كل بنوك الأسئلة','bank');await saveAdminState(s,'تم حذف كل البنوك ومزامنتها')}
window.deleteBank=async function(id){const s=fresh();s.questionBanks=s.questionBanks.filter(b=>b.id!==id);addAudit('حذف بنك أسئلة','bank',{id});await saveAdminState(s,'تم حذف البنك ومزامنته')}
window.exportBank=function(id){const b=fresh().questionBanks.find(x=>x.id===id);if(b)M.downloadFile(M.sanitizeFilename(b.title)+'.json',JSON.stringify(b,null,2),'application/json;charset=utf-8')}
function statusBadge(label,status){const st=status||'private';const txt=st==='approved'?'معتمد':st==='pending'?'بانتظار الاعتماد':'خاص';return `<span class="approval-badge ${st}">${M.esc(label)}: ${txt}</span>`}
function renderGames(){const s=fresh();$('gamesList').innerHTML=(s.games||[]).map(g=>`<div class="card game-control-card"><div class="toolbar"><div><h3>${M.esc(g.title)}</h3><p class="muted">${M.esc(g.subject||'')} · ${M.esc(g.grade||'')} · ${g.questions?.length||0} سؤال · ${M.esc(g.teacher||g.teacher_email||'')}</p><p>${statusBadge('الرئيسية',g.public_status||(g.show_in_home_public?'pending':'private'))} ${statusBadge('المشاركة',g.sharing_status||(g.share_with_teachers?'pending':'private'))}</p></div><div class="q-actions"><a class="btn small" href="../teacher/create-game.html?edit=${encodeURIComponent(g.id)}">تعديل كامل</a><a class="btn dark small" href="../player/game.html?game=${encodeURIComponent(g.id)}" target="_blank">تشغيل</a><button class="btn small" onclick="M.copyText(M.getGameLink('${g.id}'))">نسخ الرابط</button><button class="btn small" onclick="exportGame('${g.id}')">تصدير لعبة</button><button class="btn ghost small" onclick="approveGamePublic('${g.id}')">اعتماد للرئيسية</button><button class="btn ghost small" onclick="approveGameShared('${g.id}')">اعتماد للمشاركة</button><button class="btn bad small" onclick="deleteGame('${g.id}')">حذف</button></div></div></div>`).join('')||'<p class="muted">لا توجد ألعاب.</p>'}
function renderApprovals(){const s=fresh();const list=(s.games||[]).filter(g=>(g.show_in_home_public&&g.public_status!=='approved')||(g.share_with_teachers&&g.sharing_status!=='approved'));const box=$('approvalsList');if(!box)return;box.innerHTML=list.map(g=>`<div class="card"><div class="toolbar"><div><h3>${M.esc(g.title)}</h3><p class="muted">${M.esc(g.subject||'')} · ${M.esc(g.grade||'')} · منشئها: ${M.esc(g.teacher||g.teacher_email||'')}</p><p>${g.show_in_home_public?statusBadge('طلب الظهور في الرئيسية',g.public_status||'pending'):''} ${g.share_with_teachers?statusBadge('طلب المشاركة مع المعلمين',g.sharing_status||'pending'):''}</p></div><div class="q-actions">${g.show_in_home_public?`<button class="btn small" onclick="approveGamePublic('${g.id}')">اعتماد الرئيسية</button>`:''}${g.share_with_teachers?`<button class="btn small" onclick="approveGameShared('${g.id}')">اعتماد المشاركة</button>`:''}<button class="btn bad small" onclick="rejectGameSharing('${g.id}')">رفض الطلبات</button></div></div></div>`).join('')||'<p class="muted">لا توجد طلبات اعتماد معلقة.</p>'}
window.approveGamePublic=async function(id){const s=fresh();const g=s.games.find(x=>String(x.id)===String(id));if(!g)return;g.show_in_home_public=true;g.public_status='approved';g.public_approved=true;g.updated_at=new Date().toISOString();M.saveStore(s);try{await M.cloudUpsertGame?.(g);await M.syncCloudNow?.();await M.cloudSyncTables?.()}catch(e){console.warn(e)}renderAll();M.toast('تم اعتماد اللعبة للظهور في الرئيسية ومزامنتها')}
window.approveGameShared=async function(id){const s=fresh();const g=s.games.find(x=>String(x.id)===String(id));if(!g)return;g.share_with_teachers=true;g.sharing_status='approved';g.shared_approved=true;g.updated_at=new Date().toISOString();M.saveStore(s);try{await M.cloudUpsertGame?.(g);await M.syncCloudNow?.();await M.cloudSyncTables?.()}catch(e){console.warn(e)}renderAll();M.toast('تم اعتماد اللعبة في مكتبة المشاركة ومزامنتها')}
window.rejectGameSharing=async function(id){const s=fresh();const g=s.games.find(x=>String(x.id)===String(id));if(!g)return;g.show_in_home_public=false;g.share_with_teachers=false;g.public_status='private';g.sharing_status='private';g.public_approved=false;g.shared_approved=false;g.updated_at=new Date().toISOString();M.saveStore(s);try{await M.cloudUpsertGame?.(g);await M.syncCloudNow?.();await M.cloudSyncTables?.()}catch(e){console.warn(e)}renderAll();M.toast('تم رفض طلبات النشر والمشاركة ومزامنتها')}
window.exportGame=function(id){const g=fresh().games.find(x=>x.id===id);if(g)M.exportStandalone(g)}
window.deleteGame=async function(id){if(!confirm('حذف اللعبة؟'))return;const s=fresh();s.games=s.games.filter(g=>g.id!==id);s.attempts=s.attempts.filter(a=>a.game_id!==id);M.saveStore(s);try{await M.cloudDeleteGame?.(id);await M.syncCloudNow?.();await M.cloudSyncTables?.()}catch(e){console.warn(e)}renderAll();M.toast('تم حذف اللعبة ومزامنتها')}
function renderMessages(){const s=fresh();const teachers=s.teachers||[];if($('msgTarget'))$('msgTarget').innerHTML='<option value="all">كل المعلمين/المعلمات</option>'+teachers.map(t=>`<option value="${M.attr(t.id)}">${M.esc(t.name||t.email)}</option>`).join('');const msgs=(s.messages||[]).slice().reverse();$('messagesList').innerHTML=msgs.map(m=>`<div class="card"><div class="toolbar"><div><h3>${M.esc(m.subject||'رسالة')}</h3><p class="muted">من: ${M.esc(m.from_name||m.from||'')} → إلى: ${M.esc(m.to_name||m.to||'')} · ${new Date(m.created_at).toLocaleString('ar')}</p></div><button class="btn bad small" onclick="deleteMessage('${m.id}')">حذف</button></div><p>${M.esc(m.body||'')}</p></div>`).join('')||'<p class="muted">لا توجد رسائل بعد.</p>'}
window.sendAdminMessage=async function(){const s=fresh(),p=M.currentProfile();const to=$('msgTarget')?.value||'all';const teacher=(s.teachers||[]).find(t=>t.id===to);const body=($('msgBody')?.value||'').trim();if(!body)return M.toast('اكتب نص الرسالة','error');s.messages=s.messages||[];s.messages.push({id:M.uuid(),from:p.email||'admin',from_name:p.name||'الأدمن',to,to_name:to==='all'?'كل المعلمين/المعلمات':(teacher?.name||teacher?.email||to),subject:($('msgSubject')?.value||'رسالة من الأدمن').trim(),body,read:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});addAudit('إرسال رسالة','messages',{to});$('msgBody').value='';$('msgSubject').value='';try{await M.cloudUpsertMessage(s.messages[s.messages.length-1])}catch(e){M.toast('تعذر إرسال الرسالة: '+e.message,'error');return}await saveAdminState(s,'تم إرسال الرسالة ومزامنتها')}
window.deleteMessage=async function(id){try{await M.cloudDeleteMessage(id)}catch(e){M.toast('تعذر حذف الرسالة: '+e.message,'error');return}const s=fresh();s.messages=(s.messages||[]).filter(m=>m.id!==id);addAudit('حذف رسالة','messages',{id});await saveAdminState(s,'تم حذف الرسالة ومزامنتها')}

function renderAll(){renderBanks();renderGames();renderMessages();renderApprovals();renderAudit?.()}

let lastSystemHealth=[];
async function healthItem(name,fn){
  const started=Date.now();
  try{const detail=await fn();return{ok:true,name,detail:detail||'جاهز',ms:Date.now()-started}}
  catch(e){return{ok:false,name,detail:e.message||String(e),ms:Date.now()-started}}
}
function renderHealth(items){
  lastSystemHealth=items||lastSystemHealth||[];
  const el=$('systemHealthList'); if(!el)return;
  el.innerHTML=lastSystemHealth.map(x=>`<div class="card health-card ${x.ok?'ok':'bad'}"><div class="toolbar"><div><h3>${x.ok?'✅':'⚠️'} ${M.esc(x.name)}</h3><p class="muted">${M.esc(x.detail||'')} · ${x.ms||0}ms</p></div></div></div>`).join('')||'<p class="muted">اضغط تشغيل الفحص الآن.</p>';
}
window.runSystemHealth=async function(){
  const s=fresh(), cloud=s.platform?.cloud||{}, ai=s.platform?.ai||{};
  const base=String(cloud.supabaseUrl||'').replace(/\/+$/,'');
  const key=String(cloud.publishableKey||'').trim();
  const token=M.authSession?.()?.access_token||'';
  const items=[];
  items.push(await healthItem('إعدادات Supabase',async()=>{if(!cloud.enabled||!base||!key)throw new Error('إعدادات Supabase غير مكتملة');return 'الرابط والمفتاح موجودان'}));
  items.push(await healthItem('الاتصال بقاعدة البيانات',async()=>{if(!await M.cloudSyncTables())throw new Error('تعذرت قراءة بعض الجداول');return'تمت قراءة البيانات والجداول'}));
  items.push(await healthItem('حفظ إعدادات المنصة والفوتر',async()=>{if(!M.isAdmin())throw new Error('يتطلب حساب أدمن للحفظ');if(!await M.syncCloudNow())throw new Error('لم يتم تأكيد الحفظ');return'تم الحفظ والمزامنة'}));
  items.push(await healthItem('دالة الذكاء الاصطناعي dynamic-handler',async()=>{if(!base||!key)return'إعدادات Supabase غير مكتملة';const r=await fetch(base+'/functions/v1/'+(ai.edgeFunctionName||'dynamic-handler'),{method:'OPTIONS'});if(!r.ok)throw new Error('استجابة: '+r.status);return 'استجابة OPTIONS فقط؛ التشغيل الفعلي يحتاج تجربة'}));
  items.push(await healthItem('دالة حذف المعلم dynamic-api',async()=>{if(!base||!key)return'إعدادات Supabase غير مكتملة';const r=await fetch(base+'/functions/v1/dynamic-api',{method:'OPTIONS'});if(!r.ok)throw new Error('استجابة: '+r.status);return 'استجابة OPTIONS فقط؛ التشغيل الفعلي يحتاج تجربة'}));
  items.push(await healthItem('جلسة الأدمن',async()=>M.isAdmin()?(token?'أدمن بجلسة Supabase حقيقية':'أدمن محلي/جلسة غير حقيقية'):'الحساب الحالي ليس أدمن'));
  items.push(await healthItem('النسخ الاحتياطي',async()=>{const test=JSON.stringify(buildBackupPayload()).length;return'حجم النسخة الحالية تقريبًا '+Math.round(test/1024)+'KB'}));
  renderHealth(items);
  addAudit('تشغيل فحص صحة النظام','system-health',{ok:items.filter(x=>x.ok).length,total:items.length});
}
window.exportSystemHealth=function(){M.downloadFile('abu-ubaida-system-health.json',JSON.stringify(lastSystemHealth||[],null,2),'application/json;charset=utf-8')}

window.runQuestionTypeSelfTest=function(){
  const samples=[
    {type:'multiple_choice',text:'سؤال اختياري',options:['أ','ب','ج'],correct:1},
    {type:'true_false',text:'صح أم خطأ',options:['صح','خطأ'],correct:0},
    {type:'matching',text:'طابق',pairs:[{left:'أ',right:'1'},{left:'ب',right:'2'}]},
    {type:'connecting',text:'وصّل',pairs:[{left:'س1',right:'ج1'},{left:'س2',right:'ج2'}]},
    {type:'ordering',text:'رتب',items:['الأول','الثاني','الثالث']},
    {type:'classification',text:'صنف',categories:[{title:'أ',items:[{kind:'text',text:'كلمة'}]},{title:'ب',items:[{kind:'text',text:'عبارة'}]}]},
    {type:'open_text',text:'اكتب الإجابة',answers:['إجابة']},
    {type:'puzzle_image',text:'بازل',image:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iZ29sZCIvPjwvc3ZnPg==',puzzle_grid:3}
  ];
  const normalized=M.normalizeQuestions({questions:samples});
  const required=['multiple_choice','true_false','matching','connecting','ordering','classification','open_text','puzzle_image'];
  const found=new Set(normalized.map(q=>q.type));
  const missing=required.filter(t=>!found.has(t));
  const result=[{ok:missing.length===0,name:'اختبار أنواع الأسئلة',detail:missing.length?'أنواع مفقودة: '+missing.join(', '):'كل أنواع الأسئلة الأساسية تم قبولها بنجاح',ms:0}];
  renderHealth([...(lastSystemHealth||[]).filter(x=>x.name!=='اختبار أنواع الأسئلة'),...result]);
  addAudit('اختبار أنواع الأسئلة','question-types',{ok:missing.length===0,missing});
  M.toast(missing.length?'يوجد خلل في بعض أنواع الأسئلة':'تم اختبار أنواع الأسئلة بنجاح',missing.length?'warn':'success');
}

function backupArrayMerge(current=[],incoming=[]){
  const map=new Map();
  (Array.isArray(current)?current:[]).forEach(x=>{if(x&&x.id)map.set(String(x.id),x)});
  (Array.isArray(incoming)?incoming:[]).forEach(x=>{if(x&&x.id)map.set(String(x.id),{...(map.get(String(x.id))||{}),...x})});
  return [...map.values()];
}
function buildBackupPayload(){
  const s=fresh();
  return {
    backup_type:'manarat-platform-full',
    backup_version:'15.1.0',
    exported_at:new Date().toISOString(),
    store:s
  };
}
window.exportBackupJSON=function(){
  const payload=buildBackupPayload();
  M.downloadFile('abu-ubaida-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');
  addAudit('تصدير نسخة احتياطية','backup',{size:JSON.stringify(payload).length});
  M.saveStore(fresh());
  M.syncCloudNow?.().catch(()=>{});
  M.toast('تم تصدير النسخة الاحتياطية الكاملة');
}
window.importBackupJSON=async function(file){
  if(!file)return;
  try{
    const txt=await file.text();
    const raw=JSON.parse(txt);
    const data=raw.store||raw.data||raw;
    if(!data||!data.platform)return M.toast('هذا الملف لا يبدو نسخة احتياطية كاملة للمنصة','error');
    if(!confirm('سيتم دمج النسخة الاحتياطية مع البيانات الحالية مع الحفاظ على ربط Supabase والذكاء الاصطناعي الحالي. هل تريد المتابعة؟'))return;
    const s=fresh();
    const currentCloud=s.platform?.cloud||{};
    const currentAI=s.platform?.ai||{};
    const arrays=['games','teachers','questionBanks','attempts','certificates','messages','admins','studentRosters','auditLogs'];
    arrays.forEach(k=>{s[k]=backupArrayMerge(s[k],data[k])});
    s.platform={...s.platform,...(data.platform||{}),cloud:currentCloud,ai:currentAI};
    addAudit('استيراد نسخة احتياطية','backup',{source_version:raw.backup_version||data.version||'unknown'});
    M.saveStore(s);
    await M.syncCloudNow?.();
    await M.cloudSyncTables?.();
    renderAll();
    M.renderSiteFooter?.();
    M.toast('تم استيراد النسخة الاحتياطية ورفعها للسحابة بنجاح');
  }catch(e){M.toast('تعذر استيراد النسخة: '+(e.message||e),'error')}
}

M.qsa('.side-btn').forEach(btn=>btn.addEventListener('click',()=>{
  M.qsa('.admin-tab').forEach(x=>x.style.display='none');
  M.qsa('.side-btn').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  const tab=$('tab-'+btn.dataset.tab);
  if(tab)tab.style.display='block';
  else M.toast('هذا التبويب غير موجود في الصفحة: '+btn.dataset.tab,'warn');
}));

document.addEventListener('click',e=>{
  const q=e.target.closest('[data-jump-tab]');
  if(!q)return;
  const target=q.dataset.jumpTab;
  const btn=document.querySelector(`.side-btn[data-tab="${target}"]`);
  if(btn)btn.click();
});

let legacyLoad;
async function loadLegacyTools(){if(legacyLoad)return legacyLoad;legacyLoad=(async()=>{await M.ensureFreshSession();await M.cloudSyncTables?.();if(!M.requireAdminAuth())return;await M.ensureAdminCloudRole?.();fill();})().catch(e=>{legacyLoad=null;M.toast('تعذر تحميل الأدوات: '+e.message,'error');});return legacyLoad;}
document.addEventListener('click',e=>{const b=e.target.closest('.side-btn');if(b&&!b.dataset.tab.startsWith('school-'))loadLegacyTools();});
document.addEventListener('DOMContentLoaded',async()=>{if(!window.MANARAT_UNIFIED_ADMIN)await loadLegacyTools();renderHealth?.([]);$('backupImportFile')?.addEventListener('change',e=>importBackupJSON(e.target.files?.[0]));});
})();
