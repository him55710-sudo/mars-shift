## Sand navigation / 2026-11-15

- Collect registered terrain, optical, texture and thermal-context provenance in a reproducible route audit.
- Add shared buffered sand-candidate exclusions to mission planning, return checks and EVA movement.
- Show candidate map, outbound/return paths, baseline comparison and evidence export in Mission Hub.

# Changelog

## Unified workspace — 2026-11-15

Integrated the latest surface-evidence and recorded-observation histories. Added Mission Hub, a fourteen-view directory, shared grouped navigation in immersive surfaces, query-aware back/forward behavior and error recovery. Unified the operational palette and added a sharp, demand-rendered Mars backdrop. Preserved the introduction at `/about` and restored its hidden content. Scientific inputs and frozen numerical claims retain their provenance.

Validated 252 tests across 31 files, TypeScript, production packaging, desktop/mobile navigation, Navcam rendering, conditional replay stepping and exact planning-to-crew handoff. See [release verification](docs/UNIFIED_WORKSPACE.md).

## 1.1.0 - 2026-11-14

Integrated Crew view, Mission Control and the optional Terrain Lab in one app. Preserved the crew return accounting, exclusion checks, explicit route adoption and restoration on HOLD. Added real-data terrain inspection, physical profiles, CSV/JSON exports and lazy-loaded 2D/3D analysis. Offline caching includes lazy terrain chunks and verifies the current build assets.

Validated 40 application tests and the TypeScript/Vite build. Browser checks cover navigation, retained terrain selections, crew handoff and mobile layout. Actual suited-astronaut usability is not established.
