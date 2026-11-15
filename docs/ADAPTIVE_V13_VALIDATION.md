# Adaptive v13 implementation and validation

2026-11-15. Parent: `690b8e7` (v12). Worktree: `mars-shift-adaptive-v13`, branch `codex/adaptive-v13`. Earlier worktrees, protocols, failed results and imagery are retained.

## Run and inspect

- Local rehearsal: http://127.0.0.1:5206/hazards
- Recorded Sol 215 reconstruction: http://127.0.0.1:5206/hazards?metric=sol215
- Scientific report: [report.md](../public/data/hazards/adaptive-v13/report.md)
- Frozen results: `public/data/hazards/adaptive-v13/`
- Data origins and camera geometry remain in `public/data/hazards/metric-v12/`.

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
node scripts/package_navcam_assets.mjs
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5206 --strictPort
```

The existing NASA/Navcam asset setup must be available; packaging is required after every build. `node_modules` in this worktree uses the existing v22 dependency junction.

## Implementation boundaries

- `adaptive-tracker-v13.ts`: full 4D covariance IMM, correlated range/bearing measurement noise, Joseph update, bounded residual influence, explicit common error, causal incremental updates.
- `adaptive-escape-v13.ts`: synthetic local sensor adapter; no Sol 215 coordinates are injected into Sol 477 terrain.
- `evacuation-runtime-v13.ts`: copy of the frozen route policy with a predictor injection; terrain, resources, delay and continuous contact checks retained.
- `guarded-escape-v13.ts`: compares candidate and incumbent under both forecasts, with nominal and expanded radii. Uses the candidate only if none of four predicted contact measures worsens and at least one improves. This is not a guarantee against unknown future motion.
- `evacuation-worker-v13.ts`: worker owns simulation and selected prediction; helmet, map and XR frame receive consistent data. Existing worker remains unchanged.
- `MetricVortexReplay.tsx` and `MetricForecastEvidence.tsx`: past-only recorded replay, projected uncertainty, comparative results and limitations. Existing high-resolution terrain renderer remains unchanged.
- `runtime-release.json` enables Guarded only as a research rehearsal. Original policies remain selectable.

## Recorded outcomes

| Evaluation | Result | Interpretation |
|---|---|---|
| 96 synthetic development / 192 frozen confirmation trajectories | Existing IMM 31.79 m → new 27.05 m pooled position RMSE | 14.9% lower; 47/192 cases worse |
| Nominal 95% forecast ellipse | 91.8% confirmation containment; hairpin 77.2% | Coverage target failed |
| One observed Sol 215 reconstruction, three overlapping forecast pairs | Position discrepancy 3.04 m; approximate range discrepancy 0.86 m | Not independent 1 m tracking accuracy |
| First 24 new escape placements | Direct replacement 2.511 s vs legacy 2.487 s mean contact | Rejected, retained as failed result |
| Follow-up 36 new placements | Guarded 2.480 s; legacy 2.482 s; static 2.761 s | Guard vs legacy improves one case, 35 unchanged; tiny 0.064% gain |
| Follow-up return failures / no-contact | All arms 0 failures / 27 of 36 no contact | No additional improvement claimed |
| Update plus three predictions, same PC | IMM full history p95 1.099 ms → incremental 0.071 ms | Isolated tracker CPU timing; not end-to-end |
| Guarded route computation | p95 19.56 ms vs legacy 4.00 ms | Additional comparison costs time |

New independent observed trajectories: **0**. New scenario counts refer to synthetic combinations on reused terrain and motion equations. Visible dust width is not validated dynamical vortex diameter. The same-candidate Oracle is not a global optimum.

## Verification record

- 38 test files / **305 tests passed**. Includes analytic filter/covariance checks, causal history, stale/duplicate packets, rotations, missing observations, common error, legacy policy parity, guard dominance and resource/reaction constraints.
- TypeScript and production build passed; original Navcam assets packaged.
- Chrome desktop and 390×844 recorded HUD checked; modal keyboard focus and Escape verified.
- High-resolution 3D rehearsal stepped to 24 s, frame 12: 6.2 s predicted contact, 1.8 s boundary arrival and 288 s return margin remained consistent across helmet/map views. No observed console errors.
- Read-only replay command below reproduced development, model selection, confirmation and observed results exactly after excluding timestamps and CPU timings. Original files stayed unchanged. Receipt: `reproduction.json` in the result folder.

```powershell
node scripts/verify_adaptive_v13.mjs
& '../research/.venv-hazards/Scripts/python.exe' -X utf8 scripts/report_adaptive_v13.py
```

The verifier creates a fresh temporary folder, checks frozen source hashes, independently reproduces the selected configuration, then reuses the original selection timestamp bytes to preserve downstream provenance hashes. It does not rerun escape cases or assert reproducible wall-clock timings. Result-generation commands refuse overwrite. The report generator can regenerate derived summary/plot files.

Protocol-referenced sources have byte-preserving `.gitattributes`. Do not change those files and regenerate the same experiment in place. A future algorithm change needs a new version/protocol, a new held-out scenario set, and explicit evidence for promotion.

The next evidence gap is independently ranged high-frequency centre and boundary tracks, especially abrupt turns. Neither the current data nor these synthetic results establish operational navigation suitability.
