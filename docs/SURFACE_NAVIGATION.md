# Surface navigation checkpoint — v16

This extends the existing observed-terrain explorer; it does not replace the frozen scientific or optical validation products. Follow/helmet camera preference and the NASA EMU asset from v15 are preserved.

## Implemented

- A separate **Energy saver** objective minimizes an explicit effort-distance proxy. Each edge uses 3D length × (1 + 0.015 × payload kg + 6 × uphill grade² + 2 × downhill grade² + 0.8 × complexity). Complexity is native-derived TRI for the expanded mobility model and existing relief for the legacy model. Units are **effort-metres**, not measured calories, joules, oxygen consumption or battery Wh. Weights are assumptions, not fitted Mars physiology.
- Five objective weights per leg retain distinct alternatives and filter complete round trips against time, O₂ and power reserves. Per-calculation allowed-cell and directed edge caches are reused across weighted searches; changed assumptions receive new caches. No global constrained optimality claim is introduced.
- **Emergency return** starts at the current continuous simulated crew position. It checks at most four enclosing graph-centre connectors against native DEM, hard obstacles, NoData and slope constraints. Directed reverse Dijkstra supplies minimum graph return time. The selected checked connector plus graph route skips the science destination and uses spent resources plus original-capacity reserve requirements. It is not an optimum over continuous terrain.
- Every accepted movement batch retains all turns. Travel and waypoint previews sample native height at intervals no larger than 0.5 m. Unsupported, blocked, out-of-sequence or over-budget batches are rejected. Movement is held while return computation/review is pending. Browser wall-clock inactivity does not consume resources; **Add 5 min of work** explicitly adds modeled work consumption.
- The HUD now shows current modeled O₂/power, return reserve, base bearing, return ETA and navigation status. The shared return candidate appears in the surface ribbon, minimap and expanded 2D/3D map. A fractional origin connector is rendered, and the 5 m elevation profile remains explicitly a graph profile.
- `PositionSensor`, simulated fixes and `SafetyState` separate position confidence from rendering. Valid/degraded/lost states are available. Degraded/lost stops movement, removes ground-anchored routes/hazards and withholds the directional waypoint and return estimate. The configurable-in-code 2.5 m threshold is a declared rehearsal policy, not measured localization accuracy.
- Worker responses are revision/position checked; changed constraints, localization or work invalidate adoption. Session position/resource use survives reload, but a saved return request must be recomputed. Reset is explicit.
- Offline caching includes the separate return worker. No extra cloud model, paid service or runtime dependency was added.

## Reproducible actual-data results

Run `node scripts/run_navigation_analysis.mjs`. The separate `public/data/navigation-results.json` records raw source hashes, normalized engine-source hashes, assumptions and results for all three existing study regions. It does not modify `science-results.json`.

For the emergency case, traverse half of the mission-balanced outbound route plus 35% of the next edge, add five modeled work minutes, then return directly. The exhausted-O₂ case produces no verified route in every region.

| Region | Shortest round trip m | Energy round trip m | Effort proxy shortest → energy | Direct return m | Return min | Remaining reserve |
|---|---:|---:|---:|---:|---:|---:|
| floor | 1752.86 | 1752.93 | 2275.58 → 2268.77 | 471.25 | 17.30 | 70.64% |
| ridge | 1752.74 | 1764.48 | 2295.89 → 2264.48 | 435.00 | 15.93 | 72.64% |
| noah | 1751.41 | 1751.48 | 2177.57 → 2164.36 | 443.87 | 15.22 | 73.72% |

The energy improvement is small, especially in the NOAH overlap region. It is a model comparison, not a demonstrated physical energy saving. The real-data run measured about 433–807 ms for all five mission objectives and 159–271 ms for a current-position return on this local Node environment. These single-run wall times exclude worker serialization/network and do not establish browser FPS or cross-device performance.

## Verification and remaining limits

Automated coverage includes directional effort, rough-corridor detours, hard barriers, current-position connectors, original-capacity reserves, malformed usage, native relief within preview edges, localization suppression, stale/duplicate worker replies, explicit adoption and changed work/constraints. Browser verification exercises a charged 28 m waypoint, direct return, adoption, degraded positioning and recovery. Full test/build and release evidence is recorded separately.

The optical tiles are approximately 0.30 m per pixel. At eye height their magnification remains visibly soft; no invented rocks or artificial terrain detail was added. The separate observed rover road-view remains camera imagery at its actual recorded station. Native 1 m DEM interpolation and a 5 m planning graph do not resolve small obstacles. No independently measured registration residual, calibrated mobility/consumption model, astronaut safety validation or foreground GPU/FPS guarantee is available.

The original broader directive still requires a registered geology layer, a hidden-truth/observed-event weather and ground-hazard simulator, experimental WebXR device integration and a complete foreground performance audit. The surface localization threshold is not yet user adjustable. These are not completed by this checkpoint.
