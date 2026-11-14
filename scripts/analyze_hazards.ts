import fs from 'node:fs';
import crypto from 'node:crypto';
import {prepareHazardContext,HAZARD_DEFAULTS} from '../src/hazard-planner';
import type {HazardModel} from '../src/hazard-planner';
import {makeScenario,runEpisode,SCENARIOS,seededRandom,aerodynamicContext} from '../src/hazard-simulation';
import type {EpisodeMetrics} from '../src/hazard-simulation';
import {validateNoah} from '../src/noah-data';
import type {Terrain} from '../src/planner';
const out='public/data/hazards',evidence=JSON.parse(fs.readFileSync(out+'/observations.json','utf8'));
const regions=['floor','ridge','noah'].map(id=>{const root='public/data'+(id==='floor'?'':'/'+id),t:Terrain=JSON.parse(fs.readFileSync(root+'/terrain.json','utf8'));t.noah=validateNoah(t,JSON.parse(fs.readFileSync(root+'/noah-terrain.json','utf8')));return {id,terrain:t};});
const arms:HazardModel[]=['Baseline','Dynamic','MARS SHIFT'];
const configurations=[{q:.04,groundWeight:1},{q:.08,groundWeight:1.5},{q:.15,groundWeight:2}];
const mean=(a:number[])=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const percentile=(a:number[],q:number)=>{const s=[...a].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*q))]??null;};
const cost=(r:EpisodeMetrics)=>10*r.exposureSeconds+10*r.resourceViolationSeconds+20*r.constraintViolations+.2*r.distanceMetres+.2*r.noActionSeconds+.1*r.unnecessaryHoldSeconds-.1*r.progressMetres;
type Result=EpisodeMetrics&{region:string};
const selection:{q:number;groundWeight:number;meanLoss:number}[]=[];
const start=performance.now();
for(const cfg of configurations){const scores:number[]=[];
 for(const {id,terrain} of regions){for(let seed=1;seed<=16;seed++){const scenario=makeScenario(terrain,evidence,seed),context=prepareHazardContext(terrain,scenario.settings,scenario.base),r=runEpisode(context,scenario,'MARS SHIFT',{...HAZARD_DEFAULTS,groundWeight:cfg.groundWeight},cfg.q);scores.push(cost(r));}console.log('Selection',cfg.q,id,'mean loss',mean(scores).toFixed(2));}
 selection.push({...cfg,meanLoss:mean(scores)});
}
const selected=[...selection].sort((a,b)=>a.meanLoss-b.meanLoss)[0],config={...HAZARD_DEFAULTS,groundWeight:selected.groundWeight};
const frozen={schemaVersion:1,clientDate:'2026-11-15',status:'SIMULATION_ONLY',accelerationNoise:selected.q,config,selection,selectionSeeds:[1,16],holdoutSeeds:[101,132],protocolSHA256:crypto.createHash('sha256').update(fs.readFileSync('docs/HAZARD_EVALUATION_PROTOCOL.md')).digest('hex')};
fs.writeFileSync(out+'/selected-config.json',JSON.stringify(frozen,null,2));console.log('Frozen before holdout',selected);
const rows:Result[]=[];
for(const {id,terrain} of regions){
 for(let seed=101;seed<=132;seed++){const scenario=makeScenario(terrain,evidence,seed),context=prepareHazardContext(terrain,scenario.settings,scenario.base);for(const model of arms)rows.push({...runEpisode(context,scenario,model,config,selected.q),region:id});if(seed%8===4)console.log('Holdout',id,seed);}
}
function summary(r:Result[]){return {episodes:r.length,exposureSeconds:mean(r.map(x=>x.exposureSeconds)),exposedEpisodes:r.filter(x=>x.exposureSeconds>0).length,groundRiskMetres:mean(r.map(x=>x.groundRiskMetres)),constraintViolations:r.reduce((s,x)=>s+x.constraintViolations,0),distanceMetres:mean(r.map(x=>x.distanceMetres)),movingSeconds:mean(r.map(x=>x.movingSeconds)),holdSeconds:mean(r.map(x=>x.holdSeconds)),unnecessaryHoldSeconds:mean(r.map(x=>x.unnecessaryHoldSeconds)),noActionSeconds:mean(r.map(x=>x.noActionSeconds)),episodesWithNoAction:r.filter(x=>x.noActionSeconds>0).length,returnFeasibleEpisodes:r.filter(x=>x.returnFeasible).length,resourceViolationSeconds:mean(r.map(x=>x.resourceViolationSeconds)),progressMetres:mean(r.map(x=>x.progressMetres)),excessDistanceMetres:mean(r.map(x=>Math.max(0,x.distanceMetres-Math.max(0,x.progressMetres)))),replanMs:{p50:percentile(r.flatMap(x=>x.replanMs),.5),p95:percentile(r.flatMap(x=>x.replanMs),.95),max:Math.max(...r.flatMap(x=>x.replanMs))}};}
const byModel=Object.fromEntries(arms.map(model=>[model,summary(rows.filter(r=>r.model===model))]));
const differences=Array.from({length:32},(_,i)=>{const seed=101+i;return mean(rows.filter(r=>r.seed===seed&&r.model==='MARS SHIFT').map(r=>r.exposureSeconds))-mean(rows.filter(r=>r.seed===seed&&r.model==='Baseline').map(r=>r.exposureSeconds));});
const rng=seededRandom(20261115),boot=Array.from({length:2000},()=>mean(Array.from({length:differences.length},()=>differences[Math.floor(rng()*differences.length)])));
const errors=rows.filter(r=>r.model==='MARS SHIFT').flatMap(r=>r.forecastErrors),forecasts=[5,10,20,30].map(horizon=>{const e=errors.filter(e=>e.horizon===horizon);return {horizon,count:e.length,positionRMSE:Math.sqrt(mean(e.map(e=>e.position**2))),positionP95:percentile(e.map(e=>e.position),.95),radiusMAE:mean(e.map(e=>e.radius)),nominal95PositionCoverage:mean(e.map(e=>+e.covered))};});
const results={schemaVersion:1,clientDate:'2026-11-15',meaning:'Paired synthetic sensor/trajectory experiments on observed Jezero terrain. NOT real Mars track accuracy or astronaut safety validation.',frozen,byModel,byScenario:Object.fromEntries(SCENARIOS.map(kind=>[kind,Object.fromEntries(arms.map(model=>[model,summary(rows.filter(r=>r.kind===kind&&r.model===model))]))])),byRegion:Object.fromEntries(regions.map(({id})=>[id,Object.fromEntries(arms.map(model=>[model,summary(rows.filter(r=>r.region===id&&r.model===model))]))])),exposureDifference:{quantity:'MARS SHIFT minus Baseline, mean seconds per 60-second episode',mean:mean(differences),clusterBootstrap95:[percentile(boot,.025),percentile(boot,.975)],clusters:32,clusterUnit:'scenario seed across all three regions'},forecasts,physicalContext:aerodynamicContext(evidence),elapsedSeconds:(performance.now()-start)/1000,limitations:['Selection is an engineering preference; no probability of injury is fitted.','Unverified HOLD is counted as no action and is still scored against hidden truth.','Static return feasibility beyond the short forecast horizon is conditional.','Quarter-second midpoint exposure integration can differ from continuous contact duration.','Meteorological values are historical context, not live Mars telemetry.','MCD/CFD vector products are not assimilated. Terrain deflection is an explicit assumption.']};
fs.writeFileSync(out+'/evaluation.json',JSON.stringify(results,null,2));fs.writeFileSync(out+'/episodes.json',JSON.stringify(rows));
const keys=['region','seed','kind','model','exposureSeconds','distanceMetres','groundRiskMetres','constraintViolations','holdSeconds','unnecessaryHoldSeconds','noActionSeconds','returnFeasible','resourceViolationSeconds','progressMetres'];fs.writeFileSync(out+'/episodes.csv',keys.join(',')+'\n'+rows.map(r=>keys.map(k=>String((r as any)[k])).join(',')).join('\n'));
console.log(JSON.stringify({byModel,forecasts,exposureDifference:results.exposureDifference,elapsedSeconds:results.elapsedSeconds},null,2));
