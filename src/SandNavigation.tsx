import {useMemo,useState} from 'react';
import {ArrowRight,ArrowDownToLine,ArrowUpRight,Crosshair,Navigation,RotateCcw,ShieldCheck,TriangleAlert} from 'lucide-react';
import type {Point,Terrain} from './planner';
import {blocked,index} from './planner';
import {withObstacles} from './obstacles';
import {useMission} from './use-mission';
import {REGIONS} from './regions';
import {ROUTE_OPTIONS} from './mission-map-model';
import {SAND_POLICY,sandRouteAudit,sandScreen} from './sand-screening';
import {sandOverlay} from './sand-overlay';
import './sand-navigation.css';

type Props={terrain:Terrain|null;error:string;region:string;onRegion:(id:string)=>void;onPlanning:()=>void;onSurface:()=>void};
const fmt=(n:number,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
export default function SandNavigation(p:Props){
 return <section className="sand-navigation" aria-labelledby="sand-title" id="sand-navigation">
  <div className="sand-heading"><div><span className="hub-eyebrow">TERRAIN / ROUTE SCREENING</span><h2 id="sand-title">Route around sand candidates.</h2><p>Published surface textures, with the way out and back in view.</p></div><label>Study region<select value={p.region} onChange={e=>p.onRegion(e.target.value)}>{REGIONS.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
  {p.error?<div className="sand-loading" role="alert"><TriangleAlert/>{p.error}<button onClick={()=>location.reload()}>Retry loading</button></div>:p.terrain&&(p.terrain.assetRoot??'/data')===REGIONS.find(r=>r.id===p.region)?.root?<SandMission terrain={p.terrain} onPlanning={p.onPlanning} onSurface={p.onSurface}/>:<div className="sand-loading" role="status">Loading registered terrain and surface classification…</div>}
 </section>;
}
function SandMission({terrain:t,onPlanning,onSurface}:{terrain:Terrain;onPlanning:()=>void;onSurface:()=>void}){
 const {state,store,dirty}=useMission(t),d=state.draft;
 const [showBaseline,setShowBaseline]=useState(false),[showSand,setShowSand]=useState(true),[placing,setPlacing]=useState(false),[notice,setNotice]=useState('');
 const screen=useMemo(()=>sandScreen(t),[t]),overlay=useMemo(()=>sandOverlay(t),[t]),prepared=useMemo(()=>withObstacles(t,d.annotations),[t,d.annotations]);
 const route=dirty?null:state.reports[d.mode].route,baseline=dirty?null:state.sandBaseline;
 const audit=route?sandRouteAudit(t,route.cells):null,baselineAudit=baseline?sandRouteAudit(t,baseline.cells):null;
 const path=(cells:readonly number[])=>cells.map(i=>`${i%t.width+.5},${Math.floor(i/t.width)+.5}`).join(' ');
 const place=(q:Point)=>{
  if(blocked(prepared,index(t,q),d.settings,d.exclusion)){setNotice('Choose a destination outside excluded terrain and sand buffers.');return;}
  store.replace({...d,target:q,targetName:'Selected terrain destination',purpose:'Inspect the selected terrain and return under the shared mission constraints.'});setPlacing(false);setNotice('Destination updated in the shared mission.');
 };
 const exportMission=()=>{
  const report={schemaVersion:1,region:t.assetRoot,bounds:t.bounds,crs:t.crs,policy:SAND_POLICY,draft:d,route,audit,baseline,baselineAudit,coverage:{knownCells:screen.knownCells,totalCells:screen.totalCells},source:t.noah?.source,registration:t.noah?.registration,meaning:'Texture candidates and declared buffer exclusions. Unknown soil strength and local registration residual; zero mapped crossings is not certified safety.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='mars-shift-sand-route.json';a.click();URL.revokeObjectURL(url);
 };
 const avoiding=d.settings.avoidSand===true;
 const status=dirty?(state.computing?'Calculating / route unavailable':'Mission edited / recalculate'):!route?'No feasible round trip':state.pendingAdoption?'Review revised mission':!screen.knownCells?'Sand coverage unavailable':avoiding&&audit?.excludedCells===0?'Mapped candidates avoided':'Sand avoidance off';
 return <div className="sand-workspace">
  <div className="sand-map-column"><div className="sand-map-tools"><span>HiRISE · 1 km study area</span><button aria-pressed={placing} onClick={()=>setPlacing(v=>!v)}><Crosshair size={15}/>{placing?'Cancel selection':'Set destination'}</button></div>
   <svg className={`sand-map ${placing?'sand-picking':''}`} viewBox={`0 0 ${t.width} ${t.height}`} role="img" aria-label="Sand candidate map with outbound and return routes" onClick={e=>{if(!placing)return;const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const q=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());if(q.x>=0&&q.y>=0&&q.x<t.width&&q.y<t.height)place({x:Math.floor(q.x),y:Math.floor(q.y)});}}>
    <image href={(t.assetRoot??'/data')+'/optical.webp'} width={t.width} height={t.height}/>
    {showSand&&<image href={overlay} width={t.width} height={t.height} style={{imageRendering:'pixelated'}}/>}
    {showBaseline&&baseline&&<polyline points={path(baseline.outbound)} className="sand-baseline"/>}
    {route&&<><polyline points={path(route.outbound)} className="sand-route-shadow"/><polyline points={path(route.outbound)} className="sand-outbound"/><polyline points={path(route.inbound)} className="sand-inbound"/></>}
    {d.exclusion&&<circle cx={d.exclusion.x+.5} cy={d.exclusion.y+.5} r={d.exclusion.radius/t.cellSize} fill="#ffad9844" stroke="#ffad98"/>}
    {d.annotations.filter(a=>a.exclude).map(a=><circle key={a.id} cx={a.point.x+.5} cy={a.point.y+.5} r={a.radius/t.cellSize} fill="#ffad9866" stroke="#ffad98"/>)}
    {[{...d.base,label:'A · BASE'},{...d.target,label:'B · TARGET'}].map(q=><g key={q.label}><circle cx={q.x+.5} cy={q.y+.5} r="2.5" fill="#101b24" stroke="#fff" strokeWidth=".8"/><text x={Math.max(2,Math.min(t.width-36,q.x-4))} y={q.y>12?q.y-5:q.y+10} className="sand-map-label">{q.label}</text></g>)}
    <text x={t.width-10} y="13" className="sand-map-label">N ↑</text><path d={`M 8 ${t.height-10} h ${100/t.cellSize}`} stroke="white" strokeWidth="1"/><text x="8" y={t.height-14} className="sand-map-label">100 m</text>
   </svg>
   <div className="sand-legend"><span><i className="out"/>Outbound</span><span><i className="back"/>Return · dashed</span><span><i className="candidate"/>Sand candidate + 5 m buffer</span><span><i className="unknown"/>Unknown texture</span><span><i className="baseline"/>Unscreened shortest</span></div>
   <div className="sand-layer-controls"><label><input type="checkbox" checked={showSand} onChange={e=>setShowSand(e.target.checked)}/>Surface screening</label><label><input type="checkbox" checked={showBaseline} onChange={e=>setShowBaseline(e.target.checked)}/>Compare unscreened path</label></div>
  </div>
  <div className="sand-console"><div className={`sand-verdict ${route&&avoiding&&screen.knownCells?'':'sand-caution'}`} role="status">{route&&avoiding&&screen.knownCells?<ShieldCheck size={21}/>:<TriangleAlert size={21}/>}<div><span>ROUND-TRIP SCREENING</span><strong>{state.calculationError??status}</strong></div></div>
   <label className="sand-policy"><input type="checkbox" checked={avoiding} disabled={!!state.computing} onChange={e=>store.replace({...d,settings:{...d.settings,avoidSand:e.target.checked}})}/><span>Avoid mapped sand candidates<small>Exclude ripple-rich cells and a 5 m planning buffer.</small></span></label>
   {!screen.knownCells&&<p className="sand-warning">No published texture coverage in this region. This route has no sand-screening assurance. Choose NOAH-H overlap to inspect mapped candidates.</p>}
   <div className="sand-route-options" aria-label="Route objective">{ROUTE_OPTIONS.map(o=><button key={o.id} aria-pressed={d.mode===o.id} onClick={()=>store.selectMode(o.id)}>{o.short}</button>)}</div>
   <dl className="sand-metrics"><div><dt>Mapped exclusion crossings</dt><dd>{audit?audit.excludedCells:'—'}<small>{avoiding?'out + back':'avoidance disabled'}</small></dd></div><div><dt>Round trip</dt><dd>{route?fmt(route.distance):'—'}<small>metres</small></dd></div><div><dt>Time incl. science</dt><dd>{route?fmt(route.totalMinutes,1):'—'}<small>/ {d.settings.durationMinutes} min</small></dd></div><div><dt>Return reserve · modeled</dt><dd>{route?fmt(route.reserve,1)+'%':'—'}<small>minimum {d.settings.reservePercent}%</small></dd></div></dl>
   {audit&&audit.unknownCells>0&&<p className="sand-warning">{audit.unknownCells} route cells have unknown texture. Soil conditions require verification.</p>}
   {baseline&&baselineAudit&&<p className="sand-comparison">Unscreened shortest: <b>{fmt(baseline.distance)} m</b> round trip · <b>{baselineAudit.excludedCells}</b> mapped exclusion cells crossed.{route&&` Selected route: ${fmt(route.distance-baseline.distance)} m longer.`}</p>}
   {!dirty&&!route&&<p className="sand-warning" role="alert">{state.reports[d.mode].reason} Change the destination or mission limits. Sand exclusions remain active.</p>}
   <button className="sand-helmet-link" onClick={onSurface}><Navigation size={17}/>Open helmet guidance<ArrowUpRight size={16}/></button>
   <div className="sand-actions"><button className="sand-primary" onClick={onPlanning}>Open shared mission <ArrowRight size={16}/></button><button aria-label="Recalculate sand-screened mission" disabled={!!state.computing} onClick={()=>store.calculate()}><RotateCcw size={17}/></button><button aria-label="Export sand route and evidence" disabled={dirty||!route} onClick={exportMission}><ArrowDownToLine size={17}/></button></div>
   {dirty&&!state.computing&&<button onClick={()=>store.calculate()}>Calculate edited mission</button>}
   {state.pendingAdoption&&<p className="sand-warning">A revised mission is awaiting adoption in Mission Control.</p>}
   {placing&&<form className="sand-coordinates" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);place({x:Number(data.get('x')),y:Number(data.get('y'))});}}><p>Select a map point or enter planning-grid coordinates.</p><label>Column<input name="x" type="number" min="0" max={t.width-1} defaultValue={d.target.x} required/></label><label>Row<input name="y" type="number" min="0" max={t.height-1} defaultValue={d.target.y} required/></label><button type="submit">Set target</button></form>}
   <p className="sand-notice" role="status">{notice}</p>
   <details className="sand-evidence"><summary>Data coverage & screening rule</summary><p>{fmt(screen.knownCells/screen.totalCells*100,1)}% texture coverage · {fmt(screen.candidateCells)} candidate cells · 5 m planning grid.</p><p>NOAH-H 0.25 m texture classes: ≥25% ripple area in a cell with ≥95% classification coverage. A declared 5 m buffer is added. HiRISE elevation supplies slope constraints. THEMIS 100 m thermal inertia is regional context, not a metre-scale trap detector.</p><p>Unknown texture is striped and remains traversable under DEM constraints. Texture is not soil strength; local registration error is unmeasured. Zero mapped crossings does not establish physical safety.</p><a href={(t.assetRoot??'/data')+'/manifest.json'} target="_blank" rel="noreferrer">Terrain provenance ↗</a><a href="/data/hazards/sand-navigation.json" target="_blank" rel="noreferrer">Collected data & route audit ↗</a></details>
  </div>
 </div>;
}
