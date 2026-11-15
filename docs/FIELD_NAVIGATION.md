# Integrated field navigation

`/navigate` combines the registered Jezero NOAH-H study grid, native HiRISE DEM display, surface-class screening, operator exclusions and outbound/return graph routes. The Hub features this workspace; existing Navcam, weather and advanced planning views remain available.

## Evidence and coordinates

- Native HiRISE DEM: 1 m samples, checksum and registration verified by `useNativeDEM`. Planning uses the registered 5 m grid and its conservative terrain constraints. Visual relief is 1×.
- NOAH-H: published 0.25 m texture classes aggregated as cell area fractions. Ripple classes are 3, 5, 6, 9, 12 and 14; boulder-field texture is class 11. Classification registration residual is unmeasured.
- THEMIS thermal inertia: 100 m context, resampled to the common grid. It does not establish 5 m soil strength.
- Local Navcam stereo raised-feature patches use a separate, unregistered local frame. They are accessible from the method panel, and are not falsely placed on the orbital map.

Per-cell screening uses `0.55 × ripple fraction + 0.20 × normalized low thermal inertia + 0.25 × negative-TPI index`. Low thermal inertia normalization is `(450 − TI) / 300`, clipped to [0,1]. Negative TPI combines 11 m and 51 m windows: `max(clip(−TPI11 / 0.75), 0.6 × clip(−TPI51 / 2))`. Geometry requires full support for both windows; texture requires at least 95% classification coverage. Missing inputs remain explicitly incomplete; missing texture never becomes a zero-risk observation.

Ripple candidates require at least 25% classified ripple area. Depressed-ripple candidates additionally require a depression index ≥0.25 and full geometric support. Their five cells form two small regions in the shipped crop. Boulder-field texture requires ≥35% classified boulder area. These are heuristic candidates, not measured trap probabilities or individual-rock detections. The index weights and cutoffs are declared engineering assumptions.

Thermal context is motivated by [Cunningham, Whittaker and Nesnas, RSS 2017](https://roboticsproceedings.org/rss13/p38.pdf). Their fitted Curiosity slip calibration is not transplanted to this map. Current candidates have no local sinkage, traction or bearing-strength validation.

## Routes and review

The worker runs A* on the existing eight-neighbor graph, sharing `blocked`, `edgeBlocked` and modeled resource accounting with the rest of the application. It reuses the existing MIT-licensed Gale Marswalk Planner heap adaptation; attribution remains in `src/grid-heap.ts` and `public/licenses/gale-planner-MIT.txt`.

Each edge costs its 3D distance multiplied by a nonnegative policy penalty:

| Policy | Screening index, when enabled | Boulder texture | Mean slope squared | Incomplete support |
| --- | ---: | ---: | ---: | ---: |
| Shortest | 0 | 0 | 0 | 0 |
| Balanced | 4 | 0.8 | 0.004 | 0.5 |
| Cautious | 8 | 1.6 | 0.012 | 1.2 |

Both outbound and return paths enforce NoData, slope, continuous edge grade, diagonal corner constraints, existing obstacles and reviewed exclusion masks. Unreviewed derived candidates add soft penalties, never silent hard blocks. Reviewed or simulated exclusions use an explicitly shown 20 m circle plus half a planning-cell diagonal buffer. The prior outbound route remains visible in coral dashes during comparison. View-layer toggles do not change route constraints.

Resource budgets are checked after each policy's minimum-cost route is solved. A failed budget is reported for that candidate; it is not proof that every alternative is infeasible. The separate advanced planner retains its richer constrained alternatives. The lower-index exit action is a bounded rehearsal: it tests the nearest 24 fully supported, lower-index candidates and requires a feasible return. It is not an autonomous recovery controller or a guarantee of escape from an actual immobilization.

Worker revisions reject stale replies after edits. Route flow is a display animation, capped at 24 fps, stopped when hidden or paused, and suppressed by `prefers-reduced-motion`. It is not live rover telemetry. Cartographic route ribbons and candidate labels render above the terrain for legibility; measured ground geometry is unchanged. A 2D fallback carries the same color masks, candidates and routes.

## Reproduce

Run `node node_modules/vitest/vitest.mjs run src/field-navigation.test.ts --reporter verbose --disableConsoleIntercept` for synthetic constraints, penalty changes, unknown data, round-trip budgets, reviewed buffering, lower-index exits and registered real-data graph-edge checks. Run `node scripts/run_field_analysis.mjs` for a compact numerical report. The full configured build preserves the static hosting budget.
