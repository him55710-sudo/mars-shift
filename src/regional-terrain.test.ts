import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertRegionalRegistration,regionalGeometry,regionalHeight} from './regional-terrain';
import type {RegionalDEM} from './regional-terrain';
import type {Terrain} from './planner';
import type {NativeDEM} from './eva-motion';
import {heightAt} from './eva-motion';
import terrain from '../public/data/noah/terrain.json';
import metadata from '../public/data/noah/context/manifest.json';
const t=terrain as Terrain;
const bytes=readFileSync(new URL('../public/data/noah/context/dem.bin',import.meta.url));
const values=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const nearBytes=readFileSync(new URL('../public/data/noah/context/near-dem.bin',import.meta.url));
const nearValues=new Float32Array(nearBytes.buffer.slice(nearBytes.byteOffset,nearBytes.byteOffset+nearBytes.byteLength));
const context:RegionalDEM={meta:metadata,values,nearValues};
const nativeBytes=readFileSync(new URL('../public/data/noah/jezero-native-dem.bin',import.meta.url));
const native:NativeDEM={width:1000,height:1000,cellSize:1,crs:t.crs,bounds:t.bounds,values:new Float32Array(nativeBytes.buffer.slice(nativeBytes.byteOffset,nativeBytes.byteOffset+nativeBytes.byteLength))};

describe('continuous regional terrain',()=>{
 it('uses verified observed context in the unchanged study projection',()=>{expect(()=>assertRegionalRegistration(t,metadata,bytes.byteLength)).not.toThrow();expect(createHash('sha256').update(bytes).digest('hex')).toBe(metadata.binarySha256);expect(metadata.demSource.nativeResolutionMetres).toEqual([20,20]);expect(metadata.bounds[2]-metadata.bounds[0]).toBe(24000);expect(values.every(Number.isFinite)).toBe(true);});
 it('rejects a shifted footprint, incorrect units or truncated binary before display',()=>{expect(()=>assertRegionalRegistration(t,{...metadata,focusBounds:t.bounds.map((n,i)=>i===0?n+1:n)},bytes.byteLength)).toThrow();expect(()=>assertRegionalRegistration(t,{...metadata,crs:'Earth'},bytes.byteLength)).toThrow();expect(()=>assertRegionalRegistration(t,{...metadata,verticalUnits:'feet'},bytes.byteLength)).toThrow();expect(()=>assertRegionalRegistration(t,metadata,bytes.byteLength-4)).toThrow();});
 it('shares the exact native DEM perimeter, rather than lowering a skirt around the cutout',()=>{
  const data=regionalGeometry(t,native,context,0);expect(data.boundaryCount).toBe(1000);expect(data.ringCount).toBeGreaterThan(5);expect(data.indices.length/3).toBe((data.ringCount-1)*data.boundaryCount*2);
  for(let i=0;i<data.boundaryCount;i++){const x=data.positions[i*3],z=data.positions[i*3+2],height=data.positions[i*3+1];const raw=native.values[Math.round(z+499.5)*1000+Math.round(x+499.5)],expected=Number.isFinite(raw)?raw:regionalHeight(t,context,x,z);expect(expected).not.toBeNull();expect(height).toBeCloseTo(expected!,3);expect(Math.max(Math.abs(x),Math.abs(z))).toBeCloseTo(499.5,5);}
 });
 it('keeps every regional triangle outside the precise footprint, with upward winding',()=>{const data=regionalGeometry(t,native,context,0);for(let k=0;k<data.indices.length;k+=3){const [a,b,c]=Array.from(data.indices.slice(k,k+3)).map(i=>[data.positions[i*3],data.positions[i*3+2]]);const x=(a[0]+b[0]+c[0])/3,z=(a[1]+b[1]+c[1])/3;expect(Math.max(Math.abs(x),Math.abs(z))).toBeGreaterThanOrEqual(499.49);const upward=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);expect(upward).toBeGreaterThan(0);}});
 it('samples the regional raster beyond the original 1 km area without repeating the local tile',()=>{const heights=[regionalHeight(t,context,3000,0),regionalHeight(t,context,-3000,0),regionalHeight(t,context,0,3000)];expect(heights.every(v=>v!==null&&Number.isFinite(v))).toBe(true);expect(new Set(heights).size).toBe(3);expect(regionalHeight(t,context,13000,0)).toBeNull();});
 it('never fills unavailable regional observations with flat ground',()=>{const missing={...context,values:new Float32Array(values.length).fill(NaN),nearValues:new Float32Array(nearValues.length).fill(NaN)};expect(regionalHeight(t,missing,0,0)).toBeNull();expect(regionalGeometry(t,native,missing,0).indices.length).toBe(0);});
 it('preserves the authoritative terrain and native values while constructing display context',()=>{const before=createHash('sha256').update(nativeBytes).digest('hex'),planning=JSON.stringify(t);regionalGeometry(t,native,context,0);expect(createHash('sha256').update(new Uint8Array(native.values.buffer)).digest('hex')).toBe(before);expect(JSON.stringify(t)).toBe(planning);});
});
