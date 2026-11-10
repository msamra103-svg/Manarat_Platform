'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('js/school.js');
const apiCode=source.slice(source.indexOf('async function api('),source.indexOf('\nfunction notice('));
const restartCode=source.slice(source.indexOf('async function restartSession('),source.indexOf('\nfunction endSession('));
assert(apiCode.startsWith('async function api('));
assert(restartCode.startsWith('async function restartSession('));
function fixture(options={}){
 const state={session:options.session===undefined?{access_token:'old-fixture-token'}:options.session,refreshes:0,requests:[],brokerCalls:[],renders:0};
 const window={};window.parent=window;
 if(options.broker)window.parent={ManaratAdminRequests:{request:async(action,payload)=>{state.brokerCalls.push({action,payload});return {id:'broker-session'};}}};
 const context={window,adminPanel:options.broker?'assignments':null,play:options.play||null,endpoint:'https://example.invalid/school-api',KEY:'publishable-fixture',M:{
  ensureFreshSession:async()=>{state.refreshes++;if(options.refreshError)throw new Error(options.refreshError);if(options.refreshToken)state.session={access_token:options.refreshToken};return state.session;},
  authSession:()=>state.session
 },fetch:async(url,init)=>{state.requests.push({url,...init,body:JSON.parse(init.body)});return {ok:!options.serverError,json:async()=>options.serverError?{error:options.serverError}:{id:'session-'+state.requests.length,secret:'fixture-secret',questions:[]}};},controlsBusy:()=>false,close:()=>{},renderPlay:()=>{state.renders++;},renderJoin:()=>{},startDemo:()=>{}};
 vm.createContext(context);vm.runInContext(apiCode+'\n'+restartCode,context);
 return {state,context,api:context.api,restart:context.restartSession};
}
const startArgs=mode=>({code:'fixture-assignment',mode,name:mode==='group'?'':'طالب الاختبار',student_key:'fixture-key',template:'classic',type:''});
test('group start sends the teacher bearer after refreshing the session',async()=>{
 const f=fixture({refreshToken:'fresh-fixture-token'}),args=startArgs('group');await f.api('start',args);
 assert.equal(f.state.refreshes,1);assert.equal(f.state.requests[0].headers.Authorization,'Bearer fresh-fixture-token');assert.deepEqual(f.state.requests[0].body,{action:'start',...args});
});
test('individual classroom start sends the teacher bearer',async()=>{
 const f=fixture();await f.api('start',startArgs('individual'));assert.equal(f.state.refreshes,1);assert.equal(f.state.requests[0].headers.Authorization,'Bearer old-fixture-token');
});
for(const mode of ['group','individual']){
 test(mode+' restart retains mode and obtains a fresh teacher bearer',async()=>{
  const args=startArgs(mode),old={id:'old-session',questions:[],template:'classic',startArgs:args};const f=fixture({play:old,refreshToken:'restart-fixture-token'});await f.restart();
  assert.equal(f.state.requests[0].headers.Authorization,'Bearer restart-fixture-token');assert.equal(f.state.requests[0].body.mode,mode);assert.equal(f.state.requests[0].body.code,args.code);assert.equal(f.context.play.startArgs.mode,mode);assert.equal(f.state.renders,1);assert.equal(old.lifecyclePending,false);
 });
 test(mode+' without a teacher token fails before sending the request',async()=>{
  const f=fixture({session:null});await assert.rejects(f.api('start',startArgs(mode)),/جلسة المعلم/);assert.equal(f.state.requests.length,0);
 });
 test(mode+' does not send a stale token after refresh fails',async()=>{
  const f=fixture({refreshError:'expired fixture'});await assert.rejects(f.api('start',startArgs(mode)),/expired fixture/);assert.equal(f.state.requests.length,0);
 });
}
test('homework works anonymously without refreshing a teacher session',async()=>{
 const f=fixture({session:null,refreshError:'must not refresh'});await f.api('start',startArgs('home'));assert.equal(f.state.refreshes,0);assert.equal(f.state.requests[0].headers.Authorization,undefined);
});
test('default start mode remains public homework',async()=>{
 const f=fixture({session:null});await f.api('start',{code:'fixture-assignment',name:'طالب',template:'classic'});assert.equal(f.state.refreshes,0);assert.equal(f.state.requests[0].headers.Authorization,undefined);
});
test('expired teacher session cannot block home student entry',async()=>{
 const f=fixture({refreshError:'expired fixture'});await f.api('start',startArgs('home'));assert.equal(f.state.refreshes,0);assert.equal(f.state.requests[0].headers.Authorization,undefined);
});
test('homework restart remains anonymous',async()=>{
 const f=fixture({session:null,play:{id:'old',template:'classic',startArgs:startArgs('home')}});await f.restart();assert.equal(f.state.refreshes,0);assert.equal(f.state.requests[0].headers.Authorization,undefined);assert.equal(f.state.renders,1);
});
test('all existing public endpoints remain anonymous',async()=>{
 for(const action of ['settings','homeHub','open','answer','finish','leaderboard','register','loginAlias']){const f=fixture({refreshError:'must not refresh'});await f.api(action,{id:'fixture',secret:'fixture'});assert.equal(f.state.refreshes,0,action);assert.equal(f.state.requests[0].headers.Authorization,undefined,action);}
});
test('dashboard still authenticates and server authorization errors are preserved',async()=>{
 const f=fixture({serverError:'لا تملك صلاحية الوصول إلى هذا المحتوى.'});await assert.rejects(f.api('dashboard'),/لا تملك صلاحية/);assert.equal(f.state.refreshes,1);assert.equal(f.state.requests[0].headers.Authorization,'Bearer old-fixture-token');
});
test('embedded admin requests still use the existing authenticated broker',async()=>{
 const f=fixture({broker:true});const result=await f.api('start',startArgs('group'));assert.equal(result.id,'broker-session');assert.equal(f.state.brokerCalls.length,1);assert.equal(f.state.requests.length,0);
});
test('failed restart releases its busy state and keeps the previous session',async()=>{
 const old={id:'old',template:'classic',startArgs:startArgs('group')};const f=fixture({play:old,refreshError:'expired fixture'});await assert.rejects(f.restart(),/expired fixture/);assert.equal(old.lifecyclePending,false);assert.equal(f.context.play,old);assert.equal(f.state.renders,0);
});
test('local demonstration answers do not acquire teacher authentication',async()=>{
 const f=fixture({session:null,play:{id:'demo',demo:true,questions:[{id:'q',type:'multiple_choice',correct:0,points:10}]}});const result=await f.api('answer',{id:'demo',question:'q',value:0});assert.equal(result.correct,true);assert.equal(f.state.refreshes,0);assert.equal(f.state.requests.length,0);
});
test('source and production mirrors and cache version stay in sync',()=>{
 assert.equal(read('public/js/school.js'),source);assert.equal(read('public/index.html'),read('index.html'));assert.match(read('index.html'),/js\/school\.js\?v=21\.12-classroom-auth/);
});
