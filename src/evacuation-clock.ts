import {sweptContactIntervals} from './dust-devil-geometry';
import type {CircleState} from './dust-devil-geometry';
import type {TimedPoint} from './hazard-planner';
import {measureEscapePath} from './escape-metrics';
import type {Point} from './planner';
/** Egress-inspired timing diagnostic, not fire tenability or a validated refuge.
 * A moving vortex is not monotone inundation: positive timing margin alone is
 * insufficient, so retain the full continuous path contact check. */
export function evacuationClock(path:TimedPoint[],prediction:(time:number)=>CircleState,position:Point,
  cell:number,now:number,horizon:number,detected:number,estimateReady:number,moveAllowed:number){
  const knots=Array.from({length:Math.ceil(horizon/.5)+1},(_,i)=>now+Math.min(horizon,i*.5));
  const p={x:position.x*cell,y:position.y*cell};let boundaryEntry:number|null=null;
  for(let k=1;k<knots.length;k++){
    const a=prediction(knots[k-1]),b=prediction(knots[k]),hit=sweptContactIntervals(p,p,a,b,knots[k]-knots[k-1])[0];
    if(hit){boundaryEntry=knots[k-1]+hit[0]-now;break;}
  }
  const exposure=measureEscapePath(path,prediction,cell,now,now+horizon,knots);
  let terminalIndex=path.length-1;
  while(terminalIndex>0&&Math.hypot(path[terminalIndex].x-path[terminalIndex-1].x,path[terminalIndex].y-path[terminalIndex-1].y)<1e-8)terminalIndex--;
  const arrival=path[terminalIndex]?.time??now;
  const allWait=terminalIndex===0,arrivalSeconds=allWait?null:Math.max(0,arrival-now);
  return {reference:'STATIONARY_PHYSICAL_RADIUS_PLUS_1M_FRONT' as const,boundaryEntrySeconds:boundaryEntry,
    routeTerminalArrivalSeconds:arrivalSeconds,arrivalMarginSeconds:boundaryEntry===null||arrivalSeconds===null?null:boundaryEntry-arrivalSeconds,
    predictedContactSeconds:exposure.exposureSeconds,predictedMinClearance:exposure.minClearance,
    detectionTime:detected,estimateReadyTime:estimateReady,movementAllowedTime:moveAllowed,
    reactionRemaining:Math.max(0,moveAllowed-now),horizonSeconds:horizon,
    status:exposure.exposureSeconds>1e-8?'CONTACT_PREDICTED':'NO_CONTACT_IN_HORIZON',
    terminalIsValidatedRefuge:false};
}
