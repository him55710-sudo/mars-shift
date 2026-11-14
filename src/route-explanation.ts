import {point} from './planner';
import type {Mode,Point,Route,Terrain} from './planner';
export function explainRoute(route:Route|null,shortest:Route|null,mode:Mode){
 if(!route)return {title:'No feasible round trip',reason:'Change the destination, exclusions or mission assumptions, then calculate again.',facts:[] as string[]};
 const extra=shortest?route.distance-shortest.distance:0;
 const title=mode==='shortest'?'Minimize the distance':mode==='exposure'?'Reduce terrain-proxy cost':'Balance effort with a way home';
 const reason=mode==='shortest'?'The lowest distance cost among the searched budget-feasible alternatives.':mode==='exposure'?'The search penalizes slope, local relief and steep-slope proximity. These are terrain proxies, not a calibrated rockfall forecast.':'The search balances slope, ascent, local relief and exposure cost, then selects a complete round trip that meets the modeled budgets.';
 const facts=[`${route.maxSlope.toFixed(1)}° maximum mapped slope`,`${route.reserve.toFixed(1)}% modeled return reserve`,Math.abs(extra)<.1?'Same distance as the shortest feasible plan':`${extra>=0?'+':''}${extra.toFixed(0)} m versus shortest`,`${route.exposureDistance.toFixed(0)} m within steep-slope proximity proxy`];
 return {title,reason,facts};
}
export function routeGuidance(t:Terrain,cells:number[],crew:Point,lookahead=25){
 if(!cells.length)return null;let nearest=0,minimum=Infinity;cells.forEach((i,n)=>{const p=point(t,i),d=Math.hypot(p.x-crew.x,p.y-crew.y);if(d<minimum){minimum=d;nearest=n;}});let next=nearest,distance=0;while(next<cells.length-1&&distance<lookahead){const a=point(t,cells[next]),b=point(t,cells[next+1]);distance+=Math.hypot(a.x-b.x,a.y-b.y)*t.cellSize;next++;}const target=point(t,cells[next]),bearing=(Math.atan2(target.x-crew.x,crew.y-target.y)*180/Math.PI+360)%360;
 return {target,index:next,bearing,distance:Math.hypot(target.x-crew.x,target.y-crew.y)*t.cellSize,progress:nearest/Math.max(1,cells.length-1),offRoute:minimum*t.cellSize};
}
