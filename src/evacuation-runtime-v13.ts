// v13 copy of the frozen v10 route-bank policy, with one injected predictor.
// Search, budgets, continuous contact and action costs are unchanged.
// This preserves a directly comparable v10 baseline without changing its hashes.
import {encounterDistances} from './encounter-v7';
import type {EncounterDecision} from './encounter-v7';
import {abruptPrediction,availableFixes,V8} from './encounter-v8';
import type {AbruptSession,ArmV8} from './encounter-v8';
import {index,point} from './planner';
import type {Point} from './planner';
import {canStand,moveOnRover} from './rover-navigation';
import {positionOnPath,resourceSafe} from './hazard-planner';
import type {TimedPoint} from './hazard-planner';
import {sweptContact} from './dust-devil-geometry';
import type {CircleState} from './dust-devil-geometry';
import {measureEscapePath} from './escape-metrics';
export function planningHorizon(s:AbruptSession){
 const spare=remaining(s)-back(s,s.position);
 // Preserve a full 2 s executed control segment; endpoints still undergo resourceSafe.
 return Math.min(V8.horizon,Math.max(2,Math.floor(spare/s.g.tick)*s.g.tick));
}
function connectors(s:AbruptSession,p:Point=s.position){const g=s.g,t=g.terrain,entries:{i:number;ticks:number}[]=[];
 for(const x of new Set([Math.floor(p.x),Math.ceil(p.x)]))for(const y of new Set([Math.floor(p.y),Math.ceil(p.y)])){const q={x,y};if(!canStand(t,q,g.settings))continue;const m=moveOnRover(t,p,(x-p.x)*t.cellSize,(y-p.y)*t.cellSize,g.settings);if(m.reason)continue;const i=index(t,q),seconds=m.distance*(1+(t.meanSlope[i]??0)**2*.012+g.settings.loadKg*.015)/g.settings.speed;entries.push({i,ticks:Math.ceil((seconds-1e-8)/g.tick)});}
 if(p===s.position&&s.pending&&s.pending.time>s.time){const e={i:index(t,s.pending),ticks:Math.round((s.pending.time-s.time)/g.tick)},k=entries.findIndex(a=>a.i===e.i);if(k>=0)entries[k]=e;else entries.push(e);}return entries;}
const back=(s:AbruptSession,p:Point)=>Math.min(...connectors(s,p).map(e=>(e.ticks+s.returns[e.i])*s.g.tick));
const remaining=(s:AbruptSession)=>Math.min((s.resources.oxygenSeconds-104)/1.12,(s.resources.batterySeconds-104)/1.06,s.resources.missionSeconds);
export function planEvacuationV13(s:AbruptSession,arm:ArmV8,prediction=abruptPrediction(s,arm==='Oracle')):EncounterDecision{
 const began=performance.now(),g=s.g,t=g.terrain,now=s.time,H=planningHorizon(s),cell=t.cellSize,predict=prediction,history=availableFixes(s),wait=[{...s.position,time:now},{...s.position,time:now+H}],canMove=history.length>0&&now>=s.firstDetect+s.c.reaction;
 const initial={path:wait,action:'HOLD',contact:0,bandContact:0,clearance:NaN,returnMargin:remaining(s)-back(s,s.position),latencyMs:performance.now()-began,expanded:0,limited:false,unnecessaryHold:false,reason:!history.length?'OBSERVING · no delivered detection':`REACTION · movement after T+${s.firstDetect+s.c.reaction} s`,forecast:[] as CircleState[]};
 if(!canMove||!predict)return initial;
 const map=encounterDistances(g,connectors(s)),goal=now>=V8.returnAt||remaining(s)-back(s,s.position)<2*V8.horizon?s.base:s.target;
 function pathTo(last:number,delay=0){const ids=[last];while(map.parent[ids.at(-1)!]>=0)ids.push(map.parent[ids.at(-1)!]);ids.reverse();const path:TimedPoint[]=[{...s.position,time:now}];if(delay)path.push({...s.position,time:now+delay});for(const i of ids){const time=now+delay+map.d[i]*g.tick;if(time>path.at(-1)!.time+1e-8)path.push({...point(t,i),time});if(time>=now+H)break;}const p=positionOnPath(path,now+H);while(path.at(-1)!.time>now+H)path.pop();if(path.at(-1)!.time<now+H)path.push({...p,time:now+H});return path;}
 const admissible=(path:TimedPoint[])=>path.every(p=>resourceSafe(s.resources,p.time-now,back(s,p),g.settings.loadKg));
 const baseline=Number.isFinite(map.d[index(t,goal)])?pathTo(index(t,goal)):wait;
 const steps=H/g.tick,nominal=Array.from({length:steps+1},(_,i)=>predict(now+i*g.tick)),bands=nominal.map(p=>({...p,radius:p.radius+Math.hypot(p.sigma,p.radiusSigma)}));
 const contact=(path:TimedPoint[],circles:CircleState[])=>{let total=0,j=0;const at=(time:number)=>{while(j<path.length-2&&path[j+1].time<time)j++;const a=path[j],b=path[j+1],u=Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time||1)));return {x:(a.x+(b.x-a.x)*u)*cell,y:(a.y+(b.y-a.y)*u)*cell};};let a=at(now);for(let k=0;k<steps;k++){const b=at(now+(k+1)*g.tick);total+=sweptContact(a,b,circles[k],circles[k+1],g.tick);a=b;}return total;};
 const progress=(path:TimedPoint[])=>{const p=path.at(-1)!;return Math.hypot(p.x-goal.x,p.y-goal.y)*cell;};
 const baselineContact=contact(baseline,nominal),bandContact=contact(baseline,bands);
 let chosen=baseline,chosenContact=baselineContact,chosenBand=bandContact,expanded=1;
 if(arm!=='Static'&&(baselineContact>1e-8||(arm==='MARS SHIFT'&&bandContact>1e-8))){
  const ends=new Set<number>([index(t,goal),index(t,s.base)]),sectors=new Map<string,{i:number;score:number}>();
  for(const i of g.allowed){const duration=map.d[i]*g.tick;if(!Number.isFinite(duration)||duration>H)continue;const p=point(t,i),sector=Math.floor((Math.atan2(p.y-s.position.y,p.x-s.position.x)+Math.PI)/Math.PI*8)%16;for(const span of [H/3,2*H/3,H]){const key=sector+':'+span,score=Math.abs(duration-span);if(!sectors.has(key)||score<sectors.get(key)!.score)sectors.set(key,{i,score});}}
  for(const a of sectors.values())ends.add(a.i);
  let paths=[wait,...[...ends].filter(i=>Number.isFinite(map.d[i])).map(i=>pathTo(i))].filter(admissible);
  const p=nominal[0],dx=s.position.x*cell-p.x,dy=s.position.y*cell-p.y;
  // Direction rules use the same supported candidates and return budgets.
  if(arm==='Radial'||arm==='Lateral'||history.length<2){const radial=arm!=='Lateral',vx=radial?dx:-p.vy,vy=radial?dy:p.vx,norm=Math.hypot(vx,vy)||1;paths.sort((a,b)=>{const projection=(path:TimedPoint[])=>{const end=path.at(-1)!,x=(end.x-s.position.x)*cell,y=(end.y-s.position.y)*cell;return (radial?x*vx+y*vy:Math.abs(x*vx+y*vy))/norm;};return projection(b)-projection(a);});paths=arm==='Lateral'&&paths.length>1?[paths.reduce((best,path)=>{const project=(p:TimedPoint[])=>{const end=p.at(-1)!;return (end.x-s.position.x)*vx+(end.y-s.position.y)*vy;};return project(path)>project(best)?path:best;}),paths.reduce((best,path)=>{const project=(p:TimedPoint[])=>{const end=p.at(-1)!;return (end.x-s.position.x)*vx+(end.y-s.position.y)*vy;};return project(path)<project(best)?path:best;})]:paths.slice(0,1);}
  else {const shortlist=paths.map(path=>({path,score:contact(path,nominal)})).sort((a,b)=>a.score-b.score||progress(a.path)-progress(b.path)).slice(0,8);for(const item of shortlist)for(const delay of [2,6]){const path=item.path.map((p,i)=>({...p,time:p.time+(i?delay:0)}));path.splice(1,0,{...s.position,time:now+delay});const end=positionOnPath(path,now+H);while(path.at(-1)!.time>now+H)path.pop();path.push({...end,time:now+H});if(admissible(path))paths.push(path);}}
  const rows=paths.map(path=>({path,nominal:contact(path,nominal),band:contact(path,bands),progress:progress(path)}));expanded=rows.length;
  const bestNominal=Math.min(...rows.map(a=>a.nominal));
  const eligible=arm==='MARS SHIFT'?rows.filter(a=>a.nominal<=bestNominal+s.nominalRegretCap+1e-8):rows;
  eligible.sort((a,b)=>{const score=(v:typeof a)=>v.nominal+(arm==='MARS SHIFT'?s.alpha*v.band:0);return score(a)-score(b)||a.progress-b.progress;});
  if(eligible.length){chosen=eligible[0].path;chosenContact=eligible[0].nominal;chosenBand=eligible[0].band;}
 }
 const okay=admissible(chosen),next=positionOnPath(chosen,now+2),moving=Math.hypot(next.x-s.position.x,next.y-s.position.y)>1e-7;
 const metrics=measureEscapePath(chosen,time=>predict(time),cell,now,now+H,Array.from({length:steps+1},(_,i)=>now+i*g.tick));
 const avoidable=!moving&&Math.hypot(positionOnPath(baseline,now+2).x-s.position.x,positionOnPath(baseline,now+2).y-s.position.y)>1e-6&&admissible(baseline)&&baselineContact<=chosenContact+1e-8&&bandContact<=chosenBand+1e-8;
 return {path:okay?chosen:wait,action:!okay?'NO FEASIBLE ROUTE':!moving?'HOLD':goal===s.base?'RETURN':chosen===baseline?'DETOUR':'SIDESTEP',contact:chosenContact,bandContact:chosenBand,clearance:metrics.minClearance,returnMargin:remaining(s)-H-back(s,chosen.at(-1)!),latencyMs:performance.now()-began,expanded,limited:false,unnecessaryHold:avoidable,reason:!okay?'No resource-feasible candidate':chosenContact>1e-8?'CONTACT PREDICTED · minimize exposure':history.length<2?'ACQUIRING · radial fallback':`No nominal contact within ${H} s · finite candidate search`,forecast:Array.from({length:9},(_,i)=>predict(now+i*6))};
}

