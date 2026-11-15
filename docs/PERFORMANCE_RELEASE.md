# On-demand exploration loading

The default recorded-rover view now loads its own assets directly. Orbital terrain, scientific rasters, orbital exploration code and crew-session UI load when the user enters those workflows. The current unified first-person visor, native NASA meshes, imagery, movement collision checks and mission feasibility calculations are retained.

The recorded hazard texture is independent of route selection. Changing a route or opening its map no longer reallocates and uploads the full hazard raster. Changing exclusions or terrain still rebuilds it, and the hazard toggle updates its existing shader uniform. Browser inspection confirmed the raster build count stayed at 1 across route changes. Regression tests preserve exclusion precedence, unknown coverage, slope classes and source data.

## Measured payload

Five alternating before/after navigations used the same Chrome tab, viewport and local production-build server. Baseline includes the concurrent unified-visor release (`44fd36e`); both sides use the same original native observed terrain. Values below are decoded response sizes, **not compressed production network traffic**.

| Initial exploration payload | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| JavaScript | 1,264,537 B | 1,035,445 B | 18.1% |
| CSS | 241,267 B | 88,997 B | 63.1% |
| JSON data | 7,254,896 B | 443,997 B | 93.9% |
| All decoded resources | 37,677,912 B | 30,485,974 B | 19.1% |

Requests decreased from 87 to 84; the comparison runs had no failed requests. Orbital terrain and analysis data remain available on entering the orbital workflow. Removed initial requests are deferred, not deleted datasets or lower-resolution replacements.

Terrain-ready timing was 1,967 ms before (1,959–2,160 ms) and 1,769 ms after (1,663–2,054 ms), median of five runs each. The ranges overlap and the median difference is smaller than baseline spread, so the timing verdict is **inconclusive**. The 100 ms probe cadence, local cache and desktop load also limit generalization. No faster frame-rate or mobile-network claim is made.

Raw runs and resource inventories: [explore-before-after.json](performance/explore-before-after.json). Reproduce using `node scripts/perf-server.mjs <production-dist> <port>` and `/explore?perf=1`. The DOM probe is supplied only by this local measurement server; it is absent from the published app.

## Validation

- TypeScript and production Vite build passed.
- 203 tests across 22 files passed with `vitest run --maxWorkers 1 --testTimeout 20000`. The existing large-terrain replay tests exceeded the default 5-second deadline under desktop contention; their assertions were preserved and passed with the bounded 20-second deadline.
- Browser checks cover recorded-rover entry, route selection without raster rebuilding, on-demand orbital entry and return, planning and crew handoff. The favicon now resolves without a redundant missing-icon request.

## Reproduction notes

Use production builds on both sides. Do not compare a Vite development server with a production bundle. The desktop browser exposes application data through DOM attributes; `performance` is unavailable in its read-only evaluation scope, so the local probe exports actual Resource Timing measurements into a visible DOM output. Never replace missing timing with zero or claim a network speedup from decoded byte counts.
