(function(){
'use strict';
const STORE_KEY='manarat_v12_platform_store';
const LEGACY_KEYS=[];
const DEFAULT_SUPABASE_URL='https://yltlzogrhwvnmxcnaesu.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY='sb_publishable_W-XxH2FTvSZq66b-eHt-TQ_a8ZuqGRD';
const EMBEDDED_SUPABASE_CONFIG_VERSION='2026-10-07-msamra103-secure-cloud';
const EMBEDDED_AI_CONFIG_VERSION='2026-05-06-edge-gemini-file-api-v13-dynamic-handler';
const DEFAULT_GEMINI_ENDPOINT='https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_API_KEY='';
const DEFAULT_GEMINI_MODEL='gemini-2.5-flash';
const CLOUD_STATE_ID='main';
const AUTH_SESSION_KEY='manarat_v10_auth_session';
// دخول الأدمن يعتمد على Supabase Auth. لا يوجد أدمن مؤقت في نسخة الإنتاج.
const TEMP_ADMIN_BYPASS=false;
const CONFIGURED_ADMIN_EMAIL='m.samra103@gmail.com';
const CONFIGURED_ADMIN_PASSWORD='';
const CONFIGURED_ADMIN_ID='00000000-0000-4000-8000-000000000103';
const TEMP_ADMIN_USER={id:CONFIGURED_ADMIN_ID,email:CONFIGURED_ADMIN_EMAIL,user_metadata:{name:'مدير المنصة',school:'منارة التعلم الرقمي',role:'admin'}};
const qs=(s,root=document)=>root.querySelector(s); const qsa=(s,root=document)=>[...root.querySelectorAll(s)];
function esc(v=''){return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function attr(v=''){return esc(v).replace(/`/g,'&#96;')}
function uuid(){return (crypto&&crypto.randomUUID)?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function norm(s=''){return String(s??'').trim().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').toLowerCase()}
function seconds(v=0){v=Math.max(0,Number(v)||0);return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0')}
const logoClean='manarat-logo.svg';
const mark='manarat-mark.svg';
const sampleQuestions=[
{id:'q1',type:'multiple_choice',emoji:'🪐',text:'ما الكوكب المعروف بالكوكب الأحمر؟',options:['الأرض','المريخ','الزهرة','المشتري'],correct:1,points:10,attempts:1,explanation:'المريخ يُعرف بالكوكب الأحمر بسبب لون سطحه.'},
{id:'q2',type:'true_false',emoji:'✅',text:'صح أم خطأ: يحتاج النبات إلى الماء والضوء لينمو.',options:['صح','خطأ'],correct:0,points:10,attempts:1,explanation:'الماء والضوء من أهم احتياجات النبات.'},
{id:'q3',type:'matching',emoji:'🔗',text:'طابقي كل عنصر بما يناسبه:',pairs:[{left:'الشمس',right:'مصدر الضوء'},{left:'الماء',right:'يساعد النبات على النمو'},{left:'الجذور',right:'تمتص الماء'}],points:15,attempts:2,explanation:'كل جزء له وظيفة محددة.'},
{id:'q4',type:'connecting',emoji:'🧵',text:'وصّلي كل عبارة بالإجابة المناسبة:',pairs:[{left:'النبات',right:'كائن حي'},{left:'الضوء',right:'مصدر طاقة'},{left:'الماء',right:'عامل ضروري للنمو'}],points:15,attempts:2,explanation:'التوصيل يساعد على فهم العلاقة بين المفاهيم.'},
{id:'q5',type:'ordering',emoji:'🔢',text:'رتّبي مراحل نمو النبات ترتيبًا صحيحًا:',items:['بذرة','بادرة','نبات صغير','نبات مكتمل'],points:15,attempts:2,explanation:'يبدأ النبات من البذرة ثم ينمو تدريجيًا.'},
{id:'q6',type:'open_text',emoji:'✍️',text:'اكتبي كلمة تدل على العلم والفهم.',answers:['المعرفة','العلم'],points:10,attempts:2,explanation:'المعرفة والعلم إجابتان صحيحتان.'},
{id:'q7',type:'puzzle_image',emoji:'🧩',text:'ركّب صورة منارة المعرفة بشكل صحيح.',image:'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22400%22%20height=%22400%22%20viewBox=%220%200%20400%20400%22%3E%3Cdefs%3E%3ClinearGradient%20id=%22g%22%20x1=%220%22%20y1=%220%22%20x2=%221%22%20y2=%221%22%3E%3Cstop%20stop-color=%22%23081633%22/%3E%3Cstop%20offset=%221%22%20stop-color=%22%232e1065%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%22400%22%20height=%22400%22%20fill=%22url%28%23g%29%22/%3E%3Ccircle%20cx=%22105%22%20cy=%22100%22%20r=%2260%22%20fill=%22%23f6c85f%22/%3E%3Crect%20x=%22210%22%20y=%2248%22%20width=%22120%22%20height=%22110%22%20rx=%2222%22%20fill=%22%2318d2ff%22/%3E%3Cpath%20d=%22M70%20310%20L200%20180%20L330%20310%20Z%22%20fill=%22%2310d69a%22/%3E%3Ccircle%20cx=%22300%22%20cy=%22285%22%20r=%2242%22%20fill=%22%23ff8ff0%22/%3E%3Cpath%20d=%22M200%2080%20L230%20150%20L305%20155%20L245%20200%20L265%20275%20L200%20232%20L135%20275%20L155%20200%20L95%20155%20L170%20150%20Z%22%20fill=%22%23ffffff%22%20opacity=%22.82%22/%3E%3C/svg%3E',puzzle_grid:3,show_reference:true,points:15,attempts:2,explanation:'البازل ينمّي الملاحظة والتركيز.'}
];
function defaultPlatform(){return{brandName:'منارة التعلم الرقمي',brandSubtitle:'DIGITAL LEARNING BEACON',logoImage:logoClean,markImage:mark,accent1:'#f6c85f',accent2:'#18d2ff',accent3:'#7c3aed',background:'cosmic',customBgImage:'',fontFamily:'tajawal',fontScale:1.08,questionSize:34,answerSize:28,cardRadius:28,playerFx:true,playerSounds:true,hoverSounds:true,intro:true,showLogo:true,uiGender:'female',educatorGender:'female',teacherFemaleLabel:'المعلمة',teacherMaleLabel:'المعلم',studentFemaleLabel:'الطالبة',studentMaleLabel:'الطالب',adminLoginRequired:true,homeKicker:'✨ منصة تعليمية ذكية للألعاب والفيديو',homeTitle:'منصة تعليمية ذكية تجمع بين الألعاب التفاعلية ومكتبة الفيديوهات',homeHighlight:'الألعاب التفاعلية',homeText:'منارة التعلم الرقمي تجمع بين تصميم الألعاب التعليمية، مكتبة الفيديوهات، وفيديوهات الذكاء الاصطناعي لشرح المناهج الدراسية والأفكار الإبداعية داخل تجربة أنيقة وسهلة للمعلم والطالب.',featuresTitle:'خدمات منارة التعلم الرقمي',featuresSubtitle:'ألعاب تعليمية، مكتبة فيديوهات، وفيديوهات ذكاء اصطناعي تخدم المدرسة والمعلم والطالب.',features:[{icon:'🎮',title:'ألعاب تعليمية تفاعلية',desc:'أسئلة متعددة الأنواع، منافسة، لوحة أرقام، واختيار عشوائي سينمائي.'},{icon:'🎬',title:'مكتبة فيديوهات تعليمية',desc:'عرض نماذج فيديوهات من القناة داخل الواجهة مع سهولة إدارة الروابط والترتيب.'},{icon:'🤖',title:'تصميم فيديوهات بالذكاء الاصطناعي',desc:'شرح المناهج الدراسية والأفكار الإبداعية بفيديوهات احترافية جذابة.'},{icon:'📚',title:'استيراد وتوليد الأسئلة',desc:'من JSON أو PDF أو نصوص، مع دعم البنوك والتوليد الذكي.'},{icon:'🧩',title:'تجربة لعب مرنة',desc:'فردي أو منافسة، وعدد أسئلة مرن، وتصحيح يدوي للمقالي.'},{icon:'📊',title:'نتائج وشهادات ومشاركة',desc:'تقارير، شهادات، مشاركة الألعاب، وتصديرها للعمل محليًا.'}],showFeatures:true,showShowcase:true,showcaseGameTitle:'تجربة تعلم تفاعلية متكاملة',showcaseGameText:'من شاشة واحدة يمكنك تشغيل لعبة، تصفح أحدث الألعاب، ومشاهدة فيديوهات تعليمية تخدم نفس الدرس أو الفكرة.',showcaseButtonText:'جرّب لعبة نموذجية ⭐',homeFooter:'منارة التعلم الرقمي · ألعاب تعليمية وفيديوهات ذكية تصنع أثرًا تعليميًا أجمل 💛',siteAbout:'منارة التعلم الرقمي منصة تعليمية رقمية متكاملة تجمع بين الألعاب التعليمية التفاعلية، مكتبة الفيديوهات، وتصميم فيديوهات بالذكاء الاصطناعي لشرح المناهج والأفكار الإبداعية.',siteContact:'للتواصل وطلب الدعم أو تصميم الألعاب التعليمية والفيديوهات الذكية: عبر القنوات الرسمية لمنارة التعلم الرقمي.',socialLinks:{facebook:'https://www.facebook.com/profile.php?id=61574253098010',youtube:'https://www.youtube.com/@منارةالتعلمالرقمي',instagram:'https://www.instagram.com/mnrltlmlrqmy/',tiktok:'https://www.tiktok.com/@manartaltalm',whatsapp:''},contactWhatsApp:'',whatsappDirect:{enabled:false,edgeFunctionName:'send-whatsapp-message',fallbackToLink:true,successMessage:'تم إرسال رسالتك بنجاح إلى فريق منارة التعلم الرقمي.'},contactFormTitle:'راسل منارة التعلم الرقمي',contactFormText:'اكتب رسالتك وسننتقل بك مباشرة إلى واتساب لإرسالها إلى فريق منارة التعلم الرقمي.',showContactForm:true,homeSections:[{id:'heroSection',label:'الواجهة الرئيسية',visible:true},{id:'featuresSection',label:'مزايا المنصة',visible:true},{id:'showcaseSection',label:'تجربة اللاعب',visible:true},{id:'youtubeShowcaseSection',label:'فيديوهات اليوتيوب',visible:true},{id:'latestPublicGamesSection',label:'آخر الألعاب المضافة',visible:true},{id:'contactWhatsAppSection',label:'نموذج مراسلة واتساب',visible:true},{id:'homeFooterCard',label:'فوتر الصفحة الرئيسية',visible:true}],youtubeSectionTitle:'فيديوهات منارة التعلم الرقمي',youtubeSectionText:'اختر فيديو من القائمة وشاهد نماذج وأفكارًا تعليمية من القناة.',youtubeChannelUrl:'https://www.youtube.com/@منارةالتعلمالرقمي',youtubeVideos:[
{title:'فيديو عن خلق الأمانة',url:'https://www.youtube.com/watch?v=8LA71-dqyCg',id:'8LA71-dqyCg'},
{title:'الأغنية الرسمية لمنارة التعلم الرقمي',url:'https://www.youtube.com/watch?v=bepelsVKqkw',id:'bepelsVKqkw'}
],showYoutubeSection:true,publicLibraryRequiresApproval:true,maxAIQuestions:20,navLinks:[
      {icon:'🏠',label:'الرئيسية',href:'#heroSection',style:'tab'},
      {icon:'✨',label:'الخدمات',href:'#featuresSection',style:'tab'},
      {icon:'🎬',label:'الفيديوهات',href:'#youtubeShowcaseSection',style:'tab'},
      {icon:'🎮',label:'الألعاب',href:'#latestPublicGamesSection',style:'tab'},
      {icon:'💬',label:'تواصل معنا',href:'#contactWhatsAppSection',style:'tab'},
      {icon:'👩‍🏫',label:'دخول المعلم',href:'auth.html',style:'primary'}
    ],heroButtons:[{label:'+ إنشاء لعبة جديدة',href:'teacher/create-game.html',style:'primary'},{label:'فتح لوحة المعلمة',href:'teacher/dashboard.html',style:'dark'}],tabs:{home:'الرئيسية',teacher:'لوحة المعلمة',admin:'الأدمن',player:'اللعبة'},cloud:{enabled:true,supabaseUrl:DEFAULT_SUPABASE_URL,publishableKey:DEFAULT_SUPABASE_PUBLISHABLE_KEY,syncMode:'supabase_first',configVersion:EMBEDDED_SUPABASE_CONFIG_VERSION},ai:{endpoint:DEFAULT_GEMINI_ENDPOINT,apiKey:'',model:DEFAULT_GEMINI_MODEL,temperature:0.3,useEdgeFunction:true,edgeFunctionName:'dynamic-handler',configVersion:EMBEDDED_AI_CONFIG_VERSION}}}
function configuredAdminRecord(){return{id:CONFIGURED_ADMIN_ID,name:'مدير المنصة',email:CONFIGURED_ADMIN_EMAIL,role:'owner',active:true,created_at:'2026-05-05T00:00:00.000Z'}}
function ensureConfiguredAdmin(s){s=s||{};s.admins=Array.isArray(s.admins)?s.admins:[];const exists=s.admins.some(a=>String(a.email||'').trim().toLowerCase()===CONFIGURED_ADMIN_EMAIL);if(!exists)s.admins.unshift(configuredAdminRecord());return s}
function defaultStore(){return ensureConfiguredAdmin({version:'16.13.0-home-navigation-tabs',role:'admin',platform:defaultPlatform(),profile:{id:'t1',name:'أ. فاطمة الهاجري',school:'منارة التعلم الرقمي',email:'teacher@manarat.local',avatar:'',icon:'👩‍🏫',educator_gender:'female'},teachers:[{id:'t1',name:'أ. فاطمة الهاجري',school:'مدرسة قطرية',email:'teacher@manarat.local',status:'نشط',avatar:'',icon:'👩‍🏫',educator_gender:'female'}],questionBanks:[{id:'bank-demo',title:'بنك العلوم التفاعلي',subject:'علوم',grade:'رابع',created_at:new Date().toISOString(),questions:sampleQuestions}],games:[{id:'demo-adventure',title:'مغامرة المعرفة',school:'منارة التعلم الرقمي',teacher:'أ. فاطمة الهاجري',teacher_id:'t1',subject:'علوم',grade:'الصف الرابع',folder:'ألعاب نموذجية',favorite:true,timer:90,per_question_timer:0,passing_score:70,show_answer:true,allow_retry:true,show_retry_button:true,shuffle_questions:true,shuffle_options:true,question_count:7,description:'لعبة تفاعلية بتصميم سينمائي من هوية منارة التعلم الرقمي.',theme:'cosmic',created_at:new Date().toISOString(),questions:sampleQuestions}],attempts:[],certificates:[],admins:[],messages:[],studentRosters:[],auditLogs:[]})}
function enforceEmbeddedCloudConfig(base){
  base.platform=base.platform||{};
  base.platform.cloud=base.platform.cloud||{};
  if(DEFAULT_SUPABASE_URL&&DEFAULT_SUPABASE_PUBLISHABLE_KEY&&base.platform.cloud.configVersion!==EMBEDDED_SUPABASE_CONFIG_VERSION){
    base.platform.cloud={...base.platform.cloud,enabled:true,supabaseUrl:DEFAULT_SUPABASE_URL,publishableKey:DEFAULT_SUPABASE_PUBLISHABLE_KEY,syncMode:base.platform.cloud.syncMode||'supabase_first',configVersion:EMBEDDED_SUPABASE_CONFIG_VERSION};
  }
  return base;
}
function enforceEmbeddedAIConfig(base){
  base.platform=base.platform||{};
  base.platform.ai=base.platform.ai||{};
  if(DEFAULT_GEMINI_API_KEY&&base.platform.ai.configVersion!==EMBEDDED_AI_CONFIG_VERSION){
    base.platform.ai={...base.platform.ai,endpoint:DEFAULT_GEMINI_ENDPOINT,apiKey:'',model:DEFAULT_GEMINI_MODEL,temperature:Number(base.platform.ai.temperature||0.3),useEdgeFunction:true,edgeFunctionName:'dynamic-handler',configVersion:EMBEDDED_AI_CONFIG_VERSION};
  }
  return base;
}
function mergeStore(base){const d=defaultStore();base=base||{};base.platform={...d.platform,...(base.platform||{})};base.platform.ai={...d.platform.ai,...(base.platform.ai||{})};base.platform.socialLinks={...d.platform.socialLinks,...(base.platform.socialLinks||{})};base.platform.cloud={...d.platform.cloud,...(base.platform.cloud||{})};base=enforceEmbeddedCloudConfig(base);base=enforceEmbeddedAIConfig(base);base.platform.tabs={...d.platform.tabs,...(base.platform.tabs||{})};['teachers','games','attempts','certificates','questionBanks','admins','messages','studentRosters','auditLogs'].forEach(k=>{if(!Array.isArray(base[k]))base[k]=d[k]});base=ensureConfiguredAdmin(base);if(!base.profile)base.profile=d.profile;base.version='13.5.0-classification-polish-partial-score';return base}
function itemTime(x){const v=Date.parse((x&& (x.updated_at||x.created_at))||'');return Number.isFinite(v)?v:0}
function mergeEntity(old={},x={}){
  const newer=itemTime(x)>=itemTime(old)?{...old,...x}:{...x,...old};
  // حماية الأسئلة والبيانات الكبيرة من الضياع عند وجود نسخة محلية ناقصة أو صف سحابي مختصر.
  ['questions','students','pairs','items','options','answers'].forEach(k=>{
    const a=Array.isArray(x&&x[k])?x[k]:null, b=Array.isArray(old&&old[k])?old[k]:null;
    if((!Array.isArray(newer[k])||newer[k].length===0)){
      if(a&&a.length)newer[k]=a; else if(b&&b.length)newer[k]=b;
    }
  });
  if((!newer.coverImage)&&((x&&x.coverImage)||(old&&old.coverImage)))newer.coverImage=(x&&x.coverImage)||(old&&old.coverImage);
  if((!newer.data)&&(x&&x.data))newer.data=x.data;
  return newer;
}
function mergeById(localArr=[],remoteArr=[]){const map=new Map();(remoteArr||[]).forEach(x=>{if(x&&x.id)map.set(String(x.id),x)});(localArr||[]).forEach(x=>{if(x&&x.id){const old=map.get(String(x.id));if(!old){map.set(String(x.id),x);return}map.set(String(x.id),mergeEntity(old,x))}});return [...map.values()]}
function profileToTeacher(p={}){
  const g=normalizedGender(p.educator_gender||p.gender||'female');
  return {id:String(p.id||p.email||uuid()),name:p.name||p.email||'حساب معلم',school:p.school||'',email:String(p.email||'').toLowerCase(),role:p.role||'teacher',status:p.status||'نشط',avatar:p.avatar||'',icon:p.icon||(g==='male'?'👨‍🏫':'👩‍🏫'),educator_gender:g,created_at:p.created_at||'',updated_at:p.updated_at||new Date().toISOString()};
}
function mergeTeachersFromSources(localTeachers=[],profiles=[],games=[]){
  const map=new Map();
  const keyOf=t=>String(t.email||t.id||'').toLowerCase();
  (localTeachers||[]).forEach(t=>{const k=keyOf(t);if(k)map.set(k,{...t,email:String(t.email||'').toLowerCase()})});
  (profiles||[]).forEach(p=>{const t=profileToTeacher(p);const k=keyOf(t);if(k)map.set(k,{...(map.get(k)||{}),...t})});
  (games||[]).forEach(g=>{
    const email=String(g.teacher_email||'').toLowerCase();
    const id=String(g.teacher_id||email||'').trim();
    if(!email&&!id)return;
    const k=email||id;
    if(!map.has(k))map.set(k,{id:id||email,name:g.teacher||email||'معلم من الألعاب',school:g.school||'',email,role:'teacher',status:'نشط',avatar:'',icon:'👩‍🏫',educator_gender:g.teacher_gender||'female',created_at:g.created_at||'',updated_at:g.updated_at||''});
    else map.set(k,{...map.get(k),name:map.get(k).name||g.teacher||email,school:map.get(k).school||g.school||''});
  });
  return [...map.values()].filter(t=>t.email||t.id).sort((a,b)=>String(a.name||a.email).localeCompare(String(b.name||b.email),'ar'));
}
function mergePlatformFromCloud(localP={},remoteP={}){
  const d=defaultPlatform();
  const p={...d,...localP,...remoteP};
  p.ai={...d.ai,...(localP.ai||{}),...(remoteP.ai||{})};
  p.cloud={...d.cloud,...(localP.cloud||{}),...(remoteP.cloud||{})};
  p.socialLinks={...d.socialLinks,...(localP.socialLinks||{}),...(remoteP.socialLinks||{})};
  p.tabs={...d.tabs,...(localP.tabs||{}),...(remoteP.tabs||{})};
  // لا نسمح لفقدان مفاتيح الربط أن يكسر الاتصال.
  if(!p.cloud.supabaseUrl)p.cloud.supabaseUrl=(localP.cloud&&localP.cloud.supabaseUrl)||d.cloud.supabaseUrl;
  if(!p.cloud.publishableKey)p.cloud.publishableKey=(localP.cloud&&localP.cloud.publishableKey)||d.cloud.publishableKey;
  if(!p.ai.edgeFunctionName)p.ai.edgeFunctionName=(localP.ai&&localP.ai.edgeFunctionName)||d.ai.edgeFunctionName;
  return p;
}
function mergeLocalAndRemote(local,remote){
  local=mergeStore(local||{});
  remote=mergeStore(remote||{});
  const out={...remote,...local};
  // إعدادات المنصة في platform_state السحابي هي المرجع الأعلى؛ حتى لا يعيد جهاز قديم الشعار/الأيقونة/الواتساب القديم.
  out.platform=mergePlatformFromCloud(local.platform||{},remote.platform||{});
  ['teachers','games','attempts','certificates','questionBanks','admins','messages','studentRosters','auditLogs'].forEach(k=>{out[k]=mergeById(local[k],remote[k])});
  out.profile=local.profile||remote.profile;
  out.version='16.13.0-home-navigation-tabs';
  return mergeStore(out)
}
function seed(){const s=defaultStore();localStorage.setItem(STORE_KEY,JSON.stringify(s));return s}
function store(){try{let s=JSON.parse(localStorage.getItem(STORE_KEY));if(!s){for(const k of LEGACY_KEYS){try{s=JSON.parse(localStorage.getItem(k)); if(s)break}catch(e){}}} if(!s)return seed();s=mergeStore(s);localStorage.setItem(STORE_KEY,JSON.stringify(s));return s}catch(e){return seed()}}
let cloudTimer=null,cloudSaving=false,cloudHydrated=false;
function saveStore(s){const merged=mergeStore(s);localStorage.setItem(STORE_KEY,JSON.stringify(merged));setTimeout(()=>document.dispatchEvent(new CustomEvent('manarat:store-updated',{detail:{source:'saveStore'}})),0);if(!cloudSaving)queueCloudSave(merged)}
function cloudConfig(s){const p=(s&&s.platform)||store().platform||{};return p.cloud||defaultPlatform().cloud}
function cleanSupabaseUrl(u=''){return String(u||'').trim().replace(/\/+$/,'')}
function cloudReady(c){return !!(c&&c.enabled&&cleanSupabaseUrl(c.supabaseUrl)&&String(c.publishableKey||'').trim())}
function realAccessToken(){const sess=authSession();return (sess&&sess.access_token)?sess.access_token:''}
function isTemporaryAdminBypass(){return TEMP_ADMIN_BYPASS===true && !realAccessToken()}
function cloudHeaders(c,extra={}){const key=String(c.publishableKey||'').trim();const h={'apikey':key,'Content-Type':'application/json',...extra};const token=realAccessToken();if(token)h.Authorization='Bearer '+token;return h}
async function cloudFetchState(c=cloudConfig()){if(!cloudReady(c))return null;const stateId=isAdmin()?'main':'public';const url=cleanSupabaseUrl(c.supabaseUrl)+`/rest/v1/platform_state?select=data,updated_at&id=eq.${encodeURIComponent(stateId)}&limit=1`;const res=await fetch(url,{headers:cloudHeaders(c,{Accept:'application/json'})});const json=await res.json().catch(()=>null);if(!res.ok)throw new Error((json&&json.message)||`Supabase read failed (${res.status})`);const row=Array.isArray(json)?json[0]:null;if(row&&row.data){row.data.platform=row.data.platform||{};row.data.platform.updated_at=row.data.platform.updated_at||row.updated_at||new Date().toISOString()}return row}
async function cloudSaveStore(s){
  const c=cloudConfig(s);if(!cloudReady(c))return false;
  if(!isAdmin())return false;
  cloudSaving=true;
  try{
    const payload=mergeStore(s);
    payload.platform=payload.platform||{};
    payload.platform.updated_at=payload.platform.updated_at||new Date().toISOString();
    const publicPayload={version:payload.version,platform:payload.platform};
    const url=cleanSupabaseUrl(c.supabaseUrl)+'/rest/v1/platform_state';
    const rows=[
      {id:'main',data:payload,updated_at:new Date().toISOString()},
      {id:'public',data:publicPayload,updated_at:new Date().toISOString()}
    ];
    const res=await fetch(url,{method:'POST',headers:cloudHeaders(c,{Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(rows)});
    if(!res.ok){const json=await res.json().catch(()=>({}));throw new Error(json.message||`Supabase save failed (${res.status})`)}
    return true
  }finally{cloudSaving=false}
}
async function cloudForceSavePlatform(s=store()){
  const next=mergeStore(s);
  next.platform=next.platform||{};
  next.platform.updated_at=new Date().toISOString();
  await cloudSaveStore(next);
  return true;
}
function queueCloudSave(s){const c=cloudConfig(s);if(!cloudReady(c))return;if(!isAdmin())return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>cloudSaveStore(s).catch(e=>console.warn('Supabase platform sync save failed',e)),650)}
async function initCloudSync(){if(cloudHydrated)return;cloudHydrated=true;const local=store(),c=cloudConfig(local);if(!cloudReady(c))return;try{if(isAdmin()&&!isTemporaryAdminBypass())await ensureAdminCloudRole();const remote=await cloudFetchState(c);if(remote&&remote.data){const merged=mergeLocalAndRemote(local,remote.data);cloudSaving=true;localStorage.setItem(STORE_KEY,JSON.stringify(merged));cloudSaving=false;document.dispatchEvent(new CustomEvent('manarat:store-updated'));toast('تمت مزامنة المنصة مع قاعدة البيانات')}else if(isAdmin()){await cloudSaveStore(local);toast('تم إنشاء أول نسخة سحابية للمنصة في Supabase')}}catch(e){console.warn('Supabase sync failed',e);toast('تعذر تفعيل Supabase: '+(e.message||'تحقق من تشغيل ملف قاعدة البيانات النهائي'),'warn')}}
async function testCloudConnection(){const c=cloudConfig();if(!cloudReady(c)){toast('ضع رابط Supabase والمفتاح أولًا','error');return false}try{await cloudFetchState(c);await cloudSaveStore(store());toast('تم الاتصال والكتابة في Supabase بنجاح');return true}catch(e){console.error(e);toast('فشل اتصال Supabase: '+(e.message||'تحقق من تشغيل ملف قاعدة البيانات النهائي'),'error');return false}}
async function syncCloudNow(){try{if(isAdmin())await cloudSaveStore(store());await cloudSaveAllTables();await cloudSyncTables();toast('تمت مزامنة بيانات المنصة مع Supabase');return true}catch(e){toast('فشل رفع البيانات: '+(e.message||'خطأ غير معروف'),'error');return false}}

function cloudBearerHeaders(c=cloudConfig(),extra={}){
  const key=String(c.publishableKey||'').trim();
  const h={'apikey':key,'Content-Type':'application/json',...extra};
  const token=realAccessToken();
  if(token)h.Authorization='Bearer '+token;
  return h;
}
function cloudTableUrl(table,query=''){
  const c=cloudConfig();
  return cleanSupabaseUrl(c.supabaseUrl)+'/rest/v1/'+table+(query?('?'+query):'');
}
async function cloudRest(table,query='',opts={}){
  const c=cloudConfig();
  if(!cloudReady(c))throw new Error('إعدادات Supabase غير مكتملة');
  const res=await fetch(cloudTableUrl(table,query),{...opts,headers:{...cloudBearerHeaders(c),...(opts.headers||{})}});
  const text=await res.text();
  let json=null; try{json=text?JSON.parse(text):null}catch(e){json=text}
  if(!res.ok)throw new Error((json&&json.message)||String(json||'Supabase error '+res.status));
  return json;
}
async function cloudUploadFile(file,{bucket='manarat-assets',folder='uploads'}={}){
  const c=cloudConfig();
  if(!cloudReady(c))throw new Error('إعدادات Supabase غير مكتملة');
  const sess=authSession();
  const ext=(file.name||'file').split('.').pop().replace(/[^a-z0-9]/gi,'').slice(0,8)||'bin';
  const userId=(hasRealAuthSession()?currentTeacherId():'public-admin')||'public-admin';
  const path=`${folder}/${userId}/${Date.now()}-${uuid()}.${ext}`;
  const base=cleanSupabaseUrl(c.supabaseUrl);
  const bearer=(sess&&sess.access_token)?sess.access_token:String(c.publishableKey||'');
  const res=await fetch(`${base}/storage/v1/object/${bucket}/${path}`,{method:'POST',headers:{'apikey':String(c.publishableKey||''),'Authorization':'Bearer '+bearer,'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},body:file});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(json.message||json.error||'فشل رفع الملف إلى Supabase Storage');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
function isUUID(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
function profilePayload(profile={}){
  const u=currentAuthUser();
  const id=(profile.id&&isUUID(profile.id))?profile.id:(u&&isUUID(u.id)?u.id:null);
  if(!id)return null;
  const email=String(profile.email||u?.email||'').toLowerCase();
  const g=normalizedGender(profile.educator_gender||profile.gender||'female');
  return {id,email,name:profile.name||email||'حساب معلم',school:profile.school||'',role:profile.role||'teacher',status:profile.status||'نشط',avatar:profile.avatar||'',icon:profile.icon||(g==='male'?'👨‍🏫':'👩‍🏫'),educator_gender:g,updated_at:new Date().toISOString(),created_at:profile.created_at||new Date().toISOString()};
}
async function cloudUpsertProfile(profile=currentProfile()){
  if(!cloudReady(cloudConfig())||!hasRealAuthSession())return null;
  const payload=profilePayload(profile); if(!payload)return null;
  const out=await cloudRest('profiles','',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});
  return Array.isArray(out)?out[0]:out;
}
async function cloudDeleteProfile(idOrEmail){
  if(!idOrEmail)return false;
  const key=String(idOrEmail||'').trim();
  const isEmail=key.includes('@');
  const q=isEmail?('email=eq.'+encodeURIComponent(key.toLowerCase())):('id=eq.'+encodeURIComponent(key));
  try{await cloudRest('profiles',q,{method:'DELETE',headers:{Prefer:'return=minimal'}});return true}catch(e){console.warn('cloudDeleteProfile failed',e);return false}
}
async function cloudFetchProfiles(){
  if(!cloudReady(cloudConfig()))return [];
  try{return await cloudRest('profiles','select=*&order=updated_at.desc',{method:'GET',headers:{Accept:'application/json'}})||[]}catch(e){console.warn('cloudFetchProfiles failed',e);return []}
}
function safeTeacherUUID(){const u=hasRealAuthSession()?currentAuthUser():null;return (u&&isUUID(u.id))?u.id:null}
function isGameApprovedPublic(game){const p=(store().platform||{});return !!game.show_in_home_public && (p.publicLibraryRequiresApproval===false || game.public_status==='approved' || game.public_approved===true)}
function isGameApprovedShared(game){const p=(store().platform||{});return !!game.share_with_teachers && (p.publicLibraryRequiresApproval===false || game.sharing_status==='approved' || game.shared_approved===true)}
function gamePayload(game){return {id:String(game.id),teacher_id:safeTeacherUUID(),teacher_email:String(game.teacher_email||currentProfile().email||''),title:game.title||'لعبة جديدة',subject:game.subject||'',grade:game.grade||'',status:game.status||'published',is_public:isGameApprovedPublic(game),is_shared:isGameApprovedShared(game),data:game,updated_at:new Date().toISOString(),created_at:game.created_at||new Date().toISOString()}}
async function cloudUpsertGame(game){
  const payload=gamePayload(game);
  const out=await cloudRest('manarat_games','',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});
  return Array.isArray(out)?out[0]:out;
}
async function cloudDeleteGame(id){return cloudRest('manarat_games','id=eq.'+encodeURIComponent(String(id)),{method:'DELETE',headers:{Prefer:'return=minimal'}})}
async function cloudFetchGames(){
  const rows=await cloudRest('manarat_games','select=*&order=updated_at.desc',{method:'GET',headers:{Accept:'application/json'}});
  return (rows||[]).map(r=>{const d=r.data||{};const gp={...d,id:String(r.id),teacher_id:d.teacher_id||r.teacher_id,teacher_email:d.teacher_email||r.teacher_email,title:d.title||r.title,subject:d.subject||r.subject,grade:d.grade||r.grade,show_in_home_public:!!(d.show_in_home_public||r.is_public),share_with_teachers:!!(d.share_with_teachers||r.is_shared),public_status:d.public_status||(r.is_public?'approved':(d.show_in_home_public?'pending':'private')),sharing_status:d.sharing_status||(r.is_shared?'approved':(d.share_with_teachers?'pending':'private')),public_approved:!!(d.public_approved||r.is_public),shared_approved:!!(d.shared_approved||r.is_shared),questions:Array.isArray(d.questions)?d.questions:[],updated_at:r.updated_at,created_at:d.created_at||r.created_at};return gp});
}
function bankPayload(bank){return {id:String(bank.id),owner_id:safeTeacherUUID(),owner_email:String(currentProfile().email||''),title:bank.title||'بنك أسئلة',subject:bank.subject||'',grade:bank.grade||'',data:bank,updated_at:new Date().toISOString(),created_at:bank.created_at||new Date().toISOString()}}
async function cloudUpsertBank(bank){const out=await cloudRest('manarat_question_banks','',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(bankPayload(bank))});return Array.isArray(out)?out[0]:out}
async function cloudFetchBanks(){const rows=await cloudRest('manarat_question_banks','select=*&order=updated_at.desc',{method:'GET',headers:{Accept:'application/json'}});return (rows||[]).map(r=>({...r.data,id:String(r.id),title:r.data?.title||r.title,subject:r.data?.subject||r.subject,grade:r.data?.grade||r.grade}))}
async function cloudUpsertRoster(roster){const payload={id:String(roster.id),teacher_id:safeTeacherUUID(),teacher_email:String(currentProfile().email||roster.teacher_email||''),title:roster.title||'قائمة أسماء',data:roster,updated_at:new Date().toISOString(),created_at:roster.created_at||new Date().toISOString()};const out=await cloudRest('manarat_rosters','',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});return Array.isArray(out)?out[0]:out}
async function cloudFetchRosters(){const rows=await cloudRest('manarat_rosters','select=*&order=updated_at.desc',{method:'GET',headers:{Accept:'application/json'}});return (rows||[]).map(r=>({...r.data,id:String(r.id),title:r.data?.title||r.title}))}
async function cloudInsertAttempt(attempt){const g=(store().games||[]).find(x=>String(x.id)===String(attempt.game_id))||{};const tid=isUUID(g.teacher_id)?g.teacher_id:null;const payload={id:String(attempt.id||uuid()),game_id:String(attempt.game_id||''),teacher_id:tid,teacher_email:g.teacher_email||'',student_name:attempt.student_name||'',score:Number(attempt.score||0),data:attempt,created_at:attempt.created_at||new Date().toISOString()};await cloudRest('manarat_attempts','',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});return true}
async function cloudFetchAttempts(){const rows=await cloudRest('manarat_attempts','select=*&order=created_at.desc',{method:'GET',headers:{Accept:'application/json'}});return (rows||[]).map(r=>({...r.data,id:String(r.id),game_id:String(r.game_id),student_name:r.student_name,score:r.score,created_at:r.created_at}))}

async function cloudInsertAudit(log={}){
  if(!log||!log.id)return false;
  try{
    const payload={id:log.id,action:log.action||'',target:log.target||'',details:log.details||{},admin_email:log.admin_email||'',admin_name:log.admin_name||'',created_at:log.created_at||new Date().toISOString()};
    await cloudRest('manarat_audit_logs','',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
    return true;
  }catch(e){console.warn('cloudInsertAudit failed',e);return false}
}
async function cloudFetchAuditLogs(){
  try{
    const rows=await cloudRest('manarat_audit_logs','select=*&order=created_at.desc&limit=300',{method:'GET',headers:{Accept:'application/json'}})||[];
    return (rows||[]).map(r=>({id:r.id,action:r.action,target:r.target,details:r.details||{},admin_email:r.admin_email,admin_name:r.admin_name,created_at:r.created_at}));
  }catch(e){console.warn('cloudFetchAuditLogs failed',e);return []}
}
async function cloudSyncTables(){
  if(!cloudReady(cloudConfig()))return false;
  try{
    const s=store();
    const [stateRow,games,banks,rosters,attempts,profiles,auditRows]=await Promise.all([
      cloudFetchState().catch(()=>null),
      cloudFetchGames().catch(()=>[]),
      cloudFetchBanks().catch(()=>[]),
      cloudFetchRosters().catch(()=>[]),
      cloudFetchAttempts().catch(()=>[]),
      cloudFetchProfiles().catch(()=>[]),
      cloudFetchAuditLogs().catch(()=>[])
    ]);
    let baseState=s;
    if(stateRow&&stateRow.data){
      baseState=mergeLocalAndRemote(s,stateRow.data);
    }
    const merged={...baseState,
      games:mergeById(baseState.games,games),
      questionBanks:mergeById(baseState.questionBanks,banks),
      studentRosters:mergeById(baseState.studentRosters,rosters),
      attempts:mergeById(baseState.attempts,attempts),
      auditLogs:mergeById(baseState.auditLogs,auditRows)
    };
    merged.teachers=mergeTeachersFromSources(baseState.teachers,profiles,merged.games);
    const u=currentAuthUser(); if(u&&Array.isArray(profiles)){const cp=profiles.find(p=>String(p.id)===String(u.id)||String(p.email||'').toLowerCase()===String(u.email||'').toLowerCase()); if(cp)merged.profile={...(merged.profile||{}),...profileToTeacher(cp)}}
    localStorage.setItem(STORE_KEY,JSON.stringify(mergeStore(merged)));
    document.dispatchEvent(new CustomEvent('manarat:store-updated',{detail:{source:'cloudSyncTables'}}));
    return true;
  }catch(e){console.warn('cloudSyncTables failed',e);return false}
}
async function cloudSaveAllTables(){
  const s=store();
  await Promise.allSettled((s.games||[]).map(cloudUpsertGame));
  await Promise.allSettled((s.questionBanks||[]).map(cloudUpsertBank));
  await Promise.allSettled((s.studentRosters||[]).map(cloudUpsertRoster));
  await Promise.allSettled((s.auditLogs||[]).slice(0,100).map(cloudInsertAudit));
  await cloudUpsertProfile(currentProfile()).catch(e=>console.warn('profile cloud save failed',e));
  toast('تمت مزامنة الجداول السحابية بنجاح');
  return true;
}
async function callAIEdgeFunction(prompt,files=[],ai={}){
  const c=cloudConfig();
  if(!cloudReady(c))throw new Error('Supabase غير مفعّل لتشغيل Edge Function');
  const fd=new FormData();
  fd.append('prompt',prompt);
  fd.append('model',ai.model||DEFAULT_GEMINI_MODEL);
  fd.append('temperature',String(ai.temperature||0.2));
  for(const f of files||[])fd.append('files',f,f.name||'file');
  const name=ai.edgeFunctionName||'dynamic-handler';
  const edgeHeaders={'apikey':String(c.publishableKey||'')};const token=realAccessToken();if(token)edgeHeaders.Authorization='Bearer '+token;const res=await fetch(cleanSupabaseUrl(c.supabaseUrl)+'/functions/v1/'+name,{method:'POST',headers:edgeHeaders,body:fd});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(humanErrorMessage(json.error||json.message||'فشل Edge Function'));
  return typeof json==='string'?json:(json.content||JSON.stringify(json));
}

async function callEdgeJSONFunction(name,payload={}){
  const c=cloudConfig();
  if(!cloudReady(c))throw new Error('Supabase غير مفعّل لتشغيل الدوال الآمنة');
  const edgeHeaders={'apikey':String(c.publishableKey||''),'Content-Type':'application/json'};
  const token=realAccessToken();
  if(token)edgeHeaders.Authorization='Bearer '+token;
  const res=await fetch(cleanSupabaseUrl(c.supabaseUrl)+'/functions/v1/'+name,{method:'POST',headers:edgeHeaders,body:JSON.stringify(payload||{})});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(humanErrorMessage(json.error||json.message||('فشل تنفيذ الدالة الآمنة '+name)));
  return json;
}
async function cloudDeleteAuthUser(profile={}){
  const id=profile.id||profile.user_id||'';
  const email=String(profile.email||'').trim().toLowerCase();
  if(!id&&!email)return {ok:false,skipped:true,message:'لا يوجد معرف أو بريد للحساب'};
  try{return await callEdgeJSONFunction('dynamic-api',{id,email})}
  catch(e){console.warn('delete-user-admin function failed',e);return {ok:false,error:e.message||String(e)}}
}


function humanErrorMessage(msg=''){
  const raw=String(msg||'');
  const lower=raw.toLowerCase();
  if(/quota|rate limit|resource_exhausted|exceeded your current quota|free_tier/i.test(raw))return 'تم الوصول إلى الحد المجاني لمفتاح Gemini. انتظر قليلًا ثم أعد المحاولة، أو فعّل الفوترة في Google AI Studio/Google Cloud، ويفضل توليد عدد أقل من الأسئلة.';
  if(/failed to fetch|networkerror|load failed/i.test(raw))return 'تعذر الوصول إلى دالة الذكاء الاصطناعي. تأكد من اسم Edge Function، وإعداد CORS/Verify JWT، ثم جرّب مرة أخرى.';
  if(/unauthorized|401|jwt/i.test(raw))return 'الدالة رفضت الطلب بسبب صلاحيات الدخول. سجّل الدخول بحساب صحيح أو عطّل Verify JWT مؤقتًا للتجربة.';
  if(/function not found|404/i.test(raw))return 'لم يتم العثور على الدالة في Supabase. تأكد من اسم الدالة المكتوب في إعدادات الذكاء الاصطناعي.';
  if(/payload too large|413|too large|file size/i.test(raw))return 'الملف كبير جدًا. جرّب ملفًا أصغر أو قلل عدد الصفحات قبل الرفع.';
  if(/gemini_api_key|api key|invalid key/i.test(raw))return 'مفتاح Gemini غير مضبوط أو غير صحيح. ضعه في Supabase Secrets باسم GEMINI_API_KEY ثم أعد نشر الدالة.';
  if(/model|not found/i.test(raw)&&/gemini/i.test(raw))return 'اسم نموذج Gemini غير صحيح أو غير متاح للحساب الحالي. جرّب gemini-2.5-flash.';
  if(/service_role|service role|supabase_service_role/i.test(raw))return 'دالة الحذف الآمن تحتاج إضافة SUPABASE_SERVICE_ROLE_KEY داخل Supabase Secrets ثم إعادة نشر الدالة.';
  return raw;
}

function relAsset(path){if(!path)path=logoClean;if(/^data:|^https?:|^\.\.|^\//i.test(path))return path;const p=location.pathname;const prefix=(p.includes('/teacher/')||p.includes('/player/')||p.includes('/admin/'))?'../../assets/':'../assets/';return prefix+path.replace(/^assets\//,'')}
function rootPublic(){const href=location.href.split('#')[0].split('?')[0];const normalized=href.replace(/\\/g,'/');const idx=normalized.indexOf('/public/');if(idx>=0)return normalized.slice(0,idx+8);const markers=['/teacher/','/admin/','/player/'];for(const marker of markers){const pos=normalized.indexOf(marker);if(pos>=0)return normalized.slice(0,pos+1)}return normalized.replace(/[^/]*$/,'')}
function getGameLink(id){return rootPublic()+'player/game.html?game='+encodeURIComponent(id)}
function playTone(type='click'){const s=store();if(!s.platform.playerSounds)return;try{const C=window.AudioContext||window.webkitAudioContext;const ctx=new C();const osc=ctx.createOscillator();const gain=ctx.createGain();const map={hover:390,click:540,success:860,fail:180,finish:980};osc.frequency.value=map[type]||520;osc.type=type==='fail'?'sawtooth':'sine';osc.connect(gain);gain.connect(ctx.destination);gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.075,ctx.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+((type==='success'||type==='finish') ? .28 : .12));osc.start();osc.stop(ctx.currentTime+((type==='success'||type==='finish') ? .3 : .14))}catch(e){}}
function toast(msg,type='success'){msg=humanErrorMessage(msg);qsa('.toast').forEach(x=>x.remove());const el=document.createElement('div');el.className='toast '+(type==='error'?'error':type==='warn'?'warn':'');el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),3300)}
function burst(kind='good',message=''){
  if(!store().platform.playerFx)return;
  const gameGender=window.ManaratCurrentGameGender||store().platform?.uiGender||'female';
  const g=normalizedGender(gameGender);
  const text=message||(kind==='good'?(g==='male'?'أحسنت يا بطل! 🎉':'أحسنتِ يا بطلة! 🎉'):(g==='male'?'حاول مرة أخرى ✨':'حاولي مرة أخرى ✨'));
  const layer=document.createElement('div');layer.className='celebration-layer';
  const banner=document.createElement('div');banner.className='celebration-banner';banner.textContent=genderizeText(text,g);layer.appendChild(banner);
  const colors=['#facc15','#38bdf8','#fb7185','#22c55e','#a78bfa','#ffffff'];
  for(let i=0;i<95;i++){const sp=document.createElement('span');const t=i%7;sp.className=t<4?'celebration-piece':(t<6?'celebration-streamer':'celebration-star');sp.textContent=t===6?['⭐','✨','🏆','🎉'][i%4]:'';sp.style.left=(Math.random()*100)+'vw';sp.style.top=(-20-Math.random()*80)+'px';sp.style.setProperty('--piece-color',colors[i%colors.length]);sp.style.setProperty('--dx',(Math.random()*360-180)+'px');sp.style.setProperty('--dy',(-80-Math.random()*260)+'px');sp.style.setProperty('--rot',(Math.random()*960-480)+'deg');sp.style.setProperty('--dur',(1050+Math.random()*950)+'ms');layer.appendChild(sp)}
  document.body.appendChild(layer);setTimeout(()=>layer.remove(),1900)
}
function downloadFile(filename,content,type='text/plain;charset=utf-8'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),400)}
function sanitizeFilename(x='manarat-game'){return String(x).replace(/[\\/:*?"<>|]/g,'-').slice(0,90)||'manarat-game'}
function normalizeType(t='multiple_choice'){t=String(t||'').toLowerCase();if(t.includes('classif')||t.includes('categor')||t.includes('sort_table')||t.includes('تصنيف')||t.includes('جدول'))return'classification';if(t.includes('true')||t.includes('صح'))return'true_false';if(t.includes('match')||t.includes('مطابقة'))return'matching';if(t.includes('connect')||t.includes('توصيل'))return'connecting';if(t.includes('order')||t.includes('ترتيب'))return'ordering';if(t.includes('puzzle')||t.includes('بازل')||t.includes('تركيب صورة'))return'puzzle_image';if(t.includes('open')||t.includes('short')||t.includes('نص'))return'open_text';return'multiple_choice'}
function cleanQuestionValue(v){
  if(v==null)return'';
  if(typeof v==='object')v=v.text??v.question??v.title??v.left??v.right??v.answer??'';
  return String(v).replace(/```(?:json)?/gi,'').replace(/```/g,'').replace(/\s+/g,' ').trim();
}
function looksLikeRawJSONFragment(v){
  const x=cleanQuestionValue(v);
  if(!x)return true;
  const compact=x.replace(/\s+/g,' ');
  const keyHits=(compact.match(/"(?:type|emoji|text|question|options|choices|correct|correctIndex|explanation|pairs|items|answers)"\s*:/g)||[]).length;
  if(keyHits>=1)return true;
  if(/^[{}\[\],]+$/.test(compact))return true;
  if(/^\{.*\}$/.test(compact)&&/[":,]/.test(compact))return true;
  if(/^\[.*\]$/.test(compact)&&/[":,]/.test(compact))return true;
  if(/^(undefined|null|nan)$/i.test(compact))return true;
  return false;
}
function cleanOptionArray(arr){return (Array.isArray(arr)?arr:[]).map(cleanQuestionValue).filter(x=>x&&!looksLikeRawJSONFragment(x))}
function normalizeQuestion(q,i=0){
  if(!q||typeof q!=='object')return null;
  const type=normalizeType(q.type||q.kind);
  const base={id:q.id||uuid(),type,emoji:cleanQuestionValue(q.emoji)||(type==='puzzle_image'?'🧩':type==='matching'?'🔗':type==='connecting'?'🧵':type==='ordering'?'🔢':type==='classification'?'🗂️':type==='true_false'?'✅':type==='open_text'?'✍️':'📖'),text:cleanQuestionValue(q.text||q.question||q.title),image:q.image||'',points:Number(q.points||10),attempts:Number(q.attempts||1),explanation:cleanQuestionValue(q.explanation)};
  if(!base.text||looksLikeRawJSONFragment(base.text))return null;
  if(base.explanation&&looksLikeRawJSONFragment(base.explanation))base.explanation='';
  if(type==='puzzle_image'){
    const img=cleanQuestionValue(q.image||q.puzzleImage);
    const grid=Math.max(2,Math.min(5,Number(q.puzzle_grid||q.grid||3)||3));
    return img&&!looksLikeRawJSONFragment(img)?{...base,image:img,puzzle_grid:grid,show_reference:q.show_reference!==false}:null;
  }
  if(type==='classification'){
    let cols=Array.isArray(q.categories)?q.categories:(Array.isArray(q.columns)?q.columns:[]);
    cols=cols.map((c,ci)=>{
      const title=cleanQuestionValue(c.title??c.name??c.label??('عمود '+(ci+1)));
      let items=Array.isArray(c.items)?c.items:(Array.isArray(c.words)?c.words:[]);
      items=items.map(it=>{
        if(typeof it==='object'){
          const text=cleanQuestionValue(it.text??it.label??it.word??it.value??'');
          const image=cleanQuestionValue(it.image??it.img??it.url??'');
          const kind=(it.kind==='image'||it.type==='image'||(!text&&!!image))?'image':'text';
          return {kind,text:kind==='text'?text:'',image:kind==='image'?image:''};
        }
        return {kind:'text',text:cleanQuestionValue(it),image:''};
      }).filter(it=>(it.kind==='text'&&it.text&&!looksLikeRawJSONFragment(it.text))||(it.kind==='image'&&it.image&&!looksLikeRawJSONFragment(it.image)));
      return {title,items};
    }).filter(c=>c.title&&c.items.length);
    if(cols.length<2)return null;
    cols=cols.slice(0,4);
    return {...base,emoji:base.emoji||'🗂️',categories:cols,column_count:Math.max(2,Math.min(4,Number(q.column_count||q.columns_count||cols.length)||cols.length))};
  }
  if(type==='matching'||type==='connecting'){
    let pairs=Array.isArray(q.pairs)?q.pairs:[];
    pairs=pairs.map(p=>({left:cleanQuestionValue(p.left??p[0]),right:cleanQuestionValue(p.right??p[1])})).filter(p=>p.left&&p.right&&!looksLikeRawJSONFragment(p.left)&&!looksLikeRawJSONFragment(p.right));
    return pairs.length>=2?{...base,pairs}:null;
  }
  if(type==='ordering'){
    let items=cleanOptionArray(q.items);
    return items.length>=2?{...base,items}:null;
  }
  if(type==='open_text'){
    let answers=(q.answers||q.accepted||q.acceptedAnswers||[]);if(!Array.isArray(answers))answers=[answers];answers=cleanOptionArray(answers);
    const manual=q.manual_grade!==false&&q.manualGrade!==false&&q.auto_check!==true&&q.autoCheck!==true;
    return (manual||answers.length)?{...base,answers,manual_grade:manual}:null;
  }
  let options=cleanOptionArray(q.options||q.choices||[]);
  if(type==='true_false'&&options.length<2)options=['صح','خطأ'];
  let correct=Number(q.correct??q.correctIndex??0);if(!Number.isFinite(correct))correct=0;
  return options.length>=2?{...base,options,correct:Math.max(0,Math.min(options.length-1,correct))}:null;
}
function normalizeQuestions(data){let arr=Array.isArray(data)?data:(data&&Array.isArray(data.questions)?data.questions:(data&&data.questionBank&&Array.isArray(data.questionBank.questions)?data.questionBank.questions:(data&&data.type?[data]:[])));return arr.map(normalizeQuestion).filter(Boolean)}
function safeJSONStringParse(content){
  content=stripCodeFence(String(content||'').trim());
  try{return JSON.parse(content)}catch(e){}
  const first=content.indexOf('{'),last=content.lastIndexOf('}');
  if(first>=0&&last>first){try{return JSON.parse(content.slice(first,last+1))}catch(e){}}
  const af=content.indexOf('['),al=content.lastIndexOf(']');
  if(af>=0&&al>af){try{return {questions:JSON.parse(content.slice(af,al+1))}}catch(e){}}
  throw new Error('لم يرجع مزود الذكاء الاصطناعي JSON صالحًا للأسئلة');
}
function flattenQuestionText(q){
  let parts=[q.text,q.explanation].filter(Boolean);
  if(Array.isArray(q.options))parts.push(...q.options);
  if(Array.isArray(q.answers))parts.push(...q.answers);
  if(Array.isArray(q.items))parts.push(...q.items);
  if(Array.isArray(q.pairs))q.pairs.forEach(p=>parts.push(p.left,p.right));
  if(Array.isArray(q.categories))q.categories.forEach(c=>{parts.push(c.title);(c.items||[]).forEach(it=>parts.push(it.text,it.image))});
  return parts.map(x=>String(x||'')).join(' ');
}
const AI_BAD_TEMPLATE_RE=/(نص\s*السؤال|سؤال\s*فعلي|سؤال\s*نص\s*مفتوح|اختيار\s*\d+|شرح\s*قصير|شكل\s*السؤال|صيغة\s*JSON|النص\s*المستخرج|ملف\s*مرفق|وردت\s*في\s*النص|مفهوم\s*من\s*النص|إجابة\s*حقيقية\s*من\s*الدرس|للمطابقة|للتوصيل|للترتيب|للنص\s*المفتوح)/i;
const AI_STOP_WORDS=new Set('هذا هذه ذلك تلك الذي التي الذين اللاتي مما كما على إلى عن من في كان كانت يكون تكون ليس ليست بين عند بعد قبل خلال حيث لأن إن أن أو ثم وقد فقد فقط جدا كل بعض غير داخل خارج السؤال الإجابة النص الدرس المصدر الملف الفقرة العبارة صحيح خطأ اختر اختاري ضع ضعي اكتب اكتبي رتب رتبي وصل وصلي طابق طابقي'.split(' '));
function arabicTokens(v){return String(v||'').replace(/[\u064B-\u065F\u0670]/g,'').match(/[\u0621-\u064A]{4,}/g)||[]}
function isGroundedEnough(q,sourceText){
  const src=String(sourceText||'');
  if(src.replace(/\s+/g,'').length<80)return true;
  const srcSet=new Set(arabicTokens(src).filter(w=>!AI_STOP_WORDS.has(w)));
  if(srcSet.size<8)return true;
  const qt=arabicTokens(flattenQuestionText(q)).filter(w=>!AI_STOP_WORDS.has(w));
  let overlap=0;
  for(const w of new Set(qt)){if(srcSet.has(w))overlap++}
  return overlap>=1;
}
function isRealAIQuestion(q,sourceText){
  const flat=flattenQuestionText(q);
  if(!flat.trim())return false;
  if(AI_BAD_TEMPLATE_RE.test(flat))return false;
  if(!isGroundedEnough(q,sourceText))return false;
  if((q.type==='matching'||q.type==='connecting')&&Array.isArray(q.pairs)){
    if(q.pairs.some(p=>AI_BAD_TEMPLATE_RE.test(String(p.left||'')+' '+String(p.right||''))))return false;
  }
  if(q.type==='multiple_choice'&&Array.isArray(q.options)){
    if(q.options.some(o=>/^\s*(اختيار|خيار)\s*\d+/i.test(String(o))))return false;
    if(new Set(q.options.map(o=>String(o).trim())).size<q.options.length)return false;
  }
  return true;
}
function normalizeAndFilterAIQuestions(data,sourceText){
  const out=normalizeQuestions(data).filter(q=>isRealAIQuestion(q,sourceText));
  return out;
}

function applyPlatform(){const s=store(),p=s.platform||{};document.documentElement.style.setProperty('--brand1',p.accent1||'#f6c85f');document.documentElement.style.setProperty('--brand2',p.accent2||'#18d2ff');document.documentElement.style.setProperty('--brand3',p.accent3||'#7c3aed');document.documentElement.style.setProperty('--fontScale',p.fontScale||1);document.documentElement.style.setProperty('--questionSize',(p.questionSize||34)+'px');document.documentElement.style.setProperty('--answerSize',(p.answerSize||28)+'px');document.documentElement.style.setProperty('--radius',(p.cardRadius||28)+'px');document.documentElement.style.setProperty('--customBgImage',`url(${p.customBgImage||''})`);document.body.dataset.bg=p.background||'cosmic';document.body.dataset.font=p.fontFamily||'tajawal';qsa('[data-brand-name]').forEach(el=>el.textContent=p.brandName||'');qsa('[data-brand-subtitle]').forEach(el=>el.textContent=p.brandSubtitle||'');const logoSrc=relAsset(p.logoImage||logoClean);const markSrc=relAsset(p.markImage||p.logoImage||mark);qsa('[data-logo]').forEach(img=>{if(img.src!==logoSrc)img.src=logoSrc});qsa('[data-mark]').forEach(img=>{if(img.src!==markSrc)img.src=markSrc});setDynamicFavicon(markSrc);}
function setDynamicFavicon(src){
  try{
    if(!src)return;
    let link=document.querySelector('link[rel="icon"]')||document.querySelector('link[rel="shortcut icon"]');
    if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link)}
    link.href=src;
  }catch(e){}
}
async function fileToDataURL(file){return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=()=>reject(fr.error||new Error('تعذر قراءة الملف'));fr.readAsDataURL(file)})}
async function compressImageDataURL(src,maxDim=1100,quality=.82,preserveAlpha=false){
  src=String(src||'');
  if(!src.startsWith('data:image/'))return src;
  if(src.startsWith('data:image/svg'))return src;
  const isPng=src.startsWith('data:image/png');
  return await new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      try{
        let w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
        if(!w||!h)return resolve(src);
        const ratio=Math.min(1,Number(maxDim||1100)/Math.max(w,h));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(w*ratio));
        canvas.height=Math.max(1,Math.round(h*ratio));
        const ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const out=(preserveAlpha||isPng)?canvas.toDataURL('image/png'):canvas.toDataURL('image/jpeg',Number(quality||.82));
        resolve((preserveAlpha||isPng)?out:(out.length<src.length?out:src));
      }catch(e){resolve(src)}
    };
    img.onerror=()=>resolve(src);
    img.src=src;
  })
}
async function compressImageFile(file,maxDim=1100,quality=.82,preserveAlpha=false){
  if(!file)return'';
  if(!String(file.type||'').startsWith('image/'))return await fileToDataURL(file);
  const data=await fileToDataURL(file);
  const keepAlpha=preserveAlpha||String(file.type||'').includes('png')||String(file.type||'').includes('svg');
  return await compressImageDataURL(data,maxDim,quality,keepAlpha);
}
function dataUrlBase64(dataUrl){return String(dataUrl||'').split(',')[1]||''}
function stripCodeFence(content=''){
  content=String(content||'').trim();
  content=content.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```$/,'').trim();
  if((content.startsWith('{')&&content.endsWith('}'))||(content.startsWith('[')&&content.endsWith(']')))return content;
  const objA=content.indexOf('{'),objB=content.lastIndexOf('}');
  const arrA=content.indexOf('['),arrB=content.lastIndexOf(']');
  if(arrA>=0&&arrB>arrA&&(objA<0||arrA<objA))return content.slice(arrA,arrB+1);
  if(objA>=0&&objB>objA)return content.slice(objA,objB+1);
  return content;
}
function normalizeSourceForPrompt(text){
  text=String(text||'').replace(/\r/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if(text.length>42000)text=text.slice(0,42000)+'\n\n[تم اختصار بقية النص لطول الملف، ويجب الاستفادة من الملف المرفق نفسه أيضًا.]';
  return text;
}
function buildStrictQuestionPrompt({text='',count=10,types=[],fileSummary=''}){
 const selected=(types&&types.length?types:['multiple_choice','true_false','matching','connecting','ordering','classification','open_text']).join(', ');
 const source=normalizeSourceForPrompt(text);
 return `مهمتك إنشاء أسئلة تعليمية حقيقية للطلاب من المادة العلمية فقط.

المصدر الوحيد المسموح: الملف/النص المرفق في هذه الرسالة. لا تستخدم أمثلة الصيغة ولا أسماء الحقول كمادة للأسئلة.
عدد الأسئلة المطلوب: ${count}.
أنواع الأسئلة المطلوبة إن أمكن: ${selected}.
${fileSummary?`الملفات المرفقة:
${fileSummary}
`:''}
اخرج JSON فقط بهذا الهيكل العام دون Markdown ودون شرح خارجي:
{
  "questions": [
    {
      "type": "multiple_choice | true_false | matching | connecting | ordering | open_text",
      "emoji": "رمز مناسب",
      "text": "سؤال فعلي من الدرس",
      "options": ["للاختيار أو الصح والخطأ فقط"],
      "correct": 0,
      "pairs": [{"left":"للمطابقة أو التوصيل فقط","right":"إجابة حقيقية من الدرس"}],
      "items": ["للترتيب فقط"],
      "answers": ["للنص المفتوح فقط"],
      "explanation": "سبب قصير مأخوذ من المصدر"
    }
  ]
}

قواعد إلزامية لا تتجاوزها:
1) كل سؤال يجب أن يسأل عن معلومة محددة وردت في المصدر، مثل اسم أو تعريف أو سبب أو نتيجة أو خطوة أو مثال أو مقارنة.
2) ممنوع تمامًا إنتاج أسئلة عن: النص المستخرج، شكل السؤال، صيغة JSON، الملف، الرفع، Gemini، الذكاء الاصطناعي، أو طريقة التوليد.
3) ممنوع استخدام كلمات القوالب مثل: "نص السؤال"، "اختيار 1"، "اختيار 2"، "شرح قصير"، "عبارة"، "إجابة" كقيم عامة.
4) في الاختيار من متعدد: اجعل الإجابة الصحيحة من المصدر، واجعل المشتتات معقولة لكنها غير صحيحة، وحدد correct كرقم فهرس صحيح.
5) في الصح والخطأ: اجعل العبارة مبنية على معلومة من المصدر، ولا تجعلها عامة.
6) في المطابقة والتوصيل: ضع أزواجًا حقيقية؛ الطرف الأيسر مفهوم/مصطلح/سؤال قصير، والطرف الأيمن معناه/إجابته/نتيجته من المصدر. لا تكتب "وردت في النص" أو "مفهوم من النص".
7) في الترتيب: لا تستخدمه إلا إذا كان في المصدر خطوات أو تسلسل واضح؛ وإلا استبدله بنوع آخر مطلوب.
8) إذا تعذر قراءة المصدر، ارجع {"questions":[]} فقط.

المادة العلمية المستخرجة نصيًا للمساعدة، مع ضرورة الاعتماد أيضًا على الملف المرفق إن وجد:
<<<BEGIN_SOURCE>>>
${source}
<<<END_SOURCE>>>`;
}
function buildRepairQuestionPrompt({text='',count=10,types=[],fileSummary='',previousOutput=''}){
 const selected=(types&&types.length?types:['multiple_choice','true_false','matching','connecting','ordering','classification','open_text']).join(', ');
 const source=normalizeSourceForPrompt(text);
 return `الرد السابق كان غير صالح لأنه استخدم قوالب أو أسئلة عامة. أعد التوليد من المادة العلمية فقط.

المطلوب الآن: ${count} سؤالًا حقيقيًا من الدرس، بالأنواع المناسبة من: ${selected}.
${fileSummary?`الملفات المرفقة:
${fileSummary}
`:''}
لا تذكر: نص مستخرج، شكل السؤال، JSON، اختيار 1، اختيار 2، شرح قصير، وردت في النص، مفهوم من النص.
كل سؤال يجب أن يحتوي معلومة واضحة من المصدر نفسه.
أخرج JSON فقط بهذا الشكل: {"questions":[...]}.

المادة العلمية:
<<<BEGIN_SOURCE>>>
${source}
<<<END_SOURCE>>>

لا تصلح الرد السابق حرفيًا، بل أنشئ أسئلة جديدة حقيقية.`;
}
let __pdfjsLoadPromise=null;
async function ensurePDFJS(){
  if(window.pdfjsLib)return window.pdfjsLib;
  if(__pdfjsLoadPromise)return __pdfjsLoadPromise;
  __pdfjsLoadPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload=()=>{
      try{
        if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';resolve(window.pdfjsLib)}
        else reject(new Error('تعذر تحميل قارئ PDF'));
      }catch(e){reject(e)}
    };
    script.onerror=()=>reject(new Error('تعذر تحميل قارئ PDF من الإنترنت'));
    document.head.appendChild(script);
  });
  return __pdfjsLoadPromise;
}
async function extractPDFTextWithPDFJS(file,maxPages=80){
  try{
    const pdfjs=await ensurePDFJS();
    const buf=await file.arrayBuffer();
    const pdf=await pdfjs.getDocument({data:new Uint8Array(buf)}).promise;
    const limit=Math.min(pdf.numPages||0,Number(maxPages)||80);
    const pages=[];
    for(let i=1;i<=limit;i++){
      const page=await pdf.getPage(i);
      const tc=await page.getTextContent();
      const txt=(tc.items||[]).map(it=>it.str||'').join(' ').replace(/\s+/g,' ').trim();
      if(txt)pages.push(`[صفحة ${i}] ${txt}`);
    }
    return pages.join('\n').trim();
  }catch(e){console.warn('PDF text extraction failed',e);return ''}
}
async function extractPDFTextBasic(file){
  try{const buf=await file.arrayBuffer();let bin=new TextDecoder('latin1').decode(buf);let parts=[];bin.replace(/\(([^()]{2,900})\)\s*Tj/g,(m,t)=>{parts.push(t)});bin.replace(/\[(.*?)\]\s*TJ/gs,(m,t)=>{let seg=[];t.replace(/\(([^()]{1,900})\)/g,(mm,x)=>seg.push(x));if(seg.length)parts.push(seg.join(''))});return parts.join(' ').replace(/\\([()\\])/g,'$1').replace(/\\n/g,' ').replace(/\s+/g,' ').trim()||''}catch(e){return ''}
}
async function readFileText(file){
  if(!file)return'';
  const name=(file.name||'').toLowerCase();
  const type=file.type||'';
  if(type.startsWith('image/'))return '';
  if(name.endsWith('.txt')||name.endsWith('.md')||name.endsWith('.html')||name.endsWith('.json')||type.startsWith('text/')){return await file.text()}
  if(name.endsWith('.pdf')||type==='application/pdf'){
    const rich=await extractPDFTextWithPDFJS(file);
    if(rich)return rich;
    return await extractPDFTextBasic(file);
  }
  try{return await file.text()}catch(e){return ''}
}
function localGenerateQuestions(text,opts={}){text=String(text||'').replace(/\s+/g,' ').trim();if(!text || /^\[?صورة مرفوعة/i.test(text))return [];const sentences=text.split(/[.!؟?،؛\n]+/).map(x=>x.trim()).filter(x=>x.length>18);if(!sentences.length && text.length<25)return [];const count=Math.max(1,Math.min(50,Number(opts.count||10)));const types=opts.types||['multiple_choice','true_false','matching','ordering','open_text'];let qs=[];for(let i=0;i<count;i++){const s=sentences[i%Math.max(1,sentences.length)]||text.slice(0,120);const type=types[i%types.length];if(type==='true_false')qs.push({type:'true_false',emoji:'✅',text:'صح أم خطأ: '+s,options:['صح','خطأ'],correct:0,explanation:'اعتمدت العبارة على النص المرفق.'});else if(type==='matching'){const words=s.split(' ').filter(w=>w.length>3).slice(0,4);qs.push({type:'matching',emoji:'🔗',text:'طابقي الكلمات بما يناسبها من النص:',pairs:(words.length?words:['العلم','المعرفة']).map(w=>({left:w,right:'وردت في النص'})),explanation:'مطابقة مبنية على مفردات النص.'})}else if(type==='connecting'){const words=s.split(' ').filter(w=>w.length>3).slice(0,4);qs.push({type:'connecting',emoji:'🧵',text:'وصّلي كل عبارة بما يناسبها:',pairs:(words.length?words:['الفكرة','النتيجة']).map(w=>({left:w,right:'مفهوم من النص'})),explanation:'توصيل مبني على النص.'})}else if(type==='ordering'){const items=sentences.slice(i,i+4);qs.push({type:'ordering',emoji:'🔢',text:'رتّبي الأفكار كما وردت في النص:',items:(items.length>=2?items:['الفكرة الأولى','الفكرة الثانية','الفكرة الثالثة']),explanation:'ترتيب الأفكار بحسب ظهورها.'})}else if(type==='open_text')qs.push({type:'open_text',emoji:'✍️',text:'اكتبي كلمة أو فكرة رئيسية من النص.',answers:[(s.split(' ').find(w=>w.length>4)||'المعرفة')],explanation:'إجابة مفتوحة اعتمادًا على النص.'});else{let words=s.split(' ').filter(w=>w.length>3);let ans=words[0]||'المعرفة';let options=shuffle([ans,'التعاون','النشاط','المدرسة']).slice(0,4);qs.push({type:'multiple_choice',emoji:'📖',text:'اختاري الكلمة المرتبطة بالعبارة الآتية: '+s.slice(0,120),options,correct:options.indexOf(ans),explanation:'السؤال مولّد محليًا من النص.'})}}
return normalizeQuestions(qs)}
async function pdfFileToGeminiImageParts(file,maxPages=6){
  const out=[];
  try{
    const pdfjs=await ensurePDFJS();
    const buf=await file.arrayBuffer();
    const pdf=await pdfjs.getDocument({data:new Uint8Array(buf)}).promise;
    const limit=Math.min(pdf.numPages||0,Number(maxPages)||6);
    for(let i=1;i<=limit;i++){
      const page=await pdf.getPage(i);
      const viewport=page.getViewport({scale:1.45});
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d',{alpha:false});
      canvas.width=Math.max(1,Math.round(viewport.width));
      canvas.height=Math.max(1,Math.round(viewport.height));
      await page.render({canvasContext:ctx,viewport}).promise;
      const dataUrl=canvas.toDataURL('image/jpeg',0.82);
      const b64=dataUrlBase64(dataUrl);
      if(b64)out.push({inlineData:{mimeType:'image/jpeg',data:b64}});
    }
  }catch(e){console.warn('PDF preview rendering failed',e)}
  return out;
}
function fileSummaryLine(file){
  const kb=Math.max(1,Math.round((file.size||0)/1024));
  return `- ${file.name||'ملف'} (${file.type||'نوع غير محدد'}, ${kb} KB)`;
}
async function callGeminiNative(ai,prompt,files=[]){
 const rawModel=(ai.model||'gemini-2.5-flash').trim();
 const model=rawModel.includes('/')?rawModel.split('/').pop():rawModel;
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ai.apiKey||'')}`;
 const parts=[];
 for(const f of files||[]){
  const lower=(f.name||'').toLowerCase();
  let mime=f.type||'';
  if(!mime&&lower.endsWith('.pdf'))mime='application/pdf';
  if(!mime&&lower.endsWith('.txt'))mime='text/plain';
  if(!mime&&lower.endsWith('.md'))mime='text/markdown';
  if(!mime&&lower.endsWith('.json'))mime='application/json';
  if(!mime&&lower.endsWith('.html'))mime='text/html';
  if(!mime)mime='application/octet-stream';
  const isPdf=(mime==='application/pdf'||lower.endsWith('.pdf'));
  if(isPdf){
   // نرسل PDF نفسه إذا كان حجمه مناسبًا، ونرسل معه صورًا لأول الصفحات حتى ينجح مع ملفات PDF المصورة/الممسوحة ضوئيًا.
   if((f.size||0)<=12*1024*1024){
    const dataUrl=await fileToDataURL(f);const b64=dataUrlBase64(dataUrl);if(b64)parts.push({inlineData:{mimeType:'application/pdf',data:b64}});
   }
   const previews=await pdfFileToGeminiImageParts(f,6);
   parts.push(...previews);
   continue;
  }
  if(mime.startsWith('image/')||mime.startsWith('text/')||mime==='application/json'){
   const dataUrl=await fileToDataURL(f);
   const b64=dataUrlBase64(dataUrl);
   if(b64)parts.push({inlineData:{mimeType:mime,data:b64}});
  }
 }
 parts.push({text:prompt});
 const body={
  contents:[{role:'user',parts}],
  generationConfig:{temperature:0.12,responseMimeType:'application/json'}
 };
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const json=await res.json().catch(()=>({}));
 if(!res.ok){
  const msg=json.error?.message||json.error?.status||`Gemini request failed (${res.status})`;
  throw new Error(humanErrorMessage(msg));
 }
 const out=json.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n')||'';
 if(!out){
  const reason=json.candidates?.[0]?.finishReason||json.promptFeedback?.blockReason||'لم يرجع Gemini نصًا صالحًا';
  throw new Error(reason);
 }
 return out;
}
async function callOpenAICompatible(ai,prompt,files=[]){const content=[{type:'text',text:prompt}];for(const f of files||[]){const mime=f.type||'';if(mime.startsWith('image/')){const dataUrl=await fileToDataURL(f);content.push({type:'image_url',image_url:{url:dataUrl}})}}const res=await fetch(ai.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+ai.apiKey},body:JSON.stringify({model:ai.model||'gpt-4o-mini',temperature:Number(ai.temperature||0.2),messages:[{role:'user',content:content.length>1?content:prompt}]})});const json=await res.json();if(!res.ok)throw new Error(humanErrorMessage(json.error?.message||'AI request failed'));return json.choices?.[0]?.message?.content||json.output_text||''}
async function aiGenerateQuestions({text='',files=[],count=10,types=[]}){
 const s=store();
 const userText=String(text||'').trim();
 let extracted='';
 for(const f of files||[]){
  const t=await readFileText(f);
  if(t)extracted+='\n\n'+t;
 }
 const sourceText=(userText+'\n'+extracted).trim();
 const ai=s.platform.ai||{};
 const hasFiles=(files||[]).length>0;
 const fileSummary=(files||[]).map(fileSummaryLine).join('\n');
 const selectedTypes=types.length?types:['multiple_choice','true_false','matching','connecting','ordering','open_text'];
 const prompt=buildStrictQuestionPrompt({text:sourceText,count,types:selectedTypes,fileSummary});
 let aiAttempted=false;
 if(ai.useEdgeFunction!==false){
  aiAttempted=true;
  try{
   const content=await callAIEdgeFunction(prompt,files,ai);
   const parsed=safeJSONStringParse(content);
   const out=normalizeAndFilterAIQuestions(parsed,sourceText);
   if(out.length)return out;
   toast('رد الذكاء الاصطناعي كان قالبًا أو غير مرتبط بمحتوى الملف. يمكنك الضغط على زر إعادة المحاولة.', 'warn');
  }catch(e){console.warn('AI edge error',e);if(!ai.apiKey)toast('تعذر تشغيل Edge Function: '+(e.message||'خطأ غير معروف'), 'warn')}
 }
 if(ai.endpoint&&ai.apiKey){
  aiAttempted=true;
  try{
   let content='';
   if(/generativelanguage\.googleapis\.com/i.test(ai.endpoint))content=await callGeminiNative(ai,prompt,files);
   else content=await callOpenAICompatible(ai,prompt,files);
   let parsed=safeJSONStringParse(content);
   let out=normalizeAndFilterAIQuestions(parsed,sourceText);
   if(out.length)return out;
   toast('تم رفض الناتج لأنه ليس أسئلة حقيقية من محتوى الملف. اضغط زر إعادة المحاولة إذا أردت توليدًا جديدًا.', 'error');
   return [];
  }catch(e){
   console.warn('AI error',e);
   toast('تعذر توليد أسئلة حقيقية من مزود AI: '+(e.message||'خطأ غير معروف'), 'error');
   if(hasFiles)return [];
  }
 }
 if(hasFiles&&aiAttempted){
  toast('لم يتم اعتماد أسئلة محلية عامة؛ المطلوب أسئلة حقيقية من الملف. جرّب ملفًا أوضح أو الصق النص.', 'error');
  return [];
 }
 if(hasFiles&&!sourceText){toast('لا يمكن التوليد من ملف غير مقروء دون Gemini. الصق النص يدويًا أو استخدم ملفًا أوضح.', 'error');return []}
 const local=localGenerateQuestions(sourceText,{count,types:selectedTypes});
 const real=local.filter(q=>isRealAIQuestion(q,sourceText));
 if(!real.length)toast('لا يوجد نص كافٍ لتوليد أسئلة حقيقية. الصق نص الدرس أو استخدم Gemini.', 'error');
 return real;
}
async function testAIConnection(){const s=store();const ai=s.platform.ai||{};try{let content='';if(ai.useEdgeFunction!==false){content=await callAIEdgeFunction('أجب JSON فقط: {"questions":[]}',[],ai)}else{if(!ai.endpoint||!ai.apiKey){toast('ضع Endpoint و API Key أولًا','error');return false}content=/generativelanguage\.googleapis\.com/i.test(ai.endpoint)?await callGeminiNative(ai,'أجب JSON فقط: {"ok":true,"message":"connected"}',[]):await callOpenAICompatible(ai,'أجب JSON فقط: {"ok":true,"message":"connected"}',[])}JSON.parse(stripCodeFence(content));toast('تم الاتصال بمزود الذكاء الاصطناعي بنجاح');return true}catch(e){console.error(e);toast('فشل اختبار الاتصال: '+(e.message||'خطأ غير معروف'),'error');return false}}

function standaloneHTML(game,platform){
  game=game||{}; platform=platform||{};
  const safePlatform={
    brandName:platform.brandName||'منارة التعلم الرقمي',
    brandSubtitle:platform.brandSubtitle||'DIGITAL LEARNING BEACON',
    accent1:platform.accent1||'#f6c85f',
    accent2:platform.accent2||'#18d2ff',
    accent3:platform.accent3||'#7c3aed',
    questionSize:platform.questionSize||34,
    answerSize:platform.answerSize||28,
    fontScale:platform.fontScale||1.08,
    siteAbout:platform.siteAbout||'',
    siteContact:platform.siteContact||'',
    socialLinks:platform.socialLinks||{}
  };
  const standaloneFooter=siteFooterHTML(safePlatform);
  const payload=JSON.stringify({game:{...game,questions:Array.isArray(game.questions)?game.questions:[]},platform:safePlatform})
    .replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')
    .replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const inlineCSS=`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box} :root{--gold:${safePlatform.accent1};--cyan:${safePlatform.accent2};--violet:${safePlatform.accent3};--bg:#041026;--panel:rgba(8,16,38,.88);--border:rgba(255,255,255,.16);--text:#fff;--muted:#cbd5e1;--ok:#10d69a;--bad:#ef4444;--qsize:${Number(safePlatform.questionSize)||34}px;--asize:${Number(safePlatform.answerSize)||28}px;--scale:${Number(safePlatform.fontScale)||1.08}}
body{margin:0;min-height:100vh;direction:rtl;color:var(--text);font-family:Tajawal,Arial,sans-serif;background:radial-gradient(circle at 15% 10%,rgba(24,210,255,.24),transparent 28%),radial-gradient(circle at 85% 20%,rgba(246,200,95,.22),transparent 26%),linear-gradient(145deg,#041026,#071633 55%,#180b39);overflow-x:hidden;font-size:calc(16px * var(--scale))}body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.22) 1px,transparent 1px);background-size:38px 38px;opacity:.16}.site-footer-global{position:relative;margin:24px auto 34px;width:min(1160px,94vw);background:linear-gradient(180deg,rgba(8,16,38,.92),rgba(15,23,42,.82));border:1px solid rgba(255,255,255,.16);border-radius:28px;padding:22px;color:#e5e7eb}.site-footer-inner{display:grid;grid-template-columns:1fr 1fr;gap:18px}.site-footer-global h3{margin:0 0 8px;color:#ffe8a3}.site-footer-global p{line-height:1.8;color:#cbd5e1}.social-links{display:flex;flex-wrap:wrap;gap:10px}.social-links a{color:#fff;text-decoration:none;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:8px 13px;font-weight:900}@media(max-width:760px){.site-footer-inner{grid-template-columns:1fr}}.wrap{width:min(1160px,94vw);margin:auto;padding:24px 0 32px;position:relative}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}.brand{display:flex;align-items:center;gap:12px}.logo{width:62px;height:62px;border-radius:22px;display:grid;place-items:center;background:linear-gradient(135deg,var(--gold),var(--cyan));color:#071633;font-size:34px;box-shadow:0 18px 55px rgba(24,210,255,.24)}.brand h1{margin:0;color:#ffe8a3;font-size:26px;font-weight:900}.brand small{display:block;color:var(--muted);letter-spacing:2px;font-size:12px}.card{background:linear-gradient(180deg,rgba(8,16,38,.94),rgba(10,20,46,.86));border:1px solid var(--border);border-radius:30px;padding:26px;box-shadow:0 24px 90px rgba(0,0,0,.38);backdrop-filter:blur(12px)}.start{min-height:66vh;display:grid;place-items:center;text-align:center}.start h2{font-size:52px;margin:0 0 10px;color:#ffe8a3}.start p{color:var(--muted);font-size:22px;line-height:1.8}.input{width:min(520px,100%);border:1px solid var(--border);border-radius:22px;padding:18px 22px;background:rgba(15,23,42,.86);color:#fff;font-family:inherit;font-size:25px;text-align:center;outline:none;margin:6px}.btn{border:0;border-radius:20px;padding:15px 24px;background:linear-gradient(135deg,var(--gold),var(--cyan));color:#051225;font-family:inherit;font-weight:900;cursor:pointer;font-size:20px;box-shadow:0 15px 40px rgba(246,200,95,.18);transition:.18s}.btn:hover{transform:translateY(-2px) scale(1.02);filter:brightness(1.05)}.btn.dark{background:rgba(15,23,42,.82);border:1px solid var(--border);color:#fff}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.stat{background:rgba(15,23,42,.72);border:1px solid var(--border);border-radius:20px;padding:12px;text-align:center}.stat b{display:block;color:#ffe8a3;font-size:22px}.progress-wrap{height:13px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden;margin:12px 0 18px}.progress{height:100%;width:0;background:linear-gradient(90deg,var(--gold),var(--cyan));border-radius:999px;transition:.35s}.type{display:inline-block;background:linear-gradient(135deg,var(--violet),#d8b4fe);border-radius:999px;padding:7px 18px;font-weight:900;margin-bottom:14px}.q{font-size:var(--qsize);font-weight:900;line-height:1.85;text-align:center;color:#fff9d8;text-shadow:0 2px 7px rgba(0,0,0,.4);margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.answer,.tile,.drop{width:100%;min-height:90px;border:2px solid rgba(246,200,95,.38);border-radius:24px;background:linear-gradient(135deg,rgba(15,44,62,.95),rgba(29,45,78,.9));color:#fff;font-family:inherit;font-size:var(--asize);font-weight:900;line-height:1.55;display:flex;align-items:center;justify-content:center;text-align:center;padding:17px;cursor:pointer;transition:.18s;box-shadow:0 14px 34px rgba(0,0,0,.22)}.answer:hover,.tile:hover,.drop:hover{border-color:var(--cyan);transform:translateY(-2px);box-shadow:0 18px 44px rgba(24,210,255,.12)}.answer.correct,.tile.correct,.drop.correct{border-color:var(--ok);background:linear-gradient(135deg,rgba(6,78,59,.96),rgba(16,185,129,.34))}.answer.wrong,.tile.wrong,.drop.wrong{border-color:var(--bad);background:linear-gradient(135deg,rgba(69,10,10,.96),rgba(239,68,68,.32))}.letter{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);color:#ffe8a3;margin-left:12px;flex:0 0 auto}.feedback{display:none;margin-top:18px;padding:15px 18px;border-radius:20px;font-size:24px;font-weight:900;text-align:center}.feedback.show{display:block}.feedback.ok{background:rgba(16,214,154,.15);border:1px solid rgba(16,214,154,.5);color:#bbf7d0}.feedback.bad{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.5);color:#fecaca}.next-zone{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:20px}.board{display:grid;grid-template-columns:1fr 1fr;gap:18px}.col{background:rgba(15,23,42,.6);border:1px solid var(--border);border-radius:26px;padding:16px}.col h3{margin:0 0 12px;color:#ffe8a3;font-size:24px}.row-match{display:grid;grid-template-columns:1fr 70px 1fr;gap:12px;align-items:center;margin-bottom:14px}.arrow{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:rgba(246,200,95,.14);border:2px solid rgba(246,200,95,.5);color:#ffe8a3;font-size:32px;font-weight:900}.drop{border-style:dashed;background:rgba(22,34,68,.78);color:#ffe8a3}.drop.filled{border-style:solid;background:rgba(6,78,59,.68);color:#dcfce7}.order-list{display:grid;gap:12px}.order-item{display:grid;grid-template-columns:70px 1fr 140px;gap:12px;align-items:center;background:rgba(15,23,42,.74);border:2px solid rgba(24,210,255,.24);border-radius:24px;padding:14px}.order-num{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--gold),var(--cyan));color:#051225;font-weight:900;font-size:24px}.order-text{font-size:var(--asize);font-weight:900;color:#fff9d8;line-height:1.55}.mini{width:58px;height:54px;border:0;border-radius:16px;background:linear-gradient(135deg,var(--gold),var(--cyan));font-weight:900;font-size:25px;cursor:pointer}.score{font-size:90px;color:var(--gold);font-weight:900}.stars{font-size:34px}.pill{display:inline-flex;align-items:center;gap:7px;background:rgba(15,23,42,.68);border:1px solid var(--border);border-radius:999px;padding:8px 13px;margin:5px;color:#e2e8f0;font-weight:900}.turn{margin:10px 0;padding:12px;border-radius:18px;background:rgba(246,200,95,.13);border:1px solid rgba(246,200,95,.28);font-weight:900;color:#fff7d7;text-align:center}.rank{display:grid;grid-template-columns:1fr 120px 120px;gap:10px;align-items:center;padding:14px;margin:10px 0;border-radius:20px;background:rgba(15,23,42,.72);border:1px solid var(--border);font-weight:900} .puzzle-reference{display:none}.puzzle-reference img{display:none}.puzzle-board{direction:ltr;--puzzleN:3;display:grid;grid-template-columns:repeat(var(--puzzleN),1fr);gap:10px;width:min(720px,94vw);margin:0 auto;background:linear-gradient(145deg,rgba(2,6,23,.68),rgba(15,23,42,.52));border:2px solid rgba(246,200,95,.28);border-radius:30px;padding:18px;box-shadow:0 22px 70px rgba(0,0,0,.28);overflow:visible;position:relative}.puzzle-board:before{content:"";position:absolute;inset:16px;border-radius:24px;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:calc(100%/var(--puzzleN)) calc(100%/var(--puzzleN));pointer-events:none}.puzzle-slot{position:relative;aspect-ratio:1/1;border-radius:22px;background:radial-gradient(circle at 35% 30%,rgba(24,210,255,.10),transparent 55%),rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.16);transition:.18s;overflow:visible}.puzzle-slot.correct-slot{background:radial-gradient(circle at 35% 30%,rgba(16,214,154,.16),transparent 56%),rgba(16,214,154,.05);border-color:rgba(16,214,154,.40)}.puzzle-slot.drag-target{background:radial-gradient(circle at 35% 30%,rgba(24,210,255,.20),transparent 56%),rgba(24,210,255,.08);border-color:rgba(24,210,255,.56);box-shadow:0 0 0 4px rgba(24,210,255,.10)}.puzzle-piece{appearance:none;border:0;background:none;cursor:grab;touch-action:none;user-select:none}.puzzle-piece.jigsaw-piece{position:absolute;inset:-16%;width:132%;height:132%;padding:0;border:0;background:none;box-shadow:none;overflow:visible;transition:transform .16s ease,opacity .16s ease}.puzzle-piece.jigsaw-piece:active{cursor:grabbing}.puzzle-piece.jigsaw-piece.selected{transform:scale(1.03)}.puzzle-piece.jigsaw-piece.snapped{transform:scale(1.01)}.puzzle-piece.dragging-source{opacity:.18}.puzzle-svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 16px 28px rgba(0,0,0,.35))}.piece-outline{fill:rgba(255,255,255,.04);stroke:rgba(246,200,95,.72);stroke-width:2.2;vector-effect:non-scaling-stroke}.puzzle-piece.selected .piece-outline,.puzzle-slot.drag-target .piece-outline{stroke:rgba(24,210,255,.96);stroke-width:2.8;filter:drop-shadow(0 0 10px rgba(24,210,255,.35))}.puzzle-piece.snapped .piece-outline,.puzzle-piece.correct .piece-outline,.puzzle-slot.correct-slot .piece-outline{stroke:rgba(16,214,154,.96);stroke-width:2.6;filter:drop-shadow(0 0 8px rgba(16,214,154,.35))}.puzzle-piece.wrong .piece-outline{stroke:rgba(239,68,68,.96);stroke-width:2.6}.drag-ghost{position:fixed;left:0;top:0;transform:translate(-50%,-50%) rotate(-2deg);pointer-events:none;z-index:9999;filter:drop-shadow(0 22px 34px rgba(0,0,0,.42))}.puzzle-tools{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}.puzzle-status.done{color:#bbf7d0;border-color:rgba(16,214,154,.45);background:rgba(16,214,154,.12);font-weight:900}@keyframes puzzleSnapPop{0%{transform:scale(.94)}60%{transform:scale(1.05)}100%{transform:scale(1)}}.puzzle-slot.snap-pop{animation:puzzleSnapPop .42s ease-out}.puzzle-board,.puzzle-slot,.puzzle-piece.jigsaw-piece,.puzzle-svg,.piece-outline{transition:all .28s ease}.puzzle-board.solved{gap:0;padding:10px;background:linear-gradient(145deg,rgba(2,6,23,.32),rgba(15,23,42,.18));border-color:rgba(16,214,154,.38)}.puzzle-board.solved:before{opacity:0}.puzzle-board.solved .puzzle-slot{border-color:transparent;background:transparent;border-radius:0}.puzzle-board.solved .puzzle-piece.jigsaw-piece{inset:-16%;width:132%;height:132%}.puzzle-board.solved .piece-outline{stroke:rgba(255,255,255,.42);filter:none}.puzzle-complete{margin-top:16px;padding-top:14px;border-top:1px dashed rgba(255,255,255,.16);text-align:center}.puzzle-complete-image{max-width:min(520px,100%);max-height:360px;object-fit:contain;border-radius:22px;border:1px solid rgba(255,255,255,.18);background:#fff;padding:6px;box-shadow:0 16px 36px rgba(0,0,0,.24)}.puzzle-solved-overlay{position:absolute;inset:10px;z-index:20;border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 18px 40px rgba(0,0,0,.22);animation:puzzleSolvedReveal .35s ease-out}.puzzle-solved-overlay img{width:100%;height:100%;display:block;object-fit:fill}.puzzle-board.solved .puzzle-slot,.puzzle-board.solved .puzzle-piece{opacity:0;pointer-events:none}@keyframes puzzleSolvedReveal{0%{transform:scale(.97);opacity:.35}100%{transform:scale(1);opacity:1}}@media(max-width:900px){.grid,.board{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.row-match{grid-template-columns:1fr}.arrow{margin:auto;transform:rotate(90deg)}.order-item{grid-template-columns:58px 1fr}.order-actions{grid-column:1/-1}.q{font-size:30px}.answer,.tile,.drop{font-size:25px}}`;
  const standaloneMobileCSS=`.class-pool{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;border:1px dashed rgba(246,200,95,.42);border-radius:24px;padding:16px;margin:14px 0}.class-card,.class-placed{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(255,255,255,.08);color:#fff7d6;font-weight:900;padding:12px 15px;min-width:110px;min-height:52px}.class-card.selected{outline:3px solid rgba(246,200,95,.65)}.class-card img,.class-placed img{width:54px;height:54px;object-fit:cover;border-radius:14px}.class-table{display:grid;grid-template-columns:repeat(var(--classCols,2),minmax(0,1fr));gap:14px;margin:14px 0}.class-drop{min-height:170px;border:2px dashed rgba(24,210,255,.38);border-radius:24px;padding:14px;background:rgba(15,23,42,.55)}.class-drop.drag-over{border-color:#18d2ff;background:rgba(24,210,255,.12)}.class-drop.correct{border-color:#22c55e;background:rgba(34,197,94,.1)}.class-drop.wrong{border-color:#ef4444;background:rgba(239,68,68,.1)}.class-drop h3{margin:0 0 10px;color:#ffe8a3;text-align:center}@media(max-width:860px){.class-table{grid-template-columns:1fr!important}.class-card,.class-placed{min-width:calc(50% - 8px)}}.standalone-mobile-fix{display:block}body,.wrap,.card,.q,.answer,.tile,.drop,.order-text,.feedback,.pill,.turn,.fixed-pair-board,.pair-target,.fixed-answer{max-width:100%;min-width:0;overflow-wrap:anywhere;word-break:break-word}body{overflow-x:hidden}@media(max-width:760px){.wrap{width:min(100%,96vw);padding:10px 0 24px}.top{gap:8px}.brand h1{font-size:18px}.brand small{font-size:9px;letter-spacing:.7px}.logo{width:44px;height:44px;font-size:26px}.card{padding:14px;border-radius:20px}.start h2{font-size:clamp(28px,9vw,38px)}.start p{font-size:16px}.stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.stat{padding:8px;border-radius:14px}.q{font-size:clamp(20px,6vw,28px)!important;line-height:1.6}.grid{grid-template-columns:1fr!important;gap:9px}.answer,.tile,.drop{font-size:clamp(17px,5vw,22px)!important;min-height:auto;padding:11px;border-radius:16px}.letter{width:34px;height:34px;margin-left:7px}.board{grid-template-columns:1fr!important}.row-match{grid-template-columns:1fr!important;gap:7px}.arrow{width:36px;height:36px;font-size:20px;margin:auto;transform:rotate(90deg)}.order-item{grid-template-columns:42px 1fr!important;padding:10px;gap:8px}.order-num{width:38px;height:38px;font-size:18px}.order-actions{grid-column:1/-1}.mini{width:44px;height:40px;font-size:20px}.fixed-pair-board{grid-template-columns:1fr!important;gap:18px;padding:10px;overflow:hidden}.fixed-pair-board .pair-lines{display:none!important}.mode-chooser{grid-template-columns:1fr}.btn{width:100%;font-size:17px;padding:11px 14px}.score{font-size:58px}.rank{grid-template-columns:1fr;gap:5px}.puzzle-board{width:min(100%,94vw);padding:10px;gap:5px;border-radius:20px}}@media(max-width:420px){.stats{grid-template-columns:1fr}.q{font-size:22px!important}.answer,.tile,.drop,.order-text{font-size:18px!important}}`;
  const runtime=function(DATA){
    var game=DATA.game||{},platform=DATA.platform||{},questions=(game.questions||[]).slice(),i=0,score=0,correct=0,name='',startedAt=0,locked=false,tries=0,selectedAnswer='',matchState={},pairOptions=[],orderState=[],puzzleOrder=[],selectedPuzzle=null,set=[],players=[],playMode=game.mode||'individual';
    function qs(s){return document.querySelector(s)} function qsa(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
    function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]})} function attr(s){return esc(s).replace(/'/g,'&#39;')}
    function shuffle(a){a=(a||[]).slice();for(var j=a.length-1;j>0;j--){var k=Math.floor(Math.random()*(j+1)),t=a[j];a[j]=a[k];a[k]=t}return a}
    function norm(s){return String(s||'').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim().toLowerCase()}
    function gnum(){for(var a=0;a<arguments.length;a++){var n=Number(arguments[a]);if(isFinite(n)&&n>0)return n}return 0}
    function mode(){return playMode||game.mode||'individual'} function attempts(q){return Math.max(1,Number(q.attempts||1)||1)} function totalPts(){return set.reduce(function(a,q){return a+Number(q.points||10)},0)||1}
    function tone(ok){try{if(game.enable_sound===false)return;var A=window.AudioContext||window.webkitAudioContext,c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=ok==='bad'?220:720;o.type=ok==='bad'?'sawtooth':'sine';g.gain.value=.07;o.connect(g);g.connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.22);o.stop(c.currentTime+.24)}catch(e){}}
    function gender(){return String(game.audience_gender||'female').toLowerCase()==='male'?'male':'female'} function ph(k){var m=gender()==='male';var d={first:m?'اسم الطالب الأول':'اسم الطالبة الأولى',second:m?'اسم الطالب الثاني':'اسم الطالبة الثانية',placeholder:m?'اكتب اسمك هنا':'اكتبي اسمك هنا',label:m?'الطالب':'الطالبة',try:m?'حاول مرة أخرى':'حاولي مرة أخرى',good:m?'أحسنت يا بطل':'أحسنتِ يا بطلة',bad:m?'لا بأس، حاول من جديد':'لا بأس، حاولي من جديد',celebrate:m?'أحسنت يا بطل! 🎉':'أحسنتِ يا بطلة! 🎉',piecePlaced:m?'ممتاز! ركبت القطعة في مكانها الصحيح':'ممتاز! ركبتِ القطعة في مكانها الصحيح',puzzleDone:'رائع جدًا! اكتمل البازل بنجاح',puzzleHelp:m?'اسحب كل قطعة بالماوس أو اللمس إلى المكان المناسب. عند الإفلات ستثبت القطعة في مكانها الصحيح بتأثير بصري واضح، ولن تظهر الصورة الكاملة إلا بعد اكتمال التجميع.':'اسحبي كل قطعة بالماوس أو اللمس إلى المكان المناسب. عند الإفلات ستثبت القطعة في مكانها الصحيح بتأثير بصري واضح، ولن تظهر الصورة الكاملة إلا بعد اكتمال التجميع.',matchingHelp:m?'اسحب مستطيل الإجابة من جهة الإجابات، وضعه أمام العبارة المناسبة. ويمكنك أيضًا الضغط على الإجابة ثم الضغط على المكان المناسب لها.':'اسحبي مستطيل الإجابة من جهة الإجابات، وضعيه أمام العبارة المناسبة. ويمكنك أيضًا الضغط على الإجابة ثم الضغط على المكان المناسب لها.',connectingHelp:m?'اختر الإجابة أولًا، ثم اضغط على السؤال المناسب. ستبقى الإجابة في مكانها والسؤال في مكانه، وسيظهر خط واضح بينهما.':'اختاري الإجابة أولًا، ثم اضغطي على السؤال المناسب. ستبقى الإجابة في مكانها والسؤال في مكانه، وسيظهر خط واضح بينهما.',dropHere:m?'اسحب الإجابة هنا':'اسحبي الإجابة هنا',clickAfterAnswer:m?'اضغط هنا بعد اختيار الإجابة':'اضغطي هنا بعد اختيار الإجابة',connectedTo:'متصل بـ: ',changeAnswer:m?'اضغط على إجابة أخرى للتغيير':'اضغطي على إجابة أخرى للتغيير',individualDesc:m?'لعب طالب واحد':'لعب طالبة واحدة',competitionDesc:m?'منافسة بين طالبين':'منافسة بين طالبتين',individualPill:'لعب فردي',competitionPill:m?'منافسة بين طالبين':'منافسة بين طالبتين',openPlaceholder:m?'اكتب الإجابة هنا':'اكتبي الإجابة هنا',openHelp:m?'اكتب الإجابة في المربع ثم اضغط تحقق.':'اكتبي الإجابة في المربع ثم اضغطي تحقق.',orderHelp:m?'رتب العناصر باستخدام أزرار ↑ و ↓':'رتّبي العناصر باستخدام أزرار ↑ و ↓',completeVerb:m?'لإكماله':'لإكمالها'};return d[k]||k} function gx(t){var s=String(t==null?'':t),m=gender()==='male',pairs=m?[["الطالبات","الطلاب"],["الطالبتان","الطالبان"],["الطالبة","الطالب"],["أحسنتِ","أحسنت"],["ممتازة","ممتاز"],["رائعة","رائع"],["بطلة","بطل"],["حاولي","حاول"],["راجعي","راجع"],["واصلي","واصل"],["اختاري","اختر"],["اضغطي","اضغط"],["اسحبي","اسحب"],["ضعي","ضع"],["اكتبي","اكتب"],["رتّبي","رتب"],["ستتقدمين","ستتقدم"],["لإكمالها","لإكماله"]]:[["الطلاب","الطالبات"],["الطالبان","الطالبتان"],["الطالب","الطالبة"],["أحسنت يا بطل","أحسنتِ يا بطلة"],["أحسنت","أحسنتِ"],["ممتاز!","ممتازة!"],["رائع","رائعة"],["بطل","بطلة"],["حاول مرة أخرى","حاولي مرة أخرى"],["حاول","حاولي"],["راجع","راجعي"],["واصل","واصلي"],["اختر","اختاري"],["اضغط","اضغطي"],["اسحب","اسحبي"],["ضع","ضعي"],["اكتب","اكتبي"],["رتب","رتّبي"],["ستتقدم","ستتقدمين"],["لإكماله","لإكمالها"]];pairs.forEach(function(p){s=s.split(p[0]).join(p[1])});
var vm=[["أَحْسَنْتِ","أَحْسَنْتَ"],["مُمْتَازَةٌ","مُمْتَازٌ"],["رائِعَةٌ","رائِعٌ"],["اخْتِيارُكِ","اخْتِيارُكَ"],["أَبْدَعْتِ","أَبْدَعْتَ"],["بَطَلَة","بَطَل"],["حاوِلِي","حاوِلْ"],["راجِعِي","راجِعْ"],["فَكِّرِي","فَكِّرْ"],["واصِلِي","واصِلْ"]],vf=[["أَحْسَنْتَ","أَحْسَنْتِ"],["مُمْتَازٌ","مُمْتَازَةٌ"],["رائِعٌ","رائِعَةٌ"],["اخْتِيارُكَ","اخْتِيارُكِ"],["أَبْدَعْتَ","أَبْدَعْتِ"],["بَطَل","بَطَلَة"],["حاوِلْ","حاوِلِي"],["راجِعْ","راجِعِي"],["فَكِّرْ","فَكِّرِي"],["واصِلْ","واصِلِي"]];
(m?vm:vf).forEach(function(p){s=s.split(p[0]).join(p[1])});return s}
    function pickVoice(arr,fallback){return Array.isArray(arr)&&arr.length?String(arr[Math.floor(Math.random()*arr.length)]||fallback):fallback} function voiceList(kind){var m=gender()==='male';if(kind==='ok')return m?['أَحْسَنْتَ، إِجَابَةٌ صَحِيحَة.','مُمْتَازٌ، واصِلِ التَّقَدُّم.','رائِعٌ، اخْتِيارُكَ صَحِيح.','أَبْدَعْتَ يا بَطَل.']:['أَحْسَنْتِ، إِجَابَةٌ صَحِيحَة.','مُمْتَازَةٌ، واصِلِي التَّقَدُّم.','رائِعَةٌ، اخْتِيارُكِ صَحِيح.','أَبْدَعْتِ يا بَطَلَة.'];if(kind==='bad')return m?['لا بَأْسَ، حاوِلْ مَرَّةً أُخْرَى.','إِجَابَةٌ غَيْرُ صَحِيحَة، راجِعِ السُّؤال.','اقْتَرَبْتَ مِنَ الصَّواب، فَكِّرْ قَلِيلًا.']:['لا بَأْسَ، حاوِلِي مَرَّةً أُخْرَى.','إِجَابَةٌ غَيْرُ صَحِيحَة، راجِعِي السُّؤال.','اقْتَرَبْتِ مِنَ الصَّواب، فَكِّرِي قَلِيلًا.'];return m?['رائع جدًا! اكتمل البازل بنجاح.','أحسنت، اكتملت الصورة بشكل صحيح.']:['رائع جدًا! اكتمل البازل بنجاح.','أحسنتِ، اكتملت الصورة بشكل صحيح.']}function speak(ok){try{if(game.enable_sound===false||!('speechSynthesis' in window))return;var kind=ok==='ok'?'ok':(ok==='puzzle'?'puzzle':'bad');var list=voiceList(kind==='puzzle'?'puzzle':kind);var text=pickVoice(list,kind==='ok'?ph('good'):(kind==='puzzle'?ph('puzzleDone'):ph('bad')));var u=new SpeechSynthesisUtterance(gx(text));u.lang='ar-SA';u.pitch=gender()==='female'?1.35:.84;u.rate=gender()==='female'?.92:.88;window.speechSynthesis.cancel();window.speechSynthesis.speak(u)}catch(e){}}
    function rosterOptions(){return (game.students||[]).filter(Boolean).map(function(n){return '<option value="'+attr(n)+'">'+esc(n)+'</option>'}).join('')}
    function studentInputs(comp){var opts=rosterOptions();if(comp){return opts?'<select id="s1" class="input"><option value="">'+ph('first')+'</option>'+opts+'</select><select id="s2" class="input"><option value="">'+ph('second')+'</option>'+opts+'</select><input id="n1" class="input" placeholder="'+ph('first')+' يدويًا"><input id="n2" class="input" placeholder="'+ph('second')+' يدويًا">':'<input id="n1" class="input" placeholder="'+ph('first')+'"><input id="n2" class="input" placeholder="'+ph('second')+'">'}return opts?'<select id="studentSelect" class="input"><option value="">اختيار '+ph('label')+'</option>'+opts+'</select><input id="studentName" class="input" placeholder="أو '+ph('placeholder')+' يدويًا">':'<input id="studentName" class="input" placeholder="'+ph('placeholder')+'">'}
    function burst(){if(game.enable_fx===false)return;var layer=document.createElement('div');layer.className='celebration-layer';var banner=document.createElement('div');banner.className='celebration-banner';banner.textContent=gx(game.celebrationMsg||ph('celebrate'));layer.appendChild(banner);var colors=['#facc15','#38bdf8','#fb7185','#22c55e','#a78bfa','#fff'];for(var n=0;n<80;n++){var sp=document.createElement('span'),t=n%7;sp.className=t<4?'celebration-piece':(t<6?'celebration-streamer':'celebration-star');sp.textContent=t===6?['⭐','✨','🏆','🎉'][n%4]:'';sp.style.left=(Math.random()*100)+'vw';sp.style.top=(-20-Math.random()*80)+'px';sp.style.setProperty('--piece-color',colors[n%colors.length]);sp.style.setProperty('--dx',(Math.random()*360-180)+'px');sp.style.setProperty('--dy',(-80-Math.random()*260)+'px');sp.style.setProperty('--rot',(Math.random()*960-480)+'deg');sp.style.setProperty('--dur',(1050+Math.random()*950)+'ms');layer.appendChild(sp)}document.body.appendChild(layer);setTimeout(function(){layer.remove()},1900)}
    function buildSet(){var qs0=questions.slice();if(game.shuffle_questions!==false)qs0=shuffle(qs0);if(mode()==='competition'){players=[{name:((document.getElementById('s1')||{}).value||(document.getElementById('n1')||{}).value||ph('first')),score:0,correct:0},{name:((document.getElementById('s2')||{}).value||(document.getElementById('n2')||{}).value||ph('second')),score:0,correct:0}];var count=gnum(game.competition_question_count,game.competitionQuestionCount,5)||5;var groups={};qs0.forEach(function(q){(groups[q.type]||(groups[q.type]=[])).push(q)});var types=Object.keys(groups);set=[];for(var r=0;r<count;r++){var t=types[r%types.length];for(var p=0;p<2;p++){var pool=groups[t]||qs0;if(pool.length){var q=JSON.parse(JSON.stringify(pool[Math.floor(Math.random()*pool.length)]));q.playerIndex=p;set.push(q)}}}}else{var count2=gnum(game.individual_question_count,game.question_count,questions.length)||questions.length;set=qs0.slice(0,count2)}}
    function header(){var q=set[i]||{},p=mode()==='competition'?players[q.playerIndex||0]:null;var elapsed=Math.floor((Date.now()-startedAt)/1000);return '<div class="top"><div class="brand"><div class="logo">🎮</div><div><h1>'+esc(game.title||'لعبة تعليمية')+'</h1><small>'+esc(platform.brandName||'منارة التعلم الرقمي')+'</small></div></div><button class="btn dark" onclick="toggleFull()">⛶ ملء الشاشة</button></div><div class="progress-wrap"><div class="progress" style="width:'+(i/Math.max(1,set.length)*100)+'%"></div></div><div class="stats"><div class="stat"><span>السؤال</span><b>'+(Math.min(i+1,set.length))+' / '+set.length+'</b></div><div class="stat"><span>الدرجة</span><b>'+score+'</b></div><div class="stat"><span>الوقت</span><b>'+elapsed+' ث</b></div><div class="stat"><span>'+(p?'الدور':'الاسم')+'</span><b>'+esc(p?p.name:name)+'</b></div></div>'}
    function modeChooser(comp){return '<div class="mode-chooser"><button class="mode-card '+(!comp?'active':'')+'" onclick="chooseMode(\'individual\')"><b>👤 فردي</b><span>'+ph('individualDesc')+'</span></button><button class="mode-card '+(comp?'active':'')+'" onclick="chooseMode(\'competition\')"><b>⚔️ منافسة</b><span>'+ph('competitionDesc')+'</span></button></div>'} function startScreen(){var comp=mode()==='competition';document.getElementById('app').innerHTML='<section class="start"><div class="card"><div class="logo" style="margin:auto">🎮</div><h2>'+esc(game.title||'لعبة تعليمية')+'</h2><p>'+esc(gx(game.description||'استعد لتجربة تعليمية ممتعة'))+'</p>'+(game.coverImage?'<img class="hero-cover" src="'+attr(game.coverImage)+'" alt="صورة اللعبة">':'')+'<div><span class="pill">'+(comp?ph('competitionPill'):ph('individualPill'))+'</span><span class="pill">'+questions.length+' سؤال</span></div>'+modeChooser(comp)+studentInputs(comp)+'<div class="next-zone"><button class="btn" onclick="startGame()">'+esc(gx(game.startButton||'ابدأ اللعبة'))+' ⭐</button><button class="btn dark" onclick="toggleFull()">⛶ ملء الشاشة</button></div></div></section>'}
    function startGame(){name=((qs('#studentSelect')||{}).value||(qs('#studentName')||{}).value)||gx(game.student_label)||ph('label');startedAt=Date.now();i=0;score=0;correct=0;buildSet();showQuestion()}
    function base(q,body){locked=false;tries=0;selectedAnswer='';matchState={};pairOptions=[];document.getElementById('app').innerHTML=header()+'<section class="card"><div class="type">'+esc(typeName(q.type))+'</div><span class="pill">المحاولات: <b id="tryBox">0</b> / '+attempts(q)+'</span>'+(mode()==='competition'?'<div class="turn">🎯 الدور الآن: '+esc(players[q.playerIndex||0].name)+'</div>':'')+'<div class="q">'+esc((q.emoji||'')+' '+gx(q.text))+'</div>'+body+'<div id="feedback" class="feedback"></div><div class="next-zone"><button id="nextBtn" class="btn" style="display:none" onclick="nextQuestion()">السؤال التالي ⬅</button><button class="btn dark" onclick="toggleFull()">⛶ ملء الشاشة</button></div></section>';setTimeout(drawPairLines,40)}
    function typeName(t){return{multiple_choice:'اختيار من متعدد',true_false:'صح أو خطأ',matching:'مطابقة',connecting:'توصيل',ordering:'ترتيب',classification:'تصنيف',open_text:'نص مفتوح',short_answer:'نص مفتوح',puzzle_image:'بازل صورة'}[t]||'سؤال'}
    function showQuestion(){if(i>=set.length)return endScreen();var q=set[i],body='';if(q.type==='multiple_choice'||q.type==='true_false'){var opts=(game.shuffle_options!==false?shuffle((q.options||[]).map(function(o,idx){return{o:o,idx:idx}})):(q.options||[]).map(function(o,idx){return{o:o,idx:idx}}));body='<div class="grid">'+opts.map(function(x,n){return '<button class="answer" data-idx="'+x.idx+'" onclick="answerChoice('+x.idx+',this)"><span class="letter">'+(['أ','ب','ج','د','هـ'][n]||n+1)+'</span>'+esc(gx(x.o))+'</button>'}).join('')+'</div>'}else if(q.type==='open_text'||q.type==='short_answer'){body='<textarea id="openAnswer" class="input" placeholder="'+ph('openPlaceholder')+'"></textarea>'+((q.manual_grade!==false)?'<div class="manual-grade-panel"><button class="btn" onclick="answerOpen(true)">✅ الإجابة صحيحة</button><button class="btn bad" onclick="answerOpen(false)">❌ الإجابة خاطئة</button></div>':'<div class="next-zone"><button class="btn" onclick="answerOpen()">تحقق</button></div>')}else if(q.type==='ordering'){orderState=shuffle(q.items||[]);body='<p class="pill">'+ph('orderHelp')+'</p><div id="orderList" class="order-list"></div><div class="next-zone"><button class="btn" onclick="answerOrder()">تثبيت الترتيب</button></div>'}else if(q.type==='classification'){body=renderClass(q)}else if(q.type==='puzzle_image'){body=renderPuzzle(q)}else body=renderPairs(q);base(q,body);if(q.type==='ordering')renderOrder();if(q.type==='puzzle_image')drawPuzzle(q)}
    function answerChoice(idx,btn){if(locked)return;var q=set[i],good=Number(idx)===Number(q.correct);showResult(good,btn,idx)}
    function answerOpen(manual){if(locked)return;var q=set[i],val=(qs('#openAnswer')||{}).value||'',arr=(q.answers||q.accepted||[]);if(typeof manual==='boolean')return showResult(!!manual,null,{__manualOpen:true,text:val,good:!!manual});showResult(arr.length?arr.some(function(a){return norm(a)===norm(val)}):!!val,null,val)}
    function retryAttempt(){var keep=tries;locked=false;selectedAnswer='';matchState={};pairOptions=[];classState={};classItems=[];selectedClass='';showQuestion();tries=keep;var tb=qs('#tryBox');if(tb)tb.textContent=tries}function showResult(good,btn,val){var q=set[i];tries++;var tb=qs('#tryBox');if(tb)tb.textContent=tries;var canRetry=!good&&!(val&&val.__classification)&&!(val&&val.__manualOpen)&&game.allow_retry!==false&&game.show_retry_button!==false&&tries<attempts(q);if(canRetry){locked=true;tone('bad');if(btn){btn.classList.add('wrong');btn.disabled=true}qsa('.answer,.tile,.drop,.mini,.class-card,.class-drop').forEach(function(x){x.style.pointerEvents='none';if('disabled' in x)x.disabled=true});var fb=qs('#feedback');fb.className='feedback show bad';fb.innerHTML='' + ph('try') + '. المتبقي: '+(attempts(q)-tries)+'<div class="retry-zone"><button class="btn retry-button" onclick="retryAttempt()">إعادة المحاولة</button></div>';return}locked=true;var partial=val&&val.__classification;var earned=partial?Number(val.__partialPoints||0):Number(q.points||10);if(good||partial){score+=earned;if(good)correct++;if(mode()==='competition'){var p=players[q.playerIndex||0];p.score+=earned;if(good)p.correct++}if(good){if(q.type==='puzzle_image'){tone('finish');speak('puzzle');burst()}else{tone('ok');speak('ok');burst()}}else{tone(earned>0?'ok':'bad');speak(earned>0?'ok':'bad')}}else{tone('bad');speak('bad');}if(btn)btn.classList.add(good?'correct':'wrong');qsa('.answer').forEach(function(b){b.disabled=true;if(Number(b.dataset.idx)===Number(q.correct))b.classList.add('correct')});var fb=qs('#feedback');fb.className='feedback show '+(good?'ok':'bad');var classExtra=(val&&val.__classificationSummary)?'<br><small>'+esc(val.__classificationSummary)+'</small>':'';fb.innerHTML=good?(esc(gx(q.type==='puzzle_image'?(game.puzzleCompleteText||ph('puzzleDone')):(game.correctMsg||'إجابة صحيحة 🎉')))+classExtra+(q.type==='puzzle_image'?'<div class="puzzle-complete"><div class="puzzle-complete-label">الصورة بعد اكتمال التجميع</div><img src="'+attr(q.image)+'" class="puzzle-complete-image"></div>':'')):(val&&val.__classification?esc('تم تثبيت التصنيف مع احتساب الدرجة الجزئية')+classExtra:esc(gx(game.wrongMsg||'إجابة غير صحيحة'))+classExtra+((!good&&game.show_answer!==false)?'<br><small>الإجابة الصحيحة: '+esc(correctSummary(q))+'</small>':'')+(q.explanation?'<br><small>'+esc(gx(q.explanation))+'</small>':''));qs('#nextBtn').style.display='inline-block'}
    function puzzleStatusText(txt,done){var el=qs('#puzzleStatusText');if(el){el.textContent=txt;el.classList[done?'add':'remove']('done')}} function onPuzzlePlacement(correctNow){if(game.enable_sound!==false)tone(correctNow?'ok':'click'); if(correctNow)puzzleStatusText(gx(ph('piecePlaced')),false)} function checkPuzzleSolvedFx(){if(window.__puzzleSolvedFx)return;var solved=puzzleOrder.every(function(v,idx){return Number(v)===idx}); if(!solved)return; window.__puzzleSolvedFx=true; puzzleStatusText(gx(game.puzzleCompleteText||ph('puzzleDone')),true); if(game.enable_sound!==false){tone('finish'); speak('puzzle')} burst()} function applyPuzzleSwap(a,b){var beforeA=puzzleOrder[a]===a,beforeB=puzzleOrder[b]===b; var t=puzzleOrder[a]; puzzleOrder[a]=puzzleOrder[b]; puzzleOrder[b]=t; var afterA=puzzleOrder[a]===a,afterB=puzzleOrder[b]===b; var gained=(afterA&&!beforeA)||(afterB&&!beforeB); selectedPuzzle=null; drawPuzzle(set[i]); var target=qs('.puzzle-piece[data-pos="'+b+'"]')||qs('.puzzle-piece[data-pos="'+a+'"]'); if(target){target.classList.add('snap-pop'); setTimeout(function(){target.classList.remove('snap-pop')},450)} onPuzzlePlacement(gained); checkPuzzleSolvedFx()} function renderPuzzle(q){var n=Math.max(2,Math.min(5,Number(q.puzzle_grid||3)||3));var total=n*n;puzzleOrder=shuffle(Array.from({length:total},function(_,x){return x}));if(puzzleOrder.every(function(v,idx){return v===idx})&&total>1){var a=0,b=1,t=puzzleOrder[a];puzzleOrder[a]=puzzleOrder[b];puzzleOrder[b]=t}selectedPuzzle=null;window.__puzzleSolvedFx=false;return '<div class="puzzle-area"><p class="pill puzzle-status" id="puzzleStatusText">'+ph('puzzleHelp')+'</p><div id="puzzleBoard" class="puzzle-board jigsaw-board" dir="ltr" style="--puzzleN:'+n+'"></div><div class="puzzle-tools"><button class="btn dark" onclick="shufflePuzzle()">خلط القطع</button><button class="btn" onclick="answerPuzzle()">تحقق من البازل</button></div></div>'}
    function puzzleStatusText(txt,done){var el=qs('#puzzleStatusText');if(el){el.textContent=txt;el.classList[done?'add':'remove']('done')}}
    function buildPuzzleEdges(n){var key='edges_'+n;if(window[key])return window[key];var edges=new Array(n*n);function sign(r,c,k){return ((r*7+c*11+(k==='h'?3:5))%2===0?1:-1)}for(var r=0;r<n;r++){for(var c=0;c<n;c++){var idx=r*n+c;var top=r===0?0:-edges[(r-1)*n+c].bottom;var left=c===0?0:-edges[idx-1].right;var right=c===n-1?0:sign(r,c,'h');var bottom=r===n-1?0:sign(r,c,'v');edges[idx]={top:top,right:right,bottom:bottom,left:left}}}window[key]=edges;return edges}
    function piecePath(e){var tab=18,s1=30,s2=70,d='M 0 0 ';if(e.top===0){d+='L 100 0 '}else{var y=e.top===1?-tab:tab;d+='L '+s1+' 0 C 38 0 38 '+(y*.35)+' 44 '+(y*.7)+' C 48 '+y+' 52 '+y+' 56 '+(y*.7)+' C 62 '+(y*.35)+' 62 0 '+s2+' 0 L 100 0 '}if(e.right===0){d+='L 100 100 '}else{var x=e.right===1?100+tab:100-tab;var c=e.right===1?100+tab*1.1:100-tab*1.1;d+='L 100 '+s1+' C 100 38 '+(x*.98)+' 38 '+x+' 44 C '+c+' 48 '+c+' 52 '+x+' 56 C '+(x*.98)+' 62 100 62 100 '+s2+' L 100 100 '}if(e.bottom===0){d+='L 0 100 '}else{var y2=e.bottom===1?100+tab:100-tab;var c2=e.bottom===1?100+tab*1.1:100-tab*1.1;d+='L '+s2+' 100 C 62 100 62 '+(y2*.98)+' 56 '+y2+' C 52 '+c2+' 48 '+c2+' 44 '+y2+' C 38 '+(y2*.98)+' 38 100 '+s1+' 100 L 0 100 '}if(e.left===0){d+='L 0 0 '}else{var x2=e.left===1?-tab:tab;var c3=e.left===1?-tab*1.1:tab*1.1;d+='L 0 '+s2+' C 0 62 '+(x2*.98)+' 62 '+x2+' 56 C '+c3+' 52 '+c3+' 48 '+x2+' 44 C '+(x2*.98)+' 38 0 38 0 '+s1+' L 0 0 '}return d+'Z'}
    function renderPuzzleSvg(q,tile,pos,n){var r=Math.floor(tile/n),c=tile%n,edges=buildPuzzleEdges(n)[tile]||{top:0,right:0,bottom:0,left:0},path=piecePath(edges),id='pz_'+i+'_'+pos+'_'+tile+'_'+n;return '<svg class="puzzle-svg" viewBox="-22 -22 144 144" aria-hidden="true"><defs><clipPath id="clip_'+id+'"><path d="'+path+'"></path></clipPath></defs><g clip-path="url(#clip_'+id+')"><image href="'+attr(q.image)+'" x="'+(-c*100)+'" y="'+(-r*100)+'" width="'+(n*100)+'" height="'+(n*100)+'" preserveAspectRatio="none"></image><rect x="-22" y="-22" width="144" height="144" fill="rgba(255,255,255,.06)"></rect></g><path class="piece-outline" d="'+path+'"></path></svg>'}
    function drawPuzzle(q){var n=Math.max(2,Math.min(5,Number(q.puzzle_grid||3)||3)),board=qs('#puzzleBoard');if(!board)return;var solved=puzzleOrder.every(function(v,idx){return Number(v)===idx});board.style.setProperty('--puzzleN',n);board.classList[solved?'add':'remove']('solved');var pieces=puzzleOrder.map(function(tile,pos){return '<div class="puzzle-slot '+(tile===pos?'correct-slot':'')+'" data-pos="'+pos+'"><button type="button" class="puzzle-piece jigsaw-piece '+(selectedPuzzle===pos?'selected ':'')+(tile===pos?'snapped':'')+'" data-pos="'+pos+'" data-tile="'+tile+'" aria-label="قطعة بازل '+(pos+1)+'">'+renderPuzzleSvg(q,tile,pos,n)+'</button></div>'}).join('');var overlay=solved?'<div class="puzzle-solved-overlay"><img src="'+attr(q.image)+'" alt="الصورة المكتملة"></div>':'';board.innerHTML=overlay+pieces;attachPuzzleDrag()}
    
function onPuzzlePlacement(correctNow){if(game.enable_sound!==false)tone(correctNow?'ok':'click');if(correctNow)puzzleStatusText(gx(ph('piecePlaced')),false)}
    function checkPuzzleSolvedFx(){if(window.__puzzleSolvedFx)return;var solved=puzzleOrder.every(function(v,idx){return Number(v)===idx});if(!solved)return;window.__puzzleSolvedFx=true;drawPuzzle(set[i]);puzzleStatusText(gx(game.puzzleCompleteText||ph('puzzleDone')),true);if(game.enable_sound!==false){tone('finish');speak('puzzle')}burst()}
    function applyPuzzleSwap(a,b){var beforeA=puzzleOrder[a]===a,beforeB=puzzleOrder[b]===b,t=puzzleOrder[a];puzzleOrder[a]=puzzleOrder[b];puzzleOrder[b]=t;var afterA=puzzleOrder[a]===a,afterB=puzzleOrder[b]===b,gained=(afterA&&!beforeA)||(afterB&&!beforeB);selectedPuzzle=null;drawPuzzle(set[i]);var target=qs('.puzzle-slot[data-pos="'+b+'"]')||qs('.puzzle-slot[data-pos="'+a+'"]');if(target){target.classList.add('snap-pop');setTimeout(function(){target.classList.remove('snap-pop')},420)}onPuzzlePlacement(gained);checkPuzzleSolvedFx()}
    function selectPuzzle(pos){if(locked)return;if(selectedPuzzle===null){selectedPuzzle=pos;drawPuzzle(set[i]);return}if(selectedPuzzle===pos){selectedPuzzle=null;drawPuzzle(set[i]);return}applyPuzzleSwap(selectedPuzzle,pos)}
    function shufflePuzzle(){puzzleOrder=shuffle(puzzleOrder);selectedPuzzle=null;window.__puzzleSolvedFx=false;puzzleStatusText(ph('puzzleHelp'),false);drawPuzzle(set[i]);if(game.enable_sound!==false)tone('click')}
    function answerPuzzle(){if(locked)return;var good=puzzleOrder.every(function(v,idx){return v===idx});qsa('.puzzle-piece').forEach(function(el,idx){el.classList.add(puzzleOrder[idx]===idx?'correct':'wrong')});showResult(good,null,puzzleOrder)}
    function clearPuzzleTargets(){qsa('.puzzle-slot.drag-target').forEach(function(el){el.classList.remove('drag-target')})}
    function slotFromPoint(x,y){var el=document.elementFromPoint(x,y);return el?el.closest('.puzzle-slot'):null}
    function attachPuzzleDrag(){qsa('.puzzle-piece').forEach(function(piece){piece.onpointerdown=function(e){if(locked)return;if(e.button!==undefined&&e.button!==0)return;e.preventDefault();var from=Number(piece.dataset.pos),rect=piece.getBoundingClientRect(),ghost=piece.cloneNode(true),drag={from:from,piece:piece,ghost:ghost,startX:e.clientX,startY:e.clientY,moved:false};ghost.classList.add('drag-ghost');ghost.style.width=rect.width+'px';ghost.style.height=rect.height+'px';ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';document.body.appendChild(ghost);piece.classList.add('dragging-source');var move=function(ev){ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px';if(Math.abs(ev.clientX-drag.startX)>6||Math.abs(ev.clientY-drag.startY)>6)drag.moved=true;clearPuzzleTargets();var slot=slotFromPoint(ev.clientX,ev.clientY);if(slot)slot.classList.add('drag-target')};var end=function(ev){window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);clearPuzzleTargets();piece.classList.remove('dragging-source');ghost.remove();if(!drag.moved){selectPuzzle(from);return}var slot=slotFromPoint(ev.clientX,ev.clientY);if(slot){var to=Number(slot.dataset.pos);if(Number.isFinite(to)&&to!==from){applyPuzzleSwap(from,to);return}}if(game.enable_sound!==false)tone('click')};window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true})}})}
    function classItemHTML(it){
      it=it||{};
      var kind=(it.kind==='image'||(!it.text&&!!it.image))?'image':'text';
      if(kind==='image'&&it.image)return '<span class="class-media"><img src="'+attr(it.image)+'" alt=""></span>';
      return '<span>'+esc(gx(it.text||''))+'</span>'
    }
    function ensureClass(q){
      var cats=q.categories||[],all=[];
      cats.forEach(function(c,ci){(c.items||[]).forEach(function(it,ii){all.push({id:ci+':'+ii,cat:ci,kind:it.kind||((!it.text&&it.image)?'image':'text'),text:it.text||'',image:it.image||''})})});
      if(!classItems.length||classItems.length!==all.length)classItems=shuffle(all);
      if(!Object.keys(classState).length)cats.forEach(function(_,ci){classState[ci]=[]})
    }
    function renderClass(q){
      ensureClass(q);
      var cats=q.categories||[],placed=[];
      Object.keys(classState).forEach(function(k){placed=placed.concat(classState[k]||[])});
      var pool=classItems.filter(function(it){return placed.indexOf(it.id)<0}),cols=Math.max(2,Math.min(4,Number(q.column_count||cats.length)||cats.length||2));
      return '<p class="pill class-help-pill">اسحب العناصر النصية أو المصورة إلى العمود المناسب في جدول التصنيف.</p><div class="class-pool">'+(pool.length?pool.map(function(it){return '<button class="class-card '+(selectedClass===it.id?'selected':'')+'" draggable="true" data-id="'+attr(it.id)+'" onclick="selectClass(this.dataset.id)" ondragstart="dragClass(event,this.dataset.id)">'+classItemHTML(it)+'</button>'}).join(''):'<span class="pill">تم وضع كل العناصر في الجدول</span>')+'</div><div class="class-table polished-class-table" style="--classCols:'+cols+'">'+cats.map(function(c,ci){var ids=classState[ci]||[];return '<div class="class-drop" data-col="'+ci+'" onclick="placeClass('+ci+')" ondragover="event.preventDefault();this.classList.add(\x27drag-over\x27)" ondragleave="this.classList.remove(\x27drag-over\x27)" ondrop="dropClass(event,'+ci+')"><div class="class-drop-head"><h3>'+esc(gx(c.title))+'</h3></div><div class="class-drop-zone">'+(ids.length?ids.map(function(id){var it=classItems.filter(function(x){return x.id===id})[0]||{};return '<span class="class-placed-card" data-id="'+attr(id)+'">'+classItemHTML(it)+'</span>'}).join(''):'<span class="class-drop-placeholder">'+ph('dropHere')+'</span>')+'</div></div>'}).join('')+'</div><div class="next-zone"><button class="btn" onclick="answerClass()">تثبيت التصنيف</button></div>'
    }
    function selectClass(id){selectedClass=id;qsa('.class-card').forEach(function(x){x.classList.toggle('selected',x.dataset.id===id)});tone('click')}
    function dragClass(ev,id){selectedClass=id;try{ev.dataTransfer.setData('text/plain',id)}catch(e){}tone('click')}
    function placeClass(ci){if(!selectedClass)return;Object.keys(classState).forEach(function(k){classState[k]=(classState[k]||[]).filter(function(id){return id!==selectedClass})});classState[ci]=classState[ci]||[];classState[ci].push(selectedClass);showQuestion();tone('click')}
    function dropClass(ev,ci){ev.preventDefault();try{selectedClass=ev.dataTransfer.getData('text/plain')||selectedClass}catch(e){}placeClass(ci)}
    function answerClass(){
      if(locked)return;
      var q=set[i],cats=q.categories||[],total=0,placed=[];
      cats.forEach(function(c){total+=(c.items||[]).length});
      Object.keys(classState).forEach(function(k){placed=placed.concat(classState[k]||[])});
      var correctPlaced=0,wrongPlaced=0;
      Object.keys(classState).forEach(function(k){(classState[k]||[]).forEach(function(id){if(String(id).split(':')[0]===String(k))correctPlaced++;else wrongPlaced++})});
      var net=Math.max(0,correctPlaced-wrongPlaced);
      var full=Number(q.points||10);
      var earned=total?Math.round((full*net/total)*10)/10:0;
      var good=placed.length===total&&wrongPlaced===0&&correctPlaced===total;
      qsa('.class-placed-card').forEach(function(card){var id=card.dataset.id||'',col=card.closest('.class-drop')?.dataset.col||'';card.classList.add(String(id).split(':')[0]===String(col)?'correct':'wrong')});
      qsa('.class-drop').forEach(function(d){var ci=Number(d.dataset.col),ids=classState[ci]||[],ok=ids.length&&ids.every(function(id){return String(id).split(':')[0]===String(ci)});d.classList.add(ok?'correct':'wrong')});
      showResult(good,null,{__classification:true,__partialPoints:earned,__correctPlaced:correctPlaced,__wrongPlaced:wrongPlaced,__totalClassItems:total,__classificationSummary:'تم احتساب '+earned+' من '+full+' درجة. الصحيح: '+correctPlaced+'، الخطأ: '+wrongPlaced+'، غير موزع: '+Math.max(0,total-placed.length)});
    }

    function renderPairs(q){
      var rights=shuffle((q.pairs||[]).map(function(p){return p.right}));
      pairOptions=rights.slice();
      var lefts=(q.pairs||[]).map(function(p,idx){return{left:p.left,idx:idx}});
      var title=q.type==='connecting'?'التوصيل':'المطابقة';
      if(q.type!=='connecting'){
        var note=ph('matchingHelp');
        return '<p class="pill">'+note+'</p><div class="board enhanced-pairs"><div class="col"><h3>📌 الإجابات المتحركة</h3>'+rights.map(function(r){return '<button class="tile pair-answer" draggable="true" onclick="selectPairAnswer(this.dataset.val,this)" ondragstart="dragPairAnswer(event,this.dataset.val)" data-val="'+attr(r)+'">'+esc(gx(r))+'</button>'}).join('')+'</div><div class="col"><h3>🧩 '+title+'</h3>'+lefts.map(function(p){return '<div class="row-match"><div class="tile pair-left">'+esc(gx(p.left))+'</div><div class="arrow">⇐</div><button class="drop pair-drop" id="drop_'+p.idx+'" data-idx="'+p.idx+'" ondragover="allowPairDrop(event)" ondrop="dropPairAnswer(event,'+p.idx+')" onclick="setMatch('+p.idx+')">'+ph('dropHere')+'</button></div>'}).join('')+'</div></div><div class="next-zone"><button class="btn" onclick="answerMatch()">تثبيت '+title+'</button></div>'
      }
      return '<p class="pill">'+ph('connectingHelp')+'</p><div class="fixed-pair-board" id="pairBoard"><svg class="pair-lines" id="pairLines"><defs><marker id="pairArrow" markerWidth="14" markerHeight="14" refX="11" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,10 L12,5 z" fill="#facc15"></path></marker></defs></svg><div class="pair-stack"><h3>🧩 الأسئلة</h3>'+lefts.map(function(p){return '<button class="tile drop pair-drop pair-target" id="drop_'+p.idx+'" data-idx="'+p.idx+'" ondragover="allowPairDrop(event)" ondrop="dropPairAnswer(event,'+p.idx+')" onclick="setMatch('+p.idx+')"><span>'+esc(gx(p.left))+'</span><small>'+ph('clickAfterAnswer')+'</small></button>'}).join('')+'</div><div class="pair-stack"><h3>📌 الإجابات</h3>'+rights.map(function(r){return '<button class="tile pair-answer fixed-answer" draggable="true" onclick="selectPairAnswer(this.dataset.val,this)" ondragstart="dragPairAnswer(event,this.dataset.val)" data-val="'+attr(r)+'">'+esc(gx(r))+'</button>'}).join('')+'</div></div><div class="next-zone"><button class="btn" onclick="answerMatch()">تثبيت التوصيل</button></div>'}
    function drawPairLines(){try{var board=qs('#pairBoard'),svg=qs('#pairLines');if(!board||!svg)return;qsa('#pairLines path:not(marker path)').forEach(function(p){p.remove()});var rect=board.getBoundingClientRect();Object.keys(matchState||{}).forEach(function(idx){var ans=matchState[idx];if(!ans)return;var qEl=qs('#drop_'+idx),aEl=qsa('.fixed-answer').filter(function(x){return x.dataset.val===ans})[0];if(!qEl||!aEl)return;var qr=qEl.getBoundingClientRect(),ar=aEl.getBoundingClientRect(),qc=qr.left+qr.width/2,ac=ar.left+ar.width/2,x1=(qc<ac?qr.right:qr.left)-rect.left,y1=qr.top+qr.height/2-rect.top,x2=(qc<ac?ar.left:ar.right)-rect.left,y2=ar.top+ar.height/2-rect.top,dx=Math.max(80,Math.abs(x2-x1)*.45),c1=qc<ac?x1+dx:x1-dx,c2=qc<ac?x2-dx:x2+dx;var path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M '+x1+' '+y1+' C '+c1+' '+y1+', '+c2+' '+y2+', '+x2+' '+y2);path.setAttribute('marker-end','url(#pairArrow)');if(locked){var q=set[i];var ok=String((q.pairs[idx]||{}).right||'')===String(ans||'');path.classList.add(ok?'correct':'wrong')}svg.appendChild(path)})}catch(e){}}
    function selectPairAnswer(v,el){selectedAnswer=v;qsa('.pair-answer').forEach(function(x){x.classList.remove('selected')});if(el)el.classList.add('selected');tone('click')}
    function dragPairAnswer(ev,v){selectedAnswer=v;try{ev.dataTransfer.setData('text/plain',v);ev.dataTransfer.effectAllowed='move'}catch(e){}tone('click')}
    function allowPairDrop(ev){ev.preventDefault();if(ev.currentTarget)ev.currentTarget.classList.add('drag-over')}
    function dropPairAnswer(ev,idx){ev.preventDefault();var v='';try{v=ev.dataTransfer.getData('text/plain')}catch(e){}selectedAnswer=v||selectedAnswer;setMatch(idx);if(ev.currentTarget)ev.currentTarget.classList.remove('drag-over')}
    function setMatch(idx){if(!selectedAnswer)return;var q=set[i];if(q&&q.type==='connecting'){Object.keys(matchState||{}).forEach(function(k){if(matchState[k]===selectedAnswer)delete matchState[k]});matchState[idx]=selectedAnswer;var d=qs('#drop_'+idx);if(d){var original=(q.pairs[idx]||{}).left||'';d.innerHTML='<span>'+esc(gx(original))+'</span><small>'+ph('connectedTo')+''+esc(gx(selectedAnswer))+'</small>';d.classList.add('filled','connected')}qsa('.fixed-answer').forEach(function(a){a.classList.toggle('linked',Object.keys(matchState).some(function(k){return matchState[k]===a.dataset.val}));a.classList.remove('selected')});selectedAnswer='';setTimeout(drawPairLines,20);tone('click');return}matchState[idx]=selectedAnswer;var d=qs('#drop_'+idx);if(d){d.innerHTML='<span>'+esc(gx(selectedAnswer))+'</span><small style="display:block;color:#cbd5e1;font-size:14px">'+ph('changeAnswer')+'</small>';d.classList.add('filled')}tone('click')}
    function answerMatch(){if(locked)return;var q=set[i],good=(q.pairs||[]).every(function(p,idx){return String(matchState[idx]||'')===String(p.right||'')});qsa('.drop').forEach(function(d,idx){d.classList.add(String(matchState[idx]||'')===String((q.pairs[idx]||{}).right||'')?'correct':'wrong')});showResult(good,null,matchState);setTimeout(drawPairLines,20)}
    function renderOrder(){var box=qs('#orderList');box.innerHTML=orderState.map(function(t,idx){return '<div class="order-item"><div class="order-num">'+(idx+1)+'</div><div class="order-text">'+esc(gx(t))+'</div><div class="order-actions"><button class="mini" onclick="moveOrder('+idx+',-1)">↑</button><button class="mini" onclick="moveOrder('+idx+',1)">↓</button></div></div>'}).join('')}
    function moveOrder(idx,dir){var ni=idx+dir;if(ni<0||ni>=orderState.length)return;var t=orderState[idx];orderState[idx]=orderState[ni];orderState[ni]=t;renderOrder()}
    function answerOrder(){if(locked)return;var q=set[i],good=JSON.stringify(orderState)===JSON.stringify(q.items||[]);showResult(good,null,orderState)}
    function correctSummary(q){if(q.type==='multiple_choice'||q.type==='true_false')return gx((q.options||[])[q.correct]||'');if(q.type==='open_text'||q.type==='short_answer')return(q.answers||q.accepted||[]).map(gx).join(' / ');if(q.type==='ordering')return(q.items||[]).map(gx).join(' ← ');if(q.type==='puzzle_image')return gx('تركيب الصورة بشكل صحيح');if(q.type==='classification')return(q.categories||[]).map(function(c){return gx(c.title)+': '+(c.items||[]).map(function(it){return it.kind==='image'&&it.image?'[صورة]':gx(it.text||'')}).join('، ')}).join(' | ');return(q.pairs||[]).map(function(p){return gx(p.left)+' ⇐ '+gx(p.right)}).join(' | ')}
    function nextQuestion(){i++;showQuestion()}
    function stars(p){return '⭐'.repeat(Math.max(1,Math.min(5,Math.round(p/20))))}
    function endScreen(){var pct=Math.round(score/totalPts()*100),elapsed=Math.round((Date.now()-startedAt)/1000);if(mode()==='competition'){document.getElementById('app').innerHTML=header()+'<div class="card" style="text-align:center"><h2 style="font-size:44px;color:#ffe8a3">انتهت المنافسة 🎉</h2>'+players.map(function(p){return '<div class="rank"><span>'+esc(p.name)+'</span><span>'+p.correct+' إجابات</span><span>'+p.score+' نقطة</span></div>'}).join('')+'<button class="btn" onclick="startScreen()">إعادة اللعب</button></div>';burst();return}document.getElementById('app').innerHTML=header()+'<div class="card" style="text-align:center"><h2 style="font-size:44px;color:#ffe8a3">'+esc(ph('good'))+' '+esc(name)+'</h2><div class="score">'+pct+'%</div><div class="stars">'+stars(pct)+'</div><p style="font-size:24px;color:#cbd5e1">الإجابات الصحيحة: '+correct+' / '+set.length+' · الوقت: '+elapsed+' ثانية</p><button class="btn" onclick="startScreen()">إعادة اللعب</button></div>';burst()}
    function toggleFull(){if(!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen();else if(document.exitFullscreen)document.exitFullscreen()}
    window.chooseMode=function(m){playMode=(m==='competition'?'competition':'individual');startScreen()};window.retryAttempt=retryAttempt;window.selectPairAnswer=selectPairAnswer;window.dragPairAnswer=dragPairAnswer;window.allowPairDrop=allowPairDrop;window.dropPairAnswer=dropPairAnswer;window.startGame=startGame;window.answerChoice=answerChoice;window.answerOpen=answerOpen;window.nextQuestion=nextQuestion;window.setMatch=setMatch;window.answerMatch=answerMatch;window.moveOrder=moveOrder;window.answerOrder=answerOrder;window.selectClass=selectClass;window.dragClass=dragClass;window.dropClass=dropClass;window.placeClass=placeClass;window.answerClass=answerClass;window.selectPuzzle=selectPuzzle;window.shufflePuzzle=shufflePuzzle;window.answerPuzzle=answerPuzzle;window.toggleFull=toggleFull;window.startScreen=startScreen;startScreen();
  };
  const standaloneJS='('+runtime.toString()+')('+payload+');';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Cache-Control" content="no-store"><title>${esc(game.title||'لعبة تعليمية')}</title><style>${inlineCSS}${standaloneMobileCSS}.celebration-layer{position:fixed;inset:0;pointer-events:none;z-index:99998;overflow:hidden}.celebration-banner{position:fixed;top:20px;left:50%;transform:translateX(-50%) scale(.82);background:linear-gradient(135deg,#facc15,#f59e0b,#fb7185);color:#3b0764;padding:14px 28px;border-radius:999px;font-weight:900;font-size:30px;box-shadow:0 20px 60px rgba(0,0,0,.28);border:3px solid rgba(255,255,255,.55);animation:bannerPop 1.5s ease forwards;white-space:nowrap}.celebration-piece,.celebration-streamer,.celebration-star{position:absolute;pointer-events:none}.celebration-piece{width:14px;height:14px;border-radius:3px;background:var(--piece-color,#facc15);animation:fallPiece var(--dur,1500ms) linear forwards}.celebration-streamer{width:8px;height:34px;border-radius:999px;background:linear-gradient(180deg,var(--piece-color,#38bdf8),rgba(255,255,255,.4));animation:fallStreamer var(--dur,1700ms) ease-in forwards}.celebration-star{font-size:24px;animation:sparkFloat var(--dur,1200ms) ease-out forwards}@keyframes bannerPop{0%{opacity:0;transform:translateX(-50%) translateY(-18px) scale(.72)}15%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.08)}70%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-10px) scale(.94)}}@keyframes fallPiece{0%{opacity:0;transform:translate3d(0,-40px,0) rotate(0deg) scale(.7)}10%{opacity:1}100%{opacity:0;transform:translate3d(var(--dx,0px),calc(100vh + 60px),0) rotate(var(--rot,540deg)) scale(1)}}@keyframes fallStreamer{0%{opacity:0;transform:translate3d(0,-50px,0) rotate(0deg) scale(.7)}10%{opacity:1}100%{opacity:0;transform:translate3d(var(--dx,0px),calc(100vh + 80px),0) rotate(var(--rot,720deg)) scale(1)}}@keyframes sparkFloat{0%{opacity:0;transform:translate3d(0,10px,0) scale(.4)}18%{opacity:1;transform:translate3d(0,0,0) scale(1.15)}100%{opacity:0;transform:translate3d(var(--dx,0px),var(--dy,-140px),0) scale(.9)}}.hero-cover{width:100%;max-height:260px;object-fit:cover;border-radius:24px;border:1px solid rgba(255,255,255,.18);box-shadow:0 18px 45px rgba(0,0,0,.26);margin:14px 0;background:rgba(255,255,255,.06)}.pair-answer.selected{border-color:#facc15;background:linear-gradient(135deg,rgba(250,204,21,.32),rgba(6,182,212,.28))}.pair-drop.drag-over{border-color:#facc15;background:rgba(113,63,18,.48)}.mode-chooser{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:16px 0}.mode-card{border:2px solid rgba(255,255,255,.14);background:rgba(15,23,42,.78);border-radius:18px;color:white;padding:14px;font-family:inherit;cursor:pointer}.mode-card.active{border-color:#f6c85f;background:rgba(246,200,95,.18)}.mode-card b{display:block;font-size:22px;color:#fff3bf}.mode-card span{color:#cbd5e1}.fixed-pair-board{position:relative;display:grid;grid-template-columns:minmax(260px,1fr) minmax(260px,1fr);gap:clamp(70px,10vw,150px);padding:20px;border-radius:26px;background:rgba(15,23,42,.62);border:1px solid rgba(255,255,255,.16);overflow:visible}.fixed-pair-board .pair-lines{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:visible}.fixed-pair-board .pair-lines path{fill:none;stroke:#facc15;stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round;opacity:.92;filter:drop-shadow(0 2px 4px rgba(0,0,0,.55))}.fixed-pair-board .pair-lines path.correct{stroke:#22c55e}.fixed-pair-board .pair-lines path.wrong{stroke:#ef4444}.fixed-pair-board .pair-stack{position:relative;z-index:2;display:grid;gap:14px}.fixed-pair-board .pair-stack h3{text-align:center;color:#ffe8a3;margin:0 0 4px}.fixed-pair-board .pair-target{flex-direction:column;border-width:2px}.fixed-pair-board .pair-target small{display:block;margin-top:8px;color:#fde68a;font-size:16px}.fixed-pair-board .fixed-answer.linked,.fixed-pair-board .pair-target.connected{border-color:#22c55e;background:linear-gradient(135deg,rgba(5,46,22,.92),rgba(15,118,110,.74));color:#dcfce7}@media(max-width:820px){.fixed-pair-board{grid-template-columns:1fr;gap:26px}.fixed-pair-board .pair-lines{display:none}}.retry-zone{margin-top:14px;display:flex;justify-content:center}.retry-button{font-size:20px;padding:12px 24px}.enhanced-pairs .row-match{grid-template-columns:minmax(220px,1fr) 46px minmax(220px,1fr);gap:10px}.enhanced-pairs .tile,.enhanced-pairs .drop{min-height:72px;border-radius:18px}.enhanced-pairs .arrow{width:46px;height:46px;font-size:25px;opacity:.78}@media(max-width:980px){.enhanced-pairs .row-match{grid-template-columns:1fr}.enhanced-pairs .arrow{transform:rotate(90deg);margin:auto}}</style></head><body><main id="app" class="wrap"></main>${standaloneFooter}<script>${standaloneJS}<\/script></body></html>`;
}

function exportStandalone(game){const s=store();downloadFile(sanitizeFilename(game.title)+'.html',standaloneHTML(game,s.platform),'text/html;charset=utf-8')}
function copyText(t){navigator.clipboard?.writeText(t).then(()=>toast('تم النسخ بنجاح')).catch(()=>prompt('انسخ الرابط:',t))}

function authSession(){try{return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)||'null')}catch(e){return null}}
function saveAuthSession(session){if(session)localStorage.setItem(AUTH_SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(AUTH_SESSION_KEY)}
function authBaseUrl(){const c=cloudConfig();const u=cleanSupabaseUrl(c.supabaseUrl);if(!u)throw new Error('رابط Supabase غير محفوظ');return u}
function authKey(){const c=cloudConfig();const k=String(c.publishableKey||'').trim();if(!k)throw new Error('مفتاح Supabase غير محفوظ');return k}
function authHeaders(extra={}){const k=authKey();return {'apikey':k,'Content-Type':'application/json',...extra}}
async function authFetch(path,opts={}){const url=authBaseUrl()+path;const res=await fetch(url,{...opts,headers:{...authHeaders(),...(opts.headers||{})}});const json=await res.json().catch(()=>({}));if(!res.ok){throw new Error(json.error_description||json.msg||json.message||('فشل الاتصال بخدمة التسجيل ('+res.status+')'))}return json}
function profileFromUser(user,fallback={}){const m=(user&&user.user_metadata)||{};const eg=normalizedGender(m.educator_gender||m.gender||fallback.educator_gender||fallback.gender||((m.role||fallback.role)==='admin'?'male':platformGender()));return {id:(user&&user.id)||fallback.id||uuid(),name:m.name||fallback.name||String(user?.email||fallback.email||(eg==='male'?'معلم':'معلمة')).split('@')[0],school:m.school||fallback.school||'',email:user?.email||fallback.email||'',role:m.role||fallback.role||'teacher',status:'نشط',avatar:m.avatar||fallback.avatar||'',icon:m.icon||fallback.icon||(eg==='male'?'👨‍🏫':'👩‍🏫'),educator_gender:eg}}
function setProfileFromAuth(user){const s=store();const p=profileFromUser(user,s.profile||{});s.profile={...s.profile,...p};s.platform=s.platform||defaultPlatform();s.platform.uiGender=p.educator_gender||s.platform.uiGender||'female';s.teachers=mergeTeachersFromSources(s.teachers,[p],s.games||[]);saveStore(s);setTimeout(()=>cloudUpsertProfile(p).catch(e=>console.warn('profile cloud sync failed',e)),0);document.dispatchEvent(new CustomEvent('manarat:auth-updated'));return p}
async function authSignUp({email,password,name,school,role='teacher',educator_gender}){email=String(email||'').trim();password=String(password||'');if(!email||!password)throw new Error('اكتب البريد الإلكتروني وكلمة المرور');if(password.length<6)throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف');if(email.toLowerCase()===CONFIGURED_ADMIN_EMAIL)role='admin';const eg=normalizedGender(educator_gender||((role==='admin')?'male':'female'));const json=await authFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:{name:name||'مدير المنصة',school:school||'منارة التعلم الرقمي',role,educator_gender:eg,icon:eg==='male'?'👨‍🏫':'👩‍🏫'}})});const session=json.session||null;if(session){saveAuthSession(session);setProfileFromAuth(session.user||json.user)}else if(json.user){setProfileFromAuth(json.user)}return json}
function configuredAdminCredentials(email,password){return false}
function activateLocalConfiguredAdmin(){const s=ensureConfiguredAdmin(store());s.profile={...(s.profile||{}),id:CONFIGURED_ADMIN_ID,name:'مدير المنصة',school:'منارة التعلم الرقمي',email:CONFIGURED_ADMIN_EMAIL,role:'admin',status:'نشط',icon:'🛡️',educator_gender:'male'};s.platform=s.platform||defaultPlatform();s.platform.uiGender='male';saveStore(s);document.dispatchEvent(new CustomEvent('manarat:auth-updated'));return{temporary:false,user:TEMP_ADMIN_USER,message:'تم تفعيل دخول الأدمن'}}
async function authSignIn({email,password}){email=String(email||'').trim();password=String(password||'');if(!email||!password)throw new Error('اكتب البريد الإلكتروني وكلمة المرور');try{const json=await authFetch('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});if(!json.access_token||!json.user)throw new Error('لم يتم استلام جلسة دخول صالحة');saveAuthSession(json);setProfileFromAuth(json.user);return json}catch(e){if(configuredAdminCredentials(email,password)&&TEMP_ADMIN_BYPASS===true){console.warn('Supabase login failed; local bypass is disabled in production',e);return activateLocalConfiguredAdmin()}throw e}}
async function authSignOut(){const sess=authSession();try{if(sess&&sess.access_token){await fetch(authBaseUrl()+'/auth/v1/logout',{method:'POST',headers:{...authHeaders(),Authorization:'Bearer '+sess.access_token}})}}catch(e){console.warn(e)}saveAuthSession(null);toast('تم تسجيل الخروج');setTimeout(()=>{location.href=rootPublic()+'auth.html'},350)}
async function authRefreshSession(){const sess=authSession();if(!sess||!sess.refresh_token)return null;try{const json=await authFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:sess.refresh_token})});if(json&&json.access_token){saveAuthSession(json);setProfileFromAuth(json.user);return json}}catch(e){console.warn('refresh failed',e);saveAuthSession(null)}return null}
function hasRealAuthSession(){const sess=authSession();return !!(sess&&sess.access_token&&sess.user)}
function isAuthenticated(){return hasRealAuthSession()}
function currentAuthUser(){const sess=authSession();if(sess&&sess.user)return sess.user;return null}
function currentTeacherId(){return (store().profile||{}).id||currentAuthUser()?.id||'t1'}
function currentPublicPath(){const p=location.pathname.replace(/\\/g,'/');const idx=p.indexOf('/public/');return idx>=0?p.slice(idx+8)+location.search:p.split('/').pop()+location.search}
function requireTeacherAuth(){if(isAuthenticated())return true;const next=encodeURIComponent(currentPublicPath());toast('سجّل دخول '+genderWord('teacher')+' أولًا','warn');setTimeout(()=>{location.href=rootPublic()+'auth.html?next='+next},350);return false}
function teacherOwnsGame(game){const id=currentTeacherId();return !game||game.teacher_id===id||String(game.teacher_email||'').toLowerCase()===String((store().profile||{}).email||'').toLowerCase()}

function currentProfile(){const s=store();const u=currentAuthUser&&currentAuthUser();return {...(s.profile||{}),id:(u&&u.id)||(s.profile||{}).id,email:(u&&u.email)||(s.profile||{}).email,role:(u&&u.user_metadata&&u.user_metadata.role)||(s.profile||{}).role}}
function emailOf(v){return String(v||'').trim().toLowerCase()}
function isAdmin(){if(!isAuthenticated())return false;const s=store();const p=currentProfile();const email=emailOf(p.email);const admins=Array.isArray(s.admins)?s.admins:[];if(!admins.length)return isAuthenticated();if(admins.length===1 && emailOf(admins[0].email)==='admin@manarat.local')return isAuthenticated();return admins.some(a=>a.active!==false && emailOf(a.email)===email)}
function ensureAdminBootstrap(){if(isTemporaryAdminBypass())return true;const s=store();const p=currentProfile();if(isAuthenticated() && (!Array.isArray(s.admins)||!s.admins.length||(s.admins.length===1&&emailOf(s.admins[0].email)==='admin@manarat.local'))){s.admins=[{id:p.id||uuid(),name:p.name||p.email||'مدير المنصة',email:p.email,role:'owner',active:true,created_at:new Date().toISOString()}];saveStore(s);return true}return false}
async function ensureAdminCloudRole(){
  const u=currentAuthUser();
  if(isTemporaryAdminBypass()||!u||!isAdmin()||!cloudReady(cloudConfig()))return false;
  const p=currentProfile();
  try{
    await cloudRest('profiles','',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:u.id,email:u.email||p.email||'',name:p.name||u.email||'مدير المنصة',school:p.school||'',role:'admin',status:'نشط',educator_gender:p.educator_gender||'male',updated_at:new Date().toISOString()})});
    return true;
  }catch(e){console.warn('admin cloud role sync failed',e);return false}
}
function requireAdminAuth(){if(!isAuthenticated()){const next=encodeURIComponent(currentPublicPath());toast('سجّل دخول الأدمن أولًا','warn');setTimeout(()=>{location.href=rootPublic()+'auth.html?next='+next},350);return false}ensureAdminBootstrap();if(isAdmin())return true;document.body.innerHTML='<main class="page"><div class="wrap"><section class="card" style="text-align:center"><h1>غير مصرح بالدخول</h1><p class="muted">هذا القسم مخصص لمدير المنصة فقط. اطلب من الأدمن إضافتك كمدير.</p><a class="btn" href="'+rootPublic()+'index.html">العودة للرئيسية</a></section></div></main>';return false}

function normalizedGender(g){return String(g||platformGender()||'female')==='male'?'male':'female'}
function genderPack(gender){
  const male=normalizedGender(gender)==='male';
  return male?{
    student:'الطالب',students:'الطلاب',teacher:'المعلم',teachers:'المعلمين',
    startButton:'ابدأ اللعبة',placeholder:'اكتب اسمك هنا',first:'اسم الطالب الأول',second:'اسم الطالب الثاني',
    correctMsg:'ممتاز! إجابة صحيحة 🎉',wrongMsg:'حاول مرة أخرى',finalExcellent:'أداء رائع جدًا يا بطل',finalTry:'راجع الدرس جيدًا وستتقدم',
    excellent:'أحسنت يا بطل',wrong:'لا بأس، حاول من جديد',tryAgain:'حاول مرة أخرى',finish:'أداء رائع يا بطل',
    piecePlaced:'ممتاز! ركبت القطعة في مكانها الصحيح',puzzleDone:'رائع جدًا! اكتمل البازل بنجاح',
    matchingHelp:'اسحب مستطيل الإجابة من جهة الإجابات، وضعه أمام العبارة المناسبة. ويمكنك أيضًا الضغط على الإجابة ثم الضغط على المكان المناسب لها.',
    connectingHelp:'اختر الإجابة أولًا، ثم اضغط على السؤال المناسب. ستبقى الإجابة في مكانها والسؤال في مكانه، وسيظهر خط واضح بينهما.',
    dropHere:'اسحب الإجابة هنا',clickAfterAnswer:'اضغط هنا بعد اختيار الإجابة',connectedTo:'متصل بـ: ',
    individualDesc:'يلعب طالب واحد ويحصل على نتيجة وشهادة.',competitionDesc:'طالبان يتنافسان بنفس عدد الأسئلة.',
    individualPill:'لعب فردي',competitionPill:'منافسة بين طالبين',completeVerb:'لإكماله',
    correctVoicePhrases:['أَحْسَنْتَ، إِجَابَةٌ صَحِيحَة.','مُمْتَازٌ، واصِلِ التَّقَدُّم.','رائِعٌ، اخْتِيارُكَ صَحِيح.','أَبْدَعْتَ يا بَطَل.'],
    wrongVoicePhrases:['لا بَأْسَ، حاوِلْ مَرَّةً أُخْرَى.','إِجَابَةٌ غَيْرُ صَحِيحَة، راجِعِ السُّؤال.','اقْتَرَبْتَ مِنَ الصَّواب، فَكِّرْ قَلِيلًا.'],
    puzzleVoicePhrases:['رائع جدًا! اكتمل البازل بنجاح.','أحسنت، اكتملت الصورة بشكل صحيح.']
  }:{
    student:'الطالبة',students:'الطالبات',teacher:'المعلمة',teachers:'المعلمات',
    startButton:'ابدئي اللعبة',placeholder:'اكتبي اسمك هنا',first:'اسم الطالبة الأولى',second:'اسم الطالبة الثانية',
    correctMsg:'ممتازة! إجابة صحيحة 🎉',wrongMsg:'حاولي مرة أخرى',finalExcellent:'أداء رائع جدًا يا بطلة',finalTry:'راجعي الدرس جيدًا وستتقدمين',
    excellent:'أحسنتِ يا بطلة',wrong:'لا بأس، حاولي من جديد',tryAgain:'حاولي مرة أخرى',finish:'أداء رائع يا بطلة',
    piecePlaced:'ممتاز! ركبتِ القطعة في مكانها الصحيح',puzzleDone:'رائع جدًا! اكتمل البازل بنجاح',
    matchingHelp:'اسحبي مستطيل الإجابة من جهة الإجابات، وضعيه أمام العبارة المناسبة. ويمكنك أيضًا الضغط على الإجابة ثم الضغط على المكان المناسب لها.',
    connectingHelp:'اختاري الإجابة أولًا، ثم اضغطي على السؤال المناسب. ستبقى الإجابة في مكانها والسؤال في مكانه، وسيظهر خط واضح بينهما.',
    dropHere:'اسحبي الإجابة هنا',clickAfterAnswer:'اضغطي هنا بعد اختيار الإجابة',connectedTo:'متصل بـ: ',
    individualDesc:'تلعب طالبة واحدة وتحصل على نتيجة وشهادة.',competitionDesc:'طالبتان تتنافسان بنفس عدد الأسئلة.',
    individualPill:'لعب فردي',competitionPill:'منافسة بين طالبتين',completeVerb:'لإكمالها',
    correctVoicePhrases:['أَحْسَنْتِ، إِجَابَةٌ صَحِيحَة.','مُمْتَازَةٌ، واصِلِي التَّقَدُّم.','رائِعَةٌ، اخْتِيارُكِ صَحِيح.','أَبْدَعْتِ يا بَطَلَة.'],
    wrongVoicePhrases:['لا بَأْسَ، حاوِلِي مَرَّةً أُخْرَى.','إِجَابَةٌ غَيْرُ صَحِيحَة، راجِعِي السُّؤال.','اقْتَرَبْتِ مِنَ الصَّواب، فَكِّرِي قَلِيلًا.'],
    puzzleVoicePhrases:['رائع جدًا! اكتمل البازل بنجاح.','أحسنتِ، اكتملت الصورة بشكل صحيح.']
  };
}
function genderizeText(text,gender){
  let v=String(text??''); const g=normalizedGender(gender);
  const malePairs=[['الطالبات','الطلاب'],['الطالبتان','الطالبان'],['الطالبة','الطالب'],['المعلمات','المعلمين'],['المعلمة','المعلم'],['دخول المعلمة','دخول المعلم'],['لوحة المعلمة','لوحة المعلم'],['إنشاء حساب معلمة','إنشاء حساب معلم'],['اسم المعلمة','اسم المعلم'],['أحسنتِ','أحسنت'],['أبدعتِ','أبدعت'],['ممتازة','ممتاز'],['رائعة','رائع'],['بطلة','بطل'],['حاولي','حاول'],['راجعي','راجع'],['واصلي','واصل'],['اختاري','اختر'],['اضغطي','اضغط'],['اسحبي','اسحب'],['ضعي','ضع'],['اكتبي','اكتب'],['رتّبي','رتّب'],['رتبي','رتب'],['وصّلي','وصّل'],['صِلِي','صِلْ'],['طابقي','طابق'],['ستتقدمين','ستتقدم'],['لإكمالها','لإكماله'],['الخاصة بها','الخاصة به']];
  const femalePairs=[['الطلاب','الطالبات'],['الطالبان','الطالبتان'],['الطالب','الطالبة'],['المعلمين','المعلمات'],['المعلم','المعلمة'],['دخول المعلم','دخول المعلمة'],['لوحة المعلم','لوحة المعلمة'],['إنشاء حساب معلم','إنشاء حساب معلمة'],['اسم المعلم','اسم المعلمة'],['أحسنت يا بطل','أحسنتِ يا بطلة'],['أحسنت','أحسنتِ'],['أبدعت','أبدعتِ'],['ممتاز!','ممتازة!'],['رائع يا بطل','رائع يا بطلة'],['رائع','رائعة'],['بطل','بطلة'],['حاول مرة أخرى','حاولي مرة أخرى'],['حاول','حاولي'],['راجع','راجعي'],['واصل','واصلي'],['اختر','اختاري'],['اضغط','اضغطي'],['اسحب','اسحبي'],['ضع','ضعي'],['اكتب','اكتبي'],['رتّب','رتّبي'],['رتب','رتبي'],['وصّل','وصّلي'],['طابق','طابقي'],['ستتقدم','ستتقدمين'],['لإكماله','لإكمالها'],['الخاصة به','الخاصة بها']];
  (g==='male'?malePairs:femalePairs).forEach(([a,b])=>{v=v.split(a).join(b)});
  const vocalMale=[['أَحْسَنْتِ','أَحْسَنْتَ'],['مُمْتَازَةٌ','مُمْتَازٌ'],['رائِعَةٌ','رائِعٌ'],['اخْتِيارُكِ','اخْتِيارُكَ'],['أَبْدَعْتِ','أَبْدَعْتَ'],['بَطَلَة','بَطَل'],['حاوِلِي','حاوِلْ'],['راجِعِي','راجِعْ'],['فَكِّرِي','فَكِّرْ'],['واصِلِي','واصِلْ'],['رَكَّبْتِ','رَكَّبْتَ'],['اكتملتِ','اكتمل']];
  const vocalFemale=[['أَحْسَنْتَ','أَحْسَنْتِ'],['مُمْتَازٌ','مُمْتَازَةٌ'],['رائِعٌ','رائِعَةٌ'],['اخْتِيارُكَ','اخْتِيارُكِ'],['أَبْدَعْتَ','أَبْدَعْتِ'],['بَطَل','بَطَلَة'],['حاوِلْ','حاوِلِي'],['راجِعْ','راجِعِي'],['فَكِّرْ','فَكِّرِي'],['واصِلْ','واصِلِي'],['رَكَّبْتَ','رَكَّبْتِ']];
  (g==='male'?vocalMale:vocalFemale).forEach(([a,b])=>{v=v.split(a).join(b)});
  return v;
}

function platformGender(){const s=store();return normalizedGender((s.profile&&s.profile.educator_gender)||(s.profile&&s.profile.gender)||(s.platform&&s.platform.uiGender)||'female')}
function genderWord(key,gender=platformGender()){const m={teacher:{female:'المعلمة',male:'المعلم'},teachers:{female:'المعلمات',male:'المعلمين'},student:{female:'الطالبة',male:'الطالب'},students:{female:'الطالبات',male:'الطلاب'},loginTeacher:{female:'دخول المعلمة',male:'دخول المعلم'},teacherDashboard:{female:'لوحة المعلمة',male:'لوحة المعلم'},createAccount:{female:'إنشاء حساب معلمة',male:'إنشاء حساب معلم'},startPlaceholder:{female:'اكتبي اسمك هنا',male:'اكتب اسمك هنا'},tryAgain:{female:'حاولي مرة أخرى',male:'حاول مرة أخرى'},excellent:{female:'أحسنتِ',male:'أحسنت'},finalTry:{female:'راجعي الدرس جيدًا وستتقدمين',male:'راجع الدرس جيدًا وستتقدم'}};return (m[key]&&m[key][gender])||key}
function applyAdminVisibility(){const admin=isAdmin();qsa('.admin-only,[data-admin-only]').forEach(el=>{el.style.display=admin?'':'none'});qsa('a[href*="admin/admin.html"]').forEach(el=>{if(!admin)el.style.display='none';else el.style.display=''})}
function applyGenderQuickText(root=document){const gender=platformGender();const malePairs=[
['منصة ألعاب تعليمية سينمائية تشعل حماس الطالبات','منصة ألعاب تعليمية سينمائية تشعل حماس الطلاب'],['تمنح هذه الشهادة للطالبة','تمنح هذه الشهادة للطالب'],['نورة أحمد','أحمد محمد'],['لإكمالها','لإكماله'],['جاهزة لخوض','جاهز لخوض'],['المعلمات','المعلمين'],['المعلمة','المعلم'],['الطالبات','الطلاب'],['الطالبة','الطالب'],['دخول المعلمة','دخول المعلم'],['لوحة المعلمة','لوحة المعلم'],['إنشاء حساب معلمة','إنشاء حساب معلم'],['اسم المعلمة','اسم المعلم'],['تظهر لها','تظهر له'],['الخاصة بها','الخاصة به'],['أحسنتِ','أحسنت'],['راجعي','راجع'],['حاولي','حاول'],['اكتبي','اكتب'],['ابدئي','ابدأ'],['تستطيعين','تستطيع']];
const femalePairs=[['منصة ألعاب تعليمية سينمائية تشعل حماس الطلاب','منصة ألعاب تعليمية سينمائية تشعل حماس الطالبات'],['تمنح هذه الشهادة للطالب','تمنح هذه الشهادة للطالبة'],['أحمد محمد','نورة أحمد'],['لإكماله','لإكمالها'],['جاهز لخوض','جاهزة لخوض'],['المعلمين','المعلمات'],['المعلم','المعلمة'],['الطلاب','الطالبات'],['الطالب','الطالبة'],['دخول المعلم','دخول المعلمة'],['لوحة المعلم','لوحة المعلمة'],['إنشاء حساب معلم','إنشاء حساب معلمة'],['اسم المعلم','اسم المعلمة'],['تظهر له','تظهر لها'],['الخاصة به','الخاصة بها'],['أحسنت يا بطل','أحسنتِ يا بطلة'],['أحسنت','أحسنتِ'],['راجع','راجعي'],['حاول','حاولي'],['اكتب','اكتبي'],['ابدأ','ابدئي'],['تستطيع','تستطيعين']];
const replacements=gender==='male'?malePairs:femalePairs; const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){if(!n.nodeValue.trim())return NodeFilter.FILTER_REJECT; if(n.parentElement&&n.parentElement.closest('textarea,script,style,.question-box,.q,.q-admin-card'))return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT}}); let node; while(node=walker.nextNode()){let v=node.nodeValue; replacements.forEach(([a,b])=>v=v.split(a).join(b)); node.nodeValue=v} qsa('input,textarea',root).forEach(el=>{if(el.placeholder){let v=el.placeholder; replacements.forEach(([a,b])=>v=v.split(a).join(b)); el.placeholder=v}})}


function socialURL(platform,key){return ((platform&&platform.socialLinks)||{})[key]||''}
function siteFooterHTML(platform=store().platform||{}){
  const about=String(platform.siteAbout||'').trim();
  const contact=String(platform.siteContact||'').trim();
  const links=[['facebook','فيسبوك','📘'],['youtube','يوتيوب','▶️'],['instagram','إنستجرام','📸'],['tiktok','تيك توك','🎵'],['whatsapp','جروب الواتساب','💬']]
    .map(([k,label,icon])=>{const url=socialURL(platform,k);return url?`<a href="${attr(url)}" target="_blank" rel="noopener"><span class="social-icon">${icon}</span><span>${esc(label)}</span></a>`:''}).join('');
  if(!about&&!contact&&!links)return'';
  return `<footer class="site-footer-global no-print"><div class="site-footer-shell"><div class="site-footer-header"><div class="site-footer-badge">✨</div><div><div class="site-footer-kicker">منارة التعلم الرقمي</div><h2>من نحن وتواصل معنا</h2></div></div><div class="site-footer-inner"><section class="footer-card footer-about"><div class="footer-card-title"><span>💡</span><h3>من نحن</h3></div><p>${esc(about||'منارة التعلم الرقمي')}</p></section><section class="footer-card footer-contact"><div class="footer-card-title"><span>☎️</span><h3>تواصل معنا</h3></div><p>${esc(contact||'تابعونا عبر منصاتنا الرسمية.')}</p></section></div>${links?`<div class="footer-social-wrap compact"><div class="footer-social-title">القنوات الرسمية</div><div class="social-links">${links}</div></div>`:''}</div></footer>`;
}
function renderSiteFooter(){try{qsa('.site-footer-global').forEach(el=>el.remove());const html=siteFooterHTML(store().platform||{});if(html)document.body.insertAdjacentHTML('beforeend',html)}catch(e){console.warn('footer render failed',e)}}

function clearRuntimeCache(){try{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.includes('temp')||k.includes('cache')).forEach(k=>localStorage.removeItem(k));if('caches'in window)caches.keys().then(keys=>keys.filter(k=>/manarat|temp|cache/i.test(k)).forEach(k=>caches.delete(k)))}catch(e){}}
window.Manarat={qs,qsa,esc,attr,uuid,shuffle,norm,seconds,store,saveStore,seed,relAsset,rootPublic,getGameLink,playTone,toast,burst,downloadFile,sanitizeFilename,normalizeQuestion,normalizeQuestions,applyPlatform,readFileText,fileToDataURL,compressImageDataURL,compressImageFile,localGenerateQuestions,aiGenerateQuestions,testAIConnection,testCloudConnection,syncCloudNow,cloudSyncTables,cloudSaveAllTables,cloudForceSavePlatform,cloudUpsertGame,cloudDeleteGame,cloudUpsertBank,cloudInsertAttempt,cloudUploadFile,cloudUpsertProfile,cloudDeleteProfile,cloudDeleteAuthUser,cloudFetchProfiles,cloudInsertAudit,cloudFetchAuditLogs,initCloudSync,exportStandalone,copyText,authSession,hasRealAuthSession,isTemporaryAdminBypass,authSignUp,authSignIn,authSignOut,authRefreshSession,isAuthenticated,currentAuthUser,currentTeacherId,currentPublicPath,requireTeacherAuth,teacherOwnsGame,currentProfile,isAdmin,ensureAdminBootstrap,ensureAdminCloudRole,requireAdminAuth,genderWord,genderPack,genderizeText,normalizedGender,applyAdminVisibility,applyGenderQuickText,clearRuntimeCache,renderSiteFooter,siteFooterHTML,isGameApprovedPublic,isGameApprovedShared,defaultPlatform,STORE_KEY,AUTH_SESSION_KEY};
document.addEventListener('DOMContentLoaded',()=>{applyPlatform();clearRuntimeCache();initCloudSync();applyAdminVisibility();applyGenderQuickText();renderSiteFooter();document.addEventListener('manarat:auth-updated',()=>{applyAdminVisibility();applyGenderQuickText();renderSiteFooter()});document.addEventListener('manarat:store-updated',()=>{renderSiteFooter()});document.body.addEventListener('pointerover',e=>{if(store().platform.hoverSounds&&e.target.closest('button,.btn,.answer,.tile'))playTone('hover')},{passive:true});document.body.addEventListener('click',e=>{if(e.target.closest('button,.btn,.answer,.tile'))playTone('click')},{passive:true})});
})();
