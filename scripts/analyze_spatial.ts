import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {defaultMission,calculateMission} from '../src/mission-state';
import {validateScience} from '../src/science-data';
import {computeReturnMap} from '../src/return-feasibility';
import {auditReturnEnvelope} from '../src/return-envelope';
import {edgeBlocked} from '../src/planner';
import type {Terrain} from '../src/planner';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const regions=[];
for(const region of ['floor','ridge','noah']){
 const root='public/data'+(region==='floor'?'':'/'+region),t=read(root+'/terrain.json') as Terrain;t.science=validateScience(t,read(root+'/science/terrain-metrics.json'));
 const draft=defaultMission(t),started=performance.now(),mission=calculateMission(t,draft),missionMs=performance.now()-started,map=computeReturnMap(t,draft.base,draft.settings,null);
 const routes=Object.entries(mission.reports).map(([mode,report])=>{
  const route=report.route;if(!route)throw Error('Missing route '+region+' '+mode);
  const violations=route.cells.slice(1).filter((cell,n)=>edgeBlocked(t,route.cells[n],cell,draft.settings,null));
  if(violations.length)throw Error('Invalid graph edge in '+region+' '+mode);
  return {mode,distanceMetres:route.distance,totalMinutes:route.totalMinutes,reservePercent:route.reserve,edgesChecked:route.cells.length-1,edgeViolations:violations.length,returnAudit:auditReturnEnvelope(t,route,draft.settings,map.inbound)};
 });
 regions.push({region,settings:draft.settings,base:draft.base,target:draft.target,missionMs,routes,relief:read(root+'/terrain-relief.json')});
}
const sources=['src/planner.ts','src/constrained-planner.ts','src/return-feasibility.ts','src/return-envelope.ts','src/traverse-constraints.ts','src/grid-heap.ts','src/eva-motion.ts','scripts/bake_surface_relief.py','scripts/analyze_spatial.ts'];
const report={schemaVersion:1,date:'2026-11-15',runtime:process.version,method:'Fixed endpoints in three measured Jezero crops. Five objectives per region; every returned edge rechecked against the shared edge policy. Reverse directed minimum-time costs audit nominal and half-speed return after actual route-prefix travel and destination work. Timings are one local run, not a browser performance guarantee.',sourceHashes:Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')])),regions};
writeFileSync('public/data/spatial-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(regions.map(r=>({region:r.region,missionMs:r.missionMs,routes:r.routes.map(v=>({mode:v.mode,edgeViolations:v.edgeViolations,checked:v.edgesChecked,slowReturnMargin:v.returnAudit.slow.marginMinutes}))})),null,2));
