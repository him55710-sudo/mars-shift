import {useEffect,useState} from 'react';
export function useOfflineMap(){
 const [online,setOnline]=useState(navigator.onLine),[ready,setReady]=useState(false),[unsupported,setUnsupported]=useState(false),[updating,setUpdating]=useState(false);
 useEffect(()=>{
  const update=()=>setOnline(navigator.onLine);
  addEventListener('online',update);addEventListener('offline',update);
  return()=>{removeEventListener('online',update);removeEventListener('offline',update);};
 },[]);
 useEffect(()=>{
  if(import.meta.env.DEV)return;
  if(!('serviceWorker' in navigator)){setUnsupported(true);return;}
  let cancelled=false;
  let removeUpdateListeners=()=>{};
  const assets=Array.from(document.querySelectorAll('script[src],link[rel="stylesheet"]')).map(e=>new URL(e.getAttribute('src')||e.getAttribute('href')||'',location.href).pathname).filter(p=>p.startsWith('/assets/'));
  const message=(e:MessageEvent)=>{if(e.data?.type==='MARS_CACHE_STATUS'&&!cancelled)setReady(e.data.ready===true&&assets.length>=2&&Array.isArray(e.data.assets)&&assets.every(a=>e.data.assets.includes(a)));};
  navigator.serviceWorker.addEventListener('message',message);
  navigator.serviceWorker.register('/sw.js').then(reg=>{
   if(cancelled)return navigator.serviceWorker.ready;
   let installer:ServiceWorker|null=null;
   const update=()=>{if(!cancelled)setUpdating(!!reg.waiting);};
   const found=()=>{installer?.removeEventListener('statechange',update);installer=reg.installing;installer?.addEventListener('statechange',update);update();};
   reg.addEventListener('updatefound',found);found();
   removeUpdateListeners=()=>{reg.removeEventListener('updatefound',found);installer?.removeEventListener('statechange',update);};
   return navigator.serviceWorker.ready;
  }).then(reg=>{if(!cancelled)reg.active?.postMessage({type:'MARS_CACHE_STATUS'});}).catch(()=>{if(!cancelled)setUnsupported(true);});
  return()=>{cancelled=true;removeUpdateListeners();navigator.serviceWorker.removeEventListener('message',message);};
 },[]);
 return {online,ready,unsupported,updating,development:import.meta.env.DEV};
}
