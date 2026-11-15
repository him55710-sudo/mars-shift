import {useEffect,useState} from 'react';
import type {ResourceState} from './hazard-planner';
const clock=(value:number)=>{const s=Math.max(0,Math.floor(value));return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;};
/** Screen-fixed visor markings; ground route remains in the shared 3D frame. */
export function HelmetHUD({resources,sigma,fixes,overview}:{resources:ResourceState|undefined;sigma:number;fixes:number;overview:boolean}){
 if(overview)return null;
 return <>
  <div className="eva11-rim" aria-hidden="true"><div className="eva11-brow"/><div className="eva11-chin"/>
   <svg className="eva11-outline" viewBox="0 0 1000 700" preserveAspectRatio="none"><path d="M30 155 Q55 40 240 30 M760 30 Q945 40 970 155 M30 545 Q55 660 240 670 M760 670 Q945 660 970 545"/><path className="eva11-inner" d="M54 202V250M54 450V498M946 202V250M946 450V498"/></svg>
  </div>
  <div className="eva11-system"><span className="eva11-status-dot"/> EVA 01 <span>/</span> VISOR LINK <small>OBSERVED TERRAIN · REHEARSAL</small></div>
  <div className="eva11-resources" aria-label="Modeled remaining resources"><div><small>O₂</small><strong>{resources?clock(resources.oxygenSeconds):'—'}</strong></div><div><small>BAT</small><strong>{resources?clock(resources.batterySeconds):'—'}</strong></div></div>
  <div className="eva11-localization"><span>{fixes>=2?'TRACK UPDATING':'ACQUIRING TRACK'}</span><small>VIRTUAL FIX · σ {sigma.toFixed(2)} m</small></div>
  <div className="eva11-centre-mark" aria-hidden="true"><span/><i/><span/></div>
 </>;
}
type Results={image:{event:string;baselineRMSE:number;candidateRMSE:number}[];pressure:{sol:number;events:number;legacyDetected:number;candidateDetected:number;legacyUnmatched:number;candidateUnmatched:number;hours:number};imagePass:boolean;pressurePass:boolean};
export function ObservedValidationCard(){
 const [data,setData]=useState<Results|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const abort=new AbortController();fetch('/data/hazards/observed-v11/ui-summary.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setFailed(true);});return()=>abort.abort();},[]);
 return <section className="eva11-validation"><h3>Recorded-data backtest</h3><a href="/hazards?metric=sol215">Open Sol 215 metre observation replay ↗</a>{data?<><p>Three archived NASA clips · withheld clip predictions · image pixels, not metres.</p><table><thead><tr><th>Clip</th><th>V8 RMSE</th><th>Candidate</th></tr></thead><tbody>{data.image.map(r=><tr key={r.event}><th>{r.event}</th><td>{r.baselineRMSE.toFixed(2)} px</td><td>{r.candidateRMSE.toFixed(2)} px</td></tr>)}</tbody></table><p>MEDA Sol {data.pressure.sol}: {data.pressure.candidateDetected}/{data.pressure.events} eligible catalog events matched; {data.pressure.candidateUnmatched} unmatched alerts over {data.pressure.hours.toFixed(2)} hours. Unmatched does not mean a proven false alarm.</p><p>Image promotion: {data.imagePass?'met experimental gate':'gate not met'}. Pressure detector: {data.pressurePass?'met experimental gate':'gate not met'}. Neither provides observed 2D escape validation.</p></>:<p>{failed?'Results could not be loaded. Open the recorded report below.':'Loading archived validation…'}</p>}<a href="/data/hazards/observed-v11/report.md" target="_blank" rel="noreferrer">Data, methods, failures and validation requirements ↗</a></section>;
}
