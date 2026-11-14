import {useEffect,useState} from 'react';
import type {Terrain} from './planner';
import type {NativeDEM} from './eva-motion';
export function useNativeDEM(t:Terrain){
 const [native,setNative]=useState<NativeDEM|null>(null),[error,setError]=useState('');
 useEffect(()=>{let current=true;const controller=new AbortController(),root=t.assetRoot??'/data';setNative(null);setError('');Promise.all([fetch(`${root}/jezero-native-dem.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Native DEM metadata unavailable.');return r.json();}),fetch(`${root}/jezero-native-dem.bin`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Native DEM unavailable.');return r.arrayBuffer();})]).then(([meta,buffer])=>{if(!current)return;if(meta.width*meta.height*4!==buffer.byteLength||meta.bounds.some((v:number,i:number)=>Math.abs(v-t.bounds[i])>.001))throw Error('Native DEM dimensions or registration do not match this region.');setNative({width:meta.width,height:meta.height,cellSize:meta.cellSize,bounds:meta.bounds,crs:meta.crs,values:new Float32Array(buffer)});}).catch(e=>{if(current&&e.name!=='AbortError')setError(e.message);});return()=>{current=false;controller.abort();};},[t]);return {native,error};
}
