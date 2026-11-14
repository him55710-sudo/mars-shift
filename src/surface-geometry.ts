import type {Point,Terrain} from './planner';
import type {NativeDEM} from './eva-motion';
import {heightAt} from './eva-motion';

/** One conforming nonuniform grid: shared axes avoid cracks between detail levels. */
export function surfaceAxis(count:number,focus:number,detailed:boolean){
 const points=new Set<number>([0,count-1]),centre=Math.round(focus/32)*32;
 const add=(lo:number,hi:number,step:number)=>{for(let i=Math.max(0,Math.ceil(lo/step)*step);i<=Math.min(count-1,hi);i+=step)points.add(i);};
 add(0,count-1,detailed?32:4);
 if(detailed){add(centre-256,centre+256,8);add(centre-96,centre+96,2);add(centre-32,centre+32,1);}
 return [...points].sort((a,b)=>a-b);
}
const masks=new WeakMap<object,{width:number;values:Uint32Array}>();
function invalidPrefix(key:object,width:number,height:number,invalid:(i:number)=>boolean){
 let mask=masks.get(key);if(mask)return mask;
 const stride=width+1,values=new Uint32Array(stride*(height+1));
 for(let y=0;y<height;y++){let row=0;for(let x=0;x<width;x++){row+=invalid(y*width+x)?1:0;values[(y+1)*stride+x+1]=values[y*stride+x+1]+row;}}
 mask={width:stride,values};masks.set(key,mask);return mask;
}
function containsInvalid(mask:{width:number;values:Uint32Array},x0:number,y0:number,x1:number,y1:number){
 const {width:w,values:v}=mask;return v[(y1+1)*w+x1+1]-v[y0*w+x1+1]-v[(y1+1)*w+x0]+v[y0*w+x0]>0;
}
export function surfaceGeometry(t:Terrain,native:NativeDEM|null,focus:Point,detailed:boolean,min:number,exaggeration=1){
 const source=native?.values??t.elevation,w=native?.width??t.width,h=native?.height??t.height,cell=native?.cellSize??t.cellSize;
 const xs=native?surfaceAxis(w,(focus.x+.5)*t.cellSize/cell-.5,detailed):Array.from({length:w},(_,i)=>i),ys=native?surfaceAxis(h,(focus.y+.5)*t.cellSize/cell-.5,detailed):Array.from({length:h},(_,i)=>i),nx=xs.length,ny=ys.length;
 const positions=new Float32Array(nx*ny*3),uv=new Float32Array(nx*ny*2),heights=new Float32Array(nx*ny),indices:number[]=[];
 const missing=invalidPrefix(source,w,h,i=>source[i]===null||!Number.isFinite(source[i])),unsupported=invalidPrefix(t.valid,t.width,t.height,i=>!t.valid[i]);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const i=y*nx+x,e=source[ys[y]*w+xs[x]],east=(xs[x]+.5)*cell,south=(ys[y]+.5)*cell;
  heights[i]=e??NaN;positions.set([east-t.width*t.cellSize/2,(Number.isFinite(e)?e!-min:0)*exaggeration,south-t.height*t.cellSize/2],i*3);uv.set([east/(t.width*t.cellSize),1-south/(t.height*t.cellSize)],i*2);
  if(x>=nx-1||y>=ny-1)continue;
  const a=xs[x],b=ys[y],c=xs[x+1],d=ys[y+1],px0=Math.min(t.width-1,Math.floor(a*cell/t.cellSize)),py0=Math.min(t.height-1,Math.floor(b*cell/t.cellSize)),px1=Math.min(t.width-1,Math.floor(c*cell/t.cellSize)),py1=Math.min(t.height-1,Math.floor(d*cell/t.cellSize));
  // Coarse quads must never bridge unsupported cells or native NoData.
  if(containsInvalid(missing,a,b,c,d)||containsInvalid(unsupported,px0,py0,px1,py1))continue;
  indices.push(i,i+nx,i+1,i+1,i+nx,i+nx+1);
 }
 return {positions,uv,heights,indices:new Uint32Array(indices),vertices:nx*ny,triangles:indices.length/3};
}

/** Object-space lighting normals derived only from the measured1m DEM. */
export function nativeNormalPixels(native:NativeDEM){
 const {width:w,height:h,values:v,cellSize:cell}=native,pixels=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const x0=Math.max(0,x-1),x1=Math.min(w-1,x+1),y0=Math.max(0,y-1),y1=Math.min(h-1,y+1),neighbours=[v[y*w+x0],v[y*w+x1],v[y0*w+x],v[y1*w+x]],i=((h-1-y)*w+x)*4;
  const dx=neighbours.every(Number.isFinite)?(neighbours[1]-neighbours[0])/((x1-x0)*cell||1):0,dz=neighbours.every(Number.isFinite)?(neighbours[3]-neighbours[2])/((y1-y0)*cell||1):0,length=Math.hypot(dx,1,dz);
  pixels.set([Math.round((-.5*dx/length+.5)*255),Math.round((.5/length+.5)*255),Math.round((-.5*dz/length+.5)*255),255],i);
 }return pixels;
}

/** Resample the actual polyline, without smoothing a route across excluded cells. */
export function groundRibbon(t:Terrain,native:NativeDEM|null,cells:number[],min:number,width=.65){
 return groundPolyline(t,native,cells.map(i=>({x:i%t.width,y:Math.floor(i/t.width)})),min,width);
}

/** A display ribbon follows the actual DEM along an unsmoothed metric polyline. */
export function groundPolyline(t:Terrain,native:NativeDEM|null,points:Point[],min:number,width=.65){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];let along=0,previous=-1;
 for(let n=1;n<points.length;n++){
  const a=points[n-1],b=points[n],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)*t.cellSize,steps=Math.max(1,Math.ceil(length/.75));
  if(!length)continue;const side={x:-dy/Math.hypot(dx,dy)*width/2/t.cellSize,y:dx/Math.hypot(dx,dy)*width/2/t.cellSize};
  for(let s=n===1?0:1;s<=steps;s++){
   const q={x:a.x+dx*s/steps,y:a.y+dy*s/steps},left={x:q.x+side.x,y:q.y+side.y},right={x:q.x-side.x,y:q.y-side.y},le=heightAt(t,left,native),re=heightAt(t,right,native),v=along+length*s/steps;
   if(le===null||re===null){previous=-1;continue;}
   const i=positions.length/3;positions.push((left.x+.5-t.width/2)*t.cellSize,le-min+.045,(left.y+.5-t.height/2)*t.cellSize,(right.x+.5-t.width/2)*t.cellSize,re-min+.045,(right.y+.5-t.height/2)*t.cellSize);uv.push(0,v,1,v);
   if(previous>=0)indices.push(previous,i,previous+1,previous+1,i,i+1);previous=i;
  }along+=length;
 }
 return {positions:new Float32Array(positions),uv:new Float32Array(uv),indices:new Uint32Array(indices)};
}
