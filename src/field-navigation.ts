import {blocked,edgeBlocked,index,metrics,point} from './planner';
import type {Point,Route,Settings,Terrain} from './planner';
import {MinHeap} from './return-feasibility';
import {noahEvidence} from './noah-data';

export type FieldPolicy='balanced'|'shortest'|'cautious';
export type FieldKind='sand'|'trap'|'rock';
export type FieldZone={id:string;kind:FieldKind;source:'derived'|'reviewed'|'simulated';point:Point;radius:number;area:number;index:number;cells:number[];label:string;detail:string};
export type FieldAssessment={width:number;height:number;cellSize:number;bounds:number[];crs:string;risk:Float32Array;support:Float32Array;ripples:Float32Array;depression:Float32Array;sand:Uint8Array;trap:Uint8Array;rocks:Uint8Array;zones:FieldZone[];knownCells:number;sandCells:number;trapCells:number;rockCells:number;method:string};
export type FieldRoute={policy:FieldPolicy;route:Route;riskMetres:number;trapMetres:number;unknownMetres:number;meanIndex:number;expanded:number};
export type FieldResult={revision:number;plans:Partial<Record<FieldPolicy,FieldRoute|null>>;elapsedMs:number;start:Point;target:Point};
export const FIELD_COLORS={route:'#8debd4',baseline:'#aebcc8',sand:'#edb85d',trap:'#ec864a',rock:'#e87879',unknown:'#8092a4',dem:'#81bdcf'};
const clip=(v:number)=>Math.max(0,Math.min(1,v));

/** Screening evidence in this exact orbital grid, never a slip/sinkage probability. */
export function assessField(t:Terrain):FieldAssessment{
 const n=t.width*t.height,risk=new Float32Array(n),support=new Float32Array(n),ripples=new Float32Array(n),depression=new Float32Array(n),sand=new Uint8Array(n),trap=new Uint8Array(n),rocks=new Uint8Array(n);
 let knownCells=0;
 for(let i=0;i<n;i++){
  if(!t.valid[i]||t.elevation[i]===null)continue;
  const e=noahEvidence(t.noah,i),cov=e.coverage,ti=t.thermal[i],f=t.science?.fields;
  const texture=cov>=.95&&e.rippleAreaFraction!==null,thermal=ti!==null&&Number.isFinite(ti),geometry=!!f&&f.tpi11[i]!==null&&f.tpi51[i]!==null&&f.support11[i]===1&&f.support51[i]===1;
  ripples[i]=e.rippleAreaFraction===null?0:clip(e.rippleAreaFraction/Math.max(.01,cov));
  depression[i]=geometry?Math.max(clip(-f!.tpi11[i]!/.75),.6*clip(-f!.tpi51[i]!/2)):0;
  support[i]=((texture?1:0)+(thermal?1:0)+(geometry?1:0))/3;
  // Normalization and weights are declared engineering assumptions.
  const lowTI=thermal?clip((450-ti!)/300):0;
  risk[i]=texture?clip(.55*ripples[i]+.20*lowTI+.25*depression[i]):0;
  sand[i]=texture&&ripples[i]>=.25?1:0;
  trap[i]=sand[i]&&geometry&&depression[i]>=.25?1:0;
  rocks[i]=cov>=.95&&(e.boulderFieldAreaFraction??0)/Math.max(.01,cov)>=.35?1:0;
  if(texture&&thermal&&geometry)knownCells++;
 }
 const zones:FieldZone[]=[];
 for(const [kind,mask] of [['trap',trap],['sand',sand],['rock',rocks]] as const){
  const seen=new Uint8Array(n);let counter=0;
  for(let first=0;first<n;first++){
   if(!mask[first]||seen[first])continue;const cells=[first];seen[first]=1;
   for(let k=0;k<cells.length;k++){const i=cells[k],x=i%t.width,y=Math.floor(i/t.width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*t.width+xx;if(xx<0||yy<0||xx>=t.width||yy>=t.height||seen[j]||!mask[j])continue;seen[j]=1;cells.push(j);}}
   if(cells.length<(kind==='trap'?1:4))continue;
   const cx=cells.reduce((s,i)=>s+i%t.width,0)/cells.length,cy=cells.reduce((s,i)=>s+Math.floor(i/t.width),0)/cells.length;
   const centre=cells.reduce((best,i)=>Math.hypot(i%t.width-cx,Math.floor(i/t.width)-cy)<Math.hypot(best%t.width-cx,Math.floor(best/t.width)-cy)?i:best,cells[0]),p=point(t,centre);
   const radius=cells.reduce((r,i)=>Math.max(r,Math.hypot(i%t.width-p.x,Math.floor(i/t.width)-p.y)*t.cellSize+t.cellSize*Math.SQRT2/2),t.cellSize);
   const mean=cells.reduce((s,i)=>s+risk[i],0)/cells.length;
   zones.push({id:`${kind}-${++counter}`,kind,source:'derived',point:p,radius,area:cells.length*t.cellSize**2,index:mean,cells,label:kind==='trap'?'Depressed ripple candidate':kind==='sand'?'Ripple / sand candidate':'Boulder-field texture',detail:kind==='trap'?'Published ripple texture overlaps a negative topographic position. Soil bearing strength is unmeasured.':kind==='sand'?'Published ripple area exceeds 25% of this planning cell. Not all sand is a trap.':'Published boulder-field texture exceeds 35%; this is not an individual-rock count.'});
  }
 }
 zones.sort((a,b)=>(a.kind==='trap'?-1:0)-(b.kind==='trap'?-1:0)||b.area-a.area);
 return {width:t.width,height:t.height,cellSize:t.cellSize,bounds:t.bounds,crs:t.crs,risk,support,ripples,depression,sand,trap,rocks,zones,knownCells,sandCells:sand.reduce((a,b)=>a+b,0),trapCells:trap.reduce((a,b)=>a+b,0),rockCells:rocks.reduce((a,b)=>a+b,0),method:'NOAH-H ripple fraction + THEMIS thermal screening + negative DEM TPI. 0.55 ripple + 0.20 normalized low thermal inertia + 0.25 depression. Candidate screening only; no calibrated entrapment probability.'};
}

export function fieldTerrain(t:Terrain,zones:FieldZone[]):Terrain{
 const mask=Uint8Array.from(t.obstacleMask??new Uint8Array(t.width*t.height)),guard=t.cellSize*Math.SQRT2/2;
 for(const z of zones){if(z.source==='derived')continue;const r=(z.radius+guard)/t.cellSize;for(let y=Math.max(0,Math.floor(z.point.y-r));y<=Math.min(t.height-1,Math.ceil(z.point.y+r));y++)for(let x=Math.max(0,Math.floor(z.point.x-r));x<=Math.min(t.width-1,Math.ceil(z.point.x+r));x++)if(Math.hypot(x-z.point.x,y-z.point.y)*t.cellSize<=z.radius+guard)mask[y*t.width+x]=1;}
 return {...t,obstacleMask:mask};
}

function fieldLeg(t:Terrain,a:FieldAssessment,start:Point,target:Point,s:Settings,policy:FieldPolicy,avoidSand:boolean){
 const n=t.width*t.height,first=index(t,start),last=index(t,target);
 if([start,target].some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=t.width||p.y>=t.height)||blocked(t,first,s,null)||blocked(t,last,s,null))return null;
 const g=new Float64Array(n).fill(Infinity),parent=new Int32Array(n).fill(-1),closed=new Uint8Array(n),heap=new MinHeap();let expanded=0;
 const heuristic=(i:number)=>Math.hypot(i%t.width-target.x,Math.floor(i/t.width)-target.y)*t.cellSize;
 g[first]=0;heap.push(first,heuristic(first));
 while(heap.length){const item=heap.pop(),i=item.i;if(closed[i])continue;if(i===last){const cells=[i];while(cells.at(-1)!==first)cells.push(parent[cells.at(-1)!]);return {cells,cost:g[i],expanded};}closed[i]=1;expanded++;
  const x=i%t.width,y=Math.floor(i/t.width);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,j=yy*t.width+xx;if(xx<0||yy<0||xx>=t.width||yy>=t.height||closed[j]||edgeBlocked(t,i,j,s,null))continue;
   const d=Math.hypot(Math.hypot(dx,dy)*t.cellSize,t.elevation[j]!-t.elevation[i]!),sl=((t.meanSlope[i]??0)+(t.meanSlope[j]??0))/2,ground=(a.risk[i]+a.risk[j])/2,unknown=1-(a.support[i]+a.support[j])/2;
   const multiplier=policy==='shortest'?1:1+(avoidSand?(policy==='cautious'?8:4)*ground:0)+(policy==='cautious'?1.6:.8)*(a.rocks[i]+a.rocks[j])/2+(policy==='cautious'?.012:.004)*sl*sl+(policy==='cautious'?1.2:.5)*unknown;
   const cost=g[i]+d*multiplier;if(cost<g[j]){g[j]=cost;parent[j]=i;heap.push(j,cost+heuristic(j));}
  }
 }return null;
}

export function fieldPlan(t:Terrain,a:FieldAssessment,start:Point,target:Point,base:Point,s:Settings,policy:FieldPolicy,avoidSand:boolean):FieldRoute|null{
 const out=fieldLeg(t,a,start,target,s,policy,avoidSand),back=fieldLeg(t,a,target,base,s,policy,avoidSand);if(!out||!back)return null;
 out.cells.reverse();back.cells.reverse();const cells=[...out.cells,...back.cells.slice(1)],mode=policy==='shortest'?'shortest':policy==='cautious'?'exposure':'mission';
 const route:Route={...metrics(t,cells,mode,s,out.cost+back.cost),outbound:out.cells,inbound:back.cells};let riskMetres=0,trapMetres=0,unknownMetres=0;
 for(let k=1;k<cells.length;k++){const i=cells[k-1],j=cells[k],p=point(t,i),q=point(t,j),d=Math.hypot(Math.hypot(p.x-q.x,p.y-q.y)*t.cellSize,t.elevation[j]!-t.elevation[i]!);riskMetres+=d*(a.risk[i]+a.risk[j])/2;trapMetres+=d*(a.trap[i]+a.trap[j])/2;if(a.support[i]<.999||a.support[j]<.999)unknownMetres+=d;}
 return {policy,route,riskMetres,trapMetres,unknownMetres,meanIndex:route.distance?riskMetres/route.distance:0,expanded:out.expanded+back.expanded};
}

/** Bounded lower-index waypoint search. Every proposal has a checked route home. */
export function lowerRiskWaypoint(t:Terrain,a:FieldAssessment,start:Point,base:Point,s:Settings){
 const first=index(t,start);if(blocked(t,first,s,null))return {target:null,reason:'The proposed start is inside a hard constraint. No supported exit is shown.'};
 const candidates=Array.from(a.risk,(_,i)=>i).filter(i=>a.support[i]>=.999&&a.risk[i]<=a.risk[first]-.12&&!blocked(t,i,s,null)&&Math.hypot(i%t.width-start.x,Math.floor(i/t.width)-start.y)*t.cellSize>=15).sort((i,j)=>Math.hypot(i%t.width-start.x,Math.floor(i/t.width)-start.y)-Math.hypot(j%t.width-start.x,Math.floor(j/t.width)-start.y)).slice(0,24);
 for(const i of candidates){const target=point(t,i),plan=fieldPlan(t,a,start,target,base,s,'cautious',true);if(plan?.route.feasible)return {target,reason:'A lower screening-index waypoint and return satisfy the declared terrain and resource constraints.'};}
 return {target:null,reason:'No lower-index waypoint with a feasible return was found in the bounded candidate search.'};
}

export function fieldPixels(t:Terrain,a:FieldAssessment,s:Settings,zones:FieldZone[],layers:{sand:boolean;rocks:boolean;unknown:boolean}){
 const prepared=fieldTerrain(t,zones),pixels=new Uint8Array(t.width*t.height*4);
 for(let i=0;i<a.risk.length;i++){
  const color=!t.valid[i]?[108,127,143,170]:blocked(prepared,i,s,null)?[229,103,111,195]:layers.sand&&a.trap[i]?[236,134,74,225]:layers.sand&&a.sand[i]?[237,184,93,200]:layers.rocks&&a.rocks[i]?[224,126,138,130]:layers.unknown&&a.support[i]<.999?[118,138,158,130]:[0,0,0,0];pixels.set(color,i*4);
 }return pixels;
}
