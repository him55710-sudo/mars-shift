import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,ChevronDown,Eye,Layers,Map,Mountain,Pause,Play,Plus,Minus,RotateCcw,Route,X} from 'lucide-react';
import RoverScene from './RoverScene';
import type {RoverManifest} from './RoverScene';
import {roverTerrain,validateRoverGrid} from './rover-navigation';
import type {RoverGrid} from './rover-navigation';
import {VisorCompass,VisorDock,VisorReticle} from './VisorChrome';
import {BrowserXRAdapter} from './hazard-xr';
import {matchingGuidance,pendingGuidance} from './guidance-session-v15';
import type {SessionReply} from './guidance-session-v15';
import type {XRNavigationFrame} from './hazard-xr';
import type {EncounterDecision} from './encounter-v7';
import type {ArmV8,AbruptCase,WindDays} from './encounter-v8';
import type {Point,Settings} from './planner';
import type {ResourceState} from './hazard-planner';
import type {evacuationClock} from './evacuation-clock';
import './rover-explorer.css';
import './evacuation-visor.css';
import release from '../public/data/hazards/adaptive-v13/runtime-release.json';
import {HelmetHUD,ObservedValidationCard} from './EvacuationHelmetHUD';
import './evacuation-helmet-hud.css';
type Snapshot={time:number;position:Point;base:Point;target:Point;initial:Point;frame:XRNavigationFrame;decision:EncounterDecision;resources:ResourceState;settings:Settings;done:boolean;returned:boolean;fixes:number;measured:{exposureSeconds:number};clock:ReturnType<typeof evacuationClock>|null};
type Data={manifest:RoverManifest;grid:RoverGrid;wind:WindDays;case:AbruptCase;sources:{id:string;diameter:number;speed:number}[]};
const NONE:[]=[],MOTION={forward:0,right:0},NOOP=()=>{},fmt=(n:number|null|undefined,d=1)=>n==null||!Number.isFinite(n)?'—':n.toFixed(d);
const ACTIONS:Record<string,string>={HOLD:'Hold position',SIDESTEP:'Move clear',DETOUR:'Follow escape route',RETURN:'Return to start','NO FEASIBLE ROUTE':'No feasible route'};
export default function EvacuationVisor(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();const read=async(path:string)=>{const r=await fetch(path,{signal:controller.signal});if(!r.ok)throw Error(`Surface input unavailable (${r.status})`);return r.json();};
  Promise.all([read('/data/drive1004/manifest.json'),read('/data/drive1004/navigation-grid.json'),read('/data/hazards/vortex-v8/earth-analog-wind.json'),read('/data/hazards/vortex-v8/protocol-confirmation.json')]).then(([manifest,grid,wind,p])=>{
   validateRoverGrid(grid);setData({manifest,grid,wind:wind.days,sources:p.sources,case:{...p.cases[0],id:'navcam-rehearsal',terrain:'navcam',source:'MEDA57a',truth:'gust',family:'gust',heading:.65,bearing:0,distance:32,startOffset:[0,0],speed:.6,cadence:1,dropout:false,birth:10,detectLag:2,reaction:6,evaluationUntil:180,sensorSeed:101015}});
  }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();
 },[]);
 if(!data)return <main className="rover-loading"><h1>{error||'Entering the observed surface'}</h1><p>NASA Navcam geometry, calibrated image tiles and the shared evacuation engine.</p><a href="/hazards?lab=v9">Open scientific comparisons</a></main>;
 return <VisorSession data={data}/>;
}
function VisorSession({data:b}:{data:Data}){
 const [heading,setHeading]=useState(0),[photoSupport,setPhotoSupport]=useState(true);
 const viewChanged=useCallback((_p:Point,_distance:number,yaw:number)=>setHeading((90-yaw*180/Math.PI+360)%360),[]);
 const [c,setCase]=useState(b.case),[arm,setArm]=useState<ArmV8|'Guarded'>(release.guardPromotion?'Guarded':'MARS SHIFT'),[reply,setReply]=useState<SessionReply<Snapshot>|null>(null),[playing,setPlaying]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[status,setStatus]=useState('Loading observed surface…'),[overview,setOverview]=useState(false),[panel,setPanel]=useState<'scenario'|'layers'|'evidence'|null>(null),[layers,setLayers]=useState(true),[rate,setRate]=useState(1),[restart,setRestart]=useState(0),[command,setCommand]=useState({id:0,action:'reset' as 'in'|'out'|'reset'});
 const session=useMemo(()=>JSON.stringify({c,arm,restart}),[c,arm,restart]);
 const snapshot=matchingGuidance(reply,session),previousFrame=useRef<XRNavigationFrame|null>(null);
 const terrain=useMemo(()=>roverTerrain(b.grid,[]),[b.grid]);
 const manifest=useMemo(()=>({...b.manifest,assets:b.manifest.calibratedAssets??b.manifest.detailAssets??b.manifest.assets}),[b.manifest]);
 const source=b.sources.find(s=>s.id===c.source)!;
 const worker=useRef<Worker|null>(null),pending=useRef(false),id=useRef(0),panelRef=useRef<HTMLElement>(null);
 const adapter=useMemo(()=>new BrowserXRAdapter(window),[]);
 useEffect(()=>{const w=new Worker(new URL('./evacuation-worker-v13.ts',import.meta.url),{type:'module'});worker.current=w;pending.current=true;setBusy(true);setPlaying(false);setReply(null);setError('');
  w.onmessage=({data})=>{if(data.id!==id.current)return;pending.current=false;setBusy(false);if(data.error){setReply(null);setError(data.error);setPlaying(false);}else{setReply({session,value:data.snapshot});if(data.snapshot.done)setPlaying(false);}};
  w.onerror=()=>{setReply(null);setError('The planner stopped. Reset the rehearsal.');setPlaying(false);setBusy(false);pending.current=false;};
  w.postMessage({id:++id.current,type:'init',grid:b.grid,case:c,source,wind:b.wind,arm});return()=>{w.terminate();worker.current=null;};
 },[b.grid,b.wind,c,source,arm,restart,session]);
 const step=()=>{if(worker.current&&!pending.current&&!snapshot?.done){pending.current=true;setBusy(true);worker.current.postMessage({id:++id.current,type:'step'});}};
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>{if(worker.current&&!pending.current){pending.current=true;setBusy(true);worker.current.postMessage({id:++id.current,type:'step'});}},2000/rate);return()=>clearInterval(timer);},[playing,rate]);
 useEffect(()=>{if(snapshot){previousFrame.current=snapshot.frame;adapter.publish({...snapshot.frame,session} as XRNavigationFrame);}else if(previousFrame.current)adapter.publish(pendingGuidance(previousFrame.current,session,error||undefined));},[snapshot,session,adapter,error]);
 useEffect(()=>()=>adapter.close(),[adapter]);
 useEffect(()=>{if(!panel)return;setPlaying(false);const before=document.activeElement as HTMLElement|null;panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setPanel(null);};addEventListener('keydown',key);return()=>{removeEventListener('keydown',key);if(before?.isConnected)before.focus();};},[panel]);
 const frame=snapshot?.frame,cell=b.grid.cellSize;
 const next=frame?.route.find(p=>snapshot&&Math.hypot(p.x-snapshot.position.x*cell,p.y-snapshot.position.y*cell)>1);
 const distance=next&&snapshot?Math.hypot(next.x-snapshot.position.x*cell,next.y-snapshot.position.y*cell):null;
 const waypointBearing=next&&snapshot?Math.atan2(next.y-snapshot.position.y*cell,next.x-snapshot.position.x*cell)*180/Math.PI:heading;
 const relativeBearing=((waypointBearing-heading+540)%360)-180;
 const displayFrame=useMemo(()=>frame&&!layers?{...frame,forecast:[]}:frame,[frame,layers]);
 const coverage=useMemo(()=>{let d='';for(let i=0;i<b.grid.elevation.length;i++)if(b.grid.elevation[i]!==null)d+=`M${i%b.grid.width} ${Math.floor(i/b.grid.width)}h1v1h-1z`;return d;},[b.grid]);
 const action=snapshot?.done?(snapshot.returned?'Return complete':'Return incomplete'):snapshot?.decision.action??'HOLD';
 const ready=status==='Observed rover surface ready',contactPredicted=(snapshot?.clock?.predictedContactSeconds??0)>1e-8;
 const change=(v:Partial<AbruptCase>)=>setCase(c=>({...c,...v}));
 return <main className={`rover-explorer evacuation-visor ${overview?'evacuation-overview':''}`} data-frame-revision={frame?.revision??0} data-source="NASA-M20-drive-1004" lang="en">
  {snapshot&&<RoverScene photoSupport={photoSupport} manifest={manifest} grid={b.grid} terrain={terrain} settings={snapshot.settings} crew={snapshot.position} target={snapshot.decision.action==='RETURN'||snapshot.returned?snapshot.base:snapshot.target} route={null} alternatives={NONE} obstacles={NONE} hazards={false} overview={overview} thirdPerson={false} pickMode={null} paused controlled hazardRouteStyle="ribbon" command={command} motion={MOTION} onMove={viewChanged} onPick={NOOP} onStatus={setStatus} hazardFrame={displayFrame}/>}
  <div className="evacuation-shade"/><HelmetHUD resources={snapshot?.resources} sigma={frame?.localizationSigma??c.positionSigma} fixes={snapshot?.fixes??0} overview={overview}/>
  <header className="evacuation-top"><div><strong>MARS SHIFT</strong><small>FIRST-PERSON EVA · NASA SURFACE</small></div><button onClick={()=>setPanel('evidence')}>Jezero · Sol 477 <ChevronDown size={15}/><small>Perseverance / Drive 1004</small></button></header>
  <a className="sand14-entry" href="/review">Evidence & demo ↗</a><VisorCompass heading={heading}/><VisorReticle/>
  <button className="evacuation-views" onClick={()=>setPanel('scenario')}>Rehearsal <ChevronDown size={14}/></button>
  <section className={`evacuation-action ${contactPredicted?'evacuation-caution':''}`} aria-live="polite"><small><i/> {contactPredicted?'CONTACT PREDICTED':snapshot?.fixes?'NEXT MODELED ACTION':'WAITING FOR DETECTION'}</small><h1>{ACTIONS[action]??action}</h1><p>{snapshot?.clock?.predictedContactSeconds?`Predicted contact ${fmt(snapshot.clock.predictedContactSeconds)} s · minimizing exposure`:snapshot?.fixes?'Replans with each delivered observation':'A synthetic dust devil appears at T+10 s'}</p><button onClick={()=>setPanel('scenario')}><i/> {arm==='Guarded'?'Dual-model escape':arm==='MARS SHIFT'?'Legacy adaptive escape':arm} <ChevronDown size={14}/></button></section>
  {!overview&&next&&!snapshot?.done&&action!=='HOLD'&&action!=='NO FEASIBLE ROUTE'&&<div className="evacuation-waypoint"><svg className="eva11-direction" viewBox="-20 -20 40 40" style={{transform:`rotate(${relativeBearing}deg)`}} aria-label={`Waypoint bearing ${Math.round(relativeBearing)} degrees relative to view`}><path d="M0 -15L10 9L0 4L-10 9Z"/></svg><div><small>NEXT WAYPOINT</small><strong>{fmt(distance)} <span>m</span></strong></div></div>}
  <div className="evacuation-play"><button aria-label={playing?'Pause rehearsal':'Run rehearsal'} onClick={()=>setPlaying(p=>!p)} disabled={!ready||!snapshot||snapshot.done||!!error}>{playing?<Pause size={21}/>:<Play size={21}/>}</button><button onClick={step} disabled={!ready||busy||playing||!snapshot||snapshot.done}>+2 s</button><button aria-label="Reset rehearsal" onClick={()=>setRestart(n=>n+1)}><RotateCcw size={18}/></button></div>
  <div className="evacuation-zoom"><button aria-label="Zoom in" onClick={()=>setCommand(p=>({id:p.id+1,action:'in'}))}><Plus/></button><button aria-label="Zoom out" onClick={()=>setCommand(p=>({id:p.id+1,action:'out'}))}><Minus/></button></div>
  <button className="evacuation-map" aria-label={overview?'Return to helmet':'Open route overview'} onClick={()=>setOverview(v=>!v)}>
   <svg viewBox={`0 0 ${b.grid.width} ${b.grid.height}`} role="img" aria-label="Observed coverage and shared escape route"><rect width={b.grid.width} height={b.grid.height} fill="#101c20"/><path d={coverage} fill="#987462"/>{layers&&frame?.forecast.filter(p=>p.valid).map((p,i)=><circle key={i} cx={p.x/cell} cy={p.y/cell} r={p.envelope/cell} fill="none" stroke="#ffc58f" strokeWidth="1" opacity={.8-i*.07}/>)}<polyline points={frame?.route.map(p=>`${p.x/cell},${p.y/cell}`).join(' ')} fill="none" stroke="#b7ffe2" strokeWidth="1.5"/>{snapshot&&<><circle cx={snapshot.base.x} cy={snapshot.base.y} r="2" fill="white"/><circle cx={snapshot.position.x} cy={snapshot.position.y} r="2" fill="#b7ffe2"/></>}</svg>
   <span><Map size={13}/>{overview?'Return to ground':'Observed coverage'}<ArrowUpRight size={13}/></span>
  </button>
  <div className="evacuation-metrics"><div><small>BOUNDARY ARRIVAL</small><strong>{snapshot?.fixes?(snapshot.clock?.boundaryEntrySeconds==null?`> ${fmt(snapshot.clock?.horizonSeconds,0)} s`:`${fmt(snapshot.clock.boundaryEntrySeconds)} s`):'Acquiring'}</strong></div><div><small>RETURN MARGIN</small><strong>{fmt(snapshot?.decision.returnMargin,0)} s</strong></div><div><small>MODEL TIME</small><strong>{snapshot?.time??0} s</strong></div></div>
  <VisorDock label="Evacuation views"><button onClick={()=>{location.href='/explore';}}><Mountain/><span>Terrain</span></button><button aria-pressed={!overview} onClick={()=>{setOverview(false);setPanel(null);}}><Eye/><span>Visor</span></button><button aria-pressed={overview} onClick={()=>{setOverview(true);setPanel(null);}}><Route/><span>Route</span></button><button aria-expanded={panel==='layers'} onClick={()=>setPanel(panel==='layers'?null:'layers')}><Layers/><span>Layers</span></button></VisorDock>
  <div className="evacuation-foot"><span>{photoSupport?'PHOTO CONTEXT · INTERPOLATED GAPS NOT WALKABLE':'ORIGINAL STEREO · SIMULATED VORTEX'}</span><button onClick={()=>setPanel('evidence')}>Evidence & limits</button><span>Frame {frame?.revision??0}{busy?' · updating':''}</span></div>
  {(!snapshot||error)&&<div className="evacuation-loading" role="status">{error||'Building the observed surface and return graph…'}</div>}
  {panel&&<aside className="evacuation-panel" ref={panelRef} aria-label={`${panel} panel`}><header><div><small>MARS SHIFT / RESEARCH REHEARSAL</small><h2>{panel==='scenario'?'Encounter settings':panel==='layers'?'Surface & prediction':'Evidence and limits'}</h2></div><button aria-label="Close panel" onClick={()=>setPanel(null)}><X/></button></header>
   {panel==='scenario'&&<><p>Changing a condition starts a new rehearsal. This view uses the same metric path for the helmet and map.</p><label>Vortex reference<select value={c.source} onChange={e=>change({source:e.target.value})}>{b.sources.map(s=><option key={s.id} value={s.id}>{s.diameter} m / {fmt(s.speed,2)} m/s</option>)}</select></label><label>Initial centre distance<select value={c.distance} onChange={e=>change({distance:+e.target.value})}>{[15,32,60,100].map(v=><option key={v} value={v}>{v} m</option>)}</select></label><label>Approach position<select value={c.bearing} onChange={e=>change({bearing:+e.target.value})}><option value={0}>Ahead</option><option value={.4}>Right of track</option><option value={-.4}>Left of track</option><option value={Math.PI}>Moving away</option></select></label><label>Vortex motion<select value={c.truth} onChange={e=>change({truth:e.target.value})}><option value="gust">Synthetic turn and acceleration</option><option value="wind">Earth wind driven synthetic motion</option><option value="linear">Constant translation</option><option value="oscillate">Synthetic meander</option></select></label><label>Walking setting<select value={c.speed} onChange={e=>change({speed:+e.target.value})}>{[.4,.6,.9].map(v=><option key={v} value={v}>{v} m/s</option>)}</select></label><label>Reaction delay<select value={c.reaction} onChange={e=>change({reaction:+e.target.value})}>{[2,6,10].map(v=><option key={v} value={v}>{v} s</option>)}</select></label><label>Policy<select value={arm} onChange={e=>setArm(e.target.value as ArmV8|'Guarded')}>{['Static','Nominal','MARS SHIFT','Guarded','Oracle'].map(a=><option key={a}>{a}</option>)}</select></label><label>Playback rate<select value={rate} onChange={e=>setRate(+e.target.value)}>{[1,4,16].map(v=><option key={v} value={v}>{v}×</option>)}</select></label><p>{source.diameter} m is a reference diameter. Position, onset and changes are synthetic; they are not a recorded event at this rover site.</p></>}
   {panel==='layers'&&<><button aria-pressed={photoSupport} onClick={()=>setPhotoSupport(v=>!v)}>{photoSupport?'Show original stereo gaps':'Enable continuous photo context'}</button><p>Photo context fills small stereo gaps for display using nearby height interpolation and the original NASA photographs. Its depth is unverified; walking and routing still exclude missing support.</p><button aria-pressed={layers} onClick={()=>setLayers(v=>!v)}>{layers?'Hide':'Show'} predicted boundary and motion</button><p>Native NASA mesh with calibrated Navcam photo tiles. The route is a narrow surface ribbon; it does not replace the underlying geometry.</p><p>Amber rings show a model sensitivity envelope, not a calibrated probability contour. Missing mesh areas remain unknown and cannot be traversed.</p><p>{status}</p></>}
   {panel==='evidence'&&<><p>NASA/JPL-Caltech · Perseverance Sol 477. Fine mesh and image pixels are observed; the vortex and astronaut motion are a simulation.</p><dl><dt>Position assumption</dt><dd>Virtual metric sensor · σ 0.75 m</dd><dt>Observation delay</dt><dd>1 s processing + 2 s control cycle</dd><dt>Reaction</dt><dd>{c.reaction} s after delivered detection</dd><dt>Forecast horizon</dt><dd>{fmt(snapshot?.clock?.horizonSeconds??48,0)} s · limited by return resources</dd><dt>Measured contact in rehearsal</dt><dd>{fmt(snapshot?.measured.exposureSeconds,2)} s</dd><dt>Return point</dt><dd>Unprotected location, not a validated refuge</dd></dl><p>Walking follows observed support and terrain costs. No validated local CFD steers the vortex around rocks. Helmet/map integration is not operational safety validation.</p><p>v13 dual-model guard adopts an alternate path only when neither forecast increases nominal or expanded predicted contact. In 36 new synthetic cases, exposure changed from 2.482 to 2.480 s; the gain is small. Same-case static exposure was 2.761 s. Return failures were zero for all arms. This is not a guarantee about the unknown true path.</p><a href="/data/hazards/adaptive-v13/report.md" target="_blank" rel="noreferrer">v13 prediction, routing and failures ↗</a><ObservedValidationCard/><a href="/data/hazards/vortex-v10/process-review.md" target="_blank" rel="noreferrer">Fire, tsunami and hurricane research audit ↗</a><a href="/hazards?lab=v9">Open frozen DEM comparison lab ↗</a><a href="/hazards?archive=1">Earlier observations and experiments ↗</a></>}
  </aside>}
 </main>;
}
