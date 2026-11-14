import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DEFAULTS,nearestAllowed,metrics} from '../src/planner';
import type {Terrain} from '../src/planner';
import {validateScience} from '../src/science-data';
import {computeReturnMap,fastestRoundTrip,routeSensitivity,SENSITIVITY_DEFAULTS} from '../src/return-feasibility';
import {constrainedPlan} from '../src/constrained-planner';
import {MOBILITY} from '../src/mobility';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8')),sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const engineSources=Object.fromEntries(['src/mobility.ts','src/return-feasibility.ts','src/planner.ts','src/constrained-planner.ts','scripts/analyze_science.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
const regions=[];
for(const region of ['floor','ridge']){
 const root=region==='floor'?'public/data':'public/data/ridge',t=read(root+'/terrain.json') as Terrain;t.science=validateScience(t,read(root+'/science/terrain-metrics.json'));
 const base=nearestAllowed(t,{x:32,y:168},{...DEFAULTS,mobilityModel:2}),target=nearestAllowed(t,{x:153,y:43},{...DEFAULTS,mobilityModel:2});
 const models=[];
 for(const model of [1,2] as const){
  const settings={...DEFAULTS,mobilityModel:model,terrainEffort:.3},map=computeReturnMap(t,base,settings,null),fastest=fastestRoundTrip(t,map,base,target),routes=(['shortest','exposure','mission'] as const).map(mode=>{const report=constrainedPlan(t,base,target,mode,settings,null),r=report.route;return {mode,searched:report.searched,feasibleCombinations:report.feasibleCount,route:r?{distanceMetres:r.distance,travelMinutes:r.travelMinutes,totalMinutes:r.totalMinutes,reservePercent:r.reserve,outboundCells:r.outbound.length,returnCells:r.inbound.length,exposureMetres:r.exposureDistance}:null,sensitivity:r?routeSensitivity(t,r,settings,null,SENSITIVITY_DEFAULTS):null};});
  const budgetCases=[{durationMinutes:60,scienceMinutes:20,reservePercent:25},{durationMinutes:80,scienceMinutes:20,reservePercent:25},{durationMinutes:110,scienceMinutes:20,reservePercent:25},{durationMinutes:110,scienceMinutes:40,reservePercent:25},{durationMinutes:110,scienceMinutes:20,reservePercent:50}].map(patch=>{const m=computeReturnMap(t,base,{...settings,...patch},null);return {settings:patch,counts:m.counts,feasibleSquareMetres:m.counts.feasible*t.cellSize**2};});
  models.push({model,settings,counts:map.counts,feasibleSquareMetres:map.counts.feasible*t.cellSize**2,minimumDestinationTimes:{outboundMinutes:map.outbound[target.y*t.width+target.x],returnMinutes:map.inbound[target.y*t.width+target.x]},fastest:fastest?metrics(t,[...fastest.outbound,...fastest.inbound.slice(1)],'mission',settings):null,routes,budgetCases});
 }
 const expanded=computeReturnMap(t,base,{...DEFAULTS,mobilityModel:2,terrainEffort:.3},null),legacy=computeReturnMap(t,base,{...DEFAULTS,mobilityModel:1},null);let gained=0,lost=0,commonKnown=0;expanded.state.forEach((v,i)=>{if(v&&legacy.state[i]){commonKnown++;if(v===2&&legacy.state[i]!==2)gained++;if(v!==2&&legacy.state[i]===2)lost++;}});
 regions.push({region,bounds:t.bounds,crs:t.crs,base,target,sourceHashes:{terrain:sha(root+'/terrain.json'),science:sha(root+'/science/terrain-metrics.json')},comparison:{commonKnownCells:commonKnown,gainedCells:gained,lostCells:lost},models});
}
const report={schemaVersion:1,engineSources,engineHashEncoding:'SHA256 of UTF8 text with CRLF normalized to LF; data source hashes are raw bytes.',runtime:{node:process.version},model:MOBILITY,defaults:DEFAULTS,sensitivity:SENSITIVITY_DEFAULTS,regions,method:'Native derivatives aggregated to5m; directed forward/reverseDijkstra; model1legacy vsmodel2illustrative expandedEVA; same source, endpoints and budgets. Fixed-route sensitivity, no replanning.',limitations:['No calibrated Mars EVA physiology or suit-consumption model.','No soil-strength, calibrated rockfall or meter-scale thermal slip prediction.','Seeded uniform samples are imposed assumptions, not measured probabilities.','Map exactness is only for this static cropped graph and time-monotone resource model.','Real local boulder accuracy, vertical accuracy and registration error remain unmeasured.']};
writeFileSync('public/data/science-results.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(regions.map(r=>({region:r.region,comparison:r.comparison,models:r.models.map(m=>({model:m.model,feasibleSquareMetres:m.feasibleSquareMetres,counts:m.counts,destination:m.minimumDestinationTimes,routes:m.routes.map(r=>({mode:r.mode,...r.route,scenarioFrequency:r.sensitivity?.frequency})),budgets:m.budgetCases.map(b=>({...b.settings,feasibleSquareMetres:b.feasibleSquareMetres}))}))})),null,2));
