"""Bake display sun occlusion from the registered 1 m DEM, without new geometry.

The precomputed directional horizon follows Sol Atlas's shadow-bake approach;
this NumPy implementation and integration are original. No procedural rocks/noise.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image


def bake(z, cell=1.0, sun=(-48, 28, -32), reach=192, step=2):
    h, w = z.shape
    sx, up, sy = sun
    horizontal = np.hypot(sx, sy)
    if horizontal <= 0 or up <= 0:
        raise ValueError('Above-horizon oblique display sun required')
    margin = np.full(z.shape, np.inf, dtype=np.float32)
    for distance in range(step, reach + 1, step):
        dx, dy = round(sx / horizontal * distance / cell), round(sy / horizontal * distance / cell)
        if not dx and not dy:
            continue
        x0, x1, y0, y1 = max(0, -dx), min(w, w-dx), max(0, -dy), min(h, h-dy)
        if x1 <= x0 or y1 <= y0:
            continue
        a, b = z[y0:y1, x0:x1], z[y0+dy:y1+dy, x0+dx:x1+dx]
        clearance = a + np.hypot(dx, dy)*cell*up/horizontal - b
        clearance = np.where(np.isfinite(a) & np.isfinite(b), clearance, np.inf)
        np.minimum(margin[y0:y1, x0:x1], clearance, out=margin[y0:y1, x0:x1])
    # Bounded half-metre display penumbra, not uncertainty or a weather estimate.
    visibility = np.clip(margin / .5, 0, 1)
    visibility[~np.isfinite(z)] = 1
    return np.rint(visibility * 255).astype(np.uint8)


def check():
    plane = np.zeros((32, 32), dtype=np.float32)
    assert np.all(bake(plane, sun=(-1, 1, 0), reach=20, step=1) == 255)
    ridge = plane.copy()
    ridge[:, 10] = 8
    shadow = bake(ridge, sun=(-1, 1, 0), reach=20, step=1)
    assert shadow[16, 13] == 0 and shadow[16, 20] == 255
    assert shadow[16, 9] == 255  # illuminated side remains lit
    ridge[:, 10] = np.nan
    assert np.all(bake(ridge, sun=(-1, 1, 0), reach=20, step=1) == 255)
    print('PASS: flat plane, ridge shadow, sunward side, NoData')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        check()
    else:
        root = Path(__file__).resolve().parents[1] / 'public' / 'data'
        for folder in (root, root / 'ridge', root / 'noah'):
            meta = json.loads((folder / 'jezero-native-dem.json').read_text())
            binary = (folder / 'jezero-native-dem.bin').read_bytes()
            digest = hashlib.sha256(binary).hexdigest()
            assert digest == meta['validation']['binarySha256']
            z = np.frombuffer(binary, dtype='<f4').reshape(meta['height'], meta['width'])
            visibility = bake(z, meta['cellSize'])
            Image.fromarray(visibility).save(folder / 'terrain-relief.webp', lossless=True)
            result = {'classification': 'DERIVED DISPLAY', 'sourceSha256': digest,
                      'width': meta['width'], 'height': meta['height'], 'bounds': meta['bounds'],
                      'crs': meta['crs'], 'sunDirectionEastUpSouth': [-48, 28, -32],
                      'reachMetres': 192, 'stepMetres': 2, 'penumbraMetres': .5,
                      'shadowedPixels': int(np.count_nonzero(visibility < 255)),
                      'meaning': 'Simulated fixed sunlight occlusion from measured DEM. Crop restricted; no weather, surface observation or subpixel geometry is inferred.'}
            (folder / 'terrain-relief.json').write_text(json.dumps(result, indent=2) + '\n')
            print(folder.name, result['shadowedPixels'], 'shadowed pixels')
