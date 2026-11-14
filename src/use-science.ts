import {useEffect,useRef,useState} from 'react';
import type {Exclusion,Point,Route,Settings,Terrain} from './planner';
import type {ReturnMap,SensitivityConfig,SensitivityResult} from './return-feasibility';
export type ScienceResult={navigationKey?:string;map:ReturnMap;comparison:{otherFeasible:number;gained:number;lost:number;commonKnown:number};fastest:{outbound:number[];inbound:number[]}|null;sensitivity:SensitivityResult|null};
export function useScienceAnalysis(terrain:Terrain,base:Point,target:Point,settings:Settings,exclusion:Exclusion|null,route:Route|null,config:SensitivityConfig,navigationKey?:string){
 const previousTerrain=useRef(terrain);
 const [result,setResult]=useState<ScienceResult|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{
  const sameTerrain=previousTerrain.current===terrain;previousTerrain.current=terrain;setResult(previous=>sameTerrain&&previous?.navigationKey===navigationKey?previous:null);setError('');if(!terrain.science){setPending(false);return;}setPending(true);let worker:Worker|null=null;
  const timer=setTimeout(()=>{try{worker=new Worker(new URL('./science-worker.ts',import.meta.url),{type:'module'});worker.onmessage=e=>{if(e.data.error)setError(e.data.error);else setResult({...e.data,navigationKey});setPending(false);worker?.terminate();};worker.onerror=()=>{setError('Scientific worker failed. Existing mission tools remain available.');setPending(false);worker?.terminate();};worker.postMessage({terrain,base,target,settings,exclusion,route,config});}catch(e){setError(e instanceof Error?e.message:'Scientific worker unavailable.');setPending(false);}},220);
  return()=>{clearTimeout(timer);worker?.terminate();};
 },[terrain,base,target,settings,exclusion,route,config,navigationKey]);
 return {result,error,pending};
}
