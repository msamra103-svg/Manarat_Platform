#!/usr/bin/env node
/* Fishing V24 local preview server (no dependencies).
 * Serves the repository root so games/fishing/index.html can reach ../vendor/three.min.js.
 * Usage: node games/fishing/tools/serve.cjs [port]   → http://localhost:8724/games/fishing/
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.md': 'text/markdown; charset=utf-8', '.mp3': 'audio/mpeg' };
function start(port = 8724) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}
if (require.main === module) start(Number(process.argv[2]) || 8724).then(s => console.log('Fishing V24 preview: http://localhost:' + s.address().port + '/games/fishing/'));
module.exports = { start, root };
