# Exposure-first navigation: prospective validation protocol

Frozen before v2 experiments, 2026-11-15 Asia/Seoul. The old 101–132 seeds are
diagnostic development evidence, never a new test set. Preserve v1 artifacts.

Objective: less time inside a moving dust footprint, fewer unnecessary waits,
and greater static return feasibility. No suit or headset safety endpoint.

Development: seeds 2001–2024, all three registered Jezero terrains. Add acceleration,
oblique motion, initial overlap, delayed/noisy sensing and large gust-front stress cases.
Allowed tuning: prediction process noise, exposure weight, ground penalty and horizon.
Log all development configurations. Select one configuration before opening new tests.

New test: seeds 4001–4048, same three terrains, four arms (static A*, legacy Dynamic,
legacy integrated v1, revised integrated v2). New independent start/target/base locations,
headings, encounter times, walking speeds and sensor noise. Include two families
absent in development: speed reversal and alternating-turn drift. No test-driven tuning;
if a bug invalidates a run, disclose it and rerun every arm. Retain all failures.

60-second episodes, measurements every 2 s, evaluation at 0.25 s. Report paired
exposure differences and seed-cluster bootstrap intervals, HOLD and unnecessary HOLD,
return feasibility and reserve violations, ground/terrain constraints, progress,
distance, per-family results, worst decile, and p95/max planning latency.
Desired gate: >=40% less exposure than static, lower exposure than Dynamic,
less unnecessary HOLD than v1, no terrain violations, improved return feasibility.
These are targets, not pre-announced results. Failed gates must remain visible.

Separately backtest actual MDAD storm centroids/areas with rolling-origin prediction:
train MY24–29, validate MY30, test MY31–32. Keep all instances from the same year/member
together; exclude merge/split IDs and missing/low-confidence observations with counts.
Do not compress kilometre/sol storm records into metre/second EVA hazards. Compare
persistence and damped advection/growth, report physical errors and footprint overlap.
The broad-storm module is strategic warning, not a promise that walking can outrun it.

References: de Groot et al. 2021 scenario-based MPC (arXiv:2103.12517), Mustafa et al.
2023 risk assessment (arXiv:2302.10846), Battalio & Wang MDAD. This implementation is
inspired by their risk/receding-horizon approach; it does not inherit their guarantees.
