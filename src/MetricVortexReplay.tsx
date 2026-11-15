import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ChevronLeft,ChevronRight,Pause,Play,X} from 'lucide-react';
import {predictRanged} from './ranged-tracker-v12';
import type {MotionModel,RangedFix} from './ranged-tracker-v12';
import './metric-vortex-replay.css';
import {AdaptiveTracker,polarCovariance} from './adaptive-tracker-v13';
import {MetricForecastEvidence} from './MetricForecastEvidence';
import type {AdaptiveEvidence} from './MetricForecastEvidence';
type Frame={frame:number;fix:RangedFix;uncertainty:{range95:number[];radius95:number};source:{time:number;sclk:number;id:string;labelUrl:string}};
type Data={frames:Frame[];summaries:{model:string;positionRMSE:number;rangeMAE:number}[];uncertainty:{forecasts:{origin:number;target:number;model:string;range95:number[];radius95:number}[]}};
const number=(v:number|undefined,d=1)=>v===undefined?'—':v.toFixed(d);
const BASE='/data/hazards/metric-v12/';
export default function MetricVortexReplay(){
 const [upgrade,setUpgrade]=useState<AdaptiveEvidence|null>(null);
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[details,setDetails]=useState(false),[enhanced,setEnhanced]=useState(false),[model,setModel]=useState<MotionModel|'ADAPTIVE'>('ADAPTIVE');
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{const c=new AbortController();fetch('/data/hazards/adaptive-v13/ui-summary.json',{signal:c.signal}).then(r=>{if(!r.ok)throw Error('v13 검증 자료를 불러오지 못했습니다.');return r.json();}).then(setUpgrade).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[]);
 useEffect(()=>{const c=new AbortController();fetch(BASE+'ranged-results.json',{signal:c.signal}).then(r=>{if(!r.ok)throw Error('관측 자료를 불러오지 못했습니다.');return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[]);
 useEffect(()=>{if(!playing||!data||index>=3)return;const delay=(data.frames[index+1].fix.time-data.frames[index].fix.time)*500;const t=setTimeout(()=>{setIndex(index+1);if(index===2)setPlaying(false);},delay);return()=>clearTimeout(t);},[playing,data,index]);
 useEffect(()=>{if(!details)return;const before=document.activeElement as HTMLElement|null;panel.current?.querySelector<HTMLButtonElement>('button')?.focus();const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setDetails(false);if(e.key==='Tab'){const items=panel.current?.querySelectorAll<HTMLElement>('button,a[href],select');if(items?.length){const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}};addEventListener('keydown',close);return()=>{removeEventListener('keydown',close);before?.focus();};},[details]);
 const frame=data?.frames[index],history=useMemo(()=>data?.frames.slice(0,index+1).map(f=>f.fix)??[],[data,index]);
 const predictions=useMemo(()=>{
  if(history.length<2||!upgrade)return [];
  const tracker=new AdaptiveTracker(upgrade.selection.config);
  if(model==='ADAPTIVE')for(const f of history){const a=Math.atan2(f.east,f.north);tracker.update({time:f.time,x:f.north,y:f.east,covariance:polarCovariance(f.horizontalRange,a,f.rangeSigma,4/740),systematic:polarCovariance(f.horizontalRange,a,.05*f.horizontalRange,.1*Math.PI/180),crs:f.crs});}
  return [2,5,10].map(lead=>{const time=history.at(-1)!.time+lead;if(model!=='ADAPTIVE')return {...predictRanged(history,time,model),lead,ellipse:null};const p=tracker.predict(time);return {time,north:p.x,east:p.y,speed:Math.hypot(p.vx,p.vy),towardAzimuth:(Math.atan2(p.vy,p.vx)*180/Math.PI+360)%360,lead,ellipse:p.ellipse};});
 },[history,model,upgrade]);
 const step=(n:number)=>{setPlaying(false);setIndex(i=>Math.max(0,Math.min(3,i+n)));};
 if(!frame||!data||!upgrade)return <main className="metric-loading">{error||'Sol 215 관측을 연결하는 중…'}<a href="/hazards">시연으로 돌아가기</a></main>;
 const fix=frame.fix,latest=predictions[0];
 const extents=[{north:0,east:0,margin:0},...history.map(f=>({...f,margin:0})),...predictions.map(f=>({...f,margin:f.ellipse?.major??0}))];
 const minN=Math.min(...extents.map(f=>f.north-f.margin))-10,maxN=Math.max(...extents.map(f=>f.north+f.margin))+10,minE=Math.min(...extents.map(f=>f.east-f.margin))-10,maxE=Math.max(...extents.map(f=>f.east+f.margin))+10;
 const scale=Math.min(280/(maxE-minE),200/(maxN-minN)),mx=(e:number)=>160+(e-(minE+maxE)/2)*scale,my=(n:number)=>125-(n-(minN+maxN)/2)*scale,p=(n:number,e:number)=>`${mx(e)},${my(n)}`;
 return <main className="metric-visor" lang="ko" data-observation-frame={index}>
  <svg className="metric-camera" viewBox="420 0 600 240" preserveAspectRatio="xMidYMid slice" aria-label="2021년 Sol 215 실제 Navcam 관측 영상, 확대 화면">
   <image href={BASE+(enhanced?`change-${index}.png`:`frame-${index}.jpg`)} width="1280" height="240"/>
   <g className="metric-sighting" transform={`translate(${fix.pixel[0]} ${fix.pixel[1]})`}><path d="M-9 -7V-11H-5M5 -11H9V-7M9 7V11H5M-5 11H-9V7"/><circle r="1"/><path d="M-20 0H-13M13 0H20"/></g>
  </svg>
  <div className="metric-tint"/>
  <div className="metric-lens" aria-hidden="true"><i/><b/></div>
  <header className="metric-header"><a href="/hazards" aria-label="3D 대피 시연으로 돌아가기"><ArrowLeft size={14}/> MARS SHIFT</a><span>VISOR / ADAPTIVE TRACK v13</span><small>PERSEVERANCE · SOL 215 · 2021.09.27</small></header>
  <div className="metric-heading"><strong>{number(fix.azimuth,0)}°</strong><span>논문 표식 기준 방위</span><i>▏ · ▏ · ▏ · ▏ · ▏</i></div>
  <div className="metric-status"><i/> 실제 영상 + 논문 거리<small>미터 정확도 미검증</small></div>
  <section className="metric-primary" aria-live="polite"><small>{index?'APPROACH ESTIMATE':'FIRST OBSERVATION'}</small><h1>{number(fix.horizontalRange,0)}<em>m</em></h1><p>논문 기반 수평 거리</p><div className="metric-band">민감도 범위 <b>{number(frame.uncertainty.range95[0],0)}–{number(frame.uncertainty.range95[1],0)} m</b><small>가정한 오차를 전파한 95% 범위</small></div></section>
  <section className="metric-motion"><small>다음 위치 / 계산 모델</small><strong>{latest?number(latest.speed):'—'} <em>m/s</em></strong><span>{latest?`${number(latest.towardAzimuth??undefined,0)}° 방향으로 이동 추정`:'두 번째 관측을 기다립니다'}</span><p>경로 연결 보류<small>실측 정밀도와 지형 좌표계 검증 필요</small></p></section>
  <aside className="metric-map" aria-label="미터 좌표 추정 및 향후 이동"><header><span>LOCAL METRES</span><small>N ↑</small></header><svg viewBox="0 0 320 250" role="img" aria-label="로버 기준 미터 좌표. 점선은 예측이고 반투명 원은 민감도 범위입니다.">
   <defs><pattern id="metricGrid" width={20*scale} height={20*scale} patternUnits="userSpaceOnUse"><path d={`M${20*scale} 0H0V${20*scale}`} fill="none" stroke="#c4eadb" strokeOpacity=".12"/></pattern></defs><rect width="320" height="250" fill="url(#metricGrid)"/>
   <path d={`M${mx(0)-8} ${my(0)}H${mx(0)+8}M${mx(0)} ${my(0)-8}V${my(0)+8}`} stroke="#f8e1b8"/><text x={mx(0)+12} y={my(0)+3}>ROVER</text>
   <polyline points={history.map(f=>p(f.north,f.east)).join(' ')} stroke="#c4f7dd" strokeWidth="2" fill="none"/>
   {history.map((f,i)=><circle key={i} cx={mx(f.east)} cy={my(f.north)} r="3" fill="#d4f9e6"/>)}
   <circle cx={mx(fix.east)} cy={my(fix.north)} r={frame.uncertainty.radius95*scale} fill="#efce8b" fillOpacity=".1" stroke="#f5d39a" strokeDasharray="3 4"/>
   <polyline points={[p(fix.north,fix.east),...predictions.map(f=>p(f.north,f.east))].join(' ')} stroke="#f8d398" strokeDasharray="4 5" fill="none"/>
   {predictions.map(f=><g key={f.lead}>{f.ellipse&&<ellipse cx={mx(f.east)} cy={my(f.north)} rx={f.ellipse.major*scale} ry={f.ellipse.minor*scale} transform={`rotate(${f.ellipse.angle*180/Math.PI-90} ${mx(f.east)} ${my(f.north)})`} stroke="#eac690" strokeOpacity=".4" fill="#edbe76" fillOpacity=".035"/>}<circle cx={mx(f.east)} cy={my(f.north)} r="3" fill="#f8d398"/><text x={mx(f.east)+7} y={my(f.north)+3}>+{f.lead}s</text></g>)}
   <path d={`M15 230H${15+20*scale}M15 226V234M${15+20*scale} 226V234`} stroke="#d6efde"/><text x="17" y="220">20 m</text>
  </svg><p>관측 추정 · 미래 예측 · 오차 가정 타원</p></aside>
  <div className="metric-instruments"><span>VISIBLE DUST<b>{number(fix.visibleDustWidth,0)} m</b><small>가시 먼지 폭 · 와류 직경 아님</small></span><span>SOURCE TIME<b>{number(frame.source.sclk,3)}</b><small>실제 촬영 SCLK</small></span><span>FORECAST<b>2 / 5 / 10 s</b><small>마지막 영상 이후는 정답 없음</small></span></div>
  <nav className="metric-controls" aria-label="관측 재생"><button onClick={()=>step(-1)} disabled={index===0} aria-label="이전 관측"><ChevronLeft/></button><button onClick={()=>{if(index===3)setIndex(0);setPlaying(p=>!p);}} aria-label={playing?'재생 정지':'관측 재생'}>{playing?<Pause/>:<Play/>}</button><button onClick={()=>step(1)} disabled={index===3} aria-label="다음 관측"><ChevronRight/></button><span>{index+1} / 4 · 2×</span><select aria-label="이동 예측 모델" value={model} onChange={e=>setModel(e.target.value as MotionModel|'ADAPTIVE')}><option value="ADAPTIVE">적응형 추적 v13</option><option value="WEIGHTED_CV">오차 가중 속도</option><option value="LAST2">최근 두 관측 속도</option><option value="OLS">선형 추세</option><option value="PERSISTENCE">위치 유지 기준선</option></select><button className="metric-change" onClick={()=>setEnhanced(v=>!v)} aria-pressed={enhanced}>변화 강조</button><button onClick={()=>{setPlaying(false);setDetails(true);}}>검증 결과</button></nav>
  <footer className="metric-footer"><span>RECORDED NAVCAM · AUTHOR WIDTH MARK</span><span>관측 재구성 · 급반전 예측 한계 있음</span></footer>
  {details&&<section ref={panel} className="metric-details" role="dialog" aria-modal="true" aria-label="미터 관측 검증 결과"><header><h2>미터 좌표의 근거</h2><button aria-label="결과 닫기" onClick={()=>setDetails(false)}><X/></button></header><p>NASA PDS 카메라 보정값과 논문의 영상별 근사 거리를 결합했습니다. 1개 사건의 4개 관측에서 앞선 값만으로 다음 관측을 예측했습니다.</p><table><thead><tr><th>모델</th><th>위치 차이 RMSE</th><th>거리 차이 MAE</th></tr></thead><tbody><tr className="metric-candidate-row"><td>ADAPTIVE v13</td><td>{upgrade.observed.positionRMSE.toFixed(2)} m</td><td>{upgrade.observed.rangeMAE.toFixed(2)} m</td></tr>{data.summaries.map(s=><tr key={s.model}><td>{s.model}</td><td>{s.positionRMSE.toFixed(2)} m</td><td>{s.rangeMAE.toFixed(2)} m</td></tr>)}</tbody></table><p>세 예측 쌍은 독립된 세 사건이 아닙니다. 이후의 재구성 좌표·논문 근사 거리와 비교한 차이이며, 실제 중심 위치에 대한 검증된 오차가 아닙니다.</p><p>표시한 범위는 거리·방위 오차 가정에 따른 민감도입니다. 독립 측량, 실제 스테레오 궤적, 거리 센서 검증이 없으므로 실제 XR 경로로 전송하지 않습니다. Sol 215와 기존 Sol 477 지형은 다른 위치입니다.</p><MetricForecastEvidence evidence={upgrade}/><a href={BASE+'report.md'} target="_blank" rel="noreferrer">실험·원자료·한계 전체 기록 ↗</a><a href={frame.source.labelUrl} target="_blank" rel="noreferrer">이 프레임의 NASA 원본 메타데이터 ↗</a><a href="/hazards">기존 3D 대피 시연으로 돌아가기 →</a></section>}
 </main>;
}
