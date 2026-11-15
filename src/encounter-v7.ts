import {DEFAULTS,blocked,edgeBlocked,point,index} from './planner';
import type {Point,Settings,Terrain} from './planner';
import {edgeTravelMinutes} from './mobility';
import {MinHeap} from './return-feasibility';
import {canStand,moveOnRover} from './rover-navigation';
import type {RoverTerrain} from './rover-navigation';
import {positionOnPath,resourceSafe} from './hazard-planner';
import type {TimedPoint,ResourceState} from './hazard-planner';
import {sweptContact} from './dust-devil-geometry';
import type {CircleState} from './dust-devil-geometry';
import {measureEscapePath} from './escape-metrics';
import {fitLocalTrack} from './local-dust-tracker';
import {forecast} from './hazard-tracker';
import type {VortexObservation} from './hazard-tracker';

export type EncounterCase={id:string;split:string;terrain:string;source:string;family:string;distance:number;bearing:number;heading:number;startOffset:number[];speed:number;reaction:number;sensorSeed:number;truth:string;turnDegrees:number;growthMps:number;positionSigma:number;diameterSigmaFraction:number;evaluationUntil?:number};
export type EncounterSource={id:string;diameter:number;speed:number};
export type EncounterArm='Static'|'Endpoint'|'Adaptive'|'Oracle';
export const ENCOUNTER={tick:.5,horizon:36,replan:2,margin:1,returnAt:70,finishBy:360,maxStates:90000};
type Edge={i:number;ticks:number};
export type EncounterGraph={terrain:RoverTerrain;settings:Settings;edges:Edge[][];reverse:Edge[][];allowed:number[];tick:number;medianSpeed:number};

/** Identical supported graph and rounded edge times in every comparison arm. */
export function encounterGraph(terrain:Terrain,speed:number,tick=ENCOUNTER.tick):EncounterGraph{
 const t=terrain as RoverTerrain,s={...DEFAULTS,maxSlope:25,speed,loadKg:12,scienceMinutes:0,dust:false},n=t.width*t.height;
 const edges:Edge[][]=Array.from({length:n},()=>[]),reverse:Edge[][]=Array.from({length:n},()=>[]),allowed:number[]=[];
 for(let i=0;i<n;i++)if(!blocked(t,i,s,null)&&canStand(t,point(t,i),s))allowed.push(i);
 const good=new Set(allowed);
 for(const i of allowed){const p=point(t,i);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const x=p.x+dx,y=p.y+dy;if((!dx&&!dy)||x<0||y<0||x>=t.width||y>=t.height)continue;const j=y*t.width+x;
  if(!good.has(j)||edgeBlocked(t,i,j,s,null)||t.edgeBlocked?.[i]&(1<<((dy+1)*3+dx+1)))continue;
  if(!t.edgeBlocked&&moveOnRover(t,p,dx*t.cellSize,dy*t.cellSize,s).reason)continue;
  const ticks=Math.max(1,Math.ceil((edgeTravelMinutes(t,i,j,s)*60-1e-8)/tick));edges[i].push({i:j,ticks});reverse[j].push({i,ticks});
 }}const speeds=allowed.flatMap(i=>edges[i].map(e=>Math.hypot(e.i%t.width-i%t.width,Math.floor(e.i/t.width)-Math.floor(i/t.width))*t.cellSize/(e.ticks*tick))).sort((a,b)=>a-b);
 return {terrain:t,settings:s,edges,reverse,allowed,tick,medianSpeed:speeds[Math.floor(speeds.length/2)]??speed};
}
function seeds(g:EncounterGraph,p:Point){
 const t=g.terrain,entries:{i:number;ticks:number}[]=[];
 for(const x of new Set([Math.floor(p.x),Math.ceil(p.x)]))for(const y of new Set([Math.floor(p.y),Math.ceil(p.y)])){
  const q={x,y};if(!canStand(t,q,g.settings))continue;const m=moveOnRover(t,p,(q.x-p.x)*t.cellSize,(q.y-p.y)*t.cellSize,g.settings);if(m.reason)continue;
  const i=index(t,q),seconds=m.distance*(1+(t.meanSlope[i]??0)**2*.012+g.settings.loadKg*.015)/g.settings.speed;
  entries.push({i,ticks:Math.ceil((seconds-1e-8)/g.tick)});
 }return entries;
}
export function encounterDistances(g:EncounterGraph,entries:Edge[],reverse=false){
 const d=new Float64Array(g.edges.length).fill(Infinity),parent=new Int32Array(d.length).fill(-1),heap=new MinHeap();
 for(const e of entries){d[e.i]=e.ticks;heap.push(e.i,e.ticks);}
 while(heap.length){const a=heap.pop();if(a.cost!==d[a.i])continue;for(const e of (reverse?g.reverse:g.edges)[a.i])if(a.cost+e.ticks<d[e.i]){d[e.i]=a.cost+e.ticks;parent[e.i]=a.i;heap.push(e.i,d[e.i]);}}
 return {d,parent};
}
export function nearestConnected(g:EncounterGraph,p:Point,dist?:Float64Array){
 let best=-1,score=Infinity;for(const i of g.allowed){if(dist&&!Number.isFinite(dist[i]))continue;const q=point(g.terrain,i),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<score){score=d;best=i;}}
 if(best<0)throw Error('No connected observed support');return point(g.terrain,best);
}
function random(seed:number){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let x=a;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return ((x^x>>>14)>>>0)/4294967296;};}
export function encounterTruth(c:EncounterCase,source:EncounterSource,start:Point,cell:number,time:number):CircleState{
 const angle=c.heading+c.bearing,cx=start.x*cell-c.distance*Math.cos(angle),cy=start.y*cell-c.distance*Math.sin(angle),turn=20,first=Math.min(time,turn),second=Math.max(0,time-turn),b=c.heading+(c.truth==='turn'?c.turnDegrees*Math.PI/180:0);
 return {x:cx+source.speed*(Math.cos(c.heading)*first+Math.cos(b)*second),y:cy+source.speed*(Math.sin(c.heading)*first+Math.sin(b)*second),radius:source.diameter/2+(c.truth==='growth'?c.growthMps*time:0)};
}
export function makeEncounter(g:EncounterGraph,c:EncounterCase,source:EncounterSource,baseHint?:Point){
 const t=g.terrain,base=nearestConnected(g,baseHint??{x:t.width/2,y:t.height/2}),returns=encounterDistances(g,[{i:index(t,base),ticks:0}],true).d;
 const initial=nearestConnected(g,{x:base.x+c.startOffset[0]/t.cellSize,y:base.y+c.startOffset[1]/t.cellSize},returns),target=nearestConnected(g,{x:base.x+15/t.cellSize,y:base.y-6/t.cellSize},returns);
 const rng=random(c.sensorSeed),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-10,rng())))*Math.cos(2*Math.PI*rng()),observations:VortexObservation[]=[];
 for(let time=0;time<=ENCOUNTER.finishBy+ENCOUNTER.horizon;time+=2){const q=encounterTruth(c,source,initial,t.cellSize,time),rs=Math.max(.25,q.radius*c.diameterSigmaFraction);observations.push({time,x:q.x+c.positionSigma*normal(),y:q.y+c.positionSigma*normal(),radius:Math.max(.3,q.radius+rs*normal()),positionSigma:c.positionSigma,radiusSigma:rs,source:'SIMULATED_SENSOR'});}
 const resources:ResourceState={oxygenSeconds:520,batterySeconds:520,missionSeconds:420,reserveFraction:.2,oxygenReserveSeconds:104,batteryReserveSeconds:104};
 return {g,c,source,base,initial,target,returns,observations,resources,time:0,position:{...initial},trace:[{...initial,time:0}] as TimedPoint[],pending:null as TimedPoint|null,evaluationUntil:c.evaluationUntil??Math.max(90,(c.distance+source.diameter/2+1)/source.speed+20),done:false,returned:false,budgetFailure:false,trackerWindow:3 as 3|7,adaptiveHorizon:false};
}
export type EncounterSession=ReturnType<typeof makeEncounter>;
/** Retain the exact remaining time on the current planned edge. Re-estimating a
 * fractional connector can repeatedly snap backward and consume the same 2 s loop.
 * Other supported connectors remain available, so a new fix can still reverse course. */
function sessionSeeds(s:EncounterSession){
 const entries=seeds(s.g,s.position),p=s.pending;
 if(p&&p.time>s.time&&Number.isInteger(p.x)&&Number.isInteger(p.y)){
  const i=index(s.g.terrain,p),ticks=Math.round((p.time-s.time)/s.g.tick),at=entries.findIndex(e=>e.i===i),entry={i,ticks};
  if(at>=0)entries[at]=entry;else entries.push(entry);
 }return entries;
}
type Prediction=(time:number,envelope?:boolean)=>CircleState;
export function encounterPrediction(s:EncounterSession,arm:EncounterArm):Prediction{
 if(arm==='Oracle')return time=>{const q=encounterTruth(s.c,s.source,s.initial,s.g.terrain.cellSize,time);return {...q,radius:q.radius+ENCOUNTER.margin};};
 const history=s.observations.filter(o=>o.time<=s.time),track=fitLocalTrack(history,{window:s.trackerWindow,radiusMode:'last',processNoise:.08});
 return (time,envelope=false)=>{const f=forecast(track,time,false,0);return {x:f.x,y:f.y,radius:f.radius+ENCOUNTER.margin+(envelope?Math.hypot(f.position95/2.448,f.radius95/1.96):0)};};
}
function pathMetrics(path:TimedPoint[],s:EncounterSession,predict:Prediction,alpha:number){
 const t=s.g.terrain,begin=s.time,end=path.at(-1)!.time,knots=Array.from({length:Math.ceil((end-begin)/s.g.tick)+1},(_,i)=>begin+i*s.g.tick),nominal=measureEscapePath(path,time=>predict(time),t.cellSize,begin,end,knots),band=alpha?measureEscapePath(path,time=>predict(time,true),t.cellSize,begin,end,knots):nominal;
 return {contact:nominal.exposureSeconds,bandContact:band.exposureSeconds,clearance:nominal.minClearance,score:nominal.exposureSeconds+alpha*band.exposureSeconds};
}
function backSeconds(s:EncounterSession,p:Point){return Math.min(...(Math.hypot(p.x-s.position.x,p.y-s.position.y)<1e-9?sessionSeeds(s):seeds(s.g,p)).map(e=>(e.ticks+s.returns[e.i])*s.g.tick));}
function usable(s:EncounterSession){const r=s.resources;return Math.min((r.oxygenSeconds-r.oxygenReserveSeconds!)/1.12,(r.batterySeconds-r.batteryReserveSeconds!)/1.06,r.missionSeconds);}
export type EncounterDecision={path:TimedPoint[];action:string;contact:number;bandContact:number;clearance:number;returnMargin:number;latencyMs:number;expanded:number;limited:boolean;unnecessaryHold:boolean;reason:string;forecast:CircleState[]};
export function planEncounter(s:EncounterSession,arm:EncounterArm,alpha=.25):EncounterDecision{
 const began=performance.now(),g=s.g,t=g.terrain,tick=g.tick,now=s.time,n=g.edges.length,predict=encounterPrediction(s,arm),delay=Math.max(0,Math.max(s.c.reaction,4)-now),delayTicks=Math.ceil(delay/tick),starts=sessionSeeds(s),map=encounterDistances(g,starts),back=backSeconds(s,s.position),remaining=usable(s);
 const current=predict(now),future=predict(now+1),v=Math.max(.2,Math.hypot(future.x-current.x,future.y-current.y)),required=s.c.reaction+current.radius/Math.max(.08,g.medianSpeed)+current.radius/v+12;
 const horizon=s.adaptiveHorizon?Math.max(36,Math.min(120,Math.ceil(required/2)*2,Math.floor((remaining-back-2)/2)*2)):36;
 const slots=Math.round(horizon/tick),goal=(now>=ENCOUNTER.returnAt||usable(s)-back<ENCOUNTER.horizon*2)?s.base:s.target,goalIndex=index(t,goal);
 const wait=[{...s.position,time:now},{...s.position,time:now+horizon}],safe=(p:Point,dt:number)=>resourceSafe(s.resources,dt,backSeconds(s,p),g.settings.loadKg);
 const fromCells=(last:number)=>{const cells=[last];while(map.parent[cells.at(-1)!]>=0)cells.push(map.parent[cells.at(-1)!]);cells.reverse();const path:TimedPoint[]=[{...s.position,time:now}];if(delay)path.push({...s.position,time:now+delay});for(const i of cells){const time=now+(delayTicks+map.d[i])*tick;if(time>path.at(-1)!.time+1e-8)path.push({...point(t,i),time});if(time>=now+horizon)break;}const end=positionOnPath(path,now+horizon);while(path.at(-1)!.time>now+horizon)path.pop();if(path.at(-1)!.time<now+horizon)path.push({...end,time:now+horizon});return path;};
 const baseline=Number.isFinite(map.d[goalIndex])?fromCells(goalIndex):wait;
 const admissible=(path:TimedPoint[])=>path.every(p=>safe(p,p.time-now));
 const baselineMetric=pathMetrics(baseline,s,predict,arm==='Adaptive'?alpha:0);
 let chosen=baseline,chosenMetric=baselineMetric,expanded=0,limited=false,avoidableHold=false;
 const terminal=(path:TimedPoint[])=>{const p=path.at(-1)!;return Math.hypot(p.x-goal.x,p.y-goal.y)*t.cellSize;};
 if(arm==='Static'||baselineMetric.score<1e-8&&admissible(baseline)){
  if(!admissible(baseline)){chosen=wait;chosenMetric=pathMetrics(wait,s,predict,0);}
 }else if(arm==='Endpoint'||horizon>60){
  const ends=new Set<number>([goalIndex,index(t,s.base)]),sectors=new Map<number,{i:number;d:number}>();
  for(const i of g.allowed)if(map.d[i]+delayTicks<=slots){const p=point(t,i),dx=p.x-s.position.x,dy=p.y-s.position.y,d=Math.hypot(dx,dy),k=Math.floor((Math.atan2(dy,dx)+Math.PI)/(2*Math.PI)*24)%24;if(!sectors.has(k)||sectors.get(k)!.d<d)sectors.set(k,{i,d});}
  for(const e of sectors.values())ends.add(e.i);
  const paths=[wait,...[...ends].filter(i=>Number.isFinite(map.d[i])).map(fromCells)].filter(admissible);
  let score=Infinity,progress=Infinity;
  for(const path of paths){const m=pathMetrics(path,s,predict,arm==='Adaptive'?alpha:0),p=terminal(path);if(m.score<score-1e-8||Math.abs(m.score-score)<1e-8&&p<progress){chosen=path;chosenMetric=m;score=m.score;progress=p;}}
 }else{
  // Time-expanded DAG. Wait and movement edges are evaluated at their actual scheduled times.
  // One scalar cost label per (cell, half-second slot); bounded work is disclosed in the decision.
  const count=(slots+1)*n,cost=new Float64Array(count).fill(Infinity),parent=new Int32Array(count).fill(-2),layers=Array.from({length:slots+1},()=>[] as number[]);
  const circles=Array.from({length:slots+1},(_,k)=>predict(now+k*tick)),bands=Array.from({length:slots+1},(_,k)=>predict(now+k*tick,true)),weight=arm==='Oracle'?0:alpha;
  const segmentCost=(a:Point,b:Point,ka:number,kb:number)=>{let cost=0;for(let k=ka;k<kb;k++){const u=(k-ka)/(kb-ka),v=(k+1-ka)/(kb-ka),A={x:(a.x+(b.x-a.x)*u)*t.cellSize,y:(a.y+(b.y-a.y)*u)*t.cellSize},B={x:(a.x+(b.x-a.x)*v)*t.cellSize,y:(a.y+(b.y-a.y)*v)*t.cellSize};cost+=sweptContact(A,B,circles[k],circles[k+1],tick)+(weight?weight*sweptContact(A,B,bands[k],bands[k+1],tick):0);}return cost;};
  const prefix=delayTicks?segmentCost(s.position,s.position,0,Math.min(slots,delayTicks)):0;
  for(const e of starts){const k=e.ticks+delayTicks;if(k>slots||k*tick+s.returns[e.i]*tick>remaining)continue;const key=k*n+e.i,c=prefix+(e.ticks?segmentCost(s.position,point(t,e.i),delayTicks,k):0);if(c<cost[key]){if(!Number.isFinite(cost[key]))layers[k].push(e.i);cost[key]=c;parent[key]=-1;}}
  for(let k=0;k<slots;k++){
   for(const i of layers[k]){if(++expanded>ENCOUNTER.maxStates){limited=true;break;}const a=point(t,i),key=k*n+i;
    for(const e of [...g.edges[i],{i,ticks:1}]){const next=k+e.ticks;if(next>slots||next*tick+s.returns[e.i]*tick>remaining+1e-8)continue;const j=next*n+e.i,b=point(t,e.i),score=cost[key]+segmentCost(a,b,k,next)+1e-7*Math.hypot(b.x-a.x,b.y-a.y)*t.cellSize;if(score<cost[j]-1e-10){if(!Number.isFinite(cost[j]))layers[next].push(e.i);cost[j]=score;parent[j]=key;}}
   }if(limited)break;
  }
  let best=-1,bestScore=Infinity,bestGoal=Infinity;
  for(const i of layers[slots]){const key=slots*n+i,p=point(t,i),d=Math.hypot(p.x-goal.x,p.y-goal.y)*t.cellSize;if(cost[key]<bestScore-1e-5||Math.abs(cost[key]-bestScore)<1e-5&&d<bestGoal){best=key;bestScore=cost[key];bestGoal=d;}}
  if(best>=0){const path:TimedPoint[]=[];for(let key=best;key>=0;key=parent[key])path.push({...point(t,key%n),time:now+Math.floor(key/n)*tick});path.reverse();if(delay)path.unshift({...s.position,time:now+delay});path.unshift({...s.position,time:now});chosen=path;chosenMetric=pathMetrics(path,s,predict,weight);}
  else {chosen=planEncounter(s,'Endpoint',0).path;chosenMetric=pathMetrics(chosen,s,predict,weight);}
  const p=positionOnPath(chosen,now+2),b=positionOnPath(baseline,now+2);
  avoidableHold=Math.hypot(p.x-s.position.x,p.y-s.position.y)<1e-8&&Math.hypot(b.x-s.position.x,b.y-s.position.y)>1e-5&&admissible(baseline)&&baselineMetric.score<=chosenMetric.score+1e-6;
 }
 const okay=admissible(chosen),next=positionOnPath(chosen,now+2),moving=Math.hypot(next.x-s.position.x,next.y-s.position.y)>1e-7,action=!okay?'NO FEASIBLE ROUTE':!moving?'HOLD':goal===s.base?'RETURN':chosen===baseline?'DETOUR':'SIDESTEP';
 return {path:okay?chosen:wait,action,...chosenMetric,returnMargin:remaining-horizon-backSeconds(s,chosen.at(-1)!),latencyMs:performance.now()-began,expanded,limited,unnecessaryHold:avoidableHold,reason:!okay?'No resource-feasible candidate in observed support':limited?'Search limit: bounded fallback, no optimality claim':chosenMetric.contact>1e-6?'Contact predicted; minimizing exposure':`No nominal contact in ${horizon} s horizon${horizon>60?' · long-range trajectory screening':''}`,forecast:circlesForDisplay(predict,now)};
}
function circlesForDisplay(p:Prediction,now:number){return Array.from({length:7},(_,i)=>p(now+i*6));}
export function advanceEncounter(s:EncounterSession,d:EncounterDecision){
 if(s.done)return;const time=Math.min(ENCOUNTER.finishBy,s.time+2),p=positionOnPath(d.path,time);
 const pending=d.path.find(q=>q.time>time+1e-8);s.pending=pending&&Math.hypot(pending.x-p.x,pending.y-p.y)>1e-9?{...pending}:null;
 s.trace.push(...d.path.filter(p=>p.time>s.time&&p.time<time),{...p,time});s.time=time;s.position=p;s.resources.oxygenSeconds-=2*1.12;s.resources.batterySeconds-=2*1.06;s.resources.missionSeconds-=2;
 if(d.action==='NO FEASIBLE ROUTE')s.budgetFailure=true;
 // The base has no modeled shelter protection. Keep observing/replanning through
 // the fixed exposure window even if the astronaut returns before a distant vortex arrives.
 s.returned=time>=Math.max(ENCOUNTER.returnAt,s.evaluationUntil)&&Math.hypot(p.x-s.base.x,p.y-s.base.y)*s.g.terrain.cellSize<.25;
 s.done=s.returned||time>=ENCOUNTER.finishBy;
}
