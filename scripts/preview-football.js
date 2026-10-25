#!/usr/bin/env node
/* Zero-dependency local preview of the football game (no deploy, no network, no database).
 *   node scripts/preview-football.js [port]      then open  http://127.0.0.1:<port>/games/football/
 * Useful query flags: ?mode=light|standard|pro  ?diff=0|1|2  ?q=0|1|2 (graphics tier)  ?reduced=1  ?lite=1  ?debug=1
 * ?demo=long (one very long Arabic question)  ?manual=1 (advance with Football.step(seconds) for deterministic screenshots/tests)
 * The page needs WebGL; without it the game offers its simplified no-WebGL mode. Served files are read-only. */
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), port = Number(process.argv[2]) || 8080;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.bin': 'application/octet-stream' };
http.createServer((req, res) => {
  let p = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (p.endsWith(path.sep)) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
}).listen(port, '127.0.0.1', () => console.log('Football preview: http://127.0.0.1:' + port + '/games/football/'));
