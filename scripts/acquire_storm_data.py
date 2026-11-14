"""Public MDAD observations; preserves original file and provenance. No invented tracks."""
import csv, hashlib, json, math, pathlib, urllib.request

cache = pathlib.Path('../data-cache/hazards')
out = pathlib.Path('public/data/hazards')
url = 'https://dataverse.harvard.edu/api/access/datafile/3607412?format=original'
path = cache / 'MDAD.csv'
if not path.exists():
    path.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=60).read())
raw = path.read_bytes()
if len(raw) != 2380661:
    raise ValueError('Original file length differs from Harvard metadata; inspect before use')
rows = list(csv.DictReader(raw.decode('utf-8-sig').splitlines()))
groups, excluded = {}, {'missing':0, 'confidence':0, 'mergeSplit':0, 'invalid':0}
for r in rows:
    r = {k:v.strip() for k,v in r.items()}
    if r['Missing data'].lower() != 'no': excluded['missing'] += 1; continue
    if float(r['Confidence interval']) < 75: excluded['confidence'] += 1; continue
    if '+' in r['Member ID'] or r['Member ID'][-1:].isalpha(): excluded['mergeSplit'] += 1; continue
    item = dict(year=int(r['Mars Year']), phase=r['Mission subphase'], sol=int(r['Sol']), lon=float(r['Centroid longitude']), lat=float(r['Centroid latitude']), areaKm2=float(r['Area (square km)']), confidence=int(r['Confidence interval']), member=r['Member ID'])
    if not all(math.isfinite(item[k]) for k in ['sol','lon','lat','areaKm2']) or item['areaKm2']<=0: excluded['invalid'] += 1; continue
    # Sol numbering resets per mission subphase: never join across that boundary.
    key = f"{item['year']}/{item['phase']}/{item['member']}"
    groups.setdefault(key, []).append(item)
tracks = []
for key, observations in sorted(groups.items()):
    observations.sort(key=lambda x:x['sol'])
    if len({x['sol'] for x in observations}) != len(observations):
        raise ValueError('Duplicate observation time for '+key)
    if len(observations) >= 3: tracks.append({'id':key, 'observations':observations})
payload = dict(schemaVersion=1, kind='ACTUAL_ORBITAL_STORM_CATALOG', attribution='Battalio & Wang, MDAD v1, Harvard Dataverse; NASA MDAP supported', doi='10.7910/DVN/F8R2JX', license='CC0-1.0', source=url, sha256=hashlib.sha256(raw).hexdigest(), originalBytes=len(raw), originalRows=len(rows), exclusions=excluded, usableRows=sum(len(v) for v in groups.values()), tracks=tracks, spatialMeaning='Observed centroid and area; equivalent-area circle is a proxy, not observed storm boundary', temporalMeaning='Sol of mission subphase; no joins across subphase. Daily mosaics are not instantaneous scans.')
(out/'storm-tracks.json').write_text(json.dumps(payload, separators=(',',':')),encoding='utf8')
print(json.dumps({k:v for k,v in payload.items() if k!='tracks'}))
print('tracks',len(tracks),'observations',sum(len(t['observations']) for t in tracks))
