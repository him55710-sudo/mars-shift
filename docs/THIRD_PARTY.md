# Third-party credits

- React and React DOM: MIT, https://github.com/facebook/react
- TypeScript: Apache-2.0, https://github.com/microsoft/TypeScript
- Vite and Vitest: MIT, https://github.com/vitejs/vite and https://github.com/vitest-dev/vitest
- Lucide icons: ISC, https://github.com/lucide-icons/lucide
- Three.js and OrbitControls: MIT, https://github.com/mrdoob/three.js. Used to render the local observed DEM in Terrain Lab.
- ArcGIS Maps SDK for JavaScript 4.34: loaded from the official Esri CDN under its applicable terms, https://developers.arcgis.com/javascript/latest/. The global Mars elevation and imagery services retain NASA/USGS/DLR/Caltech/Esri attribution. No SDK or service authentication key is embedded.
- Actual Mastcam-Z panorama display assets: NASA/JPL-Caltech/ASU/MSSS; original tile preparation/viewer by Freie Universität Berlin. Original public sources, exact processing, image metadata and credits are recorded in `public/data/panoramas/catalog.json`. The app uses its own MIT Three.js viewer, not copied proprietary panorama-viewer code. See https://mastcamz.asu.edu/mastcam-zs-360-panorama-collection/ and https://maps.planet.fu-berlin.de/jezero/.
- DM Sans, Space Grotesk and IBM Plex Mono fonts: distributed through Google Fonts under their respective open font licenses. See https://fonts.google.com/specimen/DM+Sans, https://fonts.google.com/specimen/Space+Grotesk and https://fonts.google.com/specimen/IBM+Plex+Mono. System fallbacks remain available.
- NumPy: BSD-3-Clause; SciPy: BSD-3-Clause; Rasterio: BSD-3-Clause; Pillow: HPND; Requests: Apache-2.0; Truststore: MIT. The locked Python environment and source URLs are documented by requirements and preprocessing code.
- CaltechData: Annex & Ehlmann (2024), CC BY 4.0. Retain NASA instrument-team and provider credit; see DATA_SOURCES.md for thermal product terms and uncertainty.

No code was copied from a prior Space Apps winner. Their public project descriptions informed presentation and workflow choices only; the inferences are documented in RESEARCH.md.


## Spatial explorer upgrade

- Apple-inspired web interaction guidance: Emil Kowalski `emilkowalski/skills`, MIT, copied with license to `.agents/skills/apple-design`. This is community material, not an official Apple SDK or endorsement.
- NASA Mars global texture: NASA/JPL/Caltech, Viking observations processed at USGS; metadata and NASA media usage references in `public/media/mars-global-source.json`.
- Actual boulder training/evaluation imagery and expert masks: Mars-Bench mb-boulder_seg v1, DOI10.5281/zenodo.15494673, CC BY4.0. Original image credit NASA/JPL/University of Arizona HiRISE. See OPTICAL_BENCHMARK.md for precise authors, source records, splits and limits.
- scikit-learn HistGradientBoostingClassifier (BSD-3-Clause), trained from real Mars train patches; no terrestrial pretrained detector was repackaged as Mars validation. Model parameters/protocol are public.
- Three.js MIT Line2, LineGeometry and LineMaterial are reused from the installed package; route ribbons remain visualizations of the existing measured graph.

## NOAH-H published texture classification

Wright, Barrett, Fawdon, Favaro, Balme, Woods, Karachalios and Gerdes / The Open University, ESA NOAH. **NOAH-H terrain classifications of Jezero Crater, Mars**, version 2, published 2022-11-18. DOI: https://doi.org/10.21954/ou.rd.17121482.v2. License: **CC BY 4.0**. Original native 0.25 m categorical mosaic, original 14 rank codes/colors and sampling provenance are retained. The application redistributes transformed 5 m cell-area fractions with attribution, describes the reprojection/aggregation, and labels its own risk rules separately. Independent local registration error and observation dates are unknown. No original source code was imported. See `NOAH_H.md` and the source metadata in each `noah-terrain.json`.
