/** Incremental, full-covariance CV/IMM tracker. Independently implemented.
 * Q follows the continuous white-acceleration model; IMM mixing includes
 * between-model covariance. This is a kinematic assumption, not Martian CFD.
 */
export type Cov2 = [xx:number,xy:number,yy:number];
export type MetricMeasurement = {time:number;x:number;y:number;covariance:Cov2;crs:string;systematic?:Cov2};
export type TrackerConfig = {q:number[];switchSeconds:number;robustNIS:number;initialVelocitySigma:number};
export const TRACKER_CANDIDATES:Record<string,TrackerConfig> = {
 IMM_SLOW:{q:[.001,.04,1.44],switchSeconds:30,robustNIS:25,initialVelocitySigma:10},
 IMM_FAST:{q:[.01,.25,4],switchSeconds:10,robustNIS:25,initialVelocitySigma:10},
 IMM_BALANCED:{q:[.0025,.16,2.25],switchSeconds:20,robustNIS:25,initialVelocitySigma:10},
 IMM_UNROBUST:{q:[.0025,.16,2.25],switchSeconds:20,robustNIS:1e30,initialVelocitySigma:10},
};
type State={x:number[];P:number[]};
type Mode=State&{weight:number;q:number};
export const CHI2_95=5.991464547;
const zero=()=>Array<number>(16).fill(0);
const eye=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mul=(a:number[],b:number[])=>{const c=zero();for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[4*i+j]+=a[4*i+k]*b[4*k+j];return c;};
const transpose=(a:number[])=>a.map((_,k)=>a[(k%4)*4+Math.floor(k/4)]);
const clean=(p:number[])=>{for(let i=0;i<4;i++){p[5*i]=Math.max(1e-12,p[5*i]);for(let j=0;j<i;j++)p[4*i+j]=p[4*j+i]=(p[4*i+j]+p[4*j+i])/2;}return p;};
function checkCov(r:Cov2,allowZero=false){
 if(r.length!==3||!r.every(Number.isFinite)||r[0]<0||r[2]<0||r[0]*r[2]-r[1]**2< -1e-9||(!allowZero&&(r[0]<=0||r[2]<=0||r[0]*r[2]-r[1]**2<=0)))throw Error('Positive definite measurement covariance required');
}
export function polarCovariance(range:number,bearing:number,rangeSigma:number,bearingSigma:number):Cov2{
 if(![range,bearing,rangeSigma,bearingSigma].every(Number.isFinite)||range<=0||rangeSigma<=0||bearingSigma<=0)throw Error('Finite positive range and sensor errors required');
 const c=Math.cos(bearing),s=Math.sin(bearing),a=rangeSigma**2,b=(range*bearingSigma)**2;
 return [a*c*c+b*s*s,(a-b)*s*c,a*s*s+b*c*c];
}
export function ellipse95(r:Cov2,scale=1){
 checkCov(r,true);if(!Number.isFinite(scale)||scale<=0)throw Error('Positive scale required');
 const mid=(r[0]+r[2])/2,delta=Math.hypot((r[0]-r[2])/2,r[1]);
 return {major:Math.sqrt(Math.max(0,mid+delta)*CHI2_95*scale),minor:Math.sqrt(Math.max(0,mid-delta)*CHI2_95*scale),angle:.5*Math.atan2(2*r[1],r[0]-r[2])};
}
export function mahalanobis(dx:number,dy:number,r:Cov2){const det=r[0]*r[2]-r[1]**2;return det>0?(r[2]*dx*dx-2*r[1]*dx*dy+r[0]*dy*dy)/det:Infinity;}
function propagate(s:State,dt:number,q:number):State{
 const F=[1,0,dt,0,0,1,0,dt,0,0,1,0,0,0,0,1],P=mul(mul(F,s.P),transpose(F));
 for(const [p,v]of [[0,2],[1,3]]){P[5*p]+=q*dt**3/3;P[p*4+v]+=q*dt*dt/2;P[v*4+p]+=q*dt*dt/2;P[5*v]+=q*dt;}
 return {x:[s.x[0]+dt*s.x[2],s.x[1]+dt*s.x[3],s.x[2],s.x[3]],P:clean(P)};
}
function mix(states:State[],weights:number[]):State{
 const x=Array<number>(4).fill(0),P=zero();states.forEach((s,k)=>s.x.forEach((v,i)=>x[i]+=weights[k]*v));
 states.forEach((s,k)=>{for(let i=0;i<4;i++)for(let j=0;j<4;j++)P[4*i+j]+=weights[k]*(s.P[4*i+j]+(s.x[i]-x[i])*(s.x[j]-x[j]));});return {x,P:clean(P)};
}
function correct(s:State,z:MetricMeasurement,robustNIS:number){
 let [a,b,c]=z.covariance;const dx=z.x-s.x[0],dy=z.y-s.x[1];
 const original:Cov2=[s.P[0]+a,s.P[1]+b,s.P[5]+c],nis=mahalanobis(dx,dy,original);
 // Bounded influence, not a declaration that a measurement is false. Large
 // innovations can also be real turns; unrobust ablation is evaluated separately.
 const inflation=Math.min(100,Math.max(1,nis/robustNIS));a*=inflation;b*=inflation;c*=inflation;
 const S:Cov2=[s.P[0]+a,s.P[1]+b,s.P[5]+c],det=S[0]*S[2]-S[1]**2;
 const K=Array<number>(8).fill(0),A=eye(),P=zero();
 for(let i=0;i<4;i++){K[2*i]=(s.P[4*i]*S[2]-s.P[4*i+1]*S[1])/det;K[2*i+1]=(s.P[4*i+1]*S[0]-s.P[4*i]*S[1])/det;A[4*i]-=K[2*i];A[4*i+1]-=K[2*i+1];}
 const J=mul(mul(A,s.P),transpose(A));
 for(let i=0;i<4;i++)for(let j=0;j<4;j++)P[4*i+j]=J[4*i+j]+K[2*i]*a*K[2*j]+K[2*i]*b*K[2*j+1]+K[2*i+1]*b*K[2*j]+K[2*i+1]*c*K[2*j+1];
 return {x:s.x.map((v,i)=>v+K[2*i]*dx+K[2*i+1]*dy),P:clean(P),nis,inflation,logLikelihood:-.5*(Math.log(det)+mahalanobis(dx,dy,S))};
}
export class AdaptiveTracker {
 private modes:Mode[]=[];private time=-Infinity;private crs='';private systematic:Cov2=[0,0,0];
 updates=0;downweighted=0;lastNIS:number|null=null;
 readonly config:TrackerConfig;
 constructor(config:TrackerConfig){
  if(!config.q.length||config.q.some(q=>!Number.isFinite(q)||q<0)||![config.switchSeconds,config.robustNIS,config.initialVelocitySigma].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid tracker configuration');
  this.config={...config,q:[...config.q]};
 }
 update(z:MetricMeasurement){
  if(![z.time,z.x,z.y].every(Number.isFinite)||!z.crs)throw Error('Finite measurement and frame required');checkCov(z.covariance);if(z.systematic)checkCov(z.systematic,true);
  if(this.updates&&z.crs!==this.crs)throw Error('Coordinate frame changed');
  // Do not corrupt state with duplicated or late packets; no silent rewinding.
  if(z.time<=this.time)return {accepted:false,reason:'STALE_OR_DUPLICATE' as const};
  const N=this.config.q.length;
  if(!this.updates){const P=zero();P[0]=z.covariance[0];P[1]=P[4]=z.covariance[1];P[5]=z.covariance[2];P[10]=P[15]=this.config.initialVelocitySigma**2;
   this.modes=this.config.q.map(q=>({x:[z.x,z.y,0,0],P:[...P],weight:1/N,q}));this.crs=z.crs;
  }else{
   const dt=z.time-this.time,stay=Math.exp(-dt/this.config.switchSeconds),transition=(i:number,j:number)=>(i===j?stay:0)+(1-stay)/N;
   const prior=this.modes.map((_,j)=>this.modes.reduce((sum,m,i)=>sum+m.weight*transition(i,j),0));
   const results=this.modes.map((m,j)=>{const weights=this.modes.map((p,i)=>p.weight*transition(i,j)/prior[j]);return correct(propagate(mix(this.modes,weights),dt,m.q),z,this.config.robustNIS);});
   const logs=results.map((r,j)=>Math.log(prior[j])+r.logLikelihood),peak=Math.max(...logs),w=logs.map(v=>Math.exp(v-peak)),sum=w.reduce((a,b)=>a+b);
   this.lastNIS=results.reduce((s,r,i)=>s+prior[i]*r.nis,0);if(results.every(r=>r.inflation>1))this.downweighted++;
   this.modes=results.map((r,j)=>({x:r.x,P:r.P,weight:w[j]/sum,q:this.config.q[j]}));
  }
  this.time=z.time;this.systematic=z.systematic?[...z.systematic]:[0,0,0];this.updates++;return {accepted:true,reason:'UPDATED' as const};
 }
 predict(time:number){
  if(!this.updates||!Number.isFinite(time)||time<this.time)throw Error('Prediction requires a non-past target and an observation');
  const age=time-this.time,weights=this.modes.map(m=>m.weight),s=mix(this.modes.map(m=>propagate(m,age,m.q)),weights);
  const covariance:Cov2=[s.P[0]+this.systematic[0],s.P[1]+this.systematic[1],s.P[5]+this.systematic[2]];
  return {time,x:s.x[0],y:s.x[1],vx:s.x[2],vy:s.x[3],covariance,ellipse:ellipse95(covariance),weights,age,updates:this.updates,downweighted:this.downweighted,nis:this.lastNIS,crs:this.crs};
 }
}
