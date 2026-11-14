# MARS SHIFT

Current release: [destination-first spatial explorer, automatic optical proposals and measured validation](docs/XR_OPTICAL_UPGRADE.md). Open `/` for the new introduction, `/destinations` to choose a science mission, or `/explore` directly.

**Adaptive EVA Navigator — When Mars changes, your map changes.**

A working NASA Space Apps 2026 research prototype for **Interplanetary Survival Guide: Martian Map**. The default 3D EVA Explorer connects native DEM walking, optical evidence, mission alternatives and simulated route revalidation. Two real 1 km Jezero study regions are available. Mission Control shares the same calculated round trips and hands the exact selected paths to the existing crew rehearsal.

## Run

Node 24.x and pnpm 10.18.3 are sufficient for the web application. Processed data are included; Python and raw downloads are not required to run the demo.

```sh
pnpm install
pnpm dev
```

Open the printed local URL. `/` opens the introduction, `/destinations` chooses a mission and `/explore` opens 3D EVA, `/crew` is Crew view, `/planning` is Mission Control, `/evidence` is the source register, and `/briefing` is an exactly seven-slide project demonstration, with keyboard arrows and print styles. A validated seven-slide PowerPoint is downloadable at `/downloads/MARS-SHIFT-7-slides.pptx`. The UI is English and responsive. Local exports retain assumptions, events and provenance.

**Mars Atlas:** open `/terrain` or **Mars Atlas** for the English global Mars explorer. Reused Caltech/Esri CTX and MOLA/HRSC services stream actual imagery and 3D terrain, with sparse HiRISE and a NASA Trek Jezero 25 cm orthomosaic. Scroll/drag to explore, enter Mars coordinates, save a Mars position and inspect nearby elevation. Five locally hosted real Mastcam-Z 360° panoramas provide a camera-level view at actual observation locations. Global imagery and 3D elevation have different resolutions; source limits are explicit. See [Mars Atlas](docs/MARS_ATLAS.md).

**3D EVA Explorer:** the default page and `/terrain/local` alias share one mission with Mission Control. Enter **Walk EVA**, then use WASD/arrows, click for pointer lock or drag to look; touch arrows are available. M opens the minimap, H toggles hazard overlays, L cycles layers, Esc exits. EVA follows the native 1 m DEM with bilinear sampling at ×1 height. The rendered mesh uses 2 m vertices; the planning and collision mask conservatively retain 5 m cells. Select start/target directly on terrain, explicitly calculate, compare three objectives, inspect optical candidates and trigger a simulated exclusion. See [EVA implementation and limits](docs/EVA_EXPLORER.md).

**Terrain analysis:** `/terrain/analysis` retains statistics, profiles, contours, coordinate inspection and CSV/JSON export in English. Its displayed round trip comes from the same shared mission, replacing the independent default route. WebGL failure opens the 2D planning map.

Crew view keeps the next checkpoint, current-position return time and projected return reserve visible. HOLD stops progression; an obstacle scenario requires position/buddy checks, an alternative comparison and explicit adoption. An early return requires confirmation and skips remaining science. A saved rehearsal restores on HOLD. Production builds cache the application and both regions’ terrain, imagery, native DEM and application chunks for offline use; the interface reports readiness only after the worker verifies the cache. A first successful online load is required. This cache does not include external NASA sites or the PowerPoint download.

```sh
pnpm test
pnpm build
node scripts/benchmark.ts
```

On Windows, if pnpm is not on PATH, use the bundled pnpm executable identified by Codex's workspace-dependencies tool. `pnpm-workspace.yaml` permits only the esbuild installation script. No application API keys or paid services are needed.

## Reproduce the real data

The raw cache lives at `../data-cache`, outside the Site checkout. Python 3.12 was used.

```sh
python -m venv ../.venv
../.venv/Scripts/python -m pip install -r requirements.txt
../.venv/Scripts/python scripts/acquire.py
../.venv/Scripts/python scripts/preprocess.py
../.venv/Scripts/python scripts/preprocess.py --test
```

On macOS/Linux replace `Scripts/python` with `bin/python`. Acquisition uses verified HTTPS with the operating system trust store. DEM MD5 is checked against the published Caltech record. The 1.64 GB optical mosaic is read through HTTP ranges; it is not fully downloaded. The local range bridge only serves a fixed public source product on an ephemeral loopback port and shuts down after preprocessing.

ROI: **77.640° E, 18.450° N**, 1,000 × 1,000 m in the source Mars equirectangular projection. Native HiRISE DEM: 1 m; native optical: about 0.3 m; native THEMIS: 100 m. The original DEM and optical CRS match. Thermal data are explicitly reprojected from their source Mars CRS, preserving coarse nearest-neighbor values. No Earth WGS84/Web Mercator assumption is used.

## What works

- Native DEM WASD/touch walking, pointer lock or drag look, synchronized crew minimap and ×1 EVA geometry.
- Shared 2D/3D mission, direct 3D target selection and exact path handoff to Crew view.
- Reproducible manual optical annotations with evidence status, export/import and explicit buffered exclusions.
- Resource-feasible alternative search and frozen-route revalidation with explicit adoption.
- Second 1 km ridge region at 77.731522° E, 18.504395° N: native relief 109.10 m and complete three-product overlap. This does not validate rockfall traces or observed changes.

- Aligned real optical, elevation and thermal layers; native DEM download and source manifest.
- Eight-neighbor A* with slope, NoData and exclusion constraints; no diagonal corner-cutting.
- Shortest, lower-exposure and mission-aware outbound and return legs.
- Distance, elevation gain, slope, modeled travel time, O₂/power reserve and coverage metrics.
- Configurable mission assumptions; infeasible budgets are rejected explicitly.
- A simulated 35 m exclusion invalidates a previous route and triggers alternate round trips.
- Reduced-visibility simulation leads to HOLD/verify, rather than a claim of assured return.
- Crew checkpoints, local-corridor map, early return, science notes, session restoration and offline terrain cache.
- Large field controls, daylight/night display, keyboard dialogs and progressive disclosure of simulation controls.
- Three proposed science targets, custom map target, point inspector, zoom, layer selection, JSON export and seven-slide briefing.

## Actual measured baseline

| Mode | Round trip | Maximum cell slope | Time including 20 min science | Simulated reserve |
|---|---:|---:|---:|---:|
| Shortest | 1,752.9 m | 16.24° | 87.0 min | 37.86% |
| Lower exposure | 1,991.9 m | 5.29° | 88.3 min | 36.85% |
| Mission aware | 1,846.0 m | 11.01° | 85.7 min | 38.86% |

After the simulated exclusion, the mission-aware route is 1,945.2 m; 12 unique cells of the prior route intersect the event footprint. The recomputed routes cross **zero excluded cells**. All baseline routes cross zero cells in the configured cliff-proximity proxy; the terrain tradeoff here is slope and relief, not a measured reduction in rockfall probability. These values are specific to the default ROI and assumptions.

## Existing NASA tools, reused

The five resources in the official challenge's Resources tab are documented in `/evidence`. Mars Trek supplies the existing planetary explorer; Terrain Lab renders a local 1 km DEM mesh for quantitative analysis. USGS geology and the Curiosity route provide contextual references. Worldview supplies an Earth-only layer/time interface reference. Perseverance raw images supply an external surface-context archive; they are not treated as registered observations of this route.

## Scientific boundaries

This is not certified astronaut navigation. Slope/relief are derived measurements; cliff proximity is an uncalibrated heuristic. Habitat, targets, resources, new hazards and visibility are simulated planning inputs. THEMIS values provide regional context and are excluded from physical routing cost. Observation dates and cross-product registration error are unknown. No validated Jezero boulder recognizer, imminent-collapse prediction, real-time Mars weather, calibrated wheel slip or suit-performance model is claimed.

The unified planner evaluates five terrain/effort objective weights per direction, deduplicates paths, filters all distinct outbound × return pairs by hard modeled time, oxygen and power limits, and selects the lowest requested-mode cost among feasible candidates. This bounded alternative method does not claim global constrained optimality. No-feasible-route messages refer to this search and these assumptions.

## Documentation

- [Unified EVA implementation](docs/EVA_EXPLORER.md)
- [Gaussian splatting feasibility](docs/3DGS_FEASIBILITY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [3D Terrain Lab](docs/TERRAIN_LAB.md)
- [Data sources and classification](docs/DATA_SOURCES.md)
- [Methodology and equations](docs/METHODOLOGY.md)
- [Validation](docs/VALIDATION.md)
- [Crew workflow and human-factors rationale](docs/CREW_WORKFLOW.md)
- [Limitations](docs/LIMITATIONS.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)
- [Seven-slide content](docs/DEMO_SLIDES_EN.md)
- [Research and 2025 winner lessons](docs/RESEARCH.md)

## Attribution and AI use

CaltechDATA: Annex & Ehlmann (2024), DOI [10.22002/stqse-yay61](https://doi.org/10.22002/stqse-yay61), CC BY 4.0. NASA MRO HiRISE and Mars Odyssey THEMIS instrument teams; Caltech Murray Lab Mars 2020 Landing Site Working Group. Product-level terms and limitations are retained in the manifest and source documents. No NASA endorsement or NASA logo is used.

Codex assisted with code, preprocessing, tests, documentation and interface copy. Exa assisted source discovery; Consensus assisted literature discovery. No scientific source measurements or Mars imagery were generated by AI. Third-party code and fonts are credited in [THIRD_PARTY.md](docs/THIRD_PARTY.md).
