"""Reproducible terrain morphology from the existing native 1 m Mars DEM crops.

Run: ../.venv/Scripts/python scripts/terrain_science.py [--check]
No source observations, existing planning layers, or fitted mobility weights change.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
import scipy
from scipy.ndimage import distance_transform_edt, maximum_filter, minimum_filter, uniform_filter
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'
FLAT_GRADIENT = 1e-9
STEEP_DEGREES = 25.0
EXPOSURE_METRES = 20.0

UNITS = {
    'slope': 'degree', 'aspect': 'degree clockwise from grid north, downhill',
    'tri': 'm', 'tpi11': 'm', 'tpi51': 'm',
    'profileCurvature': 'm^-1', 'planCurvature': 'm^-1',
    'relief11': 'm', 'relief51': 'm', 'exposure': 'fraction',
    'coverage': 'fraction', 'support3': 'fraction', 'support11': 'fraction',
    'support51': 'fraction', 'uncertaintyMask': 'bitmask',
    'opticalCueFraction': 'fraction',
}
PRECISION = {k: 6 for k in UNITS}
PRECISION.update(slope=5, aspect=4, profileCurvature=9, planCurvature=9)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def full_support(valid: np.ndarray, size: int) -> np.ndarray:
    """Require every pixel of the complete square stencil, including at edges."""
    return minimum_filter(valid.astype('uint8'), size=size, mode='constant', cval=0).astype(bool)


def terrain_derivatives(z: np.ndarray, cell_size: float = 1.0) -> dict[str, np.ndarray]:
    """North-up ZT central derivatives, Riley TRI, square TPI/relief and support.

    Coordinates x=east, y=grid north. All arithmetic before export is Float64.
    Flat/critical-point aspect and directional curvatures are undefined (NaN).
    """
    z = np.asarray(z, dtype='float64')
    if z.ndim != 2 or min(z.shape) < 3 or not np.isfinite(cell_size) or cell_size <= 0:
        raise ValueError('Expected a 2D DEM and positive physical cell size')
    valid = np.isfinite(z)
    support3 = full_support(valid, 3)
    # Explicit NaN padding, never nearest-edge or zero-filled invented terrain.
    padded = np.pad(z, 1, constant_values=np.nan)
    c = padded[1:-1, 1:-1]
    north, south = padded[:-2, 1:-1], padded[2:, 1:-1]
    west, east = padded[1:-1, :-2], padded[1:-1, 2:]
    nw, ne, sw, se = padded[:-2, :-2], padded[:-2, 2:], padded[2:, :-2], padded[2:, 2:]
    p = (east - west) / (2 * cell_size)
    q = (north - south) / (2 * cell_size)
    r = (east - 2 * c + west) / cell_size**2
    t = (north - 2 * c + south) / cell_size**2
    s = (ne - nw - se + sw) / (4 * cell_size**2)
    g = p*p + q*q
    slope = np.degrees(np.arctan(np.sqrt(g)))
    aspect = np.degrees(np.arctan2(-p, -q)) % 360
    directional = support3 & (g > FLAT_GRADIENT**2)
    aspect[~directional] = np.nan
    profile = np.full(z.shape, np.nan)
    plan = np.full(z.shape, np.nan)
    np.divide(-(r*p*p + 2*s*p*q + t*q*q), g*(1+g)**1.5,
              out=profile, where=directional)
    np.divide(-(r*q*q - 2*s*p*q + t*p*p), g**1.5,
              out=plan, where=directional)
    tri = np.sqrt(sum((neighbor-c)**2 for neighbor in [north, south, west, east, nw, ne, sw, se]))
    result = {'slope': slope, 'aspect': aspect, 'tri': tri,
              'profileCurvature': profile, 'planCurvature': plan}
    for field in result.values():
        field[~support3] = np.nan
    supports = {3: support3}
    for size in [11, 51]:
        support = full_support(valid, size)
        supports[size] = support
        # Missing values do not contaminate all windows in the separable filter;
        # the full-support mask excludes every affected window afterward.
        total = uniform_filter(np.where(valid, z, 0), size=size, mode='constant', cval=0) * size**2
        tpi = z - (total-z)/(size**2-1)
        relief = (maximum_filter(np.where(valid, z, -np.inf), size=size, mode='constant', cval=-np.inf)
                  - minimum_filter(np.where(valid, z, np.inf), size=size, mode='constant', cval=np.inf))
        tpi[~support] = np.nan
        relief[~support] = np.nan
        result[f'tpi{size}'], result[f'relief{size}'] = tpi, relief
    steep = support3 & (slope > STEEP_DEGREES)
    # A fully observed 43x43 support conservatively bounds the 20 m radius plus
    # the slope stencil. No inferred exposure in unobserved border buffers.
    exposure_support = full_support(valid, 2*int(np.ceil(EXPOSURE_METRES/cell_size))+3)
    distance = distance_transform_edt(~steep, sampling=cell_size) if steep.any() else np.full(z.shape, np.inf)
    exposure = np.where(exposure_support, (distance <= EXPOSURE_METRES).astype(float), np.nan)
    uncertainty = np.full(z.shape, 32, dtype='uint8')
    uncertainty[~valid] |= 1
    uncertainty[~support3] |= 2
    uncertainty[~supports[11]] |= 4
    uncertainty[~supports[51]] |= 8
    uncertainty[support3 & ~directional] |= 16
    result.update(exposure=exposure, coverage=valid.astype(float),
                  support3=support3.astype(float), support11=supports[11].astype(float),
                  support51=supports[51].astype(float), uncertaintyMask=uncertainty.astype(float))
    return result


def aggregate(array: np.ndarray, factor: int = 5, circular: bool = False, mask: bool = False) -> np.ndarray:
    """Full native support per output cell; aspect uses a circular mean."""
    h, w = array.shape
    if h % factor or w % factor:
        raise ValueError('Grid dimensions must exactly divide the aggregation factor')
    blocks = array.reshape(h//factor, factor, w//factor, factor)
    full = np.isfinite(blocks).all(axis=(1, 3))
    if mask:
        return np.bitwise_or.reduce(np.bitwise_or.reduce(blocks.astype('uint8'), axis=3), axis=1).astype(float)
    if circular:
        radians = np.deg2rad(blocks)
        sine, cosine = np.mean(np.sin(radians), axis=(1, 3)), np.mean(np.cos(radians), axis=(1, 3))
        out = np.degrees(np.arctan2(sine, cosine)) % 360
        # Contradictory directions have no meaningful aggregate direction.
        full &= np.hypot(sine, cosine) > 1e-6
    else:
        out = np.mean(blocks, axis=(1, 3))
    out[~full] = np.nan
    return out


def finite_summary(array: np.ndarray) -> dict:
    values = array[np.isfinite(array)]
    return {'count': int(values.size), 'validFraction': float(values.size/array.size),
            **({k: float(v) for k, v in zip(['min', 'median', 'mean', 'p95', 'max'],
                                           [values.min(), np.median(values), values.mean(), np.percentile(values, 95), values.max()])}
               if values.size else {k: None for k in ['min', 'median', 'mean', 'p95', 'max']})}


def json_values(array: np.ndarray, decimals: int = 6) -> list:
    return [round(float(value), decimals) if np.isfinite(value) else None for value in array.ravel()]


def optical_proxy(directory: Path, shape: tuple[int, int], bounds: list, crs) -> tuple[np.ndarray, dict]:
    meta = json.loads((directory/'optical-v2-meta.json').read_text(encoding='utf-8'))
    encoded = (directory/'optical-v2-mask.png').read_bytes()
    if sha256(encoded) != meta['maskSha256']:
        raise ValueError('Optical cue mask checksum mismatch')
    if not np.allclose(bounds, meta['bounds'], atol=1e-8, rtol=0) or rasterio.crs.CRS.from_wkt(meta['crs']) != crs:
        raise ValueError('Optical cue mask is not aligned to the DEM')
    with Image.open(directory/'optical-v2-mask.png') as image:
        raw = np.array(image)
    if raw.shape != (shape[0]*2, shape[1]*2) or not np.isin(raw, [0, 255]).all():
        raise ValueError('Expected aligned binary 0.5 m semantic cue mask')
    native = aggregate((raw == 255).astype(float), factor=2)
    return native, {'maskSha256': meta['maskSha256'], 'modelSha256': meta['modelSha256'],
                    'sourceSamplingMetres': meta['nativeSourceMetresPerPixel'],
                    'displayMaskSamplingMetres': 0.5,
                    'validFraction': meta['statistics']['validFraction'],
                    'threshold': 0.25,
                    'meaning': 'Fraction of image area above an experimental model threshold before component filtering. NOT rock abundance, boulder count, calibrated confidence or validated Jezero field precision.'}


def build_region(region: str, check: bool = False) -> dict:
    directory = DATA if region == 'floor' else DATA/'ridge'
    output = directory/'science'
    source = directory/'jezero-dem-1m.tif'
    native_meta = json.loads((directory/'jezero-native-dem.json').read_text(encoding='utf-8'))
    planning = json.loads((directory/'terrain.json').read_text(encoding='utf-8'))
    source_bytes = source.read_bytes()
    with rasterio.open(source) as src:
        if src.count != 1 or src.crs is None or src.transform.b != 0 or src.transform.d != 0 or src.res != (1.0, 1.0):
            raise ValueError('Expected single-band north-up native 1 m Mars DEM')
        if src.transform.a <= 0 or src.transform.e >= 0:
            raise ValueError('Expected eastward columns and southward rows')
        z = np.asarray(src.read(1, masked=True).filled(np.nan), dtype='float64')
        transform, crs, bounds = src.transform, src.crs, list(src.bounds)
    if sha256(source_bytes) != native_meta['source']['sourceCropSha256']:
        raise ValueError('DEM source checksum differs from existing provenance')
    if not np.allclose(bounds, planning['bounds'], rtol=0, atol=1e-8) or crs != rasterio.crs.CRS.from_wkt(planning['crs']):
        raise ValueError('Native DEM and existing planning grid are not registered')
    if z.shape != (planning['height']*5, planning['width']*5) or planning['cellSize'] != 5:
        raise ValueError('Expected exact native 1 m to planning 5 m relationship')
    fields = terrain_derivatives(z)
    proxy, proxy_meta = optical_proxy(directory, z.shape, bounds, crs)
    fields['opticalCueFraction'] = proxy
    grid = {key: aggregate(value, circular=key == 'aspect', mask=key == 'uncertaintyMask') for key, value in fields.items()}
    provenance = {
        'demCropSha256': sha256(source_bytes),
        'nativeBinarySha256': native_meta['validation']['binarySha256'],
        'scriptSha256UTF8LF': sha256(Path(__file__).read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8')),
        'scriptHashEncoding': 'UTF-8 source after CRLF to LF normalization',
        'source': native_meta['source'],
        'software': {'numpy': np.__version__, 'scipy': scipy.__version__, 'rasterio': rasterio.__version__, 'GDAL': rasterio.__gdal_version__},
    }
    metadata = {
        'units': UNITS,
        'coordinateAxes': 'x = projected easting; y = projected grid north. Rows run north to south. Distances in projected metres; no Earth CRS or geodesic conversion.',
        'method': 'Zevenbergen-Thorne central 3x3 first/second derivatives; Riley 3x3 TRI; full square 11x11 and 51x51 m TPI excluding center; max-minus-min relief; geometric profile and true planform curvature following xDEM documented equations, without xDEM factor100.',
        'methodStatus': 'Equations reproduced in NumPy/SciPy; analytic synthetic numerical tests. xDEM/GDAL methods cited; libraries were not installed and no library cross-validation is claimed.',
        'support': {'slope': '3x3 m', 'aspect': '3x3 m; gradient magnitude >1e-9; clockwise downhill from grid north',
                    'tri': '3x3 m', 'profileCurvature': '3x3 m; null at flat or critical points',
                    'planCurvature': '3x3 m; null at flat or critical points',
                    'tpi11': '11x11 m (120 neighbors, center excluded)', 'tpi51': '51x51 m (2600 neighbors, center excluded)',
                    'relief11': '11x11 m', 'relief51': '51x51 m',
                    'exposure': 'Euclidean distance <=20 m from native slope >25 degrees. Full43x43 m source support required. Geometric proximity proxy, not calibrated probability or rockfall trajectory.'},
        'aggregation': 'All morphology fields are native1m calculations aggregated by arithmetic mean into exact5x5 native blocks; any missing support makes the output field null. Aspect is circular mean; opposing/undefined directions null. Coverage/support are fractions; uncertainty bits use bitwise OR. Existing maximum native slope hard constraint is not replaced.',
        'curvatureSign': 'Positive convex, negative concave, units1/m, NOT multiplied100. Planform denominator gradient^3 differs from tangential curvature. Direction undefined at zero gradient.',
        'noData': 'JSON null / GeoTIFF NaN. No padding, interpolation, filling or extrapolation across crop edges/holes.',
        'uncertaintyBits': {'1': 'DEM missing', '2': '3m stencil unavailable', '4': '11m stencil unavailable', '8': '51m stencil unavailable', '16': 'aspect/profile/plan curvature undefined at zero gradient', '32': 'DEM vertical and inter-product registration accuracy not quantitatively provided'},
        'accuracy': '1m is pixel spacing, not vertical accuracy. Quantized source heights and differentiation amplify noise, especially curvature. Planform curvature is ill-conditioned near flat surfaces even where its gradient is nonzero. No sigma/probability invented. Morphology does not measure soil strength, slip or astronaut safety.',
        'sensorCoverage': {'nativeDemValidFraction': float(np.isfinite(z).mean()),
                           'opticalMaskValidFraction': proxy_meta['validFraction'],
                           'thermalGridValidFraction': sum(v is not None and np.isfinite(v) for v in planning['thermal'])/len(planning['thermal']),
                           'thermalNativeSamplingMetres': 100,
                           'interpretation': 'Spatial sample availability, not accuracy or ground-truth validation. Nearest-neighbor thermal reprojection repeats coarse observations; fine display does not add thermal information.'},
        'nativeRaster': 'terrain-derivatives-1m.tif',
        'references': ['https://xdem.readthedocs.io/en/stable/terrain.html', 'https://gdal.org/en/stable/programs/gdaldem.html'],
        'opticalProxy': proxy_meta,
    }
    payload = {'schemaVersion': 1, 'region': region, 'width': planning['width'], 'height': planning['height'],
               'cellSize': 5, 'bounds': bounds, 'crs': crs.to_wkt(), 'nativeResolution': 1,
               'fields': {key: json_values(value, PRECISION[key]) for key, value in grid.items()},
               'metadata': metadata, 'provenance': provenance,
               'summary': {'native': {key: finite_summary(value) for key, value in fields.items()},
                           'planning': {key: finite_summary(value) for key, value in grid.items()}}}
    encoded = (json.dumps(payload, separators=(',', ':'), allow_nan=False)+'\n').encode('utf-8')
    tiff_path, json_path = output/'terrain-derivatives-1m.tif', output/'terrain-metrics.json'
    keys = list(fields)
    if check:
        if json_path.read_bytes() != encoded:
            raise ValueError(f'{region}: reproducible JSON differs')
        with rasterio.open(tiff_path) as tif:
            if tif.crs != crs or tif.transform != transform or tif.descriptions != tuple(keys):
                raise ValueError(f'{region}: GeoTIFF metadata mismatch')
            for n, key in enumerate(keys, 1):
                if not np.array_equal(tif.read(n), fields[key].astype('float32'), equal_nan=True):
                    raise ValueError(f'{region}: GeoTIFF band {key} differs')
    else:
        output.mkdir(parents=True, exist_ok=True)
        profile = dict(driver='GTiff', width=z.shape[1], height=z.shape[0], count=len(keys),
                       dtype='float32', crs=crs, transform=transform, nodata=np.nan,
                       compress='deflate', predictor=3, tiled=True, blockxsize=256, blockysize=256, interleave='band')
        with rasterio.open(tiff_path, 'w', **profile) as tif:
            tif.update_tags(AREA_OR_POINT='Area', DATA_CLASS='Derived morphology / uncalibrated proxies',
                            SOURCE_SHA256=provenance['demCropSha256'], SCRIPT_SHA256_UTF8_LF=provenance['scriptSha256UTF8LF'])
            for n, key in enumerate(keys, 1):
                tif.write(fields[key].astype('float32'), n)
                tif.set_band_description(n, key)
                tif.update_tags(n, units=UNITS[key], definition=metadata.get('support', {}).get(key, metadata['aggregation']))
        json_path.write_bytes(encoded)
    report = {'region': region, 'status': 'verified' if check else 'written',
              'jsonSha256': sha256(encoded), 'jsonBytes': len(encoded),
              'nativeGeoTiffSha256': sha256(tiff_path.read_bytes()), 'nativeGeoTiffBytes': tiff_path.stat().st_size,
              'source': provenance, 'summary': payload['summary']}
    report_path = output/'terrain-report.json'
    report_encoded = (json.dumps(report, indent=2, allow_nan=False)+'\n').encode('utf-8')
    if not check:
        report_path.write_bytes(report_encoded)
    else:
        stored = json.loads(report_path.read_text(encoding='utf-8'))
        if stored['jsonSha256'] != report['jsonSha256'] or stored['nativeGeoTiffSha256'] != report['nativeGeoTiffSha256']:
            raise ValueError(f'{region}: report hashes differ')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--region', choices=['floor', 'ridge', 'both'], default='both')
    args = parser.parse_args()
    for region in ['floor', 'ridge'] if args.region == 'both' else [args.region]:
        report = build_region(region, check=args.check)
        print(json.dumps({key: value for key, value in report.items() if key not in ['source', 'summary']}))
        print(json.dumps({'region': region, 'planning': {k: report['summary']['planning'][k] for k in ['slope', 'tri', 'tpi11', 'tpi51', 'relief11', 'relief51', 'profileCurvature', 'planCurvature', 'exposure', 'opticalCueFraction']}}))
