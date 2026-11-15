/** Causal pressure-dip screening at the rover, not remote vortex localization.
 * Thresholds are engineering assumptions; no detection probability is claimed.
 */
export const PRESSURE_SCREEN={baselineSeconds:30,minSamples:20,floorPa:.8,madMultiplier:4,consecutive:3,maxGapSeconds:1.1};
const median=(values:number[])=>{const a=[...values].sort((a,b)=>a-b);return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2;};
export function pressureCandidates(samples:{time:number;pressurePa:number}[],now:number){
 const prior=samples.filter(p=>p.time<=now),detections:{time:number;dropPa:number;thresholdPa:number}[]=[];let run=0;
 for(let i=0;i<prior.length;i++){
  const p=prior[i],history=prior.slice(0,i).filter(q=>q.time>=p.time-PRESSURE_SCREEN.baselineSeconds);
  if(i&&p.time-prior[i-1].time>PRESSURE_SCREEN.maxGapSeconds)run=0;
  if(history.length<PRESSURE_SCREEN.minSamples){run=0;continue;}
  const baseline=median(history.map(q=>q.pressurePa)),sigma=1.4826*median(history.map(q=>Math.abs(q.pressurePa-baseline))),threshold=Math.max(PRESSURE_SCREEN.floorPa,PRESSURE_SCREEN.madMultiplier*sigma),drop=baseline-p.pressurePa;
  run=drop>=threshold?run+1:0;
  if(run===PRESSURE_SCREEN.consecutive)detections.push({time:p.time,dropPa:drop,thresholdPa:threshold});
 }
 return detections;
}
