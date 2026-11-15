import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {encounterGraph,makeEncounter,encounterTruth,encounterPrediction,planEncounter,advanceEncounter} from './encounter-v7';
import type {EncounterCase} from './encounter-v7';
import type {Terrain} from './planner';
import {moveOnRover} from './rover-navigation';
import {measureEscapePath} from './escape-metrics';
const protocol=JSON.parse(readFileSync('public/data/hazards/encounters-v7/protocol-v2.json','utf8'));
const flat=():Terrain=>({width:25,height:25,cellSize:1,bounds:[0,0,25,25],center:[0,0],crs:'SYNTHETIC_FLAT',elevation:Array(625).fill(0),slope:Array(625).fill(0),meanSlope:Array(625).fill(0),roughness:Array(625).fill(0),exposure:Array(625).fill(0),valid:Array(625).fill(1),thermal:Array(625).fill(null),thermalRange:[0,0]});
const c:EncounterCase={...protocol.cases[0],speed:.9,reaction:2,startOffset:[0,0],truth:'linear',positionSigma:.2,diameterSigmaFraction:.05,distance:25,heading:0,bearing:0};
it('counterbalances all terrain/source/bearing families in the frozen holdout',()=>{
 const rows=protocol.cases.filter((c:EncounterCase)=>c.split==='holdout');expect(rows).toHaveLength(54);
 expect(new Set(rows.map((c:EncounterCase)=>c.terrain+':'+c.source+':'+c.family)).size).toBe(54);
 const dev=new Set(protocol.cases.filter((c:EncounterCase)=>c.split==='development').map((c:EncounterCase)=>c.sensorSeed));expect(rows.every((c:EncounterCase)=>!dev.has(c.sensorSeed))).toBe(true);
});
it('places astronauts ahead, laterally, behind and initially inside without changing vortex diameter',()=>{
 const source=protocol.sources[0],p={x:12,y:12},ahead=encounterTruth(c,source,p,1,0),behind=encounterTruth({...c,bearing:Math.PI},source,p,1,0),side=encounterTruth({...c,bearing:Math.PI/2},source,p,1,0);
 expect(ahead.x).toBeLessThan(p.x);expect(behind.x).toBeGreaterThan(p.x);expect(side.y).toBeLessThan(p.y);
 expect(Math.hypot(side.x-p.x,side.y-p.y)).toBeCloseTo(25);expect(side.radius).toBeCloseTo(source.diameter/2);
});
it('does not read future virtual observations or reveal future turns to the adaptive arm',()=>{
 for(const window of [3,7] as const){const s=makeEncounter(encounterGraph(flat(),.9),c,protocol.sources[0]);s.trackerWindow=window;s.time=14;const a=encounterPrediction(s,'Adaptive')(24);s.observations=s.observations.map(o=>o.time>14?{...o,x:1e6,y:-1e6,radius:1e5}:o);expect(encounterPrediction(s,'Adaptive')(24)).toEqual(a);}
});
it('keeps time-expanded paths supported, speed-bounded and continuously scored',()=>{
 const s=makeEncounter(encounterGraph(flat(),.9),c,{id:'test',diameter:4,speed:2});s.time=4;const d=planEncounter(s,'Oracle',0);
 expect(d.action).not.toBe('NO FEASIBLE ROUTE');expect(d.limited).toBe(false);expect(d.contact).toBeLessThan(1e-7);
 for(let k=1;k<d.path.length;k++){const a=d.path[k-1],b=d.path[k],distance=Math.hypot(b.x-a.x,b.y-a.y);expect(distance).toBeLessThanOrEqual(.9*(b.time-a.time)+1e-8);expect(moveOnRover(s.g.terrain,a,b.x-a.x,b.y-a.y,s.g.settings).reason).toBe('');}
 const fine=measureEscapePath(d.path,encounterPrediction(s,'Oracle'),1,4,40,Array.from({length:145},(_,i)=>4+i*.25));expect(fine.exposureSeconds).toBeCloseTo(d.contact,8);
 advanceEncounter(s,d);expect(s.time).toBe(6);expect(s.trace.some(p=>p.time===6)).toBe(true);
});
it('applies the same hard budgets in static, endpoint, adaptive and oracle comparisons',()=>{
 for(const arm of ['Static','Endpoint','Adaptive','Oracle'] as const){const s=makeEncounter(encounterGraph(flat(),.9),c,protocol.sources[0]);s.resources.oxygenSeconds=1;s.resources.batterySeconds=1;s.resources.missionSeconds=1;expect(planEncounter(s,arm).action).toBe('NO FEASIBLE ROUTE');}
});
it('does not repeat a fractional-cell backward/forward connector during return',()=>{
 const c=protocol.cases.find((c:EncounterCase)=>c.id==='dev-006'),t=JSON.parse(readFileSync('public/data/hazards/encounters-v7/ridge-terrain.json','utf8')).terrain,s=makeEncounter(encounterGraph(t,c.speed),c,protocol.sources.find((f:{id:string})=>f.id===c.source));
 while(!s.done)advanceEncounter(s,planEncounter(s,'Endpoint',0));
 expect(s.returned).toBe(true);expect(s.time).toBeLessThan(150);
},30000);
it('does not treat an early return as shelter from a later arriving vortex',()=>{
 const s=makeEncounter(encounterGraph(flat(),.9),{...c,evaluationUntil:150},protocol.sources[0]);s.position={...s.base};s.time=90;
 advanceEncounter(s,{path:[{...s.base,time:90},{...s.base,time:126}],action:'HOLD'} as ReturnType<typeof planEncounter>);
 expect(s.returned).toBe(false);expect(s.done).toBe(false);
});
