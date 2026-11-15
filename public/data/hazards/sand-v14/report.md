# MARS SHIFT v14 — photo continuity and sand screening

## What was changed

The large flat patches in the Sol 477 helmet scene included missing stereo triangles: rays through representative blank pixels did not intersect the original calibrated mesh. v14 draws original NASA PDS images on a separate, bounded interpolated surface behind those meshes. Original stereo meshes, v13 navigation grid, and dust-devil engines remain unchanged.

The display backing samples the measured height grid at 0.2 m, interpolates inside its convex hull, and only covers points within 3 m of a measured height sample. It is offset down by 0.04 m. Camera projection, image extents and nonzero source pixels are checked before adding a triangle. The mesh contains 55,794 triangles and is 4,375,836 bytes. Height interpolation is a visual approximation, not observed depth. Large unsupported gaps remain possible. Original image pixels are resampled, not generated. Original stereo gaps can be shown using the Layers toggle.

The backing never participates in ray picking, walking support, terrain collision or route calculation. Its SHA-256 and all source identities are recorded in `drive1004/display-v14/manifest.json`. The navigation-grid SHA-256 remains `cb15cbf547da5823e117a4405e64ecdaddaed177819d0be637f921271811f518`.

## Sand candidates, proximity and routing

This uses the existing real NOAH-H/HiRISE overlap crop, centred at 18.4600 N, 77.5650 E, approximately 6 km east of the landing site. It is **not** the Sol 477 local photo mesh. Their local coordinates have no validated connection, so v14 does not project orbital sand classes onto that mesh. The two modes are linked in the interface.

Published NOAH-H mosaic ripple classes (3, 5, 6, 9, 12, 14) identify texture candidates. A 5 m planning cell is a candidate when classified coverage is at least 95% and ripple area fraction is at least 25%. These are fixed screening rules, not fitted sinkage probabilities. No new classifier was trained. Cells below the coverage threshold are unknown, not safe. Low THEMIS thermal inertia alone does not create a hard sand exclusion.

The default 5 m extra buffer is measured between **full cell footprints** and rasterized outward. Thus it is conservative on the 5 m grid and is not an exact 5 m continuous contour. 0, 5, 10 and 20 m buffers are exposed in the interface. Existing slope, obstacles, data validity and both outbound/return resource constraints are preserved. Unknown classification is excluded by default. Routes do not cut diagonally through blocked corners.

The existing constrained planner searches objective-weight alternatives and selects the lowest objective cost among feasible candidates. It is not a proof of the globally optimal multi-resource route. Replanning uses the astronaut's current simulated position, remaining modeled resources and the **original** return base. A failed search removes guidance, reports the reason and does not silently relax constraints. Time-budget failure means no feasible path among the searched alternatives, not a proof that all continuous-world paths are impossible.

The final interactive-session review preserves the absolute departure reserve (37.5 modeled oxygen-minutes / 35 battery-minutes) as the crew advances. Because the existing planner accepts one reserve percentage for both resources, the larger required remaining-resource fraction is used conservatively. This is a UI-session correction; it does not modify the frozen departure-case experiments. Two further regression tests cover reserve conservation and exhausted-budget HOLD.

The helmet shows direction/distance to the nearest buffered cell boundary, the next waypoint, resources and a 200 m map. The large map selects destinations. Risk layer, route and XR adapter use the same masks/cells. XR timestamps accumulate actual modeled edge travel time including slopes/diagonals. The pose is explicitly an exact simulation pose, not measured localization; physical XR anchors are not validated.

## Frozen experiment

26 case definitions, five arms, 130 runs. The 24 endpoint/budget/speed combinations share an existing orbital crop; two cases test absent classification in other crops. They are **not 26 independent observed trapping events**, and there are zero independent soil-failure labels. Inputs and cases were fixed before outcomes; no post-result threshold tuning was performed.

Within each case, all arms share DEM, slope cap, speed, load, science duration, time, oxygen, battery and reserve limits. Arms separate missing-data exclusion from sand buffering. Feasibility and exclusions are checked on both legs. Candidate/buffer crossings count unique planning cells within each returned round trip, not seconds of exposure or injuries. Summing across cases can count the same physical cell more than once.

| Arm | Returned routes / 26 | No route / 26 | Planner CPU p95 (ms) |
|---|---:|---:|---:|
| UNSCREENED | 18 | 8 | 122.2 |
| COVERAGE_ONLY | 14 | 12 | 71.2 |
| SAND_0M | 14 | 12 | 70.4 |
| SAND_5M | 12 | 14 | 80.2 |
| SAND_10M | 12 | 14 | 70.7 |

UNSCREENED retains the pre-existing planner; COVERAGE_ONLY additionally excludes unknown classes; SAND arms add candidates with the indicated buffer. CPU values measure the planner call only on this machine, not rendering, map preparation, worker transfer or a real-time guarantee. Interactive worker durations include map preparation plus both comparison plans and can be higher.

Among the **same 12 cases where COVERAGE_ONLY and SAND_5M both returned routes**, buffered-cell crossings summed across cases decreased from 185 to 0, while mean round-trip length increased by 20.50 m. Mean per-case relative increase is 2.45%; mean modeled time increase is 0.85 min. UNSCREENED has identical paths on this paired subset. These numbers verify enforcement of a map exclusion, **not accuracy of sand detection or reduced real trapping probability**.

Default case `registered-0`: 1,751.41 → 1,874.37 m (+7.02%), 28 → 0 buffered cells, 84.6 min modeled mission, 39.7% modeled resource reserve. Across all 26 cases, returned routes fall from 18 UNSCREENED to 14 COVERAGE_ONLY to 12 SAND_5M. This loss of availability is reported, not filtered out as a success. Two missing-coverage controls correctly withhold screened routes. The two additional losses between COVERAGE_ONLY and SAND_5M are endpoint/connectivity exclusions (`registered-5` and `registered-15`). The implementation does not move an excluded destination to a more convenient cell.

## Same-case comparison

Entries show round-trip metres / unique buffered cells; `—` means no feasible route returned. Buffer counts are measured against each arm's own exclusion, so 0 m and 10 m arms are not directly compared as equal hazard extents. See results.json for all paths, resource values, timings and failure reasons.

| Case | UNSCREENED | COVERAGE_ONLY | SAND_0M | SAND_5M | SAND_10M |
|---|---:|---:|---:|---:|---:|
| registered-0 | 1751 / 28 | 1751 / 28 | 1798 / 0 | 1874 / 0 | 1886 / 0 |
| registered-1 | 905 / 11 | 905 / 11 | 905 / 0 | 921 / 0 | 930 / 0 |
| registered-2 | 1130 / 23 | 1130 / 23 | 1135 / 0 | 1153 / 0 | 1159 / 0 |
| registered-3 | 1223 / 30 | — | — | — | — |
| registered-4 | — | — | — | — | — |
| registered-5 | 1272 / 38 | 1272 / 38 | 1272 / 0 | — | — |
| registered-6 | — | — | — | — | — |
| registered-7 | 634 / 4 | 634 / 4 | 634 / 0 | 652 / 0 | 657 / 0 |
| registered-8 | — | — | — | — | — |
| registered-9 | 409 / 0 | 409 / 0 | 409 / 0 | 409 / 0 | 409 / 0 |
| registered-10 | 339 / 6 | 339 / 6 | 339 / 0 | 386 / 0 | 468 / 0 |
| registered-11 | 1434 / 15 | — | — | — | — |
| registered-12 | — | — | — | — | — |
| registered-13 | — | — | — | — | — |
| registered-14 | 1016 / 30 | 1016 / 30 | 1016 / 0 | 1016 / 0 | 1016 / 0 |
| registered-15 | 295 / 7 | 295 / 7 | 309 / 0 | — | — |
| registered-16 | — | — | — | — | — |
| registered-17 | 1225 / 23 | 1225 / 23 | 1225 / 0 | 1225 / 0 | 1234 / 0 |
| registered-18 | 1060 / 12 | 1060 / 12 | 1060 / 0 | 1060 / 0 | 1060 / 0 |
| registered-19 | 1527 / 30 | 1527 / 30 | 1527 / 0 | 1527 / 0 | 1558 / 0 |
| registered-20 | — | — | — | — | — |
| registered-21 | — | — | — | — | — |
| registered-22 | 989 / 7 | 989 / 7 | 989 / 0 | 989 / 0 | 989 / 0 |
| registered-23 | 1071 / 11 | 1071 / 11 | 1071 / 0 | 1088 / 0 | 1106 / 0 |
| missing-coverage-data | 1753 / 0 | — | — | — | — |
| missing-coverage-ridge | 1753 / 0 | — | — | — | — |

## Scientific limits and sources

NOAH-H is a texture classification. Its original study reports difficulty distinguishing smooth regolith from sand; the Jezero map paper discusses terrain-dependent class errors. A ripple mask will miss featureless loose sand and can include mechanically firm surfaces. A 0.25 m source pixel is not 0.25 m positional accuracy. The supplied project data has no independently measured local registration residual. The buffer is a configurable scenario assumption, not a calibrated confidence contour. The fixed classification thresholds require future independent annotation and mechanical validation.

Thermal inertia informs bulk surface properties; it does not measure a person's sinkage. Rover wheel-slip research motivates combining terrain/thermal evidence but cannot calibrate astronaut soil failure. THEMIS (~100 m) remains regional context. No meter-accurate trap boundary, measured sinkage accuracy, real injury rate, or operational EVA safety claim is made.

1. Wright et al., [NOAH-H Jezero terrain dataset, v2](https://doi.org/10.21954/ou.rd.17121482.v2), CC BY 4.0. Existing downloaded archive and mosaic checksums are retained in noah-terrain.json. The published **mosaic** legend is used rather than the training class numbering.
2. [NOAH-H automated terrain classification study, Icarus (2021)](https://www.sciencedirect.com/science/article/pii/S0019103521003560). Supports texture-based screening and its ambiguity, not soil-bearing validation.
3. [Jezero NOAH-H map publication (2022)](https://doi.org/10.1080/17445647.2022.2095935). Supports the mapped source and classification limitations.
4. Cunningham, [Improving rover mobility through physically-grounded terrain sensing (2017)](https://doi.org/10.1184/r1/6720116). Thermal/terrain-informed rover mobility rationale; no human sinkage calibration transferred.
5. Original NASA PDS Navcam images, CAHV labels and NASA-AMMOS scene transforms are linked individually with hashes in `drive1004/display-v14/manifest.json`.

The next meaningful validation requires independent mapped loose-sand/firm-ground labels, registration residuals and soil/load evidence. Evaluate precision/recall and boundary errors on a held-out spatial region; do not optimize against this 24-case crop and call it generalization. Local rover-image classification requires a separate validated segmentation and geographic registration before it can guide local XR.

## Reproduction and regression checks

Existing v13 results and sources remain preserved. `protocol.json` records 15 literal input hashes. `results.json` is write-once. The verification script checks these hashes and reruns all 130 case/arm outcomes in an isolated temporary directory; deterministic paths and metrics must match. Timestamps and machine-dependent CPU timings are not compared.

```powershell
node scripts/verify_sand_v14.mjs
node node_modules/vitest/vitest.mjs run
python scripts/test_display_support_v14.py
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
node scripts/package_navcam_assets.mjs
python scripts/report_sand_v14.py
```

15 added TypeScript tests cover classification/coverage, cell buffers, no thermal-only trigger, original obstacles, both route legs, resources and absolute reserves after replanning, diagonal corners, original return base, invalid coordinates, proximity direction, real-data input preservation and XR timing/masks. Three Python tests cover interpolation on an analytic plane, bounded gap exclusion and original navigation/output hashes. Full-suite and browser results are recorded in the v14 handoff note.
