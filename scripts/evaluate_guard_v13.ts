import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {encounterGraph,advanceEncounter,nearestConnected} from '../src/encounter-v7';
import type {EncounterGraph} from '../src/encounter-v7';
import {makeAbrupt} from '../src/encounter-v8';
import type {ArmV8} from '../src/encounter-v8';
import {planEvacuation} from '../src/evacuation-runtime';
import {planGuardedEscape} from '../src/guarded-escape-v13';
import {planEvacuationV13} from '../src/evacuation-runtime-v13';
import {createEscapeTracker} from '../src/adaptive-escape-v13';
import {roverTerrain,gridPoint} from '../src/rover-navigation';
import {measureEscapePath} from '../src/escape-metrics';
const OUT='public/data/hazards/adaptive-v13/',mode=process.argv[2],read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
mkdirSync(OUT,{recursive:true});const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex'),save=(p:string,d:unknown)=>writeFileSync(OUT+p,JSON.stringify(d,null,2),{flag:'wx'});
const old=read('public/data/hazards/vortex-v8/protocol-confirmation.json'),selection=read(OUT+'selection.json');
if(mode==='freeze'){
 const cases:any[]=[];for(const terrain of ['floor','ridge','navcam'])for(let k=0;k<12;k++){const n=cases.length;cases.push({...old.cases[0],id:`guard-confirmation-${n}`,terrain,budget:[360,500][k%2],reaction:[1,4,8][k%3],speed:[.5,.8][Math.floor(k/2)%2],birth:[12,45,80][Math.floor(k/3)%3],distance:[18,28,45,75][k%4],heading:n*.53-.3,bearing:[-.55,.15,.55,2.6][k%4],source:old.sources[k%2].id,truth:['linear','gust','oscillate','wind'][k%4],windDay:4+k%3,sensorSeed:1380061+n*1733,startOffset:[0,0],cadence:[.5,1,2,4][k%4],dropout:k%3===0});}
 save('guard-protocol.json',{frozenAt:new Date().toISOString(),scope:'36 separately frozen synthetic placements after failed direct replacement; no tuning on these outcomes on existing DEMs, using existing synthetic motion equations; not observed astronaut escapes.',cases,sources:old.sources,arms:['Static','MARS SHIFT','Adaptive','Guarded','Oracle'],selectionHash:sha(OUT+'selection.json'),gate:'Guarded research-mode promotion only if aggregate mean exposure and return failures do not increase versus MARS SHIFT, and no DEM subgroup has worse mean exposure or return failures.',hashes:Object.fromEntries(['src/adaptive-tracker-v13.ts','src/adaptive-escape-v13.ts','src/evacuation-runtime-v13.ts','src/evacuation-runtime.ts','scripts/evaluate_guard_v13.ts','src/guarded-escape-v13.ts'].map(p=>[p,sha(p)]))});console.log('Frozen 36 fresh matched synthetic DEM cases × 5 arms.');process.exit(0);
}
if(mode!=='evaluate'||existsSync(OUT+'guard-results.json'))throw Error('Use freeze then evaluate; existing results never overwritten');
const protocol=read(OUT+'guard-protocol.json');if(protocol.selectionHash!==sha(OUT+'selection.json'))throw Error('Selection changed');for(const [p,h]of Object.entries(protocol.hashes))if(sha(p)!==h)throw Error('Engine changed: '+p);
const grid=read('public/data/drive1004/navigation-grid.json'),wind=read('public/data/hazards/vortex-v8/earth-analog-wind.json').days,graphs=new Map<string,EncounterGraph>(),rows:any[]=[];
for(const c of protocol.cases){
 const key=c.terrain+':'+c.speed;if(!graphs.has(key))graphs.set(key,encounterGraph(c.terrain==='navcam'?roverTerrain(grid,[]):read('public/data/hazards/encounters-v7/'+c.terrain+'-terrain.json').terrain,c.speed));
 for(const arm of protocol.arms){const s=makeAbrupt(graphs.get(key)!,c,protocol.sources.find((v:any)=>v.id===c.source),wind,c.terrain==='navcam'?gridPoint(grid,grid.start.x,grid.start.z):undefined);if(c.terrain==='navcam')s.target=nearestConnected(s.g,gridPoint(grid,grid.target.x,grid.target.z),s.returns);
  s.predictor='CV_SMOOTH';s.resources.oxygenSeconds=c.budget;s.resources.batterySeconds=c.budget;const predict=createEscapeTracker(selection.config,selection.covarianceScale),log:any[]=[];
  while(!s.done){const start=performance.now(),guard=arm==='Guarded'?planGuardedEscape(s,predict(s)):null,d=guard?guard.decision:arm==='Adaptive'?planEvacuationV13(s,'MARS SHIFT',predict(s)):planEvacuation(s,arm as ArmV8);log.push({time:s.time,action:d.action,unnecessaryHold:d.unnecessaryHold,guardSelected:guard?.selected??null,margin:d.returnMargin,milliseconds:performance.now()-start});advanceEncounter(s,d);}
  const m=measureEscapePath(s.trace,s.truth,s.g.terrain.cellSize,c.birth,s.time,s.truthKnots);rows.push({case:c.id,terrain:c.terrain,arm,exposure:m.exposureSeconds,minClearance:m.minClearance,returned:s.returned,returnMargin:Math.min(s.resources.oxygenSeconds,s.resources.batterySeconds)-104,reserveViolation:s.resources.oxygenSeconds<104-1e-8||s.resources.batterySeconds<104-1e-8,elapsed:s.time,holds:log.filter(r=>r.action==='HOLD').length,unnecessaryHolds:log.filter(r=>r.unnecessaryHold).length,log});
 }console.log(c.id,'complete');
}
const mean=(a:number[])=>a.reduce((x,y)=>x+y,0)/a.length;
function summarize(rows:any[]){return protocol.arms.map((arm:string)=>{const a=rows.filter(r=>r.arm===arm),times=a.flatMap(r=>r.log.map((l:any)=>l.milliseconds)).sort((x,y)=>x-y);return {arm,cases:a.length,exposure:mean(a.map(r=>r.exposure)),noContact:a.filter(r=>r.exposure<1e-8).length,returnFailures:a.filter(r=>!r.returned).length,reserveViolations:a.filter(r=>r.reserveViolation).length,unnecessaryHolds:a.reduce((n,r)=>n+r.unnecessaryHolds,0),p95Ms:times[Math.floor(.95*times.length)]};});}
const summary=summarize(rows),byTerrain=['floor','ridge','navcam'].map(terrain=>({terrain,summary:summarize(rows.filter(r=>r.terrain===terrain))}));
const gates=[{terrain:'all',summary},...byTerrain].map(group=>{const a=group.summary.find((r:any)=>r.arm==='MARS SHIFT'),b=group.summary.find((r:any)=>r.arm==='Guarded');return {terrain:group.terrain,pass:b.exposure<=a.exposure+1e-8&&b.returnFailures<=a.returnFailures};});
save('guard-results.json',{createdAt:new Date().toISOString(),protocolHash:sha(OUT+'guard-protocol.json'),summary,byTerrain,gates,promotion:gates.every(g=>g.pass),rows});console.log(JSON.stringify({summary,gates},null,2));
