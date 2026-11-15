"""Freeze diverse synthetic placements and actual DEM crops before policy selection."""
from pathlib import Path
import json, hashlib, datetime, math, random
import numpy as np
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public/data/hazards/encounters-v7'
if (OUT/'protocol.json').exists():raise SystemExit('Refusing overwrite')
OUT.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
terrains=[]
for name,sub,x,y in [('floor','',450,450),('ridge','ridge/',450,450)]:
    folder=ROOT/'public/data'/sub;meta=json.loads((folder/'jezero-native-dem.json').read_text());raw=(folder/'jezero-native-dem.bin').read_bytes()
    assert sha(raw)==meta['validation']['binarySha256']
    allz=np.frombuffer(raw,dtype='<f4').reshape(meta['height'],meta['width']);z=allz[y:y+81,x:x+81].astype(float)
    dzdy,dzdx=np.gradient(z,meta['cellSize']);slope=np.degrees(np.arctan(np.hypot(dzdx,dzdy)))
    vals=lambda a:[float(v) if np.isfinite(v) else None for v in a.ravel()]
    b=meta['bounds'];bounds=[b[0]+x,b[3]-y-81,b[0]+x+81,b[3]-y]
    n=z.size
    t=dict(width=81,height=81,cellSize=1,bounds=bounds,center=[0,0],crs=meta['crs'],elevation=vals(z),slope=vals(slope),meanSlope=vals(slope),roughness=[0]*n,exposure=[0]*n,valid=[int(v) for v in np.isfinite(z).ravel()],thermal=[None]*n,thermalRange=[0,0])
    data=dict(id=name,terrain=t,source=dict(record=meta['source']['record'],binarySha256=sha(raw),pixelCrop=[x,y,81,81],layout=meta['layout'],derivation='Original 1 m samples; central finite differences for slope; no terrain synthesis',limitations=meta['limitations']))
    path=OUT/(name+'-terrain.json');path.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8');terrains.append(dict(id=name,path=path.name,sha256=sha(path.read_bytes())))

fits=[dict(id='MEDA57a',diameter=9.13,speed=1.68,diameterSigma=3.1,speedSigma=.52,source='Hueso Table S3, published model fit'),dict(id='MEDA57b',diameter=18.87,speed=1.91,diameterSigma=5.58,speedSigma=.57,source='Hueso Table S3, published model fit'),dict(id='PIA26074',diameter=60,speed=19/3.6,diameterSigma=None,speedSigma=None,source='NASA Sol899 approximate published image estimate; sensor noise below is an experimental assumption')]
cases=[]
families=['ahead','oblique-left','oblique-right','lateral','receding','inside']
bearings=[0,math.pi/4,-math.pi/4,math.pi/2,math.pi,.35]
# Development and holdout have disjoint positions, distances, approach angles and sensor seeds.
for split,count,seed in [('development',18,170701),('holdout',54,170799)]:
    rng=random.Random(seed)
    for i in range(count):
        family=i%6;fit=fits[(i//6)%3];terrain=['floor','ridge','navcam'][i%3]
        gap=([6,24,55] if split=='development' else [12,38,85])[(i//3)%3]
        radius=fit['diameter']/2+1
        bearing=bearings[family]+(rng.uniform(-.12,.12) if family not in [0,5] else 0)
        distance=radius*.55 if family==5 else radius+gap
        cases.append(dict(id=f'{split[:3]}-{i:03}',split=split,terrain=terrain,source=fit['id'],family=families[family],distance=distance,bearing=bearing,heading=rng.uniform(0,2*math.pi),startOffset=[rng.randint(-12,12),rng.randint(-12,12)],speed=[.4,.6,.9][(i//2)%3],reaction=[2,6,10][(i//4)%3],sensorSeed=seed+i*37,truth=('linear' if i%3==0 else 'turn' if i%3==1 else 'growth'),turnDegrees=(-18 if i%2 else 18),growthMps=.035,positionSigma=.75,diameterSigmaFraction=.08))
protocol=dict(version=7,frozenAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),parent='21cee87',sources=fits,terrains=terrains,cases=cases,
    geometry=dict(bearingsDegrees=list(range(0,360,30)),distanceRules=['0.5R','R','R+5','R+15','R+30','R+60','R+100','R+250'],walking=[.4,.6,.9],reaction=[2,6,10],margin=1,headingSamples=720),
    common=dict(margin=1,replanSeconds=2,sensorCadence=2,tickSeconds=.5,horizonSeconds=36,returnAt=70,finishBy=230,oxygenSeconds=520,batterySeconds=520,fixedReserveSeconds=104,missionSeconds=420,loadKg=12,maxSlope=25),
    policySelection=dict(candidates=[0,.25,.5],metric='Development mean actual continuous contact; reject increases in return failure; tie break extra HOLD then route length. Freeze chosen weight before holdout.',fallback='If no policy beats the matched endpoint reference, retain endpoint reference and report failure.'),
    limitations=['All 72 placements and virtual position/radius fixes are synthetic, not independent actual observations. Source diameter and drift priors come from observations.','Raw MEDA weather is not used as a 2D position sensor.','1 m spacing is not rock-scale traversability or registration accuracy. Missing/steep support is blocked.','Same actual remaining budgets, delay, observations, execution and terrain apply to all non-oracle arms.','Free-plane geometry omits resources and terrain and is a separate reference, not pooled with DEM performance.','Navcam is local north/east; orbital DEM is east/south. They are never overlaid without registration.','No guarantee, physical injury rate, CFD or calibrated probability is claimed.'])
(OUT/'protocol.json').write_text(json.dumps(protocol,indent=2),encoding='utf-8')
print('Frozen cases',len(cases),'hash',sha((OUT/'protocol.json').read_bytes()))
for t in terrains:print(t)
