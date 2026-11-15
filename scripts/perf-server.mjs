import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]??'dist'),port=Number(process.argv[3]??5197);
const probe=await readFile(new URL('./browser-perf-probe.js',import.meta.url));
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.woff2':'font/woff2'};
createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/__perf-probe.js'){res.setHeader('Content-Type','application/javascript');res.end(probe);return;}
 const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 let file=target;
 try{if(!(await stat(file)).isFile())file=path.join(root,'index.html');}catch{if(path.extname(file)){res.writeHead(404);res.end();return;}file=path.join(root,'index.html');}
 let data=await readFile(file);
 if(file.endsWith('index.html')&&url.searchParams.has('perf'))data=Buffer.from(data.toString().replace('<head>','<head><script src="/__perf-probe.js"></script>'));
 res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(data);
 }catch{res.writeHead(500);res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`Performance preview: http://127.0.0.1:${port}/explore?perf=1`));
