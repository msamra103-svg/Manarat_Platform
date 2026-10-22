const base=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+key};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const templates=['race','football','basketball','volleyball','bowling','fishing','puzzle','classic'];
const types=['multiple_choice','true_false','open_text','matching','connecting','ordering','classification','puzzle_image'];
const enc=encodeURIComponent;
async function db(table:string,query='',method='GET',data?:unknown){const r=await fetch(`${base}/rest/v1/${table}${query?'?'+query:''}`,{method,headers:{...headers,Prefer:'return=representation'},body:data===undefined?undefined:JSON.stringify(data)});const j=await r.json().catch(()=>null);if(!r.ok)throw new Error('تعذر حفظ البيانات. أعد المحاولة.');return j;}
async function dbAll(table:string,query=''){const rows:any[]=[];for(let offset=0;;offset+=500){const page=await db(table,query+'&limit=500&offset='+offset);rows.push(...page);if(page.length<500)return rows;}}
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function alias(username:string){const name=String(username||'').normalize('NFKC').trim().toLowerCase();if(!/^[\p{L}\p{N}_.-]{3,40}$/u.test(name))throw new Error('اسم المستخدم من 3 إلى 40 حرفًا أو رقمًا دون مسافات.');return (await hash(name))+'@teachers.abuobaid.invalid';}
const norm=(s:any)=>String(s??'').trim().normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').toLowerCase();
function cleanQuestion(q:any){const {correct,answers,accepted,correctAnswer,explanation,manual_grade,...x}=q; if(q.pairs){x.pairs=q.pairs.map((p:any)=>({left:p.left}));x.choices=q.pairs.map((p:any)=>p.right).sort(()=>Math.random()-.5);}if(q.items)x.items=[...q.items].sort(()=>Math.random()-.5);if(q.categories){x.categories=q.categories.map((c:any)=>({title:c.title}));x.classItems=(q._classItems||[]).map(({category,...item}:any)=>item);delete x._classItems;}return x;}
function grade(q:any,value:any){const max=Math.max(1,Math.min(100,Number(q.points)||10));let correct=false,pending=false;
 if(['multiple_choice','true_false'].includes(q.type))correct=Number.isInteger(value)&&value===Number(q.correct);
 else if(q.type==='open_text'){pending=q.manual_grade!==false||!(q.answers?.length);correct=!pending&&q.answers.some((a:any)=>norm(a)===norm(value));}
 else if(['matching','connecting'].includes(q.type))correct=Array.isArray(value)&&value.length===q.pairs?.length&&q.pairs.every((p:any,i:number)=>norm(value[i])===norm(p.right));
 else if(q.type==='ordering')correct=Array.isArray(value)&&JSON.stringify(value)===JSON.stringify(q.items);
 else if(q.type==='classification')correct=!!value&&q._classItems?.length>0&&q._classItems.every((it:any)=>Number(value[it.id])===it.category);
 else if(q.type==='puzzle_image')correct=Array.isArray(value)&&value.length===(Number(q.puzzle_grid)||3)**2&&value.every((v:number,i:number)=>v===i);
 else pending=true;
 return {value,points:correct?max:0,max,pending,correct,feedback:pending?'أُرسلت الإجابة للمعلم للمراجعة.':correct?'أحسنت! إجابة صحيحة.':'راجع الفكرة وحاول في تجربة جديدة.',explanation:pending?'':String(q.explanation||'')};}
async function requireUser(req:Request){const token=req.headers.get('Authorization')||'';if(!token.startsWith('Bearer '))throw new Error('سجّل الدخول أولًا.');const r=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:token}});if(!r.ok)throw new Error('انتهت الجلسة. سجّل الدخول من جديد.');const u=await r.json();const p=(await db('profiles','id=eq.'+enc(u.id)))[0];if(!p||p.status==='موقوف')throw new Error('الحساب غير متاح. تواصل مع الإدارة.');return {...p,username:u.user_metadata?.username||'',admin:p.role==='admin'};}
async function owned(table:string,id:string,p:any){const row=(await db(table,'id=eq.'+enc(id)))[0];if(!row||(!p.admin&&row.teacher_id!==p.id))throw new Error('لا تملك صلاحية الوصول إلى هذا المحتوى.');return row;}
const allowedSections=['games','champions','topGames','activeTeachers','videos','about'];
const qatarOffsetMs=3*3600*1000;
const gameTitles:Record<string,[string,string,string]>={
 football:['كرة القدم','ملعب ثلاثي الأبعاد','assets/game-covers/football.svg'],
 volleyball:['الكرة الطائرة','تداول 6×6','assets/game-covers/volleyball.svg'],
 basketball:['كرة السلة','صالة 3D','assets/game-covers/basketball.svg'],
 race:['سباق السيارات','حلبة سباق 3D','assets/game-covers/race.svg'],
 bowling:['البولينج','فيزياء 10 قوارير','assets/game-covers/bowling.svg'],
 fishing:['صيد الأسماك','بيئة بحرية 3D','assets/game-covers/fishing.svg'],
 classic:['تحدّي المعرفة','مسابقة تفاعلية','assets/game-covers/classic.svg'],
 puzzle:['بازل الصور','تركيب الصور','assets/game-covers/puzzle.svg']
};
const gradeMeta:Record<string,[string,string,string,string]>={
 '7':['نجم الصف السابع','الصف السابع','من سيكون نجم الصف السابع هذا الأسبوع؟','أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف السابع.'],
 '8':['نجم الصف الثامن','الصف الثامن','من سيكون نجم الصف الثامن هذا الأسبوع؟','أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف الثامن.'],
 '9':['نجم الصف التاسع','الصف التاسع','من سيكون نجم الصف التاسع هذا الأسبوع؟','أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف التاسع.']
};
function toDigits(s:any){return String(s??'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));}
function normGradeText(s:any){return toDigits(s).trim().normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').toLowerCase();}
function getQatarWeek(nowInput?:any){
 const d=nowInput?new Date(nowInput):new Date(),ms=Number.isFinite(d.getTime())?d.getTime():Date.now();
 const q=new Date(ms+qatarOffsetMs),dow=q.getUTCDay(),y=q.getUTCFullYear(),m=q.getUTCMonth(),dt=q.getUTCDate();
 const startMs=Date.UTC(y,m,dt-dow,0,0,0,0)-qatarOffsetMs,endMs=Date.UTC(y,m,dt+(6-dow),23,59,59,999)-qatarOffsetMs;
 return {timezone:'Asia/Qatar',startMs,endMs,startIso:new Date(startMs).toISOString(),endIso:new Date(endMs).toISOString()};
}
function parseGrade(cls:any,sKey:any,sName:any,gradeMap:any){
 if(gradeMap&&typeof gradeMap==='object'){
  const m=String((sKey&&gradeMap[String(sKey).trim()])||(sName&&gradeMap[String(sName).trim()])||'').trim();
  if(['7','8','9'].includes(m))return m;
 }
 const raw=normGradeText(cls);if(!raw)return null;
 const w=['7','8','9'].filter((g,i)=>[/سابع/,/ثامن/,/تاسع/][i].test(raw));
 if(w.length===1)return w[0];if(w.length>1)return null;
 if(/(?:صف|الصف|grade)\s*(?:10|11|12|6|5|4)/.test(raw))return null;
 const p=raw.match(/^\s*([789])\s*[/\-\\]/);if(p)return p[1];
 const nums=new Set((raw.match(/(?:^|[^\d])([789])(?=$|[^\d])/g)||[]).map((t:string)=>t.replace(/\D/g,'')));
 return nums.size===1?[...nums][0]:null;
}
function formatStudentDisplay(rawName:any,sKey:any,settings:any){
 const cfg=settings||{};
 const optOut=Array.isArray(cfg.studentOptOut)?cfg.studentOptOut.map((x:any)=>normGradeText(x)):[];
 const nName=normGradeText(rawName),nKey=String(sKey||'').trim().toLowerCase();
 if(optOut.includes(nName)||(nKey&&optOut.includes(nKey)))return null;
 const dMap=cfg.studentDisplayNames&&typeof cfg.studentDisplayNames==='object'?cfg.studentDisplayNames:{};
 const exp=String((sKey&&dMap[String(sKey).trim()])||(rawName&&dMap[String(rawName).trim()])||'').trim();
 if(exp)return exp;
 const cleaned=String(rawName??'').replace(/\s+/g,' ').trim();
 if(cleaned.length<2||!nName||['طالب','طالبه','تجربه','تجريبي','معلم','ادمن','الاداره','اختبار','demo','test','student','admin','teacher','user','guest'].includes(nName)||/^(test|demo|admin|طالب\s*\d*|تجرب|\d+$)/.test(nName))return null;
 if(cfg.studentPrivacyMode==='approved_only')return null;
 const parts=cleaned.split(' ').filter(Boolean);
 if(cfg.studentPrivacyMode==='full'||parts.length===1)return parts.slice(0,3).join(' ');
 return parts.length===2?`${parts[0]} ${parts[1].charAt(0)}.`:`${parts[0]} ${parts[1].charAt(0)}. ${parts[parts.length-1]}`;
}
function extractYtId(input:any){
 const raw=String(input||'').trim();if(!raw)return '';if(/^[\w-]{11}$/.test(raw))return raw;
 const m=raw.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/v\/)([\w-]{11})/);
 return m?m[1]:'';
}
function mergeHomepageVideos(settings:any,platform:any,schoolVideos:any[]){
 const map=new Map<string,any>();
 const add=(item:any,sourceLabel:string)=>{
  if(!item)return;if(typeof item==='string')item={url:item};
  if(item.visible===false||item.show_on_homepage===false||item.published===false)return;
  const rawUrl=String(item.url||'').trim(),ytId=extractYtId(rawUrl)||extractYtId(item.id),isDirect=/^https:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(rawUrl);
  if(!ytId&&!isDirect)return;
  const key=ytId?`yt:${ytId}`:`url:${rawUrl.toLowerCase()}`;
  const norm={
   key,id:String(item.id||ytId||key),youtubeId:ytId||'',kind:ytId?'youtube':'direct',
   title:String(item.title||'فيديو تعليمي').trim()||'فيديو تعليمي',
   subject:String(item.subject||item.category||sourceLabel||'مكتبة المدرسة').trim(),
   url:ytId?`https://www.youtube.com/watch?v=${ytId}`:rawUrl,
   embedUrl:ytId?`https://www.youtube-nocookie.com/embed/${ytId}?rel=0`:rawUrl,
   thumbnail:String(item.thumbnail||(ytId?`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`:'')).trim(),
   featured:!!item.featured
  };
  if(!map.has(key))map.set(key,norm);
  else{
   const ex=map.get(key);
   if((!ex.title||/^فيديو\s*\d*$/.test(ex.title))&&norm.title&&!/^فيديو\s*\d*$/.test(norm.title))ex.title=norm.title;
   if(norm.featured)ex.featured=true;
  }
 };
 for(const v of (settings?.homepageVideos||[]))add(v,'إدارة المدرسة');
 if(platform?.showYoutubeSection!==false)for(const v of (platform?.youtubeVideos||[]))add(v,'القناة التعليمية');
 for(const v of (schoolVideos||[])){if(v&&(v.show_on_homepage===true||(v.show_on_homepage!==false&&!v.game_id)))add(v,v.subject||'شروحات المواد');}
 const list=[...map.values()];
 list.sort((a,b)=>Number(b.featured)-Number(a.featured));
 return list.slice(0,12);
}
function computeServerWeeklyHub(sessions:any[],assignments:any[],games:any[],teachers:any[],videos:any[],settings:any,nowInput?:any){
 const week=getQatarWeek(nowInput);
 const asMap=new Map((assignments||[]).map((a:any)=>[String(a.id),a]));
 const gMap=new Map((games||[]).map((g:any)=>[String(g.id),g]));
 const tMap=new Map((teachers||[]).map((t:any)=>[String(t.id),t]));
 const weekSessions=(sessions||[]).filter((s:any)=>{
  if(!s||s.mode==='demo')return false;
  const st=s.finished_at||s.created_at;if(!st)return false;
  const ms=new Date(st).getTime();return Number.isFinite(ms)&&ms>=week.startMs&&ms<=week.endMs;
 });
 const buckets:Record<string,Map<string,any>>={'7':new Map(),'8':new Map(),'9':new Map()};
 for(const s of weekSessions){
  if(!s.finished_at||s.pending===true||s.mode==='group'||s.mode==='demo')continue;
  const fMs=new Date(s.finished_at).getTime();if(!Number.isFinite(fMs)||fMs<week.startMs||fMs>week.endMs)continue;
  const score=Number(s.score);if(!Number.isFinite(score)||score<0||score>100)continue;
  const as:any=asMap.get(String(s.assignment_id||'')),g:any=as?gMap.get(String(as.game_id||'')):null;
  const grade=parseGrade(as?.class_name||s.class_name||g?.grade||g?.data?.grade||'',s.student_key,s.student_name,settings?.studentGradeMap);
  if(!grade||!buckets[grade])continue;
  const displayName=formatStudentDisplay(s.student_name,s.student_key,settings);if(!displayName)continue;
  const sid=String(s.student_key||normGradeText(s.student_name)).trim();if(!sid)continue;
  if(!buckets[grade].has(sid))buckets[grade].set(sid,{studentKey:sid,displayName,grade,className:String(as?.class_name||gradeMeta[grade][1]).trim(),byAs:new Map(),scores:[],passed:0,lastMs:fMs});
  const rec=buckets[grade].get(sid);rec.scores.push(score);
  if(score>=(Number(as?.settings?.passing_score)||70))rec.passed++;
  if(fMs>rec.lastMs)rec.lastMs=fMs;
  const aid=String(s.assignment_id||'general');if(!rec.byAs.has(aid))rec.byAs.set(aid,[]);rec.byAs.get(aid).push(score);
 }
 const champions=['7','8','9'].map(grade=>{
  const [title,gradeLabel,emptyPrompt,emptySubtext]=gradeMeta[grade];
  const cands:any[]=[];
  for(const r of buckets[grade].values()){
   let pts=0;for(const scs of r.byAs.values()){scs.sort((a:number,b:number)=>b-a);for(const sc of scs.slice(0,2))pts+=sc;}
   const cnt=r.scores.length,avg=Math.round(r.scores.reduce((a:number,b:number)=>a+b,0)/cnt);
   if(avg<50)continue;
   const dist=r.byAs.size,comp=pts+(dist*25)+(r.passed*15);
   cands.push({...r,completedCount:cnt,avgScore:avg,bestScore:Math.max(...r.scores),distinctAssignments:dist,compositeScore:comp});
  }
  cands.sort((a,b)=>b.compositeScore-a.compositeScore||b.avgScore-a.avgScore||b.distinctAssignments-a.distinctAssignments||a.lastMs-b.lastMs);
  const w=cands[0];
  if(!w)return {grade,title,gradeLabel,emptyPrompt,emptySubtext,hasWinner:false,studentName:null,className:gradeLabel,avgScore:null,completedCount:0,distinctAssignments:0,metricLabel:emptySubtext};
  const tw=w.distinctAssignments===1?'مهمة مكتملة':w.distinctAssignments===2?'مهمتان مكتملتان':`${w.distinctAssignments} مهمات مكتملة`;
  return {grade,title,gradeLabel,emptyPrompt,emptySubtext,hasWinner:true,studentName:w.displayName,className:w.className,avgScore:w.avgScore,bestScore:w.bestScore,completedCount:w.completedCount,distinctAssignments:w.distinctAssignments,compositeScore:w.compositeScore,metricLabel:`متوسط ${w.avgScore}% · ${tw}`};
 });
 const gCounts=new Map<string,any>();
 for(const s of weekSessions){
  const tpl=String(s.template||'');if(!gameTitles[tpl]||(s.mode!=='group'&&!s.finished_at))continue;
  if(!gCounts.has(tpl))gCounts.set(tpl,{key:tpl,name:gameTitles[tpl][0],badge:gameTitles[tpl][1],cover:gameTitles[tpl][2],sessionsCount:0,students:new Set()});
  const gc=gCounts.get(tpl);gc.sessionsCount++;if(s.student_key||s.student_name)gc.students.add(String(s.student_key||normGradeText(s.student_name)));
 }
 const sGames=[...gCounts.values()].filter(g=>g.sessionsCount>0).sort((a,b)=>b.sessionsCount-a.sessionsCount||b.students.size-a.students.size).slice(0,5);
 const maxG=sGames[0]?.sessionsCount||1;
 const topGames=sGames.map((g,i)=>({rank:i+1,key:g.key,name:g.name,badge:g.badge,cover:g.cover,sessionsCount:g.sessionsCount,uniqueStudents:g.students.size,sharePercent:Math.max(12,Math.round(g.sessionsCount*100/maxG))}));
 const tStats=new Map<string,any>();
 const ensureT=(tid:any,fb:any)=>{
  const id=String(tid||'').trim();if(!id)return null;const pr:any=tMap.get(id);if(pr&&pr.status==='موقوف')return null;
  if(!tStats.has(id))tStats.set(id,{id,name:String(pr?.name||fb||'').trim()||'معلم بالمدرسة',subjects:new Set(),asSet:new Set(),classSess:0,stuPart:0,tpls:new Set()});
  return tStats.get(id);
 };
 for(const a of (assignments||[])){
  const cMs=a?.created_at?new Date(a.created_at).getTime():0;if(!Number.isFinite(cMs)||cMs<week.startMs||cMs>week.endMs)continue;
  const g:any=gMap.get(String(a.game_id||'')),t=ensureT(a.teacher_id,g?.data?.teacher);if(t){t.asSet.add(String(a.id));if(g?.data?.subject)t.subjects.add(String(g.data.subject));}
 }
 for(const s of weekSessions){
  const as:any=asMap.get(String(s.assignment_id||'')),g:any=as?gMap.get(String(as.game_id||'')):null,t=ensureT(s.teacher_id,g?.data?.teacher);if(!t)continue;
  if(s.assignment_id)t.asSet.add(String(s.assignment_id));if(s.template)t.tpls.add(String(s.template));if(g?.data?.subject)t.subjects.add(String(g.data.subject));
  if(s.mode==='group')t.classSess++;else if(s.finished_at&&s.pending!==true){t.stuPart++;if(s.mode==='individual')t.classSess++;}
 }
 const activeTeachers=[...tStats.values()].map(t=>{
  const ac=t.asSet.size,score=(ac*30)+(t.classSess*20)+(t.stuPart*10)+(t.tpls.size*15);
  const parts:string[]=[];if(ac>0)parts.push(ac===1?'مهمة نشطة':ac===2?'مهمتان نشطتان':`${ac} مهمات نشطة`);if(t.stuPart>0)parts.push(`${t.stuPart} مشاركة طلابية`);
  return {id:t.id,name:t.name,subject:[...t.subjects].slice(0,2).join(' · ')||'مواد تعليمية',assignmentsCount:ac,classroomSessions:t.classSess,studentParticipations:t.stuPart,engagementScore:score,summaryText:parts.join(' · ')||'تفعيل مستمر للمنصة'};
 }).filter(t=>t.engagementScore>0&&t.name&&t.name!=='معلم بالمدرسة').sort((a,b)=>b.engagementScore-a.engagementScore||b.studentParticipations-a.studentParticipations).slice(0,5);
 return {week,champions,topGames,activeTeachers};
}
function validateConfig(x:any){if(!x||typeof x.name!=='string'||!x.name.trim())throw new Error('اكتب اسم المدرسة.');for(const c of ['primary','background'])if(!/^#[0-9a-f]{6}$/i.test(x[c]))throw new Error('لون غير صالح.');if(x.logo&&!/^https:\/\//.test(x.logo)&&!/^data:image\/(png|jpeg|webp);base64,/.test(x.logo))throw new Error('ارفع شعارًا بصيغة صورة.');if(JSON.stringify(x).length>500000)throw new Error('الإعدادات كبيرة جدًا.');x.socials=(x.socials||[]).slice(0,20).map((s:any)=>{if(!/^https:\/\//.test(s.url))throw new Error('روابط التواصل يجب أن تبدأ بـ https://');return {label:String(s.label).slice(0,60),url:s.url,visible:s.visible!==false};});x.sections=(x.sections||[]).filter((s:string)=>allowedSections.includes(s));if(Array.isArray(x.homepageVideos)){x.homepageVideos=x.homepageVideos.slice(0,20).filter((v:any)=>v&&((extractYtId(v.url)||extractYtId(v.id))||/^https:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(String(v.url||'')))).map((v:any)=>({id:String(v.id||extractYtId(v.url)||'').slice(0,64),title:String(v.title||'فيديو تعليمي').slice(0,160),subject:String(v.subject||'مكتبة المدرسة').slice(0,80),url:String(v.url||'').slice(0,500),featured:!!v.featured,visible:v.visible!==false}));}return x;}
export async function handle(req:Request){if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 if(req.method!=='POST')throw new Error('طلب غير صالح.');const raw=await req.text();if(raw.length>600000)throw new Error('الطلب كبير جدًا.');const b=JSON.parse(raw),a=b.action;let out:any;
 if(a==='settings')out=(await db('school_settings'))[0].data;
 else if(a==='homeHub'){
  const [settingsRows,platformRows,schoolVideos,assignments,games,teachers,sessions]=await Promise.all([
   db('school_settings').catch(()=>[]),
   db('platform_state','id=eq.public').catch(()=>[]),
   db('school_videos','order=created_at.desc&limit=50').catch(()=>[]),
   db('school_assignments','order=created_at.desc&limit=300').catch(()=>[]),
   db('manarat_games','select=id,teacher_id,title,data&limit=300').catch(()=>[]),
   db('profiles','select=id,name,status,role&limit=200').catch(()=>[]),
   db('school_sessions','select=id,assignment_id,teacher_id,student_name,student_key,mode,template,score,pending,finished_at,created_at&order=created_at.desc&limit=1500').catch(()=>[])
  ]);
  const settingsData=settingsRows?.[0]?.data||{};
  const platformData=platformRows?.[0]?.data?.platform||{};
  const videos=mergeHomepageVideos(settingsData,platformData,schoolVideos||[]);
  const weekly=computeServerWeeklyHub(sessions||[],assignments||[],games||[],teachers||[],schoolVideos||[],settingsData,b.now);
  const puzzleAvailable=(games||[]).some((g:any)=>(g?.data?.questions||[]).some((q:any)=>q?.type==='puzzle_image'));
  out={videos,weekly,puzzleAvailable,updatedAt:new Date().toISOString()};
 }
 else if(a==='register'){
 const ip=await hash(req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown');if(!await db('rpc/school_rate_limit','','POST',{k:'register:'+ip,maximum:120,seconds:3600}))throw new Error('محاولات كثيرة. حاول لاحقًا.');
 const email=await alias(b.username);if(String(b.password||'').length<8||String(b.name||'').trim().length<3)throw new Error('اكتب الاسم الكامل وكلمة مرور لا تقل عن 8 أحرف.');
 const r=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email,password:b.password,email_confirm:true,user_metadata:{name:String(b.name).slice(0,100),username:String(b.username).trim(),school:'مدرسة أبو عبيدة الإعدادية للبنين',educator_gender:'male'}})});if(!r.ok)throw new Error('اسم المستخدم مستخدم بالفعل أو بيانات التسجيل غير صالحة.');out={email};
 }else if(a==='loginAlias')out={email:String(b.username||'').includes('@')?String(b.username).trim():await alias(b.username)};
 else if(a==='open'){
 const as=(await db('school_assignments','code=eq.'+enc(b.code)+'&active=eq.true'))[0];if(!as)throw new Error('الرابط غير صالح أو أوقف المعلم المهمة.');if(as.settings.deadline&&new Date(as.settings.deadline)<new Date())throw new Error('انتهى موعد المهمة.');const g=(await db('manarat_games','id=eq.'+enc(as.game_id)))[0];
 const vs=await db('school_videos','teacher_id=eq.'+as.teacher_id);out={id:as.id,title:as.title,subject:String(g.data.subject||''),teacher:String(g.data.teacher||''),class_name:as.class_name,settings:as.settings,types:[...new Set((g.data.questions||[]).map((q:any)=>q.type))].filter(t=>types.includes(t as string)),videos:vs.filter((v:any)=>!v.game_id||v.game_id===g.id)};
 }else if(a==='start'){
 const as=(await db('school_assignments','code=eq.'+enc(b.code)+'&active=eq.true'))[0];if(!as)throw new Error('المهمة غير متاحة.');if(as.settings.deadline&&new Date(as.settings.deadline)<new Date())throw new Error('انتهى موعد المهمة.');
 const mode=b.mode||'home';if(!['home','individual','group'].includes(mode))throw new Error('نمط غير صالح.');if(mode!=='home'){const p=await requireUser(req);if(p.id!==as.teacher_id&&!p.admin)throw new Error('التشغيل الصفي متاح لصاحب المهمة.');}
 if(mode!=='group'&&!String(b.name||'').trim())throw new Error('اكتب اسم الطالب.');if(!(as.settings.templates||templates).includes(b.template)||!templates.includes(b.template))throw new Error('اختر لعبة متاحة.');
 const g=(await db('manarat_games','id=eq.'+enc(as.game_id)))[0];let qs=g.data.questions||[];const allowed=as.settings.types||types;qs=qs.filter((q:any)=>allowed.includes(q.type)&&(!b.type||q.type===b.type));if(!qs.length)throw new Error('لا توجد أسئلة من النوع المحدد.');qs=qs.slice(0,100).map((q:any)=>({...q,_classItems:(q.categories||[]).flatMap((c:any,category:number)=>(c.items||[]).map((it:any)=>({...it,id:crypto.randomUUID(),category}))).sort(()=>Math.random()-.5)}));const sk=String(b.student_key||crypto.randomUUID()).slice(0,100);
 const ip=await hash(req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown');if(!await db('rpc/school_rate_limit','','POST',{k:'start:'+ip,maximum:300,seconds:3600}))throw new Error('محاولات كثيرة. حاول لاحقًا.');
 const s=(await db('school_sessions','','POST',{assignment_id:as.id,teacher_id:as.teacher_id,student_name:mode==='group'?'':String(b.name).trim().slice(0,100),student_key:mode==='group'?'':sk,mode,template:b.template,questions:qs}))[0];
 out={id:s.id,secret:s.secret,questions:qs.map(cleanQuestion),student_key:sk,threshold:as.settings.passing_score||70};
 }else if(['answer','finish','leaderboard'].includes(a)){
 const s=(await db('school_sessions','id=eq.'+enc(b.id)+'&secret=eq.'+enc(b.secret)))[0];if(!s)throw new Error('جلسة غير صالحة.');
 if(a==='answer'){if(s.finished_at)throw new Error('انتهت المحاولة.');const q=s.questions.find((q:any)=>q.id===b.question);if(!q)throw new Error('سؤال غير صالح.');if(Object.hasOwn(s.answers,b.question))out=s.answers[b.question];else{out=grade(q,b.value);const rows=await db('school_sessions','id=eq.'+s.id+'&answers=eq.'+enc(JSON.stringify(s.answers))+'&finished_at=is.null','PATCH',{answers:{...s.answers,[b.question]:out}});if(!rows.length)throw new Error('تزامن طلبان. أعد المحاولة.');}}
 else if(a==='finish'){const answers=Object.values(s.answers) as any[];if(answers.length<s.questions.length)throw new Error('أكمل كل الأسئلة قبل إنهاء المهمة.');const score=Math.round(100*answers.reduce((n,x)=>n+x.points,0)/answers.reduce((n,x)=>n+x.max,0)),pending=answers.some(x=>x.pending);await db('school_sessions','id=eq.'+s.id,'PATCH',{score,pending,finished_at:s.finished_at||new Date().toISOString()});const as=(await db('school_assignments','id=eq.'+s.assignment_id))[0];out={score,pending,passed:!pending&&score>=(as.settings.passing_score||70),group:s.mode==='group'};}
 else{const as=(await db('school_assignments','id=eq.'+s.assignment_id))[0];out=as.settings.leaderboard===false?[]:await db('school_sessions','assignment_id=eq.'+s.assignment_id+'&mode=neq.group&pending=eq.false&finished_at=not.is.null&select=student_name,score&order=score.desc&limit=20');}
 }else{
 const p=await requireUser(req);
 if(a==='profile')out=p;
 else if(a==='dashboard'){const f=p.admin?'':'teacher_id=eq.'+p.id;
 const needs:Record<string,string[]>={teachers:['teachers'],students:['sessions','assignments','teachers'],reports:['sessions','assignments','teachers'],assignments:['assignments','games'],videos:['videos','games'],games:['games']};
 const selected=p.admin&&needs[b.panel]?needs[b.panel]:['games','assignments','videos','sessions','teachers'];
 const jobs:Record<string,()=>Promise<any>>={games:()=>dbAll('manarat_games',f+'&order=created_at.desc'),assignments:()=>dbAll('school_assignments',f+'&order=created_at.desc'),videos:()=>dbAll('school_videos',f+'&order=created_at.desc'),sessions:()=>dbAll('school_sessions',f+'&select=id,assignment_id,teacher_id,student_name,student_key,mode,template,score,pending,finished_at,created_at&order=created_at.desc'),teachers:()=>p.admin?db('profiles','select=id,name,email,status,role'):Promise.resolve([])};
 const values=await Promise.all(selected.map(k=>jobs[k]()));out={profile:p,games:[],assignments:[],videos:[],sessions:[],teachers:[]};selected.forEach((k,i)=>out[k]=values[i]);}

 else if(a==='assignment'){const g=await owned('manarat_games',b.game_id,p);const settings={templates:(b.templates||templates).filter((t:string)=>templates.includes(t)),types:(b.types||types).filter((t:string)=>types.includes(t)),passing_score:Math.max(1,Math.min(100,Number(b.passing_score)||70)),deadline:b.deadline||null,leaderboard:b.leaderboard!==false};if(!settings.templates.length||!settings.types.length)throw new Error('اختر لعبة ونوع سؤال واحدًا على الأقل.');out=(await db('school_assignments','','POST',{teacher_id:g.teacher_id,game_id:g.id,title:String(b.title||g.title).slice(0,160),class_name:String(b.class_name||'').slice(0,80),settings}))[0];}
 else if(a==='toggleAssignment'){await owned('school_assignments',b.id,p);out=await db('school_assignments','id=eq.'+enc(b.id),'PATCH',{active:!!b.active});}
 else if(a==='video'){if(!/^https:\/\//.test(b.url)||!String(b.title||'').trim())throw new Error('اكتب عنوانًا ورابط فيديو https صالحًا.');if(b.game_id)await owned('manarat_games',b.game_id,p);out=await db('school_videos','','POST',{teacher_id:p.id,title:String(b.title).slice(0,160),subject:String(b.subject||'').slice(0,80),url:b.url,game_id:b.game_id||null});}
 else if(a==='deleteVideo'){await owned('school_videos',b.id,p);out=await db('school_videos','id=eq.'+enc(b.id),'DELETE');}
 else if(a==='review'){out=await owned('school_sessions',b.id,p);delete out.secret;}
 else if(a==='grade'){const s=await owned('school_sessions',b.id,p);const ans=s.answers[b.question];if(!ans||!ans.pending)throw new Error('الإجابة ليست قيد التصحيح.');const pts=Number(b.points);if(!Number.isFinite(pts)||pts<0||pts>ans.max)throw new Error('درجة خارج النطاق.');const answers={...s.answers,[b.question]:{...ans,points:pts,pending:false,feedback:String(b.feedback||'تمت مراجعة المعلم.').slice(0,500)}};const ar=Object.values(answers) as any[];out=await db('school_sessions','id=eq.'+s.id,'PATCH',{answers,pending:ar.some(x=>x.pending),score:Math.round(100*ar.reduce((n,x)=>n+x.points,0)/ar.reduce((n,x)=>n+x.max,0))});}
 else if(a==='renameStudent'){const s=await owned('school_sessions',b.id,p);if(s.mode==='group'||!String(b.name||'').trim())throw new Error('اسم غير صالح.');out=await db('school_sessions','id=eq.'+s.id,'PATCH',{student_name:String(b.name).trim().slice(0,100),student_key:String(b.student_key||s.student_key).slice(0,100)});}
 else if(a==='saveSettings'||a==='restoreSettings'){if(!p.admin)throw new Error('للإدارة فقط.');const s=(await db('school_settings'))[0];const next=a==='restoreSettings'?s.history[Number(b.index)]?.data:b.data;validateConfig(next);out=await db('school_settings','id=eq.true','PATCH',{data:next,history:[{at:new Date().toISOString(),data:s.data},...s.history].slice(0,10),updated_at:new Date().toISOString()});}
 else if(a==='settingsHistory'){if(!p.admin)throw new Error('للإدارة فقط.');out=(await db('school_settings'))[0].history;}
 else if(a==='resetPassword'){if(!p.admin||p.id===b.id)throw new Error('هذه الأداة لحسابات المعلمين فقط.');const target=(await db('profiles','id=eq.'+enc(b.id)))[0];if(!target||target.role!=='teacher'||String(b.password||'').length<8)throw new Error('اختر معلمًا وكلمة مرور من 8 أحرف على الأقل.');const r=await fetch(base+'/auth/v1/admin/users/'+enc(b.id),{method:'PUT',headers,body:JSON.stringify({password:b.password})});if(!r.ok)throw new Error('تعذر إعادة التعيين.');out={ok:true};}
 else if(a==='teacherStatus'||a==='setRole'){if(!p.admin||p.id===b.id)throw new Error('لا يمكن تعديل صلاحية حسابك الحالي.');const target=(await db('profiles','id=eq.'+enc(b.id)))[0];if(!target||String(target.email).toLowerCase()==='m.samra103@gmail.com')throw new Error('الحساب غير موجود أو محمي.');if(a==='setRole'&&!['teacher','admin'].includes(b.role))throw new Error('صلاحية غير صالحة.');out=await db('profiles','id=eq.'+enc(b.id),'PATCH',a==='setRole'?{role:b.role}:{status:b.active?'نشط':'موقوف'});} 
 else throw new Error('طلب غير معروف.');
 }
 return new Response(JSON.stringify(out),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'تعذر تنفيذ الطلب.'}),{status:400,headers:{...cors,'Content-Type':'application/json'}});}}
Deno.serve(handle);
