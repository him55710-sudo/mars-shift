import {readFileSync} from 'node:fs';
import {encounterGraph,nearestConnected} from '../src/encounter-v7';
import type {EncounterGraph} from '../src/encounter-v7';
import {makeAbrupt} from '../src/encounter-v8';
import type {AbruptCase} from '../src/encounter-v8';
import {roverTerrain,gridPoint} from '../src/rover-navigation';
import {validateNoah} from '../src/noah-data';
import {mapSandTraps,sandTerrain} from '../src/sand-traps-v14';
import type {Terrain} from '../src/planner';
export const ROOT='public/data/hazards/reactive-v16/';
export const load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
export type EvaluationCase=AbruptCase&{suite:'frozen'|'fresh'|'compound';event:string};
export type WindowSpec={id:string;x:number;y:number;width:number;height:number};
const graphs=new Map<string,EncounterGraph>(),terrains=new Map<string,Terrain>();
export function cropNoah(window:WindowSpec){
 const full=load('public/data/noah/terrain.json') as Terrain;full.noah=validateNoah(full,load('public/data/noah/noah-terrain.json'));
 const sand=mapSandTraps(full,5),prepared=sandTerrain(full,sand,true),ids=Array.from({length:window.width*window.height},(_,i)=>(window.y+Math.floor(i/window.width))*full.width+window.x+i%window.width);
 const t={...full,width:window.width,height:window.height,bounds:[full.bounds[0]+window.x*full.cellSize,full.bounds[3]-(window.y+window.height)*full.cellSize,full.bounds[0]+(window.x+window.width)*full.cellSize,full.bounds[3]-window.y*full.cellSize],noah:undefined,science:undefined,assetRoot:'/data/noah'} as Terrain;
 for(const key of ['elevation','slope','meanSlope','roughness','exposure','valid','thermal'] as const)(t[key] as any)=ids.map(i=>full[key][i]);
 t.obstacleMask=Uint8Array.from(ids,i=>prepared.obstacleMask?.[i]??0);
 return {terrain:t,window,sandCore:Uint8Array.from(ids,i=>sand.core[i]),sandBuffer:Uint8Array.from(ids,i=>sand.buffer[i]),sandUnknown:Uint8Array.from(ids,i=>sand.unknown[i]),sourceCellIndices:ids};
}
export function fixture(c:EvaluationCase,protocol:any){
 const key=c.terrain+':'+c.speed;
 if(!graphs.has(key)){
  if(!terrains.has(c.terrain)){
   const t=c.terrain==='navcam'?roverTerrain(load('public/data/drive1004/navigation-grid.json'),[]):c.terrain.startsWith('noah-')?cropNoah(protocol.windows.find((w:WindowSpec)=>w.id===c.terrain)).terrain:load('public/data/hazards/encounters-v7/'+c.terrain+'-terrain.json').terrain;
   terrains.set(c.terrain,t);
  }
  graphs.set(key,encounterGraph(terrains.get(c.terrain)!,c.speed));
 }
 const g=graphs.get(key)!,grid=c.terrain==='navcam'?load('public/data/drive1004/navigation-grid.json'):null;
 const base=grid?gridPoint(grid,grid.start.x,grid.start.z):undefined;
 const s=makeAbrupt(g,c,protocol.sources.find((a:any)=>a.id===c.source),load('public/data/hazards/vortex-v8/earth-analog-wind.json').days,base);
 // The same declared science target is used in every arm, projected to supported connectivity once.
 if(grid&&c.suite!=='frozen')s.target=nearestConnected(g,gridPoint(grid,grid.target.x,grid.target.z),s.returns);
 s.predictor='CV_SMOOTH';s.alpha=.1;s.nominalRegretCap=.5;return s;
}
