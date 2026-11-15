import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {encounterGraph,advanceEncounter,nearestConnected} from '../src/encounter-v7';
import type {EncounterGraph} from '../src/encounter-v7';
import {makeAbrupt,planAbrupt} from '../src/encounter-v8';
import type {ArmV8} from '../src/encounter-v8';
import {planEvacuation} from '../src/evacuation-runtime';
import {roverTerrain,gridPoint} from '../src/rover-navigation';
import {measureEscapePath} from '../src/escape-metrics';
const root='public/data/hazards/vortex-v10/',mode=process.argv[2]??'freeze',load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
mkdirSync(root,{recursive:true});const write=(name:string,data:unknown)=>writeFileSync(root+name,JSON.stringify(data,null,2),{flag:'wx'});
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const old=load('public/data/hazards/vortex-v8/protocol-confirmation.json'),wind=load('public/data/hazards/vortex-v8/earth-analog-wind.json').days;
if(mode==='freeze'){
 const cases:any[]=[];let n=0;
 for(const terrain of ['floor','ridge','navcam'])for(const budget of [330,520])for(const reaction of [2,6,10])for(const speed of [.4,.9]){
  cases.push({...old.cases[0],id:`horizon-${String(n).padStart(3,'0')}`,terrain,budget,reaction,speed,
   birth:[10,50,120][Math.floor(n/2)%3],distance:24+(n%4)*7,heading:n*.47,bearing:[-.3,0,.3][n%3],
   source:old.sources[n%2].id,truth:['gust','oscillate','wind'][Math.floor(n/4)%3],windDay:4+Math.floor(n/3)%3,
   sensorSeed:1011000+n,startOffset:[0,0],cadence:1,dropout:n%4===0});n++;
 }
 write('protocol.json',{frozenAt:new Date().toISOString(),scope:'Engineering regression and new synthetic sensitivity conditions; reused DEM/wind and v8 family equations. No new observed events, no forecast tuning.',
   goal:'Remove false fixed-horizon planning refusal with shared budgets; preserve contact and actual return/reserve outcomes.',
   gate:'All 36 cases × 3 matched arms: no increase in mean contact, actual reserve breaches or return failures within each arm; fewer planner refusals.',
   sources:old.sources,cases,arms:['Static','Nominal','MARS SHIFT'],hashes:Object.fromEntries(['src/evacuation-runtime.ts','src/encounter-v8.ts','src/encounter-v7.ts','src/vortex-forecast-v8.ts'].map(p=>[p,sha(p)]))});
 console.log('Frozen 36 cases before runtime measurements.');process.exit(0);
}
if(existsSync(root+'results.json'))throw Error('Refusing overwrite');const p=load(root+'protocol.json');for(const [path,hash] of Object.entries(p.hashes))if(sha(path)!==hash)throw Error('Engine changed after freeze');
const grid=load('public/data/drive1004/navigation-grid.json'),graphs=new Map<string,EncounterGraph>(),rows:any[]=[];
for(const c of p.cases)for(const arm of p.arms as ArmV8[])for(const version of ['v8','v10']){
 const key=c.terrain+':'+c.speed;if(!graphs.has(key))graphs.set(key,encounterGraph(c.terrain==='navcam'?roverTerrain(grid,[]):load('public/data/hazards/encounters-v7/'+c.terrain+'-terrain.json').terrain,c.speed));
 const s=makeAbrupt(graphs.get(key)!,c,p.sources.find((a:any)=>a.id===c.source),wind,c.terrain==='navcam'?gridPoint(grid,grid.start.x,grid.start.z):undefined);
 if(c.terrain==='navcam')s.target=nearestConnected(s.g,gridPoint(grid,grid.target.x,grid.target.z),s.returns);
 s.predictor='CV_SMOOTH';s.resources.oxygenSeconds=c.budget;s.resources.batterySeconds=c.budget;
 const log:any[]=[];while(!s.done){const d=version==='v8'?planAbrupt(s,arm):planEvacuation(s,arm);log.push({time:s.time,action:d.action,returnMargin:d.returnMargin,horizon:d.path.at(-1)!.time-s.time,latencyMs:d.latencyMs});advanceEncounter(s,d);}
 const m=measureEscapePath(s.trace,s.truth,s.g.terrain.cellSize,c.birth,s.time,s.truthKnots);
 rows.push({case:c.id,terrain:c.terrain,arm,version,contact:m.exposureSeconds,minClearance:m.minClearance,returned:s.returned,
  plannerRefusal:s.budgetFailure,reserveViolation:s.resources.oxygenSeconds<104-1e-8||s.resources.batterySeconds<104-1e-8,elapsed:s.time,log});
 if(arm==='MARS SHIFT'&&version==='v10')console.log(c.id,'completed');
}
const mean=(a:number[])=>a.reduce((s,v)=>s+v,0)/a.length;
const summary=Object.fromEntries(p.arms.flatMap((arm:string)=>['v8','v10'].map(version=>{const r=rows.filter(r=>r.arm===arm&&r.version===version),lat=r.flatMap(r=>r.log.map((d:any)=>d.latencyMs)).sort((a,b)=>a-b);return [arm+'-'+version,{cases:r.length,meanContact:mean(r.map(r=>r.contact)),noContact:r.filter(r=>r.contact<1e-8).length,returnFailures:r.filter(r=>!r.returned).length,plannerRefusals:r.filter(r=>r.plannerRefusal).length,reserveViolations:r.filter(r=>r.reserveViolation).length,p95Ms:lat[Math.floor(lat.length*.95)]}];})));
const gates=p.arms.map((arm:string)=>{const a:any=summary[arm+'-v8'],b:any=summary[arm+'-v10'];return {arm,pass:b.meanContact<=a.meanContact+1e-8&&b.returnFailures<=a.returnFailures&&b.reserveViolations<=a.reserveViolations&&b.plannerRefusals<a.plannerRefusals};});
write('results.json',{createdAt:new Date().toISOString(),protocolHash:sha(root+'protocol.json'),hashes:p.hashes,summary,gates,rows});console.log(JSON.stringify({summary,gates},null,2));
