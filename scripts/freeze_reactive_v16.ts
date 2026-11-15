import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,load,cropNoah,fixture} from './reactive_fixtures_v16';
import type {EvaluationCase,WindowSpec} from './reactive_fixtures_v16';
import {validateNoah} from '../src/noah-data';
import {mapSandTraps} from '../src/sand-traps-v14';
const mode=process.argv[2]??'protocol',sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const files=['src/reactive-evaluation-v16.ts','src/hazard-mpc.ts','src/encounter-v7.ts','src/encounter-v8.ts','src/vortex-forecast-v8.ts','src/escape-metrics.ts','src/rover-navigation.ts','src/hazard-planner.ts','scripts/reactive_fixtures_v16.ts','scripts/evaluate_reactive_v16.ts','scripts/freeze_reactive_v16.ts','scripts/run_reactive_v16.mjs'];
mkdirSync(ROOT,{recursive:true});
if(mode==='preflight'){
 const protocol=load(ROOT+'protocol.json'),rows=protocol.cases.map((c:EvaluationCase)=>{const s=fixture(c,protocol);return {case:c.id,terrain:c.terrain,allowed:s.g.allowed.length,initial:s.initial,base:s.base,target:s.target,cellSize:s.g.terrain.cellSize,crs:s.g.terrain.crs,connectedReturn:s.returns[Math.round(s.initial.y)*s.g.terrain.width+Math.round(s.initial.x)]};});
 if(rows.some((r:any)=>!r.allowed||!Number.isFinite(r.connectedReturn)))throw Error('Static source preparation failed; no policy evaluation has run');
 writeFileSync(ROOT+'preflight.json',JSON.stringify({meaning:'Static fixture and coordinate preparation only; no policy scores or outcomes evaluated.',rows},null,2)+'\n',{flag:'wx'});console.log('Static fixture preflight passed for',rows.length,'cases');process.exit(0);
}
if(mode==='seal'){
 const output=ROOT+'seal.json';if(existsSync(output))throw Error('Refusing overwrite '+output);
 writeFileSync(output,JSON.stringify({sealedAt:new Date().toISOString(),protocolSHA256:sha(ROOT+'protocol.json'),files:Object.fromEntries(files.map(p=>[p,sha(p)])),sourceHashes:Object.fromEntries([ROOT+'protocol-clarifications.json','public/data/hazards/vortex-v8/holdout-final.json','public/data/hazards/vortex-v8/protocol-final.json','public/data/hazards/vortex-v8/protocol-confirmation.json','public/data/hazards/vortex-v8/earth-analog-wind.json','public/data/hazards/escape-v5/navigation-config.json','public/data/noah/terrain.json','public/data/noah/noah-terrain.json','public/data/drive1004/navigation-grid.json'].map(p=>[p,sha(p)]))},null,2)+'\n',{flag:'wx'});console.log('Sealed policy, evaluator and all frozen sources before validation');process.exit(0);
}
if(existsSync(ROOT+'protocol.json'))throw Error('Refusing overwrite protocol');
let seed=2026111501;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
const old=load('public/data/hazards/vortex-v8/protocol-final.json'),confirmation=load('public/data/hazards/vortex-v8/protocol-confirmation.json');
const used=new Set([...old.cases,...confirmation.cases].map(c=>c.sensorSeed));
const sensorSeed=()=>{let n=0;do{n=Math.floor(random()*4294967295);}while(used.has(n));used.add(n);return n;};
const full=load('public/data/noah/terrain.json');full.noah=validateNoah(full,load('public/data/noah/noah-terrain.json'));const sand=mapSandTraps(full,5);
const windows:WindowSpec[]=[];
for(let i=0;i<sand.core.length&&windows.length<6;i++)if(sand.core[i]&&full.valid[i]){
 const x=Math.max(0,Math.min(full.width-24,i%full.width-12)),y=Math.max(0,Math.min(full.height-24,Math.floor(i/full.width)-12));
 if(windows.some(w=>Math.hypot(w.x-x,w.y-y)<24))continue;const w={id:'noah-'+(windows.length+1),x,y,width:24,height:24},crop=cropNoah(w);
 if(crop.terrain.obstacleMask!.filter((v,i)=>!v&&!!crop.terrain.valid[i]).length<40)continue;windows.push(w);
}
if(windows.length!==6)throw Error('Static source preparation did not find six supported, distinct mapped-sand windows. No validation has run.');
const cases:EvaluationCase[]=old.cases.filter(c=>c.split==='holdout').map(c=>({...c,suite:'frozen',event:'frozen-'+c.id}));
const sources=old.sources;
for(const suite of ['fresh','compound'] as const)for(let k=0;k<36;k++){
 const terrain=suite==='fresh'?['floor','ridge','navcam'][Math.floor(k/12)]:windows[Math.floor(k/6)].id,j=suite==='fresh'?k%12:k%6;
 cases.push({id:`${suite}-${terrain}-${String(k).padStart(3,'0')}`,event:`${suite}-event-${k}`,suite,split:'holdout',terrain,source:sources[Math.floor(k/4)%sources.length].id,truth:['linear','gust','oscillate','wind'][j%4],family:['linear','gust','oscillate','wind'][j%4],heading:random()*Math.PI*2,bearing:k%4===3?Math.PI:(random()-.5)*1.2,distance:18+random()*62,startOffset:[(random()-.5)*8,(random()-.5)*8],speed:[.4,.6,.9][j%3],reaction:[2,6,10][Math.floor(j/3)%3],positionSigma:.75,diameterSigmaFraction:.08,sensorSeed:sensorSeed(),birth:8+Math.floor(random()*11),detectLag:[1,2,4][j%3],cadence:[1,2,4][Math.floor(j/2)%3],dropout:j%6===5,windDay:[4,5,6][j%3],growthSeconds:[3,6,10][j%3],evaluationUntil:360,turnDegrees:0,growthMps:0});
}
const protocol={schemaVersion:16,createdBeforeValidation:new Date().toISOString(),seed:2026111501,status:'FROZEN_BEFORE_NEW_OUTCOMES',cases,sources,windows,config:load('public/data/hazards/escape-v5/navigation-config.json').config,predictor:'CV_SMOOTH',arms:['MARS SHIFT','Radial','Lateral','Reactive Best-of-3'],durationSeconds:360,processingSeconds:1,controlSeconds:2,resources:{oxygenSeconds:520,batterySeconds:520,missionSeconds:420,reserveFraction:.2,oxygenReserveSeconds:104,batteryReserveSeconds:104},footprintMarginMetres:1,definitions:{primary:'Paired mean contact difference MARS SHIFT minus Reactive Best-of-3 on fresh cases; bootstrap upper 95% bound < 0 plus no added case-wise return or resource failures.',compound:'Separate identical gate on compound cases. Never pool with fresh single-vortex headline.',contact:'Continuous contact with physical radius + fixed 1 m shared margin, over the same fixed [birth,360] interval. No early return truncation or modeled shelter.',return:'At base within 0.25 m at 360 s with declared reserves; first arrival and final success reported separately.',stop:'Separate acquiring/reaction, arrival, voluntary and an observation-only directional counterfactual avoidable-stop metric.',latency:'Full policy time including its own forecast/path construction and common feasibility gate. Counterfactual stop audit excluded. Separate common-state isolated timing after development; concurrent-run timings are diagnostic only.',seeds:'Fresh synthetic seeds/parameters, reused empirical source references and wind days. Not new independently measured Mars events.',sand:'Published NOAH-H ripple candidates, existing >=25% fraction and >=95% coverage; 5 m conservative footprint buffer and unknown exclusion. Not measured soil strength or trap probability.',failure:'All contact, no-action, return/resource and support failures disclosed; no case removed using outcomes.',noTuning:'No selection, threshold adjustment or case resampling after unblinding. Correctness amendments must preserve failed outputs and disclose a new seal/run.'}};
writeFileSync(ROOT+'protocol.json',JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});console.log('Created protocol with',cases.filter(c=>c.suite==='frozen').length,'frozen, 36 fresh and 36 compound cases. No evaluation performed.');
