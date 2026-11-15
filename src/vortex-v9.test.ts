import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {safeIntervalPath} from './sipp-v9';
import {encounterGraph} from './encounter-v7';
import type {EncounterGraph} from './encounter-v7';
import {makeEncounterV9,planSippV9} from './encounter-v9';
import {abruptPrediction} from './encounter-v8';
import {sweptContact} from './dust-devil-geometry';
import {measureEscapePath} from './escape-metrics';
import {positionOnPath} from './hazard-planner';
const protocol=JSON.parse(readFileSync('public/data/hazards/vortex-v9/protocol.json','utf8'));
const terrain=JSON.parse(readFileSync('public/data/hazards/encounters-v7/floor-terrain.json','utf8')).terrain;
const wind=JSON.parse(readFileSync('public/data/hazards/vortex-v8/earth-analog-wind.json','utf8')).days;
const line={terrain:{width:3,cellSize:1},tick:1,edges:[[{i:1,ticks:1}],[{i:0,ticks:1},{i:2,ticks:1}],[{i:1,ticks:1}]]} as EncounterGraph;
it('safe intervals agree with exhaustive time-expanded reachability including edge crossing',()=>{
  for(let offset=0;offset<20;offset++){
    const circles=Array.from({length:9},(_,k)=>({x:1,y:-3+k*(.35+offset*.04),radius:.4}));
    const safe=(a:number,b:number,k:number)=>sweptContact({x:a,y:0},{x:b,y:0},circles[k],circles[k+1],1)<1e-9;
    const layers=[new Set([0])];let earliest=Infinity;
    for(let k=0;k<=8;k++){
      if(layers[k].has(2)&&Array.from({length:8-k},(_,n)=>safe(2,2,k+n)).every(Boolean))earliest=Math.min(earliest,k);
      if(k===8)break;const next=new Set<number>();for(const i of layers[k])for(const j of [i,...line.edges[i].map(e=>e.i)])if(safe(i,j,k))next.add(j);layers.push(next);
    }
    const result=safeIntervalPath({g:line,start:{x:0,y:0},entries:[{i:0,ticks:0}],goal:{x:2,y:0},circles,now:0,admissible:()=>true});
    expect(result.limited).toBe(false);
    if(Number.isFinite(earliest)){expect(result.path).not.toBeNull();expect(result.path!.find(p=>p.x===2)!.time).toBe(earliest);}
    if(result.path){expect(measureEscapePath(result.path,t=>{const k=Math.min(7,Math.floor(t)),u=t-k;return {x:1,y:circles[k].y+u*(circles[k+1].y-circles[k].y),radius:.4};},1,0,8).exposureSeconds).toBeLessThan(1e-8);}
  }
});
it('waits for a crossing and cannot teleport through the swept obstacle',()=>{
  const circles=Array.from({length:9},(_,k)=>({x:1,y:k-1,radius:.6}));
  const r=safeIntervalPath({g:line,start:{x:0,y:0},entries:[{i:0,ticks:0}],goal:{x:2,y:0},circles,now:0,admissible:()=>true});
  expect(r.path!.find(p=>p.x===2)!.time).toBeGreaterThan(2);
  expect(positionOnPath(r.path!,1).x).toBe(0);
});
it('rejects a currently engulfed start and infeasible return budget',()=>{
  const args={g:line,start:{x:0,y:0},entries:[{i:0,ticks:0}],goal:{x:2,y:0},circles:Array(9).fill({x:0,y:0,radius:.5}),now:0,admissible:()=>true};
  expect(safeIntervalPath(args).path).toBeNull();
  expect(safeIntervalPath({...args,circles:Array(9).fill({x:20,y:0,radius:.5}),admissible:()=>false}).path).toBeNull();
});
it('crosses all bearings within independent synthetic events and uses all held-out forcing days',()=>{
  const events=[...new Set<string>(protocol.cases.map((c:any)=>c.event))];expect(events.length).toBe(54);
  for(const event of events){const rows=protocol.cases.filter((c:any)=>c.event===event);expect(rows.map((c:any)=>c.bearing)).toEqual([-.35,0,.35]);expect(new Set(rows.map((c:any)=>c.truthSeed)).size).toBe(1);}
  for(const split of ['development','holdout'])expect([...new Set(protocol.cases.filter((c:any)=>c.split===split&&c.truth==='wind').map((c:any)=>c.windDay))].sort()).toEqual(split==='development'?[1,2,3]:[4,5,6]);
  const a=protocol.cases.filter((c:any)=>c.split==='development'),b=protocol.cases.filter((c:any)=>c.split==='holdout');expect(b.every((c:any)=>a.every((d:any)=>c.truthSeed!==d.truthSeed&&c.sensorSeed!==d.sensorSeed))).toBe(true);
});
it('truth seeds alter motion independently of measurement seeds; future truth cannot leak',()=>{
  const c=protocol.cases[0],g=encounterGraph(terrain,c.speed),source=protocol.sources[0];
  const a=makeEncounterV9(g,c,source,wind),b=makeEncounterV9(g,{...c,sensorSeed:c.sensorSeed+1},source,wind),d=makeEncounterV9(g,{...c,truthSeed:c.truthSeed+1},source,wind);
  expect(a.truth(45)).toEqual(b.truth(45));expect(a.truth(45)).not.toEqual(d.truth(45));
  a.time=34;const forecast=abruptPrediction(a)!(50);a.truth=()=>({x:1e6,y:1e6,radius:1e6});a.observations=a.observations.map(o=>o.time+1>34?{...o,x:1e6}:o);expect(abruptPrediction(a)!(50)).toEqual(forecast);
});
it('SIPP and its oracle respect the same delivery, reaction and resource gates',()=>{
  for(const oracle of [false,true])for(const sigma of [0,.5]){
    const c=protocol.cases[0],s=makeEncounterV9(encounterGraph(terrain,c.speed),c,protocol.sources[0],wind);
    s.time=s.firstDetect;expect(planSippV9(s,sigma,oracle).action).toBe('HOLD');
    s.time=s.firstDetect+c.reaction;s.resources.oxygenSeconds=1;s.resources.batterySeconds=1;
    expect(planSippV9(s,sigma,oracle).action).toBe('NO FEASIBLE ROUTE');
  }
});
it('published holdout binds to frozen inputs, engines and development-only selection',()=>{
  const root='public/data/hazards/vortex-v9/',load=(p:string)=>JSON.parse(readFileSync(root+p,'utf8'));
  const selection=load('selection.json'),test=load('holdout.json'),dev=load('development.json');
  expect(selection.hashes).toEqual(test.hashes);expect(test.hashes).toEqual(dev.hashes);
  for(const [path,hash] of Object.entries(test.hashes))expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(hash);
  expect(createHash('sha256').update(readFileSync(root+'development.json')).digest('hex')).toBe(selection.developmentSHA256);
  expect(new Set(test.rows.map((r:any)=>r.event)).size).toBe(36);
  expect(test.rows.every((r:any)=>!dev.rows.some((d:any)=>r.event===d.event))).toBe(true);
});
