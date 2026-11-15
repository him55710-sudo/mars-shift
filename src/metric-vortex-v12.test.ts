import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {cameraRay,intersectGround,triangulate} from './metric-vortex-v12';
import type {Camera,V3} from './metric-vortex-v12';
import {rangedFix,predictRanged,authorizeMetricOverlay} from './ranged-tracker-v12';
import type {RangedDetection} from './ranged-tracker-v12';
const camera:Camera={C:[0,0,-2],A:[1,0,0],H:[0,100,0],V:[0,0,100],O:[1,0,0],R:[0,0,0],E:[0,0,0],linearity:1,rotation:[[1,0,0],[0,1,0],[0,0,1]]};
const d=(time:number,range:number):RangedDetection=>({id:'fixture',time,pixel:[0,0],horizontalRange:range,rangeSigma:1,pixelSigma:.1,visibleDustWidth:10,source:'RANGE_SENSOR',crs:'TEST',independentAccuracyValidated:true});
describe('metric geometry and range evidence',()=>{
 it('intersects an analytic calibrated camera ray with ground and rejects sky rays',()=>{
  const ground={along:[1,0,0] as V3,intercept:0,slope:0};
  const p=intersectGround(cameraRay(camera,[0,20]),ground)!;
  expect(p[0]).toBeCloseTo(10,9);expect(p[2]).toBeCloseTo(0,9);
  expect(intersectGround(cameraRay(camera,[0,-20]),ground)).toBeNull();
 });
 it('uses actual PDS optical axis with rover-to-site rotation',()=>{
  const input=JSON.parse(readFileSync('public/data/hazards/metric-v12/inputs.json','utf8')),c:Camera=input.products[0].camera;
  const dot=(a:V3,b:V3)=>a.reduce((s,v,i)=>s+v*b[i],0),pixel=[dot(c.H,c.O)/dot(c.A,c.O),dot(c.V,c.O)/dot(c.A,c.O)];
  const r=cameraRay(c,pixel),expected=c.rotation.map(row=>row.reduce((s,v,i)=>s+v*c.O[i],0));
  expect(Math.hypot(...r.direction)).toBeCloseTo(1,10);
  // Published camera vectors are rounded; compare angle after normalization.
  const norm=Math.hypot(...expected),dotAxis=expected.reduce((s,v,i)=>s+v*r.direction[i]/norm,0);
  expect(Math.acos(Math.min(1,dotAxis))).toBeLessThan(5e-5);
  expect((Math.atan2(r.direction[1],r.direction[0])*180/Math.PI+360)%360).toBeGreaterThan(160);
 });
 it('triangulates a known stereo point and refuses parallel or inconsistent rays',()=>{
  const norm=(a:V3)=>a.map(v=>v/Math.hypot(...a)) as V3;
  const a={origin:[-.2,0,0] as V3,direction:norm([.2,0,20])},b={origin:[.2,0,0] as V3,direction:norm([-.2,0,20])};
  const p=triangulate(a,b,.01)!;expect(p.point[2]).toBeCloseTo(20,8);expect(p.skew).toBeLessThan(1e-8);
  expect(triangulate(a,{...b,direction:a.direction},.01)).toBeNull();
  expect(triangulate(a,{...b,origin:[.2,2,0]},.1)).toBeNull();
 });
 it('does not infer range from diameter and validates missing range',()=>{
  const a=rangedFix(camera,d(0,30)),b=rangedFix(camera,{...d(0,30),visibleDustWidth:100});
  expect(a.north).toBeCloseTo(30);expect(a.east).toBe(0);expect(b.north).toBe(a.north);
  expect(()=>rangedFix(camera,{...d(0,30),horizontalRange:NaN})).toThrow();
 });
 it('predicts an analytic moving target from irregular past observations',()=>{
  const h=[0,3,8].map(t=>rangedFix(camera,d(t,100-5*t)));
  for(const model of ['LAST2','OLS','WEIGHTED_CV'] as const){const f=predictRanged(h,10,model);expect(f.range).toBeCloseTo(50,8);expect(f.speed).toBeCloseTo(5,8);}
  expect(()=>predictRanged([h[1],h[0]],10,'OLS')).toThrow();
  expect(()=>predictRanged([h[0],{...h[1],crs:'OTHER'}],10,'OLS')).toThrow();
 });
 it('keeps prediction causal when future observations change',()=>{
  const h=[0,4,8].map(t=>rangedFix(camera,d(t,80-3*t))),a=predictRanged(h.slice(0,2),8,'WEIGHTED_CV');
  h[2].north=10000;expect(predictRanged(h.slice(0,2),8,'WEIGHTED_CV')).toEqual(a);
 });
 it('blocks archive, wrong-frame, stale and overly uncertain overlays',()=>{
  const f=rangedFix(camera,d(10,30));expect(authorizeMetricOverlay(f,'TEST',1,5,11).usable).toBe(true);
  expect(authorizeMetricOverlay({...f,source:'PUBLISHED_IMAGE_ESTIMATE'},'TEST',1,5,11).usable).toBe(false);
  expect(authorizeMetricOverlay(f,'OTHER',1,5,11).usable).toBe(false);
  expect(authorizeMetricOverlay(f,'TEST',1,5,20).usable).toBe(false);
  expect(authorizeMetricOverlay(f,'TEST',6,5,11).usable).toBe(false);
 });
});
