import fs from 'node:fs';
import {createHash} from 'node:crypto';
import type {Terrain} from '../src/planner';
import {validateNoah} from '../src/noah-data';
import {validateScience} from '../src/science-data';
import {calculateMission,defaultMission} from '../src/mission-state';
import {sandRouteAudit,sandScreen,SAND_POLICY} from '../src/sand-screening';
const regions=['floor','ridge','noah'].map(region=>{
 const root='public/data'+(region==='floor'?'':'/'+region),files=['terrain.json','optical.webp','noah-terrain.json','science/terrain-metrics.json','manifest.json'];
 const inputs=files.map(file=>({path:root+'/'+file,sha256:createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex')}));
 const t:Terrain=JSON.parse(fs.readFileSync(root+'/terrain.json','utf8'));t.noah=validateNoah(t,JSON.parse(fs.readFileSync(root+'/noah-terrain.json','utf8')));t.science=validateScience(t,JSON.parse(fs.readFileSync(root+'/science/terrain-metrics.json','utf8')));
 const screen=sandScreen(t),draft=defaultMission(t),mission=calculateMission(t,draft);
 const summarize=(route:typeof mission.sandBaseline)=>route?{distanceMetres:route.distance,totalMinutes:route.totalMinutes,reservePercent:route.reserve,feasible:route.feasible,audit:sandRouteAudit(t,route.cells),outbound:route.outbound,inbound:route.inbound}:null;
 const routes=Object.fromEntries(Object.entries(mission.reports).map(([mode,report])=>{const r=summarize(report.route);if(r&&r.audit.excludedCells)throw Error(region+' '+mode+' crosses a sand exclusion.');return [mode,{route:r,reason:report.reason}];}));
 return {region,bounds:t.bounds,crs:t.crs,planningMetres:t.cellSize,inputs,source:t.noah.source,registration:t.noah.registration,coverage:{totalCells:screen.totalCells,knownCells:screen.knownCells,unknownCells:screen.totalCells-screen.knownCells,candidateCells:screen.candidateCells,bufferedExclusionCells:screen.excludedCells},draft,unscreenedShortest:summarize(mission.sandBaseline),routes};
});
const output={schemaVersion:1,policy:SAND_POLICY,meaning:'Published ripple texture screened as candidate sand, with declared buffered exclusions. Not a validated sand-trap detector or soil failure probability.',inputs:'HiRISE DEM and optical; NOAH-H texture; THEMIS thermal context. No unregistered rover imagery transferred to orbital cells.',limitations:['Unknown texture remains traversable under DEM constraints and is reported separately.','Independent local registration residual, soil bearing strength and observation dates are unknown.','Five-metre buffer is a planning assumption, not a measured positional error bound.','Thermal inertia is not used to make fine-grained hard trap exclusions.'],regions};
fs.writeFileSync('public/data/hazards/sand-navigation.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(regions.map(r=>({region:r.region,coverage:r.coverage,routes:Object.fromEntries(Object.entries(r.routes).map(([mode,v])=>[mode,v.route?{distance:v.route.distanceMetres,crossings:v.route.audit.excludedCells,unknown:v.route.audit.unknownCells}:null]))})),null,2));
