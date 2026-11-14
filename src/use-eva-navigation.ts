import {useEffect,useMemo,useSyncExternalStore} from 'react';
import type {MissionDraft} from './mission-state';
import type {Point,Terrain} from './planner';
import type {NativeDEM} from './eva-motion';
import {attemptMove} from './eva-motion';
import {withObstacles} from './obstacles';
import {initialResources,recordTraversal,spendWork,validResourceUse,returnEstimate,assessRemaining} from './eva-resources';
import type {ResourceUse} from './eva-resources';
import {localizationValid,simulatedFix} from './position-sensor';
import type {Localization,PositionFix} from './position-sensor';
import {emergencyReturn,returnInputKey} from './emergency-return';
import type {EmergencyPlan,ReturnReply,ReturnRequest,ReturnResult} from './emergency-return';
export type NavigationSnapshot={fix:PositionFix;use:ResourceUse;returnStatus:'idle'|'computing'|'ready'|'none'|'error'|'stale';result:ReturnResult|null;previous:EmergencyPlan|null;adopted:boolean;message:string;computeMs:number|null};
export interface ReturnWorker {onmessage:((event:MessageEvent<ReturnReply>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;postMessage(request:ReturnRequest):void;terminate():void;}
const validUse=validResourceUse;
export function createNavigationStore(t:Terrain,initial:MissionDraft,factory?:()=>ReturnWorker){
 let draft=initial,native:NativeDEM|null=null,contextKey=returnInputKey(initial),snapshot:NavigationSnapshot={fix:simulatedFix(initial.base),use:initialResources(),returnStatus:'idle',result:null,previous:null,adopted:false,message:'',computeMs:null};
 const storageKey='mars-shift:surface-session:v1:'+t.bounds.join(':');
 try{const raw=localStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw),p=saved.fix?.point;if(saved.version===1&&JSON.stringify(saved.base)===JSON.stringify(initial.base)&&p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=t.width-1&&p.y<=t.height-1&&['valid','degraded','lost'].includes(saved.fix.status)&&validUse(saved.use))snapshot={...snapshot,fix:simulatedFix(p,saved.fix.status),use:saved.use,returnStatus:saved.returnRequested?'stale':'idle',message:saved.returnRequested?'Recompute the current-position return after reload.':''};}}catch{/* Storage is optional; malformed simulation state is not restored. */}
 let prepared=withObstacles(t,draft.annotations),inboundCosts:Float64Array|null=null;
 const listeners=new Set<()=>void>();let worker:ReturnWorker|null=null,generation=0,disposed=false;
 const workerFactory=factory??(typeof window!=='undefined'?()=>new Worker(new URL('./return-worker.ts',import.meta.url),{type:'module'}):null);
 const commit=(s:NavigationSnapshot)=>{snapshot=s;try{localStorage.setItem(storageKey,JSON.stringify({version:1,base:draft.base,fix:s.fix,use:s.use,returnRequested:s.returnStatus!=='idle'}));}catch{}listeners.forEach(fn=>fn());};
 const cancel=()=>{generation++;worker?.terminate();worker=null;};
 const stale=(message:string)=>{cancel();commit({...snapshot,returnStatus:snapshot.returnStatus==='idle'?'idle':'stale',adopted:false,message});};
 const record=(points:Point[])=>{
  if(!localizationValid(snapshot.fix)||points.length<2||!native)return false;
  if(Math.hypot(points[0].x-snapshot.fix.point.x,points[0].y-snapshot.fix.point.y)>1e-6){cancel();commit({...snapshot,fix:simulatedFix(snapshot.fix.point,'degraded',snapshot.fix.sequence+1),adopted:false,returnStatus:snapshot.returnStatus==='idle'?'idle':'stale',message:'Motion sequence mismatch; re-establish position.'});return false;}
  if(snapshot.returnStatus!=='idle'&&!snapshot.adopted)return false;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],r=attemptMove(prepared,a,(b.x-a.x)*t.cellSize,(b.y-a.y)*t.cellSize,draft.settings,draft.exclusion,native);if(r.blocked)return false;}
  const nextUse=recordTraversal(prepared,points,draft.settings,native,snapshot.use),p=points.at(-1)!,costs=snapshot.adopted?snapshot.result?.inboundCosts??null:inboundCosts,eta=returnEstimate(prepared,p,draft.settings,draft.exclusion,native,costs);
  if(!assessRemaining(nextUse,eta,draft.settings).feasible){commit({...snapshot,message:'Movement held: the next step has no verified modeled return reserve.'});return false;}
  commit({...snapshot,fix:{...snapshot.fix,point:{...p},sequence:snapshot.fix.sequence+1},use:nextUse});return true;
 };
 const requestReturn=()=>{
  cancel();const id=generation,requestedKey=contextKey,sequence=snapshot.fix.sequence;
  const request:ReturnRequest={id,terrain:t,native,draft:structuredClone(draft),fix:structuredClone(snapshot.fix),use:{...snapshot.use}};
  commit({...snapshot,previous:snapshot.result?.plan??snapshot.previous,returnStatus:'computing',adopted:false,message:'Calculating direct return from the current simulated position…'});
  const receive=(reply:ReturnReply)=>{
   if(disposed||generation!==id||reply.id!==id)return;
   if(contextKey!==requestedKey||snapshot.fix.sequence!==sequence){stale('Position or assumptions changed; calculate return again.');return;}
   cancel();
   if('error' in reply)commit({...snapshot,returnStatus:'error',message:reply.error});
   else commit({...snapshot,result:reply.result,returnStatus:reply.result.plan?'ready':'none',adopted:false,message:reply.result.reason||'Return candidate ready. Review remaining reserves before adoption.',computeMs:reply.elapsedMs});
  };
  try{if(workerFactory){worker=workerFactory();worker.onmessage=e=>receive(e.data);worker.onerror=()=>receive({id,error:'Return worker unavailable. Retry before moving.'});worker.postMessage(request);}else{const started=performance.now();receive({id,result:emergencyReturn(request),elapsedMs:performance.now()-started});}}
  catch(error){receive({id,error:error instanceof Error?error.message:'Return calculation unavailable.'});}
 };
 return {
  getSnapshot:()=>snapshot,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
  bind:(d:MissionDraft,dem:NativeDEM|null)=>{draft=d;native=dem;const key=returnInputKey(d);if(key!==contextKey){contextKey=key;prepared=withObstacles(t,d.annotations);inboundCosts=null;if(snapshot.returnStatus!=='idle')stale('Mission constraints changed. Recalculate the return candidate.');}},
  setReturnCosts:(costs:Float64Array|null,key:string)=>{if(key===contextKey)inboundCosts=costs;},
  recordMotion:record,
  preview:(points:Point[])=>{if(!native||!localizationValid(snapshot.fix)||snapshot.returnStatus!=='idle')return false;const prepared=withObstacles(t,draft.annotations);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],r=attemptMove(prepared,a,(b.x-a.x)*t.cellSize,(b.y-a.y)*t.cellSize,draft.settings,draft.exclusion,native);if(r.blocked)return false;}return record(points);},
  setLocalization:(status:Localization)=>{cancel();commit({...snapshot,fix:simulatedFix(snapshot.fix.point,status,snapshot.fix.sequence+1),returnStatus:snapshot.returnStatus==='idle'?'idle':'stale',adopted:false,message:status==='valid'?'Simulated position re-established. Review the current route.':'Position confidence reduced; hold and suppress ground-anchored guidance.'});},
  work:(minutes:number)=>{if(snapshot.returnStatus!=='idle')stale('Resource use changed. Calculate return again.');commit({...snapshot,use:spendWork(snapshot.use,minutes)});},
  requestReturn,
  adopt:()=>{const plan=snapshot.result?.plan;if(snapshot.returnStatus==='ready'&&plan&&localizationValid(snapshot.fix)&&plan.inputKey===contextKey&&plan.positionSequence===snapshot.fix.sequence&&JSON.stringify(plan.use)===JSON.stringify(snapshot.use))commit({...snapshot,adopted:true,message:'Direct return adopted under the displayed simulated assumptions.'});},
  cancelReturn:()=>{cancel();commit({...snapshot,returnStatus:'idle',adopted:false,result:null,previous:null,message:'Returned to the science mission; recorded resource use is retained.'});},
  reset:(point:Point=draft.base)=>{cancel();commit({fix:simulatedFix(point),use:initialResources(),returnStatus:'idle',result:null,previous:null,adopted:false,message:'Surface rehearsal reset; modeled resource use cleared.',computeMs:null});},
  dispose:()=>{disposed=true;cancel();listeners.clear();}
 };
}
const stores=new Map<string,{terrain:Terrain;store:ReturnType<typeof createNavigationStore>}>();
export function useEVANavigation(t:Terrain,draft:MissionDraft,native:NativeDEM|null){
 const store=useMemo(()=>{const key=t.bounds.join(':'),old=stores.get(key);if(old?.terrain===t)return old.store;old?.store.dispose();const store=createNavigationStore(t,draft);stores.set(key,{terrain:t,store});return store;},[t]);
 useEffect(()=>{store.bind(draft,native);},[store,draft,native]);
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot);return {state,store};
}
