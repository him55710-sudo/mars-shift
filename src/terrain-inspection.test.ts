import {describe,expect,it} from 'vitest';
import {inspectionTarget,inspectionFocus} from './terrain-inspection';
import {surfaceAxis,surfaceGeometry} from './surface-geometry';
import type {Terrain} from './planner';
import type {NativeDEM} from './eva-motion';

function fixture(){const width=20,height=20,n=width*height;const t:Terrain={width,height,cellSize:5,bounds:[0,0,100,100],center:[0,0],crs:'Mars',valid:Array(n).fill(1),elevation:Array(n).fill(10),slope:Array(n).fill(2),meanSlope:Array(n).fill(2),roughness:Array(n).fill(.1),thermal:Array(n).fill(300),thermalRange:[300,300],exposure:Array(n).fill(0)};const native:NativeDEM={width:100,height:100,cellSize:1,bounds:t.bounds,crs:t.crs,values:Float32Array.from({length:10000},(_,i)=>10+i%100*.1+Math.floor(i/100)*.2)};return {t,native};}
describe('terrain point inspection',()=>{
 it('centres the camera target on physical native elevation, without selecting a mission destination',()=>{const {t,native}=fixture(),before=JSON.stringify(t),p={x:8,y:9},target=inspectionTarget(t,p,native,10)!;expect(target.x).toBe(-7.5);expect(target.z).toBe(-2.5);expect(target.y).toBeCloseTo(42*.1+47*.2+1.5,5);expect(inspectionFocus(t,target.x,target.z)).toEqual(p);expect(JSON.stringify(t)).toBe(before);});
 it('rejects points outside the study area and unsupported native data',()=>{const {t,native}=fixture();expect(inspectionTarget(t,{x:-1,y:5},native,10)).toBeNull();expect(inspectionTarget(t,{x:NaN,y:5},native,10)).toBeNull();native.values.fill(NaN);expect(inspectionTarget(t,{x:8,y:9},native,10)).toBeNull();expect(inspectionFocus(t,500,0)).toBeNull();});
 it('adds real 1 m samples while preserving the complete orbital grid and footprint',()=>{const base=surfaceAxis(1000,500,false),close=surfaceAxis(1000,500,'inspect');expect(base.every(i=>close.includes(i))).toBe(true);expect(close.length).toBeGreaterThan(base.length);for(let i=480;i<=512;i++)expect(close).toContain(i);expect(close[0]).toBe(0);expect(close.at(-1)).toBe(999);});
 it('keeps detailed vertex heights measured and omits NoData quads',()=>{const {t,native}=fixture(),g=surfaceGeometry(t,native,{x:9,y:9},'inspect',10);for(let i=0;i<g.positions.length;i+=3){const x=Math.round(g.positions[i]+49.5),y=Math.round(g.positions[i+2]+49.5);expect(g.positions[i+1]).toBeCloseTo(native.values[y*100+x]-10,5);}const missing={...native,values:native.values.slice()};missing.values.fill(NaN);expect(surfaceGeometry(t,missing,{x:9,y:9},'inspect',10).indices.length).toBe(0);});
});
