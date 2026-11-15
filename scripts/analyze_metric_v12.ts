import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cameraRay,fitGround,intersectGround,reconstruct,forecastMetric,metricNavigationGate} from '../src/metric-vortex-v12';
import type {Camera,Ground,Landmark,MetricFix} from '../src/metric-vortex-v12';
const root='public/data/hazards/metric-v12/',mode=process.argv[2];
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(n:string,x:unknown)=>writeFileSync(root+n,JSON.stringify(x,null,2),{flag:'wx'});
const inputs=read(root+'inputs.json');
if(mode==='freeze'){
 save('protocol.json',{frozenAt:new Date().toISOString(),event:inputs.event,
  purpose:'Retrospective metric geometry reconstruction and short rolling forecasts. One event; no independent surveyed centre trajectory. No automatic online localization validation.',
  calibration:'CAHVORE type 2 with PDS subframe/downsampling already included in H,V. ROVER_NAV to SITE north/east/down quaternion. Three published feature ranges fit local planar along-view profile; cross-slope assumed zero. Wheel-track band is withheld.',
  annotations:'Digitized published visible-cloud scale marks. RANSAC only maps figure pixels to PDS pixels. Pixel sigma 4 is a sensitivity assumption, not annotation validation.',
  reference:'Published approximate cloud ranges 110,80,50–60,30 m used only for agreement evaluation. Not independent 2D truth. Table 1 fitted speed and vortex diameter never enter reconstruction or forecast.',
  models:['PERSISTENCE','LAST2','OLS'],forecasts:'Every available one/two frame ahead pair after two fixes, identical times and inputs; no parameter selection.',
  geometryBaseline:'Flat local z=0 ground vs fixed calibrated terrain profile. No retuning after evaluation.',
  uncertainty:{seed:2151201,samples:1200,pixelSigma:4,rangeSigma:'max(1 m, 5% of control range)',localTerrainSigma:.25,
   meaning:'Monte Carlo sensitivity only, not calibrated 95% coverage. Shared calibration draw across all frames, independent annotation/terrain errors.',alternatives:[{pixel:2,terrain:.1},{pixel:8,terrain:.5}]},
  checks:['withheld wheel-track-band range','leave-one-control-out sensitivity','rolling future reconstruction discrepancy','future published-range agreement','ground height/pixel sensitivity','numeric camera and stereo regressions'],
  promotion:'Metric-looking coordinates alone never enable navigation. Independent metric truth, matching CRS, fresh observations and uncertainty below available clearance are required.',
  hashes:Object.fromEntries([root+'inputs.json','src/metric-vortex-v12.ts','src/vendor/nasa-cahvore.js','scripts/analyze_metric_v12.ts','scripts/prepare_metric_v12.py'].map(p=>[p,hash(p)]))});
 console.log('Frozen metric protocol.');process.exit(0);
}
if(mode!=='evaluate')throw Error('Use freeze then evaluate');
const protocol=read(root+'protocol.json');for(const [p,h] of Object.entries(protocol.hashes))if(hash(p)!==h)throw Error('Frozen source changed: '+p);
const camera:Camera=inputs.products[0].camera,controls:Landmark[]=inputs.landmarks.filter((l:Landmark)=>l.role==='calibration');
const ground=fitGround(camera,controls),flat:Ground={along:ground.along,intercept:0,slope:0};
const check=(l:Landmark,g:Ground)=>{const p=intersectGround(cameraRay(camera,l.pixel),g);return {id:l.id,publishedRange:l.range,estimatedRange:p?Math.hypot(p[0],p[1]):null,error:p?Math.hypot(p[0],p[1])-l.range:null};};
const landmarkChecks=inputs.landmarks.map((l:Landmark)=>({role:l.role,...check(l,ground),flat:check(l,flat)}));
const leaveOut=controls.map((l,i)=>check(l,fitGround(camera,controls.filter((_,j)=>i!==j))));
const fixes:MetricFix[]=inputs.annotations.map((a:any)=>reconstruct(inputs.products[a.frame].camera,ground,a.pixel,a.edges,inputs.products[a.frame].time));
if(fixes.some(x=>!x))throw Error('A recorded annotation cannot intersect calibrated ground');
const comparisons=inputs.annotations.map((a:any,i:number)=>{
 const reference=inputs.referenceRanges[i],f=fixes[i],base=reconstruct(inputs.products[a.frame].camera,flat,a.pixel,a.edges,f.time);
 return {frame:a.frame,reference,...f,rangeAgreementError:f.range-reference.range,flatRange:base?.range??null,flatAgreementError:base?base.range-reference.range:null};
});
const pairs:{origin:number;target:number}[]=[];for(let i=1;i<fixes.length-1;i++)for(let j=i+1;j<=Math.min(i+2,fixes.length-1);j++)pairs.push({origin:i,target:j});
const forecasts=pairs.flatMap(({origin,target})=>protocol.models.map((model:'PERSISTENCE'|'LAST2'|'OLS')=>{
 const f=forecastMetric(fixes.slice(0,origin+1),fixes[target].time,model),reference=inputs.referenceRanges[target];
 return {origin,target,leadSeconds:fixes[target].time-fixes[origin].time,model,...f,
  reconstructionDiscrepancy:Math.hypot(f.north-fixes[target].north,f.east-fixes[target].east),
  rangeAgreementError:f.range-reference.range,rangeIntervalMiss:Math.max(reference.interval[0]-f.range,0,f.range-reference.interval[1])};
}));
function monteCarlo(pixelSigma:number,terrainSigma:number){
 let state=protocol.uncertainty.seed;const uniform=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return (state+.5)/4294967296;};
 const normal=()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
 const sampled:MetricFix[][]=[];
 for(let i=0;i<protocol.uncertainty.samples;i++){
  try{
   const ls=controls.map(l=>({...l,pixel:l.pixel.map(v=>v+normal()*pixelSigma),range:Math.max(1,l.range+normal()*l.rangeSigmaAssumption)}));
   const g=fitGround(camera,ls);
   const frame=inputs.annotations.map((a:any)=>{
    const du=normal()*pixelSigma,dv=normal()*pixelSigma;
    return reconstruct(inputs.products[a.frame].camera,g,[a.pixel[0]+du,a.pixel[1]+dv],a.edges.map((e:number[])=>[e[0]+normal()*pixelSigma,e[1]+dv]),inputs.products[a.frame].time,normal()*terrainSigma);
   });
   if(frame.every((x:MetricFix|null)=>x&&x.range<10000))sampled.push(frame);
  }catch{/* Retain failure fraction; never silently certify rejected rays. */}
 }
 const q=(v:number[],p:number)=>[...v].sort((a,b)=>a-b)[Math.floor((v.length-1)*p)];
 return {pixelSigma,terrainSigma,samples:protocol.uncertainty.samples,valid:sampled.length,invalidFraction:1-sampled.length/protocol.uncertainty.samples,
  positions:fixes.map((f,i)=>({frame:i,range95:[q(sampled.map(s=>s[i].range),.025),q(sampled.map(s=>s[i].range),.975)],width95:[q(sampled.map(s=>s[i].width),.025),q(sampled.map(s=>s[i].width),.975)],
   sensitivityRadius95:q(sampled.map(s=>Math.hypot(s[i].north-f.north,s[i].east-f.east)),.95)})),
  forecasts:forecasts.map((f:any)=>{const values=sampled.map(s=>forecastMetric(s.slice(0,f.origin+1),s[f.target].time,f.model));return {origin:f.origin,target:f.target,model:f.model,range95:[q(values.map(v=>v.range),.025),q(values.map(v=>v.range),.975)],speed95:[q(values.map(v=>v.speed),.025),q(values.map(v=>v.speed),.975)]};})};
}
const uncertainty=monteCarlo(4,.25),sensitivity=protocol.uncertainty.alternatives.map((s:any)=>monteCarlo(s.pixel,s.terrain));
const mean=(x:number[])=>x.reduce((a,b)=>a+b,0)/x.length;
const summaries=protocol.models.map((model:string)=>{const a=forecasts.filter((f:any)=>f.model===model);return {model,pairs:a.length,rangeAgreementMAE:mean(a.map((f:any)=>Math.abs(f.rangeAgreementError))),reconstructionRMSE:Math.sqrt(mean(a.map((f:any)=>f.reconstructionDiscrepancy**2)))};});
const gates=fixes.map((_,i)=>metricNavigationGate({independentMetricTruth:false,crsMatches:false,error95Metres:uncertainty.positions[i].sensitivityRadius95,availableClearanceMetres:5,ageSeconds:0,maxAgeSeconds:2}));
const output={createdAt:new Date().toISOString(),protocolHash:hash(root+'protocol.json'),ground,landmarkChecks,leaveOut,comparisons,forecasts,summaries,uncertainty,sensitivity,gates,
 publishedFit:inputs.paper,scope:'One retrospective observed event; metre-valued reconstruction and agreement residuals, not independent metre accuracy. Sol 215 cannot be overlaid on Sol 477 geometry.'};
save('results.json',output);console.log(JSON.stringify({ground,landmarkChecks,leaveOut,comparisons,summaries,uncertainty:uncertainty.positions,invalidFraction:uncertainty.invalidFraction},null,2));
