"""Apply the already frozen V2 model to both real 0.5 m local crops.

Preserves V1 assets. Semantic threshold is selected only on Mars-Bench val6.
Candidate geometry constants are inherited unchanged from pre-test frozen V1;
no Jezero imagery/labels are used to adjust this model or postprocessing.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import time

import joblib
import numpy as np
from PIL import Image
from scipy import ndimage
from threadpoolctl import threadpool_limits

import benchmark_optical as benchmark
import train_optical as trained

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT.parent / "data-cache"
FILTERS = {"min_area_m2": 0.75, "max_area_m2": 50.0, "max_bbox_length_m": 16.0,
           "max_aspect_ratio": 4.0, "min_fill_ratio": 0.12, "candidate_buffer_m": 1.0,
           "min_separation_m": 4.0, "maximum_candidates": 150}
EXPECTED_JOBLIB_SHA256 = "12fdf0364930d0739f4a00ac54f4095b95d11ffcbe667e56844b59908631eb37"


def component_candidates(mask, response, resolution_m):
    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=np.uint8))
    candidates = []
    for label, slices in enumerate(ndimage.find_objects(labels), 1):
        if slices is None:
            continue
        ys, xs = slices
        part = labels[slices] == label
        pixels = int(part.sum())
        width, height = xs.stop-xs.start, ys.stop-ys.start
        area = pixels * resolution_m**2
        aspect = max(width, height)/max(1, min(width, height))
        fill = pixels/(width*height)
        if not (FILTERS["min_area_m2"] <= area <= FILTERS["max_area_m2"]):
            continue
        if max(width, height)*resolution_m > FILTERS["max_bbox_length_m"]:
            continue
        if aspect > FILTERS["max_aspect_ratio"] or fill < FILTERS["min_fill_ratio"]:
            continue
        cy, cx = ndimage.center_of_mass(part)
        values = response[slices][part]
        candidates.append({"pixelCenter": [round(float(xs.start+cx), 4), round(float(ys.start+cy), 4)],
            "pixelBBox": [xs.start, ys.start, width, height],
            "radiusMeters": round(max(resolution_m, math.hypot(width, height)*resolution_m/2)+FILTERS["candidate_buffer_m"], 3),
            "score": round(float(np.mean(values)), 6),
            "evidence": {"componentPixels": pixels, "predictedAreaM2": round(area, 4),
                "meanModelResponse": round(float(np.mean(values)), 6), "peakModelResponse": round(float(np.max(values)), 6),
                "bboxFillRatio": round(fill, 6), "bboxAspectRatio": round(aspect, 6)}})
    candidates.sort(key=lambda c: (-c["score"], -c["evidence"]["predictedAreaM2"], c["pixelBBox"][1], c["pixelBBox"][0]))
    retained = []
    for candidate in candidates:
        cx, cy = candidate["pixelCenter"]
        if any(math.hypot(cx-q["pixelCenter"][0], cy-q["pixelCenter"][1])*resolution_m < FILTERS["min_separation_m"] for q in retained):
            continue
        retained.append(candidate)
        if len(retained) >= FILTERS["maximum_candidates"]:
            break
    return retained, {"rawComponents": count, "eligibleComponents": len(candidates), "selected": len(retained),
        "truncatedOrSuppressed": len(candidates)-len(retained)}


def prepare_region(region):
    start = time.monotonic()
    published = json.loads((ROOT / "public/data/optical-benchmark-v2.json").read_text(encoding="utf8"))
    lock = published["model"]["lock"]
    if benchmark.sha(trained.MODEL) != lock["modelSha256"] or benchmark.sha(trained.__file__) != lock["trainingScriptSha256"]:
        raise ValueError("Frozen V2 model/script integrity failed")
    checkpoint = trained.WORK / "model.joblib"
    if checkpoint.exists() and benchmark.sha(checkpoint) != EXPECTED_JOBLIB_SHA256:
        raise ValueError("Local trained estimator checksum failed")
    artifact = json.loads(trained.MODEL.read_text(encoding="utf8"))
    baseline = json.loads((ROOT / "public/data/optical-benchmark.json").read_text(encoding="utf8"))
    original_config = baseline["detector"]["lock"]["moduleDefaultConfig"]
    if any(original_config[k] != value for k, value in FILTERS.items()):
        raise ValueError("Inherited pre-test geometry constant changed")
    output = ROOT / "public/data" / ("ridge" if region == "ridge" else "")
    prefix = "/data/ridge" if region == "ridge" else "/data"
    terrain = json.loads((output / "terrain.json").read_text(encoding="utf8"))
    source_meta = json.loads((output / "optical-native-meta.json").read_text(encoding="utf8"))
    with np.load(CACHE / f"optical-native-{region}-0_5m.npz") as cached:
        raw = cached["image"]
        source = json.loads(str(cached["metadata"]))
    crop_hash = hashlib.sha256(np.asarray(raw, dtype=np.float32).tobytes()).hexdigest()
    if crop_hash != source["cropFloat32Sha256"] or crop_hash != source_meta["source"]["cropFloat32Sha256"]:
        raise ValueError("Native source crop checksum differs")
    if not np.isfinite(raw).all():
        raise ValueError("Explicit missing-data policy needed for nonfinite native crop")
    resolution = source_meta["metresPerPixel"]
    x = trained.features(raw, resolution)
    if checkpoint.exists():
        model = joblib.load(checkpoint)
        with threadpool_limits(limits=4):
            response = model.predict_proba(x)[:, 1].reshape(raw.shape)
        backend = "Checksum-verified local estimator; same exported tree model"
    else:
        # Public JSON suffices in a fresh checkout; never require an external pickle.
        chunks = [trained.portable_proba(x[i:i+262144], artifact) for i in range(0, len(x), 262144)]
        response = np.concatenate(chunks).reshape(raw.shape)
        backend = "Portable public JSON trees; no local estimator checkpoint required"
    del x
    mask = response >= artifact["threshold"]
    selected, stats = component_candidates(mask, response, resolution)
    candidates = []
    for n, item in enumerate(selected, 1):
        cx, cy = item["pixelCenter"]
        east, south = (cx+.5)*resolution, (cy+.5)*resolution
        gx, gy = east/terrain["cellSize"]-.5, south/terrain["cellSize"]-.5
        ix = min(terrain["width"]-1, max(0, round(gx)))
        iy = min(terrain["height"]-1, max(0, round(gy)))
        idx = iy*terrain["width"]+ix
        candidates.append({"id": f"{region}-optical-v2-{n:03d}", "kind": "optical-candidate",
            "status": "candidate", "reviewStatus": "unreviewed", "excludedFromRouting": False,
            "point": {"x": round(gx, 5), "y": round(gy, 5)},
            "projectedPosition": {"easting": terrain["bounds"][0]+east, "northing": terrain["bounds"][3]-south},
            **item, "evidence": {**item["evidence"], "maximumCellSlopeDegrees": terrain["slope"][idx],
                "localReliefMetres": terrain["roughness"][idx], "terrainGridMetres": terrain["cellSize"],
                "signals": ["frozen supervised pixel classifier response", "connected predicted region passing fixed geometry constraints"],
                "interpretation": "Unreviewed transferred model suggestion; not a confirmed boulder or obstacle height. Score is uncalibrated model response."}})
    mask_path = output / "optical-v2-mask.png"
    Image.fromarray(mask.astype(np.uint8)*255).save(mask_path, optimize=True)
    config = {"version": "boulder-pixel-hgb-v2-candidates", "modelSha256": lock["modelSha256"],
        "threshold": artifact["threshold"], **FILTERS,
        "filterProvenance": "All geometry constants inherited unchanged from baseline configuration frozen before the first held-out evaluation.",
        "ranking": "Descending mean uncalibrated response; larger area then pixel row/column break ties."}
    config_hash = hashlib.sha256(json.dumps(config, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    stats.update({"configSha256": config_hash, "validFraction": 1.0, "positivePixels": int(mask.sum()),
                  "pixels": int(mask.size), "positiveAreaM2": round(float(mask.sum()*resolution**2), 4)})
    metadata = {"schemaVersion": 1, "region": region, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "image": f"{prefix}/optical-v2-mask.png", "sourceImage": f"{prefix}/optical-native.webp",
        "sourceMetadata": f"{prefix}/optical-native-meta.json", "width": raw.shape[1], "height": raw.shape[0],
        "metresPerPixel": resolution, "bounds": terrain["bounds"], "crs": terrain["crs"],
        "sourceCropSha256": crop_hash, "modelSha256": lock["modelSha256"], "configSha256": config_hash,
        "generatorScriptSha256": benchmark.sha(__file__), "trainingScriptSha256": lock["trainingScriptSha256"],
        "inferenceBackend": backend,
        "maskSha256": benchmark.sha(mask_path), "maskEncoding": "uint8 single-channel PNG, 0=below fixed model threshold, 255=at or above0.25; full semantic mask before geometric filtering/top150.",
        "nativeSourceMetresPerPixel": source["sourceResolution"],
        "credit": source_meta["credit"], "trainingDataCredit": artifact["dataset"]["credit"],
        "processing": "Same frozen normalized multiscale pixel features and classifier as V2 benchmark; no local fitting, threshold tuning, synthetic image generation or per-region parameters.",
        "statistics": stats, "elapsedSeconds": round(time.monotonic()-start, 3),
        "localAccuracy": "Unmeasured; semantic benchmark is not local candidate accuracy or safety validation."}
    payload = {"schemaVersion": 1, "region": region, "method": "frozen supervised multiscale pixel classifier candidates",
        "config": config, "configSha256": config_hash, "sourceImage": f"{prefix}/optical-native.webp",
        "sourceMetadata": f"{prefix}/optical-native-meta.json", "sourceCropSha256": crop_hash,
        "bounds": terrain["bounds"], "crs": terrain["crs"], "pixelResolutionMetres": resolution,
        "nativeOpticalResolutionMetres": source["sourceResolution"], "planningGridMetres": terrain["cellSize"],
        "model": {"name": artifact["name"], "url": "/data/optical-model-v2.json", "sha256": lock["modelSha256"]},
        "predictionMask": f"{prefix}/optical-v2-mask.png", "predictionMetadata": f"{prefix}/optical-v2-meta.json",
        "scoreDefinition": "Mean uncalibrated classifier response within a predicted component; probability-like model output, not confidence, local precision, or safety probability.",
        "status": "unreviewed optical candidates",
        "routingPolicy": "No candidate is automatically excluded; a user must review and explicitly accept/edit an exclusion buffer",
        "validation": {"independentAccuracyEstablished": False, "localAccuracyMeasured": False,
            "visualAuditIsNotGroundTruth": True, "candidateMaskIsNotBoulderSegmentation": False,
            "benchmarkUrl": "/data/optical-benchmark-v2.json",
            "heldOutBenchmark": "Exploratory V2 semantic-mask evaluation of original Mars-Bench test4, after baseline test inspection; not a fresh independent test.",
            "candidateGeometryEvaluatedByBenchmark": False},
        "statistics": stats, "candidates": candidates,
        "limitations": ["Model transferred from other HiRISE patches; no Jezero or ridge ground-truth accuracy measurement.",
            "Semantic benchmark scores are for all thresholded pixels, not this geometry-filtered top150 proposal set.",
            "Geometric filters, four-meter spacing and cap intentionally suppress regions; absence does not mean clear terrain.",
            "Classifier can confuse shadows, crater edges, ripples, fractures and mosaic artifacts with boulder pixels.",
            "Pixel resolution is not positional accuracy. Optical/DEM registration, object height and physical traversability remain uncertain.",
            "All proposals require human review and explicit buffer acceptance before affecting routing."]}
    benchmark.write_json(output / "optical-v2-meta.json", metadata)
    benchmark.write_json(output / "obstacle-candidates-v2.json", payload)
    print(json.dumps({"region": region, "statistics": stats, "maskBytes": mask_path.stat().st_size,
                      "elapsedSeconds": metadata["elapsedSeconds"]}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--regions", nargs="+", choices=["floor", "ridge"], default=["floor", "ridge"])
    args = parser.parse_args()
    for region in args.regions:
        prepare_region(region)
