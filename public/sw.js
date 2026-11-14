/* Local scientific-map cache. It is not a live telemetry or weather service. */
const CACHE='mars-shift-crew-20261114-terrain-v4';
const CORE=['/data/terrain.json','/data/manifest.json','/data/optical.webp','/data/slope.png','/data/thermal.png','/data/exposure.png'];
async function status(){
 const cache=await caches.open(CACHE);
 const checks=await Promise.all(['/',...CORE].map(url=>cache.match(url)));
 const shell=await cache.match('/');
 if(!shell)return {ready:false,assets:[]};
 const html=await shell.text();
 const shellAssets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
 const manifest=await cache.match('/.vite/manifest.json');
 if(!manifest)return {ready:false,assets:[]};
 const entries=Object.values(await manifest.json());
 const assets=[...new Set([...shellAssets,...entries.flatMap(entry=>[entry.file,...(entry.css||[])]).map(path=>'/'+path)])];
 const scripts=await Promise.all(assets.map(url=>cache.match(url)));
 return {ready:checks.every(Boolean)&&shellAssets.length>=2&&scripts.every(Boolean),assets};
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const shell=await fetch('/',{cache:'reload'});
 if(!shell.ok)throw Error('Application shell unavailable');
 const text=await shell.clone().text();
 if(!text.includes('id="root"'))throw Error('Application shell not recognized');
 await cache.put('/',shell);
 const assets=[...text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
 if(assets.length<2)throw Error('Built application assets missing');
 // Include lazy terrain-analysis chunks so a verified offline shell opens Terrain Lab too.
 const manifestResponse=await fetch('/.vite/manifest.json',{cache:'reload'});
 if(!manifestResponse.ok)throw Error('Build manifest unavailable');
 await cache.put('/.vite/manifest.json',manifestResponse.clone());
 const manifest=await manifestResponse.json();
 const chunks=Object.values(manifest).flatMap(entry=>[entry.file,...(entry.css||[])]).map(path=>'/'+path);
 await cache.addAll([...new Set([...CORE,...assets,...chunks])]);
 /* No automatic page reload: a new worker waits until existing clients close. */
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('mars-shift-crew-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
 for(const client of await self.clients.matchAll())client.postMessage({type:'MARS_CACHE_STATUS',...await status()});
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='MARS_CACHE_STATUS')event.waitUntil(status().then(result=>event.source?.postMessage({type:'MARS_CACHE_STATUS',...result})));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith((async()=>{
   try{return await fetch(event.request);}catch{return await (await caches.open(CACHE)).match('/')||Response.error();}
  })());return;
 }
 if(CORE.includes(url.pathname)||url.pathname.startsWith('/assets/'))event.respondWith((async()=>{
  // These paths are public static assets. Cross-origin module request headers
  // may differ from precache headers (Vary: Origin); the bytes are identical.
  const cache=await caches.open(CACHE),stored=await cache.match(event.request,{ignoreVary:true});
  return stored||fetch(event.request);
 })());
});
