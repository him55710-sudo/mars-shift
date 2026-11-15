import {readFileSync} from 'node:fs';
import {encounterGraph,makeEncounter,planEncounter,advanceEncounter} from '../src/encounter-v7';
const p=JSON.parse(readFileSync('public/data/hazards/encounters-v7/protocol-v2.json','utf8')),c=p.cases.find((x:any)=>x.id==='dev-006'),g=encounterGraph(JSON.parse(readFileSync('public/data/hazards/encounters-v7/ridge-terrain.json','utf8')).terrain,c.speed),s=makeEncounter(g,c,p.sources.find((x:any)=>x.id===c.source));
while(!s.done){const d=planEncounter(s,'Endpoint',0);if(s.time>=70&&d.action==='HOLD'){console.log(JSON.stringify({time:s.time,position:s.position,base:s.base,reason:d.reason,path:d.path.slice(0,8),margin:d.returnMargin}));break;}advanceEncounter(s,d);}

console.log(JSON.stringify({returned:s.returned,time:s.time,position:s.position}));
