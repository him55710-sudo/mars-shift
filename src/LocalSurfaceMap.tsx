import {useId,useMemo} from 'react';
import type {Point,Route,Terrain} from './planner';
import type {RoverGrid,RoverObstacle} from './rover-navigation';
import type {XRNavigationFrame} from './hazard-xr';
import {roverHazardPixels} from './rover-hazard-raster';
import {stormDisplayPixels} from './hazard-visual';
import {localMapFrame,localMapPoint} from './local-map-model';
import './local-surface-map.css';

const EMPTY:RoverObstacle[]=[];
type Props={comparison?:Route|null;viewBox?:string;terrain:Terrain;grid:RoverGrid;crew:Point;base:Point;target:Point;route?:Route|null;obstacles?:RoverObstacle[];frame?:XRNavigationFrame;sourceLabel?:string;hazards?:boolean;onPick?:(p:Point)=>void};
function image(t:Terrain,pixels:Uint8Array|Uint8ClampedArray){const canvas=document.createElement('canvas');canvas.width=t.width;canvas.height=t.height;const ctx=canvas.getContext('2d')!,data=ctx.createImageData(t.width,t.height);data.data.set(pixels);ctx.putImageData(data,0,0);return canvas.toDataURL();}
export default function LocalSurfaceMap({comparison,viewBox,terrain:t,grid,crew,base,target,route,obstacles=EMPTY,frame,sourceLabel,hazards=false,onPick}:Props){
 const clip=useId().replaceAll(':',''),projection=localMapFrame(t,frame);
 const dem=useMemo(()=>{const values=t.elevation.filter((v):v is number=>v!==null),lo=Math.min(...values),hi=Math.max(...values),p=new Uint8ClampedArray(t.width*t.height*4);for(let i=0;i<t.valid.length;i++){const v=t.elevation[i],shade=v===null||!t.valid[i]?null:65+100*(v-lo)/Math.max(.1,hi-lo);p.set(shade===null?[13,24,32,255]:[shade+25,shade+10,shade,255],i*4);}return image(t,p);},[t]);
 const overlay=useMemo(()=>image(t,stormDisplayPixels(t,projection?frame:undefined,hazards?roverHazardPixels(grid,t,obstacles):new Uint8Array(t.width*t.height*4))),[t,grid,frame,hazards,obstacles,!!projection]);
 const pointList=(cells:readonly number[])=>cells.map(i=>`${i%t.width+.5},${Math.floor(i/t.width)+.5}`).join(' ');
 const marker=(p:Point,text:string,color:string)=>{const q=localMapPoint(p);return <g><circle cx={q.x} cy={q.y} r="1.3" fill={color} stroke="#0b161e" strokeWidth=".6"/><text x={Math.max(3,Math.min(t.width-24,q.x+3))} y={Math.max(6,q.y-3)}>{text}</text></g>;};
 return <div className={`local-surface-map ${onPick?'local-map-picking':''}`} data-map-frame={t.crs} data-map-time={projection?.time??''}>
  <svg viewBox={viewBox??`0 0 ${t.width} ${t.height}`} role="img" aria-label="2D local terrain, red risk areas and the same outbound and return routes" onClick={e=>{if(!onPick)return;const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());if(p.x>=0&&p.y>=0&&p.x<t.width&&p.y<t.height)onPick({x:p.x-.5,y:p.y-.5});}}>
   <defs><clipPath id={clip}><rect width={t.width} height={t.height}/></clipPath></defs>
   <g clipPath={`url(#${clip})`}><image href={dem} width={t.width} height={t.height}/><image href={overlay} width={t.width} height={t.height}/>
    {comparison&&<polyline points={pointList(comparison.outbound)} stroke="#ffcb8c" strokeWidth=".4" strokeDasharray=".8 .7"/>}
    {route&&<><polyline points={pointList(route.outbound)} stroke="#91f7d4" strokeWidth="1"/><polyline points={pointList(route.inbound)} stroke="#f0f9ff" strokeWidth=".55" strokeDasharray="1.2 1.4"/></>}
    {!!projection?.route.length&&<polyline points={projection.route.map(p=>`${p.x},${p.y}`).join(' ')} stroke="#91f7d4" strokeWidth="1"/>}
    {projection?.current&&<circle cx={projection.current.x} cy={projection.current.y} r={projection.current.radius} fill="none" stroke="#ff4052" strokeWidth=".7"/>}
    {marker(base,Math.hypot(crew.x-base.x,crew.y-base.y)<2?'A / CREW':'A · BASE','#c1e6ff')}{marker(target,'B · TARGET','#91f7d4')}{Math.hypot(crew.x-base.x,crew.y-base.y)>=2&&marker(crew,'CREW','#ffffff')}
   </g>
   <text x={t.width-13} y="9">N ↑</text><path d={`M 6 ${t.height-9} h ${5/t.cellSize}`} stroke="#edf6fa" strokeWidth=".7"/><text x="6" y={t.height-13}>5 m</text>
  </svg>
  <div className="local-map-key"><span>2D DEM · SOL 477 · LOCAL METRES</span><span><i/>Red: risk area {frame&&<><b>···</b> Pale: forecast</>}</span><span>{sourceLabel??(frame?'RELOCATED SIMULATION':'REVIEWED / SIMULATED SAND')}</span></div>
 </div>;
}
