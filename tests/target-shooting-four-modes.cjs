'use strict';
/* Four-mode guided educational gameplay: real mode assets, one mid-flight question,
   server-graded hit/miss; independent teacher package retains four manual challenges. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('games/target-shooting/game.js');
const config = require('../games/target-shooting/core/config.js');
const school = read('js/school.js');
const html = read('games/target-shooting/index.html');
const birds = read('games/target-shooting/modes/birds/birds.js');
const discs = read('games/target-shooting/modes/clay-discs/clay.js');
const PH = require('../games/target-shooting/physics/projectile.js');
assert.deepEqual(config.MODE_KEYS, ['archery', 'birds', 'balloons', 'clay']);
assert.match(game, /C\.MODE_KEYS\.forEach\(\(k, i\) =>/);
assert.match(game, /\$\('modeCards'\)\.hidden = false/);
assert.match(game, /if \(guided\) Object\.assign\(cfg, \{ mode: 'choice'/);
assert.match(game, /if \(guided\) prepareGuidedTarget\(\)/);
assert.match(game, /const target = guided \? guidedTarget\(\) : null/);
assert.match(game, /f\.flight\.t >= f\.pauseAt/);
assert.match(game, /phase\('midflight'\)/);
assert.match(game, /PH\.solveLaunch\(f\.flight\.p, dest, PH\.SPEED\)/);
assert.match(game, /post\('question'\)/);
assert.match(game, /S\.guidedDecision = r\.correct === true \? 'hit' : 'miss'/);
assert.match(school, /shooting:\{mode:'choice',difficulty:'beginner',arrowsPerQuestion:1/);
assert.match(html, /game\.js\?v=4-four-modes/);
assert.match(birds, /mode\.prepareGuidedTarget = function/);
assert.match(birds, /launch\(next\)/);
assert.match(birds, /mode\.guidedVisualStep = function/);
assert.match(discs, /mode\.prepareGuidedTarget = function/);
assert.match(discs, /launch\(\{ house: 'front'/);
assert.match(discs, /mode\.guidedVisualStep = function/);
// Real target coordinates and collision dimensions from the unchanged 3D scene modes.
const scenes = {
  archery: { target: { x: 0, y: 1.27, z: -12 }, kind: 'disc', r: .61 },
  birds: { target: { x: 0, y: 7, z: -22 }, kind: 'sphere', r: .7 },
  balloons: { target: { x: 0, y: 3.7, z: -15 }, kind: 'sphere', r: .33 },
  clay: { target: { x: .3, y: 5, z: -15 }, kind: 'sphere', r: .20 }
};
for(const [mode,{target,kind,r}] of Object.entries(scenes)) {
  for(const fps of [30,60,144]) {
    for(const correct of [true,false]) {
      const origin={x:.25,y:1.7,z:0};
      const goal=PH.solveLaunch(origin,target,PH.SPEED);
      assert.ok(goal, `${mode} initial shot can be solved`);
      const f=new PH.Flight(origin,goal.v,mode);
      const colliders=[{kind,c0:target,c1:target,n:{x:0,y:0,z:1},r}];
      while(f.t < goal.t*.43) assert.equal(f.step(PH.STEP,colliders),null, `${mode}: question must precede any hit`);
      const frozenPosition={...f.p};
      // Simulate question open for as long as required: arrow position stays unchanged.
      assert.deepEqual(f.p, frozenPosition, `${mode}: stays frozen until student answers`);
      const dest={...target,x:target.x+(correct?0:2.9)};
      const next=PH.solveLaunch(f.p,dest,PH.SPEED);assert.ok(next);
      Object.assign(f.v,next.v);f.tipOf(f.p,f.v,f.tip);Object.assign(f.prevTip,f.tip);
      let impact=null;
      for(let frame=0;frame<fps*2&&!impact;frame++){
        for(let j=0;j<Math.round(240/fps);j++) {
          impact=f.step(PH.STEP,colliders); if(impact) break;
          if(f.p.z < target.z-4) break;
        }
        if(f.p.z < target.z-4) break;
      }
      assert.equal(Boolean(impact),correct,`${mode}: ${correct?'correct hits':'wrong misses'} at ${fps} FPS`);
    }
  }
}
console.log('PASS four modes: selectable archery/birds/balloons/clay; one mid-flight question; graded hit/miss at 30/60/144 FPS');
