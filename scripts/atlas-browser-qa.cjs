const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.QA_URL||'http://127.0.0.1:5173';
(async()=>{
  fs.mkdirSync('.local/atlas-qa',{recursive:true});
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1536,height:1000},acceptDownloads:true});
    const errors=[],tiles={ctx:0,dem:0,hirise:0,nasa:0};
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(!r.ok())return;const u=r.url();if(u.includes('/CTX1/MapServer/tile'))tiles.ctx++;if(u.includes('/MDEM200M/ImageServer/tile'))tiles.dem++;if(u.includes('/HiRISE/MapServer/tile'))tiles.hirise++;if(u.includes('/JEZ_hirise_soc_006_orthoMosaic'))tiles.nasa++;});
    await page.goto(base+'/terrain');
    await page.waitForFunction(()=>{const b=document.querySelector('.ma-position-actions button');return b&&!b.disabled;},null,{timeout:60000});
    await page.waitForFunction(()=>document.querySelector('.ma-point-metrics')?.textContent.includes('-2,'),null,{timeout:30000});
    await page.waitForFunction(()=>document.querySelector('.ma-connection')?.textContent.includes('표시됨'),null,{timeout:30000});await page.screenshot({path:'.local/atlas-qa/global.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:/Jezero 예제로/}).click();
    await page.waitForFunction(()=>Number(document.querySelector('.mars-atlas').dataset.cameraAltitude)<100000,null,{timeout:30000});
    await page.getByRole('button',{name:'주변 보기',exact:true}).click();
    await page.waitForFunction(()=>Number(document.querySelector('.mars-atlas').dataset.cameraAltitude)<10000,null,{timeout:30000});
    await page.waitForFunction(()=>document.querySelector('.ma-connection')?.textContent.includes('표시됨'),null,{timeout:30000});
    await page.screenshot({path:'.local/atlas-qa/nearby.png',fullPage:true});
    assert.ok(tiles.ctx>0&&tiles.dem>0&&tiles.nasa>0,JSON.stringify(tiles));
    const before=Number(await page.locator('.mars-atlas').getAttribute('data-view-scale'));
    await page.mouse.move(800,450);await page.mouse.wheel(0,-650);
    await page.waitForFunction(before=>Number(document.querySelector('.mars-atlas').dataset.viewScale)<before,before);
    await page.getByRole('button',{name:'내 위치로',exact:true}).click();
    assert.ok(await page.evaluate(()=>localStorage.getItem('mars-shift-my-mars-position')));
    await page.getByRole('combobox',{name:'주변 표시 범위'}).selectOption('1000');
    await page.getByRole('button',{name:'위치 데이터 JSON 저장',exact:true}).click();
    // Trigger a second explicit export while listening, since the first checks direct activation.
    const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'위치 데이터 JSON 저장',exact:true}).click();const file=await downloaded;await file.saveAs('.local/atlas-qa/location.json');
    const report=JSON.parse(fs.readFileSync('.local/atlas-qa/location.json','utf8'));assert.equal(report.coordinateSystem.wkid,104971);assert.equal(report.neighborhoodRadiusMeters,1000);assert.ok(report.samples.center<0);assert.equal(report.samples.count,9);assert.ok(Math.abs(report.myMarsPosition.lon-77.4508)<1e-8);
    await page.getByLabel('화성 경도',{exact:true}).fill('400');await page.getByRole('button',{name:'화성 좌표로 이동',exact:true}).click();await page.getByRole('alert').waitFor();
    await page.getByLabel('화성 경도',{exact:true}).fill('-133.8');await page.getByLabel('화성 위도',{exact:true}).fill('18.65');await page.getByRole('button',{name:'화성 좌표로 이동',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ma-coordinate-value')?.textContent.includes('133.8000'));
    await page.getByRole('button',{name:'Viking 컬러 전역 · 약 231 m',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Viking 컬러 전역 · 약 231 m',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByRole('checkbox',{name:'HiRISE 고해상도 촬영 구역만 · 원본 0.25–1 m'}).uncheck();
    await page.getByRole('button',{name:'지도 조작 도움말',exact:true}).click();await page.getByRole('heading',{name:'자유롭게 탐색하기',exact:true}).waitFor();await page.getByRole('button',{name:'도움말 닫기',exact:true}).click();
    await page.getByRole('button',{name:'데이터 출처·정밀도',exact:true}).click();await page.getByRole('heading',{name:'관측 데이터와 실제 정밀도',exact:true}).waitFor();await page.getByRole('button',{name:'출처 닫기',exact:true}).click();
    for(const width of [1024,768]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`.local/atlas-qa/width-${width}.png`,fullPage:true});}
    const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.goto(base+'/terrain');await mobile.waitForFunction(()=>{const b=document.querySelector('.ma-position-actions button');return b&&!b.disabled;},null,{timeout:60000});assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.waitForFunction(()=>document.querySelector('.ma-connection')?.textContent.includes('표시됨'),null,{timeout:30000});await mobile.screenshot({path:'.local/atlas-qa/mobile.png',fullPage:true});assert.equal(await mobile.locator('.ma-collapsed').count(),1);
    await page.getByRole('button',{name:'주요 지형',exact:true}).click();await page.getByRole('button',{name:'Jezero 수치·단면 분석',exact:false}).click();await page.locator('.tl-scene canvas').waitFor();assert.ok(page.url().endsWith('/terrain/local'));await page.getByRole('link',{name:'Mars Atlas',exact:true}).click();await page.locator('.ma-globe canvas').first().waitFor();
    assert.deepEqual(errors,[]);console.log('PASS: actual global/DEM/NASA image tiles, numeric elevation, free wheel zoom, coordinates, my position/radius/export, layer controls, sources/help, local analysis navigation, four responsive widths. Tiles:',tiles);
    if(process.env.QA_PANORAMA==='1'){
      await page.getByRole('button',{name:'지표 360°',exact:true}).click();await page.locator('.ma-native-panorama canvas').waitFor();await page.locator('.ma-loading').waitFor({state:'hidden',timeout:30000});await page.screenshot({path:'.local/atlas-qa/panorama.png',fullPage:true});await page.getByRole('button',{name:'지표 영상 확대',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ma-pano-fov')?.textContent.includes('58'));await page.locator('.ma-native-panorama').focus();await page.keyboard.press('ArrowRight');
      for(const name of ['Bunsen Peak','Crocodile Bridge','Vingeanne','Marble Mountain']){await page.locator('.ma-panorama-list>button').filter({hasText:name}).click();await page.locator('.ma-loading').waitFor({state:'hidden',timeout:30000});assert.equal(await page.locator('.ma-panorama-error').count(),0);}
      console.log('PASS: five local real Mastcam-Z panoramas, keyboard rotation and FOV zoom.');
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
