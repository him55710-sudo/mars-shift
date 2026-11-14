# Validation

## Executed checks

- `pnpm test`: **18 tests passed** in the initial core verification.
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
