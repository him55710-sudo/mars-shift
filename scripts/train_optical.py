"""Bounded supervised follow-up: original Mars-Bench train, threshold on val only.

The original test was previously inspected for the baseline. Follow-up test
results are exploratory and cannot be called a new untouched independent test.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import rasterio
from scipy import ndimage, special
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier
from threadpoolctl import threadpool_limits

import benchmark_optical as benchmark

ROOT = Path(__file__).resolve().parents[1]
CACHE = benchmark.CACHE
WORK = CACHE / "supervised-v2"
MODEL = ROOT / "public/data/optical-model-v2.json"
REPORT = ROOT / "public/data/optical-benchmark-v2.json"
SCALES_M = [0.3, 0.6, 1.2, 2.4]
FEATURE_NAMES = ["normalized"] + [f"mean_{s}m" for s in SCALES_M] + [f"residual_{s}m" for s in SCALES_M] + [f"std_{s}m" for s in SCALES_M] + ["gradient_0.6m", "gradient_1.2m"]
PARAMS = {"learning_rate": 0.1, "max_iter": 100, "max_leaf_nodes": 15,
          "min_samples_leaf": 50, "l2_regularization": 2.0,
          "early_stopping": False, "random_state": 20261114}
THRESHOLDS = np.linspace(0.1, 0.9, 17).tolist()


def features(image, resolution_m):
    gray = np.asarray(image, dtype=np.float32)
    lo, hi = np.percentile(gray, [1, 99])
    gray = np.clip((gray - lo) / max(float(hi-lo), 1e-6), 0, 1).astype(np.float32)
    means = [ndimage.gaussian_filter(gray, max(0.5, s/resolution_m), mode="reflect") for s in SCALES_M]
    residuals = [gray - m for m in means]
    stds = [np.sqrt(np.maximum(0, ndimage.gaussian_filter(gray*gray, max(0.5, s/resolution_m), mode="reflect") - m*m)) for s, m in zip(SCALES_M, means)]
    gradients = [np.hypot(ndimage.sobel(means[i], axis=0, mode="reflect"), ndimage.sobel(means[i], axis=1, mode="reflect"))/8 for i in [1, 2]]
    return np.stack([gray, *means, *residuals, *stds, *gradients], axis=-1).reshape(-1, len(FEATURE_NAMES)).astype(np.float32)


def items(split):
    if split not in {"train", "val", "test"}:
        raise ValueError("Invalid split")
    for path in sorted((CACHE / "data" / split / "images").glob("*.tif")):
        with rasterio.open(path) as ds:
            image, resolution = ds.read(1), abs(ds.transform.a)
        mask_path = CACHE / "data" / split / "masks" / path.name
        with rasterio.open(mask_path) as ds:
            gt = ds.read(1) == 1
        yield {"id": path.stem, "image": image, "gt": gt, "resolutionM": resolution,
               "imageSha256": benchmark.sha(path), "maskSha256": benchmark.sha(mask_path)}


def export_model(model):
    trees = []
    for iteration in model._predictors:
        if len(iteration) != 1:
            raise ValueError("Only binary HGB is supported")
        nodes = iteration[0].nodes
        if np.any(nodes["is_categorical"]):
            raise ValueError("No categorical splits allowed")
        trees.append({name: nodes[name].tolist() for name in ["value", "feature_idx", "num_threshold", "left", "right", "is_leaf", "missing_go_to_left"]})
    return {"baseLogit": float(model._baseline_prediction[0, 0]), "trees": trees}


def portable_proba(x, artifact):
    raw = np.full(len(x), artifact["baseLogit"], dtype=np.float64)
    for tree in artifact["trees"]:
        index = np.zeros(len(x), dtype=np.int64)
        leaf = np.asarray(tree["is_leaf"], dtype=bool)
        feature = np.asarray(tree["feature_idx"], dtype=np.int64)
        threshold = np.asarray(tree["num_threshold"], dtype=float)
        left, right = np.asarray(tree["left"]), np.asarray(tree["right"])
        while True:
            active = np.flatnonzero(~leaf[index])
            if not len(active):
                break
            node = index[active]
            values = x[active, feature[node]]
            go_left = np.where(np.isnan(values), np.asarray(tree["missing_go_to_left"])[node], values <= threshold[node])
            index[active] = np.where(go_left, left[node], right[node])
        raw += np.asarray(tree["value"])[index]
    return special.expit(raw)


def fit():
    if MODEL.exists() or (WORK / "training-lock.json").exists():
        raise ValueError("V2 is already frozen. No silent retraining after test inspection.")
    benchmark.verify_archives()
    WORK.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20261114)
    xs, ys, weights, provenance = [], [], [], []
    for tile in items("train"):
        x = features(tile["image"], tile["resolutionM"])
        y = tile["gt"].ravel()
        index_parts, weight_parts = [], []
        # Fixed class-aware subsampling, weighted back to each tile's prevalence.
        for label, maximum in [(1, 4000), (0, 12000)]:
            pool = np.flatnonzero(y == label)
            n = min(maximum, len(pool))
            if not n:
                continue
            chosen = rng.choice(pool, size=n, replace=False)
            index_parts.append(chosen)
            weight_parts.append(np.full(n, len(pool)/n, dtype=np.float32))
        indices = np.concatenate(index_parts)
        w = np.concatenate(weight_parts)
        w *= len(w)/w.sum()
        xs.append(x[indices]); ys.append(y[indices]); weights.append(w)
        provenance.append({"id": tile["id"], "split": "train", "imageSha256": tile["imageSha256"],
                           "maskSha256": tile["maskSha256"], "sampledPixels": len(indices)})
    x, y, w = np.concatenate(xs), np.concatenate(ys), np.concatenate(weights)
    model = HistGradientBoostingClassifier(**PARAMS)
    with threadpool_limits(limits=4):
        model.fit(x, y, sample_weight=w)
    portable = export_model(model)
    val_counts = [{"tp": 0, "fp": 0, "fn": 0, "tn": 0} for _ in THRESHOLDS]
    maximum_export_error = 0.0
    for tile in items("val"):
        xval = features(tile["image"], tile["resolutionM"])
        with threadpool_limits(limits=4):
            probability = model.predict_proba(xval)[:, 1]
        check = np.arange(0, len(xval), 100)
        error = float(np.max(np.abs(portable_proba(xval[check], portable) - probability[check])))
        maximum_export_error = max(maximum_export_error, error)
        if error > 1e-8:
            raise ValueError(f"Portable tree export differs: {error}")
        for i, threshold in enumerate(THRESHOLDS):
            counts = benchmark.pixel_counts(probability.reshape(tile["gt"].shape) >= threshold, tile["gt"])
            for key in counts:
                val_counts[i][key] += counts[key]
        provenance.append({"id": tile["id"], "split": "val", "imageSha256": tile["imageSha256"], "maskSha256": tile["maskSha256"]})
    trials = [{"threshold": threshold, "counts": counts, "metrics": benchmark.ratios(counts)} for threshold, counts in zip(THRESHOLDS, val_counts)]
    # Predetermined objective, tie toward the more conservative higher threshold.
    selected = max(trials, key=lambda q: (q["metrics"]["f1"] or 0, q["threshold"]))
    now = datetime.now(timezone.utc).isoformat()
    artifact = {"schemaVersion": 1, "name": "boulder-pixel-hgb-v2", "status": "frozen-before-v2-test",
        "trainedAt": now, "algorithm": "binary HistGradientBoostingClassifier", "sklearnVersion": sklearn.__version__,
        "parameters": PARAMS, "featureNames": FEATURE_NAMES, "gaussianScalesM": SCALES_M,
        "featureSpec": "Per-image p1/p99 clipped normalization; Gaussian reflect sigma=max(.5,scaleM/resM); gray, means, gray-minus-mean, local std, Sobel magnitude/8 at .6m and1.2m.",
        "threshold": selected["threshold"], "thresholdSelection": "Maximize micro pixel F1 on original val6 only; fixed grid .10:.05:.90, higher-threshold tie break.",
        "validationTrials": trials, "trainingSampleCount": len(y), "trainingImages": 39, "validationImages": 6,
        "trainingSampling": "Seed20261114; at most4000 positive+12000 negative pixels/tile; inverse sampling weights restore per-tile prevalence.",
        "provenance": provenance, "trainingScriptSha256": benchmark.sha(__file__),
        "dataset": {"url": "https://zenodo.org/records/15494673", "doi": "10.5281/zenodo.15494673", "license": "CC-BY-4.0", "credit": "Purohit et al.(2025), Mars-Bench; HiRISE NASA/JPL-Caltech/University of Arizona."},
        "evaluationCaveat": "Model family proposed after baseline test results were inspected. Any V2 test result is exploratory follow-up, not a fresh independent confirmation.",
        "portableValidationMaxAbsoluteProbabilityError": maximum_export_error,
        "probabilityCalibration": "Uncalibrated classifier score; no safety probability interpretation.", **portable}
    benchmark.write_json(MODEL, artifact)
    joblib.dump(model, WORK / "model.joblib")
    benchmark.write_json(WORK / "training-lock.json", {"frozenAt": now, "modelSha256": benchmark.sha(MODEL),
        "trainingScriptSha256": benchmark.sha(__file__), "selectedThreshold": artifact["threshold"], "testUsedForFittingOrThreshold": False})
    print("FROZEN", MODEL, "threshold", selected["threshold"], "val", selected["metrics"], "samples", len(y), flush=True)


def predict_mask(image, resolution_m, artifact=None):
    artifact = artifact or json.loads(MODEL.read_text(encoding="utf8"))
    x = features(image, resolution_m)
    return (portable_proba(x, artifact) >= artifact["threshold"]).reshape(image.shape)


def evaluate():
    lock = json.loads((WORK / "training-lock.json").read_text(encoding="utf8"))
    if benchmark.sha(MODEL) != lock["modelSha256"] or benchmark.sha(__file__) != lock["trainingScriptSha256"]:
        raise ValueError("Frozen model or training/evaluation script changed")
    artifact = json.loads(MODEL.read_text(encoding="utf8"))
    model = joblib.load(WORK / "model.joblib")
    rows = []
    for tile in items("test"):
        x = features(tile["image"], tile["resolutionM"])
        with threadpool_limits(limits=4):
            probability = model.predict_proba(x)[:, 1]
        pred = (probability >= artifact["threshold"]).reshape(tile["gt"].shape)
        counts = benchmark.pixel_counts(pred, tile["gt"])
        objects = benchmark.component_counts(pred, tile["gt"])
        row = {"id": tile["id"], "imageSha256": tile["imageSha256"], "maskSha256": tile["maskSha256"],
            "resolutionM": tile["resolutionM"], "pixels": int(tile["gt"].size), "pixelCounts": counts,
            "pixelMetrics": benchmark.ratios(counts), "componentBoxCounts": objects,
            "componentBoxMetrics": {k: v for k, v in benchmark.ratios(objects).items() if k != "iou"}}
        rows.append(row)
        print(tile["id"], row["pixelMetrics"], flush=True)
    counts, objects = benchmark.sum_counts(rows, "pixelCounts"), benchmark.sum_counts(rows, "componentBoxCounts")
    report = {"schemaVersion": 1, "status": "measured-exploratory-follow-up", "measuredAt": datetime.now(timezone.utc).isoformat(),
        "title": "Train/validation-only supervised follow-up on the previously inspected Mars-Bench test split",
        "dataset": {"url": "https://zenodo.org/records/15494673", "license": "CC-BY-4.0", "tileCount": 4, "pixels": 1000000,
            "originalSplits": {"train": 39, "val": 6, "test": 4}},
        "model": {"name": artifact["name"], "url": "/data/optical-model-v2.json", "sha256": lock["modelSha256"],
            "threshold": artifact["threshold"], "validationSelectedMetrics": max(artifact["validationTrials"], key=lambda q: (q["metrics"]["f1"] or 0, q["threshold"]))["metrics"], "lock": lock},
        "aggregate": {"pixelCounts": counts, "pixelMetrics": benchmark.ratios(counts), "pixelBootstrap95": benchmark.bootstrap(rows, "pixelCounts"),
            "componentBoxCounts": objects, "componentBoxMetrics": {k: v for k, v in benchmark.ratios(objects).items() if k != "iou"},
            "componentBoxBootstrap95": {k: v for k, v in benchmark.bootstrap(rows, "componentBoxCounts").items() if k != "iou"}},
        "samples": rows, "baselineUrl": "/data/optical-benchmark.json",
        "protocol": {"weightsFitOnlyOn": "original train39", "thresholdSelectedOnlyOn": "original val6", "v2FrozenBeforeTestInference": True,
            "testPreviouslyInspectedForBaseline": True, "testDrivenV2ThresholdTuning": False, "resampling": False,
            "metricDefinitions": "Same strict native pixel and 8-connected component box IoU>=.5 proxy as baseline; tile-bootstrap10k seed20261114."},
        "limitations": [artifact["evaluationCaveat"], "Original split shares parent HiRISE observations; not geographically independent.",
            "Four tiny test patches give unstable intervals. Local Jezero and ridge accuracy remain unmeasured.",
            "Semantic components are not original boulder instances. No measured height, traversability or safety claim.", "Classifier scores are not calibrated probabilities."],
        "localValidation": {"status": "unreviewed", "jezeroPrecision": None, "jezeroRecall": None}}
    benchmark.write_json(REPORT, report)
    print("WROTE", REPORT, json.dumps(report["aggregate"]), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--fit", action="store_true")
    modes.add_argument("--evaluate", action="store_true")
    args = parser.parse_args()
    fit() if args.fit else evaluate()
