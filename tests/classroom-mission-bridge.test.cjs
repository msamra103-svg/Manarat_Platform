const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(mode){
 let tick,listener;const sent=[],feedback=[];
 const parent={postMessage:m=>sent.push(m)},game={startSession(){},finish(){},enterMenu(){},ui:{renderEnd(){},setHealth(){},feedback:(...args)=>feedback.push(args)},audio:{play(){}},controls:{enabled:true},rules:{wrongPenalty:20},prefs:{},state:'question',session:{index:0,health:100,maxHealth:100,missions:[{id:'q',wrong:[],solved:false}]}};
 const c={URLSearchParams,location:{search:'?school=1',origin:'https://school.test'},crypto:{randomUUID:()=> 'request-id'},setInterval:fn=>(tick=fn,1),clearInterval(){},setTimeout(){},document:{body:{classList:{add(){}}},getElementById:()=>null},window:{parent,__mmSchoolGame:game,addEventListener:(type,fn)=>listener=fn}};
 vm.runInNewContext(fs.readFileSync('games/muhimmat-almaarifa/school-bridge.js','utf8'),c);tick();
 const send=(message,source=parent,origin=c.location.origin)=>listener({source,origin,data:{protocol:'mm-school/1',game:'muhimmat-almaarifa',channel:'channel',...message}});
 send({type:'config',mode,questions:[{id:'q',text:'سؤال',options:[{id:'0',text:'أ'},{id:'1',text:'ب'}]}]});
 const attempt=()=>game.evaluate({optionId:'1',setState(){}});
 const grade={type:'grade',requestId:'request-id',index:0,correct:false,points:0,feedback:'إجابة غير صحيحة',explanation:'تفسير المعلم'};
 return {game,sent,feedback,attempt,send,grade,parent};
}
test('classroom mission shows the server explanation without losing health',()=>{
 const f=fixture('group');f.attempt();f.send(f.grade);assert.equal(f.game.session.health,100);assert.equal(f.game.state,'question');assert.equal(f.game.controls.enabled,true);assert.equal(f.feedback[0][2],'تفسير المعلم');
 f.send(f.grade);assert.equal(f.feedback.length,1,'duplicate grade ignored');
});
test('individual mission retains its challenge and rejects untrusted grade messages',()=>{
 const f=fixture('home');f.attempt();f.send(f.grade,{},'https://school.test');f.send(f.grade,f.parent,'https://other.test');assert.equal(f.game.session.health,100);
 f.send(f.grade);assert.equal(f.game.session.health,80);assert.equal(f.feedback.length,1);f.send(f.grade);assert.equal(f.game.session.health,80);
});
