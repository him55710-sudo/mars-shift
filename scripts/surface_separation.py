"""Extract a metric surface raster and raised-feature candidates from NASA triangles.

The output is geometric evidence, not a semantic rock detector or safe-ground map.
No image/depth completion, synthetic objects or interpolation across missing data.
"""
from pathlib import Path
import hashlib
import json
import struct
import numpy as np
from scipy.ndimage import uniform_filter, label, binary_propagation
from rasterio.features import shapes
from affine import Affine

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/drive1004'
CELL = .1
ORIGIN = np.array([-8., -4.])
SIZE = 400
DT = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
DIMS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def accessor(j, b, i):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
    dt = np.dtype(DT[a['componentType']]); n = DIMS[a['type']]
    return np.ndarray((a['count'], n), dtype=dt, buffer=b,
                      offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
                      strides=(v.get('byteStride', dt.itemsize*n), dt.itemsize)).copy()


def rasterize_triangles(triangles, origin, cell, width, height):
    """Vertical barycentric intersections, retaining observed min/max and normals."""
    lo_y = np.full(width*height, np.inf); hi_y = np.full(width*height, -np.inf)
    slope = np.zeros(width*height)
    for start in range(0, len(triangles), 20000):
        tri = triangles[start:start+20000]; xz = tri[:, :, [0, 2]]
        lo = np.maximum(0, np.ceil((xz.min(1)-origin)/cell-.5).astype(int))
        hi = np.minimum([width-1, height-1], np.floor((xz.max(1)-origin)/cell-.5).astype(int))
        ok = np.all(hi >= lo, 1); tri = tri[ok]; lo = lo[ok]; hi = hi[ok]
        if not len(tri): continue
        spans = hi-lo+1
        for sx, sz in np.unique(spans, axis=0):
            use = (spans[:, 0] == sx) & (spans[:, 1] == sz); ts = tri[use]; ls = lo[use]
            dx, dz = np.meshgrid(np.arange(sx), np.arange(sz)); dx = dx.ravel(); dz = dz.ravel()
            group = max(1, 750000//len(dx))
            for k in range(0, len(ts), group):
                t = ts[k:k+group]; l = ls[k:k+group]
                gx = l[:, 0, None]+dx; gz = l[:, 1, None]+dz
                x = origin[0]+(gx+.5)*cell; z = origin[1]+(gz+.5)*cell
                ax, az = t[:, 0, 0, None], t[:, 0, 2, None]
                bx, bz = t[:, 1, 0, None], t[:, 1, 2, None]
                cx, cz = t[:, 2, 0, None], t[:, 2, 2, None]
                den = (bz-cz)*(ax-cx)+(cx-bx)*(az-cz)
                with np.errstate(divide='ignore', invalid='ignore'):
                    u = ((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den
                    v = ((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den; w = 1-u-v
                    y = u*t[:, 0, 1, None]+v*t[:, 1, 1, None]+w*t[:, 2, 1, None]
                inside = (u >= -1e-7) & (v >= -1e-7) & (w >= -1e-7) & (abs(den) > 1e-10)
                normal = np.cross(t[:, 1]-t[:, 0], t[:, 2]-t[:, 0])
                grade = np.degrees(np.arctan2(np.hypot(normal[:, 0], normal[:, 2]), abs(normal[:, 1])))
                ids = (gz*width+gx)[inside]; ys = y[inside]
                np.minimum.at(lo_y, ids, ys); np.maximum.at(hi_y, ids, ys)
                np.maximum.at(slope, ids, np.broadcast_to(grade[:, None], inside.shape)[inside])
    return lo_y.reshape(height, width), hi_y.reshape(height, width), slope.reshape(height, width)


def reference_plane(z, cell, radius, iterations=4):
    """Robust local affine reference; a tilted plane remains a plane near holes.

    Positive residuals receive less weight, reducing the influence of protrusions.
    Nothing is estimated at an unobserved centre. At least 55% of the full window
    must be observed, with adequate two-dimensional covariance for a plane fit.
    """
    z = np.asarray(z, dtype=float); valid = np.isfinite(z)
    yy, xx = np.indices(z.shape, dtype=float); xx *= cell; yy *= cell
    window = 2*int(np.ceil(radius/cell))+1
    blur = lambda a: uniform_filter(a, size=window, mode='constant', cval=0)
    support = blur(valid.astype(float)); weight = valid.astype(float)
    values = np.where(valid, z, 0); estimate = np.full(z.shape, np.nan)
    for _ in range(iterations):
        mass = blur(weight); norm = np.maximum(mass, 1e-15)
        xm, ym, zm = [blur(weight*a)/norm for a in [xx, yy, values]]
        cxx = blur(weight*xx*xx)/norm-xm*xm
        cyy = blur(weight*yy*yy)/norm-ym*ym
        cxy = blur(weight*xx*yy)/norm-xm*ym
        cxz = blur(weight*xx*values)/norm-xm*zm
        cyz = blur(weight*yy*values)/norm-ym*zm
        det = cxx*cyy-cxy*cxy
        usable = valid & (support >= .55) & (mass >= .12) & (det > (cell**4)*.01)
        px = np.divide(cxz*cyy-cyz*cxy, det, out=np.zeros_like(det), where=usable)
        py = np.divide(cyz*cxx-cxz*cxy, det, out=np.zeros_like(det), where=usable)
        estimate = np.where(usable, zm+px*(xx-xm)+py*(yy-ym), np.nan)
        positive = np.maximum(0, np.where(usable, values-estimate, 0))
        weight = valid/(1+(positive/.08)**2)
    return estimate, support


def separate(z, slope, cell):
    small, support = reference_plane(z, cell, .6)
    ground, large_support = reference_plane(z, cell, 1.5)
    support = np.minimum(support, large_support)
    valid = np.isfinite(z); assessed = valid & np.isfinite(small) & np.isfinite(ground)
    residual = np.where(assessed, np.maximum(0, z-ground), np.nan)
    mask = assessed & (residual >= .15) & (z-small >= .04)
    seeds, seed_count = label(mask, np.ones((3, 3), dtype=bool))
    seed_sizes = np.bincount(seeds.ravel()); seed_sizes[0] = 0
    stable_seeds = seed_sizes[seeds] >= 4
    growth = assessed & (residual >= .075) & (z-small >= .02)
    mask = binary_propagation(stable_seeds, structure=np.ones((3, 3)), mask=growth)
    labels, count = label(mask, np.ones((3, 3), dtype=bool))
    regions = []
    for ident in range(1, count+1):
        cells = np.flatnonzero(labels.ravel() == ident)
        if len(cells) < 4: continue
        regions.append((float(np.nanmax(residual.ravel()[cells])), cells))
    regions.sort(key=lambda q: (-q[0], int(q[1][0])))
    ids = np.zeros(z.size, dtype=np.uint16); features = []
    for ident, (peak, cells) in enumerate(regions[:255], 1):
        ids[cells] = ident; rows, cols = np.divmod(cells, z.shape[1])
        peak_cell = int(cells[np.argmax(residual.ravel()[cells])])
        features.append({'id': ident, 'cells': cells.tolist(), 'peakCell': peak_cell,
                         'heightAboveReference': round(peak, 4), 'area': round(len(cells)*cell*cell, 4),
                         'meanHeightAboveReference': round(float(np.mean(residual.ravel()[cells])), 4),
                         'boundsCells': [[int(cols.min()), int(rows.min())], [int(cols.max()), int(rows.max())]],
                         'heightBounds': [round(float(np.min(ground.ravel()[cells])), 4), round(float(np.max(z.ravel()[cells])), 4)],
                         'supportFraction': round(float(np.min(support.ravel()[cells])), 4),
                         'kind': 'raised feature candidate', 'reviewStatus': 'unreviewed'})
    ids = ids.reshape(z.shape)
    classes = np.where(valid, 4, 0).astype(np.uint8)
    classes[assessed] = 1; classes[assessed & (slope > 35)] = 3; classes[ids > 0] = 2
    return {'ground': ground, 'residual': residual, 'classes': classes, 'ids': ids, 'features': features}


def main():
    raw = (OUT/'manifest.json').read_bytes(); manifest = json.loads(raw)
    triangles = []
    for asset in manifest['detailAssets']:
        if asset.get('contextOnly'): continue
        b = (ROOT/'public'/asset['url'].lstrip('/')).read_bytes()
        if hashlib.sha256(b).hexdigest() != asset['sha256']: raise ValueError('Source geometry hash changed')
        length = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20+length]); binary = b[28+length:]
        m = np.array(asset['transform']).reshape(4, 4).T
        for mesh in j['meshes']:
            for primitive in mesh['primitives']:
                p = accessor(j, binary, primitive['attributes']['POSITION'])@m[:3, :3].T+m[:3, 3]
                ix = accessor(j, binary, primitive['indices']).reshape(-1, 3)
                triangles.append(p[ix])
    tri = np.concatenate(triangles)
    low, high, slope = rasterize_triangles(tri, ORIGIN, CELL, SIZE, SIZE)
    observed = np.isfinite(high); conflict = observed & ((high-low) > .2)
    z = np.where(observed & ~conflict, high, np.nan)
    result = separate(z, slope, CELL); features = result['features']
    footprint = {}
    for geometry, ident in shapes(result['ids'], mask=result['ids'] > 0,
                                  transform=Affine(CELL, 0, ORIGIN[0], 0, CELL, ORIGIN[1]), connectivity=4):
        footprint.setdefault(int(ident), []).extend([geometry['coordinates']])
    for f in features:
        row, col = divmod(f.pop('peakCell'), SIZE)
        f['peak'] = [round(float(ORIGIN[0]+(col+.5)*CELL), 4), round(float(z[row, col]), 4), round(float(ORIGIN[1]+(row+.5)*CELL), 4)]
        bounds = f.pop('boundsCells'); f['bounds'] = [[round(float(ORIGIN[0]+bounds[0][0]*CELL), 4), round(float(ORIGIN[1]+bounds[0][1]*CELL), 4)], [round(float(ORIGIN[0]+(bounds[1][0]+1)*CELL), 4), round(float(ORIGIN[1]+(bounds[1][1]+1)*CELL), 4)]]
        f['footprint'] = {'type': 'MultiPolygon', 'coordinates': footprint.get(f['id'], [])}
        f.pop('cells')
    array = lambda a: [round(float(v), 4) if np.isfinite(v) else None for v in a.ravel()]
    classes = result['classes']; known = int(np.isfinite(z).sum()); assessed = int(np.isin(classes, [1, 2, 3]).sum())
    output = {'schemaVersion': 1, 'sourceCommit': manifest['sourceCommit'],
              'sourceManifestSha256': hashlib.sha256(raw).hexdigest(),
              'sourceUrl': manifest['sourceUrl'], 'frame': manifest['frame'],
              'grid': {'width': SIZE, 'height': SIZE, 'cellSize': CELL, 'origin': ORIGIN.tolist()},
              'elevation': array(z), 'referenceGround': array(result['ground']), 'residual': array(result['residual']),
              'classes': classes.ravel().tolist(), 'featureIds': result['ids'].ravel().tolist(), 'features': features,
              'elevationRange': [round(float(np.nanmin(z)), 4), round(float(np.nanmax(z)), 4)],
              'summary': {'sourceTriangles': len(tri), 'observedCells': int(observed.sum()), 'conflictCells': int(conflict.sum()),
                          'knownCells': known, 'assessedCells': assessed, 'unassessedObservedCells': known-assessed,
                          'featureCells': int((result['ids'] > 0).sum()), 'featureCount': len(features)},
              'classLabels': {'0': 'No usable observation', '1': 'Reference-like surface', '2': 'Raised feature candidate', '3': 'Steep surface', '4': 'Insufficient neighbourhood'},
              'method': {'raster': 'Vertical intersections with original finest NASA mesh triangles; highest observed surface; conflicts over 0.2 m masked.',
                         'reference': 'Four robust weighted local affine-plane fits at 0.6 m and 1.5 m radius; positive-residual weight scale 0.08 m; full-window observed fraction >=0.55.',
                         'candidate': 'Seeds: large-scale positive height >=0.15 m, small-scale height >=0.04 m, 8-connected group of >=4 cells. Grow only through supported residual >=0.075 m and small-scale height >=0.02 m. No semantic rock identification.',
                         'units': 'metres; X north, Y up, Z east. Footprints are local metres, not WGS84 GeoJSON.'},
              'limitations': ['0.10 m is the raster sampling interval, not measurement accuracy.', 'Ground reference and candidates are model-derived; source stereo and registration errors are unquantified.', 'Missing and conflicting observations remain masked. An unflagged cell is not verified safe ground.', 'Candidate footprints are 2.5D raster regions, not instance-segmented watertight rocks.', 'These local coordinates are separate from the orbital HiRISE mission frame.']}
    output['extractionId'] = hashlib.sha256(json.dumps(output, separators=(',', ':')).encode()).hexdigest()
    (OUT/'surface-evidence.json').write_text(json.dumps(output, separators=(',', ':'))+'\n', encoding='utf-8')
    (OUT/'surface-features.json').write_text(json.dumps({k: output[k] for k in ['schemaVersion', 'extractionId', 'sourceCommit', 'frame', 'method', 'features', 'limitations']}, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(output['summary'], indent=2), flush=True)


if __name__ == '__main__': main()
