import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {pressureCandidates,PRESSURE_SCREEN} from '../src/meda-detection';
import type {Recordings} from '../src/observed-replay';
const root='public/data/hazards/observed-v6/',r=JSON.parse(readFileSync(root+'recordings.json','utf8')) as Recordings;
if(existsSync(root+'pressure-screen.json'))throw Error('Refusing overwrite');
const results=r.events.map(e=>{const detections=pressureCandidates(e.pressure,90),minimum=e.pressure.reduce((a,b)=>a.pressurePa<b.pressurePa?a:b);return {event:e.id,detections,windowMinimumTime:minimum.time,firstCandidateLeadToWindowMinimum:detections.length?minimum.time-detections[0].time:null};});
writeFileSync(root+'pressure-screen.json',JSON.stringify({kind:'CAUSAL_POINT_SENSOR_DIAGNOSTIC',parameters:PRESSURE_SCREEN,results,limitation:'Lead to window pressure minimum, NOT warning to the front boundary. Curated event windows cannot estimate false alarms or missed-event rates. No position or heading is inferred.'},null,2));console.log(results);
