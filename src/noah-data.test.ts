import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateNoah,noahEvidence,evidenceRisk} from './noah-data';
import {DEFAULTS} from './planner';
import type {Terrain} from './planner';
const read=(p:string)=>JSON.parse(readFileSync(new URL('../public/data/'+p,import.meta.url),'utf8'));
describe('published NOAH-H registration and evidence',()=>{
 it('preserves actual coverage and does not move classifications into the other ROIs',()=>{
  for(const root of ['', 'ridge/','noah/']){const t=read(root+'terrain.json') as Terrain,n=validateNoah(t,read(root+'noah-terrain.json'));const actual=n.fields.coverage.reduce((a,b)=>a+b,0)/(t.width*t.height);expect(actual).toBeCloseTo(root==='noah/'?.89846088:0,8);}
 });
 it('rejects displaced grids and fabricated unknown classes',()=>{
  const t=read('noah/terrain.json'),n=read('noah/noah-terrain.json');n.grid.bounds[0]+=.5;expect(()=>validateNoah(t,n)).toThrow(/registered/);
  const empty=read('noah-terrain.json');empty.fields.dominantClass[0]=11;expect(()=>validateNoah(read('terrain.json'),empty)).toThrow(/Unknown/);
 });
 it('reports class areas without treating them as physical boulder counts',()=>{
  const t=read('noah/terrain.json') as Terrain,n=validateNoah(t,read('noah/noah-terrain.json')),i=n.fields.dominantClass.findIndex((id,j)=>id===11&&t.slope[j]!==null&&t.slope[j]!<18&&n.fields.classFractions[j]![10]>.25),e=noahEvidence(n,i);
  expect(i).toBeGreaterThan(-1);expect(e.boulderFieldAreaFraction).toBeGreaterThan(.25);expect(e.observationDate).toBeNull();expect(e.registrationResidualMetres).toBeNull();expect(evidenceRisk(t,n,i,DEFAULTS,null).state).toBe('candidate');
  expect(evidenceRisk(t,n,i,DEFAULTS,{x:i%t.width,y:Math.floor(i/t.width),radius:10}).state).toBe('constraint');
 });
 it('keeps absent classification unknown without inventing zeros or hard obstacles',()=>{
  const t=read('terrain.json') as Terrain,n=validateNoah(t,read('noah-terrain.json')),i=t.valid.findIndex((v,j)=>v===1&&t.slope[j]!==null&&t.slope[j]!<18&&!t.exposure[j]);
  expect(noahEvidence(n,i).boulderFieldAreaFraction).toBeNull();expect(evidenceRisk(t,n,i,DEFAULTS,null).state).toBe('unknown');
 });
});
