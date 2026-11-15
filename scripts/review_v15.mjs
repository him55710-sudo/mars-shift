import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite/package.json'))('esbuild');
const bundle=await build({entryPoints:['src/review-evidence-v15.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'warning'});
const {deriveReviewEvidence}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
const files={guard:'adaptive-v13/guard-results.json',sand:'sand-v14/results.json',forecast:'adaptive-v13/confirmation.json',metric:'metric-v12/ranged-results.json',observed:'adaptive-v13/observed.json',images:'observed-v11/image-results.json'};
const inputs={},sources=[];
for(const [key,file] of Object.entries(files)){const path='public/data/hazards/'+file,bytes=await readFile(path);inputs[key]=JSON.parse(bytes);sources.push({role:key,url:'/data/hazards/'+file,sha256:createHash('sha256').update(bytes).digest('hex')});}
const evidence={...deriveReviewEvidence(inputs),sources,interpretation:'Secondary audit of existing frozen experiments. No new observation, model training, holdout or operational validation is claimed.'};
const output='public/data/review-v15/evidence.json',rendered=JSON.stringify(evidence,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(output,'utf8')!==rendered)throw Error('Review evidence is stale; inspect changed inputs before regenerating.');console.log('PASS: six source hashes, matched comparisons and all published v15 metrics reproduce.');}
else {await mkdir('public/data/review-v15',{recursive:true});await writeFile(output,rendered);console.log('Generated review evidence from six preserved source results.');}
