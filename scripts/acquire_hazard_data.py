"""Reproduce small public MEDA products and a licensed published vortex catalog.
No credentials, no MCD redistribution, no interpolation over missing observations.
Run from repository root: python scripts/acquire_hazard_data.py [--offline]
"""
import csv
import hashlib
import io
import json
import pathlib
import statistics
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT.parent / 'data-cache' / 'hazards'
OUT = ROOT / 'public' / 'data' / 'hazards'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
OFFLINE = '--offline' in sys.argv
PDS = 'https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/'
PRODUCTS = [
 ('WE__0057___________DER_WS__________________P02', 'sol_0000_0089/sol_0057/'),
 ('WE__0057___________DER_PS__________________P01', 'sol_0000_0089/sol_0057/'),
]
provenance = []
def get(url, filename, expected=None):
    path = CACHE / filename
    if not path.exists():
        if OFFLINE:
            raise FileNotFoundError(path)
        path.write_bytes(urllib.request.urlopen(url, timeout=90).read())
    data = path.read_bytes()
    if expected and hashlib.md5(data).hexdigest() != expected:
        raise ValueError('Published checksum mismatch: ' + filename)
    provenance.append(dict(url=url, file=filename, bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), publishedMD5=expected))
    return data

record = json.loads(get('https://zenodo.org/api/records/7315862', 'zenodo-record.json'))
table = next(f for f in record['files'] if f['key'].startswith('Table_S3'))
data = get(table['links']['self'], table['key'], table['checksum'].split(':')[1])
z = zipfile.ZipFile(io.BytesIO(data))
ns = {'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
rows = []
for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:row', ns):
    r = {}
    for cell in row:
        val = cell.find('s:v', ns)
        if val is None:
            continue
        r[''.join(c for c in cell.attrib['r'] if c.isalpha())] = strings[int(val.text)] if cell.attrib.get('t') == 's' else val.text
    rows.append(r)
catalog = []
for row in rows[1:]:
    if not row.get('T') or not row.get('X'):
        continue
    catalog.append(dict(event=row['A'], ltst=row['C'], diameter=float(row['T']), diameterSigma=float(row['U']), advection=float(row['X']), advectionSigma=float(row['Y']), centralDropPa=float(row['R']), nearSurfaceTemperatureK=float(row['M']), kind='PUBLISHED_MODEL_FIT'))

def numeric(row, field, lo, hi):
    try:
        v = float(row[field])
        return v if lo <= v <= hi else None
    except (ValueError, KeyError):
        return None

tables = {}
for name, subdir in PRODUCTS:
    for ext in ['xml', 'CSV']:
        data = get(PDS + 'data_derived_env/' + subdir + name + '.' + ext, name + '.' + ext)
        if ext == 'CSV':
            tables['wind' if '_WS_' in name else 'pressure'] = list(csv.DictReader(io.StringIO(data.decode('utf-8-sig'))))
wind = [r for r in tables['wind'] if numeric(r, 'HORIZONTAL_WIND_SPEED', 0, 100) is not None and numeric(r,'WIND_DIRECTION',0,360) is not None and r['ROVER_STILL'] == '1']
pressure = [r for r in tables['pressure'] if numeric(r, 'PRESSURE', 100, 1500) is not None]
def stats(a):
    a = sorted(a)
    return dict(count=len(a), min=a[0], median=statistics.median(a), max=a[-1], p05=a[int((len(a)-1)*.05)], p95=a[int((len(a)-1)*.95)])
summary = dict(schemaVersion=1, kind='ARCHIVED_OBSERVATION_AND_PUBLISHED_FIT', sol=57,
    wind=stats([float(r['HORIZONTAL_WIND_SPEED']) for r in wind]), pressure=stats([float(r['PRESSURE']) for r in pressure]),
    rejectedWindRows=len(tables['wind'])-len(wind), totalWindRows=len(tables['wind']),
    missingWindUncertaintyRows=sum(not r['HORIZONTAL_WIND_SPEED_UNCERTAINTY'] for r in wind),
    catalog=catalog, catalogDiameter=stats([r['diameter'] for r in catalog]), catalogAdvection=stats([r['advection'] for r in catalog]),
    background=dict(speedMps=statistics.median(float(r['HORIZONTAL_WIND_SPEED']) for r in wind),pressurePa=statistics.median(float(r['PRESSURE']) for r in pressure),temperatureK=statistics.median(r['nearSurfaceTemperatureK'] for r in catalog)),
    limitations=[
        'Sol 57 is a selected historical example, not current weather or a representative Mars climatology.',
        'Quality: derived products only; stationary rover; numeric fill values and blank retrievals rejected. Missing uncertainty is retained, never converted to zero.',
        'S3 diameters and advection speeds are author model fits, not independent direct track measurements. Catalog selection favors modeled events.',
        'Wind direction frame is not assimilated into map coordinates without ancillary geometry verification. Scenario headings are simulated.',
        'No public ground-truth EVA damage labels or 2D vortex time series are in these inputs.',
        'MCD and published RANS CFD are contextual references; no licensed MCD grids or locally validated CFD vector field is bundled.'
    ], sources=provenance, catalogCredit='Hueso et al., Zenodo 7315863, Table S3; CC BY 4.0',
    catalogURL='https://doi.org/10.5281/zenodo.7315863',medaURL=PDS, retrievedClientDate='2026-11-15')
(OUT/'observations.json').write_text(json.dumps(summary,indent=2,allow_nan=False),encoding='utf-8')
# Retain a readable short observed time window. No invented spatial tracks.
sampleWind=[r for r in wind if '0057 10:5' in r['LTST']][::2]
samplePressure=[r for r in pressure if '0057 10:5' in r['LTST']]
(OUT/'meda-sol57-window.json').write_text(json.dumps(dict(kind='ARCHIVED_MEDA',wind=sampleWind,pressure=samplePressure),separators=(',',':')),encoding='utf-8')
print(json.dumps({k:summary[k] for k in ['wind','pressure','catalogDiameter','catalogAdvection','rejectedWindRows','missingWindUncertaintyRows']},indent=2))
