import {encounterGraph,makeEncounter,planEncounter,advanceEncounter,encounterPrediction,encounterTruth} from './encounter-v7';
import type {EncounterSession,EncounterArm} from './encounter-v7';
import {roverTerrain,gridPoint} from './rover-navigation';
import {measureEscapePath} from './escape-metrics';
import type {XRNavigationFrame} from './hazard-xr';
import {fitLocalTrack} from './local-dust-tracker';
import {forecast} from './hazard-tracker';
let session:EncounterSession|null=null,decision:ReturnType<typeof planEncounter>|null=null,arm:EncounterArm='Adaptive',alpha=.25;
self.onmessage=({data})=>{try{
 if(data.type==='init'){
  const terrain=data.case.terrain==='navcam'?roverTerrain(data.grid,[]):data.terrain;
  const graph=encounterGraph(terrain,data.case.speed);arm=data.arm;alpha=data.alpha;
  session=makeEncounter(graph,data.case,data.source,data.case.terrain==='navcam'?gridPoint(data.grid,data.grid.start.x,data.grid.start.z):undefined);
  session.trackerWindow=data.trackerWindow??7;session.adaptiveHorizon=false;
 }else if(session&&decision)advanceEncounter(session,decision);
 if(!session)return;const s=session,t=s.g.terrain;decision=planEncounter(s,arm,alpha);const prediction=encounterPrediction(s,arm),canGuide=s.time>=4&&decision.action!=='NO FEASIBLE ROUTE';
 const track=fitLocalTrack(s.observations.filter(o=>o.time<=s.time),{window:s.trackerWindow,radiusMode:'last',processNoise:.08});
 const frame:XRNavigationFrame={schemaVersion:1,revision:s.time/2,timestamp:s.time,coordinates:s.c.terrain==='navcam'?'GRID_NORTH_EAST_METRES':'GRID_EAST_SOUTH_METRES',crs:t.crs,bounds:t.bounds,cellSize:t.cellSize,origin:s.position,action:decision.action,anchorsEnabled:canGuide,route:canGuide?decision.path.map(p=>({x:p.x*t.cellSize,y:p.y*t.cellSize,time:p.time})):[],forecast:Array.from({length:7},(_,i)=>{const time=s.time+i*6,a=prediction(time),b=prediction(time,true),next=prediction(time+.5),uncertainty=forecast(track,time,false,0);return {time,x:a.x,y:a.y,radius:a.radius-1,envelope:b.radius,position95:arm==='Oracle'?0:uncertainty.position95,radius95:arm==='Oracle'?0:uncertainty.radius95,vx:(next.x-a.x)/.5,vy:(next.y-a.y)/.5,age:time-track.lastObservation,valid:s.time>=4};}),source:'SIMULATION',localizationSigma:.75,warning:decision.reason,routeEvaluation:{contactMethod:'CONTINUOUS',predictedContactSeconds:decision.contact,predictedMinClearanceMetres:decision.clearance,returnMarginSeconds:decision.returnMargin,warningTimeReference:'STATIONARY_ENVELOPE_FRONT_ENTRY'}};
 const truth=(time:number)=>{const c=encounterTruth(s.c,s.source,s.initial,t.cellSize,time);return {...c,radius:c.radius+1};};
 const measured=s.time?measureEscapePath(s.trace,truth,t.cellSize,0,s.time,[20]):{exposureSeconds:0,minClearance:null,intervals:[]};
 postMessage({id:data.id,snapshot:{time:s.time,position:s.position,base:s.base,target:s.time>=70?s.base:s.target,initial:s.initial,frame,decision,measured,resources:s.resources,done:s.done,returned:s.returned,evaluationUntil:s.evaluationUntil,truth:truth(s.time),settings:s.g.settings}});
 }catch(e){postMessage({id:data.id,error:e instanceof Error?e.message:String(e)});}};
