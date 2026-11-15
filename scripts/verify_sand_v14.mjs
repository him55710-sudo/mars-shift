import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

// Re-run the frozen experiment in an isolated directory; never overwrite evidence.
const root=resolve('.'),out='public/data/hazards/sand-v14/',read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const protocol=await read(out+'protocol.json'),expected=await read(out+'results.json');
const temp=await mkdtemp(join(tmpdir(),'mars-sand-v14-'));
for(const [p,sha] of Object.entries(protocol.hashes)){
 const bytes=await readFile(join(root,p));
 if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Frozen input changed: '+p);
 await mkdir(dirname(join(temp,p)),{recursive:true});await writeFile(join(temp,p),bytes);
}
await mkdir(join(temp,out),{recursive:true});await copyFile(join(root,out,'protocol.json'),join(temp,out,'protocol.json'));
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite/package.json'))('esbuild');
await build({entryPoints:[join(root,'scripts/evaluate_sand_v14.ts')],bundle:true,platform:'node',format:'esm',outfile:join(temp,'evaluate.mjs'),logLevel:'warning'});
const run=spawnSync(process.execPath,[join(temp,'evaluate.mjs'),'evaluate'],{cwd:temp,encoding:'utf8'});
if(run.status!==0)throw Error(run.stderr||run.stdout);
const actual=JSON.parse(await readFile(join(temp,out,'results.json'),'utf8'));
const deterministic=value=>Array.isArray(value)?value.map(deterministic):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['createdAt','milliseconds','p95Ms'].includes(key)).map(([key,value])=>[key,deterministic(value)])):value;
if(JSON.stringify(deterministic(actual))!==JSON.stringify(deterministic(expected)))throw Error('Deterministic case results differed from the frozen record');
console.log(`Verified ${Object.keys(protocol.hashes).length} frozen input hashes and all ${expected.rows.length} case/arm outcomes. Timing is intentionally not compared. Original evidence unchanged. Reproduction: ${temp}`);
