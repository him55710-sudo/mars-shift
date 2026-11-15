import {describe,it,expect} from 'vitest';
import {evaluateSandLabels} from './sand-validation';
import type {SandValidation} from './sand-validation';
const input=():SandValidation=>({schema:1,task:'rover-slip',labelProvenance:'independent-observation',threshold:.5,rows:[.9,.7,.4,.2,null].map((score,i)=>({id:String(i),episode:'drive-1',split:'test',score,label:([1,0,1,0,1] as const)[i],source:'independent fixture',beforeTraversal:true}))});
describe('independent sand evaluation',()=>{
 it('reports errors, abstentions and coverage without counting missing data as negative',()=>{const r=evaluateSandLabels(input());expect(r).toMatchObject({tp:1,fp:1,tn:1,fn:1,unknown:1,coverage:.8,precision:.5,recall:.5,f1:.5,falsePositiveRate:.5});expect(r.averagePrecision).toBeCloseTo(5/6);});
 it('does not invent accuracy when no independent test labels exist',()=>{const r=evaluateSandLabels({...input(),rows:[]});expect(r.precision).toBeNull();expect(r.recall).toBeNull();expect(r.coverage).toBeNull();expect(r.averagePrecision).toBeNull();});
 it('rejects episode leakage and post-traversal inputs',()=>{const d=input();d.rows[0].split='development';expect(()=>evaluateSandLabels(d)).toThrow(/Episode leakage/);const p=input();p.rows[0].beforeTraversal=false;expect(()=>evaluateSandLabels(p)).toThrow(/leakage/);});
 it('rejects duplicate observations and out-of-range scores',()=>{const d=input();d.rows[0].id='1';expect(()=>evaluateSandLabels(d)).toThrow(/Duplicate/);const p=input();p.rows[0].score=1.1;expect(()=>evaluateSandLabels(p)).toThrow(/invalid/);});
 it('handles tied scores independently of label order',()=>{const d=input();d.rows=d.rows.slice(0,2).map(r=>({...r,score:.7}));expect(evaluateSandLabels(d).averagePrecision).toBe(.5);expect(evaluateSandLabels({...d,rows:d.rows.reverse()}).averagePrecision).toBe(.5);});
});
