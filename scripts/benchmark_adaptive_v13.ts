import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AdaptiveTracker} from '../src/adaptive-tracker-v13';
import {fitForecastV8} from '../src/vortex-forecast-v8';
const out='public/data/hazards/adaptive-v13/',selected=JSON.parse(readFileSync(out+'selection.json','utf8'));
const observations=Array.from({length:512},(_,i)=>({time:i*.7,x:100+3*i*.7+Math.sin(i),y:50+i*.7+.4*Math.cos(i),positionSigma:1,radius:5.5,radiusSigma:1,source:'SIMULATED_SENSOR' as const}));
const timings:Record<string,number[]>={V8_IMM_REPLAY:[],V13_INCREMENTAL:[]};let checksum=0;
// Includes update/fit plus all three horizon queries for BOTH implementations.
// Same prefixes, same machine, alternating order, 32-prefix warm-up excluded.
for(let round=0;round<4;round++){
 const tracker=new AdaptiveTracker(selected.config);
 for(let i=0;i<observations.length;i++)for(const name of round%2?Object.keys(timings).reverse():Object.keys(timings)){
  const o=observations[i],began=performance.now();
  if(name==='V13_INCREMENTAL'){tracker.update({time:o.time,x:o.x,y:o.y,covariance:[1,0,1],crs:'TIMING'});for(const lead of [2,5,10])checksum+=tracker.predict(o.time+lead).x;}
  else{const f=fitForecastV8(observations.slice(0,i+1),'IMM');for(const lead of [2,5,10])checksum+=f(o.time+lead).x;}
  if(i>=32)timings[name].push(performance.now()-began);
 }
}
const summary=Object.entries(timings).map(([name,a])=>{a.sort((x,y)=>x-y);return {name,queries:a.length,medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],totalMs:a.reduce((x,y)=>x+y,0)};});
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
writeFileSync(out+'timing.json',JSON.stringify({createdAt:new Date().toISOString(),scope:'Synthetic 512-fix stream, 4 repeats; update + 2/5/10s queries. Different trackers, not output-identical. Machine-local CPU timing, no network/render/planner.',summary,checksum,hashes:Object.fromEntries(['src/adaptive-tracker-v13.ts','src/vortex-forecast-v8.ts','scripts/benchmark_adaptive_v13.ts',out+'selection.json'].map(p=>[p,hash(p)]))},null,2),{flag:'wx'});console.log(JSON.stringify(summary,null,2));
