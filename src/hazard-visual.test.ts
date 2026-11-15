import {describe,it,expect} from 'vitest';
import {stormDisplayPixels,riskPixel} from './hazard-visual';
import type {Terrain} from './planner';
import type {XRNavigationFrame} from './hazard-xr';

const terrain=()=>({width:6,height:5,cellSize:1,bounds:[10,20,16,25],crs:'LOCAL:NORTH-EAST',valid:Array(30).fill(1),elevation:Array(30).fill(0)}) as Terrain;
const frame=():XRNavigationFrame=>({schemaVersion:1,revision:1,timestamp:0,coordinates:'GRID_NORTH_EAST_METRES',crs:'LOCAL:NORTH-EAST',bounds:[10,20,16,25],cellSize:1,origin:{x:0,y:0},action:'HOLD',anchorsEnabled:false,route:[],source:'SIMULATION',localizationSigma:1,warning:null,forecast:[{time:0,x:1,y:2,radius:.6,envelope:.9,position95:0,radius95:0,vx:0,vy:0,age:0,valid:true},{time:10,x:4,y:2,radius:.6,envelope:.9,position95:0,radius95:0,vx:0,vy:0,age:0,valid:true}]});
const pixel=(p:Uint8Array,x:number,y:number)=>Array.from(p.slice((y*6+x)*4,(y*6+x)*4+4));

describe('Red hazard footprints on the existing ground',()=>{
 it('distinguishes the current footprint from the swept forecast between fixes',()=>{
  const pixels=stormDisplayPixels(terrain(),frame());
  expect(pixel(pixels,1,2)).toEqual(riskPixel());
  expect(pixel(pixels,2,2)).toEqual(riskPixel(105));
  expect(pixel(pixels,4,2)).toEqual(riskPixel(105));
  expect(pixel(pixels,1,0)).toEqual([0,0,0,0]);
 });
 it('leaves source gaps unpainted and does not alter terrain or the base overlay',()=>{
  const t=terrain();t.valid[14]=0;t.elevation[15]=null;
  const base=new Uint8Array(120),before=JSON.stringify(t);
  const p=stormDisplayPixels(t,frame(),base);
  expect(pixel(p,2,2)).toEqual([0,0,0,0]);expect(pixel(p,3,2)).toEqual([0,0,0,0]);
  expect(base.every(v=>v===0)).toBe(true);expect(JSON.stringify(t)).toBe(before);
 });
 it('withholds unregistered or mismatched frames instead of moving them onto the photo terrain',()=>{
  const t=terrain(),base=new Uint8Array(120);base.set(riskPixel(),0);
  for(const f of [{...frame(),crs:'ORBITAL:OTHER'},{...frame(),cellSize:5},{...frame(),bounds:[0,0,6,5]}])expect(stormDisplayPixels(t,f,base)).toEqual(base);
  expect(stormDisplayPixels(t,undefined,base)).toEqual(base);
 });
 it('updates the current area with time and preserves stronger reviewed warnings',()=>{
  const t=terrain(),f=frame(),base=new Uint8Array(120);base.set(riskPixel(),14*4);
  const p=stormDisplayPixels(t,f,base);expect(pixel(p,2,2)).toEqual(riskPixel());
  f.forecast=f.forecast.slice(1);f.timestamp=10;
  const moved=stormDisplayPixels(t,f);expect(pixel(moved,1,2)).toEqual([0,0,0,0]);expect(pixel(moved,4,2)).toEqual(riskPixel());
 });
 it('rejects malformed fixes and does not draw a corridor through a missing fix',()=>{
  const f=frame();f.forecast[0].x=NaN;
  expect(pixel(stormDisplayPixels(terrain(),f),2,2)).toEqual([0,0,0,0]);
 });
});

it('withholds all red shading for invalid forecast fixes',()=>{
 const f=frame();f.forecast.forEach(p=>p.valid=false);
 expect(stormDisplayPixels(terrain(),f).every(v=>v===0)).toBe(true);
});
