import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {encounterGraph,makeEncounter,planEncounter,advanceEncounter,encounterTruth} from '../src/encounter-v7';
import {measureEscapePath} from '../src/escape-metrics';
const root='public/data/hazards/encounters-v7/',load=(p:string)=>JSON.parse(readFileSync(p,'utf8')),protocol=load(root+'protocol-confirmation.json'),c=protocol.cases.find((c:{id:string})=>c.id==='confirm-036'),source=protocol.sources.find((s:{id:string})=>s.id===c.source),s=makeEncounter(encounterGraph(load(root+'ridge-terrain.json').terrain,c.speed),c,source),rows=[],output=root+'regression-diagnostic.json';
if(existsSync(output))throw Error('Refusing overwrite');s.trackerWindow=7;
while(!s.done){
 const a=planEncounter(s,'Adaptive',.25),e=planEncounter(s,'Endpoint',0),oracle=planEncounter(s,'Oracle',0),truth=(time:number)=>{const q=encounterTruth(c,source,s.initial,1,time);return {...q,radius:q.radius+1};};
 const details=(d:typeof a)=>({action:d.action,nominal:d.contact,band:d.bandContact,clearance:d.clearance,margin:d.returnMargin,next:d.path.find(p=>p.time>=s.time+2),actualFutureContact:measureEscapePath(d.path,truth,1,s.time,s.time+36,[20]).exposureSeconds});
 rows.push({time:s.time,position:{...s.position},adaptive:details(a),endpointAtSamePosition:details(e),oracleAtSamePosition:details(oracle)});advanceEncounter(s,a);
}
writeFileSync(output,JSON.stringify({kind:'POST_CONFIRMATION_DIAGNOSTIC_NO_RETUNING',case:c.id,note:'Alternative paths evaluated from the adaptive astronaut state, not their independent rollouts. Future truth is used only for offline diagnosis.',rows},null,2));
console.log(JSON.stringify(rows.filter(r=>r.adaptive.actualFutureContact>r.endpointAtSamePosition.actualFutureContact+.5),null,2));
