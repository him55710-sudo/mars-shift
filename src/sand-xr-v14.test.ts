import {it,expect} from 'vitest';
import {sandXRFrame} from './sand-xr-v14';
import {mapSandTraps} from './sand-traps-v14';
import {sandGroundPixels} from './sand-display-v14';
import {DEFAULTS,plan} from './planner';
import type {Terrain} from './planner';
const t:Terrain={width:8,height:8,cellSize:1,bounds:[0,0,8,8],crs:'TEST',center:[0,0],elevation:Array(64).fill(0),slope:Array(64).fill(0),meanSlope:Array(64).fill(0),roughness:Array(64).fill(0),exposure:Array(64).fill(0),thermal:Array(64).fill(null),thermalRange:[0,0],valid:Array(64).fill(1)};
it('publishes absolute times including slope/load travel and diagonal length',()=>{
 const settings={...DEFAULTS,scienceMinutes:0},route=plan(t,{x:1,y:1},{x:4,y:4},'shortest',settings,null)!;
 const frame=sandXRFrame(t,mapSandTraps(t),{x:1,y:1},route,settings,7,60);
 expect(frame.route[0].time).toBe(60);expect(frame.route.at(-1)!.time-60).toBeCloseTo(route.travelMinutes*60/2,8);
 expect(frame.ground.sinkageProbability).toBeNull();expect(frame.crs).toBe(t.crs);expect(frame.ground.source).toBe('DERIVED_NOAH_H');
});
it('withholds the route when infeasible but retains the unknown ground map',()=>{
 const m=mapSandTraps(t),frame=sandXRFrame(t,m,{x:1,y:1},null,DEFAULTS,8,65);expect(frame.action).toBe('HOLD');expect(frame.anchorsEnabled).toBe(false);expect(frame.route).toEqual([]);expect(frame.ground.unknownIndices).toHaveLength(64);
});
it('renders candidates, buffers and unknowns as distinct ground categories',()=>{
 const m=mapSandTraps(t);m.core[1]=1;m.buffer[1]=1;m.buffer[2]=1;const pixels=sandGroundPixels(m);expect(Array.from(pixels.slice(4,8))).toEqual([246,157,51,250]);expect(Array.from(pixels.slice(8,12))).toEqual([250,207,115,230]);expect(Array.from(pixels.slice(12,16))).toEqual([160,164,180,100]);
});
