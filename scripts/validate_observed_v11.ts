import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {predictImage,pressureAlerts,matchCatalog,LEGACY_PRESSURE} from '../src/observed-validation-v11';
import type {ImageModel,ImagePoint,PressureConfig} from '../src/observed-validation-v11';
const root='public/data/hazards/observed-v11/',mode=process.argv[2]??'freeze';
const load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(n:string,x:unknown)=>writeFileSync(root+n,JSON.stringify(x,null,2),{flag:'wx'});
const mean=(a:number[])=>a.reduce((s,v)=>s+v,0)/a.length,rmse=(a:number[])=>Math.sqrt(mean(a.map(x=>x*x)));
mkdirSync(root,{recursive:true});
if(mode==='freeze'){
 const candidates:ImageModel[]=[];for(const window of [3,5,7])for(const damping of [0,.35])for(const widthMode of ['last','median3'] as const)candidates.push({name:'ROBUST',window,damping,widthMode});
 const pressureConfigs:PressureConfig[]=[];for(const window of [30,60,90])for(const floor of [.5,.8])for(const consecutive of [2,3])pressureConfigs.push({kind:'trend',window,floor,consecutive,mad:4,gap:5});
 save('protocol.json',{frozenAt:new Date().toISOString(),scope:'Retrospective existing observations; previously studied clips/days, not new independent events. Component validation only.',
  image:{events:['PIA26074','PIA26528','PIA24039'],split:'For test index i: selection clip (i+1)%3, calibration clip (i+2)%3; test clip never enters selection or interval calibration.',
   history:5,leads:[1,2,3],units:'image pixels and frame steps; no metre conversion; PIA24039 seconds are assumed uniform',candidates,
   baselineNames:['PERSISTENCE','LAST2','OLS5','LOCAL7','CV_SMOOTH','CV_RESPONSIVE','IMM'],selectionLoss:'mean(abs(x error)/origin width + 0.5*abs(width error)/origin width)',
   interval:'90% empirical absolute residual quantile of separate calibration clip, by lead and normalized by origin width. No exchangeability or coverage guarantee.',
   gate:'Against CV_SMOOTH: >=10% lower equal-clip mean RMSE; no clip RMSE or width MAE worse; empirical position coverage >=90% on every clip. Engineering target, not safety standard.',
   navigationPromotion:false},
  pressure:{developmentSol:57,evaluationSol:215,configs:pressureConfigs,legacy:LEGACY_PRESSURE,warmupSeconds:100,matchingSeconds:[10,30,60],primaryMatchingSeconds:30,refractorySeconds:60,
   catalog:'Hueso Table S2 amplitude >=0.5 Pa within fully observed common scoring intervals; nearest one-to-one time matching. Weak/edge catalog windows excluded from unmatched alarm count.',
   selection:'Maximum catalog-agreement F1 on sol57, then fewer unmatched alarms, then parameter order. This proxy is not truth-based precision.',
   gate:'Sol215 catalog recall improves and unmatched alerts/hour does not increase versus legacy at 30 s matching. Catalogue verification, not dusty-vortex specificity.'},
  hashes:Object.fromEntries(['src/observed-validation-v11.ts','src/vortex-forecast-v8.ts','src/local-dust-tracker.ts','src/hazard-tracker.ts','scripts/validate_observed_v11.ts','scripts/prepare_observed_v11.py','public/data/hazards/local-observations.json',root+'pressure-input.json'].map(p=>[p,hash(p)]))});
 console.log('Frozen component validation protocol.');process.exit(0);
}
const protocol=load(root+'protocol.json');for(const [p,h] of Object.entries(protocol.hashes))if(hash(p)!==h)throw Error('Changed after freeze: '+p);
if(mode==='images'){
 if(existsSync(root+'image-results.json'))throw Error('Refusing overwrite');
 const events=load('public/data/hazards/local-observations.json').events as {id:string;cadenceSeconds:number;cadenceKind:string;points:ImagePoint[]}[];
 function forecastRows(e:typeof events[number],model:ImageModel){const rows:any[]=[];
  for(let i=4;i<e.points.length;i++)for(const lead of [1,2,3]){const truth=e.points[i+lead];if(!truth)continue;
   const origin=e.points[i],f=predictImage(e.points.slice(0,i+1),lead,model),dx=truth.x-origin.x,epsilon=Math.max(origin.positionSigma,truth.positionSigma)*2;
   rows.push({event:e.id,originFrame:origin.frame,targetFrame:truth.frame,lead,leadSeconds:truth.time-origin.time,secondsStatus:e.cadenceKind,originX:origin.x,originWidth:origin.width,predictedX:f.x,observedX:truth.x,predictedWidth:f.width,observedWidth:truth.width,xError:f.x-truth.x,widthError:f.width-truth.width,normalizedError:Math.abs(f.x-truth.x)/origin.width,normalizedWidthError:Math.abs(f.width-truth.width)/origin.width,directionCorrect:Math.abs(dx)>epsilon?Math.sign(f.x-origin.x)===Math.sign(dx):null});
  }return rows;
 }
 const folds:any[]=[],rows:any[]=[],summaries:any[]=[];
 for(let index=0;index<events.length;index++){
  const test=events[index],train=events[(index+1)%3],cal=events[(index+2)%3];
  const selection=protocol.image.candidates.map((config:ImageModel)=>{const r=forecastRows(train,config);return {config,loss:mean(r.map(v=>v.normalizedError+.5*v.normalizedWidthError))};}).sort((a:any,b:any)=>a.loss-b.loss);
  const selected:ImageModel=selection[0].config,calRows=forecastRows(cal,selected);
  const q=(lead:number,key:string)=>{const a=calRows.filter(r=>r.lead===lead).map(r=>r[key]).sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.ceil((a.length+1)*.9)-1)];};
  const intervals=[1,2,3].map(lead=>({lead,calibrationCount:calRows.filter(r=>r.lead===lead).length,positionQ:q(lead,'normalizedError'),widthQ:q(lead,'normalizedWidthError')}));
  folds.push({test:test.id,selectionEvent:train.id,calibrationEvent:cal.id,selected,selection,intervals});
  for(const model of [...protocol.image.baselineNames.map((name:string)=>({name})),{...selected,label:'SELECTED_ROBUST'}]){
   const name=model.label??model.name,r=forecastRows(test,model).map(v=>{const band=intervals.find(q=>q.lead===v.lead)!;return {...v,model:name,...(name==='SELECTED_ROBUST'?{positionHalfWidth:band.positionQ*v.originWidth,widthHalfWidth:band.widthQ*v.originWidth,positionCovered:v.normalizedError<=band.positionQ,widthCovered:v.normalizedWidthError<=band.widthQ}:{})};});
   rows.push(...r);for(const lead of [0,1,2,3]){const a=r.filter(v=>!lead||v.lead===lead),direction=a.filter(v=>v.directionCorrect!==null);
    summaries.push({event:test.id,model:name,lead:lead||'ALL',forecasts:a.length,rmsePx:rmse(a.map(v=>v.xError)),maePx:mean(a.map(v=>Math.abs(v.xError))),widthMAEPx:mean(a.map(v=>Math.abs(v.widthError))),directionCount:direction.length,directionAccuracy:direction.length?mean(direction.map(v=>+v.directionCorrect!)):null,
     ...(name==='SELECTED_ROBUST'?{positionCoverage:mean(a.map(v=>+v.positionCovered)),widthCoverage:mean(a.map(v=>+v.widthCovered)),meanPositionIntervalWidth:mean(a.map(v=>v.positionHalfWidth*2))}:{})});
   }
  }
 }
 const baseline=summaries.filter(s=>s.model==='CV_SMOOTH'&&s.lead==='ALL'),candidate=summaries.filter(s=>s.model==='SELECTED_ROBUST'&&s.lead==='ALL');
 const gain=1-mean(candidate.map(s=>s.rmsePx))/mean(baseline.map(s=>s.rmsePx));
 const gate={gainAtLeast10Percent:gain>=.1,noClipPositionWorse:candidate.every((s,i)=>s.rmsePx<=baseline[i].rmsePx),noClipWidthWorse:candidate.every((s,i)=>s.widthMAEPx<=baseline[i].widthMAEPx),coverageEveryClip:candidate.every(s=>s.positionCoverage>=.9)};
 const result={createdAt:new Date().toISOString(),protocolHash:hash(root+'protocol.json'),unit:'PIXELS',independentClips:3,previouslyStudied:true,folds,summaries,gain,gate,pass:Object.values(gate).every(Boolean),navigationPromotion:false,rows};
 save('image-results.json',result);console.log(JSON.stringify({baseline,candidate,gain,gate},null,2));process.exit(0);
}
const pressure=load(root+'pressure-input.json');
function assess(sol:number,config:PressureConfig){const day=pressure.days.find((d:any)=>d.sol===sol),began=performance.now(),scan=pressureAlerts(day.samples,config);
 const matches=protocol.pressure.matchingSeconds.map((t:number)=>({tolerance:t,...matchCatalog(scan.alerts,day.catalog,scan.eligible,t)}));
 return {sol,config,samples:day.samples.length,eligibleHours:scan.eligibleHours,eligibleIntervals:scan.eligible,alerts:scan.alerts,matches,elapsedMs:performance.now()-began};}
if(mode==='pressure-development'){
 if(existsSync(root+'pressure-selection.json'))throw Error('Refusing overwrite');
 const candidates=protocol.pressure.configs.map((c:PressureConfig)=>assess(57,c));
 const primary=(r:any)=>r.matches.find((m:any)=>m.tolerance===30);
 candidates.sort((a:any,b:any)=>primary(b).agreementF1-primary(a).agreementF1||primary(a).unmatched.length-primary(b).unmatched.length);
 const legacy=assess(57,LEGACY_PRESSURE);save('pressure-selection.json',{createdAt:new Date().toISOString(),protocolHash:hash(root+'protocol.json'),selected:candidates[0].config,candidates,legacy});
 console.log(JSON.stringify({selected:candidates[0].config,development:primary(candidates[0]),legacy:primary(legacy)},null,2));process.exit(0);
}
if(mode==='pressure-evaluation'){
 if(existsSync(root+'pressure-results.json'))throw Error('Refusing overwrite');const selection=load(root+'pressure-selection.json');
 if(selection.protocolHash!==hash(root+'protocol.json'))throw Error('Selection protocol mismatch');
 const legacy=assess(215,LEGACY_PRESSURE),candidate=assess(215,selection.selected),p=(x:any)=>x.matches.find((m:any)=>m.tolerance===30);
 const gate={recallImproves:p(candidate).catalogRecall>p(legacy).catalogRecall,unmatchedRateDoesNotIncrease:p(candidate).unmatched.length/candidate.eligibleHours<=p(legacy).unmatched.length/legacy.eligibleHours};
 save('pressure-results.json',{createdAt:new Date().toISOString(),protocolHash:hash(root+'protocol.json'),selectionHash:hash(root+'pressure-selection.json'),legacy,candidate,gate,pass:Object.values(gate).every(Boolean),warningReference:'LEAD_TO_RETROSPECTIVE_PRESSURE_CENTRE_NOT_REMOTE_BOUNDARY'});
 console.log(JSON.stringify({legacy:p(legacy),candidate:p(candidate),eligibleHours:candidate.eligibleHours,gate},null,2));process.exit(0);
}
throw Error('Unknown mode');
