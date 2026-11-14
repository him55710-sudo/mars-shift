# Hazard evaluation protocol — frozen before first experiment

Client date: 2026-11-15. Research prototype, not human safety validation.

Three arms share actual registered Jezero terrain, identical scenario seeds, sensor readings,
movement model and resource ledger. Baseline uses existing static shortest-distance A*;
Dynamic adds tracked center/radius and time-expanded search; MARS SHIFT additionally uses
position/radius uncertainty, ground screening cost and absolute resource reserves.

Selection seeds 1–16, holdout seeds 101–132, three real regions (floor, ridge, NOAH-H overlap).
Eight equally weighted scenario families: crossing, approaching, harmless passing, curved
motion, radius growth, sensor outage, depleted resources and large vortex. Speeds cycle
0.4/0.6/0.9 m/s as assumptions. Sixty seconds, replanning every two simulated seconds.
Vortex size/advection are sampled from the 22 published Hueso S3 model fits; sensor position
and radius measurements, scenario headings, placement and local wind field are simulated.
All failed searches and unavailable actions remain in the denominator.

Select among fixed process-noise/ground-cost configurations on selection seeds only:
(0.04, 1.0), (0.08, 1.5), (0.15, 2.0). Horizon 30 s, grid 5 m, time quantum 1 s.
Minimize 10 × exposure seconds + 10 × resource violation seconds + 20 × terrain violations
+ 0.2 × distance + 0.2 × unverified-action seconds + 0.1 × unnecessary HOLD seconds
− 0.1 × progress. This objective is an engineering preference, not a harm function.
After selection, freeze configuration before evaluating holdout seeds. No tuning on holdout.

Report paired exposure differences with a scenario-seed bootstrap (2,000 resamples),
absolute exposure, no-action cases, hard constraints, ground index × distance, distance,
moving/HOLD time, final goal progress, static return feasibility and computation latency p50/p95.
Unnecessary HOLD means the counterfactual static route did not intersect hidden truth during
the next 30 seconds, judged only by the evaluator. Also report excess distance per equal
mission progress, rather than equating shorter but incomplete routes with better navigation.
Forecast error and nominal position-envelope coverage are measured separately at 5/10/20/30 s;
these are synthetic track errors, not MEDA trajectory backtest accuracy.

Real-data checks: byte checksums and published catalog checksum; fill/missing value handling;
catalog parameter ranges; terrain registration reuse. No independent observed 2D tracks or
astronaut injury labels are available in the acquired products. Historical meteorological
replay therefore validates ingestion, not real dust-devil prediction skill or injury reduction.

Release gate: tests and build pass, zero configured hard-terrain violations, report both positive
and negative comparisons. A default simulation configuration may be frozen from development
experiments; deployment as an operational astronaut safety system is outside the evidence.
