(function(){
const M=window.Manarat,$=id=>document.getElementById(id);let current=M.store();
function fresh(){current=M.store();return current} function p(){return fresh().platform}
function val(id,v){const el=$(id);if(el)el.value=v??''} function chk(id,v){const el=$(id);if(el)el.checked=!!v}
function parseJSON(v,f){try{return JSON.parse(v)}catch(e){M.toast('صيغة JSON غير صحيحة','error');return f}}


const HOME_SECTION_DEFAULTS=[
  {id:'heroSection',label:'الواجهة الرئيسية',visible:true},
  {id:'featuresSection',label:'مزايا المنصة',visible:true},
  {id:'showcaseSection',label:'تجربة اللاعب',visible:true},
  {id:'youtubeShowcaseSection',label:'فيديوهات اليوتيوب',visible:true},
  {id:'latestPublicGamesSection',label:'آخر الألعاب المضافة',visible:true},
  {id:'contactWhatsAppSection',label:'نموذج مراسلة واتساب',visible:true},
  {id:'homeFooterCard',label:'فوتر الصفحة الرئيسية',visible:true}
];
function normalizeHomeSections(list=[]){
  const map=new Map();
  (Array.isArray(list)?list:[]).forEach(x=>{if(x&&x.id)map.set(String(x.id),{id:String(x.id),label:String(x.label||x.id),visible:x.visible!==false})});
  const out=[];
  (Array.isArray(list)?list:[]).forEach(x=>{if(x&&x.id&&HOME_SECTION_DEFAULTS.some(d=>d.id===x.id)&&!out.some(y=>y.id===x.id))out.push(map.get(String(x.id)))});
  HOME_SECTION_DEFAULTS.forEach(d=>{if(!out.some(x=>x.id===d.id))out.push(map.get(d.id)||d)});
  return out;
}
function homeSectionIcon(id){
  return {heroSection:'🏠',featuresSection:'✨',showcaseSection:'🎮',youtubeShowcaseSection:'▶️',latestPublicGamesSection:'🆕',contactWhatsAppSection:'💬',homeFooterCard:'🔻'}[id]||'📦'
}
function homeSectionsFromManager(fallback=[]){
  const box=$('homeSectionsManager');
  if(!box)return normalizeHomeSections(fallback&&fallback.length?fallback:HOME_SECTION_DEFAULTS);
  const rows=[...box.querySelectorAll('.home-section-item')];
  if(!rows.length)return normalizeHomeSections(fallback&&fallback.length?fallback:HOME_SECTION_DEFAULTS);
  return normalizeHomeSections(rows.map(row=>({
    id:row.dataset.id,
    label:row.querySelector('.home-section-label')?.textContent?.trim()||row.dataset.id,
    visible:!!row.querySelector('.home-section-visible')?.checked
  })));
}
function renderHomeSectionsManager(list=[]){
  const box=$('homeSectionsManager'); if(!box)return;
  const sections=normalizeHomeSections(list&&list.length?list:HOME_SECTION_DEFAULTS);
  box.innerHTML=sections.map((s,i)=>`<div class="home-section-item ${s.visible===false?'muted-section':''}" draggable="true" data-id="${M.attr(s.id)}">
    <div class="drag-handle" title="اسحب لترتيب القسم">⋮⋮</div>
    <div class="home-section-icon">${homeSectionIcon(s.id)}</div>
    <div class="home-section-info"><b class="home-section-label">${M.esc(s.label)}</b><small>${M.esc(s.id)}</small></div>
    <label class="mini-switch"><input class="home-section-visible" type="checkbox" ${s.visible!==false?'checked':''}><span>${s.visible!==false?'ظاهر':'مخفي'}</span></label>
    <div class="home-section-actions"><button type="button" class="btn tiny" data-move="up">↑</button><button type="button" class="btn tiny" data-move="down">↓</button></div>
  </div>`).join('');
  let dragging=null;
  box.querySelectorAll('.home-section-item').forEach(item=>{
    item.addEventListener('dragstart',e=>{dragging=item;item.classList.add('dragging');e.dataTransfer.effectAllowed='move'});
    item.addEventListener('dragend',()=>{item.classList.remove('dragging');dragging=null});
    item.addEventListener('dragover',e=>{e.preventDefault();const after=getDragAfterElement(box,e.clientY);if(!dragging)return;if(after==null)box.appendChild(dragging);else box.insertBefore(dragging,after)});
    item.querySelector('.home-section-visible')?.addEventListener('change',e=>{item.classList.toggle('muted-section',!e.target.checked);item.querySelector('.mini-switch span').textContent=e.target.checked?'ظاهر':'مخفي'});
  });
  box.querySelectorAll('[data-move]').forEach(btn=>btn.addEventListener('click',()=>{
    const item=btn.closest('.home-section-item');
    if(btn.dataset.move==='up'&&item.previousElementSibling)box.insertBefore(item,item.previousElementSibling);
    if(btn.dataset.move==='down'&&item.nextElementSibling)box.insertBefore(item.nextElementSibling,item);
  }));
}

window.resetHomeSectionsManager=function(){
  renderHomeSectionsManager(HOME_SECTION_DEFAULTS);
  M.toast('تمت استعادة ترتيب أقسام الصفحة الرئيسية افتراضيًا، اضغط حفظ الصفحة الرئيسية لاعتمادها');
}

function getDragAfterElement(container,y){
  const items=[...container.querySelectorAll('.home-section-item:not(.dragging)')];
  return items.reduce((closest,child)=>{
    const box=child.getBoundingClientRect();
    const offset=y-box.top-box.height/2;
    if(offset<0&&offset>closest.offset)return{offset,element:child};
    return closest;
  },{offset:Number.NEGATIVE_INFINITY}).element;
}

function ytIdFromUrl(url=''){
  url=String(url||'').trim();
  const patterns=[/youtu\.be\/([A-Za-z0-9_-]{6,})/,/[?&]v=([A-Za-z0-9_-]{6,})/,/\/embed\/([A-Za-z0-9_-]{6,})/,/\/shorts\/([A-Za-z0-9_-]{6,})/];
  for(const p of patterns){const m=url.match(p);if(m)return m[1]}
  return /^[A-Za-z0-9_-]{6,}$/.test(url)?url:'';
}
function youtubeWatchUrl(v){
  const id=v&&v.id?String(v.id):ytIdFromUrl(v&&v.url);
  return id?`https://www.youtube.com/watch?v=${id}`:String(v&&v.url||'');
}
function youtubeThumbUrl(v){
  const id=v&&v.id?String(v.id):ytIdFromUrl(v&&v.url);
  return v&&v.thumbnail?v.thumbnail:(id?`https://img.youtube.com/vi/${id}/hqdefault.jpg`:'');
}
function normalizeYoutubeVideos(list=[]){
  return (Array.isArray(list)?list:[]).map((v,i)=>{
    if(typeof v==='string')v={url:v};
    const id=String(v.id||ytIdFromUrl(v.url||'')).trim();
    const url=String(v.url||youtubeWatchUrl({id})).trim();
    return {id,title:String(v.title||('فيديو '+(i+1))).trim(),url,thumbnail:String(v.thumbnail||youtubeThumbUrl({id,url})).trim()};
  }).filter(v=>v.id||v.url).slice(0,8);
}
function youtubeVideosFromManager(fallback=[]){
  const box=$('youtubeVideosManager');
  if(!box)return normalizeYoutubeVideos(fallback);
  const rows=[...box.querySelectorAll('.youtube-video-item')];
  return normalizeYoutubeVideos(rows.map(row=>({
    id:row.dataset.id||ytIdFromUrl(row.dataset.url||''),
    title:row.querySelector('.yt-admin-title')?.value||row.dataset.title||'',
    url:row.querySelector('.yt-admin-url')?.value||row.dataset.url||'',
    thumbnail:row.dataset.thumbnail||''
  })));
}
function renderYoutubeVideosManager(list=[]){
  const box=$('youtubeVideosManager'); if(!box)return;
  const videos=normalizeYoutubeVideos(list);
  box.innerHTML=videos.map((v,i)=>`<div class="youtube-video-item" draggable="true" data-id="${M.attr(v.id||'')}" data-url="${M.attr(v.url||'')}" data-title="${M.attr(v.title||'')}" data-thumbnail="${M.attr(v.thumbnail||'')}">
    <div class="drag-handle" title="اسحب لترتيب الفيديو">⋮⋮</div>
    <img class="yt-admin-thumb" src="${M.attr(youtubeThumbUrl(v)||'')}" alt="">
    <div class="yt-admin-fields">
      <input class="input yt-admin-title" value="${M.attr(v.title||('فيديو '+(i+1)))}" placeholder="عنوان الفيديو">
      <input class="input yt-admin-url" value="${M.attr(v.url||youtubeWatchUrl(v))}" placeholder="رابط الفيديو">
    </div>
    <div class="yt-admin-actions">
      <button type="button" class="btn tiny" data-move="up">↑</button>
      <button type="button" class="btn tiny" data-move="down">↓</button>
      <button type="button" class="btn tiny bad" data-remove="1">حذف</button>
    </div>
  </div>`).join('')||'<p class="muted">لم تتم إضافة فيديوهات بعد. أضف رابط فيديو أو اجلب آخر الفيديوهات من القناة.</p>';
  let dragging=null;
  box.querySelectorAll('.youtube-video-item').forEach(item=>{
    item.addEventListener('dragstart',e=>{dragging=item;item.classList.add('dragging');e.dataTransfer.effectAllowed='move'});
    item.addEventListener('dragend',()=>{item.classList.remove('dragging');dragging=null});
    item.addEventListener('dragover',e=>{e.preventDefault();const after=getDragAfterElement(box,e.clientY);if(!dragging)return;if(after==null)box.appendChild(dragging);else box.insertBefore(dragging,after)});
    item.querySelectorAll('.yt-admin-url').forEach(inp=>inp.addEventListener('input',()=>{
      const id=ytIdFromUrl(inp.value);item.dataset.id=id;item.dataset.url=inp.value;const img=item.querySelector('.yt-admin-thumb');if(img&&id)img.src=`https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }));
  });
  box.querySelectorAll('[data-move]').forEach(btn=>btn.addEventListener('click',()=>{
    const item=btn.closest('.youtube-video-item'); if(!item)return;
    if(btn.dataset.move==='up'&&item.previousElementSibling)box.insertBefore(item,item.previousElementSibling);
    if(btn.dataset.move==='down'&&item.nextElementSibling)box.insertBefore(item.nextElementSibling,item);
  }));
  box.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('.youtube-video-item')?.remove()));
}
window.addYoutubeVideoFromInputs=function(){
  const title=($('youtubeVideoTitle')?.value||'').trim();
  const url=($('youtubeVideoUrl')?.value||'').trim();
  if(!url)return M.toast('ضع رابط الفيديو أولًا','warn');
  const current=youtubeVideosFromManager(fresh().platform.youtubeVideos||[]);
  current.push({title:title||('فيديو '+(current.length+1)),url,id:ytIdFromUrl(url)});
  renderYoutubeVideosManager(current);
  if($('youtubeVideoTitle'))$('youtubeVideoTitle').value='';
  if($('youtubeVideoUrl'))$('youtubeVideoUrl').value='';
}
window.fetchLatestYoutubeVideos=async function(){
  const s=fresh(),p=s.platform;
  const channelUrl=($('youtubeChannelUrl')?.value||p.youtubeChannelUrl||p.socialLinks?.youtube||'').trim();
  if(!channelUrl)return M.toast('ضع رابط القناة أولًا','warn');
  try{
    M.toast('جاري جلب آخر فيديوهات القناة...');
    const cloud=p.cloud||{};
    const base=String(cloud.supabaseUrl||'').replace(/\/+$/,'');
    const key=String(cloud.publishableKey||'').trim();
    if(!base||!key)throw new Error('إعدادات Supabase غير مكتملة');
    const res=await fetch(base+'/functions/v1/fetch-youtube-videos',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({channelUrl,limit:5})});
    const json=await res.json().catch(()=>({}));
    if(!res.ok||json.ok===false)throw new Error(json.error||json.message||'تعذر جلب الفيديوهات');
    renderYoutubeVideosManager(json.videos||[]);
    M.toast('تم جلب آخر الفيديوهات، اضغط حفظ الصفحة الرئيسية لاعتمادها');
  }catch(e){
    M.toast('تعذر جلب الفيديوهات: '+(e.message||e),'error');
  }
}

function readPlatform(){const old=p();return {...old,brandName:$('brandName')?.value||old.brandName,brandSubtitle:$('brandSubtitle')?.value||old.brandSubtitle,logoImage:$('logoImage')?.value||old.logoImage,markImage:$('markImage')?.value||old.markImage,accent1:$('accent1')?.value||old.accent1,accent2:$('accent2')?.value||old.accent2,accent3:$('accent3')?.value||old.accent3,background:$('background')?.value||old.background,fontFamily:$('fontFamily')?.value||old.fontFamily,fontScale:Number($('fontScale')?.value||old.fontScale),customBgImage:$('customBgImage')?.value||old.customBgImage,questionSize:Number($('questionSize')?.value||old.questionSize),answerSize:Number($('answerSize')?.value||old.answerSize),cardRadius:Number($('cardRadius')?.value||old.cardRadius),uiGender:$('uiGender')?.value||old.uiGender||'female',educatorGender:$('educatorGender')?.value||old.educatorGender||'female',playerFx:!!$('playerFx')?.checked,playerSounds:!!$('playerSounds')?.checked,hoverSounds:!!$('hoverSounds')?.checked,intro:!!$('intro')?.checked,homeKicker:$('homeKicker')?.value||old.homeKicker,homeTitle:$('homeTitle')?.value||old.homeTitle,homeHighlight:$('homeHighlight')?.value||old.homeHighlight,homeText:$('homeText')?.value||old.homeText,featuresTitle:$('featuresTitle')?.value||old.featuresTitle,featuresSubtitle:$('featuresSubtitle')?.value||old.featuresSubtitle,features:parseJSON($('featuresJSON')?.value||'[]',old.features),showcaseGameTitle:$('showcaseGameTitle')?.value||old.showcaseGameTitle,showcaseGameText:$('showcaseGameText')?.value||old.showcaseGameText,showcaseButtonText:$('showcaseButtonText')?.value||old.showcaseButtonText,homeFooter:$('homeFooter')?.value||old.homeFooter,siteAbout:$('siteAbout')?.value||old.siteAbout,siteContact:$('siteContact')?.value||old.siteContact,contactWhatsApp:$('contactWhatsApp')?.value||'',contactFormTitle:$('contactFormTitle')?.value||old.contactFormTitle,contactFormText:$('contactFormText')?.value||old.contactFormText,showContactForm:!!$('showContactForm')?.checked,whatsappDirect:{...(old.whatsappDirect||{}),enabled:!!$('whatsappDirectEnabled')?.checked,edgeFunctionName:$('whatsappEdgeFunctionName')?.value||'send-whatsapp-message',fallbackToLink:!!$('whatsappFallbackToLink')?.checked,successMessage:$('whatsappSuccessMessage')?.value||'تم إرسال رسالتك بنجاح إلى فريق منارة التعلم الرقمي.'},youtubeSectionTitle:$('youtubeSectionTitle')?.value||old.youtubeSectionTitle,youtubeSectionText:$('youtubeSectionText')?.value||old.youtubeSectionText,youtubeChannelUrl:$('youtubeChannelUrl')?.value||old.youtubeChannelUrl,youtubeVideos:youtubeVideosFromManager(old.youtubeVideos),showYoutubeSection:!!$('showYoutubeSection')?.checked,socialLinks:{...(old.socialLinks||{}),facebook:$('facebookUrl')?.value||'',youtube:$('youtubeUrl')?.value||'',instagram:$('instagramUrl')?.value||'',tiktok:$('tiktokUrl')?.value||'',whatsapp:$('whatsappUrl')?.value||''},publicLibraryRequiresApproval:!!$('publicLibraryRequiresApproval')?.checked,maxAIQuestions:Number($('maxAIQuestions')?.value||old.maxAIQuestions||20),navLinks:parseJSON($('navJSON')?.value||'[]',old.navLinks),heroButtons:parseJSON($('heroButtonsJSON')?.value||'[]',old.heroButtons),showFeatures:!!$('showFeatures')?.checked,showShowcase:!!$('showShowcase')?.checked,homeSections:homeSectionsFromManager(old.homeSections||HOME_SECTION_DEFAULTS),cloud:{...old.cloud,enabled:!!$('cloudEnabled')?.checked,supabaseUrl:$('supabaseUrl')?.value||old.cloud?.supabaseUrl||'',publishableKey:$('supabaseKey')?.value||old.cloud?.publishableKey||'',syncMode:$('cloudSyncMode')?.value||old.cloud?.syncMode||'supabase_first'},ai:{...old.ai,endpoint:$('aiEndpoint')?.value||'',apiKey:'',model:$('aiModel')?.value||'gemini-2.5-flash',temperature:Number($('aiTemperature')?.value||old.ai?.temperature||0.3),useEdgeFunction:!!$('aiUseEdge')?.checked,edgeFunctionName:$('aiEdgeFunctionName')?.value||old.ai?.edgeFunctionName||'dynamic-handler'}}}
function fill(){const s=fresh(),x=s.platform;['brandName','brandSubtitle','logoImage','markImage','accent1','accent2','accent3','background','fontFamily','fontScale','customBgImage','questionSize','answerSize','cardRadius','uiGender','educatorGender','homeKicker','homeTitle','homeHighlight','homeText','featuresTitle','featuresSubtitle','showcaseGameTitle','showcaseGameText','showcaseButtonText','homeFooter','siteAbout','siteContact','contactWhatsApp','contactFormTitle','contactFormText','whatsappEdgeFunctionName','whatsappSuccessMessage','youtubeSectionTitle','youtubeSectionText','youtubeChannelUrl','maxAIQuestions'].forEach(id=>val(id,x[id]));val('facebookUrl',x.socialLinks?.facebook);val('youtubeUrl',x.socialLinks?.youtube);val('instagramUrl',x.socialLinks?.instagram);val('tiktokUrl',x.socialLinks?.tiktok);val('whatsappUrl',x.socialLinks?.whatsapp);renderYoutubeVideosManager(x.youtubeVideos||[]);renderHomeSectionsManager(x.homeSections||HOME_SECTION_DEFAULTS);val('whatsappEdgeFunctionName',x.whatsappDirect?.edgeFunctionName||'send-whatsapp-message');val('whatsappSuccessMessage',x.whatsappDirect?.successMessage||'تم إرسال رسالتك بنجاح إلى فريق منارة التعلم الرقمي.');chk('showContactForm',x.showContactForm!==false);chk('whatsappDirectEnabled',x.whatsappDirect?.enabled===true);chk('whatsappFallbackToLink',x.whatsappDirect?.fallbackToLink!==false);chk('showYoutubeSection',x.showYoutubeSection!==false);chk('publicLibraryRequiresApproval',x.publicLibraryRequiresApproval!==false);val('supabaseUrl',x.cloud?.supabaseUrl);val('supabaseKey',x.cloud?.publishableKey);val('cloudSyncMode',x.cloud?.syncMode||'supabase_first');chk('cloudEnabled',x.cloud?.enabled!==false);val('featuresJSON',JSON.stringify(x.features||[],null,2));val('navJSON',JSON.stringify(x.navLinks||[],null,2));val('heroButtonsJSON',JSON.stringify(x.heroButtons||[],null,2));val('aiEndpoint',x.ai?.endpoint);val('aiKey',x.ai?.apiKey);val('aiModel',x.ai?.model);val('aiTemperature',x.ai?.temperature??0.3);val('aiEdgeFunctionName',x.ai?.edgeFunctionName||'dynamic-handler');chk('aiUseEdge',x.ai?.useEdgeFunction!==false);['playerFx','playerSounds','hoverSounds','intro','showFeatures','showShowcase'].forEach(id=>chk(id,x[id]!==false));if($('logoPreview'))$('logoPreview').src=M.relAsset(x.logoImage);if($('markPreview'))$('markPreview').src=M.relAsset(x.markImage||x.logoImage);M.applyPlatform();renderAll()}
function live(){const x=readPlatform();document.documentElement.style.setProperty('--brand1',x.accent1||'#f6c85f');document.documentElement.style.setProperty('--brand2',x.accent2||'#18d2ff');document.documentElement.style.setProperty('--brand3',x.accent3||'#7c3aed');document.documentElement.style.setProperty('--fontScale',x.fontScale||1);document.documentElement.style.setProperty('--questionSize',(x.questionSize||34)+'px');document.documentElement.style.setProperty('--answerSize',(x.answerSize||28)+'px');document.documentElement.style.setProperty('--radius',(x.cardRadius||28)+'px');document.documentElement.style.setProperty('--customBgImage',`url(${x.customBgImage||''})`);document.body.dataset.bg=x.background||'cosmic';document.body.dataset.font=x.fontFamily||'tajawal';if($('logoPreview'))$('logoPreview').src=M.relAsset(x.logoImage);if($('markPreview'))$('markPreview').src=M.relAsset(x.markImage||x.logoImage);M.qsa('[data-mark]').forEach(img=>img.src=M.relAsset(x.markImage||x.logoImage));M.qsa('[data-logo]').forEach(img=>img.src=M.relAsset(x.logoImage));}
window.savePlatform=async function(){
  try{await waitForBrandingUploads?.()}catch(e){console.warn('branding upload wait failed',e)}
  const s=fresh();
  const nextPlatform={...readPlatform(),updated_at:new Date().toISOString()};
  s.platform=nextPlatform;
  addAudit('تحديث إعدادات المنصة','platform',{
    section:'platform',
    logo:!!nextPlatform.logoImage,
    mark:!!nextPlatform.markImage,
    whatsapp:nextPlatform.socialLinks?.whatsapp||''
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
window.resetPlatform=async function(){const s=fresh();s.platform=M.defaultPlatform();addAudit('استعادة الهوية الافتراضية','platform');M.saveStore(s);fill();M.renderSiteFooter?.();try{await M.syncCloudNow?.()}catch(e){}M.toast('تمت استعادة الهوية الافتراضية')}

window.setGeminiPreset=function(){
  $('aiEndpoint').value='https://generativelanguage.googleapis.com/v1beta/models';
  $('aiModel').value='gemini-2.5-flash';
  $('aiKey').value='';
  if($('aiUseEdge')) $('aiUseEdge').checked=true;
  M.toast('تم ضبط Gemini عبر Edge Function الآمنة. مفتاح Gemini يبقى داخل Supabase Secrets فقط.');
}

window.copySupabaseSetupText=function(){
  const txt=`Supabase Project URL:\nhttps://yltlzogrhwvnmxcnaesu.supabase.co\n\nSupabase publishable / anon key:\nsb_publishable_W-XxH2FTvSZq66b-eHt-TQ_a8ZuqGRD\n\nSQL المطلوب تشغيله:\nsupabase/00_START_HERE_CREATE_DATABASE.sql\n\nبعد النشر أضف رابط Netlify في:\nAuthentication → URL Configuration → Site URL + Redirect URLs`;
  M.copyText(txt);
}
window.copyGeminiSetupText=function(){
  const txt=`إعداد Gemini الآمن عبر Supabase Edge Function:\n\nEdge Function name:\ndynamic-handler\n\nSupabase Secret name:\nGEMINI_API_KEY\n\nModel:\ngemini-2.5-flash\n\nاترك API Key فارغًا في الواجهة عند استخدام Edge Function.`;
  M.copyText(txt);
}

window.testAIProvider=async function(){savePlatform();await M.testAIConnection();}

window.testSupabaseProvider=async function(){savePlatform();await M.testCloudConnection();}
window.syncCloudTablesNow=async function(){await M.syncCloudNow?.();renderAll();}
window.forceReloadPlatformFromCloud=async function(){try{await M.cloudSyncTables?.();fill();M.applyPlatform?.();M.renderSiteFooter?.();M.toast('تم سحب إعدادات المنصة من السحابة')}catch(e){M.toast('تعذر سحب إعدادات المنصة: '+(e.message||e),'error')}}

document.addEventListener('manarat:store-updated',()=>{fill();});

async function prepareBrandingFile(file,targetId){
  if(!file)return'';
  const isIcon=targetId==='markImage';
  const preserveAlpha=isIcon||String(file.type||'').includes('png')||String(file.type||'').includes('svg');

  // إصلاح V16.8:
  // الأيقونة الصغيرة لا تنتظر Storage ولا تتحول إلى JPG.
  // نحفظها مباشرة كـ PNG/SVG داخل platform_state حتى تظهر فورًا وتنتقل بين الأجهزة.
  const compressed=await M.compressImageFile(file,isIcon?384:1200,isIcon?1:.82,preserveAlpha).catch(async()=>{
    return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(file)})
  });

  if(isIcon){
    return compressed;
  }

  try{
    const blob=await (await fetch(compressed)).blob();
    const mime=blob.type||file.type||(preserveAlpha?'image/png':'image/jpeg');
    const ext=mime.includes('svg')?'svg':(mime.includes('png')?'png':'jpg');
    const uploadFile=new File([blob],(targetId||'image')+'-'+Date.now()+'.'+ext,{type:mime});
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('انتهت مهلة رفع الصورة')),12000));
    const url=await Promise.race([M.cloudUploadFile(uploadFile,{bucket:'manarat-assets',folder:targetId==='customBgImage'?'backgrounds':'branding'}),timeout]);
    return url;
  }catch(uploadErr){
    console.warn('cloud branding upload failed, saving embedded image in platform_state',uploadErr);
    return compressed;
  }
}
async function waitForBrandingUploads(){
  const ids=['logoImage','markImage','customBgImage'];
  for(const id of ids){
    if(pendingBrandUploads[id]){
      const url=await pendingBrandUploads[id];
      if(url&&$(id))$(id).value=url;
      delete pendingBrandUploads[id];
    }
  }
}
async function fileToData(inputId,targetId){
  const input=$(inputId);
  const file=input?.files?.[0];
  if(file) return window.handleBrandFileDirect(targetId,file);
  return M.toast('لم يتم اختيار صورة. استخدم زر اختيار الصورة ثم اختر ملفًا من الجهاز.','warn');
}
window.handleBrandUpload=function(inputId,targetId){
  const input=$(inputId);
  const file=input?.files?.[0];
  return window.handleBrandFileDirect(targetId,file);
}
window.pickBrandFile=function(inputId){const el=$(inputId);if(el)el.click()}

window.handleBrandFileDirect=async function(targetId,file){
  if(!file)return M.toast('لم يتم اختيار صورة','warn');
  const inputId=targetId==='markImage'?'markUpload':(targetId==='logoImage'?'logoUpload':'bgUpload');
  try{
    const isIcon=targetId==='markImage';
    M.toast(isIcon?'جاري تجهيز الأيقونة الشفافة...':'جاري تجهيز الصورة...');
    const url=await prepareBrandingFile(file,targetId);
    if(url&&$(targetId))$(targetId).value=url;
    if(isIcon&&$('markPreview'))$('markPreview').src=M.relAsset(url);
    if(targetId==='logoImage'&&$('logoPreview'))$('logoPreview').src=M.relAsset(url);
    live();
    M.applyPlatform();
    M.renderSiteFooter?.();
    M.toast(isIcon?'تم تطبيق الأيقونة في المعاينة. اضغط حفظ إعدادات المنصة لاعتمادها.':'تم تجهيز الصورة. اضغط حفظ إعدادات المنصة لاعتمادها.','success');
  }catch(e){
    console.error('direct brand file failed',e);
    M.toast('تعذر تجهيز الصورة: '+(e.message||e),'error');
  }finally{
    const input=$(inputId); if(input) input.value='';
  }
}

function renderStats(){const s=fresh();$('teachersCount').textContent=(s.teachers||[]).length;$('banksCount').textContent=(s.questionBanks||[]).length;$('gamesCount').textContent=(s.games||[]).length;$('attemptsCount').textContent=(s.attempts||[]).length}

async function saveAdminState(s,msg='تم الحفظ والمزامنة',opts={}){
  M.saveStore(s);
  try{
    await M.syncCloudNow?.();
    await M.cloudSyncTables?.();
  }catch(e){
    console.warn('admin cloud sync failed',e);
    if(opts.warn!==false)M.toast('تم الحفظ محليًا، وتعذرت المزامنة السحابية: '+(e.message||e),'warn');
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
window.exportAuditLog=function(){const s=fresh();M.downloadFile('manarat-audit-log.json',JSON.stringify(s.auditLogs||[],null,2),'application/json;charset=utf-8')}
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
function teacherGameCount(s,t){const email=String(t.email||'').toLowerCase(),id=String(t.id||'');return (s.games||[]).filter(g=>String(g.teacher_id||'')===id||String(g.teacher_email||'').toLowerCase()===email).length}
function renderTeachers(){const s=fresh();const teachers=(s.teachers||[]).slice().sort((a,b)=>String(a.name||a.email).localeCompare(String(b.name||b.email),'ar'));$('teachersList').innerHTML=`<div class="toolbar" style="margin-bottom:12px"><div><b>عدد الحسابات الظاهرة: ${teachers.length}</b><p class="muted">يتم تجميع المعلمين من جدول profiles ومن مالكي الألعاب حتى لا يختفي أي حساب.</p></div><button class="btn small" onclick="refreshTeachersFromCloud()">تحديث المعلمين من السحابة</button></div><table class="table"><thead><tr><th>الاسم</th><th>المدرسة</th><th>البريد</th><th>الصيغة</th><th>الألعاب</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${teachers.map(t=>`<tr><td>${M.esc(t.icon||'')} ${M.esc(t.name||t.email||'حساب معلم')}</td><td>${M.esc(t.school||'')}</td><td>${M.esc(t.email||'')}</td><td>${M.normalizedGender(t.educator_gender)==='male'?'معلم':'معلمة'}</td><td>${teacherGameCount(s,t)}</td><td>${M.esc(t.status||'نشط')}</td><td><div class="q-actions"><button class="btn small" onclick="toggleTeacher('${M.attr(t.id||t.email)}')">تفعيل/إيقاف</button><button class="btn bad small" onclick="deleteTeacher('${M.attr(t.id||t.email)}')">حذف</button></div></td></tr>`).join('')}</tbody></table>`}
window.refreshTeachersFromCloud=async function(){try{await M.cloudSyncTables?.();renderAll();M.toast('تم تحديث بيانات المعلمين من السحابة')}catch(e){M.toast('تعذر تحديث المعلمين: '+(e.message||e),'error')}}
window.toggleTeacher=async function(id){const s=fresh();const t=s.teachers.find(x=>String(x.id)===String(id)||String(x.email)===String(id));if(t)t.status=t.status==='نشط'?'موقوف':'نشط';M.saveStore(s);if(t){t.updated_at=new Date().toISOString();await M.cloudUpsertProfile?.(t).catch(e=>console.warn('teacher status cloud sync failed',e));addAudit('تحديث حالة معلم','teacher',{id:t.id,email:t.email,status:t.status})}await M.syncCloudNow?.().catch(()=>{});await M.cloudSyncTables?.().catch(()=>{});renderAll();M.toast('تم تحديث حالة المعلم ومزامنتها')}
window.deleteTeacher=async function(id){
  const s=fresh();
  const t=s.teachers.find(x=>String(x.id)===String(id)||String(x.email)===String(id));
  if(!t)return M.toast('لم يتم العثور على المعلم/المعلمة','warn');
  const label=t.name||t.email||'هذا الحساب';
  if(!confirm('هل تريد حذف '+label+' من المنصة؟ سيتم حذف ملفه التعريفي وألعابه، وستحاول المنصة حذف حسابه الحقيقي من Supabase Auth عبر الدالة الآمنة.'))return;
  const teacherKey=String(t.id||'');
  const teacherEmail=String(t.email||'').toLowerCase();
  const owned=(s.games||[]).filter(g=>String(g.teacher_id||'')===teacherKey||String(g.teacher_email||'').toLowerCase()===teacherEmail);
  for(const g of owned){await M.cloudDeleteGame?.(g.id).catch(e=>console.warn('teacher game delete cloud failed',e))}
  s.games=(s.games||[]).filter(g=>!(String(g.teacher_id||'')===teacherKey||String(g.teacher_email||'').toLowerCase()===teacherEmail));
  s.teachers=(s.teachers||[]).filter(x=>!(String(x.id||'')===String(id)||String(x.email||'')===String(id)));
  s.messages=(s.messages||[]).filter(m=>String(m.to||'')!==teacherKey&&String(m.to||'').toLowerCase()!==teacherEmail&&String(m.from||'').toLowerCase()!==teacherEmail);
  addAudit('حذف معلم/معلمة','teacher',{id:teacherKey,email:teacherEmail,name:t.name||'',deleted_games:owned.length});
  M.saveStore(s);
  await M.cloudDeleteProfile?.(teacherKey||teacherEmail).catch(e=>console.warn('teacher profile delete cloud failed',e));
  const authResult=await M.cloudDeleteAuthUser?.(t);
  await M.syncCloudNow?.().catch(()=>{});
  await M.cloudSyncTables?.().catch(()=>{});
  renderAll();
  if(authResult&&authResult.ok)M.toast('تم حذف المعلم/المعلمة وحساب Supabase Auth بنجاح');
  else M.toast('تم حذف بيانات المعلم من المنصة. حذف حساب Auth يحتاج أن تكون دالة dynamic-api منشورة بالكود الصحيح، مع إبقاء Verify JWT مفعّلًا.','warn');
}

function renderAdmins(){const s=fresh();const admins=s.admins||[];$('adminsList').innerHTML=admins.map(a=>`<div class="card"><div class="toolbar"><div><h3>${M.esc(a.name||a.email)}</h3><p class="muted">${M.esc(a.email)} · ${a.active===false?'موقوف':'نشط'} · ${M.esc(a.role||'admin')}</p></div><div class="q-actions"><button class="btn small" onclick="toggleAdminUser('${a.id}')">تفعيل/إيقاف</button><button class="btn bad small" onclick="removeAdminUser('${a.id}')">حذف</button></div></div></div>`).join('')||'<p class="muted">لا يوجد أدمن مسجل. أول مستخدم يدخل لوحة الأدمن يمكن اعتماده كأدمن.</p>'}
window.addAdminUser=async function(){const email=($('adminEmail')?.value||'').trim().toLowerCase(),name=($('adminName')?.value||'').trim()||email;if(!email)return M.toast('اكتب بريد الأدمن','error');const s=fresh();s.admins=s.admins||[];if(s.admins.some(a=>String(a.email||'').toLowerCase()===email))return M.toast('هذا البريد موجود بالفعل كأدمن','warn');s.admins.push({id:M.uuid(),name,email,role:'admin',active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});addAudit('إضافة أدمن','admin',{email});$('adminEmail').value='';$('adminName').value='';await saveAdminState(s,'تمت إضافة أدمن جديد ومزامنته')}
window.toggleAdminUser=async function(id){const s=fresh();const a=(s.admins||[]).find(x=>x.id===id);if(a){a.active=a.active===false;a.updated_at=new Date().toISOString();addAudit('تحديث حالة أدمن','admin',{id,email:a.email,active:a.active})}await saveAdminState(s,'تم تحديث حالة الأدمن ومزامنتها')}
window.removeAdminUser=async function(id){if(!confirm('حذف هذا الأدمن؟'))return;const s=fresh();s.admins=(s.admins||[]).filter(a=>a.id!==id);addAudit('حذف أدمن','admin',{id});await saveAdminState(s,'تم حذف الأدمن ومزامنته')}
function renderMessages(){const s=fresh();const teachers=s.teachers||[];if($('msgTarget'))$('msgTarget').innerHTML='<option value="all">كل المعلمين/المعلمات</option>'+teachers.map(t=>`<option value="${M.attr(t.id)}">${M.esc(t.name||t.email)}</option>`).join('');const msgs=(s.messages||[]).slice().reverse();$('messagesList').innerHTML=msgs.map(m=>`<div class="card"><div class="toolbar"><div><h3>${M.esc(m.subject||'رسالة')}</h3><p class="muted">من: ${M.esc(m.from_name||m.from||'')} → إلى: ${M.esc(m.to_name||m.to||'')} · ${new Date(m.created_at).toLocaleString('ar')}</p></div><button class="btn bad small" onclick="deleteMessage('${m.id}')">حذف</button></div><p>${M.esc(m.body||'')}</p></div>`).join('')||'<p class="muted">لا توجد رسائل بعد.</p>'}
window.sendAdminMessage=async function(){const s=fresh(),p=M.currentProfile();const to=$('msgTarget')?.value||'all';const teacher=(s.teachers||[]).find(t=>t.id===to);const body=($('msgBody')?.value||'').trim();if(!body)return M.toast('اكتب نص الرسالة','error');s.messages=s.messages||[];s.messages.push({id:M.uuid(),from:p.email||'admin',from_name:p.name||'الأدمن',to,to_name:to==='all'?'كل المعلمين/المعلمات':(teacher?.name||teacher?.email||to),subject:($('msgSubject')?.value||'رسالة من الأدمن').trim(),body,read:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});addAudit('إرسال رسالة','messages',{to});$('msgBody').value='';$('msgSubject').value='';await saveAdminState(s,'تم إرسال الرسالة ومزامنتها')}
window.deleteMessage=async function(id){const s=fresh();s.messages=(s.messages||[]).filter(m=>m.id!==id);addAudit('حذف رسالة','messages',{id});await saveAdminState(s,'تم حذف الرسالة ومزامنتها')}

function renderReports(){
  const s=fresh();
  const attempts=s.attempts||[];
  const games=s.games||[];
  const byGame=games.map(g=>{
    const att=attempts.filter(a=>String(a.game_id)===String(g.id));
    const avg=att.length?Math.round(att.reduce((a,b)=>a+Number(b.score||0),0)/att.length):0;
    const best=att.length?Math.max(...att.map(a=>Number(a.score||0))):0;
    const low=att.length?Math.min(...att.map(a=>Number(a.score||0))):0;
    const bestStudent=(att.slice().sort((a,b)=>Number(b.score||0)-Number(a.score||0))[0]||{}).student_name||'-';
    const wrong={};
    att.forEach(a=>(a.answers||[]).forEach(ans=>{if(ans&&!ans.is_correct){const key=ans.question_text||ans.question_id||'سؤال غير محدد';wrong[key]=(wrong[key]||0)+1}}));
    const hardest=Object.entries(wrong).sort((a,b)=>b[1]-a[1])[0];
    return`<div class="card report-card"><h3>${M.esc(g.title)}</h3><div class="stat-row"><div class="stat"><span>المحاولات</span><strong>${att.length}</strong></div><div class="stat"><span>المتوسط</span><strong>${avg}%</strong></div><div class="stat"><span>أعلى درجة</span><strong>${best}%</strong></div><div class="stat"><span>أقل درجة</span><strong>${low}%</strong></div></div><p class="muted">أفضل نتيجة: ${M.esc(bestStudent)} · عدد الأسئلة: ${g.questions?.length||0} · المعلم: ${M.esc(g.teacher||g.teacher_email||'')}</p>${hardest?`<p class="muted">أكثر سؤال احتاج مراجعة: <b>${M.esc(hardest[0]).slice(0,140)}</b> · أخطاء: ${hardest[1]}</p>`:''}</div>`
  }).join('');
  const byTeacher=(s.teachers||[]).map(t=>{
    const email=String(t.email||'').toLowerCase(), id=String(t.id||'');
    const tg=games.filter(g=>String(g.teacher_id||'')===id||String(g.teacher_email||'').toLowerCase()===email);
    const ta=attempts.filter(a=>tg.some(g=>String(g.id)===String(a.game_id)));
    const avg=ta.length?Math.round(ta.reduce((x,a)=>x+Number(a.score||0),0)/ta.length):0;
    return`<tr><td>${M.esc(t.name||t.email||'')}</td><td>${tg.length}</td><td>${ta.length}</td><td>${avg}%</td></tr>`
  }).join('');
  const students={}; attempts.forEach(a=>{const n=a.student_name||'طالب/طالبة';students[n]=students[n]||{count:0,total:0,best:0};students[n].count++;students[n].total+=Number(a.score||0);students[n].best=Math.max(students[n].best,Number(a.score||0))});
  const byStudent=Object.entries(students).sort((a,b)=>b[1].count-a[1].count).slice(0,30).map(([name,x])=>`<tr><td>${M.esc(name)}</td><td>${x.count}</td><td>${Math.round(x.total/x.count)}%</td><td>${x.best}%</td></tr>`).join('');
  $('reportsList').innerHTML=
    `<h3>ملخص المعلمين</h3><table class="table"><thead><tr><th>المعلم/المعلمة</th><th>الألعاب</th><th>المحاولات</th><th>متوسط النتائج</th></tr></thead><tbody>${byTeacher||'<tr><td colspan="4">لا توجد بيانات</td></tr>'}</tbody></table>
    <h3>أكثر الطلاب استخدامًا</h3><table class="table"><thead><tr><th>الاسم</th><th>المحاولات</th><th>المتوسط</th><th>أفضل درجة</th></tr></thead><tbody>${byStudent||'<tr><td colspan="4">لا توجد بيانات</td></tr>'}</tbody></table>
    <h3>تحليل الألعاب</h3>${byGame||'<p class="muted">لا توجد تقارير بعد.</p>'}`;
}

function renderAll(){renderStats();renderBanks();renderGames();renderTeachers();renderAdmins();renderMessages();renderReports();renderApprovals();renderAudit?.()}

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
  items.push(await healthItem('إعدادات Supabase',async()=>cloud.enabled&&base&&key?'الرابط والمفتاح موجودان':'إعدادات Supabase غير مكتملة'));
  items.push(await healthItem('الاتصال بقاعدة البيانات',async()=>{await M.cloudSyncTables?.();return'تمت قراءة البيانات والجداول'}));
  items.push(await healthItem('حفظ إعدادات المنصة والفوتر',async()=>{if(!M.isAdmin())return'يتطلب حساب أدمن للحفظ';await M.syncCloudNow?.();return'تم الحفظ والمزامنة'}));
  items.push(await healthItem('دالة الذكاء الاصطناعي dynamic-handler',async()=>{if(!base||!key)return'إعدادات Supabase غير مكتملة';const r=await fetch(base+'/functions/v1/'+(ai.edgeFunctionName||'dynamic-handler'),{method:'OPTIONS'});return r.ok?'الدالة موجودة وتستجيب':'استجابة: '+r.status}));
  items.push(await healthItem('دالة حذف المعلم dynamic-api',async()=>{if(!base||!key)return'إعدادات Supabase غير مكتملة';const r=await fetch(base+'/functions/v1/dynamic-api',{method:'OPTIONS'});return r.ok?'الدالة موجودة وتستجيب':'استجابة: '+r.status}));
  items.push(await healthItem('جلسة الأدمن',async()=>M.isAdmin()?(token?'أدمن بجلسة Supabase حقيقية':'أدمن محلي/جلسة غير حقيقية'):'الحساب الحالي ليس أدمن'));
  items.push(await healthItem('النسخ الاحتياطي',async()=>{const test=JSON.stringify(buildBackupPayload()).length;return'حجم النسخة الحالية تقريبًا '+Math.round(test/1024)+'KB'}));
  renderHealth(items);
  addAudit('تشغيل فحص صحة النظام','system-health',{ok:items.filter(x=>x.ok).length,total:items.length});
}
window.exportSystemHealth=function(){M.downloadFile('manarat-system-health.json',JSON.stringify(lastSystemHealth||[],null,2),'application/json;charset=utf-8')}

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

window.exportFullReport=function(){const s=fresh();M.downloadFile('manarat-full-report.json',JSON.stringify(s,null,2),'application/json;charset=utf-8')}
window.exportCSVReport=function(){const s=fresh();const rows=['اللعبة,اسم الطالب,الدرجة,الوقت,التاريخ'];(s.attempts||[]).forEach(a=>{const g=(s.games||[]).find(x=>String(x.id)===String(a.game_id))||{};rows.push([g.title||a.game_id,a.student_name,a.score,a.time_spent,a.created_at].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','))});M.downloadFile('manarat-report.csv',rows.join('\n'),'text/csv;charset=utf-8')}


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
  M.downloadFile('manarat-platform-full-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');
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

document.addEventListener('DOMContentLoaded',async()=>{await M.authRefreshSession();if(!M.requireAdminAuth())return;await M.ensureAdminCloudRole?.();await M.cloudSyncTables?.();fill();renderHealth?.([]);['input','change','keyup'].forEach(ev=>document.body.addEventListener(ev,e=>{if(e.target.closest('#tab-identity,#tab-player'))live()}));$('logoUpload')?.addEventListener('change',()=>fileToData('logoUpload','logoImage'));$('markUpload')?.addEventListener('change',()=>fileToData('markUpload','markImage'));$('bgUpload')?.addEventListener('change',()=>fileToData('bgUpload','customBgImage'));document.body.addEventListener('change',e=>{if(e.target?.id==='logoUpload')fileToData('logoUpload','logoImage');if(e.target?.id==='markUpload')fileToData('markUpload','markImage');if(e.target?.id==='bgUpload')fileToData('bgUpload','customBgImage')},true);$('backupImportFile')?.addEventListener('change',e=>importBackupJSON(e.target.files?.[0]));});
})();
