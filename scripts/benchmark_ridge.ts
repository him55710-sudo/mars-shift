/** Reproducible legacy route check on the separately processed real ridge ROI. */
import {readFileSync,writeFileSync} from 'node:fs';
import {DEFAULTS,blocked,nearestAllowed,plan,point} from '../src/planner.ts';
import type {Terrain,Mode,Point,Route} from '../src/planner.ts';
const root=new URL('../public/data/ridge/',import.meta.url);
const t=JSON.parse(readFileSync(new URL('terrain.json',root),'utf8')) as Terrain;
const native=JSON.parse(readFileSync(new URL('jezero-native-dem.json',root),'utf8'));
const modes:Mode[]=['shortest','exposure','mission'];
const start=nearestAllowed(t,{x:32,y:168},DEFAULTS),target=nearestAllowed(t,{x:153,y:43},DEFAULTS);
const compact=(r:Route|null)=>r?Object.fromEntries(Object.entries(r).filter(([k])=>!['cells','outbound','inbound'].includes(k))):null;
const compare=(a:Point,b:Point)=>modes.map(mode=>({mode,route:compact(plan(t,a,b,mode,DEFAULTS,null))}));
const baseline=compare(start,target);
let recommended:{start:Point;target:Point;reason:string;routes:ReturnType<typeof compare>}|null=null;
if(baseline.some(r=>!r.route)){
  const allowed=t.valid.map((_,i)=>!blocked(t,i,DEFAULTS,null)),seen=new Set<number>();let largest:number[]=[];
  for(let seed=0;seed<allowed.length;seed++){
    if(!allowed[seed]||seen.has(seed))continue;
    const component=[seed];seen.add(seed);
    for(let n=0;n<component.length;n++){
      const i=component[n],p=point(t,i);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const x=p.x+dx,y=p.y+dy,j=y*t.width+x;
        if(x<0||y<0||x>=t.width||y>=t.height||!allowed[j]||seen.has(j))continue;
        if(dx&&dy&&(!allowed[p.y*t.width+x]||!allowed[y*t.width+p.x]))continue;
        seen.add(j);component.push(j);
      }
    }
    if(component.length>largest.length)largest=component;
  }
  if(largest.length){
    const nearest=(p:Point)=>largest.reduce((best,i)=>{const a=point(t,best),b=point(t,i);return Math.hypot(b.x-p.x,b.y-p.y)<Math.hypot(a.x-p.x,a.y-p.y)?i:best;},largest[0]);
    const a=point(t,nearest({x:32,y:168})),b=point(t,nearest({x:153,y:43}));
    recommended={start:a,target:b,reason:'Both points selected from the largest valid slope<=18 degree connected component, respecting diagonal corner constraints.',routes:compare(a,b)};
  }
}
const finite=(values:(number|null)[])=>values.filter((x):x is number=>x!==null&&Number.isFinite(x));
const slopes=finite(t.slope).sort((a,b)=>a-b),elevations=finite(t.elevation);
const result={createdAt:new Date().toISOString(),dataset:'ridge',center:t.center,bounds:t.bounds,settings:DEFAULTS,legacyStart:start,legacyTarget:target,allThreeLegacyPathsExist:baseline.every(r=>!!r.route),allThreeLegacyPathsResourceFeasible:baseline.every(r=>!!r.route?.feasible),baseline,recommended,terrain:{validCells:t.valid.filter(Boolean).length,planningReliefMetres:Math.max(...elevations)-Math.min(...elevations),nativeReliefMetres:native.statistics.max-native.statistics.min,meanCellMaximumSlopeDegrees:slopes.reduce((a,b)=>a+b,0)/slopes.length,p95CellMaximumSlopeDegrees:slopes[Math.floor((slopes.length-1)*.95)],maximumCellSlopeDegrees:slopes.at(-1),cellsOver25Degrees:slopes.filter(v=>v>25).length,exposureProxyCells:t.exposure.filter(v=>v!==null&&v>0).length,exposureProxyAreaSquareMetres:t.exposure.filter(v=>v!==null&&v>0).length*t.cellSize*t.cellSize},source:'CaltechDATA 10.22002/stqse-yay61 cenjez_DEM_1m.tif',disclosure:'Terrain selection is an observed higher-relief crop. Habitat and target coordinates are illustrative. Route feasibility is only under the existing simulated assumptions. Exposure is a cliff-proximity heuristic, not a rockfall probability.'};
writeFileSync(new URL('validation-results.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
