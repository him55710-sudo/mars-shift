import {exposureMPC} from './hazard-mpc';
import {connectorSeconds,positionOnPath,resourceSafe,staticSegmentSafe} from './hazard-planner';
import type {HazardContext,HazardConfig,ResourceState,TimedPoint,EscapeCandidate} from './hazard-planner';
import {leg,point,index} from './planner';
import type {Point} from './planner';
import {fitLocalTrack} from './local-dust-tracker';
import {fitForecastV8} from './vortex-forecast-v8';
import type {Forecast,VortexObservation} from './hazard-tracker';
import {moveOnRover,canStand} from './rover-navigation';
import type {EncounterGraph} from './encounter-v7';
import {measureEscapePath} from './escape-metrics';
import type {AbruptSession} from './encounter-v8';
import {sandRiskMap} from './sand-risk';

export const REACTIVE_ARMS=['MARS SHIFT','Radial','Lateral','Reactive Best-of-3'] as const;
export type ReactiveArm=typeof REACTIVE_ARMS[number];
/** Explicit policy boundary: no truth callback, future observations, seed, onset,
 * source speed, future manoeuvre label, or scenario-generator parameters. */
export type ReactiveInput={context:HazardContext;graph:EncounterGraph;position:Point;base:Point;target:Point;time:number;resources:ResourceState;observations:VortexObservation[];readyAt:number;config:HazardConfig};
export type ReactiveDecision={arm:ReactiveArm;path:TimedPoint[];action:string;status:'ACQUIRING'|'REACTION'|'MODELED_CLEAR'|'STALE_FORECAST'|'CONTACT_PREDICTED'|'NO_VERIFIED_ACTION';reason:string;contact:number|null;clearance:number|null;returnMargin:number;latencyMs:number;candidateCount:number;forecast:Forecast[];unnecessaryHold:boolean};
export function evaluationContext(s:AbruptSession):HazardContext{return {terrain:s.g.terrain,settings:s.g.settings,base:s.base,ground:sandRiskMap(s.g.terrain),returnSeconds:Float64Array.from(s.returns,v=>v*s.g.tick),returnNext:new Int32Array(s.returns.length).fill(-1)};}
export function policyInput(s:AbruptSession,context:HazardContext,config:HazardConfig):ReactiveInput{
 const observations=s.observations.filter(o=>o.time+1<=s.time).map(o=>Object.freeze({...o}));
 return {context,graph:s.g,position:{...s.position},base:{...s.base},target:{...s.target},time:s.time,resources:{...s.resources},observations,readyAt:observations.length?Math.ceil((observations[0].time+1)/2)*2+s.c.reaction:Infinity,config:{...config}};
}
export function inputPrediction(input:ReactiveInput){
 if(!input.observations.length)return null;
 const fit=fitForecastV8(input.observations,'CV_SMOOTH'),last=input.observations.at(-1)!;
 return (time:number):Forecast=>{const p=fit(time),position95=2.447747*p.sigma,radius95=1.96*p.radiusSigma;return {time,x:p.x,y:p.y,radius:p.radius,position95,radius95,envelope:p.radius+Math.hypot(position95,radius95),vx:p.vx,vy:p.vy,age:Math.max(0,time-last.time),valid:input.observations.length>=2};};
}
export function returnSeconds(input:ReactiveInput,p:Point){
 const {context:c}=input,t=c.terrain;let best=Infinity;
 for(const x of new Set([Math.floor(p.x),Math.ceil(p.x)]))for(const y of new Set([Math.floor(p.y),Math.ceil(p.y)])){
  if(x<0||y<0||x>=t.width||y>=t.height)continue;const q={x,y};if(!canStand(t,q,c.settings))continue;
  if(moveOnRover(t,p,(x-p.x)*t.cellSize,(y-p.y)*t.cellSize,c.settings).reason)continue;
  best=Math.min(best,connectorSeconds(c,p,q)+c.returnSeconds[index(t,q)]);
 }return best;
}
export function usableSeconds(input:ReactiveInput){const r=input.resources,load=input.context.settings.loadKg;return Math.min((r.oxygenSeconds-r.oxygenReserveSeconds!)/(1+load*.01),(r.batterySeconds-r.batteryReserveSeconds!)/(1+load*.005),r.missionSeconds);}
export function reactiveHorizon(input:ReactiveInput){return Math.min(input.config.horizon,Math.max(2,Math.floor((usableSeconds(input)-returnSeconds(input,input.position))*2)/2));}
export function reactiveGoal(input:ReactiveInput){return input.time>=90||usableSeconds(input)-returnSeconds(input,input.position)<2*input.config.horizon?input.base:input.target;}
export function physicalPathAllowed(input:ReactiveInput,path:TimedPoint[]){
 const {context:c,graph:g}=input,t=c.terrain;if(path.length<2)return false;
 if(Math.hypot(path[0].x-input.position.x,path[0].y-input.position.y)>1e-7||Math.abs(path[0].time-input.time)>1e-7)return false;
 for(let k=1;k<path.length;k++){
  const a=path[k-1],b=path[k],dt=b.time-a.time;if(![a.x,a.y,b.x,b.y,dt].every(Number.isFinite)||dt<0)return false;
  const distance=Math.hypot(b.x-a.x,b.y-a.y)*t.cellSize;if(distance<1e-8)continue;
  if(dt<=0||distance/dt>c.settings.speed+1e-6)return false;
  if([a.x,a.y,b.x,b.y].every(Number.isInteger)){
   if(!g.edges[index(t,a)]?.some(e=>e.i===index(t,b)))return false;
  }else if(moveOnRover(t,a,(b.x-a.x)*t.cellSize,(b.y-a.y)*t.cellSize,c.settings).reason)return false;
 }
 return path.every(p=>resourceSafe(input.resources,p.time-input.time,returnSeconds(input,p),c.settings.loadKg));
}
function timedRoute(input:ReactiveInput,target:Point,H:number){
 const c=input.context,t=c.terrain,route=leg(t,{x:Math.round(input.position.x),y:Math.round(input.position.y)},target,'time',c.settings,null);if(!route)return null;
 let cells=route.cells;if(cells.length>1&&staticSegmentSafe(t,c.settings,input.position,point(t,cells[1])))cells=cells.slice(1);
 const path:TimedPoint[]=[{...input.position,time:input.time}];
 for(const i of cells){const p=point(t,i),a=path.at(-1)!,dt=connectorSeconds(c,a,p);if(dt<1e-8)continue;
  if(a.time+dt>=input.time+H){const u=(input.time+H-a.time)/dt;path.push({x:a.x+(p.x-a.x)*u,y:a.y+(p.y-a.y)*u,time:input.time+H});break;}path.push({...p,time:a.time+dt});
 }
 if(path.at(-1)!.time<input.time+H)path.push({...path.at(-1)!,time:input.time+H});return path;
}
function directionPath(input:ReactiveInput,dx:number,dy:number,H:number){
 const t=input.context.terrain,n=Math.hypot(dx,dy);if(n<1e-8)return null;dx/=n;dy/=n;
 const reach=input.context.settings.speed*H,desired={x:input.position.x+dx*reach/t.cellSize,y:input.position.y+dy*reach/t.cellSize};
 const endpoints=input.graph.allowed.map(i=>point(t,i)).filter(p=>{const x=(p.x-input.position.x)*t.cellSize,y=(p.y-input.position.y)*t.cellSize,d=Math.hypot(x,y);return d>.2&&d<=reach*1.1&&(x*dx+y*dy)/d>=Math.SQRT1_2;}).sort((a,b)=>Math.hypot(a.x-desired.x,a.y-desired.y)-Math.hypot(b.x-desired.x,b.y-desired.y)||index(t,a)-index(t,b));
 for(const p of endpoints.slice(0,12)){const path=timedRoute(input,p,H);if(path&&physicalPathAllowed(input,path)&&Math.hypot(positionOnPath(path,input.time+2).x-input.position.x,positionOnPath(path,input.time+2).y-input.position.y)>.01)return path;}
 return null;
}
function pathScore(input:ReactiveInput,path:TimedPoint[],predict:NonNullable<ReturnType<typeof inputPrediction>>,H:number){
 const m=measureEscapePath(path,time=>{const f=predict(time);return {...f,radius:f.radius+1};},input.context.terrain.cellSize,input.time,input.time+H,Array.from({length:Math.ceil(H*2)+1},(_,i)=>Math.min(input.time+H,input.time+i*.5)));
 const end=path.at(-1)!,goal=reactiveGoal(input);return {contact:m.exposureSeconds,clearance:m.minClearance,progress:Math.hypot(end.x-goal.x,end.y-goal.y)*input.context.terrain.cellSize};
}
export function reactivePaths(input:ReactiveInput,predict:NonNullable<ReturnType<typeof inputPrediction>>,H:number){
 const p=predict(input.time),cell=input.context.terrain.cellSize,rx=input.position.x*cell-p.x,ry=input.position.y*cell-p.y;
 // With one fix, velocity is unobserved: perpendicular to the observed radial axis.
 const vx=Math.hypot(p.vx,p.vy)>.05?p.vx:-rx,vy=Math.hypot(p.vx,p.vy)>.05?p.vy:-ry;
 return [directionPath(input,rx,ry,H),directionPath(input,-vy,vx,H),directionPath(input,vy,-vx,H)];
}
export function planReactive(input:ReactiveInput,arm:ReactiveArm):ReactiveDecision{
 const began=performance.now(),H=reactiveHorizon(input),wait:TimedPoint[]=[{...input.position,time:input.time},{...input.position,time:input.time+H}],predict=inputPrediction(input);
 const finish=(path:TimedPoint[],status:ReactiveDecision['status'],reason:string,count=0):ReactiveDecision=>{if(status==='MODELED_CLEAR'&&input.time-input.observations.at(-1)!.time>input.config.maxSensorAge){status='STALE_FORECAST';reason='Stale delivered observation; coasting estimate only. '+reason;}const m=predict?pathScore(input,path,predict,H):null,next=positionOnPath(path,input.time+2),moving=Math.hypot(next.x-input.position.x,next.y-input.position.y)>.001;return {arm,path,status,action:status==='NO_VERIFIED_ACTION'?'NO FEASIBLE ROUTE':!moving?'HOLD':reactiveGoal(input)===input.base?'RETURN':'SIDESTEP',reason,contact:m?.contact??null,clearance:m?.clearance??null,returnMargin:usableSeconds(input)-H-returnSeconds(input,path.at(-1)!),latencyMs:performance.now()-began,candidateCount:count,forecast:predict?Array.from({length:9},(_,i)=>predict(input.time+i*H/8)):[],unnecessaryHold:false};};
 if(!predict)return finish(wait,'ACQUIRING','No delivered observation; avoidance is not verified.');
 if(input.time<input.readyAt)return finish(wait,'REACTION','Shared reaction delay is still active.');
 if(input.time-input.observations.at(-1)!.time>(input.config.coastSeconds??input.config.maxSensorAge))return finish(wait,'NO_VERIFIED_ACTION','Observation exceeded the common coast limit; no verified escape command.');
 if(arm==='MARS SHIFT'){
  let bank:EscapeCandidate[]=[];const track=fitLocalTrack(input.observations,{window:5,radiusMode:'last',processNoise:.08});
  exposureMPC(input.context,input.position,input.target,input.time,track,input.resources,{...input.config,horizon:H},'MARS SHIFT',{forecastAt:predict,onCandidates:candidates=>{bank=candidates;}});
  const allowed=bank.filter(c=>physicalPathAllowed(input,c.path)).sort((a,b)=>a.score-b.score),chosen=allowed[0];
  if(!chosen)return finish(wait,'NO_VERIFIED_ACTION','No trajectory passes the common terrain and return-resource gate.',bank.length);
  const m=pathScore(input,chosen.path,predict,H);return finish(chosen.path,m.contact>1e-8?'CONTACT_PREDICTED':'MODELED_CLEAR',m.contact>1e-8?'Contact remains predicted; exposure-minimizing modeled action.':'No nominal contact in the finite horizon; no safety guarantee.',bank.length);
 }
 const goal=timedRoute(input,reactiveGoal(input),H),goalScore=goal&&physicalPathAllowed(input,goal)?pathScore(input,goal,predict,H):null;
 if(goal&&goalScore&&goalScore.contact<=1e-8)return finish(goal,'MODELED_CLEAR','Continue the common mission/return route; no nominal contact in this horizon.',1);
 const f=predict(input.time),cell=input.context.terrain.cellSize,rx=input.position.x*cell-f.x,ry=input.position.y*cell-f.y,vx=Math.hypot(f.vx,f.vy)>.05?f.vx:-rx,vy=Math.hypot(f.vx,f.vy)>.05?f.vy:-ry;
 const paths=arm==='Radial'?[directionPath(input,rx,ry,H)]:arm==='Lateral'?[directionPath(input,-vy,vx,H),directionPath(input,vy,-vx,H)]:reactivePaths(input,predict,H);
 const rows=paths.filter((p):p is TimedPoint[]=>!!p).map(path=>({path,...pathScore(input,path,predict,H)})).sort((a,b)=>a.contact-b.contact||a.progress-b.progress||b.clearance-a.clearance);
 if(!rows.length)return finish(wait,'NO_VERIFIED_ACTION','No directional escape passes the common terrain and return-resource gate.',paths.length);
 const chosen=rows[0];return finish(chosen.path,chosen.contact>1e-8?'CONTACT_PREDICTED':'MODELED_CLEAR',chosen.contact>1e-8?'Directional action still predicts contact.':'Observed-direction escape; finite-horizon model only.',paths.length);
}
/** Offline counterfactual metric; excluded from policy latency and never uses truth. */
export function avoidableStop(input:ReactiveInput,d:ReactiveDecision){
 if(input.time<input.readyAt)return false;const next=positionOnPath(d.path,input.time+2);if(Math.hypot(next.x-input.position.x,next.y-input.position.y)>.001)return false;const predict=inputPrediction(input);if(!predict)return false;const H=reactiveHorizon(input),hold=pathScore(input,d.path,predict,H);if(hold.progress<.25&&hold.contact<=1e-8)return false;
 const goal=timedRoute(input,reactiveGoal(input),H);
 return [...reactivePaths(input,predict,H),goal].filter((p):p is TimedPoint[]=>!!p&&physicalPathAllowed(input,p)).some(path=>{const m=pathScore(input,path,predict,H);return m.contact<hold.contact-1e-8||m.contact<=hold.contact+1e-8&&m.progress<hold.progress-1e-6;});
}
