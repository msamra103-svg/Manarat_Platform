/* Football V22 real human GLB asset, build and integration regression. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const txt=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=txt('games/football/index.html');
assert.match(html,/realistic-players\.js\?v=22/);
assert.match(html,/GLTFLoader\.r128\.js/);
assert.match(html,/SkeletonUtils\.r128\.js/);
assert.match(html,/premier-visuals\.js/);
assert.match(html,/sports\/game\.js/);
assert.match(txt('games/football/realistic-players.js'),/T\.SkeletonUtils/);
assert.match(txt('games/football/realistic-players.js'),/T\.AnimationMixer/);
assert.match(txt('games/football/realistic-players.js'),/sculptInto/);
assert.match(txt('games/football/realistic-players.js'),/item\.actor\.traverse/);
assert.match(txt('games/football/realistic-players.js'),/prior\.frame\(S,dt\)/);
assert.match(txt('games/sports/game.js'),/school-football-result/);
for(const name of ['real-football-motion.glb','real-football-sculpt.glb']){
 const p=path.join(root,'games/football/assets',name);
 assert(fs.existsSync(p),name+' missing from build');
 const b=fs.readFileSync(p);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert(b.byteLength>=1000000);
 const pub=path.join(root,'public/games/football/assets',name);
 if(fs.existsSync(pub))assert.equal(fs.statSync(pub).size,b.length);
}
assert(!html.includes('http://'),'Football page cannot call runtime HTTP assets');
console.log('Football V22: skeletal GLBs, animation, legacy protocol, and build assets OK');
