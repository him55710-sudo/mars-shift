import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {rangedFix,predictRanged,authorizeMetricOverlay} from '../src/ranged-tracker-v12';
import type {RangedDetection,RangedFix,MotionModel} from '../src/ranged-tracker-v12';
const root='public/data/hazards/metric-v12/',mode=process.argv[2];
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex'),read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const save=(n:string,x:unknown)=>writeFileSync(root+n,JSON.stringify(x,null,2),{flag:'wx'}),inputs=read(root+'inputs.json');
if(mode==='freeze'){
 save('ranged-protocol.json',{frozenAt:new Date().toISOString(),phase:'Follow-up after identifying invalid ground-contact interpretation of author scale marks. Previous protocol/results preserved, not used as an accuracy benchmark.',
  units:'Metres / seconds / local north-east. Range is separately supplied published image interpretation, not computed from apparent width.',
  eventCount:1,observedRangeFrames:4,models:['PERSISTENCE','LAST2','OLS','WEIGHTED_CV'],history:2,maxFrameLead:2,
  inputs:'Author approximate horizontal ranges 110,80,55(midpoint of50–60),30 m; source camera rays at digitized horizontal dust marks; exact PDS exposure SCLK. Published visible dust widths 2,11,11,11 m stay separate from fitted vortex diameter25m.',
  uncertainty:{seed:120215,samples:2000,rangeSigmaFraction:.1,minRangeSigma:3,pixelSigma:4,sharedRangeScaleSigma:.05,sharedAzimuthSigmaDegrees:.1,
   meaning:'Declared sensitivity assumptions, not calibrated instrument errors or confidence guarantees. Normal range/angle draws; common scale/azimuth draw per event.',alternativeFractions:[.05,.2]},
  evaluation:'Three chronological forecast-target pairs, one event, no tuning or model promotion. Report metric discrepancy to later reconstructed coordinates and published approximate ranges. They share geometric calibration; neither is surveyed independent centre truth.',
  missingRange:'Never silently assign a default range or velocity. Metric position unavailable until a range provider is present.',
  navigation:'Retrospective published range cannot authorize live navigation. SITE7/DRIVE2050 must never be overlaid on Sol477/Drive1004.',
  hashes:Object.fromEntries([root+'inputs.json','src/ranged-tracker-v12.ts','src/metric-vortex-v12.ts','src/vendor/nasa-cahvore.js','scripts/analyze_ranged_v12.ts'].map(p=>[p,hash(p)]))});
 console.log('Frozen ranged observation protocol.');process.exit(0);
}
if(mode!=='evaluate')throw Error('Use freeze then evaluate');const protocol=read(root+'ranged-protocol.json');
for(const [p,h]of Object.entries(protocol.hashes))if(hash(p)!==h)throw Error('Frozen source changed: '+p);
const detections:RangedDetection[]=inputs.annotations.map((a:any,i:number)=>({id:inputs.products[i].id,time:inputs.products[i].time,pixel:a.pixel,
 horizontalRange:inputs.referenceRanges[i].range,rangeSigma:Math.max(3,.1*inputs.referenceRanges[i].range),pixelSigma:4,visibleDustWidth:i===0?2:11,
 source:'PUBLISHED_IMAGE_ESTIMATE',crs:'JEZERO_SITE7_DRIVE2050_LOCAL_NE',independentAccuracyValidated:false}));
const fixes=detections.map((d,i)=>rangedFix(inputs.products[i].camera,d));
const pairs:{origin:number;target:number}[]=[];for(let i=1;i<fixes.length-1;i++)for(let j=i+1;j<=Math.min(i+2,fixes.length-1);j++)pairs.push({origin:i,target:j});
const forecasts=pairs.flatMap(p=>protocol.models.map((model:MotionModel)=>{
 const f=predictRanged(fixes.slice(0,p.origin+1),fixes[p.target].time,model),r=inputs.referenceRanges[p.target];
 return {...p,model,leadSeconds:f.time-fixes[p.origin].time,...f,positionDiscrepancy:Math.hypot(f.north-fixes[p.target].north,f.east-fixes[p.target].east),rangeDiscrepancy:f.range-r.range,rangeIntervalMiss:Math.max(r.interval[0]-f.range,0,f.range-r.interval[1])};
}));
function ensemble(fraction:number){
 let state=protocol.uncertainty.seed;const uniform=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;},normal=()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
 const samples:RangedFix[][]=[];
 for(let k=0;k<protocol.uncertainty.samples;k++){
  const scale=1+normal()*.05,angle=normal()*.1*Math.PI/180;
  samples.push(detections.map((d,i)=>{
   const f=rangedFix(inputs.products[i].camera,{...d,horizontalRange:Math.max(2,d.horizontalRange*scale+normal()*Math.max(3,d.horizontalRange*fraction)),pixel:[d.pixel[0]+normal()*4,d.pixel[1]+normal()*4]});
   const n=f.north*Math.cos(angle)-f.east*Math.sin(angle),e=f.north*Math.sin(angle)+f.east*Math.cos(angle);return {...f,north:n,east:e};
  }));
 }
 const q=(v:number[],p:number)=>v.sort((a,b)=>a-b)[Math.floor((v.length-1)*p)];
 return {rangeSigmaFraction:fraction,positions:fixes.map((f,i)=>({frame:i,range95:[q(samples.map(s=>s[i].horizontalRange),.025),q(samples.map(s=>s[i].horizontalRange),.975)],radius95:q(samples.map(s=>Math.hypot(s[i].north-f.north,s[i].east-f.east)),.95)})),
 forecasts:forecasts.map((f:any)=>{const a=samples.map(s=>predictRanged(s.slice(0,f.origin+1),s[f.target].time,f.model));return {origin:f.origin,target:f.target,model:f.model,range95:[q(a.map(v=>v.range),.025),q(a.map(v=>v.range),.975)],radius95:q(a.map(v=>Math.hypot(v.north-f.north,v.east-f.east)),.95),speed95:[q(a.map(v=>v.speed),.025),q(a.map(v=>v.speed),.975)]};})};
}
const uncertainty=ensemble(.1),alternatives=protocol.uncertainty.alternativeFractions.map(ensemble);
const mean=(a:number[])=>a.reduce((s,n)=>s+n,0)/a.length;
const summaries=protocol.models.map((model:string)=>{const a=forecasts.filter((f:any)=>f.model===model);return {model,pairs:a.length,positionRMSE:Math.sqrt(mean(a.map((f:any)=>f.positionDiscrepancy**2))),rangeMAE:mean(a.map((f:any)=>Math.abs(f.rangeDiscrepancy)))};});
const frames=fixes.map((fix,i)=>({frame:i,fix,source:inputs.products[i],uncertainty:uncertainty.positions[i],
 forecasts:i<1?[]:[2,5,10].map(lead=>predictRanged(fixes.slice(0,i+1),fix.time+lead,'WEIGHTED_CV')),
 gate:authorizeMetricOverlay(fix,'JEZERO_DRIVE1004',uncertainty.positions[i].radius95,5,fix.time)}));
const result={createdAt:new Date().toISOString(),protocolHash:hash(root+'ranged-protocol.json'),frames,forecasts,summaries,uncertainty,alternatives,
 publishedFit:inputs.paper,eventCount:1,frameCount:4,promotion:false,
 limitation:'Metric reconstruction from published approximate ranges and calibrated camera rays. Forecast discrepancy is not verified metre-scale accuracy. Future 2/5/10 s HUD points have no measured target beyond the last image.'};
save('ranged-results.json',result);console.log(JSON.stringify({summaries,forecasts,positions:uncertainty.positions},null,2));
