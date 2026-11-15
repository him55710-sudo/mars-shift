# Local dust-devil v4 protocol — 2026-11-15 (Asia/Seoul)

Written before computing new prediction or navigation scores. Preserve all v1–v3 artifacts.

## Scope and evidence

The task is escape from a nearby moving dust devil, in metres and seconds. MDAD daily
regional storms are excluded from the local predictor, local scenario generator and XR default.
The 15–280 m range in Reiss et al. (2014) is an observed diameter range, not a universal
limit, radius, damage radius, or storm-forecast error. Spirit observed 2–276 m, mostly 10–20 m.

New sources: Bickel et al. (2025), DOI 10.48620/87803 (1,039 detections, measured
advection where present); NASA/JPL PIA26074 (Jezero sol 899, 21 frames at reported 4 s),
PIA26528 (Jezero sol 1398, 21 frames at approximately 6 s), PIA24039 (Curiosity sol
2847, 21 frames spanning 255 s). The latter has only total duration in the release;
uniform 12.75 s timing is an approximation and must be reported as such.

The published catalog contains mean velocities, not full HRSC five-position trajectories.
Do not fabricate those positions from the mean velocities. The NASA GIFs are enhanced
observations. Their measured image-plane centers/widths are derived labels, not surveyed
3D ground truth. Monocular images do not observe range or the radial velocity. Annotated
regions condition evaluation on a visible, identified column; detector recall is not tested.

## Prediction split

Use only PIA26074 for choosing estimator settings. Freeze the configuration before opening
prediction scores for PIA26528 and PIA24039. Entire events are separated; adjacent frames
are never randomly divided into training and test. Spatial image processing is fixed and
uses each frame alone (no future-frame background subtraction). Manual event ROIs are
measurement annotations, not predictor inputs. The predictor receives only earlier fixes.

Compare legacy Kalman, last-fix persistence, last-two-fix constant velocity, and a causal
short-window robust fit with conservative radius dynamics. Candidate window sizes 3/5/7;
radius modes last/median/limited linear; choose by development position RMSE plus radius
MAE, with an explicit position-versus-radius tradeoff. Report image-pixel center RMSE,
crossrange direction sign accuracy (excluding sub-pixel displacement; monocular azimuth is unavailable), apparent
width MAE, temporal lead and sample counts. Metric conversions use the published diameter
and initial apparent width and are approximate; they are not independently calibrated metres.
Report weak-signal/merged columns and sensitivity to annotation threshold.

## Matched resource comparison

All local comparison arms use the same initial budgets, fixed absolute reserves, resource
consumption, terrain, speed, candidate trajectories, execution period (2 s), horizon (30 s),
return-time function and resource admission/return urgency policy. Static uses no future dust
motion; Dynamic uses nominal predicted motion; MARS SHIFT adds uncertainty and ground risk.
The candidate paths are built with the existing terrain A*. Same resource constraints apply
even when a path begins inside dust. Any infeasible-budget failure is counted, not dropped.
Keep the old implementations and their results available as legacy artifacts.

Common budget admission must account for every executed point, continuous-grid connectors,
the time spent returning and fixed original reserves. Already depleted cases must be labeled
and handled by the same fallback for every arm. No result can be attributed solely to
uncertainty unless tracking and resource controllers are held constant.

## Navigation split and metrics

Use measured Bickel diameter/speed pairs from observations before 2022 for development;
2022 onward for held-out scenarios. Use new seeds 8101–8124 for development and
9101–9190 for final testing across all three Jezero patches. Do not resize a large regional
storm into a small vortex. Preserve the measured distribution, include 10–280 m controlled
size strata and larger-vortex stress cases, with walker speeds 0.4/0.6/0.9 m/s.
Relocating observed motion to an astronaut and interpolating between frames are simulation
assumptions. Include initially-inside, crossing, near miss, delayed detection, radius growth,
sensor gap and low-reserve conditions. Include the two held-out NASA event motion shapes.

Freeze estimator and navigation weights before final evaluation. Report all per-event data,
exposure seconds and penetration, first exit time, re-entry, HOLD, terrain violations,
return-budget failures, route length and p95 recalculation time. Use paired seed-cluster
bootstrap intervals. Separate results by diameter, event shape and initially-inside cases.
Targets: lower exposure than both matched Static and Dynamic; no more return failures than
either; zero terrain violations. Report a failed target unchanged. No operational safety claim.

## XR acceptance

Default to a nearby 10–280 m dust devil; display observed/derived/simulated provenance,
estimated diameter, motion, time to contact, and the chosen route. The XR and map must share
one decision frame. Already-inside routes stay visible with an exposure-reduction warning.
Keep historical regional storm material separate from the local escape demonstration.
