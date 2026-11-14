import type {Terrain} from './planner';
import {noahEvidence} from './noah-data';
import {blocked,index,point} from './planner';
import type {Settings,Point} from './planner';
import {graphNeighbours,MinHeap} from './return-feasibility';
export type SandRisk={index:number;support:number;thermalMetres:100;classificationMetres:.25;planningMetres:number;kind:'HEURISTIC_CANDIDATE';missing:string[]};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Declared screening rule, NOT a calibrated probability of astronaut sinkage or rover slip.
 * Thermal inertia normalization 150–450 SI and weights are engineering assumptions. */
export function sandRisk(t:Terrain,i:number):SandRisk {
 const noah=noahEvidence(t.noah,i),thermal=t.thermal[i],slope=t.slope[i],rough=t.roughness[i],missing:string[]=[];
 if(thermal===null||!Number.isFinite(thermal))missing.push('THEMIS');if(noah.coverage<.95)missing.push('NOAH-H coverage/registration');if(slope===null||rough===null)missing.push('DEM derivatives');
 const lowTI=thermal===null||!Number.isFinite(thermal)?.5:clamp((450-thermal)/300),ripples=noah.rippleAreaFraction??.5;
 return {index:clamp(.45*lowTI+.35*ripples+.1*clamp((slope??18)/18)+.1*clamp((rough??1)/1)),support:((thermal!==null&&Number.isFinite(thermal)?1:0)+noah.coverage+(slope!==null&&rough!==null?1:0))/3,thermalMetres:100,classificationMetres:.25,planningMetres:t.cellSize,kind:'HEURISTIC_CANDIDATE',missing};
}
export function sandRiskMap(t:Terrain){const risk=new Float32Array(t.width*t.height),support=new Float32Array(risk.length);for(let i=0;i<risk.length;i++){const r=sandRisk(t,i);risk[i]=r.index;support[i]=r.support;}return {risk,support};}
/** Static ablation: same graph/hard slope constraints, adds only the declared ground index. */
export function sandAwareLeg(t:Terrain,start:Point,target:Point,s:Settings,weight=1.5){
 const first=index(t,start),last=index(t,target),n=t.width*t.height,risk=sandRiskMap(t).risk,g=new Float64Array(n).fill(Infinity),parent=new Int32Array(n).fill(-1),heap=new MinHeap();if(blocked(t,first,s,null)||blocked(t,last,s,null))return null;g[first]=0;heap.push(first,0);
 while(heap.length){const item=heap.pop(),i=item.i;if(item.cost!==g[i])continue;if(i===last){const cells=[i];while(cells.at(-1)!==first)cells.push(parent[cells.at(-1)!]);return cells.reverse();}
  graphNeighbours(t,i,s,null,j=>{const a=point(t,i),b=point(t,j),distance=Math.hypot((a.x-b.x)*t.cellSize,(a.y-b.y)*t.cellSize,t.elevation[i]!-t.elevation[j]!),cost=g[i]+distance*(1+weight*(risk[i]+risk[j])/2);if(cost<g[j]){g[j]=cost;parent[j]=i;heap.push(j,cost);}});
 }return null;
}
