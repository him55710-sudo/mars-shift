"""Reproduce the separate 1 km eastern Jezero ridge assets from real rasters.

Uses the same source rasters, processing, Mars CRS and native DEM export as the
default study area. Existing public/data default assets are never replaced.

    ../.venv/Scripts/python scripts/prepare_ridge.py
    ../.venv/Scripts/python scripts/prepare_ridge.py --check
    node scripts/benchmark_ridge.ts
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

import preprocess
import prepare_native_dem as native

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'data' / 'ridge'
CENTER = (77.73152233744179, 18.5043948063779)
URL_BASE = '/data/ridge'


def check_assets() -> dict:
    terrain = json.loads((OUTPUT / 'terrain.json').read_text(encoding='utf-8'))
    meta = json.loads((OUTPUT / 'jezero-native-dem.json').read_text(encoding='utf-8'))
    manifest = json.loads((OUTPUT / 'manifest.json').read_text(encoding='utf-8'))
    binary = (OUTPUT / 'jezero-native-dem.bin').read_bytes()
    if len(binary) != 1000 * 1000 * 4:
        raise ValueError('Unexpected native binary dimensions')
    with rasterio.open(OUTPUT / 'jezero-dem-1m.tif') as src:
        expected = np.asarray(src.read(1, masked=True).filled(np.nan), dtype='<f4')
        expected[~np.isfinite(expected)] = np.nan
        if not np.allclose(src.bounds, terrain['bounds'], rtol=0, atol=1e-8):
            raise ValueError('DEM crop and planning bounds differ')
    actual = np.frombuffer(binary, dtype='<f4').reshape(1000, 1000)
    if not np.array_equal(expected, actual, equal_nan=True):
        raise ValueError('Native binary differs from the exact source crop')
    if hashlib.sha256(binary).hexdigest() != meta['validation']['binarySha256']:
        raise ValueError('Native DEM checksum differs')
    optical = json.loads((OUTPUT / 'optical-meta.json').read_text(encoding='utf-8'))
    if not np.allclose(optical['bounds'], terrain['bounds'], rtol=0, atol=1e-8):
        raise ValueError('Optical crop and planning bounds differ')
    if meta['url'] != URL_BASE + '/jezero-native-dem.bin':
        raise ValueError('Native metadata refers to the wrong dataset URL')
    if meta['source']['file'] != URL_BASE + '/jezero-dem-1m.tif':
        raise ValueError('Native metadata refers to the wrong source crop')
    if meta['opticalReference']['url'] != URL_BASE + '/optical.webp':
        raise ValueError('Native metadata refers to the wrong optical texture')
    for key in ['elevation', 'slope', 'meanSlope', 'roughness', 'exposure', 'valid', 'thermal']:
        if len(terrain[key]) != 40000:
            raise ValueError(f'Unexpected planning dimensions: {key}')
    for name, size in [('optical.webp', (1000, 1000)), ('hillshade.webp', (1000, 1000)), ('slope.png', (200, 200)), ('thermal.png', (200, 200)), ('exposure.png', (200, 200))]:
        with Image.open(OUTPUT / name) as im:
            if im.size != size:
                raise ValueError(f'Unexpected image dimensions: {name}')
            im.verify()
    if manifest['roi']['centerLonLat'] != list(CENTER):
        raise ValueError('Ridge manifest has a different nominal centre')
    return {'status':'verified', 'centerLonLat':list(CENTER), 'nativePixelCount':int(np.isfinite(actual).sum()), 'nativeReliefMetres':float(np.nanmax(actual)-np.nanmin(actual)), 'coverage':manifest['coverage'], 'nativeBinarySha256':meta['validation']['binarySha256']}


def prepare() -> dict:
    preprocess.CENTER = CENTER
    preprocess.OUT = OUTPUT
    preprocess.main()
    # The native exporter is deliberately reused without changing its default
    # dataset globals or implementation on disk.
    native.DATA = OUTPUT
    native.SOURCE = OUTPUT / 'jezero-dem-1m.tif'
    native.BINARY = OUTPUT / 'jezero-native-dem.bin'
    native.METADATA = OUTPUT / 'jezero-native-dem.json'
    metadata = native.prepare()
    metadata['url'] = URL_BASE + '/jezero-native-dem.bin'
    metadata['source']['file'] = URL_BASE + '/jezero-dem-1m.tif'
    metadata['opticalReference']['url'] = URL_BASE + '/optical.webp'
    (OUTPUT / 'jezero-native-dem.json').write_text(json.dumps(metadata, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    manifest_path = OUTPUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['dataset'] = {'id':'ridge', 'name':'Eastern Jezero ridge', 'assetBase':URL_BASE, 'selection':'A separate real 1 km crop chosen for higher observed relief; it does not replace the original study area.'}
    manifest_path.write_text(json.dumps(manifest, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    return check_assets()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify generated ridge assets without rewriting them')
    args = parser.parse_args()
    print(json.dumps(check_assets() if args.check else prepare(), indent=2, allow_nan=False))
