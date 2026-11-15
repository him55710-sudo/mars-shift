/* Local scientific-map cache. It is not a live telemetry or weather service. */
const CACHE='mars-shift-crew-20261115-mobile-flow-v42';
const CORE=[...new Set([...['/data/noah/context/near-dem.bin','/data/noah/context/near-optical.webp','/data/noah/context/manifest.json','/data/noah/context/dem.bin','/data/noah/context/optical.webp','/data/hazards/sand-navigation.json','/data/drive1004/surface-evidence.json','/data/drive1004/surface-features.json','/data/drive1004/surface-evidence-validation.json','/data/hazards/observed-v6/recordings.json','/data/hazards/observed-v6/results.json','/data/hazards/observed-v6/protocol.json','/data/hazards/observed-v6/pressure-screen.json','/data/hazards/observed-v6/oracle.json','/data/drive1004/manifest.json','/data/drive1004/navigation-grid.json','/data/drive1004/calibrated-validation.json','/data/drive1004/navigation-results.json','/models/nasa-emu-surface.glb','/data/navcam/manifest.json','/data/navcam/sol9-navcam-efficient.glb','/data/navcam/observation.png','/data/hazards/storm-boundaries.json','/data/hazards/v3-frozen.json','/data/hazards/v3-evaluation.json','/data/hazards/storm-evaluation.json','/data/hazards/observations.json','/data/hazards/selected-config.json','/data/hazards/evaluation.json','/data/hazards/sand-comparison.json',...['/data','/data/ridge'].flatMap(root=>['terrain-relief.webp','terrain-relief.json','terrain.json','manifest.json','optical.webp','slope.png','thermal.png','exposure.png','jezero-native-dem.json','jezero-native-dem.bin','optical-native.webp','optical-native-meta.json','surface-optical-meta.json','surface-tiles/manifest.json','obstacle-candidates-v2.json','optical-v2-mask.png','optical-v2-meta.json','science/terrain-metrics.json','science/terrain-report.json'].map(file=>root+'/'+file)),'/data/optical-benchmark.json','/data/optical-benchmark-v2.json','/data/optical-model-v2.json','/media/mars-global.jpg','/data/science-results.json','/data/navigation-results.json','/data/noah/integration-results.json','/models/nasa-emu-web.glb','/models/nasa-emu-web.json',...['/data','/data/ridge','/data/noah'].map(root=>root+'/noah-terrain.json'),...['terrain-relief.webp','terrain-relief.json','terrain.json','manifest.json','optical.webp','slope.png','thermal.png','exposure.png','jezero-native-dem.json','jezero-native-dem.bin','optical-native.webp','optical-native-meta.json','surface-optical-meta.json','surface-tiles/manifest.json','science/terrain-metrics.json','science/terrain-report.json'].map(file=>'/data/noah/'+file)],...[...['surface-evidence.json','surface-features.json','surface-evidence-validation.json'].map(p=>'/data/drive1004/'+p),...['protocol-final.json','protocol-confirmation.json','earth-analog-wind.json','policy-selection.json','final/ui-summary.json','final/report.md'].map(p=>'/data/hazards/vortex-v8/'+p),...['protocol-confirmation.json','selection-v7-2.json','confirmation-summary.json','floor-terrain.json','ridge-terrain.json','floor-optical.webp','ridge-optical.webp','report.md','paired-confirmation.csv'].map(p=>'/data/hazards/encounters-v7/'+p),'/data/hazards/observed-v6/recordings.json','/data/hazards/observed-v6/results.json','/data/hazards/observed-v6/protocol.json','/data/hazards/observed-v6/pressure-screen.json','/data/hazards/observed-v6/oracle.json','/data/drive1004/manifest.json','/data/drive1004/navigation-grid.json','/data/drive1004/calibrated-validation.json','/data/drive1004/navigation-results.json','/models/nasa-emu-surface.glb','/data/navcam/manifest.json','/data/navcam/sol9-navcam-efficient.glb','/data/navcam/observation.png','/data/hazards/storm-boundaries.json','/data/hazards/v3-frozen.json','/data/hazards/v3-evaluation.json','/data/hazards/storm-evaluation.json','/data/hazards/observations.json','/data/hazards/selected-config.json','/data/hazards/evaluation.json','/data/hazards/sand-comparison.json',...['/data','/data/ridge'].flatMap(root=>['terrain-relief.webp','terrain-relief.json','terrain.json','manifest.json','optical.webp','slope.png','thermal.png','exposure.png','jezero-native-dem.json','jezero-native-dem.bin','optical-native.webp','optical-native-meta.json','surface-optical-meta.json','surface-tiles/manifest.json','obstacle-candidates-v2.json','optical-v2-mask.png','optical-v2-meta.json','science/terrain-metrics.json','science/terrain-report.json'].map(file=>root+'/'+file)),'/data/optical-benchmark.json','/data/optical-benchmark-v2.json','/data/optical-model-v2.json','/media/mars-global.jpg','/data/science-results.json','/data/navigation-results.json','/data/noah/integration-results.json','/models/nasa-emu-web.glb','/models/nasa-emu-web.json',...['/data','/data/ridge','/data/noah'].map(root=>root+'/noah-terrain.json'),...['terrain-relief.webp','terrain-relief.json','terrain.json','manifest.json','optical.webp','slope.png','thermal.png','exposure.png','jezero-native-dem.json','jezero-native-dem.bin','optical-native.webp','optical-native-meta.json','surface-optical-meta.json','surface-tiles/manifest.json','science/terrain-metrics.json','science/terrain-report.json'].map(file=>'/data/noah/'+file)]])];
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
 const workerMetadata=await cache.match('/__workers.json');if(!workerMetadata)return {ready:false,assets:[]};const workers=await workerMetadata.json();
 const tileMetadata=await cache.match('/__surface-tiles.json');if(!tileMetadata)return {ready:false,assets:[]};const tiles=await tileMetadata.json();
 const assets=[...new Set([...tiles,...workers,...shellAssets,...entries.flatMap(entry=>[entry.file,...(entry.css||[])]).map(path=>'/'+path)])];
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
 const tileUrls=[];const roverResponse=await cache.match('/data/drive1004/manifest.json');if(!roverResponse)throw Error('Rover manifest missing');const rover=await roverResponse.json();tileUrls.push(...new Set([...rover.assets,...(rover.detailAssets||[])].map(a=>a.url)));for(const root of ['/data','/data/ridge','/data/noah']){const response=await cache.match(root+'/surface-tiles/manifest.json');if(!response)throw Error('Surface tile manifest missing');const data=await response.json();for(const level of data.levels)for(const tile of level.tiles)tileUrls.push(root+'/surface-tiles/'+tile.url);}await cache.addAll(tileUrls);await cache.put('/__surface-tiles.json',new Response(JSON.stringify(tileUrls),{headers:{'Content-Type':'application/json'}}));
 const workers=[];for(const path of chunks.filter(p=>p.endsWith('.js'))){const response=await cache.match(path);if(!response)continue;const source=await response.text();for(const hit of source.matchAll(/assets\/(?:science|mission|return|hazard|observed|field|evacuation|sand|encounter|abrupt)-worker(?:-v[0-9]+)?-[A-Za-z0-9_-]+\.js/g))workers.push('/'+hit[0]);}
 const uniqueWorkers=[...new Set(workers)];if(!uniqueWorkers.some(p=>p.includes('science-worker-'))||!uniqueWorkers.some(p=>p.includes('mission-worker-'))||!uniqueWorkers.some(p=>p.includes('return-worker-')))throw Error('Analysis, mission or return worker missing from offline build');await cache.addAll(uniqueWorkers);await cache.put('/__workers.json',new Response(JSON.stringify(uniqueWorkers),{headers:{'Content-Type':'application/json'}}));
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
 if((url.pathname.startsWith('/data/drive1004/')&&url.pathname.endsWith('.glb'))||(url.pathname.startsWith('/data/hazards/observed-v6/')&&url.pathname.endsWith('.webp'))){event.respondWith((async()=>{const cache=await caches.open(CACHE),stored=await cache.match(event.request);if(stored)return stored;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;})());return;}
 if(CORE.includes(url.pathname)||url.pathname.startsWith('/assets/')||url.pathname.includes('/surface-tiles/'))event.respondWith((async()=>{
  // These paths are public static assets. Cross-origin module request headers
  // may differ from precache headers (Vary: Origin); the bytes are identical.
  const cache=await caches.open(CACHE),stored=await cache.match(event.request,{ignoreVary:true});
  return stored||fetch(event.request);
 })());
});
