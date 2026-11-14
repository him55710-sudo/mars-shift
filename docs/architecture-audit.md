# Engineering audit — 14 November 2026

Scope: the user's Final Engineering Directive, “Real Mars Terrain Digital Twin & Risk-Aware EVA XR Navigation”. This is the delivery checklist, not a completion declaration. Existing baseline commit: `cc2e28c3be47590c2f93952b978a97fbc8b6a6dc`. The 2055 crew mission is a **simulated future scenario**, not a NASA mission prediction.

## Observed implementation

| Capability | Status | Authoritative implementation / gap |
|---|---|---|
| Global Mars context | IMPLEMENTED | `MarsGlobe.tsx`, `mars-atlas.ts`: existing ArcGIS Mars services, Mars WKID 104971, separately loaded global context. No Earth WGS84 terrain. |
| Regional real DEM | IMPLEMENTED | Two 1 km square Jezero regions; published Caltech HiRISE 1 m DEM, native Float32 arrays, original Mars sphere CRS and metre bounds retained. `prepare_native_dem.py`, `prepare_ridge.py`, `use-native-dem.ts`. |
| DEM/ortho registration | PARTIAL | Identical Mars CRS, exact raster-edge bounds and pixel-centre convention; numeric grid alignment verified. Independent absolute geolocation and image/DEM feature residuals have not been measured. Shared metadata is not an accuracy measurement. |
| Optical rendering | IMPLEMENTED | Fresh ~0.3 m source crops, 3334² WebP; ~0.5 m frozen detector evidence, 1 m minimap. Provenance, range checksums and crop hashes retained. `prepare_surface_optical.py`. |
| Ground geometry / route draping | IMPLEMENTED | `surface-geometry.ts`: native 1 m detail near crew, shared adaptive axes, no quads across NoData; resampled real route edges follow native heights. EVA vertical scale is exactly 1. |
| Tile streaming / per-tile culling | PARTIAL | Global SDK streams tiles. Local region loads one complete native DEM and one optical texture. Adaptive geometry exists; local multiresolution texture tiles still required. |
| Terrain derivatives | IMPLEMENTED | `terrain_science.py`: native slope, aspect, TRI, TPI, curvature, multiscale relief and coverage masks; analytic and real-data tests. Not a soil-strength or rockfall-probability model. |
| Terrain classification / geology | MISSING | NOAH-H acquisition started. Geological map and USGS quality mosaic require coverage/registration review. Existing thermal layer is ~100 m context. |
| Optical candidates / human review | PARTIAL | Reproducible detector, benchmark, review/export and obstacle masks exist. Candidate validation is limited; human-verified annotations are not certified boulder ground truth. |
| A* / alternative round trips | IMPLEMENTED | `planner.ts`, `constrained-planner.ts`: four modes, slope/NoData/exclusion constraints, explicit no-feasible result, bounded alternative filtering. No global constrained optimality claim. |
| Directional mobility / return area | IMPLEMENTED | `mobility.ts`, `return-feasibility.ts`: 3D edge lengths, directional grade, modeled burden, forward/reverse graph costs and hard resource reserves. |
| Energy saver objective | MISSING | Existing mission-balanced mode combines effort and exposure; it is not a dedicated minimum-energy mode. |
| Emergency return | PARTIAL | `crew-engine.ts` supports return from a checkpoint, remaining resources and observed exclusion replanning. Free-walking EVA position is not yet unified with this session. |
| Dynamic hazard comparison | IMPLEMENTED | `mission-state.ts`: frozen prior route, invalid cells, calculated alternatives and explicit adoption. Event is explicitly simulated. |
| Ground truth / observations separation | MISSING | Current event is immediately introduced as a known exclusion. Undetected scenario obstacles and a distinct observation channel still required. |
| NASA-derived crew visual | IMPLEMENTED | `astronaut-avatar.ts`, `prepare_nasa_crew.py`: NASA EMU adapted in Blender 5.2, 23,238 triangles, 9-bone illustrative walk, 852,596-byte GLB. Not a flight suit specification. |
| EVA camera / collision | IMPLEMENTED | `eva-motion.ts`, `TerrainScene.tsx`: WASD, mouse look/pointer lock, mobile controls, real DEM interpolation, 5 m constraint collision. Sub-grid obstacles remain unresolved. |
| Helmet-first presentation | IMPLEMENTED | Helmet is the default. Third-person is optional, with a lower camera pitch to keep the full suit in view. |
| HUD / minimap / expanded map | IMPLEMENTED | `SurfaceHUD.tsx`, `MissionMap.tsx`, shared mission store: actual route, crew, elevation, hazard layer, route purpose/profile and explicit calculation. |
| Resource readings | MOCK | Explicit simulated oxygen/power budgets and projected return values; no physiological sensors. Ground elevation/slope are derived from observed DEM. |
| Localization states / AR gating | MISSING | No valid/degraded/lost state manager or sensor adapter. Ground path display must be gated before localization failure simulation is complete. |
| WebXR device session | MISSING | Desktop/mobile Three.js works; real XR session/device validation not implemented. A headset must not be implied. |
| Dust storm | PARTIAL | Existing reduced-visibility setting affects model and holds crew workflow. Visual weather, localization degradation and explicit reevaluation must be unified. |
| Dust devil / sand trap | MISSING | No reproducible hidden-event/observed-event engine or field-sensor disclosure. |
| Science worker | IMPLEMENTED | `science-worker.ts` isolates return-map and seeded sensitivity analysis. |
| Mission routing worker | MISSING | `use-mission.ts` currently calculates routes synchronously. Must move route/replan work off UI thread with revision-safe responses. |
| Offline and hosting | IMPLEMENTED | Versioned service worker, local core data, Vite static output, existing Sites and Vercel deployments. New asset offline and production checks remain release gates. |

## Verification at this checkpoint

`pnpm test`: **116 tests in 9 files passed**, 17.41 s on this workstation. `vitest.config.ts` limits CPU-bound workers to one, preserving existing assertions and per-test deadlines. Rendering tests cover NoData, metre/UV registration, native lighting normals, route draping and distinct hazard categories. This does not validate all new directive requirements.

Existing scientific assets remain frozen. `science-results.json` SHA256: `dd261a7d5b19c0aabb75326439e88004832926d8fc2a3f4d47e8b22943c3efa0`. New render-data checks and browser results are tracked separately. Physical hazard probabilities, astronaut survival, localization accuracy and hardware XR performance are **UNVERIFIED**.

## Delivery sequence and completion evidence

1. **Phase 1 — real terrain / rendering:** audit; verify both regions' native arrays, optical provenance, metre registration, NoData and UVs; implement local multiresolution tiles/culling; helmet-first quality review; record frame/loading/memory measurements. Complete only after local browser, mobile, build and source checks.
2. **Phase 2 — evidence-aware hazards:** retrieve original NOAH-H and class definitions; nearest-neighbour Mars reprojection, coverage and registration metadata; inspect geological/USGS confidence coverage; four-state red/orange/green/grey layers with per-cell evidence, resolution, date and route effects. Do not turn terrain labels into calibrated failure probabilities.
3. **Phase 3 — routing:** preserve distance/time/exposure routes; add explicit energy objective and emergency return from free-walking current position; resources/reserve/location policy; async worker and revision cancellation; observed-event cost updates and before/after comparison; deterministic blocked/budget/no-route tests.
4. **Phase 4 — XR:** helmet HUD, base/next-waypoint directions, remaining resources and return estimate; position/sensor interface, safety manager and WebXR adapter; valid/degraded/lost state gates; test map/HUD alignment and disable misleading world-locked guidance when position is uncertain. Hardware success remains unverified without hardware.
5. **Phase 5 — emergency rehearsal:** deterministic storm, dust-devil, sand-trap and slope event scenarios; independent simulator truth and observations; no hidden-obstacle leakage; hold/relocalize/replan/return; all events and solar changes labeled simulated. Preserve battery operation independent of solar input.

Final gates: complete data/license register, architecture, reproducible demo, full tests/build, measured performance report, desktop/mobile/WebGL fallback, production smoke check, limitations and follow-up. The seven-slide submission limit and existing mission/offline behavior remain invariants. Each requirement stays open until its corresponding code/data/runtime evidence is verified.


## Rendering checkpoint — 2026-11-14, surface v13

Implemented native optical tile streaming, a four-tile1024² resident atlas,128 m frustum-cullable geometry patches, and deferred third-person-only NASA EMU loading/shadows. Rendering partitions preserve each original triangle, UV and normal; CPU navigation uses the same authoritative DEM. Native DEM bytes now pass SHA256, metre/CRS/bounds/half-pixel checks before entering ground mode. A Node type dependency and explicit AMD boundary cast keep production type checks valid.

Validation:121 tests in12 web test files passed; production TypeScript/Vite build passed. Native1 m validations and13 numerical Python terrain tests passed previously;4 NOAH preparation tests passed. Browser Chrome at1536×639 displayed the actual tile-backed terrain, helmet/follow camera, route ribbon and ground constraint hatching with no fresh WebGL errors. Expanded map/mobile/offline publication checks are recorded with the deployment verification.

Computed: default-base mesh61,250 triangles versus500,000 in the old uniform2 m mesh (87.75% reduction). Local coarse+atlas optical texture storage8,194,304 bytes before mipmaps, versus44,462,224 bytes for one3334² RGBA image. This is not total GPU/process memory. Per-position triangle counts vary.

The development five-second sweep was throttled in the automated/background Chrome context (10 frames/5 s); CPU draw submission median2.00 ms is not GPU time. Those results are unsuitable as foreground performance claims. No zero-lag or60 FPS claim is made. Eye-height sharpness remains limited by ~0.3 m orbital imagery and1 m DEM, without actual rock-side stereo imagery for these ROIs.

Phase2 data are acquired but not yet exposed as a completed feature: real NOAH-H classification covers89.846088% of the newly prepared western overlap region and does not cover the original floor/ridge ROIs. USGS controlled DTM comparison revealed a ~−10.264 m median offset on floor; that dataset was not silently substituted. See NOAH_H.md and EXTERNAL_TERRAIN_REVIEW.md. Localization gating, mission worker, new energy/emergency objectives and distinct simulator observations remain open as above.


## Phase 2 and routing-worker checkpoint — NOAH v14

**Implemented:** third registered NOAH-H overlap region; original 14-class legend; coverage and class-area layers; four-state rule overlay; per-cell provenance/unknown dates/registration uncertainty; native 1 m derived morphology and 0.3 m optical tiles. NOAH-H is a published derived texture classification, not a geological unit map or calibrated failure surface. A separately registered geological unit layer remains unimplemented. External USGS/PDS overlap findings remain as documented above.

**Implemented:** mission alternatives and exclusion replanning now run in `mission-worker.ts`. The shared store retains last completed paths, pauses walking/adoption during computation, terminates superseded work, rejects late/duplicate replies, preserves edits during a calculation and reports worker failure without silently running the heavy solver on the browser thread. The CLI path remains synchronous for reproducible analyses. Offline precache discovers and verifies both scientific and mission worker bundles.

**Validated locally:** 132 tests in 14 files, TypeScript/Vite build; seven new asynchronous transport tests cover pending-state gating, in-flight edits, cancellation/stale results, immediate hazard freeze, failed worker retry, reset/disposal and reload with uncalculated edits. Chrome showed real classified terrain, ground hazard boundaries, route alternatives and evidence in desktop and 390 × 844 layouts with no new console errors. Browser worker timings observed on the NOAH default mission were 1,034.9 and 1,300.4 ms; these are two development samples, not a frame-rate benchmark or hardware guarantee. A separate Node calculation took 418.1 ms, replan 470.0 ms; runtime/environment differ.

The original seven-slide presentation and `science-results.json` are preserved. Energy-saver objective, current-position emergency return, localization gating and hidden/observed event separation are still pending. No full-system completion or certified navigation claim is made at this checkpoint.

Production-build offline check passed locally: all 59 core assets, 207 optical tiles and both module workers were present; after stopping the localhost preview server, reload restored the NOAH scene, return map and explicitly recalculated route (revision 1, 1,469.6 ms). No network-dependent global service is claimed available offline.


## Phase 3 / surface navigation checkpoint — v16, 2026-11-15

The initial table above is a historical audit. Current changes supersede its Energy saver, Emergency return, Localization and Mission routing worker entries: dedicated effort-distance routing and current-position return are implemented; accepted surface motion consumes explicit simulated resources; return calculation runs in a revision-safe worker; valid/degraded/lost fixes gate ground guidance and movement. See [SURFACE_NAVIGATION.md](SURFACE_NAVIGATION.md) and the separate actual-data numerical report. Per-calculation edge/constraint caches reuse work without carrying stale hazards across requests.

NOAH-H and local native optical streaming were already delivered in v14–15. Geology, hidden simulation truth / observation events, experimental WebXR and foreground performance validation remain incomplete. Follow view remains the saved/current photo-reference preference; helmet view remains available. No full-directive completion or scientific safety certification is claimed.

## Flight Deck UI verification — 2026-11-15

The earlier checkpoints above are historical. Shared UI tokens, navigation and responsive field controls now cover 22 desktop/phone views. The current verification and bounded human-factors limitations are in [DESIGN_REVIEW.md](DESIGN_REVIEW.md). Published helmet/Navcam functionality and the hazard research remain integrated; this UI pass does not certify local obstacle sensing or real EVA safety. Source checks: 181 tests in 18 files and a TypeScript/Vite build. Visible-browser camera sweeps were 47.8 FPS desktop and 53.0 FPS phone-size on this host.
