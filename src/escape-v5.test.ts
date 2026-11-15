import {it,expect} from 'vitest';
import {DEFAULTS} from './planner';import type {Terrain} from './planner';
import {prepareHazardContext,HAZARD_DEFAULTS,decideEscape} from './hazard-planner';import type {EscapeCandidate} from './hazard-planner';
import {makeXRFrame} from './hazard-xr';
import {exposureMPC} from './hazard-mpc';import {fitLocalTrack} from './local-dust-tracker';
import type {VortexTrack,VortexObservation} from './hazard-tracker';import {forecast} from './hazard-tracker';
const fixture=():Terrain=>{const n=1600;return {width:40,height:40,cellSize:5,bounds:[0,0,200,200],center:[77,18],crs:'test',elevation:Array(n).fill(0),slope:Array(n).fill(0),meanSlope:Array(n).fill(0),roughness:Array(n).fill(0),exposure:Array(n).fill(0),valid:Array(n).fill(1),thermal:Array(n).fill(300),thermalRange:[300,300]};};
const axis=(p:number,v=0)=>({p,v,pp:0,pv:0,vv:0});
const track:VortexTrack={time:0,lastObservation:0,x:axis(46,40),y:axis(50),r:axis(.4),accelerationNoise:0,radiusNoise:0,observations:3,rejected:0,source:'SIMULATED_SENSOR'};
const cfg={...HAZARD_DEFAULTS,policy:'local-matched' as const,localizationSigma:0,continuousContact:true};
const resources={oxygenSeconds:900,batterySeconds:900,missionSeconds:600,reserveFraction:.25};
it('scores a fast sub-sample crossing continuously in the actual terrain candidate bank',()=>{
 const c=prepareHazardContext(fixture(),DEFAULTS,{x:10,y:10});let held:EscapeCandidate|undefined;
 exposureMPC(c,{x:10,y:10},{x:20,y:10},0,track,resources,cfg,'MARS SHIFT',{onCandidates:all=>{held=all.find(a=>a.action==='HOLD'&&a.distance===0);}});
 expect(held?.predictedExposure).toBeCloseTo(.07,10);expect(held?.predictedMinClearance).toBeCloseTo(-1.4,10);
});
it('perfect-information injection changes forecasts only, retaining terrain and resource admission',()=>{
 const t=fixture();t.obstacleMask=Array(1600).fill(0);for(let y=0;y<40;y++)t.obstacleMask[y*40+11]=1;
 const c=prepareHazardContext(t,DEFAULTS,{x:10,y:10});let all:EscapeCandidate[]=[];
 const result=exposureMPC(c,{x:10,y:10},{x:20,y:10},0,track,resources,cfg,'MARS SHIFT',{forecastAt:time=>({...forecast(track,time,false,0),x:10000,y:10000}),onCandidates:candidates=>all=candidates});
 expect(result.chosen).not.toBeNull();expect(all.length).toBeGreaterThan(1);
 expect(all.every(a=>a.predictedExposure===0)).toBe(true);
 expect(all.every(a=>a.path.every(p=>p.x<11))).toBe(true);
});
it('uses three available fixes at startup even when a five-fix window is configured',()=>{
 const observations:VortexObservation[]=Array.from({length:5},(_,i)=>({time:i*2,x:3*i*2,y:0,radius:5,positionSigma:1,radiusSigma:.5,source:'SIMULATED_SENSOR'}));
 const conf={window:5 as const,radiusMode:'last' as const,processNoise:.08};
 const early=fitLocalTrack(observations.slice(0,3),conf),five=fitLocalTrack(observations,conf),three=fitLocalTrack(observations,{...conf,window:3});
 expect(early.time).toBe(4);expect(early.observations).toBe(3);expect(early.x.v).toBeCloseTo(3);
 expect(five.x.vv).toBeLessThan(three.x.vv);expect(five.x.v).toBeCloseTo(3);
});
it('exports the identical computed route and contact definitions to XR',()=>{
 const c=prepareHazardContext(fixture(),DEFAULTS,{x:10,y:10});
 const d=decideEscape(c,{x:10,y:10},{x:20,y:10},0,track,resources,'MARS SHIFT',cfg),frame=makeXRFrame(c.terrain,{x:10,y:10},d,9);
 expect(frame.route).toEqual(d.chosen!.path.map(p=>({x:p.x*5,y:p.y*5,time:p.time})));
 expect(frame.routeEvaluation?.contactMethod).toBe('CONTINUOUS');
 expect(frame.routeEvaluation?.predictedContactSeconds).toBe(d.chosen!.predictedExposure);
 expect(frame.routeEvaluation?.predictedMinClearanceMetres).toBe(d.chosen!.predictedMinClearance);
 expect(frame.routeEvaluation?.warningTimeReference).toBe('STATIONARY_ENVELOPE_FRONT_ENTRY');
});
