/* Optional local benchmark probe; never imported by the production application. */
(() => {
  performance.setResourceTimingBufferSize(1500);
  let readyAt = null, lcp = null, longTasks = 0;
  try { new PerformanceObserver(list => { lcp = list.getEntries().at(-1)?.startTime ?? lcp; }).observe({type:'largest-contentful-paint',buffered:true}); } catch {}
  try { new PerformanceObserver(list => { longTasks += list.getEntries().length; }).observe({type:'longtask',buffered:true}); } catch {}
  const timer = setInterval(() => {
    const scene = document.querySelector('.rover-scene');
    if (readyAt === null && scene?.dataset.loaded === 'true') readyAt = performance.now();
    const resources = performance.getEntriesByType('resource').filter(r => !r.name.includes('__perf-probe'));
    const output = document.getElementById('performance-probe') || document.body.appendChild(Object.assign(document.createElement('output'),{id:'performance-probe'}));
    output.style.cssText = 'position:fixed;bottom:0;left:0;z-index:9999;background:#172025;color:#f2f5f5;font:11px monospace;padding:4px 8px;pointer-events:none;max-width:100%';
    const scripts = resources.filter(r => /\.js$/.test(new URL(r.name).pathname));
    const json = resources.filter(r => /\.json$/.test(new URL(r.name).pathname));
    const result = {readyMs:readyAt===null?null:Math.round(readyAt),lcpMs:lcp===null?null:Math.round(lcp),longTasks,requests:resources.length,decodedBytes:resources.reduce((a,r)=>a+r.decodedBodySize,0),scriptBytes:scripts.reduce((a,r)=>a+r.decodedBodySize,0),jsonBytes:json.reduce((a,r)=>a+r.decodedBodySize,0),errors:resources.filter(r=>r.responseStatus>=400).map(r=>new URL(r.name).pathname),resources:resources.map(r=>({path:new URL(r.name).pathname,bytes:r.decodedBodySize,transfer:r.transferSize,ms:Math.round(r.duration)})),scene:scene?{...scene.dataset}:null};
    output.dataset.result = JSON.stringify(result);
    output.dataset.ready = String(readyAt !== null);
    output.textContent = `Benchmark · ${readyAt===null?'loading':`${Math.round(readyAt)} ms ready`} · ${resources.length} requests · ${Math.round(result.scriptBytes/1024)} KiB JS`;
    if (readyAt!==null&&performance.now()-readyAt>20000) clearInterval(timer);
  },100);
})();
