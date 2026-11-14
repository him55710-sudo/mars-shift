import type {Settings,Terrain} from './planner';
/** Declared engineering proxy, not metabolic energy, battery Wh or Mars physiology. */
export const ENERGY_MODEL={version:'effort-distance-v1',units:'effort-m',uphillGradeSquared:6,downhillGradeSquared:2,payloadPerKg:.015,complexityPerMetre:.8};
export function edgeEffortMetres(t:Terrain,a:number,b:number,s:Settings):number{
 const horizontal=Math.hypot(a%t.width-b%t.width,Math.floor(a/t.width)-Math.floor(b/t.width))*t.cellSize;
 if(!horizontal)return 0;
 const za=t.elevation[a],zb=t.elevation[b];if(za===null||zb===null||!Number.isFinite(za)||!Number.isFinite(zb))return Infinity;
 const grade=(zb-za)/horizontal,up=Math.max(0,grade),down=Math.max(0,-grade);
 const complexity=s.mobilityModel===2?((t.science?.fields.tri[a]??NaN)+(t.science?.fields.tri[b]??NaN))/2:((t.roughness[a]??NaN)+(t.roughness[b]??NaN))/2;
 if(!Number.isFinite(complexity)||complexity<0)return Infinity;
 return Math.hypot(horizontal,zb-za)*(1+ENERGY_MODEL.payloadPerKg*s.loadKg+ENERGY_MODEL.uphillGradeSquared*up*up+ENERGY_MODEL.downhillGradeSquared*down*down+ENERGY_MODEL.complexityPerMetre*complexity);
}
