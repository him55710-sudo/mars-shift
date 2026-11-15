import type {Point,Terrain,Settings} from './planner';
import {DEFAULTS,nearestAllowed,index,blocked} from './planner';
import {decideEscape,positionOnPath,resourceSafe,staticSegmentSafe} from './hazard-planner';
import type {HazardContext,HazardModel,HazardConfig,ResourceState,EscapeDecision} from './hazard-planner';
import {startTrack,updateTrack,updateTrackResponsive,forecast} from './hazard-tracker';
import type {VortexObservation,VortexTrack} from './hazard-tracker';
export type CatalogEntry={event:string;diameter:number;diameterSigma:number;advection:number;advectionSigma:number};
export type WeatherEvidence={background:{speedMps:number;pressurePa:number;temperatureK:number};catalog:CatalogEntry[]};
export type ScenarioKind='crossing'|'approach'|'passing'|'turning'|'growing'|'dropout'|'low-reserve'|'large-vortex'|'accelerating'|'oblique'|'inside'|'sensor-gap'|'broad-front'|'noisy'|'reversal'|'drift-turn'|'stop-start'|'radius-pulse';
export const SCENARIOS:ScenarioKind[]=['crossing','approach','passing','turning','growing','dropout','low-reserve','large-vortex'];
export const NOVEL_SCENARIOS:ScenarioKind[]=['accelerating','oblique','inside','sensor-gap','broad-front','noisy','reversal','drift-turn'];
export const FINAL_SCENARIOS:ScenarioKind[]=[...NOVEL_SCENARIOS,'stop-start','radius-pulse'];
export type TruthPoint={time:number;x:number;y:number;radius:number};
export type HazardScenario={seed:number;kind:ScenarioKind;start:Point;target:Point;base:Point;truth:TruthPoint[];observations:VortexObservation[];settings:Settings;resources:ResourceState;catalogEvent:string;terrainEffect:'ASSUMED_CONTOUR_DEFLECTION'|'NO_TERRAIN_WIND_CORRECTION';background:WeatherEvidence['background'];duration:number};
export function seededRandom(seed:number){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function gaussian(rng:()=>number){return Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());}
/** Cheap precomputable field. This terrain deflection is an ASSUMPTION, not CFD output. */
export function assumedWindField(t:Terrain,vx:number,vy:number){
 const east=new Float32Array(t.width*t.height),south=new Float32Array(east.length);
 for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){
  const i=y*t.width+x,h=t.elevation[i]??0,l=t.elevation[y*t.width+Math.max(0,x-1)]??h,r=t.elevation[y*t.width+Math.min(t.width-1,x+1)]??h,u=t.elevation[Math.max(0,y-1)*t.width+x]??h,d=t.elevation[Math.min(t.height-1,y+1)*t.width+x]??h;
  const gx=(r-l)/(2*t.cellSize),gy=(d-u)/(2*t.cellSize),norm=Math.hypot(gx,gy),dot=norm?(vx*gx+vy*gy)/norm:0,k=Math.min(.25,norm*.5);
  east[i]=vx-k*dot*(norm?gx/norm:0);south[i]=vy-k*dot*(norm?gy/norm:0);
 }return {east,south,kind:'ASSUMPTION' as const};
}
export function makeScenario(t:Terrain,evidence:WeatherEvidence,seed:number,kind:ScenarioKind=SCENARIOS[seed%SCENARIOS.length],duration=60):HazardScenario {
 if(FINAL_SCENARIOS.includes(kind))return makeNovelScenario(t,evidence,seed,kind,duration);
 const rng=seededRandom(seed),settings={...DEFAULTS,speed:[.4,.6,.9][seed%3],loadKg:12,scienceMinutes:0,mobilityModel:1 as const},start=nearestAllowed(t,{x:Math.floor(t.width*.45)+Math.floor(rng()*15),y:Math.floor(t.height*.5)+Math.floor(rng()*10)},settings),target=nearestAllowed(t,{x:start.x+9,y:start.y},settings),base=nearestAllowed(t,{x:start.x-6,y:start.y+2},settings);
 const eligible=evidence.catalog.filter(c=>c.diameter<40),entry=(kind==='large-vortex'?evidence.catalog:eligible)[seed%(kind==='large-vortex'?evidence.catalog.length:eligible.length)];
 const speed=entry.advection,radius=kind==='large-vortex'?Math.max(40,entry.diameter/2):entry.diameter/2,angle=kind==='approach'?0:Math.PI/2+(rng()-.5)*.3,vx=Math.cos(angle)*speed,vy=Math.sin(angle)*speed,encounter=18+rng()*15;
 const center={x:start.x*t.cellSize+(kind==='passing'?60:kind==='approach'?0:7+rng()*9),y:start.y*t.cellSize};
 let x=center.x-vx*(encounter+12),y=center.y-vy*(encounter+12);const truth:TruthPoint[]=[],field=assumedWindField(t,vx,vy);
 for(let step=0;step<=(duration+72)*4;step++){
  const time=-12+step*.25,cell=index(t,{x:Math.max(0,Math.min(t.width-1,Math.round(x/t.cellSize))),y:Math.max(0,Math.min(t.height-1,Math.round(y/t.cellSize)))}),bend=kind==='turning'&&time>12?.75*Math.sin((time-12)/20):.03*Math.sin(time/13+seed),wx=field.east[cell],wy=field.south[cell];
  truth.push({time,x,y,radius:Math.max(1,radius+(kind==='growing'?Math.max(0,time)*.12:Math.sin(time/11)*.2))});x+=(wx*Math.cos(bend)-wy*Math.sin(bend))*.25;y+=(wx*Math.sin(bend)+wy*Math.cos(bend))*.25;
 }
 const observations:VortexObservation[]=[];
 for(let time=-12;time<=duration;time+=2){if(kind==='dropout'&&time>=14&&time<=30)continue;const tr=truth[Math.round((time+12)*4)],sigma=kind==='turning'?2:1;
  observations.push({time,x:tr.x+gaussian(rng)*sigma,y:tr.y+gaussian(rng)*sigma,radius:Math.max(.2,tr.radius+gaussian(rng)*.6),positionSigma:sigma,radiusSigma:.6,source:'SIMULATED_SENSOR'});
 }
 const resources={oxygenSeconds:kind==='low-reserve'?150:1800,batterySeconds:kind==='low-reserve'?155:1800,missionSeconds:kind==='low-reserve'?150:1800,reserveFraction:.25,oxygenReserveSeconds:(kind==='low-reserve'?150:1800)*.25,batteryReserveSeconds:(kind==='low-reserve'?155:1800)*.25};
 return {seed,kind,start,target,base,truth,observations,settings,resources,catalogEvent:entry.event,terrainEffect:'ASSUMED_CONTOUR_DEFLECTION',background:evidence.background,duration};
}
/** Independent placement/dynamics family. Last two families are reserved for v2 tests. */
export function makeNovelScenario(t:Terrain,e:WeatherEvidence,seed:number,kind:ScenarioKind,duration=60):HazardScenario {
 const rng=seededRandom(seed^0x65ac123),angle=rng()*2*Math.PI,heading=rng()*2*Math.PI,settings={...DEFAULTS,speed:.35+rng()*.65,loadKg:6+rng()*12,scienceMinutes:0,mobilityModel:1 as const};
 const start=nearestAllowed(t,{x:Math.floor(t.width*(.2+rng()*.6)),y:Math.floor(t.height*(.2+rng()*.6))},settings);
 const target=nearestAllowed(t,{x:Math.round(start.x+Math.cos(heading)*18),y:Math.round(start.y+Math.sin(heading)*18)},settings),base=nearestAllowed(t,{x:Math.round(start.x-Math.cos(heading)*4),y:Math.round(start.y-Math.sin(heading)*4)},settings);
 const eligible=e.catalog.filter(c=>c.diameter<60),entry=eligible[Math.floor(rng()*eligible.length)],speed=entry.advection*(.75+rng()*.5),radius=kind==='broad-front'?75+rng()*50:entry.diameter/2,hit=kind==='inside'?0:12+rng()*18;
 const offset=kind==='oblique'?(rng()-.5)*20:kind==='broad-front'?radius-8:(rng()-.5)*8,center={x:start.x*t.cellSize-Math.sin(angle)*offset,y:start.y*t.cellSize+Math.cos(angle)*offset};
 let x=center.x-Math.cos(angle)*speed*(hit+12),y=center.y-Math.sin(angle)*speed*(hit+12);const truth:TruthPoint[]=[];
 for(let k=0;k<=(duration+72)*4;k++){
  const time=-12+k*.25,turn=kind==='drift-turn'?.8*Math.sin(Math.max(0,time-5)/7):kind==='reversal'&&time>18?Math.PI:kind==='oblique'?.3*Math.sin(time/20):0,mult=kind==='accelerating'?Math.max(.5,1+time*.018):kind==='stop-start'&&time>=8&&time<22?.05:1;
  truth.push({time,x,y,radius:Math.max(1,radius+(kind==='broad-front'?Math.max(0,time)*.15:kind==='radius-pulse'?radius*.6*Math.sin(time/5):.4*Math.sin(time/9)))});
  x+=Math.cos(angle+turn)*speed*mult*.25;y+=Math.sin(angle+turn)*speed*mult*.25;
 }
 const observations:VortexObservation[]=[];for(let time=-12;time<=duration;time+=2){if(kind==='sensor-gap'&&time>=10&&time<=22)continue;const p=truth[(time+12)*4],sigma=kind==='noisy'?1+Math.abs(Math.sin(time/8))*3:1.2;observations.push({time,x:p.x+gaussian(rng)*sigma+(kind==='noisy'&&time===18?80:0),y:p.y+gaussian(rng)*sigma,radius:Math.max(.2,p.radius+gaussian(rng)*.8),positionSigma:sigma,radiusSigma:.8,source:'SIMULATED_SENSOR'});}
 const budget=seed%4===0?130+rng()*50:1200,resources={oxygenSeconds:budget,batterySeconds:budget*1.1,missionSeconds:budget,reserveFraction:.25,oxygenReserveSeconds:budget*.25,batteryReserveSeconds:budget*1.1*.25};
 return {seed,kind,start,target,base,truth,observations,settings,resources,catalogEvent:entry.event,terrainEffect:'ASSUMED_CONTOUR_DEFLECTION',background:e.background,duration};
}
export function truthAt(s:HazardScenario,time:number):TruthPoint {
 const at=Math.max(0,Math.min(s.truth.length-1,(time+12)*4)),lo=Math.floor(at),a=s.truth[lo],b=s.truth[Math.min(s.truth.length-1,lo+1)],u=at-lo;return {time,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,radius:a.radius+(b.radius-a.radius)*u};
}
export function trackAt(s:HazardScenario,time:number,q=.08,responsive=false){let tr:VortexTrack|null=null;for(const o of s.observations){if(o.time>time)break;tr=tr?(responsive?updateTrackResponsive(tr,o):updateTrack(tr,o)):startTrack(o,q);}if(!tr)throw Error('No observations yet');return tr;}
export type EpisodeMetrics={seed:number;kind:ScenarioKind;model:HazardModel;exposureSeconds:number;groundRiskMetres:number;constraintViolations:number;distanceMetres:number;movingSeconds:number;holdSeconds:number;unnecessaryHoldSeconds:number;noActionSeconds:number;returnFeasible:boolean;resourceViolationSeconds:number;progressMetres:number;replanMs:number[];forecastErrors:{horizon:number;position:number;radius:number;covered:boolean}[];actionCounts:Record<string,number>;trace:{time:number;point:Point;action:string;status:string}[]};
export function remainingResources(s:HazardScenario,elapsed:number):ResourceState{return {...s.resources,oxygenSeconds:Math.max(0,s.resources.oxygenSeconds-elapsed*(1+s.settings.loadKg*.01)),batterySeconds:Math.max(0,s.resources.batterySeconds-elapsed*(1+s.settings.loadKg*.005)),missionSeconds:Math.max(0,s.resources.missionSeconds-elapsed)};}
/** Evaluation owns hidden truth; the planner receives only past observations and a map. */
export function runEpisode(c:HazardContext,s:HazardScenario,model:HazardModel,config:HazardConfig,q=.08):EpisodeMetrics {
 let position={...s.start};const result:EpisodeMetrics={seed:s.seed,kind:s.kind,model,exposureSeconds:0,groundRiskMetres:0,constraintViolations:0,distanceMetres:0,movingSeconds:0,holdSeconds:0,unnecessaryHoldSeconds:0,noActionSeconds:0,returnFeasible:false,resourceViolationSeconds:0,progressMetres:0,replanMs:[],forecastErrors:[],actionCounts:{},trace:[]};
 for(let time=0;time<s.duration;time+=2){
  const track=trackAt(s,time,q,model==='MARS SHIFT'&&config.responsiveTracking),resources=remainingResources(s,time),decision=decideEscape(c,position,s.target,time,track,resources,model,config),path=decision.chosen?.path;
  result.replanMs.push(decision.latencyMs);result.actionCounts[decision.action??decision.status]=(result.actionCounts[decision.action??decision.status]??0)+1;
  result.trace.push({time,point:{...position},action:decision.action??'UNVERIFIED HOLD',status:decision.status});
  if(!path)result.noActionSeconds+=2;
  const from={...position};let moved=0;
  for(let dt=.25;dt<=2;dt+=.25){const next=path?positionOnPath(path,time+dt):position,tr=truthAt(s,time+dt-.125),mid={x:(position.x+next.x)/2*c.terrain.cellSize,y:(position.y+next.y)/2*c.terrain.cellSize},d=Math.hypot(next.x-position.x,next.y-position.y)*c.terrain.cellSize;
   // Quarter-second midpoint quadrature; separate exact-edge tests protect the planner.
   if(Math.hypot(mid.x-tr.x,mid.y-tr.y)<=tr.radius+1)result.exposureSeconds+=.25;
   if(!staticSegmentSafe(c.terrain,c.settings,position,next))result.constraintViolations++;
   const i=index(c.terrain,{x:Math.round(next.x),y:Math.round(next.y)});result.groundRiskMetres+=d*c.ground.risk[i];moved+=d;position=next;
  }
  result.distanceMetres+=moved;if(moved>.01)result.movingSeconds+=2;else {result.holdSeconds+=2;
   const nominal=decideEscape(c,from,s.target,time,track,resources,'Baseline',config).chosen?.path;
   if(nominal){let safe=true;for(let dt=0;dt<=config.horizon;dt+=.5){const p=positionOnPath(nominal,time+dt),tr=truthAt(s,time+dt);if(Math.hypot(p.x*c.terrain.cellSize-tr.x,p.y*c.terrain.cellSize-tr.y)<=tr.radius+1)safe=false;}if(safe)result.unnecessaryHoldSeconds+=2;}
  }
  const i=index(c.terrain,{x:Math.round(position.x),y:Math.round(position.y)});result.returnFeasible=resourceSafe(remainingResources(s,time+2),0,c.returnSeconds[i],s.settings.loadKg);if(!result.returnFeasible)result.resourceViolationSeconds+=2;
  if(model==='MARS SHIFT'&&time<=s.duration-30)for(const horizon of [5,10,20,30]){const f=forecast(track,time+horizon,true),tr=truthAt(s,time+horizon),error=Math.hypot(f.x-tr.x,f.y-tr.y);result.forecastErrors.push({horizon,position:error,radius:Math.abs(f.radius-tr.radius),covered:error<=f.position95});}
 }
 result.progressMetres=(Math.hypot(s.start.x-s.target.x,s.start.y-s.target.y)-Math.hypot(position.x-s.target.x,position.y-s.target.y))*c.terrain.cellSize;return result;
}
/** Physical context only. Dynamic pressure does not predict injury, abrasion, visibility or seal failure. */
export function aerodynamicContext(e:WeatherEvidence){const density=e.background.pressurePa/(188.92*e.background.temperatureK);return {densityKgM3:density,backgroundDynamicPressurePa:.5*density*e.background.speedMps**2,damageProbability:null,meaning:'CO2 ideal gas and background 1/2 rho v²; not vortex circulation or human harm'};}
