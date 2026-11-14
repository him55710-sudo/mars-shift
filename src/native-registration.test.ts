import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertNativeRegistration} from './native-registration';
describe('actual native raster registration',()=>{
 for(const region of ['','ridge/'])it(`verifies source bytes, Mars coordinates and pixel centres for ${region||'floor'}`,()=>{
  const root=`public/data/${region}`,t=JSON.parse(readFileSync(root+'terrain.json','utf8')),m=JSON.parse(readFileSync(root+'jezero-native-dem.json','utf8')),buffer=readFileSync(root+'jezero-native-dem.bin'),optical=JSON.parse(readFileSync(root+'surface-optical-meta.json','utf8'));
  expect(()=>assertNativeRegistration(t,m,buffer.length)).not.toThrow();
  expect(createHash('sha256').update(buffer).digest('hex')).toBe(m.validation.binarySha256);
  expect(optical.crs).toBe(m.crs);expect(optical.bounds).toEqual(m.bounds);
  expect(()=>assertNativeRegistration(t,{...m,crs:'EPSG:4326'},buffer.length)).toThrow(/Mars/);
  expect(()=>assertNativeRegistration(t,{...m,bounds:m.bounds.map((v:number,i:number)=>v+(i===0?1:0))},buffer.length)).toThrow(/registration/);
  expect(()=>assertNativeRegistration(t,{...m,cellSize:.5},buffer.length)).toThrow(/units/);
  expect(()=>assertNativeRegistration(t,m,buffer.length-4)).toThrow(/dimensions/);
 });
});
