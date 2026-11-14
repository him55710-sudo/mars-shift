# Mars Atlas

Current upgrade: [Unified 3D EVA implementation and validation](EVA_EXPLORER.md) supersedes historical route, UI-language, path and test-count descriptions below. The default page now opens the unified explorer.

`/terrain` is the global explorer; `/terrain/analysis` retains the quantitative Jezero Terrain Lab. The application reuses the same global services as Caltech's [published CTX SceneView](https://murray-lab.caltech.edu/CTX/V01/SceneView/MurrayLabCTXmosaic.html), using ArcGIS Maps SDK for JavaScript 4.34, without an API key. It does not use an Earth globe or pretend Earth Web Mercator is Mars.

## Explore and inspect

Scroll or pinch to zoom; left-drag to pan; right-drag to tilt and rotate. Visible zoom, north, top-down and whole-planet controls provide alternatives. Enter latitude and east-positive longitude, or choose one of eight landmarks. Input accepts −180…360° longitude and −90…90° latitude, normalizing longitude to −180…180°.

Clicking the surface selects a Mars location. **Nearby view** moves to an oblique view around that point. **My position** saves that selected coordinate locally and displays a physical 1/5/25 km radius. This is user-designated Mars location, not GPS, telemetry or tracking. Distances and offsets use the Mars 2000 sphere radius 3,396,190 m. The nearby list ranks the supplied landmark and panorama catalogue by spherical distance; it is not a complete feature inventory.

The inspector queries actual global elevation at nine points, with 1 km geodesic cardinal spacing around the selection. Centre elevation and maximum-minus-minimum of valid samples are shown. This 2 km cardinal-span sample grid is a coarse neighbourhood summary, not a comprehensive maximum relief, local obstacle classifier, surface slope or safety estimate. Explicit NoData values and nonfinite results remain missing. Stale query results cannot replace a newer selected point.

JSON exports retain selected/saved positions, radius, actual sample values, source services, Mars CRS and display state. Camera height is labelled relative to the reference surface, not as a precise height above the selected ground.

## Reused observations

| Layer | Source | Actual spatial detail |
|---|---|---|
| CTX image mosaic | [Caltech Murray Lab / NASA / JPL / MSSS / Esri](https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer?f=pjson) | Approximately 5 m imagery; nearly global, with gaps and uncontrolled registration |
| Viking colour | [NASA / USGS / Esri MDIM](https://astro.arcgis.com/arcgis/rest/services/OnMars/MDIM/MapServer?f=pjson) | Approximately 231 m imagery, global context |
| Global 3D | [MOLA/HRSC 200 m DEM](https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer?f=pjson) | Original product 200 m; server sampling grid can differ; vertical exaggeration ×1 |
| Sparse HiRISE | [NASA / JPL / University of Arizona / USGS / Esri](https://astro.arcgis.com/arcgis/rest/services/OnMars/HiRISE/MapServer?f=pjson) | Original imagery 0.25–1 m, observed areas only; service includes historical coverage and variable registration |
| Jezero orthomosaic | [NASA Trek WMTS capabilities](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml) | Original 25 cm; bounded to 77.2229331…77.583964° E, 18.3067994…18.669315° N |
| Local Terrain Lab | Included Caltech DEM and optical crop | Separate 1 km Jezero ROI centred on 77.640° E, 18.450° N; native DEM 1 m, numerical grid 5 m |

The NASA WMTS uses two geographic root columns and one root row with the same physical footprints as the ArcGIS Mars scheme. A small TileLayer adapter resizes NASA's 256 px image into a 512 px display canvas for compatibility, without changing its geographic footprint. This is display resampling, not a resolution increase. Outside that orthomosaic footprint, transparent tiles preserve the underlying CTX/HiRISE mosaic. Sparse service tile misses also fall back to the lower layer. All global services require internet access and can be delayed or unavailable independently.

High-resolution imagery does not make the 200 m global DEM equally detailed. Zoom can enlarge display pixels indefinitely; there is no claim of centimetre-scale terrain geometry over the entire planet. Fine 3D requires local stereo DEM coverage. The existing local analysis remains available for actual higher-resolution numerical terrain measurements.

## Actual ground panoramas

**Surface 360°** displays five real Mastcam-Z observation locations: Butler Landing, Bunsen Peak, Crocodile Bridge, Vingeanne and Marble Mountain. These are fixed camera observations in Jezero, not a generated view from an arbitrary selected point. The [Mastcam-Z team introduces the original FU Berlin experience](https://mastcamz.asu.edu/take-a-virtual-hike-in-jezero-with-mastcam-z/) and maintains the [panorama collection](https://mastcamz.asu.edu/mastcam-zs-360-panorama-collection/).

The app reuses the published left-eye enhanced-colour image tiles from the [FU Berlin tour manifest](https://maps.planet.fu-berlin.de/vtour/tour.xml). They are assembled exactly into six faces at 1,792–2,304 px per face and encoded to WebP quality 92, without inpainting, invented geometry or AI imagery. The native Three.js cubemap viewer provides scroll/pinch/FOV-button zoom and drag/arrow-key rotation; it does not allow fictitious walking between photographs. Source frame IDs, coordinates, original tile URLs, level dimensions, file sizes, SHA256 hashes and credits are retained in `/data/panoramas/catalog.json`. Source images may include original stitch seams or incomplete sky/rover coverage. The original ultra-high-resolution viewer remains linked for larger source levels.

Hosting these derived display assets locally avoids browser CORS restrictions on source JPEG files and the original map viewer's unrelated remote rover-track dependencies. Credit: NASA/JPL-Caltech/ASU/MSSS; panorama tiling and public viewer by Freie Universität Berlin. Source terms and credits remain applicable; no endorsement is implied.

## Validation

`pnpm test` includes Mars sphere distances, dateline/pole offsets, radius circles, coordinate validation, sparse elevation handling, footprint bounds and existing local/crew routing cases. `pnpm build` runs strict TypeScript and a production build.

`scripts/atlas-browser-qa.cjs` checks live CTX/DEM/NASA tile responses, actual elevation samples, wheel zoom, coordinate entry and errors, saved Mars position, radius/JSON export, layer controls, source/help UI, local analysis navigation and responsive widths 1536/1024/768/390. `QA_PANORAMA=1` also checks all five local panorama loads, FOV zoom and keyboard rotation. Evidence is under ignored `.local/atlas-qa/`. External sparse tiles can legitimately return 404/CORS errors; the base layer remains available. The panorama path uses local assets and does not depend on those services.

The global engine and tiles are online. The existing verified offline cache covers the application code and local Terrain Lab assets; panorama images are loaded on demand and are not included in the offline-ready claim.
