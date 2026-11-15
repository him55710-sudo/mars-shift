import {encounterGraph,advanceEncounter} from './encounter-v7';
import {makeAbrupt,planAbrupt,abruptPrediction,availableFixes,V8} from './encounter-v8';
import type {AbruptSession,ArmV8} from './encounter-v8';
import {roverTerrain,gridPoint} from './rover-navigation';
import {measureEscapePath} from './escape-metrics';
import type {XRNavigationFrame} from './hazard-xr';
let s:AbruptSession|null=null,decision:ReturnType<typeof planAbrupt>|null=null,arm:ArmV8='MARS SHIFT';
self.onmessage=({data})=>{try{
 if(data.type==='init'){const t=data.case.terrain==='navcam'?roverTerrain(data.grid,[]):data.terrain;arm=data.arm;s=makeAbrupt(encounterGraph(t,data.case.speed),data.case,data.source,data.wind,data.case.terrain==='navcam'?gridPoint(data.grid,data.grid.start.x,data.grid.start.z):undefined);s.predictor=data.predictor??'CV_SMOOTH';s.alpha=data.alpha??.1;s.nominalRegretCap=.5;}
 else if(s&&decision)advanceEncounter(s,decision);
 if(!s)return;const t=s.g.terrain;decision=planAbrupt(s,arm);const f=abruptPrediction(s,arm==='Oracle'),history=availableFixes(s),guide=!!f&&s.time>=s.firstDetect+s.c.reaction&&decision.action!=='NO FEASIBLE ROUTE';
 const frame:XRNavigationFrame={schemaVersion:1,revision:s.time/2,timestamp:s.time,coordinates:s.c.terrain==='navcam'?'GRID_NORTH_EAST_METRES':'GRID_EAST_SOUTH_METRES',crs:t.crs,bounds:t.bounds,cellSize:t.cellSize,origin:s.position,action:decision.action,anchorsEnabled:guide,route:guide?decision.path.map(p=>({x:p.x*t.cellSize,y:p.y*t.cellSize,time:p.time})):[],forecast:f?Array.from({length:9},(_,i)=>{const time=s!.time+i*6,p=f(time);return {time,x:p.x,y:p.y,radius:p.radius-1,envelope:p.radius+Math.hypot(p.sigma,p.radiusSigma),position95:2.447747*p.sigma,radius95:1.96*p.radiusSigma,vx:p.vx,vy:p.vy,age:time-history.at(-1)!.time,valid:history.length>=2};}):[],source:'SIMULATION',localizationSigma:s.c.positionSigma,warning:decision.reason,routeEvaluation:{contactMethod:'CONTINUOUS',predictedContactSeconds:decision.contact,predictedMinClearanceMetres:Number.isFinite(decision.clearance)?decision.clearance:null,returnMarginSeconds:decision.returnMargin,warningTimeReference:'STATIONARY_ENVELOPE_FRONT_ENTRY'}};
 const measured=s.time>s.c.birth?measureEscapePath(s.trace,s.truth,t.cellSize,s.c.birth,s.time,s.truthKnots):{exposureSeconds:0,minClearance:null};
 postMessage({id:data.id,snapshot:{time:s.time,position:s.position,base:s.base,target:s.time>=V8.returnAt?s.base:s.target,initial:s.initial,frame,decision,measured,resources:s.resources,done:s.done,returned:s.returned,evaluationUntil:s.evaluationUntil,truth:s.truth(s.time),settings:s.g.settings,firstDetect:history.length?s.firstDetect:null,estimateReady:history.length>=2?s.estimateReady:null,fixes:history.length,birth:s.c.birth}});
 }catch(e){postMessage({id:data.id,error:e instanceof Error?e.message:String(e)});}};
