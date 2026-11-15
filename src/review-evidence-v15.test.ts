import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {deriveReviewEvidence,validateReviewEvidence} from './review-evidence-v15';
import type {ReviewInputs} from './review-evidence-v15';
const read=(name:string)=>JSON.parse(readFileSync(new URL('../public/data/hazards/'+name,import.meta.url),'utf8'));
const inputs:ReviewInputs={guard:read('adaptive-v13/guard-results.json'),sand:read('sand-v14/results.json'),forecast:read('adaptive-v13/confirmation.json'),metric:read('metric-v12/ranged-results.json'),observed:read('adaptive-v13/observed.json'),images:read('observed-v11/image-results.json')};
it('keeps observations, repeated forecast pairs and synthetic cases separate',()=>{
 const e=deriveReviewEvidence(inputs);expect(e.observations.metricEvents).toBe(1);expect(e.observations.futurePairs).toBe(3);expect(e.forecast.syntheticCases).toBe(192);expect(e.forecast.independentObservedEvents).toBe(0);expect(e.escape.cases).toBe(36);expect(e.observations.validatedOneMetreAccuracy).toBe(false);
});
it('retains small incremental gains, ties and the failed sand cases',()=>{
 const e=deriveReviewEvidence(inputs);expect(e.escape.versusLegacyPercent).toBeLessThan(.1);expect(e.escape.versusStaticPercent).toBeGreaterThan(10);expect(e.sand.unscreenedFeasible).toBe(18);expect(e.sand.screenedFeasible).toBe(12);expect(e.sand.pairedBufferBefore).toBe(185);expect(e.sand.pairedFeasible).toBe(12);expect(e.sand.cases).toBe(26);
});
it('rejects a dropped or duplicated comparison case instead of reporting a biased gain',()=>{
 expect(()=>deriveReviewEvidence({...inputs,guard:{rows:inputs.guard.rows.slice(1)}})).toThrow(/Unpaired/);
 expect(()=>deriveReviewEvidence({...inputs,guard:{rows:[...inputs.guard.rows,inputs.guard.rows[0]]}})).toThrow(/duplicate/);
});
it('rejects operational claims and corrupt published metrics',()=>{
 const e=deriveReviewEvidence(inputs);expect(()=>validateReviewEvidence({...e,observations:{...e.observations,validatedOneMetreAccuracy:true}})).toThrow(/Unsupported/);expect(()=>validateReviewEvidence({...e,forecast:{...e.forecast,currentRMSE:NaN}})).toThrow(/finite/);
});
