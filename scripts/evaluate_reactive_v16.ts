import {readFileSync,writeFileSync,existsSync,mkdirSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {ROOT,load,fixture} from './reactive_fixtures_v16';
import type {EvaluationCase} from './reactive_fixtures_v16';
import {planAbrupt,ARMS_V8} from '../src/encounter-v8';
import {advanceEncounter} from '../src/encounter-v7';
import {REACTIVE_ARMS,evaluationContext,policyInput,planReactive,avoidableStop,returnSeconds,reactiveGoal} from '../src/reactive-evaluation-v16';
import {measureEscapePath} from '../src/escape-metrics';
import {heightAt} from '../src/eva-motion';
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex'),protocol=load(ROOT+'protocol.json'),seal=load(ROOT+'seal.json'),mode=process.argv[2]??'fresh';
if(sha(ROOT+'protocol.json')!==seal.protocolSHA256)throw Error('Protocol changed after seal');
for(const [path,hash] of Object.entries({...seal.files,...seal.sourceHashes}))if(sha(path)!==hash)throw Error('Sealed input changed: '+path);
const output=ROOT+mode+'.json';if(existsSync(output))throw Error('Refusing overwrite '+output);
const work='analysis/reactive-v16/';mkdirSync(work,{recursive:true});const checkpoint=work+mode+'.ndjson';
if(existsSync(checkpoint)&&!process.argv.includes('--resume'))throw Error('Checkpoint exists; use --resume without changing the seal');
const rows:any[]=existsSync(checkpoint)?readFileSync(checkpoint,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
if(!existsSync(checkpoint))writeFileSync(checkpoint,'',{flag:'wx'});const done=new Set(rows.map(r=>r.case+'|'+r.arm));
const append=(row:any)=>{rows.push(row);appendFileSync(checkpoint,JSON.stringify(row)+'\n');console.log(mode,rows.length,row.case,row.arm,'contact',row.contact?.toFixed(3),'return',row.returnComplete);};
const mean=(a:number[])=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
if(mode==='regression'){
 const original=load('public/data/hazards/vortex-v8/holdout-final.json');
 for(const c of protocol.cases.filter((c:EvaluationCase)=>c.suite==='frozen'))for(const arm of ARMS_V8){
  if(done.has(c.id+'|'+arm))continue;const s=fixture(c,protocol),trace=[];let holds=0;
  while(!s.done){const d=planAbrupt(s,arm);if(d.action==='HOLD'&&s.time>=s.firstDetect+s.c.reaction)holds+=2;trace.push(d);advanceEncounter(s,d);}
  const m=measureEscapePath(s.trace,s.truth,s.g.terrain.cellSize,c.birth,s.time,s.truthKnots),distance=s.trace.slice(1).reduce((v,p,i)=>v+Math.hypot(p.x-s.trace[i].x,p.y-s.trace[i].y)*s.g.terrain.cellSize,0),reference=original.rows.find((r:any)=>r.case===c.id&&r.arm===arm);
  if(!reference)throw Error('Missing frozen reference '+c.id+' '+arm);
  const checks={contact:Math.abs(m.exposureSeconds-reference.contact),clearance:Math.abs(m.minClearance-reference.minClearance),distance:Math.abs(distance-reference.distance),elapsed:Math.abs(s.time-reference.elapsed),holds:Math.abs(holds-reference.holds),return:s.returned===reference.returnComplete,budget:s.budgetFailure===reference.budgetViolation};
  append({case:c.id,arm,contact:m.exposureSeconds,returnComplete:s.returned,checks,pass:checks.return&&checks.budget&&Object.entries(checks).filter(([k])=>!['return','budget'].includes(k)).every(([,v])=>Number(v)<1e-7)});
 }
 writeFileSync(output,JSON.stringify({kind:'FULL_FROZEN_V8_REGRESSION',protocolSHA256:seal.protocolSHA256,rows,pass:rows.every(r=>r.pass)},null,2)+'\n',{flag:'wx'});process.exit(rows.every(r=>r.pass)?0:1);
}
if(!['frozen','fresh','compound'].includes(mode))throw Error('Unknown evaluation mode');
for(const c of protocol.cases.filter((c:EvaluationCase)=>c.suite===mode)){
 const template=fixture(c,protocol),context=evaluationContext(template);
 for(const arm of REACTIVE_ARMS){
  if(done.has(c.id+'|'+arm))continue;
  const s={...template,position:{...template.initial},resources:{...protocol.resources},trace:[{...template.initial,time:0}],pending:null,time:0,done:false,returned:false,budgetFailure:false};
  const decisions:any[]=[],latencies:number[]=[],timingStates:any[]=[];let reactionHold=0,arrivalHold=0,voluntaryHold=0,avoidable=0,noAction=0,firstReturn:number|null=null,distance=0,scienceReached=false,returnFeasibilityFailure=false;
  while(s.time<protocol.durationSeconds){
   const input=policyInput(s,context,protocol.config),began=performance.now(),d=planReactive(input,arm);latencies.push(performance.now()-began);
   if(returnSeconds(input,input.position)>Math.min((s.resources.oxygenSeconds-104)/1.12,(s.resources.batterySeconds-104)/1.06,s.resources.missionSeconds)+1e-8)returnFeasibilityFailure=true;
   const isHold=d.action==='HOLD'||d.action==='NO FEASIBLE ROUTE',goal=reactiveGoal(input);
   if(isHold){if(s.time<input.readyAt)reactionHold+=2;else if(Math.hypot(s.position.x-goal.x,s.position.y-goal.y)*s.g.terrain.cellSize<.25)arrivalHold+=2;else voluntaryHold+=2;}
   if(avoidableStop(input,d))avoidable+=2;if(d.status==='NO_VERIFIED_ACTION')noAction++;
   if([0,20,40,80,120].includes(s.time))timingStates.push({case:c.id,arm,time:s.time,position:{...s.position},resources:{...s.resources}});
   decisions.push({time:s.time,position:{...s.position},resources:{...s.resources},...d});
   const before=s.trace.length;advanceEncounter(s,{...d,contact:d.contact??0,bandContact:d.contact??0,clearance:d.clearance??0,expanded:d.candidateCount,limited:false,forecast:[]});
   for(let i=before;i<s.trace.length;i++){const a=s.trace[i-1],b=s.trace[i],cell=s.g.terrain.cellSize;distance+=Math.hypot((b.x-a.x)*cell,(b.y-a.y)*cell,(heightAt(s.g.terrain,b)??0)-(heightAt(s.g.terrain,a)??0));if(Math.hypot(b.x-s.target.x,b.y-s.target.y)*cell<.25)scienceReached=true;}
   if(s.time>=90&&Math.hypot(s.position.x-s.base.x,s.position.y-s.base.y)*s.g.terrain.cellSize<.25&&firstReturn===null)firstReturn=s.time;
   s.done=false; // Fixed exposure window: arriving at an unprotected base never censors exposure.
  }
  const m=measureEscapePath(s.trace,s.truth,s.g.terrain.cellSize,c.birth,protocol.durationSeconds,s.truthKnots),resourceFailure=s.resources.oxygenSeconds<104-1e-8||s.resources.batterySeconds<104-1e-8||s.resources.missionSeconds<0;
  const returnComplete=Math.hypot(s.position.x-s.base.x,s.position.y-s.base.y)*s.g.terrain.cellSize<.25&&!resourceFailure;
  append({case:c.id,event:c.event,suite:mode,arm,terrain:c.terrain,source:c.source,contact:m.exposureSeconds,minClearance:m.minClearance,contactIntervals:m.intervals,noContact:m.exposureSeconds<=1e-8,returnComplete,firstReturn,scienceReached,missionComplete:scienceReached&&returnComplete,returnFeasibilityFailure,resourceFailure,noAction,voluntaryHold,arrivalHold,reactionHold,avoidableStop:avoidable,distance,elapsed:s.time,initial:s.initial,base:s.base,target:s.target,finalPosition:s.position,finalResources:s.resources,latencies,timingStates,decisions,trace:s.trace});
 }
}
const compact=rows.map(({decisions,trace,timingStates,latencies,...r})=>({...r,diagnosticP95Ms:[...latencies].sort((a,b)=>a-b)[Math.floor(latencies.length*.95)]}));
const summary=Object.fromEntries(REACTIVE_ARMS.map(arm=>{const r=compact.filter(x=>x.arm===arm);return [arm,{cases:r.length,meanContactSeconds:mean(r.map(x=>x.contact)),noContactRate:mean(r.map(x=>Number(x.noContact))),meanMinClearanceMetres:mean(r.map(x=>x.minClearance)),minimumClearanceMetres:Math.min(...r.map(x=>x.minClearance)),returnRate:mean(r.map(x=>Number(x.returnComplete))),missionCompletionRate:mean(r.map(x=>Number(x.missionComplete))),resourceFailures:r.filter(x=>x.resourceFailure).length,returnFeasibilityFailures:r.filter(x=>x.returnFeasibilityFailure).length,meanDistanceMetres:mean(r.map(x=>x.distance)),meanVoluntaryHoldSeconds:mean(r.map(x=>x.voluntaryHold)),meanArrivalHoldSeconds:mean(r.map(x=>x.arrivalHold)),meanAvoidableStopSeconds:mean(r.map(x=>x.avoidableStop)),noActionDecisions:r.reduce((v,x)=>v+x.noAction,0)}];}));
const raw=readFileSync(checkpoint),compressed=gzipSync(raw,{level:9});if(!gunzipSync(compressed).equals(raw))throw Error('Lossless checkpoint archive mismatch');
writeFileSync(ROOT+mode+'-traces.ndjson.gz',compressed,{flag:'wx'});
writeFileSync(output,JSON.stringify({kind:'PAIRED_SYNTHETIC_POLICY_EVALUATION',suite:mode,protocolSHA256:seal.protocolSHA256,sealSHA256:sha(ROOT+'seal.json'),summary,rows:compact,traces:{url:'/data/hazards/reactive-v16/'+mode+'-traces.ndjson.gz',uncompressedSHA256:createHash('sha256').update(raw).digest('hex'),uncompressedBytes:raw.length},limitations:'Synthetic policy evaluation with reused observed terrain/source references; not an astronaut study, actual injury probability or certified safety claim. Concurrent-run latencies are diagnostic; isolated timing is separate.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(summary,null,2));
