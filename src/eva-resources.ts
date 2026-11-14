import type {Point,Settings,Terrain} from './planner';
import {MOBILITY,hasMobilityData} from './mobility';
import {heightAt,attemptMove} from './eva-motion';
import {blocked,index} from './planner';
import type {Exclusion} from './planner';
import type {NativeDEM} from './eva-motion';
export type ResourceUse={elapsedMinutes:number;oxygenMinutes:number;powerMinutes:number;distanceMetres:number;unsupported:boolean};
export const initialResources=():ResourceUse=>({elapsedMinutes:0,oxygenMinutes:0,powerMinutes:0,distanceMetres:0,unsupported:false});
export const validResourceUse=(u:ResourceUse)=>!!u&&typeof u.unsupported==='boolean'&&[u.elapsedMinutes,u.oxygenMinutes,u.powerMinutes,u.distanceMetres].every(v=>Number.isFinite(v)&&v>=0);
/** Same declared directional mobility factors, evaluated along accepted DEM motion. */
export function segmentTravel(t:Terrain,a:Point,b:Point,s:Settings,native:NativeDEM|null){
 const horizontal=Math.hypot(b.x-a.x,b.y-a.y)*t.cellSize;if(horizontal<1e-10)return {minutes:0,distance:0,gain:0};
 const ai=Math.round(a.y)*t.width+Math.round(a.x),bi=Math.round(b.y)*t.width+Math.round(b.x),za=heightAt(t,a,native),zb=heightAt(t,b,native);
 if(za===null||zb===null||!hasMobilityData(t,ai,s)||!hasMobilityData(t,bi,s))return {minutes:Infinity,distance:Infinity,gain:0};
 const dz=zb-za,up=Math.max(0,dz/horizontal),down=Math.max(0,-dz/horizontal),distance=Math.hypot(horizontal,dz),slope=((t.meanSlope[ai]??0)+(t.meanSlope[bi]??0))/2;
 const factor=s.mobilityModel===2?1+MOBILITY.uphill*up+MOBILITY.downhill*down+(s.terrainEffort??MOBILITY.defaultTerrainEffort)*(t.science!.fields.tri[ai]!+t.science!.fields.tri[bi]!)/2+MOBILITY.payloadPerKg*s.loadKg:1+slope*slope*.012+s.loadKg*.015+up*2;
 return {minutes:distance*factor/(Math.max(.01,s.speed)*(s.dust?.55:1)*60),distance,gain:Math.max(0,dz)};
}
export function spendTravel(use:ResourceUse,minutes:number,distance:number,s:Settings):ResourceUse{
 if(!Number.isFinite(minutes)||minutes<0||!Number.isFinite(distance)||distance<0)return {...use,unsupported:true};
 return {...use,elapsedMinutes:use.elapsedMinutes+minutes,oxygenMinutes:use.oxygenMinutes+minutes*(1+s.loadKg*.01),powerMinutes:use.powerMinutes+minutes*(1+s.loadKg*.005),distanceMetres:use.distanceMetres+distance};
}
export function recordTraversal(t:Terrain,points:Point[],s:Settings,native:NativeDEM|null,use:ResourceUse){
 let result=use;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*t.cellSize/.5));if(!Number.isFinite(count))return {...result,unsupported:true};for(let k=1;k<=count;k++){const p={x:a.x+(b.x-a.x)*(k-1)/count,y:a.y+(b.y-a.y)*(k-1)/count},q={x:a.x+(b.x-a.x)*k/count,y:a.y+(b.y-a.y)*k/count},v=segmentTravel(t,p,q,s,native);result=spendTravel(result,v.minutes,v.distance,s);}}return result;
}
export function spendWork(use:ResourceUse,minutes:number):ResourceUse{
 if(!Number.isFinite(minutes)||minutes<0)return {...use,unsupported:true};
 return {...use,elapsedMinutes:use.elapsedMinutes+minutes,oxygenMinutes:use.oxygenMinutes+minutes*.65,powerMinutes:use.powerMinutes+minutes*.8};
}
export function assessRemaining(use:ResourceUse,travelMinutes:number,s:Settings){
 const oxygenNow=100*(1-use.oxygenMinutes/s.oxygenMinutes),powerNow=100*(1-use.powerMinutes/s.powerMinutes);
 const oxygenAfter=oxygenNow-100*travelMinutes*(1+s.loadKg*.01)/s.oxygenMinutes,powerAfter=powerNow-100*travelMinutes*(1+s.loadKg*.005)/s.powerMinutes,timeMargin=s.durationMinutes-use.elapsedMinutes-travelMinutes,reserve=Math.min(oxygenAfter,powerAfter);
 const reasons:string[]=[];
 if(!validResourceUse(use)||use.unsupported||!Number.isFinite(travelMinutes)||travelMinutes<0||![oxygenNow,powerNow,oxygenAfter,powerAfter,timeMargin,reserve].every(Number.isFinite))reasons.push('Return travel or resource accounting is unsupported.');
 if(timeMargin < -1e-9)reasons.push('Return exceeds remaining modeled time.');
 if(reserve+1e-9<s.reservePercent)reasons.push('Return would consume the required original-capacity O2 / power reserve.');
 if(s.dust)reasons.push('Reduced visibility: hold and verify the local situation.');
 return {oxygenNow,powerNow,oxygenAfter,powerAfter,reserve,timeMargin,travelMinutes,feasible:reasons.length===0,reasons};
}
/** A continuous position may only join one of its enclosing graph centres.
 * Sweep the connector against native DEM / constraints, then sample at <=0.5 m.
 * Coarse graph travel remains a declared estimate, not native-resolution routing. */
export function returnConnectors(t:Terrain,origin:Point,s:Settings,e:Exclusion|null,native:NativeDEM|null){
 const found:{point:Point;minutes:number;distance:number;gain:number}[]=[];
 if(!native||![origin.x,origin.y].every(Number.isFinite)||origin.x<0||origin.y<0||origin.x>t.width-1||origin.y>t.height-1||blocked(t,index(t,{x:Math.round(origin.x),y:Math.round(origin.y)}),s,e))return found;
 for(const x of new Set([Math.floor(origin.x),Math.ceil(origin.x)]))for(const y of new Set([Math.floor(origin.y),Math.ceil(origin.y)])){
  const p={x,y};if(blocked(t,index(t,p),s,e))continue;
  const dx=(x-origin.x)*t.cellSize,dy=(y-origin.y)*t.cellSize,sweep=attemptMove(t,origin,dx,dy,s,e,native);if(sweep.blocked)continue;
  const count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.5));let minutes=0,distance=0,gain=0;
  for(let k=1;k<=count;k++){const a={x:origin.x+(x-origin.x)*(k-1)/count,y:origin.y+(y-origin.y)*(k-1)/count},b={x:origin.x+(x-origin.x)*k/count,y:origin.y+(y-origin.y)*k/count},v=segmentTravel(t,a,b,s,native);minutes+=v.minutes;distance+=v.distance;gain+=v.gain;}
  if(Number.isFinite(minutes))found.push({point:p,minutes,distance,gain});
 }return found;
}
export function returnEstimate(t:Terrain,p:Point,s:Settings,e:Exclusion|null,native:NativeDEM|null,inbound:ArrayLike<number>|null){
 if(!inbound)return Infinity;
 return returnConnectors(t,p,s,e,native).reduce((best,c)=>Math.min(best,c.minutes+(inbound[index(t,c.point)]??Infinity)),Infinity);
}
