import {describe,expect,it} from 'vitest';
import {measuredSurfacePixels} from './dem-appearance';
import {nativeNormalPixels} from './surface-geometry';
import type {NativeDEM} from './eva-motion';

function dem():NativeDEM{return {width:25,height:25,cellSize:1,bounds:[0,0,25,25],crs:'Mars',values:Float32Array.from({length:625},(_,i)=>10+(i%25)*.1+Math.floor(i/25)*.2)};}
const alpha=(pixels:Uint8Array,x:number,y:number)=>pixels[((24-y)*25+x)*4+3];
describe('appearance derived from measured DEM',()=>{
 it('keeps exact physical normals and gives planar slopes neutral cavity shading, including edges',()=>{
  const native=dem(),before=native.values.slice(),normal=nativeNormalPixels(native),pixels=measuredSurfacePixels(native);
  for(let i=0;i<pixels.length;i++)expect(pixels[i]).toBe(i%4===3?255:normal[i]);
  expect(native.values).toEqual(before);
 });
 it('shades measured concavities without adding a height or normal perturbation',()=>{
  const native=dem();native.values[12*25+12]-=1;const before=native.values.slice(),normal=nativeNormalPixels(native),pixels=measuredSurfacePixels(native);
  expect(alpha(pixels,12,12)).toBeLessThan(230);expect(alpha(pixels,12,12)).toBeGreaterThanOrEqual(Math.round(.66*255));
  for(let i=0;i<pixels.length;i++)if(i%4!==3)expect(pixels[i]).toBe(normal[i]);
  expect(native.values).toEqual(before);expect(alpha(pixels,3,3)).toBe(255);
 });
 it('does not turn a missing height or one-sided data boundary into a cavity',()=>{
  const native=dem();native.values.fill(10);for(let y=0;y<25;y++)native.values[y*25+12]=NaN;
  const pixels=measuredSurfacePixels(native);expect(alpha(pixels,12,12)).toBe(255);expect(alpha(pixels,11,12)).toBe(255);expect(alpha(pixels,13,12)).toBe(255);
 });
 it('uses metric distances so rescaling coordinates and heights preserves display shading',()=>{
  const native=dem();native.values[12*25+12]-=.5;const scaled={...native,cellSize:2,values:Float32Array.from(native.values,v=>v*2)};
  expect(measuredSurfacePixels(scaled)).toEqual(measuredSurfacePixels(native));
 });
});
