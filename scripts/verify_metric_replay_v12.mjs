// Recompute frozen experiments in a new temporary directory, never the archive.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('vite/package.json'))('esbuild');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out='public/data/hazards/metric-v12/';
const scratch=mkdtempSync(join(tmpdir(),'mars-shift-metric-v12-'));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const phase of [
 {protocol:'protocol.json',entry:'scripts/analyze_metric_v12.ts',result:'results.json'},
 {protocol:'ranged-protocol.json',entry:'scripts/analyze_ranged_v12.ts',result:'ranged-results.json'},
]){
 const protocol=JSON.parse(readFileSync(join(root,out,phase.protocol),'utf8'));
 for(const [path,expected] of Object.entries(protocol.hashes)){
  const source=join(root,path),target=join(scratch,path);
  if(hash(readFileSync(source))!==expected)throw Error('Frozen source changed: '+path);
  mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);
 }
 copyFileSync(join(root,out,phase.protocol),join(scratch,out,phase.protocol));
 const bundled=await build({entryPoints:[join(root,phase.entry)],bundle:true,platform:'node',format:'esm',write:false,logLevel:'warning'});
 const script=join(scratch,phase.result+'.mjs');writeFileSync(script,bundled.outputFiles[0].contents,{flag:'wx'});
 const child=spawnSync(process.execPath,[script,'evaluate'],{cwd:scratch,encoding:'utf8',maxBuffer:8*1024*1024});
 if(child.status!==0)throw Error(child.stderr||child.stdout||'Replay failed');
 const expected=JSON.parse(readFileSync(join(root,out,phase.result),'utf8'));
 const actual=JSON.parse(readFileSync(join(scratch,out,phase.result),'utf8'));
 // Generation time is the only deliberately non-deterministic field.
 delete expected.createdAt;delete actual.createdAt;
 if(!isDeepStrictEqual(actual,expected))throw Error('Recomputed output differs: '+phase.result);
 console.log('Identical scientific output:',phase.result);
}
console.log('Original archives untouched. Recomputed artifacts:',scratch);
