import {describe,expect,it} from 'vitest';
import {DEFAULTS,metrics} from './planner';
import type {Route,Terrain} from './planner';
import {constrainedPlan} from './constrained-planner';
import {computeReturnMap} from './return-feasibility';
import {calculateMission,defaultMission,validDraft} from './mission-state';
import {initialCrew} from './crew-engine';
import {mappedHazard,routeElevationProfile,ROUTE_OPTIONS} from './mission-map-model';
function terrain():Terrain{const n=81;return {width:9,height:9,cellSize:5,bounds:[0,0,45,45],center:[0,0],crs:'Mars projected metres',elevation:Array.from({length:n},(_,i)=>i%9*.2),slope:Array(n).fill(5),meanSlope:Array(n).fill(4),roughness:Array(n).fill(.3),exposure:Array(n).fill(0),valid:Array(n).fill(1),thermal:Array(n).fill(200),thermalRange:[200,200]};}
describe('four synchronized route objectives',()=>{
 it('finds the same minimum directed time as independent forward/reverse Dijkstra',()=>{const t=terrain(),base={x:1,y:7},target={x:7,y:1},m=computeReturnMap(t,base,DEFAULTS,null),r=constrainedPlan(t,base,target,'time',DEFAULTS,null).route!;expect(r).not.toBeNull();expect(r.travelMinutes).toBeCloseTo(m.outbound[16]+m.inbound[16],10);expect(r.cost).toBeCloseTo(r.travelMinutes,10);expect(r.cells[0]).toBe(r.cells.at(-1));});
 it('keeps resource and obstacle constraints hard for the fastest objective',()=>{const t=terrain(),base={x:1,y:7},target={x:7,y:1};expect(constrainedPlan(t,base,target,'time',{...DEFAULTS,durationMinutes:.01},null).route).toBeNull();t.obstacleMask=new Uint8Array(81);for(let y=0;y<9;y++)t.obstacleMask[y*9+4]=1;expect(constrainedPlan(t,base,target,'time',DEFAULTS,null).route).toBeNull();});
 it('preserves fastest mode in shared mission validation and exact crew handoff',()=>{const t=terrain(),draft={...defaultMission(t),base:{x:1,y:7},target:{x:7,y:1},mode:'time' as const},state=calculateMission(t,validDraft(t,draft)),r=state.reports.time.route!;expect(ROUTE_OPTIONS.map(r=>r.id)).toEqual(expect.arrayContaining(['time','shortest','exposure','energy','mission']));expect(Object.keys(state.reports)).toContain('time');const crew=initialCrew(t,{...draft,computed:{outbound:r.outbound,inbound:r.inbound}});expect(crew.track).toEqual(r.outbound);expect(crew.returnTrack).toEqual(r.inbound);});
});
describe('registered map evidence and route profile',()=>{
 it('profiles actual route elevations over metre-scale 3D edge distances',()=>{const t=terrain();t.elevation[0]=0;t.elevation[1]=3;t.elevation[10]=4;const cells=[0,1,10],r={...metrics(t,[...cells,1,0],'shortest',DEFAULTS),outbound:cells,inbound:[10,1,0]} as Route,profile=routeElevationProfile(t,r);expect(profile.map(s=>s.elevation)).toEqual([0,3,4]);expect(profile[1].distance).toBeCloseTo(Math.hypot(5,3));expect(profile[2].distance).toBeCloseTo(Math.hypot(5,3)+Math.hypot(5,1));});
 it('does not interpolate a profile through unobserved terrain',()=>{const t=terrain(),r={...metrics(t,[0,1,0],'shortest',DEFAULTS),outbound:[0,1],inbound:[1,0]};t.valid[1]=0;expect(routeElevationProfile(t,r)).toEqual([]);expect(routeElevationProfile(t,null)).toEqual([]);});
 it('keeps unknown, excluded and derived-proximity evidence distinct',()=>{const t=terrain();t.valid[0]=0;t.slope[1]=30;t.exposure[2]=1;expect(mappedHazard(t,0,DEFAULTS,null)).toBe('unknown');expect(mappedHazard(t,1,DEFAULTS,null)).toBe('excluded');expect(mappedHazard(t,2,DEFAULTS,null)).toBe('steep-proximity');expect(mappedHazard(t,3,DEFAULTS,null)).toBe('clear-mapped');expect(mappedHazard(t,3,{...DEFAULTS,mobilityModel:2},null)).toBe('unknown');});
});
