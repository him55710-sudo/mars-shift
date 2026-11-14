"""Read published boundary coordinates from a tar stream; never extract archive paths."""
import csv, hashlib, io, json, pathlib, tarfile, urllib.request
cache=pathlib.Path('../data-cache/hazards'); out=pathlib.Path('public/data/hazards')
url='https://zenodo.org/api/records/7480334/files/MY31.tar.gz/content'
path=cache/'MY31.tar.gz'
if not path.exists():
    with urllib.request.urlopen(url,timeout=90) as r, path.open('wb') as f:
        while chunk:=r.read(1024*1024): f.write(chunk)
digest=hashlib.md5(path.read_bytes()).hexdigest()
if digest!='7b92f2c156ecb9287545887a85cb8dc7': raise ValueError('Published MD5 mismatch')
examples=json.loads((out/'storm-evaluation.json').read_text(encoding='utf8'))['examples']
names={f"{p['phase']}_day{p['sol']:02d}_{p['member']}.csv":f"{s['id']}/{p['sol']}" for s in examples for p in s['observations']}
fixes={s['id']+'/'+str(p['sol']):p for s in examples for p in s['observations']}
boundaries={}; samples=[]
with tarfile.open(path,mode='r:gz') as archive:
    for item in archive:
        name=pathlib.PurePosixPath(item.name).name
        if name.endswith('.csv') and len(samples)<3:samples.append(name)
        if name not in names or not item.isfile():continue
        text=archive.extractfile(item).read().decode('utf8')
        coords=[[float(x) for x in row[:2]] for row in csv.reader(io.StringIO(text)) if len(row)>=2]
        boundaries[names[name]]=coords
        if len(boundaries)==len(names): break
invalid=[]; outside=[]
for key, coords in boundaries.items():
    center=fixes[key]
    if not coords or not all(-180<=x<=180 and -90<=y<=90 for x,y in coords): invalid.append(key)
    x=[((p[0]-center['lon']+540)%360)-180 for p in coords]; y=[p[1] for p in coords]
    if not x or not (min(x)<=0<=max(x) and min(y)<=center['lat']<=max(y)): outside.append(key)
validation={'count':len(boundaries),'invalidGeographicRange':invalid,'centroidOutsideBounds':outside,'passedBoth':len(set(boundaries)-set(invalid)-set(outside)),'note':'Raw coordinates preserved without inferred offsets. Basic checks cannot establish cross-version registration. All overlays withheld pending reconciliation.'}
payload={'registration':'UNVERIFIED','validation':validation,'kind':'OBSERVED_MANUAL_BOUNDARY_PIXELS','source':url,'doi':'10.5281/zenodo.7480334','attribution':'Battalio, Wang, Richardson, Toigo & Saidel, MDAD v1.1','license':'CC-BY-4.0','md5':digest,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'resolutionDegrees':.1,'boundaries':boundaries}
(out/'storm-boundaries.json').write_text(json.dumps(payload,separators=(',',':')),encoding='utf8')
print('matched',len(boundaries),'invalid range',len(invalid),'center outside bounds',len(outside),'passed both',validation['passedBoth'])
