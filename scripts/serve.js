const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../public'),port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch(e){res.writeHead(400);return res.end('Bad request')}
 const aliases={'/admin':'/admin/admin.html','/teacher':'/teacher/dashboard.html','/player':'/player/game.html','/auth':'/auth.html'};
 pathname=aliases[pathname]||pathname;let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end('Forbidden')}
 if(pathname.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes)});
}).listen(port,'127.0.0.1',()=>console.log('Manarat: http://127.0.0.1:'+port));
