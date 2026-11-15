import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {explorationGrid,observedCoverage} from './rover-entry';
import {groundRouteRaster} from './rover-ground-route';
import {gridPoint,worldPoint,roverTerrain,roverRoutes,moveOnRover,ROVER_SETTINGS} from './rover-navigation';
import type {RoverGrid} from './rover-navigation';
const raw=JSON.parse(readFileSync('public/data/drive1004/navigation-grid.json','utf8')) as RoverGrid;
const g=explorationGrid(raw),terrain=roverTerrain(g,[]),start=gridPoint(g,g.start.x,g.start.z),target=gridPoint(g,g.target.x,g.target.z),routes=roverRoutes(terrain,start,target),route=routes.exposure!;
describe('Observed surface entry and ground-projected guidance',()=>{
 it('starts inside a fully observed 3 m neighbourhood without altering source geometry or recorded scenarios',()=>{
  expect(g.elevation).toBe(raw.elevation);expect(g.slope).toBe(raw.slope);expect(explorationGrid(raw,true)).toBe(raw);
  const before=observedCoverage(raw,raw.start.x,raw.start.z),after=observedCoverage(g,g.start.x,g.start.z);
  expect(after.fraction).toBe(1);expect(after.clearance).toBeGreaterThan(3.4);expect(after.fraction).toBeGreaterThan(before.fraction);
  expect(raw.start).toEqual({x:1.375,z:5.375});
  writeFileSync('analysis/observed-ground-entry.json',JSON.stringify({source:'NASA-AMMOS/3DTilesSampleData Drive1004',samplingMetres:g.cellSize,before:{point:raw.start,...before},after:{point:g.start,...after},target:g.target,routes:Object.fromEntries(Object.entries(routes).map(([k,r])=>[k,r?{roundTripMetres:r.distance,totalMinutes:r.totalMinutes,maxSlopeDegrees:r.maxSlope}:null])),limits:['Coverage means a finite sample in the existing conservative grid, not independently verified surface accuracy.','Entry selection changes only exploration defaults. Navigation geometry, constraints and recorded scenarios are unchanged.','Only original NASA triangles receive the walking overlay. No navigation infill; optional photo context uses explicitly estimated depth.']},null,2)+'\n');
 });
 it('walks every computed outbound and return edge with the existing swept collision checks',()=>{
  expect(Object.values(routes).every(r=>r?.feasible)).toBe(true);
  for(const path of [route.outbound,route.inbound])for(let n=1;n<path.length;n++){
   const a={x:path[n-1]%g.width,y:Math.floor(path[n-1]/g.width)},b={x:path[n]%g.width,y:Math.floor(path[n]/g.width)};
   const moved=moveOnRover(terrain,a,(b.x-a.x)*g.cellSize,(b.y-a.y)*g.cellSize,ROVER_SETTINGS);
   expect(moved.reason).toBe('');expect(moved.point.x).toBeCloseTo(b.x);expect(moved.point.y).toBeCloseTo(b.y);
  }
 });
 it('registers the overlay to metre coordinates, leaving unknown and excluded samples unpainted',()=>{
  const raster=groundRouteRaster(g,terrain,route);expect(raster.spacing).toBe(.05);expect(raster.width).toBe(800);
  let painted=0;for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++){
   if(!raster.pixels[(y*raster.width+x)*4])continue;painted++;
   const i=Math.floor(y/5)*g.width+Math.floor(x/5);expect(!!terrain.valid[i]).toBe(true);expect(terrain.obstacleMask?.[i]).toBe(0);
  }expect(painted).toBeGreaterThan(400);
  for(const i of route.outbound){const x=(i%g.width)*5+2,y=Math.floor(i/g.width)*5+2;expect(raster.pixels[(y*raster.width+x)*4]).toBeGreaterThan(240);}
  expect(groundRouteRaster(g,terrain,null).pixels.some(v=>v!==0)).toBe(false);
 });
 it('removes obsolete projected guidance after an exclusion invalidates or reroutes the plan',()=>{
  const i=route.outbound[Math.floor(route.outbound.length/2)],w=worldPoint(g,{x:i%g.width,y:Math.floor(i/g.width)}),obstacle={id:'test-only',...w,radius:.65,kind:'simulated' as const};
  const blocked=roverTerrain(g,[obstacle]),replacement=roverRoutes(blocked,start,target).exposure??null,raster=groundRouteRaster(g,blocked,replacement);
  let incorrectlyPainted=0;for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++)if(blocked.obstacleMask?.[Math.floor(y/5)*g.width+Math.floor(x/5)]&&raster.pixels[(y*raster.width+x)*4])incorrectlyPainted++;
  expect(incorrectlyPainted).toBe(0);
  expect(replacement===null||replacement.outbound.every(j=>!blocked.obstacleMask?.[j])).toBe(true);
 });
});
