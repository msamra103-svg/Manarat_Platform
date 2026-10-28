#!/usr/bin/env node
/* Writes games/fishing/docs/FILE_MANIFEST_V24.md: every file of the package with status vs the base commit
 * (from SOURCE_MANIFEST.json git blob SHAs), size and SHA-256. Usage: node games/fishing/tools/make-manifest.cjs */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..', '..', '..'), base = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/SOURCE_MANIFEST.json'), 'utf8'));
const baseSha = Object.fromEntries(base.files.map(f => [f.path, f.sha])), rows = [];
const walk = d => { for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const p = path.posix.join(d, e.name); if (['node_modules', 'dist', '.git', 'public'].includes(e.name)) continue; if (e.isDirectory()) walk(p); else rows.push(p.replace(/^\.\//, '')); } };
walk('games/fishing');
for (const file of base.files) if (!rows.includes(file.path)) rows.push(file.path);
for (const file of fs.readdirSync(path.join(root, 'tests'))) if (/^fishing-.*\.cjs$/.test(file)) rows.push('tests/' + file);
const out = ['# صيد الأسماك V24 — file manifest', '', 'Status compares against the base commit `' + base.sourceCommit + '` (SOURCE_MANIFEST.json).', '', '| Status | Path | Bytes | SHA-256 |', '|---|---|---:|---|'];
const count = { new: 0, modified: 0, unchanged: 0 };
for (const p of rows.sort()) {
  if (p === 'games/fishing/docs/FILE_MANIFEST_V24.md') continue;
  const b = fs.readFileSync(path.join(root, p)), git = crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
  const st = baseSha[p] ? (baseSha[p] === git ? 'unchanged' : 'modified') : 'new'; count[st]++;
  out.push(`| ${st} | \`${p}\` | ${b.length} | \`${crypto.createHash('sha256').update(b).digest('hex').slice(0, 16)}…\` |`);
}
out.splice(4, 0, `Totals: ${count.new} new, ${count.modified} modified (fishing entry and package scripts), ${count.unchanged} unchanged base files.`, '');
fs.writeFileSync(path.join(root, 'games/fishing/docs/FILE_MANIFEST_V24.md'), out.join('\n') + '\n');
console.log(count);
