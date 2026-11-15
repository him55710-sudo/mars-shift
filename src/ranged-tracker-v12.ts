import {cameraRay,pointAtRange} from './metric-vortex-v12';
import type {Camera} from './metric-vortex-v12';
export type RangeEvidence='PUBLISHED_IMAGE_ESTIMATE'|'SYNCHRONIZED_STEREO'|'RANGE_SENSOR';
export type RangedDetection={id:string;time:number;pixel:[number,number];horizontalRange:number;rangeSigma:number;pixelSigma:number;visibleDustWidth:number;source:RangeEvidence;crs:string;independentAccuracyValidated:boolean};
export type RangedFix=RangedDetection&{north:number;east:number;azimuth:number;sigmaNorth:number;sigmaEast:number};
export type MotionModel='PERSISTENCE'|'LAST2'|'OLS'|'WEIGHTED_CV';
/** Range is an observation supplied separately; it is never inferred from dust width. */
export function rangedFix(camera:Camera,d:RangedDetection):RangedFix{
 if(![d.time,d.horizontalRange,d.rangeSigma,d.pixelSigma,d.visibleDustWidth,...d.pixel].every(Number.isFinite)||d.horizontalRange<=0||d.rangeSigma<=0||d.pixelSigma<=0||d.visibleDustWidth<=0||!d.crs)throw Error('Valid timestamp, range evidence, uncertainty and frame required');
 const ray=cameraRay(camera,d.pixel),p=pointAtRange(ray,d.horizontalRange);
 const low=pointAtRange(ray,Math.max(1,d.horizontalRange-d.rangeSigma)),high=pointAtRange(ray,d.horizontalRange+d.rangeSigma);
 const l=pointAtRange(cameraRay(camera,[d.pixel[0]-d.pixelSigma,d.pixel[1]]),d.horizontalRange),r=pointAtRange(cameraRay(camera,[d.pixel[0]+d.pixelSigma,d.pixel[1]]),d.horizontalRange);
 return {...d,north:p[0],east:p[1],azimuth:(Math.atan2(p[1],p[0])*180/Math.PI+360)%360,
  sigmaNorth:Math.max(.01,Math.hypot((high[0]-low[0])/2,(r[0]-l[0])/2)),sigmaEast:Math.max(.01,Math.hypot((high[1]-low[1])/2,(r[1]-l[1])/2))};
}
export function predictRanged(history:RangedFix[],target:number,model:MotionModel){
 if(history.length<2||!Number.isFinite(target)||target<=history.at(-1)!.time||history.some((p,i)=>p.crs!==history[0].crs||![p.time,p.north,p.east,p.rangeSigma].every(Number.isFinite)||p.rangeSigma<=0||i>0&&p.time<=history[i-1].time))throw Error('Ordered observations in one frame required');
 const last=history.at(-1)!,points=model==='LAST2'?history.slice(-2):history;
 if(model==='PERSISTENCE')return {time:target,north:last.north,east:last.east,range:Math.hypot(last.north,last.east),speed:0,towardAzimuth:null,visibleDustWidth:last.visibleDustWidth};
 // Isotropic range-scale weights keep the same weight for both coordinates.
 // Full correlated uncertainty is propagated jointly by the analysis ensemble.
 const weights=points.map(p=>model==='WEIGHTED_CV'?1/p.rangeSigma**2:1),sum=weights.reduce((a,b)=>a+b);
 const mt=points.reduce((s,p,i)=>s+weights[i]*(p.time-last.time),0)/sum;
 const den=points.reduce((s,p,i)=>s+weights[i]*(p.time-last.time-mt)**2,0);
 if(den<=0)throw Error('No temporal baseline');
 const axis=(k:'north'|'east')=>{
  const mean=points.reduce((s,p,i)=>s+weights[i]*p[k],0)/sum;
  const speed=points.reduce((s,p,i)=>s+weights[i]*(p.time-last.time-mt)*(p[k]-mean),0)/den;
  return {value:mean+speed*(target-last.time-mt),speed};
 };
 const n=axis('north'),e=axis('east');
 return {time:target,north:n.value,east:e.value,range:Math.hypot(n.value,e.value),speed:Math.hypot(n.speed,e.speed),towardAzimuth:(Math.atan2(e.speed,n.speed)*180/Math.PI+360)%360,visibleDustWidth:last.visibleDustWidth};
}
/** Interface contract for a real metre-range provider; archive replay stays separate. */
export function authorizeMetricOverlay(fix:RangedFix,targetCRS:string,error95:number,clearance:number,now:number,maxAge=2){
 const reasons:string[]=[];
 if(!fix.independentAccuracyValidated||fix.source==='PUBLISHED_IMAGE_ESTIMATE')reasons.push('RETROSPECTIVE_OR_UNVALIDATED_RANGE');
 if(fix.crs!==targetCRS)reasons.push('WRONG_SITE_FRAME');
 if(!Number.isFinite(now)||now<fix.time||now-fix.time>maxAge)reasons.push('STALE_OR_FUTURE_FIX');
 if(!Number.isFinite(error95)||error95<=0||!Number.isFinite(clearance)||clearance<=error95)reasons.push('INSUFFICIENT_CLEARANCE');
 return {usable:reasons.length===0,reasons};
}
