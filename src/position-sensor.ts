import type {Point} from './planner';
export type Localization='valid'|'degraded'|'lost';
export type PositionFix={point:Point;status:Localization;errorMetres:number|null;sequence:number;source:'SIMULATED'};
export interface PositionSensor {read():PositionFix;subscribe(listener:(fix:PositionFix)=>void):()=>void;}
export const POSITION_POLICY={maxErrorMetres:2.5,meaning:'Declared rehearsal threshold, not validated Mars localization accuracy'};
export const simulatedFix=(point:Point,status:Localization='valid',sequence=0):PositionFix=>({point:{...point},status,errorMetres:status==='valid'?.5:status==='degraded'?15:null,sequence,source:'SIMULATED'});
export function localizationValid(fix:PositionFix,maxErrorMetres=POSITION_POLICY.maxErrorMetres){
 return fix.status==='valid'&&Number.isFinite(fix.point.x)&&Number.isFinite(fix.point.y)&&fix.errorMetres!==null&&Number.isFinite(fix.errorMetres)&&fix.errorMetres>=0&&fix.errorMetres<=maxErrorMetres;
}
