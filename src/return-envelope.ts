import {edgeTravelMinutes} from './mobility';
import {travelLimit} from './constrained-planner';
import type {Route,Settings,Terrain} from './planner';
export type ReturnEnvelope={checked:number;unsupported:number;nominal:{cell:number;marginMinutes:number};slow:{cell:number;marginMinutes:number};factor:number};
/** Red Route's every-point walk-back audit, reimplemented for our directed costs,
 * original-capacity O2/power reserves and exact, unthinned route. Scenario, not prediction.
 * Inbound must be reverse-Dijkstra costs under the SAME terrain and settings.
 */
export function auditReturnEnvelope(t:Terrain,route:Route,s:Settings,inbound:ArrayLike<number>,factor=2):ReturnEnvelope{
 if(!Number.isFinite(factor)||factor<1)throw Error('Return slowdown must be at least one.');
 const result:ReturnEnvelope={checked:0,unsupported:0,nominal:{cell:-1,marginMinutes:Infinity},slow:{cell:-1,marginMinutes:Infinity},factor};let elapsed=0;
 for(let n=0;n<route.cells.length;n++){
  const cell=route.cells[n];if(n)elapsed+=edgeTravelMinutes(t,route.cells[n-1],cell,s);
  const back=inbound[cell];if(!Number.isFinite(elapsed)||!Number.isFinite(back)||back<0){result.unsupported++;continue;}
  const limit=travelLimit({...s,scienceMinutes:n>=route.outbound.length-1?s.scienceMinutes:0});result.checked++;
  for(const [name,multiplier] of [['nominal',1],['slow',factor]] as const){const marginMinutes=limit-elapsed-back*multiplier;if(marginMinutes<result[name].marginMinutes)result[name]={cell,marginMinutes};}
 }
 return result;
}
