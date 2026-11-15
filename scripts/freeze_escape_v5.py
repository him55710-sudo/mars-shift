"""Create, never overwrite, the pre-change scenario and historical artifact manifest."""
import json, hashlib, random
from pathlib import Path
root=Path('public/data/hazards'); dest=root/'escape-v5'; dest.mkdir(exist_ok=True)
events=json.loads((root/'jezero-vortex-parameters.json').read_text())['events']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
cases=[]
for split,n,seed0 in [('diagnostic',12,15001),('holdout',36,17001)]:
 for i in range(n):
  rng=random.Random(seed0+i); e=events[(i*7+(0 if split=='diagnostic' else 3))%len(events)]
  cases.append(dict(id=f'{split}-{i+1:02}',split=split,seed=seed0+i,
   region='floor' if i%2==0 else 'ridge',event=e['id'],diameter=e['diameter'],speed=e['speedMps'],
   walking=[.4,.6,.9][i%3],warning=[12,28,50][(i//3)%3],offsetFraction=[0,.5,1.2][(i//2)%3],
   heading=rng.random()*6.283185307179586,startFraction=[.3+rng.random()*.4,.3+rng.random()*.4],
   growth=0 if split=='diagnostic' else [0,0,.04][i%3],
   turnDegrees=0 if split=='diagnostic' else [0,0,0,20,-20,0][i%6],turnTime=24,
   budgetSlack=45 if i%4==0 else 180,initiallyInside=split=='holdout' and i in [10,31]))
old=[*root.glob('dust-escape-*'),*root.glob('v4-*')]
sources=[Path(p) for p in ['src/hazard-mpc.ts','src/hazard-planner.ts','src/dust-devil-geometry.ts','src/local-return.ts','src/local-dust-tracker.ts','docs/ESCAPE_V5_PROTOCOL.md','public/data/terrain.json','public/data/ridge/terrain.json']]
doc=dict(version=5,scope='SYNTHETIC_NEW_GEOMETRY_KNOWN_PARAMETERS',contactPaddingMetres=1,
 warningDefinition='STATIONARY_FIRST_BOUNDARY_ENTRY; nominal placement only for growth/turn cases',
 detectionTime=0,estimateReadyTime=4,firstActionTime=6,contactToleranceSeconds=1e-8,
 historicalHashes={str(p).replace('\\','/'):sha(p) for p in old},sourceHashes={str(p).replace('\\','/'):sha(p) for p in sources},cases=cases)
with (dest/'manifest.json').open('x',encoding='utf8') as f:json.dump(doc,f,indent=2)
print('Frozen',len(cases),'cases; existing files were not overwritten.')
