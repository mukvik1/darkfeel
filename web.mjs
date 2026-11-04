import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.pdf':'application/pdf','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'){res.setHeader('Content-Type','application/json');return res.end('{"ok":true}');}
 if(url.pathname==='/api/events'){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  try{const upstream=await fetch(process.env.EVENTS_API_URL||'https://darkfeel-events-bot-production.up.railway.app/api/dark-feel/events',{signal:AbortSignal.timeout(10000)});if(!upstream.ok)throw Error();const payload=await upstream.json();if(!Array.isArray(payload.events))throw Error();return res.end(JSON.stringify({events:payload.events}));}catch{res.statusCode=503;return res.end('{"error":"events_unavailable"}');}
 }
 let filename;try{filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch{res.writeHead(400);return res.end();}
 if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(404);return res.end();}
 if(filename===root)filename=path.join(root,'index.html');
 try{const stat=await fs.promises.stat(filename);if(!stat.isFile())throw Error();res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');res.setHeader('Cache-Control',path.extname(filename)==='.html'||path.extname(filename)==='.json'?'no-cache':'public, max-age=3600');if(req.method==='HEAD')return res.end();fs.createReadStream(filename).pipe(res);}catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||3000),'0.0.0.0');
