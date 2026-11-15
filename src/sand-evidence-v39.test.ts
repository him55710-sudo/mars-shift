import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {validateSandBenchmark,sandModelRoutingGate,applySandModelExclusions} from './sand-evidence-v39';
import type {Terrain} from './planner';
describe('independent NASA sand evidence',()=>{
 it('recomputes published confusion metrics and rejects corrupted counts',()=>{
  const raw=JSON.parse(fs.readFileSync('public/data/hazards/sand-v39/report.json','utf8')),r=validateSandBenchmark(raw);
  expect(r.examples).toHaveLength(3);expect(r.metrics.tp+r.metrics.fn).toBeGreaterThan(0);
  expect(()=>validateSandBenchmark({...raw,metrics:{...raw.metrics,fp:raw.metrics.fp+1}})).toThrow();
 });
 it('does not authorize Jezero physical exclusions from MSL appearance accuracy',()=>{
  const r=validateSandBenchmark(JSON.parse(fs.readFileSync('public/data/hazards/sand-v39/report.json','utf8')));
  expect(sandModelRoutingGate(r).automaticExclusions).toBe(false);
  expect(()=>applySandModelExclusions({width:2,height:2} as Terrain,[0,1,0,0],r)).toThrow(/not been validated/);
  expect(sandModelRoutingGate(null).automaticExclusions).toBe(false);
 });
 it('holds out complete site-drive groups and contains all 322 expert test images',()=>{
  const s=JSON.parse(fs.readFileSync('public/data/hazards/sand-v39/splits.json','utf8'));
  const group=(n:string)=>n.match(/_F(\d{7})/)![1],train=new Set(s.train.map(group)),cal=new Set(s.calibration.map(group)),test=new Set(s.test.map(group));
  expect(s.test).toHaveLength(322);
  for(const g of train){expect(cal.has(g)).toBe(false);expect(test.has(g)).toBe(false);}
  for(const g of cal)expect(test.has(g)).toBe(false);
 });
});
