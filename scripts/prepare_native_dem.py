"""Export the supplied native Jezero DEM without resampling its observations.

The binary format is little-endian Float32, row-major, one height per source
pixel centre. Source NoData and nonfinite values are represented by NaN. The
JSON sidecar records the original Mars CRS, raster-edge bounds and affine
transform, so the browser can interpolate actual native heights correctly.

Run using the project's Python environment:
    ../.venv/Scripts/python scripts/prepare_native_dem.py
    ../.venv/Scripts/python scripts/prepare_native_dem.py --check
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
SOURCE = DATA / "jezero-dem-1m.tif"
BINARY = DATA / "jezero-native-dem.bin"
METADATA = DATA / "jezero-native-dem.json"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def prepare(check: bool = False) -> dict:
    source_bytes = SOURCE.read_bytes()
    with rasterio.open(SOURCE) as src:
        transform = src.transform
        if src.count != 1 or src.crs is None:
            raise ValueError("Expected a single-band georeferenced source DEM")
        if transform.b != 0 or transform.d != 0 or transform.a <= 0 or transform.e >= 0:
            raise ValueError("Expected the existing north-up Mars raster")
        if not np.allclose(src.res, [1.0, 1.0], rtol=0, atol=1e-9):
            raise ValueError("Source is not the documented native 1 m DEM")
        masked = src.read(1, masked=True)
        heights = np.asarray(masked.filled(np.nan), dtype="<f4")
        heights[~np.isfinite(heights)] = np.nan
        width, height = src.width, src.height
        bounds, crs = list(src.bounds), src.crs.to_wkt()
        nodata = src.nodata

    planning = json.loads((DATA / "terrain.json").read_text(encoding="utf-8"))
    if not np.allclose(bounds, planning["bounds"], rtol=0, atol=1e-8):
        raise ValueError("Native and planning raster-edge bounds differ")
    if width != planning["width"] * 5 or height != planning["height"] * 5:
        raise ValueError("Native and planning grid dimensions do not align")
    if not np.allclose(planning["cellSize"], 5.0):
        raise ValueError("Expected existing 5 m planning grid")

    # The existing planning DEM stores the 5x5 native-pixel mean rounded to
    # centimetres. Compare in Float64 so Float32 summation error is not added.
    blocks = heights.astype("float64").reshape(planning["height"], 5, planning["width"], 5)
    aggregate = np.nanmean(blocks, axis=(1, 3)).reshape(-1)
    reference = np.asarray([np.nan if v is None else v for v in planning["elevation"]])
    overlap = np.isfinite(aggregate) & np.isfinite(reference)
    if not np.any(overlap):
        raise ValueError("No overlap with the existing planning elevations")
    max_aggregate_error = float(np.max(np.abs(aggregate[overlap] - reference[overlap])))
    if max_aggregate_error > 0.005001:
        raise ValueError(f"Planning means differ beyond documented rounding: {max_aggregate_error}")

    optical = json.loads((DATA / "optical-meta.json").read_text(encoding="utf-8"))
    if not np.allclose(bounds, optical["bounds"], rtol=0, atol=1e-8):
        raise ValueError("Optical and native DEM bounds differ")
    with Image.open(DATA / "optical.webp") as image:
        optical_size, optical_mode = list(image.size), image.mode

    encoded = heights.tobytes(order="C")
    valid = np.isfinite(heights)
    metadata = {
        "schemaVersion": 1,
        "url": "/data/jezero-native-dem.bin",
        "width": width,
        "height": height,
        "cellSize": 1.0,
        "nativeResolution": [1.0, 1.0],
        "bounds": bounds,
        "crs": crs,
        "verticalUnits": "metres",
        "verticalReference": "Unmodified elevations from the published source DEM; no Earth datum conversion",
        "dataType": "float32",
        "byteOrder": "little-endian",
        "layout": "row-major, rows north to south, columns west to east",
        "noData": "NaN",
        "sourceNoData": nodata,
        "pixelCentreOffset": [0.5, 0.5],
        "affine": {
            "a": transform.a, "b": transform.b, "c": transform.c,
            "d": transform.d, "e": transform.e, "f": transform.f,
        },
        "coordinateFormula": {
            "easting": "bounds[0] + (column + 0.5) * cellSize",
            "northing": "bounds[3] - (row + 0.5) * cellSize",
        },
        "interpolation": "Sample coordinates are native pixel centres; any browser bilinear interpolation is a derived display/camera height, not a finer observation",
        "source": {
            "file": "/data/jezero-dem-1m.tif",
            "originalProduct": "cenjez_DEM_1m.tif",
            "record": "https://data.caltech.edu/records/stqse-yay61",
            "doi": "10.22002/stqse-yay61",
            "version": "v2 (2024)",
            "credit": "NASA MRO HiRISE / Caltech; Annex & Ehlmann (2024)",
            "license": "CC BY 4.0",
            "sourceCropSha256": digest(source_bytes),
            "processing": "Existing native 1 m crop copied into little-endian Float32; no spatial resampling, terrain synthesis or vertical exaggeration",
        },
        "opticalReference": {
            "url": "/data/optical.webp",
            "displayPixels": optical_size,
            "displayMode": optical_mode,
            "displayMetresPerPixel": [(bounds[2] - bounds[0]) / optical_size[0], (bounds[3] - bounds[1]) / optical_size[1]],
            "nativeMetresPerPixel": optical["sourceResolution"],
            "source": optical["source"],
            "processing": "Existing contrast-stretched, bilinear 1 m display resampling; native approximately 0.3 m observations are not all retained in this display asset",
            "annotationLimit": "Individual sub-display-pixel objects cannot be verified from this WebP; manual annotations are observations/candidates, not validated boulder classifications",
        },
        "statistics": {
            "validPixels": int(valid.sum()),
            "validFraction": float(valid.mean()),
            "min": float(np.nanmin(heights)),
            "max": float(np.nanmax(heights)),
            "mean": float(np.nanmean(heights.astype("float64"))),
        },
        "validation": {
            "planningCellSizeMetres": 5,
            "planningCellsCompared": int(overlap.sum()),
            "planningRoundedMeanMaxAbsoluteErrorMetres": max_aggregate_error,
            "planningRoundingToleranceMetres": 0.005001,
            "boundsAndOpticalAlignment": "exact within 1e-8 projected metres",
            "binaryByteLength": len(encoded),
            "binarySha256": digest(encoded),
        },
        "limitations": "Native pixel spacing is not vertical accuracy or registration accuracy. Observation dates and inter-product registration error remain unknown. Heights do not resolve all small rocks or establish walkability.",
    }

    if check:
        stored = BINARY.read_bytes()
        sidecar = json.loads(METADATA.read_text(encoding="utf-8"))
        if stored != encoded or sidecar != metadata:
            raise ValueError("Browser native DEM assets do not exactly match source/metadata")
        decoded = np.frombuffer(stored, dtype="<f4").reshape(height, width)
        if not np.array_equal(decoded, heights, equal_nan=True):
            raise ValueError("Browser Float32 round-trip differs from source heights")
    else:
        BINARY.write_bytes(encoded)
        METADATA.write_text(json.dumps(metadata, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate existing outputs without rewriting")
    args = parser.parse_args()
    result = prepare(check=args.check)
    print(json.dumps({"status": "verified" if args.check else "written", "width": result["width"], "height": result["height"], "statistics": result["statistics"], "validation": result["validation"]}, indent=2))
