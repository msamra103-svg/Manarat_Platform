#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');
require('./unpack-champions-race').unpackRace(root);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = new Set(fs.readdirSync(src));
    for (const entry of fs.readdirSync(dest)) {
      if (!entries.has(entry)) fs.rmSync(path.join(dest, entry), { recursive: true, force: true });
    }
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

for (const file of ['index.html', 'auth.html', '_redirects', 'live.html']) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) copyRecursive(src, path.join(pub, file));
}

for (const dir of ['js', 'css', 'assets', 'admin', 'teacher', 'player', 'games', 'ui-redesign']) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) copyRecursive(src, path.join(pub, dir));
}

console.log('Synced root assets to public/');
