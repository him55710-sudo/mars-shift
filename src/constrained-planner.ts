import {edgeTravelMinutes} from './mobility';
import {blocked,index,leg,metrics,point} from './planner';
import type {Exclusion,Mode,Point,Route,Settings,Terrain} from './planner';
export type SearchReport={route:Route|null;candidates:Route[];searched:number;feasibleCount:number;travelLimit:number;method:string;reason:string};
export const travelLimit=(s:Settings)=>Math.min(s.durationMinutes-s.scienceMinutes,(s.oxygenMinutes*(1-s.reservePercent/100)-s.scienceMinutes*.65)/(1+s.loadKg*.01),(s.powerMinutes*(1-s.reservePercent/100)-s.scienceMinutes*.8)/(1+s.loadKg*.005));
export function edgeValues(t:Terrain,a:number,b:number,mode:Mode,s:Settings){
 const p=point(t,a),q=point(t,b),horizontal=Math.hypot(p.x-q.x,p.y-q.y)*t.cellSize,dz=t.elevation[b]!-t.elevation[a]!,distance=Math.hypot(horizontal,dz),slope=((t.meanSlope[a]??0)+(t.meanSlope[b]??0))/2,exposure=((t.exposure[a]??0)+(t.exposure[b]??0))/2,unknown=t.thermal[b]===null?1:0;
 let factor=1;if(mode==='exposure')factor+=s.hazardWeight*exposure+slope*slope*.035+(t.roughness[b]??0)*.2+unknown*.2;if(mode==='mission')factor+=s.hazardWeight*.55*exposure+slope*slope*.012+Math.max(0,dz)/horizontal*2+(t.roughness[b]??0)*.08+unknown*.1;
 return {cost:distance*factor,effortCost:edgeTravelMinutes(t,a,b,s)*Math.max(.01,s.speed)*(s.dust?.55:1)*60};
}
class Heap{items:{i:number;f:number}[]=[];push(i:number,f:number){let n=this.items.length;this.items.push({i,f});while(n){const parent=(n-1)>>1;if(this.items[parent].f<=f)break;this.items[n]=this.items[parent];n=parent;}this.items[n]={i,f};}pop(){const first=this.items[0],last=this.items.pop()!;if(this.items.length){let n=0;while(n*2+1<this.items.length){let c=n*2+1;if(c+1<this.items.length&&this.items[c+1].f<this.items[c].f)c++;if(this.items[c].f>=last.f)break;this.items[n]=this.items[c];n=c;}this.items[n]=last;}return first;}}
function alternativeLeg(t:Terrain,start:Point,target:Point,mode:Mode,s:Settings,e:Exclusion|null,alpha:number){
 if([start,target].some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=t.width||p.y>=t.height))return null;
 const first=index(t,start),last=index(t,target);if(blocked(t,first,s,e)||blocked(t,last,s,e))return null;
 const n=t.width*t.height,g=new Float64Array(n).fill(Infinity),parent=new Int32Array(n).fill(-1),closed=new Uint8Array(n),heap=new Heap();g[first]=0;heap.push(first,0);
 while(heap.items.length){const {i}=heap.pop();if(closed[i])continue;if(i===last){const cells=[i];while(cells.at(-1)!==first)cells.push(parent[cells.at(-1)!]);return cells.reverse();}closed[i]=1;const p=point(t,i);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=t.width||y>=t.height)continue;const j=y*t.width+x;if(closed[j]||blocked(t,j,s,e)||dx&&dy&&(blocked(t,p.y*t.width+x,s,e)||blocked(t,y*t.width+p.x,s,e)))continue;const v=edgeValues(t,i,j,mode,s),score=g[i]+(1-alpha)*v.cost+alpha*v.effortCost;if(score<g[j]){g[j]=score;parent[j]=i;heap.push(j,score+Math.hypot(x-target.x,y-target.y)*t.cellSize);}}
 }return null;
}
const costOf=(t:Terrain,cells:number[],mode:Mode,s:Settings)=>cells.slice(1).reduce((cost,i,n)=>cost+edgeValues(t,cells[n],i,mode,s).cost,0);
/** Bounded objective alternatives, not a globally optimal multi-resource solver.
 * All three current budgets are monotone in modeled travel time. The alpha=1
 * candidate explicitly searches the fastest path under that effort model.
 * Do not prune scalar-label searches using resources: retain alternatives and
 * apply the hard resource limits to their complete round-trip combinations. */
export function constrainedPlan(t:Terrain,base:Point,target:Point,mode:Mode,s:Settings,e:Exclusion|null,returnBase:Point=base):SearchReport{
 const outbound:number[][]=[],inbound:number[][]=[];let searched=0;
 for(const alpha of [0,.25,.5,.75,1]){for(const [a,b,list] of [[base,target,outbound],[target,returnBase,inbound]] as const){searched++;const cells=alpha===0?leg(t,a,b,mode,s,e)?.cells:alternativeLeg(t,a,b,mode,s,e,alpha);if(cells&&!list.some(r=>r.join(',')===cells.join(',')))list.push(cells);}}
 const candidates:Route[]=[];
 for(const a of outbound)for(const b of inbound){const cells=[...a,...b.slice(1)],m=metrics(t,cells,mode,s,costOf(t,cells,mode,s));candidates.push({...m,outbound:a,inbound:b});}
 const feasible=candidates.filter(r=>r.feasible).sort((a,b)=>a.cost-b.cost||a.totalMinutes-b.totalMinutes),route=feasible[0]??null;
 return {route,candidates,searched,feasibleCount:feasible.length,travelLimit:travelLimit(s),method:'5 objective weights per leg; distinct outbound/return pairs; hard budget filter; lowest selected-mode terrain cost among feasible candidates',reason:route?'':!candidates.length?'No traversable round trip under terrain, exclusion and obstacle constraints.':s.dust?'HOLD: reduced visibility requires local verification.':'NO FEASIBLE ROUTE among the searched alternatives under the configured time, oxygen and power limits.'};
}
