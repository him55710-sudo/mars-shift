# Sand escape rehearsal and accuracy audit

Open `/hazards?ground=training`. The visor reuses the calibrated NASA Sol 477 scene, original collision support and native photo textures. It does not register NOAH-H observations onto this unrelated local frame.

1. Introduce sand traps. Three explicitly fictional footprints invalidate the former direct route.
2. Walk escape route. Playback follows the collision-checked path at a modeled 0.6 m/s. Pause, look around, open Route, or hide the hazard layer.
3. At the checkpoint, plan and walk the return to the original start.
4. Scenario → Surrounded demonstrates an explicit HOLD. It never removes an exclusion to invent a path.
5. Why this route? compares baseline distance and training-zone crossings. Evidence & accuracy distinguishes observations, derived screening and the rehearsal.

## Computed results

Run `node scripts/run_sand_rehearsal.mjs --check`. The report includes the source grid SHA-256, both route legs and all 18 conditions: 3 scenarios × 3 objectives × 2 budgets. Six are feasible; 12 correctly have no route (the enclosed-ring conditions and 1-second budgets). Every feasible route has zero continuous segment/footprint crossing. These cases were developed for interaction and regression checks, not withheld detector evaluation.

Default shortest case: original round trip 10.543001 m, screened round trip 11.423775 m. Baseline crossing is 5.328427 m; screened crossing is 0 m. Crossing length sums full edges that intersect any expanded footprint, so it is a conservative edge-length measure, not exact interior chord length. Minimum screened clearance from the already crew-buffered circle is 0.20 m. The graph uses a 0.35 m crew buffer plus half the cell diagonal for rasterization. This is a simulated navigation margin, not measured positioning accuracy.

The 3 m entry neighbourhood has 441/441 available height samples. The existing visual photo backing has estimated depth and remains excluded from collision and planning. No NASA raster or mesh bytes were changed.

## Accuracy is not established by the demo

There are **zero independent trapping labels** in this release. No trapping precision, recall, survival probability or calibrated foot-sinkage risk is claimed. Existing NOAH-H ripple classification is observed texture screening. THEMIS does not resolve small local traps. Curiosity slip models from the NASA/JPL paper are referenced, not reproduced; they cannot be transferred to astronaut feet without validation.

NASA AI4Mars provides expert terrain-class labels suitable for sand/rock classification evaluation; it does not supply astronaut sinkage labels. Its published model accuracy is not MARS SHIFT's accuracy. This release does not introduce a newly trained visual classifier.

The accuracy panel accepts independent-label JSON files and calculates confusion counts, precision, recall, F1, false-positive rate and tie-aware average precision. It reports missing predictions separately with coverage. It rejects invalid numbers, duplicate IDs, post-traversal inputs and episode leakage across splits. Source independence and whether inputs really precede the outcome still need external audit. Average precision is not labeled trapezoidal PR-AUC. No uploaded label changes route ground truth.

Schema and collection requirements: `/data/hazards/sand-v38/validation-protocol.json`. Empty inputs yield unavailable metrics, never zero-error or perfect-accuracy claims. Collect and register real before-traversal inputs and independent rover slip outcomes before evaluating trap prediction. Any astronaut-specific claim additionally requires relevant human mobility data.

## Implementation and limits

Routing stays in a Web Worker. A single base support graph is cached per worker; changing a scenario only adds exclusions and reruns the existing route objectives. Camera playback keeps route textures stable and reuses measured-surface collision tests. Stale worker responses cannot enable movement guidance for changed settings. The demo uses guided walking, not a new free-walking physics engine. Mission time and suit reserves remain declared assumptions.

The existing observed sand screen, recorded Sol 215 replay, review and current briefing routes had been bypassed by a prior App integration; their direct routing is restored without replacing scientific engines or frozen experiments.

Primary sources reviewed:

- [NASA/JPL slip prediction with thermal inertia](https://ntrs.nasa.gov/citations/20210006223): method cited; no slip model reproduced.
- [NASA AI4Mars](https://data.nasa.gov/dataset/ai4mars-a-dataset-for-terrain-aware-autonomous-driving-on-mars): independent terrain-label resource, not imported trapping ground truth.
- [AI4Mars original paper](https://openaccess.thecvf.com/content/CVPR2021W/AI4Space/html/Swan_AI4MARS_A_Dataset_for_Terrain-Aware_Autonomous_Driving_on_Mars_CVPRW_2021_paper.html): task and label limitations referenced.
