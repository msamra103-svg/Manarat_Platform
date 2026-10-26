/* Loads the bowling game's real browser scripts (Three r128 + local add-ons) into Node for tests.
 * No GPU: WebGLRenderer is never constructed here. GLB files are parsed with the real GLTFLoader
 * and the real meshopt WASM decoder. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
function loadThree(extra = []) {
  const THREE = { ...require(path.join(ROOT, 'games/vendor/three.min.js')) };
  const ctx = { THREE, console, TextDecoder, TextEncoder, WebAssembly, Promise, setTimeout, clearTimeout, URL, Blob: globalThis.Blob, self: {}, Math, Date, fetch: undefined };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const files = ['games/bowling/vendor/GLTFLoader.js', 'games/bowling/vendor/SkeletonUtils.js', 'games/bowling/vendor/meshopt_decoder.js', ...extra];
  for (const f of files) {
    let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (f.endsWith('meshopt_decoder.js')) src += '\n;window.MeshoptDecoder = MeshoptDecoder;';
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx;
}
function parseGLB(ctx, rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new ctx.THREE.GLTFLoader();
  loader.setMeshoptDecoder(ctx.MeshoptDecoder);
  return new Promise((res, rej) => loader.parse(ab, '', res, rej));
}
module.exports = { loadThree, parseGLB, ROOT };
