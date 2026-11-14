import {describe,it,expect} from 'vitest';
import {tileWindow,ATLAS_SIZE,TILE_SIZE} from './surface-tiles';
describe('physical display tile windows',()=>{
 it('keeps the focus inside a bounded four-tile atlas across the full region',()=>{
  for(let i=0;i<=100;i++)for(let j=0;j<=100;j++){
   const x=i/100,y=j/100,w=tileWindow(3334,x,y);
   expect(w.x).toBeGreaterThanOrEqual(0);expect(w.x).toBeLessThanOrEqual(5);
   expect(x-w.origin[0]).toBeGreaterThanOrEqual(0);expect(x-w.origin[0]).toBeLessThanOrEqual(w.span);
   expect(y-w.origin[1]).toBeGreaterThanOrEqual(0);expect(y-w.origin[1]).toBeLessThanOrEqual(w.span);
  }
 });
 it('retains the native pixel-to-metre mapping without stretching edge tiles',()=>{
  const w=tileWindow(3334,.9,.9);
  expect(w.origin[0]*3334).toBe(w.x*TILE_SIZE);
  expect(w.span*3334).toBeCloseTo(ATLAS_SIZE,10);
  expect(ATLAS_SIZE*ATLAS_SIZE*4).toBe(4194304);
 });
});
