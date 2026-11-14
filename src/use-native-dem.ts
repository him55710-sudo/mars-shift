import {useEffect,useState} from 'react';
import type {Terrain} from './planner';
import type {NativeDEM} from './eva-motion';
import {assertNativeRegistration} from './native-registration';
export function useNativeDEM(t:Terrain){
 const [native,setNative]=useState<NativeDEM|null>(null),[error,setError]=useState('');
 useEffect(()=>{let current=true;const controller=new AbortController(),root=t.assetRoot??'/data';setNative(null);setError('');Promise.all([fetch(`${root}/jezero-native-dem.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Native DEM metadata unavailable.');return r.json();}),fetch(`${root}/jezero-native-dem.bin`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Native DEM unavailable.');return r.arrayBuffer();})]).then(async([meta,buffer])=>{if(!current)return;assertNativeRegistration(t,meta,buffer.byteLength);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==meta.validation.binarySha256)throw Error('Native DEM checksum mismatch.');if(!current)return;setNative({width:meta.width,height:meta.height,cellSize:meta.cellSize,bounds:meta.bounds,crs:meta.crs,values:new Float32Array(buffer)});}).catch(e=>{if(current&&e.name!=='AbortError')setError(e.message);});return()=>{current=false;controller.abort();};},[t]);return {native,error};
}
