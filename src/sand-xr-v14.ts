import type {Terrain,Point,Route,Settings} from './planner';
import {point} from './planner';
import {edgeTravelMinutes} from './mobility';
import type {SandMap} from './sand-traps-v14';
import type {XRNavigationFrame} from './hazard-xr';
export function sandXRFrame(t:Terrain,map:SandMap,crew:Point,route:Route|null,s:Settings,revision:number,spentSeconds:number){
 let time=spentSeconds;
 const points=route?route.outbound.map((i,k)=>{if(k)time+=edgeTravelMinutes(t,route.outbound[k-1],i,s)*60;const p=point(t,i);return {x:p.x*t.cellSize,y:p.y*t.cellSize,time};}):[];
 const frame:XRNavigationFrame={schemaVersion:1,revision,timestamp:spentSeconds,coordinates:'GRID_EAST_SOUTH_METRES',crs:t.crs,bounds:t.bounds,cellSize:t.cellSize,origin:crew,action:route?'AVOID_SAND':'HOLD',anchorsEnabled:!!route,route:points,forecast:[],source:'SIMULATION',localizationSigma:0,warning:route?'Published texture candidates; soil strength and registration residual unknown.':'No feasible screened route'};
 return {...frame,ground:{source:'DERIVED_NOAH_H',bufferMetres:map.bufferMetres,coreIndices:Array.from(map.core.keys()).filter(i=>map.core[i]),excludedIndices:Array.from(map.buffer.keys()).filter(i=>map.buffer[i]),unknownIndices:Array.from(map.unknown.keys()).filter(i=>map.unknown[i]),sinkageProbability:null,localization:'EXACT_SIMULATION_POSE_NOT_A_SENSOR'}};
}
