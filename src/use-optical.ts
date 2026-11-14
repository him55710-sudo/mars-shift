import {useEffect,useState} from 'react';
import {validateDetectionAsset} from './optical-candidates';
import type {DetectionAsset} from './optical-candidates';
import type {Terrain} from './planner';
export function useOpticalCandidates(t:Terrain){const [asset,setAsset]=useState<DetectionAsset|null>(null),[error,setError]=useState('');useEffect(()=>{const controller=new AbortController();setAsset(null);setError('');fetch((t.assetRoot??'/data')+'/obstacle-candidates-v2.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Optical candidate file is unavailable.');return r.json();}).then(d=>setAsset(validateDetectionAsset(d,t))).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[t]);return {asset,error};}
