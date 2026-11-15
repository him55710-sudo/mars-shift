import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {observedSession,observedSnapshot,advanceObserved} from '../src/observed-session';
import {conditionalAt} from '../src/observed-escape';
import {measureEscapePath} from '../src/escape-metrics';
import type {Recordings} from '../src/observed-replay';
import type {RoverGrid} from '../src/rover-navigation';
const root='public/data/hazards/observed-v6/',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),r=load(root+'recordings.json') as Recordings,grid=load('public/data/drive1004/navigation-grid.json') as RoverGrid,protocol=load(root+'protocol.json');
if(existsSync(root+'oracle.json'))throw Error('Refusing to overwrite diagnostic');
const rows=[];
for(const c of protocol.cases){
 const s=observedSession(grid,r.events.find(e=>e.id===c.event)!,c.heading,'MARS SHIFT',c.warning,c.walkingSpeed),original={...s.vortex},speed=Math.hypot(original.vx,original.vy),ratio=Math.max(.05,speed+c.truthSpeedSigma*original.speedSigma)/speed;
 // Supply the same fixed synthetic trajectory used for scoring, with no estimation uncertainty.
 s.vortex={...original,vx:original.vx*ratio,vy:original.vy*ratio,radius:Math.max(.1,original.radius+c.truthSizeSigma*original.radiusSigma),radiusSigma:0,speedSigma:0};
 while(!s.done){const snap=observedSnapshot(s);advanceObserved(s,snap.decision);}
 const m=measureEscapePath(s.trace,t=>conditionalAt(original,t,c.truthSizeSigma,c.truthSpeedSigma),grid.cellSize,0,s.time);
 rows.push({case:c.id,contact:m.exposureSeconds,minClearance:m.minClearance,returnComplete:s.returnComplete});
}
const result={kind:'POST_RESULT_DIAGNOSTIC_NO_POLICY_CHANGE',protocol:load(root+'oracle-protocol.json'),rows,summary:{cases:rows.length,noContact:rows.filter(r=>r.contact<1e-8).length,meanContact:rows.reduce((s,r)=>s+r.contact,0)/rows.length,returnCompleted:rows.filter(r=>r.returnComplete).length},scriptSHA256:createHash('sha256').update(readFileSync('scripts/analyze_observed_oracle.ts')).digest('hex')};
writeFileSync(root+'oracle.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.summary));
