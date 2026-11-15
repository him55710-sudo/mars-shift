# Independent NASA sand-appearance validation

This release runs a new, explicitly experimental MARS SHIFT texture classifier against real NASA/JPL AI4Mars expert labels. It does not rebrand NASA's published accuracy as our own. The previously deployed Jezero NOAH-H orbital screening rule is a different model and sensor domain; these scores do not validate it.

## Frozen experiment

Protocol: `SAND_VALIDATION_V39_PROTOCOL.json`, committed before fitting. The model code was committed before fitting. The calibration threshold and model hash are committed before opening test labels for evaluation.

- Source: [official AI4Mars merged 0.6](https://zenodo.org/records/15995036), linked by the [NASA data catalog](https://data.nasa.gov/dataset/ai4mars-a-dataset-for-terrain-aware-autonomous-driving-on-mars).
- Attribution: Swan et al., AI4Mars, NASA/JPL-Caltech, CVPR Workshops 2021. Expert labels measure terrain appearance, not wheel slip or human sinkage.
- All 322 MSL Navcam `masked-gold-min3-100agree` test images are retained. No selection by class or favorable result.
- Remove every test site-drive ID from development, including opposite-eye stereo views. Hash-order the remaining groups; use one image per group, 128 for training and 32 for calibration. Nearby drives can still share geology.
- Native-pixel image features: grayscale intensity and multiscale mean, standard deviation, gradient and Laplacian. Random forest parameters are fixed in the protocol. This is a small reproducible baseline, not a production deep segmentation model or NASA flight software.
- Select threshold on calibration F2 only. Full calibration curve and threshold-0.5, always-sand and never-sand comparisons are published.
- Evaluate the fixed native lattice starting at (4,4), stride 8. Expert label 2 means sand; 0,1,3 mean other terrain; 255 is ignored and included in coverage accounting. No interpolation of labels.
- Report exact TP, FP, TN, FN, precision, recall, false-positive rate, miss rate, F1/F2 and IoU. Bootstrap images (1,000 draws, seed 3902), rather than pretending adjacent pixels are independent. These intervals do not establish independent site-level generalization.

The full report is `/data/hazards/sand-v39/report.json`; every test image has counts. The evidence view shows the deterministic first hash-ordered image, the image with the most false-positive pixels, and the image with the most missed sand pixels. Failure examples are deliberately visible.

## Route integration and limits

For each displayed NASA test image, the same endpoints and common expert-annotation coverage domain are used for three four-neighbor graph searches: coverage-only baseline, predicted-sand exclusions plus a one-cell buffer, and expert-sand reference exclusions plus the same buffer. The predicted path is calculated without expert class values; its exposure is then audited against expert sand. Every result, including HOLD or missed sand on a predicted route, is published. Annotation coverage is an oracle benchmark domain, not an independently inferred coverage product.

This graph is in image coordinates. It has no ground-metre distance, DEM, physical speed or certified astronaut safety meaning. Its purpose is to expose how classification errors affect a navigation graph.

The HUD links this independent test to the existing first-person training demo and real NOAH-H evidence panel. The model routing gate withholds automatic physical exclusions because MSL Navcam imagery has not been registered or locally validated against the Jezero orbital map or Sol 477 mesh. Unit tests verify that a high appearance score cannot authorize that transfer. Existing declared or manually reviewed physical exclusions remain the source of routing constraints.

## Actual trapping/slip evidence

The availability audit is `/data/hazards/sand-v39/source-audit.json`. The [JPL mobility-trends repository](https://doi.org/10.48577/jpl.M8FWRK) was retrieved through its public API; the returned file list contains a paper PDF, not a before-drive image-to-slip table. [NASA/JPL's slip/thermal-inertia study](https://ntrs.nasa.gov/citations/20210006223) and its [RSS paper](https://www.roboticsproceedings.org/rss13/p38.pdf) describe real slip experiments. We did not obtain their matched per-drive raw measurements and do not reproduce or claim their prediction results.

Matched slip outcomes obtained: **0**. Therefore trapping/slip TP, FP, FN, precision and recall remain unavailable. This is a retrieval result for the sources inspected, not proof that no public telemetry exists. Traverse length and fault-stop counts cannot be substituted for terrain-matched slipping/entrapment labels.

## Reproduction

Use Python 3.12 and the dependency versions recorded in `model-lock.json`. The existing scientific environment has NumPy, SciPy, Pillow, requests, joblib and scikit-learn.

```powershell
../.venv/Scripts/python.exe -X utf8 scripts/evaluate_ai4mars.py --prepare
../.venv/Scripts/python.exe -X utf8 scripts/evaluate_ai4mars.py --fit
# Retain/commit model-lock.json before the following test operation.
../.venv/Scripts/python.exe -X utf8 scripts/evaluate_ai4mars.py --test
../.venv/Scripts/python.exe -X utf8 scripts/evaluate_ai4mars.py --check
../.venv/Scripts/python.exe -X utf8 -m unittest discover -s scripts -p test_ai4mars_validation.py
pnpm test
pnpm build
```

Only required members of the official ZIP are downloaded over verified byte ranges, with TLS verification retained. Each decompressed member passes ZIP CRC32 and has a published SHA-256. The full 16 GB archive MD5 is not verified by partial downloading. Cached original inputs and the locally fitted joblib model stay outside the repository. No downloaded pickle/model code is executed. Browser evaluation uses small precomputed reports and overlays; no training or per-frame inference runs inside the 3D renderer.


## Measured results, 2026-11-15

All 322 expert test images were processed, spanning 89 site-drive groups. Thirty-six had no agreed labels on the fixed sampled lattice. Confusion counts therefore come from 286 contributing images and 1,827,103 labeled lattice pixels, 34.63% of all sampled pixels.

| Measure | Locked 0.40 threshold |
| --- | ---: |
| True sand detections (TP) | 427,643 |
| False sand alarms (FP) | 133,539 |
| Correct other-terrain predictions (TN) | 1,214,801 |
| Missed sand (FN) | 51,120 |
| Precision | 76.20% |
| Recall | 89.32% |
| False-positive rate, FP / (FP + TN) | 9.90% |
| Miss rate, FN / (TP + FN) | 10.68% |
| Sand IoU | 69.84% |
| Image-bootstrap recall 95% interval | 85.30–93.17% |

At the fixed 0.50 comparator, precision was 79.46%, recall 86.36%, false-positive rate 7.93%, and miss rate 13.64%. The calibration-selected threshold trades additional false alarms for fewer misses; it does not dominate the comparator on every metric.

A post-hoc descriptive audit applied the already-defined image graph to all 322 test images without changing the model, endpoints or buffer. Coverage-only paths existed in 105 images, expert-sand reference paths in 84, and predicted-mask paths in 45. None of these 45 predicted paths crossed labeled expert sand on the sampled lattice. The model held in 39 images despite an available expert-sand reference path. These are conditional image-graph results: sparse expert coverage, no physical ground scale, incomplete hazard classes and no measured slip outcomes prevent a physical safety conclusion. All rows, including unavailable and HOLD results, are in `routing-audit.json`.

Verification: 412 existing TypeScript tests passed in the full regression run. The focused 24-test run passed, including the 3 new evidence tests (415 distinct TypeScript tests checked overall). Five new Python numerical tests passed. The source audit and cached tabulation reproduced all 322 official image/label hashes and exact confusion counts; full inference was run once for this release. `--check` remains available for a complete inference rerun. The production build passed, retaining all 66 NASA photo assets and 1,045,833 original mesh triangles. Browser and final post-integration build verification are recorded in the release completion notes.

Browser verification: desktop HUD results, largest false-positive and largest-miss overlays, expert-reference path selection, model HOLD outcome, mobile 390x844 layout with no horizontal overflow, and accessible panel close were checked. Training and inference are offline; the browser loads only precomputed reports and images.
