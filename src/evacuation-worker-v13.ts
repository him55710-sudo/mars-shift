import {encounterGraph,advanceEncounter,nearestConnected} from './encounter-v7';
import {makeAbrupt,abruptPrediction,availableFixes} from './encounter-v8';
import type {AbruptSession,ArmV8} from './encounter-v8';
import {planEvacuation,planningHorizon} from './evacuation-runtime';
import {planGuardedEscape} from './guarded-escape-v13';
import {createEscapeTracker} from './adaptive-escape-v13';
import release from '../public/data/hazards/adaptive-v13/runtime-release.json';
import {evacuationClock} from './evacuation-clock';
import {roverTerrain,gridPoint} from './rover-navigation';
import {measureEscapePath} from './escape-metrics';
import type {XRNavigationFrame} from './hazard-xr';
let s:AbruptSession|null=null,decision:ReturnType<typeof planEvacuation>|null=null,arm:ArmV8|'Guarded'='MARS SHIFT';
let track=createEscapeTracker(release.config,release.covarianceScale);
self.onmessage=({data})=>{try{
 if(data.type==='init'){
   const grid=data.grid,t=roverTerrain(grid,[]);arm=data.arm;track=createEscapeTracker(release.config,release.covarianceScale);if(arm==='Guarded'&&!release.guardPromotion)arm='MARS SHIFT';
   s=makeAbrupt(encounterGraph(t,data.case.speed),data.case,data.source,data.wind,gridPoint(grid,grid.start.x,grid.start.z));
   s.target=nearestConnected(s.g,gridPoint(grid,grid.target.x,grid.target.z),s.returns);
   s.predictor='CV_SMOOTH';s.alpha=.1;s.nominalRegretCap=.5;
 }else if(s&&decision)advanceEncounter(s,decision);
 if(!s)return;const guard=arm==='Guarded'?planGuardedEscape(s,track(s)):null;decision=guard?guard.decision:planEvacuation(s,arm as ArmV8);
 const t=s.g.terrain,h=availableFixes(s),predict=guard?guard.predict:abruptPrediction(s,arm==='Oracle'),H=planningHorizon(s),guide=!!predict&&s.time>=s.firstDetect+s.c.reaction&&decision.action!=='NO FEASIBLE ROUTE';
 const clock=predict?evacuationClock(decision.path,predict,s.position,t.cellSize,s.time,H,s.firstDetect,s.estimateReady,s.firstDetect+s.c.reaction):null;
 const frame:XRNavigationFrame={schemaVersion:1,revision:s.time/2,timestamp:s.time,coordinates:'GRID_NORTH_EAST_METRES',crs:t.crs,bounds:t.bounds,cellSize:t.cellSize,origin:s.position,
   action:decision.action,anchorsEnabled:guide,route:guide?decision.path.map(p=>({x:p.x*t.cellSize,y:p.y*t.cellSize,time:p.time})):[],
   forecast:predict?Array.from({length:9},(_,i)=>{const time=s!.time+i*H/8,p=predict(time);return {time,x:p.x,y:p.y,radius:p.radius-1,envelope:p.radius+Math.hypot(p.sigma,p.radiusSigma),position95:2.447747*p.sigma,radius95:1.96*p.radiusSigma,vx:p.vx,vy:p.vy,age:time-h.at(-1)!.time,valid:h.length>=2};}):[],
   source:'SIMULATION',localizationSigma:s.c.positionSigma,warning:decision.reason,
   routeEvaluation:{contactMethod:'CONTINUOUS',predictedContactSeconds:clock?.predictedContactSeconds??null,predictedMinClearanceMetres:clock?.predictedMinClearance??null,returnMarginSeconds:decision.returnMargin,warningTimeReference:'STATIONARY_PHYSICAL_RADIUS_PLUS_1M_FRONT'}};
 const measured=s.time>s.c.birth?measureEscapePath(s.trace,s.truth,t.cellSize,s.c.birth,s.time,s.truthKnots):{exposureSeconds:0,minClearance:null};
 postMessage({id:data.id,snapshot:{time:s.time,position:s.position,base:s.base,target:s.target,initial:s.initial,frame,decision,measured,resources:s.resources,done:s.done,returned:s.returned,settings:s.g.settings,fixes:h.length,clock}});
 }catch(e){postMessage({id:data.id,error:e instanceof Error?e.message:String(e)});}};
