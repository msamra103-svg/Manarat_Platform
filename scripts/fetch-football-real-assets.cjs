#!/usr/bin/env node
/* Bundle licensed human-footballer GLBs into this platform at build time.
 * Sources: GameplayFootball (Unlicense) converted/sculpted by soccerviewer (MIT).
 * No third-party runtime/CDN requests in the shipped classroom game.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const https=require('node:https');
const root=path.resolve(__dirname,'..');
const base='https://raw.githubusercontent.com/andrewRowlinson/soccerviewer/main/match/assets/';
const items=[
 {file:'real-football-motion.glb',source:'clips.glb',bytes:2121256},
 {file:'real-football-sculpt.glb',source:'tpose_sculpted.glb',bytes:1320336}
];
function download(url,destination,redirects=0){
 if(redirects>5)return Promise.reject(new Error('Too many HTTP redirects'));
 return new Promise((resolve,reject)=>{
   const req=https.get(url,{timeout:25000,headers:{'User-Agent':'Manarat-Football-Build/22'}},res=>{
     const code=res.statusCode;
     if([301,302,303,307,308].includes(code)&&res.headers.location){
       res.resume();
       download(new URL(res.headers.location,url).href,destination,redirects+1).then(resolve,reject);return;
     }
     if(code!==200){res.resume();reject(new Error('Asset download status '+code+': '+url));return;}
     const out=fs.createWriteStream(destination);
     res.pipe(out);
     out.on('finish',()=>out.close(resolve));
     out.on('error',reject);res.on('error',reject);
   });
   req.on('timeout',()=>req.destroy(new Error('Football asset download timed out')));
   req.on('error',reject);
 });
}
async function main(){
 const folder=path.join(root,'games','football','assets');
 fs.mkdirSync(folder,{recursive:true});
 for(const asset of items){
   const dest=path.join(folder,asset.file);
   if(fs.existsSync(dest)&&fs.statSync(dest).size===asset.bytes)continue;
   const temp=dest+'.tmp-'+process.pid;
   try{
     await download(base+asset.source,temp);
     const bytes=fs.readFileSync(temp);
     if(bytes.length!==asset.bytes||bytes.toString('ascii',0,4)!=='glTF')
       throw new Error('Invalid GLB download: '+asset.file+' size='+bytes.length);
     fs.renameSync(temp,dest);
     console.log('Bundled licensed footballer model:',asset.file,bytes.length,'bytes');
   }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 }
}
main().catch(err=>{console.error('[football-assets]',err.message);process.exitCode=1;});
