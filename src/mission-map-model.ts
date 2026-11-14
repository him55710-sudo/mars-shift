import type {Mode,Route,Settings,Terrain} from './planner';
import {blocked,point} from './planner';
import {hasMobilityData} from './mobility';
import {explainRoute} from './route-explanation';
export const ROUTE_OPTIONS:{id:Mode;name:string;short:string;color:string;purpose:string}[]=[
 {id:'time',name:'Fastest time',short:'Fastest',color:'#60d8f3',purpose:'Minimum modeled round-trip travel time'},
 {id:'shortest',name:'Shortest distance',short:'Shortest',color:'#f7c675',purpose:'Minimum distance among searched feasible alternatives'},
 {id:'exposure',name:'Safety priority',short:'Lower exposure',color:'#b3e4a5',purpose:'Lower slope, relief and steep-slope proximity cost'},
 {id:'mission',name:'Mission balanced',short:'Balanced',color:'#b6a0ec',purpose:'Balance terrain effort, exposure and return resources'},
];
export function routePurpose(route:Route|null,shortest:Route|null,mode:Mode){return {...explainRoute(route,shortest,mode),option:ROUTE_OPTIONS.find(m=>m.id===mode)!};}
export type RouteProfileSample={cell:number;distance:number;elevation:number;slope:number|null};
/** Elevation and length use the same registered 5 m planning geometry as routing. */
export function routeElevationProfile(t:Terrain,route:Route|null){
 if(!route)return [] as RouteProfileSample[];let distance=0;const samples:RouteProfileSample[]=[];
 for(let n=0;n<route.outbound.length;n++){
  const cell=route.outbound[n],e=t.elevation[cell];if(!t.valid[cell]||e===null||!Number.isFinite(e))return [];
  if(n){const a=route.outbound[n-1],p=point(t,a),q=point(t,cell);distance+=Math.hypot(Math.hypot(q.x-p.x,q.y-p.y)*t.cellSize,e-t.elevation[a]!);}
  samples.push({cell,distance,elevation:e,slope:t.slope[cell]});
 }return samples;
}
export type HazardClass='unknown'|'excluded'|'steep-proximity'|'clear-mapped';
export function mappedHazard(t:Terrain,i:number,s:Settings,e:Parameters<typeof blocked>[3]):HazardClass{
 if(!t.valid[i]||t.elevation[i]===null||!Number.isFinite(t.elevation[i])||t.slope[i]===null||!Number.isFinite(t.slope[i])||!hasMobilityData(t,i,s))return 'unknown';
 if(blocked(t,i,s,e))return 'excluded';
 if(t.exposure[i])return 'steep-proximity';
 return 'clear-mapped';
}
