#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const ROOT=path.resolve(__dirname,'..');
const SHA256='c0eea8c9a1f75ebb78e06829bb488dd37837dd7c5087f1e1df2e654e351ff701';
const N=14;
const ALLOWED=new Set([
 'assets/draco-decoder.js','assets/ferrari_458_lod.js',
 'assets/car_concept_hi.js','assets/car_concept_lod.js',
 'assets/ferrari_458_hi.js','vendor/DRACOLoader.js',
 'vendor/THREE_LICENSE.txt','vendor/jszip.min.js','vendor/GLTFLoader.js'
]);
function unpackRace(root=ROOT){
 const partsDir=path.join(root,'bundles','champions-race-v8');
 if(!fs.existsSync(partsDir))return {installed:false,reason:'bundle absent'};
 const chunks=[];
 for(let n=1;n<=N;n++){
  const part=path.join(partsDir,`part-${String(n).padStart(2,'0')}.bin`);
  if(!fs.existsSync(part))throw Error('Missing racing model part '+n);
  chunks.push(fs.readFileSync(part));
 }
 const zip=Buffer.concat(chunks);
 if(crypto.createHash('sha256').update(zip).digest('hex')!==SHA256)
  throw Error('Champions Race asset bundle SHA-256 integrity check failed');
 let at=0;
 const extracted=new Map();
 while(at+4<=zip.length){
  const signature=zip.readUInt32LE(at);
  if(signature===0x02014b50||signature===0x06054b50)break;
  if(signature!==0x04034b50||at+30>zip.length)throw Error('Invalid ZIP local entry');
  const flags=zip.readUInt16LE(at+6),method=zip.readUInt16LE(at+8);
  if(flags&0x8 || (method!==8&&method!==0))throw Error('Unsupported ZIP entry encoding');
  const compressed=zip.readUInt32LE(at+18),size=zip.readUInt32LE(at+22);
  const filenameLength=zip.readUInt16LE(at+26),extraLength=zip.readUInt16LE(at+28);
  const start=at+30,body=start+filenameLength+extraLength,end=body+compressed;
  if(end>zip.length||size>20000000)throw Error('Invalid ZIP entry size');
  const name=zip.subarray(start,start+filenameLength).toString('utf8');
  if(!ALLOWED.has(name)||extracted.has(name))throw Error('Unexpected ZIP entry '+name);
  const data=method===8?zlib.inflateRawSync(zip.subarray(body,end)):zip.subarray(body,end);
  if(data.length!==size)throw Error('Incorrect uncompressed ZIP length for '+name);
  extracted.set(name,data);
  at=end;
 }
 if(extracted.size!==ALLOWED.size)throw Error('Incomplete Champions Race asset bundle');
 const output=path.join(root,'games','champions-race');
 for(const [name,data] of extracted){
  const dest=path.join(output,name);fs.mkdirSync(path.dirname(dest),{recursive:true});
  const temp=dest+'.race-v8-tmp';fs.writeFileSync(temp,data);fs.renameSync(temp,dest);
 }
 return {installed:true,files:extracted.size,bytes:zip.length};
}
if(require.main===module)console.log('Champions Race assets:',unpackRace());
module.exports={unpackRace};
