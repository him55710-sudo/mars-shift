import {fitLocalTrack} from './local-dust-tracker';
import {forecast} from './hazard-tracker';

export type RecordedMovie={id:string;page:string;split:string;cadenceSeconds:number;cadenceKind:string;imageSize:number[];roi:number[];diameterMetres:number;advectionMps:number|null;points:{time:number;frame:number;x:number;width:number;positionSigma:number;radiusSigma:number;quality:string;image:string}[]};
export type RecordedPassage={id:string;sol:number;ltst:string;eventSCLK:number;pressure:{time:number;pressurePa:number}[];wind:{time:number;speedMps:number;directionDeg:number;speedSigma:number|null;bothBooms:boolean}[];fit:{diameterMetres:number;diameterSigma:number|null;speedMps:number;speedSigma:number};issues:string[];quality:{pressure:{count:number;medianCadenceSeconds:number;maxGapSeconds:number};wind:{count:number;medianCadenceSeconds:number;maxGapSeconds:number}}};
export type Recordings={schemaVersion:1;events:RecordedPassage[];movies:RecordedMovie[];catalogSource:string;limitations:string[]};

/** Returns an actual past sample, never an interpolated or future sensor fix. */
export function recordedAt<T extends {time:number}>(points:T[],time:number,maxAge:number):T|null {
 for(let i=points.length-1;i>=0;i--)if(points[i].time<=time)return time-points[i].time<=maxAge?points[i]:null;
 return null;
}
/** A pixel forecast is deliberately not a world-navigation observation. */
export function imagePrediction(movie:RecordedMovie,time:number,horizon=movie.cadenceSeconds){
 const history=movie.points.filter(p=>p.time<=time);
 if(history.length<3||time-history.at(-1)!.time>movie.cadenceSeconds*1.5)return null;
 const track=fitLocalTrack(history.map(p=>({time:p.time,x:p.x,y:0,radius:p.width/2,positionSigma:p.positionSigma,radiusSigma:p.radiusSigma,source:'OBSERVED_IMAGE_DERIVED' as const})),{window:5,radiusMode:'last',processNoise:.08});
 const f=forecast(track,time+horizon,false,0);
 return {coordinateType:'IMAGE_CROSSRANGE_PIXELS' as const,time:time+horizon,x:f.x,width:f.radius*2,position95:f.position95,latest:history.at(-1)!.time};
}

/** Chronological evaluation at the next *recorded* frame; no temporal resampling. */
export function scoreRecordedMovies(movies:RecordedMovie[]){
 return movies.flatMap(movie=>['persistence','two-frame velocity','five-frame robust'].map(method=>{
  const errors:number[]=[],widthErrors:number[]=[];
  for(let i=2;i<movie.points.length-1;i++){
   const p=movie.points[i],previous=movie.points[i-1],next=movie.points[i+1],dt=next.time-p.time;
   const prediction=imagePrediction(movie,p.time,dt)!;
   const x=method==='persistence'?p.x:method==='two-frame velocity'?p.x+(p.x-previous.x)/(p.time-previous.time)*dt:prediction.x;
   errors.push(x-next.x);widthErrors.push((method==='five-frame robust'?prediction.width:p.width)-next.width);
  }
  return {event:movie.id,split:movie.split,method,n:errors.length,coordinateType:'PIXELS',rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),widthMAE:widthErrors.reduce((s,e)=>s+Math.abs(e),0)/widthErrors.length,cadenceSeconds:movie.cadenceSeconds,cadenceKind:movie.cadenceKind};
 }));
}
