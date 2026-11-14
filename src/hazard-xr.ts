import type {EscapeDecision} from './hazard-planner';
import type {Point,Terrain} from './planner';
import type {Forecast} from './hazard-tracker';
/** Transport-neutral contract for browser WebXR or a future native OpenXR bridge.
 * No head-pose, optical registration or hardware certification is claimed. */
export type XRNavigationFrame={schemaVersion:1;revision:number;timestamp:number;coordinates:'GRID_EAST_SOUTH_METRES';crs:string;bounds:number[];cellSize:number;origin:Point;action:string;anchorsEnabled:boolean;route:({x:number;y:number;time:number})[];forecast:Forecast[];source:'SIMULATION';localizationSigma:number;warning:string|null};
export interface XRNavigationAdapter {publish(frame:XRNavigationFrame):void;close():void;}
/** Earliest conservative envelope entry between forecast samples, not just at sample endpoints. */
export function approachSeconds(forecasts:Forecast[],positionMetres:Point,now:number):number|null {
 for(let k=0;k<forecasts.length-1;k++){
  const a=forecasts[k],b=forecasts[k+1],x=a.x-positionMetres.x,y=a.y-positionMetres.y,vx=b.x-a.x,vy=b.y-a.y,r=Math.max(a.envelope,b.envelope),aa=vx*vx+vy*vy,bb=2*(x*vx+y*vy),cc=x*x+y*y-r*r;
  if(cc<=0)return Math.max(0,a.time-now);if(!aa)continue;const discriminant=bb*bb-4*aa*cc;if(discriminant<0)continue;const u=(-bb-Math.sqrt(discriminant))/(2*aa);if(u>=0&&u<=1)return Math.max(0,a.time+(b.time-a.time)*u-now);
 }return null;
}
export function makeXRFrame(t:Terrain,position:Point,decision:EscapeDecision,revision:number,localizationSigma=1):XRNavigationFrame {
 const anchorsEnabled=(decision.status==='MODELED_ACTION'||decision.status==='EXPOSURE_MINIMIZING')&&localizationSigma<=5;
 return {schemaVersion:1,revision,timestamp:decision.time,coordinates:'GRID_EAST_SOUTH_METRES',crs:t.crs,bounds:t.bounds,cellSize:t.cellSize,origin:position,action:decision.action??'NO VERIFIED ACTION',anchorsEnabled,route:anchorsEnabled?(decision.chosen?.path??[]).map(p=>({x:p.x*t.cellSize,y:p.y*t.cellSize,time:p.time})):[],forecast:decision.forecast,source:'SIMULATION',localizationSigma,warning:anchorsEnabled?null:decision.reason};
}
/** Browser host can subscribe without coupling the planner to a headset renderer. */
export class BrowserXRAdapter implements XRNavigationAdapter {
 constructor(private target:EventTarget){}
 publish(frame:XRNavigationFrame){this.target.dispatchEvent(new CustomEvent('mars-shift:xr-frame',{detail:frame}));}
 close(){}
}
