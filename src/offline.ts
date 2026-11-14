import {useEffect,useState} from 'react';
export function useOfflineMap(){
 const [online,setOnline]=useState(navigator.onLine),[ready,setReady]=useState(false),[unsupported,setUnsupported]=useState(false);
 useEffect(()=>{
  const update=()=>setOnline(navigator.onLine);
  addEventListener('online',update);addEventListener('offline',update);
  return()=>{removeEventListener('online',update);removeEventListener('offline',update);};
 },[]);
 useEffect(()=>{
  if(import.meta.env.DEV)return;
  if(!('serviceWorker' in navigator)){setUnsupported(true);return;}
  let cancelled=false;
  const message=(e:MessageEvent)=>{if(e.data?.type==='MARS_CACHE_STATUS'&&!cancelled)setReady(e.data.ready===true);};
  navigator.serviceWorker.addEventListener('message',message);
  navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(reg=>{if(!cancelled)reg.active?.postMessage({type:'MARS_CACHE_STATUS'});}).catch(()=>{if(!cancelled)setUnsupported(true);});
  return()=>{cancelled=true;navigator.serviceWorker.removeEventListener('message',message);};
 },[]);
 return {online,ready,unsupported,development:import.meta.env.DEV};
}
