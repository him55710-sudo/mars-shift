from pathlib import Path
import json,hashlib,csv,sys
from xml.etree import ElementTree as E
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path('public/data/hazards/metric-v12')
r=json.loads((root/'ranged-results.json').read_text());p=json.loads((root/'inputs.json').read_text())
assert '--refresh-figures' in sys.argv or not (root/'metric-backtest.png').exists(),'Refusing overwrite'
frames=r['frames'];t=np.array([f['fix']['time']for f in frames]);dist=[f['fix']['horizontalRange']for f in frames]
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,ax=plt.subplots(1,2,figsize=(12,5.4),gridspec_kw={'width_ratios':[1.35,1]})
low=[f['uncertainty']['range95'][0]for f in frames];high=[f['uncertainty']['range95'][1]for f in frames]
ax[0].fill_between(t,low,high,color='#17756f',alpha=.12,label='Assumption-based sensitivity band')
ax[0].plot(t,dist,'o-',color='#183f3b',label='Published approximate image range')
for f in r['forecasts']:
 if f['model']=='WEIGHTED_CV':
  ax[0].plot([t[f['origin']],t[f['target']]],[dist[f['origin']],f['range']],'--',color='#c5813c',alpha=.8)
  ax[0].scatter(t[f['target']],f['range'],marker='x',s=60,color='#c5813c')
ax[0].plot([],[],'x--',color='#c5813c',label='Causal weighted-CV forecast')
ax[0].set(xlabel='Seconds relative to microphone start',ylabel='Horizontal range (m)',title='One observed approach, four range estimates')
ax[0].legend(fontsize=8)
s=r['summaries'];ax[1].barh(['Persistence','Last two','OLS','Weighted CV'],[v['positionRMSE']for v in s],color=['#869591','#357e77','#83aaa1','#c5813c']);ax[1].invert_yaxis();ax[1].set(xlabel='Position discrepancy RMSE (m)',title='Same three forecast-target pairs')
for i,v in enumerate(s):ax[1].text(v['positionRMSE']+.4,i,f"{v['positionRMSE']:.2f}",va='center',fontsize=9)
ax[1].set_xlim(0,40)
fig.suptitle('Sol 215: metre-valued reconstruction and chronological replay',fontsize=15)
fig.text(.5,.025,'Approximate published ranges + calibrated camera rays; not independent surveyed centre truth.\nOne event / three overlapping forecast pairs cannot establish operational accuracy.',ha='center',fontsize=9,color='#5e645f')
fig.tight_layout(rect=(0,.09,1,.93));fig.savefig(root/'metric-backtest.png',dpi=160);plt.close(fig)

fig,ax=plt.subplots(2,2,figsize=(12,6.4))
for i,a in enumerate(ax.flat):
 im=plt.imread(root/f'change-{i}.png');a.imshow(im,cmap='gray',vmin=0,vmax=1)
 u,v=p['annotations'][i]['pixel'];a.scatter([u],[v],s=100,facecolor='none',edgecolor='#d78c31')
 a.set(xlim=(520,880),ylim=(239,95),title=f"Frame {i+1}: supplied range {dist[i]:.0f} m / bearing {frames[i]['fix']['azimuth']:.1f}°",xlabel='PDS source sample',ylabel='PDS source line')
fig.suptitle('Causal change from first image + digitized author marker',fontsize=14)
fig.text(.5,.02,'First image contains weak dust; no future image enters change display. Mark is not a measured ground-contact point.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.05,1,.94),h_pad=3.5);fig.savefig(root/'source-measurements.png',dpi=150);plt.close(fig)
if not (root/'forecast-metrics.csv').exists():
 with (root/'forecast-metrics.csv').open('x',newline='',encoding='utf-8-sig')as f:
  w=csv.DictWriter(f,fieldnames=list(r['forecasts'][0]));w.writeheader();w.writerows(r['forecasts'])
for product in p['products']:
 label=E.parse(root/(product['id']+'.xml')).getroot()
 values=[float(n.text)for n in label.iter()if n.tag.endswith('}spacecraft_clock_start')]
 assert values and all(abs(v-product['sclk'])<1e-6 for v in values)
audit={'sourceTimeVerifiedAgainstLabels':True,'protocolHash':hashlib.sha256((root/'ranged-protocol.json').read_bytes()).hexdigest(),
 'independentEvents':1,'coordinateCount':4,'forecastPairs':3,'accuracyClaim':'No independent metre accuracy',
 'calibrationAttempt':'Initial ground-ray reconstruction rejected: author scale marks are not ground-contact points. Original protocol and outputs retained.'}
if not (root/'audit.json').exists():(root/'audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
print(json.dumps(audit,indent=2))
