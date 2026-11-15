import type {RecordedPassage} from './observed-replay';
import {conditionalAt,planObservedEscape,recordedReturnMap,relocatedVortex,REPLAY_CONDITIONS} from './observed-escape';
import {gridPoint,roverTerrain,ROVER_SETTINGS} from './rover-navigation';
import type {RoverGrid} from './rover-navigation';
import type {Point} from './planner';
import type {HazardModel,ResourceState} from './hazard-planner';
import {positionOnPath} from './hazard-planner';
import type {XRNavigationFrame} from './hazard-xr';

export function observedSession(grid:RoverGrid,event:RecordedPassage,heading:number,model:HazardModel='MARS SHIFT',warning=18,speed=.6){
 const terrain=roverTerrain(grid,[]),base=gridPoint(grid,grid.start.x,grid.start.z),target=gridPoint(grid,grid.target.x,grid.target.z),settings={...ROVER_SETTINGS,speed,scienceMinutes:0},returns=recordedReturnMap(terrain,base,settings),vortex=relocatedVortex(event.fit,base,grid.cellSize,heading,warning);
 const resources:ResourceState={oxygenSeconds:300,batterySeconds:300,missionSeconds:240,reserveFraction:.2,oxygenReserveSeconds:60,batteryReserveSeconds:60};
 return {grid,event,terrain,base,target,settings,returns,vortex,resources,model,time:0,position:{...base},trace:[{...base,time:0}],returnComplete:false,done:false};
}
export type ObservedSession=ReturnType<typeof observedSession>;
export function observedSnapshot(session:ObservedSession){
 const s=session,decision=planObservedEscape(s.terrain,s.settings,s.position,s.base,s.time>=50?s.base:s.target,s.time,s.resources,s.vortex,s.model,s.returns),chosen=decision.chosen;
 const frame:XRNavigationFrame={schemaVersion:1,revision:s.time/2,timestamp:s.time,coordinates:'GRID_NORTH_EAST_METRES',crs:s.terrain.crs,bounds:s.terrain.bounds,cellSize:s.grid.cellSize,origin:s.position,action:chosen?.action??'NO FEASIBLE ROUTE',anchorsEnabled:!!chosen,route:(chosen?.path??[]).map(p=>({x:p.x*s.grid.cellSize,y:p.y*s.grid.cellSize,time:p.time})),forecast:Array.from({length:7},(_,i)=>{const time=s.time+i*5,p=conditionalAt(s.vortex,time),sigma=s.vortex.speedSigma*(time-s.vortex.time);return {time,x:p.x,y:p.y,radius:p.radius-REPLAY_CONDITIONS.marginMetres,radius95:2*s.vortex.radiusSigma,position95:2*sigma,envelope:p.radius+2*s.vortex.radiusSigma+2*sigma,vx:s.vortex.vx,vy:s.vortex.vy,age:0,valid:true};}),source:'SIMULATION',localizationSigma:0,warning:decision.reason,evidence:{kind:'OBSERVATION_CONSTRAINED_RELOCATION',event:s.event.id,heading:'ASSUMED',position:'NOT_OBSERVED',terrain:'NAVCAM_SOL477'},routeEvaluation:{contactMethod:'CONTINUOUS',predictedContactSeconds:chosen?.contact??null,predictedMinClearanceMetres:chosen?.clearance??null,returnMarginSeconds:chosen?.returnMargin??null,warningTimeReference:'STATIONARY_ENVELOPE_FRONT_ENTRY'}};
 return {time:s.time,position:s.position,base:s.base,target:s.target,resources:{...s.resources},frame,decision,done:s.done,returnComplete:s.returnComplete};
}
export type ObservedSnapshot=ReturnType<typeof observedSnapshot>;
export function advanceObserved(s:ObservedSession,decision:ObservedSnapshot['decision']){
 if(s.done)return;const path=decision.chosen?.path;
 if(!path){s.done=true;return;}
 const time=s.time+REPLAY_CONDITIONS.updateSeconds,next=positionOnPath(path,time);
 // Preserve all traversed corners for continuous scoring; never replace them by one chord.
 s.trace.push(...path.filter(p=>p.time>s.time&&p.time<time),{...next,time});
 s.position=next as Point;s.time=time;s.resources.oxygenSeconds-=2*(1+s.settings.loadKg*.01);s.resources.batterySeconds-=2*(1+s.settings.loadKg*.005);s.resources.missionSeconds-=2;
 s.returnComplete=time>=50&&Math.hypot(next.x-s.base.x,next.y-s.base.y)*s.grid.cellSize<.25;s.done=s.returnComplete||time>=120;
}
