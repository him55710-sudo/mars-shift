import {describe,it,expect} from 'vitest';
import {AdaptiveTracker,TRACKER_CANDIDATES,polarCovariance,ellipse95,mahalanobis} from './adaptive-tracker-v13';
import type {MetricMeasurement} from './adaptive-tracker-v13';
const z=(time:number,x=time,y=0):MetricMeasurement=>({time,x,y,covariance:[1,0,1],crs:'TEST'});
describe('full covariance streaming tracker',()=>{
 it('matches an analytic two-observation scalar Kalman update',()=>{
  const t=new AdaptiveTracker({q:[0],switchSeconds:1,robustNIS:1e30,initialVelocitySigma:1});t.update(z(0,0));t.update(z(1,3));const p=t.predict(1);
  expect(p.x).toBeCloseTo(2,10);expect(p.vx).toBeCloseTo(1,10);expect(p.covariance[0]).toBeCloseTo(2/3,10);expect(t.predict(2).x).toBeCloseTo(3,10);
 });
 it('propagates continuous white acceleration with the semigroup property',()=>{
  const t=new AdaptiveTracker({q:[2],switchSeconds:1,robustNIS:1e30,initialVelocitySigma:1});t.update(z(0));
  expect(t.predict(3).covariance[0]).toBeCloseTo(1+9+2*27/3,10);
  expect(t.predict(3).covariance[2]).toBeCloseTo(28,10);
 });
 it('preserves range-bearing correlation and rotated estimates',()=>{
  const angle=.7,c=Math.cos(angle),s=Math.sin(angle),a=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_BALANCED),b=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_BALANCED);
  for(let i=0;i<25;i++){const x=40+i*3+Math.sin(i),y=10+i*2;const r=polarCovariance(Math.hypot(x,y),Math.atan2(y,x),2,.003);
   a.update({...z(i,x,y),covariance:r});b.update({...z(i,x*c-y*s,x*s+y*c),covariance:[c*c*r[0]-2*c*s*r[1]+s*s*r[2],c*s*(r[0]-r[2])+(c*c-s*s)*r[1],s*s*r[0]+2*c*s*r[1]+c*c*r[2]]});}
  const pa=a.predict(30),pb=b.predict(30);expect(pb.x).toBeCloseTo(pa.x*c-pa.y*s,7);expect(pb.y).toBeCloseTo(pa.x*s+pa.y*c,7);expect(pb.ellipse.major).toBeCloseTo(pa.ellipse.major,7);
 });
 it('does not mutate a posterior when queried at different horizons',()=>{
  const t=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_FAST);for(let i=0;i<8;i++)t.update(z(i));const a=t.predict(10);t.predict(40);expect(t.predict(10)).toEqual(a);
  expect(t.update(z(6,99))).toEqual({accepted:false,reason:'STALE_OR_DUPLICATE'});expect(t.predict(10)).toEqual(a);
  expect(t.update(z(7,99)).accepted).toBe(false);expect(()=>t.update({...z(8),crs:'OTHER'})).toThrow();
 });
 it('is causal: predictions at a prefix equal a separately replayed prefix',()=>{
  const a=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_SLOW),b=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_SLOW);
  for(let i=0;i<10;i++){a.update(z(i,i*2+Math.cos(i)));b.update(z(i,i*2+Math.cos(i)));}
  const before=a.predict(15);for(let i=10;i<20;i++)a.update(z(i,-i*100));expect(b.predict(15)).toEqual(before);
 });
 it('downweights a large isolated residual without declaring it a false detection',()=>{
  const a=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_BALANCED),b=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_UNROBUST);
  for(let i=0;i<30;i++){a.update(z(i,i*3));b.update(z(i,i*3));}a.update(z(30,190));b.update(z(30,190));
  expect(Math.abs(a.predict(31).x-93)).toBeLessThan(Math.abs(b.predict(31).x-93));expect(a.downweighted).toBe(1);
 });
 it('keeps positive covariances through irregular, correlated, maneuvering data and gaps',()=>{
  const t=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_FAST);let time=0;
  for(let i=0;i<250;i++){time+=.1+(i%9)/3;t.update({...z(time,20+time*3+12*Math.sin(time/7),time+Math.cos(time)),covariance:[9,2.9,1]});const p=t.predict(time+10);
   expect(p.covariance.every(Number.isFinite)).toBe(true);expect(p.covariance[0]*p.covariance[2]-p.covariance[1]**2).toBeGreaterThan(0);expect(p.weights.reduce((a,b)=>a+b)).toBeCloseTo(1,10);}
  expect(t.predict(time+20).ellipse.major).toBeGreaterThan(t.predict(time+2).ellipse.major);
 });
 it('does not average an event-common systematic error down with more observations',()=>{
  const a=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_SLOW),b=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_SLOW);
  for(let i=0;i<100;i++){a.update(z(i));b.update({...z(i),systematic:[25,3,4]});}const x=a.predict(110),y=b.predict(110);
  expect(y.x).toBe(x.x);expect(y.covariance[0]-x.covariance[0]).toBeCloseTo(25);expect(y.covariance[1]-x.covariance[1]).toBeCloseTo(3);
 });
 it('rejects invalid covariance, future-to-past queries and invalid configuration',()=>{
  const t=new AdaptiveTracker(TRACKER_CANDIDATES.IMM_FAST);expect(()=>t.predict(1)).toThrow();expect(()=>t.update({...z(0),covariance:[1,2,1]})).toThrow();
  t.update(z(4));expect(()=>t.predict(3)).toThrow();expect(()=>polarCovariance(0,0,1,1)).toThrow();expect(()=>new AdaptiveTracker({...TRACKER_CANDIDATES.IMM_FAST,q:[-1]})).toThrow();
 });
 it('returns analytic ellipse axes and Mahalanobis distance',()=>{
  const e=ellipse95([9,0,1]);expect(e.major/e.minor).toBeCloseTo(3);expect(e.angle).toBe(0);expect(mahalanobis(3,1,[9,0,1])).toBeCloseTo(2);
 });
});
