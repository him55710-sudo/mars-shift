import {planEvacuationV13} from './evacuation-runtime-v13';
import {abruptPrediction} from './encounter-v8';
import type {AbruptSession} from './encounter-v8';
import {measureEscapePath} from './escape-metrics';
import type {EncounterDecision} from './encounter-v7';
type Predict=NonNullable<ReturnType<typeof abruptPrediction>>;
/** Pareto guard on BOTH model predictions, not a guarantee on the unknown truth.
 * Candidate and incumbent share DEM, timing, resource checks and path bank.
 * No thresholds are fitted to the earlier failed escape cases.
 */
export function planGuardedEscape(s:AbruptSession,adaptive:Predict|null){
 const began=performance.now(),legacy=abruptPrediction(s),incumbent=planEvacuationV13(s,'MARS SHIFT',legacy);
 if(!legacy||!adaptive||incumbent.action==='NO FEASIBLE ROUTE')return {decision:incumbent,predict:legacy,selected:'LEGACY' as const,compared:false};
 const candidate=planEvacuationV13(s,'MARS SHIFT',adaptive);
 if(candidate.action==='NO FEASIBLE ROUTE')return {decision:incumbent,predict:legacy,selected:'LEGACY' as const,compared:false};
 const H=incumbent.path.at(-1)!.time-s.time,knots=Array.from({length:Math.round(H/s.g.tick)+1},(_,i)=>s.time+i*s.g.tick);
 const risks=(d:EncounterDecision)=>[legacy,adaptive].flatMap(predict=>[false,true].map(band=>measureEscapePath(d.path,time=>{const p=predict(time);return {...p,radius:p.radius+(band?Math.hypot(p.sigma,p.radiusSigma):0)};},s.g.terrain.cellSize,s.time,s.time+H,knots).exposureSeconds));
 const a=risks(incumbent),b=risks(candidate);
 const improves=b.every((v,i)=>v<=a[i]+1e-8)&&b.some((v,i)=>v<a[i]-1e-8);
 const chosen=improves?candidate:incumbent;
 return {decision:{...chosen,latencyMs:performance.now()-began,reason:chosen.reason+(improves?' · dual-model risk improvement':' · legacy retained by dual-model guard')},predict:improves?adaptive:legacy,selected:improves?'ADAPTIVE' as const:'LEGACY' as const,compared:true,risks:{legacy:a,adaptive:b}};
}
