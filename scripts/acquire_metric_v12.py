"""Reacquire/verify exactly the archived Sol 215 sources; never overwrite them.

Run from any directory. --verify-only performs no network requests.
Registration JSONs are archived intermediate measurements, not new detections.
"""
from pathlib import Path
import argparse
import hashlib
import json
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/hazards/metric-v12'
CACHE = ROOT.parent / 'data-cache/hazards/metric-v12'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--verify-only', action='store_true')
args = parser.parse_args()
CACHE.mkdir(parents=True, exist_ok=True)
inputs = json.loads((OUT / 'inputs.json').read_text(encoding='utf-8'))
manifest = json.loads((OUT / 'source-manifest.json').read_text(encoding='utf-8'))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def acquire(name, url, expected):
    path = CACHE / name
    if path.exists():
        assert digest(path.read_bytes()) == expected, f'Changed cache: {name}'
        return
    if args.verify_only:
        raise FileNotFoundError(path)
    with urllib.request.urlopen(url, timeout=120) as response:
        data = response.read()
    assert digest(data) == expected, f'Source content changed: {name}; not saved'
    with path.open('xb') as f:
        f.write(data)


for p in inputs['products']:
    acquire(p['id'] + '.IMG', p['imageUrl'], p['imageSha256'])
    acquire(p['id'] + '.xml', p['labelUrl'], p['labelSha256'])

base = 'https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9747922/'
acquire('paper.xml', base + 'fullTextXML', manifest['files']['paper.xml'])
acquire('supplementary.zip', base + 'supplementaryFiles', manifest['files']['supplementary.zip'])
# Extract only exact, explicitly listed scientific files; never extract paths.
with zipfile.ZipFile(CACHE / 'supplementary.zip') as archive:
    for name, expected in manifest['files'].items():
        if not name.startswith('41467_'):
            continue
        path = CACHE / name
        if path.exists():
            assert digest(path.read_bytes()) == expected, f'Changed supplement: {name}'
            continue
        if args.verify_only:
            raise FileNotFoundError(path)
        members = [m for m in archive.namelist() if Path(m).name == name]
        assert len(members) == 1, f'Ambiguous supplement: {name}'
        data = archive.read(members[0])
        assert digest(data) == expected, f'Changed source: {name}'
        with path.open('xb') as f:
            f.write(data)

for name, expected in manifest['registration'].items():
    source = OUT / 'registration' / name
    assert digest(source.read_bytes()) == expected, f'Changed annotation: {name}'
    path = CACHE / name
    if path.exists():
        assert digest(path.read_bytes()) == expected
    elif args.verify_only:
        raise FileNotFoundError(path)
    else:
        with path.open('xb') as f:
            f.write(source.read_bytes())

for protocol_name in ['protocol.json', 'ranged-protocol.json']:
    protocol = json.loads((OUT / protocol_name).read_text(encoding='utf-8'))
    for path, expected in protocol['hashes'].items():
        assert digest((ROOT / path).read_bytes()) == expected, f'Changed frozen input: {path}'
print('Verified 20 PDS image/label pairs, paper, supplement archive + 3 extracts, '
      '4 registration intermediates, and both frozen source protocols.')
