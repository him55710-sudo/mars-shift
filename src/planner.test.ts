import {describe,expect,it} from 'vitest';
import {DEFAULTS,affected,blocked,index,leg,metrics,nearestAllowed,plan,point} from './planner';
import type {Terrain} from './planner';
import actual from '../public/data/terrain.json';

function fixture(w=12,h=12):Terrain{
  const n=w*h;return {width:w,height:h,cellSize:5,bounds:[0,0,w*5,h*5],center:[77.64,18.45],crs:'test planar metres',elevation:Array(n).fill(0),slope:Array(n).fill(0),meanSlope:Array(n).fill(0),roughness:Array(n).fill(0),exposure:Array(n).fill(0),valid:Array(n).fill(1),thermal:Array(n).fill(300),thermalRange:[300,300]};
}
const checkContinuity=(t:Terrain,path:number[])=>{for(let n=1;n<path.length;n++){const a=point(t,path[n-1]),b=point(t,path[n]);expect(Math.abs(a.x-b.x)).toBeLessThanOrEqual(1);expect(Math.abs(a.y-b.y)).toBeLessThanOrEqual(1);expect(a.x!==b.x||a.y!==b.y).toBe(true);}};

describe('physical route geometry',()=>{
  it('uses metre-scale cell distances and returns to base',()=>{
    const t=fixture(),r=plan(t,{x:1,y:1},{x:4,y:1},'shortest',DEFAULTS,null)!;
    expect(r.distance).toBeCloseTo(30);expect(r.cells[0]).toBe(r.cells.at(-1));expect(r.outbound.at(-1)).toBe(r.inbound[0]);checkContinuity(t,r.cells);
  });
  it('uses terrain elevation in 3D distance',()=>{const t=fixture();t.elevation[2]=12;const r=metrics(t,[1,2],'shortest',DEFAULTS);expect(r.distance).toBe(13);expect(r.gain).toBe(12);});
  it('matches the analytic Euclidean optimum on an open grid',()=>{const t=fixture();const r=plan(t,{x:1,y:1},{x:6,y:6},'shortest',DEFAULTS,null)!;expect(r.distance).toBeCloseTo(10*5*Math.SQRT2);});
  it('retains the terrain measurement when the science point is the base',()=>{const t=fixture();t.slope[13]=12;t.meanSlope[13]=7;const r=plan(t,{x:1,y:1},{x:1,y:1},'mission',DEFAULTS,null)!;expect(r.distance).toBe(0);expect(r.maxSlope).toBe(12);expect(r.meanSlope).toBe(7);expect(r.totalMinutes).toBe(DEFAULTS.scienceMinutes);});
});
describe('hard constraints',()=>{
  it('avoids blocked and NoData cells',()=>{const t=fixture();t.valid[index(t,{x:5,y:5})]=0;const r=plan(t,{x:1,y:1},{x:9,y:9},'mission',DEFAULTS,null)!;expect(r.cells).not.toContain(65);checkContinuity(t,r.cells);});
  it('cannot cross a full NoData wall',()=>{const t=fixture();for(let y=0;y<t.height;y++)t.valid[y*t.width+5]=0;expect(plan(t,{x:1,y:1},{x:9,y:9},'shortest',DEFAULTS,null)).toBeNull();});
  it('does not cut a diagonal through blocked corners',()=>{const t=fixture(2,2);t.valid[1]=0;t.valid[2]=0;expect(leg(t,{x:0,y:0},{x:1,y:1},'shortest',DEFAULTS,null)).toBeNull();});
  it('respects slope limits in every planning mode',()=>{const t=fixture();t.slope[index(t,{x:9,y:9})]=35;for(const mode of ['shortest','exposure','mission'] as const)expect(plan(t,{x:1,y:1},{x:9,y:9},mode,DEFAULTS,null)).toBeNull();});
  it('rejects invalid target coordinates',()=>{const t=fixture();expect(plan(t,{x:0,y:0},{x:-1,y:10},'mission',DEFAULTS,null)).toBeNull();});
});
describe('mission feasibility and evidence',()=>{
  it('rejects a geometrically valid route if resource reserve is insufficient',()=>{const t=fixture();const r=plan(t,{x:1,y:1},{x:9,y:9},'mission',{...DEFAULTS,oxygenMinutes:1},null)!;expect(r.feasible).toBe(false);expect(r.reasons.join(' ')).toContain('reserve');});
  it('rejects missions that exceed the duration',()=>{const r=plan(fixture(),{x:1,y:1},{x:9,y:9},'mission',{...DEFAULTS,durationMinutes:1},null)!;expect(r.feasible).toBe(false);expect(r.timeRemaining).toBeLessThan(0);});
  it('keeps missing thermal coverage unknown without inventing physical values',()=>{const t=fixture();t.thermal.fill(null);const r=plan(t,{x:1,y:1},{x:9,y:9},'mission',DEFAULTS,null)!;expect(r.unknownThermalDistance).toBeCloseTo(r.distance);expect(Object.keys(r)).not.toContain('safetyProbability');});
  it('holds on degraded visibility even with a nominal resource margin',()=>{const r=plan(fixture(),{x:1,y:1},{x:9,y:9},'mission',{...DEFAULTS,dust:true},null)!;expect(r.feasible).toBe(false);expect(r.reasons.join(' ')).toContain('HOLD');});
  it('terrain exposure changes the route only as a transparent heuristic',()=>{const t=fixture();for(let x=2;x<=8;x++)t.exposure[5*t.width+x]=1;const a=plan(t,{x:1,y:5},{x:9,y:5},'shortest',DEFAULTS,null)!;const b=plan(t,{x:1,y:5},{x:9,y:5},'exposure',DEFAULTS,null)!;expect(b.exposureDistance).toBeLessThan(a.exposureDistance);expect(b.distance).toBeGreaterThan(a.distance);});
});
describe('route revalidation',()=>{
  it('invalidates a previous route and reroutes around a new hard exclusion',()=>{const t=fixture(),start={x:1,y:5},target={x:10,y:5},a=plan(t,start,target,'mission',DEFAULTS,null)!,e={x:5,y:5,radius:9};expect(affected(t,a,e).length).toBeGreaterThan(0);const b=plan(t,start,target,'mission',DEFAULTS,e)!;expect(b).not.toBeNull();expect(affected(t,b,e)).toHaveLength(0);expect(b.distance).toBeGreaterThan(a.distance);});
  it('reports no path when an exclusion seals the region',()=>{const t=fixture();expect(plan(t,{x:1,y:5},{x:10,y:5},'mission',DEFAULTS,{x:5,y:5,radius:200})).toBeNull();});
});
describe('published Jezero integration',()=>{
  const t=actual as Terrain,base=nearestAllowed(t,{x:32,y:168},DEFAULTS),target=nearestAllowed(t,{x:153,y:43},DEFAULTS);
  it('computes three continuous physical round trips on the actual NASA-derived DEM',()=>{for(const mode of ['shortest','exposure','mission'] as const){const r=plan(t,base,target,mode,DEFAULTS,null)!;expect(r).not.toBeNull();expect(r.distance).toBeGreaterThan(1000);expect(r.cells.every(i=>!blocked(t,i,DEFAULTS,null))).toBe(true);expect(r.cells[0]).toBe(r.cells.at(-1));checkContinuity(t,r.cells);}});
  it('replans the actual baseline without crossing the scenario footprint',()=>{const a=plan(t,base,target,'mission',DEFAULTS,null)!;const p=point(t,a.outbound[Math.floor(a.outbound.length*.55)]),e={...p,radius:35};const b=plan(t,base,target,'mission',DEFAULTS,e)!;expect(b).not.toBeNull();expect(affected(t,a,e).length).toBeGreaterThan(0);expect(affected(t,b,e)).toHaveLength(0);});
});
