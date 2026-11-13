const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const tables={school_settings:[{id:true,data:{name:'المدرسة',primary:'#8a1538',background:'#ffffff',socials:[],sections:[]},history:[],updated_at:'2026-10-22T00:00:00.000Z'}],profiles:[{id:'owner',role:'admin',status:'نشط'},{id:'teacher',role:'teacher',status:'نشط'},{id:'other',role:'teacher',status:'نشط'}],manarat_games:[{id:'game',teacher_id:'teacher',title:'عنوان الاختبار',data:{questions:[{id:'q1',type:'multiple_choice',correct:1,options:['أ','ب'],text:'اختر',points:10},{id:'q2',type:'open_text',manual_grade:true,text:'اشرح',points:10}]}}],school_assignments:[{id:'assignment',teacher_id:'teacher',game_id:'game',code:'secret-code',active:true,settings:{templates:['race'],types:['multiple_choice','open_text']}}],school_sessions:[],school_videos:[]};
let handler;const context={console,crypto,Response,Request,TextEncoder,URL,fetch:async(url,opts={})=>{const u=new URL(url);if(u.pathname==='/auth/v1/user'){const token=opts.headers.Authorization.slice(7);return Response.json({id:token},{status:['owner','teacher','other'].includes(token)?200:401});}const table=u.pathname.split('/').pop(),method=opts.method||'GET',body=opts.body&&JSON.parse(opts.body);if(table==='school_rate_limit')return Response.json(true);let rows=(tables[table]||[]).filter(r=>{for(const [k,v]of u.searchParams){if(['select','order','limit'].includes(k)||!k)continue;const [op,...tail]=v.split('.'),value=tail.join('.');if(op==='eq'&&String(typeof r[k]==='object'?JSON.stringify(r[k]):r[k])!==value)return false;if(op==='is'&&value==='null'&&r[k]!=null)return false;if(op==='neq'&&String(r[k])===value)return false;}return true;});if(method==='POST'){rows=[{id:crypto.randomUUID(),secret:'attempt-secret',answers:{},created_at:new Date().toISOString(),...body}];(tables[table]||=[]).push(...rows);}if(method==='PATCH')rows.forEach(r=>Object.assign(r,body));if(method==='DELETE')tables[table]=tables[table].filter(r=>!rows.includes(r));return Response.json(rows);},Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://mock.invalid':'server-key'},serve:h=>handler=h}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../supabase/functions/_shared/design-schema.js','utf8'),context);vm.runInContext(stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/school-api/index.ts','utf8').replace("import '../_shared/design-schema.js';",'').replace('const DESIGN_PREVIEW=true','const DESIGN_PREVIEW=false')).replace('export async function','async function'),context);
async function call(action,b={},token){const res=await handler(new Request('https://mock.invalid',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify({action,...b})}));return{status:res.status,json:await res.json()};}
(async()=>{
const id='qatar-camel-race';
const settings=(await call('settings')).json;assert(settings.design.gameOrder.includes(id));assert(settings.design.games[id].visible);assert(!settings.heroGames.includes('puzzle'));
const qs=Array.from({length:10},(_,i)=>({id:'camel-'+i,type:i%2?'true_false':'multiple_choice',text:'سؤال '+i,options:['صواب','خطأ'],correct:0,points:10}));
tables.manarat_games[0].data.questions=[...qs,{id:'essay',type:'open_text',text:'اشرح',points:10}];
assert.equal((await call('assignment',{game_id:'game',templates:[id],types:['multiple_choice','true_false','open_text']},'other')).status,400);
const assigned=await call('assignment',{game_id:'game',templates:[id],types:['multiple_choice','true_false','open_text']},'teacher');assert.equal(assigned.status,200);assert.deepEqual(assigned.json.settings.templates,[id]);
Object.assign(tables.school_assignments.find(x=>x.id===assigned.json.id),{code:'camel-code',active:true});
for(const mode of ['home','individual','group']){
 const startArgs={code:'camel-code',template:id,mode,name:'الاسم الحقيقي للطالب'};
 if(mode!=='home'){
  assert.equal((await call('start',startArgs)).status,400);
  assert.equal((await call('start',startArgs,'other')).status,400);
 }
 const started=await call('start',startArgs,mode==='home'?undefined:'teacher');assert.equal(started.status,200,JSON.stringify(started.json));
 const s=started.json;assert.equal(s.questions.length,10);assert(s.questions.every(q=>!('correct' in q)&&!('answers' in q)));
 assert.equal((await call('finish',{id:s.id,secret:s.secret})).status,400);
 for(let i=0;i<10;i++){
  const a=await call('answer',{id:s.id,secret:s.secret,question:qs[i].id,value:i%2,points:999});assert.equal(a.json.points,i%2?0:10);
  const duplicate=await call('answer',{id:s.id,secret:s.secret,question:qs[i].id,value:1-(i%2)});assert.equal(duplicate.json.points,a.json.points);
 }
 const done=await call('finish',{id:s.id,secret:s.secret,points:99999});assert.equal(done.status,200);assert.equal(done.json.score,50);assert.equal(done.json.group,mode==='group');
 const row=tables.school_sessions.find(x=>x.id===s.id);assert.equal(row.student_name,mode==='group'?'':'الاسم الحقيقي للطالب');assert.equal(row.template,id);
 const again=await call('start',startArgs,mode==='home'?undefined:'teacher');assert.equal(again.status,200);assert.notEqual(again.json.id,s.id);
 console.log('PASS camel '+mode+' full ten questions, auth, score, identity, duplicate answer and independent replay');
}
assert.equal((await call('start',{code:'secret-code',template:id,name:'طالب'})).status,400,'Old assignment allowlist is not silently broadened');
assert.equal((await call('start',{code:'camel-code',template:id,name:'طالب',type:'open_text'})).status,400,'Unsupported types rejected');
const tf=await call('start',{code:'camel-code',template:id,name:'طالب',type:'true_false'});assert.equal(tf.json.questions.length,5);
console.log('CAMEL SERVER ALL PASS; no live records used.');
})().catch(e=>{console.error(e);process.exit(1)});
