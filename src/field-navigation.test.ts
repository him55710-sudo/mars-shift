import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {assessField,fieldPixels,fieldPlan,fieldTerrain,lowerRiskWaypoint} from './field-navigation';
import type {FieldZone} from './field-navigation';
import {DEFAULTS,blocked,edgeBlocked,index,nearestAllowed} from './planner';
import type {Terrain} from './planner';
import {validateNoah} from './noah-data';
import {validateScience} from './science-data';
import {sandRouteAudit} from './sand-screening';

function fixture(w=22,h=16):Terrain {const n=w*h;return {width:w,height:h,cellSize:5,bounds:[0,0,w*5,h*5],center:[0,0],crs:'test',elevation:Array(n).fill(0),slope:Array(n).fill(0),meanSlope:Array(n).fill(0),roughness:Array(n).fill(0),exposure:Array(n).fill(0),valid:Array(n).fill(1),thermal:Array(n).fill(300),thermalRange:[300,300]};}
const zone:FieldZone={id:'test',kind:'trap',source:'reviewed',point:{x:11,y:8},radius:10,area:Math.PI*100,index:.8,cells:[],label:'Test',detail:'Test operator exclusion'};
describe('integrated ground navigation',()=>{
 it('keeps missing texture and topographic inputs unknown, rather than confirmed sand or clear ground',()=>{const t=fixture(),a=assessField(t);expect(a.knownCells).toBe(0);expect(a.sandCells).toBe(0);expect(a.trapCells).toBe(0);expect(a.support[10]).toBeCloseTo(1/3);const p=fieldPlan(t,a,{x:1,y:8},{x:20,y:8},{x:1,y:8},DEFAULTS,'balanced',true)!;expect(p.unknownMetres).toBeCloseTo(p.route.distance);});
 it('changes the actual graph route when screening penalties are enabled',()=>{const t=fixture(),a=assessField(t);a.support.fill(1);for(let y=4;y<12;y++)for(let x=9;x<=12;x++){a.risk[y*t.width+x]=1;a.trap[y*t.width+x]=1;}const start={x:1,y:8},target={x:20,y:8},short=fieldPlan(t,a,start,target,start,DEFAULTS,'shortest',true)!,avoid=fieldPlan(t,a,start,target,start,DEFAULTS,'balanced',true)!,off=fieldPlan(t,a,start,target,start,DEFAULTS,'balanced',false)!;expect(avoid.riskMetres).toBeLessThan(short.riskMetres);expect(avoid.route.distance).toBeGreaterThan(short.route.distance);expect(off.riskMetres).toBeCloseTo(short.riskMetres);});
 it('buffers reviewed exclusions, preserves source arrays, and checks both legs',()=>{const t=fixture(),a=assessField(t),prepared=fieldTerrain(t,[zone]),start={x:1,y:8},p=fieldPlan(prepared,a,start,{x:20,y:8},start,DEFAULTS,'balanced',true)!;expect(t.obstacleMask).toBeUndefined();expect(blocked(prepared,index(t,zone.point),DEFAULTS,null)).toBe(true);expect(p.route.cells[0]).toBe(p.route.cells.at(-1));for(let k=1;k<p.route.cells.length;k++)expect(edgeBlocked(prepared,p.route.cells[k-1],p.route.cells[k],DEFAULTS,null)).toBe(false);});
 it('does not convert derived candidates into hard blocks without review',()=>{const t=fixture(),p=fieldTerrain(t,[{...zone,source:'derived'}]);expect(p.obstacleMask?.some(Boolean)).toBe(false);});
 it('penalizes boulder-field textures without asserting individual rock obstacles',()=>{const t=fixture(),a=assessField(t),start={x:1,y:8},target={x:20,y:8};a.support.fill(1);for(let y=5;y<11;y++)for(let x=9;x<=12;x++)a.rocks[y*t.width+x]=1;const p=fieldPlan(t,a,start,target,start,DEFAULTS,'balanced',false)!,baseline=fieldPlan(t,a,start,target,start,DEFAULTS,'shortest',false)!;expect(p.route.cells.filter(i=>a.rocks[i]).length).toBeLessThan(baseline.route.cells.filter(i=>a.rocks[i]).length);expect(t.obstacleMask).toBeUndefined();});
 it('cannot cut corners or bridge NoData',()=>{const t=fixture(2,2),a=assessField(t);t.valid[1]=t.valid[2]=0;expect(fieldPlan(t,a,{x:0,y:0},{x:1,y:1},{x:0,y:0},DEFAULTS,'shortest',true)).toBeNull();});
 it('rejects invalid endpoints and reports resource failures without claiming a safe alternative',()=>{const t=fixture(),a=assessField(t);expect(fieldPlan(t,a,{x:1,y:8},{x:-1,y:8},{x:1,y:8},DEFAULTS,'balanced',true)).toBeNull();const p=fieldPlan(t,a,{x:1,y:8},{x:20,y:8},{x:1,y:8},{...DEFAULTS,durationMinutes:1},'cautious',true)!;expect(p.route.feasible).toBe(false);expect(p.route.reasons.length).toBeGreaterThan(0);});
 it('requires complete support and a feasible return for a lower-index exit proposal',()=>{const t=fixture(),a=assessField(t),start={x:11,y:8};a.risk.fill(.8);a.support.fill(1);a.risk[index(t,{x:15,y:8})]=.1;const p=lowerRiskWaypoint(t,a,start,{x:1,y:8},DEFAULTS);expect(p.target).toEqual({x:15,y:8});a.support.fill(0);expect(lowerRiskWaypoint(t,a,start,{x:1,y:8},DEFAULTS).target).toBeNull();expect(lowerRiskWaypoint(fieldTerrain(t,[zone]),a,start,{x:1,y:8},DEFAULTS).target).toBeNull();});
 it('keeps constraint colors visible when candidate display layers are disabled',()=>{const t=fixture(),a=assessField(t),p=fieldPixels(t,a,DEFAULTS,[zone],{sand:false,rocks:false,unknown:false}),i=index(t,zone.point);expect(Array.from(p.slice(i*4,i*4+4))).toEqual([229,103,111,195]);});
});

describe('registered Jezero evidence',()=>{
 it('honors the shared explicit ripple buffer policy in every displayed route',()=>{
  const load=(p:string)=>JSON.parse(readFileSync(new URL('../public/data/noah/'+p,import.meta.url),'utf8'));
  const t=load('terrain.json') as Terrain;t.noah=validateNoah(t,load('noah-terrain.json'));t.science=validateScience(t,load('science/terrain-metrics.json'));
  const a=assessField(t),s={...DEFAULTS,avoidSand:true,mobilityModel:2 as const,scienceMinutes:5,durationMinutes:120,oxygenMinutes:160,powerMinutes:150},base=nearestAllowed(t,{x:32,y:168},s),target=nearestAllowed(t,{x:153,y:43},s);
  for(const policy of ['shortest','balanced','cautious'] as const){const p=fieldPlan(t,a,base,target,base,s,policy,true)!;expect(p?.route.feasible).toBe(true);expect(sandRouteAudit(t,p.route.cells).excludedCells).toBe(0);}
 },20000);
 it('derives candidates from actual source layers and validates every returned graph edge',()=>{
  const load=(p:string)=>JSON.parse(readFileSync(new URL('../public/data/noah/'+p,import.meta.url),'utf8'));
  const t=load('terrain.json') as Terrain;t.noah=validateNoah(t,load('noah-terrain.json'));t.science=validateScience(t,load('science/terrain-metrics.json'));
  const a=assessField(t),s={...DEFAULTS,mobilityModel:2 as const,scienceMinutes:5,durationMinutes:120,oxygenMinutes:160,powerMinutes:150},base=nearestAllowed(t,{x:32,y:168},s),target=nearestAllowed(t,{x:153,y:43},s);
  expect(a.knownCells).toBeGreaterThan(30000);expect(a.sandCells).toBeGreaterThan(0);expect(a.rockCells).toBeGreaterThan(0);expect(a.trapCells).toBeGreaterThan(0);
  const summary=[];
  for(const policy of ['shortest','balanced','cautious'] as const){const p=fieldPlan(t,a,base,target,base,s,policy,true)!;expect(p).not.toBeNull();expect(p.route.feasible).toBe(true);for(let k=1;k<p.route.cells.length;k++)expect(edgeBlocked(t,p.route.cells[k-1],p.route.cells[k],s,null)).toBe(false);summary.push({policy,distance:p.route.distance,indexMetres:p.riskMetres,trapMetres:p.trapMetres,reserve:p.route.reserve});}
  expect(summary[1].indexMetres).toBeLessThan(summary[0].indexMetres);
  console.info('Registered field assessment',JSON.stringify({known:a.knownCells,sand:a.sandCells,traps:a.trapCells,rocks:a.rockCells,regions:a.zones.filter(z=>z.kind==='trap').length,routes:summary}));
 },20000);
});
