"""Independent vertical-ray and analytic-reference diagnostics for the export."""
import json
import hashlib
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter
from surface_separation import ROOT, OUT, accessor, reference_plane
import struct

manifest = json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
data = json.loads((OUT/'surface-evidence.json').read_text(encoding='utf-8'))
triangles = []
for asset in manifest['detailAssets']:
    if asset.get('contextOnly'): continue
    content = (ROOT/'public'/asset['url'].lstrip('/')).read_bytes()
    jl = struct.unpack('<I', content[12:16])[0]; j = json.loads(content[20:20+jl]); b = content[28+jl:]
    m = np.array(asset['transform']).reshape(4, 4).T
    for mesh in j['meshes']:
        for primitive in mesh['primitives']:
            p = accessor(j, b, primitive['attributes']['POSITION'])@m[:3, :3].T+m[:3, 3]
            triangles.append(p[accessor(j, b, primitive['indices']).reshape(-1, 3)])
tri = np.concatenate(triangles); lo = tri[:, :, [0, 2]].min(1); hi = tri[:, :, [0, 2]].max(1)
g = data['grid']; elevation = np.array(data['elevation'], dtype=float); known = np.flatnonzero(np.isfinite(elevation))
sample = np.unique(np.r_[known[np.linspace(0, len(known)-1, 64, dtype=int)], [int((f['peak'][2]-g['origin'][1])/g['cellSize'])*g['width']+int((f['peak'][0]-g['origin'][0])/g['cellSize']) for f in data['features']]])
errors = []
for i in sample:
    x = g['origin'][0]+(i % g['width']+.5)*g['cellSize']; z = g['origin'][1]+(i//g['width']+.5)*g['cellSize']
    candidates = tri[np.all(lo <= [x, z], axis=1) & np.all(hi >= [x, z], axis=1)]
    a, b, c = candidates[:, 0], candidates[:, 1], candidates[:, 2]
    den = (b[:, 2]-c[:, 2])*(a[:, 0]-c[:, 0])+(c[:, 0]-b[:, 0])*(a[:, 2]-c[:, 2]); ok = abs(den) > 1e-10
    a, b, c, den = a[ok], b[ok], c[ok], den[ok]
    u = ((b[:, 2]-c[:, 2])*(x-c[:, 0])+(c[:, 0]-b[:, 0])*(z-c[:, 2]))/den
    v = ((c[:, 2]-a[:, 2])*(x-c[:, 0])+(a[:, 0]-c[:, 0])*(z-c[:, 2]))/den; w = 1-u-v
    h = (u*a[:, 1]+v*b[:, 1]+w*c[:, 1])[(u >= -1e-7) & (v >= -1e-7) & (w >= -1e-7)]
    assert len(h) and h.max()-h.min() <= .200001
    errors.append(abs(elevation[i]-float(h.max())))
assert max(errors) <= .000051

# An analytic diagnostic isolates the slope/boundary bias of a Gaussian baseline.
yy, xx = np.indices((101, 101)); plane = .035*xx+.025*yy
plane[40:47, 40:47] = np.nan; valid = np.isfinite(plane)
weight = gaussian_filter(valid.astype(float), 5)
gaussian_reference = gaussian_filter(np.where(valid, plane, 0), 5)/np.maximum(weight, 1e-6)
robust_reference, support = reference_plane(plane, .1, 1.5)
assessed = np.isfinite(robust_reference)
gaussian_bias = (plane-gaussian_reference)[assessed]; robust_bias = (plane-robust_reference)[assessed]
assert np.max(abs(robust_bias)) < 1e-8

report = {'schemaVersion': 1, 'extractionId': data['extractionId'],
          'exportSha256': hashlib.sha256((OUT/'surface-evidence.json').read_bytes()).hexdigest(),
          'sourceTriangles': len(tri), 'directTriangleChecks': {'samples': len(sample), 'includesAllCandidatePeaks': True,
              'maximumExportHeightDifferenceMetres': max(errors), 'meaning': 'Four-decimal export consistency, not stereo measurement accuracy.'},
          'analyticInclineAndHoleDiagnostic': {'grid': [101, 101], 'cellMetres': .1, 'planeGradient': [.35, .25],
              'gaussianSigmaCells': 5, 'sameAssessedCells': int(assessed.sum()),
              'gaussianMaximumAbsoluteBiasMetres': float(np.max(abs(gaussian_bias))),
              'robustPlaneMaximumAbsoluteBiasMetres': float(np.max(abs(robust_bias))),
              'gaussianPositiveResidualOver15cm': int((gaussian_bias > .15).sum()),
              'robustPlanePositiveResidualOver15cm': int((robust_bias > .15).sum()),
              'meaning': 'Analytic shape diagnostic only; not field precision/recall or Mars obstacle ground truth.'},
          'summary': data['summary'], 'limitations': data['limitations']}
(OUT/'surface-evidence-validation.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report['directTriangleChecks'], indent=2))
print(json.dumps(report['analyticInclineAndHoleDiagnostic'], indent=2))
