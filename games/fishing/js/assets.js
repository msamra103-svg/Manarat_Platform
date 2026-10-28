/* صيد الأسماك V24 — model loading. Primary path: local GLB files in assets/models (GLTFLoader, r128).
 * Offline (file://) path: the same GLBs embedded as base64 in assets/models/embedded-models.js when present.
 * Last resort: rebuild the identical models procedurally from js/models/*.js. The chosen source is reported.
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const FILES = { boat: 'boat.glb', fisherman: 'fisherman.glb', tackle: 'tackle.glb', hamour: 'fish-hamour.glb', shaari: 'fish-shaari.glb', safi: 'fish-safi.glb' };
  const REQUIRED = {
    boat: ['hull', 'deck', 'cooler', 'cooler-lid', 'outboard'],
    fisherman: ['root', 'spine01', 'neck01', 'head', 'upperarm01_R', 'lowerarm01_R', 'wrist_R', 'upperarm01_L', 'lowerarm01_L', 'wrist_L', 'upperleg01_R', 'lowerleg01_R', 'foot_R', 'upperleg01_L', 'lowerleg01_L', 'foot_L', 'finger2-1_R', 'angler-skin', 'angler-vest'],
    tackle: ['reel', 'reel-rotor', 'reel-crank', 'reel-bail', 'rod-grip', 'rod-guide', 'float', 'sinker', 'hook', 'bait', 'landing-net', 'net-tube'],
    hamour: ['body'], shaari: ['body'], safi: ['body']
  };
  function b64ToBuffer(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function parse(buffer) { return new Promise((res, rej) => { const l = new T.GLTFLoader(); l.parse(buffer, '', g => res(g.scene), rej); }); }
  function valid(key, obj) { const miss = REQUIRED[key].filter(n => !obj.getObjectByName(n)); return { ok: !miss.length, miss }; }
  function procedural(key) {
    if (key === 'boat') return root.FishingBoatModel.build();
    if (key === 'fisherman') return root.FishingFishermanModel.build();
    if (key === 'tackle') return root.FishingTackleModel.build();
    return root.FishingFishModel.build(key);
  }
  async function loadOne(key, report) {
    const emb = root.FISHING_EMBEDDED_MODELS && root.FISHING_EMBEDDED_MODELS[key];
    try {
      if (!T.GLTFLoader) throw new Error('GLTFLoader missing');
      let buffer = null, source = 'glb';
      if (location.protocol !== 'file:') { const r = await fetch('assets/models/' + FILES[key], { cache: 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status); buffer = await r.arrayBuffer(); }
      else if (emb) { buffer = b64ToBuffer(emb); source = 'embedded-glb'; }
      else throw new Error('offline without embedded models');
      const scene = await parse(buffer), check = valid(key, scene);
      if (!check.ok) throw new Error('missing nodes ' + check.miss.join(','));
      const obj = scene.children.length === 1 ? scene.children[0] : scene; obj.updateMatrixWorld(true);
      report[key] = { source, bytes: buffer.byteLength }; return obj;
    } catch (e) {
      if (emb && location.protocol !== 'file:') { try { const scene = await parse(b64ToBuffer(emb)); if (valid(key, scene).ok) { report[key] = { source: 'embedded-glb', note: String(e.message || e) }; return scene.children[0]; } } catch (e2) { /* fall through */ } }
      report[key] = { source: 'procedural', note: String(e.message || e) }; return procedural(key);
    }
  }
  async function loadAll(onProgress) {
    const report = {}, out = {}, keys = Object.keys(FILES); let done = 0;
    await Promise.all(keys.map(async k => { out[k] = await loadOne(k, report); done++; if (onProgress) onProgress(done / keys.length); }));
    const t = out.tackle, pick = n => { const o = t.getObjectByName(n); if (o && o.parent) o.parent.remove(o); return o; };
    out.parts = { reel: pick('reel'), grip: pick('rod-grip'), guide: pick('rod-guide'), float: pick('float'), sinker: pick('sinker'), hook: pick('hook'), net: pick('landing-net') };
    out.fish = { hamour: out.hamour, shaari: out.shaari, safi: out.safi };
    // GLTF textures are sRGB-encoded by the loader; make sure fins keep alpha cut-outs and meshes cast shadows
    [out.boat, out.fisherman].forEach(o => o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }));
    out.report = report; out.source = Object.values(report).every(r => r.source === 'glb') ? 'glb' : Object.values(report).some(r => r.source === 'procedural') ? 'mixed-procedural' : 'embedded-glb';
    return out;
  }
  root.FishingAssets = { loadAll, FILES, REQUIRED, procedural };
})(window);
