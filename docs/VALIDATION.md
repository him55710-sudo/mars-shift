# Validation

## Executed checks

- `pnpm test`: **30 tests passed** after the crew workflow revision (18 routing tests and 12 crew-state tests).
- `python scripts/preprocess.py --test`: **4 tests passed** (flat surface, known planar slope, physical pixel spacing, missing-pixel display handling).
- `pnpm build`: TypeScript check and Vite production build passed.
- Actual acquisition and preprocessing completed: checked DEM checksum, Mars CRS, native units, optical CRS match, raster footprint, thermal alignment and valid-data coverage.
- `node scripts/benchmark.ts`: wrote reproducible actual-data comparison to `public/data/validation-results.json`.

The routing tests cover physical distances, 3D edge distance, analytic open-grid optimum, path continuity, NoData, complete barriers, diagonal corner constraints, slope constraints in all modes, invalid target coordinates, reserve rejection, mission-duration rejection, missing thermal behavior, reduced-visibility HOLD, heuristic exposure avoidance, route invalidation, rerouting, no-path behavior, and integration on the actual Jezero grid.

## Measured baseline and event

Default settings are in `planner.ts` and exported with results. Values below are computed from the published raster, not hypothetical accuracy gains.

| Route | Before distance (m) | After simulated exclusion (m) | Before max cell slope | Before total time (min) | Before reserve |
|---|---:|---:|---:|---:|---:|
| Shortest | 1752.9 | 1793.6 | 16.24° | 86.98 | 37.86% |
| Lower exposure | 1991.9 | 1991.9 | 5.29° | 88.31 | 36.85% |
| Mission aware | 1846.0 | 1945.2 | 11.01° | 85.66 | 38.86% |

The event intersects 12 unique prior mission-route cells. All three recomputed candidates avoid every cell inside the exclusion. The lower-exposure path is unchanged because it already avoids the event footprint. That is an expected and useful result, not a failed scenario.

All baseline routes cross zero cells of the configured steep-slope proximity proxy. Do not market these results as measured rockfall-risk reduction. The demonstrated benefits are different terrain choices, explicit modeled resource margins and auditable response to a hypothetical new exclusion.

## Browser checks

Chrome verified actual loading, route metrics and simulated event revalidation. Increasing the science stop to 120 minutes and recalculating produced NEEDS REVISION, with time-budget and reserve rejection. Further final browser checks are recorded in `BROWSER_QA.md` after completion.

Screenshots are direct browser captures of the running app, not fabricated product mockups. Unit tests validate software behavior under defined inputs, not physical safety performance.

## Crew workflow revision — 2026-11-14

Actual-data tests additionally cover 75 m checkpoints, accumulated resource use, the full outbound/science/return sequence, early return, HOLD and reduced-visibility movement prevention, remaining-mission rerouting, preservation of an exclusion, saved-session geometry/source identity, bounded event identities and destination clamping.

Chrome verified departure-check guidance; startup gating; checkpoint movement; obstacle HOLD → position/buddy verification → compare → explicit adoption; visibility HOLD that remains locked after acknowledgments; restoration on HOLD; return cancellation and confirmation; and Mission Control handoff of the Crater-floor comparison target (1,451 m round trip, displayed reserve 49%). A 390 × 844 responsive check showed no horizontal overflow. Primary actions measured 52–58 CSS px high and map zoom controls 48 × 48 CSS px. This is a target-size check, not a glove or pressure-suit usability experiment.

A production build was served locally, its cache reached “Map saved offline”, and the HTTP server was stopped. Reload still rendered the application and terrain, restored a saved session on HOLD, and completed an explicitly confirmed early return without the server. External NASA pages and presentation downloads are outside this offline cache. Production publication is separately checked in `BROWSER_QA.md`.

An additional regression check proves that an excluded corridor remains invalid after restoration or a visibility-mode change, even if its display reason is reset. The geometry check independently prevents progression until a feasible replacement is adopted.
