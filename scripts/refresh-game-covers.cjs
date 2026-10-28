/* Real 3D screenshots for the current published homepage game cards. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=process.cwd();
const routes={football:'games/football/index.html',basketball:'games/basketball/index.html',volleyball:'games/volleyball/index.html',bowling:'games/bowling/index.html',fishing:'games/fishing/index.html',race:'games/champions-race/index.html'};
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg'};
let playwright;try{playwright=require('playwright')}catch(e){console.error('Run npm ci first');process.exit(1)}
const server=http.createServer((req,res)=>{let u;try{u=new URL(req.url,'http://127.0.0.1')}catch{res.writeHead(400);return res.end()}const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data)})});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1'));
 let browser;let done=0;
 try{
  browser=await playwright.chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [name,route] of Object.entries(routes)){
   const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
   try{
    const response=await page.goto('http://127.0.0.1:'+server.address().port+'/'+route,{waitUntil:'domcontentloaded',timeout:45000});
    if(!response?.ok())throw Error('HTTP '+response?.status());
    await page.waitForTimeout(8500);
    const jpeg=await page.screenshot({type:'jpeg',quality:85,animations:'disabled',timeout:30000});
    if(jpeg.length<9500)throw Error('Screenshot too small');
    const cover='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><image width="640" height="360" href="data:image/jpeg;base64,'+jpeg.toString('base64')+'"/></svg>\n';
    for(const prefix of ['','public/']){const out=path.join(root,prefix,'assets/game-covers',name+'.svg');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,cover)}
    console.log('UPDATED '+name+' from latest '+route);done++;
   }catch(e){console.warn('SKIPPED '+name+': '+e.message)}
   finally{await page.close()}
  }
 }finally{if(browser)await browser.close();server.close()}
 console.log('3D screenshots applied: '+done+'/6');if(done<6)process.exitCode=2;
})().catch(e=>{console.error(e);server.close();process.exitCode=1});