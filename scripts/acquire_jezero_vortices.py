import json,hashlib,urllib.request,zipfile,xml.etree.ElementTree as E
from pathlib import Path
CACHE=Path('../data-cache/hazards'); OUT=Path('public/data/hazards')
name='Table_S3_Mars_MEDA_Pressure_Winds_Modeled_Vortices.xlsx'
url='https://zenodo.org/api/records/7315863/files/'+name+'/content'
p=CACHE/name
if not p.exists():p.write_bytes(urllib.request.urlopen(url,timeout=60).read())
raw=p.read_bytes();assert hashlib.md5(raw).hexdigest()=='7efe9e5281ef6b535d17e956da0fe986'
z=zipfile.ZipFile(p);ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings=[''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml'))]
rows=[]
for row in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:row',ns):
 d={}
 for c in row.findall('s:c',ns):
  v=c.find('s:v',ns)
  if v is not None:d[''.join(i for i in c.attrib['r'] if i.isalpha())]=strings[int(v.text)] if c.attrib.get('t')=='s' else float(v.text)
 rows.append(d)
events=[]
for r in rows[1:]:
 if 'T' not in r:continue
 flags=['NEGATIVE_DIAMETER_SIGMA_IN_SOURCE'] if r['U']<0 else []
 events.append(dict(id=str(r['A'])+'/'+r['C'],sol=str(r['A']),ltst=r['C'],diameter=r['T'],diameterSigmaRaw=r['U'],speedMps=r['X'],speedSigma=r['Y'],driftAzimuthRaw=r['Z'],azimuthSigma=r['AA'],closestApproachMetres=r['V'],closestApproachSigma=r['W'],corePressureDropPa=r['R'],qualityFlags=flags,provenance='MODEL_INFERRED_FROM_MEDA_PRESSURE_AND_WIND'))
assert len(events)==22
data=dict(schemaVersion=1,doi='10.5281/zenodo.7315863',paper='https://doi.org/10.1029/2022JE007516',url=url,sha256=hashlib.sha256(raw).hexdigest(),md5=hashlib.md5(raw).hexdigest(),meaning='22 selected Jezero dust devils. Model-inferred parameters, not high-frequency position truth. Diameter denotes maximum-wind vortex diameter; U is drift velocity (paper Table 1).',selectionBias='Strong, dusty events with clear wind signatures and successful fits; biased toward close encounters. Not a population frequency sample.',events=events)
(OUT/'jezero-vortex-parameters.json').write_text(json.dumps(data,indent=2,allow_nan=False),encoding='utf8')
print('events',len(events),'diameter range',min(e['diameter'] for e in events),max(e['diameter'] for e in events),'speed range',min(e['speedMps'] for e in events),max(e['speedMps'] for e in events),'flags',[e['id'] for e in events if e['qualityFlags']])
