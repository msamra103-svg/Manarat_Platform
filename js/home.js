(function(){
let selectedYT=0;

function homeIcon(symbol){
 const paths={
 '🎮':'<path d="M6 7h12a3 3 0 0 1 3 3l1 6a2 2 0 0 1-3 2l-3-2H8l-3 2a2 2 0 0 1-3-2l1-6a3 3 0 0 1 3-3Z"/><path d="M6 10v4m-2-2h4m8-1h.01M19 13h.01"/>',
 '🎬':'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="m10 9 5 3-5 3V9ZM3 8h18M7 5l2 3m5-3 2 3"/>',
 '🤖':'<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8M1 11v5m22-5v5"/>',
 '📚':'<path d="M12 6v15M3 4h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v15h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3V4Z"/>',
 '🧩':'<path d="M8 3H3v6a3 3 0 1 1 0 6v6h6a3 3 0 1 1 6 0h6v-6a3 3 0 1 1 0-6V3h-6a3 3 0 1 1-7 0Z"/>',
 '📊':'<path d="M4 20V9h4v11m4 0V4h4v16m4 0V1M2 22h20"/>',
 '🏠':'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
 '✨':'<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z"/>',
 '💬':'<path d="M20 16a3 3 0 0 1-3 3H9l-5 3v-5a3 3 0 0 1-2-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9Z"/><path d="M6 9h10M6 13h6"/>',
 '👩‍🏫':'<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>'
 };
 return paths[symbol]?`<svg class="home-line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[symbol]}</svg>`:Manarat.esc(symbol||'');
}


const HOME_NAV_TABS=[
  {icon:'🏠',label:'الرئيسية',href:'#heroSection',style:'tab'},
  {icon:'✨',label:'الخدمات',href:'#featuresSection',style:'tab'},
  {icon:'🎬',label:'الفيديوهات',href:'#youtubeShowcaseSection',style:'tab'},
  {icon:'🎮',label:'الألعاب',href:'#latestPublicGamesSection',style:'tab'}
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
function renderButtons(list){return (list||[]).filter(x=>!String(x.href||'').includes('admin/admin.html')).map(x=>`<a class="${x.style==='tab'?'nav-tab':btnClass(x.style)}" href="${Manarat.esc(x.href||'#')}" data-nav-href="${Manarat.esc(x.href||'#')}"><span>${homeIcon(x.icon||'')}</span><b>${Manarat.esc(x.label||'زر')}</b></a>`).join('')}
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
    youtubeShowcaseSection:p.showYoutubeSection!==false
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
  const sec=ensureBeforeFooter('youtubeShowcaseSection','<div class="youtube-pro card premium-youtube"><div class="youtube-pro-head"><div><div class="kicker">🎬 قناة المدرسة</div><h2 id="youtubeSectionTitle"></h2><p id="youtubeSectionText" class="muted"></p></div><a id="youtubeChannelButton" class="btn dark" target="_blank" rel="noopener">زيارة القناة ▶️</a></div><div class="youtube-pro-grid"><div class="youtube-player-wrap"><div class="video-preview" id="videoPreview"><img id="youtubePoster" alt=""><button type="button" id="playFeaturedVideo" aria-label="تشغيل الفيديو المختار"><span aria-hidden="true">▶</span><b>مشاهدة الفيديو</b></button></div><iframe id="youtubeMainFrame" hidden title="فيديو منصة المدرسة" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><div class="youtube-current-info"><b id="youtubeCurrentTitle"></b><a id="youtubeCurrentLink" class="btn small ghost" target="_blank" rel="noopener">فتح الفيديو في يوتيوب</a></div></div><div id="youtubeThumbs" class="youtube-pro-thumbs"></div></div></div>');
  const videos=normalizeYTVideos(p.youtubeVideos||[]);
  sec.dataset.empty=videos.length?'false':'true';sec.style.display=(p.showYoutubeSection===false||!videos.length)?'none':'';
  if(!videos.length)return;
  selectedYT=Math.max(0,Math.min(selectedYT,videos.length-1));
  const current=videos[selectedYT]||videos[0];
  Manarat.qs('#youtubeSectionTitle').textContent=p.youtubeSectionTitle||'فيديوهات منصة المدرسة';
  Manarat.qs('#youtubeSectionText').textContent=p.youtubeSectionText||'اختر فيديو وشاهد نماذج من القناة.';
  const ch=Manarat.qs('#youtubeChannelButton');ch.href=p.youtubeChannelUrl||p.socialLinks?.youtube||'#';
  const frame=Manarat.qs('#youtubeMainFrame'),poster=Manarat.qs('#youtubePoster'),preview=Manarat.qs('#videoPreview');frame.removeAttribute('src');frame.hidden=true;preview.hidden=false;poster.hidden=false;poster.src='https://img.youtube.com/vi/'+current.id+'/hqdefault.jpg';poster.onerror=()=>poster.hidden=true;Manarat.qs('#playFeaturedVideo').onclick=()=>{preview.hidden=true;frame.hidden=false;frame.src='https://www.youtube.com/embed/'+encodeURIComponent(current.id)+'?autoplay=1';};
  Manarat.qs('#youtubeCurrentTitle').textContent=current.title||'فيديو منصة المدرسة';
  const currentUrl=current.url||`https://www.youtube.com/watch?v=${encodeURIComponent(current.id)}`;
  Manarat.qs('#youtubeCurrentLink').href=currentUrl;
  Manarat.qs('#youtubeThumbs').innerHTML=videos.map((v,i)=>`<button class="yt-pro-thumb ${i===selectedYT?'active':''}" data-yt="${i}"><img src="${Manarat.attr(v.thumbnail||('https://img.youtube.com/vi/'+v.id+'/hqdefault.jpg'))}" alt=""><span>${Manarat.esc(v.title)}</span><small>مشاهدة الآن</small></button>`).join('');
  Manarat.qsa('.yt-pro-thumb').forEach(btn=>btn.addEventListener('click',()=>{selectedYT=Number(btn.dataset.yt)||0;renderYouTubeSection(Manarat.store().platform)}));
}


function refreshV17Reveal(){document.querySelectorAll('.v17-reveal').forEach(el=>{el.classList.remove('v17-reveal');el.classList.add('is-visible')})}
function setupV17UI(){
  const toggle=document.getElementById('mobileNavToggle');
  const nav=document.getElementById('homeNavLinks');
  if(toggle&&nav){
    toggle.onclick=()=>{
      const open=nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded',String(open));
      toggle.textContent=open?'×':'☰';
    };
    nav.addEventListener('click',e=>{
      if(e.target.closest('a')){
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded','false');
        toggle.textContent='☰';
      }
    });
  }
  const back=document.getElementById('v17BackTop');
  if(back){
    back.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
    const syncBack=()=>back.classList.toggle('show',window.scrollY>620);
    window.addEventListener('scroll',syncBack,{passive:true});
    syncBack();
  }
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
const quickCards=[
  {icon:'🎮',title:'الألعاب التعليمية',desc:'أنشئ وشغّل ألعابًا متعددة الأنماط وشاركها مع الطلاب.',href:'#showcaseSection',tag:'ابدأ التجربة'},
  {icon:'🎬',title:'فيديوهات المدرسة',desc:'شاهد نماذج مختارة مباشرة من القناة التعليمية للمدرسة.',href:'#youtubeShowcaseSection',tag:'شاهد النماذج'},
  {icon:'🤖',title:'توليد ذكي للأسئلة',desc:'حوّل النصوص والملفات إلى أسئلة تعليمية قابلة للتعديل.',href:'auth.html',tag:'للمعلمين'},
  {icon:'📊',title:'نتائج ومتابعة',desc:'تابع محاولات الطلاب وأدر محتواك من لوحة واحدة.',href:'auth.html',tag:'لوحة المعلم'}
];
const highlights=['تشغيل فردي أو منافسة','اختيار عدد الأسئلة من شاشة اللعب','لوحة أرقام الأسئلة','اختيار عشوائي سينمائي','تصحيح يدوي للأسئلة المقالية'];
Manarat.qs('#heroQuickCards').innerHTML=quickCards.map(c=>`<a class="hero-quick-card" href="${Manarat.attr(c.href||'#')}"><div class="badge">${homeIcon(c.icon)}</div><div><b>${Manarat.esc(c.title)}</b><p>${Manarat.esc(c.desc)}</p><small>${Manarat.esc(c.tag||'انتقال')}</small></div></a>`).join('');
Manarat.qs('#showcaseHighlights').innerHTML=highlights.map(x=>`<span class="showcase-chip">${Manarat.esc(x)}</span>`).join('');
Manarat.qs('#featuresGrid').innerHTML=(p.features||[]).map(f=>`<div class="card feature-card-premium"><div class="badge">${homeIcon(f.icon||'✨')}</div><h3>${Manarat.esc(f.title||'ميزة')}</h3><p class="muted">${Manarat.esc(f.desc||'')}</p><div class="feature-glow"></div></div>`).join('');Manarat.qs('#featuresSection').style.display=p.showFeatures===false?'none':'';Manarat.qs('#showcaseSection').style.display=p.showShowcase===false?'none':'';renderYouTubeSection(p);renderLatestGames(s);applyHomeSectionOrder(p);fitHomeHeroText();activateHomeNav();refreshV17Reveal();Manarat.applyGenderQuickText(document);}
document.addEventListener('DOMContentLoaded',async()=>{setupV17UI();render();await Manarat.cloudSyncTables?.();render()});
document.addEventListener('manarat:store-updated',render);
window.addEventListener('resize',()=>fitHomeHeroText());
window.addEventListener('scroll',()=>activateHomeNav(),{passive:true});
})();
