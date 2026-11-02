// Server-authoritative classroom sessions; independent of the existing assignment API.
const base=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const actions=new Set(['upload_background','set_background','close_awards','replay_awards','create','list','join','state','answer','start','next','reveal','pause','resume','lock','kick','finish','report']);
const hostActions=new Set(['upload_background','set_background','close_awards','replay_awards','create','list','start','next','reveal','pause','resume','lock','kick','finish','report']);
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function rpc(name:string,data:unknown){const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok){const m=String(j?.message||'');throw new Error(/[\u0600-\u06ff]/.test(m)?m:'تعذر تنفيذ الطلب. تحقق من البيانات وأعد المحاولة.');}return j;}

async function uploadBackground(b:any,actor:string){
 const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(!ext[b.mime]||typeof b.base64!=='string'||b.base64.length>2000000||!/^[a-zA-Z0-9+/]+={0,2}$/.test(b.base64))throw Error('صيغة الصورة أو حجمها غير صالح.');
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(b.base64),c=>c.charCodeAt(0));}catch{throw Error('بيانات الصورة غير صالحة.');}
 if(bytes.length<12||bytes.length>1500000)throw Error('الصورة أكبر من المسموح بعد تجهيزها.');
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(b.mime==='image/png'&&png||b.mime==='image/jpeg'&&jpg||b.mime==='image/webp'&&webp))throw Error('محتوى الملف لا يطابق نوع الصورة.');
 const path=actor+'/live/'+crypto.randomUUID()+'.'+ext[b.mime];
 const r=await fetch(base+'/storage/v1/object/manarat-brand-assets/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':b.mime,'Cache-Control':'max-age=31536000','x-upsert':'false'},body:bytes});
 if(!r.ok)throw Error('تعذّر رفع الصورة. أعد المحاولة؛ الخلفية السابقة لم تتغير.');
 return {path};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  if(req.method!=='POST')throw new Error('طلب غير صالح.');
  const raw=await req.text();if(raw.length>2050000)throw new Error('الطلب أكبر من المسموح.');
  const b=JSON.parse(raw),action=String(b.action||'');if(!actions.has(action))throw new Error('إجراء غير صالح.');if(action!=='upload_background'&&raw.length>6000)throw new Error('الطلب أكبر من المسموح.');
  let actor:null|string=null;
  if(hostActions.has(action)||b.host===true){
   const authorization=req.headers.get('Authorization')||'';if(!authorization.startsWith('Bearer '))throw new Error('سجّل الدخول بحساب المعلم أولًا.');
   const r=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});if(!r.ok)throw new Error('انتهت جلسة المعلم. سجّل الدخول مجددًا.');actor=(await r.json()).id;
  }
  const secret=String(b.secret||'');if(!actor&&!/^[a-f0-9]{64}$/.test(secret))throw new Error('بيانات المشاركة غير صالحة.');
  if(!['create','list','upload_background'].includes(action)&&!/^\d{6}$/.test(String(b.code||'')))throw new Error('كود الجلسة من ستة أرقام.');
  if(action==='answer'&&(!Number.isInteger(b.choice)||!Number.isInteger(b.index)))throw new Error('اختيار غير صالح.');
  const ip=await hash(req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown');
  const limitKey=action==='upload_background'?'live-upload:'+actor:action==='join'?'live-join:'+ip:actor?'live-host:'+actor:'live-player:'+await hash(secret);
  if(!await rpc('school_rate_limit',{k:limitKey,maximum:action==='upload_background'?12:action==='join'?500:180,seconds:60}))throw new Error('طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.');
  if(action==='upload_background'){
   // Verify an active teacher/admin profile before writing any object.
   await rpc('live_session',{p_action:'list',p_data:{},p_actor:actor,p_secret:''});
   return Response.json(await uploadBackground(b,actor!),{headers:cors});
  }
  // Identity, score, timestamps and correctness are NEVER accepted from the request.
  const data={background_path:typeof b.background_path==='string'?b.background_path:'',avatar:/^qatar-(0[1-9]|1[0-2])$/.test(String(b.avatar||''))?b.avatar:'qatar-01',code:b.code,assignment:b.assignment,duration:b.duration,speed:b.speed===true,auto:b.auto===true,name:String(b.name||'').replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,'').trim(),index:b.index,choice:b.choice,version:b.version,player:b.player};
  const result=await rpc('live_session',{p_action:action,p_data:data,p_actor:actor,p_secret:actor?'':await hash(secret)});
  return Response.json(result,{headers:cors});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'تعذر الاتصال.'},{status:400,headers:cors});}
});
