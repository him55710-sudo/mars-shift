import {describe,it,expect} from 'vitest';
import {surfaceAxis,surfaceGeometry,groundRibbon,nativeNormalPixels} from './surface-geometry';
import {groundHazardPixels} from './ground-overlay';
import {DEFAULTS} from './planner';
import type {Terrain} from './planner';
import type {NativeDEM} from './eva-motion';
function fixture(){const t:Terrain={width:8,height:8,cellSize:5,bounds:[0,0,40,40],center:[0,0],crs:'Mars',valid:Array(64).fill(1),elevation:Array(64).fill(10),slope:Array(64).fill(2),meanSlope:Array(64).fill(2),roughness:Array(64).fill(.1),thermal:Array(64).fill(200),thermalRange:[200,200],exposure:Array(64).fill(0)};const native:NativeDEM={width:40,height:40,cellSize:1,bounds:t.bounds,crs:t.crs,values:Float32Array.from({length:1600},(_,i)=>10+i%40*.1+Math.floor(i/40)*.2)};return {t,native};}
describe('native terrain with adaptive display detail',()=>{
 it('retains native1m samples near the crew and exact cropped endpoints',()=>{const axis=surfaceAxis(1000,160,true);expect(axis[0]).toBe(0);expect(axis.at(-1)).toBe(999);for(let x=128;x<=192;x++)expect(axis).toContain(x);expect(new Set(axis).size).toBe(axis.length);});
 it('uses fewer triangles than the old uniform2m mesh without adding elevations',()=>{const {t,native}=fixture();native.width=1000;native.height=1000;native.values=new Float32Array(1e6).fill(10);t.width=200;t.height=200;t.valid=Array(40000).fill(1);const g=surfaceGeometry(t,native,{x:32,y:168},true,10);expect(g.triangles).toBeLessThan(100000);expect(g.triangles).toBeGreaterThan(20000);expect(g.heights.every(v=>v===10)).toBe(true);});
 it('keeps metre coordinates, physical heights and1x vertical geometry',()=>{const {t,native}=fixture(),g=surfaceGeometry(t,native,{x:3,y:3},true,10);expect([...g.positions.slice(0,3)]).toEqual([-19.5,0,-19.5]);expect(g.positions[4]).toBeCloseTo(.1,5);expect(g.uv[0]).toBeCloseTo(.5/40,6);expect(g.uv[1]).toBeCloseTo(1-.5/40,6);});
 it('does not let a coarse quad bridge native NoData or excluded data coverage',()=>{const {t,native}=fixture(),before=surfaceGeometry(t,native,{x:3,y:3},false,10);native.values[2*40+2]=NaN;const after=surfaceGeometry(t,{...native,values:native.values.slice()},{x:3,y:3},false,10);expect(after.triangles).toBeLessThan(before.triangles);const masked={...t,valid:t.valid.map((v,i)=>i===20?0:v)};expect(surfaceGeometry(masked,native,{x:3,y:3},false,10).triangles).toBeLessThan(before.triangles);});
});
describe('ground registered navigation',()=>{
 it('derives object-space lighting normals from physical DEM gradients',()=>{const {native}=fixture(),pixels=nativeNormalPixels(native),i=((39-10)*40+10)*4,l=Math.hypot(.1,1,.2);expect(pixels[i]/255*2-1).toBeCloseTo(-.1/l,2);expect(pixels[i+1]/255*2-1).toBeCloseTo(1/l,2);expect(pixels[i+2]/255*2-1).toBeCloseTo(-.2/l,2);});
 it('drapes both ribbon edges on the interpolated DEM with only a display offset',()=>{const {t,native}=fixture(),g=groundRibbon(t,native,[18,19,20],10);expect(g.indices.length).toBeGreaterThan(0);for(let i=0;i<g.positions.length;i+=3){const x=g.positions[i]+20-.5,z=g.positions[i+2]+20-.5;expect(g.positions[i+1]).toBeCloseTo(x*.1+z*.2+.045,5);}expect(Math.max(...g.uv.filter((_,i)=>i%2))).toBeCloseTo(10);});
 it('never fabricates a ribbon over unknown DEM support',()=>{const {t,native}=fixture();native.values.fill(NaN);expect(groundRibbon(t,native,[18,19],10).indices).toHaveLength(0);});
 it('separates excluded, derived caution and unknown overlay classes',()=>{const {t}=fixture();t.slope[1]=30;t.exposure[2]=1;t.valid[3]=0;const rgba=groundHazardPixels(t,DEFAULTS,null);expect([...rgba.slice(0,4)]).toEqual([0,0,0,0]);expect([...rgba.slice(4,8)]).toEqual([245,89,63,235]);expect([...rgba.slice(8,12)]).toEqual([244,173,64,180]);expect([...rgba.slice(12,16)]).toEqual([165,145,201,210]);});
});
