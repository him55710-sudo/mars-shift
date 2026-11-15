import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import type {Terrain} from './planner';
import {blocked,DEFAULTS,edgeBlocked,plan} from './planner';
import {validateNoah} from './noah-data';
import {calculateMission,defaultMission,validDraft} from './mission-state';
import {computeReturnMap,fastestRoundTrip} from './return-feasibility';
import {sandRouteAudit,sandScreen} from './sand-screening';
function fixture(){
 const t:Terrain={width:15,height:15,cellSize:5,bounds:[0,0,75,75],center:[0,0],crs:'test',elevation:Array(225).fill(0),slope:Array(225).fill(0),meanSlope:Array(225).fill(0),roughness:Array(225).fill(0),exposure:Array(225).fill(0),valid:Array(225).fill(1),thermal:Array(225).fill(300),thermalRange:[300,300]};
 const source:Terrain=JSON.parse(fs.readFileSync('public/data/noah/terrain.json','utf8'));
 const n=validateNoah(source,JSON.parse(fs.readFileSync('public/data/noah/noah-terrain.json','utf8')));
 t.noah={...n,fields:{dominantClass:Array(225).fill(1),dominantAreaFraction:Array(225).fill(1),coverage:Array(225).fill(1),classFractions:Array.from({length:225},()=>[1,...Array(13).fill(0)])}};
 for(let y=4;y<=10;y++)t.noah.fields.classFractions[y*15+7]=[0,0,1,...Array(11).fill(0)];
 return t;
}
describe('shared sand-candidate exclusions',()=>{
 it('routes outbound and return around buffered candidates; keeps the unscreened comparator',()=>{
  const t=fixture(),s={...DEFAULTS,avoidSand:true},base={x:2,y:7},target={x:12,y:7};
  const a=plan(t,base,target,'shortest',{...s,avoidSand:false},null)!,b=plan(t,base,target,'shortest',s,null)!;
  expect(sandRouteAudit(t,a.cells).candidateCells).toBeGreaterThan(0);expect(b.distance).toBeGreaterThan(a.distance);
  for(const cells of [b.outbound,b.inbound])expect(sandRouteAudit(t,cells).excludedCells).toBe(0);
  expect(blocked(t,7*15+6,s,null)).toBe(true);expect(edgeBlocked(t,3*15+5,4*15+6,s,null)).toBe(true);
 });
 it('uses exactly the same mask for return-feasibility and all mission alternatives',()=>{
  const t=fixture(),d={...defaultMission(t),base:{x:2,y:7},target:{x:12,y:7}},m=calculateMission(t,d),map=computeReturnMap(t,d.base,d.settings,null),fastest=fastestRoundTrip(t,map,d.base,d.target)!;
  for(const r of Object.values(m.reports)){expect(r.route).not.toBeNull();expect(sandRouteAudit(t,r.route!.cells).excludedCells).toBe(0);}
  expect(sandRouteAudit(t,[...fastest.outbound,...fastest.inbound]).excludedCells).toBe(0);
  expect(sandRouteAudit(t,m.sandBaseline!.cells).excludedCells).toBeGreaterThan(0);
 });
 it('rejects endpoints and impassable barriers without silently disabling avoidance',()=>{
  const t=fixture();for(let y=0;y<15;y++)t.noah!.fields.classFractions[y*15+7]=[0,0,1,...Array(11).fill(0)];
  const s={...DEFAULTS,avoidSand:true};
  expect(plan(t,{x:2,y:7},{x:7,y:7},'shortest',s,null)).toBeNull();expect(plan(t,{x:2,y:7},{x:12,y:7},'shortest',s,null)).toBeNull();
  expect(plan(t,{x:2,y:7},{x:12,y:7},'shortest',{...s,avoidSand:false},null)).not.toBeNull();
 });
 it('retains unknown coverage, does not treat thermal inertia as a fine-grained trap, and preserves other obstacles',()=>{
  const t=fixture();t.noah=undefined;t.thermal.fill(150);const screen=sandScreen(t);
  expect(screen.knownCells).toBe(0);expect(screen.candidateCells).toBe(0);expect(screen.unknown.every(v=>v===1)).toBe(true);
  t.obstacleMask=new Uint8Array(225);t.obstacleMask[0]=1;expect(blocked(t,0,{...DEFAULTS,avoidSand:true},null)).toBe(true);
  const r=plan(t,{x:2,y:7},{x:12,y:7},'shortest',{...DEFAULTS,avoidSand:true},null)!;expect(sandRouteAudit(t,r.cells).unknownCells).toBeGreaterThan(0);
 });
 it('migrates saved missions and rejects malformed policy values',()=>{
  const t=fixture(),d={...defaultMission(t),base:{x:2,y:7},target:{x:12,y:7}};delete d.settings.avoidSand;expect(validDraft(t,d).settings.avoidSand).toBe(true);
  expect(()=>validDraft(t,{...d,settings:{...d.settings,avoidSand:'false'}})).toThrow(/sand/);
  expect(validDraft(t,{...d,settings:{...d.settings,avoidSand:false}}).settings.avoidSand).toBe(false);
 });
 it('screens the actual registered NOAH-H region on both legs of all five objectives',()=>{
  const t:Terrain=JSON.parse(fs.readFileSync('public/data/noah/terrain.json','utf8'));t.noah=validateNoah(t,JSON.parse(fs.readFileSync('public/data/noah/noah-terrain.json','utf8')));
  const screen=sandScreen(t);expect(screen.candidateCells).toBe(2188);expect(screen.knownCells).toBe(35850);
  const mission=calculateMission(t,defaultMission(t));
  for(const report of Object.values(mission.reports)){expect(report.route).not.toBeNull();expect(sandRouteAudit(t,report.route!.cells).excludedCells).toBe(0);}
 },30000);
});
