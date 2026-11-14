import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {defaultMission,calculateMission} from '../src/mission-state';
import {validateScience} from '../src/science-data';
import {emergencyReturn} from '../src/emergency-return';
import {simulatedFix} from '../src/position-sensor';
import {initialResources,recordTraversal,spendWork} from '../src/eva-resources';
import {point} from '../src/planner';
import type {Terrain} from '../src/planner';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const regions=[];
for(const region of ['floor','ridge','noah']){
 const root='public/data'+(region==='floor'?'':'/'+region),t=read(root+'/terrain.json') as Terrain;t.science=validateScience(t,read(root+'/science/terrain-metrics.json'));
 const meta=read(root+'/jezero-native-dem.json'),bytes=readFileSync(root+'/jezero-native-dem.bin'),native={...meta,values:new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))},draft=defaultMission(t),started=performance.now(),mission=calculateMission(t,draft),missionMs=performance.now()-started;
 const route=mission.reports.mission.route!;if(!route)throw Error('Missing baseline '+region);
 const half=Math.floor(route.outbound.length/2),a=point(t,route.outbound[half]),b=point(t,route.outbound[half+1]),current={x:a.x+(b.x-a.x)*.35,y:a.y+(b.y-a.y)*.35},points=[...route.outbound.slice(0,half+1).map(i=>point(t,i)),current],use=spendWork(recordTraversal(t,points,draft.settings,native,initialResources()),5),request={id:1,terrain:t,native,draft,fix:simulatedFix(current),use},returnStart=performance.now(),result=emergencyReturn(request),returnMs=performance.now()-returnStart;
 const fail=emergencyReturn({...request,use:{...use,oxygenMinutes:draft.settings.oxygenMinutes}});
 regions.push({region,sourceHashes:{terrain:sha(root+'/terrain.json'),dem:sha(root+'/jezero-native-dem.bin'),science:sha(root+'/science/terrain-metrics.json')},settings:draft.settings,base:draft.base,target:draft.target,missionMs,returnMs,routes:Object.entries(mission.reports).map(([mode,r])=>({mode,distance:r.route?.distance,travelMinutes:r.route?.travelMinutes,reserve:r.route?.reserve,effortMetres:r.route?.effortMetres})),current,use,directReturn:result.plan?{distance:result.plan.route.distance,travelMinutes:result.plan.route.travelMinutes,reserve:result.plan.route.reserve,connectorMetres:result.plan.connectorMetres,skipsScienceTarget:!result.plan.route.outbound.includes(route.outbound.at(-1)!)}:null,exhaustedOutcome:fail.reason});
}
const files=['src/energy-model.ts','src/emergency-return.ts','src/eva-resources.ts','src/constrained-planner.ts','src/planner.ts','scripts/analyze_navigation.ts'];
const report={schemaVersion:1,runtime:process.version,engineSources:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')])),method:'Fixed baseline endpoints. Walk halfway along mission outbound plus a 35% fractional edge, add five modeled work minutes, calculate direct current-position return. Times are one local Node run, not browser FPS. Reuses real 1m DEM with 5m graph; no calibrated physiology.',regions};
writeFileSync('public/data/navigation-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(regions.map(r=>({region:r.region,missionMs:r.missionMs,returnMs:r.returnMs,routes:r.routes,directReturn:r.directReturn})),null,2));
