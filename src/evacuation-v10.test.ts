import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {evacuationClock} from './evacuation-clock';
import {planEvacuation,planningHorizon} from './evacuation-runtime';
import {encounterGraph,advanceEncounter} from './encounter-v7';
import {makeAbrupt,planAbrupt} from './encounter-v8';
import type {ArmV8} from './encounter-v8';
const terrain=JSON.parse(readFileSync('public/data/hazards/encounters-v7/floor-terrain.json','utf8')).terrain;
const protocol=JSON.parse(readFileSync('public/data/hazards/vortex-v8/protocol-confirmation.json','utf8'));
const graph=encounterGraph(terrain,.9);
const make=()=>{const s=makeAbrupt(graph,{...protocol.cases[0],truth:'linear',birth:0,detectLag:0,dropout:false,distance:25,startOffset:[0,0],reaction:6},protocol.sources[0],{});s.predictor='CV_SMOOTH';return s;};
it('egress clock uses leading boundary arrival, not centre arrival',()=>{
 const c=evacuationClock([{x:0,y:0,time:0},{x:0,y:8,time:8},{x:0,y:8,time:20}],t=>({x:30-2*t,y:0,radius:5}),{x:0,y:0},1,0,20,1,2,7);
 expect(c.boundaryEntrySeconds).toBeCloseTo(12.5);expect(c.routeTerminalArrivalSeconds).toBe(8);expect(c.arrivalMarginSeconds).toBeCloseTo(4.5);expect(c.reactionRemaining).toBe(7);expect(c.terminalIsValidatedRefuge).toBe(false);
});
it('positive terminal timing margin cannot hide contact along the route',()=>{
 const c=evacuationClock([{x:0,y:0,time:0},{x:8,y:0,time:8},{x:8,y:0,time:12}],t=>({x:10-t,y:0,radius:1}),{x:0,y:0},1,0,12,0,1,0);
 expect(c.arrivalMarginSeconds).toBeGreaterThan(0);expect(c.predictedContactSeconds).toBeGreaterThan(0);expect(c.status).toBe('CONTACT_PREDICTED');
});
it('does not treat a safe HOLD as an evacuation travel time or a refuge',()=>{
 const c=evacuationClock([{x:0,y:0,time:0},{x:0,y:0,time:10}],()=>({x:20,y:0,radius:1}),{x:0,y:0},1,0,10,0,1,0);
 expect(c.routeTerminalArrivalSeconds).toBeNull();expect(c.arrivalMarginSeconds).toBeNull();expect(c.predictedContactSeconds).toBe(0);
});
it('keeps the frozen v8 decisions unchanged while the full horizon is affordable',()=>{
 for(const arm of ['Static','Nominal','MARS SHIFT','Oracle'] as ArmV8[]){const s=make();s.time=10;expect(planningHorizon(s)).toBe(48);const a=planAbrupt(s,arm),b=planEvacuation(s,arm);expect(b.path).toEqual(a.path);expect(b.contact).toBe(a.contact);expect(b.action).toBe(a.action);}
});
it('avoids false late-budget refusal without exceeding any shared reserve',()=>{
 for(const arm of ['Static','Nominal','MARS SHIFT','Oracle'] as ArmV8[]){const s=make();s.time=170;s.position={...s.base};s.resources.oxygenSeconds=330-170*1.12;s.resources.batterySeconds=330-170*1.06;
  expect(planAbrupt(s,arm).action).toBe('NO FEASIBLE ROUTE');const H=planningHorizon(s),d=planEvacuation(s,arm);
  expect(H).toBeLessThan(48);expect(H).toBeGreaterThanOrEqual(2);expect(d.action).not.toBe('NO FEASIBLE ROUTE');
  expect(d.path.at(-1)!.time-s.time).toBe(H);expect(d.returnMargin).toBeGreaterThanOrEqual(-1e-8);
  advanceEncounter(s,d);expect(s.resources.oxygenSeconds).toBeGreaterThanOrEqual(104);expect(s.resources.batterySeconds).toBeGreaterThanOrEqual(104);
 }
});
it('still refuses a truly insufficient executed step and preserves response delay',()=>{
 for(const arm of ['Static','Nominal','MARS SHIFT','Oracle'] as ArmV8[]){const s=make();s.time=s.firstDetect;expect(planEvacuation(s,arm).action).toBe('HOLD');s.time=10;s.resources.oxygenSeconds=104.5;s.resources.batterySeconds=104.5;expect(planEvacuation(s,arm).action).toBe('NO FEASIBLE ROUTE');}
});
