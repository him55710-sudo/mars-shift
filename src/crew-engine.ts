import {DEFAULTS, blocked, leg, metrics, nearestAllowed, point} from './planner';
import type {Exclusion, Mode, Point, Settings, Terrain} from './planner';
import {withObstacles} from './obstacles';
import type {ObstacleAnnotation} from './obstacles';
import {constrainedPlan} from './constrained-planner';

export type Phase='prepare'|'outbound'|'science'|'return'|'complete';
export type CrewPlan={base:Point;target:Point;targetName:string;purpose:string;settings:Settings;mode:Mode;exclusion?:Exclusion|null;obstacles?:ObstacleAnnotation[];computed?:{outbound:number[];inbound:number[]}};
export type CrewEvent={id:number;minute:number;title:string;detail:string;level:'warning'|'caution'|'advisory'};
export type CrewState={version:1;terrainKey:string;config:CrewPlan;phase:Phase;track:number[];returnTrack:number[];cursor:number;trail:number[];elapsed:number;oxygenSpent:number;powerSpent:number;scienceSpent:number;held:boolean;holdReason:string;exclusion:Exclusion|null;events:CrewEvent[];revision:number;scienceTasks?:boolean[]};
export type Candidate={track:number[];returnTrack:number[];distance:number;minutes:number;reserve:number;timeMargin:number;feasible:boolean;reasons:string[]};
export const CREW_SESSION='mars-shift:crew-session:v1';
export const CREW_HANDOFF='mars-shift:crew-handoff:v1';
const terrainKey=(t:Terrain)=>`${t.crs}|${t.bounds.join(',')}|${t.width}x${t.height}|${t.cellSize}`;

export function defaultCrewPlan(t:Terrain):CrewPlan{
 return {base:nearestAllowed(t,{x:32,y:168},DEFAULTS),target:nearestAllowed(t,{x:153,y:43},DEFAULTS),targetName:'Surface texture transect',purpose:'Document surface texture, photograph the context and compare elevations.',settings:{...DEFAULTS},mode:'mission'};
}
export function position(t:Terrain,s:CrewState):Point{return point(t,s.track[s.cursor]??s.config.base.y*t.width+s.config.base.x);}
export function pathDistance(t:Terrain,cells:number[]):number{
 let d=0;for(let i=1;i<cells.length;i++){const a=point(t,cells[i-1]),b=point(t,cells[i]);d+=Math.hypot(Math.hypot(a.x-b.x,a.y-b.y)*t.cellSize,t.elevation[cells[i]]!-t.elevation[cells[i-1]]!);}return d;
}
export function checkpointIndex(t:Terrain,cells:number[],cursor:number,meters=75):number{
 let d=0,i=cursor;while(i<cells.length-1&&d<meters){d+=pathDistance(t,[cells[i],cells[i+1]]);i++;}return i;
}
export function bearing(t:Terrain,a:number,b:number):number{const p=point(t,a),q=point(t,b);return (Math.atan2(q.x-p.x,p.y-q.y)*180/Math.PI+360)%360;}
function futureMetrics(t:Terrain,s:CrewState,track:number[],returnTrack:number[]){
 const science=s.phase==='return'||s.phase==='complete'?0:Math.max(0,s.config.settings.scienceMinutes-s.scienceSpent);
 const cells=s.phase==='science'?returnTrack:s.phase==='return'||s.phase==='complete'?track:[...track,...returnTrack.slice(1)];
 const m=metrics(t,cells,s.config.mode,{...s.config.settings,scienceMinutes:science});
 const cfg=s.config.settings;
 const o=100*(1-s.oxygenSpent/cfg.oxygenMinutes)-(100-m.oxygenRemaining);
 const p=100*(1-s.powerSpent/cfg.powerMinutes)-(100-m.powerRemaining);
 const reserve=Math.min(o,p),timeMargin=cfg.durationMinutes-s.elapsed-m.totalMinutes;
 const reasons:string[]=[];
 if(timeMargin<0)reasons.push('The remaining plan exceeds the mission time budget.');
 if(reserve<cfg.reservePercent)reasons.push('Projected return reserve falls below the required minimum.');
 if(cfg.dust)reasons.push('Visibility is reduced. Hold and verify the local situation.');
 return {distance:m.distance,minutes:m.totalMinutes,reserve,timeMargin,feasible:!reasons.length,reasons,travel:m.travelMinutes,oxygenAfter:o,powerAfter:p};
}
export function candidate(t:Terrain,s:CrewState,exclusion=s.exclusion,returnOnly=false):Candidate|null{
 t=withObstacles(t,s.config.obstacles??[]);
 const current=position(t,s),cfg=s.config;
 const needsOutbound=!returnOnly&&(s.phase==='prepare'||s.phase==='outbound');
 if(needsOutbound){
  const supplied=s.phase==='prepare'&&cfg.computed&&JSON.stringify(exclusion)===JSON.stringify(cfg.exclusion??null)?cfg.computed:null;
  const validPath=(cells:number[],start:Point,end:Point)=>Array.isArray(cells)&&cells.length>0&&cells.length<100000&&cells[0]===start.y*t.width+start.x&&cells.at(-1)===end.y*t.width+end.x&&cells.every((i,n)=>{if(!Number.isInteger(i)||i<0||i>=t.width*t.height||blocked(t,i,cfg.settings,exclusion))return false;if(!n)return true;const a=point(t,cells[n-1]),b=point(t,i),dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);return dx<=1&&dy<=1&&(!dx||!dy||!blocked(t,a.y*t.width+b.x,cfg.settings,exclusion)&&!blocked(t,b.y*t.width+a.x,cfg.settings,exclusion));});
  if(supplied&&validPath(supplied.outbound,current,cfg.target)&&validPath(supplied.inbound,cfg.target,cfg.base))return {track:supplied.outbound,returnTrack:supplied.inbound,...futureMetrics(t,s,supplied.outbound,supplied.inbound)};
  const reserveFactor=1-cfg.settings.reservePercent/100;
  if(reserveFactor<=0)return null;
  const remaining={...cfg.settings,scienceMinutes:Math.max(0,cfg.settings.scienceMinutes-s.scienceSpent),durationMinutes:cfg.settings.durationMinutes-s.elapsed,oxygenMinutes:cfg.settings.oxygenMinutes-s.oxygenSpent/reserveFactor,powerMinutes:cfg.settings.powerMinutes-s.powerSpent/reserveFactor};
  const route=constrainedPlan(t,current,cfg.target,cfg.mode,remaining,exclusion,cfg.base).route;
  return route?{track:route.outbound,returnTrack:route.inbound,...futureMetrics(t,s,route.outbound,route.inbound)}:null;
 }
 const a=leg(t,current,needsOutbound?cfg.target:cfg.base,cfg.mode,cfg.settings,exclusion);
 if(!a)return null;
 const b=needsOutbound?leg(t,cfg.target,cfg.base,cfg.mode,cfg.settings,exclusion):a;
 if(!b)return null;
 const state=returnOnly?{...s,phase:'return' as Phase}:s;
 const track=needsOutbound?a.cells:s.phase==='science'&&!returnOnly?[s.track[s.cursor]]:a.cells;
 const back=b.cells;
 return {track,returnTrack:back,...futureMetrics(t,state,track,back)};
}
export function initialCrew(t:Terrain,config=defaultCrewPlan(t)):CrewState{
 const base=config.base.y*t.width+config.base.x;
 const s:CrewState={version:1,terrainKey:terrainKey(t),config,phase:'prepare',track:[base],returnTrack:[base],cursor:0,trail:[base],elapsed:0,oxygenSpent:0,powerSpent:0,scienceSpent:0,held:false,holdReason:'',exclusion:config.exclusion??null,events:[],revision:0,scienceTasks:[false,false,false]};
 const c=candidate(t,s);return c?{...s,track:c.track,returnTrack:c.returnTrack}:s;
}
export function assessCrew(t:Terrain,s:CrewState){
 t=withObstacles(t,s.config.obstacles??[]);
 const future=futureMetrics(t,s,s.track.slice(s.cursor),s.returnTrack);
 const remaining=s.phase==='science'?s.returnTrack:s.phase==='return'||s.phase==='complete'?s.track.slice(s.cursor):[...s.track.slice(s.cursor),...s.returnTrack.slice(1)];
 const routeBlocked=remaining.some(i=>blocked(t,i,s.config.settings,s.exclusion));
 const returnLeg=leg(t,position(t,s),s.config.base,s.config.mode,s.config.settings,s.exclusion);
 const now=returnLeg?futureMetrics(t,{...s,phase:'return'},returnLeg.cells,returnLeg.cells):null;
 const cfg=s.config.settings;
 const travel=future.travel;
 const scienceWindow=Math.max(0,Math.min(cfg.durationMinutes-s.elapsed-travel,(cfg.oxygenMinutes*(1-cfg.reservePercent/100)-s.oxygenSpent-travel*(1+cfg.loadKg*.01))/.65,(cfg.powerMinutes*(1-cfg.reservePercent/100)-s.powerSpent-travel*(1+cfg.loadKg*.005))/.8));
 return {...future,feasible:future.feasible&&!routeBlocked,reasons:routeBlocked?[...future.reasons,'The current corridor intersects an exclusion. Review an alternative before moving.']:future.reasons,routeBlocked,returnNow:now,returnCells:returnLeg?.cells??[],scienceWindow,oxygenNow:100*(1-s.oxygenSpent/cfg.oxygenMinutes),powerNow:100*(1-s.powerSpent/cfg.powerMinutes),hasMissionPath:s.track.length>1||s.phase!=='prepare'};
}
export function addEvent(s:CrewState,title:string,detail:string,level:CrewEvent['level']='advisory'):CrewState{
 return {...s,events:[...s.events,{id:(s.events.at(-1)?.id??0)+1,minute:s.elapsed,title,detail,level}].slice(-30)};
}
export function beginCrew(t:Terrain,s:CrewState):CrewState{
 const c=candidate(t,s);if(!c?.feasible)return s;
 return addEvent({...s,phase:'outbound',track:c.track,returnTrack:c.returnTrack,cursor:0},'EVA rehearsal started','Crew position and resource use are simulated.');
}
export function advanceCrew(t:Terrain,s:CrewState):CrewState{
 if(s.held||s.config.settings.dust||!['outbound','return'].includes(s.phase)||!assessCrew(t,s).feasible)return s;
 const next=checkpointIndex(t,s.track,s.cursor),segment=s.track.slice(s.cursor,next+1);
 const m=metrics(t,segment,s.config.mode,{...s.config.settings,scienceMinutes:0});
 const cfg=s.config.settings;
 let updated={...s,cursor:next,trail:[...s.trail,...segment.slice(1)],elapsed:s.elapsed+m.travelMinutes,oxygenSpent:s.oxygenSpent+(100-m.oxygenRemaining)*cfg.oxygenMinutes/100,powerSpent:s.powerSpent+(100-m.powerRemaining)*cfg.powerMinutes/100};
 if(next===s.track.length-1){
  if(s.phase==='outbound')updated=addEvent({...updated,phase:'science'},'Science site reached','Confirm local conditions before starting science.');
  else updated=addEvent({...updated,phase:'complete'},'Habitat reached','The rehearsal is complete. Review the event log.');
 }
 return updated;
}
export function logScience(t:Terrain,s:CrewState):CrewState{
 if(s.phase!=='science'||s.held||s.config.settings.dust)return s;
 const delta=Math.min(5,s.config.settings.scienceMinutes-s.scienceSpent);
 if(delta<=0||assessCrew(t,s).scienceWindow+1e-8<delta)return s;
 return {...s,scienceSpent:s.scienceSpent+delta,elapsed:s.elapsed+delta,oxygenSpent:s.oxygenSpent+delta*.65,powerSpent:s.powerSpent+delta*.8};
}
export function holdCrew(t:Terrain,s:CrewState,hazard=false):CrewState{
 if(s.phase==='prepare'||s.phase==='complete')return s;
 const path=s.phase==='science'?s.returnTrack:s.track;
 const cursor=s.phase==='science'?0:s.cursor;
 const i=checkpointIndex(t,path,cursor,120),p=point(t,path[i]??path[cursor]);
 const exclusion=hazard?{...p,radius:35}:s.exclusion;
 const updated={...s,held:true,holdReason:hazard?'obstacle':'pause',exclusion};
 return addEvent(updated,hazard?'Route corridor blocked':'Movement paused',hazard?'Simulated 35 m obstacle exclusion added ahead. Stop, verify, then compare an alternative.':'Review position and crew readiness before resuming.',hazard?'warning':'caution');
}
export function useCandidate(s:CrewState,c:Candidate,returnOnly=false):CrewState{
 if(!c.feasible||s.config.settings.dust)return s;
 return addEvent({...s,phase:returnOnly?(c.track.length===1?'complete':'return'):s.phase,track:c.track,returnTrack:c.returnTrack,cursor:0,held:false,holdReason:'',revision:s.revision+1},returnOnly?'Return plan accepted':'Revised route accepted','Explicit crew confirmation recorded; movement remains a simulation.');
}
export function validSavedCrew(t:Terrain,value:unknown):value is CrewState{
 if(!value||typeof value!=='object')return false;
 const s=value as CrewState;
 try{t=withObstacles(t,s.config?.obstacles??[]);}catch{return false;}
 if(s.version!==1||s.terrainKey!==terrainKey(t)||!['prepare','outbound','science','return','complete'].includes(s.phase)||!s.config?.settings)return false;
 if(!['shortest','exposure','mission','time'].includes(s.config.mode)||typeof s.config.targetName!=='string'||typeof s.config.purpose!=='string'||typeof s.held!=='boolean'||typeof s.holdReason!=='string'||!Number.isInteger(s.revision)||s.revision<0)return false;
 if(![s.config.base,s.config.target].every(p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<t.width&&p.y<t.height))return false;
 if(s.scienceTasks!==undefined&&(!Array.isArray(s.scienceTasks)||s.scienceTasks.length!==3||!s.scienceTasks.every(x=>typeof x==='boolean')))return false;
 if(s.exclusion&&![s.exclusion.x,s.exclusion.y,s.exclusion.radius].every(n=>Number.isFinite(n)&&n>=0))return false;
 if(!Array.isArray(s.events)||!s.events.every(e=>Number.isInteger(e.id)&&Number.isFinite(e.minute)&&typeof e.title==='string'&&typeof e.detail==='string'&&['warning','caution','advisory'].includes(e.level)))return false;
 if(![s.elapsed,s.oxygenSpent,s.powerSpent,s.scienceSpent].every(n=>Number.isFinite(n)&&n>=0))return false;
 if(!(['maxSlope','speed','scienceMinutes','durationMinutes','oxygenMinutes','powerMinutes','reservePercent','loadKg','hazardWeight'] as const).every(k=>Number.isFinite(s.config.settings[k])))return false;
 if(s.config.settings.oxygenMinutes<=0||s.config.settings.powerMinutes<=0||s.config.settings.speed<=0)return false;
 for(const cells of [s.track,s.returnTrack,s.trail]){
  if(!Array.isArray(cells)||!cells.length||cells.length>100000||!cells.every(i=>Number.isInteger(i)&&i>=0&&i<t.width*t.height&&!blocked(t,i,s.config.settings,null)))return false;
  for(let n=1;n<cells.length;n++){const a=point(t,cells[n-1]),b=point(t,cells[n]);if(Math.abs(a.x-b.x)>1||Math.abs(a.y-b.y)>1)return false;}
 }
 return Number.isInteger(s.cursor)&&s.cursor>=0&&s.cursor<s.track.length&&s.trail.at(-1)===s.track[s.cursor]&&Array.isArray(s.events);
}
