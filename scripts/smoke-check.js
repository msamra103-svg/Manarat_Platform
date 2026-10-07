#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const required = [
  'index.html',
  'auth.html',
  'admin/admin.html',
  'teacher/dashboard.html',
  'teacher/create-game.html',
  'player/game.html',
  'js/core.js',
  'js/admin.js',
  'js/dashboard.js',
  'js/create-game.js',
  'js/player.js',
  'css/main.css',
  'vercel.json',
  'netlify.toml',
  'supabase/functions/dynamic-handler/index.ts',
  'supabase/functions/dynamic-api/index.ts',
  'supabase/functions/send-whatsapp-message/index.ts',
  'supabase/functions/fetch-youtube-videos/index.ts',
];

let failed = false;
for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error('Missing:', rel);
    failed = true;
  }
}

const jsFiles = ['js/core.js','js/admin.js','js/dashboard.js','js/create-game.js','js/player.js','public/js/core.js','public/js/admin.js','public/js/dashboard.js','public/js/create-game.js','public/js/player.js'];
for (const rel of jsFiles) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) {
    const res = spawnSync(process.execPath, ['-c', p], { encoding: 'utf8' });
    if (res.status !== 0) {
      console.error('Syntax error:', rel);
      console.error(res.stderr);
      failed = true;
    }
  }
}

const textFiles = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory() && !['node_modules','.git'].includes(f)) walk(p);
    else if (st.isFile() && /\.(js|html|md|env|ts)$/i.test(f)) textFiles.push(p);
  }
}
walk(root);
for (const p of textFiles) {
  const txt = fs.readFileSync(p, 'utf8');
  if (/AIzaSy[A-Za-z0-9_\-]{20,}/.test(txt)) {
    console.error('Gemini API key appears in frontend/package file:', path.relative(root, p));
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Smoke check passed: required files, JS syntax, and frontend key scan are OK.');
