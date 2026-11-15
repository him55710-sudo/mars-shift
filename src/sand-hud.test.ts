import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import type {Terrain} from './planner';
import {DEFAULTS} from './planner';
import {validateNoah} from './noah-data';
import {groundHazardPixels} from './ground-overlay';
import {localMapWindow,relativeBearing,sandHUDState} from './sand-hud-model';
function fixture(){
 const t:Terrain=JSON.parse(fs.readFileSync('public/data/noah/terrain.json','utf8'));
 t.noah=validateNoah(t,JSON.parse(fs.readFileSync('public/data/noah/noah-terrain.json','utf8')));
 t.width=30;t.height=30;t.cellSize=5;t.valid=Array(900).fill(1);t.elevation=Array(900).fill(0);t.slope=Array(900).fill(0);t.meanSlope=Array(900).fill(0);t.roughness=Array(900).fill(0);t.exposure=Array(900).fill(0);t.thermal=Array(900).fill(300);
 t.noah.fields={dominantClass:Array(900).fill(1),coverage:Array(900).fill(1),dominantAreaFraction:Array(900).fill(1),classFractions:Array.from({length:900},()=>[1,...Array(13).fill(0)])};
 t.noah.fields.classFractions[15*30+16]=[0,0,1,...Array(11).fill(0)];
 return t;
}
const cells=Array.from({length:12},(_,i)=>(15-i)*30+10),crew={x:10,y:15};
describe('readable sand guidance from the crew perspective',()=>{
 it('computes left/right turns across north without reversing the camera frame',()=>{
  expect(relativeBearing(5,355)).toBe(10);expect(relativeBearing(355,5)).toBe(-10);
  const t=fixture();expect(sandHUDState(t,cells,crew,0,true,true,true).title).toBe('Follow the marked route');
  expect(sandHUDState(t,cells,crew,90,true,true,true).title).toBe('Turn left');expect(sandHUDState(t,cells,crew,270,true,true,true).title).toBe('Turn right');
 });
 it('reports distance to the actual buffered cell edge, with its camera-relative side',()=>{
  const t=fixture(),a=sandHUDState(t,cells,crew,0,true,true,true),b=sandHUDState(t,cells,crew,180,true,true,true);
  expect(a.nearest!.metres).toBeCloseTo(22.5);expect(a.nearest!.side).toBe('right');expect(b.nearest!.side).toBe('left');
 });
 it('hides directional guidance and distances when localization is unavailable',()=>{
  const a=sandHUDState(fixture(),cells,crew,0,true,true,false);expect(a.kind).toBe('hold');expect(a.turn).toBeNull();expect(a.nearest).toBeNull();
  expect(sandHUDState(fixture(),cells,{x:-1,y:0},0,true,true,true).kind).toBe('hold');
 });
 it('never directs movement for paused, invalidated, off-route or unscreened paths',()=>{
  const t=fixture();expect(sandHUDState(t,cells,crew,0,true,false,true).kind).toBe('hold');
  expect(sandHUDState(t,[15*30+10,15*30+16],crew,0,true,true,true).title).toBe('HOLD · sand exclusion');
  expect(sandHUDState(t,cells,{x:5,y:15},0,true,true,true).title).toBe('HOLD · off route');
  expect(sandHUDState(t,cells,crew,0,false,true,true).turn).toBeNull();expect(sandHUDState(t,cells,crew,0,false,true,true).title).toBe('Sand avoidance OFF');
 });
 it('shows unknown texture ahead as a verification action, never as clear terrain',()=>{
  const t=fixture();t.noah!.fields.coverage[cells[1]]=0;t.noah!.fields.classFractions[cells[1]]=null;
  const a=sandHUDState(t,cells,crew,0,true,true,true);expect(a.title).toBe('Verify unknown ground');expect(a.turn).toBeNull();
 });
 it('keeps the local map within study bounds and preserves a physical metre scale',()=>{
  const t=fixture();for(const p of [{x:0,y:0},{x:29,y:29},crew]){const crop=localMapWindow(t,p,100);expect(crop.size*t.cellSize).toBe(100);expect(crop.x).toBeGreaterThanOrEqual(0);expect(crop.y).toBeGreaterThanOrEqual(0);expect(crop.x+crop.size).toBeLessThanOrEqual(t.width);expect(crop.y+crop.size).toBeLessThanOrEqual(t.height);expect(p.x+.5).toBeGreaterThanOrEqual(crop.x);expect(p.x+.5).toBeLessThanOrEqual(crop.x+crop.size);}
 });
 it('distinguishes sand core, its buffer and other hard constraints on the actual ground overlay',()=>{
  const t=fixture(),pixels=groundHazardPixels(t,{...DEFAULTS,avoidSand:true},null),core=15*30+16,buffer=15*30+15;
  expect([...pixels.slice(core*4,core*4+4)]).toEqual([255,64,82,255]);expect([...pixels.slice(buffer*4,buffer*4+4)]).toEqual([255,64,82,220]);
  const steep=fixture();steep.slope[core]=30;expect([...groundHazardPixels(steep,{...DEFAULTS,avoidSand:true},null).slice(core*4,core*4+4)]).toEqual([245,89,63,235]);
 });
});
