import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,ChevronRight,Layers,Map,Navigation,RotateCcw,X} from 'lucide-react';
import TerrainScene,{useSurfaceTexture} from './TerrainScene';
import type {SceneRoute} from './TerrainScene';
import {DEFAULTS,nearestAllowed,point} from './planner';
import type {Terrain,Point,Settings,Mode} from './planner';
import {validateNoah} from './noah-data';
import {validateScience} from './science-data';
import {useNativeDEM} from './use-native-dem';
import {mapSandTraps,nearbySand,routeHeading,sandTerrain} from './sand-traps-v14';
import type {SandMap} from './sand-traps-v14';
import type {SearchReport} from './constrained-planner';
import {sandLayerCanvas,sandGroundPixels} from './sand-display-v14';
import {edgeTravelMinutes} from './mobility';
import {sandXRFrame} from './sand-xr-v14';
import {remainingSandSettings} from './sand-session-v14';
import {BrowserXRAdapter} from './hazard-xr';
import {VisorCompass} from './VisorChrome';
import './sand-trap-v14.css';
import './local-surface-map.css';
import SandBenchmarkEvidence from './SandBenchmarkEvidence';
import {sandLanguage,sandText} from './sand-language-v15';
import type {SandLanguage} from './sand-language-v15';

type Result={id:number;inputKey:string;map:SandMap;baseline:SearchReport;screened:SearchReport;audit:{core:number;buffer:number;unknown:number}|null;baselineAudit:{core:number;buffer:number;unknown:number}|null;milliseconds:number;error?:string};
const NONE:[]=[],MOTION={forward:0,right:0},NOOP=()=>{},fmt=(v:number|null|undefined,d=0)=>v==null?'—':v.toFixed(d);
export default function SandTrapVisor(){
 const [language,setLanguage]=useState(()=>sandLanguage(location.search));
 const tx=(value:string)=>sandText(language,value);
 const changeLanguage=(value:SandLanguage)=>{setLanguage(value);const url=new URL(location.href);url.searchParams.set('lang',value);history.replaceState(history.state,'',url);};
 const [terrain,setTerrain]=useState<Terrain|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController(),read=async(p:string)=>{const r=await fetch('/data/noah/'+p,{signal:controller.signal});if(!r.ok)throw Error('모래 지형 자료를 불러오지 못했습니다.');return r.json();};
  Promise.all([read('terrain.json'),read('noah-terrain.json'),read('science/terrain-metrics.json')]).then(([t,n,science])=>setTerrain({...t,assetRoot:'/data/noah',noah:validateNoah(t,n),science:validateScience(t,science)})).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();
 },[]);
 if(!terrain)return <main className="sand14-loading"><h1>{tx(error||'관측된 모래 지형을 분석하는 중')}</h1><p>{tx('HiRISE 지형 · NOAH-H 분류 · 같은 좌표계의 왕복 경로')}</p><a href="/hazards">{tx('먼지악마 시연으로')}</a></main>;
 return <SandSession terrain={terrain} language={language} onLanguage={changeLanguage}/>;
}
function SandSession({terrain:t,language,onLanguage}:{terrain:Terrain;language:SandLanguage;onLanguage:(v:SandLanguage)=>void}){
 const tx=(value:string)=>sandText(language,value);
 const initial=useMemo(()=>{const screened=sandTerrain(t,mapSandTraps(t));return {base:nearestAllowed(screened,{x:32,y:168},DEFAULTS),target:nearestAllowed(screened,{x:153,y:43},DEFAULTS)};},[t]);
 const [crew,setCrew]=useState(initial.base),[target,setTarget]=useState(initial.target),[spent,setSpent]=useState(0),[budget,setBudget]=useState(110),[buffer,setBuffer]=useState(5),[mode,setMode]=useState<Mode>('shortest'),[overview,setOverview]=useState(false),[layers,setLayers]=useState(true),[panel,setPanel]=useState(false),[compare,setCompare]=useState(false),[heading,setHeading]=useState(0),[reply,setResult]=useState<Result|null>(null),[workerBusy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0),[command,setCommand]=useState({id:0,type:'reset' as 'reset'|'left'|'right'|'in'|'out'});
 const worker=useRef<Worker|null>(null),request=useRef(0),dialog=useRef<HTMLElement>(null);
 const settings=useMemo<Settings>(()=>remainingSandSettings(spent,budget,target.x===initial.base.x&&target.y===initial.base.y),[budget,spent,target,initial]);
 const inputKey=useMemo(()=>JSON.stringify({crew,target,settings,buffer,mode}),[crew,target,settings,buffer,mode]);
 const result=reply?.inputKey===inputKey?reply:null,busy=workerBusy||(!result&&!error);
 useEffect(()=>{const w=new Worker(new URL('./sand-worker-v14.ts',import.meta.url),{type:'module'});worker.current=w;w.onmessage=({data})=>{if(data.id!==request.current)return;setBusy(false);if(data.error){setError(data.error);setResult(null);}else{setError('');setResult(data);setRevision(v=>v+1);}};w.onerror=()=>{setError('경로 계산이 중단됐습니다. 다시 계산해주세요.');setBusy(false);setResult(null);};return()=>{w.terminate();worker.current=null;};},[]);
 useEffect(()=>{setBusy(true);setResult(null);worker.current?.postMessage({id:++request.current,inputKey,terrain:t,base:crew,returnBase:initial.base,target,settings,buffer,mode,excludeUnknown:true});},[t,crew,target,settings,buffer,mode,initial,inputKey]);
 useEffect(()=>{if(!panel)return;const before=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setPanel(false);if(e.key==='Tab'){const a=dialog.current?.querySelectorAll<HTMLElement>('button,select,input,a[href]');if(a?.length){if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a[a.length-1].focus();}else if(!e.shiftKey&&document.activeElement===a[a.length-1]){e.preventDefault();a[0].focus();}}}};addEventListener('keydown',key);return()=>{removeEventListener('keydown',key);before?.focus();};},[panel]);
 const map=useMemo(()=>result?.map??mapSandTraps(t,buffer),[result,t,buffer]);
 const prepared=useMemo(()=>sandTerrain(t,map),[t,map]),{native}=useNativeDEM(t),{surface:texture}=useSurfaceTexture(t,'optical',0,true);
 const groundPixels=useMemo(()=>sandGroundPixels(map),[map]);
 const overlay=useMemo(()=>sandLayerCanvas(t,map),[t,map]),overlayUrl=useMemo(()=>overlay.toDataURL(),[overlay]);
 const surface=useMemo(()=>{if(!texture)return null;const canvas=document.createElement('canvas');canvas.width=texture.width;canvas.height=texture.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(texture,0,0);if(layers){ctx.imageSmoothingEnabled=false;ctx.drawImage(overlay,0,0,canvas.width,canvas.height);}return canvas;},[texture,overlay,layers]);
 const route=busy?null:result?.screened.route??null,baseline=result?.baseline.route??null;
 const bearing=routeHeading(t,route,0),near=nearbySand(t,map,crew,heading),yaw=-bearing*Math.PI/180;
 const viewPoint=useMemo(()=>({...crew}),[crew,bearing]);
 const [map2d,setMap2d]=useState(false);
 const routes=useMemo<SceneRoute[]>(()=>route?[{mode,outbound:route.outbound,inbound:route.inbound,color:'#b5f5d5',active:true}]:[],[route,mode]);
 const onMove=useCallback((_p:Point,_d:number,_r:string,yaw:number)=>setHeading((-yaw*180/Math.PI+360)%360),[]);
 const mapBox=overview?`0 0 ${t.width} ${t.height}`:`${Math.max(0,Math.min(t.width-40,crew.x-20))} ${Math.max(0,Math.min(t.height-40,crew.y-20))} 40 40`;
 const path=(cells:readonly number[])=>cells.map(i=>`${i%t.width+.5},${Math.floor(i/t.width)+.5}`).join(' ');
 const advance=(approach=false)=>{if(!route||route.outbound.length<2)return;const approaching=approach?route.outbound.findIndex((i,k)=>k>2&&(nearbySand(t,map,point(t,i)).distance??Infinity)<=20):-1;const next=approaching>0?approaching:Math.min(2,route.outbound.length-1);let elapsed=0;for(let i=1;i<=next;i++)elapsed+=edgeTravelMinutes(prepared,route.outbound[i-1],route.outbound[i],settings);setSpent(v=>v+elapsed);setCrew(point(t,route.outbound[next]));setNotice('현재 위치와 남은 자원으로 왕복 경로를 다시 계산했습니다.');};
 const reset=()=>{setCrew(initial.base);setTarget(initial.target);setSpent(0);setBudget(110);setNotice('초기 임무로 돌아왔습니다.');};
 const choose=(p:Point)=>{setTarget(p);setNotice('선택한 목적지까지 다시 계산합니다. 제외 구역이면 경로를 제공하지 않습니다.');};
 useEffect(()=>{const adapter=new BrowserXRAdapter(window);adapter.publish(sandXRFrame(t,map,crew,route,settings,revision,spent*60));return()=>adapter.close();},[route,revision,spent,t,crew,settings,map]);
 const safeToGuide=!!route&&!busy,status=busy?'경로 재계산 중':error?'계산 오류':!route?'이동 보류 · 가능한 왕복 경로 없음':near.unknown?'지반 정보 확인 필요':near.inside?'위험 후보 구역 안쪽':near.distance!==null&&near.distance<=25?'모래 트랩 후보 근접':'모래 후보 구역 우회';
 return <main className={`sand14-visor ${overview?'is-map':''}`} lang={language} data-revision={revision} data-route-buffer-crossings={result?.audit?.buffer??'unavailable'}>
  <TerrainScene terrain={t} surface={surface} layer="optical" exaggeration={1} contourInterval={10} showContours={false} showGrid={false} route={route?.outbound??NONE} routes={routes} selected={crew} profile={NONE} profileMode={false} view={map2d?'2d':'3d'} mode={overview?'orbit':'eva'} cameraAction={command} onPick={overview?choose:NOOP} onUnavailable={()=>setError('3D 화면을 사용할 수 없습니다. 지도에서 경로를 확인해주세요.')} native={native} crew={crew} base={initial.base} target={target} settings={settings} showHazards={layers} groundHazards={groundPixels} surfaceDetail quality="detail" movementAllowed={false} worldAnchors={true} walkTarget={viewPoint} walkHeading={yaw} walkPitch={-.12} motion={MOTION} onMove={onMove}/>
  <div className="rover-view-toggle sand14-view-toggle" role="group" aria-label="Sand dimension"><button aria-pressed={map2d} onClick={()=>{setMap2d(true);setOverview(true);}}>2D</button><button aria-pressed={!map2d} onClick={()=>{setMap2d(false);setOverview(true);}}>3D</button></div><div className="sand14-rim"/><header className="sand14-top"><a href="/hazards"><ArrowLeft size={16}/> MARS SHIFT</a><span>GROUND / SAND TRAP SCREENING<small>{tx('Jezero · NOAH-H 관측 분류 구역')}</small></span><div className="sand15-header-actions"><a href="/hazards?ground=training">Sand escape ↗</a><button aria-label="Interface language" onClick={()=>onLanguage(language==='en'?'ko':'en')}>{language==='en'?'한국어':'English'}</button><button onClick={()=>setPanel(true)}><Layers size={16}/>{tx('분석·조건')}</button></div></header>
  {!overview&&<VisorCompass heading={heading}/>}
  <section className="sand14-command" aria-live="polite"><small>{tx('지반 위험 후보 · 침하 확률 아님')}</small><h1>{tx(status)}</h1><p>{near.distance!==null?`${tx(near.side)} · ${tx('완충 구역 경계까지')} ${Math.floor(near.distance)} m`:tx('근처에 분류된 모래 후보 없음')}</p><span>{buffer} m {tx('추가 여유 · 분류가 없는 지점은 경로에서 제외')}</span>{!route&&!busy&&<p role="alert">{tx(error||result?.screened.reason||'')}</p>}</section>
  {!overview&&safeToGuide&&route.outbound.length>1&&<div className="sand14-waypoint"><Navigation style={{transform:`rotate(${(bearing-heading+540)%360-180}deg)`}}/><span>{tx('다음 경로 지점')}<strong>{fmt(Math.hypot(point(t,route.outbound[1]).x-crew.x,point(t,route.outbound[1]).y-crew.y)*t.cellSize,1)} m</strong></span></div>}
  <div className="sand14-actions"><button onClick={()=>advance()} disabled={!safeToGuide||route!.outbound.length<2}>{tx('경로 따라 전진')}<ChevronRight size={16}/></button><button onClick={()=>{setTarget(initial.base);setNotice('출발 지점으로 복귀 경로를 계산합니다.');}} disabled={busy}>{tx('복귀')}</button><button aria-label={tx('임무 초기화')} onClick={reset}><RotateCcw size={16}/></button></div>
  <aside className={`sand14-map ${overview?'expanded':'mini'}`}><header><b>{tx(overview?'모래 후보와 왕복 경로':'주변 200 m')}</b><span>N ↑</span></header><svg viewBox={mapBox} role="img" aria-label={tx('관측 모래 후보, 완충 구역, 왕복 경로 지도')} onClick={e=>{if(!overview)return;const m=e.currentTarget.getScreenCTM();if(!m)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());if(p.x>=0&&p.y>=0&&p.x<t.width&&p.y<t.height)choose({x:Math.floor(p.x),y:Math.floor(p.y)});}}><image href="/data/noah/optical.webp" width={t.width} height={t.height}/>{layers&&<image href={overlayUrl} width={t.width} height={t.height}/>} {compare&&baseline&&<polyline points={path(baseline.outbound)} className="baseline"/>}{route&&<><polyline points={path(route.outbound)} className="route-shadow"/><polyline points={path(route.outbound)} className="outbound"/><polyline points={path(route.inbound)} className="inbound"/></>}{[{p:crew,label:'YOU'},{p:target,label:'B'},{p:initial.base,label:'A'}].map(({p,label})=><g key={label}><circle cx={p.x+.5} cy={p.y+.5} r={label==='YOU'?2.3:1.5} fill={label==='YOU'?'#c5ffe6':'#fff'} stroke="#132623" strokeWidth=".7"/><text x={Math.min(185,p.x+4)} y={p.y+1}>{label}</text></g>)}</svg><p>{tx('주황: 후보 · 옅은 경계: 완충 · 민트: 우회')}</p>{overview&&<small>{tx('지도에서 목적지를 선택하면 현재 위치에서 재계산합니다.')}</small>}</aside>
  <div className="sand14-stats"><span>{tx('왕복 거리')}<b>{fmt(route?.distance)} m</b></span><span>{tx('예상 소요')}<b>{fmt(route?.totalMinutes,1)} min</b></span><span>{tx('귀환 후 자원 여유')}<b>{fmt(route?.reserve,1)}%</b></span><span>{tx('제외 구역 통과')}<b>{result?.audit?.buffer??'—'}</b></span></div>
  <nav className="sand14-dock" aria-label={tx('보기')}><button aria-pressed={!overview} onClick={()=>setOverview(false)}><Navigation size={17}/>{tx('헬멧')}</button><button aria-pressed={overview} onClick={()=>setOverview(true)}><Map size={17}/>{tx('위험 지도')}</button><button aria-pressed={layers} onClick={()=>setLayers(v=>!v)}><Layers size={17}/>{tx('위험 표시')}</button></nav>
  <footer className="sand14-foot"><span>{tx('실제 관측 분류 · 모의 우주비행사 위치 · 5 m 계획 격자')}</span><span role="status">{notice?tx(notice):`${tx('분류')} ${fmt(map.knownCount/map.core.length*100,1)}% · ${tx('계산')} ${fmt(result?.milliseconds)} ms`}</span></footer>
  {panel&&<section ref={dialog} className="sand14-panel" role="dialog" aria-modal="true" aria-label={tx('모래 위험 분석 조건')}><header><h2>{tx('모래 후보와 경로 조건')}</h2><button aria-label={tx('분석 닫기')} onClick={()=>setPanel(false)}><X/></button></header><p>{tx('NOAH-H가 분류한 모래 물결 지형을 후보로 표시합니다. 지반 지지력이나 실제 침하를 검출한 결과는 아닙니다.')}</p><label>{tx('후보 주변 추가 여유')}<select value={buffer} onChange={e=>setBuffer(+e.target.value)}>{[0,5,10,20].map(v=><option key={v} value={v}>{v} m</option>)}</select></label><label>{tx('경로 목적')}<select value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="shortest">{tx('제외 조건 내 짧은 왕복 경로')}</option><option value="time">{tx('이동 시간')}</option><option value="exposure">{tx('경사·지형 노출')}</option></select></label><label>{tx('임무 시간 예산')}<select value={budget} onChange={e=>setBudget(+e.target.value)}>{[20,60,110,150].map(v=><option key={v} value={v}>{v} min</option>)}</select></label><button onClick={()=>{advance(true);setPanel(false);}} disabled={!safeToGuide}>{tx('다음 위험 후보 근처까지 경로 재생')}</button><label className="check"><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>{tx('모래 제외 전 경로 비교')}</label><dl><dt>{tx('같은 조건의 기존 경로')}</dt><dd>{fmt(baseline?.distance)} m · {tx('완충 구역')} {result?.baselineAudit?.buffer??'—'} {tx('칸 통과')}</dd><dt>{tx('모래 후보를 제외한 경로')}</dt><dd>{fmt(route?.distance)} m · {tx('완충 구역')} {result?.audit?.buffer??'—'} {tx('칸 통과')}</dd><dt>{tx('관측 / 분석 해상도')}</dt><dd>{tx('NOAH-H 0.25 m 입력 · 5 m 계획 격자 · THEMIS 약 100 m')}</dd></dl><p>{tx('분류 피복 ≥95%, 모래 물결 면적 ≥25%인 셀을 후보로 삼는 보수적 규칙입니다. 여유 반경은 셀 전체 크기까지 고려해 바깥쪽으로 확장합니다. 위치 정합 잔차와 지반 강도는 미확인입니다.')}</p><p>{tx('THEMIS는 지역적 열관성 참고값입니다. 이곳의 작은 모래 트랩을 확정하는 센서로 쓰지 않습니다. Sol 477 로버 사진 지형은 이 궤도 관측 구역과 좌표가 연결되지 않아 자동 분류를 투영하지 않습니다.')}</p><a href="/data/hazards/sand-v14/report.md" target="_blank" rel="noreferrer">{tx('구현·실험·한계 기록')}<ArrowUpRight size={13}/></a><a href={t.noah!.source.doi.startsWith('http')?t.noah!.source.doi:'https://doi.org/'+t.noah!.source.doi} target="_blank" rel="noreferrer">{tx('NOAH-H 원자료')}</a><SandBenchmarkEvidence/></section>}
 </main>;
}
