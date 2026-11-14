import {noahEvidence,evidenceRisk} from './noah-data';
import type {Terrain,Settings,Exclusion} from './planner';
import './noah.css';
const pct=(v:number|null)=>v===null?'Unknown':(v*100).toFixed(1)+'%';
export const RISK_LABELS={constraint:'Constraint violation',candidate:'Hazard candidate',lower:'Lower under stated rules',unknown:'Unknown evidence'};
export function NoahLegend({terrain:t,risk=false}:{terrain:Terrain;risk?:boolean}){
 return <div className="noah-legend">{risk?Object.entries(RISK_LABELS).map(([key,label])=><span key={key}><i className={'risk-'+key}/>{label}</span>):<>{t.noah?.classes.map(c=><span key={c.id}><i style={{background:c.color}}/>{c.label}</span>)}<span><i className="risk-unknown"/>Unclassified / missing support</span></>}<small>{risk?'Rules: 25% classified texture candidate; 95% coverage for lower concern. Heuristics, not safety probabilities.':'Published mosaic classes · native 0.25 m sampling → 5 m area fractions. Colors identify texture classes, not risk.'}</small></div>;
}
export default function NoahEvidence({terrain:t,index,settings,exclusion=null}:{terrain:Terrain;index:number;settings:Settings;exclusion?:Exclusion|null}){
 const e=noahEvidence(t.noah,index),risk=evidenceRisk(t,t.noah,index,settings,exclusion);
 return <section className="noah-evidence" aria-label="Published terrain classification evidence"><h3>Terrain classification &amp; evidence</h3><span className={'noah-state risk-'+risk.state}>{RISK_LABELS[risk.state]}</span><dl>
  <div><dt>NOAH-H texture</dt><dd>{e.label}</dd></div><div><dt>Evidence type</dt><dd>{e.classification}</dd></div><div><dt>Classification coverage</dt><dd>{pct(e.coverage)}</dd></div><div><dt>Dominant class area</dt><dd>{pct(e.dominantAreaFraction)}</dd></div><div><dt>Boulder-field texture area</dt><dd>{pct(e.boulderFieldAreaFraction)}</dd></div><div><dt>Ripple texture area</dt><dd>{pct(e.rippleAreaFraction)}</dd></div><div><dt>Source / display sampling</dt><dd>0.25 m / 5 m</dd></div><div><dt>Observation date</dt><dd>Unknown</dd></div><div><dt>Publication date</dt><dd>{e.publicationDate??'Unknown'}</dd></div><div><dt>Local registration error</dt><dd>Not independently measured</dd></div>
 </dl><p>{risk.reasons.join('; ')}.</p><p><strong>Routing:</strong> {risk.routingImpact}.</p><p>{t.noahError||e.limitations}</p>{t.noah&&<p><a href={'https://doi.org/'+t.noah.source.doi} target="_blank" rel="noreferrer">NOAH-H source · {t.noah.source.license}</a><br/>{t.noah.source.credit}</p>}</section>;
}
