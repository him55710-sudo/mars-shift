import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {roverTerrain,gridPoint} from '../src/rover-navigation';
import {explorationGrid,observedCoverage} from '../src/rover-entry';
import {planTraining,trainingObstacles,SAND_REHEARSAL_VERSION} from '../src/sand-rehearsal';
const input='public/data/drive1004/navigation-grid.json',g=explorationGrid(JSON.parse(readFileSync(input,'utf8'))),base=roverTerrain(g,[]),crew=gridPoint(g,g.start.x,g.start.z),target=gridPoint(g,g.target.x,g.target.z);
const cases=[];
for(const scenario of ['clear','detour','surrounded'] as const)for(const mode of ['shortest','exposure','time'] as const)for(const seconds of [180,1]){
 const obstacles=trainingObstacles(g,scenario,crew),r=planTraining(base,g,crew,target,obstacles,seconds,mode);
 cases.push({scenario,mode,budgetSeconds:seconds,feasible:!!r.route,roundTripMetres:r.route?.distance??null,modeledSeconds:r.route?r.route.totalMinutes*60:null,reservePercent:r.route?.reserve??null,baselineRoundTripMetres:r.baseline?.distance??null,baselineCrossingMetres:r.baselineAudit?.exposureMetres??null,exclusionCrossingMetres:r.audit?.exposureMetres??null,minimumClearanceMetres:r.audit?.minClearance??null,route:r.route?.outbound??[],returnRoute:r.route?.inbound??[]});
}
const report={version:SAND_REHEARSAL_VERSION,kind:'SYNTHETIC_EXCLUSION_ENFORCEMENT_NOT_DETECTION_ACCURACY',sourceGridSha256:createHash('sha256').update(readFileSync(input)).digest('hex'),entry:g.start,entryCoverage:observedCoverage(g,g.start.x,g.start.z),settings:{speedMetresPerSecond:.6,maximumSlopeDegrees:25,crewMarginMetres:.35,rasterGuardMetres:g.cellSize/Math.SQRT2,planningCellMetres:g.cellSize},independentTrappingLabels:0,trappingPrecision:null,trappingRecall:null,cases,failures:cases.filter(c=>!c.feasible).length,violations:cases.filter(c=>c.feasible&&c.exclusionCrossingMetres!>1e-8).length};
const dir='public/data/hazards/sand-v38';mkdirSync(dir,{recursive:true});const bytes=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync(dir+'/report.json','utf8').replaceAll('\r\n','\n')!==bytes)throw Error('Recorded sand rehearsal results do not reproduce');console.log('18 sand cases reproduced; source grid hash and all paths match.');}else{writeFileSync(dir+'/report.json',bytes);console.log(JSON.stringify({cases:cases.length,failures:report.failures,violations:report.violations}));}
