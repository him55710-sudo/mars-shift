import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {encounterGraph,advanceEncounter} from '../src/encounter-v7';
import type {EncounterGraph} from '../src/encounter-v7';
import {planAbrupt} from '../src/encounter-v8';
import type {ArmV8} from '../src/encounter-v8';
import {makeEncounterV9,planSippV9} from '../src/encounter-v9';
import type {CaseV9} from '../src/encounter-v9';
import type {PredictorV8} from '../src/vortex-forecast-v8';
import {measureEscapePath} from '../src/escape-metrics';
import {positionOnPath} from '../src/hazard-planner';
const root='public/data/hazards/vortex-v9/',load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const mode=process.argv[2]??'development',protocol=load(root+'protocol.json'),wind=load('public/data/hazards/vortex-v8/earth-analog-wind.json').days;
const output=root+mode+'.json';if(existsSync(output))throw Error('Refusing overwrite '+output);
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const hashes=Object.fromEntries(['src/encounter-v9.ts','src/sipp-v9.ts','src/encounter-v8.ts','src/encounter-v7.ts','src/vortex-forecast-v8.ts','scripts/analyze_vortex_v9.ts',root+'protocol.json','public/data/hazards/vortex-v8/earth-analog-wind.json','public/data/hazards/encounters-v7/floor-terrain.json','public/data/hazards/encounters-v7/ridge-terrain.json'].map(p=>[p,sha(p)]));
type Config={label:string;engine:'sipp'|'v8';predictor:PredictorV8;sigma:number;arm?:ArmV8;oracle?:boolean};
let configs:Config[]=protocol.selection.predictors.flatMap((predictor:PredictorV8)=>[0,.5].map(sigma=>({label:`SIPP-${predictor}-${sigma}`,engine:'sipp',predictor,sigma})));
if(mode==='holdout'){
  const selection=load(root+'selection.json');if(JSON.stringify(hashes)!==JSON.stringify(selection.hashes))throw Error('Source/input changed after development selection');
  if(sha(root+'development.json')!==selection.developmentSHA256)throw Error('Development evidence changed');
  configs=[{label:'Static',engine:'v8',arm:'Static',predictor:'CV_SMOOTH',sigma:0},
    {label:'V8-Nominal',engine:'v8',arm:'Nominal',predictor:'CV_SMOOTH',sigma:0},
    {label:'V8-MARS',engine:'v8',arm:'MARS SHIFT',predictor:'CV_SMOOTH',sigma:.5},
    {...selection.nominal,label:'SIPP-Nominal'},{...selection.candidate,label:'SIPP-Uncertainty'},
    {...selection.nominal,label:'SIPP-Oracle',oracle:true}];
}
const graphs=new Map<string,EncounterGraph>(),rows:any[]=[],mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/a.length;
const cases:CaseV9[]=protocol.cases.filter((c:CaseV9)=>c.split===(mode==='holdout'?'holdout':'development')).slice(0,mode==='smoke'?1:Infinity);
for(const [caseNumber,c] of cases.entries())for(const config of configs){
  const key=c.terrain+':'+c.speed;
  if(!graphs.has(key))graphs.set(key,encounterGraph(load('public/data/hazards/encounters-v7/'+c.terrain+'-terrain.json').terrain,c.speed));
  const s=makeEncounterV9(graphs.get(key)!,c,protocol.sources.find((a:any)=>a.id===c.source),wind);s.predictor=config.predictor;
  const decisions:any[]=[],latencies:number[]=[];let firstMove:number|null=null,holds=0,activeHold=0,fallbacks=0;
  while(!s.done){
    const d=config.engine==='sipp'?planSippV9(s,config.sigma,config.oracle):planAbrupt(s,config.arm!);
    const moving=Math.hypot(positionOnPath(d.path,s.time+2).x-s.position.x,positionOnPath(d.path,s.time+2).y-s.position.y)>1e-8;
    if(moving&&firstMove===null)firstMove=s.time;
    if(!moving&&s.time>=s.firstDetect+c.reaction){holds+=2;
      // Analysis only: the truth-defined stationary threat does not enter planning.
      const threat=measureEscapePath([{...s.position,time:s.time},{...s.position,time:s.time+48}],s.truth,s.g.terrain.cellSize,s.time,s.time+48,s.truthKnots).exposureSeconds>1e-8;
      if(threat)activeHold+=2;
    }
    if(d.reason.includes('fallback'))fallbacks++;
    latencies.push(d.latencyMs);decisions.push({time:s.time,x:s.position.x,y:s.position.y,action:d.action,returnMargin:d.returnMargin,predictedContact:d.contact,latencyMs:d.latencyMs,expanded:d.expanded,limited:d.limited,reason:d.reason});
    advanceEncounter(s,d);
  }
  const m=measureEscapePath(s.trace,s.truth,s.g.terrain.cellSize,c.birth,s.time,s.truthKnots);
  const stationary=measureEscapePath([{...s.initial,time:0},{...s.initial,time:s.time}],s.truth,s.g.terrain.cellSize,c.birth,s.time,s.truthKnots);
  rows.push({case:c.id,event:c.event,arm:config.label,terrain:c.terrain,family:c.family,source:c.source,budget:c.budget,
    contact:m.exposureSeconds,minClearance:m.minClearance,contactIntervals:m.intervals,stationaryThreat:stationary.exposureSeconds>1e-8,
    returnComplete:s.returned,budgetViolation:s.budgetFailure,elapsed:s.time,holds,activeHold,fallbacks,
    distance:s.trace.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-s.trace[i].x,p.y-s.trace[i].y)*s.g.terrain.cellSize,0),
    birth:c.birth,detected:s.firstDetect,estimateReady:s.estimateReady,firstPlan:s.firstDetect,firstMove,
    minReturnMargin:Math.min(...decisions.map(d=>d.returnMargin)),latencies,decisions,trace:s.trace});
  if(config===configs.at(-1))console.log(mode,caseNumber+1,'/',cases.length,c.id);
}
const summary=Object.fromEntries(configs.map(c=>{const r=rows.filter(r=>r.arm===c.label),lat=r.flatMap(r=>r.latencies).sort((a,b)=>a-b);return [c.label,{cases:r.length,noContact:r.filter(r=>r.contact<1e-8).length,meanContact:mean(r.map(r=>r.contact)),meanClearance:mean(r.map(r=>r.minClearance)),meanHold:mean(r.map(r=>r.holds)),meanActiveHold:mean(r.map(r=>r.activeHold)),returnFailures:r.filter(r=>!r.returnComplete).length,budgetViolations:r.filter(r=>r.budgetViolation).length,p95Ms:lat[Math.floor(lat.length*.95)],maxMs:lat.at(-1),fallbacks:r.reduce((a,r)=>a+r.fallbacks,0)}];}));
writeFileSync(output,JSON.stringify({createdAt:new Date().toISOString(),hashes,configs,summary,rows}));console.log(summary);
if(mode==='development'){
  const select=(sigma:number)=>configs.filter(c=>c.sigma===sigma).sort((a,b)=>{const x=summary[a.label],y=summary[b.label];return x.returnFailures-y.returnFailures||x.meanContact-y.meanContact||x.meanActiveHold-y.meanActiveHold;})[0];
  writeFileSync(root+'selection.json',JSON.stringify({frozenAt:new Date().toISOString(),hashes,developmentSHA256:sha(output),nominal:select(0),candidate:select(.5)},null,2),{flag:'wx'});
}
