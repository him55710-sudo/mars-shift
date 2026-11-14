export type Point = {x:number;y:number};
export type Terrain = {width:number;height:number;cellSize:number;bounds:number[];center:number[];crs:string;elevation:(number|null)[];slope:(number|null)[];meanSlope:(number|null)[];roughness:(number|null)[];exposure:(number|null)[];valid:number[];thermal:(number|null)[];thermalRange:number[]};
export type Mode = 'shortest'|'exposure'|'mission';
export type Exclusion = Point & {radius:number};
export type Settings = {maxSlope:number;speed:number;scienceMinutes:number;durationMinutes:number;oxygenMinutes:number;powerMinutes:number;reservePercent:number;loadKg:number;dust:boolean;hazardWeight:number};
export const DEFAULTS: Settings={maxSlope:18,speed:.6,scienceMinutes:20,durationMinutes:110,oxygenMinutes:150,powerMinutes:140,reservePercent:25,loadKg:12,dust:false,hazardWeight:8};
export type Route = {mode:Mode;outbound:number[];inbound:number[];cells:number[];distance:number;gain:number;maxSlope:number;meanSlope:number;exposureDistance:number;unknownThermalDistance:number;travelMinutes:number;totalMinutes:number;oxygenRemaining:number;powerRemaining:number;timeRemaining:number;reserve:number;feasible:boolean;reasons:string[];cost:number};

class Heap {
  data:{i:number;f:number}[]=[];
  push(i:number,f:number){let n=this.data.length;this.data.push({i,f});while(n>0){const p=(n-1)>>1;if(this.data[p].f<=f)break;this.data[n]=this.data[p];n=p;}this.data[n]={i,f};}
  pop(){const out=this.data[0],last=this.data.pop()!;if(this.data.length){let n=0;while(n*2+1<this.data.length){let c=n*2+1;if(c+1<this.data.length&&this.data[c+1].f<this.data[c].f)c++;if(this.data[c].f>=last.f)break;this.data[n]=this.data[c];n=c;}this.data[n]=last;}return out;}
}
export const index=(t:Terrain,p:Point)=>p.y*t.width+p.x;
export const point=(t:Terrain,i:number):Point=>({x:i%t.width,y:Math.floor(i/t.width)});
export function blocked(t:Terrain,i:number,s:Settings,e:Exclusion|null){
  if(i<0||i>=t.width*t.height||!t.valid[i]||t.slope[i]===null||t.elevation[i]===null||!Number.isFinite(t.slope[i])||!Number.isFinite(t.elevation[i])||t.slope[i]!>s.maxSlope)return true;
  const p=point(t,i);return !!e && Math.hypot(p.x-e.x,p.y-e.y)*t.cellSize<=e.radius;
}
export function leg(t:Terrain,start:Point,target:Point,mode:Mode,s:Settings,e:Exclusion|null):{cells:number[];cost:number}|null{
  if([start,target].some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=t.width||p.y>=t.height))return null;
  const first=index(t,start),last=index(t,target);if(blocked(t,first,s,e)||blocked(t,last,s,e))return null;
  const count=t.width*t.height, g=new Float64Array(count).fill(Infinity),parent=new Int32Array(count).fill(-1),closed=new Uint8Array(count),heap=new Heap();
  g[first]=0;heap.push(first,0);
  const heuristic=(p:Point)=>Math.hypot(p.x-target.x,p.y-target.y)*t.cellSize;
  while(heap.data.length){
    const {i}=heap.pop();if(closed[i])continue;
    if(i===last){const cells=[last];while(cells[cells.length-1]!==first){const n=parent[cells[cells.length-1]];if(n<0)return null;cells.push(n);}return {cells:cells.reverse(),cost:g[last]};}
    closed[i]=1;const p=point(t,i);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=t.width||y>=t.height)continue;
      const j=y*t.width+x;if(closed[j]||blocked(t,j,s,e))continue;
      // A diagonal must not cut between two blocked orthogonal neighbours.
      if(dx&&dy&&(blocked(t,p.y*t.width+x,s,e)||blocked(t,y*t.width+p.x,s,e)))continue;
      const horizontal=Math.hypot(dx,dy)*t.cellSize,dz=t.elevation[j]!-t.elevation[i]!,dist=Math.hypot(horizontal,dz);
      const sl=((t.meanSlope[i]??0)+(t.meanSlope[j]??0))/2,ex=((t.exposure[i]??0)+(t.exposure[j]??0))/2;
      const uncertainty=(t.thermal[j]===null?1:0); // Coverage penalty, never a safety probability.
      let multiplier=1;
      if(mode==='exposure')multiplier+=s.hazardWeight*ex+sl*sl*.035+(t.roughness[j]??0)*.2+uncertainty*.2;
      if(mode==='mission')multiplier+=s.hazardWeight*.55*ex+sl*sl*.012+Math.max(0,dz)/horizontal*2+(t.roughness[j]??0)*.08+uncertainty*.1;
      const score=g[i]+dist*multiplier;
      if(score<g[j]){g[j]=score;parent[j]=i;heap.push(j,score+heuristic({x,y}));}
    }
  }
  return null;
}
export function metrics(t:Terrain,cells:number[],mode:Mode,s:Settings,cost=0):Omit<Route,'outbound'|'inbound'>{
  let distance=0,gain=0,maxSlope=t.slope[cells[0]]??0,weightedSlope=0,exposureDistance=0,unknownThermalDistance=0,travelMinutes=0;
  for(let n=1;n<cells.length;n++){
    const a=cells[n-1],b=cells[n],p=point(t,a),q=point(t,b),h=Math.hypot(p.x-q.x,p.y-q.y)*t.cellSize,dz=t.elevation[b]!-t.elevation[a]!,d=Math.hypot(h,dz),sl=((t.meanSlope[a]??0)+(t.meanSlope[b]??0))/2;
    distance+=d;gain+=Math.max(0,dz);maxSlope=Math.max(maxSlope,t.slope[a]??0,t.slope[b]??0);weightedSlope+=sl*d;
    exposureDistance+=d*((t.exposure[a]??0)+(t.exposure[b]??0))/2;
    if(t.thermal[a]===null||t.thermal[b]===null)unknownThermalDistance+=d;
    const effort=1+sl*sl*.012+s.loadKg*.015+Math.max(0,dz)/Math.max(h,.01)*2;
    travelMinutes+=d*effort/(Math.max(.01,s.speed)*(s.dust?.55:1)*60);
  }
  const totalMinutes=travelMinutes+s.scienceMinutes;
  const oxygenUse=travelMinutes*(1+s.loadKg*.01)+s.scienceMinutes*.65;
  const powerUse=travelMinutes*(1+s.loadKg*.005)+s.scienceMinutes*.8;
  const oxygenRemaining=100*(1-oxygenUse/s.oxygenMinutes),powerRemaining=100*(1-powerUse/s.powerMinutes),timeRemaining=s.durationMinutes-totalMinutes,reserve=Math.min(oxygenRemaining,powerRemaining);
  const reasons:string[]=[];
  if(timeRemaining<0)reasons.push('Round trip exceeds mission time budget.');
  if(reserve<s.reservePercent)reasons.push('Return resource reserve is below the required minimum.');
  if(s.dust)reasons.push('Reduced visibility: HOLD and verify local obstacle detection before movement.');
  return {mode,cells,distance,gain,maxSlope,meanSlope:distance?weightedSlope/distance:(t.meanSlope[cells[0]]??0),exposureDistance,unknownThermalDistance,travelMinutes,totalMinutes,oxygenRemaining,powerRemaining,timeRemaining,reserve,feasible:!reasons.length,reasons,cost};
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
