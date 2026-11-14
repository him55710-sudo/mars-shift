# Published NOAH-H terrain classifications

The project reuses the authors' **descriptive-class mosaic** from [NOAH-H terrain classifications of Jezero Crater, Mars, version 2](https://doi.org/10.21954/ou.rd.17121482.v2), released under **CC BY 4.0**. The associated method is [Wright et al. (2022), Journal of Maps](https://doi.org/10.1080/17445647.2022.2095935). This is a published machine-derived terrain-texture classification, not an observed hazard probability map or a newly trained MARS SHIFT classifier.

The downloaded archive is `NOAH-H_terrain_classifications_of_Jezero_Crater_Mars.zip`, **352,353,484 bytes**, with verified published MD5 **42835d4e3a7cdb322b057b2b85941500**. It remains outside Git in `../data-cache/NOAH-H_17121482_v2.zip`. The preparation script additionally verifies the extracted TIFF against its complete ZIP member using SHA256 and ZIP CRC validation. Per-product JSON records the exact mosaic and original layer-file hashes.

The original README explains that the authors applied ArcGIS Pro 2.8 **spline** transformations to HiRISE images, transferred the same control points/transforms to NOAH-H rasters, then changed class pixel values to prioritize classifications during mosaicking. Consequently, the **published mosaic rank codes differ from the original individual-raster/network class numbers**. The project reads labels and colors directly from `DescriptiveClasses_rank_DC.lyrx`; it does not infer them from a generic NOAH-H class list.

|Mosaic code|Original published descriptive label|
|---|---|
|1|Non Bedrock: Smooth, Featureless|
|2|Bedrock: Textured|
|3|Small ripples: Non-continuous small ripples, Bedrock substrate|
|4|Bedrock: Smooth|
|5|Small ripples: Non-continuous small ripples, Non-Bedrock substrate|
|6|Small ripples: Continuous small ripples|
|7|Non Bedrock: Textured|
|8|Non Bedrock: Smooth, Lineated|
|9|Large Ripples: Simple form large ripples, Isolated|
|10|Bedrock: Rugged|
|11|Boulder Fields|
|12|Large Ripples: Simple form large ripples, Continuous|
|13|Bedrock: Fractured|
|14|Large Ripples: Rectilinear form large ripples|

## Coverage and the additional study region

The 0.25 m categorical mosaic uses a Mars sphere of radius **3,396,190 m**, with equirectangular latitude of true scale **0°**. The existing Caltech/project CRS uses the same Mars sphere with latitude of true scale **18.4663°**. Reprojection uses those Mars CRSs directly; Earth WGS84 is not substituted.

Actual overlap checks found **no NOAH-H coverage in either existing floor or ridge study region**. Their `noah-terrain.json` files therefore contain null classes and zero coverage for every cell. This result is preserved rather than shifting a classification raster to produce a colored layer.

A third real 1 km crop, **NOAH-H / Caltech overlap**, uses nominal center **77.565° E, 18.46° N**, snapped to the original Caltech 1 m DEM pixel lattice with the same method as `preprocess.py`. It is approximately 6 km east of Perseverance's landing site and must not be called the landing site itself. The Caltech DEM does not cover the actual landing location at approximately 77.45° E.

Exact third-region bounds in the existing project Mars CRS are:

```text
left    4360409.037914526 m
bottom  1093711.6170900527 m
right   4361409.037914526 m
top     1094711.6170900527 m
```

The native Caltech source window is `(column 427, row 7306, width 1000, height 1000)`. Its valid DEM fraction is **99.9899%** and observed relief is **26.7451 m**. These are DEM source-support figures, separate from classification coverage.

The NOAH-H product at `/data/noah/noah-terrain.json` has **89.846088%** sampled classification coverage: **36,049** of 40,000 planning cells have at least one class sample, **35,826** have complete class coverage, and **3,951** are wholly unknown. Partially classified cells retain their missing fraction. NoData is not converted into a known terrain type.

Selected whole-footprint class area estimates are:

|Published texture class|Area fraction of the complete 1 km² footprint|
|---|---:|
|Non-bedrock: smooth, lineated|32.655438%|
|Non-bedrock: textured|23.973369%|
|Boulder fields|17.130063%|
|Bedrock: rugged|9.723888%|
|Large ripples: continuous|2.833294%|

These are **classified texture area fractions**, not rock counts, rockfall probabilities, confirmed loose-soil fractions or accident/survival probabilities. A class such as non-bedrock or ripples can supply a documented candidate indicator, while its physical interpretation and any routing weight remain separate explicit heuristics. Classification coverage and DEM support must be combined by the consuming engine before making traversal decisions.

## Reproducible categorical aggregation

`scripts/prepare_noah.py` registers categories with **nearest-neighbour** resampling to a 0.25 m target lattice inside each exact 5 m planning cell. Each cell contains **400 equally spaced sample centers**. `fields.classFractions[i]` contains 14 class area estimates in `classFractionOrder`, each equal to the number of matching samples divided by **all 400 samples**. Unknown samples remain in the denominator; the sum equals `fields.coverage[i]`, subject to six-decimal rounding. These are sampling-based area estimates, not exact polygon-intersection areas or model confidence scores.

`dominantClass` is the largest known class count. Ties choose the lower published mosaic rank code, a disclosed deterministic display rule. Wholly unclassified cells have null dominant class, dominant fraction and class-fraction vector. The source TIFF's NoData value is **127**; output unknown has no class assignment. Native pixel spacing does not establish positional accuracy or small-object clearance.

The supplied tie-point coordinate files document the authors' original registration. Neither the README nor those coordinate pairs provide an independently measured residual against this project's later Caltech DEM/orthomosaic. The local registration residual is therefore explicitly **unknown/null**. The preparation applies no extra fitted shift or claimed registration correction.

```sh
../.venv/Scripts/python scripts/prepare_noah.py
../.venv/Scripts/python scripts/prepare_noah.py --check
../.venv/Scripts/python -m unittest discover -s scripts -p test_prepare_noah.py
```

Four tests cover NoData in the area denominator, deterministic majority ties, registered categorical sampling, outside-coverage handling, the original rank-code mapping and actual-data coverage. The `--check` command revalidates original archive identity, TIFF identity, labels, Mars registration and all three numerical products. The script does not edit any existing terrain, optical detector or scientific analysis product.


## Interface integration after surface v13

The overlap crop now has a registered native ~0.3 m optical display and 69 display tiles. Acquisition transferred 5,370,428 bytes through the validated range bridge. Native optical NoData is transparent; it is not inpainted. Existing floor/ridge display checks still reproduce unchanged assets.

`prepare_noah_science.py` reuses the existing numerically tested terrain equations without rewriting the two baseline scientific products. Its full derivative raster and planning arrays reproduce under `--check`. Native DEM coverage is 99.9899%; native 3 m morphology aggregates have 98.01% planning coverage. Planning slope median 1.64886°, p95 4.81016°; TRI median 0.07485 m, p95 0.20832 m. These are shape measures, not soil strength. The optical detector cue field is entirely null because no evaluated local model mask has been supplied.

`noah-data.ts` validates exact Mars registration, original mosaic IDs and class-area sums; it supplies per-cell source/coverage/uncertainty evidence. A separate display-only rule categorizes hard graph constraints, texture candidates, lower modeled concern and missing classification. The 25% candidate-area and 95% coverage thresholds are explicit heuristics, not calibrated failure probabilities, and never create hard route obstacles by themselves. Four tests validate actual coverage, wrong-ROI rejection, missing classes and constraint precedence. The destination selector now exposes the third region. Shared 2D/3D scientific layers show the original categorical legend, classification coverage, boulder-field/ripple texture area and four-state hazard rules. The inspection panel reports class areas, source/license, publication date, unknown observation date, unknown independent registration error and route impact. The original two regions stay unclassified. Ground view uses thin, distance-faded candidate boundaries/hatching; lower concern is unpainted so the real optical image remains visible. This is additional context, not a replacement for the graph constraints or user-reviewed obstacle buffers.


## Reproducible application integration result

`node scripts/run_noah_analysis.mjs` writes `/data/noah/integration-results.json` without changing the two frozen baseline scientific reports. In the declared default model (0.6 m/s, 12 kg payload, 20 min science, 25% reserve), the shortest feasible alternative is about 1.751 km / 80.6 min including science. Safety-priority routing is 1.792 km / 81.7 min with maximum mapped slope 4.46°, compared with 10.6° for shortest distance. All compared routes have zero steep-slope proximity exposure here; this is not evidence of measured rockfall avoidance.

The return-feasible area is 0.979375 km² at 110 min, falling to 0.429650 km² at 60 min. The map has 796 unknown morphology cells and 29 blocked cells. Classification uncertainty is separately displayed; it is not silently treated as measured mobility failure. A simulated 35 m exclusion invalidates nine unique old-route cells and triggers alternatives under the same resource settings.

A 0.5 m optical inspection image is supplied by `prepare_noah_optical_display.py` with transparent native NoData. No automatic optical detections or precision/recall claims are generated for this new ROI. Its review panel explicitly reports the missing evaluated detector; the manual annotation workflow remains available.
