"""Retrieve the actual published Earth analog files; preserve raw bytes and provenance."""
import urllib.request,pathlib,json,hashlib,time
root=pathlib.Path('../data-cache/hazards/toledo-2023');root.mkdir(exist_ok=True,parents=True)
def fetch(url):
 for attempt in range(3):
  try:return urllib.request.urlopen(url,timeout=40).read()
  except Exception:
   if attempt==2:raise
   time.sleep(1)
record=fetch('https://zenodo.org/api/records/7930641');data=json.loads(record)
(root/'record.json').write_bytes(record)
files=[]
for f in data['files']:
 p=root/f['key']
 if not p.exists():p.write_bytes(fetch(f['links']['self']))
 if p.stat().st_size!=f['size']:raise ValueError('Wrong byte count '+str(p))
 if f.get('checksum','').startswith('md5:') and hashlib.md5(p.read_bytes()).hexdigest()!=f['checksum'][4:]:raise ValueError('Publisher checksum mismatch '+str(p))
 files.append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'url':f['links']['self']})
manifest={'record':data['id'],'doi':data['doi'],'title':data['metadata']['title'],'license':data['metadata'].get('license'),'files':files,'limitation':'Terrestrial field campaign, not a Martian dust-devil ground-truth trajectory dataset'}
p=pathlib.Path('public/data/hazards/vortex-v8/acquisition.json')
if p.exists():raise RuntimeError('Refusing overwrite '+str(p))
p.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');print(len(files),'raw files verified')
