import {useEffect,useRef} from 'react';
import {ChevronDown} from 'lucide-react';

const primary=[['explore','Explore'],['plan','Plan a mission'],['terrain','Mars Atlas']] as const;
const secondary=[['review','Evidence & demo'],['hazards','Dust devil rehearsal'],['destinations','Destinations'],['crew','Crew rehearsal'],['terrain-local','Terrain analysis'],['evidence','Evidence & sources'],['briefing','7-slide briefing']] as const;
const compact:Record<string,string>={hazards:'Hazards',explore:'Explorer',plan:'Planning',terrain:'Atlas'};
const path=(id:string)=>id==='plan'?'/planning':id==='terrain-local'?'/terrain/analysis':'/'+id;

export default function MissionNavigation({current,onNavigate}:{current:string;onNavigate:(page:string)=>void}){
 const menu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const close=(event:PointerEvent)=>{if(menu.current?.open&&!menu.current.contains(event.target as Node))menu.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 const links=(items:ReadonlyArray<readonly[string,string]>)=>items.map(([id,label])=><a key={id} href={path(id)} aria-label={label} aria-current={id===current?'page':undefined} onClick={event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(menu.current)menu.current.open=false;onNavigate(id);}}><span className="nav-name">{label}</span><span className="nav-name-compact">{compact[id]??label}</span></a>);
 return <nav className="mission-nav" aria-label="Main navigation">
  {links(primary)}
  <details ref={menu} className="mission-more" onKeyDown={event=>{if(event.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}>
   <summary>{secondary.find(([id])=>id===current)?.[1]??'Mission library'}<ChevronDown size={14}/></summary>
   <div className="mission-more-links">{links(secondary)}</div>
  </details>
 </nav>;
}
