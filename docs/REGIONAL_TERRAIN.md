# Continuous regional terrain

The Field Navigation view renders the original 1 km analysis surface inside a continuous 24 km regional landscape. A second 4 km context patch improves nearby image and terrain detail. The authoritative local DEM, planning grid, classified cells, obstacles, budgets and route objectives are unchanged.

## Observed sources

- Regional heights: the original [USGS Mars 2020 Science Investigation CTX DEM mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic), 20 m native resolution. The source is not the detrended Caltech derivative. The original GeoTIFF is downloaded with TLS verification, checked against its advertised 90,345,300 byte size, and given a reproducible SHA-256. There is no claim of independent verification against a published checksum.
- Regional imagery: NASA/JPL/MSSS/Caltech Murray Lab/Esri [OnMars CTX tile service](https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer). Each acquired tile retains its address and SHA-256. This is an uncontrolled optical mosaic; a local image registration residual has not been measured.
- Existing high detail: the original Caltech/HiRISE native 1 m DEM and registered local optical image remain in their original coordinate frame.

`scripts/prepare_regional_context.py` reprojects the CTX DEM and image tiles into the existing Mars projection, preserving the analysis bounds exactly. Regional heights use a 256 × 256 grid across 24 km (93.75 m display spacing). Nearby heights use 201 × 201 samples across 4 km (about 19.90 m spacing, derived from the 20 m source). Sampling is not a claim of improved source resolution. The near optical patch applies a documented 1st–99th percentile contrast stretch, without generated texture or sharpening that invents features.

The runtime validates byte lengths, units, CRS, bounds, dimensions and hashes before displaying context. All five context assets are local static files; production does not depend on a live map service. The service worker includes those assets for the existing offline workflow.

## Joining the surfaces

`regionalGeometry` uses the exact same orbital perimeter vertices as `surfaceGeometry`. It adds conforming rings outside that footprint. Heights transition from the native edge to observed CTX terrain across 200 m, entirely as display interpolation. At a native NoData boundary vertex, the observed coarse CTX height is used only for the surrounding display. Local NoData masks and routing constraints are preserved.

The regional mesh has no artificial vertical walls or lowered skirts. A 90 m optical blend inside the native image boundary uses correctly projected context pixels; no clamped or repeated edge texture extends into the surrounding landscape. A separate 160–200 m transition joins the near context patch to the broad context. Small corner marks indicate the analysis footprint without cutting the ground. Perspective and 2D views show the surrounding imagery; context clicks cannot silently become targets outside the supported study area.

Only the regional display is extended. Candidate colors, coverage percentages and optimized paths still apply to the original 1 km analysis footprint. The surrounding DEM is excluded from obstacle screening, resource accounting and the route graph.

## Verification

`src/regional-terrain.test.ts` checks source hashes, registration rejection, exact native boundary heights, upward triangle winding, no regional triangles crossing the local footprint, NoData behavior and immutability of planning/native data. The existing field-navigation real-data tests continue to check every returned route edge and the explicit sand buffer policy.
