import {lazy,Suspense,useState} from 'react';
import NavcamSurface from './NavcamSurface';
const LegacyNavcamStation=lazy(()=>import('./LegacyNavcamStation'));
export default function NavcamStation(p:{onNavigate:(id:string)=>void;onClose:()=>void;onPanorama:()=>void}){
 const [archive,setArchive]=useState(false);
 return archive?<Suspense fallback={<div className="xr-road-loading">Loading recorded archive…</div>}><LegacyNavcamStation onClose={()=>setArchive(false)} onPanorama={p.onPanorama}/></Suspense>:<NavcamSurface onNavigate={p.onNavigate} onClose={p.onClose} onPanorama={p.onPanorama} onArchive={()=>setArchive(true)}/>;
}
