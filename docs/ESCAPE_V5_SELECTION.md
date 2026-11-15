# Diagnostic decision, before opening the fixed holdout

The 48-case manifest was frozen first. Original diagnostic and cost-audit results
are retained separately; neither was overwritten. The 36 holdout case scores have
not been read at this decision point.

| Diagnostic arm (12 identical cases) | No contact | Mean contact seconds |
|---|---:|---:|
| Flat, perfect future, immediate | 9 | 2.1572 |
| DEM, perfect future, immediate | 8 | 2.7131 |
| DEM, perfect future, 6 s lag | 7 | 3.2433 |
| DEM, estimates, 6 s lag | 6 | 3.8155 |
| DEM, estimates, 6 s lag, 45 s horizon | 5 | 3.6425 |

The initially suspected mission-progress-vs-contact tradeoff was NOT confirmed:
zero witnesses of a chosen contacting route with an admissible noncontacting
candidate, and zero witnesses exceeding another candidate's contact by 0.5 s.
Do not claim that suspected scoring bug was found or fixed.

Terrain, initial delay and estimated information each worsen contact in these
paired diagnostic aggregates. They are conditional ablations, not additive causal
percentages for all scenarios. Increasing the horizon alone lost one no-contact
case, so it was not selected.

Selected bottleneck: noisy velocity estimates from only three fixes spanning four
seconds. Use the existing causal estimator with five fixes spanning eight seconds
when available. Startup still uses the three available fixes at t=4; first movement
remains eligible at t=6. No retrospective observations or new sensor capability.
Five fixes reduce constant-velocity least-squares velocity variance for equal
independent noise, but may lag a maneuver. Turning cases remain in the holdout.
Radius mode, process noise, horizon, weights and candidate geometry are unchanged.

Separately enforce the fixed contact definition during candidate scoring: replace
the 0.5 s point count by continuous segment contact. Diagnostics isolate this change:
continuous-only mean contact 3.8219 s (6/12 no contact); plus five fixes 3.6714 s
(6/12 no contact). Mean signed minimum clearance improves 0.1870 to 0.8217 m;
worst clearance worsens -16.9019 to -17.1266 m. Return violations remain zero.
This is a modest diagnostic gain, not proof of general superiority.

Add a Dynamic arm with the same five-fix estimator and continuous scoring, so the
integrated model can be compared to a moving-hazard-only model with the same inputs.
This adds one control arm, not new or selected holdout scenarios (36 cases x 6 arms).
Freeze once, run all holdout cases once, report unfavorable subgroups without retuning.
