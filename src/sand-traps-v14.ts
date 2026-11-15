import {validateNoah,noahEvidence} from './noah-data';
import {constrainedPlan} from './constrained-planner';
import {blocked,index,point} from './planner';
import type {Point,Settings,Terrain,Mode,Route} from './planner';

// Published MOSAIC legend IDs, not the class numbering of the training paper.
export const SAND14={rippleClasses:[3,5,6,9,12,14],minimumCoverage:.95,rippleFraction:.25,bufferMetres:5} as const;
export type SandMap={core:Uint8Array;buffer:Uint8Array;unknown:Uint8Array;fractions:Float32Array;coreCount:number;knownCount:number;bufferMetres:number};
/** Texture screening. Not a classifier of bearing strength or sinkage probability. */
export function mapSandTraps(t:Terrain,bufferMetres=5):SandMap{
 if(!Number.isFinite(bufferMetres)||bufferMetres<0||bufferMetres>30)throw Error('Buffer must be between 0 and 30 metres');
 if(t.noah)validateNoah(t,t.noah);
 const n=t.width*t.height,core=new Uint8Array(n),buffer=new Uint8Array(n),unknown=new Uint8Array(n),fractions=new Float32Array(n);let coreCount=0,knownCount=0;
 for(let i=0;i<n;i++){
  const e=noahEvidence(t.noah,i);fractions[i]=e.rippleAreaFraction??0;
  if(e.coverage<SAND14.minimumCoverage){unknown[i]=1;continue;}knownCount++;
  if(fractions[i]>=SAND14.rippleFraction){core[i]=1;coreCount++;}
 }
 // Distance between full square cell footprints, not only their centres.
 // Include touching cells conservatively; round the geometric buffer outwards.
 const radius=Math.ceil(bufferMetres/t.cellSize)+1;
 for(let i=0;i<n;i++)if(core[i]){
  const x=i%t.width,y=Math.floor(i/t.width);buffer[i]=1;
  if(!bufferMetres)continue;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(Math.hypot(Math.max(0,Math.abs(dx)-1),Math.max(0,Math.abs(dy)-1))*t.cellSize>bufferMetres+1e-9)continue;
   const a=x+dx,b=y+dy;if(a>=0&&b>=0&&a<t.width&&b<t.height)buffer[b*t.width+a]=1;
  }
 }
 return {core,buffer,unknown,fractions,coreCount,knownCount,bufferMetres};
}
export function sandTerrain(t:Terrain,map:SandMap,excludeUnknown=true):Terrain{
 if(map.core.length!==t.width*t.height)throw Error('Sand map size mismatch');
 return {...t,obstacleMask:Uint8Array.from(map.buffer,(v,i)=>Number(!!v||!!t.obstacleMask?.[i]||(excludeUnknown&&!!map.unknown[i])))};
}
export function sandAudit(map:SandMap,cells:readonly number[]){
 const ids=[...new Set(cells)];return {core:ids.filter(i=>map.core[i]).length,buffer:ids.filter(i=>map.buffer[i]).length,unknown:ids.filter(i=>map.unknown[i]).length};
}
export function sandPlan(t:Terrain,map:SandMap,base:Point,target:Point,settings:Settings,mode:Mode='shortest',excludeUnknown=true,returnBase:Point=base){
 const prepared=sandTerrain(t,map,excludeUnknown),baseline=constrainedPlan(t,base,target,mode,settings,null,returnBase),screened=constrainedPlan(prepared,base,target,mode,settings,null,returnBase);
 return {baseline,screened,prepared};
}
export function nearbySand(t:Terrain,map:SandMap,p:Point,heading=0){
 let best=Infinity,closest=-1;
 for(let i=0;i<map.buffer.length;i++)if(map.buffer[i]){const q=point(t,i),d=Math.hypot(Math.max(0,Math.abs(p.x-q.x)-.5),Math.max(0,Math.abs(p.y-q.y)-.5))*t.cellSize;if(d<best){best=d;closest=i;}}
 const here=Math.round(p.y)*t.width+Math.round(p.x),q=closest<0?null:point(t,closest),bearing=q?(Math.atan2(q.x-p.x,p.y-q.y)*180/Math.PI+360)%360:0,relative=(bearing-heading+540)%360-180;
 return {distance:closest<0?null:best,relative,side:best===0?'현재 위치':Math.abs(relative)<35?'앞쪽':Math.abs(relative)>145?'뒤쪽':relative<0?'왼쪽':'오른쪽',unknown:here<0||here>=map.unknown.length||!!map.unknown[here],inside:best===0};
}
export function routeHeading(t:Terrain,route:Route|null,step:number){
 if(!route||step>=route.outbound.length-1)return 0;const a=point(t,route.outbound[step]),b=point(t,route.outbound[step+1]);return Math.atan2(b.x-a.x,a.y-b.y)*180/Math.PI;
}
export function validSandDestination(t:Terrain,p:Point,s:Settings){return Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<t.width&&p.y<t.height&&!blocked(t,index(t,p),s,null);}
