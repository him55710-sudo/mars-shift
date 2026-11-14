/** Regional orbital storm model, km and sols. Never rescale these into local EVA metres. */
export type StormFix={year:number;phase:string;sol:number;lon:number;lat:number;areaKm2:number;confidence:number;member:string};
export type StormConfig={damping:number;growth:number;window:number;centerErrorKm:number;radiusErrorKm:number};
export const MARS_RADIUS_KM=3389.5;
const rad=Math.PI/180,wrap=(x:number)=>(x+540)%360-180;
export function greatCircleKm(a:{lon:number;lat:number},b:{lon:number;lat:number}){const dlat=(b.lat-a.lat)*rad,dlon=wrap(b.lon-a.lon)*rad,h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;return 2*MARS_RADIUS_KM*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));}
function bearing(a:StormFix,b:StormFix){const d=wrap(b.lon-a.lon)*rad;return Math.atan2(Math.sin(d)*Math.cos(b.lat*rad),Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos(d));}
function advance(a:StormFix,distance:number,azimuth:number){const d=distance/MARS_RADIUS_KM,p=a.lat*rad,l=a.lon*rad,lat=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(azimuth)),lon=l+Math.atan2(Math.sin(azimuth)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(lat));return {lon:wrap(lon/rad),lat:lat/rad};}
export function forecastRegionalStorm(history:StormFix[],sol:number,c:StormConfig){
 if(history.length<2)throw Error('At least two observed fixes required');
 const a=history[Math.max(0,history.length-c.window)],b=history.at(-1)!,dt=b.sol-a.sol,lead=sol-b.sol;
 if(dt<=0||lead<0||lead>2||history.some(p=>p.year!==b.year||p.phase!==b.phase||p.member!==b.member||p.sol>b.sol))throw Error('Unsupported time, phase or member');
 const speed=greatCircleKm(a,b)/dt,center=advance(b,speed*c.damping*lead,bearing(a,b)),r=Math.sqrt(b.areaKm2/Math.PI),dr=(r-Math.sqrt(a.areaKm2/Math.PI))/dt,radiusKm=Math.max(1,r+Math.max(-r*.5,Math.min(r*.5,dr*c.growth*lead)));
 return {...center,sol,radiusKm,areaKm2:Math.PI*radiusKm**2,speedKmPerSol:speed*c.damping,centerErrorKm:c.centerErrorKm*Math.sqrt(Math.max(1,lead)),radiusErrorKm:c.radiusErrorKm*Math.sqrt(Math.max(1,lead)),source:'FORECAST_FROM_ARCHIVED_ORBITAL_OBSERVATIONS' as const};
}
/** Circle-proxy overlap, not polygon IoU. */
export function circleIoU(r:number,s:number,d:number){let intersection=0;if(d>=r+s)return 0;if(d<=Math.abs(r-s))intersection=Math.PI*Math.min(r,s)**2;else intersection=r*r*Math.acos((d*d+r*r-s*s)/(2*d*r))+s*s*Math.acos((d*d+s*s-r*r)/(2*d*s))-.5*Math.sqrt(Math.max(0,(-d+r+s)*(d+r-s)*(d-r+s)*(d+r+s)));return intersection/(Math.PI*(r*r+s*s)-intersection);}
export function regionalEscapeAssessment(f:ReturnType<typeof forecastRegionalStorm>,crew:{lon:number;lat:number},walkSpeed:number,availableSeconds:number){const clearanceKm=greatCircleKm(f,crew)-f.radiusKm-f.centerErrorKm-f.radiusErrorKm,walkKm=walkSpeed*Math.max(0,availableSeconds)/1000;return {clearanceKm,walkKm,canWalkOut:clearanceKm>=0||-clearanceKm<=walkKm,action:clearanceKm>=0?'MONITOR_REGIONAL_FRONT':'RETURN_TO_SHELTER',meaning:'Forecast circle + validation error screening. Shelter is the designated base; no prediction of interior conditions.'};}
