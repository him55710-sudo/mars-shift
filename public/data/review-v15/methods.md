# MARS SHIFT — evidence and methods, v15

Review date: 15 November 2026. Research prototype, not an operational EVA system.

## Purpose and contribution

Help a simulated astronaut choose a next action and retain a modeled return option during a local dust-devil encounter. Separately, screen mapped sand candidates before planning an outbound and return route. Regional dust storms are not treated as locally escapable tornadoes. The contribution is an inspectable integration of observations, uncertainty, terrain, resource constraints and helmet guidance. A*, Kalman/IMM tracking, camera projection and terrain classification are existing methods, not inventions claimed here.

The current English demonstration is `/briefing` (seven slides including the opening slide). `/review` provides the evidence and three working views. The old downloadable PowerPoint and `/briefing?archive=1` describe an earlier release and are retained only as archives. Local URLs are not public submission URLs.

## What is observed, reconstructed or assumed?

| Input | Role | Limit |
|---|---|---|
| NASA HiRISE elevation and optical imagery | Terrain costs and orbital mission map | Source resolution is not positioning accuracy |
| NASA PDS calibrated Navcam, Sol 215 | Camera rays for a published dust-devil event | Approximate ranges reconstructed from a paper, not surveyed future positions |
| NASA PDS Navcam stereo, Sol 477 / Drive 1004 | Detailed helmet terrain and navigation support | Different place/time from the Sol 215 event |
| MEDA observations | Recorded pressure evidence and published event scales | A single station does not uniquely identify a moving vortex's full geometry |
| Published NOAH-H mosaic | Mapped ripple texture candidates | Not soil bearing strength or astronaut sinkage labels |
| THEMIS thermal context | Coarse regional surface context | Not a metre-scale hard exclusion or human sinkage calibration |
| Crew, local sensor and vortex scenario | Speed, delays, resources, onset, turns and position noise | Explicit simulation assumptions |

The orbital sand crop, Sol 215 reconstruction and Sol 477 scene have no validated common local registration. Sand classes are not projected onto the photographed rover scene. Display-only interpolation fills some stereo gaps with original photographs; it does not create walkable or measured terrain.

## Preserved computational evidence

`evidence.json` is a secondary audit of six pre-existing result files, with SHA-256 identities. It introduces no new observation, trained model or holdout. The generator checks paired case identities and retains failed cases. Multiple model evaluations of the same event are not counted as independent observations.

**Observed reconstruction:** one metric event, four approximate positions, three distinct origin/target future comparisons. The 3.04 m position RMSE is against the paper-derived reconstruction; it does not establish independently measured one-metre accuracy. Three previously studied image clips are separate angular/image evidence and are not three new range-validated trajectories.

**Prediction confirmation:** 192 synthetic cases. Mean reported RMSE changes from 31.79 to 27.05 m versus the previous IMM (14.90% reduction), with 47 worse cases. The nominal 95% region contains 91.80% of evaluated positions: uncertainty is under-covered in this experiment. Zero new independently observed events entered this confirmation set. The adaptive filter mixes motion models and handles large innovations; it is not validated local CFD or a proven best possible Mars predictor.

**Escape confirmation:** 36 matched cases on observed terrain; five policies use the same case-specific resources, mobility and delay assumptions. Mean contact: Static 2.761 s; previous integrated 2.482 s; Adaptive without guard 2.490 s; current Guarded 2.480 s; full-information reference 2.466 s. All have 27/36 no-contact outcomes and zero return failures. Guarded reduces contact by 10.190% versus Static and 0.064% versus the previous integrated policy (one improved, 35 tied, none worse). This does not demonstrate a large incremental escape benefit. The full-information reference uses the same finite candidate action set; it is not a globally optimal continuous-world solution. The frozen report also retains clearance, delays, reserves, HOLD decisions and calculation times.

Warning time denotes the predicted arrival of the risk region's front boundary at the current position, not centre arrival. Frozen encounter protocols retain reaction/control delays, radius/buffer assumptions and contact definitions. Continuous segment contact checks address between-sample crossings. Moving away from the instantaneous centre is only one possible action; feasible terrain, future relative motion and return budget matter. The v15 review does not retune these definitions.

**Sand screening:** 26 conditions, five arms, 130 runs on existing map data; no independently observed trapping events. On the same 12 cases where coverage-only and 5 m screening both find routes, unique buffered planning-cell crossings summed over cases change from 185 to zero, at 20.50 m added mean round-trip length. The same physical cell can occur in multiple cases. The default trip changes from 1,751.41 to 1,874.37 m (+7.02%), with 28 to zero buffered cells. Across all conditions, route availability decreases from 18/26 unscreened to 14/26 coverage-only and 12/26 screened. Avoiding a declared mask verifies constraint enforcement, not detection accuracy or lower real trapping probability.

The published mosaic ripple classes (3, 5, 6, 9, 12, 14), at least 95% classified coverage and at least 25% ripple area define candidates in 5 m planning cells. Unknown coverage is excluded. Buffers expand full cell footprints conservatively; they are not measured confidence contours. Loose featureless sand may be missed, and ripples may be mechanically firm. Routes retain slope, support, obstacles, both resource budgets and the original return base. Failed searches withhold guidance; they do not prove that every physically possible route is infeasible.

## Reliability changes in v15

Scenario, policy and reset changes identify a new guidance session. The helmet excludes mismatched replies immediately. The XR adapter publishes a withdrawn frame without route, forecast or claimed valid anchors while the new calculation is pending or after a planner failure. This fixes stale guidance; it is not an improvement in forecast skill. English/Korean sand controls retain the same worker and mission state.

## Reproduce

From the repository with Node dependencies installed:

```sh
node scripts/review_v15.mjs --check
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
node scripts/package_navcam_assets.mjs
node scripts/verify_adaptive_v13.mjs
node scripts/verify_sand_v14.mjs
```

The first command recomputes the published audit in memory and rejects stale values. The replay scripts check recorded identities and deterministic metrics in isolated temporary directories; they do not overwrite the historical results. CPU timings remain machine dependent. The v15 audit is not an additional statistical replication or a fresh test set.

## Next scientific gates

Freeze a new protocol before inspecting outcomes. Use event-level train/validation/test separation for tracking, and spatially held-out regions for terrain classification. Obtain synchronized angles and independent range/position measurements, preserving timestamps, calibration residuals and missing detections. Report error by forecast horizon, bias, tail error, interval coverage and event-level uncertainty; do not pool adjacent frames as independent events. Require precision/recall, boundary error and registration residuals for sand candidates, with separate mechanical labels before any sinkage claim.

For routing, compare all baselines with the same terrain, resource limits, detection/reaction delay and contact definition; retain impossible/failed cases. Report paired contact, no-contact, minimum clearance, return failure, needless HOLD and full end-to-end latency. Define a meaningful effect and allowed regressions before testing. Choose event counts using pilot variability and the desired precision/power, not the number of synthetic combinations. Reuse of the current confirmation set is development, not fresh confirmation. User studies can test whether guidance is understood; they cannot establish Mars survival rates.

## Primary sources and attribution

- [Official judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/): Impact, Creativity, Validity, Relevance, Presentation; each has a 1–5 scale. No numerical weights were shown in the version inspected on 15 November 2026. Internal project ratings are not official judge scores.
- [Official project submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/): English linked materials, one demonstration link, at most seven slides including the opening slide or a video at most 30 seconds, plus a separate full-project link accessible without authorization. Publication/submission was not performed in this local review.
- [Murdoch et al. (2022), The sound of a Martian dust devil](https://www.nature.com/articles/s41467-022-35100-z): observed event and approximate reconstruction basis.
- [NASA PDS calibrated Sol 215 Navcam](https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_navcam_ops_calibrated/data/sol/00215/ids/rdr/ncam/); original local products and camera labels retain their individual provenance.
- [NASA-AMMOS CameraModelUtilsJS](https://github.com/NASA-AMMOS/CameraModelUtilsJS): camera implementation, Apache 2.0; vendored license and source identity are retained.
- [NOAH-H Jezero dataset v2](https://doi.org/10.21954/ou.rd.17121482.v2), Wright et al., CC BY 4.0; [map publication](https://doi.org/10.1080/17445647.2022.2095935).
- [Cunningham (2017), terrain-informed rover mobility](https://doi.org/10.1184/r1/6720116): motivates thermal/terrain evidence; no human sinkage model is transferred.
- Frozen v13 and v14 reports preserve detailed method references and experimental definitions beside their result files. The process review of fire/tsunami/hurricane evacuation research is preserved at `/data/hazards/vortex-v10/process-review.md`.

NASA/JPL-Caltech imagery and terrain are observed source products, not AI-generated scenery. The hero image is a screenshot of the v14 software with observed imagery and simulated crew/vortex overlays. Codex assisted implementation, tests, analysis and documentation; Exa assisted source discovery in this review. Existing source credits and open-source licenses are retained. NASA endorsement, real injury reduction and operational safety are not claimed.
