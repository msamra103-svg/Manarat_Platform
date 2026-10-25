// Server-authoritative classroom sessions; independent of the existing assignment API.
const base=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const actions=new Set(['create','list','join','state','answer','start','next','reveal','pause','resume','lock','kick','finish','report']);
const hostActions=new Set(['create','list','start','next','reveal','pause','resume','lock','kick','finish','report']);
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function rpc(name:string,data:unknown){const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok){const m=String(j?.message||'');throw new Error(/[\u0600-\u06ff]/.test(m)?m:'تعذر تنفيذ الطلب. تحقق من البيانات وأعد المحاولة.');}return j;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  if(req.method!=='POST')throw new Error('طلب غير صالح.');
  const raw=await req.text();if(raw.length>6000)throw new Error('الطلب أكبر من المسموح.');
  const b=JSON.parse(raw),action=String(b.action||'');if(!actions.has(action))throw new Error('إجراء غير صالح.');
  let actor:null|string=null;
  if(hostActions.has(action)||b.host===true){
   const authorization=req.headers.get('Authorization')||'';if(!authorization.startsWith('Bearer '))throw new Error('سجّل الدخول بحساب المعلم أولًا.');
   const r=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});if(!r.ok)throw new Error('انتهت جلسة المعلم. سجّل الدخول مجددًا.');actor=(await r.json()).id;
  }
  const secret=String(b.secret||'');if(!actor&&!/^[a-f0-9]{64}$/.test(secret))throw new Error('بيانات المشاركة غير صالحة.');
  if(!['create','list'].includes(action)&&!/^\d{6}$/.test(String(b.code||'')))throw new Error('كود الجلسة من ستة أرقام.');
  if(action==='answer'&&(!Number.isInteger(b.choice)||!Number.isInteger(b.index)))throw new Error('اختيار غير صالح.');
  const ip=await hash(req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown');
  const limitKey=action==='join'?'live-join:'+ip:actor?'live-host:'+actor:'live-player:'+await hash(secret);
  if(!await rpc('school_rate_limit',{k:limitKey,maximum:action==='join'?500:180,seconds:60}))throw new Error('طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.');
  // Identity, score, timestamps and correctness are NEVER accepted from the request.
  const data={code:b.code,assignment:b.assignment,duration:b.duration,speed:b.speed===true,auto:b.auto===true,name:String(b.name||'').replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,'').trim(),index:b.index,choice:b.choice,version:b.version,player:b.player};
  const result=await rpc('live_session',{p_action:action,p_data:data,p_actor:actor,p_secret:actor?'':await hash(secret)});
  return Response.json(result,{headers:cors});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'تعذر الاتصال.'},{status:400,headers:cors});}
});
