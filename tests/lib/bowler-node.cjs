/* Builds the real bowling rig in Node: GLB parsed by the real GLTFLoader + meshopt WASM decoder,
 * the real athlete.js / motion.js / bowler.js, textures replaced by empty THREE.Texture objects
 * (no GPU). Used by the anatomy / attachment tests. */
'use strict';
const { loadThree, parseGLB } = require('./three-node.cjs');
async function makeBowler({ variant = 'b', hand = 'right' } = {}) {
  const ctx = loadThree([]);
  ctx.BowlingPhysics = require('../../games/bowling/physics.js');
  ctx.BowlingMotion = require('../../games/bowling/motion.js');
  const fs = require('fs'), path = require('path'), vm = require('vm');
  for (const f of ['games/bowling/athlete.js', 'games/bowling/bowler.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../..', f), 'utf8'), ctx, { filename: f });
  await ctx.MeshoptDecoder.ready;
  const T = ctx.THREE;
  const g = await parseGLB(ctx, 'games/bowling/assets/models/athlete_' + variant + '.glb');
  const c = await parseGLB(ctx, 'games/bowling/assets/models/clips.glb');
  const tex = () => new T.Texture();
  const lib = { create: opts => new ctx.BowlingAthlete.Athlete(g, c.animations, tex, opts) };
  const bowler = ctx.BowlingBowler.create(lib, { variant, hand, kitTexture: new T.Texture() });
  return { ctx, T, bowler, P: ctx.BowlingPhysics, M: ctx.BowlingMotion };
}
module.exports = { makeBowler };
