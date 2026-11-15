import {fitForecastV8} from './vortex-forecast-v8';
import type {PredictorV8} from './vortex-forecast-v8';
export type ImagePoint={frame:number;time:number;x:number;width:number;positionSigma:number;radiusSigma:number};
export type ImageModel={name:string;window?:number;damping?:number;widthMode?:'last'|'median3'};
export const median=(x:number[])=>{const a=[...x].sort((a,b)=>a-b),n=a.length;return n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2;};
export function predictImage(history:ImagePoint[],lead:number,model:ImageModel){
 if(history.length<3||lead<=0||!Number.isFinite(lead)||history.some((p,i)=>![p.frame,p.time,p.x,p.width].every(Number.isFinite)||p.width<=0||i>0&&(p.frame<=history[i-1].frame||p.time<=history[i-1].time)))throw Error('Chronological image observations and positive lead required');
 const last=history.at(-1)!,dt=median(history.slice(1).map((p,i)=>p.time-history[i].time));
 if(['LOCAL7','CV_SMOOTH','CV_RESPONSIVE','IMM'].includes(model.name)){
  const f=fitForecastV8(history.map(p=>({time:p.time,x:p.x,y:0,radius:p.width/2,positionSigma:p.positionSigma,radiusSigma:p.radiusSigma,source:'OBSERVED_IMAGE_DERIVED' as const})),model.name as PredictorV8)(last.time+lead*dt);
  return {x:f.x,width:2*f.radius};
 }
 const points=history.slice(-(model.window??5));let slope=0,intercept=last.x;
 if(model.name==='LAST2'){const a=history.at(-2)!;slope=(last.x-a.x)/(last.frame-a.frame);}
 if(model.name==='OLS5'){
  const mx=points.reduce((a,p)=>a+p.frame,0)/points.length,my=points.reduce((a,p)=>a+p.x,0)/points.length;
  slope=points.reduce((a,p)=>a+(p.frame-mx)*(p.x-my),0)/points.reduce((a,p)=>a+(p.frame-mx)**2,0);intercept=my+slope*(last.frame-mx);
 }
 if(model.name==='ROBUST'){
  const slopes:number[]=[];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)slopes.push((points[j].x-points[i].x)/(points[j].frame-points[i].frame));
  slope=median(slopes);intercept=median(points.map(p=>p.x+slope*(last.frame-p.frame)));
 }
 const damping=model.damping??0,advance=damping?(-Math.expm1(-damping*lead))/damping:lead;
 return {x:intercept+slope*advance,width:model.widthMode==='median3'?median(history.slice(-3).map(p=>p.width)):last.width};
}
export type PressureConfig={kind:'median'|'trend';window:number;floor:number;consecutive:number;mad:number;gap:number};
export const LEGACY_PRESSURE:PressureConfig={kind:'median',window:30,floor:.8,consecutive:3,mad:4,gap:0};
export type PressureAlert={time:number;drop:number;threshold:number};
/** Streaming equivalent of the frozen detector; only preceding samples enter a baseline. */
export function pressureAlerts(samples:number[][],config:PressureConfig){
 let left=0,run=0,segmentStart=samples[0]?.[0]??0,lastAlert=-Infinity;
 const alerts:PressureAlert[]=[],eligible:[number,number][]=[];let interval:[number,number]|null=null;
 for(let i=0;i<samples.length;i++){
  const [time,value]=samples[i];if(!Number.isFinite(time)||!Number.isFinite(value)||i>0&&time<=samples[i-1][0])throw Error('Monotone pressure samples required');
  if(i&&time-samples[i-1][0]>1.1){left=i;run=0;segmentStart=time;if(interval)eligible.push(interval);interval=null;}
  while(left<i&&samples[left][0]<time-config.window)left++;
  // Common 100-second warmup supports every candidate and gap reset.
  if(time-segmentStart>=100){if(!interval)interval=[time,time];else interval[1]=time;}
  const past=samples.slice(left,i).filter(p=>p[0]<=time-config.gap);
  if(past.length<20){run=0;continue;}
  let baseline:number,sigma:number;
  if(config.kind==='median'){baseline=median(past.map(p=>p[1]));sigma=1.4826*median(past.map(p=>Math.abs(p[1]-baseline)));}
  else{
   const mt=past.reduce((a,p)=>a+p[0]-time,0)/past.length,mp=past.reduce((a,p)=>a+p[1],0)/past.length;
   const slope=past.reduce((a,p)=>a+(p[0]-time-mt)*(p[1]-mp),0)/past.reduce((a,p)=>a+(p[0]-time-mt)**2,0);
   baseline=mp-slope*mt;const residual=past.map(p=>p[1]-(baseline+slope*(p[0]-time))),centre=median(residual);
   baseline+=centre;sigma=1.4826*median(residual.map(r=>Math.abs(r-centre)));
  }
  const drop=baseline-value,threshold=Math.max(config.floor,config.mad*sigma);run=drop>=threshold?run+1:0;
  if(run===config.consecutive&&time-segmentStart>=100&&time-lastAlert>=60){alerts.push({time,drop,threshold});lastAlert=time;}
 }
 if(interval)eligible.push(interval);
 return {alerts,eligible,eligibleHours:eligible.reduce((a,p)=>a+p[1]-p[0]+1,0)/3600};
}
export function matchCatalog(alerts:PressureAlert[],catalog:{id:string;time:number;amplitude:number}[],eligible:[number,number][],tolerance=30){
 const events=catalog.filter(c=>c.amplitude>=.5&&eligible.some(([a,b])=>c.time-tolerance>=a&&c.time+tolerance<=b));
 const usable=alerts.filter(a=>eligible.some(([l,r])=>a.time>=l&&a.time<=r));
 const pairs=events.flatMap((e,i)=>usable.map((a,j)=>({i,j,d:Math.abs(a.time-e.time)})).filter(p=>p.d<=tolerance)).sort((a,b)=>a.d-b.d);
 const ei=new Set<number>(),ai=new Set<number>(),matches:{event:string;catalogTime:number;alertTime:number;leadToCatalogCentre:number}[]=[];
 for(const p of pairs)if(!ei.has(p.i)&&!ai.has(p.j)){ei.add(p.i);ai.add(p.j);matches.push({event:events[p.i].id,catalogTime:events[p.i].time,alertTime:usable[p.j].time,leadToCatalogCentre:events[p.i].time-usable[p.j].time});}
 // Alerts near excluded edge events cannot be classified as unmatched.
 const excluded=catalog.filter(c=>!events.some(e=>e.id===c.id));
 const unmatched=usable.filter((a,i)=>!ai.has(i)&&!excluded.some(c=>Math.abs(c.time-a.time)<=tolerance));
 const recall=events.length?matches.length/events.length:null,precision=matches.length+unmatched.length?matches.length/(matches.length+unmatched.length):null;
 return {eligibleEvents:events.length,matches,missed:events.filter((_,i)=>!ei.has(i)).map(e=>e.id),unmatched,
  catalogRecall:recall,catalogAgreement:precision,agreementF1:recall&&precision?2*recall*precision/(recall+precision):0};
}
