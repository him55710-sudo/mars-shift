# Escape v5: definitions, matched references and one-bottleneck improvement

Frozen before diagnosis and controller changes, 2026-11-15. Preserve all v4 and
`dust-escape-*` artifacts. The old 7,200 combinations are synthetic factorial cases,
not 7,200 independent observations. Known Table S3 parameters are not new events.

## Fixed definitions

- Warning W is the time from first available detection (t=0) to FIRST ENTRY of the
  declared circular exclusion boundary at the stationary starting point, for straight
  constant-radius approaches. Centre passage is W + sqrt(R²-b²)/v; head-on W+R/v.
- All new arms use R=physical model radius+1 m. This is an exclusion convention,
  not a measured damage boundary. Earlier 2 m analytical examples remain separate.
- Contact is strictly inside this circle for positive duration; tangency has zero
  duration. Numerical no-contact threshold is 1e-8 seconds. Record signed minimum
  clearance as well. Integrate continuous piecewise-linear path/circle intersection.
- Common sensing: t=0 detection, 0/2/4 s fixes, estimate ready t=4, first plan/motion
  eligible t=6 (2 s delivery/reaction lag); thereafter replan every 2 s. Initial
  information-ablation arms at t=0 are explicitly different, not matched controls.
- Same terrain, speed, load, consumption, fixed reserve, base/target, sampled fixes
  and execution loop for all matched arms. Return feasibility is static beyond the
  forecast horizon; do not claim an actually completed, dust-free return mission.
- Speed 0.4/0.6/0.9 m/s and load 12 kg are assumptions; DEM travel costs reduce
  speed by the existing slope/load model. Synthetic growth/turns are assumptions.

## Freeze and sequence

`escape-v5/manifest.json` fixes 12 diagnostic and 36 holdout cases, disjoint seeds,
two real DEMs, headings/offsets, parameters, speeds, warning leads and resources.
Some holdout cases turn or grow; nominal W is then a placement parameter, and the
actual stationary first-contact time is separately measured. Not an event holdout.
No holdout scores may be inspected until one implementation and configuration are
frozen in `implementation-freeze.json`. Scripts refuse to overwrite results.

1. Regress boundary-vs-centre timing and swept contact including fast crossings,
   tangent, growth and interval subdivision. Preserve old inputs/outputs by hash.
2. Diagnose with legacy controller: flat/full-information/no initial lag;
   DEM/full-information/no lag; DEM/full-information/common 6 s lag;
   DEM/noisy/common lag; DEM/noisy/common lag/45 s horizon.
   Perfect information supplies true future motion over the SAME candidate bank,
   DEM, walking costs, resources and horizon. It is a bounded-search reference,
   not a proof of global optimality. Keep free-plane headings separate.
3. Record all candidate witnesses: a chosen contacting route while a return-admissible
   noncontacting alternative exists can establish an objective tradeoff bottleneck.
   Choose ONE confirmed bottleneck to improve. Continuous scoring is permissible
   to make the fixed contact definition consistent with candidate evaluation.
4. Freeze implementation, then evaluate Baseline, Dynamic, legacy integrated,
   improved integrated and matched full-information improved reference on all 36
   holdout cases. Include failures, near misses and initially-inside separately.
   No retuning on these scores. Publish per-case paired CSV/JSON, every failed
   episode's timestamps, contact intervals, trajectory, minimum clearance and return
   margin, aggregate contact/no-contact/return failures and p50/p95/max computation.
5. Reproduce tests/types/build. XR consumes the same chosen path/metric contract;
   do not call the bounded best candidate a globally optimal or guaranteed safe path.

The optimization goal is to choose a terrain-feasible, resource-feasible movement
direction/path that avoids contact when available and reduces modeled contact when
not. No astronaut injury rate or real-world safety guarantee is inferred.
