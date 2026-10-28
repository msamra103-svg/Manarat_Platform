/* School V21: Complete Cinematic Educational Gaming Platform + Full Admin Experience Studio */
(()=>{'use strict';
const M=window.Manarat,$=id=>document.getElementById(id),esc=M.esc;
const endpoint='https://yltlzogrhwvnmxcnaesu.supabase.co/functions/v1/school-api';
const adminPanel=new URLSearchParams(location.search).get('adminPanel');
if(adminPanel)document.body.classList.add('admin-embedded');
const KEY='sb_publishable_W-XxH2FTvSZq66b-eHt-TQ_a8ZuqGRD';
const OFFICIAL_SCHOOL_NAME='مدرسة أبو عبيدة الإعدادية للبنين';
const games={race:['🏎️','سباق السيارات'],football:['⚽','كرة القدم'],basketball:['🏀','كرة السلة'],volleyball:['🏐','الكرة الطائرة'],bowling:['🎳','البولينج'],fishing:['🎣','صيد الأسماك'],'target-shooting':['🎯','التصويب على الهدف'],puzzle:['🧩','بازل الصور'],classic:['✦','تحدّي المعرفة']};
const gameCategories={race:'speed',football:'sports',basketball:'sports',volleyball:'sports',bowling:'speed',fishing:'mind','target-shooting':'sports',puzzle:'mind',classic:'mind'};
const types={multiple_choice:'اختيار من متعدد',true_false:'صح وخطأ',open_text:'مقالي',matching:'مطابقة',connecting:'توصيل',ordering:'ترتيب',classification:'تصنيف',puzzle_image:'بازل الصور'};
function gameIcon(k){const paths={race:'<path d="M3 15l2-6h14l2 6v4H3zM7 9l2-4h6l2 4M6 19v2m12-2v2M6 14h2m8 0h2"/>',football:'<circle cx="12" cy="12" r="9"/><path d="M12 7l5 4-2 6H9l-2-6zM12 3v4m9 5l-4-1m-2 6l3 3M9 17l-3 3M3 12l4-1"/>',basketball:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5 5q12 7 0 14M19 5q-12 7 0 14"/>',volleyball:'<circle cx="12" cy="12" r="9"/><path d="M12 3q-4 6 0 9t0 9M3 12q5-3 9 0M12 12q3-5 8-6M5 6q3 6 2 12"/>',bowling:'<path d="M8 3h4v5l3 9q1 4-5 4t-5-4l3-9zM8 7h4"/><circle cx="18" cy="17" r="4"/><path d="M17 16h.1m2 0h.1"/>',fishing:'<path d="M14 3v9q0 5-5 5t-4-5M5 12l2 2M4 5l16-3"/><path d="M12 20q4-6 8-2l3-2v6l-3-2q-4 3-8 0z"/>','target-shooting':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="M21 3l-7.5 7.5M17 3h4v4"/>',puzzle:'<path d="M4 4h6q-2 6 3 5t2-5h5v6q-6-2-5 3t5 2v5h-6q2-6-3-5t-2 5H4v-6q6 2 5-3t-5-2z"/>',classic:'<path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths[k]||paths.classic}</svg>`;}

const DEFAULT_NAV_ITEMS=[
 {id:'hero',label:'الرئيسية',href:'#heroShowcaseSection',icon:'⌂',visible:true},
 {id:'games',label:'الألعاب التعليمية',href:'#gamesGallerySection',icon:'🎮',visible:true},
 {id:'champions',label:'نجوم التميز',href:'#weeklyChampionsSection',icon:'🏆',visible:true},
 {id:'topGames',label:'الأكثر تفاعلًا',href:'#weeklyTopGamesSection',icon:'🔥',visible:true},
 {id:'videos',label:'مكتبة الفيديو',href:'#schoolVideosSection',icon:'🎬',visible:true},
 {id:'about',label:'عن المنصة',href:'#aboutSchoolSection',icon:'🏛️',visible:true}
];

const THEME_PRESETS=window.ManaratDesign?.presets||{};
function defaultConfig(){
 return {
  name:OFFICIAL_SCHOOL_NAME,
  subtitle:'منصة التعلّم التفاعلي والألعاب التعليمية',
  primary:'#8a1538',
  background:'#f6f4f0',
  accent:'#d4af37',
  themePreset:'qatar-arena',
  fontFamily:'Tajawal',
  cardRadius:18,
  motionLevel:'balanced',
  layoutDensity:'comfortable',
  stickyHeader:true,
  logo:'',
  logoSize:44,
  ministryLogo:'',
  showMinistryLogo:true,
  ministryLogoSize:44,
  schoolImage:'',
  showSchoolImage:true,
  schoolImageStyle:'cinematic-glass',
  schoolImagePos:'center',
  schoolImageOverlay:52,
  hero:'تعلّم بطريقتك. وتقدّم كل يوم.',
  description:'منصة الألعاب التعليمية التفاعلية ثلاثية الأبعاد — مهمات صفية، واجبات منزلية، وتقارير إنجاز مباشرة تجمع معلمي المدرسة وطلابها.',
  heroIntervalSeconds:6,
  heroAutoRotate:true,
  enablePuzzleInHero:false,
  galleryColumns:4,
  rankingsEnabled:true,
  teacherRecognitionEnabled:true,
  studentPrivacyMode:'abbreviated',
  videoLayout:'featured-split',
  socials:[],
  homepageVideos:[],
  navItems:structuredClone(DEFAULT_NAV_ITEMS),
  sections:['games','champions','topGames','activeTeachers','videos','about']
 };
}

let config=defaultConfig(),data=null,tab='games',assignment=null,play=null,selected='race',noticeTimer,settingsDraft,studioModule='all',previewDeviceMode='desktop',activeGameCategory='all',activeVideoSubject='all';

function gameHUD(){if(!play||!assignment)return '';const maximum=play.questions.reduce((n,q)=>n+Math.max(1,Math.min(100,Number(q.points)||10)),0),score=maximum?Math.round((play.points||0)*100/maximum):0;return `<header class="game-session-hud"><div class="session-identity"><span>${esc(config.name)}</span><strong>${esc(assignment.title)}</strong><div class="session-details"><span>${esc(games[play.template]?.[1]||'')}</span><span>المادة: ${esc(assignment.subject||'غير محددة')}</span>${assignment.teacher?`<span>المعلم: ${esc(assignment.teacher)}</span>`:''}${assignment.class_name?`<span>${esc(assignment.class_name)}</span>`:''}</div></div><div class="session-scores"><div><small>النقاط التعليمية</small><b>${play.points||0}<em> / ${maximum}</em></b></div><div><small>${assignment.mode==='group'?'النمط':play.pendingCount?'الدرجة المبدئية':'الدرجة'}</small><b>${assignment.mode==='group'?'جماعي':score+'%'}</b></div><div><small>الإجابات</small><b>${play.completed||0}<em> / ${play.questions.length}</em></b></div></div>${play.demo?'<p class="session-note">تجربة تدريبية — لا تُسجّل نتائجها في حسابات الطلاب.</p>':play.pendingCount?'<p class="session-note">توجد إجابات تنتظر تصحيح المعلم.</p>':''}</header>`;}

function controlsBusy(){return !!play?.answerPending||!!play?.lifecyclePending;}
async function restartSession(){if(!play||controlsBusy())return;const old=play;if(old.demo){close();startDemo(old.template);return;}if(!old.startArgs){close();renderJoin();return;}old.lifecyclePending=true;try{const next=await api('start',old.startArgs);play=Object.assign(next,{startArgs:{...old.startArgs},index:0,correct:0,points:0,completed:0,pendingCount:0,template:old.template});close();renderPlay();}finally{old.lifecyclePending=false;}}
function endSession(){if(!play||controlsBusy())return;play.stopped=true;close();show(`<section class="auth card"><span class="eyebrow">${esc(assignment.title)}</span><h1>تم إنهاء اللعب</h1><p>المحاولة غير مكتملة، ولم تُسجّل كنتيجة نهائية.</p><p>أجبت عن ${play.completed||0} من ${play.questions.length} سؤال.</p><div data-game-nav-slot></div></section>`);window.ManaratNavigation?.update();}
window.ManaratGameControls={isActive:()=>!!play&&!play.finished&&!play.stopped&&document.body.classList.contains('playing-game'),canRestart:()=>!!play,isBusy:controlsBusy,restart:restartSession,end:endSession};

function renderPlay(){if(play.template==='race')renderRace();else if(['football','basketball','bowling','volleyball','fishing','target-shooting'].includes(play.template))renderSport();else renderQuestion();}
function updateGameHUD(){document.querySelectorAll('.game-session-hud').forEach(el=>el.outerHTML=gameHUD());}
function startDemo(sport){if(sport==='puzzle')return home();if(!['race','football','basketball','bowling','volleyball','fishing','target-shooting','puzzle','classic'].includes(sport))return home();const questions=[{id:'demo1',type:'multiple_choice',text:'كم يساوي حاصل ضرب ٣ × ٤؟',options:['٧','١٢','١٦'],correct:1,points:10},{id:'demo2',type:'multiple_choice',text:'ما الكوكب الذي نعيش عليه؟',options:['الأرض','المريخ','زحل'],correct:0,points:10},{id:'demo3',type:'multiple_choice',text:'أيّ هذه الكلمات تدل على جمع؟',options:['كتاب','طالب','أشجار'],correct:2,points:10}];assignment={title:'تجربة '+games[sport][1],subject:'معارف عامة',teacher:'',class_name:'',mode:'demo',settings:{templates:[sport],types:['multiple_choice']},videos:[]};play={id:'demo-'+sport,secret:'local-demo',demo:true,questions,index:0,correct:0,points:0,completed:0,pendingCount:0,template:sport,threshold:70};renderPlay();}
async function api(action,payload={}){if(play?.demo&&payload.id===play.id){if(action==='answer'){const q=play.questions.find(q=>q.id===payload.question);if(!q)throw new Error('سؤال غير صالح.');const correct=payload.value===q.correct;return {correct,pending:false,points:correct?q.points:0,max:q.points,feedback:correct?'إجابة صحيحة، أحسنت!':'إجابة غير صحيحة، واصل المحاولة.',explanation:''};}if(action==='finish'){const total=play.questions.reduce((n,q)=>n+q.points,0);const score=Math.round((play.points||0)/total*100);return {score,pending:false,passed:score>=70,group:false};}if(action==='leaderboard')return [];}
if(adminPanel&&window.parent&&window.parent!==window){try{const broker=window.parent.ManaratAdminRequests;if(broker)return await broker.request(action,payload);}catch(e){throw e;}}const publicAction=['settings','homeHub','open','start','answer','finish','leaderboard','register','loginAlias'].includes(action);if(!publicAction)await M.ensureFreshSession();const token=publicAction?null:M.authSession()?.access_token;const res=await fetch(endpoint,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...payload})});const j=await res.json();if(!res.ok)throw new Error(j.error||'تعذر الاتصال.');return j;}
function notice(msg){$('notice').textContent=msg;$('notice').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').style.display='none',5500);}
async function run(fn,button){if(button)button.disabled=true;try{return await fn();}catch(e){notice(e.message||'تعذر تنفيذ العملية.');if($('app').querySelector?.('.loading'))show('<section class="card"><h2>تعذر فتح الصفحة</h2><p>'+esc(e.message)+'</p><a class="button" href="index.html">العودة للرئيسية</a></section>');}finally{if(button)button.disabled=false;}}
function show(html){document.body.classList.toggle?.('playing-game',html.includes('class="game-session-hud"'));$('app').innerHTML=html;window.ManaratDesignRuntime?.afterRender(config);window.scrollTo(0,0);}
function dialog(html){$('modal').classList.toggle?.('football-question',!!play&&play.template==='football'&&html.includes('game-layout'));$('modal').classList.toggle?.('scene-question',!!play&&['volleyball','fishing','puzzle','classic'].includes(play.template)&&html.includes('game-layout'));$('modal').classList.toggle?.('target-shooting-question',!!play&&play.template==='target-shooting'&&html.includes('game-layout'));$('modalContent').innerHTML=(html.includes('game-layout')?'<div data-game-nav-slot></div>':'')+html;if(!$('modal').open)$('modal').showModal();}
function close(){$('modal').close();}
function button(text,action,id='',cls=''){return `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;}
function field(label,id,value='',type='text'){return `<label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}">`;}

function resolveNavItems(c){
 const list=Array.isArray(c?.navItems)&&c.navItems.length?c.navItems:DEFAULT_NAV_ITEMS;
 return list.filter(item=>item&&item.visible!==false&&item.label);
}

function applyBrand(c){
 const cfg=window.ManaratDesign?window.ManaratDesign.normalize({...defaultConfig(),...(c||{})}):{...defaultConfig(),...(c||{})};
 const outdatedBrand=/(?:منارة\s*(?:التعلم|التعلّم)?|DIGITAL LEARNING BEACON|Manarat(?:\s+Learning)?)/i;
 const oldSocialLink=/61574253098010|mnrltlmlrqmy|manartaltalm|منارةالتعلمالرقمي/i;
 if(outdatedBrand.test(cfg.name||''))cfg.name=OFFICIAL_SCHOOL_NAME;
 if(outdatedBrand.test(cfg.subtitle||''))cfg.subtitle='منصة التعلّم التفاعلي والألعاب التعليمية';
 if(outdatedBrand.test(cfg.footerText||''))cfg.footerText=cfg.name+' · مساحة للتعلّم التفاعلي والإنجاز الرقمي';
 if(Array.isArray(cfg.socials))cfg.socials=cfg.socials.filter(s=>!oldSocialLink.test(decodeURIComponent(String(s.url||'')))&&!outdatedBrand.test(s.label||''));
 if(String(cfg.logo||'').includes('manarat-logo.svg')||String(cfg.logo||'').includes('manarat-mark.svg'))cfg.logo='assets/school-mark.svg';

 const preset=THEME_PRESETS[cfg.themePreset]||THEME_PRESETS.qatar||{};
 const primary=cfg.primary||preset.primary||'#8a1538';
 const background=cfg.background||preset.background||'#FAF8F7';
 const accent=cfg.accent||preset.accent||'#d4af37';
 const isDark=cfg.themePreset==='dark'||/^#0[0-9a-f]/i.test(background);
 const rootStyle=document.documentElement.style;
 rootStyle.setProperty('--primary',primary);
 rootStyle.setProperty('--bg',background);
 rootStyle.setProperty('--accent',accent);
 rootStyle.setProperty('--ui-radius',(Number(cfg.cardRadius)||18)+'px');
 rootStyle.setProperty('--logo-size',(Math.max(32,Math.min(72,Number(cfg.logoSize)||44)))+'px');
 rootStyle.setProperty('--ministry-logo-size',(Math.max(32,Math.min(72,Number(cfg.ministryLogoSize)||44)))+'px');
 rootStyle.setProperty('--school-overlay',(Math.max(15,Math.min(88,Number(cfg.schoolImageOverlay)??52))/100).toFixed(2));
 rootStyle.setProperty('--gallery-cols',String(Math.max(2,Math.min(4,Number(cfg.galleryColumns)||4))));
 if(document.body?.dataset){
  document.body.dataset.themePreset=cfg.themePreset||(isDark?'midnight-cyber':'qatar-arena');
  document.body.dataset.motionLevel=cfg.motionLevel||'balanced';
  document.body.dataset.layoutDensity=cfg.layoutDensity||'comfortable';
  document.body.dataset.fontFamily=cfg.fontFamily||'Tajawal';
 }
 const hdr=$('platformHeader');
 if(hdr&&hdr.classList?.toggle){hdr.classList.toggle('is-sticky',cfg.stickyHeader!==false);}
 $('brandName').textContent=cfg.name;
 $('brandSubtitle').textContent=cfg.subtitle;
 document.title=cfg.name+' | منصة التعلم';
 window.ManaratDesignRuntime?.apply(cfg);
 $('brandMark').innerHTML=`<img alt="شعار مدرسة أبو عبيدة الإعدادية للبنين" src="${esc(cfg.logo||'assets/school-mark.svg')}" referrerpolicy="no-referrer">`;
 const minSlot=$('ministryBrandSlot'),minImg=$('ministryLogoImg');
 if(minSlot){
  minSlot.hidden=cfg.showMinistryLogo===false;
  if(minImg&&cfg.ministryLogo)minImg.src=cfg.ministryLogo;
 }
 const navTrack=$('primaryNavTabs');
 if(navTrack){
  const items=resolveNavItems(cfg);
  navTrack.innerHTML=items.map((it,idx)=>`<a href="${esc(it.href||'#')}" class="nav-tab-btn ${idx===0?'active':''}" data-nav-href="${esc(it.href||'#')}"><span class="nav-tab-icon" aria-hidden="true">${esc(it.icon||'✦')}</span><span class="nav-tab-label">${esc(it.label)}</span></a>`).join('');
 }
 $('footer').innerHTML=`<div class="footer-brand-row"><strong>${esc(cfg.name)}</strong><span>·</span><span>${esc(cfg.footerText||cfg.name+' · مساحة للتعلّم التفاعلي والإنجاز الرقمي')}</span></div><div class="row footer-links-row">${(cfg.socials||[]).filter(s=>s.visible!==false&&/^https:\/\//.test(s.url)).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</div>`;
}

async function navigation(){if($('adminLink')){$('adminLink').hidden=true;if(M.isAuthenticated())try{const p=await api('profile');$('adminLink').hidden=!p.admin;}catch{}}$('dashboardLink').hidden=!M.isAuthenticated();$('loginLink').textContent=M.isAuthenticated()?'خروج':'دخول المعلم';}
let hubData={videos:[],weekly:null,puzzleAvailable:false},heroIdx=0,heroTimer=null,heroPaused=false,activeVideoKey='';
const sectionLabels={schoolIdentity:'واجهة مبنى المدرسة والهوية',games:'الألعاب التعليمية',champions:'نجوم التميز الأسبوعي',topGames:'الألعاب الأكثر تفاعلًا',activeTeachers:'المعلمون الأكثر تفعيلًا',videos:'مكتبة الفيديوهات التعليمية',about:'عن المنصة والتواصل'};
const heroCatalog={
 football:{key:'football',name:'كرة القدم',badge:'ملعب ثلاثي الأبعاد',headline:'مرّر بذكاء، أجب بدقة، وسجّل هدف الفوز',pitch:'واجه حارس المرمى في بيئة ثلاثية الأبعاد وحوّل كل إجابة صحيحة إلى هجمة متقنة.',cover:'assets/game-covers/football.svg'},
 volleyball:{key:'volleyball',name:'الكرة الطائرة',badge:'تداول 6×6',headline:'استقبل، أعدّ الكرة، واضرب ساحقًا بالمعرفة',pitch:'تبادل الكرات فوق الشبكة مع فريقك وتقدّم في الأشواط عبر الإجابات المتتالية.',cover:'assets/game-covers/volleyball.svg'},
 basketball:{key:'basketball',name:'كرة السلة',badge:'صالة 3D',headline:'صوّب رميتك الثلاثية نحو السلة بإجاباتك الصحيحة',pitch:'تحكّم في زاوية التصويب والتوقيت بعد كل سؤال علمي أو مهاري تجيب عنه بنجاح.',cover:'assets/game-covers/basketball.svg'},
 race:{key:'race',name:'سباق السيارات',badge:'حلبة سباق 3D',headline:'انطلق في المضمار وتجاوز الحواجز المعرفية',pitch:'قد سيارتك على الحلبة وافتح بوابات العبور نحو خط النهاية مع كل إجابة متقنة.',cover:'assets/game-covers/race.svg'},
 bowling:{key:'bowling',name:'البولينج',badge:'فيزياء 10 قوارير',headline:'اضبط الزاوية والدوران وأسقط القوارير العشر',pitch:'محاكاة فيزيائية واقعية تكافئ إجابتك الصحيحة برمية مثالية على مضمار البولينج.',cover:'assets/game-covers/bowling.svg'},
 fishing:{key:'fishing',name:'صيد الأسماك',badge:'بيئة بحرية 3D',headline:'راقب حركة الأسماك تحت الماء واصطد الإجابة الصحيحة',pitch:'تجربة هادئة ومركّزة تجمع دقة الملاحظة واستحضار المعلومة في بيئة مائية تفاعلية.',cover:'assets/game-covers/fishing.svg'},
 'target-shooting':{key:'target-shooting',name:'التصويب على الهدف',badge:'٤ أنماط · سهم لكل سؤال',headline:'الهدف الدائري والطيور والبالونات والطبق الطائر',pitch:'اختر نمط التصويب من أربعة أنماط ثلاثية الأبعاد؛ ينطلق السهم ثم يظهر السؤال قبل الإصابة، والصحيح يصيب الهدف والخاطئ يخطئه.',cover:'assets/game-covers/target-shooting.svg'},
 classic:{key:'classic',name:'تحدّي المعرفة',badge:'مسابقة تفاعلية',headline:'اختبر سرعة البديهة والفهم العميق في جميع المواد',pitch:'تحدٍّ معرفي مباشر يدعم الأسئلة الموضوعية والمقالية والمطابقة والترتيب والتصنيف.',cover:'assets/game-covers/classic.svg'},
 puzzle:{key:'puzzle',name:'بازل الصور',badge:'تركيب الصور',headline:'ركّب أجزاء الصورة التعليمية واكتشف المفهوم الكامل',pitch:'تحدٍّ بصري تفاعلي لتجميع الخرائط والرسوم العلمية والصور التعليمية داخل المهمات.',cover:'assets/game-covers/puzzle.svg'}
};
function getActiveHeroSlides(){
 const hub=window.ManaratHomepageHub;
 if(hub?.getHeroSlides)return hub.getHeroSlides({settings:config,puzzleAvailable:false}).filter(s=>s.key!=='puzzle').map(s=>({...s,cover:config.design?.games[s.key]?.cover||s.cover}));
 const order=['football','volleyball','basketball','race','bowling','fishing','target-shooting','classic'];
 // Puzzle eligibility is evaluated only inside the authorized assignment.
 return order.map(k=>({...heroCatalog[k],ctaLabel:k==='puzzle'?'متاح داخل مهام الصور':'جرّب '+heroCatalog[k].name,ctaHref:k==='puzzle'?'#joinForm':'index.html?demo='+k}));
}
function updateHeroDOM(idx){
 const slides=getActiveHeroSlides();if(!slides.length)return;
 heroIdx=((idx%slides.length)+slides.length)%slides.length;
 const s=slides[heroIdx],box=$('heroSceneBox'),img=$('heroSceneImg'),title=$('heroSceneTitle'),desc=$('heroSceneDesc'),badge=$('heroSceneBadge'),cta=$('heroPlayLink');
 if(box?.dataset)box.dataset.scene=s.key;
 if(img){const cardImg=document.querySelector?.(`.game-cover[data-scene="${s.key}"] img`);img.src=config.design?.games[s.key]?.cover||cardImg?.src||s.cover;img.classList.remove('is-changing');void img.offsetWidth;img.classList.add('is-changing');img.alt='مشهد لعبة '+s.name;}
 if(title)title.textContent=s.headline;if($('heroShowcaseContainer'))$('heroShowcaseContainer').setAttribute('aria-label',`اللعبة ${heroIdx+1} من ${slides.length}: ${s.name}`);
 if(desc)desc.textContent=s.pitch;
 if(badge)badge.textContent=s.name+' · '+s.badge;
 if(cta){cta.textContent=s.ctaLabel+' ←';cta.href=s.ctaHref;}
 document.querySelectorAll?.('.hero-chip').forEach(c=>{const active=c.dataset.id===s.key;c.classList.toggle('active',active);c.setAttribute?.('aria-selected',active?'true':'false');});
 document.querySelectorAll?.('.hero-dot').forEach((d,i)=>d.classList.toggle('active',i===heroIdx));
 window.ManaratCovers?.refresh();
}
function scheduleHeroRotation(){
 clearTimeout(heroTimer);
 if(config?.heroAutoRotate===false||!document.querySelector||config.design?.motion==='minimal')return;
 if(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
 const sec=Math.max(4,Math.min(20,Number(config?.heroIntervalSeconds)||6));
 heroTimer=setTimeout(()=>{
  if(!heroPaused&&$('heroSceneBox'))updateHeroDOM(heroIdx+1);
  if($('heroSceneBox'))scheduleHeroRotation();
 },sec*1000);
 heroTimer?.unref?.();
}
function resolveHomeVideos(){
 const source=window.ManaratHomepageHub?.mergePublicVideos({settingsVideos:config.homepageVideos||[],schoolVideos:(hubData.videos||[]).map(v=>({...v,show_on_homepage:true})),platformVideos:[]})||hubData.videos||[];
 const d=config.design||{},order=d.videoOrder||[];
 return source.filter(v=>!(d.videoHidden||[]).includes(v.key)).sort((a,b)=>{const af=[a.key,a.id,a.youtubeId].includes(d.featuredVideo),bf=[b.key,b.id,b.youtubeId].includes(d.featuredVideo);return Number(bf)-Number(af)||(order.includes(a.key)?order.indexOf(a.key):999)-(order.includes(b.key)?order.indexOf(b.key):999);}).slice(0,d.videoLimit||12);
}
function renderVideoStageMarkup(v){
 if(!v)return '';
 if(config.design?.videoPlayer==='dialog')return `<button type="button" class="v21-video-poster" data-action="openHomeVideo" data-id="${esc(v.key)}">▷ ${esc(v.title)}</button>`;
 const player=v.kind==='youtube'&&v.youtubeId
  ?`<iframe class="home-video-iframe" title="${esc(v.title)}" src="https://www.youtube-nocookie.com/embed/${esc(v.youtubeId)}?rel=0" loading="lazy" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen" allowfullscreen></iframe>`
  :`<video class="home-video-native" controls preload="metadata" src="${esc(v.url)}"></video>`;
 return `<div class="home-video-player-frame">${player}</div><div class="home-video-meta"><div class="home-video-meta-text"><span class="home-video-subject">${esc(v.subject||'مكتبة المدرسة')}</span><h3 id="activeHomeVideoTitle">${esc(v.title)}</h3></div><a class="button quiet home-video-ext" href="${esc(v.url)}" target="_blank" rel="noopener">فتح في نافذة مستقلة ↗</a></div>`;
}
function resolveWeeklyHub(){
 if(hubData?.weekly&&Array.isArray(hubData.weekly.champions)&&hubData.weekly.champions.length===3)return hubData.weekly;
 const hub=window.ManaratHomepageHub;
 if(hub?.computeWeeklyRankings)return hub.computeWeeklyRankings({sessions:[],assignments:[],games:[],teachers:[],settings:config});
 return {
  week:{labelAr:'الأحد – السبت · توقيت الدوحة'},
  champions:[
   {grade:'7',title:'نجم الصف السابع',gradeLabel:'الصف السابع',hasWinner:false,emptyPrompt:'من سيكون نجم الصف السابع هذا الأسبوع؟',metricLabel:'أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف السابع.'},
   {grade:'8',title:'نجم الصف الثامن',gradeLabel:'الصف الثامن',hasWinner:false,emptyPrompt:'من سيكون نجم الصف الثامن هذا الأسبوع؟',metricLabel:'أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف الثامن.'},
   {grade:'9',title:'نجم الصف التاسع',gradeLabel:'الصف التاسع',hasWinner:false,emptyPrompt:'من سيكون نجم الصف التاسع هذا الأسبوع؟',metricLabel:'أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف التاسع.'}
  ],
  topGames:[],
  activeTeachers:[]
 };
}
function resolveHomepageSections(){return (config.sections||['games','about']).filter(s=>s!=='schoolIdentity'||config.showSchoolImage&&config.schoolImage);}

function renderSchoolBuildingShowcase(){
 if(config.showSchoolImage===false||!config.schoolImage)return '';
 const imgSrc=config.schoolImage;
 const styleMode=config.schoolImageStyle||'cinematic-glass';
 const posMode=config.schoolImagePos||'center';
 return `<div class="school-architectural-banner style-${esc(styleMode)}" data-testid="school-building-showcase">
  <div class="school-photo-frame">
   <img src="${esc(imgSrc)}" alt="المبنى المدرسي — ${esc(config.name||OFFICIAL_SCHOOL_NAME)}" style="object-position:${esc(posMode)}" loading="eager" decoding="async" referrerpolicy="no-referrer">
   <div class="school-photo-scrim" aria-hidden="true"></div>
  </div>
  <div class="school-identity-plaque">
   <div class="plaque-top-row">
    <span class="plaque-ministry-kicker">وزارة التربية والتعليم والتعليم العالي · دولة قطر</span>
    <span class="plaque-grade-scope">المرحلة الإعدادية · الصفوف ٧ – ٨ – ٩</span>
   </div>
   <h2 class="plaque-school-name">${esc(config.name||OFFICIAL_SCHOOL_NAME)}</h2>
   <p class="plaque-school-sub">${esc(config.subtitle||'منصة التعلّم التفاعلي والألعاب التعليمية')}</p>
  </div>
 </div>`;
}

function home(){
 if(window.ManaratDesign)config=window.ManaratDesign.normalize(config);
 const slides=getActiveHeroSlides();
 if(heroIdx>=slides.length)heroIdx=0;
 const curSlide=slides[heroIdx]||slides[0];
 const weekly=resolveWeeklyHub();
 const videosList=resolveHomeVideos();
 const activeVid=videosList.find(v=>v.key===activeVideoKey)||videosList[0]||null;
 if(activeVid)activeVideoKey=activeVid.key;
 const totalWeekSessions=weekly.topGames.reduce((sum,g)=>sum+(Number(g.sessionsCount)||0),0);
 const totalWeekStudents=hubData.analytics?.participants??null;
 const vidLayout=config.videoLayout||'featured-split';

 const sections={
  schoolIdentity:`<section class="home-section school-identity-section" id="schoolIdentitySection">${renderSchoolBuildingShowcase()}</section>`,

  games:`<section class="home-section" id="gamesGallerySection"><div class="section-head"><div><span class="section-kicker">ميدان التعلّم التفاعلي · بيئات ثلاثية الأبعاد</span><h2>اختر ملعبك. وابدأ التحدّي.</h2><p>اختر التجربة التفاعلية ثلاثية الأبعاد التي تحبها من الألعاب التي يتيحها معلمك، وأجب بدقة لتحسم الجولة.</p></div><div class="gallery-filter-bar" role="group" aria-label="تصنيف الألعاب"><button type="button" class="gallery-filter-btn ${activeGameCategory==='all'?'active':''}" data-action="filterGames" data-id="all">الكل (${config.design?.gameOrder.filter(k=>k!=='puzzle'&&config.design.games[k].visible).length||7})</button><button type="button" class="gallery-filter-btn ${activeGameCategory==='sports'?'active':''}" data-action="filterGames" data-id="sports">ملاعب رياضية 3D</button><button type="button" class="gallery-filter-btn ${activeGameCategory==='speed'?'active':''}" data-action="filterGames" data-id="speed">سباقات وفيزياء</button><button type="button" class="gallery-filter-btn ${activeGameCategory==='mind'?'active':''}" data-action="filterGames" data-id="mind">تحديات وتركيز</button></div></div><div class="grid games-gallery" data-cols="${esc(config.galleryColumns||4)}">${Object.entries(games).filter(([k])=>k!=='puzzle'&&config.design?.games[k]?.visible!==false).map(([k,g],idx)=>{const cat=gameCategories[k]||'mind';const dimmed=activeGameCategory!=='all'&&activeGameCategory!==cat;return `<article class="card game-cover-card ${dimmed?'is-filtered-out':''}" data-game-cat="${cat}" data-game="${k}"><div class="game-cover" data-scene="${k}"><img src="assets/game-covers/${k}.svg" alt="مشهد ${g[1]}" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="cover-number">0${idx+1}</span><span class="cover-badge">${({race:'سباق 3D',football:'ملعب 3D',basketball:'صالة 3D',volleyball:'تداول 6×6',bowling:'فيزياء 10 قوارير',fishing:'بيئة مائية 3D','target-shooting':'تصويب تعليمي',puzzle:'أسئلة الصور',classic:'مسابقة معرفية'})[k]}</span></div><div class="game-cover-body"><div class="game-card-title-row"><h3>${g[1]}</h3><span class="game-card-icon" aria-hidden="true">${gameIcon(k)}</span></div><p class="muted">${({race:'تقدّم بسيارتك وتجاوز الحواجز مع كل إجابة صحيحة.',football:'أجب عن السؤال وسدّد نحو المرمى في مواجهة الحارس.',basketball:'أجب عن السؤال وصوّب الكرة نحو السلة.',volleyball:'تابع الكرة عند الشبكة وأجب لتحسم النقطة.',bowling:'اضبط الزاوية والدوران وأسقط القوارير العشر.',fishing:'راقب حركة الأسماك تحت الماء واصطد إجابتك الصحيحة.','target-shooting':'شاهد الرامي يشد القوس، ثم أجب عن السؤال؛ سهمك يصيب عند الإجابة الصحيحة.',puzzle:'ركّب أجزاء الصورة التعليمية بالسحب والإفلات.',classic:'ركّز في الأسئلة المباشرة وتابع تقدمك الدراسي.'})[k]}</p>${k==='puzzle'?`<button type="button" class="button quiet game-launch-btn" data-action="joinFocus">متاح في مهام الصور ←</button>`:`<a class="button quiet game-launch-btn" href="index.html?demo=${k}">${k==='race'?'جرّب السباق':'جرّب اللعبة'} ←</a>`}</div></article>`;}).join('')}</div></section>`,

  champions:`<section class="home-section champions-section" id="weeklyChampionsSection" data-testid="weekly-champions-section"><div class="section-head"><div><span class="section-kicker">لوحة الشرف المدرسية · تحديث أسبوعي (${esc(weekly.week?.labelAr||'الأحد – السبت')})</span><h2>نجوم التميز لهذا الأسبوع</h2><p>يُحتسب التميز تلقائيًا من نتائج المهمات الفردية المكتملة لكل صف دراسي وفق توقيت الدوحة.</p></div><span class="ranking-rule-note">الصفوف الإعدادية: السابع · الثامن · التاسع</span></div><div class="champions-board">${weekly.champions.map(c=>`<article class="champion-box ${c.hasWinner?'is-crowned':'is-awaiting'}" data-grade="${esc(c.grade)}" data-testid="champion-card-grade-${esc(c.grade)}"><div class="champion-header"><span class="champion-grade-label">${esc(c.gradeLabel)}</span><span class="champion-emblem" aria-hidden="true">${c.hasWinner?'🏆':'☆'}</span></div><h3>${esc(c.title)}</h3>${c.hasWinner?`<div class="champion-winner-body"><strong class="champion-student-name">${esc(c.studentName)}</strong><span class="champion-class-meta">${esc(c.className)}</span><div class="champion-score-bar" aria-hidden="true"><span style="width:${Math.min(100,Math.max(20,Number(c.avgScore)||80))}%"></span></div><div class="champion-metrics"><b>${c.avgScore}%</b><span>${esc(c.metricLabel)}</span></div></div>`:`<div class="champion-empty-body"><p class="champion-prompt">${esc(c.emptyPrompt)}</p><p class="champion-subtext">${esc(c.metricLabel)}</p>${button('ادخل رمز المهمة ونافس الآن ←','joinFocus','','quiet champion-cta')}</div>`}</article>`).join('')}</div></section>`,

  topGames:`<section class="home-section top-games-section" id="weeklyTopGamesSection" data-testid="weekly-top-games-section"><div class="section-head"><div><span class="section-kicker">مؤشر التفاعل الطلابي الأسبوعي · إحصاءات مباشرة</span><h2>الألعاب الأكثر تفاعلًا هذا الأسبوع</h2><p>أكثر الألعاب التعليمية اختيارًا وتشغيلًا في المهمات الصفية والواجبات المنزلية خلال الأسبوع الحالي.</p></div><div class="engagement-kpi-strip"><span>إجمالي الجولات: <b>${totalWeekSessions}</b></span><span>·</span>${totalWeekStudents!==null?`<span>مشاركون فريدون: <b>${totalWeekStudents}</b></span>`:''}</div></div>${weekly.topGames.length?`<div class="top-games-board">${weekly.topGames.filter(g=>g.key!=='puzzle').map(g=>`<div class="top-game-row" data-testid="top-game-row"><div class="top-game-rank">0${g.rank}</div><img class="top-game-thumb" src="${esc(g.cover)}" alt="${esc(g.name)}" width="80" height="45" loading="lazy"><div class="top-game-info"><div class="top-game-title-row"><h3>${esc(g.name)}</h3><span class="top-game-stats"><b>${g.sessionsCount}</b> جولة مكتملة${g.uniqueStudents?` · ${g.uniqueStudents} طالب`:''}${g.avgScore?` · متوسط ${g.avgScore}%`:''}</span></div><div class="top-game-bar-track" role="progressbar" aria-valuenow="${g.sharePercent}" aria-valuemin="0" aria-valuemax="100"><span class="top-game-bar-fill" style="width:${g.sharePercent}%"></span></div></div><a class="button quiet top-game-try" href="index.html?demo=${esc(g.key)}">جرّبها ←</a></div>`).join('')}</div>`:`<div class="empty">لا توجد جولات مكتملة معتمدة هذا الأسبوع بعد. ابدأ مهمة تعليمية لتظهر المؤشرات الحقيقية.</div>`}</section>`,

  activeTeachers:`<section class="home-section active-teachers-section" id="weeklyTeachersSection" data-testid="weekly-teachers-section"><div class="section-head"><div><span class="section-kicker">تقدير العطاء التربوي · مبادرات التعلم التفاعلي</span><h2>المعلمون الأكثر تفعيلًا للمنصة</h2><p>إشادة أسبوعية بمعلمي المدرسة الأكثر إطلاقًا للمهمات التفاعلية ومتابعةً لإنجاز الطلاب.</p></div></div>${weekly.activeTeachers.length?`<div class="teachers-board">${weekly.activeTeachers.map((t,idx)=>`<article class="teacher-box" data-testid="active-teacher-card"><div class="teacher-rank-badge">#${idx+1}</div><div class="teacher-info"><h3>${esc(t.name)}</h3><span class="teacher-subject">${esc(t.subject)}</span><p class="teacher-metrics">${esc(t.summaryText)}</p></div></article>`).join('')}</div>`:`<div class="teachers-empty-banner"><div class="teachers-empty-content"><h3>لوحة التميز التربوي لهذا الأسبوع</h3><p>تُحدّث قائمة المعلمين الأكثر تفعيلًا تلقائيًا مع إطلاق المهمات الصفية والواجبات المنزلية خلال الأسبوع الدراسي.</p></div>${button('دخول مساحة المعلم لإطلاق مهمة ←','dashboard','','quiet')}</div>`}</section>`,

  videos:`<section class="home-section videos-gallery-section" id="schoolVideosSection" data-testid="homepage-video-gallery"><div class="section-head"><div><span class="section-kicker">الشروحات المرئية والمحتوى الإثرائي</span><h2>مكتبة الفيديوهات التعليمية</h2><p>شاهد الشروحات المرئية المعتمدة من إدارة المدرسة والمعلمين، واستعدّ جيدًا قبل بدء التحديات التعليمية.</p></div><span class="video-count-note">${videosList.length?`${videosList.length} فيديو متاح للمشاهدة`:'مرتبطة بالمهمات والقناة التعليمية'}</span></div>${videosList.length?`<div class="video-gallery-board layout-${esc(vidLayout)}"><div class="video-featured-stage" id="featuredVideoStage">${renderVideoStageMarkup(activeVid)}</div>${videosList.length>1?`<div class="video-playlist" role="list" aria-label="قائمة الفيديوهات التعليمية">${videosList.map((v,idx)=>`<button type="button" class="video-thumb-btn ${v.key===activeVid?.key?'active':''}" data-action="selectHomeVideo" data-id="${esc(v.key)}" aria-label="تشغيل ${esc(v.title)}"><div class="video-thumb-preview">${v.thumbnail?`<img src="${esc(v.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span class="video-thumb-fallback">▷</span>`}<span class="video-thumb-index">0${idx+1}</span></div><div class="video-thumb-caption"><strong>${esc(v.title)}</strong><span>${esc(v.subject||'مكتبة المدرسة')}</span></div></button>`).join('')}</div>`:''}</div>`:`<div class="video-empty-board"><div class="video-empty-text"><h3>شاهد، افهم، ثم جرّب</h3><p class="muted">تجد فيديوهات المادة التي أضافها معلمك داخل رابط المهمة، كما تظهر هنا الفيديوهات العامة المنشورة من إدارة المدرسة.</p></div><div class="row">${button('لديّ رمز مهمة تعليمية ←','joinFocus','','quiet')}${button('إدارة مكتبة الفيديو (للمعلمين)','dashboard','','outline')}</div></div>`}</section>`,

  analytics:`<section class="home-section" id="learningAnalyticsSection"><div class="section-head"><div><span class="section-kicker">بيانات فعلية · توقيت الدوحة</span><h2>نبض التعلّم هذا الأسبوع</h2><p>مؤشرات النشاط المعتمد عبر المهمات التعليمية.</p></div></div>${window.ManaratDesignRuntime?.analytics(hubData,config)||''}</section>`,
  about:`<section class="home-section about-school-section" id="aboutSchoolSection"><div class="about-board"><div class="about-main"><span class="section-kicker">الهوية المدرسية والرسالة التربوية</span><h2>من نحن · ${esc(config.name)}</h2><p>${esc(config.about||config.description)}</p><div class="row">${(config.socials||[]).filter(s=>s.visible!==false&&/^https:\/\//.test(s.url)).map(s=>`<a class="button quiet" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</div></div>${config.contactText?`<div class="about-contact"><h3>تواصل معنا</h3><p>${esc(config.contactText)}</p></div>`:`<div class="about-contact"><h3>بيئة تعليمية قطرية معتمدة</h3><p>تجمع المنصة بين الألعاب التفاعلية ثلاثية الأبعاد، الواجبات الذكية، وتقارير المتابعة الفورية لطلاب المرحلة الإعدادية.</p></div>`}</div></section>`
 };

 const activeSections=resolveHomepageSections();
 const showTopSchoolBanner=false;
 show(`<div class="platform-home">
  ${showTopSchoolBanner?renderSchoolBuildingShowcase():''}
  <section class="hero" id="heroShowcaseSection">
   <div class="hero-copy-column">
    <span class="eyebrow hero-school-name">${esc(config.name)}</span>
    <h1>${esc(config.hero)}</h1>
    <p>${esc(config.description)}</p>
    <div class="hero-metrics"><div class="hero-metric"><b>${Object.entries(config.design.games).filter(([k,g])=>k!=='puzzle'&&g.visible).length}</b><span>تجارب تعليمية</span></div><div class="hero-metric"><b>٧ · ٨ · ٩</b><span>صفوف المرحلة الإعدادية</span></div></div>
    <div class="row hero-cta-row">${button('دخول مساحة المعلم ←','dashboard')}${button('لديّ رابط أو رمز مهمة','joinFocus','','outline')}</div>
   </div>
   <div class="hero-showcase" id="heroShowcaseContainer" tabindex="0" role="region" aria-label="معرض الألعاب التفاعلية">
    <div class="hero-scene" id="heroSceneBox" data-scene="${esc(curSlide.key)}"><img id="heroSceneImg" src="${esc(curSlide.cover)}" alt="مشهد لعبة ${esc(curSlide.name)}" width="640" height="360" decoding="async" referrerpolicy="no-referrer"></div>
    <div class="hero-controls-top"><span class="hero-live" id="heroSceneBadge">${esc(curSlide.name+' · '+curSlide.badge)}</span><div class="hero-nav-arrows">${button('‹','heroPrev','','hero-arrow-btn')}${button('›','heroNext','','hero-arrow-btn')}</div></div>
    <div class="hero-showcase-caption">
     <div class="hero-caption-row">
      <div><h3 id="heroSceneTitle">${esc(curSlide.headline)}</h3><p id="heroSceneDesc">${esc(curSlide.pitch)}</p></div>
      <a id="heroPlayLink" class="button hero-try-cta" href="${esc(curSlide.ctaHref)}">${esc(curSlide.ctaLabel)} ←</a>
     </div>
     <div class="hero-switcher" role="tablist" aria-label="اختيار اللعبة المعروضة">${slides.map((s,i)=>`<button type="button" role="tab" aria-selected="${i===heroIdx?'true':'false'}" class="hero-chip ${i===heroIdx?'active':''}" data-action="heroScene" data-id="${esc(s.key)}">${esc(s.name)}</button>`).join('')}</div>
    </div>
   </div>
  </section>
  <form id="joinForm" class="join row"><label for="joinCode" style="margin:0;font-weight:700">ادخل إلى مهمتك أو المسابقة المباشرة</label><input id="joinCode" autocomplete="off" placeholder="كود المسابقة أو رابط المهمة من معلمك" required><button type="submit">دخول ←</button><span class="help">الدخول للطالب بالاسم فقط دون كلمة مرور</span></form>
  ${activeSections.map(s=>sections[s]||'').join('')}
 </div>`);
 window.ManaratDesignRuntime?.afterRender(config);
 const heroBox=$('heroShowcaseContainer');if(heroBox){const pause=document.createElement('button');pause.type='button';pause.id='v21HeroPause';pause.textContent='إيقاف التدوير';pause.onclick=()=>{heroPaused=pause.getAttribute('aria-pressed')!=='true';pause.setAttribute('aria-pressed',String(heroPaused));pause.textContent=heroPaused?'استئناف التدوير':'إيقاف التدوير';};heroBox.querySelector('.hero-showcase-caption')?.append(pause);}
 bindHeroInteractions();
 scheduleHeroRotation();
 window.ManaratCovers?.refresh();
}
function bindHeroInteractions(){
 const box=$('heroShowcaseContainer');if(!box||!box.addEventListener)return;
 box.addEventListener('mouseenter',()=>{heroPaused=true;});
 box.addEventListener('mouseleave',()=>{heroPaused=$('v21HeroPause')?.getAttribute('aria-pressed')==='true';});
 box.addEventListener('focusin',()=>{heroPaused=true;});
 box.addEventListener('focusout',()=>{heroPaused=$('v21HeroPause')?.getAttribute('aria-pressed')==='true';});
 box.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'){e.preventDefault();updateHeroDOM(heroIdx+1);scheduleHeroRotation();}
  if(e.key==='ArrowRight'){e.preventDefault();updateHeroDOM(heroIdx-1);scheduleHeroRotation();}
 });
 let touchStartX=null;
 box.addEventListener('touchstart',e=>{touchStartX=e.changedTouches?.[0]?.clientX??null;heroPaused=true;},{passive:true});
 box.addEventListener('touchend',e=>{
  const endX=e.changedTouches?.[0]?.clientX??null;
  if(touchStartX!==null&&endX!==null&&Math.abs(endX-touchStartX)>40){
   updateHeroDOM(endX>touchStartX?heroIdx+1:heroIdx-1);
  }
  touchStartX=null;heroPaused=true;if($('v21HeroPause')){$('v21HeroPause').setAttribute('aria-pressed','true');$('v21HeroPause').textContent='استئناف التدوير';}scheduleHeroRotation();
 },{passive:true});
}
function auth(signup=false){show(`<section class="auth card"><span class="eyebrow">مساحة المعلمين · ${esc(config.name)}</span><h1>${signup?'أنشئ حسابك':'أهلًا بعودتك'}</h1><p class="muted">${signup?'اسم مستخدم وكلمة مرور؛ لا تحتاج إلى بريد إلكتروني.':'أدخل اسم المستخدم. يمكن للأدمن استخدام بريده الحالي.'}</p><form id="authForm" data-signup="${signup}">${signup?field('الاسم الكامل','fullName'):''}${field('اسم المستخدم'+(signup?'':' أو بريد الأدمن'),'username')}${field('كلمة المرور','password','','password')}<p class="help">${signup?'8 أحرف على الأقل. اسم المستخدم فريد ولا يحتوي على مسافات.':'نسيت كلمة المرور؟ تواصل مع إدارة المدرسة لإعادة تعيينها.'}</p><button style="width:100%">${signup?'إنشاء الحساب':'تسجيل الدخول'}</button></form><div style="margin-top:18px">${button(signup?'لديّ حساب بالفعل':'إنشاء حساب معلم',signup?'login':'signup','','quiet')}</div></section>`);$('username').autocomplete='username';$('password').autocomplete=signup?'new-password':'current-password';}
async function dashboard(){if(!M.isAuthenticated())return auth();if(!data)show('<p class="loading">جارٍ تحميل مساحتك…</p>');data=adminPanel==='settings'?{profile:await api('profile')}:await api('dashboard',adminPanel?{panel:adminPanel}:{});if($('adminLink'))$('adminLink').hidden=!data.profile.admin;if(adminPanel){if(!data.profile.admin)throw new Error('هذه اللوحة متاحة للإدارة فقط.');tab=['settings','teachers','students','reports','assignments','videos','games'].includes(adminPanel)?adminPanel:'settings';}renderDashboard();}
function mountStudentAnalytics(initialTaskFilter=''){if(typeof window!=='undefined'&&window.ManaratStudentAnalytics?.mount){window.ManaratStudentAnalytics.mount('studentAnalyticsMount',{sessions:data?.sessions||[],assignments:data?.assignments||[],games:data?.games||[],initialTaskFilter});}}
function renderDashboard(){if(adminPanel){show('<section id="panel"></section>');renderPanel();return;}const group=data.sessions.filter(s=>s.mode==='group'),individual=data.sessions.filter(s=>s.mode!=='group'&&s.finished_at);const showTopAnalytics=['games','analytics'].includes(tab);show(`<div class="teacher-workspace"><div class="section-head workspace-heading"><div><span class="eyebrow">${data.profile.admin?'إدارة المدرسة':'مساحة المعلم'}</span><h1 style="margin:5px 0">أهلًا، ${esc(data.profile.name)}</h1><p>نظّم المحتوى، فعّل التعلّم، وتابع أثره.</p></div><div class="workspace-actions">${data.profile.admin?'<a class="button quiet" href="admin/admin.html">لوحة التحكم ←</a>':''}<a class="button quiet" href="live.html?host=1">مسابقة مباشرة</a><a class="button" href="teacher/create-game.html">＋ إنشاء لعبة</a></div></div><div class="stats"><div class="card stat"><b>${data.games.length}</b><span>لعبة أنشئت</span></div><div class="card stat"><b>${new Set(data.sessions.map(s=>s.assignment_id)).size}</b><span>مهمة تم تشغيلها</span></div><div class="card stat"><b>${group.length}</b><span>جلسة جماعية في الصف</span></div><div class="card stat"><b>${individual.length}</b><span>محاولة فردية مكتملة</span></div></div><div class="tabs">${[['games','ألعابي'],['assignments','المهمات والواجبات'],['videos','فيديوهاتي'],['reports','سجل الإنجاز'],['analytics','تطور مستوى الطلاب'],...(data.profile.admin?[['teachers','المعلمون'],['settings','استوديو الهوية والتصميم']]:[])].map(([k,t])=>button(t,'tab',k,k===tab?'active':'')).join('')}</div>${showTopAnalytics?'<div id="studentAnalyticsMount"></div>':''}<section id="panel"></section></div>`);if(showTopAnalytics)mountStudentAnalytics('');renderPanel();}
const empty=(s)=>`<div class="empty">${s}</div>`;
function renderPanel(){const p=$('panel');if(tab==='games')p.innerHTML=data.games.length?`<div class="grid">${data.games.map(g=>`<article class="card"><span class="tag">${esc(g.subject||'مادة تعليمية')}</span><h3>${esc(g.title)}</h3><p class="muted">${(g.data.questions||[]).length} سؤال · ${esc(g.grade||'اختر الصف عند الإسناد')}</p><div class="row">${button('إسناد وتشغيل','assign',g.id)}<a class="button quiet" href="teacher/create-game.html?edit=${encodeURIComponent(g.id)}">تحرير</a></div></article>`).join('')}</div>`:empty('ابدأ بإنشاء لعبة وأضف أسئلتك يدويًا أو بالذكاء الاصطناعي.');
if(tab==='assignments')p.innerHTML=data.assignments.length?`<div class="grid">${data.assignments.map(a=>`<article class="card"><span class="tag">${esc(a.class_name||'مهمة تعليمية')} · ${a.active?'متاحة':'متوقفة'}</span><h3>${esc(a.title)}</h3><p class="muted">${a.settings.templates.map(k=>games[k]?.[1]).join(' · ')}</p><div class="stack"><div class="row">${button('نسخ رابط الواجب','copy',a.id)}${button('تشغيل صفي','class',a.id,'quiet')}${a.active?`<a class="button quiet" href="live.html?host=1&assignment=${a.id}">استضافة مباشرة</a>`:''}</div>${button(a.active?'إيقاف المهمة':'إعادة التفعيل','toggle',a.id,'outline')}</div></article>`).join('')}</div>`:empty('أنشئ إسنادًا من تبويب ألعابي، ثم شارك رابط الواجب مع الطلاب.');
if(tab==='videos')p.innerHTML=`<div class="section-head"><div><h2>مكتبتك التعليمية</h2><p>أضف رابط فيديو أو ارفع ملفًا واربطه بمادة أو لعبة، أو انشره في الصفحة الرئيسية للمدرسة.</p></div>${button('＋ إضافة فيديو','addVideo')}</div><div class="grid">${data.videos.map(v=>`<article class="card"><span class="tag">${esc(v.subject||'فيديو تعليمي')}${!v.game_id?' · عام للرئيسية':''}</span><h3>${esc(v.title)}</h3><div class="row">${button('مشاهدة','watch',v.id,'quiet')}${button('حذف','deleteVideo',v.id,'outline')}</div></article>`).join('')}</div>`;
if(tab==='analytics')p.innerHTML='';
if(tab==='reports')renderReports();if(tab==='settings')renderSettings();if(tab==='teachers')renderAccounts();if(tab==='students')renderStudents();
}
function assignmentForm(id){const g=data.games.find(g=>g.id===id),available=[...new Set((g.data.questions||[]).map(q=>q.type))];dialog(`<h2>إسناد «${esc(g.title)}»</h2><form id="assignmentForm" data-game="${esc(id)}">${field('عنوان المهمة','assignmentTitle',g.title)}${field('الصف / الشعبة','className')}<label>الألعاب المتاحة للطالب</label><div class="check-grid">${Object.entries(games).map(([k,g])=>`<label class="check"><input type="checkbox" name="templates" value="${k}" checked>${gameIcon(k)} ${g[1]}</label>`).join('')}</div><fieldset class="shooting-options" style="border:1px solid #e8dde1;border-radius:14px;padding:10px 12px"><legend>🎯 التصويب على الهدف</legend><p class="help">الرامي يسحب القوس تلقائيًا، ثم يظهر السؤال في المنتصف. الإجابة الصحيحة تصيب الهدف والخاطئة تخطئه. سهم واحد لكل سؤال.</p></fieldset><label>أنواع الأسئلة المتاحة</label><div class="check-grid">${available.map(k=>`<label class="check"><input type="checkbox" name="types" value="${esc(k)}" checked>${types[k]||esc(k)}</label>`).join('')}</div><div class="two-col"><div>${field('درجة الاجتياز %','passingScore',70,'number')}</div><div>${field('موعد الإغلاق (اختاري)','deadline','','datetime-local')}</div></div><label class="check"><input id="leaderboard" type="checkbox" checked>إظهار قائمة الصدارة للمشاركين</label><p class="help">اللعب الجماعي يُحتسب جلسة للمعلم. الفردي فقط يُسجّل باسم الطالب ودرجته.</p><button>إنشاء رابط المهمة</button></form>`);}
function link(a){const u=new URL('index.html',location.href);u.searchParams.set('task',a.code);return u.href;}
function videoForm(){dialog(`<h2>إضافة فيديو تعليمي</h2><form id="videoForm">${field('العنوان','videoTitle')}${field('المادة','videoSubject')}${field('رابط الفيديو (يوتيوب أو ملف فيديو)','videoUrl','','url')}<label for="videoFile">أو ارفع ملف فيديو (حتى 40 MB)</label><input id="videoFile" type="file" accept="video/mp4,video/webm"><label for="videoGame">نطاق العرض</label><select id="videoGame"><option value="">عام — الصفحة الرئيسية للمدرسة وجميع مهماتي</option>${data.games.map(g=>`<option value="${esc(g.id)}">خاص بلعبة: ${esc(g.title)}</option>`).join('')}</select>${data?.profile?.admin?`<label class="check" style="margin-top:10px"><input id="videoPinHomepage" type="checkbox" checked>تثبيت أيضًا في قائمة فيديوهات الصفحة الرئيسية للمدرسة</label>`:''}<button style="margin-top:18px">حفظ الفيديو</button></form>`);}
function watch(v){let u;try{u=new URL(v.url);}catch{return;}const youtube=['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname);let id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1];dialog(`<h2>${esc(v.title)}</h2>${youtube&&/^[\w-]{11}$/.test(id||'')?`<iframe class="media" title="${esc(v.title)}" src="https://www.youtube-nocookie.com/embed/${id}" allow="fullscreen" allowfullscreen></iframe>`:/\.(mp4|webm)(\?|$)/i.test(v.url)?`<video class="media" controls src="${esc(v.url)}"></video>`:`<a class="button" href="${esc(v.url)}" target="_blank" rel="noopener">فتح الفيديو</a>`}`);}
function renderReports(){const selectedReport=$('reportAssignment')?.value||'',rows=data.sessions.filter(s=>s.mode!=='group'&&(!selectedReport||s.assignment_id===selectedReport));$('panel').innerHTML=`<div class="section-head"><div><h2>سجل الإنجاز الفردي</h2><p>الصف: ${rows.filter(s=>s.mode==='individual').length} محاولة · المنزل: ${rows.filter(s=>s.mode==='home').length} محاولة</p></div>${button('تصدير Excel (CSV)','export','','quiet')}</div><label for="reportAssignment">تصفية بالمهمة</label><select id="reportAssignment"><option value="">كل المهمات</option>${data.assignments.map(a=>`<option value="${a.id}" ${selectedReport===a.id?'selected':''}>${esc(a.title)} · ${esc(a.class_name)}</option>`).join('')}</select><div id="studentAnalyticsMount"></div><div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>الطالب</th><th>المهمة</th><th>المكان</th><th>الدرجة</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${esc(s.student_name)}</td><td>${esc(data.assignments.find(a=>a.id===s.assignment_id)?.title||'')}</td><td>${s.mode==='home'?'المنزل':'الصف'}</td><td>${s.score??'—'}${s.score!==null?'%':''}</td><td>${!s.finished_at?'بدأ اللعب':s.pending?'بانتظار التصحيح':'مكتملة'}</td><td>${button('السجل','student',s.id,'quiet')} ${button('الإجابات','review',s.id,'outline')}</td></tr>`).join('')}</tbody></table></div><p class="help">الأسماء لا تُدمج تلقائيًا. يمكنك تصحيح اسم المحاولة أو ربطها بسجل طالب آخر بعد مراجعتك. تُعرض أحدث 5000 جلسة.</p>`;mountStudentAnalytics(selectedReport);}
function studentRecord(id){const s=data.sessions.find(s=>s.id===id),rows=data.sessions.filter(x=>x.mode!=='group'&&x.student_key===s.student_key);dialog(`<h2>سجل ${esc(s.student_name)}</h2><p>${new Set(rows.map(x=>x.assignment_id)).size} مهمة · ${rows.length} محاولة</p><div class="stack">${rows.map(x=>`<div class="card"><b>${esc(data.assignments.find(a=>a.id===x.assignment_id)?.title||'')}</b><p>${x.score??'—'}% · ${x.pending?'بانتظار التصحيح':x.finished_at?'مكتملة':'غير مكتملة'}</p></div>`).join('')}</div><form id="renameForm" data-id="${id}">${field('تصحيح اسم هذه المحاولة','correctedName',s.student_name)}<label for="mergeKey">ربط بسجل موجود (اختياري، بعد المراجعة)</label><select id="mergeKey"><option value="">الاحتفاظ بالسجل الحالي</option>${[...new Map(data.sessions.filter(x=>x.mode!=='group'&&x.student_key!==s.student_key).map(x=>[x.student_key,x])).values()].map(x=>`<option value="${esc(x.student_key)}">${esc(x.student_name)} · ${esc(x.student_key.slice(0,8))}</option>`).join('')}</select><button style="margin-top:15px">حفظ التصحيح</button></form>`);}
async function review(id){const s=await api('review',{id});dialog(`<h2>إجابات ${esc(s.student_name||'الجلسة الجماعية')}</h2><div class="stack">${s.questions.map(q=>{const a=s.answers[q.id];return `<div class="card"><b>${esc(q.text)}</b><p class="muted">${a?esc(typeof a.value==='string'?a.value:JSON.stringify(a.value)):'لم تُجب بعد'}</p>${a?.pending?`<form class="gradeForm" data-id="${s.id}" data-q="${esc(q.id)}"><label>الدرجة من ${a.max}</label><input name="points" type="number" min="0" max="${a.max}" required><label>تغذية راجعة</label><input name="feedback"><button style="margin-top:10px">اعتماد الدرجة</button></form>`:a?`<span class="tag">${a.points} / ${a.max}</span>`:''}</div>`;}).join('')}</div>`);}

function renderAccounts(){const owner='m.samra103@gmail.com';$('panel').innerHTML=`<h2>المستخدمون والصلاحيات</h2><p class="muted">المعلم يدير محتواه ونتائج طلابه. مدير المنصة يدير جميع الحسابات والإعدادات. التسجيل متاح من صفحة الدخول.</p><div class="table-wrap"><table><thead><tr><th>الحساب</th><th>الصلاحية</th><th>الحالة</th><th>إدارة الحساب</th></tr></thead><tbody>${data.teachers.map(t=>`<tr><td><b>${esc(t.name)}</b><br><small>${esc(t.email)}</small></td><td>${t.role==='admin'?'مدير المنصة':'معلم'}</td><td>${esc(t.status)}</td><td>${t.id===data.profile.id||t.email?.toLowerCase()===owner?'حساب محمي':button(t.role==='admin'?'تحويل إلى معلم':'منح إدارة كاملة','role',t.id,'outline')+' '+button(t.status==='موقوف'?'تفعيل':'إيقاف','teacherStatus',t.id,'quiet')}${t.role==='teacher'?' '+button('إعادة كلمة المرور','reset',t.id,'quiet'):''}</td></tr>`).join('')}</tbody></table></div>`;}
function renderStudents(){const students=new Map();for(const s of data.sessions.filter(s=>s.mode!=='group')){const key=s.student_key||s.id;if(!students.has(key))students.set(key,{id:s.id,name:s.student_name,count:0,done:0});const t=students.get(key);t.count++;if(s.finished_at)t.done++;}$('panel').innerHTML=`<h2>الطلاب وسجلات التعلّم</h2><p class="muted">يدخل الطلاب بالاسم ورابط المهمة دون كلمة مرور. تحكّم في إتاحة الدخول من «المهمات والواجبات». يمكنك تصحيح الاسم وربط المحاولات من سجل الطالب.</p>${students.size?`<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>المحاولات</th><th>المكتملة</th><th>السجل</th></tr></thead><tbody>${[...students.values()].map(t=>`<tr><td>${esc(t.name)}</td><td>${t.count}</td><td>${t.done}</td><td>${button('عرض وتعديل السجل','student',t.id,'quiet')}</td></tr>`).join('')}</tbody></table></div>`:empty('تظهر سجلات الطلاب بعد أول مشاركة في مهمة.')}`;}

function renderSettings(){window.ManaratStudio.mount({host:$('panel'),config,api,onSaved:c=>{config=c;applyBrand(c);if(adminPanel)parent.postMessage({type:'school-settings-saved'},location.origin);}});}

async function openAssignment(code,mode='home'){assignment=await api('open',{code});assignment.code=code;assignment.mode=mode;selected=assignment.settings.templates[0];renderJoin();}
function availableTemplates(type=''){const hasPuzzle=assignment.types.includes('puzzle_image')&&assignment.settings.types.includes('puzzle_image');return assignment.settings.templates.filter(k=>games[k]&&(k!=='puzzle'||hasPuzzle&&(!type||type==='puzzle_image')));}
function refreshTemplateChoices(){const type=$('questionType')?.value||'',allowed=availableTemplates(type);if(!allowed.includes(selected))selected=allowed[0]||'';const box=$('templateChoices');if(box)box.innerHTML=allowed.length?allowed.map(k=>`<button type="button" data-action="selectTemplate" data-id="${k}" class="${k===selected?'selected':''}"><b>${gameIcon(k)}</b>${games[k][1]}</button>`).join(''):'<p class="help">لا توجد طريقة لعب متاحة لهذا النوع من الأسئلة.</p>';const submit=$('startForm')?.querySelector('button[type="submit"]');if(submit)submit.disabled=!allowed.length;}
function renderJoin(){show(`<section class="game-layout"><span class="eyebrow">${esc(assignment.class_name)} · ${assignment.mode==='group'?'لعب جماعي على السبورة':assignment.mode==='individual'?'لعب فردي في الصف':'واجب منزلي'}</span><h1>${esc(assignment.title)}</h1>${assignment.videos.length?`<div class="card"><h3>قبل أن تبدأ</h3><div class="row">${assignment.videos.map(v=>button('▷ '+esc(v.title),'taskVideo',v.id,'quiet')).join('')}</div></div>`:''}<form id="startForm"><div class="card" style="margin-top:20px">${assignment.mode!=='group'?field('اسم الطالب','studentName',localStorage.getItem('abuobaid_student_name')||''):'<p>تُحتسب هذه الجلسة ضمن إنجاز المعلم فقط.</p>'}<h3>اختر طريقة اللعب</h3><div id="templateChoices" class="template">${availableTemplates().map(k=>`<button type="button" data-action="selectTemplate" data-id="${k}" class="${k===selected?'selected':''}"><b>${gameIcon(k)}</b>${games[k][1]}</button>`).join('')}</div><label for="questionType">نوع الأسئلة</label><select id="questionType"><option value="">كل الأنواع المتاحة</option>${assignment.types.filter(t=>assignment.settings.types.includes(t)).map(t=>`<option value="${t}">${types[t]||esc(t)}</option>`).join('')}</select><button type="submit" style="margin-top:22px;width:100%">ابدأ التحدّي ←</button></div></form></section>`);refreshTemplateChoices();}
function arena(){const n=play?.correct||0,total=play?.questions.length||5,progress=Math.round(n/total*100),k=play?.template||selected;let scene='';
if(k==='race')scene=`<rect x="0" y="72" width="600" height="85" rx="15" fill="#dfd8dc"/><path d="M0 114H600" stroke="white" stroke-width="3" stroke-dasharray="20 16"/><path d="M550 72V157" stroke="#8a1538" stroke-width="8" stroke-dasharray="9 8"/><g class="moving" transform="translate(${20+progress*4.7} 95)"><rect width="60" height="30" rx="12" fill="var(--primary)"/><rect x="18" y="5" width="23" height="20" rx="5" fill="white"/><circle cx="12" cy="0" r="6" fill="#38313b"/><circle cx="47" cy="0" r="6" fill="#38313b"/><circle cx="12" cy="30" r="6" fill="#38313b"/><circle cx="47" cy="30" r="6" fill="#38313b"/></g>`;
else if(k==='football')scene=`<rect x="20" y="30" width="560" height="160" rx="18" fill="#e2eee5"/><path d="M300 30V190M480 60H560V160H480Z" fill="none" stroke="#75937b" stroke-width="3"/><circle cx="300" cy="110" r="45" fill="none" stroke="#75937b"/><text x="${play?.lastCorrect?510:110}" y="130" font-size="48" class="moving">⚽</text><text x="50" y="60" fill="#36563e" font-size="18">${n} أهداف</text>`;
else if(k==='basketball')scene=`<rect x="40" y="32" width="520" height="155" rx="16" fill="#f0dfce"/><path d="M510 40V165M465 45H530V85H465Z" fill="none" stroke="#7b5d48" stroke-width="5"/><ellipse cx="480" cy="92" rx="25" ry="7" fill="none" stroke="#8a1538" stroke-width="5"/><path d="M458 97L468 122H492L503 97" fill="none" stroke="#fff" stroke-width="3"/><text x="${play?.lastCorrect?460:100}" y="${play?.lastCorrect?88:155}" font-size="43" class="moving">🏀</text>`;
else if(k==='volleyball')scene=`<rect x="25" y="155" width="550" height="30" fill="#eadbb8"/><path d="M300 45V170M300 60H410V125H300M320 60V125M345 60V125M370 60V125M395 60V125M300 80H410M300 100H410" stroke="#9f8390" fill="none" stroke-width="3"/><text x="${play?.lastCorrect?455:100}" y="${play?.lastCorrect?110:150}" font-size="50" class="moving">🏐</text>`;
else if(k==='bowling')scene=`<path d="M50 175L145 40H455L550 175Z" fill="#ecdfce"/>${Array.from({length:10},(_,i)=>`<text x="${245+(i%4)*25}" y="${60+Math.floor(i/4)*35}" font-size="28" opacity="${i<Math.ceil(progress/10)?.16:1}">♟</text>`).join('')}<circle cx="${play?.lastCorrect?300:95}" cy="${play?.lastCorrect?90:155}" r="17" fill="var(--primary)" class="moving"/>`;
else if(k==='target-shooting')scene=`<path d="M0 150H600V210H0Z" fill="#cfe3b8"/>${Array.from({length:5},(_,i)=>`<g transform="translate(${80+i*110} 95)" opacity="${i<Math.ceil(progress/20)?1:.35}"><circle r="34" fill="#fff" stroke="#ddd"/><circle r="26" fill="#1f7bd8"/><circle r="17" fill="#e2252b"/><circle r="8" fill="#ffd21f"/></g>`).join('')}<text x="440" y="40" font-size="20" fill="var(--primary)">${n} إصابة صحيحة</text>`;
else if(k==='fishing')scene=`<path d="M0 100Q30 80 60 100T120 100T180 100T240 100T300 100T360 100T420 100T480 100T540 100T600 100V210H0Z" fill="#d7edf0"/><path d="M120 40L320 25L330 135" stroke="#795943" stroke-width="3" fill="none"/>${Array.from({length:5},(_,i)=>`<text x="${60+i*100}" y="160" font-size="30" opacity="${i<Math.ceil(progress/20)?.2:1}">🐟</text>`).join('')}<text x="440" y="65" font-size="20" fill="var(--primary)">${n} صيد ناجح</text>`;
else if(k==='puzzle')scene=`<text x="220" y="145" font-size="95">🏫</text>${Array.from({length:12},(_,i)=>`<rect x="${180+(i%4)*60}" y="${30+Math.floor(i/4)*50}" width="58" height="48" rx="5" fill="var(--primary)" opacity="${i<Math.ceil(progress/100*12)?0:1}"/>`).join('')}`;
else scene=`<circle cx="300" cy="110" r="70" fill="#f0e0e6"/><text x="300" y="130" text-anchor="middle" font-size="48" fill="var(--primary)">${n}</text>`;
return `<div class="arena"><span class="arena-caption">${games[k][1]} · ${n} إجابات صحيحة</span><svg viewBox="0 0 600 210" role="img" aria-label="تقدم اللعبة ${progress}%">${scene}</svg></div>`;}
function questionUI(q){if(['multiple_choice','true_false'].includes(q.type))return `<div class="answers">${(q.options||['صح','خطأ']).map((o,i)=>button(esc(o),'answer',i)).join('')}</div>`;
if(['open_text','short_answer'].includes(q.type))return '<label for="answerText">اكتب إجابتك</label><textarea id="answerText"></textarea>'+button('إرسال الإجابة','textAnswer');
if(['matching','connecting'].includes(q.type))return q.pairs.map((p,i)=>`<label for="match${i}">${esc(p.left)}</label><select id="match${i}"><option value="">اختر…</option>${q.choices.map(c=>`<option>${esc(c)}</option>`).join('')}</select>`).join('')+'<p></p>'+button('تثبيت المطابقة','matchAnswer');
if(q.type==='ordering'){play.order=play.order||[...q.items];return `<p class="help">استخدم ↑ لإعادة ترتيب العناصر.</p><div class="stack">${play.order.map((it,i)=>`<div class="row card" style="padding:10px">${button('↑','orderUp',i,'quiet')}<span>${esc(it)}</span></div>`).join('')}</div><p></p>${button('تثبيت الترتيب','orderAnswer')}`;}
if(q.type==='classification')return q.classItems.map(it=>`<label>${it.image?`<img src="${esc(it.image)}" width="70" alt="عنصر للتصنيف">`:esc(it.text)}</label><select data-class-id="${esc(it.id)}"><option value="">اختر التصنيف…</option>${q.categories.map((c,i)=>`<option value="${i}">${esc(c.title)}</option>`).join('')}</select>`).join('')+'<p></p>'+button('تثبيت التصنيف','classAnswer');
if(q.type==='puzzle_image')return '<iframe id="originalPuzzle" title="بازل الصورة" src="games/puzzle.html" style="width:100%;height:72vh;border:0;border-radius:15px" allow="fullscreen"></iframe>';
if(q.type==='puzzle_grid_fallback'){const n=Number(q.puzzle_grid)||3;play.tiles=play.tiles||M.shuffle(Array.from({length:n*n},(_,i)=>i));return `<p class="help">اضغط قطعتين لتبديلهما حتى تكتمل الصورة.</p><div class="puzzle-board" style="grid-template-columns:repeat(${n},1fr)">${play.tiles.map((tile,pos)=>`<button data-action="tile" data-id="${pos}" class="${play.tile===pos?'selected':''}" aria-label="القطعة ${pos+1}" style="background-image:url('${esc(q.image).replace(/'/g,'%27')}');background-size:${n*100}%;background-position:${tile%n/(n-1)*100}% ${Math.floor(tile/n)/(n-1)*100}%"></button>`).join('')}</div>${button('تحقق من الصورة','puzzleAnswer')}`;}
return '<p>هذا النوع يحتاج مراجعة المعلم.</p>'+button('إرسال للمراجعة','textAnswer');}
function renderQuestion(){const q=play.questions[play.index];const render=['race','football','basketball','bowling','volleyball','fishing','target-shooting'].includes(play.template)?dialog:show;render(`${gameHUD()}<section class="game-layout"><div class="game-top"><b>${esc(assignment.title)}</b><span>${play.index+1} / ${play.questions.length}</span></div><div class="progress"><span style="width:${play.index/play.questions.length*100}%"></span></div>${['race','football','basketball','bowling','volleyball','fishing','target-shooting','puzzle','classic'].includes(play.template)?'':arena()}<article class="card"><span class="tag">${types[q.type]||'سؤال'}</span><h2 class="question">${esc(q.text)}</h2>${q.image&&q.type!=='puzzle_image'?`<img src="${esc(q.image)}" alt="صورة السؤال" style="max-width:100%;max-height:220px">`:''}<div id="answerArea">${questionUI(q)}</div><div id="feedback"></div></article></section>`);}
async function answer(value){if(play.answered||play.answerPending)return;play.answerPending=true;try{const q=play.questions[play.index],r=await api('answer',{id:play.id,secret:play.secret,question:q.id,value});play.answered=true;play.points=(play.points||0)+(Number(r.points)||0);play.completed=(play.completed||0)+1;play.pendingCount=(play.pendingCount||0)+(r.pending?1:0);updateGameHUD();play.lastCorrect=r.correct;play.lastPending=!!r.pending;if(r.correct)play.correct++;if(['football','basketball','bowling','volleyball','fishing','target-shooting'].includes(play.template)){close();$(play.template+'Game').contentWindow.postMessage({type:'school-'+play.template+'-result',token:play.sportToken,index:play.index,correct:r.correct,pending:r.pending,feedback:[r.feedback,r.explanation].filter(Boolean).join(' ')},location.origin);return;}$('answerArea').querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);$('feedback').innerHTML=`<div class="feedback ${!r.correct&&!r.pending?'wrong':''}"><b>${esc(r.feedback)}</b><p>${esc(r.explanation)}</p></div>${button(play.template==='race'?'واصل السباق ←':play.index===play.questions.length-1?'عرض النتيجة':'السؤال التالي ←','next')}`;if(document.querySelector('.arena'))document.querySelector('.arena').outerHTML=arena();}finally{play.answerPending=false;}}
async function finish(){const session=play;if(session.lifecyclePending)return;session.lifecyclePending=true;try{const r=await api('finish',{id:play.id,secret:play.secret});play.finished=true;show(`<section class="auth card" style="text-align:center;max-width:650px"><span class="eyebrow">${esc(assignment.title)}</span><h1>${r.group?'اكتملت الجلسة الصفية':r.pending?'أحسنت، وصلت إجاباتك':r.passed?'أحسنت! اجتزت المهمة':'تجربة مفيدة، واصل التعلّم'}</h1>${r.group?'<p>سُجّلت جلسة جماعية في إنجاز المعلم دون درجات فردية للطلاب.</p>':`<div class="result-score">${r.score}%</div><p>${r.pending?'الدرجة مبدئية حتى مراجعة الأسئلة المقالية.':'درجة الاجتياز '+play.threshold+'%'}</p>`}<div class="row" style="justify-content:center">${button('العودة للمهمة','replay','','quiet')}${!r.group?button('قائمة الصدارة','leaderboard'):''}</div><div id="leaderboardResults"></div></section>`);}finally{session.lifecyclePending=false;}}
function exportCSV(){const id=$('reportAssignment').value,rows=data.sessions.filter(s=>s.mode!=='group'&&(!id||s.assignment_id===id));const safe=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';const values=[['الطالب','المهمة','الصف','المكان','الدرجة','الحالة','التاريخ'],...rows.map(s=>{const a=data.assignments.find(a=>a.id===s.assignment_id);return[s.student_name,a?.title,a?.class_name,s.mode==='home'?'المنزل':'الصف',s.score,s.pending?'بانتظار التصحيح':s.finished_at?'مكتملة':'غير مكتملة',s.created_at];})];M.downloadFile('سجل-إنجاز-الطلاب.csv','\ufeff'+values.map(r=>r.map(safe).join(',')).join('\r\n'),'text/csv;charset=utf-8');}

document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,id=b.dataset.id;e.preventDefault();if(['heroScene','heroPrev','heroNext'].includes(a)){heroPaused=true;if($('v21HeroPause')){$('v21HeroPause').setAttribute('aria-pressed','true');$('v21HeroPause').textContent='استئناف التدوير';}}run(async()=>{
 if(a==='raceQuestion'){if(play?.raceQuestion)renderQuestion();else notice('قد السيارة إلى الحاجز الأول.');}
 else if(a==='heroScene'){const slides=getActiveHeroSlides(),idx=slides.findIndex(s=>s.key===id);updateHeroDOM(idx>=0?idx:0);scheduleHeroRotation();}
 else if(a==='heroPrev'){updateHeroDOM(heroIdx-1);scheduleHeroRotation();}
 else if(a==='heroNext'){updateHeroDOM(heroIdx+1);scheduleHeroRotation();}
 else if(a==='filterGames'){activeGameCategory=id||'all';document.querySelectorAll?.('.gallery-filter-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.id===activeGameCategory));document.querySelectorAll?.('.game-cover-card').forEach(card=>{card.classList.toggle('is-filtered-out',activeGameCategory!=='all'&&card.dataset.gameCat!==activeGameCategory);});}
 else if(a==='openHomeVideo'){const v=resolveHomeVideos().find(v=>v.key===id);if(v)watch(v);}
 else if(a==='selectHomeVideo'){activeVideoKey=id;const vids=resolveHomeVideos(),sel=vids.find(v=>v.key===id)||vids[0];if(sel&&$('featuredVideoStage')){$('featuredVideoStage').innerHTML=renderVideoStageMarkup(sel);document.querySelectorAll('.video-thumb-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.id===sel.key));}}
 else if(a==='dashboard')await dashboard();
 else if(a==='login')auth();
 else if(a==='signup')auth(true);
 else if(a==='joinFocus'){$('joinCode')?.scrollIntoView?.({behavior:'smooth',block:'center'});$('joinCode')?.focus();}
 else if(a==='tab'){tab=id;renderDashboard();}
 else if(a==='assign')assignmentForm(id);
 else if(a==='copy'){const u=link(data.assignments.find(x=>x.id===id));try{await navigator.clipboard.writeText(u);notice('تم نسخ رابط المهمة.');}catch{dialog(`<h2>رابط المهمة</h2><input class="link-field" readonly value="${esc(u)}">`);}}
 else if(a==='toggle'){const x=data.assignments.find(x=>x.id===id);await api('toggleAssignment',{id,active:!x.active});await dashboard();}
 else if(a==='class'){const x=data.assignments.find(x=>x.id===id);dialog(`<h2>طريقة التشغيل الصفي</h2><p>الجماعي إنجاز للمعلم فقط. الفردي يسجّل باسم الطالب.</p><div class="row">${button('جماعي على السبورة','classGroup',x.id)}${button('فردي باسم الطالب','classIndividual',x.id,'quiet')}</div>`);}
 else if(a==='classGroup'||a==='classIndividual'){close();await openAssignment(data.assignments.find(x=>x.id===id).code,a==='classGroup'?'group':'individual');}
 else if(a==='addVideo')videoForm();else if(a==='watch')watch(data.videos.find(v=>v.id===id));else if(a==='taskVideo')watch(assignment.videos.find(v=>v.id===id));else if(a==='deleteVideo'){dialog(`<h2>حذف الفيديو؟</h2><p>سيختفي الرابط من مهماتك.</p>${button('تأكيد الحذف','confirmDeleteVideo',id)}`);}else if(a==='confirmDeleteVideo'){await api('deleteVideo',{id});close();await dashboard();}
 else if(a==='review')await review(id);else if(a==='student')studentRecord(id);else if(a==='export')exportCSV();else if(a==='reset')dialog(`<h2>إعادة تعيين كلمة المرور</h2><form id="resetForm" data-id="${id}">${field('كلمة المرور الجديدة (8 أحرف على الأقل)','newPassword','','password')}<button style="margin-top:15px">حفظ كلمة المرور</button></form>`);
 else if(a==='role'){const t=data.teachers.find(t=>t.id===id),role=t.role==='admin'?'teacher':'admin';if(!confirm(role==='admin'?'منح هذا الحساب صلاحية إدارة المنصة بالكامل؟':'إلغاء صلاحية الإدارة وتحويل الحساب إلى معلم؟'))return;await api('setRole',{id,role});await dashboard();}
 else if(a==='teacherStatus'){const t=data.teachers.find(t=>t.id===id);await api('teacherStatus',{id,active:t.status==='موقوف'});await dashboard();}
 else if(a==='selectTemplate'){if(!availableTemplates($('questionType')?.value||'').includes(id))return;selected=id;if(id==='puzzle')$('questionType').value='puzzle_image';refreshTemplateChoices();document.querySelectorAll('[data-action=selectTemplate]').forEach(x=>x.classList.toggle('selected',x.dataset.id===id));}
 else if(a==='answer')await answer(Number(id));else if(a==='textAnswer')await answer($('answerText')?.value||'');else if(a==='matchAnswer'){const q=play.questions[play.index],v=q.pairs.map((_,i)=>$('match'+i).value);if(v.some(x=>!x))throw new Error('أكمل كل الاختيارات.');await answer(v);}
 else if(a==='classAnswer'){const v={};for(const x of document.querySelectorAll('[data-class-id]')){if(x.value==='')throw new Error('صنّف كل العناصر.');v[x.dataset.classId]=Number(x.value);}await answer(v);}
 else if(a==='orderUp'){const i=Number(id);if(i>0)[play.order[i-1],play.order[i]]=[play.order[i],play.order[i-1]];$('answerArea').innerHTML=questionUI(play.questions[play.index]);}
 else if(a==='orderAnswer')await answer(play.order);else if(a==='tile'){const i=Number(id);if(play.tile===undefined)play.tile=i;else{[play.tiles[i],play.tiles[play.tile]]=[play.tiles[play.tile],play.tiles[i]];play.tile=undefined;}$('answerArea').innerHTML=questionUI(play.questions[play.index]);}
 else if(a==='puzzleAnswer')await answer(play.tiles);else if(a==='next'){if(play.template==='race'){play.raceQuestion=false;close();$('originalRace').contentWindow.postMessage({type:'school-race-continue',correct:play.lastCorrect,pending:play.lastPending,index:play.index,token:play.raceToken},location.origin);return;}if(play.index===play.questions.length-1)await finish();else{play.index++;play.answered=false;play.order=null;play.tiles=null;play.tile=undefined;renderQuestion();}}
 else if(a==='replay'){if(play?.demo)startDemo(play.template);else renderJoin();}else if(a==='leaderboard'){const rows=await api('leaderboard',{id:play.id,secret:play.secret});$('leaderboardResults').innerHTML=`<h3>قائمة الصدارة</h3>${rows.length?rows.map((r,i)=>`<div class="row card" style="justify-content:space-between;margin-top:8px"><span>${i+1}. ${esc(r.student_name)}</span><b>${r.score}%</b></div>`).join(''):'لا توجد نتائج نهائية منشورة بعد.'}`;}
},b);});

document.addEventListener('submit',e=>{const f=e.target;if(!['joinForm','authForm','assignmentForm','videoForm','renameForm','resetForm','settingsForm','startForm'].includes(f.id)&&!f.classList.contains('gradeForm'))return;e.preventDefault();run(async()=>{
 if(f.id==='joinForm'){const entry=M.resolveStudentEntry($('joinCode').value);if(entry.kind==='live'){location.href=entry.href;return;}await openAssignment(entry.code);history.replaceState(null,'','?task='+encodeURIComponent(entry.code));}
 else if(f.id==='authForm'){const username=$('username').value.trim(),password=$('password').value;if(f.dataset.signup==='true')await api('register',{username,password,name:$('fullName').value});const r=await api('loginAlias',{username});await M.authSignIn({email:r.email,password});await navigation();await dashboard();const next=new URLSearchParams(location.search).get('next');if(data.profile.admin&&next==='admin')location.href='admin/admin.html';else if(next==='live'){const c=new URLSearchParams(location.search).get('liveCode');location.href='live.html?host=1'+(/^\d{6}$/.test(c||'')?'&code='+c:'');}}
 else if(f.id==='assignmentForm'){const r=await api('assignment',{game_id:f.dataset.game,title:$('assignmentTitle').value,class_name:$('className').value,templates:[...f.querySelectorAll('[name=templates]:checked')].map(x=>x.value),types:[...f.querySelectorAll('[name=types]:checked')].map(x=>x.value),passing_score:$('passingScore').value,deadline:$('deadline').value?new Date($('deadline').value).toISOString():null,leaderboard:$('leaderboard').checked,shooting:{mode:'choice',difficulty:'beginner',arrowsPerQuestion:1,aimAssist:'auto'}});close();tab='assignments';await dashboard();dialog(`<h2>المهمة جاهزة</h2><p>أرسل هذا الرابط لطلابك. يدخلون بالاسم فقط.</p><input class="link-field" readonly value="${esc(link(r))}"><p></p>${button('نسخ الرابط','copy',r.id)}`);}
 else if(f.id==='videoForm'){let url=$('videoUrl').value.trim();const file=$('videoFile').files[0];if(file){if(file.size>40*1024*1024)throw new Error('الحد الأقصى للفيديو 40 MB.');if(!['video/mp4','video/webm'].includes(file.type))throw new Error('ارفع MP4 أو WebM.');const uploaded=await M.cloudUploadFile(file,{folder:'school-videos'});url=uploaded.url||uploaded.publicUrl||uploaded;}const title=$('videoTitle').value,subject=$('videoSubject').value,game_id=$('videoGame').value;await api('video',{title,subject,url,game_id});if(data?.profile?.admin&&$('videoPinHomepage')?.checked){const nextCfg=structuredClone(config);nextCfg.homepageVideos=Array.isArray(nextCfg.homepageVideos)?nextCfg.homepageVideos:[];nextCfg.homepageVideos.unshift({title,subject,url,visible:true,featured:false});try{await api('saveSettings',{data:nextCfg});config=nextCfg;}catch{}}close();await dashboard();}
 else if(f.id==='renameForm'){await api('renameStudent',{id:f.dataset.id,name:$('correctedName').value,student_key:$('mergeKey').value});close();await dashboard();}
 else if(f.id==='resetForm'){await api('resetPassword',{id:f.dataset.id,password:$('newPassword').value});close();notice('تم تغيير كلمة مرور المعلم.');}
 else if(f.classList.contains('gradeForm')){await api('grade',{id:f.dataset.id,question:f.dataset.q,points:f.elements.points.value,feedback:f.elements.feedback.value});notice('تم اعتماد الدرجة.');await review(f.dataset.id);data=await api('dashboard');}

 else if(f.id==='startForm'){if(!availableTemplates($('questionType').value).includes(selected))throw new Error('اختر طريقة لعب متاحة لنوع السؤال.');const name=$('studentName')?.value||'';let key=localStorage.getItem('abuobaid_student_key');if(!key||localStorage.getItem('abuobaid_student_name')!==name)key=crypto.randomUUID();const startArgs={code:assignment.code,mode:assignment.mode,name,student_key:key,template:selected,type:selected==='puzzle'?'puzzle_image':$('questionType').value};play=await api('start',startArgs);Object.assign(play,{startArgs,index:0,correct:0,points:0,completed:0,pendingCount:0,template:selected,studentName:name});if(assignment.mode!=='group'){localStorage.setItem('abuobaid_student_name',name);localStorage.setItem('abuobaid_student_key',key);}if(play.template==='race')renderRace();else if(['football','basketball','bowling','volleyball','fishing','target-shooting'].includes(play.template))renderSport();else renderQuestion();}
},f.querySelector('button[type=submit]')||f.querySelector('button:last-child'));});

document.addEventListener('change',e=>{if(e.target.id==='questionType')refreshTemplateChoices();if(e.target.id==='reportAssignment')renderReports();});

$('closeModal').onclick=close;$('dashboardLink').onclick=()=>run(dashboard);$('loginLink').onclick=()=>M.isAuthenticated()?M.authSignOut():auth();
function renderSport(){play.sportToken=crypto.randomUUID();play.sportOutcome=false;const sport=play.template;show(`${gameHUD()}<section class="football-host"><iframe id="${sport}Game" title="${esc(games[sport][1])}" src="games/${sport}/index.html${sport==='target-shooting'?'?guided=2':''}" style="width:100%;height:85svh;min-height:440px;border:0;border-radius:18px" allow="fullscreen;autoplay" allowfullscreen></iframe></section>`);}
window.addEventListener('message',e=>{if(!play||!['football','basketball','bowling','volleyball','fishing','target-shooting'].includes(play.template))return;const sport=play.template,frame=$(sport+'Game'),prefix='school-'+sport+'-';if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow)return;const b=e.data;if(!b||typeof b!=='object')return;if(b.type===prefix+'ready'){frame.contentWindow.postMessage(Object.assign({type:prefix+'config',title:assignment.title,count:play.questions.length,images:play.questions.map(q=>q.image||''),token:play.sportToken},sport==='target-shooting'?{school:String(config?.name||OFFICIAL_SCHOOL_NAME),student:String(play.studentName||''),shooting:assignment.settings?.shooting||null}:{}),location.origin);return;}if(b.token!==play.sportToken||b.index!==play.index)return;if(b.type===prefix+'question'&&!play.answered&&!play.answerPending)renderQuestion();if(b.type===prefix+'outcome'&&play.answered)play.sportOutcome=true;if(b.type===prefix+'fullscreen'){run(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();});}if(b.type===prefix+'next'&&play.answered&&play.sportOutcome){play.sportOutcome=false;run(async()=>{if(play.index===play.questions.length-1){try{await finish();}catch(e){play.sportOutcome=true;frame.contentWindow.postMessage({type:prefix+'retry',token:play.sportToken,index:play.index},location.origin);throw e;}}else{const oldIndex=play.index;play.index++;play.answered=false;play.order=null;play.tiles=null;play.tile=undefined;frame.contentWindow.postMessage({type:prefix+'advance',token:play.sportToken,index:oldIndex},location.origin);}});}});
function renderRace(){play.raceToken=crypto.randomUUID();play.raceQuestion=false;show(`${gameHUD()}<section><div class="row" style="justify-content:space-between"><h2>${esc(assignment.title)}</h2>${button('عرض السؤال الحالي','raceQuestion','','quiet')}</div><iframe id="originalRace" title="سباق الأبطال ثلاثي الأبعاد" src="games/champions-race/index.html?school=1" style="width:100%;height:min(78dvh,920px);min-height:300px;border:0;border-radius:18px" allow="fullscreen;autoplay"></iframe><p class="help">التحكم باللمس في مساحة السباق أو بأسهم لوحة المفاتيح. افتح السؤال عند الوصول إلى الحاجز.</p></section>`);}
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;const race=$('originalRace'),puzzle=$('originalPuzzle');if(race&&e.source===race.contentWindow){if(e.data?.type==='school-race-ready')race.contentWindow.postMessage({type:'school-race-config',school:config.name,title:assignment.title,count:play.questions.length,teacher:assignment.teacher||'',subject:assignment.subject||'',logo:config.logo||'',token:play.raceToken},location.origin);if(e.data?.type==='school-race-fullscreen')run(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();});if(e.data?.type==='school-race-question'&&e.data.token===play.raceToken){const incoming=Number(e.data.index);if(Number.isInteger(incoming)&&incoming>=0&&incoming<play.questions.length&&(incoming===play.index||(play.answered&&incoming===play.index+1))){play.index=incoming;play.answered=false;play.order=null;play.tiles=null;play.raceQuestion=true;renderQuestion();}}if(e.data?.type==='school-race-finished'&&e.data.token===play.raceToken&&play.index===play.questions.length-1&&play.answered)run(finish);}
if(puzzle&&e.source===puzzle.contentWindow){const q=play.questions[play.index];if(e.data?.type==='school-puzzle-ready')puzzle.contentWindow.postMessage({type:'school-puzzle-config',image:q.image,title:assignment.title,school:config.name,pieces:Number(q.puzzle_grid)===3?9:Number(q.puzzle_grid)===4?16:6},location.origin);if(e.data?.type==='school-puzzle-complete')run(()=>answer(Array.from({length:(Number(q.puzzle_grid)||3)**2},(_,i)=>i)));}});
window.addEventListener('message',e=>{const params=new URLSearchParams(location.search);if(!params.has('designPreview')||parent===window||e.source!==parent||e.origin!==location.origin||e.data?.type!=='manarat-design-preview'||e.data.channel!==params.get('channel'))return;config=window.ManaratDesign.normalize(e.data.config);applyBrand(config);home();});
window.School={api,home,dashboard,openAssignment,arena,gradeUI:questionUI,setHubData:d=>{hubData=d||hubData;}};
(async()=>{if(!adminPanel)navigation();const params=new URLSearchParams(location.search);const isHome=!params.has('task')&&!params.has('dashboard')&&!adminPanel&&!params.has('login')&&!params.has('demo');try{const [cfg,hub]=await Promise.all([api('settings'),isHome?api('homeHub').catch(()=>({loadError:true})):Promise.resolve(null)]);if(cfg&&cfg.name)config=window.ManaratDesign.normalize({...defaultConfig(),...cfg});if(hub&&typeof hub==='object'&&(Array.isArray(hub.videos)||hub.weekly||hub.loadError))hubData=hub;}catch(e){notice('تعذر تحميل الإعدادات: '+e.message);}applyBrand(config);if(params.has('task'))await run(()=>openAssignment(params.get('task')));else if(params.has('dashboard')||adminPanel)await run(dashboard);else if(params.has('login'))auth();else if(params.has('demo'))startDemo(params.get('demo'));else {home();if(hubData.loadError)notice('تعذر تحميل بيانات التفاعل. أعد تحميل الصفحة للمحاولة مجددًا.');}if(params.has('designPreview')&&parent!==window){parent.postMessage({type:'manarat-design-ready',channel:params.get('channel')},location.origin);}})();
})();