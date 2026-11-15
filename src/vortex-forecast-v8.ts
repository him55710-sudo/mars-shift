import {fitLocalTrack} from './local-dust-tracker';
import {forecast,validObservation} from './hazard-tracker';
import type {AxisState,VortexObservation} from './hazard-tracker';
export type PredictorV8='LOCAL7'|'CV_SMOOTH'|'CV_RESPONSIVE'|'IMM';
export const PREDICTORS_V8:PredictorV8[]=['LOCAL7','CV_SMOOTH','CV_RESPONSIVE','IMM'];
type Mode={x:AxisState;y:AxisState;q:number;weight:number};
export type PredictionV8={x:number;y:number;radius:number;sigma:number;radiusSigma:number;vx:number;vy:number;weights:number[]};
const predict=(a:AxisState,d:number,q:number):AxisState=>({p:a.p+d*a.v,v:a.v,pp:a.pp+2*d*a.pv+d*d*a.vv+q*q*d**3/3,pv:a.pv+d*a.vv+q*q*d*d/2,vv:a.vv+q*q*d});
const correct=(a:AxisState,z:number,r:number):AxisState=>{const S=a.pp+r*r,k=a.pp/S,l=a.pv/S;return {p:a.p+k*(z-a.p),v:a.v+l*(z-a.p),pp:(1-k)**2*a.pp+k*k*r*r,pv:(1-k)*(a.pv-l*a.pp)+k*l*r*r,vv:Math.max(1e-10,a.vv-2*l*a.pv+l*l*S)};};
function mix(axes:AxisState[],w:number[]):AxisState{const p=axes.reduce((s,a,i)=>s+w[i]*a.p,0),v=axes.reduce((s,a,i)=>s+w[i]*a.v,0);return {p,v,pp:axes.reduce((s,a,i)=>s+w[i]*(a.pp+(a.p-p)**2),0),pv:axes.reduce((s,a,i)=>s+w[i]*(a.pv+(a.p-p)*(a.v-v)),0),vv:axes.reduce((s,a,i)=>s+w[i]*(a.vv+(a.v-v)**2),0)};}
/** Independently implemented IMM mixing / likelihood update. Modes share a CV
 * state but use different continuous white-acceleration noise levels. This is
 * maneuver adaptation, not a CFD or an observed Martian turning law. */
export function fitForecastV8(history:VortexObservation[],model:PredictorV8){
 if(!history.length||history.some((o,i)=>!validObservation(o)||i>0&&o.time<=history[i-1].time))throw Error('Chronological finite fixes required');
 const last=history.at(-1)!,radiusTrack=fitLocalTrack(history,{window:7,radiusMode:'median',processNoise:.08});
 if(model==='LOCAL7')return (time:number):PredictionV8=>{const f=forecast(radiusTrack,time,false,0);return {...f,sigma:f.position95/2.447747,radiusSigma:f.radius95/1.96,weights:[1]};};
 const first=history[0],init=(p:number):AxisState=>({p,v:0,pp:first.positionSigma**2,pv:0,vv:9});
 const qs=model==='IMM'?[.03,.2,1.2]:[model==='CV_SMOOTH'?.03:1.2];
 let modes:Mode[]=qs.map(q=>({x:init(first.x),y:init(first.y),q,weight:1/qs.length}));
 for(let n=1;n<history.length;n++){
  const o=history[n],dt=o.time-history[n-1].time,N=modes.length;
  // A continuous-time stay probability makes behavior stable to sampling cadence.
  const stay=Math.exp(-dt/30),transition=(i:number,j:number)=>N===1?1:i===j?stay+(1-stay)/N:(1-stay)/N;
  const prior=modes.map((_,j)=>modes.reduce((s,m,i)=>s+m.weight*transition(i,j),0));
  const logs:number[]=[];
  modes=modes.map((m,j)=>{const w=modes.map((a,i)=>a.weight*transition(i,j)/prior[j]);const x=predict(mix(modes.map(a=>a.x),w),dt,m.q),y=predict(mix(modes.map(a=>a.y),w),dt,m.q),sx=x.pp+o.positionSigma**2,sy=y.pp+o.positionSigma**2;logs.push(Math.log(prior[j])-.5*(Math.log(sx*sy)+(o.x-x.p)**2/sx+(o.y-y.p)**2/sy));return {...m,x:correct(x,o.x,o.positionSigma),y:correct(y,o.y,o.positionSigma)};});
  const peak=Math.max(...logs),w=logs.map(v=>Math.exp(v-peak)),sum=w.reduce((a,b)=>a+b,0);modes.forEach((m,i)=>m.weight=w[i]/sum);
 }
 return (time:number):PredictionV8=>{const dt=Math.max(0,time-last.time),w=modes.map(m=>m.weight),x=mix(modes.map(m=>predict(m.x,dt,m.q)),w),y=mix(modes.map(m=>predict(m.y,dt,m.q)),w),r=forecast(radiusTrack,time,false,0);return {x:x.p,y:y.p,vx:x.v,vy:y.v,radius:r.radius,radiusSigma:r.radius95/1.96,sigma:Math.sqrt(Math.max(x.pp,y.pp)),weights:w};};
}
