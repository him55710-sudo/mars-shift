import {readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// Source retains all experimental inputs. Static hosting only needs the runtime
// products, linked reports, and downloads. These traces are not runtime inputs.
const output=resolve('dist');
const target=relative=>{
 const path=resolve(output,relative);
 if(!path.startsWith(output+sep))throw Error('Static packaging escaped dist.');
 return path;
};
const trace='data/hazards/escape-v5/failures.json';
const original=await readFile(target(trace));
const compressed=gzipSync(original,{level:9});
if(!gunzipSync(compressed).equals(original))throw Error('Lossless trace compression failed.');
await writeFile(target(trace+'.gz'),compressed);
const sourceOnly=[
 trace,'data/hazards/escape-v5/holdout.json',
 'data/hazards/escape-v5/diagnostic.json',
 'data/hazards/escape-v5/improvement-diagnostic.json',
 'data/hazards/escape-v5/cost-diagnostic.json',
 'data/hazards/v3-episodes.json','data/hazards/v2-episodes.json',
 'data/hazards/episodes.json','data/hazards/v1/episodes.json',
 'data/hazards/v4-episodes.json','data/hazards/dust-escape-geometry.json',
 'data/hazards/dust-escape-terrain.json',
 'data/hazards/v3-dev-0.json','data/hazards/v3-dev-1.json',
 'data/hazards/v2-dev-0.json','data/hazards/v2-dev-1.json',
];
for(const relative of sourceOnly)await rm(target(relative),{force:true});

// Keep all research inputs in Git. Large, non-runtime traces are distributed
// losslessly; no image, mesh or raster value changes. Multiband analysis TIFFs
// remain source downloads; the public app retains native DEM TIFF downloads.
const review=JSON.parse(await readFile(target('data/review-v15/evidence.json'),'utf8'));
const pinned=new Set(review.sources.map(s=>s.url.slice(1)));
const sw=await readFile(target('sw.js'),'utf8');
const coreExpression=sw.match(/const CORE=([\s\S]*?);\r?\n/)[1];
const core=new Set(Function(`return (${coreExpression})`)());
const archives=[];
const sourceDownloads=[];
async function archive(relative){
 const bytes=await readFile(target(relative)),gzip=gzipSync(bytes,{level:9});
 if(!gunzipSync(gzip).equals(bytes))throw Error('Source archive changed bytes: '+relative);
 await writeFile(target(relative+'.gz'),gzip);
 await rm(target(relative));
 archives.push({original:'/'+relative,download:'/'+relative+'.gz',originalBytes:bytes.length,downloadBytes:gzip.length,sha256:createHash('sha256').update(bytes).digest('hex'),hashAppliesTo:'uncompressed original'});
}
for(const root of ['data','data/ridge','data/noah']){
 const relative=root+'/science/terrain-derivatives-1m.tif',bytes=await readFile(target(relative));
 sourceDownloads.push({sourcePath:'public/'+relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),availability:'source repository'});
 await rm(target(relative));
}
for(const folder of ['encounters-v7','vortex-v8','vortex-v9','vortex-v10','observed-v11','metric-v12','adaptive-v13','sand-v14']){
 const relativeRoot='data/hazards/'+folder;
 async function visit(relative){
  for(const name of await readdir(target(relative))){
   const path=relative+'/'+name,info=await stat(target(path));
   if(info.isDirectory()){await visit(path);continue;}
   if(!name.endsWith('.json')||info.size<600000||pinned.has(path)||core.has('/'+path))continue;
   // Protocols, summaries and replay inputs remain directly readable by the app.
   if(/protocol|selection|summary|manifest|wind|terrain|recording|config|ranged-results|image-results|observed/.test(name))continue;
   await archive(path);
  }
 }
 await visit(relativeRoot);
}
await writeFile(target('data/static-downloads.json'),JSON.stringify({encoding:'gzip',meaning:'Lossless trace downloads; original bytes are restored by decompression. Multiband analysis TIFFs are retained in the source repository; public native DEM downloads remain available.',archives,sourceDownloads},null,2)+'\n');
for(const url of core)if(url!=='/')await stat(target(url.slice(1)));
for(const source of review.sources){
 const bytes=await readFile(target(source.url.slice(1)));
 if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error('Published review source changed: '+source.url);
}
async function size(path){
 const metadata=await stat(path);
 if(!metadata.isDirectory())return metadata.size;
 const children=await readdir(path);
 return (await Promise.all(children.map(child=>size(resolve(path,child))))).reduce((a,b)=>a+b,0);
}
const bytes=await size(output);
// Keep room for the hosting manifest and archive metadata beneath the 256 MiB limit.
if(bytes>255*1024*1024)throw Error(`Static output ${(bytes/2**20).toFixed(2)} MiB exceeds the 255 MiB packaging budget.`);
console.log(`Static output ${(bytes/2**20).toFixed(2)} MiB. ${archives.length} lossless source archives; six review sources and all offline inputs verified. Original experiment inputs retained in Git.`);
