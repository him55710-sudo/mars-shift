import {blocked,DEFAULTS,metrics} from './planner';
import {edgeTravelMinutes} from './mobility';
import type {Mode,Point,Route,Settings,Terrain} from './planner';
import {heightAt} from './eva-motion';

export type RoverGrid={width:number;height:number;cellSize:number;origin:number[];elevation:(number|null)[];slope:(number|null)[];start:{x:number;z:number};target:{x:number;z:number}};
export type RoverObstacle={id:string;x:number;z:number;radius:number;kind:'reviewed'|'simulated'};
export type RoverTerrain=Terrain&{edgeBlocked:Uint16Array};
export const ROVER_SETTINGS:Settings={...DEFAULTS,maxSlope:25,speed:.6,scienceMinutes:2,durationMinutes:20,oxygenMinutes:30,powerMinutes:30,reservePercent:25,loadKg:12};
export const worldPoint=(g:RoverGrid,p:Point)=>({x:g.origin[0]+(p.x+.5)*g.cellSize,z:g.origin[1]+(p.y+.5)*g.cellSize});
export const gridPoint=(g:RoverGrid,x:number,z:number):Point=>({x:(x-g.origin[0])/g.cellSize-.5,y:(z-g.origin[1])/g.cellSize-.5});
export function validateRoverGrid(g:RoverGrid){
 const n=g.width*g.height;
 if(!Number.isInteger(g.width)||!Number.isInteger(g.height)||g.width<2||g.height<2||n>1000000||!Number.isFinite(g.cellSize)||g.cellSize<=0||g.origin.length!==2||!g.origin.every(Number.isFinite)||g.elevation.length!==n||g.slope.length!==n)throw Error('Invalid observed navigation grid');
 if(g.elevation.some(z=>z!==null&&!Number.isFinite(z))||g.slope.some(z=>z!==null&&(!Number.isFinite(z)||z<0||z>90)))throw Error('Invalid observed surface values');
}
/** The mesh-derived graph is local, and is never assigned the orbital study-region CRS. */
export function roverTerrain(g:RoverGrid,obstacles:RoverObstacle[],maxSlope=25):RoverTerrain{
 validateRoverGrid(g);const n=g.width*g.height,valid=g.elevation.map((v,i)=>v!==null&&g.slope[i]!==null?1:0),mask=new Uint8Array(n),exposure=new Array<number|null>(n).fill(null);
 for(let i=0;i<n;i++){
  const x=i%g.width,y=Math.floor(i/g.width),w=worldPoint(g,{x,y});
  // One-cell guard plus swept footprint tests keeps the crew away from data gaps.
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   const a=x+dx,b=y+dz,j=b*g.width+a;
   if(a<0||b<0||a>=g.width||b>=g.height||!valid[j]||(g.slope[j]??90)>maxSlope)mask[i]=1;
  }
  if(obstacles.some(o=>Math.hypot(w.x-o.x,w.z-o.z)<=o.radius+.35))mask[i]=1;
  exposure[i]=valid[i]?Math.max(0,(g.slope[i]??90)-10)/30:null;
 }
 const t:RoverTerrain={width:g.width,height:g.height,cellSize:g.cellSize,bounds:[g.origin[0],g.origin[1],g.origin[0]+g.width*g.cellSize,g.origin[1]+g.height*g.cellSize],center:[0,0],crs:'LOCAL:NASA-M20-SITE026-NORTH-UP-EAST-METRES',elevation:g.elevation,slope:g.slope,meanSlope:g.slope,roughness:new Array(n).fill(0),exposure,valid,thermal:new Array(n).fill(null),thermalRange:[0,0],obstacleMask:mask,edgeBlocked:new Uint16Array(n)};
 // A route edge must pass exactly the same swept support/grade tests as walking.
 const settings={...ROVER_SETTINGS,maxSlope};
 for(let i=0;i<n;i++){if(mask[i]||!valid[i])continue;const p={x:i%g.width,y:Math.floor(i/g.width)};for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;if(moveOnRover(t,p,dx*g.cellSize,dz*g.cellSize,settings).reason)t.edgeBlocked![i]|=1<<((dz+1)*3+dx+1);}}
 return t;
}
export function canStand(t:Terrain,p:Point,s=ROVER_SETTINGS){
 const x=Math.round(p.x),y=Math.round(p.y),i=y*t.width+x;
 if(x<0||y<0||x>=t.width||y>=t.height||!t.valid[i]||t.obstacleMask?.[i]||(t.slope[i]??90)>s.maxSlope||heightAt(t,p)===null)return false;
 for(let k=0;k<8;k++)if(heightAt(t,{x:p.x+Math.cos(k*Math.PI/4)*.3/t.cellSize,y:p.y+Math.sin(k*Math.PI/4)*.3/t.cellSize})===null)return false;
 return true;
}
export function moveOnRover(t:Terrain,p:Point,dx:number,dz:number,s=ROVER_SETTINGS){
 const distance=Math.hypot(dx,dz);if(!Number.isFinite(distance))return {point:p,distance:0,reason:'Invalid movement'};
 const steps=Math.max(1,Math.ceil(distance/Math.min(.08,t.cellSize/3)));let current=p,travel=0;
 for(let k=1;k<=steps;k++){
  const next={x:p.x+dx/t.cellSize*k/steps,y:p.y+dz/t.cellSize*k/steps},a=heightAt(t,current),b=heightAt(t,next),h=Math.hypot(next.x-current.x,next.y-current.y)*t.cellSize;
  if(!canStand(t,next,s)||a===null||b===null||Math.abs(b-a)>.22||h>0&&Math.atan2(Math.abs(b-a),h)*180/Math.PI>s.maxSlope+1)return {point:current,distance:travel,reason:'Observed boundary, steep surface or buffered obstacle'};
  travel+=Math.hypot(h,b-a);current=next;
 }
 return {point:current,distance:travel,reason:''};
}
/** Local mesh graph adapter. Existing orbital planning and scientific engines are unchanged. */
function localLeg(t:RoverTerrain,start:Point,target:Point,mode:Mode,s:Settings){
 const first=start.y*t.width+start.x,last=target.y*t.width+target.x;
 if(blocked(t,first,s,null)||blocked(t,last,s,null))return null;
 const distance=new Float64Array(t.width*t.height).fill(Infinity),parent=new Int32Array(distance.length).fill(-1),closed=new Uint8Array(distance.length),heap:{i:number;cost:number}[]=[];
 const push=(item:{i:number;cost:number})=>{let n=heap.length;heap.push(item);while(n>0){const p=(n-1)>>1;if(heap[p].cost<=item.cost)break;heap[n]=heap[p];n=p;}heap[n]=item;};
 const pop=()=>{const out=heap[0],tail=heap.pop()!;if(heap.length){let n=0;while(n*2+1<heap.length){let c=n*2+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=tail.cost)break;heap[n]=heap[c];n=c;}heap[n]=tail;}return out;};
 distance[first]=0;push({i:first,cost:0});
 while(heap.length){const {i}=pop();if(closed[i])continue;if(i===last){const cells=[i];while(cells.at(-1)!==first)cells.push(parent[cells.at(-1)!]);return {cells:cells.reverse(),cost:distance[i]};}closed[i]=1;const x=i%t.width,y=Math.floor(i/t.width);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz||t.edgeBlocked[i]&(1<<((dz+1)*3+dx+1)))continue;const nx=x+dx,ny=y+dz,j=ny*t.width+nx;if(nx<0||ny<0||nx>=t.width||ny>=t.height||closed[j]||blocked(t,j,s,null))continue;if(dx&&dz&&(blocked(t,y*t.width+nx,s,null)||blocked(t,ny*t.width+x,s,null)))continue;
   const horizontal=Math.hypot(dx,dz)*t.cellSize,edgeLength=Math.hypot(horizontal,t.elevation[j]!-t.elevation[i]!),slope=(t.meanSlope[i]!+t.meanSlope[j]!)/2,exposure=(t.exposure[i]!+t.exposure[j]!)/2;
   const cost=mode==='time'?edgeTravelMinutes(t,i,j,s):edgeLength*(mode==='exposure'?1+s.hazardWeight*exposure+slope*slope*.035+.2:1),score=distance[i]+cost;
   if(score<distance[j]){distance[j]=score;parent[j]=i;const heuristic=Math.hypot(nx-target.x,ny-target.y)*t.cellSize/(mode==='time'?s.speed*60:1);push({i:j,cost:score+heuristic});}
  }
 }return null;
}
export function roverRoutes(t:RoverTerrain,start:Point,target:Point,s=ROVER_SETTINGS,base=start):Partial<Record<Mode,Route|null>>{
 const a={x:Math.round(start.x),y:Math.round(start.y)},b={x:Math.round(target.x),y:Math.round(target.y)};
 if(!canStand(t,start,s)||!canStand(t,target,s))return {};
 return Object.fromEntries((['shortest','exposure','time'] as Mode[]).map(mode=>{const out=localLeg(t,a,b,mode,s),back=localLeg(t,b,{x:Math.round(base.x),y:Math.round(base.y)},mode,s);if(!out||!back)return [mode,null];const cells=[...out.cells,...back.cells.slice(1)],r:Route={...metrics(t,cells,mode,s,out.cost+back.cost),outbound:out.cells,inbound:back.cells};return [mode,r.feasible?r:null];}));
}
