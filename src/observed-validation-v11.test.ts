import {it,expect} from 'vitest';
import {pressureAlerts,matchCatalog,predictImage,LEGACY_PRESSURE} from './observed-validation-v11';
import {pressureCandidates} from './meda-detection';
const points=Array.from({length:10},(_,i)=>({frame:i,time:i*4,x:10+2*i,width:5,positionSigma:.5,radiusSigma:.5}));
it('forecasts an analytic straight image track and preserves coordinate scaling',()=>{
 const model={name:'ROBUST',window:5,damping:0,widthMode:'last' as const},a=predictImage(points.slice(0,6),3,model);
 expect(a.x).toBeCloseTo(26);expect(a.width).toBe(5);
 const b=predictImage(points.slice(0,6).map(p=>({...p,x:p.x*3+100,width:p.width*3})),3,model);
 expect(b.x).toBeCloseTo(a.x*3+100);expect(b.width).toBe(a.width*3);
});
it('ignores future truth when issuing an image prediction',()=>{
 const model={name:'ROBUST',window:7,damping:.35},before=predictImage(points.slice(0,6),3,model),changed=points.map((p,i)=>({...p,x:i>5?1e6:p.x}));
 expect(predictImage(changed.slice(0,6),3,model)).toEqual(before);
 expect(()=>predictImage([points[1],points[0],points[2]],1,model)).toThrow();
});
it('streaming legacy pressure alerts agree with frozen algorithm on observed prefixes',()=>{
 const samples=Array.from({length:300},(_,i)=>[i,750-(i>=150&&i<158?2:0)]),a=pressureAlerts(samples,LEGACY_PRESSURE),b=pressureCandidates(samples.map(([time,pressurePa])=>({time,pressurePa})),299);
 expect(a.alerts.map(a=>a.time)).toEqual(b.map(a=>a.time));expect(a.alerts[0].time).toBe(152);
 const altered=samples.map(([t,p])=>[t,t>180?1:p]);expect(pressureAlerts(altered,LEGACY_PRESSURE).alerts.filter(a=>a.time<=180)).toEqual(a.alerts.filter(a=>a.time<=180));
});
it('does not bridge missing sensor periods or score their warmup',()=>{
 const samples=[...Array.from({length:150},(_,i)=>[i,750]),...Array.from({length:120},(_,i)=>[500+i,748])];
 const r=pressureAlerts(samples,LEGACY_PRESSURE);expect(r.alerts).toEqual([]);expect(r.eligible).toEqual([[100,149],[600,619]]);
});
it('matches one alert to one catalog event and keeps unmatched alarms distinct from proven false positives',()=>{
 const r=matchCatalog([{time:150,drop:2,threshold:.8},{time:151,drop:2,threshold:.8},{time:240,drop:2,threshold:.8}],[{id:'a',time:152,amplitude:1}],[[100,300]],30);
 expect(r.matches).toHaveLength(1);expect(r.unmatched).toHaveLength(2);expect(r.catalogRecall).toBe(1);expect(r.matches[0].leadToCatalogCentre).toBe(1);
});
