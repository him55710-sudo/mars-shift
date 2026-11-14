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
