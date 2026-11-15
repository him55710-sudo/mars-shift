import fs from 'node:fs';import crypto from 'node:crypto';
import {DEFAULTS,nearestAllowed} from '../src/planner';import type {Terrain,Point} from '../src/planner';
import {prepareHazardContext,positionOnPath,staticSegmentSafe,resourceSafe} from '../src/hazard-planner';import type {HazardConfig,HazardModel,ResourceState,TimedPoint,EscapeCandidate} from '../src/hazard-planner';
import {exposureMPC} from '../src/hazard-mpc';import {localReturnSeconds} from '../src/local-return';
import {fitLocalTrack} from '../src/local-dust-tracker';import {forecast} from '../src/hazard-tracker';import type {VortexTrack,VortexObservation,Forecast} from '../src/hazard-tracker';
import {measureEscapePath} from '../src/escape-metrics';import {bestStraightEscape} from '../src/dust-devil-geometry';
import {seededRandom} from '../src/hazard-simulation';import {validateNoah} from '../src/noah-data';
const root='public/data/hazards/escape-v5',mode=process.argv[2]??'diagnose';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8')),sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),write=(name:string,value:any)=>fs.writeFileSync(`${root}/${name}`,JSON.stringify(value,null,2),{flag:'wx'});
const manifest=read(root+'/manifest.json'),legacy=read('public/data/hazards/v4-frozen.json').config as HazardConfig;
for(const [p,hash] of Object.entries(manifest.historicalHashes))if(sha(p)!==hash)throw Error('Historical artifact changed: '+p);
type Arm={name:string;model:HazardModel;perfect?:boolean;flat?:boolean;delay:number;horizon:number;improved?:boolean;continuousOnly?:boolean};
const diagnosticArms:Arm[]=[
 {name:'flat-perfect-0',model:'MARS SHIFT',perfect:true,flat:true,delay:0,horizon:30},
 {name:'DEM-perfect-0',model:'MARS SHIFT',perfect:true,delay:0,horizon:30},
 {name:'DEM-perfect-6',model:'MARS SHIFT',perfect:true,delay:6,horizon:30},
 {name:'DEM-estimated-6',model:'MARS SHIFT',delay:6,horizon:30},
 {name:'DEM-estimated-6-h45',model:'MARS SHIFT',delay:6,horizon:45}];
const testArms:Arm[]=[{name:'Baseline',model:'Baseline',delay:6,horizon:30},{name:'Dynamic',model:'Dynamic',delay:6,horizon:30},{name:'MARS-v4',model:'MARS SHIFT',delay:6,horizon:30},{name:'Dynamic-v5-tracker',model:'Dynamic',delay:6,horizon:30,improved:true},{name:'MARS-v5',model:'MARS SHIFT',delay:6,horizon:30,improved:true},{name:'DEM-full-information-v5',model:'MARS SHIFT',perfect:true,delay:6,horizon:30,improved:true}];
const implementationFiles=['src/hazard-mpc.ts','src/hazard-planner.ts','src/escape-metrics.ts','src/dust-devil-geometry.ts','src/local-return.ts','src/local-dust-tracker.ts','src/hazard-tracker.ts','src/planner.ts','src/mobility.ts','scripts/analyze_escape_v5.ts'];
if(mode==='freeze'){
 write('implementation-freeze.json',{manifestSHA256:sha(root+'/manifest.json'),protocolSHA256:sha('docs/ESCAPE_V5_PROTOCOL.md'),files:Object.fromEntries(implementationFiles.map(p=>[p,sha(p)])),config:{...legacy,continuousContact:true,localTracker:{...legacy.localTracker,window:5}},selectedBottleneck:'Estimation vs perfect-information gap with common 6 s latency. Reduce short-window velocity noise using five causal fixes (no added startup latency); retain candidate bank, horizon and weights. Exact candidate contact scoring separately audited.'});process.exit(0);
}
if(mode==='test'){
 const frozen=read(root+'/implementation-freeze.json');if(frozen.manifestSHA256!==sha(root+'/manifest.json'))throw Error('Scenario manifest changed');
 for(const [p,hash] of Object.entries(frozen.files))if(sha(p)!==hash)throw Error('Frozen implementation changed: '+p);
}else if(!['diagnose','cost-diagnose','improvement-diagnose'].includes(mode))throw Error('Use diagnose, cost-diagnose, freeze or test');
const filename=mode==='test'?'holdout.json':mode==='cost-diagnose'?'cost-diagnostic.json':mode==='improvement-diagnose'?'improvement-diagnostic.json':'diagnostic.json';if(fs.existsSync(root+'/'+filename))throw Error('Refusing to overwrite '+filename);
const terrainCache=new Map<string,Terrain>();
function terrain(region:string){if(!terrainCache.has(region)){const p=region==='ridge'?'public/data/ridge':'public/data',t=read(p+'/terrain.json');t.noah=validateNoah(t,read(p+'/noah-terrain.json'));terrainCache.set(region,t);}return terrainCache.get(region)!;}
function flatten(t:Terrain):Terrain{const n=t.width*t.height;return {...t,elevation:Array(n).fill(0),slope:Array(n).fill(0),meanSlope:Array(n).fill(0),roughness:Array(n).fill(0),exposure:Array(n).fill(0),valid:Array(n).fill(1),obstacleMask:undefined,noah:undefined,science:undefined};}
const episodes:any[]=[],cases:any[]=[];
for(const s of manifest.cases.filter((x:any)=>x.split===(mode==='test'?'holdout':'diagnostic'))){
 const t=terrain(s.region),cell=t.cellSize,settings={...DEFAULTS,speed:s.walking,loadKg:12,scienceMinutes:0,mobilityModel:1 as const};
 const start=nearestAllowed(t,{x:Math.round(t.width*s.startFraction[0]),y:Math.round(t.height*s.startFraction[1])},settings),target=nearestAllowed(t,{x:Math.round(start.x+Math.cos(s.heading)*12),y:Math.round(start.y+Math.sin(s.heading)*12)},settings);
 let base=nearestAllowed(t,{x:Math.round(start.x-Math.cos(s.heading)*4),y:Math.round(start.y-Math.sin(s.heading)*4)},settings),c=prepareHazardContext(t,settings,base);
 if(!Number.isFinite(localReturnSeconds(c,start))){base={...start};c=prepareHazardContext(t,settings,base);}
 const flat=prepareHazardContext(flatten(t),settings,base),R=s.diameter/2+1,b=R*s.offsetFraction,long=s.initiallyInside?0:-(s.speed*s.warning+Math.sqrt(Math.max(0,R*R-b*b))),offset=s.initiallyInside?0:b;
 const cx=start.x*cell+long*Math.cos(s.heading)-offset*Math.sin(s.heading),cy=start.y*cell+long*Math.sin(s.heading)+offset*Math.cos(s.heading),vx=Math.cos(s.heading)*s.speed,vy=Math.sin(s.heading)*s.speed;
 const v2={x:Math.cos(s.heading+s.turnDegrees*Math.PI/180)*s.speed,y:Math.sin(s.heading+s.turnDegrees*Math.PI/180)*s.speed};
 const truth=(time:number)=>{const a=Math.min(time,s.turnTime),b=Math.max(0,time-s.turnTime);return {x:cx+vx*a+v2.x*b,y:cy+vy*a+v2.y*b,radius:R+s.growth*time};};
 const trueForecast=(time:number):Forecast=>{const p=truth(time),vel=time<s.turnTime?{x:vx,y:vy}:v2;return {...p,radius:p.radius-1,time,position95:0,radius95:0,envelope:p.radius,vx:vel.x,vy:vel.y,age:0,valid:true};};
 const duration=Math.ceil(Math.max(80,s.warning+2*R/Math.max(.3,s.speed-s.walking)+20)/2)*2;
 const rng=seededRandom(s.seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng()),observations:VortexObservation[]=[];
 for(let time=0;time<=duration;time+=2){const p=truth(time);observations.push({time,x:p.x+normal(),y:p.y+normal(),radius:Math.max(.2,p.radius-1+normal()*.5),positionSigma:1,radiusSigma:.5,source:'SIMULATED_SENSOR'});}
 const tracks=Array.from({length:duration/2},(_,k)=>k<3?null:fitLocalTrack(observations.filter(o=>o.time<=k*2-2),legacy.localTracker));
 const usable=localReturnSeconds(c,start)+duration+s.budgetSlack,initial:ResourceState={oxygenSeconds:usable*1.12/.75,batterySeconds:usable*1.06/.75,missionSeconds:usable,reserveFraction:.25,oxygenReserveSeconds:usable*1.12/3,batteryReserveSeconds:usable*1.06/3};
 const resources=(time:number)=>({...initial,oxygenSeconds:initial.oxygenSeconds-time*1.12,batterySeconds:initial.batterySeconds-time*1.06,missionSeconds:initial.missionSeconds-time});
 const returnMargin=(context:typeof c,p:Point,time:number)=>{const r=resources(time),seconds=localReturnSeconds(context,p);return Math.min((r.oxygenSeconds-r.oxygenReserveSeconds!)/1.12,(r.batterySeconds-r.batteryReserveSeconds!)/1.06,r.missionSeconds)-seconds;};
 const hold=[{...start,time:0},{...start,time:duration}],stationary=measureEscapePath(hold,truth,cell,0,duration,[s.turnTime]);
 const ideal=s.growth===0&&s.turnDegrees===0?bestStraightEscape({x:cx-start.x*cell,y:cy-start.y*cell},{x:vx,y:vy},R,s.walking,6,duration):null;
 cases.push({...s,start,target,base,duration,resources:initial,stationaryContactIntervals:stationary.intervals,actualStationaryFirstContact:stationary.intervals[0]?.[0]??null,freePlanePerfectStraightReference:ideal});
 for(const arm of mode==='test'?testArms:mode==='improvement-diagnose'?[{name:'DEM-estimated-continuous',model:'MARS SHIFT',delay:6,horizon:30,continuousOnly:true},{name:'DEM-estimated-five-fixes',model:'MARS SHIFT',delay:6,horizon:30,improved:true}] as Arm[]:mode==='cost-diagnose'?diagnosticArms.filter(a=>a.name==='DEM-estimated-6'):diagnosticArms){
  const context=arm.flat?flat:c,cfg={...legacy,horizon:arm.horizon,...((arm.improved||arm.continuousOnly)?{continuousContact:true}:{}),...(arm.improved?{localTracker:{...legacy.localTracker,window:5}}:{})} as HazardConfig;
  const armTracks=arm.improved?Array.from({length:duration/2},(_,k)=>k<3?null:fitLocalTrack(observations.filter(o=>o.time<=k*2-2),cfg.localTracker)):tracks;
  let pos={...start},motionStart:number|null=null,firstPlan:number|null=null,contactTradeoffs=0,terrainViolations=0,resourceViolationSeconds=0,minReturnMargin=Infinity,holdSeconds=0;
  const executed:TimedPoint[]=[{...start,time:0}],steps:any[]=[],latencies:number[]=[],predictionErrors:{horizon:number;positionSquared:number;radiusAbsolute:number}[]=[];
  for(let time=0;time<duration;time+=2){
   const f=trueForecast(time),axis=(p:number,v:number)=>({p,v,pp:0,pv:0,vv:0});
   const exact:VortexTrack={time,lastObservation:time,x:axis(f.x,f.vx),y:axis(f.y,f.vy),r:axis(f.radius,s.growth),accelerationNoise:0,radiusNoise:0,observations:3,rejected:0,source:'SIMULATED_SENSOR'};
   const tr=arm.perfect?exact:armTracks[time/2];let decision:ReturnType<typeof exposureMPC>|null=null,witness:any=null,candidateCount=0;
   const began=performance.now();
   if(time>=arm.delay&&tr){
    const predict=arm.perfect?trueForecast:(at:number)=>forecast(tr,at,true,legacy.localizationSigma),circle=(at:number)=>{const p=predict(at);return {...p,radius:p.radius+1};};
    decision=exposureMPC(context,pos,target,time,tr,resources(time),cfg,arm.model,{forecastAt:arm.perfect?trueForecast:undefined,onCandidates:['diagnose','cost-diagnose'].includes(mode)?(_all,admissible,chosen)=>{
     candidateCount=_all.length;if(!chosen)return;const knots=Array.from({length:arm.horizon*2+1},(_,i)=>time+i*.5),selected=measureEscapePath(chosen.path,circle,cell,time,time+arm.horizon,knots);
     if(selected.exposureSeconds<=1e-8)return;
     for(const a of admissible.filter(a=>a!==chosen&&(mode==='cost-diagnose'||(a.predictedExposure??1)===0)).sort((a,b)=>a.score-b.score)){
      const alternative=measureEscapePath(a.path,circle,cell,time,time+arm.horizon,knots);
      if(mode==='cost-diagnose'?alternative.exposureSeconds+.5<selected.exposureSeconds:alternative.exposureSeconds<=1e-8){witness={chosenExposure:selected.exposureSeconds,chosenScore:chosen.score,alternativeScore:a.score,alternativeExposure:alternative.exposureSeconds,alternativeAction:a.action,alternativeMinClearance:alternative.minClearance,alternativeReturnMargin:a.returnMargin};contactTradeoffs++;break;}
     }
    }:undefined});if(firstPlan===null)firstPlan=time;
   }
   const latency=performance.now()-began;if(decision)latencies.push(latency);
   if(tr)for(const horizon of [5,10,20,30])if(time+horizon<=duration){const p=arm.perfect?trueForecast(time+horizon):forecast(tr,time+horizon,true,legacy.localizationSigma),actual=truth(time+horizon);predictionErrors.push({horizon,positionSquared:(p.x-actual.x)**2+(p.y-actual.y)**2,radiusAbsolute:Math.abs(p.radius+1-actual.radius)});}
   const path=decision?.chosen?.path??[{...pos,time},{...pos,time:time+2}],cut=[...new Set([time,time+2,...path.filter(p=>p.time>time&&p.time<time+2).map(p=>p.time)])].sort((a,b)=>a-b);
   for(let j=1;j<cut.length;j++){const a=positionOnPath(path,cut[j-1]),b=positionOnPath(path,cut[j]);if(!staticSegmentSafe(context.terrain,settings,a,b))terrainViolations++;if(motionStart===null&&Math.hypot(a.x-b.x,a.y-b.y)>1e-8)motionStart=cut[j-1];executed.push({...b,time:cut[j]});}
   const end=positionOnPath(path,time+2);if(Math.hypot(end.x-pos.x,end.y-pos.y)<1e-8)holdSeconds+=2;
   for(let dt=0;dt<2;dt+=.25){const p=positionOnPath(path,time+dt),margin=returnMargin(context,p,time+dt);minReturnMargin=Math.min(minReturnMargin,margin);if(!resourceSafe(resources(time+dt),0,localReturnSeconds(context,p),12))resourceViolationSeconds+=.25;}
   steps.push({time,estimateLatestTime:tr?.time??null,action:decision?.action??'UNAVAILABLE',position:pos,nextPosition:end,latencyMs:decision?latency:null,predictedExposure:decision?.chosen?.predictedExposure??null,chosenScore:decision?.chosen?.score??null,returnMarginSeconds:returnMargin(context,pos,time),candidateCount,witness});pos=end;
  }
  const metrics=measureEscapePath(executed,truth,cell,0,duration,[s.turnTime]),margin=returnMargin(context,pos,duration);
  const episode={id:s.id,arm:arm.name,region:s.region,initiallyInside:s.initiallyInside,stationaryThreat:stationary.exposureSeconds>1e-8,warningPlacement:s.warning,actualStationaryFirstContact:stationary.intervals[0]?.[0]??null,detectionTime:0,estimateReadyTime:arm.perfect?0:4,firstPlanTime:firstPlan,firstMovementTime:motionStart,computationIncludedInDynamics:false,...metrics,noContact:metrics.exposureSeconds<=1e-8,returnMarginSeconds:margin,minReturnMarginSeconds:Math.min(margin,minReturnMargin),returnFailure:margin< -1e-8||resourceViolationSeconds>0,resourceViolationSeconds,terrainViolations,holdSeconds,contactTradeoffs,latencies,predictionErrors,steps,trajectory:executed};episodes.push(episode);
 }
 console.log('completed',s.id);
}
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/(v.length||1),quantile=(v:number[],q:number)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(q*v.length))]??null;
const summary=Object.fromEntries([...new Set(episodes.map(e=>e.arm))].map(arm=>{const es=episodes.filter(e=>e.arm===arm),threat=es.filter(e=>e.stationaryThreat&&!e.initiallyInside),near=es.filter(e=>!e.stationaryThreat),lat=es.flatMap(e=>e.latencies);return [arm,{episodes:es.length,noContact:es.filter(e=>e.noContact).length,threatening:threat.length,threateningNoContact:threat.filter(e=>e.noContact).length,nearMissContact:near.filter(e=>!e.noContact).length,meanExposure:mean(es.map(e=>e.exposureSeconds)),meanMinClearance:mean(es.map(e=>e.minClearance)),worstMinClearance:Math.min(...es.map(e=>e.minClearance)),returnFailures:es.filter(e=>e.returnFailure).length,terrainViolations:es.reduce((n,e)=>n+e.terrainViolations,0),minReturnMargin:Math.min(...es.map(e=>e.minReturnMarginSeconds)),contactTradeoffs:es.reduce((n,e)=>n+e.contactTradeoffs,0),meanHoldSeconds:mean(es.map(e=>e.holdSeconds)),prediction:Object.fromEntries([5,10,20,30].map(h=>{const rows=es.flatMap(e=>e.predictionErrors).filter(p=>p.horizon===h);return [h,{windows:rows.length,positionRMSE:Math.sqrt(mean(rows.map(p=>p.positionSquared))),radiusMAE:mean(rows.map(p=>p.radiusAbsolute))}];})),replanMs:{p50:quantile(lat,.5),p95:quantile(lat,.95),max:Math.max(...lat)}}];}));
write(filename,{scope:'SYNTHETIC_COUNTERFACTUAL_SIMULATION',manifestSHA256:sha(root+'/manifest.json'),protocolSHA256:sha('docs/ESCAPE_V5_PROTOCOL.md'),implementationSHA256:mode==='test'?sha(root+'/implementation-freeze.json'):null,arms:mode==='test'?testArms:diagnosticArms,summary,cases,episodes});
console.log(JSON.stringify(summary,null,2));
