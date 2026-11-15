import {describe,expect,it} from 'vitest';
import {roverHazardPixels} from './rover-hazard-raster';
import type {Terrain} from './planner';
import type {RoverGrid} from './rover-navigation';
const grid={width:4,height:1,cellSize:1,origin:[10,20]} as RoverGrid;
const terrain={valid:[1,0,1,1],slope:[0,null,13,0],obstacleMask:new Uint8Array([0,0,0,1])} as unknown as Terrain;
describe('recorded-surface display evidence',()=>{
 it('keeps clear cells transparent and distinguishes missing coverage, slope and buffered gaps',()=>{
  expect(Array.from(roverHazardPixels(grid,terrain,[]))).toEqual([0,0,0,0,160,172,177,100,244,181,74,170,160,172,177,100]);
 });
 it('uses world coordinates and preserves reviewed exclusions above other display classes',()=>{
  const pixels=roverHazardPixels(grid,terrain,[{id:'review',x:11.5,z:20.5,radius:.1,kind:'reviewed'}]);
  expect(Array.from(pixels.slice(4,8))).toEqual([248,85,52,255]);
  expect(Array.from(pixels.slice(0,4))).toEqual([0,0,0,0]);
 });
 it('does not mutate source validity or slope when rebuilding display pixels',()=>{
  const before=[...terrain.valid,...terrain.slope];roverHazardPixels(grid,terrain,[]);
  expect([...terrain.valid,...terrain.slope]).toEqual(before);
 });
});
