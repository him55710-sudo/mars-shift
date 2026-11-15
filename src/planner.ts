import {edgeEffortMetres} from './energy-model';
import {GridHeap} from './grid-heap';
import {crossesExclusion,exceedsGrade} from './traverse-constraints';
import type {NoahTerrain} from './noah-data';
import type {TerrainScience} from './science-data';
import {budgetForTravel,edgeTravelMinutes,hasMobilityData} from './mobility';
export type Point = {x:number;y:number};
export type Terrain = {width:number;height:number;cellSize:number;bounds:number[];center:number[];crs:string;elevation:(number|null)[];slope:(number|null)[];meanSlope:(number|null)[];roughness:(number|null)[];exposure:(number|null)[];valid:number[];thermal:(number|null)[];thermalRange:number[];obstacleMask?:Uint8Array|number[];assetRoot?:string;science?:TerrainScience;noah?:NoahTerrain;noahError?:string};
export type Mode = 'shortest'|'exposure'|'mission'|'time'|'energy';
export type Exclusion = Point & {radius:number};
export type Settings = {maxSlope:number;speed:number;scienceMinutes:number;durationMinutes:number;oxygenMinutes:number;powerMinutes:number;reservePercent:number;loadKg:number;dust:boolean;hazardWeight:number;mobilityModel?:1|2;terrainEffort?:number};
export const DEFAULTS: Settings={maxSlope:18,speed:.6,scienceMinutes:20,durationMinutes:110,oxygenMinutes:150,powerMinutes:140,reservePercent:25,loadKg:12,dust:false,hazardWeight:8};
export type Route = {mode:Mode;outbound:number[];inbound:number[];cells:number[];distance:number;gain:number;maxSlope:number;meanSlope:number;exposureDistance:number;unknownThermalDistance:number;travelMinutes:number;totalMinutes:number;oxygenRemaining:number;powerRemaining:number;timeRemaining:number;reserve:number;feasible:boolean;reasons:string[];cost:number;effortMetres?:number};

export const index=(t:Terrain,p:Point)=>p.y*t.width+p.x;
export const point=(t:Terrain,i:number):Point=>({x:i%t.width,y:Math.floor(i/t.width)});
export function blocked(t:Terrain,i:number,s:Settings,e:Exclusion|null){
  if(i<0||i>=t.width*t.height||!t.valid[i]||t.obstacleMask?.[i]||t.slope[i]===null||t.elevation[i]===null||!Number.isFinite(t.slope[i])||!Number.isFinite(t.elevation[i])||t.slope[i]!>s.maxSlope||!hasMobilityData(t,i,s))return true;
  const p=point(t,i);return !!e && Math.hypot(p.x-e.x,p.y-e.y)*t.cellSize<=e.radius;
}
/** Shared graph edge policy for A*, weighted alternatives and reverse Dijkstra. */
export function edgeBlocked(t:Terrain,a:number,b:number,s:Settings,e:Exclusion|null,allowed?:Uint8Array){
 const closed=(i:number)=>allowed?!allowed[i]:blocked(t,i,s,e);
 if(closed(a)||closed(b))return true;
 const p=point(t,a),q=point(t,b),dx=q.x-p.x,dy=q.y-p.y;
 if(Math.abs(dx)>1||Math.abs(dy)>1||(!dx&&!dy))return true;
 if(dx&&dy&&(closed(p.y*t.width+q.x)||closed(q.y*t.width+p.x)))return true;
 return exceedsGrade(t.elevation[a],t.elevation[b],Math.hypot(dx,dy)*t.cellSize,s.maxSlope)||crossesExclusion(p,q,t.cellSize,e);
}
export function leg(t:Terrain,start:Point,target:Point,mode:Mode,s:Settings,e:Exclusion|null,allowed=Uint8Array.from({length:t.width*t.height},(_,i)=>blocked(t,i,s,e)?0:1)):{cells:number[];cost:number}|null{
  if([start,target].some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=t.width||p.y>=t.height))return null;
  const first=index(t,start),last=index(t,target);if(blocked(t,first,s,e)||blocked(t,last,s,e))return null;
  const count=t.width*t.height, g=new Float64Array(count).fill(Infinity),parent=new Int32Array(count).fill(-1),closed=new Uint8Array(count),heap=new GridHeap();
  g[first]=0;heap.push(first,0);
  const heuristic=(p:Point)=>Math.hypot(p.x-target.x,p.y-target.y)*t.cellSize/(mode==='time'?Math.max(.01,s.speed)*(s.dust?.55:1)*60:1);
  while(heap.length){
    const {i}=heap.pop();if(closed[i])continue;
    if(i===last){const cells=[last];while(cells[cells.length-1]!==first){const n=parent[cells[cells.length-1]];if(n<0)return null;cells.push(n);}return {cells:cells.reverse(),cost:g[last]};}
    closed[i]=1;const p=point(t,i);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=t.width||y>=t.height)continue;
      const j=y*t.width+x;if(closed[j]||edgeBlocked(t,i,j,s,e,allowed))continue;
      const horizontal=Math.hypot(dx,dy)*t.cellSize,dz=t.elevation[j]!-t.elevation[i]!,dist=Math.hypot(horizontal,dz);
      const sl=((t.meanSlope[i]??0)+(t.meanSlope[j]??0))/2,ex=((t.exposure[i]??0)+(t.exposure[j]??0))/2;
      const uncertainty=(t.thermal[j]===null?1:0); // Coverage penalty, never a safety probability.
      let multiplier=1;
      if(mode==='exposure')multiplier+=s.hazardWeight*ex+sl*sl*.035+(t.roughness[j]??0)*.2+uncertainty*.2;
      if(mode==='mission')multiplier+=s.hazardWeight*.55*ex+sl*sl*.012+Math.max(0,dz)/horizontal*2+(t.roughness[j]??0)*.08+uncertainty*.1;
      const score=g[i]+(mode==='time'?edgeTravelMinutes(t,i,j,s):mode==='energy'?edgeEffortMetres(t,i,j,s):dist*multiplier);
      if(score<g[j]){g[j]=score;parent[j]=i;heap.push(j,score+heuristic({x,y}));}
    }
  }
  return null;
}
export function metrics(t:Terrain,cells:number[],mode:Mode,s:Settings,cost=0):Omit<Route,'outbound'|'inbound'>{
  let distance=0,gain=0,maxSlope=t.slope[cells[0]]??0,weightedSlope=0,exposureDistance=0,unknownThermalDistance=0,travelMinutes=0,effortMetres=0;
  for(let n=1;n<cells.length;n++){
    const a=cells[n-1],b=cells[n],p=point(t,a),q=point(t,b),h=Math.hypot(p.x-q.x,p.y-q.y)*t.cellSize,dz=t.elevation[b]!-t.elevation[a]!,d=Math.hypot(h,dz),sl=((t.meanSlope[a]??0)+(t.meanSlope[b]??0))/2;
    distance+=d;gain+=Math.max(0,dz);maxSlope=Math.max(maxSlope,t.slope[a]??0,t.slope[b]??0);weightedSlope+=sl*d;
    exposureDistance+=d*((t.exposure[a]??0)+(t.exposure[b]??0))/2;
    if(t.thermal[a]===null||t.thermal[b]===null)unknownThermalDistance+=d;
    travelMinutes+=edgeTravelMinutes(t,a,b,s);effortMetres+=edgeEffortMetres(t,a,b,s);
  }
  return {mode,cells,distance,gain,maxSlope,effortMetres,meanSlope:distance?weightedSlope/distance:(t.meanSlope[cells[0]]??0),exposureDistance,unknownThermalDistance,travelMinutes,...budgetForTravel(travelMinutes,s),cost};
}
export function plan(t:Terrain,base:Point,target:Point,mode:Mode,s:Settings,e:Exclusion|null):Route|null{
  const a=leg(t,base,target,mode,s,e),b=leg(t,target,base,mode,s,e);if(!a||!b)return null;
  const cells=[...a.cells,...b.cells.slice(1)];return {...metrics(t,cells,mode,s,a.cost+b.cost),outbound:a.cells,inbound:b.cells};
}
export function affected(t:Terrain,r:Route,e:Exclusion){return r.cells.filter(i=>{const p=point(t,i);return Math.hypot(p.x-e.x,p.y-e.y)*t.cellSize<=e.radius;});}
export function nearestAllowed(t:Terrain,p:Point,s:Settings):Point{
  for(let radius=0;radius<30;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    const q={x:p.x+dx,y:p.y+dy};if(q.x>=0&&q.y>=0&&q.x<t.width&&q.y<t.height&&!blocked(t,index(t,q),s,null))return q;
  }return p;
}
