# Final prospective round after v2 diagnosis

2026-11-15. V2 test 4001–4048 is now inspected and remains published without edits.
It showed mean exposure 4.682 s versus static 7.684 s (39.06%, missing the desired
40% target), and residual freezing under sharp motion changes. Do not tune on it.

Changes permitted: corroborated maneuver reacquisition after two consistent fixes;
bounded coasting during a short sensor gap with explicit degraded guidance. Keep
the trajectory objective and ground/resource weights fixed from v2 development.
Development 3001–3024 over the first six novel families, all three terrains. Compare
responsive/coasting settings against the unchanged v2 configuration. Track forecast
errors as well as route metrics. No search over the final test.

Final new test seeds 6001–6070, 10 balanced families over three terrains (210 per arm):
the eight v2 families plus stop/start translation and pulsating radius, neither seen
in development. Four identical-condition arms: static, legacy Dynamic, integrated v1,
revised integrated. Also publish a v2-only diagnostic subset if needed, never replace
the original v2 test. Keep previous metrics, bootstrap by seed, all failures included.

No parameter updates after final results. Report desired-gate failures and families
with regressions explicitly. Select before testing. Runtime changes after testing
may affect presentation only; computational bug fixes require complete reruns.
