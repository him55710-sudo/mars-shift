"""Download the published DEM and thermal context; never bypass TLS verification."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin
import hashlib, json, re, urllib.request
import truststore
truststore.inject_into_ssl()
import requests

CACHE=Path(__file__).resolve().parents[2]/'data-cache'
CACHE.mkdir(exist_ok=True)
RECORD='https://data.caltech.edu/api/records/stqse-yay61'

def download(url, path, checksum=None):
    if path.exists() and (not checksum or hashlib.md5(path.read_bytes()).hexdigest()==checksum):
        print('Cached:',path.name,flush=True);return
    print('Downloading:',path.name,flush=True)
    with requests.get(url,stream=True,timeout=120) as response, path.with_suffix('.part').open('wb') as f:
        response.raise_for_status()
        for block in response.iter_content(1024*1024): f.write(block)
    part=path.with_suffix('.part')
    if checksum and hashlib.md5(part.read_bytes()).hexdigest()!=checksum:
        raise ValueError('Source checksum failed: '+path.name)
    part.replace(path)
    print('Verified:',path.name,path.stat().st_size,flush=True)

def dem():
    record=requests.get(RECORD,timeout=40).json()
    (CACHE/'caltech-record.json').write_text(json.dumps(record,indent=2))
    f=record['files']['entries']['cenjez_DEM_1m.tif']
    download(f['links']['content'],CACHE/f['key'],f['checksum'].split(':')[1])

def thermal():
    root='https://murray-lab.caltech.edu/Mars2020/'
    # Validate using the operating system's trusted CA store.
    response=requests.get(root,timeout=40);response.raise_for_status();html=response.text
    links=re.findall(r'href=[\"\x27]([^\"\x27]+)',html)
    url=urljoin(root,next(u for u in links if 'THEMIS_TI_Quantitative.zip' in u))
    (CACHE/'thermal-source.txt').write_text(url)
    download(url,CACHE/'THEMIS_TI_Quantitative.zip')

if __name__=='__main__':
    failed=0
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(dem),pool.submit(thermal)]
        for f in futures:
            try:f.result()
            except Exception as e:
                failed+=1
                print(type(e).__name__,str(e),flush=True)
    if failed:raise SystemExit(1)
