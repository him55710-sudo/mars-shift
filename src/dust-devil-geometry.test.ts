import {it,expect,describe} from 'vitest';
import {sweptContact,sweptContactIntervals,headOnBoundary,straightEncounter,bestStraightEscape} from './dust-devil-geometry';
import {measureEscapePath,segmentClearance} from './escape-metrics';
describe('continuous dust-devil contact geometry',()=>{
 it('finds short contacts missed by endpoint or half-second sampling',()=>{expect(sweptContact({x:0,y:0},{x:0,y:0},{x:-10,y:0,radius:1},{x:10,y:0,radius:1},1)).toBeCloseTo(.1,12);});
 it('handles radius growth and no motion without division by zero',()=>{expect(sweptContact({x:2,y:0},{x:2,y:0},{x:0,y:0,radius:1},{x:0,y:0,radius:3},4)).toBeCloseTo(2);expect(sweptContact({x:0,y:0},{x:0,y:0},{x:0,y:0,radius:1},{x:0,y:0,radius:1},4)).toBe(4);});
 it('is unchanged by translation and segment subdivision',()=>{const a={x:4,y:2},b={x:7,y:4},c={x:0,y:0,radius:3},d={x:10,y:5,radius:4},m={x:5.5,y:3},n={x:5,y:2.5,radius:3.5};expect(sweptContact(a,b,c,d,10)).toBeCloseTo(sweptContact(a,m,c,n,5)+sweptContact(m,b,n,d,5),10);});
 it('proves the head-on boundary with a constructive path above and unavoidable reachability below',()=>{for(const R of [5,14.5,32])for(const v of [1,5.3,20]){const u=.6,L=2,b=headOnBoundary(R,v,u,L),w={x:u*Math.cos(b.headingRadians),y:u*Math.sin(b.headingRadians)};const clear=straightEncounter({x:-b.centerDistanceMetres-.1,y:0},{x:v,y:0},R,w,L,500);expect(clear.exposureSeconds).toBe(0);expect(clear.minClearance).toBeGreaterThan(0);const shortDistance=b.centerDistanceMetres-.1-v*L;expect(u*shortDistance/v).toBeLessThan(R);expect(straightEncounter({x:-b.centerDistanceMetres+.1,y:0},{x:v,y:0},R,w,L,500).exposureSeconds).toBeGreaterThan(0);}});
 it('does not advise running directly away from a much faster head-on vortex',()=>{const c={x:-150,y:0},v={x:5.3,y:0};expect(straightEncounter(c,v,14.5,{x:.6,y:0},2,100).exposureSeconds).toBeGreaterThan(0);expect(bestStraightEscape(c,v,14.5,.6,2,100).exposureSeconds).toBe(0);});
 it('counts an initially-inside escape as exposure, not prevention',()=>{expect(bestStraightEscape({x:0,y:0},{x:5.3,y:0},12.5,.6,0,60).exposureSeconds).toBeGreaterThan(0);});
 it('distinguishes front-boundary warning from centre arrival, including latency and padding',()=>{
  for(const [diameter,expected] of [[10,16.3459119497],[25,27.4308176101],[60,53.2955974843]]){
   const R=diameter/2+2,v=5.3,u=.6,L=6,b=headOnBoundary(R,v,u,L);
   expect(b.warningSeconds).toBeCloseTo(expected,8);
   expect(b.centerArrivalSeconds-b.warningSeconds).toBeCloseTo(R/v,10);
   expect(b.centerDistanceMetres/v).toBeCloseTo(b.centerArrivalSeconds,10);
   const w={x:u*Math.cos(b.headingRadians),y:u*Math.sin(b.headingRadians)};
   expect(straightEncounter({x:-(v*(b.warningSeconds+.1)+R),y:0},{x:v,y:0},R,w,L,300).exposureSeconds).toBe(0);
   expect(straightEncounter({x:-(v*(b.warningSeconds-.1)+R),y:0},{x:v,y:0},R,w,L,300).exposureSeconds).toBeGreaterThan(0);
  }
 });
 it('records continuous entry/exit and excludes a tangency',()=>{
  expect(sweptContactIntervals({x:0,y:0},{x:0,y:0},{x:-10,y:0,radius:1},{x:10,y:0,radius:1},1)).toEqual([[.45,.55]]);
  expect(sweptContact({x:0,y:1},{x:0,y:1},{x:-10,y:0,radius:1},{x:10,y:0,radius:1},1)).toBe(0);
 });
 it('keeps exposure invariant under controller interval subdivision and catches a between-sample crossing',()=>{
  const at=(t:number)=>({x:-4+40*t,y:0,radius:.4}),hold=[{x:0,y:0,time:0},{x:0,y:0,time:1}];
  const exact=measureEscapePath(hold,at,1,0,1);expect(exact.exposureSeconds).toBeCloseTo(.02,10);
  for(const dt of [1,.5,.1,.01]){
   const knots=Array.from({length:Math.floor(1/dt)+1},(_,i)=>i*dt);
   expect(measureEscapePath(hold,at,1,0,1,knots).exposureSeconds).toBeCloseTo(exact.exposureSeconds,10);
  }
  expect([0,.5,1].some(t=>Math.abs(at(t).x)<.4)).toBe(false);
 });
 it('splits actual motion turns and radius growth instead of joining across them',()=>{
  const path=[{x:0,y:0,time:0},{x:0,y:0,time:2}],at=(t:number)=>({x:t<=1?-4+4*t:4*(t-1),y:t<=1?4*(1-t):4*(t-1),radius:1});
  expect(measureEscapePath(path,at,1,0,2,[1]).exposureSeconds).toBeGreaterThan(0);
  expect(measureEscapePath(path,at,1,0,2).exposureSeconds).toBe(0);
  expect(segmentClearance({x:3,y:0},{x:3,y:0},{x:0,y:0,radius:1},{x:0,y:0,radius:4})).toBeCloseTo(-1,10);
 });
});
