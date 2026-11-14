# Native-scale HiRISE surface display

The ground explorer has a display-only optical product at approximately the original HiRISE orthomosaic pixel scale. It reuses `cenjez_DRG_0_3m.tif` from [Annex & Ehlmann (2024), Caltech record v2](https://data.caltech.edu/records/stqse-yay61), DOI **10.22002/stqse-yay61**, credited to NASA MRO HiRISE / Caltech under **CC BY 4.0**. It covers the same two real 1 km study footprints and Mars projected coordinate system as the existing DEM and planning grids.

The source raster pixel spacing is **0.29995473187602484 m**. A **3334 × 3334** texture samples each exact 1000 m footprint at **0.29994001199760045 m/pixel**, using bilinear resampling to preserve registration at the crop edges. This is a negligible alignment resample at the native scale, not a claim of finer observations. Rows run north to south. The same 1st–99th percentile grayscale contrast stretch is used, followed by WebP quality 97 encoding. No sharpening, synthesized rock detail, super-resolution or generated geography was applied.

The old `optical.webp` (1 m minimap/legacy crop) and `optical-native.webp` (0.5 m frozen detection/evidence input) remain unchanged. Optical classifier results and scientific analysis are not recomputed from this new display texture. It does not change the **1 m DEM**, **5 m planning grid**, optical object-validation limits or thermal product resolution.

Published display files:

|Region|Texture|Sidecar|
|---|---|---|
|Central floor|`/data/surface-optical.webp`|`/data/surface-optical-meta.json`|
|Eastern ridge|`/data/ridge/surface-optical.webp`|`/data/ridge/surface-optical-meta.json`|

Each sidecar records the exact projected bounds and CRS, native and display resolution, Float32 crop SHA256, exported image SHA256 and byte count, contrast thresholds, every downloaded byte-range SHA256, and transfer validation. The complete 1.64 GB source is **not** downloaded or claimed checksum-verified. The source's published MD5 is retained as identification, while HTTPS certificate checks, HTTP 206 Content-Range, exact byte lengths, per-range hashes and local crop hashes verify the actual bounded acquisition.

Reproduce or verify using the existing project Python environment:

```sh
../.venv/Scripts/python scripts/prepare_surface_optical.py
../.venv/Scripts/python scripts/prepare_surface_optical.py --check
```

The first command caches real Float32 display crops outside the repository in `../data-cache/surface-optical-{floor,ridge}-0_3m.npz`. It uses the existing bounded range bridge without modifying its frozen detector module. The second command performs no network requests and verifies crop hashes, exact footprint alignment, CRS, dimensions, image SHA256 and metadata consistency. Acquisition is bounded to 96 MiB total; both new crops transferred **13,117,472 bytes** including the TIFF header and tile ranges.

At person-height zoom, approximately 0.3 m orbital imagery still cannot show centimetre-scale objects or rock sides that were not observed. Pixel spacing does not establish positional or registration accuracy. Real camera-level rover panoramas are a separate observational product and must not be substituted for the orthomosaic's georeferenced navigation geometry.

For rendering, a 3334² decoded RGBA texture can require about 44.5 MB before mipmaps. Compressed download size is not GPU memory use. The viewer should load this display product only when needed, retain existing fallbacks, and use spatial/geometry level of detail rather than drawing all terrain at the finest density.
