# Local dust-devil escape envelope — preregistered 2026-11-15 KST

Question: under what size, translation speed, usable warning, reaction delay and walking
conditions can a person avoid a local translating vortex? No regional storm data or suit damage model.
No tuning of v4 on these tests. The 22 new Jezero events are model-inferred vortex parameters,
not measured astronaut encounters or independent position tracks. They are a selected close-encounter
sample, not the frequency distribution of all Jezero vortices. Preserve v4 artifacts.

1. Acquire Hueso et al. Table S3, Zenodo 7315863; validate published MD5. Keep original
   diameter, drift velocity, closest approach, uncertainties and any invalid values flagged.
   Murdoch et al. sol 215 (25 m, 5.3 m/s) is a separate illustrative reference, not a new independent event.
2. Derive the exact free-plane head-on boundary for a constant-radius circle, straight constant
   translation speed v > walking speed u, instantaneous movement after delay L, known state:
   D_detection > v*L + R*v/u. Equivalently, warning to stationary first contact
   T > L + R/u - R/v. R is a declared exclusion radius, not a damage radius.
   Establish with a reachable-set impossibility bound and a constructive constant-heading solution.
   Verify analytic geometry against exact swept line/circle contact. Include HOLD and retreat.
3. Sweep diameters 5,10,20,25,40,60,100,280 m; translation 1,3,5.3,10,20 m/s;
   walking 0.4,0.6,0.9 m/s; warning 5,10,20,30,60 s; delay 2,6,10 s;
   transverse offsets 0,0.5R,0.9R,1.2R. Radius includes a declared 2 m buffer.
   These are factorial kinematics, not probabilities of real escape. Exact swept contact,
   not sampled hit/miss, evaluates every piecewise-linear segment.
4. New Jezero terrain trials: all 22 Table S3 events × warning 5/20/40 s × three frozen
   v4 arms (198 episodes), central-floor DEM, 0.6 m/s assumed nominal walking, 12 kg modeled load.
   New seeds 12001 onward. Same resources and original reserves; first sensor at t=0, then
   every 2 s, first guidance after three fixes at t=4 plus a 2 s reaction delay (t=6).
   Straight true paths with actual fitted size/speed; varied heading and closest miss distance
   0,0.5R,1.2R. No fitted track curvature is invented. Sensor errors are explicitly assumed.
   Initially-inside cases are an additional diagnostic, not silently combined with pre-contact detection.
5. Report swept exposure, avoidance count, return-budget failures, minimum clearance,
   and missed-threat/false-alarm counts for HOLD forecasts at fixed 5/10/20/30 s horizons.
   A threat is a future crossing of the declared radius by a stationary person, evaluated
   against hidden synthetic truth. Exclude currently-inside and unsupported/stale predictions
   from the binary confusion table; count them separately. Repeated forecasts are correlated.
   These are SIMULATED collision detection rates, never measured Mars collision rates.
6. Separate physically unavoidable, oracle feasible, controller failure and prediction failure.
   Oracle free-plane headings do not account for terrain or resource limits and are only an
   optimistic comparator. No all-path impossibility claim outside the proven head-on case.
7. Produce a reproducible report and scientific figure. Do not promote new weights or declare
   operational validation from a favorable aggregate. Record failures, source biases and horizon limits.
