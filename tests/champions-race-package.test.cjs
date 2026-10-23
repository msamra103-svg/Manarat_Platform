'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const {unpackRace}=require('../scripts/unpack-champions-race.js');
const r=unpackRace(root);
assert.equal(r.installed,true);
assert.equal(r.files,9);
for(const p of [
 'assets/car_concept_hi.js','assets/car_concept_lod.js',
 'assets/ferrari_458_hi.js','assets/ferrari_458_lod.js',
 'assets/draco-decoder.js','vendor/GLTFLoader.js',
 'vendor/DRACOLoader.js','vendor/THREE_LICENSE.txt','vendor/jszip.min.js'
]) assert(fs.statSync(path.join(root,'games','champions-race',p)).size>0,'Missing '+p);
console.log('PASS Champions Race ZIP integrity + 9 bundled assets');
