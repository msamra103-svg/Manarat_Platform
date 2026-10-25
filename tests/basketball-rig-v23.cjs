// Two-bone IK used for arms/legs, tested on a real Three.js r128 bone chain (Node). Run: node tests/basketball-rig-v23.cjs
const assert = require('node:assert/strict'), fs = require('fs'), vm = require('vm');
const THREE = { ...require('../games/vendor/three.min.js') };
const ctx = { THREE, window: { THREE }, Math, console }; ctx.window.window = ctx.window; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('games/basketball/athletes.js', 'utf8'), ctx);
const { solveTwoBone } = ctx.window.BasketballAthletes;

function chain() {
  const root = new THREE.Object3D(), a = new THREE.Bone(), b = new THREE.Bone(), c = new THREE.Bone();
  root.add(a); a.add(b); b.add(c);
  a.position.set(0, 1.4, 0); b.position.set(0, -0.29, 0); c.position.set(0, -0.27, 0); // upper arm / forearm
  a.quaternion.setFromEuler(new THREE.Euler(0.2, 0.1, 0.3)); b.quaternion.setFromEuler(new THREE.Euler(-0.4, 0, 0));
  root.rotation.y = 0.7; root.updateMatrixWorld(true);
  return { root, a, b, c };
}
const wp = o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
let n = 0;
for (let i = 0; i < 300; i++) {
  const { a, b, c } = chain();
  const A = wp(a), dir = new THREE.Vector3(Math.sin(i * 1.3), Math.cos(i * 0.7), Math.sin(i * 2.1)).normalize();
  const reach = 0.12 + (i % 50) / 50 * 0.42; // 0.12..0.54 (< 0.56 total)
  const target = A.clone().addScaledVector(dir, reach);
  const pole = A.clone().add(new THREE.Vector3(0.3, -0.5, -0.4));
  solveTwoBone(a, b, c, target, pole, 1);
  const err = wp(c).distanceTo(target);
  assert(err < 1e-3, 'reaches target (err ' + err + ')');
  // bone lengths preserved (no stretching)
  assert(Math.abs(wp(a).distanceTo(wp(b)) - 0.29) < 1e-6 && Math.abs(wp(b).distanceTo(wp(c)) - 0.27) < 1e-6, 'rigid bones');
  // middle joint bends toward the pole side
  const B = wp(b), axis = target.clone().sub(A).normalize();
  const side = B.clone().sub(A).projectOnPlane(axis), pl = pole.clone().sub(A).projectOnPlane(axis);
  if (side.length() > 1e-3 && pl.length() > 1e-3) assert(side.normalize().dot(pl.normalize()) > 0.98, 'elbow/knee follows pole');
  n++;
}
// unreachable target: straightened toward it, never stretched
{
  const { a, b, c } = chain(); const A = wp(a);
  const target = A.clone().add(new THREE.Vector3(0.9, 0, 0));
  solveTwoBone(a, b, c, target, A.clone().add(new THREE.Vector3(0, -1, 0)), 1);
  const C = wp(c); assert(C.distanceTo(A) <= 0.56 + 1e-6 && C.distanceTo(A) > 0.55, 'clamped to full extension');
  assert(C.clone().sub(A).normalize().dot(new THREE.Vector3(1, 0, 0)) > 0.999, 'points at target');
}
console.log(`PASS basketball rig v23: two-bone IK reaches ${n} random targets <1 mm, rigid bones, pole-consistent joints, clamps unreachable targets`);
