#!/usr/bin/env node
/* Real browser check for licensed rigged soccer players; preview branch only. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..','public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
function createServer(){
 return http.createServer((req,res)=>{
   const uri=decodeURIComponent(new URL(req.url,'http://127.0.0.1/').pathname);
   const file=path.resolve(root,'.'+uri);
   if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   fs.readFile(file,(err,data)=>{
     if(err){res.writeHead(404);res.end('Not found: '+uri);return;}
     res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
     res.end(data);
   });
 });
}
(async()=>{
 const server=createServer();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-web-security']});
  const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const failures=[];
  p.on('pageerror',e=>failures.push('PAGE ERROR '+e.message));
  p.on('console',m=>{if(m.type()==='error')failures.push('CONSOLE '+m.text());});
  await p.goto('http://127.0.0.1:'+port+'/games/football/index.html',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForFunction(()=>window.RealFootballRig?.status==='ready'||window.RealFootballRig?.status==='error',null,{timeout:60000});
  const state=await p.evaluate(()=>({model:window.RealFootballRig?.status,count:window.RealFootballRig?.count,error:window.RealFootballRig?.error,hasThree:!!window.THREE,source:window.RealFootballRig?.source}));
  await fs.promises.mkdir(path.resolve(__dirname,'../artifacts'),{recursive:true});
  await p.screenshot({path:path.resolve(__dirname,'../artifacts/football-v22-iphone.png'),fullPage:true});
  console.log('MOBILE FOOTBALL:',JSON.stringify(state),'BROWSER ERRORS:',failures.slice(0,12));
  assert.equal(state.model,'ready','3D athlete loading failed: '+state.error);
  assert.equal(state.count,10,'Expected 10 rigged soccer player instances');
  assert.equal(state.hasThree,true);
  await p.getByRole('button',{name:/ادخل الملعب/}).click();
  await p.getByRole('button',{name:/سدّد الكرة/}).click();
  await p.waitForFunction(()=>window.Football?.phase==='question',null,{timeout:20000});
  console.log('Football practice reached educational question successfully');
  await p.screenshot({path:path.resolve(__dirname,'../artifacts/football-v22-question.png'),fullPage:true});
  await p.close();
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
