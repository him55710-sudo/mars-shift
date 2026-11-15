# v12 validation record — 2026-11-15

Scope: local, non-operational Sol 215 range/bearing reconstruction and chronological prediction replay. No independent metre-accuracy claim. Parent: v11 `9288b1b6f0da8ddd0bca7dc6327fa27e1294e200`. Existing v11 experiments and high-resolution 3D viewer retained.

## Automated checks

- `node node_modules/vitest/vitest.mjs run`: **36 files / 291 tests passed**. Log: external workspace `research/v12-tests.log`.
- `node node_modules/typescript/bin/tsc -b` + Vite production build + `scripts/package_navcam_assets.mjs`: passed. Logs: `research/v12-build.log`, final packaging `research/v12-final-build.log`.
- `python scripts/acquire_metric_v12.py --verify-only`: 20 raw PDS image/label pairs, paper, supplement archive + three extracts, four registration intermediates, both experimental source hashes verified.
- `node scripts/verify_metric_replay_v12.mjs`: regenerated both `results.json` and `ranged-results.json` in a new temporary directory; all scientific fields identical. Only generation timestamps excluded. Original archives untouched.
- XML exposure clocks checked against all 20 extracted SCLK values by the report generator.

The initial optical-axis unit test had a ~7e-6 component discrepancy due to the rounded published optical-axis vector. The assertion now checks normalized angular agreement within 5e-5 radians; no camera-model output was changed to fit the test. The measurement assumptions were rejected where inappropriate: author scale bars are not ground-contact measurements. This rejected experiment is preserved and clearly separated from the active ranged replay.

## Browser verification

Chrome via the computer-use plugin, production preview at `http://127.0.0.1:5205/hazards?metric=sol215`:

- Native desktop screenshot and 390×844 mobile screenshot captured.
- Previous/next observations update range, original SCLK, speed, bearing, and metric map.
- Four selectable models; LAST2 selection changed 3rd-observation speed from 6.7 to 6.3m/s.
- Playback uses twice the original inter-exposure cadence, reaches observation 4, stops, and disables Next.
- Change emphasis toggles on/off; it uses current/first imagery, with first-frame dust contamination disclosed.
- Evidence dialog displays the complete four-model table, methodological limits, and primary data link. Escape closes the dialog and returns focus.
- Existing Sol 477 3D visor loads; its Evidence panel opens the new Sol 215 replay, and replay links back.
- No console errors captured in the new replay.
- Viewport override reset; final replay tab retained for the user.

During visual QA, global `nav { height:100% }` stretched the controls across the helmet centre. The metric control bar now explicitly sets auto height/width/order; the footer resets inherited page-footer styling. Rebuilt and visually checked both sizes after this fix.

Screenshots retained outside Git:

- `research/v12-metric-helmet.jpg`
- `research/v12-metric-mobile.jpg`

## Result interpretation

Active result: one event, four approximate published range inputs, three overlapping forecast-target pairs. LAST2 position-discrepancy RMSE 6.1943m / range-discrepancy MAE 4.2025m. Weighted-CV 6.3309m / 4.6792m. These are discrepancies to reconstructed / approximate references, not independently measured centre errors. Weighted-CV did not beat LAST2 and was not promoted into the navigation engine.

The UI's 2/5/10-second forecasts lack independent future centre truth. Visible dust width is distinct from dynamic vortex diameter. No actual stereo movie, new independent trajectory dataset, live range sensor, or closed-loop EVA outcome was validated. The adapter refuses retrospective or unvalidated input and mismatched terrain coordinates. The scientific report specifies the still-missing validation steps.

Exa was used; Consensus returned its monthly quota limit. No Consensus literature-review completion is claimed.
