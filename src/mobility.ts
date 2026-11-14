import type {Settings,Terrain} from './planner';

/** Deliberately illustrative coefficients, not a fitted Mars EVA physiology model. */
export const MOBILITY={version:'directional-geometry-v1',uphill:5,downhill:2,payloadPerKg:.015,triReferenceMetres:1,defaultTerrainEffort:.3};
export const expandedMobility=(s:Settings)=>s.mobilityModel===2;
export function hasMobilityData(t:Terrain,i:number,s:Settings){
 return !expandedMobility(s)||!!t.science&&t.science.fields.tri[i]!==null&&Number.isFinite(t.science.fields.tri[i]);
}
export function edgeTravelMinutes(t:Terrain,a:number,b:number,s:Settings):number {
 if(!hasMobilityData(t,a,s)||!hasMobilityData(t,b,s))return Infinity;
 const dx=(b%t.width-a%t.width)*t.cellSize,dy=(Math.floor(b/t.width)-Math.floor(a/t.width))*t.cellSize,h=Math.hypot(dx,dy);
 if(!h)return 0;
 const za=t.elevation[a],zb=t.elevation[b];if(za===null||zb===null||!Number.isFinite(za)||!Number.isFinite(zb)||s.speed<=0)return Infinity;
 const dz=zb-za,distance=Math.hypot(h,dz),up=Math.max(0,dz/h),down=Math.max(0,-dz/h),sl=((t.meanSlope[a]??0)+(t.meanSlope[b]??0))/2;
 const factor=expandedMobility(s)?1+MOBILITY.uphill*up+MOBILITY.downhill*down+(s.terrainEffort??MOBILITY.defaultTerrainEffort)*((t.science!.fields.tri[a]!+t.science!.fields.tri[b]!)/2/MOBILITY.triReferenceMetres)+MOBILITY.payloadPerKg*s.loadKg:1+sl*sl*.012+s.loadKg*.015+up*2;
 return distance*factor/(Math.max(.01,s.speed)*(s.dust?.55:1)*60);
}
export function budgetForTravel(travelMinutes:number,s:Settings){
 const totalMinutes=travelMinutes+s.scienceMinutes,oxygenUse=travelMinutes*(1+s.loadKg*.01)+s.scienceMinutes*.65,powerUse=travelMinutes*(1+s.loadKg*.005)+s.scienceMinutes*.8;
 const oxygenRemaining=100*(1-oxygenUse/s.oxygenMinutes),powerRemaining=100*(1-powerUse/s.powerMinutes),timeRemaining=s.durationMinutes-totalMinutes,reserve=Math.min(oxygenRemaining,powerRemaining);
 const reasons:string[]=[];if(!Number.isFinite(travelMinutes)||travelMinutes<0)reasons.push('Modeled travel time is unsupported or invalid.');if(timeRemaining < -1e-9)reasons.push('Round trip exceeds mission time budget.');if(reserve+1e-9<s.reservePercent)reasons.push('Return resource reserve is below the required minimum.');if(s.dust)reasons.push('Reduced visibility: HOLD and verify local obstacle detection before movement.');
 return {totalMinutes,oxygenRemaining,powerRemaining,timeRemaining,reserve,feasible:!reasons.length,reasons};
}
