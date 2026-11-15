import fs from 'node:fs';import crypto from 'node:crypto';
import {headOnBoundary,straightEncounter,bestStraightEscape,sweptContact,linearClearance} from '../src/dust-devil-geometry';
import {DEFAULTS,nearestAllowed} from '../src/planner';import type {Terrain,Point} from '../src/planner';
import {prepareHazardContext,decideEscape,positionOnPath,staticSegmentSafe,resourceSafe} from '../src/hazard-planner';import type {HazardModel,TimedPoint,ResourceState} from '../src/hazard-planner';
import {localReturnSeconds} from '../src/local-return';import {fitLocalTrack} from '../src/local-dust-tracker';import {forecast} from '../src/hazard-tracker';import type {VortexObservation} from '../src/hazard-tracker';
import {seededRandom} from '../src/hazard-simulation';import {validateNoah} from '../src/noah-data';
const root='public/data/hazards',sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),data=JSON.parse(fs.readFileSync(root+'/jezero-vortex-parameters.json','utf8'));
const out=process.argv[2]??'geometry',mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/(a.length||1);
if(out==='geometry'){
 const rows=[];
 for(const diameter of [5,10,20,25,40,60,100,280])for(const speed of [1,3,5.3,10,20])for(const walking of [.4,.6,.9])for(const warning of [5,10,20,30,60])for(const delay of [2,6,10])for(const offsetFraction of [0,.5,.9,1.2]){
  const R=diameter/2+2,b=offsetFraction*R,x=-(speed*warning+Math.sqrt(Math.max(0,R*R-b*b))),center={x,y:b},v={x:speed,y:0},duration=warning+2*R/(speed-walking)+delay+10;
  const oracle=bestStraightEscape(center,v,R,walking,delay,duration),hold=straightEncounter(center,v,R,{x:0,y:0},delay,duration),retreat=straightEncounter(center,v,R,{x:walking,y:0},delay,duration),side=straightEncounter(center,v,R,{x:0,y:-walking},delay,duration);
  rows.push({diameter,speed,walking,warning,delay,offsetFraction,oracleExposure:oracle.exposureSeconds,oracleClearance:oracle.minClearance,holdExposure:hold.exposureSeconds,retreatExposure:retreat.exposureSeconds,sidestepExposure:side.exposureSeconds,headOnMinimumWarning:offsetFraction===0?headOnBoundary(R,speed,walking,delay).warningSeconds:null});
 }
 const examples=[10,25,60,280].map(d=>({diameter:d,...headOnBoundary(d/2+2,5.3,.6,2)}));
 const catalogue=data.events.map((e:any)=>({id:e.id,diameter:e.diameter,speed:e.speedMps,...headOnBoundary(e.diameter/2+2,e.speedMps,.6,6)}));
 const initiallyInside=[10,25,60].flatMap(diameter=>[1,5.3,20].map(speed=>({diameter,speed,...bestStraightEscape({x:0,y:0},{x:speed,y:0},diameter/2+2,.6,0,200)})));
 fs.writeFileSync(root+'/dust-escape-geometry.json',JSON.stringify({meaning:'Exact free-plane kinematics, 2 m exclusion buffer. Oracle has true state; no terrain, acceleration or resources. Not a measured escape probability.',protocolSHA256:sha('docs/DUST_DEVIL_ESCAPE_PROTOCOL.md'),examples,catalogue,initiallyInside,rows}));console.log(JSON.stringify({rows:rows.length,examples},null,2));
}else if(out==='terrain'){
 const terrain:Terrain=JSON.parse(fs.readFileSync('public/data/terrain.json','utf8'));terrain.noah=validateNoah(terrain,JSON.parse(fs.readFileSync('public/data/noah-terrain.json','utf8')));
 const frozen=JSON.parse(fs.readFileSync(root+'/v4-frozen.json','utf8')),cfg=frozen.config,settings={...DEFAULTS,speed:.6,loadKg:12,scienceMinutes:0,mobilityModel:1 as const},models:HazardModel[]=['Baseline','Dynamic','MARS SHIFT'];
 const episodes:any[]=[],warnings:any[]=[],diagnostics:any[]=[];
 for(let i=0;i<data.events.length;i++)for(const warning of [5,20,40]){
  const e=data.events[i],seed=12001+i,rng=seededRandom(seed),angle=rng()*2*Math.PI,R=e.diameter/2+1,offsetFraction=[0,.5,1.2][i%3],b=R*offsetFraction,long=-(e.speedMps*warning+Math.sqrt(Math.max(0,R*R-b*b))),vx=Math.cos(angle)*e.speedMps,vy=Math.sin(angle)*e.speedMps;
  const start=nearestAllowed(terrain,{x:Math.round(terrain.width*(.35+rng()*.3)),y:Math.round(terrain.height*(.35+rng()*.3))},settings),target=nearestAllowed(terrain,{x:Math.round(start.x+Math.cos(angle)*12),y:Math.round(start.y+Math.sin(angle)*12)},settings),base=nearestAllowed(terrain,{x:Math.round(start.x-Math.cos(angle)*4),y:Math.round(start.y-Math.sin(angle)*4)},settings),c=prepareHazardContext(terrain,settings,base);
  const cx=start.x*terrain.cellSize+long*Math.cos(angle)-b*Math.sin(angle),cy=start.y*terrain.cellSize+long*Math.sin(angle)+b*Math.cos(angle),truth=(time:number)=>({x:cx+vx*time,y:cy+vy*time,radius:R}),duration=Math.ceil(Math.max(60,warning+2*R/(e.speedMps-.6)+15)/2)*2;
  const observations:VortexObservation[]=[];const normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());
  for(let time=0;time<=duration;time+=2){const p=truth(time);observations.push({time,x:p.x+normal(),y:p.y+normal(),radius:Math.max(.2,R-1+normal()*.5),positionSigma:1,radiusSigma:.5,source:'SIMULATED_SENSOR'});}
  const tracks=Array.from({length:duration/2},(_,k)=>k<1?null:fitLocalTrack(observations.filter(o=>o.time<=k*2-2),cfg.localTracker));
  const oracle=bestStraightEscape({x:cx-start.x*5,y:cy-start.y*5},{x:vx,y:vy},R,.6,6,duration),usable=localReturnSeconds(c,start)+duration+180;
  const initial:ResourceState={oxygenSeconds:usable*1.12/.75,batterySeconds:usable*1.06/.75,missionSeconds:usable,reserveFraction:.25,oxygenReserveSeconds:usable*1.12/3,batteryReserveSeconds:usable*1.06/3};
  const resources=(t:number)=>({...initial,oxygenSeconds:initial.oxygenSeconds-t*1.12,batterySeconds:initial.batterySeconds-t*1.06,missionSeconds:initial.missionSeconds-t});
  // Shared stationary reference: both warning methods see exactly the same truth/denominators.
  for(let time=0;time<duration;time+=2)for(const horizon of [5,10,20,30]){
   const p={x:start.x*5,y:start.y*5},a=truth(time),z=truth(time+horizon),inside=Math.hypot(p.x-a.x,p.y-a.y)<R,actual=sweptContact(p,p,a,z,horizon)>1e-8,tr=tracks[time/2];
   for(const method of ['nominal','envelope']){let predicted:null|boolean=null;if(tr&&tr.observations>=3){const f=forecast(tr,time,method==='envelope',1),g=forecast(tr,time+horizon,method==='envelope',1),ra=method==='envelope'?Math.max(f.envelope,g.envelope):f.radius+1,rb=method==='envelope'?ra:g.radius+1;predicted=sweptContact(p,p,{x:f.x,y:f.y,radius:ra},{x:g.x,y:g.y,radius:rb},horizon)>1e-8;}warnings.push({id:e.id,warning,time,horizon,method,inside,actual,predicted});}
  }
  for(const model of models){let pos:Point={...start},exposure=0,minClearance=Infinity,violations=0,resourceViolations=0,distance=0,hold=0,insideLast=false,firstExit:number|null=null;const latency:number[]=[];
   for(let time=0;time<duration;time+=2){const tr=tracks[time/2],decision=tr&&tr.observations>=3?decideEscape(c,pos,target,time,tr,resources(time),model,cfg):null,path=decision?.chosen?.path??[{...pos,time},{...pos,time:time+2}];if(decision)latency.push(decision.latencyMs);
    // Split at every trajectory knot, so the exact contact formula sees linear segments.
    const cuts=[time,...path.filter((p:TimedPoint)=>p.time>time&&p.time<time+2).map((p:TimedPoint)=>p.time),time+2].sort((a:number,b:number)=>a-b);const from={...pos};
    for(let j=1;j<cuts.length;j++){const ta=cuts[j-1],tb=cuts[j],a=positionOnPath(path,ta),b=positionOnPath(path,tb),p={x:a.x*5,y:a.y*5},q={x:b.x*5,y:b.y*5},ca=truth(ta),cb=truth(tb);exposure+=sweptContact(p,q,ca,cb,tb-ta);minClearance=Math.min(minClearance,linearClearance({x:p.x-ca.x,y:p.y-ca.y},{x:(q.x-p.x)/(tb-ta)-vx,y:(q.y-p.y)/(tb-ta)-vy},R,tb-ta).clearance);if(!staticSegmentSafe(terrain,settings,a,b))violations++;distance+=Math.hypot(q.x-p.x,q.y-p.y);}
    for(let dt=.25;dt<=2;dt+=.25){const p=positionOnPath(path,time+dt),v=truth(time+dt),inside=Math.hypot(p.x*5-v.x,p.y*5-v.y)<R;if(insideLast&&!inside&&firstExit===null)firstExit=time+dt;insideLast=inside;if(!resourceSafe(resources(time+dt),0,localReturnSeconds(c,p),12))resourceViolations+=.25;}
    pos=positionOnPath(path,time+2);if(Math.hypot(pos.x-from.x,pos.y-from.y)<1e-5)hold+=2;
   }
   episodes.push({id:e.id,seed,warning,offsetFraction,model,diameter:e.diameter,speed:e.speedMps,duration,exposureSeconds:exposure,avoided:exposure<1e-8,minClearance,firstExitSeconds:firstExit,distanceMetres:distance,holdSeconds:hold,terrainViolations:violations,resourceViolationSeconds:resourceViolations,returnFeasible:resourceSafe(resources(duration),0,localReturnSeconds(c,pos),12),returnMarginSeconds:resources(duration).missionSeconds-localReturnSeconds(c,pos),oracleExposure:oracle.exposureSeconds,oracleFeasible:oracle.exposureSeconds<1e-8,replanMs:latency});
  }
  diagnostics.push({id:e.id,warning,diameter:e.diameter,speed:e.speedMps,offsetFraction,oracleExposure:oracle.exposureSeconds,headOnBound:offsetFraction===0?headOnBoundary(R,e.speedMps,.6,6):null});
  console.log('completed',i+1,warning);
 }
 const summarize=(rows:any[])=>({episodes:rows.length,meanExposure:mean(rows.map(r=>r.exposureSeconds)),avoided:rows.filter(r=>r.avoided).length,returnFailures:rows.filter(r=>!r.returnFeasible).length,terrainViolations:rows.reduce((s,r)=>s+r.terrainViolations,0),oracleFeasible:rows.filter(r=>r.oracleFeasible).length,missedOracleOpportunity:rows.filter(r=>r.oracleFeasible&&!r.avoided).length});
 const byWarning=Object.fromEntries([5,20,40].map(w=>[w,Object.fromEntries(models.map(m=>[m,summarize(episodes.filter(r=>r.warning===w&&r.model===m))]))]));
 const confusion=[5,10,20,30].flatMap(horizon=>['nominal','envelope'].map(method=>{const all=warnings.filter(r=>r.horizon===horizon&&r.method===method),outside=all.filter(r=>!r.inside),a=outside.filter(r=>r.predicted!==null),tp=a.filter(r=>r.actual&&r.predicted).length,fn=a.filter(r=>r.actual&&!r.predicted).length,fp=a.filter(r=>!r.actual&&r.predicted).length,tn=a.filter(r=>!r.actual&&!r.predicted).length,unknown=outside.filter(r=>r.predicted===null),unknownDanger=unknown.filter(r=>r.actual).length;return {horizon,method,TP:tp,FN:fn,FP:fp,TN:tn,falseNegativeRate:fn/(tp+fn||1),falsePositiveRate:fp/(fp+tn||1),insideExcluded:all.length-outside.length,unavailable:unknown.length,unavailableDanger:unknownDanger,missedOrUnavailable:fn+unknownDanger,allOutsideDanger:tp+fn+unknownDanger};}));
 const report={meaning:'22 previously used model-inferred Jezero vortex parameter sets, reverified against the original Table S3. New counterfactual placement, assumed 2s sensors, 6s first action, 1m exclusion buffer as frozen v4. Exact swept contact. Not new independent events or measured Mars escape/collision rates.',interpretationAmendments:'docs/DUST_DEVIL_ESCAPE_AMENDMENTS.md',protocolSHA256:sha('docs/DUST_DEVIL_ESCAPE_PROTOCOL.md'),frozenConfigSHA256:sha(root+'/v4-frozen.json'),byWarning,confusion,diagnostics,episodes};fs.writeFileSync(root+'/dust-escape-terrain.json',JSON.stringify(report,null,2));console.log(JSON.stringify({byWarning,confusion},null,2));
}else throw Error('Unknown mode');
