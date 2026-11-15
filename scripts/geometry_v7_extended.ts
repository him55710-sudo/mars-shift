import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {bestStraightEscape,straightEncounter,headOnBoundary} from '../src/dust-devil-geometry';
const root='public/data/hazards/encounters-v7/',protocol=JSON.parse(readFileSync(root+'protocol-v2.json','utf8')),output=root+'geometry-extended.json';
if(existsSync(output))throw Error('Refusing overwrite');
const rows=[];
for(const source of protocol.sources)for(const speed of [.4,.6,.9])for(const delay of [2,6,10])for(const bearing of protocol.geometry.bearingsDegrees)for(const gap of [-.5,0,5,15,30,60,100,250,400,600]){
 const R=source.diameter/2+1,D=gap===-.5?R*.5:R+gap,theta=bearing*Math.PI/180,c={x:-D*Math.cos(theta),y:-D*Math.sin(theta)},v={x:source.speed,y:0},duration=Math.max(90,(D+4*R)/source.speed+delay+60),hold=straightEncounter(c,v,R,{x:0,y:0},delay,duration),radial=straightEncounter(c,v,R,{x:speed*Math.cos(theta),y:speed*Math.sin(theta)},delay,duration),side=[-speed,speed].map(y=>straightEncounter(c,v,R,{x:0,y},delay,duration)).sort((a,b)=>a.exposureSeconds-b.exposureSeconds)[0],best=bestStraightEscape(c,v,R,speed,delay,duration);
 rows.push({source:source.id,speed,delay,bearing,frontGap:D-R,stationaryThreat:hold.exposureSeconds>1e-8,holdContact:hold.exposureSeconds,radialAwayContact:radial.exposureSeconds,sideContact:side.exposureSeconds,bestContact:best.exposureSeconds,bestClearance:best.minClearance,headingDegrees:Math.atan2(best.vy,best.vx)*180/Math.PI});
}
const thresholds=protocol.sources.map((s:{id:string;diameter:number;speed:number})=>{const R=s.diameter/2+1,b=headOnBoundary(R,s.speed,.6,6);return {...s,...b,frontGapMetres:b.centerDistanceMetres-R,margin:1,walking:.6,delay:6};});
writeFileSync(output,JSON.stringify({kind:'FREE_PLANE_REFERENCE_NOT_POOLED_WITH_DEM',note:'Radial away is directly away from initial vortex center. Original geometry.json oppositeContact was opposite the drift vector, a different action. 3240 synthetic combinations, not observed events. Best is sampled straight-heading oracle; head-on thresholds use exact formula.',count:rows.length,thresholds,rows},null,2));
console.log(rows.length,JSON.stringify(thresholds));
