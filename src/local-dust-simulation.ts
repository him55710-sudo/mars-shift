import {DEFAULTS,nearestAllowed,index} from './planner';
import type {Terrain,Point} from './planner';
import {seededRandom,remainingResources,truthAt} from './hazard-simulation';
import type {HazardScenario,ScenarioKind,TruthPoint} from './hazard-simulation';
import {prepareHazardContext,decideEscape,positionOnPath,resourceSafe,staticSegmentSafe} from './hazard-planner';
import type {HazardContext,HazardModel,HazardConfig} from './hazard-planner';
import {fitLocalTrack} from './local-dust-tracker';
import type {VortexObservation} from './hazard-tracker';
import {localReturnSeconds} from './local-return';
export type LocalImageEvent={id:string;split:string;diameterMetres:number;advectionMps?:number|null;cadenceSeconds:number;points:{time:number;x:number;width:number}[]};
export type LocalEvidence={events:LocalImageEvent[];catalog:{id:string;group:string;split:string;diameter:number;speedMps:number;azimuthDeg:number}[]};
export type LocalScenario=HazardScenario&{sourceId:string;diameter:number;motionProvenance:string;initialReturnFeasible:boolean};
export const LOCAL_KINDS:ScenarioKind[]=['crossing','inside','passing','growing','sensor-gap','low-reserve','turning','oblique','radius-pulse','large-vortex'];
const gaussian=(r:()=>number)=>Math.sqrt(-2*Math.log(Math.max(1e-12,r())))*Math.cos(2*Math.PI*r());
function interpolate(e:LocalImageEvent,time:number){const points=e.points;let i=1;while(i<points.length-1&&points[i].time<time)i++;const a=points[i-1],b=points[i],u=(time-a.time)/(b.time-a.time);return {x:a.x+(b.x-a.x)*u,width:Math.max(1,a.width+(b.width-a.width)*u)};}
/** Measured size/speed priors, simulated placement and range sensors. Image replays are
 * counterfactual: crossrange shape is rotated/scaled; radial motion was not observed. */
export function makeLocalScenario(t:Terrain,e:LocalEvidence,seed:number,kind:ScenarioKind,split='test'):LocalScenario {
 const rng=seededRandom(seed),settings={...DEFAULTS,speed:[.4,.6,.9][seed%3],loadKg:12,scienceMinutes:0,mobilityModel:1 as const};
 const start=nearestAllowed(t,{x:Math.floor(t.width*(.3+rng()*.4)),y:Math.floor(t.height*(.3+rng()*.4))},settings),heading=rng()*Math.PI*2;
 const target=nearestAllowed(t,{x:Math.round(start.x+Math.cos(heading)*15),y:Math.round(start.y+Math.sin(heading)*15)},settings),base=nearestAllowed(t,{x:Math.round(start.x-Math.cos(heading)*4),y:Math.round(start.y-Math.sin(heading)*4)},settings);
 const catalog=e.catalog.filter(a=>a.split===split),entry=catalog[seed%catalog.length];if(!entry)throw Error('Empty source split');
 const replay=kind==='oblique'||kind==='radius-pulse',events=e.events.filter(a=>a.split===split),event=replay?events[(seed%2)%events.length]:null;
 const controlled=seed%4===0,diameter=event?.diameterMetres??(controlled?[10,60,280][Math.floor(seed/4)%3]:entry.diameter),radius=diameter/2,speed=event?.advectionMps??entry.speedMps,angle=rng()*2*Math.PI;
 const hit=kind==='inside'?0:15+rng()*15,offset=kind==='passing'?radius+20:kind==='inside'?radius*.5:radius*(.5+rng()*.5),origin={x:start.x*t.cellSize-Math.sin(angle)*offset,y:start.y*t.cellSize+Math.cos(angle)*offset};
 const imageScale=event?(event.advectionMps?event.advectionMps*(event.points.at(-1)!.time-event.points[0].time)/Math.max(1,event.points.at(-1)!.x-event.points[0].x):event.diameterMetres/event.points[0].width):1;
 const truth:TruthPoint[]=[];for(let k=0;k<528;k++){const time=-12+k*.25,im=event?interpolate(event,time+12):null,center=event?interpolate(event,hit+12):null,travel=im&&center?(im.x-center.x)*imageScale:(time-hit)*speed,bend=kind==='turning'&&time>12?.4*Math.sin((time-12)/12):0;
  truth.push({time,x:origin.x+Math.cos(angle+bend)*travel,y:origin.y+Math.sin(angle+bend)*travel,radius:Math.max(1,radius*(kind==='growing'?1+Math.max(0,time)*.006:kind==='radius-pulse'&&im?Math.max(.5,Math.min(1.5,im.width/event!.points[0].width)):1))});
 }
 const observations:VortexObservation[]=[];for(let time=-12;time<=60;time+=2){if(kind==='sensor-gap'&&time>=12&&time<=24)continue;const p=truth[(time+12)*4],sigma=seed%5===0?2:.6,rs=Math.max(.4,radius*.03);observations.push({time,x:p.x+gaussian(rng)*sigma,y:p.y+gaussian(rng)*sigma,radius:Math.max(.2,p.radius+gaussian(rng)*rs),positionSigma:sigma,radiusSigma:rs,source:'SIMULATED_SENSOR'});}
 const c=prepareHazardContext(t,settings,base),back=localReturnSeconds(c,start),usable=kind==='low-reserve'?back+35:back+300,oxygen=usable*(1+settings.loadKg*.01)/.75,battery=usable*(1+settings.loadKg*.005)/.75;
 const resources={oxygenSeconds:oxygen,batterySeconds:battery,missionSeconds:usable,reserveFraction:.25,oxygenReserveSeconds:oxygen*.25,batteryReserveSeconds:battery*.25};
 return {seed,kind,start,target,base,truth,observations,settings,resources,catalogEvent:event?.id??entry.id,sourceId:event?.id??entry.group,diameter,motionProvenance:event?'OBSERVED_IMAGE_SHAPE_WITH_ASSUMED_METRIC_SCALE_AND_PLACEMENT':controlled?'CONTROLLED_DIAMETER_WITH_PUBLISHED_SPEED':'PUBLISHED_SIZE_SPEED_WITH_SIMULATED_PLACEMENT',terrainEffect:'NO_TERRAIN_WIND_CORRECTION',background:{speedMps:speed,pressurePa:700,temperatureK:210},duration:60,initialReturnFeasible:resourceSafe(resources,0,back,settings.loadKg)};
}
export function localTrackAt(s:HazardScenario,time:number,cfg:HazardConfig){return fitLocalTrack(s.observations.filter(o=>o.time<=time),cfg.localTracker);}
export function runLocalEpisode(c:HazardContext,s:LocalScenario,model:HazardModel,cfg:HazardConfig){
 let position:Point={...s.start},wasInside=false,firstExit:number|null=null,entered=false;
 const result={seed:s.seed,kind:s.kind,sourceId:s.sourceId,diameter:s.diameter,motionProvenance:s.motionProvenance,model,exposureSeconds:0,penetrationMetreSeconds:0,holdSeconds:0,unnecessaryHoldSeconds:0,noActionSeconds:0,distanceMetres:0,groundRiskMetres:0,constraintViolations:0,resourceViolationSeconds:0,returnFeasible:false,initialReturnFeasible:s.initialReturnFeasible,progressMetres:0,firstExitSeconds:null as number|null,reentries:0,replanMs:[] as number[]};
 for(let time=0;time<60;time+=2){const track=localTrackAt(s,time,cfg),r=remainingResources(s,time),d=decideEscape(c,position,s.target,time,track,r,model,cfg),path=d.chosen?.path;result.replanMs.push(d.latencyMs);if(!path)result.noActionSeconds+=2;const from={...position};let moved=0;
  for(let dt=.25;dt<=2;dt+=.25){const next=path?positionOnPath(path,time+dt):position,tr=truthAt(s,time+dt-.125),mid={x:(next.x+position.x)/2*c.terrain.cellSize,y:(next.y+position.y)/2*c.terrain.cellSize},depth=tr.radius+1-Math.hypot(mid.x-tr.x,mid.y-tr.y),inside=depth>0;
   if(inside){result.exposureSeconds+=.25;result.penetrationMetreSeconds+=depth*.25;if(!wasInside&&entered)result.reentries++;entered=true;}else if(wasInside&&firstExit===null)firstExit=time+dt;
   wasInside=inside;if(!staticSegmentSafe(c.terrain,c.settings,position,next))result.constraintViolations++;
   const length=Math.hypot(next.x-position.x,next.y-position.y)*c.terrain.cellSize;moved+=length;result.groundRiskMetres+=length*c.ground.risk[index(c.terrain,{x:Math.round(next.x),y:Math.round(next.y)})];position=next;
   if(!resourceSafe(remainingResources(s,time+dt),0,localReturnSeconds(c,position),s.settings.loadKg))result.resourceViolationSeconds+=.25;
  }
  result.distanceMetres+=moved;if(moved<.01){result.holdSeconds+=2;const nominal=decideEscape(c,from,s.target,time,track,r,'Baseline',cfg).chosen?.path;if(nominal){let safe=true;for(let dt=0;dt<=30;dt+=.5){const p=positionOnPath(nominal,time+dt),tr=truthAt(s,time+dt);if(Math.hypot(p.x*c.terrain.cellSize-tr.x,p.y*c.terrain.cellSize-tr.y)<=tr.radius+1)safe=false;}if(safe)result.unnecessaryHoldSeconds+=2;}}
 }
 result.returnFeasible=resourceSafe(remainingResources(s,60),0,localReturnSeconds(c,position),s.settings.loadKg);result.firstExitSeconds=firstExit;result.progressMetres=(Math.hypot(s.start.x-s.target.x,s.start.y-s.target.y)-Math.hypot(position.x-s.target.x,position.y-s.target.y))*c.terrain.cellSize;return result;
}
