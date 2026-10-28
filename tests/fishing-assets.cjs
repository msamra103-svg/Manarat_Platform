/* Fishing V24 — asset & isolation tests: real GLB models (structure + required rig/scene nodes, no external
 * resources), WAV audio, licences for every shipped asset, no CDN/online dependency, shared files untouched. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), assert = require('node:assert/strict');
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };
const G = 'games/fishing/';
// required node names straight from the runtime loader
const ctx = { window: {}, THREE: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(G + 'js/assets.js', 'utf8'), ctx); const { FILES, REQUIRED } = ctx.window.FishingAssets;
function readGlb(file) {
  const b = fs.readFileSync(file); ok(b.toString('ascii', 0, 4) === 'glTF', file + ' magic'); ok(b.readUInt32LE(4) === 2, file + ' glTF 2.0'); ok(b.readUInt32LE(8) === b.length, file + ' length header');
  const jl = b.readUInt32LE(12); ok(b.toString('ascii', 16, 20) === 'JSON', file + ' JSON chunk'); const json = JSON.parse(b.toString('utf8', 20, 20 + jl));
  const binOff = 20 + jl; ok(b.toString('ascii', binOff + 4, binOff + 8) === 'BIN\0', file + ' BIN chunk'); return { json, bin: b.readUInt32LE(binOff) };
}
let tris = 0;
for (const [key, file] of Object.entries(FILES)) {
  const { json, bin } = readGlb(G + 'assets/models/' + file);
  const names = new Set((json.nodes || []).map(n => n.name)); for (const n of REQUIRED[key]) ok(names.has(n), `${file} has node "${n}"`);
  ok((json.buffers || []).every(x => !x.uri), file + ' buffers embedded'); ok((json.images || []).every(i => !i.uri && Number.isInteger(i.bufferView)), file + ' textures embedded');
  ok((json.meshes || []).length > 0 && (json.accessors || []).length > 0 && bin > 1000, file + ' has mesh data');
  for (const a of json.accessors) { ok(a.bufferView !== undefined && a.count > 0, file + ' accessor'); if (a.min) ok(a.min.every(Number.isFinite) && a.max.every(Number.isFinite), file + ' finite bounds'); }
  json.meshes.forEach(m => m.primitives.forEach(p => { const acc = json.accessors[p.indices !== undefined ? p.indices : p.attributes.POSITION]; tris += acc.count / 3; }));
}
ok(tris > 40000, 'substantial geometry across models (' + Math.round(tris) + ' triangles)');
// embedded copy for offline use matches the GLB files byte-for-byte
{ const w = {}; vm.runInNewContext(fs.readFileSync(G + 'assets/models/embedded-models.js', 'utf8'), { window: w }); for (const [k, f] of Object.entries(FILES)) ok(Buffer.from(w.FISHING_EMBEDDED_MODELS[k], 'base64').equals(fs.readFileSync(G + 'assets/models/' + f)), 'embedded ' + k + ' identical'); }
// audio
const am = JSON.parse(fs.readFileSync(G + 'assets/audio/manifest.json', 'utf8'));
for (const [n, e] of Object.entries(am)) { const b = fs.readFileSync(G + e.file); ok(b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE', n + ' wav'); ok(b.readUInt32LE(24) === 32000 && b.readUInt16LE(34) === 16, n + ' 32 kHz/16-bit'); ok(b.readUInt32LE(40) > 1000, n + ' has samples'); }
const dsp = require('../games/fishing/js/audio-dsp.js'); ok(dsp.NAMES.every(n => am[n]), 'every synthesised sound rendered');
ok(Buffer.from(dsp.wav(dsp.render('bell', 32000), 32000)).equals(fs.readFileSync(G + 'assets/audio/bell.wav')), 'audio rendering reproducible from source');
// licences
const lic = fs.readFileSync(G + 'docs/LICENCES_V24.md', 'utf8');
for (const dir of ['assets/models', 'assets/audio', 'assets/textures', 'vendor']) for (const f of fs.readdirSync(G + dir)) ok(lic.includes(f), 'licence entry for ' + dir + '/' + f);
// offline: no CDN / remote URLs in runtime files
const runtime = []; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['tools', 'vendor', 'docs', 'assets'].includes(e.name)) walk(p); } else if (/\.(js|html|css)$/.test(e.name)) runtime.push(p); }); walk(G);
for (const f of runtime) { const s = fs.readFileSync(f, 'utf8'); ok(!/https?:\/\//.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), 'no remote URL in ' + f); ok(!/fonts\.googleapis|cdn\.|unpkg|jsdelivr/.test(s), 'no CDN in ' + f); }
const html = fs.readFileSync(G + 'index.html', 'utf8');
ok(!/experiences\/|sports\//.test(html), 'index.html no longer loads the shared experiences/sports engine');
ok(html.includes('<title>صيد الأسماك</title>') && html.includes('مدرسة أبو عبيدة الإعدادية للبنين'), 'exact game and school names');
ok(html.includes('../vendor/three.min.js') && html.includes('../../js/platform-nav.js'), 'references shared three.js + platform nav without copying');
// shared files untouched (git blob sha from SOURCE_MANIFEST.json)
const man = JSON.parse(fs.readFileSync(G + 'docs/SOURCE_MANIFEST.json', 'utf8'));
for (const e of man.files) { if (['games/fishing/index.html', 'package.json'].includes(e.path)) continue; const b = fs.readFileSync(e.path), sha = crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex'); ok(sha === e.sha, 'unchanged: ' + e.path); }
// Integration adds npm scripts; existing dependencies and scripts must survive.
const sourcePackage = JSON.parse(fs.readFileSync(G + 'docs/SOURCE_PACKAGE.json', 'utf8'));
const currentPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const key of ['dependencies', 'devDependencies']) { assert.deepEqual(currentPackage[key], sourcePackage[key]); checks++; }
for (const [name, command] of Object.entries(sourcePackage.scripts)) ok(currentPackage.scripts[name] === command, 'existing script preserved: ' + name);
ok(!!currentPackage.scripts['test:live'], 'live competition tests preserved');
console.log(`PASS fishing assets & isolation (${checks} checks): 6 GLB models with rig/scene nodes, ${Object.keys(am).length} WAV sounds, licences, offline-only runtime, shared engine files byte-identical`);
