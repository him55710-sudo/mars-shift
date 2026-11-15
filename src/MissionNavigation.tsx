import {useEffect,useRef} from 'react';
import {ArrowUpRight,ChevronDown,Grid2X2} from 'lucide-react';
import {WORKSPACES,shouldHandleLink} from './workspaces';

export default function MissionNavigation({current,onNavigate,compact=false}:{current:string;onNavigate:(page:string)=>void;compact?:boolean}) {
 const menu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const close=(event:PointerEvent)=>{if(menu.current?.open&&!menu.current.contains(event.target as Node))menu.current.open=false;};
  document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);
 },[]);
 const link=(w:typeof WORKSPACES[number])=>({href:w.href,'aria-current':w.id===current?'page' as const:undefined,onClick:(event:React.MouseEvent)=>{
  if(!shouldHandleLink(event))return;event.preventDefault();if(menu.current)menu.current.open=false;onNavigate(w.id);
 }});
 return <nav className={`mission-nav ${compact?'mission-nav-compact':''}`} aria-label="Main navigation">
  {!compact&&['home','navigate','explore','terrain'].map(id=>WORKSPACES.find(w=>w.id===id)!).map(w=><a key={w.id} {...link(w)}><span className="nav-name">{w.name}</span><span className="nav-name-compact">{w.short}</span></a>)}
  <details ref={menu} className="mission-more" onKeyDown={event=>{if(event.key==='Escape'&&menu.current?.open){event.stopPropagation();menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}>
   <summary><Grid2X2 size={15}/><span>All views</span><ChevronDown size={13}/></summary>
   <div className="mission-more-links">
    {['Overview','Explore','Mission','Analysis','Library'].map(group=><div className="mission-menu-group" key={group}><span>{group}</span>{WORKSPACES.filter(w=>w.group===group).map(w=><a key={w.id} {...link(w)}><span>{w.name}</span><ArrowUpRight size={12}/></a>)}</div>)}
   </div>
  </details>
 </nav>;
}
