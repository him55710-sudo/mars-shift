"""Versioned recorded MEDA / NASA movie replay. Never fabricates ground tracks.
Run from repository root using ../research/.venv-hazards/Scripts/python.exe.
"""
from pathlib import Path
import csv, hashlib, json, statistics, urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT.parent / 'data-cache/hazards'
OUT = ROOT / 'public/data/hazards/observed-v6'
if (OUT / 'recordings.json').exists():
    raise SystemExit('Refusing to overwrite frozen recordings.json')
OUT.mkdir(parents=True, exist_ok=True)
PDS = 'https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/'
sources = []
def sha(data): return hashlib.sha256(data).hexdigest()
def product(sol, kind):
    name = f'WE__{sol:04d}___________DER_{kind}__________________P0{1 if kind=="PS" else 2}'
    sub = 'sol_0000_0089' if sol == 57 else 'sol_0180_0299'
    for ext in ['xml', 'CSV']:
        url = f'{PDS}{sub}/sol_{sol:04d}/{name}.{ext}'
        p = CACHE / f'{name}.{ext}'
        if not p.exists(): p.write_bytes(urllib.request.urlopen(url, timeout=90).read())
        data = p.read_bytes()
        if ext == 'xml' and b'Product_Observational' not in data: raise ValueError(url)
        sources.append(dict(url=url, file=p.name, bytes=len(data), sha256=sha(data)))
    return list(csv.DictReader(data.decode('utf-8-sig').splitlines()))
def number(row, key, lo, hi):
    try:
        value = float(row[key])
        return value if lo <= value <= hi else None
    except (ValueError, KeyError): return None

catalog = json.loads((ROOT/'public/data/hazards/observations.json').read_text())['catalog']
events = []
for sol in [57, 215]:
    pressure, wind = product(sol,'PS'), product(sol,'WS')
    for fit in [r for r in catalog if int(r['ltst'].split()[0]) == sol]:
        # Rounded LTST identifies the published event; elapsed time is SCLK Earth seconds.
        match = [r for r in pressure if r['LTST'].strip() == fit['ltst']]
        if not match: raise ValueError('No pressure timestamp matches '+fit['event'])
        center = min(float(r['SCLK']) for r in match)
        ps, ws, rejected = [], [], dict(pressure=0,wind=0)
        for rows, dest, kind in [(pressure,ps,'pressure'),(wind,ws,'wind')]:
            for row in rows:
                t = float(row['SCLK']) - center
                if abs(t) > 90: continue
                if kind == 'pressure':
                    value = number(row,'PRESSURE',100,1500)
                    if value is None: rejected[kind]+=1;continue
                    dest.append(dict(time=t, pressurePa=value))
                else:
                    v, d = number(row,'HORIZONTAL_WIND_SPEED',0,100),number(row,'WIND_DIRECTION',0,360)
                    if v is None or d is None or row['ROVER_STILL'].strip() != '1': rejected[kind]+=1;continue
                    dest.append(dict(time=t,speedMps=v,directionDeg=d,speedSigma=number(row,'HORIZONTAL_WIND_SPEED_UNCERTAINTY',0,100),bothBooms=row['BOTH_BOOMS_USED_FOR_RETRIEVAL'].strip()=='1'))
        for rows in [ps,ws]:
            if any(b['time']<=a['time'] for a,b in zip(rows,rows[1:])):raise ValueError('Non-monotonic source clock')
        def quality(rows):
            dt=[b['time']-a['time'] for a,b in zip(rows,rows[1:])]
            return dict(count=len(rows),medianCadenceSeconds=statistics.median(dt),maxGapSeconds=max(dt))
        # An invalid published uncertainty is not made positive or replaced with precision.
        sigma=fit['diameterSigma'] if fit['diameterSigma']>=0 else None
        events.append(dict(id=fit['event'],sol=sol,ltst=fit['ltst'],eventSCLK=center,pressure=ps,wind=ws,
            quality=dict(pressure=quality(ps),wind=quality(ws),rejected=rejected),
            fit=dict(diameterMetres=fit['diameter'],diameterSigma=sigma,speedMps=fit['advection'],speedSigma=fit['advectionSigma']),
            issues=[] if sigma is not None else ['Table S3 diameter uncertainty is negative (-1.23); not usable as sigma. No robust navigation based on that uncertainty.']))

movies = json.loads((ROOT/'public/data/hazards/local-observations.json').read_text())['events']
for e in movies:
    raw=(CACHE/e['file']).read_bytes()
    if sha(raw)!=e['sha256']: raise ValueError('Movie checksum changed')
    im=Image.open(CACHE/e['file']);e['imageSize']=list(im.size)
    directory=OUT/e['id'];directory.mkdir(exist_ok=True)
    for point in e['points']:
        im.seek(point['frame']);p=directory/f"{point['frame']:02d}.webp"
        im.convert('RGB').save(p,lossless=True)
        point['image']=f"/data/hazards/observed-v6/{e['id']}/{p.name}"
        point['imageSha256']=sha(p.read_bytes())

record=dict(schemaVersion=1,kind='RECORDED_INSTRUMENT_AND_IMAGE_REPLAY',integrationBase='7a643b7',events=events,movies=movies,sources=sources,
    catalogSource='https://doi.org/10.5281/zenodo.7315863',
    clock='SCLK elapsed Earth seconds; t=0 is the rounded published Table S3 event LTST, not an astronaut detection time.',
    limitations=['MEDA is a point sensor. Pressure/wind are not a 2D vortex position track; local wind is not vortex translation.',
    'Published diameter/translation estimates are retrospective model fits, not independent surveyed truth.',
    'Sol 57/215 recordings and Sol 477 Navcam terrain are different encounters. Relocation and heading are assumptions.',
    'Pressure uncertainty is not exported: blank values and a suspect kelvin unit in the source label are not repaired.',
    'Movie labels are curated ROI apparent-column FWHM in pixels; not wind boundary or ground radius.'])
(OUT/'recordings.json').write_text(json.dumps(record,indent=2,allow_nan=False),encoding='utf-8')
print(json.dumps([dict(id=e['id'],quality=e['quality'],issues=e['issues']) for e in events],indent=2))
