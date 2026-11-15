import {sweptContactIntervals,linearClearance} from './dust-devil-geometry';
import type {CircleState,XY} from './dust-devil-geometry';
import type {TimedPoint} from './hazard-planner';
import {positionOnPath} from './hazard-planner';

/** Minimum signed separation from a linearly growing disk. Convex 1-D minimization;
 * fixed radius uses the analytic expression. Accuracy is ~1e-6 of segment motion. */
export function segmentClearance(a:XY,b:XY,c:CircleState,d:CircleState){
 const x=a.x-c.x,y=a.y-c.y,vx=b.x-d.x-x,vy=b.y-d.y-y,dr=d.radius-c.radius;
 if(Math.abs(dr)<1e-12)return linearClearance({x,y},{x:vx,y:vy},c.radius,1).clearance;
 const f=(u:number)=>Math.hypot(x+vx*u,y+vy*u)-c.radius-dr*u;
 let lo=0,hi=1;for(let k=0;k<36;k++){const l=(2*lo+hi)/3,r=(lo+2*hi)/3;if(f(l)<f(r))hi=r;else lo=l;}
 return Math.min(f(0),f(1),f((lo+hi)/2));
}
/** Exact exposure for a piecewise-linear walker and circle; caller supplies circle
 * turning/radius-change knots. No point-sampling contact classification is used. */
export function measureEscapePath(path:TimedPoint[],circleAt:(time:number)=>CircleState,cell:number,begin:number,end:number,circleKnots:number[]=[]){
 const cuts=[...new Set([begin,end,...path.map(p=>p.time),...circleKnots].filter(t=>t>=begin&&t<=end))].sort((a,b)=>a-b);
 const intervals:[number,number][]=[];let minClearance=Infinity;
 for(let i=1;i<cuts.length;i++){
  const ta=cuts[i-1],tb=cuts[i],pa=positionOnPath(path,ta),pb=positionOnPath(path,tb),a={x:pa.x*cell,y:pa.y*cell},b={x:pb.x*cell,y:pb.y*cell},c=circleAt(ta),d=circleAt(tb);
  minClearance=Math.min(minClearance,segmentClearance(a,b,c,d));
  for(const [u,v] of sweptContactIntervals(a,b,c,d,tb-ta)){
   const last=intervals.at(-1),entry=ta+u,exit=ta+v;
   if(last&&Math.abs(last[1]-entry)<1e-8)last[1]=exit;else intervals.push([entry,exit]);
  }
 }
 return {exposureSeconds:intervals.reduce((sum,[a,b])=>sum+b-a,0),minClearance,intervals};
}
