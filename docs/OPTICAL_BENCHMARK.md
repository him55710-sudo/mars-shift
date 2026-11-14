# Optical cue benchmark

This project evaluates its own frozen `shadow-contrast-v1` detector against real, independently labeled HiRISE imagery. The output is an **unreviewed optical cue**, not a confirmed boulder, calibrated probability, measured boulder height, or EVA safety decision. Published model scores are never substituted for this detector's results.

## Data and permission

The selected source is [Purohit et al. (2025), Mars-Bench: mb-boulder_seg, v1](https://zenodo.org/records/15494673), DOI [10.5281/zenodo.15494673](https://doi.org/10.5281/zenodo.15494673). The [record API](https://zenodo.org/api/records/15494673) explicitly specifies `cc-by-4.0`; the [authors' dataset card](https://huggingface.co/datasets/Mirali33/mb-boulder_seg) agrees. The source describes planetary scientist annotations of HiRISE boulders. The downloaded labels are binary semantic masks, not instance IDs.

Attribution: **Mirali Purohit, Bimal Gajera, Vatsal Malaviya, Irish Mehta, Kunal Kasodekar, Jacob Adler, Steven Lu, Umaa Rebbapragada and Hannah Kerner (2025), Mars-Bench: mb-boulder_seg, v1, DOI 10.5281/zenodo.15494673, CC BY 4.0. HiRISE/MRO imagery: NASA/JPL-Caltech/University of Arizona.** See [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Image and label pixels are kept unchanged; deriving metrics, bounding boxes and inventory metadata are our processing changes. Benchmark rasters remain outside the deployable `public/` tree.

Other primary sources inspected:

| Source | Permission and decision |
| --- | --- |
| [BoulderNet original data](https://zenodo.org/records/8171052) | Zenodo API specifies CC BY 4.0. The 265,067,013-byte preprocessed archive includes train/validation/test images and labels. It is a viable larger future evaluation; we use the smaller Mars-Bench test here. No weights were downloaded. |
| [Pearson's Mars-Rock-Detector](https://github.com/pearsonkyle/Mars-Rock-Detector) | Public training archive and code, but GitHub metadata returned no explicit license and `/license` returned 404 at inspection. Neither its code nor its labels are reused. |
| [Nagle-McNaughton's Boulder_Identification](https://github.com/TimNagle-McNaughton/Boulder_Identification) | Public ArcPy workflow and example data, but the same explicit-license check returned none/404. Neither its code nor its data are reused. |

The source metadata response and alternative-source inspection are retained in the local cache. A public repository alone is not our evidence of permission.

## Frozen protocol

The source's original 39 train / 6 validation / 4 test split is preserved. All four test patches are evaluated, each 500 × 500 pixels, totaling 1,000,000 pixels. No train or validation image is used to fit the baseline detector, and no test result is used to change its thresholds. The detector configuration was frozen before the detector author viewed test imagery. `--lock` records the full source SHA-256, detector API/default/import AST hash, and actual default configuration before evaluation. `--evaluate` rejects changed detector code or defaults.

| Test tile | Native meters/pixel |
| --- | ---: |
| ESP_017355_2260_RED_6161 | 0.50 |
| ESP_025650_2165_RED_6402 | 0.25 |
| ESP_028537_2270_RED_3105 | 0.25 |
| ESP_037018_2170_RED_MRDR_0751 | 0.60 |

These scales come from each original GeoTIFF affine transform, not a single assumed camera resolution. The detector receives the original single-band uint8 array and corresponding native scale. Masks use `0=Background, 1=Boulder`; there is no resizing, reprojecting, label dilation, reference filtering, or appearance selection. The detector's fixed, scale-aware minimum area and maximum count still apply as part of the evaluated algorithm.

The audit finds no exact image hash duplicates and no same-CRS crop-bound intersections between test and train/validation. However, the published splits **share parent HiRISE observation IDs**. This is an external labeled patch holdout, not an observation-independent geographic test. It also does not validate either local Jezero ROI.

### Metrics

Pixel TP/FP/FN/TN compare the returned boolean cue mask with reference class 1. Precision = TP/(TP+FP); recall = TP/(TP+FN); F1 = 2TP/(2TP+FP+FN); IoU = TP/(TP+FP+FN). Aggregate scores use micro counts across all four tiles. Undefined ratios are `null`. The detector segments dark shadow/contrast cues while reference labels outline boulders. Poor pixel agreement reflects that task mismatch and must remain visible.

A secondary **component-box proxy** converts both masks into 8-connected components, then uses their half-open axis-aligned bounding boxes. Matching maximizes one-to-one match count at box IoU ≥ 0.5, with IoU breaking ties. Unmatched predictions are FP and unmatched reference components are FN. Touching labeled boulders can form one component, and cue regions can be offset from rocks. This proxy is not true instance detection precision/recall, AP, or confirmed hazard identification.

Intervals resample **whole tiles**, not individual pixels, 10,000 times with NumPy seed 20261114. For each bootstrap draw the script recomputes micro scores and reports the 2.5th/97.5th percentiles. With only four test tiles the 95% intervals are unstable; correlated pixels do not become a million independent observations. Report the four per-tile scores alongside them.

## Reproduce

Use the project's Python environment with NumPy, SciPy, rasterio, requests, and truststore. In the repository:

```powershell
..\.venv\Scripts\python.exe scripts/benchmark_optical.py --prepare
..\.venv\Scripts\python.exe scripts/benchmark_optical.py --check
..\.venv\Scripts\python.exe scripts/benchmark_optical.py --lock
..\.venv\Scripts\python.exe scripts/benchmark_optical.py --evaluate
```

`--prepare` downloads the version-pinned archives, verifies both the published MD5 and frozen SHA-256, and preserves original split paths under `../data-cache/optical-benchmark/zenodo-15494673/`. Cache reuse is checksum verified. No benchmark image or mask is needed by the deployed application. The lock is benchmark-only cache state; do not erase it to hide a detector change after looking at test results. A later algorithm needs an explicit new preregistration and a fresh untouched evaluation set before a new generalization claim.

The public [optical-benchmark.json](../public/data/optical-benchmark.json) contains the measured counts, intervals, per-tile native metadata, source archive hashes, individual image/mask hashes, detector lock, and limitations. The script checks identity/empty-mask counts and a matching case that requires cardinality-first assignment. Its metric code is separate from the detector and never passes labels to `detect()`.

### Measured baseline result

| Pixel metric | Micro score | 95% whole-tile bootstrap interval |
| --- | ---: | ---: |
| Precision | 9.42% | 6.05–12.23% |
| Recall | 16.34% | 8.07–37.59% |
| F1 | 11.95% | 8.86–13.34% |
| IoU | 6.36% | 4.63–7.15% |

Pixel counts are TP 5,306 / FP 51,024 / FN 27,158 / TN 916,512. The strict component-box proxy matches 5 of 600 predicted components against 362 reference components, giving 595 unmatched predictions and 357 unmatched reference components (proxy precision 0.83%, recall 1.38%). Every tile hits the algorithm's existing 150-candidate cap. These are weak baseline results and do not support treating the cues as accurate boulder detections.

One concurrent source edit occurred during the first evaluation: a pure computation optimization moved `normalized-background` from inside the component loop to a single `bright_residual` array. The initial attempt and lock were retained. We audited the original loaded bytecode against the final source and confirmed **bitwise identical masks and exactly equal candidate records/statistics for all four inputs**, with unchanged default configuration. A confirmatory evaluation produces the same counts. Later range-server validation and unused-import edits were audited by comparing the preserved source snapshot with current detector function/default/dependency-import ASTs: they are identical. The result embeds both audits and full/API hashes. Future runs check detector API integrity before and after evaluation; acquisition-only edits do not silently change measured metrics. No threshold was changed in response to test results.

## Supervised V2: exploratory follow-up

After seeing the weak baseline result, we made one bounded supervised follow-up. This ordering is a material limitation: the test set was already inspected when the model family was proposed. **The V2 scores are exploratory follow-up on a previously inspected benchmark, not a fresh independent test.** No further model, feature or threshold changes were made after V2 test inference.

`scripts/train_optical.py` fits a scikit-learn 1.9.1 `HistGradientBoostingClassifier` using only the original 39 training images. The fixed feature family contains normalized grayscale, local Gaussian means, signed residuals, local standard deviations at 0.3/0.6/1.2/2.4 m, and Sobel magnitudes at 0.6/1.2 m. Features use each tile's native scale. Fixed seed 20261114 samples at most 4,000 positive and 12,000 negative pixels per training tile, with inverse sampling weights restoring each tile's positive/negative prevalence: 585,203 training pixels in total. No test image is read by `--fit`.

The one model uses 100 boosting iterations, 15 maximum leaves, learning rate 0.1, minimum leaf size 50 and L2 regularization 2; early stopping is disabled. The only selection is a prespecified threshold grid 0.10 to 0.90 in 0.05 steps, maximizing micro pixel F1 on the original six validation tiles and breaking ties toward the higher threshold. The selected threshold is 0.25, with validation precision 35.67%, recall 42.24%, F1 38.68%, IoU 23.97%. The exported model and script hashes were frozen before V2 test inference.

| Pixel metric | V2 exploratory test score | 95% whole-tile bootstrap interval |
| --- | ---: | ---: |
| Precision | 29.60% | 5.97–39.87% |
| Recall | 51.93% | 23.15–65.15% |
| F1 | 37.70% | 9.49–48.69% |
| IoU | 23.23% | 4.98–32.18% |

V2 pixel counts: TP 16,857 / FP 40,100 / FN 15,607 / TN 927,436. Secondary component-box proxy: TP 77 / FP 1,894 / FN 285, precision 3.91%, recall 21.27%, F1 6.60%. These strict object proxies remain weak. Supervised semantic overlap improves on the cue baseline, but neither result establishes accurate local boulder instances or safety.

The [V2 report](../public/data/optical-benchmark-v2.json) preserves the original baseline link and reports the same metric definitions. The [portable model JSON](../public/data/optical-model-v2.json) is 370,795 bytes and contains 100 numeric tree arrays, the base logit, threshold, feature specification, training/validation hashes, validation trials and attribution. The Python `portable_proba()` implementation was checked on 2,500 uniformly spaced pixels in each validation image against scikit-learn inference: maximum absolute score error 0.0. This is a codec check, not an accuracy score. Classifier outputs remain uncalibrated scores.

To reproduce the V2 experiment in a fresh cache with scikit-learn 1.9.1 and joblib installed:

```powershell
..\.venv\Scripts\python.exe scripts/train_optical.py --fit
..\.venv\Scripts\python.exe scripts/train_optical.py --evaluate
```

`--fit` refuses to overwrite an existing frozen model/lock, and `--evaluate` verifies both model and script hashes. The local joblib file is our own training output, not an externally downloaded pickle. The deployed JSON needs no sklearn runtime. Its portable feature extraction still requires the exact documented Gaussian/Sobel operations; the tree JSON alone is not a browser detector. `predict_mask(image, resolution_m)` is available for offline native-image processing. Applying it to Jezero would be domain transfer with no local labeled accuracy measurement; it must not replace the published baseline under the same name.

### Real local assets

`scripts/prepare_optical_v2.py` applies the frozen model to the existing original-data float32 crops at 0.5 m/pixel, then writes separate V2 assets for the floor and rugged ridge. It does not alter V1 assets or retrain the model. The source crop hash is checked against both cached source metadata and published optical metadata. The model and training-script hashes are verified before use. It uses our checksum-verified estimator checkpoint when available; otherwise the published JSON trees suffice without a private model cache. Reproduce after native crop preparation:

```powershell
..\.venv\Scripts\python.exe scripts/prepare_optical_v2.py
```

Each region exports `obstacle-candidates-v2.json`, `optical-v2-mask.png`, and `optical-v2-meta.json` under `public/data/` or `public/data/ridge/`. The PNG is the full thresholded semantic prediction: 0 means below threshold, 255 means at or above 0.25. It is not a reviewed obstacle map or the selected-candidate mask. Both outputs are 2000 × 2000 pixels.

For proposals, the generator inherits the unchanged **pre-test V1 geometry constants**: area 0.75–50 m², maximum bounding side 16 m, aspect ratio ≤4, fill ≥0.12, 4 m center spacing, 1 m radius buffer, maximum 150 candidates. It verifies these against the original baseline lock. It does not add V1's shadow or adjacent-brightness gates to supervised predictions. Candidates rank by mean uncalibrated model response, with area and pixel position as fixed tie breakers. No local threshold or geometry tuning took place. These geometry-filtered and capped proposals were **not** the mask used in V2 benchmark scoring; reported pixel precision/recall must not be relabeled as local candidate precision/recall.

| Region | Predicted pixels / 4,000,000 | Raw / eligible / selected components | Export time |
| --- | ---: | ---: | ---: |
| Floor | 83,157 | 4,991 / 3,157 / 150 | 10.05 s |
| Ridge | 62,300 | 3,585 / 2,252 / 150 | 10.64 s |

Proposal JSON retains the V1 review/routing boundary: `reviewStatus=unreviewed` and `excludedFromRouting=false`. It includes matching planning-grid and projected coordinates, source-image links, geometry, model/config hashes and evidence. The score means average uncalibrated classifier response, never local accuracy or safety confidence. Confirmed exclusions still require a person's explicit review and chosen buffer. Small predicted regions, spacing suppression, out-of-distribution appearances and optical/DEM registration remain limitations.

Frozen archive hashes:

| File | Published MD5 | SHA-256 |
| --- | --- | --- |
| data.zip | `9b82c4b9110eab668ecd2c9eb7c222e1` | `d94389edd86e14bcaed0b7eaa52a3e5aef2364ed1a9dab92af5d9b8190e6e39e` |
| mapping.json | `551e3db637c7f6c7ad1097524f27095a` | `9271d36ffce55fde2fa21578ed2c3efbf0007e778093e944ffde619c8eb8e78e` |
| partitions.zip | `cdadf1f9f5b29ea225a8d606a27b3b32` | `04632de89f88dc511c0e76db42cad18801b0e024a406fae5126ce625d9ddd7f6` |

## Local review before hazard claims

Local Jezero accuracy remains **unmeasured**. A review of only suggested candidates can estimate candidate acceptance, but cannot measure missed boulders or recall. A reproducible local validation session should:

1. Freeze original crop pixels, georeferencing, image hash, detector source/config hash, sampling seed, tile grid, eligibility rule, and matching rule before annotation.
2. Sample tiles independently of detector output, including regions with no suggestions. Either label all eligible tiles or record each tile's selection probability and use suitable weighted estimates. Keep any threshold-development tiles separate from an untouched test set.
3. Have reviewers first annotate original imagery without candidate overlays. Record boulder polygons/boxes separately from shadows; retain uncertain/occluded cases rather than treating them as confirmed negatives. A second reviewer adjudicates disagreements before outputs are unblinded.
4. Evaluate the fixed predictions against adjudicated labels, reporting pixel and explicitly defined instance metrics, sample counts, unresolved cases, scale, and spatially grouped uncertainty. A reviewer accepting one suggestion does not calibrate its numeric ranking score.

Suggested session record (schema contract for future review, **not a completed validation**):

```json
{
  "schemaVersion": 1,
  "sessionId": "review-id",
  "status": "preregistered",
  "site": "jezero-or-ridge",
  "imageSha256": "required",
  "detectorSourceSha256": "required",
  "detectorConfigSha256": "required",
  "resolutionM": 0.3,
  "sampling": {"seed": 1, "tileSizePx": 500, "selectionRule": "predeclared", "testTiles": []},
  "reviewers": [],
  "annotations": [{"tileId": "tile", "class": "boulder", "pixelPolygon": [], "certainty": "unknown", "reviewer": "required"}],
  "adjudication": {"status": "pending", "reviewer": null},
  "matching": {"geometry": "box", "iouThreshold": 0.5},
  "metrics": null
}
```

This external benchmark and future local review assess visible optical evidence. They cannot recover unobserved rock height, material strength, small hazards below source resolution, or human traversability from one orthomosaic.
