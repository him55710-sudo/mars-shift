"""Analytic and actual-data checks; no display-colored images as ground truth."""
import hashlib
import json
from pathlib import Path
import unittest

import numpy as np
import rasterio

from terrain_science import aggregate, terrain_derivatives

ROOT = Path(__file__).resolve().parents[1]


class AnalyticTerrain(unittest.TestCase):
    def grid(self, size=101, resolution=1):
        values = (np.arange(size)-(size-1)/2)*resolution
        return np.meshgrid(values, -values)

    def test_planar_slope_aspect_and_metres(self):
        for resolution in [1, 2.5]:
            x, y = self.grid(51, resolution)
            result = terrain_derivatives(.3*x+.4*y+1000, resolution)
            self.assertAlmostEqual(result['slope'][25, 25], np.degrees(np.arctan(.5)), places=10)
            self.assertAlmostEqual(result['aspect'][25, 25], np.degrees(np.arctan2(-.3, -.4)) % 360, places=10)
            self.assertAlmostEqual(result['tri'][25, 25], np.sqrt(6*(.3**2+.4**2))*resolution, places=10)
            self.assertAlmostEqual(result['profileCurvature'][25, 25], 0, places=10)
            self.assertAlmostEqual(result['planCurvature'][25, 25], 0, places=10)

    def test_compass_aspects(self):
        x, y = self.grid()
        for surface, expected in [(-y, 0), (-x, 90), (y, 180), (x, 270)]:
            self.assertAlmostEqual(terrain_derivatives(surface)['aspect'][50, 50], expected)

    def test_flat_is_undefined_not_arbitrary_compass(self):
        result = terrain_derivatives(np.zeros((61, 61)))
        self.assertEqual(result['slope'][30, 30], 0)
        self.assertEqual(result['tri'][30, 30], 0)
        for key in ['aspect', 'profileCurvature', 'planCurvature']:
            self.assertTrue(np.isnan(result[key][30, 30]))
        self.assertEqual(int(result['uncertaintyMask'][30, 30]), 32 | 16)

    def test_ridge_and_valley_tpi_scales(self):
        x, _ = self.grid()
        ridge = terrain_derivatives(-.01*x*x)
        valley = terrain_derivatives(.01*x*x)
        for size in [11, 51]:
            offsets = np.arange(-(size//2), size//2+1)
            expected = .01*size*np.sum(offsets**2)/(size*size-1)
            self.assertAlmostEqual(ridge[f'tpi{size}'][50, 50], expected, places=10)
            self.assertAlmostEqual(valley[f'tpi{size}'][50, 50], -expected, places=10)
        self.assertGreater(ridge['tpi51'][50, 50], ridge['tpi11'][50, 50])

    def test_planar_tpi_is_zero_with_center_excluded(self):
        x, y = self.grid()
        result = terrain_derivatives(.3*x+.2*y+50)
        for key in ['tpi11', 'tpi51']:
            self.assertAlmostEqual(result[key][50, 50], 0, places=10)

    def test_known_geometric_curvatures_and_cross_derivative(self):
        x, y = self.grid()
        result = terrain_derivatives(.02*x*x+.01*y*y+.006*x*y+.3*x+.2*y)
        p, q, r, s, t = .3, .2, .04, .006, .02
        g = p*p+q*q
        profile = -(r*p*p+2*s*p*q+t*q*q)/(g*(1+g)**1.5)
        plan = -(r*q*q-2*s*p*q+t*p*p)/g**1.5
        self.assertAlmostEqual(result['profileCurvature'][50, 50], profile, places=12)
        self.assertAlmostEqual(result['planCurvature'][50, 50], plan, places=12)
        self.assertLess(profile, 0)  # upward bowl / concave, not convex
        self.assertNotAlmostEqual(plan, -(r*q*q-2*s*p*q+t*p*p)/g, places=5)

    def test_critical_point_has_no_preferred_profile(self):
        x, y = self.grid()
        result = terrain_derivatives(x*x+y*y)
        self.assertTrue(np.isnan(result['profileCurvature'][50, 50]))
        self.assertTrue(np.isnan(result['planCurvature'][50, 50]))

    def test_nodata_and_boundaries_never_fill_or_reflect(self):
        x, y = self.grid(151)
        z = x+y
        z[75, 75] = np.nan
        result = terrain_derivatives(z)
        self.assertTrue(np.isnan(result['slope'][0, 75]))
        self.assertTrue(np.isnan(result['slope'][75, 74]))
        self.assertTrue(np.isfinite(result['slope'][75, 73]))
        self.assertTrue(np.isnan(result['tpi11'][75, 70]))
        self.assertTrue(np.isfinite(result['tpi11'][75, 69]))
        self.assertTrue(np.isnan(result['tpi51'][75, 50]))
        self.assertTrue(np.isfinite(result['tpi51'][75, 49]))
        self.assertTrue(np.isnan(result['tpi51'][24, 75]))
        self.assertEqual(result['coverage'][75, 75], 0)
        self.assertEqual(int(result['uncertaintyMask'][75, 75]), 32 | 1 | 2 | 4 | 8)

    def test_multiscale_relief_is_physical_range(self):
        x, _ = self.grid()
        result = terrain_derivatives(.2*x)
        self.assertAlmostEqual(result['relief11'][50, 50], 2)
        self.assertAlmostEqual(result['relief51'][50, 50], 10)

    def test_steep_exposure_euclidean_proxy_and_support(self):
        # A native ramp stripe creates >25 degree slopes; no trajectory claims.
        z = np.zeros((101, 101))
        z[:, 50:] = 4
        result = terrain_derivatives(z)
        self.assertEqual(result['exposure'][50, 70], 1)
        self.assertEqual(result['exposure'][50, 71], 0)
        self.assertTrue(np.isnan(result['exposure'][20, 50]))
        self.assertTrue(np.isfinite(result['exposure'][21, 50]))

    def test_strict_full_block_and_circular_aspect(self):
        a = np.arange(100, dtype=float).reshape(10, 10)
        a[0, 0] = np.nan
        result = aggregate(a)
        self.assertTrue(np.isnan(result[0, 0]))
        self.assertAlmostEqual(result[1, 1], np.mean(a[5:, 5:]))
        directions = np.full((5, 5), 359.)
        directions[:, :2] = 1
        value = aggregate(directions, circular=True)[0, 0]
        self.assertLess(min(value, 360-value), 1)

    def test_mask_aggregation_preserves_all_reasons(self):
        a = np.full((5, 5), 32.)
        a[0, 0] = 33
        a[1, 1] = 36
        self.assertEqual(aggregate(a, mask=True)[0, 0], 37)


class ActualMarsIntegration(unittest.TestCase):
    def test_both_regions_registration_source_hash_and_native_samples(self):
        for sub in ['', 'ridge']:
            directory = ROOT/'public'/'data'/sub
            source = directory/'jezero-dem-1m.tif'
            payload = json.loads((directory/'science'/'terrain-metrics.json').read_text(encoding='utf-8'))
            self.assertEqual(payload['provenance']['demCropSha256'], hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertEqual(payload['nativeResolution'], 1)
            self.assertEqual((payload['width'], payload['height'], payload['cellSize']), (200, 200, 5))
            with rasterio.open(source) as src:
                z = src.read(1).astype(float)
                self.assertEqual(list(src.bounds), payload['bounds'])
                self.assertEqual(src.crs, rasterio.crs.CRS.from_wkt(payload['crs']))
            # Independent direct native TRI calculation at one complete block.
            expected = []
            for row in range(500, 505):
                for col in range(500, 505):
                    window = z[row-1:row+2, col-1:col+2]
                    expected.append(np.sqrt(np.sum((window-z[row, col])**2)))
            cell = 100*200+100
            self.assertAlmostEqual(payload['fields']['tri'][cell], np.mean(expected), places=5)
            self.assertEqual(payload['fields']['coverage'][cell], 1)
            self.assertTrue(payload['fields']['tpi51'][0] is None)
            self.assertEqual(len(payload['fields']['opticalCueFraction']), 40000)


if __name__ == '__main__':
    unittest.main()
