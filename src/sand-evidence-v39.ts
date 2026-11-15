import type {Terrain} from './planner';

export type SandCounts={tp:number;fp:number;tn:number;fn:number;precision:number|null;recall:number|null;falsePositiveRate:number|null;missRate:number|null;iou:number|null};
export type ImageRoute={cells:number;expertSandCells:number;path:number[]}|null;
export type SandBenchmark={schema:1;task:'terrain-sand-appearance';modelSHA256:string;model:string;source:string;threshold:number;testImages:number;testSiteDriveGroups:number;trainImages:number;calibrationImages:number;labeledLatticePixels:number;labelCoverage:number;stride:number;metrics:SandCounts;imageBootstrap95:Record<string,[number,number]>;rows:{known:number}[];examples:{selection:string;id:string;counts:number[];overlay:string;routeAudit:{width:number;height:number;coordinateSystem:string;baseline:ImageRoute;predicted:ImageRoute;expertReference:ImageRoute;start:number;target:number}|null}[];slip:{matchedBeforeDriveOutcomes:number;precision:null;recall:null;status:string};deployment:{automaticPhysicalExclusionsAllowed:false;reason:string;localReviewRequired:true};limitations:string[]};
export function validateSandBenchmark(value:unknown):SandBenchmark{
 const r=value as SandBenchmark,m=r?.metrics;
 if(r?.schema!==1||r.task!=='terrain-sand-appearance'||!Array.isArray(r.rows)||!m||r.testImages!==322||!Number.isFinite(r.threshold)||r.threshold<0||r.threshold>1||![m.tp,m.fp,m.tn,m.fn].every(n=>Number.isSafeInteger(n)&&n>=0)||r.labeledLatticePixels!==m.tp+m.fp+m.tn+m.fn||r.deployment?.automaticPhysicalExclusionsAllowed!==false||r.slip?.matchedBeforeDriveOutcomes!==0)throw Error('Invalid or out-of-scope NASA sand benchmark');
 const close=(v:number|null,a:number,b:number)=>b?typeof v==='number'&&Math.abs(v-a/b)<1e-10:v===null;
 if(!close(m.precision,m.tp,m.tp+m.fp)||!close(m.recall,m.tp,m.tp+m.fn)||!close(m.falsePositiveRate,m.fp,m.fp+m.tn)||!close(m.missRate,m.fn,m.tp+m.fn))throw Error('Benchmark counts and rates disagree');
 return r;
}
/** The frozen MSL appearance experiment cannot authorize physical Jezero exclusions.
 * A model promotion requires a separately versioned local registration and outcome study.
 * No caller may turn a UI confidence percentage into a soil-support measurement. */
export function sandModelRoutingGate(report:SandBenchmark|null){
 return {automaticExclusions:false as const,action:'LOCAL_REVIEW_REQUIRED' as const,reason:report?'MSL Navcam appearance validation only. This location and soil support have not been validated.':'Validation unavailable. Do not infer traversable ground from missing predictions.'};
}
export function applySandModelExclusions(t:Terrain,mask:ArrayLike<number>,report:SandBenchmark|null):Terrain{
 if(mask.length!==t.width*t.height)throw Error('Prediction registration mismatch');
 const gate=sandModelRoutingGate(report);
 if(!gate.automaticExclusions)throw Error(gate.reason);
 return t;
}
