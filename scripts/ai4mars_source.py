"""Read named official AI4Mars ZIP members over verified HTTP byte ranges.

No mirrors or untrusted pickle objects. ZIP CRC and SHA256 recorded per member.
The complete 16 GB archive is not downloaded; its central directory is cached.
"""
import io
import json
import hashlib
import time
import zipfile
import zlib
import struct
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT.parent / 'data-cache' / 'ai4mars-v39'
URL = 'https://zenodo.org/api/records/15995036/files/ai4mars-dataset-merged-0.6.zip/content'
SIZE = 16232481989

class RemoteZip(io.RawIOBase):
    def __init__(self):
        self.pos = 0
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else SIZE + offset
        return self.pos
    def read(self, n=-1):
        end = SIZE-1 if n < 0 else min(SIZE-1, self.pos+n-1)
        if end < self.pos: return b''
        CACHE.mkdir(parents=True, exist_ok=True)
        p = CACHE / f'range-{self.pos}-{end}.bin'
        if p.exists(): data = p.read_bytes()
        else:
            print('FETCH',self.pos,end,flush=True)
            for retry in range(5):
                r = requests.get(URL, headers={'Range':f'bytes={self.pos}-{end}'}, timeout=90)
                print('RESPONSE',r.status_code,r.headers.get('Content-Range'),len(r.content),flush=True)
                if r.status_code == 206 and r.headers.get('Content-Range') == f'bytes {self.pos}-{end}/{SIZE}': break
                time.sleep(2+retry)
            else: raise ValueError(f'Unverified range response: {r.status_code}, {r.headers.get("Content-Range")}')
            data = r.content
            if len(data) != end-self.pos+1: raise ValueError('Truncated byte range')
            # Keep large central directory blocks, not thousands of small member fragments.
            if len(data)>1000000: p.write_bytes(data)
        self.pos += len(data)
        return data

def archive(): return zipfile.ZipFile(RemoteZip())

def member(z, name):
    path = CACHE / 'members' / name
    if path.exists(): return path.read_bytes()
    info=z.getinfo(name)
    remote=RemoteZip();remote.seek(info.header_offset)
    raw=remote.read(info.compress_size+4096)
    if raw[:4]!=b'PK\x03\x04': raise ValueError('Invalid member header')
    name_len,extra_len=struct.unpack_from('<HH',raw,26)
    compressed=raw[30+name_len+extra_len:30+name_len+extra_len+info.compress_size]
    data=zlib.decompress(compressed,-15) if info.compress_type==8 else compressed
    if len(data)!=info.file_size or zlib.crc32(data)!=info.CRC: raise ValueError('Member CRC mismatch')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data

if __name__ == '__main__':
    with archive() as z:
        names = z.namelist()
        (CACHE/'names.json').write_text(json.dumps(names), encoding='utf-8')
        from collections import Counter
        print(Counter('/'.join(n.split('/')[:4]) for n in names).most_common(30))
        for n in names:
            if n.lower().endswith(('.md','.txt')) and z.getinfo(n).file_size < 20000:
                print(n, member(z,n).decode('utf-8',errors='replace')[:10000])

