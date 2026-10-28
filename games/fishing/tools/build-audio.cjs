#!/usr/bin/env node
/* Renders every procedural sound of صيد الأسماك V24 to games/fishing/assets/audio/<name>.wav (32 kHz, 16-bit mono).
 * The DSP is deterministic (seeded), so the WAV files are reproducible from source. Usage: node games/fishing/tools/build-audio.cjs */
'use strict';
const fs = require('fs'), path = require('path');
const A = require('../js/audio-dsp.js'), SR = 32000, out = path.join(__dirname, '..', 'assets', 'audio');
fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const name of A.NAMES) {
  const t0 = Date.now(), s = A.render(name, SR), file = path.join(out, name + '.wav');
  fs.writeFileSync(file, Buffer.from(A.wav(s, SR)));
  manifest[name] = { file: 'assets/audio/' + name + '.wav', seconds: +(s.length / SR).toFixed(3), sampleRate: SR, origin: 'procedurally synthesised by js/audio-dsp.js (original, project-owned)' };
  console.log(name.padEnd(11), (s.length / SR).toFixed(2) + ' s', (fs.statSync(file).size / 1024).toFixed(0) + ' KB', (Date.now() - t0) + ' ms');
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
