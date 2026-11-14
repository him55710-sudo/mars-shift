import {blocked,index} from './planner';
import type {Exclusion,Point,Route,Settings,Terrain} from './planner';
import {budgetForTravel,edgeTravelMinutes,expandedMobility,hasMobilityData} from './mobility';

export const MAP_UNKNOWN=0,MAP_OVER_BUDGET=1,MAP_FEASIBLE=2,MAP_BLOCKED=3,MAP_DISCONNECTED=4;
export type ReturnMap={localSecondsPerMetre:Float64Array;outbound:Float64Array;inbound:Float64Array;total:Float64Array;reserve:Float64Array;margin:Float64Array;state:Uint8Array;outParent:Int32Array;returnNext:Int32Array;counts:{unknown:number;overBudget:number;feasible:number;blocked:number;disconnected:number};baseValid:boolean;travelLimitMinutes:number;method:string};
export class MinHeap {
 private data:{i:number;cost:number}[]=[];
 get length(){return this.data.length;}
 push(i:number,cost:number){let n=this.data.length;this.data.push({i,cost});while(n){const p=(n-1)>>1;if(this.data[p].cost<=cost)break;this.data[n]=this.data[p];n=p;}this.data[n]={i,cost};}
 pop(){const first=this.data[0],last=this.data.pop()!;if(this.data.length){let n=0;while(n*2+1<this.data.length){let c=n*2+1;if(c+1<this.data.length&&this.data[c+1].cost<this.data[c].cost)c++;if(this.data[c].cost>=last.cost)break;this.data[n]=this.data[c];n=c;}this.data[n]=last;}return first;}
}
/** Shared adjacency: full-cell constraints, no diagonal corner cutting, directional time. */
export function graphNeighbours(t:Terrain,i:number,s:Settings,e:Exclusion|null,visit:(j:number)=>void){
 const x=i%t.width,y=Math.floor(i/t.width);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=t.width||yy>=t.height)continue;
  const j=yy*t.width+xx;if(blocked(t,j,s,e)||dx&&dy&&(blocked(t,y*t.width+xx,s,e)||blocked(t,yy*t.width+x,s,e)))continue;
  visit(j);
 }
}
function timeMap(t:Terrain,base:number,s:Settings,e:Exclusion|null,reverse:boolean){
 const n=t.width*t.height,distance=new Float64Array(n).fill(Infinity),parent=new Int32Array(n).fill(-1),heap=new MinHeap();
 if(blocked(t,base,s,e))return {distance,parent};distance[base]=0;heap.push(base,0);
 while(heap.length){const current=heap.pop();if(current.cost!==distance[current.i])continue;
  graphNeighbours(t,current.i,s,e,j=>{
   // Reverse graph traverses incoming original edges. Do not copy outbound costs.
   const step=reverse?edgeTravelMinutes(t,j,current.i,s):edgeTravelMinutes(t,current.i,j,s),cost=current.cost+step;
   if(cost<distance[j]){distance[j]=cost;parent[j]=current.i;heap.push(j,cost);}
  });
 }
 return {distance,parent};
}
export function computeReturnMap(t:Terrain,base:Point,s:Settings,e:Exclusion|null):ReturnMap {
 const n=t.width*t.height,inside=Number.isInteger(base.x)&&Number.isInteger(base.y)&&base.x>=0&&base.y>=0&&base.x<t.width&&base.y<t.height,b=inside?index(t,base):-1;
 const localSecondsPerMetre=new Float64Array(n).fill(NaN);
 const out=timeMap(t,b,s,e,false),back=timeMap(t,b,s,e,true),state=new Uint8Array(n),total=new Float64Array(n).fill(NaN),reserve=new Float64Array(n).fill(NaN),margin=new Float64Array(n).fill(NaN),counts={unknown:0,overBudget:0,feasible:0,blocked:0,disconnected:0};
 for(let i=0;i<n;i++){
  if(!t.valid[i]||t.elevation[i]===null||t.slope[i]===null||!Number.isFinite(t.elevation[i])||!Number.isFinite(t.slope[i])||!hasMobilityData(t,i,s)){counts.unknown++;continue;}
  if(blocked(t,i,s,e)){state[i]=MAP_BLOCKED;counts.blocked++;continue;}
  let sum=0,edges=0;graphNeighbours(t,i,s,e,j=>{const h=Math.hypot(j%t.width-i%t.width,Math.floor(j/t.width)-Math.floor(i/t.width))*t.cellSize,d=Math.hypot(h,t.elevation[j]!-t.elevation[i]!);sum+=edgeTravelMinutes(t,i,j,s)*60/d;edges++;});if(edges)localSecondsPerMetre[i]=sum/edges;
  if(!Number.isFinite(out.distance[i])||!Number.isFinite(back.distance[i])){state[i]=MAP_DISCONNECTED;counts.disconnected++;continue;}
  const budget=budgetForTravel(out.distance[i]+back.distance[i],s);total[i]=budget.totalMinutes;reserve[i]=budget.reserve;margin[i]=budget.reserve-s.reservePercent;
  state[i]=budget.feasible?MAP_FEASIBLE:MAP_OVER_BUDGET;if(budget.feasible)counts.feasible++;else counts.overBudget++;
 }
 const travelLimitMinutes=Math.min(s.durationMinutes-s.scienceMinutes,(s.oxygenMinutes*(1-s.reservePercent/100)-s.scienceMinutes*.65)/(1+s.loadKg*.01),(s.powerMinutes*(1-s.reservePercent/100)-s.scienceMinutes*.8)/(1+s.loadKg*.005));
 return {localSecondsPerMetre,outbound:out.distance,inbound:back.distance,total,reserve,margin,state,outParent:out.parent,returnNext:back.parent,counts,baseValid:inside&&!blocked(t,b,s,e),travelLimitMinutes,method:'Forward and reverse Dijkstra on the same directed 8-neighbour static graph. Exact minimum time under declared edge costs; resource feasibility follows only because all budgets are monotone in total travel time. Crop-restricted; not certified safety.'};
}
export function fastestRoundTrip(t:Terrain,m:ReturnMap,base:Point,target:Point){
 const b=index(t,base),last=index(t,target);if(!Number.isFinite(m.outbound[last])||!Number.isFinite(m.inbound[last]))return null;
 const outbound=[last],inbound=[last];for(let n=0;outbound.at(-1)!==b&&n<t.width*t.height;n++){const p=m.outParent[outbound.at(-1)!];if(p<0)return null;outbound.push(p);}for(let n=0;inbound.at(-1)!==b&&n<t.width*t.height;n++){const p=m.returnNext[inbound.at(-1)!];if(p<0)return null;inbound.push(p);}return {outbound:outbound.reverse(),inbound};
}
export type SensitivityConfig={seed:number;runs:number;speedMin:number;speedMax:number;scienceDelta:number;effortMin:number;effortMax:number;blockFrequency:number};
export const SENSITIVITY_DEFAULTS:SensitivityConfig={seed:20261114,runs:200,speedMin:.8,speedMax:1.2,scienceDelta:5,effortMin:.75,effortMax:1.25,blockFrequency:.1};
export type SensitivityResult={config:SensitivityConfig;passed:number;frequency:number;travel:{p05:number;p50:number;p95:number};reserveMargin:{p05:number;p50:number;p95:number};failures:Record<string,number>;meaning:string};
function random(seed:number){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let x=a;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return ((x^x>>>14)>>>0)/4294967296;};}
const quantiles=(a:number[])=>{const b=[...a].sort((x,y)=>x-y),q=(f:number)=>{const p=(b.length-1)*f,i=Math.floor(p);return b[i]+(b[Math.ceil(p)]-b[i])*(p-i);};return {p05:q(.05),p50:q(.5),p95:q(.95)};};
export function routeSensitivity(t:Terrain,route:Route,s:Settings,e:Exclusion|null,config:SensitivityConfig=SENSITIVITY_DEFAULTS):SensitivityResult {
 if(Object.values(config).some(v=>!Number.isFinite(v))||!Number.isInteger(config.seed)||config.seed<0||config.seed>4294967295||!Number.isInteger(config.runs)||config.runs<1||config.runs>2000||config.speedMin<=0||config.speedMax<config.speedMin||config.effortMin<0||config.effortMax<config.effortMin||config.scienceDelta<0||config.blockFrequency<0||config.blockFrequency>1)throw Error('Invalid sensitivity assumptions.');
 const rng=random(config.seed),uniform=(a:number,b:number)=>a+(b-a)*rng(),times:number[]=[],margins:number[]=[],failures={time:0,reserve:0,blocked:0,unknown:0,visibility:0};let passed=0;
 for(let run=0;run<config.runs;run++){
  const scenario={...s,speed:s.speed*uniform(config.speedMin,config.speedMax),scienceMinutes:Math.max(0,s.scienceMinutes+uniform(-config.scienceDelta,config.scienceDelta)),terrainEffort:(s.terrainEffort??.3)*uniform(config.effortMin,config.effortMax)};
  // A synthetic closure deliberately intersects a non-base route cell. Frequency is an input, not an estimated hazard probability.
  const closureDraw=rng(),eligible=route.cells.filter(i=>i!==route.cells[0]);
  const closureCell=closureDraw<config.blockFrequency&&eligible.length?eligible[Math.min(eligible.length-1,Math.floor(closureDraw/config.blockFrequency*eligible.length))]:null;
  const closure=closureCell!==null;
  let minutes=0,invalid=false,unknown=false;for(let n=1;n<route.cells.length;n++){const a=route.cells[n-1],b=route.cells[n];invalid ||= blocked(t,a,scenario,e)||blocked(t,b,scenario,e);const dt=edgeTravelMinutes(t,a,b,scenario);if(!Number.isFinite(dt))unknown=true;else minutes+=dt;}
  const budget=budgetForTravel(minutes,scenario);times.push(minutes);margins.push(budget.reserve-s.reservePercent);if(budget.timeRemaining<0)failures.time++;if(budget.reserve<s.reservePercent)failures.reserve++;if(closure||invalid)failures.blocked++;if(unknown)failures.unknown++;if(s.dust)failures.visibility++;if(budget.feasible&&!closure&&!invalid&&!unknown)passed++;
 }
 return {config:{...config},passed,frequency:passed/config.runs,travel:quantiles(times),reserveMargin:quantiles(margins),failures,meaning:'Seeded uniform sensitivity of the fixed selected route, without replanning. Failure counts can overlap. Synthetic route-closure frequency is an imposed assumption. These frequencies are not accident, survival or real-world reliability probabilities.'};
}
export function gridComparison(t:Terrain,base:Point,s:Settings,e:Exclusion|null){
 const expanded=computeReturnMap(t,base,{...s,mobilityModel:2},e),legacy=computeReturnMap(t,base,{...s,mobilityModel:1},e);let gained=0,lost=0,commonKnown=0;
 for(let i=0;i<expanded.state.length;i++)if(expanded.state[i]!==MAP_UNKNOWN&&legacy.state[i]!==MAP_UNKNOWN){commonKnown++;if(expanded.state[i]===MAP_FEASIBLE&&legacy.state[i]!==MAP_FEASIBLE)gained++;if(legacy.state[i]===MAP_FEASIBLE&&expanded.state[i]!==MAP_FEASIBLE)lost++;}
 return {expanded,legacy,commonKnown,gained,lost};
}
export const mobilityLabel=(s:Settings)=>expandedMobility(s)?'Directional geometry + native TRI':'Legacy slope effort';
