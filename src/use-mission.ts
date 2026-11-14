import {useMemo,useSyncExternalStore} from 'react';
import {blocked,metrics} from './planner';
import type {Mode,Terrain} from './planner';
import {calculateMission,defaultMission,emptyMission,freezeMissionHazard,missionDirty,missionKey,validDraft} from './mission-state';
import type {MissionDraft,MissionHistory,MissionSnapshot} from './mission-state';
import type {MissionWorker} from './mission-worker-protocol';
import {withObstacles} from './obstacles';
export type MissionStore=ReturnType<typeof createMissionStore>;
type Options={workerFactory?:()=>MissionWorker};
export function createMissionStore(t:Terrain,initial?:MissionDraft,options:Options={}){
 let snapshot=emptyMission(initial??defaultMission(t)),restoreRevision=0;
 if(!initial&&typeof localStorage!=='undefined')try{
  const raw=localStorage.getItem(missionKey(t));
  if(raw){const saved=JSON.parse(raw);
   if(saved.version===3){
    const draft=validDraft(t,saved.draft),calculated=validDraft(t,saved.calculated);
    restoreRevision=Number.isSafeInteger(saved.revision)&&saved.revision>=0?saved.revision:0;
    snapshot={...emptyMission(calculated),draft,pendingAdoption:saved.pendingAdoption===true};
    const old=saved.previous,validCells=(a:unknown):a is number[]=>Array.isArray(a)&&a.length>0&&a.length<100000&&a.every(i=>Number.isInteger(i)&&i>=0&&i<t.width*t.height);
    if(old&&['shortest','exposure','mission','time'].includes(old.mode)&&validCells(old.outbound)&&validCells(old.inbound)){
     const cells=[...old.outbound,...old.inbound.slice(1)],prepared=withObstacles(t,calculated.annotations);
     snapshot.previous={...metrics(t,cells,old.mode,calculated.settings),outbound:old.outbound,inbound:old.inbound};
     snapshot.invalidated=cells.filter(i=>blocked(prepared,i,calculated.settings,calculated.exclusion));
    }
   }else snapshot=emptyMission(validDraft(t,saved));
  }
 }catch{/* Corrupt storage cannot replace the validated default. */snapshot=emptyMission(initial??defaultMission(t));restoreRevision=0;}
 const listeners=new Set<()=>void>();
 let worker:MissionWorker|null=null,requestId=0,disposed=false;
 // Browser calculations never fall back to blocking the rendering thread.
 // The synchronous path is for the CLI/scientific tests only.
 const workerFactory=options.workerFactory??(typeof window!=='undefined'?()=>new Worker(new URL('./mission-worker.ts',import.meta.url),{type:'module'}):null);
 const commit=(next:MissionSnapshot)=>{
  snapshot=next;
  try{localStorage.setItem(missionKey(t),JSON.stringify({version:3,draft:next.draft,calculated:next.calculated,revision:next.revision,pendingAdoption:next.pendingAdoption,previous:next.previous}));}catch{/* Storage may be unavailable. */}
  listeners.forEach(fn=>fn());
 };
 const cancel=()=>{requestId++;worker?.terminate();worker=null;};
 const run=(draft:MissionDraft,context:MissionHistory=snapshot)=>{
  if(disposed)return;cancel();
  const id=requestId,requested=structuredClone(draft),history:MissionHistory={revision:context.revision,previous:context.previous,invalidated:context.invalidated,pendingAdoption:context.pendingAdoption};
  const fail=(message:string)=>{if(disposed||id!==requestId)return;cancel();commit({...snapshot,computing:false,calculationError:message});};
  if(!workerFactory){const started=performance.now();try{const result=calculateMission(t,requested,history);commit({...result,draft:snapshot.draft,computing:false,calculationMs:performance.now()-started});}catch(error){fail(error instanceof Error?error.message:'Route calculation failed.');}return;}
  commit({...snapshot,computing:true,calculationError:undefined});
  try{
   worker=workerFactory();
   worker.onmessage=event=>{
    const reply=event.data;if(disposed||id!==requestId||reply.id!==id)return;
    if('error' in reply){fail(reply.error);return;}
    cancel();
    // Edits made during computation remain draft edits, never stale request data.
    commit({...reply.result,draft:snapshot.draft,computing:false,calculationError:undefined,calculationMs:reply.elapsedMs});
   };
   worker.onerror=()=>fail('Route worker unavailable. Retry calculation before walking.');
   worker.postMessage({id,terrain:t,draft:requested,history});
  }catch(error){fail(error instanceof Error?error.message:'Route worker unavailable.');}
 };
 run(snapshot.calculated,{...snapshot,revision:restoreRevision-1});
 return {
  getSnapshot:()=>snapshot,
  subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
  update:(patch:Partial<MissionDraft>)=>commit({...snapshot,draft:{...snapshot.draft,...patch}}),
  selectMode:(mode:Mode)=>commit({...snapshot,draft:{...snapshot.draft,mode}}),
  calculate:()=>run(snapshot.draft),
  hazard:()=>{if(missionDirty(snapshot))return;const frozen=freezeMissionHazard(t,snapshot);if(frozen===snapshot)return;commit(frozen);run(frozen.draft,frozen);},
  adopt:()=>{if(!missionDirty(snapshot)&&snapshot.reports[snapshot.draft.mode].route)commit({...snapshot,pendingAdoption:false});},
  reset:()=>{commit({...snapshot,draft:defaultMission(t),previous:null,invalidated:[],pendingAdoption:false});run(snapshot.draft);},
  replace:(draft:MissionDraft)=>{commit({...snapshot,draft:validDraft(t,draft)});run(snapshot.draft);},
  dispose:()=>{disposed=true;cancel();listeners.clear();}
 };
}
const stores=new Map<string,{terrain:Terrain;store:MissionStore}>();
export function missionStoreFor(t:Terrain){
 const key=missionKey(t),existing=stores.get(key);
 if(!existing||existing.terrain!==t){existing?.store.dispose();const store=createMissionStore(t);stores.set(key,{terrain:t,store});return store;}
 return existing.store;
}
export function useMission(t:Terrain){const store=useMemo(()=>missionStoreFor(t),[t]);const state=useSyncExternalStore(store.subscribe,store.getSnapshot);return {state,store,dirty:missionDirty(state)};}
