import type {Exclusion,Point} from './planner';
/** Continuous centreline check; endpoints alone can miss a small circular closure. */
export function crossesExclusion(a:Point,b:Point,cellSize:number,e:Exclusion|null){
 if(!e)return false;
 const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,u=den?Math.max(0,Math.min(1,((e.x-a.x)*dx+(e.y-a.y)*dy)/den)):0;
 return Math.hypot(a.x+u*dx-e.x,a.y+u*dy-e.y)*cellSize<=e.radius;
}
export function exceedsGrade(a:number|null,b:number|null,horizontal:number,maxSlope:number){
 return a===null||b===null||!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(maxSlope)||horizontal<0||!Number.isFinite(horizontal)||(maxSlope<90&&Math.abs(b!-a!)>horizontal*Math.tan(maxSlope*Math.PI/180)+1e-8);
}
