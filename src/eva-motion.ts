import {blocked} from './planner';
import type {Exclusion,Point,Settings,Terrain} from './planner';
export type NativeDEM={width:number;height:number;cellSize:number;values:Float32Array;bounds:number[];crs:string};
export function heightAt(t:Terrain,p:Point,native?:NativeDEM|null):number|null{
 const w=native?.width??t.width,h=native?.height??t.height,values=native?.values??t.elevation;
 const ratio=t.cellSize/(native?.cellSize??t.cellSize),x=(p.x+.5)*ratio-.5,y=(p.y+.5)*ratio-.5;
 if(x<0||y<0||x>w-1||y>h-1)return null;const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;
 const v=[values[y0*w+x0],values[y0*w+x1],values[y1*w+x0],values[y1*w+x1]];if(v.some(z=>z===null||!Number.isFinite(z)))return null;
 return v[0]!*(1-fx)*(1-fy)+v[1]!*fx*(1-fy)+v[2]!*(1-fx)*fy+v[3]!*fx*fy;
}
export function attemptMove(t:Terrain,from:Point,dxMeters:number,dyMeters:number,settings:Settings,exclusion:Exclusion|null,native?:NativeDEM|null){
 const distance=Math.hypot(dxMeters,dyMeters);if(!Number.isFinite(distance))return {point:from,moved:0,blocked:true,reason:'Invalid movement input'};
 const steps=Math.max(1,Math.ceil(distance/Math.min(1,t.cellSize/3)));let current=from,moved=0;
 for(let n=1;n<=steps;n++){const q={x:from.x+dxMeters/t.cellSize*n/steps,y:from.y+dyMeters/t.cellSize*n/steps};if(q.x<0||q.y<0||q.x>t.width-1||q.y>t.height-1)return {point:current,moved,blocked:true,reason:'End of observed DEM'};const x=Math.round(q.x),y=Math.round(q.y),px=Math.round(current.x),py=Math.round(current.y),i=y*t.width+x;
  if(blocked(t,i,settings,exclusion)||x!==px&&y!==py&&(blocked(t,py*t.width+x,settings,exclusion)||blocked(t,y*t.width+px,settings,exclusion))||heightAt(t,q,native)===null)return {point:current,moved,blocked:true,reason:t.obstacleMask?.[i]?'Buffered obstacle annotation':'NoData, slope limit or simulated exclusion'};
  moved+=Math.hypot(q.x-current.x,q.y-current.y)*t.cellSize;current=q;
 }return {point:current,moved,blocked:false,reason:''};
}
