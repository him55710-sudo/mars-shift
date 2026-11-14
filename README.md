# MARS SHIFT

**Adaptive EVA Navigator — When Mars changes, your map changes.**

A working NASA Space Apps 2026 research prototype for **Interplanetary Survival Guide: Martian Map**. The default crew view guides a simulated EVA through preparation, traverse, science and return. Mission Control compares complete, terrain-based round trips on a real 1 km Jezero region and hands the selected plan to the crew.

## Run

Node 22.18+ and pnpm 11+ are sufficient for the web application. Processed data are included; Python and raw downloads are not required to run the demo.

```sh
pnpm install
pnpm dev
```

Open the printed local URL. `/` is Crew view, `/planning` is Mission Control, `/evidence` is the source register, and `/briefing` is an exactly seven-slide project demonstration, with keyboard arrows and print styles. A validated seven-slide PowerPoint is downloadable at `/downloads/MARS-SHIFT-7-slides.pptx`. The UI is English and responsive. Local exports retain assumptions, events and provenance.

**Mars Atlas:** open `/terrain` or **Mars Atlas** for the Korean global Mars explorer. Reused Caltech/Esri CTX and MOLA/HRSC services stream actual imagery and 3D terrain, with sparse HiRISE and a NASA Trek Jezero 25 cm orthomosaic. Scroll/drag to explore, enter Mars coordinates, save a Mars position and inspect nearby elevation. Five locally hosted real Mastcam-Z 360° panoramas provide a camera-level view at actual observation locations. Global imagery and 3D elevation have different resolutions; source limits are explicit. See [Mars Atlas](docs/MARS_ATLAS.md).

**Terrain Lab:** `/terrain/local`, also linked inside Mars Atlas, retains the Korean quantitative Jezero workspace. Explore the actual DEM as a rotatable 3D mesh, switch optical/elevation/slope/local-relief/thermal layers, blend the optical basemap, adjust vertical exaggeration, add contours and a baseline traverse, inspect cells, draw elevation profiles, and export JSON or CSV. WebGL failure automatically opens the 2D map. See [Terrain Lab](docs/TERRAIN_LAB.md) for measurements, controls, and validation.

Crew view keeps the next checkpoint, current-position return time and projected return reserve visible. HOLD stops progression; an obstacle scenario requires position/buddy checks, an alternative comparison and explicit adoption. An early return requires confirmation and skips remaining science. A saved rehearsal restores on HOLD. Production builds cache the application and six terrain assets for offline use; the interface reports readiness only after the worker verifies the cache. A first successful online load is required. This cache does not include external NASA sites or the PowerPoint download.

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

This is not certified astronaut navigation. Slope/relief are derived measurements; cliff proximity is an uncalibrated heuristic. Habitat, targets, resources, new hazards and visibility are simulated planning inputs. THEMIS values provide regional context and are excluded from physical routing cost. Observation dates and cross-product registration error are unknown. No boulder classifier, imminent-collapse prediction, real-time Mars weather, calibrated wheel slip or suit-performance model is claimed.

Mission-aware routing minimizes a transparent terrain cost and then checks resource feasibility. It is not a globally optimal multi-resource constrained solver; a rejected candidate does not prove all possible routes are infeasible under every alternative cost model.

## Documentation

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
