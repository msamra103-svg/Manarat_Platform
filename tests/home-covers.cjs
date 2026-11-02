const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const c={window:{},location:{origin:'https://school.test',href:'https://school.test/index.html'},URL,document:{querySelectorAll:()=>[]}};vm.createContext(c);vm.runInContext(fs.readFileSync('js/game-covers.js','utf8'),c);
const resolve=c.window.ManaratCovers.resolve;
for(const key of ['football','basketball','bowling','volleyball','fishing','race','target-shooting','qatar-runner','qatar-hero','classic','puzzle']){
 const current=resolve(key);assert(fs.existsSync(current),current);assert.equal(resolve(key,'assets/game-covers/'+key+'.svg'),current);assert.equal(resolve(key,'https://school.test/assets/game-covers/'+key+'.svg?v=old'),current);
 assert.equal(resolve(key,'https://teacher.test/custom.jpg'),'https://teacher.test/custom.jpg');
 assert.equal(resolve(key,'data:image/png;base64,custom'),'data:image/png;base64,custom');
}
assert(!fs.readFileSync('js/game-covers.js','utf8').includes('createElement'));
console.log('PASS current covers exist, saved legacy paths migrate, custom images survive, no preview iframe');
