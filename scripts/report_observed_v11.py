"""Read frozen outputs; diagnostics do not tune or rewrite any model."""
from pathlib import Path
import csv,json,math,hashlib
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path('public/data/hazards/observed-v11')
load=lambda name:json.loads((root/name).read_text())
images,pressure,inputs,selection=map(load,['image-results.json','pressure-results.json','pressure-input.json','pressure-selection.json'])
out=root/'diagnostics.json'
if out.exists():raise SystemExit('Refusing overwrite')
primary=lambda r:next(m for m in r['matches'] if m['tolerance']==30)
table=[]
for d in inputs['days']:
    r=selection['legacy'] if d['sol']==57 else pressure['legacy']
    table.append(dict(sol=d['sol'],samples=len(d['samples']),catalogAll=len(d['catalog']),catalogAboveThreshold=sum(e['amplitude']>=.5 for e in d['catalog']),eligibleHours=r['eligibleHours'],eligibleEvents=primary(r)['eligibleEvents']))
day=next(d for d in inputs['days'] if d['sol']==215)
config=pressure['candidate']['config'];x=np.asarray(day['samples'])
diagnoses=[]
for e in day['catalog']:
    if e['id'] not in primary(pressure['candidate'])['missed']:continue
    checks=[]
    for i in np.flatnonzero(np.abs(x[:,0]-e['time'])<=15):
        t,v=x[i];h=x[(x[:,0]>=t-config['window'])&(x[:,0]<=t-config['gap'])]
        if len(h)<20:continue
        tm=h[:,0]-t;sm=(h[:,1]-h[:,1].mean());slope=np.sum((tm-tm.mean())*sm)/np.sum((tm-tm.mean())**2)
        baseline=h[:,1].mean()-slope*tm.mean();residual=h[:,1]-(baseline+slope*tm);centre=np.median(residual)
        sigma=1.4826*np.median(np.abs(residual-centre));drop=baseline+centre-v;threshold=max(config['floor'],config['mad']*sigma)
        checks.append(dict(time=float(t),drop=float(drop),threshold=float(threshold),margin=float(drop-threshold)))
    best=max(checks,key=lambda c:c['margin'])
    diagnoses.append(dict(event=e,maximumThresholdMargin=best,scope='Retrospective trace diagnostic of frozen configuration, not used for selection'))

plt.rcParams.update({'font.family':'DejaVu Sans','axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#fbfcfa','axes.facecolor':'#fbfcfa','font.size':10})
fig,axes=plt.subplots(3,2,figsize=(12,10),gridspec_kw={'width_ratios':[2,1]})
for i,fold in enumerate(images['folds']):
    event=fold['test'];a,b=axes[i];raw=[r for r in images['rows'] if r['event']==event and r['model']=='CV_SMOOTH' and r['lead']==3];new=[r for r in images['rows'] if r['event']==event and r['model']=='SELECTED_ROBUST' and r['lead']==3]
    frames=[r['targetFrame'] for r in raw]
    a.plot(frames,[r['observedX'] for r in raw],'o-',c='#273b42',label='Observed image measurement',ms=3)
    a.plot(frames,[r['predictedX'] for r in raw],c='#d07b34',label='Frozen CV_SMOOTH')
    a.plot(frames,[r['predictedX'] for r in new],c='#147f76',label='Selected robust candidate')
    a.fill_between(frames,[r['predictedX']-r['positionHalfWidth'] for r in new],[r['predictedX']+r['positionHalfWidth'] for r in new],color='#147f76',alpha=.1,label='Empirical interval (not guaranteed)')
    a.set(title=event+' / 3-frame-ahead prediction',xlabel='Target frame',ylabel='Cross-image location (px)')
    summary=[s for s in images['summaries'] if s['event']==event and s['lead']=='ALL' and s['model'] in ['PERSISTENCE','CV_SMOOTH','SELECTED_ROBUST']]
    b.barh(['Persistence','CV_SMOOTH','Candidate'],[s['rmsePx'] for s in summary],color=['#8e9d9c','#d07b34','#147f76']);b.set_xlabel('Position RMSE (px), 1–3 frames');b.invert_yaxis()
axes[0,0].legend(fontsize=8,loc='upper left')
fig.suptitle('Existing NASA observations — retrospective withheld-clip backtest\n3 clips, 63 measured frames; 135 overlapping forecasts per model are not 135 independent events',fontsize=13)
fig.tight_layout(rect=(0,0,1,.94));fig.savefig(root/'image-backtest.png',dpi=160);plt.close(fig)

fig,axes=plt.subplots(1,3,figsize=(13,3.9))
events=[c for c in day['catalog'] if c['amplitude']>=.5]
for ax,e in zip(axes,events):
    w=x[np.abs(x[:,0]-e['time'])<=45];ax.plot(w[:,0]-e['time'],w[:,1],c='#243b43',lw=1)
    for name,color in [('legacy','#d07b34'),('candidate','#147f76')]:
        for a in pressure[name]['alerts']:
            if abs(a['time']-e['time'])<=45:ax.axvline(a['time']-e['time'],c=color,label=name)
    ax.axvline(0,c='#829294',ls='--',alpha=.7);ax.set(title=e['id']+f" / catalog dip {e['amplitude']:.3f} Pa",xlabel='Seconds from catalog centre',ylabel='Recorded pressure (Pa)')
    if ax.get_legend_handles_labels()[0]:ax.legend(fontsize=8)
fig.suptitle('MEDA Sol 215 — continuous-product replay, three eligible ≥0.5 Pa events\nCatalog-centre timing is not warning to a remote vortex boundary',fontsize=12)
fig.tight_layout(rect=(0,0,1,.86));fig.savefig(root/'pressure-backtest.png',dpi=160);plt.close(fig)

with (root/'image-metrics.csv').open('x',newline='',encoding='utf-8-sig') as f:
    keys=sorted(set().union(*(s.keys() for s in images['summaries'])));w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(images['summaries'])
with (root/'image-forecasts.csv').open('x',newline='',encoding='utf-8-sig') as f:
    keys=sorted(set().union(*(s.keys() for s in images['rows'])));w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(images['rows'])
result=dict(inventory=table,missedPressureDiagnostics=diagnoses,zeroFailureIndependentEventExamples={str(n):1-.05**(1/n) for n in [3,59,299]},
    note='Exact one-sided 95% binomial bounds are illustrative only; dependent frames and shared-day events are not independent trials.',
    artifactHashes={n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ['protocol.json','image-results.json','pressure-selection.json','pressure-results.json','pressure-input.json']})
out.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
