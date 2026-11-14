/** Local tangent coordinates: x east, y south, metres; timestamps are simulation seconds.
 * A point weather station is NOT a position sensor. Inputs below are simulated optical/range fixes. */
export type AxisState = {p:number;v:number;pp:number;pv:number;vv:number};
export type VortexObservation = {time:number;x:number;y:number;radius:number;positionSigma:number;radiusSigma:number;source:'SIMULATED_SENSOR'};
export type VortexTrack = {time:number;lastObservation:number;x:AxisState;y:AxisState;r:AxisState;accelerationNoise:number;radiusNoise:number;observations:number;rejected:number;source:'SIMULATED_SENSOR';pendingManeuver?:VortexObservation;reacquisitions?:number};
export type Forecast = {time:number;x:number;y:number;radius:number;position95:number;radius95:number;envelope:number;vx:number;vy:number;age:number;valid:boolean};
const initial=(p:number,sigma:number,velocity=0):AxisState=>({p,v:velocity,pp:sigma*sigma,pv:0,vv:9});
function predict(a:AxisState,dt:number,q:number):AxisState {
 return {p:a.p+a.v*dt,v:a.v,pp:a.pp+2*dt*a.pv+dt*dt*a.vv+q*q*dt**3/3,pv:a.pv+dt*a.vv+q*q*dt*dt/2,vv:a.vv+q*q*dt};
}
function correct(a:AxisState,z:number,sigma:number):AxisState {
 const variance=sigma*sigma,s=a.pp+variance,kp=a.pp/s,kv=a.pv/s,e=z-a.p;
 // Scalar Joseph update: preserves positive semidefiniteness under roundoff.
 return {p:a.p+kp*e,v:a.v+kv*e,pp:(1-kp)**2*a.pp+kp*kp*variance,pv:(1-kp)*(a.pv-kv*a.pp)+kp*kv*variance,vv:a.vv-2*kv*a.pv+kv*kv*(a.pp+variance)};
}
export function validObservation(o:VortexObservation){return o.source==='SIMULATED_SENSOR'&&[o.time,o.x,o.y,o.radius,o.positionSigma,o.radiusSigma].every(Number.isFinite)&&o.radius>0&&o.positionSigma>0&&o.radiusSigma>0;}
export function startTrack(o:VortexObservation,accelerationNoise=.25):VortexTrack {
 if(!validObservation(o)||!Number.isFinite(accelerationNoise)||accelerationNoise<=0)throw Error('Invalid vortex observation or process noise');
 return {time:o.time,lastObservation:o.time,x:initial(o.x,o.positionSigma),y:initial(o.y,o.positionSigma),r:{...initial(o.radius,o.radiusSigma),vv:.04},accelerationNoise,radiusNoise:.05,observations:1,rejected:0,source:o.source};
}
export function updateTrack(track:VortexTrack,o:VortexObservation):VortexTrack {
 if(!validObservation(o)||o.time<=track.time)return {...track,rejected:track.rejected+1};
 const dt=o.time-track.time,x=predict(track.x,dt,track.accelerationNoise),y=predict(track.y,dt,track.accelerationNoise),r=predict(track.r,dt,track.radiusNoise);
 const innovation=(o.x-x.p)**2/(x.pp+o.positionSigma**2)+(o.y-y.p)**2/(y.pp+o.positionSigma**2);
 if(innovation>36)return {...track,rejected:track.rejected+1};
 return {...track,time:o.time,lastObservation:o.time,x:correct(x,o.x,o.positionSigma),y:correct(y,o.y,o.positionSigma),r:correct(r,o.radius,o.radiusSigma),observations:track.observations+1};
}
/** Two-fix maneuver reacquisition: a single spurious fix cannot reset the track.
 * 60 m/s is a declared plausibility cap, not a learned Martian maximum. */
export function updateTrackResponsive(track:VortexTrack,o:VortexObservation):VortexTrack {
 const updated=updateTrack(track,o);
 if(updated.time>track.time)return {...updated,pendingManeuver:undefined};
 if(!validObservation(o)||o.time<=track.time)return updated;
 const a=track.pendingManeuver,dt=a?o.time-a.time:0;
 if(a&&dt>0&&dt<=6&&Math.hypot(o.x-a.x,o.y-a.y)/dt<=60){
  const fresh=startTrack(o,track.accelerationNoise),vv=(a.positionSigma**2+o.positionSigma**2)/dt**2;
  return {...fresh,x:{...fresh.x,v:(o.x-a.x)/dt,vv},y:{...fresh.y,v:(o.y-a.y)/dt,vv},r:{...fresh.r,v:Math.max(-.5,Math.min(.5,(o.radius-a.radius)/dt)),vv:.1},observations:track.observations+2,rejected:updated.rejected,reacquisitions:(track.reacquisitions??0)+1};
 }
 return {...updated,pendingManeuver:o};
}
export function forecast(track:VortexTrack,time:number,uncertainty=true,localizationSigma=1):Forecast {
 const dt=Math.max(0,time-track.time),x=predict(track.x,dt,track.accelerationNoise),y=predict(track.y,dt,track.accelerationNoise),r=predict(track.r,dt,track.radiusNoise);
 const position95=2.447747*Math.sqrt(Math.max(0,x.pp,y.pp)+localizationSigma**2),radius95=1.96*Math.sqrt(Math.max(0,r.pp));
 const radius=Math.max(.1,r.p);
 return {time,x:x.p,y:y.p,radius,position95,radius95,envelope:radius+(uncertainty?position95+radius95:0)+1,vx:x.v,vy:y.v,age:time-track.lastObservation,valid:Number.isFinite(time)&&time>=track.time&&dt<=60&&track.observations>=3};
}
/** Conservative monotone covariance bound over a whole edge; no endpoint-only collision test. */
export function sweptVortexCollision(track:VortexTrack,a:{x:number;y:number},b:{x:number;y:number},start:number,end:number,uncertainty:boolean,localizationSigma=1){
 if(![start,end,a.x,a.y,b.x,b.y].every(Number.isFinite)||end<start||start<track.time)return true;
 const f=forecast(track,start,uncertainty,localizationSigma),g=forecast(track,end,uncertainty,localizationSigma);
 if(!f.valid||!g.valid)return true;
 const dx=a.x-f.x,dy=a.y-f.y,vx=(b.x-g.x)-dx,vy=(b.y-g.y)-dy,den=vx*vx+vy*vy,u=den?Math.max(0,Math.min(1,-(dx*vx+dy*vy)/den)):0;
 // pp(dt) is convex on dt >= 0 (second derivative 2*vv + 2*q²*dt).
 // Its maximum over this interval is therefore at an endpoint.
 const p=Math.max(f.position95,g.position95),r=Math.max(f.radius95,g.radius95);
 const radius=Math.max(f.radius,g.radius)+1+(uncertainty?p+r:0);
 return Math.hypot(dx+u*vx,dy+u*vy)<=radius;
}
