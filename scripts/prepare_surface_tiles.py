"""Build a bounded multiresolution display pyramid from verified real HiRISE crops.

No new terrain is generated. Run with the project's ../.venv/Scripts/python.
The native crop and contrast policy match prepare_surface_optical.py.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT.parent / 'data-cache'
TILE = 512

def build(region):
    folder = ROOT / 'public/data' / ('' if region == 'floor' else region)
    source = json.loads((folder / 'surface-optical-meta.json').read_text(encoding='utf-8'))
    with np.load(CACHE / f'surface-optical-{region}-0_3m.npz') as data:
        raw = data['image']
        assert hashlib.sha256(np.asarray(raw, dtype='<f4').tobytes()).hexdigest() == source['source']['cropFloat32Sha256']
    lo, hi = source['processing']['contrastRawRange']
    image = Image.fromarray(np.round(np.clip((np.nan_to_num(raw,nan=lo)-lo)/(hi-lo), 0, 1)*255).astype('uint8'))
    if not np.isfinite(raw).all():
        image = image.convert('RGBA')
        image.putalpha(Image.fromarray((np.isfinite(raw)*255).astype('uint8')))
    output = folder / 'surface-tiles'
    output.mkdir(exist_ok=True)
    levels = []
    for level, size in enumerate([834, 1667, 3334]):
        scaled = image.resize((size, size), Image.Resampling.LANCZOS) if size != image.width else image
        tiles = []
        for y in range((size+TILE-1)//TILE):
            for x in range((size+TILE-1)//TILE):
                bounds = [x*TILE, y*TILE, min((x+1)*TILE,size), min((y+1)*TILE,size)]
                crop = scaled.crop(bounds)
                name = f'{level}-{x}-{y}.webp'
                path = output / name
                crop.save(path, quality=97, method=6)
                encoded = path.read_bytes()
                tiles.append({'x':x, 'y':y, 'url':name, 'width':crop.width, 'height':crop.height,
                              'bytes':len(encoded), 'sha256':hashlib.sha256(encoded).hexdigest()})
        levels.append({'level':level, 'pixels':size, 'metresPerPixel':1000/size, 'tiles':tiles})
    manifest = {'schemaVersion':1, 'region':region, 'classification':'OBSERVED', 'tileSize':TILE,
                'bounds':source['bounds'], 'crs':source['crs'], 'levels':levels,
                'credit':source['credit'], 'sourceCropSha256':source['source']['cropFloat32Sha256'],
                'processing':'Same contrast as native surface product; Lanczos lower-resolution display levels, WebP97. Native level is not upsampled.',
                'registrationResidualMetres':None, 'limitations':source['limitations']}
    (output / 'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'region':region,'tiles':sum(len(l['tiles']) for l in levels),'bytes':sum(t['bytes'] for l in levels for t in l['tiles'])}))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--region',choices=['floor','ridge','noah','both'],default='both')
    args=parser.parse_args()
    for region in ['floor','ridge'] if args.region=='both' else [args.region]:
        build(region)
