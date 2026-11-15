type GuardRow={case:string;arm:string;exposure:number;returned:boolean;reserveViolation:boolean};
type SandRow={case:string;arm:string;feasible:boolean;distance:number|null;totalMinutes:number|null;audit:{core:number;buffer:number;unknown:number}|null};
type ForecastSummary={model:string;rmse:number;coverage:number|null};
export type ReviewInputs={guard:{rows:GuardRow[]};sand:{rows:SandRow[]};forecast:{summary:ForecastSummary[];paired:{baseline:string;worseCases:number;totalCases:number}[];independentObservedEvents:number};metric:{eventCount:number;frameCount:number;forecasts:{origin:number;target:number}[]};observed:{positionRMSE:number};images:{independentClips:number}};
const mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/a.length;
const percent=(before:number,after:number)=>(before-after)/before*100;
function indexed<T extends {case:string;arm:string}>(rows:T[],arm:string){
 const a=rows.filter(r=>r.arm===arm),map=new Map(a.map(r=>[r.case,r]));
 if(!a.length||map.size!==a.length)throw Error('Missing or duplicate case/arm: '+arm);
 return map;
}
function sameCases(a:Map<string,unknown>,b:Map<string,unknown>){if(a.size!==b.size||[...a.keys()].some(k=>!b.has(k)))throw Error('Unpaired comparison cases');}
export function deriveReviewEvidence(input:ReviewInputs){
 const rows=input.guard.rows,legacy=indexed(rows,'MARS SHIFT'),guard=indexed(rows,'Guarded'),staticArm=indexed(rows,'Static');sameCases(legacy,guard);sameCases(staticArm,guard);
 const routeArms=['Static','MARS SHIFT','Adaptive','Guarded','Oracle'].map(arm=>{const a=indexed(rows,arm);sameCases(a,guard);return {arm,cases:a.size,contactSeconds:mean([...a.values()].map(x=>x.exposure)),noContact:[...a.values()].filter(x=>x.exposure<=1e-8).length,returnFailures:[...a.values()].filter(x=>!x.returned).length};});
 const contact=(arm:string)=>routeArms.find(row=>row.arm===arm)!.contactSeconds;
 const deltas=[...guard].map(([id,row])=>row.exposure-legacy.get(id)!.exposure),baseline=contact('Static'),current=contact('Guarded');
 const coverage=indexed(input.sand.rows,'COVERAGE_ONLY'),screened=indexed(input.sand.rows,'SAND_5M'),unscreened=indexed(input.sand.rows,'UNSCREENED');sameCases(coverage,screened);sameCases(unscreened,screened);
 const sandPairs=[...screened].filter(([id,row])=>row.feasible&&coverage.get(id)!.feasible).map(([id,b])=>({a:coverage.get(id)!,b}));
 if(!sandPairs.length)throw Error('No paired feasible sand cases');
 for(const {b} of sandPairs)if(!b.audit||b.audit.buffer||b.audit.unknown||b.audit.core)throw Error('Screened route violates exclusions');
 const defaultBefore=unscreened.get('registered-0')!,defaultAfter=screened.get('registered-0')!;
 if(!defaultBefore?.feasible||!defaultAfter?.feasible)throw Error('Default case unavailable');
 const f=input.forecast.summary.find(x=>x.model==='ADAPTIVE')!,fOld=input.forecast.summary.find(x=>x.model==='IMM_V8')!,pair=input.forecast.paired.find(x=>x.baseline==='IMM_V8')!;
 if(!f||!fOld||!pair)throw Error('Forecast baseline absent');
 const evidence={schemaVersion:1 as const,release:'v15',rubric:{scale:[1,5],weights:null,source:'https://www.spaceappschallenge.org/resources/judging-awards-guide/'},
  observations:{metricEvents:input.metric.eventCount,metricFrames:input.metric.frameCount,futurePairs:new Set(input.metric.forecasts.map(x=>`${x.origin}/${x.target}`)).size,previouslyStudiedImageClips:input.images.independentClips,reconstructedPositionRMSE:input.observed.positionRMSE,unit:'m',groundTruth:'PAPER_APPROXIMATE_RANGE_RECONSTRUCTION',validatedOneMetreAccuracy:false},
  forecast:{syntheticCases:pair.totalCases,independentObservedEvents:input.forecast.independentObservedEvents,previousRMSE:fOld.rmse,currentRMSE:f.rmse,reductionPercent:percent(fOld.rmse,f.rmse),coverage:f.coverage,worseCases:pair.worseCases},
  escape:{scope:'SYNTHETIC_VORTEX_ON_OBSERVED_DEM',cases:guard.size,arms:routeArms,versusStaticPercent:percent(baseline,current),versusLegacyPercent:percent(contact('MARS SHIFT'),current),betterCases:deltas.filter(d=>d< -1e-8).length,worseCases:deltas.filter(d=>d>1e-8).length,tiedCases:deltas.filter(d=>Math.abs(d)<=1e-8).length,realSafetyValidation:false},
  sand:{scope:'OBSERVED_TEXTURE_MAP_WITH_SYNTHETIC_MISSIONS',cases:screened.size,unscreenedFeasible:[...unscreened.values()].filter(x=>x.feasible).length,coverageOnlyFeasible:[...coverage.values()].filter(x=>x.feasible).length,screenedFeasible:[...screened.values()].filter(x=>x.feasible).length,pairedFeasible:sandPairs.length,pairedBufferBefore:sandPairs.reduce((s,{a})=>s+a.audit!.buffer,0),pairedBufferAfter:0,meanDistanceAdded:mean(sandPairs.map(({a,b})=>b.distance!-a.distance!)),defaultBeforeMetres:defaultBefore.distance!,defaultAfterMetres:defaultAfter.distance!,defaultBeforeCells:defaultBefore.audit!.buffer,defaultAfterCells:defaultAfter.audit!.buffer,independentSoilFailureLabels:0,validatedSinkageProbability:false},
  boundaries:{coRegisteredSandAndSol477:false,physicalHeadsetValidated:false,nasaEndorsement:false}};
 validateReviewEvidence(evidence);return evidence;
}
export type ReviewEvidence=ReturnType<typeof deriveReviewEvidence>;
export function validateReviewEvidence(value:unknown):void{
 const v=value as ReviewEvidence;
 if(v?.schemaVersion!==1||v.release!=='v15'||v.observations?.groundTruth!=='PAPER_APPROXIMATE_RANGE_RECONSTRUCTION'||v.escape?.scope!=='SYNTHETIC_VORTEX_ON_OBSERVED_DEM'||v.sand?.scope!=='OBSERVED_TEXTURE_MAP_WITH_SYNTHETIC_MISSIONS')throw Error('Evidence scope mismatch');
 for(const x of [v.observations.reconstructedPositionRMSE,v.forecast.currentRMSE,v.forecast.previousRMSE,v.escape.versusStaticPercent,v.sand.defaultBeforeMetres,v.sand.defaultAfterMetres])if(!Number.isFinite(x))throw Error('Evidence contains non-finite metric');
 if(v.observations.validatedOneMetreAccuracy!==false||v.escape.realSafetyValidation!==false||v.sand.validatedSinkageProbability!==false)throw Error('Unsupported operational claim');
 if(v.escape.betterCases+v.escape.worseCases+v.escape.tiedCases!==v.escape.cases||v.sand.pairedFeasible>v.sand.screenedFeasible||v.sand.screenedFeasible>v.sand.cases)throw Error('Evidence denominator mismatch');
}
