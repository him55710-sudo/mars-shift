export type XY={x:number;y:number};
export type CircleState=XY&{radius:number};
/** Exact duration inside a linearly translating/growing circular exclusion zone.
 * Both the walker and circle are linear within this segment. Tangency has zero duration. */
export function sweptContact(a:XY,b:XY,c:CircleState,d:CircleState,seconds:number){
 return sweptContactIntervals(a,b,c,d,seconds).reduce((sum,[entry,exit])=>sum+exit-entry,0);
}
/** Entry/exit times relative to this segment; strict interior, tangency excluded. */
export function sweptContactIntervals(a:XY,b:XY,c:CircleState,d:CircleState,seconds:number):[number,number][]{
 if(![a.x,a.y,b.x,b.y,c.x,c.y,d.x,d.y,c.radius,d.radius,seconds].every(Number.isFinite)||seconds<0||c.radius<0||d.radius<0)throw Error('Invalid swept-contact inputs');
 const x=a.x-c.x,y=a.y-c.y,vx=b.x-d.x-x,vy=b.y-d.y-y,dr=d.radius-c.radius;
 const A=vx*vx+vy*vy-dr*dr,B=2*(x*vx+y*vy-c.radius*dr),C=x*x+y*y-c.radius*c.radius;
 const cuts=[0,1];
 if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12){const u=-C/B;if(u>0&&u<1)cuts.push(u);}}
 else {const disc=B*B-4*A*C;if(disc>=0){const sq=Math.sqrt(disc);for(const u of [(-B-sq)/(2*A),(-B+sq)/(2*A)])if(u>0&&u<1)cuts.push(u);}}
 cuts.sort((p,q)=>p-q);const intervals:[number,number][]=[];for(let i=1;i<cuts.length;i++){const m=(cuts[i]+cuts[i-1])/2;if(A*m*m+B*m+C<0&&seconds>0)intervals.push([cuts[i-1]*seconds,cuts[i]*seconds]);}
 return intervals;
}
export function linearClearance(relative:XY,velocity:XY,radius:number,duration:number){
 const den=velocity.x**2+velocity.y**2,t=den?Math.max(0,Math.min(duration,-(relative.x*velocity.x+relative.y*velocity.y)/den)):0;
 return {time:t,clearance:Math.hypot(relative.x+velocity.x*t,relative.y+velocity.y*t)-radius};
}
/** Proven head-on free-plane boundary, v>u; arbitrary turning cannot beat it.
 * At center passage all reachable positions lie within u*D/v of the initial point.
 * A heading with cos(theta)=u/v achieves that bound at its closest approach. */
export function headOnBoundary(radius:number,translation:number,walking:number,delay:number){
 if(![radius,translation,walking,delay].every(Number.isFinite)||radius<=0||walking<=0||translation<=walking||delay<0)throw Error('Requires R>0, v>u>0, L>=0');
 return {warningSeconds:delay+radius/walking-radius/translation,centerArrivalSeconds:delay+radius/walking,centerDistanceMetres:translation*delay+radius*translation/walking,headingRadians:Math.acos(walking/translation)};
}
export function straightEncounter(center:XY,translation:XY,radius:number,walking:XY,delay:number,duration:number){
 const L=Math.min(delay,duration),c={...center,radius},middle={x:center.x+translation.x*L,y:center.y+translation.y*L,radius},end={x:center.x+translation.x*duration,y:center.y+translation.y*duration,radius},position={x:walking.x*(duration-L),y:walking.y*(duration-L)};
 const exposure=sweptContact({x:0,y:0},{x:0,y:0},c,middle,L)+sweptContact({x:0,y:0},position,middle,end,duration-L);
 const before=linearClearance({x:-center.x,y:-center.y},{x:-translation.x,y:-translation.y},radius,L),after=linearClearance({x:-middle.x,y:-middle.y},{x:walking.x-translation.x,y:walking.y-translation.y},radius,duration-L);
 return {exposureSeconds:exposure,minClearance:Math.min(before.clearance,after.clearance)};
}
/** Oracle comparator with true constant motion: 720 headings plus HOLD. Not a terrain planner. */
export function bestStraightEscape(center:XY,v:XY,radius:number,speed:number,delay:number,duration:number){
 let best={...straightEncounter(center,v,radius,{x:0,y:0},delay,duration),vx:0,vy:0,action:'HOLD'};
 for(let k=0;k<720;k++){const a=k*Math.PI/360,w={x:Math.cos(a)*speed,y:Math.sin(a)*speed},r=straightEncounter(center,v,radius,w,delay,duration);
  if(r.exposureSeconds<best.exposureSeconds-1e-9||Math.abs(r.exposureSeconds-best.exposureSeconds)<1e-9&&r.minClearance>best.minClearance)best={...r,vx:w.x,vy:w.y,action:'MOVE'};
 }return best;
}
