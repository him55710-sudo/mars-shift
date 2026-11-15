import {AdaptiveTracker} from './adaptive-tracker-v13';
import type {TrackerConfig} from './adaptive-tracker-v13';
import {availableFixes} from './encounter-v8';
import type {AbruptSession} from './encounter-v8';
import {fitLocalTrack} from './local-dust-tracker';
import {forecast} from './hazard-tracker';
/** Synthetic local-range adapter only. Never consumes the retrospective Sol215
 * coordinates; the old DEM and this simulation retain their shared frame. */
export function createEscapeTracker(config:TrackerConfig,covarianceScale=1){
 const tracker=new AdaptiveTracker(config);let consumed=0;
 return (s:AbruptSession)=>{
  const h=availableFixes(s);if(!h.length)return null;
  if(h.length<consumed)throw Error('Create a fresh tracker after resetting the simulation');
  while(consumed<h.length){const o=h[consumed++];tracker.update({time:o.time,x:o.x,y:o.y,covariance:[o.positionSigma**2,0,o.positionSigma**2],crs:s.g.terrain.crs});}
  const radius=fitLocalTrack(h.slice(-7),{window:7,radiusMode:'median',processNoise:.08});
  return (time:number)=>{const p=tracker.predict(time),r=forecast(radius,time,false,0);return {x:p.x,y:p.y,vx:p.vx,vy:p.vy,sigma:p.ellipse.major/2.447747*Math.sqrt(covarianceScale),radius:r.radius+1,radiusSigma:r.radius95/1.96,weights:p.weights};};
 };
}
