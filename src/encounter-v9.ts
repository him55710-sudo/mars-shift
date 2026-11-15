import {makeAbrupt,abruptPrediction,planAbrupt,V8} from './encounter-v8';
import type {AbruptCase,AbruptSession,WindDays} from './encounter-v8';
import type {EncounterGraph,EncounterSource,EncounterDecision} from './encounter-v7';
import type {Point} from './planner';
import {index,point} from './planner';
import {canStand,moveOnRover} from './rover-navigation';
import {positionOnPath,resourceSafe} from './hazard-planner';
import {measureEscapePath} from './escape-metrics';
import type {CircleState} from './dust-devil-geometry';
import {safeIntervalPath} from './sipp-v9';

export type CaseV9=AbruptCase&{event:string;truthSeed:number;budget:number};
export function seededNormal(seed:number){
  const uniform=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
  return {uniform,normal:()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform())};
}
/** A seeded stress generator, explicitly not a fitted Mars turbulence law.
 * Reused measured terrestrial winds provide background direction/speed only.
 * Each event has independent synthetic turn/growth parameters; bearings share it. */
export function makeEncounterV9(g:EncounterGraph,c:CaseV9,source:EncounterSource,wind:WindDays){
  const s=makeAbrupt(g,c,source,wind),r=seededNormal(c.truthSeed),noise=seededNormal(c.sensorSeed);
  const turnAt=10+25*r.uniform(),turn=(.3+.6*r.uniform())*(r.uniform()<.5?-1:1),period=10+15*r.uniform();
  const phase=r.uniform()*2*Math.PI,growth=.04+.1*r.uniform(),w=wind[String(c.windDay)];
  const windMean=w?w.reduce((sum,p)=>sum+p[1],0)/w.length:1;
  let wi=0,drift=0,rate=0,speedDrift=0;
  let x=s.initial.x*g.terrain.cellSize-c.distance*Math.cos(c.heading+c.bearing);
  let y=s.initial.y*g.terrain.cellSize-c.distance*Math.sin(c.heading+c.bearing);
  const truth:CircleState[]=[];
  for(let time=0;time<=420;time+=.25){
    const age=Math.max(0,time-c.birth);let heading=c.heading,speed=source.speed;
    if(time>c.birth){
      rate=.94*rate+.003*r.normal();drift=.995*drift+rate*.25;
      speedDrift=.98*speedDrift+.012*r.normal();heading+=drift;speed*=Math.max(.6,1+speedDrift);
      if(c.truth==='wind'&&w){
        while(wi<w.length-2&&w[wi+1][0]<=age)wi++;
        const p=w[wi],q=w[wi+1],u=Math.max(0,Math.min(1,(age-p[0])/(q[0]-p[0])));
        heading+=(p[2]+u*(((q[2]-p[2]+540)%360)-180)-w[0][2])*Math.PI/180;
        speed*=Math.max(.2,Math.min(2,(p[1]+u*(q[1]-p[1]))/windMean));
      }
      if(c.truth==='meander')heading+=turn*(Math.sin(age/period+phase)-Math.sin(phase));
      if(c.truth==='gust'){heading+=age>turnAt?turn*(1-Math.exp(-(age-turnAt)/3)):0;speed*=age>turnAt&&age<turnAt+12?1.35:1;}
      x+=speed*Math.cos(heading)*.25;y+=speed*Math.sin(heading)*.25;
    }
    const radius=source.diameter/2*Math.min(1,.15+.85*age/c.growthSeconds)*(1+growth*Math.sin(age/17));
    truth.push({x,y,radius:radius+1});
  }
  s.truth=(time:number)=>{const k=Math.max(0,Math.min(truth.length-1,time/.25)),i=Math.floor(k),j=Math.min(i+1,truth.length-1),u=k-i;return {x:truth[i].x+u*(truth[j].x-truth[i].x),y:truth[i].y+u*(truth[j].y-truth[i].y),radius:truth[i].radius+u*(truth[j].radius-truth[i].radius)};};
  s.observations=s.observations.map(o=>{const p=s.truth(o.time),rs=Math.max(.25,(p.radius-1)*c.diameterSigmaFraction);return {...o,x:p.x+c.positionSigma*noise.normal(),y:p.y+c.positionSigma*noise.normal(),radius:Math.max(.3,p.radius-1+rs*noise.normal()),radiusSigma:rs};});
  s.resources.oxygenSeconds=c.budget;s.resources.batterySeconds=c.budget;
  return s;
}
// The connector/mobility formula is intentionally identical to frozen v8.
export function connectorsV9(s:AbruptSession,p:Point=s.position){
  const g=s.g,t=g.terrain,entries:{i:number;ticks:number}[]=[];
  for(const x of new Set([Math.floor(p.x),Math.ceil(p.x)]))for(const y of new Set([Math.floor(p.y),Math.ceil(p.y)])){
    if(!canStand(t,{x,y},g.settings))continue;
    const m=moveOnRover(t,p,(x-p.x)*t.cellSize,(y-p.y)*t.cellSize,g.settings);if(m.reason)continue;
    const i=index(t,{x,y}),seconds=m.distance*(1+(t.meanSlope[i]??0)**2*.012+g.settings.loadKg*.015)/g.settings.speed;
    entries.push({i,ticks:Math.ceil((seconds-1e-8)/g.tick)});
  }
  if(p===s.position&&s.pending&&s.pending.time>s.time){const e={i:index(t,s.pending),ticks:Math.round((s.pending.time-s.time)/g.tick)},at=entries.findIndex(a=>a.i===e.i);if(at>=0)entries[at]=e;else entries.push(e);}
  return entries;
}
export function planSippV9(s:AbruptSession,sigma=0,oracle=false):EncounterDecision{
  const began=performance.now(),base=planAbrupt(s,'Static'),predict=abruptPrediction(s,oracle);
  if(!predict||s.time<s.firstDetect+s.c.reaction)return base;
  const g=s.g,t=g.terrain,H=V8.horizon,now=s.time;
  const back=(p:Point)=>Math.min(...connectorsV9(s,p).map(e=>(e.ticks+s.returns[e.i])*g.tick));
  const remaining=Math.min((s.resources.oxygenSeconds-104)/1.12,(s.resources.batterySeconds-104)/1.06,s.resources.missionSeconds);
  const goal=now>=V8.returnAt||remaining-back(s.position)<2*H?s.base:s.target;
  const circles=Array.from({length:H/g.tick+1},(_,k)=>{const p=predict(now+k*g.tick);return {...p,radius:p.radius+sigma*Math.hypot(p.sigma,p.radiusSigma)};});
  const envelope=(time:number)=>{const p=predict(time);return {...p,radius:p.radius+sigma*Math.hypot(p.sigma,p.radiusSigma)};};
  const knots=Array.from({length:circles.length},(_,k)=>now+k*g.tick);
  const baseline=measureEscapePath(base.path,envelope,t.cellSize,now,now+H,knots);
  if(baseline.exposureSeconds<1e-8&&base.action!=='NO FEASIBLE ROUTE')return {...base,latencyMs:performance.now()-began};
  const result=safeIntervalPath({g,start:s.position,entries:connectorsV9(s),goal,circles,now,
    admissible:(i,ticks)=>resourceSafe(s.resources,ticks*g.tick,s.returns[i]*g.tick,g.settings.loadKg)});
  if(!result.path){
    const fallback=planAbrupt(s,oracle?'Oracle':sigma?'MARS SHIFT':'Nominal');
    return {...fallback,expanded:result.expanded,limited:result.limited,latencyMs:performance.now()-began,
      reason:'SIPP found no zero-contact path within lattice/horizon; finite-candidate exposure fallback. '+fallback.reason};
  }
  const path=result.path,metric=measureEscapePath(path,predict,t.cellSize,now,now+H,knots),p=positionOnPath(path,now+2);
  const moving=Math.hypot(p.x-s.position.x,p.y-s.position.y)>1e-8;
  return {path,action:!moving?'HOLD':goal===s.base?'RETURN':'SIDESTEP',contact:metric.exposureSeconds,bandContact:0,
    clearance:metric.minClearance,returnMargin:remaining-H-back(path.at(-1)!),latencyMs:performance.now()-began,
    expanded:result.expanded,limited:result.limited,unnecessaryHold:!moving&&base.action!=='HOLD'&&baseline.exposureSeconds<1e-8,
    reason:result.limited?'Bounded SIPP: zero-contact candidate; search limit reached':'SIPP: zero predicted contact within 48 s; static return budget beyond horizon',
    forecast:Array.from({length:9},(_,i)=>predict(now+i*6))};
}
