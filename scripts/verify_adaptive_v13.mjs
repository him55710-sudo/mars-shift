// Reproduce frozen forecast results without writing to the original experiment.
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out='public/data/hazards/adaptive-v13';
const read=(p)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(p)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const protocol=read(join(root,out,'protocol.json'));
const results=['protocol','development','selection','confirmation','observed'];
const originals=Object.fromEntries(results.map(name=>[name,sha(join(root,out,name+'.json'))]));
const scratch=mkdtempSync(join(tmpdir(),'mars-shift-v13-reproduction-'));
function copy(relative){
  const dest=join(scratch,relative);
  mkdirSync(dirname(dest),{recursive:true});
  copyFileSync(join(root,relative),dest);
}
for(const [path,hash] of Object.entries(protocol.hashes)){
  if(sha(join(root,path))!==hash)throw Error('Frozen source changed: '+path);
  copy(path);
}
copy(out+'/protocol.json');
copy('public/data/hazards/metric-v12/ranged-results.json');
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('vite/package.json'))('esbuild');
const bundle=await build({entryPoints:[join(root,'scripts/evaluate_adaptive_v13.ts')],bundle:true,platform:'node',format:'esm',write:false,logLevel:'warning'});
writeFileSync(join(scratch,'evaluate.mjs'),bundle.outputFiles[0].contents,{flag:'wx'});
const volatile=new Set(['createdAt','selectedAt','p95Ms']);
function scientific(value){
  if(Array.isArray(value))return value.map(scientific);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!volatile.has(key)).map(([key,v])=>[key,scientific(v)]));
  return value;
}
const checked=[];
function compare(name){
  const original=scientific(read(join(root,out,name+'.json')));
  const replay=scientific(read(join(scratch,out,name+'.json')));
  if(!isDeepStrictEqual(original,replay))throw Error('Scientific output differs: '+name+'; inspect '+scratch);
  checked.push(name);
  console.log('MATCH '+name);
}
function run(mode){
  const result=spawnSync(process.execPath,[join(scratch,'evaluate.mjs'),mode],{cwd:scratch,encoding:'utf8',maxBuffer:8*1024*1024});
  writeFileSync(join(scratch,mode+'.log'),(result.stdout??'')+(result.stderr??''),{flag:'wx'});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error('Replay failed: '+mode+'; inspect '+scratch);
}
run('develop');compare('development');compare('selection');
// The selected configuration was independently reproduced above. Restore its
// original timestamp bytes so downstream provenance hashes remain identical.
copy(out+'/selection.json');
run('confirm');compare('confirmation');
run('observed');compare('observed');
for(const [name,hash] of Object.entries(originals))if(sha(join(root,out,name+'.json'))!==hash)throw Error('Original result was modified: '+name);
const receipt={verifiedAt:new Date().toISOString(),scratch,checked,excludedFields:[...volatile],originalHashes:originals,originalsUnchanged:true,scope:'Deterministic forecast replay only; route and wall-clock timings are not rerun by this command.'};
writeFileSync(join(scratch,'reproduction.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
console.log(JSON.stringify(receipt,null,2));
