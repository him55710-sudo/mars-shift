import {useEffect,useState} from 'react';
import type {Terrain} from './planner';
import type {RegionalContext} from './regional-terrain';
import {assertRegionalRegistration} from './regional-terrain';
const sha=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
export function useRegionalContext(t:Terrain){
 const [context,setContext]=useState<RegionalContext|null>(null),[error,setError]=useState('');
 useEffect(()=>{let current=true;const objectUrls:string[]=[];const controller=new AbortController(),root=(t.assetRoot??'/data')+'/context';setContext(null);setError('');
  const read=async(name:string)=>{const r=await fetch(root+'/'+name,{signal:controller.signal});if(!r.ok)throw Error('Regional context could not be loaded.');return r;};
  Promise.all([read('manifest.json').then(r=>r.json()),read('dem.bin').then(r=>r.arrayBuffer()),read('optical.webp').then(r=>r.arrayBuffer()),read('near-dem.bin').then(r=>r.arrayBuffer()),read('near-optical.webp').then(r=>r.arrayBuffer())]).then(async([meta,buffer,optical,nearBuffer,nearOptical])=>{
   assertRegionalRegistration(t,meta,buffer.byteLength);const [demHash,imageHash,nearDemHash,nearImageHash]=await Promise.all([sha(buffer),sha(optical),sha(nearBuffer),sha(nearOptical)]);if(demHash!==meta.binarySha256||imageHash!==meta.imageSha256||!meta.near||nearDemHash!==meta.near.binarySha256||nearImageHash!==meta.near.imageSha256||nearBuffer.byteLength!==meta.near.width*meta.near.height*4)throw Error('Regional context checksum mismatch.');
   if(!current)return;const decode=async(bytes:ArrayBuffer)=>{const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));objectUrls.push(url);const im=new Image();im.src=url;await im.decode();return im;};const [image,nearImage]=await Promise.all([decode(optical),decode(nearOptical)]);if(!current)return;setContext({meta,values:new Float32Array(buffer),nearValues:new Float32Array(nearBuffer),image,nearImage});
  }).catch(e=>{if(current&&e.name!=='AbortError')setError(e.message);});
  return()=>{current=false;controller.abort();objectUrls.forEach(url=>URL.revokeObjectURL(url));};
 },[t]);return {context,error};
}
