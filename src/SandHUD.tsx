import {useMemo} from 'react';
import {ArrowUpRight,Map,Navigation,ShieldAlert} from 'lucide-react';
import type {Point,Route,Settings,Terrain} from './planner';
import type {SafetyState} from './safety-state';
import {localMapWindow,sandHUDState} from './sand-hud-model';
import {sandOverlay} from './sand-overlay';
import './sand-hud.css';

type Props={terrain:Terrain;route:Route;crew:Point;base:Point;origin?:Point;heading:number;settings:Settings;safety:SafetyState;onMap:()=>void;fullDisplay:boolean};
export default function SandHUD(p:Props){
 const {terrain:t}=p,overlay=useMemo(()=>sandOverlay(t),[t]),window=localMapWindow(t,p.crew);
 const guidance=useMemo(()=>sandHUDState(t,p.route.outbound,p.crew,p.heading,p.settings.avoidSand===true,p.safety.canMove,p.safety.worldAnchors),[t,p.route.outbound,p.crew,p.heading,p.settings.avoidSand,p.safety.canMove,p.safety.worldAnchors]);
 const path=(cells:number[])=>cells.map(i=>`${i%t.width+.5},${Math.floor(i/t.width)+.5}`).join(' ');
 const width=window.size/105,scale=window.size/40,known=p.safety.worldAnchors;
 if(p.fullDisplay)return null;
 return <div className={`sand-hud sand-hud-${guidance.kind}`}>
  <section className="sand-hud-command" aria-label="Sand avoidance guidance" role="status">
   {guidance.turn===null?<ShieldAlert size={29}/>:<Navigation size={31} style={{transform:`rotate(${guidance.turn}deg)`}}/>}
   <div><span>NEXT ACTION · MAPPED TERRAIN</span><strong>{guidance.title}</strong><small>{guidance.detail}{guidance.turn!==null&&guidance.waypointMetres!==null?` · ${Math.round(guidance.waypointMetres)} m to waypoint`:''}</small>
   {guidance.nearest&&<b className="sand-hud-distance">Mapped sand buffer <em>{Math.floor(guidance.nearest.metres)} m</em> {guidance.nearest.side}</b>}</div>
  </section>
  {!p.fullDisplay&&<button className="sand-hud-map" onClick={p.onMap} aria-label="Open full mission map from local sand display">
   <div className="sand-hud-map-heading"><Map size={14}/><strong>LOCAL TERRAIN</strong><span>{Math.round(window.metres)} m</span></div>
   {known?<svg viewBox={`${window.x} ${window.y} ${window.size} ${window.size}`} role="img" aria-label="Nearby sand buffers, current heading and selected route">
    <image href={(t.assetRoot??'/data')+'/optical.webp'} width={t.width} height={t.height}/><image href={overlay} width={t.width} height={t.height} style={{imageRendering:'pixelated'}}/>
    <polyline points={path(p.route.inbound)} fill="none" stroke="#f0f8ff" strokeWidth={width} strokeDasharray={`${width*2} ${width*2}`}/>
    <polyline points={(p.origin?`${p.origin.x+.5},${p.origin.y+.5} `:'')+path(p.route.outbound)} fill="none" stroke="#0a251d" strokeWidth={width*3.4}/>
    <polyline points={(p.origin?`${p.origin.x+.5},${p.origin.y+.5} `:'')+path(p.route.outbound)} fill="none" stroke="#a3ffdc" strokeWidth={width*1.7}/>
    <circle cx={p.base.x+.5} cy={p.base.y+.5} r={scale*1.3} fill="white" stroke="#101b24" strokeWidth={scale*.5}/>
    <g transform={`translate(${p.crew.x+.5} ${p.crew.y+.5}) rotate(${p.heading})`}><path d={`M0 ${-scale*7} L${-scale*3.8} ${-scale*.6} Q0 ${-scale*3} ${scale*3.8} ${-scale*.6} Z`} fill="#e9fff34d"/><path d={`M0 ${-scale*2.8} L${scale*1.9} ${scale*2} L0 ${scale*.9} L${-scale*1.9} ${scale*2} Z`} fill="white" stroke="#0a251d" strokeWidth={scale*.55}/></g>
    <text x={window.x+window.size-scale*2} y={window.y+scale*3.5} textAnchor="end" fontSize={scale*2.8} fontWeight="700" fill="white" stroke="#0a1119" strokeWidth={scale*.7} paintOrder="stroke">N ↑</text>
   </svg>:<div className="sand-hud-map-unavailable">Position uncertain<br/>Ground overlays hidden</div>}
   <div className="sand-hud-map-key"><span><i/>Sand · avoid</span><span><i/>Route</span><ArrowUpRight size={14}/></div>
  </button>}
 </div>;
}
