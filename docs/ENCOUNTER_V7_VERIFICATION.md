# v7 verification — 2026-11-15

- Base: `21cee87` / calibrated Navcam visual base `7a643b7`.
- `node node_modules/vitest/vitest.mjs run --testTimeout=15000`: **250 passed, 30 files**. Includes continuous between-sample contact, analytic front-boundary timing, causal 3/7-fix forecasts, common budgets, fractional-edge return regression, continuing evaluation after early return, and hiding invalid visual tracks.
- `node node_modules/typescript/bin/tsc -b`: passed.
- Vite production build: passed (5.16 s); calibrated Navcam packaging passed. Existing source assets retained.
- Final confirmation: 72 frozen cases × 5 arms = 360 episodes. All complete, no budget violations. All arms use the same terrain, resources, reaction delay and sensor samples. Endpoint and Adaptive share the selected 7-fix predictor; LegacyAdaptive explicitly retains 3.
- Additional warm planner timing: 180 calls; p95 258.5 ms, max 289.6 ms. Loading/rendering excluded.
- Original v4/v5/v6 data and v7 development/holdout/validation outputs retained. Engine hashes for development/holdout match `encounter-v7-initial.ts.txt`; validation matches `encounter-v7-1.ts.txt`; ablation/confirmation match current engine bytes.
- Browser checked on local Chrome: actual DEM and calibrated Navcam rendering, scenario selection, 2 s stepping, accelerated replay, shared map/XR frame revision, early-estimation HOLD, contact-risk messaging, final results table and report/CSV links. A development-only hot-reload hook-array warning occurred while changing effect dependencies; a clean production load did not reproduce it.

This is a local research build, not a deployed service. Browser preview: `http://127.0.0.1:5193/hazards`. Measurements do not establish actual astronaut safety or a guaranteed real-time deadline.
