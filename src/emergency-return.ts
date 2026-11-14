import {index,metrics} from './planner';
import type {Point,Route,Terrain} from './planner';
import type {MissionDraft} from './mission-state';
import {computeReturnMap} from './return-feasibility';
import {validDraft} from './mission-state';
import type {NativeDEM} from './eva-motion';
import {withObstacles} from './obstacles';
import {localizationValid} from './position-sensor';
import type {PositionFix} from './position-sensor';
import {assessRemaining,returnConnectors,validResourceUse} from './eva-resources';
import type {ResourceUse} from './eva-resources';
export type ReturnRequest={id:number;terrain:Terrain;native:NativeDEM|null;draft:MissionDraft;fix:PositionFix;use:ResourceUse};
export type EmergencyPlan={route:Route;origin:Point;base:Point;connector:Point;connectorMetres:number;connectorMinutes:number;inputKey:string;positionSequence:number;use:ResourceUse;explanation:string};
export type ReturnResult={plan:EmergencyPlan|null;reason:string;checkedConnectors:number;inboundCosts?:Float64Array};
export type ReturnReply={id:number;result:ReturnResult;elapsedMs:number}|{id:number;error:string};
export const returnInputKey=(d:MissionDraft)=>JSON.stringify({base:d.base,settings:d.settings,exclusion:d.exclusion,annotations:d.annotations});
export function emergencyReturn(request:ReturnRequest):ReturnResult{
 const {draft:d,fix,native,use}=request,t=withObstacles(request.terrain,d.annotations),origin=fix.point;
 const fail=(reason:string,checkedConnectors=0):ReturnResult=>({plan:null,reason,checkedConnectors});
 try{validDraft(t,d);}catch{return fail('Invalid mission assumptions.');}
 if(!validResourceUse(use)||use.unsupported)return fail('NO VERIFIED SAFE ROUTE: invalid resource accounting.');
 if(!localizationValid(fix))return fail('LOCALIZATION HOLD: a valid position within the declared uncertainty limit is required.');
 if(!native)return fail('Native DEM is required to verify the current-position connector.');
 const map=computeReturnMap(t,d.base,d.settings,d.exclusion),connectors=returnConnectors(t,origin,d.settings,d.exclusion,native);
 let best:EmergencyPlan|null=null,checked=connectors.length;
 for(const c of connectors){
  const connector=c.point,start=index(t,connector),base=index(t,d.base);
  if(!Number.isFinite(map.inbound[start]))continue;
  const cells=[start];let node=start;
  while(node!==base&&cells.length<=t.width*t.height){node=map.returnNext[node];if(node<0)break;cells.push(node);}
  if(node!==base)continue;
  const back={cells,cost:map.inbound[start]},connectorMinutes=c.minutes,connectorMetres=c.distance,connectorGain=c.gain;
  const m=metrics(t,back.cells,'time',{...d.settings,scienceMinutes:0},back.cost),travel=m.travelMinutes+connectorMinutes,remaining=assessRemaining(use,travel,d.settings);
  if(!remaining.feasible)continue;
  const route:Route={...m,effortMetres:undefined,distance:m.distance+connectorMetres,gain:m.gain+connectorGain,travelMinutes:travel,totalMinutes:travel,oxygenRemaining:remaining.oxygenAfter,powerRemaining:remaining.powerAfter,timeRemaining:remaining.timeMargin,reserve:remaining.reserve,feasible:true,reasons:[],cost:travel,outbound:back.cells,inbound:[index(t,d.base)]};
  if(!best||travel<best.route.travelMinutes)best={route,origin:{...origin},base:{...d.base},connector,connectorMetres,connectorMinutes,inputKey:returnInputKey(d),positionSequence:fix.sequence,use:{...use},explanation:'Direct return to habitat; science work omitted. Minimum modeled time among four checked native-DEM connectors and directed graph paths, after spent resources and original-capacity reserves. Not a continuous-space optimum or certified safety claim.'};
 }
 return best?{plan:best,reason:'',checkedConnectors:checked,inboundCosts:map.inbound}:fail('NO VERIFIED SAFE ROUTE under current position, exclusions and remaining time / O2 / power assumptions.',checked);
}
