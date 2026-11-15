import type {ReactNode} from 'react';
import './visor-chrome.css';

/** Shared helmet instruments for the observed rover surface and orbital EVA. */
export function VisorCompass({heading}:{heading:number}){
 const normalized=(heading%360+360)%360,rounded=Math.round(normalized/15)*15;
 return <div className="visor-compass" aria-label={`Heading ${Math.round(normalized)} degrees`}>
  <strong>{String(Math.round(normalized)%360).padStart(3,'0')}<small>°</small></strong><i/>
  <div className="visor-compass-window"><div style={{transform:`translateX(${(rounded-normalized)*2}px)`}}>{Array.from({length:11},(_,n)=>{const a=((rounded+(n-5)*15)%360+360)%360;return <span key={n}><b>{a===0?'N':a===90?'E':a===180?'S':a===270?'W':a%30===0?a:''}</b><em/></span>;})}</div></div>
 </div>;
}
export function VisorReticle(){return <div className="visor-reticle" aria-hidden="true"><i/><i/><i/><i/></div>;}
export function VisorDock({children,label='Visor controls'}:{children:ReactNode;label?:string}){return <nav className="visor-dock" aria-label={label}>{children}</nav>;}
