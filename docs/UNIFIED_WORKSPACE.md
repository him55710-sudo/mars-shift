# Unified exploration workspace — 15 November 2026

The default `/` is Mission Hub. Fourteen named views share a single directory and navigation model in `src/workspaces.ts`. Surface Explorer, calibrated Navcam close-up, surface feature separation, the orbital EVA mission, Atlas, planning, destinations, crew rehearsal, weather, terrain analysis, evidence, briefing and the original introduction remain available.

## Integrated histories

The release combines `codex/dem-separation-v25` (`bbb6eb2`) and `codex/observed-replay-v6` / `codex/encounter-envelope-v7` (`21cee87`). The Navcam renderer retains surface-evidence shaders, selected-feature inspection and full-route framing together with the controlled camera and local hazard overlays needed by the recorded-observation rehearsal. Offline core products and the observed worker are retained together under cache version `unified-mission-v31`.

Ancestor checks passed for all eleven local heads: main, dem-separation-v25, encounter-envelope-v7, helmet-navcam-v19, judge-workflow, navcam-detail-v22, observed-replay-v6, rover-surface-v20, spatial-hud-v21, surface-realism-v15 and unified-visor-v26. Earlier commits are preserved by merges. Uncommitted research in the original `mars-shift` checkout was left intact; it is not silently substituted for the frozen published models.

## Navigation and presentation

- Mission Hub presents the primary explore → plan → rehearse workflow and direct links to every supporting view. `/about` preserves the original mission introduction; its previously hidden reveal content is now visible without an animation initializer.
- A grouped **All views** disclosure is shared by the hub, operational headers, destination picker, recorded-surface explorer and the Navcam close-up. Escape closes the menu and returns focus to its summary. Navcam's focus trap includes the menu summary and excludes hidden links.
- Query-aware navigation distinguishes `/explore`, `?surface=mission`, `?surface=navcam` and `?analysis=separation`. Back/forward reads both the pathname and query. An unknown URL shows a recovery screen instead of entering a crew rehearsal.
- Navy surfaces, consistent mint actions, restrained borders, shared type roles and readable navigation unify the surrounding UI. Scientific raster ramps, route colors, source imagery, measured geometry and crew daylight mode keep their existing meanings.
- The hub uses the existing NASA/USGS-derived Mars texture at up to device pixel ratio 2. Its globe renders on texture/size changes; static hub presentation does not continuously redraw the planet. The original introduction keeps its scroll-linked scene. No generated terrain imagery or new UI dependency was introduced.
- Route and model products remain lazy-loaded. The hub does not request orbital terrain, MEDA recordings or calibrated surface meshes before visitors enter the corresponding view.
- Static packaging preserves every runtime product, all surface imagery and native GeoTIFF downloads. Unreferenced raw tuning/episode traces remain in source. The linked v5 failure-timeline download is losslessly gzipped, with a byte-for-byte decompression check. A 255 MiB build budget prevents another rejected upload under the host's 256 MiB limit.

## Validation

- 31 Vitest files, **252 tests passed**, including the five workspace navigation contract tests. These cover every directory URL, terrain aliases, explorer queries, unknown URLs and modified link clicks.
- TypeScript and the Sites production build passed. Calibrated Navcam packaging retained all original research inputs.
- Chrome checks at 1440 × 900 and 390 × 844 confirmed hub layout, full menus, recorded surface, Navcam detail, and operational navigation.
- Mission Control → departure review retained the selected target, mode, 1,793 m round trip, 20 min science and 39% displayed modeled reserve in the tested eastern-ridge baseline.
- Recorded-observation rehearsal loaded the measured recordings and controlled Navcam renderer. A +2 s step advanced time, resources and the displayed plan. No browser console errors were observed during these checked flows.
- Back navigation restored the Navcam query and renderer after visiting planning, crew and weather. Destinations and Terrain Lab opened successfully. The original introduction's hero opacity was verified as 1.

These are desktop-browser and responsive-layout checks, not suited-astronaut usability validation. External Atlas services still require a connection. Offline caching needs a completed first online cache and has its existing explicit readiness checks; a fresh full offline-cache cycle was not part of this interface release's manual checks.

## Scientific provenance

Frozen replay protocols and numerical reports retain their original source hashes and experimental context. Integration edits to renderer presentation and component props are not relabeled as the frozen implementation. The planner, observation processing and recorded experiment results are preserved; no numerical performance improvement is asserted by this interface release. Observed, derived, simulated and unknown classifications remain explicit. This remains a research prototype.
