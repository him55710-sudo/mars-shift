"""Write once, before performance experiments. Synthetic events, not new observations."""
import json, random, hashlib
from pathlib import Path
from datetime import datetime, timezone

root = Path('public/data/hazards/vortex-v9')
root.mkdir(parents=True, exist_ok=True)
old = json.loads(Path('public/data/hazards/vortex-v8/protocol-confirmation.json').read_text())
cases = []
for split, repeats, seed in [('development', 1, 910000), ('holdout', 2, 920000)]:
    n = 0
    for repeat in range(repeats):
        for terrain in ['floor', 'ridge']:
            for source in old['sources']:
                for family in ['wind', 'meander', 'gust']:
                    event = f'{split}-{n:03d}'
                    r = random.Random(seed + n)
                    speed = r.choice([.4, .9])
                    factor = r.choice([.65, 1, 1.6])
                    radius = source['diameter']/2 + 1
                    gap = source['speed']*10 + radius*(source['speed']/(speed/1.18)-1)
                    # Bearings are fully crossed within every underlying synthetic motion event.
                    for k, bearing in enumerate([-.35, 0, .35]):
                        c = dict(old['cases'][0])
                        c.update(id=f'{event}-b{k}', event=event, split=split, terrain=terrain,
                                 source=source['id'], truth=family, family=family,
                                 distance=radius+factor*gap,
                                 bearing=bearing, speed=speed, windDay=1+(n//3)%3 if split=='development' else 4+(n//3)%3,
                                 truthSeed=seed+n, sensorSeed=seed+10000+n*3+k,
                                 budget=520 if repeat==0 else 330, gapFactor=factor,
                                 dropout=n%4==0, cadence=[1,2,4][(n//3)%3])
                        # Same orientation and noise-free trajectory shape for all three placements.
                        c['heading'] = random.Random(seed+n+100000).uniform(-3.14159,3.14159)
                        cases.append(c)
                    n += 1
protocol = dict(version=9, frozenAt=datetime.now(timezone.utc).isoformat(), sources=old['sources'], cases=cases,
    scope='Conditional synthetic-seed validation on previously seen DEM and measured Earth wind; NOT independent observed Mars validation.',
    definitions=dict(contact='Positive duration inside physical radius + 1 m margin; continuous piecewise-linear relative intersection at truth knots (0.25 s).',
                     warning='Arrival of leading risk boundary, not center. Growth, turning and virtual measurement latency explicit.',
                     reaction=6, processing=1, replanning=2, horizon=48, graphTick=.5,
                     evaluationUntil=180, returnDeadline=360, shelter=False,
                     sameConstraints='Every arm shares graph, speed, sensor delivery, reaction and oxygen/battery reserves; Oracle differs only in future trajectory.'),
    selection=dict(predictors=['CV_SMOOTH','LOCAL7','IMM'], nominalSigmas=[0], candidateSigmas=[.5],
                   objective=['returnFailures','meanContact','meanActiveHold'],
                   rule='Choose each class only on development; freeze selection and source hashes before opening holdout.'),
    gate=dict(relativeContactReduction=.20, lowerClusterBootstrapGain=0, noContactGain=.05,
              returnFailureIncrease=0, budgetViolationIncrease=0, activeHoldIncreaseSeconds=0,
              p95LatencyLimitMs=100, primaryComparator='development-selected SIPP nominal',
              interpretation='Project promotion target, not a scientific or safety standard. All gates must pass.'),
    statistics=dict(unit='synthetic event (all three bearing placements clustered)', bootstrap=5000, seed=931731,
                    caveat='Conditional on six reused Earth wind windows and shared generator. Not a population confidence interval for Mars. No optional stopping.'),
    limitations=['Terrain restricts walking but does not steer vortex truth: no validated local CFD.',
                 'Synthetic turn/growth distributions are stress assumptions, not fitted Mars probabilities.',
                 'Virtual 2D sensors assume metric localization, with no occlusion or image-to-ground uncertainty.',
                 'Wind windows and DEM have been examined before. Only synthetic seeds are new.',
                 'No separate sand-trap truth or terrain-risk ablation in this comparison.'])
p = root/'protocol.json'
with p.open('x', encoding='utf8', newline='\n') as f: json.dump(protocol, f, indent=2)
print(len(cases), 'cases', hashlib.sha256(p.read_bytes()).hexdigest())
