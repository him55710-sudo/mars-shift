/* Run with PLAYWRIGHT_MODULE pointing to a Playwright installation, if not local. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.QA_URL||'http://127.0.0.1:5173';
(async()=>{
  fs.mkdirSync('.local/terrain-qa',{recursive:true});
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',args:['--enable-webgl','--ignore-gpu-blocklist']});
  try{
    const page=await browser.newPage({viewport:{width:1536,height:1100},deviceScaleFactor:1,acceptDownloads:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/terrain');
    await page.locator('.tl-scene canvas').waitFor();
    await page.locator('.tl-profile-chart svg path[fill="url(#tl-profile-fill)"]').waitFor();
    await page.screenshot({path:'.local/terrain-qa/desktop.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    console.log('desktop 3D loaded',await page.locator('.tl-overview').innerText());
    for(const id of ['slope','roughness','thermal','optical','elevation']){
      await page.locator(`.tl-layers button:has(.${id})`).click();
      assert.equal(await page.locator(`.tl-layers button:has(.${id})`).getAttribute('aria-pressed'),'true');
      assert.ok((await page.locator('.tl-map-caption strong').innerText()).length>0);
    }
    await page.locator('#vertical-scale').fill('12');
    assert.match(await page.locator('.tl-map-caption small').innerText(),/12/);
    await page.getByLabel('격자 열 X',{exact:true}).fill('25');await page.getByLabel('격자 행 Y',{exact:true}).fill('45');await page.getByRole('button',{name:'입력 좌표 조회',exact:true}).click();
    assert.match(await page.locator('.tl-panel-head .tl-kicker').innerText(),/09025/);
    const viewport=page.locator('.tl-map-viewport');await viewport.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('input[aria-label="격자 열 X"]')?.value==='26');
    const canvas=page.locator('.tl-scene canvas'),bounds=await canvas.boundingBox();
    await canvas.click({position:{x:bounds.width*.5,y:bounds.height*.5}});
    await page.waitForFunction(()=>document.querySelector('input[aria-label="격자 열 X"]')?.value!=='26');
    await page.getByRole('button',{name:'지도 확대',exact:true}).click();await page.getByRole('button',{name:'지도 축소',exact:true}).click();await page.getByRole('button',{name:'시점 초기화',exact:true}).click();
    await page.getByRole('checkbox',{name:/좌표 격자/}).check();await page.getByRole('checkbox',{name:/예시 탐사 경로/}).check();await page.getByRole('checkbox',{name:/등고선/}).uncheck();
    await page.getByRole('button',{name:'2D 지도',exact:true}).click();await page.locator('.tl-flat-map').waitFor();
    await page.getByRole('button',{name:'두 지점 사이 단면 그리기',exact:true}).click();const flat=page.locator('.tl-flat-map'),box=await flat.boundingBox();
    // Use the middle region; the SVG preserves a square map within the viewport.
    await flat.click({position:{x:box.width*.4,y:box.height*.65}});await flat.click({position:{x:box.width*.6,y:box.height*.35}});
    await page.locator('.tl-profile-chart').waitFor();
    const reports={};
    for(const [label,key] of [['분석 보고서','report'],['전체 격자','grid'],['고도 단면','profile']]){
      await page.getByRole('button',{name:'데이터 내보내기'}).click();const waiting=page.waitForEvent('download');await page.locator('#tl-export-options button').filter({hasText:label}).click();const file=await waiting;await file.saveAs(`.local/terrain-qa/${file.suggestedFilename()}`);reports[key]=file.suggestedFilename();
    }
    const report=JSON.parse(fs.readFileSync('.local/terrain-qa/'+reports.report,'utf8'));assert.equal(report.statistics.elevation.count,40000);assert.ok(report.profile.distance>0);assert.ok(report.profile.samples.length>2);assert.ok(fs.readFileSync('.local/terrain-qa/'+reports.grid,'utf8').split('\r\n').length===40001);
    await page.getByRole('button',{name:'3D 지형',exact:true}).click();await page.locator('.tl-scene canvas').waitFor();
    await page.getByRole('link',{name:'Mission Control',exact:true}).click();await page.locator('.terrain-map').waitFor();await page.getByRole('link',{name:'3D Terrain',exact:true}).click();await page.locator('.tl-scene canvas').waitFor();
    for(const width of [1024,768,390]){
      await page.setViewportSize({width,height:width===390?844:1100});await page.screenshot({path:`.local/terrain-qa/width-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
    }
    assert.deepEqual(errors,[]);console.log('PASS: five layers, 3D picking/camera, keyboard/coordinate input, overlays, 2D profile, three downloads, navigation, four viewport widths; no page errors.');
    if(process.env.QA_OFFLINE==='1'){
      await page.waitForFunction(()=>document.querySelector('.tl-status')?.textContent.includes('오프라인 준비됨'));
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      await page.context().setOffline(true);await page.reload();await page.locator('.tl-scene canvas').waitFor();
      await page.locator('.tl-layers button:has(.thermal)').click();await page.locator('.tl-map-caption strong').filter({hasText:'열관성'}).waitFor();
      await page.context().setOffline(false);
      const deleted=await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('mars-shift-crew-'));const cache=await caches.open(name);const key=(await cache.keys()).find(r=>r.url.includes('/assets/TerrainExplorer-')&&r.url.endsWith('.js'));await cache.delete(key);navigator.serviceWorker.controller.postMessage({type:'MARS_CACHE_STATUS'});return key.url;});
      await page.waitForFunction(()=>!document.querySelector('.tl-status')?.textContent.includes('오프라인 준비됨'));
      assert.ok(deleted.includes('TerrainExplorer'));console.log('PASS: production offline reload and layer change; readiness retracts when the terrain chunk is missing.');
    }
    const fallback=await browser.newPage();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).startsWith('webgl')?null:original.call(this,type,...args);};});await fallback.goto(base+'/terrain');await fallback.locator('.tl-flat-map').waitFor();assert.match(await fallback.locator('.tl-status').innerText(),/2D/);console.log('PASS: unavailable WebGL falls back to 2D.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
