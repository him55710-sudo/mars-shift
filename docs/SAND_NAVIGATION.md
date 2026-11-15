# Sand candidate navigation in Mission Hub

Mission Hub (`/#sand-navigation`) now displays registered HiRISE imagery, published sand-texture candidates, their planning buffers, and the same outbound/return mission used by Mission Control and EVA. Mint is outbound; the fine white dashed line is return. The tan dashed comparator is the shortest budget-feasible route with sand screening disabled. Hiding the surface overlay does not disable routing constraints.

The Hub supports all five route objectives, region selection, map or keyboard-coordinate destination selection, explicit sand-avoidance switching, recalculation, and JSON export with route cells, settings, source, policy, coverage and registration limits. Stale calculations never display a current route or zero-crossing claim. A failed search preserves exclusions and reports no feasible round trip. Previously saved missions without a sand setting are migrated to avoidance enabled; explicit false remains false.

## Collected evidence and rule

`public/data/hazards/sand-navigation.json` collects all three regions, input SHA256 hashes (terrain/thermal arrays, optical imagery, NOAH-H classification, morphology and manifest), original source metadata and checksum identities, coverage, policy and calculated routes. It is generated from existing reproducible products; no synthetic detections or new sensor observations are inserted.

| Input | Role | Limit |
| --- | --- | --- |
| HiRISE / Caltech DEM, native 1 m | Elevation, slope and graph constraints | Planning cells are 5 m; small obstacles remain unresolved |
| HiRISE optical, about 0.3 m source | Registered visual context | Appearance does not measure bearing strength |
| NOAH-H v2, 0.25 m classification | Ripple texture area per registered 5 m cell | Derived classification, not physical trap labels |
| THEMIS, 100 m | Regional context and legacy screening experiment | Never converted into metre-scale hard trap exclusions |

The explicit planning rule selects cells with at least 95% classification coverage and at least 25% total area in original published ripple codes 3, 5, 6, 9, 12 and 14. It excludes each full selected cell plus one surrounding planning-cell ring (at least 5 m). The diagonal ring is conservative. The buffer is a declared planning assumption, not a measured registration-error bound.

The rule is centralized in `sand-screening.ts`. `planner.blocked` applies it when `Settings.avoidSand` is true. Thus A*, bounded resource-constrained alternatives, forward/reverse return Dijkstra, emergency return, corner checks and native EVA movement use the same exclusions. Existing slope, resource, NoData, manual obstacle and simulated exclusion checks continue to apply. Class-derived exclusions remain labeled as candidates, even though the selected policy blocks them.

Unknown texture is striped and counted along routes. It remains traversable under the existing DEM policy; the screen never calls it confirmed clear. Central floor and Eastern ridge have zero NOAH-H coverage, so the Hub explicitly reports unavailable sand screening. New unsaved sessions start in the actual NOAH-H overlap region. A user's saved study region is retained.

## Measured default mission

NOAH-H overlap has 35,850 of 40,000 cells meeting the coverage rule (89.625%), 2,188 ripple candidate cells, and 4,401 cells after buffering. Default start is (32,168), destination (153,43); 0.6 m/s modeled level speed, 12 kg payload, 20 min science and 25% required reserve. Local science morphology is loaded for these figures.

| Objective | Out + back | Time incl. science | Modeled reserve | Buffered exclusion cells crossed | Unknown texture route cells |
| --- | ---: | ---: | ---: | ---: | ---: |
| Unscreened shortest comparator | 1,751.4 m | See generated report | See generated report | 18 | 0 |
| Screened shortest | 1,856.8 m | 84.0 min | 40.1% | 0 | 0 |
| Screened fastest | 1,856.8 m | 83.8 min | 40.3% | 0 | 0 |
| Screened lower exposure | 1,880.3 m | 84.8 min | 39.5% | 0 | 0 |
| Screened energy proxy | 1,856.9 m | 84.0 min | 40.1% | 0 | 0 |
| Screened balanced | 1,862.7 m | 84.1 min | 40.1% | 0 | 0 |

The unscreened comparator crosses 10 candidate cells and 18 buffered exclusion cells, counting unique cells across both legs. Screened shortest is 105.4 m (6.0%) longer. The balanced and shortest routes have different objectives; their distance differences do not isolate a causal sand-cost effect. Zero mapped crossings is a graph invariant, not a measured reduction in actual trap incidents.

## Reproduce and verify

```sh
node scripts/run_sand_navigation.mjs
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
node scripts/package_navcam_assets.mjs
node scripts/package_static_assets.mjs
```

Six new tests cover outbound and inbound detours, no diagonal corner cutting, return-map agreement, all mission objectives, blocked endpoints, an impassable sand barrier, no silent fallback, missing classification, thermal-only evidence, preserved obstacles, saved-mission policy validation, and actual registered NOAH-H routes. The generated audit checks all five objectives in all three regions using their current morphology data and rejects any nonzero sand exclusion crossing.

Initial full regression run: 32 test files / 258 tests passed; production TypeScript/build/static packaging passed. Browser checks verified Hub objective switching, same selected route and region in Mission Control, keyboard-coordinate destination recalculation, and explicit unknown coverage on the floor region. At a 390 × 844 responsive viewport, map and console stacked without horizontal overflow (375 px content width after the scrollbar). Browser console errors were empty. Disabling avoidance crossed 21 buffered cells for the edited destination; re-enabling restored zero. A 20 min mission budget reported no feasible route without disabling exclusions. The exported JSON file was verified on disk (18,052 bytes, registered NOAH-H region, both legs, exact policy, zero candidate/buffer/unknown crossings for the selected route). The default mission was restored after these checks. Final full regression repeated: 32 files / 258 tests passed; static output 254.17 MiB beneath the existing 255 MiB packaging gate.

## Scope of inference

There is no ground-truth Jezero sand-trap or bearing-strength validation. Independent local registration error, acquisition dates, actual wheel slip and astronaut sinkage remain unknown. NOAH-H texture should guide inspection and conservative route screening; it does not establish that all traps have been detected. No unregistered Navcam or drive-local terrain is overlaid on this orbital grid. The earlier thermal-weighted candidate experiment remains available as `sand-comparison.json` and is distinct from this explicit texture-based exclusion policy.

Sources: [NOAH-H v2](https://doi.org/10.21954/ou.rd.17121482.v2), [Caltech / HiRISE products](https://data.caltech.edu/records/stqse-yay61), [existing NOAH-H registration and original legend](NOAH_H.md), [terrain product provenance](DATA_SOURCES.md).


## Helmet and Hub display update

The helmet now uses a crew-centered, north-up 200 m inset instead of compressing the entire 1 km study area into the small HUD. The current heading, mint active route, dashed return and amber mapped sand buffers use the same registered frame. A high-contrast next-action panel shows relative turn direction and the distance/side of the nearest mapped buffer edge. Distances use the declared 5 m cell footprints and are rounded down to whole metres for display; they are not live range sensing or known position-error bounds.

The panel withholds movement directions for unavailable localization, paused routing, a path that intersects an exclusion, more than 10 m off-route, disabled sand avoidance, or missing nearby classification. The existing localization policy continues to control movement and ground anchors. Off-route HOLD is an instruction to verify/recalculate, not an additional movement-lock mechanism. Full-map mode keeps the selected route mint, labels amber buffers, and separates its title, resources, scale and controls. Hub adds a direct **Open helmet guidance** action, stronger route contrast, an opt-in unscreened comparator, and working direct section links.

Ground sand cores and buffers have distinct amber colors; other hard exclusions stay red. Sand boundary contrast and the DEM-draped directional ribbon are strengthened; the 0.85 m ribbon is a display width, not a guaranteed safe corridor. The expanded mission map now uses the same ground hazard palette.

Seven additional tests cover camera-relative direction across north, distance to buffered cell edges, uncertain positions, stale/blocked/off-route/unscreened paths, missing texture ahead, cropped map bounds and distinct ground hazard classes. Full regression: 33 files / 265 tests passed. Browser verification used the real NOAH-H study region with a selected start near an existing route: the HUD displayed a mapped sand buffer 22 m to the right and a 14 m next waypoint. Setting the simulated position to DEGRADED removed the directional arrow, distance and map anchors, showing HOLD; restoring VALID reinstated them. No console errors were recorded. At 390 × 844 and 390 × 688, the local map and command were readable; DOM rectangle checks confirmed that movement buttons did not overlap resources, map or command. Full-map checks also confirmed separation of controls, resources and navigation instructions. Rendering quality and the 3D geometry remain the existing application pipeline.

Final integration also preserves the concurrently released Field Navigation workspace, worker, ground overview and animated route overlays. Its overview uniform is combined with the helmet sand emphasis. The merged source passed 34 test files / 276 tests and TypeScript checks.


## Original Sol 477 photo visor

The Hub's **Open high-detail rover visor** action opens `/explore`, the original Sol 477 / Drive1004 photo-mesh renderer shown in the reference HUD. It defaults to the 66 calibrated source tiles (1,045,833 triangles, 36,485,580 bytes), with the original transforms, embedded PDS imagery, antialiasing, texture anisotropy and camera. Efficient detail remains an explicit user choice. The terrain is not replaced by the orbital DEM or a new generated surface.

Local sand review adds an amber buffered outline, a labeled source (user review or simulated rehearsal), and a small distance/side readout. Routing, both legs and walking use the same 0.35 m crew-clearance exclusion. A blocked graph reports no feasible replacement and holds movement. The review is an image judgment, not an automatic or field-validated sand detection. The rehearsal places one explicitly simulated candidate on the current route; it does not modify source imagery or imply a sensor observation.

Drive1004 has no registration to the orbital mission. Consequently, NOAH-H masks and the orbital route are not projected onto this separate surface. Local reviews and simulations can be exported with their provenance. The orbital Hub continues to use its registered NOAH-H candidate screening.

`node scripts/verify_rover_display.mjs` runs after production packaging and checks all 66 source and deployed GLBs against their recorded SHA256, sizes, transforms and metadata. This covers embedded imagery and geometry together. The audit is saved in `analysis/native-rover-display.json`. Tests exercise native asset selection, local coordinate guidance, shared walking and round-trip exclusions, and an actual Drive1004 rehearsal detour.
