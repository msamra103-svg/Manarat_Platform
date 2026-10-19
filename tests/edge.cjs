// Execute Edge handlers locally with ALL network requests mocked.
const {stripTypeScriptTypes}=require('node:module');
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
function load(name,fetch){let handler;const code=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../supabase/functions',name,'index.ts'),'utf8'));vm.runInNewContext(code,{Deno:{env:{get:()=> 'test-only'},serve:f=>handler=f},fetch,Response,Request,Headers,console,TextEncoder,TextDecoder,URL,AbortController,setTimeout,clearTimeout});return handler;}
(async()=>{
for(const folder of fs.readdirSync(path.join(__dirname,'../supabase/functions'))){const file=path.join(__dirname,'../supabase/functions',folder,'index.ts');if(fs.existsSync(file))new vm.Script(stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/export (?=async function|function|const)/g,''));}
console.log('PASS all Edge TypeScript parses');
for(const name of ['dynamic-api','delete-user-admin']){
let admin=true,targetEmail='m.samra103@gmail.com',deletes=0;
const handler=load(name,async(url,opt={})=>{
if(url.endsWith('/auth/v1/user'))return Response.json({id:'admin-2',email:'admin2@test.invalid'});
if(url.endsWith('/rpc/is_admin'))return Response.json(admin);
if(url.includes('/auth/v1/admin/users/')){if(opt.method==='DELETE'){deletes++;return Response.json({})}return Response.json({id:'target',email:targetEmail});}
throw new Error('Unexpected network '+url);
});
const req=()=>new Request('https://test.invalid',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({id:'target',email:'forged@test.invalid'})});
assert.equal((await handler(req())).status,400);assert.equal(deletes,0);
admin=false;assert.equal((await handler(req())).status,403);assert.equal(deletes,0);
admin=true;targetEmail='teacher@test.invalid';assert.equal((await handler(req())).status,200);assert.equal(deletes,1);
console.log('PASS '+name+': canonical owner protected; non-admin denied; teacher deletion path mocked');
}
for(const name of ['dynamic-handler','generate-questions','generate-questions-from-pdf']){
let network=0;const handler=load(name,async()=>{network++;throw new Error('Unauthenticated request reached network')});const res=await handler(new Request('https://test.invalid',{method:'POST',body:'{}'}));assert(res.status>=400);assert.equal(network,0);console.log('PASS '+name+': no AI request without user token');
}
console.log('EDGE ALL PASS');
})().catch(e=>{console.error(e);process.exit(1)});
