# V9 verification

- New engine: safe intervals with earliest-arrival dominance, safe waiting, continuous edge crossing, shared static return resources, bounded fallback.
- New unit tests: exhaustive time-expanded reachability equivalence on 20 tiny crossing problems; delayed crossing; engulfed start; depleted budget; every bearing crossed per event; all forcing days actually used; independent truth/sensor seeds; causal observations; matching reaction/processing clocks; source/input/selection hash binding.
- Full pre-UI suite: 33 files, 272 tests passed. Final v8/v9 focused suite: 18/18 passed, including the added provenance test (273 distinct tests total).
- TypeScript compilation, production Vite build and calibrated Navcam asset packaging passed after UI integration.
- All performance engines and input hashes matched after analysis. Existing v8 source and result hashes were preserved.
- Development: 54 placements × 6 configs = 324 runs. Final test: 108 × 6 = 648 runs. No final-test retuning.
- Browser: production preview at http://127.0.0.1:5201/hazards?lab=v9; SIPP uncertainty, holdout-000-b0, returned at T+180 s with 0.00 s contact, matching saved run. Reset and stepped to T+40 s; helmet and Mission Control both displayed revision 20, DETOUR, 0.00 s contact and 237 s return margin. No console errors.
- Screenshots: `../research/vortex-v9-helmet.jpg`, `../research/vortex-v9-map.jpg`. UI replay is verification of integration, not a new research sample.
- Default `/hazards` remains v8 MARS. SIPP is an explicit research mode. V25/high-resolution Navcam rendering code/assets were retained from v8; v9's registered DEM experiment does not add Navcam cases.
- React review: parallel independent data fetches, abort cleanup, worker cleanup, explicit experimental status, semantic labels and tables. No new dependency.

Known limitations: fixed 48 s horizon can refuse a late tight-budget plan without actual reserve exhaustion; v9 predictor candidates differ between selected policy classes; conditional synthetic rather than observed-event generalization; pixel-to-ground localization and local CFD not validated. No deployment, remote push or user workspace replacement was performed.
