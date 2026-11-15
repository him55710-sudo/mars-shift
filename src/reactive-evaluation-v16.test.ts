import {describe,expect,it} from 'vitest';
import {encounterGraph,encounterDistances} from './encounter-v7';
import type {AbruptSession} from './encounter-v8';
import {REACTIVE_ARMS,evaluationContext,policyInput,planReactive,inputPrediction,reactivePaths,physicalPathAllowed} from './reactive-evaluation-v16';
import type {Terrain} from './planner';
import config from '../public/data/hazards/escape-v5/navigation-config.json';

function setup(){
 const width=64,height=64,n=width*height,t:Terrain={width,height,cellSize:1,bounds:[0,0,width,height],center:[0,0],crs:'TEST:METRES',elevation:Array(n).fill(0),slope:Array(n).fill(0),meanSlope:Array(n).fill(0),roughness:Array(n).fill(0),exposure:Array(n).fill(0),valid:Array(n).fill(1),thermal:Array(n).fill(null),thermalRange:[0,0]};
 const g=encounterGraph(t,.6),base={x:32,y:32},s={g,base,position:{...base},target:{x:45,y:32},time:12,c:{reaction:2},resources:{oxygenSeconds:1000,batterySeconds:1000,missionSeconds:800,reserveFraction:.2,oxygenReserveSeconds:200,batteryReserveSeconds:200},observations:[{time:2,x:42,y:32,radius:3,positionSigma:.1,radiusSigma:.1,source:'SIMULATED_SENSOR'},{time:4,x:40,y:32,radius:3,positionSigma:.1,radiusSigma:.1,source:'SIMULATED_SENSOR'},{time:100,x:123456789,y:123456789,radius:1000,positionSigma:0,radiusSigma:0,source:'SIMULATED_SENSOR'}],returns:encounterDistances(g,[{i:base.y*width+base.x,ticks:0}],true).d} as unknown as AbruptSession;
 Object.defineProperty(s,'truth',{get(){throw Error('POLICY READ FUTURE TRUTH');}});
 return {s,input:policyInput(s,evaluationContext(s),config.config as any)};
}
describe('fair observation-only reactive evaluation',()=>{
 it('does not expose generator parameters, truth callbacks or undelivered observations',()=>{const {input}=setup();expect(input.observations).toHaveLength(2);expect(Object.keys(input)).not.toContain('truth');expect(Object.keys(input)).not.toContain('c');expect(JSON.stringify(input.observations)).not.toContain('123456789');for(const arm of REACTIVE_ARMS)expect(()=>planReactive(input,arm)).not.toThrow();});
 it('applies the exact same observation delivery and reaction gate to every arm',()=>{const {input}=setup();input.time=4;input.observations=input.observations.slice(0,1);input.readyAt=8;for(const arm of REACTIVE_ARMS){const d=planReactive(input,arm);expect(d.status).toBe('REACTION');expect(d.action).toBe('HOLD');expect(d.path[0].x).toBe(d.path.at(-1)!.x);}input.observations=[];for(const arm of REACTIVE_ARMS)expect(planReactive(input,arm).status).toBe('ACQUIRING');});
 it('constructs genuinely opposite lateral choices from observed velocity',()=>{const {input}=setup(),predict=inputPrediction(input)!,paths=reactivePaths(input,predict,20);expect(paths[1]).not.toBeNull();expect(paths[2]).not.toBeNull();const a=paths[1]!.at(-1)!,b=paths[2]!.at(-1)!;expect((a.y-input.position.y)*(b.y-input.position.y)).toBeLessThan(0);});
 it('uses the common speed, support, terrain edges and return-resource gate for all chosen actions',()=>{const {input}=setup(),before=input.context.terrain.elevation.slice();for(const arm of REACTIVE_ARMS){const d=planReactive(input,arm);if(d.status!=='NO_VERIFIED_ACTION')expect(physicalPathAllowed(input,d.path)).toBe(true);expect(d.path.every(p=>p.time>=input.time)).toBe(true);}expect(input.context.terrain.elevation).toEqual(before);const invalid=[{...input.position,time:12},{x:55,y:32,time:13}];expect(physicalPathAllowed(input,invalid)).toBe(false);});
 it('never reports a clear route when the shared return reserve is exhausted',()=>{const {input}=setup();input.resources.oxygenSeconds=199;for(const arm of REACTIVE_ARMS){const d=planReactive(input,arm);expect(d.status).toBe('NO_VERIFIED_ACTION');expect(d.action).toBe('NO FEASIBLE ROUTE');}});
 it('does not label stale estimates as clear and stops verification beyond the common coast limit',()=>{const {input}=setup();input.time=25;input.readyAt=0;for(const arm of REACTIVE_ARMS){const d=planReactive(input,arm);expect(d.status).toBe('NO_VERIFIED_ACTION');expect(d.reason).toContain('coast limit');}});
});
