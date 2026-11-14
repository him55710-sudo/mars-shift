import {describe,it,expect} from 'vitest';
import {DEFAULTS} from './planner';
import type {Terrain} from './planner';
import {HAZARD_DEFAULTS,prepareHazardContext,decideEscape,positionOnPath,staticSegmentSafe} from './hazard-planner';
import {startTrack,updateTrack,updateTrackResponsive} from './hazard-tracker';
import {makeXRFrame} from './hazard-xr';
import {makeNovelScenario,NOVEL_SCENARIOS} from './hazard-simulation';
import {forecastRegionalStorm,greatCircleKm,regionalEscapeAssessment,circleIoU} from './storm-forecast';
import {boundaryPlausibility} from './storm-boundary';
import boundaryData from '../public/data/hazards/storm-boundaries.json';
import evidence from '../public/data/hazards/observations.json';
const t=():Terrain=>({width:40,height:40,cellSize:5,bounds:[0,0,200,200],center:[77,18],crs:'test',elevation:Array(1600).fill(0),slope:Array(1600).fill(0),meanSlope:Array(1600).fill(0),roughness:Array(1600).fill(0),exposure:Array(1600).fill(0),valid:Array(1600).fill(1),thermal:Array(1600).fill(300),thermalRange:[300,300]});
const config={...HAZARD_DEFAULTS,policy:'exposure-mpc' as const},resources={oxygenSeconds:900,batterySeconds:900,missionSeconds:900,reserveFraction:.25};
function track(x:number,y:number,vx=0,vy=0,radius=8){let z=startTrack({time:-12,x:x-12*vx,y:y-12*vy,radius,positionSigma:1,radiusSigma:.5,source:'SIMULATED_SENSOR'},.08);for(let time=-10;time<=0;time+=2)z=updateTrack(z,{time,x:x+time*vx,y:y+time*vy,radius,positionSigma:1,radiusSigma:.5,source:'SIMULATED_SENSOR'});return z;}
describe('exposure-first navigation',()=>{
 it('requires corroboration before reacquiring a sharp maneuver',()=>{const before=track(50,50,2),fix={time:2,x:80,y:65,radius:8,positionSigma:1,radiusSigma:.5,source:'SIMULATED_SENSOR' as const},one=updateTrackResponsive(before,fix);expect(one.time).toBe(0);const two=updateTrackResponsive(one,{...fix,time:4,x:84,y:66});expect(two.time).toBe(4);expect(two.reacquisitions).toBe(1);const recovered=updateTrackResponsive(one,{...fix,time:4,x:58,y:50});expect(recovered.reacquisitions??0).toBe(0);});
 it('labels bounded sensor-gap coasting and stops at the declared limit',()=>{const c=prepareHazardContext(t(),DEFAULTS,{x:5,y:5}),cfg={...config,coastSeconds:16},z=track(500,500);expect(decideEscape(c,{x:10,y:10},{x:20,y:10},10,z,resources,'MARS SHIFT',cfg).reason).toContain('SENSOR GAP');expect(decideEscape(c,{x:10,y:10},{x:20,y:10},18,z,resources,'MARS SHIFT',cfg).status).toBe('SENSOR_STALE');});
 it('leaves an already occupied footprint instead of rejecting every escape edge',()=>{const c=prepareHazardContext(t(),{...DEFAULTS,speed:1,loadKg:0},{x:8,y:10}),d=decideEscape(c,{x:10,y:10},{x:25,y:10},0,track(50,50),resources,'MARS SHIFT',config);expect(d.status).toBe('EXPOSURE_MINIMIZING');expect(d.chosen).not.toBeNull();expect(d.action).not.toBe('HOLD');const p=positionOnPath(d.chosen!.path,2);expect(Math.hypot(p.x-10,p.y-10)).toBeGreaterThan(.1);expect(d.chosen!.predictedExposure).toBeLessThan(30);expect(makeXRFrame(c.terrain,{x:10,y:10},d,1).anchorsEnabled).toBe(true);});
 it('makes progress when a far passing vortex gives no reason to wait',()=>{const c=prepareHazardContext(t(),{...DEFAULTS,speed:1,loadKg:0},{x:8,y:10}),d=decideEscape(c,{x:10,y:10},{x:25,y:10},0,track(500,500,2),resources,'MARS SHIFT',config);expect(d.action).not.toBe('HOLD');expect(positionOnPath(d.chosen!.path,2).x).toBeGreaterThan(10);expect(d.chosen!.predictedExposure).toBe(0);});
 it('respects terrain walls and walking speed in every trajectory',()=>{const terrain=t();for(let y=0;y<40;y++)terrain.valid[y*40+12]=0;const c=prepareHazardContext(terrain,{...DEFAULTS,speed:.6,loadKg:0},{x:8,y:10}),d=decideEscape(c,{x:10.2,y:10},{x:10,y:20},0,track(50,50),resources,'MARS SHIFT',config);for(const candidate of d.candidates)for(let i=1;i<candidate.path.length;i++){const a=candidate.path[i-1],b=candidate.path[i];expect(staticSegmentSafe(terrain,c.settings,a,b)).toBe(true);expect(Math.hypot(a.x-b.x,a.y-b.y)*5).toBeLessThanOrEqual((b.time-a.time)*.6+1e-8);}});
 it('uses return urgency before the remaining budget makes every action infeasible',()=>{const c=prepareHazardContext(t(),{...DEFAULTS,speed:1,loadKg:0},{x:5,y:10}),d=decideEscape(c,{x:10,y:10},{x:25,y:10},0,track(500,500),{...resources,oxygenSeconds:90,batterySeconds:90,missionSeconds:90},'MARS SHIFT',config);expect(positionOnPath(d.chosen!.path,2).x).toBeLessThan(10);});
 it('keeps invalid localization and blocked positions out of guidance',()=>{const terrain=t(),c=prepareHazardContext(terrain,DEFAULTS,{x:5,y:5});expect(decideEscape(c,{x:10,y:10},{x:20,y:20},10,track(50,50),resources,'MARS SHIFT',config).status).toBe('SENSOR_STALE');terrain.valid[410]=0;expect(decideEscape(c,{x:10,y:10},{x:20,y:20},0,track(50,50),resources,'MARS SHIFT',config).chosen).toBeNull();});
 it('generates grid-aligned new scenario bases and targets',()=>{for(const kind of NOVEL_SCENARIOS){const s=makeNovelScenario(t(),evidence,2001,kind);for(const p of [s.start,s.target,s.base])expect(Number.isInteger(p.x)&&Number.isInteger(p.y)).toBe(true);}});
});
describe('orbital storm forecasting uses physical scales',()=>{
 const a={year:31,phase:'P01',member:'P01_001',sol:1,lat:0,lon:179,areaKm2:100000,confidence:100},b={...a,sol:2,lon:-179},c={damping:.5,growth:0,window:2,centerErrorKm:100,radiusErrorKm:30};
 it('crosses longitude wrap along the short arc, not across the planet',()=>{const p=forecastRegionalStorm([a,b],3,c);expect(p.lon).toBeCloseTo(-178);expect(greatCircleKm(a,b)).toBeLessThan(120);});
 it('preserves area without invented growth and rejects mixed phase/identity',()=>{expect(forecastRegionalStorm([a,b],3,c).areaKm2).toBeCloseTo(100000);expect(()=>forecastRegionalStorm([a,{...b,member:'other'}],3,c)).toThrow();expect(()=>forecastRegionalStorm([a,b],7,c)).toThrow();});
 it('does not promise a walker can escape a regional footprint',()=>{const f=forecastRegionalStorm([a,b],3,c),v=regionalEscapeAssessment(f,f,.6,3600);expect(v.canWalkOut).toBe(false);expect(v.action).toBe('RETURN_TO_SHELTER');expect(v.walkKm).toBeCloseTo(2.16);});
 it('labels equivalent-circle overlap with correct geometric limits',()=>{expect(circleIoU(10,10,0)).toBeCloseTo(1);expect(circleIoU(10,10,21)).toBe(0);expect(circleIoU(10,5,0)).toBeCloseTo(.25);});
});

describe('observed boundary registration guard',()=>{
 it('rejects impossible latitudes and preserves quarantine of the downloaded archive',()=>{expect(boundaryPlausibility([[17.6,71.3],[112.2,96.2],[70,80]],{lon:74.45,lat:51.55}).valid).toBe(false);expect(boundaryData.registration).toBe('UNVERIFIED');expect(boundaryData.validation.invalidGeographicRange.length).toBe(31);});
 it('detects a misplaced outline while handling longitude wrap correctly',()=>{expect(boundaryPlausibility([[40,20],[45,20],[45,25],[40,25]],{lon:42,lat:10}).valid).toBe(false);expect(boundaryPlausibility([[179,-1],[-179,-1],[-179,1],[179,1]],{lon:180,lat:0}).valid).toBe(true);});
});
