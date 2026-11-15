import {MinHeap} from './return-feasibility';
import {edgeTravelMinutes} from './mobility';
import {point,index,edgeBlocked} from './planner';
import type {Point,Settings} from './planner';
import {canStand,moveOnRover} from './rover-navigation';
import type {RoverTerrain} from './rover-navigation';
import {positionOnPath,resourceSafe} from './hazard-planner';
import type {TimedPoint,ResourceState,HazardModel} from './hazard-planner';
import {measureEscapePath} from './escape-metrics';
import type {RecordedPassage} from './observed-replay';

export type ConditionalVortex={x:number;y:number;vx:number;vy:number;radius:number;radiusSigma:number;speedSigma:number;time:number};
export const REPLAY_CONDITIONS={horizon:30,reactionSeconds:6,marginMetres:1,updateSeconds:2,walkingSpeed:.6,warningSeconds:18};
export function relocatedVortex(fit:RecordedPassage['fit'],start:Point,cell:number,heading:number,warning=REPLAY_CONDITIONS.warningSeconds):ConditionalVortex {
 if(fit.diameterSigma===null)throw Error('Missing valid diameter uncertainty: recorded replay only');
 const vx=Math.cos(heading)*fit.speedMps,vy=Math.sin(heading)*fit.speedMps,offset=fit.diameterMetres/2+REPLAY_CONDITIONS.marginMetres+warning*fit.speedMps;
 return {x:start.x*cell-Math.cos(heading)*offset,y:start.y*cell-Math.sin(heading)*offset,vx,vy,radius:fit.diameterMetres/2,radiusSigma:fit.diameterSigma/2,speedSigma:fit.speedSigma,time:0};
}
export function conditionalAt(v:ConditionalVortex,time:number,sizeSigma=0,speedSigma=0){
 const speed=Math.hypot(v.vx,v.vy),factor=Math.max(.05,speed+speedSigma*v.speedSigma)/speed,dt=time-v.time;
 return {x:v.x+v.vx*factor*dt,y:v.y+v.vy*factor*dt,radius:Math.max(.1,v.radius+sizeSigma*v.radiusSigma)+REPLAY_CONDITIONS.marginMetres};
}
function edges(t:RoverTerrain,i:number,s:Settings){
 const a=point(t,i),out:{i:number;seconds:number}[]=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if((!dx&&!dy)||t.edgeBlocked[i]&(1<<((dy+1)*3+dx+1)))continue;
  const x=a.x+dx,y=a.y+dy;if(x<0||y<0||x>=t.width||y>=t.height)continue;
  const j=y*t.width+x;if(edgeBlocked(t,i,j,s,null))continue;
  out.push({i:j,seconds:edgeTravelMinutes(t,i,j,s)*60});
 }return out;
}
function graph(t:RoverTerrain,start:Point,s:Settings){
 const times=new Float64Array(t.width*t.height).fill(Infinity),parent=new Int32Array(times.length).fill(-1),heap=new MinHeap();
 for(const x of new Set([Math.floor(start.x),Math.ceil(start.x)]))for(const y of new Set([Math.floor(start.y),Math.ceil(start.y)])){
  const p={x,y};if(!canStand(t,p,s))continue;const move=moveOnRover(t,start,(x-start.x)*t.cellSize,(y-start.y)*t.cellSize,s);if(move.reason)continue;
  const i=index(t,p),dt=move.distance*(1+(t.meanSlope[i]??0)**2*.012+s.loadKg*.015)/s.speed;
  times[i]=dt;heap.push(i,dt);
 }
 while(heap.length){const item=heap.pop();if(item.cost>times[item.i]+1e-9)continue;for(const e of edges(t,item.i,s)){const cost=item.cost+e.seconds;if(cost<times[e.i]){times[e.i]=cost;parent[e.i]=item.i;heap.push(e.i,cost);}}}
 return {times,parent};
}
/** Reverse graph respects directed uphill travel time and the same swept support masks. */
export function recordedReturnMap(t:RoverTerrain,base:Point,s:Settings){
 const incoming=Array.from({length:t.width*t.height},()=>[] as {i:number;seconds:number}[]);
 for(let i=0;i<incoming.length;i++)if(!t.obstacleMask?.[i]&&t.valid[i])for(const e of edges(t,i,s))incoming[e.i].push({i,seconds:e.seconds});
 const times=new Float64Array(incoming.length).fill(Infinity),heap=new MinHeap(),b=index(t,{x:Math.round(base.x),y:Math.round(base.y)});times[b]=0;heap.push(b,0);
 while(heap.length){const a=heap.pop();if(a.cost>times[a.i]+1e-9)continue;for(const e of incoming[a.i])if(a.cost+e.seconds<times[e.i]){times[e.i]=a.cost+e.seconds;heap.push(e.i,times[e.i]);}}
 return times;
}
export type ObservedCandidate={action:string;path:TimedPoint[];contact:number;robustContact:number;clearance:number;returnMargin:number;distance:number;goal:number;budgetSafe:boolean};
export function planObservedEscape(t:RoverTerrain,s:Settings,start:Point,base:Point,target:Point,now:number,resources:ResourceState,v:ConditionalVortex,model:HazardModel,returns:Float64Array){
 const began=performance.now(),h=REPLAY_CONDITIONS.horizon,delay=Math.max(0,REPLAY_CONDITIONS.reactionSeconds-now),map=graph(t,start,s),ends=new Set<number>(),sectors=new Map<number,{i:number;distance:number}>();
 for(let i=0;i<map.times.length;i++)if(map.times[i]<=h-delay){const p=point(t,i),dx=p.x-start.x,dy=p.y-start.y,d=Math.hypot(dx,dy),sector=Math.floor((Math.atan2(dy,dx)+Math.PI)/(2*Math.PI)*24)%24;if(!sectors.has(sector)||sectors.get(sector)!.distance<d)sectors.set(sector,{i,distance:d});}
 for(const e of sectors.values())ends.add(e.i);
 for(const p of [base,target]){const i=index(t,{x:Math.round(p.x),y:Math.round(p.y)});if(Number.isFinite(map.times[i]))ends.add(i);}
 const paths:{action:string;path:TimedPoint[]}[]=[{action:'HOLD',path:[{...start,time:now},{...start,time:now+h}]}];
 for(const i of ends){
  const cells=[i];while(map.parent[cells.at(-1)!]>=0)cells.push(map.parent[cells.at(-1)!]);cells.reverse();
  const path:TimedPoint[]=[{...start,time:now}];if(delay)path.push({...start,time:now+delay});
  for(const j of cells){const p=point(t,j),time=now+delay+map.times[j];if(time<=path.at(-1)!.time+1e-9)continue;path.push({...p,time});if(time>=now+h)break;}
  const end=positionOnPath(path,now+h);while(path.at(-1)!.time>now+h)path.pop();if(path.at(-1)!.time<now+h)path.push({...end,time:now+h});
  paths.push({action:i===index(t,{x:Math.round(base.x),y:Math.round(base.y)})?'RETURN':i===index(t,{x:Math.round(target.x),y:Math.round(target.y)})?'DETOUR':'SIDESTEP',path});
 }
 const back=(p:Point)=>{let best=Infinity;for(const x of new Set([Math.floor(p.x),Math.ceil(p.x)]))for(const y of new Set([Math.floor(p.y),Math.ceil(p.y)])){const q={x,y};if(!canStand(t,q,s))continue;const move=moveOnRover(t,p,(x-p.x)*t.cellSize,(y-p.y)*t.cellSize,s);if(!move.reason)best=Math.min(best,returns[index(t,q)]+move.distance*(1+(t.meanSlope[index(t,q)]??0)**2*.012+s.loadKg*.015)/s.speed);}return best;};
 const candidates:ObservedCandidate[]=paths.map(({action,path})=>{
  const nominal=measureEscapePath(path,time=>conditionalAt(v,time),t.cellSize,now,now+h),end=path.at(-1)!,returnSeconds=back(end),usable=Math.min((resources.oxygenSeconds-(resources.oxygenReserveSeconds??0))/(1+s.loadKg*.01),(resources.batterySeconds-(resources.batteryReserveSeconds??0))/(1+s.loadKg*.005),resources.missionSeconds);
  const robustContact=Math.max(nominal.exposureSeconds,...[-1,1].flatMap(size=>[-1,1].map(speed=>measureEscapePath(path,time=>conditionalAt(v,time,size,speed),t.cellSize,now,now+h).exposureSeconds)));
  const budgetSafe=path.every(p=>resourceSafe(resources,p.time-now,back(p),s.loadKg));
  return {action:Math.hypot(positionOnPath(path,now+2).x-start.x,positionOnPath(path,now+2).y-start.y)<1e-7?'HOLD':action,path,contact:nominal.exposureSeconds,robustContact,clearance:nominal.minClearance,returnMargin:usable-h-returnSeconds,budgetSafe,distance:path.slice(1).reduce((d,p,k)=>d+Math.hypot(p.x-path[k].x,p.y-path[k].y)*t.cellSize,0),goal:Math.hypot(end.x-target.x,end.y-target.y)*t.cellSize};
 });
 const admissible=candidates.filter(c=>c.budgetSafe);
 // Contact first, then mission progress/distance. HOLD is useful only if the modeled path merits it.
 const rank=(a:ObservedCandidate,b:ObservedCandidate)=>{
  if(model!=='Baseline'){const dust=model==='MARS SHIFT'?a.robustContact-b.robustContact:a.contact-b.contact;if(Math.abs(dust)>1e-6)return dust;const nominal=a.contact-b.contact;if(Math.abs(nominal)>1e-6)return nominal;}
  return (a.goal+.03*a.distance)-(b.goal+.03*b.distance);
 };
 const chosen=[...admissible].sort(rank)[0]??null;
 return {chosen,candidates,latencyMs:performance.now()-began,reason:!chosen?'No candidate preserves the return budget within observed support.':chosen.contact>1e-6?'Contact remains in the conditional model; route reduces modeled exposure.':'No nominal contact in the modeled horizon. Direction and placement are assumed.'};
}
