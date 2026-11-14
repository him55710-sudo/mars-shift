# Unified 3D EVA Explorer — 14 November 2026

The default `/` or `/explore` page is a terrain rehearsal on actual HiRISE observations. `/terrain` retains the global Mars Atlas and five real Mastcam-Z panorama sites. Planet-wide data are contextual; detailed walking/planning is confined to two observed 1 km regions, not globally available metre-scale terrain.

## Controls and mission flow

Orbit by dragging, pan with right-drag, zoom with wheel/pinch. Select **Walk EVA**, then click the terrain for mouse lock; drag-look remains available when pointer lock is unsupported. WASD/arrows move at the configured modeled speed; touch arrows are also available. M expands the synchronized minimap and exits walking for interaction; H toggles hazard overlays; L cycles layers; Esc exits. Walking follows bilinearly sampled native 1 m DEM elevations, eye height 1.7 m, vertical exaggeration fixed at 1. The displayed mesh uses 2 m vertex spacing from the native DEM. This is not a rover-camera reconstruction or a collision-resolved boulder scene.

Choose start/target with the terrain tools or minimap; inspect numeric values with coordinates. Changes pause walking and mark the old paths stale. **Calculate** explicitly commits all mission inputs to shared state. Mission Control, 3D EVA, detailed terrain analysis and Crew handoff use those actual outbound/return arrays. Switching route objective selects a calculated alternative; objective selection alone does not invalidate geometry. State is saved per region in browser storage. Walking distance and position are rehearsal state; displayed resource totals refer to the planned mission, not live suit consumption.

Swept motion samples at most 1 m per step and rejects mapped NoData, maximum native slope per 5 m cell, explicit annotation buffers and simulated exclusions. Diagonal corner cutting is forbidden. Unresolved sub-grid obstacles remain unknown. Neither 1 m DEM sampling nor close-up rendering establishes centimetre-level safety.

## Route search and resource constraints

`constrained-planner.ts` preserves the original terrain costs, searches weights α ∈ {0, .25, .5, .75, 1} blending the requested terrain cost with modeled effort-distance, independently for outbound and return legs. The α=0 baseline uses the original A*. Duplicate paths are removed; every distinct outbound × return pair is measured and hard-filtered for time, reserve and visibility. Lowest requested-mode terrain cost wins among feasible pairs. At most ten A* searches and 25 combinations per objective are considered. This is a bounded alternative search, not general globally optimal multi-resource routing.

All current resource budgets are linear and monotone in modeled travel minutes T:

```text
T ≤ duration − science
T ≤ [oxygen × (1 − reserve/100) − .65 × science] / (1 + .01 × load)
T ≤ [power × (1 − reserve/100) − .8 × science] / (1 + .005 × load)
```

Effort includes slope, ascent and payload. Oxygen/power units are simulated endurance minutes, not a calibrated EVA physiology model. Thermal inertia remains coarse context, not a physical soil-strength penalty. A fixture where the original mission cost optimum takes 3.222 minutes and violates a 3.1 minute window now finds a feasible mixed-leg alternative of about 3.086 minutes; a 90 m / 2.95 minute fastest pair is also considered. No route is invented when all alternatives fail.

## Reproducible optical evidence workflow

The source optical raster is ~0.3 m; the registered, contrast-enhanced display image is 1 m per pixel. The evidence panel displays an actual 80 × 80 m crop, records the selected grid point, buffer radius, note, time and provenance, and exports/imports JSON bound to the region's exact projected bounds. Import rejects malformed fields, duplicates and excessive annotations. Four statuses separate manual candidates, manually reviewed objects (not field verified), uncertain regions and simulated inputs. Candidates do not block routes automatically. An explicit exclusion checkbox applies a conservative radius plus half a 5 m cell diagonal; the same mask drives routing and walking.

No automatic optical classifier is claimed. No labeled evaluation set, precision/recall or false-positive rate exists. Shadows may be non-rock features; source resolution, downsampling and orbital viewing omit small objects and occlusions. Manual review is not physical confirmation. This intentionally uses the directive's manual annotation fallback rather than fabricating automatic detections.

## Simulated event revalidation

The event freezes the selected prior route and places a 35 m exclusion at 55% of its outbound cells. The old route remains red; the intersecting segment is highlighted and unique invalidated cells are counted. The three objectives are recalculated under unchanged mission assumptions, with distance/time differences shown. Walking remains paused until explicit adoption. If no searched alternative is feasible, adoption and walking remain disabled. Events are simulated inputs, never observed Mars terrain change.

## Second real study region

`public/data/ridge` is centred at 77.7315223374° E, 18.5043948064° N in the same source projection. DEM, optical and thermal coverage are complete. Native DEM relief is 109.0979 m; the conservative planning grid has 430 cells above 25° and 2,527 cells in the 20 m steep-slope proximity proxy. `prepare_ridge.py` reproduces the extraction; `benchmark_ridge.ts` records the original terrain-only comparison.

The default routes in both study regions cross zero proximity-proxy cells. No annotated rockfall traces, directed runout analysis or calibrated rockfall probability was established. The second region demonstrates more rugged observed topography, not proven avoidance of observed rockfall. It must not be promoted as measured rockfall-risk reduction.

## Verification

68 unit/integration tests cover existing behavior plus native interpolation, swept WASD collision, NoData/slope/corner/exclusion/annotation constraints, budget-rescuing alternatives, hard-resource failure, annotation validation, shared mission edits and explicit calculation, exact Crew path handoff, frozen-route revalidation and no-route adoption prevention. TypeScript and production build pass. `scripts/eva-browser-qa.cjs` exercises desktop/mobile, walking, hotkeys, mission synchronization, point selection, annotation exclusion, revalidation/adoption, both regions, offline native DEM reload and WebGL-to-2D fallback. Browser results are software checks, not human usability research or safety certification.

The production service worker caches both regions' required images/data/native DEMs and all application chunks only after a successful online load. External planetary tiles, uncached panorama imagery, original source archives and downloads still need network access. The UI reports verified local cache status.

## Remaining scientific work

Validate optical annotations against independent labels and full-resolution source crops; obtain measured image/DEM registration errors; inspect actual rockfall traces and directional runout; calibrate astronaut resource/effort models; add real multiview surface reconstructions only with camera metadata and verified geometric registration. See [3DGS feasibility](3DGS_FEASIBILITY.md). No current display certifies terrain safety.
