import unittest
import numpy as np
from surface_separation import rasterize_triangles, reference_plane, separate


class SurfaceSeparationTests(unittest.TestCase):
    def test_metric_triangle_sampling_and_axes(self):
        # y = 2*x + .5*z + 3; sample at cell centres, not grid corners.
        points = np.array([[0, 3, 0], [2, 7, 0], [0, 4, 2], [2, 8, 2]], dtype=float)
        low, high, slope = rasterize_triangles(points[[[0, 1, 2], [1, 3, 2]]], np.array([0., 0.]), .5, 4, 4)
        z, x = np.mgrid[.25:2:.5, .25:2:.5]
        np.testing.assert_allclose(high, 2*x+.5*z+3, atol=1e-12)
        np.testing.assert_allclose(low, high)
        np.testing.assert_allclose(slope, np.degrees(np.arctan(np.hypot(2, .5))))

    def test_overlapping_inconsistent_surfaces_are_detectable(self):
        a = np.array([[[0, 0, 0], [2, 0, 0], [0, 0, 2]]], dtype=float)
        b = a.copy(); b[:, :, 1] += .3
        low, high, _ = rasterize_triangles(np.concatenate([a, b]), np.array([0., 0.]), .5, 4, 4)
        observed = np.isfinite(high)
        self.assertTrue(np.all((high-low)[observed] > .2))
        self.assertFalse(observed[-1, -1])

    def test_inclined_plane_remains_plane_even_near_a_hole(self):
        y, x = np.indices((81, 81)); z = .04*x-.025*y+7.; z[35:40, 35:40] = np.nan
        reference, _ = reference_plane(z, .1, 1.5)
        use = np.isfinite(reference)
        np.testing.assert_allclose(reference[use], z[use], atol=1e-8)
        self.assertTrue(np.all(np.isnan(reference[35:40, 35:40])))

    def test_raised_region_on_a_slope_is_separate_from_ground(self):
        y, x = np.indices((101, 101)); plane = .025*x+.01*y
        z = plane+.6*np.exp(-((x-50)**2+(y-50)**2)/14)
        result = separate(z, np.full(z.shape, 15.), .1)
        self.assertGreater(len(result['features']), 0)
        self.assertGreater(result['ids'][50, 50], 0)
        self.assertGreater(result['residual'][50, 50], .35)
        self.assertEqual(int(result['ids'][:20].sum()), 0)

    def test_missing_and_unsupported_cells_are_not_invented_ground(self):
        z = np.full((61, 61), np.nan); z[25:30, 25:30] = 1.
        result = separate(z, np.zeros(z.shape), .1)
        self.assertEqual(len(result['features']), 0)
        self.assertTrue(np.all(result['classes'][~np.isfinite(z)] == 0))
        self.assertTrue(np.all(result['classes'][np.isfinite(z)] == 4))

    def test_small_noise_is_not_promoted_and_source_values_are_unchanged(self):
        y, x = np.indices((81, 81)); z = .02*x+.04*np.exp(-((x-40)**2+(y-40)**2)/8)
        before = z.copy(); result = separate(z, np.full(z.shape, 12.), .1)
        self.assertEqual(len(result['features']), 0)
        np.testing.assert_array_equal(z, before)


if __name__ == '__main__': unittest.main()
