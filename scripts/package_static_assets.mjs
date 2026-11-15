import {readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';

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
async function size(path){
 const metadata=await stat(path);
 if(!metadata.isDirectory())return metadata.size;
 const children=await readdir(path);
 return (await Promise.all(children.map(child=>size(resolve(path,child))))).reduce((a,b)=>a+b,0);
}
const bytes=await size(output);
// Keep room for the hosting manifest and archive metadata beneath the 256 MiB limit.
if(bytes>255*1024*1024)throw Error(`Static output ${(bytes/2**20).toFixed(2)} MiB exceeds the 255 MiB packaging budget.`);
console.log(`Static output ${(bytes/2**20).toFixed(2)} MiB. Linked failure traces verified lossless; raw experiment inputs retained in source.`);
