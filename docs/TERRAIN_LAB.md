# 3D Terrain Lab

Open `http://127.0.0.1:5173/terrain` after `pnpm dev`, or choose **3D Terrain** in the app. This workspace uses the existing real Jezero 1,000 × 1,000 m dataset at 77.640° E, 18.450° N. It does not accept arbitrary external rasters or provide a global terrain catalogue.

## Explore

- Drag to orbit, right-drag to pan, and use the wheel or visible buttons to zoom. Reset fits the camera to the viewport; N aligns north toward the top of the view.
- Select optical imagery, elevation, maximum slope, local relief, or thermal inertia. Numeric colors are linearly scaled to each layer's valid minimum and maximum. Layer opacity blends numeric colors over the optical basemap. Lighting conveys terrain shape, so use the legend and numerical inspector for exact values.
- Vertical exaggeration ranges from ×1 to ×15. The default is ×6 because this region's actual elevation range is only 23.06 m. Exaggeration changes rendering only. The rectangular base and surrounding grid are display references, not observed geological strata.
- Add contours at 2, 5, or 10 m intervals, a 50 m reference grid, or the baseline mission-aware outbound route. The route uses the default habitat, target and assumptions; it does not inherit a separately edited Mission Control plan.
- Click a surface cell for values, move selection with arrow keys while the map is focused, or enter integer grid column/row values (0–199). Rows increase southward. Local E/N coordinates are measured from the southwest corner; exported coordinates use the original Mars equirectangular CRS in metres.
- Choose the ruler, then click A and B for a straight terrain section. This section is a measurement, not a computed traversable route. Hover the profile for values; click a chart sample to inspect its cell. CSV provides the underlying values for keyboard and assistive-technology users.
- View settings, selected cell and the latest completed section persist within the browser session when navigating between app views. Blocked storage does not prevent analysis. WebGL initialization failure or context loss switches to the 2D map.

## Measurements

| Field | Definition | Units / resolution |
|---|---|---|
| Elevation | Published DEM, mean per analysis cell | m; 1 m native → 5 m cells |
| Maximum slope | Maximum native slope within each analysis cell | degrees; not slope of the exaggerated mesh |
| Mean slope | Mean native slope within each analysis cell | degrees |
| Local relief | Cell mean of the native 11 × 11 m elevation range | m; not a calibrated roughness or bearing-strength index |
| Thermal inertia | Nearest-neighbour reprojection of THEMIS quantitative product | J m⁻² K⁻¹ s⁻½; native 100 m, repeated on the 5 m grid |
| Area classes | Equal-area cell counts in [0,5), [5,15), [15,25), [25,∞) degrees | m² and % of cells with valid elevation and slope |
| Profile | Nearest-cell samples along A–B at spacing ≤5 m | Horizontal and 3D distances in m; unexaggerated heights |

Statistics include only finite measurements within valid DEM cells. Quantiles use linear interpolation of sorted valid values. The 3D mesh connects cell centres; its outermost vertices are 2.5 m inside the raster extent. Triangles and contours omit missing-data cells. Contours use marching squares; saddle cells produce paired edge intersections, without a claim about subcell topology. Profile gaps remain disconnected: ascent/descent sum valid adjacent samples only, and complete 3D distance is unavailable if any sample is missing. Raster sampling can affect apparent short-scale ascent; it is not native 1 m surveying.

The actual default region has 40,000 valid cells. Elevation spans −2,621.64 to −2,598.58 m. Mean cell-maximum slope is 5.552935°, and its 95th percentile is 11.6105°. The default section is 816.716 m horizontally (nearest-cell elevation samples). These summaries describe the supplied dataset; no AI-generated terrain is used.

## Exports and evidence

**Analysis JSON** includes the full source manifest, original CRS and bounds, layer statistics, slope classes, inspected values, section samples and display settings. **Grid CSV** includes 40,000 cell rows with projected metre coordinates, measurements, explicit unit-bearing headers and validity. **Profile CSV** includes horizontal distance, projected coordinates, actual elevation and cell-maximum slope. Missing numeric values are blank, never zero-filled. CSV files have a UTF-8 BOM for Korean Windows/Excel compatibility; source and resolution metadata are in the accompanying analysis JSON.

The scientific scope remains the existing data source limitations: unknown observation dates and inter-product registration error; coarse THEMIS values provide regional context; slope classes are not geological units or safety certifications. See `DATA_SOURCES.md` and `LIMITATIONS.md`.

## Verification

`pnpm test` runs the original routing/crew tests plus ten analysis tests covering quantiles, missing/non-finite values, exact slope boundaries, projected coordinates, analytic physical distances, profile gaps and zero-length sections, contours on a known ramp, and actual Jezero measurements. `pnpm build` runs strict TypeScript and Vite.

`scripts/terrain-browser-qa.cjs` uses Playwright (local installation or `PLAYWRIGHT_MODULE`) with installed Edge by default (`PLAYWRIGHT_CHANNEL` can override). It checks actual WebGL rendering, five layers, 3D picking, coordinate and keyboard selection, camera controls, overlays, drawn 2D profiles, JSON/CSV download content, app navigation, widths 1536/1024/768/390, page errors and forced WebGL failure. Screenshots and downloaded evidence are saved under ignored `.local/terrain-qa/`.

Production caching includes Terrain Lab's lazy chunks using `dist/.vite/manifest.json`. Offline readiness requires a successful online installation and verified cached core and build assets. Browser verification also covers an offline reload and layer change, then deliberately removes a cached terrain chunk to verify that readiness is withdrawn. Public static asset cache matching ignores response `Vary` headers because module requests and precache requests may have different Origin headers despite identical asset bytes. External source sites are not cached.
