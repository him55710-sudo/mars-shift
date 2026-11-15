import {index} from './planner';
import type {Point} from './planner';
import {connectorSeconds,staticSegmentSafe,resourceSafe,positionOnPath} from './hazard-planner';
import type {HazardContext,ResourceState,TimedPoint} from './hazard-planner';
/** Continuous position to a reachable graph node, then the SAME static inbound map.
 * Min over adjacent nodes avoids artificial return-cost jumps at rounding boundaries. */
export function localReturnSeconds(c:HazardContext,p:Point):number {
 let best=Infinity;const t=c.terrain;
 for(const x of [Math.floor(p.x),Math.ceil(p.x)])for(const y of [Math.floor(p.y),Math.ceil(p.y)]){
  const q={x,y};if(x<0||y<0||x>=t.width||y>=t.height||!staticSegmentSafe(t,c.settings,p,q))continue;
  best=Math.min(best,connectorSeconds(c,p,q)+c.returnSeconds[index(t,q)]);
 }return best;
}
export function localCommitSafe(c:HazardContext,path:TimedPoint[],now:number,r:ResourceState,seconds=2){
 for(let dt=0;dt<=seconds+1e-8;dt+=.25){if(!resourceSafe(r,dt,localReturnSeconds(c,positionOnPath(path,now+dt)),c.settings.loadKg))return false;}return true;
}
