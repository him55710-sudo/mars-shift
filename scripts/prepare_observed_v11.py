"""Offline input inventory. Published records remain separate from model outputs."""
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as E
import csv, hashlib, json

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'data-cache/hazards'
OUT=ROOT/'public/data/hazards/observed-v11'
OUT.mkdir(exist_ok=True)
target=OUT/'pressure-input.json'
if target.exists(): raise SystemExit('Refusing overwrite: '+str(target))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
table=CACHE/'Table_S2_Mars_Jezero_MEDA_Vortices.xlsx'
register=json.loads((CACHE/'zenodo-record.json').read_text())
published=next(f for f in register['files'] if f['key']==table.name)
assert hashlib.md5(table.read_bytes()).hexdigest()==published['checksum'].split(':')[1]
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with ZipFile(table) as z:
    strings=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml'))]
    rows=[]
    for row in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:row',ns):
        r={}
        for c in row:
            v=c.find('s:v',ns)
            if v is not None:r[''.join(a for a in c.attrib['r'] if a.isalpha())]=strings[int(v.text)] if c.attrib.get('t')=='s' else v.text
        rows.append(r)
    assert rows[0]['C']=='SCLK' and rows[0]['G']=='Amp(Pa)'
sources=[dict(file=table.name,sha256=sha(table),url=published['links']['self'],publishedMD5=published['checksum'])]
days=[]
recorded=json.loads((ROOT/'public/data/hazards/observed-v6/recordings.json').read_text())
for sol in [57,215]:
    name=f'WE__{sol:04d}___________DER_PS__________________P01.CSV'
    file=CACHE/name
    provenance=next(s for s in recorded['sources'] if s['file']==name)
    assert sha(file)==provenance['sha256']
    sources.append(provenance)
    samples=[];rejected=0
    for r in csv.DictReader(file.open(encoding='utf-8-sig',newline='')):
        try:t,p=float(r['SCLK']),float(r['PRESSURE'])
        except ValueError:rejected+=1;continue
        if not 100<=p<=1500:rejected+=1;continue
        samples.append([t,p])
    assert all(b[0]>a[0] for a,b in zip(samples,samples[1:]))
    catalog=[dict(id=f"S2-row-{i+1}",sol=sol,time=float(r['C']),amplitude=float(r['G']),ltst=r['E'],gaussianFWHM=float(r['I'])) for i,r in enumerate(rows) if r.get('A')==str(sol)]
    days.append(dict(sol=sol,samples=samples,catalog=catalog,rejected=rejected,source=name))
target.write_text(json.dumps(dict(kind='ARCHIVED_MEDA_FULL_AVAILABLE_PRODUCTS',sources=sources,days=days,
    limits=['S2 pressure-dip catalog is retrospective; not every dip is dusty.',
            'Catalog agreement is not independent 2D trajectory validation.',
            'Invalid rows and time gaps are not interpolated; missing pressure uncertainty is not set to zero.']),separators=(',',':')),encoding='utf-8')
print(json.dumps([dict(sol=d['sol'],samples=len(d['samples']),catalog=len(d['catalog']),rejected=d['rejected']) for d in days]))
