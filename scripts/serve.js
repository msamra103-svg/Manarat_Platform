const http=require('http'),fs=require('fs'),path=require('path');
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const root=path.resolve(__dirname,'../public'),port=Number(option('--port')||process.env.PORT||3000),host=option('--host')||process.env.HOST||'0.0.0.0';
const retiredPaths=Object.fromEntries(require('../vercel.json').redirects.map(route=>[route.source,route.destination]));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.json':'application/json'};
http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch(e){res.writeHead(400);return res.end('Bad request')}
 if(Object.hasOwn(retiredPaths,pathname)){
  const query=new URL(req.url,'http://localhost').search;
  res.writeHead(302,{Location:retiredPaths[pathname]+query});
  return res.end();
 }
 const aliases={'/admin':'/admin/admin.html','/teacher':'/teacher/dashboard.html','/player':'/player/game.html','/auth':'/auth.html'};
 pathname=aliases[pathname]||pathname;let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end('Forbidden')}
 if(pathname.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes)});
}).listen(port,host,()=>console.log('Abu Ubaida Platform: http://'+host+':'+port));
