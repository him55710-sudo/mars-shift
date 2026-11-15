# v14 — display continuity and observed sand screening

This branch extends v13 (`521ba53`) without replacing its experiment records or dust-devil engines. The app adds a bounded display-only photo backing to the existing helmet scene and a separate registered NOAH-H sand-screening session.

## Open locally

- Photo helmet / existing dust-devil rehearsal: `http://127.0.0.1:5208/hazards`
- Sand candidate HUD / map / round-trip routing: `http://127.0.0.1:5208/hazards?ground=sand`
- Full scientific report: `http://127.0.0.1:5208/data/hazards/sand-v14/report.md`

The preview uses `dist`. Restart with `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5208 --strictPort`. Development uses port 5207. The local dependency directory is shared with the prior Navcam checkout; install package-lock.json dependencies if using a new machine.

## Try it

Photo helmet: advance the existing rehearsal to T+24 s, then compare Layers → Show original stereo gaps / Enable continuous photo context. Missing depth remains excluded from walking. Some distant/unsupported gaps intentionally remain.

Sand mode: select 분석·조건 → 다음 위험 후보 근처까지 경로 재생 to advance along the computed path near a candidate. The HUD warns of the side and distance to the buffered footprint. 위험 지도 shows the same exclusions and both route legs. Click a map destination to replan. Change the buffer, route objective or mission time budget; 20 min at the default target withholds movement guidance. 복귀 plans to the original base; 임무 초기화 resets the simulated mission.

The Sol 477 photo mesh and the orbital NOAH-H crop are different coordinate frames and sites. They are linked modes, not one geographically registered scene. Sand screening is derived from published ripple texture classes, not measured soil strength. The frame is marked as a simulated astronaut pose. No metrical localization or real-world safety certification is implied.

## Recorded verification, 2026-11-15

- Vitest: **41 files, 320 tests passed** (15 added).
- Python display support: **3 tests passed**.
- TypeScript project build: passed.
- Vite production build and calibrated Navcam packaging: passed.
- Frozen evaluation: **15 input hashes and all 130 case/arm deterministic outcomes reproduced** in a separate temporary directory. Original results untouched; CPU timing is machine dependent.
- Served production GLB, protocol, result and report match source bytes.
- Browser: original/photo-context toggle, unchanged T+24 s rehearsal, candidate proximity after route playback, map and comparison path, insufficient-time HOLD, desktop and 390×844 / 390×688 layout. No console errors observed in the checked flows.

Logs and screenshots are in the sibling `research` directory: `sand-v14-tests.log`, `sand-v14-build.log`, `sand-v14-evaluation.log`, `sand-v14-original-gaps.jpg`, `sand-v14-photo-helmet.jpg`, `sand-v14-sand-map.jpg`, `sand-v14-sand-helmet.jpg`, `sand-v14-mobile.jpg`.

## Results and limitations

26 predefined scenario conditions × 5 arms use existing mapped data; there are **zero independent trapping labels**. This is a computational route backtest over observed terrain classification, not a field validation of trapping detection.

Default round trip: 1,751.41 → 1,874.37 m (+7.02%), 28 → 0 buffered candidate cells. On the 12 matched feasible cases, summed candidate-buffer crossings are 185 → 0, with mean distance +20.50 m (+2.45% per case). This verifies exclusion enforcement. All-case feasibility declines: 18/26 unscreened, 14/26 coverage-only, 12/26 with 5 m buffer. The full report retains failed cases and their causes.

Read `public/data/hazards/sand-v14/report.md` for scientific references, exact definitions, all-case table and reproducibility commands. Existing native photo rendering and scientific dataset attribution are retained. The fixed v14 protocol and results must not be overwritten when extending the model.

Final interaction review also corrected depleted-resource replanning: the original absolute departure reserves (37.5 oxygen-minutes and 35 battery-minutes) remain reserved. A common, conservative percentage is used because the existing planner accepts one percentage for both resources. Two added regression checks verify total-trip conservation and exhausted-budget HOLD. This UI-session correction does not change the frozen departure-case evaluation inputs or outcomes.

Worker replies carry the exact input key. Guidance, comparison metrics and XR paths are withheld immediately when position, destination or conditions change, including the render before the next effect dispatches a request. This prevents a prior-location path from briefly being shown at a new position.
