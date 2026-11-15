import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {encounterGraph,makeEncounter,planEncounter,advanceEncounter,encounterTruth,encounterPrediction,ENCOUNTER} from '../src/encounter-v7';
import type {EncounterCase,EncounterArm,EncounterGraph} from '../src/encounter-v7';
import {roverTerrain,gridPoint} from '../src/rover-navigation';
import {measureEscapePath} from '../src/escape-metrics';
import {bestStraightEscape,straightEncounter} from '../src/dust-devil-geometry';
const root='public/data/hazards/encounters-v7/',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),mode=process.argv[2]??'development',protocolFile=['validation','ablation','confirmation'].includes(mode)?`protocol-${mode}.json`:'protocol-v2.json',protocol=load(root+protocolFile),graphs=new Map<string,EncounterGraph>(),rover=load('public/data/drive1004/navigation-grid.json');
const output=root+mode+'.json';if(existsSync(output))throw Error('Refusing overwrite '+output);
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(mode==='geometry'){
 const rows=[];
 for(const source of protocol.sources)for(const speed of protocol.geometry.walking)for(const delay of protocol.geometry.reaction)for(const bearing of protocol.geometry.bearingsDegrees)for(const rule of protocol.geometry.distanceRules){
  const R=source.diameter/2+1,D=rule==='0.5R'?R*.5:rule==='R'?R:R+Number(rule.slice(2)),theta=bearing*Math.PI/180,c={x:-D*Math.cos(theta),y:-D*Math.sin(theta)},v={x:source.speed,y:0},duration=Math.max(90,(D+4*R)/source.speed+delay+60),hold=straightEncounter(c,v,R,{x:0,y:0},delay,duration),opposite=straightEncounter(c,v,R,{x:-speed,y:0},delay,duration),sides=[-speed,speed].map(y=>straightEncounter(c,v,R,{x:0,y},delay,duration)).sort((a,b)=>a.exposureSeconds-b.exposureSeconds),best=bestStraightEscape(c,v,R,speed,delay,duration);
  rows.push({source:source.id,diameter:source.diameter,translation:source.speed,speed,delay,bearing,rule,distance:D,frontGap:D-R,stationaryThreat:hold.exposureSeconds>1e-8,holdContact:hold.exposureSeconds,oppositeContact:opposite.exposureSeconds,sideContact:sides[0].exposureSeconds,bestContact:best.exposureSeconds,bestClearance:best.minClearance,headingDegrees:Math.atan2(best.vy,best.vx)*180/Math.PI});
 }
 writeFileSync(output,JSON.stringify({kind:'FREE_PLANE_PERFECT_INFORMATION_NO_RESOURCES',count:rows.length,rows},null,2));console.log('Geometry cases',rows.length);process.exit(0);
}
function graph(c:EncounterCase){const key=c.terrain+':'+c.speed;if(!graphs.has(key)){const t=c.terrain==='navcam'?roverTerrain(rover,[]):load(root+c.terrain+'-terrain.json').terrain;graphs.set(key,encounterGraph(t,c.speed));}return graphs.get(key)!;}
let selected=.25;if(mode==='holdout'||mode==='validation'){const selection=load(root+'selection.json');selected=selection.alpha;if(selection.holdoutOpened)throw Error('Invalid selection record');}
const cases=protocol.cases.filter((c:EncounterCase)=>c.split===(mode==='smoke'?'development':mode)).slice(0,mode==='smoke'?3:Infinity) as EncounterCase[];
const arms=mode==='ablation'?protocol.variants:mode==='confirmation'?load(root+'selection-v7-2.json').arms:mode==='development'?([{arm:'Static',alpha:0},{arm:'Endpoint',alpha:0},...protocol.policySelection.candidates.map((alpha:number)=>({arm:'Adaptive',alpha}))]):([{arm:'Static',alpha:0},{arm:'Endpoint',alpha:0},{arm:'Adaptive',alpha:selected},{arm:'Oracle',alpha:0}]);
const rows:any[]=[];
for(const c of cases)for(const config of arms){
 const g=graph(c),source=protocol.sources.find((v:any)=>v.id===c.source),base=c.terrain==='navcam'?gridPoint(rover,rover.start.x,rover.start.z):undefined,s=makeEncounter(g,c,source,base),times:number[]=[],decisions:any[]=[];let holds=0,avoidable=0,limits=0,firstMovement:number|null=null,firstReturn:number|null=null;
 s.trackerWindow=config.trackerWindow??3;s.adaptiveHorizon=config.adaptiveHorizon??false;
 const forecastErrors:{lead:number;position:number;radius:number}[]=[];
 while(!s.done){if(s.time>=4&&s.time<=80&&config.arm!=='Oracle'){const predict=encounterPrediction(s,config.arm as EncounterArm);for(const lead of [5,10,20]){const q=predict(s.time+lead),truth=encounterTruth(c,source,s.initial,g.terrain.cellSize,s.time+lead);forecastErrors.push({lead,position:Math.hypot(q.x-truth.x,q.y-truth.y),radius:Math.abs(q.radius-1-truth.radius)});}}
  const d=planEncounter(s,config.arm as EncounterArm,config.alpha);times.push(d.latencyMs);if(d.action==='HOLD')holds+=2;if(d.unnecessaryHold)avoidable+=2;if(d.limited)limits++;if(firstMovement===null&&d.action!=='HOLD'&&d.action!=='NO FEASIBLE ROUTE')firstMovement=s.time;if(firstReturn===null&&d.action==='RETURN')firstReturn=s.time;
  decisions.push({time:s.time,action:d.action,contact:d.contact,clearance:d.clearance,margin:d.returnMargin,expanded:d.expanded,limited:d.limited,position:{...s.position}});advanceEncounter(s,d);
 }
 const knots=[20,...Array.from({length:Math.ceil(s.time)+1},(_,i)=>i)],truth=(time:number)=>{const q=encounterTruth(c,source,s.initial,g.terrain.cellSize,time);return {...q,radius:q.radius+1};},metrics=measureEscapePath(s.trace,truth,g.terrain.cellSize,0,s.time,knots),stationary=measureEscapePath([{...s.initial,time:0},{...s.initial,time:s.time}],truth,g.terrain.cellSize,0,s.time,knots),distance=s.trace.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-s.trace[i].x,p.y-s.trace[i].y)*g.terrain.cellSize,0);
 times.sort((a,b)=>a-b);rows.push({case:c.id,terrain:c.terrain,source:c.source,family:c.family,truth:c.truth,arm:config.arm,alpha:config.alpha,variant:config.variant??config.arm+':'+config.alpha,trackerWindow:s.trackerWindow,adaptiveHorizon:s.adaptiveHorizon,forecastErrors,contact:metrics.exposureSeconds,minClearance:metrics.minClearance,stationaryThreat:stationary.exposureSeconds>1e-8,stationaryContact:stationary.exposureSeconds,distance,elapsed:s.time,holdSeconds:holds,avoidableHoldSeconds:avoidable,returnComplete:s.returned,budgetViolation:s.budgetFailure,p95Ms:times[Math.floor(times.length*.95)],limitedReplans:limits,initial:s.initial,base:s.base,detectTime:0,estimateReady:4,firstMovement,firstReturn,contactIntervals:metrics.intervals,decisions});
 console.log(c.id,c.terrain,c.family,config.arm,config.alpha,'contact',metrics.exposureSeconds.toFixed(2),'return',s.returned,'p95',times[Math.floor(times.length*.95)].toFixed(1),'limits',limits);
}
const keys=[...new Set(rows.map(r=>r.variant))],summary=Object.fromEntries(keys.map(key=>{const r=rows.filter(r=>r.variant===key),mean=(k:string)=>r.reduce((s,r)=>s+r[k],0)/r.length;return [key,{cases:r.length,noContact:r.filter(r=>r.contact<1e-8).length,threats:r.filter(r=>r.stationaryThreat).length,threatAvoided:r.filter(r=>r.stationaryThreat&&r.contact<1e-8).length,meanContact:mean('contact'),meanClearance:mean('minClearance'),meanHold:mean('holdSeconds'),meanAvoidableHold:mean('avoidableHoldSeconds'),returnFailures:r.filter(r=>!r.returnComplete).length,budgetViolations:r.filter(r=>r.budgetViolation).length,meanP95Ms:mean('p95Ms'),limitedReplans:r.reduce((s,r)=>s+r.limitedReplans,0),meanDistance:mean('distance')}];}));
writeFileSync(output,JSON.stringify({mode,createdAt:new Date().toISOString(),protocolSHA256:sha(root+protocolFile),engineSHA256:sha('src/encounter-v7.ts'),summary,rows},null,2));console.log(JSON.stringify(summary,null,2));
