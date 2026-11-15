import {startTrack,validObservation} from './hazard-tracker';
import type {AxisState,VortexObservation,VortexTrack} from './hazard-tracker';
export type LocalTrackerConfig={window:3|5|7;radiusMode:'last'|'median'|'linear';processNoise:number};
export const LOCAL_TRACKER_DEFAULTS:LocalTrackerConfig={window:5,radiusMode:'median',processNoise:.08};
const median=(x:number[])=>{const s=[...x].sort((a,b)=>a-b);return s.length%2?s[s.length>>1]:(s[s.length/2-1]+s[s.length/2])/2;};

/** Causal weighted local regression. Huber reweighting downweights isolated optical errors.
 * No range is inferred from a monocular image. Input coordinates retain their own units. */
function fit(values:number[],time:number[],sigma:number[]):AxisState {
 const last=time.at(-1)!,t=time.map(v=>v-last);let w=sigma.map(v=>1/(v*v)),p=values.at(-1)!,v=0,inv00=0,inv01=0,inv11=0;
 for(let pass=0;pass<3;pass++){
  let a=0,b=0,c=0,d=0,e=0;for(let i=0;i<t.length;i++){a+=w[i];b+=w[i]*t[i];c+=w[i]*t[i]*t[i];d+=w[i]*values[i];e+=w[i]*values[i]*t[i];}
  const det=a*c-b*b;if(det<=1e-12)break;inv00=c/det;inv01=-b/det;inv11=a/det;p=inv00*d+inv01*e;v=inv01*d+inv11*e;
  const residual=values.map((z,i)=>z-p-v*t[i]),scale=Math.max(median(sigma),1.4826*median(residual.map(Math.abs)));
  w=w.map((_,i)=>1/(sigma[i]*sigma[i])*Math.min(1,1.5*scale/Math.max(1e-9,Math.abs(residual[i]))));
 }
 const residual=values.map((z,i)=>z-p-v*t[i]),variance=Math.max(1,residual.reduce((sum,r,i)=>sum+r*r/(sigma[i]*sigma[i]),0)/Math.max(1,values.length-2));
 return {p,v,pp:Math.max(.01,inv00*variance),pv:inv01*variance,vv:Math.max(.0001,inv11*variance)};
}
export function fitLocalTrack(history:VortexObservation[],config:LocalTrackerConfig=LOCAL_TRACKER_DEFAULTS):VortexTrack {
 if(!history.length||history.some((o,i)=>!validObservation(o)||(i>0&&o.time<=history[i-1].time)))throw Error('Local observations must be finite and strictly chronological');
 const points=history.slice(-config.window),last=points.at(-1)!,base=startTrack(last,config.processNoise);
 if(points.length<2)return base;
 const times=points.map(o=>o.time),sigmas=points.map(o=>o.positionSigma),x=fit(points.map(o=>o.x),times,sigmas),y=fit(points.map(o=>o.y),times,sigmas);
 const radiusValues=points.map(o=>o.radius),radius= config.radiusMode==='median'?median(radiusValues):last.radius;
 let r:AxisState={p:radius,v:0,pp:Math.max(last.radiusSigma**2,median(radiusValues.map(a=>(a-radius)**2))),pv:0,vv:.0025};
 if(config.radiusMode==='linear'){r=fit(radiusValues,times,points.map(o=>o.radiusSigma));r.p=Math.max(.1,r.p);r.v=Math.max(-.02*r.p,Math.min(.02*r.p,r.v));}
 return {...base,x,y,r,observations:points.length,radiusNoise:.01,source:last.source};
}
