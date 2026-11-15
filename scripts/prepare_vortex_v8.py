"""Freeze scenarios before any v8 performance runs; never overwrite artifacts."""
import pathlib,json,hashlib,datetime,numpy as np
out=pathlib.Path('public/data/hazards/vortex-v8');out.mkdir(exist_ok=True)
cache=pathlib.Path('../data-cache/hazards/toledo-2023')
def save(name,d):
 p=out/name
 if p.exists(): raise RuntimeError('Refusing overwrite '+str(p))
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
wind={};files=[]
for day in range(1,7):
 p=cache/f'Figure4_Day{day}.txt';a=np.loadtxt(p,skiprows=1)
 # Keep last duplicate station timestamp; do not invent additional samples.
 times=np.round(a[:,0]*3600,2); unique={float(t):(float(v),float(d)) for t,v,d in zip(times,a[:,1],a[:,2])}
 ordered=sorted(unique);cadence=float(np.median(np.diff(ordered)))
 # First 241-second continuous segment, selected without looking at forecasts.
 start=next(i for i in range(len(ordered)-250) if ordered[i+240]-ordered[i]<=245 and max(np.diff(ordered[i:i+241]))<2.1)
 keys=ordered[start:start+241];wind[str(day)]=[[round(t-keys[0],3),*unique[t]] for t in keys]
 files.append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'rows':len(a),'uniqueTimes':len(ordered),'medianCadenceSeconds':cadence,'selectedFirstLocalTimeSeconds':keys[0]})
save('earth-analog-wind.json',{'source':'https://doi.org/10.5281/zenodo.7930641','record':'7930642','meaning':'Measured Botswana station winds. Advection of synthetic Martian-size vortex by these winds is a stress assumption, NOT a measured vortex track or Martian wind field.','days':wind,'files':files})
sources=[{'id':'MEDA57a','diameter':9.13,'speed':1.68},{'id':'MEDA57b','diameter':18.87,'speed':1.91},{'id':'PIA26074','diameter':60,'speed':19/3.6}]
cases=[]
for split,count in [('development',18),('holdout',54)]:
 for i in range(count):
  source=sources[i%3];group=i//3
  # Same source x terrain x bearing cross product in each split.
  terrain=['floor','ridge','navcam'][(i//3)%3]
  bearing=[0,0,.7,-.7,1.57,3.141592653589793][(i//9)%6] if split=='holdout' else [0,.7][(i//9)%2]
  gap=[8,25,60,120,5,40][(i//9)%6] if split=='holdout' else [20,55][i//9]
  family=['linear','drift','wind'][group%3] if split=='development' else ['wind','oscillate','gust'][group%3]
  cases.append(dict(id=f'{split[:3]}-{i+1:03}',split=split,terrain=terrain,source=source['id'],family=family,truth=family,distance=source['diameter']/2+1+gap,bearing=bearing,heading=(i%4)*np.pi/2+.21,startOffset=[3,-5],speed=[.4,.6,.9][(i//3)%3],reaction=[2,6,10][(i//9)%3],sensorSeed=(81000 if split=='development' else 191000)+i,positionSigma=.75,diameterSigmaFraction=.08,turnDegrees=0,growthMps=0,birth=[10,20,30][i%3],detectLag=[0,2,6][(i//3)%3],cadence=[1,2,4][i%3],dropout=family in ['gust','drift'],windDay=(1+group%3 if split=='development' else 4+group%3),growthSeconds=4,evaluationUntil=180))
save('protocol.json',{'version':8,'frozenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':sources,'cases':cases,'selection':{'forecastCandidates':['LOCAL7','CV_SMOOTH','CV_RESPONSIVE','IMM'],'policyAlpha':[0,.1,.25],'forecastCriterion':'development event-macro 5/10/20 s position RMSE; no holdout truth used','policyCriterion':'development mean contact, then return failures, then hold; nominal regret cap 0.5 s'},'definitions':{'contact':'strict interior of physical synthetic radius plus 1 m margin; swept piecewise-linear intersection, truth knots every 0.25 s','warning':'stationary predicted margin-boundary first entry, not center arrival','birth':'instant onset of small visible radius 15%, grows to nominal in 4 s; astronaut stationary sampling rock before alarm','delivery':'sensor timestamp +1 s common processing allowance; frames only observed on 2 s control ticks','reaction':'after first delivered fix; all arms including Oracle identical','estimateReady':'second delivered fix; first-fix radial fallback permitted after reaction, not four-second mandatory hold','sensor':'fixed virtual external position network, no range/occlusion model; latency/dropout assumptions; not monocular vision','return':'same terrain graph, speed and load, same oxygen/battery budgets; return point is NOT shelter','oracle':'same alarm/resources and finite candidate bank with exact future path; not global optimum','terrainEffects':'DEM limits walker. Direction forcing is synthetic/terrestrial analog, no validated rock-scale Mars CFD','independence':'54 held-out synthetic cases, not 54 actual events. Wind windows are only three held-out Earth days. Existing NASA image clips already used in earlier releases; retrospective diagnostic only.','holdout':'unseen sensor seeds, unseen gust/oscillatory families, wind days 4–6; code defects must be logged and entire set rerun under a new filename'}})
print('Frozen 18 development + 54 holdout cases; six separate Earth wind days')
