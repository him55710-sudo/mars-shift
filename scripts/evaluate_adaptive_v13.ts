import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AdaptiveTracker,TRACKER_CANDIDATES,polarCovariance,mahalanobis,CHI2_95} from '../src/adaptive-tracker-v13';
import type {MetricMeasurement,TrackerConfig} from '../src/adaptive-tracker-v13';
import {fitForecastV8} from '../src/vortex-forecast-v8';
import {predictRanged} from '../src/ranged-tracker-v12';
import type {RangedFix,MotionModel} from '../src/ranged-tracker-v12';
const OUT='public/data/hazards/adaptive-v13/',mode=process.argv[2];mkdirSync(OUT,{recursive:true});
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(p:string,d:unknown)=>writeFileSync(OUT+p,JSON.stringify(d,null,2),{flag:'wx'});
const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
const mean=(a:number[])=>a.reduce((x,y)=>x+y,0)/a.length;
const quantile=(a:number[],p:number)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
const FAMILIES=['linear','turn','weave','accelerate','stop-start','hairpin','bias','outlier-burst'];
const files=['src/adaptive-tracker-v13.ts','src/vortex-forecast-v8.ts','src/ranged-tracker-v12.ts','scripts/evaluate_adaptive_v13.ts'];
type Case={id:string;seed:number;family:string;rangeSigma:number;bearingSigma:number;cadence:number;delay:number;dropout:boolean};
function cases(split:'development'|'confirmation'){
 const rows:Case[]=[];const families=split==='development'?FAMILIES.slice(0,4):FAMILIES;
 for(const family of families)for(const noise of [0,1,2])for(let k=0;k<8;k++)rows.push({id:`${split}-${family}-${noise}-${k}`,seed:(split==='development'?130100:139100)+rows.length*7919,family,rangeSigma:[.5,2,5][noise],bearingSigma:[.2,.5,1][noise]*Math.PI/180,cadence:[.5,1,2,4][k%4],delay:[0,.5,1,2][(k+1)%4],dropout:k>=4});
 return rows;
}
if(mode==='freeze'){
 save('protocol.json',{frozenAt:new Date().toISOString(),scope:'New synthetic sensor/motion stress test; no new independent observed trajectories. Historical Sol215 replay is a separate retrospective check.',
  development:cases('development'),confirmation:cases('confirmation'),families:FAMILIES,candidates:TRACKER_CANDIDATES,
  baselineNames:['PERSISTENCE','LAST2','OLS','WEIGHTED_CV','CV_SMOOTH_V8','IMM_V8'],leads:[2,5,10],origins:'8..48 seconds every 2 seconds; only observations delivered by origin',
  select:'Lowest development mean squared Euclidean forecast error pooled over all horizons/cases. No confirmation feedback.',
  calibration:'Development-only 95th percentile position NEES / chi2(2,.95), >=1. This is synthetic empirical scaling, not guaranteed event coverage.',
  promotion:'Research HUD only. Report per-family failures and paired event bootstrap; no operational navigation promotion or metre-accuracy claim.',
  measurement:'Polar Gaussian independent range/angle noise, optional dropout 20..27s. 2% large outliers; unseen bias and burst families in confirmation. Noise/cadence values are assumptions, not measured Mars sensor specs.',
  hashes:Object.fromEntries(files.map(f=>[f,sha(f)]))});console.log('Frozen 96 development and 192 confirmation trajectories before evaluation.');process.exit(0);
}
const protocol=read(OUT+'protocol.json');for(const [p,h]of Object.entries(protocol.hashes))if(sha(p)!==h)throw Error('Frozen source changed: '+p);
function simulate(c:Case){
 const r=rng(c.seed),normal=()=>Math.sqrt(-2*Math.log(r()))*Math.cos(2*Math.PI*r());
 const initialHeading=(r()-.5)*Math.PI*2,speed=2+r()*10,start=[30+r()*120,(r()-.5)*100],phase=r()*Math.PI*2;
 const truth:{x:number;y:number}[]=[{x:start[0],y:start[1]}];const tick=.05;
 for(let k=1;k<=1300;k++){
  const t=(k-.5)*tick;let angle=initialHeading,v=speed;
  if(c.family==='turn')angle+=Math.max(0,Math.min(1,(t-15)/10))*.9;
  if(c.family==='weave')angle+=.5*Math.sin(t/6+phase);
  if(c.family==='accelerate')v*=.5+t/50;
  if(c.family==='stop-start')v*=t>18&&t<28?.05:1;
  if(c.family==='hairpin')angle+=Math.max(0,Math.min(1,(t-20)/5))*2.4;
  const last=truth.at(-1)!;truth.push({x:last.x+v*Math.cos(angle)*tick,y:last.y+v*Math.sin(angle)*tick});
 }
 const at=(time:number)=>{const f=Math.min(truth.length-1,time/tick),i=Math.floor(f),j=Math.min(truth.length-1,i+1),u=f-i;return {x:truth[i].x+(truth[j].x-truth[i].x)*u,y:truth[i].y+(truth[j].y-truth[i].y)*u};};
 const observations:(MetricMeasurement&{arrival:number})[]=[];
 for(let time=0;time<=55;time+=c.cadence*(.8+.4*r())){
  if(c.dropout&&time>20&&time<27)continue;const p=at(time),a=Math.atan2(p.y,p.x),range=Math.hypot(p.x,p.y);
  const outlier=r()<.02||(c.family==='outlier-burst'&&time>22&&time<25);
  const rangeBias=c.family==='bias'?3:0,angleBias=c.family==='bias'?.6*Math.PI/180:0;
  const rr=Math.max(1,range+rangeBias+normal()*c.rangeSigma*(outlier?12:1)),aa=a+angleBias+normal()*c.bearingSigma*(outlier?12:1);
  observations.push({time,arrival:time+c.delay,x:rr*Math.cos(aa),y:rr*Math.sin(aa),covariance:polarCovariance(rr,aa,c.rangeSigma,c.bearingSigma),crs:'SYNTHETIC_LOCAL_NE'});
 }
 return {at,observations};
}
const baselines=protocol.baselineNames as string[];
function runCase(c:Case,models:Record<string,TrackerConfig>,scale=1){
 const {at,observations}=simulate(c),trackers=Object.fromEntries(Object.entries(models).map(([name,config])=>[name,new AdaptiveTracker(config)]));
 const history:MetricMeasurement[]=[],rows:any[]=[];let cursor=0;
 for(let now=8;now<=48;now+=2){
  while(cursor<observations.length&&observations[cursor].arrival<=now){const z=observations[cursor++];history.push(z);Object.values(trackers).forEach(t=>t.update(z));}
  if(history.length<2)continue;
  const ranged=history.map(z=>({time:z.time,north:z.x,east:z.y,crs:z.crs,rangeSigma:Math.sqrt((z.covariance[0]+z.covariance[2])/2),visibleDustWidth:11})) as RangedFix[];
  const obs=history.map(z=>({time:z.time,x:z.x,y:z.y,radius:5.5,positionSigma:Math.sqrt((z.covariance[0]+z.covariance[2])/2),radiusSigma:1,source:'SIMULATED_SENSOR' as const}));
  for(const name of [...baselines,...Object.keys(trackers)]){
   const begin=performance.now();let predict:(time:number)=>{x:number;y:number;covariance?:[number,number,number]};
   if(trackers[name])predict=t=>trackers[name].predict(t);
   else if(name.endsWith('_V8'))predict=fitForecastV8(obs,name==='IMM_V8'?'IMM':'CV_SMOOTH');
   else predict=t=>{const p=predictRanged(ranged,t,name as MotionModel);return {x:p.north,y:p.east};};
   const predictions=protocol.leads.map((lead:number)=>{const p=predict(now+lead),truth=at(now+lead),dx=p.x-truth.x,dy=p.y-truth.y;return {lead,error:Math.hypot(dx,dy),nees:p.covariance?mahalanobis(dx,dy,p.covariance):null,major:p.covariance?Math.sqrt(CHI2_95*scale*((p.covariance[0]+p.covariance[2])/2+Math.hypot((p.covariance[0]-p.covariance[2])/2,p.covariance[1]))):null};});
   rows.push({case:c.id,family:c.family,model:name,now,age:now-history.at(-1)!.time,milliseconds:performance.now()-begin,predictions});
  }
 }
 return rows;
}
function summarize(rows:any[],scale=1){return [...new Set(rows.map(r=>r.model))].map(model=>{const r=rows.filter(r=>r.model===model),p=r.flatMap(r=>r.predictions);return {model,origins:r.length,rmse:Math.sqrt(mean(p.map(p=>p.error**2))),mae:mean(p.map(p=>p.error)),p95:quantile(p.map(p=>p.error),.95),coverage:p[0].nees===null?null:mean(p.map(p=>Number(p.nees<=CHI2_95*scale))),meanMajor:p[0].major===null?null:mean(p.map(p=>p.major)),p95Ms:quantile(r.map(r=>r.milliseconds),.95),byLead:protocol.leads.map((lead:number)=>({lead,rmse:Math.sqrt(mean(p.filter(p=>p.lead===lead).map(p=>p.error**2)))}))};});}
function compact(rows:any[]){return [...new Set(rows.map(r=>r.case))].flatMap(id=>[...new Set(rows.map(r=>r.model))].map(model=>{const r=rows.filter(r=>r.case===id&&r.model===model),p=r.flatMap(r=>r.predictions);return {case:id,family:r[0].family,model,mse:mean(p.map(p=>p.error**2)),mae:mean(p.map(p=>p.error))};}));}
if(mode==='develop'){
 if(existsSync(OUT+'selection.json'))throw Error('Refusing overwrite');const rows=protocol.development.flatMap((c:Case)=>runCase(c,protocol.candidates));const summary=summarize(rows);
 const selected=summary.filter(s=>s.model in protocol.candidates).sort((a,b)=>a.rmse-b.rmse)[0];
 const nees=rows.filter((r:any)=>r.model===selected.model).flatMap((r:any)=>r.predictions.map((p:any)=>p.nees));const scale=Math.max(1,quantile(nees,.95)/CHI2_95);
 save('development.json',{createdAt:new Date().toISOString(),summary,cases:compact(rows)});
 save('selection.json',{selected:selected.model,config:protocol.candidates[selected.model],covarianceScale:scale,selectedAt:new Date().toISOString(),protocolHash:sha(OUT+'protocol.json'),reason:protocol.select});console.log(JSON.stringify({summary,selected:selected.model,scale},null,2));process.exit(0);
}
if(mode==='confirm'){
 if(existsSync(OUT+'confirmation.json'))throw Error('Refusing overwrite');const selected=read(OUT+'selection.json');if(selected.protocolHash!==sha(OUT+'protocol.json'))throw Error('Protocol changed');
 const rows=protocol.confirmation.flatMap((c:Case)=>runCase(c,{ADAPTIVE:selected.config},selected.covarianceScale));const summary=summarize(rows,selected.covarianceScale),byCase=compact(rows);
 const paired=baselines.map(model=>{const differences=protocol.confirmation.map((c:Case)=>byCase.find(r=>r.case===c.id&&r.model==='ADAPTIVE')!.mse-byCase.find(r=>r.case===c.id&&r.model===model)!.mse);const r=rng(13999);const draws=Array.from({length:2000},()=>mean(differences.map(()=>differences[Math.floor(r()*differences.length)])));return {baseline:model,meanMSEDifference:mean(differences),bootstrap95:[quantile(draws,.025),quantile(draws,.975)],worseCases:differences.filter((d:number)=>d>0).length,totalCases:differences.length};});
 save('confirmation.json',{createdAt:new Date().toISOString(),protocolHash:sha(OUT+'protocol.json'),selectionHash:sha(OUT+'selection.json'),summary,paired,byFamily:FAMILIES.map(family=>({family,summary:summarize(rows.filter((r:any)=>r.family===family),selected.covarianceScale)})),cases:byCase,independentObservedEvents:0});
 console.log(JSON.stringify({summary,paired},null,2));process.exit(0);
}
if(mode==='observed'){
 const selected=read(OUT+'selection.json'),old=read('public/data/hazards/metric-v12/ranged-results.json'),t=new AdaptiveTracker(selected.config),rows:any[]=[];
 for(let i=0;i<old.frames.length;i++){
  const f=old.frames[i].fix,a=Math.atan2(f.east,f.north),R=polarCovariance(f.horizontalRange,a,f.rangeSigma,4/740);t.update({time:f.time,x:f.north,y:f.east,covariance:R,crs:f.crs,systematic:polarCovariance(f.horizontalRange,a,.05*f.horizontalRange,.1*Math.PI/180)});
  const forecasts=[2,5,10].map(lead=>({...t.predict(f.time+lead),lead}));
  const targets=old.forecasts.filter((q:any)=>q.model==='LAST2'&&q.origin===i).map((q:any)=>{const p=t.predict(q.time),target=old.frames[q.target].fix;return {target:q.target,lead:q.leadSeconds,positionDiscrepancy:Math.hypot(p.x-target.north,p.y-target.east),rangeDiscrepancy:Math.hypot(p.x,p.y)-target.horizontalRange};});
  rows.push({frame:i,filtered:t.predict(f.time),forecasts,targets});
 }
 const targets=rows.flatMap(r=>r.targets);save('observed.json',{createdAt:new Date().toISOString(),selectionHash:sha(OUT+'selection.json'),frames:rows,positionRMSE:Math.sqrt(mean(targets.map(t=>t.positionDiscrepancy**2))),rangeMAE:mean(targets.map(t=>Math.abs(t.rangeDiscrepancy))),meaning:'Retrospective approximate-range reconstruction only, no independent surveyed centre truth. Model selected on synthetic development; synthetic covariance scale does not validate observed coverage.'});console.log(JSON.stringify({positionRMSE:Math.sqrt(mean(targets.map(t=>t.positionDiscrepancy**2))),rangeMAE:mean(targets.map(t=>Math.abs(t.rangeDiscrepancy)))}));process.exit(0);
}
throw Error('Use freeze, develop, confirm or observed');
