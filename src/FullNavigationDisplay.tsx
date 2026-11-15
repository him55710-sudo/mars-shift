import {useMemo} from 'react';
import {ArrowLeft,ArrowRight,Crosshair,Map,ShieldAlert} from 'lucide-react';
import type {Exclusion,Point,Route,Settings,Terrain} from './planner';
import type {PositionFix} from './position-sensor';
import {localizationValid} from './position-sensor';
import {groundHazardPixels} from './ground-overlay';
import {routeGuidance} from './route-explanation';
import {sandScreen} from './sand-screening';
import './full-navigation.css';
type Props={terrain:Terrain;route:Route;origin?:Point;base:Point;fix:PositionFix;yaw:number;range:number;storm:boolean;hazards:boolean;settings:Settings;exclusion:Exclusion|null;onFix:()=>void;onTurn:(direction:'left'|'right')=>void;onMap:()=>void};
/** A north-up map of the same mission, not a synthetic replacement for the scene.
 * The scene controller keeps native-DEM collision/resource checks while its GPU rendering is paused. */
export default function FullNavigationDisplay(p:Props){
 const {terrain:t,fix}=p,valid=localizationValid(fix),crew=fix.point,span=p.range/t.cellSize,heading=((-p.yaw*180/Math.PI)%360+360)%360,color=p.origin?'#ffd18a':'#a3ffdc';
 const mask=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=t.width;canvas.height=t.height;const ctx=canvas.getContext('2d')!;ctx.putImageData(new ImageData(new Uint8ClampedArray(groundHazardPixels(t,p.settings,p.exclusion)),t.width,t.height),0,0);return canvas.toDataURL();},[t,p.settings,p.exclusion]);
 const poly=(cells:number[])=>cells.map(i=>`${i%t.width+.5},${Math.floor(i/t.width)+.5}`).join(' '),guidance=valid?routeGuidance(t,p.route.outbound,crew):null;
 const marker=span*.012,viewBox=`${crew.x+.5-span/2} ${crew.y+.5-span/2} ${span} ${span}`;
 const sandKnown=sandScreen(t).knownCells>0;
 return <section className="full-navigation" aria-label="Full visor navigation display" data-range-metres={p.range} data-position-valid={valid}>
  <svg viewBox={viewBox} role="img" aria-label="North-up HiRISE navigation map following the current crew position" preserveAspectRatio="xMidYMid slice">
   <defs><pattern id="navigation-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#a0d6ef" strokeWidth=".05" opacity=".25"/></pattern></defs>
   <image href={(t.assetRoot??'/data')+'/optical-native.webp'} width={t.width} height={t.height}/><rect width={t.width} height={t.height} fill="#09223e" opacity=".36"/>
   {p.hazards&&<image href={mask} width={t.width} height={t.height} opacity=".55" style={{imageRendering:'pixelated'}}/>}<rect width={t.width} height={t.height} fill="url(#navigation-grid)"/>
   <g fill="none" strokeLinejoin="round" strokeLinecap="round"><polyline points={(p.origin?`${p.origin.x+.5},${p.origin.y+.5} `:'')+poly(p.route.outbound)} stroke="#071c2c" strokeWidth={marker*.8}/><polyline points={(p.origin?`${p.origin.x+.5},${p.origin.y+.5} `:'')+poly(p.route.outbound)} stroke={color} strokeWidth={marker*.4}/><polyline points={poly(p.route.inbound)} stroke="#c5e7ff" strokeWidth={marker*.24} strokeDasharray={`${marker} ${marker*.7}`}/></g>
   <circle cx={p.base.x+.5} cy={p.base.y+.5} r={marker} fill="#b4f2d6" stroke="#102c36" strokeWidth={marker*.25}/><text x={p.base.x+.5} y={p.base.y+.5-marker*1.8} fontSize={marker*1.5} fill="#e4fff3" textAnchor="middle" stroke="#092035" strokeWidth={marker*.18} paintOrder="stroke">HABITAT</text>
   <circle cx={p.route.outbound.at(-1)!%t.width+.5} cy={Math.floor(p.route.outbound.at(-1)!/t.width)+.5} r={marker*.75} fill="#ffd18a"/>
   {!valid&&<circle cx={crew.x+.5} cy={crew.y+.5} r={Math.max(marker*3,(fix.errorMetres??50)/t.cellSize)} fill="#ffc07322" stroke="#ffc073" strokeWidth={marker*.12} strokeDasharray={`${marker*.3} ${marker*.4}`}/>}
   <g transform={`translate(${crew.x+.5} ${crew.y+.5}) rotate(${heading}) scale(${marker})`}><circle r="2.8" fill="#8ce8ff12" stroke="#9ce8ff44" strokeWidth=".08"/><path d="M0 -1.9L1.2 1.3L0 .65L-1.2 1.3Z" fill={valid?'#d8faff':'#ffc073'} stroke="#082337" strokeWidth=".18"/></g>
  </svg>
  <div className="full-navigation-title"><span>{p.storm?'DUST / VISIBILITY REHEARSAL':'FULL VISOR NAVIGATION'}</span><h2>{p.storm?'See the route. Keep your bearings.':'Your mission, around you.'}</h2><p>{p.storm?'Visibility is simulated at 8 m. This map uses previously observed terrain.':'North-up · current position · observed terrain'}</p></div>
  <div className="full-navigation-scale"><span>N ↑</span><strong>{p.range} m <small>vertical field</small></strong><i/><small>Solid outbound · dashed return</small><small>{!sandKnown?'Sand texture unavailable':p.settings.avoidSand?'Amber: sand + buffer · avoidance ON':'Amber: sand + buffer · avoidance OFF'}</small></div>
  <div className="full-navigation-guidance"><NavigationReadout bearing={guidance?.bearing} distance={guidance?.distance}/><div><button aria-label="Turn heading left" onClick={()=>p.onTurn('left')}><ArrowLeft size={16}/>Turn</button><button aria-label="Turn heading right" onClick={()=>p.onTurn('right')}>Turn<ArrowRight size={16}/></button><button onClick={p.onMap}><Map size={16}/>Plan</button></div><small>W / S forward &amp; back · A / D sidestep · arrows change position</small></div>
  {!valid&&<div className="full-navigation-hold" role="status"><ShieldAlert size={20}/><h3>Position uncertain · movement held</h3><p>Last known position is shown. Navigation anchors need a valid position estimate.</p><button onClick={p.onFix}><Crosshair size={16}/>Use simulated position fix</button><small>This manually restores an assumed fix for rehearsal. It does not establish a real-world location.</small></div>}
 </section>;
}
function NavigationReadout({bearing,distance}:{bearing?:number;distance?:number}){return <p><span>NEXT WAYPOINT<strong>{distance===undefined?'—':Math.round(distance)} <small>m</small></strong></span><span>BEARING<strong>{bearing===undefined?'—':Math.round(bearing)}<small>°</small></strong></span></p>;}
