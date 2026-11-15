import fs from 'node:fs';
import crypto from 'node:crypto';
import {fitLocalTrack} from '../src/local-dust-tracker';
import type {LocalTrackerConfig} from '../src/local-dust-tracker';
import {startTrack,updateTrack,forecast} from '../src/hazard-tracker';
import type {VortexObservation} from '../src/hazard-tracker';
const root='public/data/hazards',data=JSON.parse(fs.readFileSync(root+'/local-observations.json','utf8'));
const mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/(a.length||1);
type Event={id:string;split:string;cadenceSeconds:number;cadenceKind:string;diameterMetres:number;points:{time:number;x:number;width:number;positionSigma:number;radiusSigma:number}[]};
function evaluate(event:Event,method:string,config?:LocalTrackerConfig){
 const observations:VortexObservation[]=event.points.map(p=>({time:p.time,x:p.x,y:0,radius:p.width/2,positionSigma:p.positionSigma,radiusSigma:p.radiusSigma,source:'OBSERVED_IMAGE_DERIVED'}));
 const rows=[];
 for(let i=2;i<observations.length-1;i++){
  const past=observations.slice(0,i+1),last=past.at(-1)!,prev=past.at(-2)!;
  let tr=method==='robust'?fitLocalTrack(past,config):past.slice(1).reduce((a,o)=>updateTrack(a,o),startTrack(past[0],.08));
  if(method==='persistence'||method==='two-fix'){tr=startTrack(last,.08);tr.observations=past.length;tr.x.v=method==='two-fix'?(last.x-prev.x)/(last.time-prev.time):0;}
  for(const steps of [1,2,3]){const target=observations[i+steps];if(!target)continue;const pred=forecast(tr,target.time,false,0),displacement=target.x-last.x;
   rows.push({origin:last.time,lead:target.time-last.time,steps,positionErrorPx:pred.x-target.x,widthErrorPx:2*(pred.radius-target.radius),directionCorrect:Math.abs(displacement)>=1?Number(Math.sign(pred.x-last.x)===Math.sign(displacement)):null});
  }
 }
 const summarize=(x:typeof rows)=>({samples:x.length,positionRMSEpx:Math.sqrt(mean(x.map(r=>r.positionErrorPx**2))),apparentWidthMAEpx:mean(x.map(r=>Math.abs(r.widthErrorPx))),directionSignAccuracy:mean(x.filter(r=>r.directionCorrect!==null).map(r=>r.directionCorrect!))});
 return {event:event.id,method,cadenceSeconds:event.cadenceSeconds,cadenceKind:event.cadenceKind,...summarize(rows),byLead:[1,2,3].map(n=>({leadSeconds:n*event.cadenceSeconds,...summarize(rows.filter(r=>r.steps===n))})),rows};
}
const mode=process.argv[2]??'prediction-dev';
if(mode==='prediction-dev'){
 const event=data.events.find((e:Event)=>e.split==='development'),selection=[];
 for(const window of [3,5,7] as const)for(const radiusMode of ['last','median','linear'] as const){const config={window,radiusMode,processNoise:.08},result=evaluate(event,'robust',config);selection.push({config,loss:result.positionRMSEpx+result.apparentWidthMAEpx/2,result});}
 selection.sort((a,b)=>a.loss-b.loss);const frozen={selected:selection[0].config,developmentEvent:event.id,heldoutEvents:data.events.filter((e:Event)=>e.split!=='development').map((e:Event)=>e.id),selection,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(root+'/local-observations.json')).digest('hex'),protocolSHA256:crypto.createHash('sha256').update(fs.readFileSync('docs/LOCAL_DUST_V4_PROTOCOL.md')).digest('hex')};
 fs.writeFileSync(root+'/v4-predictor-frozen.json',JSON.stringify(frozen,null,2));console.log(JSON.stringify({selected:frozen.selected,loss:selection[0].loss}));
}else if(mode==='prediction-test'){
 const frozen=JSON.parse(fs.readFileSync(root+'/v4-predictor-frozen.json','utf8'));
 const results=data.events.filter((e:Event)=>e.split!=='development').flatMap((e:Event)=>['legacy-kalman','persistence','two-fix','robust'].map(m=>evaluate(e,m,frozen.selected)));
 const report={meaning:'Held-out image-derived crossrange and apparent width; not independent 2D ground-position accuracy. Two test events only. Curiosity timing approximated.',frozen,results};
 fs.writeFileSync(root+'/v4-prediction.json',JSON.stringify(report,null,2));console.log(JSON.stringify(results.map(({rows,...r}:any)=>r),null,2));
}else throw Error('Unknown mode');
