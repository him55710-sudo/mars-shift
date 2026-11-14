"""Deterministic HiRISE optical obstacle *candidate* generation.

No learned detector, boulder confirmation, probability, or safety classification
is produced. The frozen v1 configuration was chosen before inspecting held-out
Mars-Bench test images. Source crops are real range-read HiRISE orthomosaic data.

Project Python environment:
    ../.venv/Scripts/python scripts/detect_optical.py
    ../.venv/Scripts/python scripts/detect_optical.py --test
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass, field
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import re
from threading import Lock, Thread
import unittest

import numpy as np
from PIL import Image, ImageDraw
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from scipy import ndimage as ndi
import truststore

truststore.inject_into_ssl()
import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
CACHE = ROOT.parent / "data-cache"
ARTIFACTS = ROOT / ".local" / "optical-detection"
SOURCE_URL = "https://data.caltech.edu/api/records/stqse-yay61/files/cenjez_DRG_0_3m.tif/content"
SOURCE_SIZE = 1640221885
PUBLISHED_SOURCE_MD5 = "cb546a61f83426c56a5576523423f9fa"
DISPLAY_RESOLUTION_M = 0.5

# Frozen before any held-out Mars-Bench test-image inspection. Changes require
# a new version and a fresh held-out evaluation, not tuning on the existing test.
DEFAULT_CONFIG = {
    "version": "shadow-contrast-v1",
    "normalization_percentiles": [1.0, 99.0],
    "background_sigma_m": 3.0,
    "dark_residual_threshold": 0.055,
    "dark_percentile_ceiling": 50.0,
    "min_area_m2": 0.75,
    "max_area_m2": 50.0,
    "max_bbox_length_m": 16.0,
    "max_aspect_ratio": 4.0,
    "min_fill_ratio": 0.12,
    "bright_pair_threshold": 0.025,
    "search_ring_m": 2.0,
    "candidate_buffer_m": 1.0,
    "min_separation_m": 4.0,
    "maximum_candidates": 150,
}


def config_sha256(config: dict | None = None) -> str:
    return hashlib.sha256(json.dumps(config or DEFAULT_CONFIG, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def detect(image: np.ndarray, config: dict | None = None, resolution_m: float = 0.5) -> dict:
    """Return cue mask, ranked unreviewed candidates, and counts.

    `image` is a grayscale raster or RGB/RGBA raster. Returned pixel centres
    use zero-based continuous pixel-index coordinates. `mask` contains retained
    dark cue components (before route buffering), not a learned rock mask.
    This API performs no source access and can evaluate an independent dataset.
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    if not math.isfinite(resolution_m) or resolution_m <= 0:
        raise ValueError("resolution_m must be positive")
    gray = np.asarray(image, dtype=np.float32)
    if gray.ndim == 3:
        gray = np.mean(gray[..., :3], axis=2)
    if gray.ndim != 2 or min(gray.shape) < 3:
        raise ValueError("Expected a grayscale or RGB raster")
    valid = np.isfinite(gray)
    empty = np.zeros(gray.shape, dtype=bool)
    if not valid.any():
        return {"mask": empty, "candidates": [], "stats": {"rawComponents": 0, "eligibleComponents": 0, "selected": 0, "validFraction": 0.0, "configSha256": config_sha256(cfg)}}
    lo, hi = np.percentile(gray[valid], cfg["normalization_percentiles"])
    if hi - lo <= np.finfo(np.float32).eps:
        return {"mask": empty, "candidates": [], "stats": {"rawComponents": 0, "eligibleComponents": 0, "selected": 0, "validFraction": float(valid.mean()), "configSha256": config_sha256(cfg)}}
    normalized = np.clip((np.where(valid, gray, np.median(gray[valid])) - lo) / (hi - lo), 0, 1)
    background = ndi.gaussian_filter(normalized, cfg["background_sigma_m"] / resolution_m)
    dark_residual = background - normalized
    bright_residual = normalized - background
    median_ceiling = np.percentile(normalized[valid], cfg["dark_percentile_ceiling"])
    seeds = valid & (dark_residual >= cfg["dark_residual_threshold"]) & (normalized <= median_ceiling)
    # A 2x2 closing links a split shadow cue; it does not add synthetic imagery.
    mask = ndi.binary_closing(seeds, structure=np.ones((2, 2), dtype=bool))
    safe_valid = ndi.binary_erosion(valid, iterations=max(1, math.ceil(cfg["search_ring_m"] / resolution_m)), border_value=0)
    mask &= safe_valid
    labels, count = ndi.label(mask, structure=np.ones((3, 3), dtype=np.uint8))
    objects = ndi.find_objects(labels)
    ring_pixels = max(1, math.ceil(cfg["search_ring_m"] / resolution_m))
    candidates = []
    for label_id, slices in enumerate(objects, 1):
        if slices is None:
            continue
        ys, xs = slices
        width, height = xs.stop - xs.start, ys.stop - ys.start
        part = labels[slices] == label_id
        pixel_area = int(part.sum())
        area_m2 = pixel_area * resolution_m**2
        if not (cfg["min_area_m2"] <= area_m2 <= cfg["max_area_m2"]):
            continue
        if max(width, height) * resolution_m > cfg["max_bbox_length_m"]:
            continue
        aspect = max(width, height) / max(1, min(width, height))
        fill = pixel_area / (width * height)
        if aspect > cfg["max_aspect_ratio"] or fill < cfg["min_fill_ratio"]:
            continue
        outer = (slice(max(0, ys.start-ring_pixels), min(gray.shape[0], ys.stop+ring_pixels)), slice(max(0, xs.start-ring_pixels), min(gray.shape[1], xs.stop+ring_pixels)))
        local_component = labels[outer] == label_id
        ring = ndi.binary_dilation(local_component, iterations=ring_pixels) & ~local_component & valid[outer]
        if not ring.any():
            continue
        bright_peak = float(np.max(bright_residual[outer][ring]))
        if bright_peak < cfg["bright_pair_threshold"]:
            continue
        contrast = float(np.median(background[slices][part] - normalized[slices][part]))
        dark_peak = float(np.max(dark_residual[slices][part]))
        y_local, x_local = ndi.center_of_mass(part)
        cx, cy = float(xs.start+x_local), float(ys.start+y_local)
        # A transparent ranking heuristic, never a calibrated probability.
        compactness = min(1.0, fill / max(1.0, math.sqrt(aspect)))
        score = float(np.clip(0.50 * min(1.0, contrast/.25) + 0.20*compactness + 0.15*min(1.0, bright_peak/.2) + 0.15*min(1.0, dark_peak/.3), 0, 1))
        candidates.append({
            "pixelCenter": [round(cx, 4), round(cy, 4)],
            "pixelBBox": [int(xs.start), int(ys.start), int(width), int(height)],
            "radiusMeters": round(max(resolution_m, math.hypot(width, height)*resolution_m/2) + cfg["candidate_buffer_m"], 3),
            "score": round(score, 5),
            "evidence": {"componentPixels": pixel_area, "darkCueAreaM2": round(area_m2, 4), "medianDarkContrast": round(contrast, 6), "peakDarkResidual": round(dark_peak, 6), "adjacentBrightResidual": round(bright_peak, 6), "bboxFillRatio": round(fill, 6), "bboxAspectRatio": round(aspect, 6)},
            "_label": label_id,
        })
    candidates.sort(key=lambda c: (-c["score"], -c["evidence"]["darkCueAreaM2"], c["pixelBBox"][1], c["pixelBBox"][0]))
    retained = []
    for candidate in candidates:
        cx, cy = candidate["pixelCenter"]
        if any(math.hypot(cx-r["pixelCenter"][0], cy-r["pixelCenter"][1])*resolution_m < cfg["min_separation_m"] for r in retained):
            continue
        retained.append(candidate)
        if len(retained) >= cfg["maximum_candidates"]:
            break
    retained_labels = [c.pop("_label") for c in retained]
    cue_mask = np.isin(labels, retained_labels) if retained_labels else empty
    return {"mask": cue_mask, "candidates": retained, "stats": {"rawComponents": count, "eligibleComponents": len(candidates), "selected": len(retained), "validFraction": float(valid.mean()), "truncatedOrSuppressed": len(candidates)-len(retained), "configSha256": config_sha256(cfg), "normalizationRawRange": [float(lo), float(hi)]}}


def detect_candidates(image: np.ndarray, resolution_m: float, config: dict | None = None) -> list:
    return detect(image, config=config, resolution_m=resolution_m)["candidates"]


@dataclass
class RangeState:
    bytes_received: int = 0
    reserved_bytes: int = 0
    requests: list = field(default_factory=list)
    cache: dict = field(default_factory=dict)
    lock: Lock = field(default_factory=Lock)
    maximum_bytes: int = 96 * 1024 * 1024


def range_server(state: RangeState):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_HEAD(self):
            if self.path != "/optical.tif":
                self.send_error(404); return
            self.send_response(200)
            self.send_header("Content-Length", str(SOURCE_SIZE))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()

        def do_GET(self):
            if self.path != "/optical.tif":
                self.send_error(404); return
            requested = self.headers.get("Range", "bytes=0-16383")
            match = re.fullmatch(r"bytes=(\d+)-(\d+)", requested)
            if not match or int(match[2]) < int(match[1]) or int(match[2]) >= SOURCE_SIZE or int(match[2])-int(match[1])+1 > 32*1024*1024:
                self.send_error(416); return
            requested_bytes = int(match[2])-int(match[1])+1
            with state.lock:
                cached = state.cache.get(requested)
                if cached is None:
                    if state.bytes_received + state.reserved_bytes + requested_bytes > state.maximum_bytes:
                        self.send_error(429, "Bounded source transfer budget reached"); return
                    state.reserved_bytes += requested_bytes
            if cached is None:
                try:
                    response = requests.get(SOURCE_URL, headers={"Range": requested}, timeout=90)
                    if response.status_code != 206:
                        self.send_error(502, "Source did not return a verified byte range"); return
                    expected = f"bytes {match[1]}-{match[2]}/{SOURCE_SIZE}"
                    if response.headers.get("Content-Range") != expected:
                        self.send_error(502, "Source range metadata mismatch"); return
                    content = response.content
                    if len(content) != requested_bytes:
                        self.send_error(502, "Source range byte count mismatch"); return
                    cached = (content, expected)
                    with state.lock:
                        state.bytes_received += len(content)
                        state.cache[requested] = cached
                        state.requests.append({"range": requested, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
                except requests.RequestException:
                    self.send_error(502, "Verified source request failed"); return
                finally:
                    with state.lock:
                        state.reserved_bytes -= requested_bytes
            self.send_response(206)
            self.send_header("Content-Length", str(len(cached[0])))
            self.send_header("Content-Range", cached[1])
            self.send_header("Content-Type", "image/tiff")
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            self.wfile.write(cached[0])
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    return server


def acquire_crops(regions: list[str], force: bool = False):
    CACHE.mkdir(exist_ok=True, parents=True)
    pending = [region for region in regions if force or not (CACHE/f"optical-native-{region}-0_5m.npz").exists()]
    if not pending:
        return
    state = RangeState()
    server = range_server(state)
    try:
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MULTIRANGE="NO", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif", GDAL_CACHEMAX=64*1024*1024):
            with rasterio.open(f"http://127.0.0.1:{server.server_port}/optical.tif") as src:
                for region in pending:
                    output = DATA/"ridge" if region == "ridge" else DATA
                    terrain = json.loads((output/"terrain.json").read_text(encoding="utf-8"))
                    if src.crs != rasterio.crs.CRS.from_wkt(terrain["crs"]):
                        raise ValueError("Optical source CRS differs from the terrain CRS")
                    bounds = terrain["bounds"]
                    width = round((bounds[2]-bounds[0])/DISPLAY_RESOLUTION_M)
                    height = round((bounds[3]-bounds[1])/DISPLAY_RESOLUTION_M)
                    window = from_bounds(*bounds, src.transform)
                    image = src.read(1, window=window, out_shape=(height, width), out_dtype="float32", resampling=Resampling.bilinear, masked=True)
                    metadata = {"bounds": bounds, "crs": src.crs.to_wkt(), "sourceResolution": list(src.res), "sourceWindow": [window.col_off, window.row_off, window.width, window.height], "sourceRasterSize": [src.width, src.height], "outputResolution": [(bounds[2]-bounds[0])/width, (bounds[3]-bounds[1])/height], "resampling": "bilinear", "source": SOURCE_URL, "sourcePublishedMd5": PUBLISHED_SOURCE_MD5, "wholeSourceChecksumVerified": False, "transferBytesThisAcquisition": state.bytes_received, "rangeRequests": state.requests.copy()}
                    raw = image.filled(np.nan).astype("float32")
                    metadata["cropFloat32Sha256"] = hashlib.sha256(raw.astype("<f4").tobytes()).hexdigest()
                    path = CACHE/f"optical-native-{region}-0_5m.npz"
                    np.savez_compressed(path, image=raw, metadata=json.dumps(metadata, sort_keys=True))
                    print(f"Fetched {region}: {width}x{height}, total source transfer {state.bytes_received:,} bytes", flush=True)
    finally:
        server.shutdown(); server.server_close()


def write_region(region: str):
    output = DATA/"ridge" if region == "ridge" else DATA
    terrain = json.loads((output/"terrain.json").read_text(encoding="utf-8"))
    with np.load(CACHE/f"optical-native-{region}-0_5m.npz") as cached:
        raw, source = cached["image"], json.loads(str(cached["metadata"]))
    detection = detect(raw, resolution_m=DISPLAY_RESOLUTION_M)
    valid = np.isfinite(raw)
    lo, hi = np.percentile(raw[valid], DEFAULT_CONFIG["normalization_percentiles"])
    display = np.clip((np.nan_to_num(raw, nan=lo)-lo)/(hi-lo), 0, 1)
    image = Image.fromarray(np.round(display*255).astype("uint8"), mode="L")
    evidence_path = output/"optical-native.webp"
    image.save(evidence_path, quality=95, method=6)
    prefix = "/data/ridge" if region == "ridge" else "/data"
    candidates = []
    for n, item in enumerate(detection["candidates"], 1):
        cx, cy = item["pixelCenter"]
        east, south = (cx+.5)*DISPLAY_RESOLUTION_M, (cy+.5)*DISPLAY_RESOLUTION_M
        x, y = east/terrain["cellSize"]-.5, south/terrain["cellSize"]-.5
        grid_x, grid_y = min(terrain["width"]-1, max(0, round(x))), min(terrain["height"]-1, max(0, round(y)))
        index = grid_y*terrain["width"]+grid_x
        candidates.append({"id": f"{region}-optical-{n:03d}", "kind": "optical-candidate", "status": "candidate", "reviewStatus": "unreviewed", "excludedFromRouting": False, "point": {"x": round(x, 5), "y": round(y, 5)}, "projectedPosition": {"easting": terrain["bounds"][0]+east, "northing": terrain["bounds"][3]-south}, **item, "evidence": {**item["evidence"], "maximumCellSlopeDegrees": terrain["slope"][index], "localReliefMetres": terrain["roughness"][index], "terrainGridMetres": terrain["cellSize"], "signals": ["compact dark local-contrast component", "adjacent brighter-than-background pixels"], "interpretation": "Image cue may be a shadow, rock, small crater, texture, or mosaic artifact; no boulder confirmation"}})
    metadata = {"schemaVersion": 1, "region": region, "image": f"{prefix}/optical-native.webp", "width": image.width, "height": image.height, "metresPerPixel": DISPLAY_RESOLUTION_M, "nativeMetresPerPixel": source["sourceResolution"], "bounds": terrain["bounds"], "crs": terrain["crs"], "source": source, "credit": "NASA MRO HiRISE / Caltech; Annex & Ehlmann (2024), DOI 10.22002/stqse-yay61, CC BY 4.0", "processing": {"display": "Bilinear source sampling to exact 0.5 m pixels; 1–99 percentile grayscale stretch; WebP quality95", "imageSha256": hashlib.sha256(evidence_path.read_bytes()).hexdigest(), "imageByteLength": evidence_path.stat().st_size}, "limitations": "This display samples native ~0.3 m imagery at 0.5 m. Pixel spacing is not positional accuracy. Observation date and optical/DEM registration error are unknown. No automatic boulder confirmation or subpixel reconstruction."}
    (output/"optical-native-meta.json").write_text(json.dumps(metadata, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    payload = {"schemaVersion": 1, "region": region, "method": "deterministic optical shadow/contrast candidates", "config": DEFAULT_CONFIG, "configSha256": config_sha256(), "sourceImage": f"{prefix}/optical-native.webp", "sourceMetadata": f"{prefix}/optical-native-meta.json", "sourceCropSha256": source["cropFloat32Sha256"], "bounds": terrain["bounds"], "crs": terrain["crs"], "pixelResolutionMetres": DISPLAY_RESOLUTION_M, "nativeOpticalResolutionMetres": source["sourceResolution"], "planningGridMetres": terrain["cellSize"], "scoreDefinition": "Transparent dimensionless ranking heuristic, not a probability/confidence or validated classifier score", "status": "unreviewed optical candidates", "routingPolicy": "No candidate is automatically excluded; a user must review and explicitly accept/edit an exclusion buffer", "validation": {"independentAccuracyEstablished": False, "visualAuditIsNotGroundTruth": True, "candidateMaskIsNotBoulderSegmentation": True, "heldOutBenchmark": "Mars-Bench mb-boulder_seg v1, separate evaluation; no test-set tuning permitted"}, "statistics": detection["stats"], "candidates": candidates, "limitations": ["Dark/bright pairs can be rocks, small crater edges, dunes/ripples, fractures, shadows or mosaic artifacts.", "Boulders without visible compact shadow/contrast, masked pixels and subpixel objects can be missed.", "The top150 ranking and minimum spacing intentionally suppress candidates; absence is not clear terrain.", "Native source approximately0.3m; evidence display0.5m; routing grid5m. None resolves all small obstacles.", "Shadow-centred locations and optical/DEM registration are uncertain; inspection and editable buffers are required."]}
    (output/"obstacle-candidates.json").write_text(json.dumps(payload, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    ARTIFACTS.mkdir(exist_ok=True, parents=True)
    overview = image.convert("RGB").resize((1000, 1000))
    draw = ImageDraw.Draw(overview)
    for item in candidates:
        bx, by, bw, bh = item["pixelBBox"]
        draw.rectangle((bx/2, by/2, (bx+bw)/2, (by+bh)/2), outline="#ff9f65", width=2)
    overview.save(ARTIFACTS/f"{region}-candidate-overview.png")
    sheets = Image.new("RGB", (5*240, 4*265), "#18201b")
    painter = ImageDraw.Draw(sheets)
    for n, item in enumerate(candidates[:20]):
        cx, cy = item["pixelCenter"]
        left = min(image.width-160, max(0, round(cx)-80))
        top = min(image.height-160, max(0, round(cy)-80))
        crop = image.crop((left, top, left+160, top+160)).convert("RGB").resize((230, 230))
        x, y = (n%5)*240+5, (n//5)*265+5
        sheets.paste(crop, (x, y))
        bx, by, bw, bh = item["pixelBBox"]
        painter.rectangle((x+(bx-left)*230/160, y+(by-top)*230/160, x+(bx+bw-left)*230/160, y+(by+bh-top)*230/160), outline="#f39465", width=1)
        painter.text((x,y+235), f"{item['id']} score {item['score']:.3f}", fill="#e3e8d6")
    sheets.save(ARTIFACTS/f"{region}-top20-audit.png")
    print(json.dumps({"region": region, "statistics": detection["stats"], "imageBytes": evidence_path.stat().st_size, "output": str(output/"obstacle-candidates.json")}), flush=True)


class DetectorTests(unittest.TestCase):
    def test_flat_has_no_candidates(self):
        self.assertEqual(detect(np.full((100,100), 70.0))["candidates"], [])

    def test_invalid_and_empty_regions_have_no_candidates(self):
        result = detect(np.full((100,100), np.nan))
        self.assertFalse(result["mask"].any())
        self.assertEqual(result["candidates"], [])

    def test_deterministic_compact_dark_bright_cue(self):
        image = np.tile(np.linspace(0.4, 0.6, 100, dtype=np.float32), (100, 1))
        image[48:52,48:52] = 0.1
        image[47:52,53:56] = 0.9
        first = detect(image)
        second = detect(image)
        self.assertEqual(first["candidates"], second["candidates"])
        self.assertTrue(first["candidates"])
        self.assertLess(abs(first["candidates"][0]["pixelCenter"][0]-49.5), 3)
        self.assertEqual(first["stats"]["configSha256"], config_sha256())

    def test_resolution_validation(self):
        with self.assertRaises(ValueError): detect(np.zeros((10,10)), resolution_m=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--region", choices=["floor", "ridge", "both"], default="both")
    parser.add_argument("--force-acquire", action="store_true")
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()
    if args.test:
        unittest.main(argv=[__file__]); return
    regions = ["floor", "ridge"] if args.region == "both" else [args.region]
    acquire_crops(regions, force=args.force_acquire)
    for region in regions:
        write_region(region)


if __name__ == "__main__":
    main()
