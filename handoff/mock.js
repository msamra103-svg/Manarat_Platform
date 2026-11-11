/* LOCAL PREVIEW ONLY. Never copy this file or its fixture auth into production. */
(()=>{'use strict';
if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname))throw new Error('UI preview must run on localhost');
const nativeFetch=window.fetch.bind(window),DBKEY='abu_ui_mock_v1';
const uid='22222222-2222-4222-8222-222222222222',aid='11111111-1111-4111-8111-111111111111';
const names={football:'كرة القدم',basketball:'كرة السلة',volleyball:'الكرة الطائرة',bowling:'البولينج',fishing:'صيد الأسماك','target-shooting':'التصويب على الهدف','qatar-runner':'عدّاء قطر','qatar-hero':'مغامرات بطل قطر',race:'سباق السيارات',puzzle:'بازل الصور',classic:'تحدّي المعرفة'};
const params=new URLSearchParams(location.search);let role=params.get('previewRole')||localStorage.getItem('abu_ui_role')||'guest';
if(location.pathname.includes('/admin/'))role='admin';if(params.has('adminPanel'))role='admin';
if(!['admin','teacher','guest'].includes(role))role='guest';localStorage.setItem('abu_ui_role',role);
const teachers=[{id:uid,name:'معلم تجريبي ١',email:'teacher1@preview.invalid',role:'teacher',status:'نشط',subject:'التربية الإسلامية',school:'مدرسة أبو عبيدة الإعدادية للبنين',educator_gender:'male'},{id:'33333333-3333-4333-8333-333333333333',name:'معلم تجريبي ٢',email:'teacher2@preview.invalid',role:'teacher',status:'موقوف',subject:'العلوم',educator_gender:'male'},{id:aid,name:'مدير تجريبي',email:'admin@preview.invalid',role:'admin',status:'نشط',educator_gender:'male'}];
const profile=()=>({...teachers.find(t=>t.id===(role==='admin'?aid:uid)),admin:role==='admin'});
const fixtureQuestions=[{id:'q-demo-1',type:'multiple_choice',text:'أي سلوك يحافظ على الماء؟',options:['إغلاق الصنبور بعد الاستخدام','ترك الصنبور مفتوحًا'],correct:0,points:10,attempts:1,explanation:'نحافظ على الماء بإغلاق الصنبور.'},{id:'q-demo-2',type:'true_false',text:'المحافظة على نظافة المدرسة مسؤولية الجميع.',options:['صح','خطأ'],correct:0,points:10,attempts:1},{id:'q-demo-3',type:'open_text',text:'اقترح فكرة للمحافظة على البيئة.',points:10,manual_grade:true,answers:[]}];
function initial(){
 const games=Object.entries(names).map(([template,title],i)=>({id:'44444444-4444-4444-8444-'+String(i+1).padStart(12,'0'),teacher_id:uid,teacher:'معلم تجريبي ١',teacher_email:'teacher1@preview.invalid',title:'نشاط تجريبي — '+title,subject:i%2?'العلوم':'التربية الإسلامية',grade:['السابع','الثامن','التاسع'][i%3],template,created_at:'2026-11-01T09:00:00Z',updated_at:'2026-11-10T09:00:00Z',data:{title:'نشاط تجريبي — '+title,teacher:'معلم تجريبي ١',subject:i%2?'العلوم':'التربية الإسلامية',grade:'السابع',questions:structuredClone(fixtureQuestions),template}}));
 const assignments=games.slice(0,4).map((g,i)=>({id:'55555555-5555-4555-8555-'+String(i+1).padStart(12,'0'),game_id:g.id,teacher_id:uid,title:g.title,class_name:['السابع / ١','الثامن / ٢','التاسع / ١','السابع / ٢'][i],code:String(i+1).padStart(24,'a'),active:i!==3,created_at:'2026-11-09T09:00:00Z',settings:{templates:['football','race','classic'],types:['multiple_choice','true_false','open_text'],passing_score:70,deadline:null,leaderboard:true}}));
 const sessions=Array.from({length:9},(_,i)=>({id:'66666666-6666-4666-8666-'+String(i+1).padStart(12,'0'),assignment_id:assignments[i%4].id,teacher_id:uid,student_name:i===8?'':'طالب تجريبي '+(i%4+1),student_key:i===8?'':'demo-student-'+(i%4+1),mode:i===8?'group':i%2?'home':'individual',template:i%2?'football':'classic',score:50+i*5,pending:i===6,created_at:'2026-11-'+String(3+i%7).padStart(2,'0')+'T09:00:00Z',finished_at:i===7?null:'2026-11-'+String(3+i%7).padStart(2,'0')+'T09:03:00Z',questions:structuredClone(fixtureQuestions),answers:{'q-demo-1':{value:0,points:10,max:10,correct:true,pending:false},'q-demo-3':{value:'نزرع الأشجار',points:0,max:10,pending:i===6}}}));
 return {settings:{name:'مدرسة أبو عبيدة الإعدادية للبنين',subtitle:'منصة التعلّم التفاعلي والألعاب التعليمية',hero:'تعلّم، العب، وتقدّم',description:'بيانات المعاينة تجريبية بالكامل. طوّر تصميم الواجهة مع الحفاظ على الوظائف.',primary:'#8a1538',background:'#f8f6f4',accent:'#ba965a',logo:'/assets/school-mark.svg',showMinistryLogo:false,ministryLogo:'',schoolImage:'',socials:[],about:'منصة تعليمية لمدرسة أبو عبيدة الإعدادية للبنين.',contactText:'بيانات تواصل تجريبية فقط',footerText:'مدرسة أبو عبيدة الإعدادية للبنين',uiGender:'male',homepageVideos:[],design:{font:'system',preset:'qatar'}},games,assignments,sessions,teachers,videos:[{id:'video-demo',title:'فيديو تعليمي تجريبي',subject:'العلوم',url:location.origin+'/dev/demo-video.mp4',teacher_id:uid,game_id:null}],history:[]};
}
let db;try{db=JSON.parse(localStorage.getItem(DBKEY)||'null')}catch{}if(!db)db=initial();
const save=()=>localStorage.setItem(DBKEY,JSON.stringify(db));
const normal=c=>window.ManaratDesign?.normalize?ManaratDesign.normalize(c):c;
const clone=v=>structuredClone(v);
const mock={calls:[],blocked:[],profile,role,db,save,names,fixtureQuestions};window.__uiMock=mock;
function response(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})}
async function school(b){mock.calls.push(b.action);const a=b.action;
 if(a==='settings')return normal(db.settings);
 if(a==='profile')return profile();
 if(a==='dashboard'){const p=profile();return {profile:p,games:clone(db.games),assignments:clone(db.assignments),sessions:clone(db.sessions),teachers:clone(db.teachers),videos:clone(db.videos)};}
 if(a==='homeHub')return {videos:[],puzzleAvailable:false,weekly:{week:{labelAr:'أسبوع تجريبي',timezone:'Asia/Qatar'},champions:['7','8','9'].map((g,i)=>({grade:g,title:['نجم الصف السابع','نجم الصف الثامن','نجم الصف التاسع'][i],gradeLabel:['الصف السابع','الصف الثامن','الصف التاسع'][i],hasWinner:i<2,studentName:i<2?'طالب تجريبي '+(i+1):null,className:g+' / ١',avgScore:95-i*5,metricLabel:'نتيجة اصطناعية للمعاينة',emptyPrompt:'لا توجد نتائج تجريبية لهذا الصف'})),topGames:['football','race','basketball'].map((g,i)=>({key:g,name:names[g],rank:i+1,badge:'معاينة',cover:'/assets/game-covers/'+g+'.svg',sessionsCount:30-i*5,uniqueStudents:10-i,sharePercent:100-i*20})),activeTeachers:[{name:'معلم تجريبي ١',subject:'التربية الإسلامية',summaryText:'بيانات للعرض فقط',engagementScore:300}]},analytics:{}};
 if(a==='designState')return {data:normal(db.settings),revision:'local-'+db.history.length,preview:true,publicVideos:[]};
 if(a==='saveDesign'||a==='saveSettings'){db.history.unshift({at:new Date().toISOString(),data:clone(db.settings)});db.settings=normal(b.data);save();return a==='saveDesign'?{data:db.settings,revision:'local-'+db.history.length}:db.settings;}
 if(a==='settingsHistory')return clone(db.history);
 if(a==='uploadDesignAsset')return {id:crypto.randomUUID(),name:b.name,url:'data:'+b.mime+';base64,'+b.base64};
 if(a==='loginAlias')return {email:'teacher1@preview.invalid'};
 if(a==='assignment'){const item={id:crypto.randomUUID(),teacher_id:uid,game_id:b.game_id,title:b.title,class_name:b.class_name,active:true,code:'abcdef012345abcdef012345',created_at:new Date().toISOString(),settings:{templates:b.templates,types:b.types,passing_score:Number(b.passing_score)||70,deadline:b.deadline,leaderboard:b.leaderboard}};db.assignments.unshift(item);save();return item;}
 if(a==='toggleAssignment'){const x=db.assignments.find(x=>x.id===b.id);if(x)x.active=b.active;save();return x||{};}
 if(a==='review')return clone(db.sessions.find(x=>x.id===b.id)||db.sessions[0]);
 if(a==='grade'){const s=db.sessions.find(x=>x.id===b.id);if(s){s.pending=false;s.answers[b.question]={value:s.answers[b.question]?.value,points:Number(b.points)||0,max:10,pending:false,feedback:b.feedback};}save();return {ok:true};}
 if(a==='renameStudent'){const s=db.sessions.find(x=>x.id===b.id);if(s){s.student_name=b.name;s.student_key=b.student_key||s.student_key;}save();return s||{};}
 if(a==='teacherStatus'||a==='setRole'){const t=db.teachers.find(x=>x.id===b.id);if(t){if(a==='teacherStatus')t.status=b.active?'نشط':'موقوف';else t.role=b.role;}save();return t||{};}
 if(a==='video'){const v={id:crypto.randomUUID(),teacher_id:uid,...b};db.videos.unshift(v);save();return v;}
 if(a==='deleteVideo'){db.videos=db.videos.filter(x=>x.id!==b.id);save();return {ok:true};}
 if(a==='open'){const x=clone(db.assignments[0]);return {...x,types:x.settings.types,videos:[],subject:'التربية الإسلامية',teacher:'معلم تجريبي ١'};}
 if(a==='resetPassword'||a==='register')return {ok:true,local_only:true};
 throw new Error('هذا الإجراء خارج محاكاة التصميم: '+a);
}
window.fetch=async(input,init={})=>{const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;const u=new URL(raw,location.href);let b={};try{b=JSON.parse(init.body||'{}')}catch{}
 if(u.hostname==='ui-preview.invalid'){
  try{if(u.pathname.endsWith('/school-api'))return response(await school(b));
   if(u.pathname.startsWith('/auth/'))return response({id:profile().id,email:profile().email,access_token:'local-preview-not-a-token',refresh_token:'local-preview-not-a-refresh',expires_at:4102444800,user:{id:profile().id,email:profile().email,user_metadata:{name:profile().name}}});
   if(u.pathname.includes('/rest/v1/')){const table=u.pathname.split('/').pop();const rows=table==='profiles'?db.teachers:table==='manarat_games'?db.games:table==='school_assignments'?db.assignments:table==='school_sessions'?db.sessions:table==='school_videos'?db.videos:table==='platform_state'?[{id:'public',data:{platform:window.Manarat?.store().platform||{}}}]:[];return response(rows);}
   return response({error:'خدمة غير متاحة في المعاينة المحلية'},400);
  }catch(e){return response({error:e.message},400);}
 }
 if(u.origin===location.origin&&(!init.method||['GET','HEAD'].includes(init.method)))return nativeFetch(input,init);
 mock.blocked.push(u.origin+u.pathname);throw new Error('الاتصال الخارجي معطّل في حزمة التصميم');
};
window.XMLHttpRequest=class{open(){throw new Error('XHR disabled in UI sandbox')}send(){throw new Error('XHR disabled')}};
window.WebSocket=class{constructor(){throw new Error('WebSocket disabled in UI sandbox')}};
window.EventSource=class{constructor(){throw new Error('EventSource disabled in UI sandbox')}};
try{navigator.sendBeacon=()=>false;}catch{}
document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a)return;try{const u=new URL(a.href);if(u.origin!==location.origin&&!['blob:','data:'].includes(u.protocol)){e.preventDefault();alert('الرابط الخارجي غير متاح في المعاينة المحلية.');}}catch{}},true);
document.addEventListener('DOMContentLoaded',()=>{const bar=document.createElement('div');bar.id='ui-sandbox-notice';bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#36232b;color:white;padding:5px;text-align:center;font:12px Arial';bar.textContent='معاينة محلية فقط — جميع الأسماء والنتائج تجريبية — لا يوجد نشر أو اتصال ببيانات المدرسة';document.body.append(bar);document.body.style.paddingBottom='28px';});
})();
