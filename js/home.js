(function(){
let selectedYT=0;

const HOME_NAV_TABS=[
  {icon:'🏠',label:'الرئيسية',href:'#heroSection',style:'tab'},
  {icon:'✨',label:'الخدمات',href:'#featuresSection',style:'tab'},
  {icon:'🎬',label:'الفيديوهات',href:'#youtubeShowcaseSection',style:'tab'},
  {icon:'🎮',label:'الألعاب',href:'#latestPublicGamesSection',style:'tab'},
  {icon:'💬',label:'تواصل معنا',href:'#contactWhatsAppSection',style:'tab'}
];
function homeNavLinks(list=[]){
  const src=Array.isArray(list)?list:[];
  const hasTabs=src.some(x=>String(x.href||'').startsWith('#')||x.style==='tab');
  const actions=src.filter(x=>!String(x.href||'').startsWith('#')&&x.style!=='tab'&&!String(x.href||'').includes('admin/admin.html'));
  const cleanActions=actions.length?actions:[
    {icon:'👩‍🏫',label:'دخول المعلم',href:'auth.html',style:'ghost'},
    {icon:'🎮',label:'تشغيل لعبة نموذجية',href:'player/game.html?game=demo-adventure',style:'primary'}
  ];
  return hasTabs?src:[...HOME_NAV_TABS,...cleanActions];
}

function btnClass(style){return style==='ghost'?'btn ghost':style==='dark'?'btn dark':'btn'}
function renderButtons(list){return (list||[]).filter(x=>!String(x.href||'').includes('admin/admin.html')).map(x=>`<a class="${x.style==='tab'?'nav-tab':btnClass(x.style)}" href="${Manarat.esc(x.href||'#')}" data-nav-href="${Manarat.esc(x.href||'#')}"><span>${Manarat.esc(x.icon||'')}</span><b>${Manarat.esc(x.label||'زر')}</b></a>`).join('')}
function activateHomeNav(){
  const tabs=[...document.querySelectorAll('.nav-tab')];
  if(!tabs.length)return;
  const ids=tabs.map(a=>String(a.getAttribute('href')||'')).filter(h=>h.startsWith('#')).map(h=>h.slice(1));
  let current='heroSection';
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(el&&el.getBoundingClientRect().top<160)current=id;
  });
  tabs.forEach(a=>a.classList.toggle('active',String(a.getAttribute('href')||'')==='#'+current));
}

const HOME_SECTIONS=[
  {id:'heroSection',label:'الواجهة الرئيسية'},
  {id:'featuresSection',label:'مزايا المنصة'},
  {id:'showcaseSection',label:'تجربة اللاعب'},
  {id:'youtubeShowcaseSection',label:'فيديوهات اليوتيوب'},
  {id:'latestPublicGamesSection',label:'آخر الألعاب المضافة'},
  {id:'contactWhatsAppSection',label:'نموذج مراسلة واتساب'},
  {id:'homeFooterCard',label:'فوتر الصفحة الرئيسية'}
];
function normalizeHomeSections(list=[]){
  const known=new Set(HOME_SECTIONS.map(x=>x.id));
  const out=[];
  (Array.isArray(list)?list:[]).forEach(x=>{if(x&&known.has(x.id)&&!out.some(y=>y.id===x.id))out.push({id:x.id,label:x.label||x.id,visible:x.visible!==false})});
  HOME_SECTIONS.forEach(x=>{if(!out.some(y=>y.id===x.id))out.push({...x,visible:true})});
  return out;
}
function applyHomeSectionOrder(p){
  const main=document.querySelector('main.wrap')||document.querySelector('main');
  if(!main)return;
  let sections=normalizeHomeSections(p.homeSections||[]);
  const knownVisibleCount=sections.filter(s=>s&&s.visible!==false).length;
  // حماية مهمة: إذا جاءت إعدادات سحابية تالفة أو مخفية لكل الصفحة، لا نخفي الصفحة الرئيسية.
  if(!knownVisibleCount)sections=normalizeHomeSections([]);
  const visibility={
    featuresSection:p.showFeatures!==false,
    showcaseSection:p.showShowcase!==false,
    youtubeShowcaseSection:p.showYoutubeSection!==false,
    contactWhatsAppSection:p.showContactForm!==false
  };
  const visibleEls=[];
  sections.forEach(s=>{
    const el=document.getElementById(s.id);
    if(!el)return;
    const isOptionalEmpty=(s.id==='youtubeShowcaseSection'||s.id==='latestPublicGamesSection')&&el.dataset.empty==='true';
    const shown=s.visible!==false && visibility[s.id]!==false && !isOptionalEmpty;
    el.style.display=shown?'':'none';
    if(shown)visibleEls.push(el);
    main.appendChild(el);
  });
  // حماية إضافية: إذا انتهى الأمر بلا أي مكون مرئي، نعيد العناصر الأساسية فورًا.
  if(!visibleEls.length){
    ['heroSection','featuresSection','showcaseSection','homeFooterCard'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.style.display='';main.appendChild(el)}
    });
  }
}

function ensureBeforeFooter(id,html){
  let sec=Manarat.qs('#'+id);
  if(sec)return sec;
  const footer=Manarat.qs('footer');
  sec=document.createElement('section');
  sec.id=id;
  sec.innerHTML=html;
  footer?.parentNode?.insertBefore(sec,footer);
  return sec;
}
function ensureLatestSection(){return ensureBeforeFooter('latestPublicGamesSection','<div class="toolbar"><div><h2>🆕 آخر الألعاب المضافة</h2><p class="muted">ألعاب أتاحها منشئوها للظهور في الصفحة الرئيسية.</p></div></div><div id="latestPublicGamesGrid" class="game-list"></div>')}
function renderLatestGames(s){const sec=ensureLatestSection();const grid=Manarat.qs('#latestPublicGamesGrid');if(!grid)return;const games=(s.games||[]).filter(g=>g.show_in_home_public===true&&(g.public_status==='approved'||g.public_approved===true||(s.platform&&s.platform.publicLibraryRequiresApproval===false))&&Array.isArray(g.questions)&&g.questions.length).sort((a,b)=>Date.parse(b.updated_at||b.created_at||0)-Date.parse(a.updated_at||a.created_at||0)).slice(0,8);sec.dataset.empty=games.length?'false':'true';sec.style.display=games.length?'':'none';grid.innerHTML=games.map(g=>`<div class="card game-card"><div class="badge">🎮</div><h3>${Manarat.esc(g.title||'لعبة تعليمية')}</h3><p class="muted">${Manarat.esc(g.subject||'')} · ${Manarat.esc(g.grade||'')}<br>${Number((g.questions||[]).length)} سؤال · ${Manarat.esc(g.teacher||g.school||'')}</p><a class="btn small" href="player/game.html?game=${encodeURIComponent(g.id)}">تشغيل اللعبة</a></div>`).join('')}
function ytId(url=''){
  url=String(url||'').trim();
  const patterns=[/youtu\.be\/([A-Za-z0-9_-]{6,})/,/[?&]v=([A-Za-z0-9_-]{6,})/,/\/embed\/([A-Za-z0-9_-]{6,})/,/\/shorts\/([A-Za-z0-9_-]{6,})/];
  for(const p of patterns){const m=url.match(p);if(m)return m[1]}
  return /^[A-Za-z0-9_-]{6,}$/.test(url)?url:'';
}
function normalizeYTVideos(list=[]){return (Array.isArray(list)?list:[]).map((v,i)=>typeof v==='string'?{title:'فيديو '+(i+1),url:v}:v).map((v,i)=>({...v,id:ytId(v.url||v.id||''),title:v.title||('فيديو '+(i+1))})).filter(v=>v.id).slice(0,6)}
function renderYouTubeSection(p){
  const sec=ensureBeforeFooter('youtubeShowcaseSection','<div class="youtube-pro card premium-youtube"><div class="youtube-pro-head"><div><div class="kicker">🎬 قناة منارة التعلم</div><h2 id="youtubeSectionTitle"></h2><p id="youtubeSectionText" class="muted"></p></div><a id="youtubeChannelButton" class="btn dark" target="_blank" rel="noopener">زيارة القناة ▶️</a></div><div class="youtube-pro-grid"><div class="youtube-player-wrap"><iframe id="youtubeMainFrame" title="فيديو منارة التعلم الرقمي" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><div class="youtube-current-info"><b id="youtubeCurrentTitle"></b><a id="youtubeCurrentLink" class="btn small ghost" target="_blank" rel="noopener">فتح الفيديو في يوتيوب</a></div></div><div id="youtubeThumbs" class="youtube-pro-thumbs"></div></div></div>');
  const videos=normalizeYTVideos(p.youtubeVideos||[]);
  sec.dataset.empty=videos.length?'false':'true';sec.style.display=(p.showYoutubeSection===false||!videos.length)?'none':'';
  if(!videos.length)return;
  selectedYT=Math.max(0,Math.min(selectedYT,videos.length-1));
  const current=videos[selectedYT]||videos[0];
  Manarat.qs('#youtubeSectionTitle').textContent=p.youtubeSectionTitle||'فيديوهات منارة التعلم الرقمي';
  Manarat.qs('#youtubeSectionText').textContent=p.youtubeSectionText||'اختر فيديو وشاهد نماذج من القناة.';
  const ch=Manarat.qs('#youtubeChannelButton');ch.href=p.youtubeChannelUrl||p.socialLinks?.youtube||'#';
  Manarat.qs('#youtubeMainFrame').src=`https://www.youtube.com/embed/${encodeURIComponent(current.id)}`;
  Manarat.qs('#youtubeCurrentTitle').textContent=current.title||'فيديو منارة التعلم الرقمي';
  const currentUrl=current.url||`https://www.youtube.com/watch?v=${encodeURIComponent(current.id)}`;
  Manarat.qs('#youtubeCurrentLink').href=currentUrl;
  Manarat.qs('#youtubeThumbs').innerHTML=videos.map((v,i)=>`<button class="yt-pro-thumb ${i===selectedYT?'active':''}" data-yt="${i}"><img src="${Manarat.attr(v.thumbnail||('https://img.youtube.com/vi/'+v.id+'/hqdefault.jpg'))}" alt=""><span>${Manarat.esc(v.title)}</span><small>مشاهدة الآن</small></button>`).join('');
  Manarat.qsa('.yt-pro-thumb').forEach(btn=>btn.addEventListener('click',()=>{selectedYT=Number(btn.dataset.yt)||0;renderYouTubeSection(Manarat.store().platform)}));
}
function waTarget(link=''){
  link=String(link||'').trim();
  if(!link)return '';
  if(/^https?:\/\//i.test(link))return link;
  const digits=link.replace(/[^\d+]/g,'').replace(/^\+/,'');
  return digits?`https://wa.me/${digits}`:'';
}

async function sendWhatsAppDirect(p,payload){
  const cloud=p.cloud||{};
  const fn=(p.whatsappDirect&&p.whatsappDirect.edgeFunctionName)||'send-whatsapp-message';
  const base=String(cloud.supabaseUrl||'').replace(/\/+$/,'');
  const key=String(cloud.publishableKey||'').trim();
  if(!base||!key)throw new Error('إعدادات Supabase غير مكتملة');
  const res=await fetch(base+'/functions/v1/'+encodeURIComponent(fn),{
    method:'POST',
    headers:{'apikey':key,'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const json=await res.json().catch(()=>({}));
  if(!res.ok||json.ok===false)throw new Error(json.error||json.message||'فشل إرسال رسالة واتساب');
  return json;
}

function renderContactSection(p){
  const sec=ensureBeforeFooter('contactWhatsAppSection','<div class="contact-home card premium-contact"><div><div class="kicker">📩 تواصل معنا</div><h2 id="contactFormTitle"></h2><p id="contactFormText" class="muted"></p></div><form id="whatsappContactForm" class="contact-form"><input id="contactName" class="input" autocomplete="name" placeholder="الاسم"><input id="contactPhone" class="input" autocomplete="tel" placeholder="رقم التواصل"><textarea id="contactMessage" class="input" rows="4" placeholder="اكتب رسالتك"></textarea><input id="contactHoney" type="text" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><button id="contactSubmitButton" class="btn" type="submit">إرسال عبر واتساب 💬</button><p id="contactHint" class="muted"></p></form></div>');
  sec.dataset.empty='false';sec.style.display=p.showContactForm===false?'none':'';
  Manarat.qs('#contactFormTitle').textContent=p.contactFormTitle||'راسل منارة التعلم الرقمي';
  Manarat.qs('#contactFormText').textContent=p.contactFormText||'اكتب رسالتك وسنفتح واتساب لإرسالها.';
  const target=waTarget(p.contactWhatsApp||p.socialLinks?.whatsapp||'');
  Manarat.qs('#contactHint').textContent=target?'':'ضع رقم واتساب الرسائل من لوحة الأدمن لتفعيل الإرسال المباشر.';
  const form=Manarat.qs('#whatsappContactForm');
  form.onsubmit=async(e)=>{
    e.preventDefault();
    const name=Manarat.qs('#contactName').value.trim();
    const phone=Manarat.qs('#contactPhone').value.trim();
    const msg=Manarat.qs('#contactMessage').value.trim();
    const honey=Manarat.qs('#contactHoney')?.value||'';
    if(!msg)return Manarat.toast('اكتب نص الرسالة أولًا','warn');
    const btn=Manarat.qs('#contactSubmitButton');
    if(btn){btn.disabled=true;btn.textContent='جاري الإرسال...'}
    const payload={name,phone,message:msg,page:location.href,honeypot:honey,created_at:new Date().toISOString()};
    const direct=p.whatsappDirect&&p.whatsappDirect.enabled===true;
    try{
      if(direct){
        await sendWhatsAppDirect(p,payload);
        Manarat.toast(p.whatsappDirect?.successMessage||'تم إرسال رسالتك بنجاح إلى فريق منارة التعلم الرقمي.');
        form.reset();
        return;
      }
      throw new Error('direct disabled');
    }catch(err){
      console.warn('direct whatsapp failed',err);
      if(direct&&p.whatsappDirect?.fallbackToLink===false){
        Manarat.toast('تعذر إرسال الرسالة مباشرة: '+(err.message||err),'error');
        return;
      }
      const body=`السلام عليكم، رسالة من موقع منارة التعلم الرقمي.%0A%0Aالاسم: ${encodeURIComponent(name||'غير مذكور')}%0Aرقم التواصل: ${encodeURIComponent(phone||'غير مذكور')}%0A%0Aالرسالة:%0A${encodeURIComponent(msg)}`;
      const t=waTarget(p.contactWhatsApp||p.socialLinks?.whatsapp||'');
      if(!t)return Manarat.toast('لم يتم ضبط رقم واتساب الرسائل من لوحة الأدمن','error');
      let url=t;
      if(/wa\.me|api\.whatsapp\.com|web\.whatsapp\.com/i.test(t)){
        url += (t.includes('?')?'&':'?')+'text='+body;
      }else if(/chat\.whatsapp\.com/i.test(t)){
        navigator.clipboard?.writeText(decodeURIComponent(body.replace(/%0A/g,'\n'))).catch(()=>{});
        Manarat.toast('رابط الواتساب الحالي جروب؛ تم نسخ الرسالة، الصقها بعد فتح الجروب','warn');
      }
      window.open(url,'_blank','noopener');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='إرسال عبر واتساب 💬'}
    }
  };
}

function fitHomeHeroText(){
  const box=Manarat.qs('#heroSection .hero-copy');
  const title=Manarat.qs('#homeTitle');
  const text=Manarat.qs('#homeText');
  if(!box||!title)return;
  const raw=(title.textContent||'').trim();
  const len=raw.length;
  let size=64;
  if(len>45)size=56;
  if(len>65)size=48;
  if(len>85)size=40;
  if(len>110)size=34;
  if(window.innerWidth<900)size=Math.min(size,42);
  if(window.innerWidth<560)size=Math.min(size,32);
  title.style.setProperty('--hero-title-size',size+'px');
  if(text){
    text.style.setProperty('--hero-text-size',(window.innerWidth<560?'15px':(len>95?'16px':'18px')));
  }
}

function render(){const s=Manarat.store(),p=s.platform;Manarat.applyPlatform();const gender=Manarat.normalizedGender((s.profile||{}).educator_gender||p.uiGender);Manarat.qs('#homeKicker').textContent=p.homeKicker||'';const title=Manarat.qs('#homeTitle');let tt=Manarat.esc(Manarat.genderizeText(p.homeTitle||'',gender));const h=Manarat.esc(p.homeHighlight||'');if(h&&tt.includes(h))tt=tt.replace(h,`<span>${h}</span>`);title.innerHTML=tt;Manarat.qs('#homeText').textContent=Manarat.genderizeText(p.homeText||'',gender);Manarat.qs('#featuresTitle').textContent=p.featuresTitle||'';Manarat.qs('#featuresSubtitle').textContent=p.featuresSubtitle||'';Manarat.qs('#showcaseGameTitle').textContent=p.showcaseGameTitle||'';Manarat.qs('#showcaseGameText').textContent=p.showcaseGameText||'';Manarat.qs('#showcaseButton').textContent=p.showcaseButtonText||'ابدأ';Manarat.qs('#homeFooter').textContent=p.homeFooter||'';Manarat.qs('#homeMainLogo').src=Manarat.relAsset(p.logoImage);Manarat.qs('#homeNavLinks').innerHTML=renderButtons(homeNavLinks(p.navLinks));Manarat.qs('#homeHeroActions').innerHTML=renderButtons(p.heroButtons);
const metrics=[{n:(p.features||[]).length||6,l:'خدمات رئيسية'},{n:8,l:'أنواع أسئلة'},{n:'AI',l:'فيديوهات وأفكار ذكية'},{n:'24/7',l:'منصة جاهزة للتشغيل'}];
const quickCards=[
  {icon:'🎬',title:'مكتبة الفيديوهات',desc:'انتقل مباشرة إلى قسم الفيديوهات ونماذج القناة.',href:'#youtubeShowcaseSection',tag:'مشاهدة الفيديوهات'},
  {icon:'🤖',title:'فيديوهات الذكاء الاصطناعي',desc:'خدمة تصميم فيديوهات لشرح المناهج والأفكار الإبداعية.',href:'#showcaseSection',tag:'خدمة أساسية'},
  {icon:'🎮',title:'الألعاب التعليمية',desc:'استعرض تجربة اللعب والأنماط التفاعلية داخل المنصة.',href:'#showcaseSection',tag:'تجربة اللعب'},
  {icon:'🆕',title:'آخر الألعاب',desc:'تصفح آخر الألعاب المضافة والمتاحة للتشغيل.',href:'#latestPublicGamesSection',tag:'مكتبة الألعاب'}
];
const serviceTags=['الألعاب التفاعلية','مكتبة الفيديوهات','فيديوهات المناهج بالذكاء الاصطناعي','تقارير وشهادات','استيراد وتوليد ذكي'];
const highlights=['تشغيل فردي أو منافسة','اختيار عدد الأسئلة من شاشة اللعب','لوحة أرقام الأسئلة','اختيار عشوائي سينمائي','تصحيح يدوي للأسئلة المقالية'];
Manarat.qs('#heroMetrics').innerHTML=metrics.map(m=>`<div class="metric-chip"><b>${Manarat.esc(String(m.n))}</b><span>${Manarat.esc(m.l)}</span></div>`).join('');
Manarat.qs('#heroQuickCards').innerHTML=quickCards.map(c=>`<a class="hero-quick-card" href="${Manarat.attr(c.href||'#')}"><div class="badge">${Manarat.esc(c.icon)}</div><div><b>${Manarat.esc(c.title)}</b><p>${Manarat.esc(c.desc)}</p><small>${Manarat.esc(c.tag||'انتقال')}</small></div></a>`).join('');
Manarat.qs('#heroServiceTags').innerHTML=serviceTags.map(x=>`<span>${Manarat.esc(x)}</span>`).join('');
Manarat.qs('#showcaseHighlights').innerHTML=highlights.map(x=>`<span class="showcase-chip">${Manarat.esc(x)}</span>`).join('');
Manarat.qs('#featuresGrid').innerHTML=(p.features||[]).map(f=>`<div class="card feature-card-premium"><div class="badge">${Manarat.esc(f.icon||'✨')}</div><h3>${Manarat.esc(f.title||'ميزة')}</h3><p class="muted">${Manarat.esc(f.desc||'')}</p><div class="feature-glow"></div></div>`).join('');Manarat.qs('#featuresSection').style.display=p.showFeatures===false?'none':'';Manarat.qs('#showcaseSection').style.display=p.showShowcase===false?'none':'';renderYouTubeSection(p);renderLatestGames(s);renderContactSection(p);applyHomeSectionOrder(p);fitHomeHeroText();activateHomeNav();Manarat.applyGenderQuickText(document);}document.addEventListener('DOMContentLoaded',async()=>{await Manarat.cloudSyncTables?.();render()});document.addEventListener('manarat:store-updated',render);window.addEventListener('resize',()=>fitHomeHeroText());window.addEventListener('scroll',()=>activateHomeNav(),{passive:true});
})();
