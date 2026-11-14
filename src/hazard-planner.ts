import {blocked,index,leg,point} from './planner';
import type {Point,Settings,Terrain} from './planner';
import {edgeTravelMinutes} from './mobility';
import {heightAt} from './eva-motion';
import {computeReturnMap,graphNeighbours,MinHeap} from './return-feasibility';
import {sandRiskMap} from './sand-risk';
import {forecast,sweptVortexCollision} from './hazard-tracker';
import type {VortexTrack} from './hazard-tracker';
import {exposureMPC} from './hazard-mpc';

export type HazardModel='Baseline'|'Dynamic'|'MARS SHIFT';
export type EscapeAction='HOLD'|'SIDESTEP'|'DETOUR'|'RETURN';
export type TimedPoint=Point&{time:number};
export type ResourceState={oxygenSeconds:number;batterySeconds:number;missionSeconds:number;reserveFraction:number;oxygenReserveSeconds?:number;batteryReserveSeconds?:number};
export type HazardConfig={horizon:number;step:number;groundWeight:number;uncertainty:boolean;maxExpanded:number;maxSensorAge:number;localizationSigma:number;policy?:'legacy'|'exposure-mpc';exposureWeight?:number;responsiveTracking?:boolean;coastSeconds?:number};
export const HAZARD_DEFAULTS:HazardConfig={horizon:30,step:1,groundWeight:1.5,uncertainty:true,maxExpanded:20000,maxSensorAge:6,localizationSigma:1};
export type EscapeCandidate={action:EscapeAction;path:TimedPoint[];feasible:boolean;reason:string;score:number;distance:number;groundExposure:number;returnSeconds:number;expanded:number;budgetSafe:boolean;predictedExposure?:number;riskIntegral?:number;returnMargin?:number};
export type EscapeDecision={time:number;model:HazardModel;status:'MODELED_ACTION'|'EXPOSURE_MINIMIZING'|'NO_VERIFIED_ACTION'|'SENSOR_STALE'|'SEARCH_LIMIT';action:EscapeAction|null;chosen:EscapeCandidate|null;candidates:EscapeCandidate[];latencyMs:number;forecast:ReturnType<typeof forecast>[];reason:string};
export type HazardContext={terrain:Terrain;settings:Settings;base:Point;ground:ReturnType<typeof sandRiskMap>;returnSeconds:Float64Array;returnNext:Int32Array};
export function prepareHazardContext(terrain:Terrain,settings:Settings,base:Point):HazardContext {
 const map=computeReturnMap(terrain,base,{...settings,scienceMinutes:0,dust:false},null);
 return {terrain,settings,base,ground:sandRiskMap(terrain),returnSeconds:Float64Array.from(map.inbound,v=>v*60),returnNext:map.returnNext};
}
const metres=(t:Terrain,p:Point)=>({x:p.x*t.cellSize,y:p.y*t.cellSize});
export function staticSegmentSafe(t:Terrain,s:Settings,a:Point,b:Point){
 const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*8));let previous:Point|null=null;
 for(let k=0;k<=steps;k++){
  const p={x:Math.round(a.x+(b.x-a.x)*k/steps),y:Math.round(a.y+(b.y-a.y)*k/steps)};
  if(p.x<0||p.y<0||p.x>=t.width||p.y>=t.height||blocked(t,index(t,p),s,null))return false;
  if(previous&&previous.x!==p.x&&previous.y!==p.y&&(blocked(t,index(t,{x:p.x,y:previous.y}),s,null)||blocked(t,index(t,{x:previous.x,y:p.y}),s,null)))return false;
  previous=p;
 }return true;
}
export function resourceSafe(resources:ResourceState,elapsed:number,returnSeconds:number,loadKg:number){
 const o=1+loadKg*.01,b=1+loadKg*.005;
 return Number.isFinite(returnSeconds)&&elapsed>=0&&resources.reserveFraction>=0&&resources.reserveFraction<1&&(elapsed+returnSeconds)*o<=resources.oxygenSeconds-(resources.oxygenReserveSeconds??resources.oxygenSeconds*resources.reserveFraction)+1e-8&&(elapsed+returnSeconds)*b<=resources.batterySeconds-(resources.batteryReserveSeconds??resources.batterySeconds*resources.reserveFraction)+1e-8&&elapsed+returnSeconds<=resources.missionSeconds+1e-8;
}
function distance(t:Terrain,a:Point,b:Point){return Math.hypot((a.x-b.x)*t.cellSize,(a.y-b.y)*t.cellSize,(heightAt(t,a)??0)-(heightAt(t,b)??0));}
export function connectorSeconds(c:HazardContext,a:Point,b:Point){const t=c.terrain,h=distance(t,a,b);if(h<1e-8)return 0;const i=index(t,{x:Math.round(a.x),y:Math.round(a.y)}),j=index(t,{x:Math.round(b.x),y:Math.round(b.y)});return i===j?h*(1+(t.meanSlope[i]??0)**2*.012+c.settings.loadKg*.015)/c.settings.speed:Math.max(h/c.settings.speed,edgeTravelMinutes(t,i,j,c.settings)*60*h/distance(t,point(t,i),point(t,j)));}
function failure(action:EscapeAction,reason:string,expanded=0):EscapeCandidate{return {action,path:[],feasible:false,reason,score:Infinity,distance:0,groundExposure:0,returnSeconds:Infinity,expanded,budgetSafe:false};}

/** Time-expanded A* with explicit wait edges and continuous relative-motion collision checks.
 * One label per (cell,time) is valid because conservative resource use depends only on elapsed time.
 * Optimality applies only to this discretized, bounded candidate search and declared cost. */
export function timeExpandedPath(c:HazardContext,start:Point,target:Point,now:number,track:VortexTrack,resources:ResourceState,model:HazardModel,action:EscapeAction,config:HazardConfig=HAZARD_DEFAULTS):EscapeCandidate {
 const {terrain:t,settings:s}=c,n=t.width*t.height,last=index(t,target),integrated=model==='MARS SHIFT',dynamic=model!=='Baseline',slots=Math.floor(config.horizon/config.step),heap=new MinHeap(),g=new Map<number,number>(),parent=new Map<number,number>();let expanded=0;
 if(blocked(t,last,s,null)||!Number.isInteger(target.x)||!Number.isInteger(target.y))return failure(action,'Target is not traversable');
 const check=(a:Point,b:Point,ta:number,tb:number)=>staticSegmentSafe(t,s,a,b)&&(!dynamic||!sweptVortexCollision(track,metres(t,a),metres(t,b),ta,tb,integrated&&config.uncertainty,config.localizationSigma));
 const heuristic=(i:number)=>Math.hypot(i%t.width-target.x,Math.floor(i/t.width)-target.y)*t.cellSize;
 const seeds=new Set<number>();
 for(const x of [Math.floor(start.x),Math.ceil(start.x)])for(const y of [Math.floor(start.y),Math.ceil(start.y)]){
  if(x<0||y<0||x>=t.width||y>=t.height)continue;const p={x,y},i=index(t,p);if(seeds.has(i))continue;seeds.add(i);
  const ticks=Math.ceil(connectorSeconds(c,start,p)/config.step),elapsed=ticks*config.step;if(ticks>slots||!check(start,p,now,now+elapsed))continue;
  if(integrated&&!resourceSafe(resources,elapsed,c.returnSeconds[i],s.loadKg))continue;
  const key=ticks*n+i,cost=distance(t,start,p)*(1+(integrated?config.groundWeight*c.ground.risk[i]:0));g.set(key,cost);parent.set(key,-1);heap.push(key,cost+heuristic(i));
 }
 let best=-1;
 while(heap.length){
  const item=heap.pop(),key=item.i,i=key%n,tick=Math.floor(key/n),cost=g.get(key)!;
  if(item.cost>cost+heuristic(i)+1e-7)continue;
  if(++expanded>config.maxExpanded)return failure(action,'Search limit reached; feasibility not established',expanded);
  const p=point(t,i),elapsed=tick*config.step;
  if(i===last&&check(p,p,now+elapsed,now+config.horizon)&&(!integrated||resourceSafe(resources,config.horizon,c.returnSeconds[i],s.loadKg))){best=key;break;}
  const visit=(j:number)=>{
   const q=point(t,j),wait=j===i,delta=wait?1:Math.max(1,Math.ceil(edgeTravelMinutes(t,i,j,s)*60/config.step)),next=tick+delta;if(next>slots)return;
   const end=next*config.step;if(integrated&&!resourceSafe(resources,end,c.returnSeconds[j],s.loadKg))return;
   if(!check(p,q,now+elapsed,now+end))return;
   const d=wait?0:distance(t,p,q),risk=(c.ground.risk[i]+c.ground.risk[j])/2,stepCost=wait?.12*config.step:d*(1+(integrated?config.groundWeight*risk:0)),k=next*n+j,newCost=cost+stepCost;
   if(newCost<(g.get(k)??Infinity)){g.set(k,newCost);parent.set(k,key);heap.push(k,newCost+heuristic(j));}
  };
  visit(i);graphNeighbours(t,i,s,null,visit);
 }
 if(best<0)return failure(action,'No path meets the horizon, hazard and resource constraints',expanded);
 const path:TimedPoint[]=[];for(let k=best;k>=0;k=parent.get(k)??-1)path.push({...point(t,k%n),time:now+Math.floor(k/n)*config.step});path.reverse();
 if(path[0].time>now||distance(t,start,path[0])>1e-8)path.unshift({...start,time:now});
 if(path.at(-1)!.time<now+config.horizon)path.push({...path.at(-1)!,time:now+config.horizon});
 let length=0,groundExposure=0;for(let i=1;i<path.length;i++){const d=distance(t,path[i-1],path[i]);length+=d;groundExposure+=d*c.ground.risk[index(t,{x:Math.round(path[i].x),y:Math.round(path[i].y)})];}
 const returnSeconds=c.returnSeconds[last],budgetSafe=resourceSafe(resources,config.horizon,returnSeconds,s.loadKg);
 return {action,path,feasible:true,reason:'Collision-free within the modeled horizon; return check is static beyond it',score:g.get(best)!,distance:length,groundExposure,returnSeconds,expanded,budgetSafe};
}
function waypoint(c:HazardContext,start:Point,target:Point,seconds:number){
 const t=c.terrain,p={x:Math.round(start.x),y:Math.round(start.y)},route=leg(t,p,target,'time',c.settings,null);if(!route)return p;
 let elapsed=0,last=route.cells[0];for(let k=1;k<route.cells.length;k++){elapsed+=edgeTravelMinutes(t,last,route.cells[k],c.settings)*60;if(elapsed>seconds)break;last=route.cells[k];}return point(t,last);
}
export function decideEscape(c:HazardContext,start:Point,missionTarget:Point,now:number,track:VortexTrack,resources:ResourceState,model:HazardModel='MARS SHIFT',config:HazardConfig=HAZARD_DEFAULTS):EscapeDecision {
 const began=performance.now(),finish=(extra:Omit<EscapeDecision,'time'|'model'|'latencyMs'|'forecast'>):EscapeDecision=>({time:now,model,latencyMs:performance.now()-began,forecast:Array.from({length:7},(_,i)=>forecast(track,now+i*config.horizon/6,model==='MARS SHIFT',config.localizationSigma)),...extra});
 if(![now,start.x,start.y,config.horizon,config.step,config.localizationSigma,resources.oxygenSeconds,resources.batterySeconds,resources.missionSeconds].every(Number.isFinite)||config.horizon<=0||config.horizon>45||config.step<=0||config.step>config.horizon||config.localizationSigma<0)return finish({status:'NO_VERIFIED_ACTION',action:null,chosen:null,candidates:[],reason:'Invalid model inputs'});
 if(model==='Baseline'){
  const p={x:Math.round(start.x),y:Math.round(start.y)},route=leg(c.terrain,p,missionTarget,'shortest',c.settings,null),path:TimedPoint[]=[{...start,time:now}];let length=0,groundExposure=0;
  if(!route||!staticSegmentSafe(c.terrain,c.settings,start,p))return finish({status:'NO_VERIFIED_ACTION',action:null,chosen:null,candidates:[],reason:'Static A* found no traversable path'});
  // A continuous crew position can already be along the first graph edge. Never snap
  // it backwards at every observation (that creates oscillation and biases Baseline).
  let cells=route.cells;
  if(cells.length>1){const next=point(c.terrain,cells[1]),dx=next.x-p.x,dy=next.y-p.y,den=dx*dx+dy*dy,u=((start.x-p.x)*dx+(start.y-p.y)*dy)/den,off=Math.hypot(start.x-p.x-u*dx,start.y-p.y-u*dy);if(u>0&&u<1&&off<1e-5)cells=cells.slice(1);}
  let at=now;for(const cell of cells){const q=point(c.terrain,cell),a=path.at(-1)!,dt=connectorSeconds(c,a,q);if(!dt)continue;at+=dt;path.push({...q,time:at});length+=distance(c.terrain,a,q);groundExposure+=distance(c.terrain,a,q)*c.ground.risk[cell];if(at>=now+config.horizon)break;}
  if(path.at(-1)!.time<now+config.horizon)path.push({...path.at(-1)!,time:now+config.horizon});
  const end=path.at(-1)!,returnSeconds=c.returnSeconds[index(c.terrain,{x:Math.round(end.x),y:Math.round(end.y)})],candidate:EscapeCandidate={action:'DETOUR',path,feasible:true,reason:'Existing static shortest-distance A*; moving hazard ignored',score:length,distance:length,groundExposure,returnSeconds,expanded:0,budgetSafe:resourceSafe(resources,end.time-now,returnSeconds,c.settings.loadKg)};
  return finish({status:'MODELED_ACTION',action:'DETOUR',chosen:candidate,candidates:[candidate],reason:candidate.reason});
 }
 const allowedAge=model==='MARS SHIFT'&&config.policy==='exposure-mpc'?Math.max(config.maxSensorAge,Math.min(16,config.coastSeconds??0)):config.maxSensorAge;
 if(now-track.lastObservation>allowedAge||track.observations<3||now<track.time||config.localizationSigma>5)return finish({status:'SENSOR_STALE',action:null,chosen:null,candidates:[],reason:'Insufficient or stale observations / localization. No verified movement guidance.'});
 if(model==='MARS SHIFT'&&config.policy==='exposure-mpc'){const result=exposureMPC(c,start,missionTarget,now,track,resources,config);if(now-track.lastObservation>config.maxSensorAge&&result.chosen){result.status='EXPOSURE_MINIMIZING';result.reason='SENSOR GAP: bounded forecast coasting; new observation required. '+result.reason;result.chosen.reason=result.reason;}return finish(result);}
 const rounded={x:Math.round(start.x),y:Math.round(start.y)},ahead=waypoint(c,start,missionTarget,config.horizon*.7),back=waypoint(c,start,c.base,config.horizon*.7),v=Math.hypot(track.x.v,track.y.v)||1,sideMetres=Math.min(10,c.settings.speed*config.horizon*.5),dx=-track.y.v/v*sideMetres/c.terrain.cellSize,dy=track.x.v/v*sideMetres/c.terrain.cellSize;
 const targets:{action:EscapeAction;point:Point}[]=[{action:'HOLD',point:rounded},{action:'SIDESTEP',point:{x:Math.round(start.x+dx),y:Math.round(start.y+dy)}},{action:'SIDESTEP',point:{x:Math.round(start.x-dx),y:Math.round(start.y-dy)}},{action:'DETOUR',point:ahead},{action:'RETURN',point:back}];
 const candidates=targets.map(({action,point:p})=>{
  if(p.x<0||p.y<0||p.x>=c.terrain.width||p.y>=c.terrain.height)return failure(action,'Candidate leaves observed terrain');
  // HOLD must stay at the actual continuous position, not drift to a nearby cell.
  if(action==='HOLD'){
   const safe=staticSegmentSafe(c.terrain,c.settings,start,start)&&!sweptVortexCollision(track,metres(c.terrain,start),metres(c.terrain,start),now,now+config.horizon,model==='MARS SHIFT'&&config.uncertainty,config.localizationSigma),backSeconds=c.returnSeconds[index(c.terrain,rounded)]+connectorSeconds(c,start,rounded),budget=resourceSafe(resources,config.horizon,backSeconds,c.settings.loadKg);
   return safe&&(model!=='MARS SHIFT'||budget)?{action,path:[{...start,time:now},{...start,time:now+config.horizon}],feasible:true,reason:'Remaining here satisfies the modeled horizon',score:16,distance:0,groundExposure:0,returnSeconds:backSeconds,expanded:0,budgetSafe:budget}:failure(action,safe?'HOLD would consume required return reserve':'Predicted envelope reaches the current position');
  }
  const result=timeExpandedPath(c,start,p,now,track,resources,model,action,config);
  if(result.feasible){const initialDistance=Math.hypot(start.x-missionTarget.x,start.y-missionTarget.y)*c.terrain.cellSize,endDistance=Math.hypot(p.x-missionTarget.x,p.y-missionTarget.y)*c.terrain.cellSize;result.score+=.9*(endDistance-initialDistance)+(action==='SIDESTEP'?5:action==='RETURN'?12:0);}
  return result;
 });
 const chosen=candidates.filter(a=>a.feasible).sort((a,b)=>a.score-b.score)[0]??null;
 const first=chosen?.path[1],action=chosen&&first&&Math.hypot(first.x-start.x,first.y-start.y)<1e-8?'HOLD':chosen?.action??null;
 return finish({status:chosen?'MODELED_ACTION':candidates.some(c=>c.expanded>config.maxExpanded)?'SEARCH_LIMIT':'NO_VERIFIED_ACTION',chosen,action,candidates,reason:chosen?chosen.reason:'No candidate verified. Do not interpret this as proof that no possible escape exists.'});
}
export function positionOnPath(path:TimedPoint[],time:number):Point {
 if(!path.length)throw Error('Empty timed path');for(let k=1;k<path.length;k++){if(time<=path[k].time){const a=path[k-1],b=path[k],u=Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time||1)));return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};}}return {...path.at(-1)!};
}

