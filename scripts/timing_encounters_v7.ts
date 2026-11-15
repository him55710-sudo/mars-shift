import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {encounterGraph,makeEncounter,planEncounter} from '../src/encounter-v7';
import {roverTerrain,gridPoint} from '../src/rover-navigation';
import type {EncounterCase} from '../src/encounter-v7';
const root='public/data/hazards/encounters-v7/',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),protocol=load(root+'protocol-confirmation.json'),grid=load('public/data/drive1004/navigation-grid.json'),output=root+'timing.json';
if(existsSync(output))throw Error('Refusing overwrite');
const rows=[];
for(const c of protocol.cases.filter((c:EncounterCase)=>c.family==='ahead'&&Math.abs(c.distance-protocol.sources.find((s:{id:string})=>s.id===c.source).diameter/2-1-35)<1e-6)){
 const g=encounterGraph(c.terrain==='navcam'?roverTerrain(grid,[]):load(root+c.terrain+'-terrain.json').terrain,.6);
 for(const time of [6,14]){const s=makeEncounter(g,c,protocol.sources.find((q:{id:string})=>q.id===c.source),c.terrain==='navcam'?gridPoint(grid,grid.start.x,grid.start.z):undefined);s.time=time;s.trackerWindow=7;
  for(let i=0;i<2;i++)planEncounter(s,'Adaptive',.25);
  const ms=[];for(let i=0;i<10;i++)ms.push(planEncounter(s,'Adaptive',.25).latencyMs);ms.sort((a,b)=>a-b);rows.push({case:c.id,time,terrain:c.terrain,ms,p50:ms[5],p95:ms[9]});
 }
}
const all=rows.flatMap(r=>r.ms).sort((a,b)=>a-b),result={createdAt:new Date().toISOString(),kind:'WARM_PLANNER_MICROBENCHMARK',note:'18 fixed states x 10 repeats after 2 warmups. Graph load/render/worker transport excluded; other desktop tasks may run. Not a real-time guarantee.',calls:all.length,p50:all[Math.floor(all.length*.5)],p95:all[Math.floor(all.length*.95)],max:all.at(-1),over2000ms:all.filter(v=>v>2000).length,rows};
writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));
