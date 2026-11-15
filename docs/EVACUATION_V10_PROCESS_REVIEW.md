# v10 renderer and evacuation methodology audit

The complete Korean audit, primary-source links, immutable experiment protocol and results are shipped together:

- [Process review](../public/data/hazards/vortex-v10/process-review.md)
- [Frozen protocol](../public/data/hazards/vortex-v10/protocol.json)
- [Results and per-step logs](../public/data/hazards/vortex-v10/results.json)
- [Matched case table](../public/data/hazards/vortex-v10/paired-cases.csv)

Default `/hazards` now uses the calibrated Navcam renderer and a ground-following route ribbon. `/hazards?lab=v9` retains the frozen orbital DEM comparison interface. `/hazards?archive=1` retains earlier analysis. The native surface materials and calibrated tile pipeline are reused.

The runtime change is restricted to a resource-limited planning horizon shared by all arms. MARS SHIFT planner refusal incidence fell from 18/36 to 4/36; contact, return failures and actual reserve violations were unchanged. This is a planning reliability correction, not improved vortex prediction or newly demonstrated avoidance superiority. The 36 conditions reuse v8 truth families and existing terrain/wind, with new prescribed combinations and seeds. They are not 36 observed Martian events.

Six new unit tests cover boundary-vs-centre timing, an unsafe positive timing margin, HOLD timing, parity while the old horizon is affordable, late-budget recovery and genuinely insufficient resources. Existing experiments are preserved. The default renderer uses the existing CV_SMOOTH route-bank policy plus the shared horizon correction, not the rejected v9 SIPP candidate.

Validation on 2026-11-15: 34 test files / 279 tests passed; TypeScript project check and production build passed. The calibrated Navcam packaging completed without changing source inputs. Mobile testing used a 390 × 844 viewport; route overview framing was adjusted to fit its start, target and current path. The horizon-source and protocol hashes still match the frozen results. Runtime p95 is an engineering timing observation, not a device-level latency guarantee.
