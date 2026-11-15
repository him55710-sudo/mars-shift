import {lazy,Suspense,useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,Camera,Compass,Flag,Footprints,Globe2,Layers,Mountain,Orbit,Presentation,Route,Users,Wind} from 'lucide-react';
import MissionNavigation from './MissionNavigation';
import SandNavigation from './SandNavigation';
import type {Terrain} from './planner';
import {WORKSPACES,shouldHandleLink,workspaceHref} from './workspaces';
import './mission-hub.css';
const Planet=lazy(()=>import('./PlanetBackdrop'));
const ICONS={orbit:Orbit,footprints:Footprints,scan:Camera,layers:Layers,globe:Globe2,route:Route,flag:Flag,users:Users,wind:Wind,mountain:Mountain,book:BookOpen,presentation:Presentation,compass:Compass};
export default function MissionHub({onNavigate,terrain,error,region,onRegion}:{onNavigate:(page:string)=>void;terrain:Terrain|null;error:string;region:string;onRegion:(id:string)=>void}) {
 const [online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);addEventListener('online',update);addEventListener('offline',update);return()=>{removeEventListener('online',update);removeEventListener('offline',update);};},[]);
 const link=(id:string)=>({href:workspaceHref(id),onClick:(event:React.MouseEvent)=>{if(shouldHandleLink(event)){event.preventDefault();onNavigate(id);}}});
 return <main className="mission-hub" lang="en" id="main-content">
  <header className="hub-header"><a {...link('home')} className="hub-brand" aria-label="MARS SHIFT home"><Orbit size={27}/><span>MARS SHIFT<small>EXPLORATION WORKSPACE</small></span></a><MissionNavigation current="home" onNavigate={onNavigate}/><span className="hub-prototype">RESEARCH PROTOTYPE</span></header>
  <section className="hub-hero" aria-labelledby="hub-title">
   <div className="hub-planet"><Suspense fallback={null}><Planet placement="hub"/></Suspense></div>
   <div className="hub-hero-copy"><span className="hub-eyebrow"><i/>JEZERO CRATER · MARS</span><h1 id="hub-title">A world to explore.<br/><em>A way home.</em></h1><p>From the first look to the return route.<br/>Your Mars mission, in one place.</p><div className="hub-hero-actions"><a className="hub-primary" {...link('explore')}>Enter the surface <ArrowUpRight size={18}/></a><a className="hub-secondary" {...link('plan')}>Plan a mission <ArrowRight size={16}/></a></div><span className="hub-source">NASA observations · Simulated mission resources</span></div>
   <div className="hub-planet-caption"><span>04 / SOLAR SYSTEM</span><strong>MARS</strong><span>18.45° N &nbsp; 77.64° E / JEZERO</span></div>
   <div className="hub-orbit-mark" aria-hidden="true">MARS RECONNAISSANCE / FIELD WORKSPACE</div>
  </section>
  <SandNavigation terrain={terrain} error={error} region={region} onRegion={onRegion} onPlanning={()=>onNavigate('plan')}/>
  <section className="hub-workspace" aria-labelledby="hub-workspace-title"><div className="hub-section-title"><div><span className="hub-eyebrow">YOUR WORKSPACE</span><h2 id="hub-workspace-title">Choose your next step.</h2></div><span className={`hub-connection ${online?'':'is-offline'}`} role="status"><i/>{online?'Online':'Offline · streamed Atlas requires a connection'}</span></div>
   <div className="hub-featured">
    <a {...link('explore')} className="hub-feature hub-feature-surface"><div className="hub-feature-visual"><img src="/data/navcam/observation.png" alt="Recorded NASA Navcam view of the Martian surface"/><span><Footprints size={15}/>SURFACE</span><ArrowUpRight size={20}/></div><div className="hub-feature-copy"><span>01 / EXPLORE</span><h3>Set foot on Mars.</h3><p>Walk recorded rover terrain. Look closer at the surface beneath you.</p><b>Open Surface Explorer <ArrowRight size={15}/></b></div></a>
    <a {...link('plan')} className="hub-feature hub-feature-plan"><div className="hub-feature-visual"><img src="/data/ridge/optical.webp" alt="HiRISE observation of the Jezero eastern ridge" loading="lazy"/><span><Route size={15}/>MISSION</span><ArrowUpRight size={20}/></div><div className="hub-feature-copy"><span>02 / PLAN</span><h3>Keep the return in view.</h3><p>Compare terrain, time and resources across complete round trips.</p><b>Open Mission Control <ArrowRight size={15}/></b></div></a>
    <a {...link('hazards')} className="hub-feature hub-feature-weather"><div className="hub-feature-visual"><img src="/data/optical.webp" alt="HiRISE observation of the Jezero crater floor" loading="lazy"/><span><Wind size={15}/>ANALYSIS</span><ArrowUpRight size={20}/></div><div className="hub-feature-copy"><span>03 / REHEARSE</span><h3>When conditions change.</h3><p>Replay recorded observations and compare conditional escape models.</p><b>Open Weather & Hazards <ArrowRight size={15}/></b></div></a>
   </div>
   <div className="hub-directory"><div className="hub-directory-heading"><h3>Every view. One workspace.</h3><a {...link('about')}>About the mission <ArrowUpRight size={14}/></a></div><div className="hub-directory-grid">{WORKSPACES.filter(w=>!['home','about','explore','plan','hazards'].includes(w.id)).map(w=>{const Icon=ICONS[w.icon];return <a {...link(w.id)} key={w.id}><span className="hub-directory-icon"><Icon size={20}/></span><span><strong>{w.name}</strong><small>{w.description}</small></span><ArrowUpRight size={15}/></a>;})}</div></div>
  </section>
  <footer className="hub-footer"><span><Orbit size={17}/>MARS SHIFT <b>/</b> NASA Space Apps 2026</span><p>Observed terrain. Derived analysis. Declared simulations.</p><a {...link('evidence')}>Sources & limitations <ArrowUpRight size={13}/></a></footer>
 </main>;
}
