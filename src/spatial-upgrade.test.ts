import {describe,it,expect} from 'vitest';
import {GridHeap} from './grid-heap';
import {DEFAULTS,edgeBlocked,leg,metrics,plan} from './planner';
import type {Terrain,Settings} from './planner';
import {attemptMove} from './eva-motion';
import {computeReturnMap} from './return-feasibility';
import {auditReturnEnvelope} from './return-envelope';
import {constrainedPlan} from './constrained-planner';
const fixture=(w=8,h=8):Terrain=>({width:w,height:h,cellSize:5,bounds:[0,0,w*5,h*5],center:[77,18],crs:'Mars metres',valid:Array(w*h).fill(1),elevation:Array(w*h).fill(0),slope:Array(w*h).fill(0),meanSlope:Array(w*h).fill(0),exposure:Array(w*h).fill(0),roughness:Array(w*h).fill(0),thermal:Array(w*h).fill(200),thermalRange:[200,200]});
describe('licensed typed route heap',()=>{
 it('grows from one slot, orders duplicate and negative costs, and empties safely',()=>{const heap=new GridHeap(1),values=Array.from({length:4097},(_,i)=>({i,cost:Math.sin(i)*100}));values.forEach(v=>heap.push(v.i,v.cost));const sorted=values.slice().sort((a,b)=>a.cost-b.cost);for(const v of sorted)expect(heap.pop()).toEqual(v);expect(heap.length).toBe(0);expect(()=>heap.pop()).toThrow();heap.push(9,2);expect(heap.pop()).toEqual({i:9,cost:2});});
});
describe('continuous traversal constraints',()=>{
 it('rejects an elevation step even when both slope-raster samples look flat',()=>{const t=fixture(2,1);t.elevation[1]=10;expect(edgeBlocked(t,0,1,DEFAULTS,null)).toBe(true);for(const mode of ['shortest','time','energy','mission','exposure'] as const)expect(leg(t,{x:0,y:0},{x:1,y:0},mode,DEFAULTS,null)).toBeNull();expect(computeReturnMap(t,{x:0,y:0},DEFAULTS,null).inbound[1]).toBe(Infinity);expect(constrainedPlan(t,{x:0,y:0},{x:1,y:0},'mission',DEFAULTS,null).route).toBeNull();});
 it('prevents diagonal and orthogonal segments from piercing small circular closures',()=>{const t=fixture(2,2),e={x:.5,y:.5,radius:1};expect(edgeBlocked(t,0,3,DEFAULTS,e)).toBe(true);expect(edgeBlocked(t,0,1,DEFAULTS,e)).toBe(false);expect(leg(t,{x:0,y:0},{x:1,y:1},'shortest',DEFAULTS,e)!.cells).toHaveLength(3);expect(edgeBlocked(t,0,1,DEFAULTS,{x:.5,y:0,radius:.1})).toBe(true);});
 it('checks the continuous native DEM grade and closure during actual walking',()=>{const t=fixture(3,3),native={width:15,height:15,cellSize:1,bounds:t.bounds,crs:t.crs,values:Float32Array.from({length:225},(_,i)=>i%15<4?0:3)};expect(attemptMove(t,{x:0,y:1},5,0,DEFAULTS,null,native).blocked).toBe(true);expect(attemptMove(t,{x:0,y:1},5,0,DEFAULTS,{x:.1,y:1,radius:.1},null).blocked).toBe(true);});
 it('allows a plane exactly at the configured grade tolerance',()=>{const t=fixture(2,1);t.elevation[1]=5*Math.tan(18*Math.PI/180);expect(edgeBlocked(t,0,1,DEFAULTS,null)).toBe(false);});
});
describe('every-position return stress audit',()=>{
 it('includes work at the destination, detects a half-speed failure, and uses supplied directed costs',()=>{const t=fixture(5,1),s:Settings={...DEFAULTS,speed:1,loadKg:0,scienceMinutes:2,durationMinutes:2.9,oxygenMinutes:100,powerMinutes:100},r=plan(t,{x:0,y:0},{x:4,y:0},'time',s,null)!,map=computeReturnMap(t,{x:0,y:0},s,null),a=auditReturnEnvelope(t,r,s,map.inbound);expect(a.checked).toBe(r.cells.length);expect(a.nominal.marginMinutes).toBeGreaterThan(0);expect(a.slow.marginMinutes).toBeLessThan(0);expect(a.slow.cell).toBe(4);const directed=map.inbound.slice();directed[4]=2;expect(auditReturnEnvelope(t,r,s,directed).nominal.marginMinutes).toBeLessThan(0);});
 it('preserves unknown return support instead of reporting a reassuring buffer',()=>{const t=fixture(),s={...DEFAULTS,scienceMinutes:0},r=plan(t,{x:0,y:0},{x:4,y:4},'time',s,null)!,costs=new Float64Array(64).fill(Infinity),audit=auditReturnEnvelope(t,r,s,costs);expect(audit.checked).toBe(0);expect(audit.unsupported).toBe(r.cells.length);expect(audit.nominal.cell).toBe(-1);expect(()=>auditReturnEnvelope(t,r,s,costs,.5)).toThrow();expect(metrics(t,r.cells,'time',s).travelMinutes).toBeGreaterThan(0);});
});
