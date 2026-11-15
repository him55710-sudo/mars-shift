import {index,leg,point,blocked} from './planner';
import type {Point} from './planner';
import {connectorSeconds,positionOnPath,resourceSafe,staticSegmentSafe} from './hazard-planner';
import type {HazardContext,HazardConfig,ResourceState,EscapeCandidate,EscapeDecision,EscapeAction,TimedPoint} from './hazard-planner';
import {forecast} from './hazard-tracker';
import type {VortexTrack,Forecast} from './hazard-tracker';
import type {HazardModel} from './hazard-planner';
import {localReturnSeconds,localCommitSafe} from './local-return';
import {measureEscapePath} from './escape-metrics';

/** Receding-horizon trajectory bank with time-resolved exposure costs.
 * Terrain remains a hard constraint. Unavoidable dust is optimized, never called clear.
 * Logistic radial uncertainty is a screening surrogate, NOT a calibrated probability.
 * Only the first two seconds are executed, then observations replace the prediction. */
export type MPCAudit={forecastAt?:(time:number)=>Forecast;onCandidates?:(candidates:EscapeCandidate[],admissible:EscapeCandidate[],chosen:EscapeCandidate|null)=>void};
export function exposureMPC(c:HazardContext,start:Point,target:Point,now:number,track:VortexTrack,r:ResourceState,cfg:HazardConfig,model:HazardModel='MARS SHIFT',audit?:MPCAudit):Omit<EscapeDecision,'time'|'model'|'latencyMs'|'forecast'> {
 const t=c.terrain,h=cfg.horizon,cell=t.cellSize,rounded={x:Math.round(start.x),y:Math.round(start.y)},local=(p:Point)=>index(t,{x:Math.round(p.x),y:Math.round(p.y)});
 if(!staticSegmentSafe(t,c.settings,start,start))return {status:'NO_VERIFIED_ACTION',action:null,chosen:null,candidates:[],reason:'Current position is outside traversable observed terrain.'};
 const matched=cfg.policy==='local-matched';
 const back=(p:Point)=>matched?localReturnSeconds(c,p):c.returnSeconds[local(p)]+connectorSeconds(c,p,{x:Math.round(p.x),y:Math.round(p.y)});
 const usable=Math.min((r.oxygenSeconds-(r.oxygenReserveSeconds??r.oxygenSeconds*r.reserveFraction))/(1+c.settings.loadKg*.01),(r.batterySeconds-(r.batteryReserveSeconds??r.batterySeconds*r.reserveFraction))/(1+c.settings.loadKg*.005),r.missionSeconds);
 const slack=usable-back(start),returning=slack<2*h;
 const predict=audit?.forecastAt??((time:number)=>forecast(track,time,true,cfg.localizationSigma));
 const samples=Array.from({length:Math.ceil(h/.5)},(_,i)=>predict(now+Math.min(h,(i+.5)*.5)));
 const endpoints=new Map<string,{p:Point;action:EscapeAction}>();
 const add=(p:Point,action:EscapeAction)=>{p={x:Math.round(p.x),y:Math.round(p.y)};if(p.x>=0&&p.y>=0&&p.x<t.width&&p.y<t.height&&!blocked(t,index(t,p),c.settings,null))endpoints.set(`${p.x},${p.y}`,{p,action});};
 for(const scale of [.55,1.1])for(let k=0;k<16;k++){const angle=k*Math.PI/8,d=c.settings.speed*h*scale/cell;add({x:start.x+Math.cos(angle)*d,y:start.y+Math.sin(angle)*d},'SIDESTEP');}
 add(target,'DETOUR');add(c.base,'RETURN');
 const paths:{action:EscapeAction;path:TimedPoint[]}[]=[{action:'HOLD',path:[{...start,time:now},{...start,time:now+h}]}];
 for(const {p,action} of endpoints.values()){
  const route=leg(t,rounded,p,'time',c.settings,null);if(!route)continue;
  let cells=route.cells;
  // Connect directly to the next reachable cell instead of snapping a moving walker back.
  if(cells.length>1&&staticSegmentSafe(t,c.settings,start,point(t,cells[1])))cells=cells.slice(1);
  for(const delay of [0,4,8]){
   const path:TimedPoint[]=[{...start,time:now}];if(delay)path.push({...start,time:now+delay});
   for(const i of cells){const p=point(t,i),a=path.at(-1)!,dt=connectorSeconds(c,a,p);if(dt<1e-7)continue;if(!staticSegmentSafe(t,c.settings,a,p))break;
    const end=a.time+dt;if(end>=now+h){const u=(now+h-a.time)/dt;path.push({x:a.x+(p.x-a.x)*u,y:a.y+(p.y-a.y)*u,time:now+h});break;}path.push({...p,time:end});
   }
   if(path.at(-1)!.time<now+h)path.push({...path.at(-1)!,time:now+h});paths.push({action,path});
  }
 }
 const candidates:EscapeCandidate[]=paths.map(({action,path})=>{
  let riskIntegral=0,predictedExposure=0,depth=0,length=0,groundExposure=0;
  for(let k=0;k<samples.length;k++){const f=samples[k],p=positionOnPath(path,f.time),d=Math.hypot(p.x*cell-f.x,p.y*cell-f.y),margin=d-f.radius-1,sigma=Math.max(.6,Math.hypot(f.position95/2.448,f.radius95/1.96));
   riskIntegral+=.5/(1+Math.exp(Math.max(-40,Math.min(40,margin/sigma))));if(margin<0)predictedExposure+=.5;depth+=.5*Math.max(0,-margin)/Math.max(1,f.radius);
  }
  const exact=cfg.continuousContact?measureEscapePath(path,time=>{const f=predict(time);return {...f,radius:f.radius+1};},cell,now,now+h,Array.from({length:Math.ceil(h*2)+1},(_,i)=>Math.min(now+h,now+i*.5))):null;
  if(exact)predictedExposure=exact.exposureSeconds;
  for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],d=Math.hypot(b.x-a.x,b.y-a.y)*cell;length+=d;groundExposure+=d*c.ground.risk[local(b)];}
  const end=path.at(-1)!,next=positionOnPath(path,now+2),returnSeconds=back(end),margin=usable-h-returnSeconds,commitMargin=usable-2-back(next),budgetSafe=resourceSafe(r,h,returnSeconds,c.settings.loadKg);
  const goal=returning?c.base:target,goalDistance=Math.hypot(end.x-goal.x,end.y-goal.y)*cell;
  const deficit=(m:number)=>Number.isFinite(m)?Math.max(0,-m):1e4;
  const dustCost=matched?(model==='Baseline'?0:predictedExposure+depth*.5+(model==='MARS SHIFT'?(cfg.uncertaintyWeight??.3)*riskIntegral:0)):(riskIntegral+predictedExposure*.4+depth*.15);
  const groundWeight=matched&&model!=='MARS SHIFT'?0:cfg.groundWeight;
  const score=(cfg.exposureWeight??35)*dustCost+.08*length+groundWeight*.08*groundExposure+.55*goalDistance+deficit(margin)*25+deficit(commitMargin)*200;
  const waits=Math.hypot(next.x-start.x,next.y-start.y)<1e-6;
  return {action:waits?'HOLD':action,path,feasible:true,reason:predictedExposure>0?'Least modeled exposure among terrain-feasible candidates; dust contact remains predicted.':'No nominal dust intersection in this trajectory; uncertainty is still modeled.',score,distance:length,groundExposure,returnSeconds,expanded:0,budgetSafe,predictedExposure,riskIntegral,returnMargin:margin,predictedMinClearance:exact?.minClearance};
 });
 // Preserve a feasible two-second return commitment whenever one exists. Already depleted
 // budgets do not suppress escape: the deficit remains visible and is penalized above.
 const admissible=candidates.filter(a=>matched?localCommitSafe(c,a.path,now,r):resourceSafe(r,2,back(positionOnPath(a.path,now+2)),c.settings.loadKg));
 const chosen=[...(admissible.length?admissible:candidates)].sort((a,b)=>a.score-b.score)[0]??null;
 audit?.onCandidates?.(candidates,admissible,chosen);
 const display=(['HOLD','SIDESTEP','DETOUR','RETURN'] as EscapeAction[]).map(action=>candidates.filter(c=>c.action===action).sort((a,b)=>a.score-b.score)[0]).filter((c):c is EscapeCandidate=>!!c);
 if(chosen&&!display.includes(chosen)){const i=display.findIndex(c=>c.action===chosen.action);if(i>=0)display[i]=chosen;else display.push(chosen);}
 if(matched&&chosen&&!admissible.length)chosen.reason='RETURN BUDGET INFEASIBLE: no candidate preserves the reserve. Minimum modeled deficit/exposure fallback; return is not guaranteed.';
 return {status:!chosen?'NO_VERIFIED_ACTION':(chosen.predictedExposure??0)>0||!chosen.budgetSafe||!admissible.length?'EXPOSURE_MINIMIZING':'MODELED_ACTION',action:chosen?.action??null,chosen,candidates:display,reason:chosen?chosen.reason:'No terrain-feasible trajectory.'};
}
