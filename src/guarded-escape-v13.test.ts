import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {encounterGraph} from './encounter-v7';
import {makeAbrupt,abruptPrediction} from './encounter-v8';
import type {ArmV8} from './encounter-v8';
import {planEvacuation} from './evacuation-runtime';
import {planEvacuationV13} from './evacuation-runtime-v13';
import {planGuardedEscape} from './guarded-escape-v13';
import {createEscapeTracker} from './adaptive-escape-v13';
import {TRACKER_CANDIDATES} from './adaptive-tracker-v13';
const terrain=JSON.parse(readFileSync('public/data/hazards/encounters-v7/floor-terrain.json','utf8')).terrain;
const protocol=JSON.parse(readFileSync('public/data/hazards/vortex-v8/protocol-confirmation.json','utf8'));
const graph=encounterGraph(terrain,.9);
const make=()=>{const s=makeAbrupt(graph,{...protocol.cases[0],truth:'gust',birth:0,detectLag:0,dropout:false,distance:35,startOffset:[0,0],reaction:6},protocol.sources[0],{});s.predictor='CV_SMOOTH';return s;};
it('injected runtime retains exact frozen v10 paths, actions and resources without an override',()=>{
 for(const arm of ['Static','Nominal','MARS SHIFT','Oracle'] as ArmV8[])for(const time of [10,160]){const s=make();s.time=time;if(time===160)s.resources.oxygenSeconds=160;
  const a=planEvacuation(s,arm),b=planEvacuationV13(s,arm);expect(b.path).toEqual(a.path);expect(b.action).toBe(a.action);expect(b.contact).toBe(a.contact);expect(b.returnMargin).toBe(a.returnMargin);}
});
it('retains the incumbent on equal model risks and on absent observations',()=>{
 const s=make();expect(planGuardedEscape(s,null).selected).toBe('LEGACY');s.time=20;const old=abruptPrediction(s),g=planGuardedEscape(s,old);expect(g.selected).toBe('LEGACY');expect(g.decision.path).toEqual(planEvacuation(s,'MARS SHIFT').path);
});
it('only selects a new path if nominal and expanded contact do not worsen in either model',()=>{
 const s=make(),track=createEscapeTracker(TRACKER_CANDIDATES.IMM_SLOW,2.25);
 for(const time of [10,20,30,40]){s.time=time;const g=planGuardedEscape(s,track(s));if(g.selected==='ADAPTIVE'){
  expect(g.risks!.adaptive.every((v,i)=>v<=g.risks!.legacy[i]+1e-8)).toBe(true);expect(g.risks!.adaptive.some((v,i)=>v<g.risks!.legacy[i]-1e-8)).toBe(true);
 }expect(g.decision.returnMargin).toBeGreaterThanOrEqual(-1e-8);}
});
it('preserves reaction delay and refuses an unaffordable first movement',()=>{
 const s=make(),track=createEscapeTracker(TRACKER_CANDIDATES.IMM_SLOW);s.time=s.firstDetect;expect(planGuardedEscape(s,track(s)).decision.action).toBe('HOLD');
 s.time=10;s.resources.oxygenSeconds=104.5;s.resources.batterySeconds=104.5;expect(planGuardedEscape(s,track(s)).decision.action).toBe('NO FEASIBLE ROUTE');
});
