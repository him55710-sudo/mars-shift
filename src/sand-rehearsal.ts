import {gridPoint,worldPoint,roverRoutes,ROVER_SETTINGS} from './rover-navigation';
import type {RoverGrid,RoverTerrain,RoverObstacle} from './rover-navigation';
import type {Point,Route,Mode} from './planner';

export type SandScenario='clear'|'detour'|'surrounded';
export const SAND_REHEARSAL_VERSION='sand-rehearsal-v38';
export const SAND_SETTINGS={...ROVER_SETTINGS,scienceMinutes:0,durationMinutes:3,oxygenMinutes:4,powerMinutes:4,reservePercent:25};
// Declared fictional training footprints, in the native Sol 477 local metre frame.
// These are NOT classifications or measurements of the NASA photographs.
export const TRAINING_PATCHES:RoverObstacle[]=[
 {id:'training-1',x:-4.375,z:9.125,radius:.7,kind:'simulated',material:'sand'},
 {id:'training-2',x:-1.125,z:9.875,radius:.65,kind:'simulated',material:'sand'},
 {id:'training-3',x:-4.625,z:5.875,radius:.75,kind:'simulated',material:'sand'},
];
export function trainingObstacles(g:RoverGrid,scenario:SandScenario,crew:Point):RoverObstacle[]{
 if(scenario==='clear')return [];
 if(scenario==='detour')return TRAINING_PATCHES;
 const w=worldPoint(g,crew);
 return Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return {id:`ring-${i}`,x:w.x+Math.cos(a)*1.9,z:w.z+Math.sin(a)*1.9,radius:.55,kind:'simulated' as const,material:'sand' as const};});
}
export function maskTrainingTerrain(base:RoverTerrain,g:RoverGrid,obstacles:RoverObstacle[]):RoverTerrain{
 const mask=Uint8Array.from(base.obstacleMask??new Uint8Array(g.width*g.height));
 for(let i=0;i<mask.length;i++){const p=worldPoint(g,{x:i%g.width,y:Math.floor(i/g.width)});
  // Extra half-cell diagonal encloses the full raster footprint + .35 m crew margin.
  if(obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<=o.radius+.35+g.cellSize/Math.SQRT2))mask[i]=1;
 }
 return {...base,obstacleMask:mask};
}
export function routeTrainingAudit(g:RoverGrid,route:Route|null,obstacles:RoverObstacle[]){
 if(!route)return null;
 let exposureMetres=0,minClearance=Infinity;
 for(const leg of [route.outbound,route.inbound])for(let k=1;k<leg.length;k++){
  const a=worldPoint(g,{x:leg[k-1]%g.width,y:Math.floor(leg[k-1]/g.width)}),b=worldPoint(g,{x:leg[k]%g.width,y:Math.floor(leg[k]/g.width)});
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);let exposed=false;
  for(const o of obstacles){const u=Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/(len*len||1)));const clearance=Math.hypot(a.x+u*dx-o.x,a.z+u*dz-o.z)-o.radius-.35;minClearance=Math.min(minClearance,clearance);if(clearance<0)exposed=true;}
  if(exposed)exposureMetres+=len;
 }
 return {exposureMetres,minClearance:Number.isFinite(minClearance)?minClearance:null};
}
export function planTraining(base:RoverTerrain,g:RoverGrid,crew:Point,target:Point,obstacles:RoverObstacle[],remainingSeconds=180,mode:Mode='shortest'){
 const began=performance.now(),terrain=maskTrainingTerrain(base,g,obstacles),settings={...SAND_SETTINGS,durationMinutes:remainingSeconds/60},home=gridPoint(g,g.start.x,g.start.z);
 const before=roverRoutes(base,crew,target,settings,home).shortest??null,options=roverRoutes(terrain,crew,target,settings,home),route=options[mode]??null;
 return {terrain,route,baseline:before,alternatives:Object.values(options).filter((r):r is Route=>!!r),audit:routeTrainingAudit(g,route,obstacles),baselineAudit:routeTrainingAudit(g,before,obstacles),milliseconds:performance.now()-began};
}
