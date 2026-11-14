"""Prepare real HiRISE textures at approximately the native 0.3 m scale.

This is a display-only product. It does not replace the frozen 0.5 m optical
detector inputs, annotations, planning rasters or scientific products.

    ../.venv/Scripts/python scripts/prepare_surface_optical.py
    ../.venv/Scripts/python scripts/prepare_surface_optical.py --check

The existing bounded HTTPS range bridge verifies every partial response. The
whole 1.64 GB source is neither downloaded nor claimed checksum-verified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from detect_optical import RangeState, range_server, SOURCE_URL, SOURCE_SIZE, PUBLISHED_SOURCE_MD5

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT.parent / "data-cache"
DATA = ROOT / "public" / "data"
PIXELS = 3334
QUALITY = 97
PERCENTILES = [1, 99]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def region_path(region: str) -> Path:
    return DATA / "ridge" if region == "ridge" else DATA


def acquire(regions: list[str]) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    pending = [r for r in regions if not (CACHE / f"surface-optical-{r}-0_3m.npz").exists()]
    if not pending:
        return
    state = RangeState(maximum_bytes=96 * 1024 * 1024)
    server = range_server(state)
    try:
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MULTIRANGE="NO", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif", GDAL_CACHEMAX=64 * 1024 * 1024):
            with rasterio.open(f"http://127.0.0.1:{server.server_port}/optical.tif") as src:
                for region in pending:
                    t = json.loads((region_path(region) / "terrain.json").read_text(encoding="utf-8"))
                    if src.crs != rasterio.crs.CRS.from_wkt(t["crs"]):
                        raise ValueError("Optical source CRS differs from planning CRS")
                    bounds = t["bounds"]
                    window = from_bounds(*bounds, src.transform)
                    before = state.bytes_received
                    first_request = len(state.requests)
                    masked = src.read(1, window=window, out_shape=(PIXELS, PIXELS), out_dtype="float32", resampling=Resampling.bilinear, masked=True)
                    raw = masked.filled(np.nan).astype("<f4")
                    if not np.isfinite(raw).all():
                        raise ValueError("These display crops require a complete observed optical footprint")
                    meta = {
                        "source": SOURCE_URL, "sourcePublishedMd5": PUBLISHED_SOURCE_MD5,
                        "sourceBytes": SOURCE_SIZE, "wholeSourceChecksumVerified": False,
                        "sourceResolution": list(src.res), "sourceRasterSize": [src.width, src.height],
                        "sourceWindow": [window.col_off, window.row_off, window.width, window.height],
                        "bounds": bounds, "crs": src.crs.to_wkt(),
                        "outputResolution": [(bounds[2] - bounds[0]) / PIXELS, (bounds[3] - bounds[1]) / PIXELS],
                        "cropFloat32Sha256": sha(raw.tobytes()),
                        "resampling": "bilinear at approximately native source spacing; no super-resolution",
                        "newTransferBytesForRegion": state.bytes_received - before,
                        "totalTransferBytesThisAcquisition": state.bytes_received,
                        "headerAndCropRangeRequests": state.requests.copy(),
                        "cropRequestStartIndex": first_request,
                        "rangeValidation": "HTTPS TLS verified; each HTTP206 Content-Range and byte length checked; SHA256 retained for every transferred byte range",
                    }
                    np.savez_compressed(CACHE / f"surface-optical-{region}-0_3m.npz", image=raw, metadata=json.dumps(meta, sort_keys=True))
                    print(f"Fetched {region}: {PIXELS} x {PIXELS}; total transferred {state.bytes_received:,} bytes", flush=True)
    finally:
        server.shutdown()
        server.server_close()


def write_region(region: str, check: bool) -> dict:
    output = region_path(region)
    terrain = json.loads((output / "terrain.json").read_text(encoding="utf-8"))
    cached_path = CACHE / f"surface-optical-{region}-0_3m.npz"
    with np.load(cached_path) as cached:
        raw = cached["image"]
        source = json.loads(str(cached["metadata"]))
    if raw.shape != (PIXELS, PIXELS) or not np.isfinite(raw).all():
        raise ValueError("Invalid source crop")
    if sha(np.asarray(raw, dtype="<f4").tobytes()) != source["cropFloat32Sha256"]:
        raise ValueError("Source crop checksum differs")
    if not np.allclose(source["bounds"], terrain["bounds"], rtol=0, atol=1e-8):
        raise ValueError("Source crop is not aligned to the planning bounds")
    if rasterio.crs.CRS.from_wkt(source["crs"]) != rasterio.crs.CRS.from_wkt(terrain["crs"]):
        raise ValueError("Source crop CRS mismatch")
    lo, hi = np.percentile(raw, PERCENTILES)
    if not hi > lo:
        raise ValueError("Optical crop has no display range")
    display = np.round(np.clip((raw - lo) / (hi - lo), 0, 1) * 255).astype("uint8")
    path = output / "surface-optical.webp"
    meta_path = output / "surface-optical-meta.json"
    if not check:
        Image.fromarray(display).save(path, quality=QUALITY, method=6)
    image_bytes = path.read_bytes()
    with Image.open(path) as im:
        if im.size != (PIXELS, PIXELS):
            raise ValueError("Texture dimensions differ")
        im.verify()
    prefix = "/data/ridge" if region == "ridge" else "/data"
    meta = {
        "schemaVersion": 1, "region": region, "image": prefix + "/surface-optical.webp",
        "classification": "observed optical display product", "width": PIXELS, "height": PIXELS,
        "metresPerPixel": source["outputResolution"][0], "nativeMetresPerPixel": source["sourceResolution"],
        "bounds": source["bounds"], "crs": source["crs"],
        "layout": "rows north to south, columns west to east; pixel centres at (column + 0.5, row + 0.5)",
        "source": source,
        "credit": "NASA MRO HiRISE / Caltech; Annex & Ehlmann (2024), DOI 10.22002/stqse-yay61, CC BY 4.0",
        "processing": {"resampling": source["resampling"], "contrastPercentiles": PERCENTILES,
            "contrastRawRange": [float(lo), float(hi)], "encoding": f"grayscale WebP quality{QUALITY}",
            "sharpening": "none", "imageSha256": sha(image_bytes), "imageByteLength": len(image_bytes)},
        "validation": {"boundsToleranceMetres": 1e-8, "crsMatchesPlanningGrid": True,
            "validOpticalFraction": float(np.isfinite(raw).mean()), "wholeSourceChecksumVerified": False},
        "limitations": "Approximately 0.3 m orbital pixel spacing is not centimetre-scale ground imagery, positional accuracy, or boulder validation. DEM spacing remains 1 m and planning cells remain 5 m. This product does not alter detector inputs or observations. No AI generation, synthetic rocks, procedural geography or super-resolution was used.",
    }
    if check:
        stored = json.loads(meta_path.read_text(encoding="utf-8"))
        if stored != meta:
            raise ValueError("Published display metadata differs from its source crop or image")
    else:
        meta_path.write_text(json.dumps(meta, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    return {"region": region, "status": "verified" if check else "written", "width": PIXELS,
        "metresPerPixel": meta["metresPerPixel"], "nativeMetresPerPixel": meta["nativeMetresPerPixel"],
        "imageByteLength": len(image_bytes), "imageSha256": sha(image_bytes),
        "transferBytes": source["totalTransferBytesThisAcquisition"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate existing crops and published images without network access")
    parser.add_argument("--region", choices=["floor", "ridge", "both"], default="both")
    args = parser.parse_args()
    regions = ["floor", "ridge"] if args.region == "both" else [args.region]
    if not args.check:
        acquire(regions)
    print(json.dumps([write_region(region, args.check) for region in regions], indent=2))
