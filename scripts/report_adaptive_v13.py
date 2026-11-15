"""Verify immutable protocols, export paired metrics and regenerate report plots.
Never modifies the frozen scientific results. UI summary is a derived payload.
"""
from pathlib import Path
import json, hashlib, csv
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data/hazards/adaptive-v13'
read=lambda name:json.loads((OUT/(name+'.json')).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name in ['protocol','escape-protocol','guard-protocol']:
    for path,expected in read(name)['hashes'].items():
        assert sha(ROOT/path)==expected, f'Frozen source changed: {path}'
selection=read('selection');prediction=read('confirmation');observed=read('observed')
escape=read('escape-results');guard=read('guard-results');timing=read('timing')
assert prediction['protocolHash']==sha(OUT/'protocol.json')
assert prediction['selectionHash']==sha(OUT/'selection.json')
assert guard['protocolHash']==sha(OUT/'guard-protocol.json')
assert escape['protocolHash']==sha(OUT/'escape-protocol.json')
summary={s['model']:s for s in prediction['summary']}
ui={'selection':selection,'observed':{k:observed[k]for k in ['positionRMSE','rangeMAE']},
    'confirmation':{'summary':[{k:s[k]for k in ['model','rmse','coverage']}for s in prediction['summary']]},
    'escape':{'promotion':escape['promotion'],'summary':[{k:s[k]for k in ['arm','exposure','returnFailures']}for s in escape['summary']]},
    'guard':{'promotion':guard['promotion'],'summary':[{k:s[k]for k in ['arm','exposure','returnFailures','noContact','p95Ms']}for s in guard['summary']]}}
(OUT/'ui-summary.json').write_text(json.dumps(ui,separators=(',',':')),encoding='utf-8')

plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,ax=plt.subplots(1,3,figsize=(14,5))
models=['CV_SMOOTH_V8','IMM_V8','ADAPTIVE'];colors=['#a0a8a3','#538f85','#c18848']
for m,color in zip(models,colors):
    ax[0].plot([v['lead']for v in summary[m]['byLead']],[v['rmse']for v in summary[m]['byLead']],'o-',label=m,color=color)
ax[0].set(xlabel='Forecast horizon (s)',ylabel='Position RMSE (m)',title='192 frozen synthetic trajectories');ax[0].legend(fontsize=8)
families=prediction['byFamily'];cover=[next(s for s in f['summary']if s['model']=='ADAPTIVE')['coverage']*100 for f in families]
ax[1].barh([f['family']for f in families],cover,color=['#538f85'if v>=95 else '#c18848'for v in cover]);ax[1].axvline(95,color='#333',ls='--',lw=1);ax[1].set(xlim=(0,100),xlabel='Empirical containment (%)',title='Nominal 95% ellipse still misses turns');ax[1].invert_yaxis()
for i,v in enumerate(cover):ax[1].text(v-2,i,f'{v:.1f}',ha='right',va='center',color='white',fontsize=8)
v=guard['summary'];ax[2].bar(['Static','Legacy','Direct\nadaptive','Guarded','Same-bank\noracle'],[s['exposure']for s in v],color=['#aaa','#538f85','#c18848','#315f55','#d3d8d5']);ax[2].set(ylabel='Mean contact duration (s)',ylim=(0,3.3),title='36 new synthetic DEM placements')
ax[2].tick_params(axis='x',labelsize=8)
for i,s in enumerate(v):ax[2].text(i,s['exposure']+.05,f"{s['exposure']:.3f}",ha='center',fontsize=8)
fig.suptitle('MARS SHIFT v13: forecast gains, uncertainty failures, and small routing gains',fontsize=14)
fig.text(.5,.02,'Synthetic sensor/noise assumptions. No new independent observed trajectories. No operational safety or 1 m accuracy claim.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.06,1,.94));fig.savefig(OUT/'validation-overview.png',dpi=160);plt.close(fig)

def csv_once(name,rows):
    path=OUT/name
    if path.exists():return
    with path.open('x',encoding='utf-8-sig',newline='')as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
csv_once('prediction-by-case.csv',prediction['cases'])
csv_once('guard-paired-cases.csv',[{k:r[k]for k in ['case','terrain','arm','exposure','minClearance','returned','returnMargin','reserveViolation','elapsed','holds','unnecessaryHolds']}for r in guard['rows']])
old={r['case']:r for r in guard['rows']if r['arm']=='MARS SHIFT'}
new={r['case']:r for r in guard['rows']if r['arm']=='Guarded'}
delta=[new[k]['exposure']-old[k]['exposure']for k in old]
audit={'protocolHashesVerified':True,'realNewIndependentTrajectories':0,'developmentSyntheticTrajectories':96,'confirmationSyntheticTrajectories':192,
       'initialEscapePlacements':24,'followupEscapePlacements':36,'directReplacementPromoted':escape['promotion'],'guardPromotedForResearchRehearsal':guard['promotion'],
       'guardBetterCases':sum(d< -1e-8 for d in delta),'guardWorseCases':sum(d>1e-8 for d in delta),'guardSameCases':sum(abs(d)<=1e-8 for d in delta),
       'measuredSourceDiscrepancyIsNotMetreAccuracy':True,'uiSummaryBytes':(OUT/'ui-summary.json').stat().st_size}
if not (OUT/'audit.json').exists():(OUT/'audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
print(json.dumps(audit,indent=2))
