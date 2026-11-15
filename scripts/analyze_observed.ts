import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scoreRecordedMovies} from '../src/observed-replay';
import type {Recordings} from '../src/observed-replay';
import {observedSession,observedSnapshot,advanceObserved} from '../src/observed-session';
import {conditionalAt} from '../src/observed-escape';
import {measureEscapePath} from '../src/escape-metrics';
import type {RoverGrid} from '../src/rover-navigation';
import type {HazardModel} from '../src/hazard-planner';
const root='public/data/hazards/observed-v6/',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),record=load(root+'recordings.json') as Recordings,grid=load('public/data/drive1004/navigation-grid.json') as RoverGrid;
const protocol=load(root+'protocol.json'),rows:any[]=[];
if(existsSync(root+'results.json'))throw Error('Refusing to overwrite results');
for(const c of protocol.cases)for(const model of ['Baseline','Dynamic','MARS SHIFT'] as HazardModel[]){
 const event=record.events.find(e=>e.id===c.event)!;const s=observedSession(grid,event,c.heading,model,c.warning,c.walkingSpeed),times:number[]=[],decisions:any[]=[];let held=0,failedBudget=false;
 while(!s.done){const snap=observedSnapshot(s),a=snap.decision.chosen;times.push(snap.decision.latencyMs);if(a?.action==='HOLD')held+=2;if(!a||!a.budgetSafe)failedBudget=true;decisions.push({time:s.time,position:s.position,action:a?.action??null,contact:a?.contact,clearance:a?.clearance,returnMargin:a?.returnMargin});advanceObserved(s,snap.decision);}
 // Evaluation truth is a pre-fixed parameter perturbation, NOT observed ground truth.
 const nominal=measureEscapePath(s.trace,t=>conditionalAt(s.vortex,t),grid.cellSize,0,s.time),stress=measureEscapePath(s.trace,t=>conditionalAt(s.vortex,t,c.truthSizeSigma,c.truthSpeedSigma),grid.cellSize,0,s.time);
 const distance=s.trace.slice(1).reduce((d,p,i)=>d+Math.hypot(p.x-s.trace[i].x,p.y-s.trace[i].y)*grid.cellSize,0);times.sort((a,b)=>a-b);
 rows.push({case:c.id,event:c.event,model,nominalContact:nominal.exposureSeconds,contact:stress.exposureSeconds,minClearance:stress.minClearance,distance,elapsed:s.time,holdSeconds:held,returnComplete:s.returnComplete,returnFailed:!s.returnComplete,failedBudget,p95Ms:times[Math.floor(times.length*.95)],decisions});
 console.log(c.id,model,'contact',stress.exposureSeconds.toFixed(3),'returned',s.returnComplete);
}
const summary=Object.fromEntries(['Baseline','Dynamic','MARS SHIFT'].map(model=>{const r=rows.filter(r=>r.model===model),mean=(key:string)=>r.reduce((a,b)=>a+b[key],0)/r.length;return [model,{cases:r.length,noContact:r.filter(r=>r.contact<1e-8).length,meanContact:mean('contact'),meanMinimumClearance:mean('minClearance'),meanDistance:mean('distance'),meanHold:mean('holdSeconds'),returnCompleted:r.filter(r=>r.returnComplete).length,returnFailures:r.filter(r=>r.returnFailed).length,budgetViolations:r.filter(r=>r.failedBudget).length,meanP95Ms:mean('p95Ms')}];}));
const sourceFiles=['src/observed-escape.ts','src/observed-session.ts','src/observed-replay.ts','src/rover-navigation.ts','src/escape-metrics.ts','src/dust-devil-geometry.ts','src/planner.ts','src/mobility.ts','scripts/analyze_observed.ts','public/data/drive1004/navigation-grid.json',root+'recordings.json',root+'protocol.json'];
const hashes=Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
writeFileSync(root+'results.json',JSON.stringify({kind:'RECORDED_PIXEL_FORECAST_AND_CONDITIONAL_LOCAL_ESCAPE',protocolSHA256:hashes[root+'protocol.json'],pixelForecasts:scoreRecordedMovies(record.movies),summary,rows,hashes,limitations:protocol.limitations},null,2));
const keys=['case','event','model','nominalContact','contact','minClearance','distance','elapsed','holdSeconds','returnComplete','returnFailed','failedBudget','p95Ms'];writeFileSync(root+'paired-cases.csv',[keys.join(','),...rows.map(r=>keys.map(k=>r[k]).join(','))].join('\n'));
console.log(JSON.stringify(summary,null,2));
