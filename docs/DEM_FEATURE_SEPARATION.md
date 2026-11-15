# DEM and raised-feature evidence

Open `/explore?analysis=separation`, or select **Terrain** in the rover visor. The same camera can compare Source image, DEM relief, Separate features, and Features only. Selecting a region frames its original position and reports height above the estimated reference, raster footprint area, and neighbourhood coverage. A user can add a conservative exclusion to the existing route graph after review.

## The measured surface and the estimated reference

This release uses the original NASA Perseverance stereo meshes, pinned to `NASA-AMMOS/3DTilesSampleData` commit `76444abbb4faff1b05f46a09b81ca2c24602b333`. It samples **988,527 finest source triangles**, without surrounding coarse context, at 0.10 m intervals over the existing 40 × 40 m local frame. Vertical barycentric intersections retain the highest observed surface. This is a stereo-derived local DEM/DSM containing rocks and other raised terrain, rather than a measured bare-earth DTM.

The raster records 65,530 observed centres. At 6,053 centres, source heights disagree by more than 0.20 m; those centres remain masked. The usable raster contains 59,477 centres. NoData and conflicting cells are never filled by the renderer. DEM relief connects adjacent sample centres only when all four corners are observed, and uses physical height at ×1 scale. Its light and colour ramp are display aids; the sample heights do not change.

The estimated ground reference comes from four robust local affine fits in square windows of 0.6 m and 1.5 m half-width. Positive residuals receive less weight with an 0.08 m scale. A fit requires at least 55% observed window coverage, sufficient remaining weight, and a nondegenerate two-dimensional covariance. A planar incline remains an incline, including near asymmetric missing observations. This reference is a model of neighbouring terrain, not a recovered physical ground surface under every rock.

Raised-region seeds require a large-window positive residual of at least 0.15 m, a small-window residual of at least 0.04 m, and at least four connected samples. Hysteresis grows a seed only through supported residuals above 0.075 m and 0.02 m respectively. Connected regions can merge adjacent raised patches; they are not semantic object instances. The current export contains **16 candidate regions covering 910 samples / 9.10 m²**. Candidate decisions are available at 44,032 centres, or 74% of usable centres. The other 15,445 usable centres are explicitly unassessed.

The reference-like, raised, steep (>35°), insufficient-neighbourhood and no-usable-observation classes are separate. These display classes are independent of the configurable navigation slope threshold. An unflagged sample is not certified safe ground. In Separate features and Features only, the classification texture is registered to the original source meshes; vertices are not moved and no replacement boulders are generated. Selected wire boxes indicate a region's extent, rather than a complete rock shape.

## Coordinate and route contracts

The frame remains the NASA station's local metres: X north, Y up, Z east. The fine evidence raster and the existing 0.25 m navigation raster share the same bounds; the client rejects mismatched frames. The local source is separate from the orbital HiRISE study regions. The existing 1 m orbital DEM remains the source for those regional routes; it cannot establish the presence or shape of small local rocks.

Candidate footprints are MultiPolygon coordinate arrays in **local metres**, not RFC 7946 / WGS84 GeoJSON. Heights and footprint areas are raster/model quantities. Stereo accuracy, registration uncertainty and sub-grid obstacles remain unquantified. A 0.10 m sample interval does not establish 0.10 m measurement accuracy.

Automatic candidates do not silently change passability. **Review & exclude this footprint** adds a circle enclosing the full region bounds; the existing navigation engine adds crew clearance and recalculates outbound and return routes. The annotation records the feature ID and extraction hash. This is user-reviewed exclusion, rather than field confirmation of an obstacle. Source-image mode and visor movement remain available.

## Public implementations inspected

- [Gale Marswalk Planner, `navcam3d/align.py`](https://github.com/sohaib1083/gale-marswalk-planner/blob/0fd5f635027a838fe4606e35abfee84df13c32e1/navcam3d/align.py) finds connected raised patches above a validity-normalized Gaussian reference. Its camera-registered geometry, explicit support provenance and photo/slope views informed this workflow. Our independent robust affine reference addresses incline and asymmetric-window bias; we retain separate unknown support. Learned depth infill is not used. No new source code from this repository was copied.
- [Tour-de-Mars, `tools/build_terrain.py`](https://github.com/pengvil/Tour-de-Mars/blob/451989702b0a18b68dc99a55393243f03d867d78/tools/build_terrain.py) preprocesses official CTX terrain, physical slopes, relief and coverage into a small, declared grid. We apply that separation of source observations, derived evidence and runtime presentation. Its 20 m input / 100 m planning grid is useful regional context, and is not a source of small-rock labels. The inspected tree did not expose a LICENSE; its implementation was not copied.
- [PCL's ground/non-ground separation tutorial](https://pointclouds.org/documentation/tutorials/progressive_morphological_filtering.html) and [PDAL SMRF documentation](https://pdal.org/en/stable/stages/filters.smrf.html) informed the explicit distinction between ground reference and raised returns. This release does not claim to implement PMF or SMRF, which are different algorithms.
- [NASA/JPL MARTIAN](https://github.com/nasa-jpl/martian) documents source DTM, registered imagery, metric meshes and declared camera/light conditions. Those principles inform the DEM-only view and ×1 height display. The Blender framework was not embedded in the browser.

## Reproduce and inspect

```powershell
../.venv/Scripts/python scripts/surface_separation.py
../.venv/Scripts/python -m unittest discover -s scripts -p test_surface_separation.py -v
../.venv/Scripts/python scripts/validate_surface_evidence.py
node node_modules/vitest/vitest.mjs run --testTimeout=15000
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
node scripts/package_navcam_assets.mjs
```

The Python environment needs NumPy, SciPy and Rasterio. Source GLBs and hashes are already versioned; this pipeline downloads nothing. It creates:

- `public/data/drive1004/surface-evidence.json`: heights, reference, residual, classes, region IDs, metric footprints, methods and extraction hash.
- `public/data/drive1004/surface-features.json`: smaller feature and provenance record.
- `public/data/drive1004/surface-evidence-validation.json`: independent direct-ray checks and the analytic-reference diagnostic.

The validator samples 80 source positions, including every candidate peak, using independent vertical-triangle intersection calculations. Maximum export difference is 0.00004783 m, consistent with four-decimal rounding. This checks numeric export, not source stereo accuracy. Six Python tests check metric axes, overlapping-source disagreement, slope invariance around holes, raised regions, sparse support and low noise. Five frontend tests check metric mesh construction, missing-cell boundaries, actual candidate IDs/areas/peaks, frame rejection and buffered route exclusion.

On an analytic inclined plane with a hole, the normalized Gaussian reference has maximum absolute bias 0.06954 m over the same assessed cells; the robust affine reference differs from the plane only at floating-point precision. Neither crosses the 0.15 m seed threshold in that diagnostic. This is a controlled shape check, not a Mars precision/recall benchmark. There are no independently labeled Mars obstacle instances for this specific station in this release.

## Release verification

15 November 2026: all 216 frontend/engine tests passed across 24 files; all six new Python tests passed; TypeScript and the production build passed. Browser checks covered desktop and 375 px mobile layouts, mode switching at a fixed camera, direct 3D candidate selection, reference display, reviewed exclusion and undo, return to visor, and an exported JSON file containing 160,000 samples and 16 regions with the matching extraction hash. The pruned static build remains below the hosting limit at about 252.7 MiB.
