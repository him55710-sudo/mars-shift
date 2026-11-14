"""Numerical and executed-data checks for the NOAH-H categorical adapter."""
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
import rasterio
from rasterio.transform import from_origin

import prepare_noah as noah


class CategoricalAggregation(unittest.TestCase):
    def test_unknown_stays_in_area_denominator_and_ties_are_explicit(self):
        samples = np.array([[1, 1, 0, 0], [1, 2, 0, 0], [2, 2, 3, 1], [2, 0, 3, 1]], dtype="uint8")
        f = noah.aggregate_classes(samples, 2, 2, 2, [1, 2, 3])
        self.assertEqual(f["dominantClass"], [1, None, 2, 1])
        self.assertEqual(f["coverage"], [1, 0, .75, 1])
        self.assertEqual(f["dominantAreaFraction"], [.75, None, .75, .5])
        self.assertIsNone(f["classFractions"][1])
        self.assertEqual(f["classFractions"][2], [0, .75, 0])
        for fractions, coverage in zip(f["classFractions"], f["coverage"]):
            self.assertAlmostEqual(sum(fractions) if fractions else 0, coverage)

    def test_registered_categorical_sampling_preserves_unknown_and_classes(self):
        mars = rasterio.crs.CRS.from_proj4("+proj=eqc +lat_ts=0 +R=3396190 +units=m +no_defs")
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "categorical.tif"
            # One native2.5m source pixel is NoData: the upper-left5m
            # planning cell is75% observed and must not become100% class1.
            a = np.array([[1, 1, 2, 2], [1, 127, 2, 2], [3, 3, 2, 2], [3, 3, 2, 2]], dtype="uint8")
            with rasterio.open(path, "w", driver="GTiff", width=4, height=4, count=1, dtype="uint8", crs=mars, transform=from_origin(0, 10, 2.5, 2.5), nodata=127) as ds:
                ds.write(a, 1)
            grid = {"width": 2, "height": 2, "cellSize": 5, "bounds": [0, 0, 10, 10], "crs": mars.to_wkt()}
            classes = [{"id": i, "label": str(i)} for i in [1, 2, 3]]
            r = noah.build_region("test", grid, path, classes, {"controlPointFiles": []})
            self.assertEqual(r["fields"]["dominantClass"], [1, 2, 3, 2])
            self.assertEqual(r["fields"]["coverage"], [.75, 1, 1, 1])
            self.assertEqual(r["fields"]["classFractions"][0], [.75, 0, 0])
            self.assertEqual(r["coverage"]["sampledFraction"], .9375)

    def test_nonoverlapping_grid_is_unknown_not_an_invented_class(self):
        mars = rasterio.crs.CRS.from_proj4("+proj=eqc +lat_ts=0 +R=3396190 +units=m +no_defs")
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "categorical.tif"
            with rasterio.open(path, "w", driver="GTiff", width=1, height=1, count=1, dtype="uint8", crs=mars, transform=from_origin(0, 5, 5, 5), nodata=127) as ds:
                ds.write(np.ones((1, 1), dtype="uint8"), 1)
            grid = {"width": 1, "height": 1, "cellSize": 5, "bounds": [100, 100, 105, 105], "crs": mars.to_wkt()}
            r = noah.build_region("test", grid, path, [{"id": 1, "label": "observed"}], {"controlPointFiles": []})
            self.assertEqual(r["fields"]["dominantClass"], [None])
            self.assertEqual(r["fields"]["classFractions"], [None])
            self.assertEqual(r["coverage"]["sampledFraction"], 0)


class PublishedActualData(unittest.TestCase):
    def test_source_rank_legend_and_actual_coverage(self):
        root = Path(__file__).resolve().parents[1] / "public" / "data"
        new = json.loads((root / "noah" / "noah-terrain.json").read_text(encoding="utf-8"))
        definitions = {item["id"]: item["label"] for item in new["classes"]}
        # These are the original published MOSAIC rank codes, not the
        # differently numbered raw NOAH-H network raster classes.
        self.assertEqual(definitions[11], "Boulder Fields")
        self.assertEqual(definitions[10], "Bedrock: Rugged")
        self.assertEqual(definitions[8], "Non Bedrock: Smooth, Lineated")
        self.assertEqual(new["source"]["archiveMd5"], noah.ARCHIVE_MD5)
        self.assertTrue(new["source"]["archiveChecksumVerified"])
        self.assertIsNone(new["registration"]["residualMetres"])
        self.assertEqual(new["grid"]["bounds"], [4360409.037914526, 1093711.6170900527, 4361409.037914526, 1094711.6170900527])
        self.assertGreater(new["coverage"]["sampledFraction"], .89)
        self.assertLess(new["coverage"]["sampledFraction"], .91)
        self.assertGreater(new["coverage"]["unknownCells"], 0)
        self.assertEqual(len(new["fields"]["dominantClass"]), 40000)
        for fractions, coverage in zip(new["fields"]["classFractions"], new["fields"]["coverage"]):
            if fractions is None:
                self.assertEqual(coverage, 0)
            else:
                self.assertEqual(len(fractions), 14)
                self.assertAlmostEqual(sum(fractions), coverage, places=5)
        for region in ["floor", "ridge"]:
            path = root / ("ridge/noah-terrain.json" if region == "ridge" else "noah-terrain.json")
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(data["coverage"]["sampledFraction"], 0)
            self.assertTrue(all(v is None for v in data["fields"]["dominantClass"]))


if __name__ == "__main__":
    unittest.main()
