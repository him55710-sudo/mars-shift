import {Matrix3,Vector2,Vector3} from 'three';
import {cmod_cahvore_2d_to_3d_general} from './vendor/nasa-cahvore.js';

export type V3=[number,number,number];
export type Camera={C:V3;A:V3;H:V3;V:V3;O:V3;R:V3;E:V3;linearity:number;rotation:number[][]};
export type Ray={origin:V3;direction:V3};
export type Ground={along:V3;intercept:number;slope:number};
export type Landmark={pixel:number[];range:number;id:string;role:string;pixelSigmaAssumption:number;rangeSigmaAssumption:number};
export type MetricFix={time:number;north:number;east:number;range:number;width:number};
const vec=(v:number[])=>new Vector3(v[0],v[1],v[2]);
const arr=(v:Vector3)=>v.toArray() as V3;
export function cameraRay(camera:Camera,pixel:number[]):Ray{
 if(pixel.length!==2||!pixel.every(Number.isFinite))throw Error('Finite source-image coordinates required');
 const c=camera;
 if(![...c.C,...c.A,...c.H,...c.V,...c.O,...c.R,...c.E,c.linearity,...c.rotation.flat()].every(Number.isFinite))throw Error('Invalid camera');
 const ray=cmod_cahvore_2d_to_3d_general(new Vector2(...pixel),c.linearity,vec(c.C),vec(c.A),vec(c.H),vec(c.V),vec(c.O),vec(c.R),vec(c.E));
 const q=new Matrix3().set(...c.rotation.flat() as [number,number,number,number,number,number,number,number,number]);
 return {origin:arr(ray.pos3.applyMatrix3(q)),direction:arr(ray.uvec3.applyMatrix3(q).normalize())};
}
export function pointAtRange(ray:Ray,range:number):V3{
 if(!Number.isFinite(range)||range<=0)throw Error('Positive horizontal range required');
 const [x,y]=ray.origin,[u,v]=ray.direction,A=u*u+v*v,B=2*(x*u+y*v),C=x*x+y*y-range*range;
 const disc=B*B-4*A*C;if(A<1e-12||disc<0)throw Error('Range does not intersect ray');
 const t=(-B+Math.sqrt(disc))/(2*A);if(t<=0)throw Error('Range is behind camera');
 return arr(vec(ray.origin).addScaledVector(vec(ray.direction),t));
}
/** Local planar terrain profile along the camera viewing azimuth.
 * The cross-track gradient is held at zero, an explicit surface assumption. */
export function fitGround(camera:Camera,landmarks:Landmark[]):Ground{
 if(landmarks.length<2)throw Error('Two distinct range controls required');
 const axis=new Matrix3().set(...camera.rotation.flat() as [number,number,number,number,number,number,number,number,number]);
 const along=vec(camera.A).applyMatrix3(axis);along.z=0;along.normalize();
 const points=landmarks.map(l=>pointAtRange(cameraRay(camera,l.pixel),l.range));
 const xs=points.map(p=>p[0]*along.x+p[1]*along.y),zs=points.map(p=>p[2]);
 const mx=xs.reduce((a,b)=>a+b)/xs.length,mz=zs.reduce((a,b)=>a+b)/zs.length;
 const den=xs.reduce((s,x)=>s+(x-mx)**2,0);if(den<1)throw Error('Range controls are ill-conditioned');
 const slope=xs.reduce((s,x,i)=>s+(x-mx)*(zs[i]-mz),0)/den;
 return {along:arr(along),intercept:mz-slope*mx,slope};
}
export function intersectGround(ray:Ray,ground:Ground,verticalOffset=0):V3|null{
 const [n,e,z]=ray.origin,[dn,de,dz]=ray.direction,[an,ae]=ground.along;
 const den=dz-ground.slope*(an*dn+ae*de);
 if(Math.abs(den)<1e-8)return null;
 const t=(ground.intercept+verticalOffset+ground.slope*(an*n+ae*e)-z)/den;
 if(t<=0||t>10000)return null;
 return arr(vec(ray.origin).addScaledVector(vec(ray.direction),t));
}
export function reconstruct(camera:Camera,ground:Ground,pixel:number[],edges:number[][],time:number,verticalOffset=0):MetricFix|null{
 const p=intersectGround(cameraRay(camera,pixel),ground,verticalOffset);if(!p)return null;
 // Width is the chord between edge rays at the centre's horizontal range.
 // It describes visible dust, not the dynamic vortex radius.
 const range=Math.hypot(p[0],p[1]),a=pointAtRange(cameraRay(camera,edges[0]),range),b=pointAtRange(cameraRay(camera,edges[1]),range);
 return {time,north:p[0],east:p[1],range,width:Math.hypot(a[0]-b[0],a[1]-b[1])};
}
export function forecastMetric(history:MetricFix[],targetTime:number,model:'PERSISTENCE'|'LAST2'|'OLS'){
 if(history.length<2||!Number.isFinite(targetTime)||targetTime<=history.at(-1)!.time||history.some((p,i)=>![p.time,p.north,p.east].every(Number.isFinite)||i>0&&p.time<=history[i-1].time))throw Error('Causal chronological history required');
 const last=history.at(-1)!,points=model==='LAST2'?history.slice(-2):history;
 let vn=0,ve=0,n=last.north,e=last.east;
 if(model!=='PERSISTENCE'){
  const mt=points.reduce((s,p)=>s+p.time,0)/points.length,mn=points.reduce((s,p)=>s+p.north,0)/points.length,me=points.reduce((s,p)=>s+p.east,0)/points.length;
  const den=points.reduce((s,p)=>s+(p.time-mt)**2,0);
  vn=points.reduce((s,p)=>s+(p.time-mt)*(p.north-mn),0)/den;ve=points.reduce((s,p)=>s+(p.time-mt)*(p.east-me),0)/den;
  n=mn+vn*(targetTime-mt);e=me+ve*(targetTime-mt);
 }
 return {time:targetTime,north:n,east:e,range:Math.hypot(n,e),speed:Math.hypot(vn,ve),towardAzimuth:(Math.atan2(ve,vn)*180/Math.PI+360)%360};
}
/** Stereo alternative, usable only for synchronized rays in a shared frame. */
export function triangulate(a:Ray,b:Ray,maxSkew:number):{point:V3;skew:number;angleDegrees:number}|null{
 const u=vec(a.direction).normalize(),v=vec(b.direction).normalize(),w=vec(a.origin).sub(vec(b.origin));
 const dot=u.dot(v),den=1-dot*dot;if(den<1e-8)return null;
 const du=u.dot(w),dv=v.dot(w),s=(dot*dv-du)/den,t=(dv-dot*du)/den;
 if(s<=0||t<=0)return null;
 const p=vec(a.origin).addScaledVector(u,s),q=vec(b.origin).addScaledVector(v,t),skew=p.distanceTo(q);
 if(skew>maxSkew)return null;
 return {point:arr(p.add(q).multiplyScalar(.5)),skew,angleDegrees:Math.acos(Math.min(1,Math.abs(dot)))*180/Math.PI};
}
/** Gate protects the navigation adapter from unvalidated metric-looking data. */
export function metricNavigationGate(evidence:{independentMetricTruth:boolean;crsMatches:boolean;error95Metres:number;availableClearanceMetres:number;ageSeconds:number;maxAgeSeconds:number}){
 const reasons:string[]=[];
 if(!evidence.independentMetricTruth)reasons.push('METRIC_ACCURACY_UNVALIDATED');
 if(!evidence.crsMatches)reasons.push('COORDINATE_FRAME_MISMATCH');
 if(!Number.isFinite(evidence.error95Metres)||evidence.error95Metres<0||evidence.error95Metres>=evidence.availableClearanceMetres)reasons.push('UNCERTAINTY_EXCEEDS_CLEARANCE');
 if(!Number.isFinite(evidence.ageSeconds)||evidence.ageSeconds<0||evidence.ageSeconds>evidence.maxAgeSeconds)reasons.push('STALE_OBSERVATION');
 return {usable:reasons.length===0,reasons};
}
