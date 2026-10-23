#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),errors=[];let scripts=0,links=0;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>['node_modules','.git'].includes(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
for(const file of walk(root)){
 const rel=path.relative(root,file);
 if(/\.(js|cjs)$/.test(file)){try{new vm.Script(fs.readFileSync(file,'utf8'),{filename:rel});scripts++}catch(e){errors.push(e.message)}}
 if(/\.(js|html|ts)$/.test(file)&&/AIzaSy[A-Za-z0-9_\-]{20,}|sb_secret_[A-Za-z0-9_-]{20,}/.test(fs.readFileSync(file,'utf8')))errors.push('Private API key: '+rel);
 if(file.endsWith('.html')){
  const html=fs.readFileSync(file,'utf8');for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){const scriptType=match[1].match(/\btype\s*=\s*["']([^"']+)["']/i);if(/\bsrc\s*=/.test(match[1])||(scriptType&&!/^(?:module|text\/javascript|application\/javascript)$/i.test(scriptType[1]))||!match[2].trim())continue;try{new vm.Script(match[2],{filename:rel+' inline'});scripts++}catch(e){errors.push(e.message)}}
  for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){const url=match[1].split(/[?#]/)[0];if(!url||/^(?:[a-z]+:|\/\/|#)/i.test(url))continue;const target=path.resolve(path.dirname(file),url);if(!fs.existsSync(target))errors.push(rel+' references missing '+url);links++}
 }
}
for(const dir of ['js','css','assets','admin','teacher','player','games'])for(const file of walk(path.join(root,dir))){const rel=path.relative(root,file),mirror=path.join(root,'public',rel);if(!fs.existsSync(mirror)||!fs.readFileSync(file).equals(fs.readFileSync(mirror)))errors.push('Mirror mismatch: '+rel)}
for(const rel of ['public/index.html','public/auth.html','supabase/01_UPGRADE_V17_1.sql','scripts/serve.js','vercel.json','netlify.toml'])if(!fs.existsSync(path.join(root,rel)))errors.push('Missing '+rel);
if(fs.existsSync(path.join(root,'supabase/functions/send-whatsapp-message')))errors.push('Forbidden WhatsApp Edge Function exists');
for(const file of walk(root)){const rel=path.relative(root,file);if(rel==='scripts/smoke-check.js'||rel.startsWith('.playwright-cli'))continue;if(/\.(js|ts|html|css|env|example|md)$/i.test(file)&&/WHATSAPP_|send-whatsapp-message|contactWhatsApp|whatsappDirect|wa\.me\//i.test(fs.readFileSync(file,'utf8')))errors.push('Forbidden WhatsApp reference in '+rel)}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log(`PASS: ${scripts} JS/inline syntax checks; ${links} local references; mirrored assets; private-key & zero-WhatsApp scan.`);

