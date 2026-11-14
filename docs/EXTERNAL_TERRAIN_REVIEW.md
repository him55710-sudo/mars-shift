# External terrain and rover-data review

Reviewed 2026-11-14. Exact URLs, local evidence identities, footprints, transfer counts and decisions are recorded in [`public/data/external-terrain-sources.json`](../public/data/external-terrain-sources.json). New reference evidence was acquired; the existing Caltech DEM, imagery, terrain metrics and routing grids were preserved.

## Quantified overlap and registration

|Source|Central floor, 77.64° E|Eastern ridge, 77.7315° E|NOAH region, 77.565° E|Current decision|
|---|---|---|---|---|
|NASA/USGS HiRISE STAC item `DTEEC_023247_1985_022957_1985_U01`|Real 1 km crop acquired; 100% valid reference support|Outside item footprint|All four ROI corners inside item polygon; raster not sampled|Reference only; registration discrepancy measured|
|USGS MSR TRN v003 DTM/ortho/confidence mosaic|Outside footprint|Outside footprint|Outside footprint|Do not paint this confidence map onto these regions|
|PDS Perseverance mesh and PLACES localization|Closest recorded localization 9,444 m from ROI bounds|14,738 m|5,226 m|No unregistered near-field mesh inserted|

The NOAH projected bounds used here are `[4360409.037914526,1093711.6170900527,4361409.037914526,1094711.6170900527]` in the existing Mars study projection. STAC polygon containment is a footprint check, not an assertion that every NOAH pixel has valid source support. Rover distances use the archived `best_tactical.csv` localization points, not exhaustive mesh footprints. The 666 available records cover sols −1 through 1896; these are not a claim about later unreviewed rover positions.

## NASA/USGS AWS HiRISE COGs

The [AWS registry](https://registry.opendata.aws/nasa-usgs-mars-hirise-dtms/) and [USGS documentation](https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/) identify CC0, MOLA-controlled products with aeroid-relative elevation. The live collection is [`mro_hirise_socet_dtms`](https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms); the documentation's `mro_hirise_controlled_socet_dtms` API link currently returns 404. The queried Jezero item supplies DTM, orthoimages, hillshade, FOM and processing provenance. Its delivered DTM posting is approximately 1.015 m in an equidistant cylindrical Mars sphere projection (radius 3,396,190 m, true-scale latitude 0°). Posting is not a guarantee of feature resolution or accuracy.

`scripts/review_external_terrain.py` reads only needed byte ranges through the project's verified HTTPS bridge. It checks 206 status, byte counts and Content-Range, caps each asset at 32 MiB, and records range SHA256 receipts. The floor DTM and FOM required **7,231,975 bytes total**, rather than downloading both approximately 250 MB source rasters. The resulting two-band reference GeoTIFF is 200 × 200 at the existing 5 m grid, with the original Mars CRS/bounds recorded. No Earth WGS84 transformation was used. Full upstream-file checksums were not verified; that limit is explicit.

For all **40,000 floor cells**, USGS DTM minus the current Caltech 5 m elevation gives:

|Statistic|Metres|
|---|---:|
|Median|−10.264|
|Mean|−10.299|
|5th / 95th percentiles|−13.953 / −6.854|
|RMSE|10.520|

This measures disagreement after coordinate reprojection. It does **not** establish which product is more accurate, diagnose a unique datum error, or validate horizontal alignment. No offset correction, silent substitution or terrain blend was applied. A registration audit against controlled common features is required first.

The downloaded USGS processing provenance uses **cubic** resampling for its FOM COG. The sampled raw values span 1–255 and must not be interpreted with the separate MSR simplified-confidence legend, or as safety probabilities. The STAC item's date is also inconsistent: it reports 2006-09-29, whereas the official [ESP_023247_1985](https://www.uahirise.org/ESP_023247_1985) and [ESP_022957_1985](https://www.uahirise.org/ESP_022957_1985) pages give **2011-07-12** and **2011-06-20**. The official observation dates are retained in the source registry.

## USGS MSR TRN v003

The [official MSR record](https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic), DOI [10.5066/P13CPYYU](https://doi.org/10.5066/P13CPYYU), was reachable with ordinary verified Requests although the web reader returned 403. Its v003 README and XML identify jointly adjusted strips, CTX control, edited elevation and an affine correction. The package distinguishes geoid-relative elevation from radius-relative products; these references must not be interchanged.

The published mosaic bounds are **77.0578–77.3808° E, 18.1357–18.5881° N**. The three study regions lie farther east. The 5,468,062,403-byte ZIP was inspected with bounded byte ranges. The README was downloaded directly; XML metadata, confidence legend and class table were extracted from the ZIP with CRC checks. Local SHA256 identities were recorded for each. The DTM XML states CC0 1.0. Its confidence member is about 65.3 MB compressed; it and the full archive were not downloaded because there is no relevant overlap. No whole-archive hash is asserted.

Its categorical confidence describes stereo-processing provenance: NoData, saturation, suspicious matching, interpolation, correlation classes and manual interpolation. It does not measure bearing strength, unresolved rocks, or calibrated astronaut risk. A new study region within the actual mosaic could reuse this product after DEM/ortho/confidence registration is checked.

## PDS near-field terrain meshes

The [NASA PDS Navcam bundle](https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn:nasa:pds:mars2020_navcam_ops_mesh&version=13.0), DOI [10.17189/6q2j-q039](https://doi.org/10.17189/6q2j-q039), is authentic derived rover mesh data. NASA's [Landform input guide](https://github.com/NASA-AMMOS/Landform/wiki/Links-to-Publicly-Available-Input-Data) links the public [Navcam archive](https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_navcam_ops_mesh/) and [Mastcam-Z mesh archive](https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_mastcamz_ops_mesh). The archive root and collection directory were reachable, but the sol listing timed out both in the web reader and a 30-second Requests attempt. The older archive-explorer URL redirects to an Atlas shell. No mesh or texture bytes were imported into the app.

The [PLACES data](https://pds-geosciences.wustl.edu/missions/mars2020/places.htm), its actual `best_tactical.csv` and PDS XML label were acquired and hashed. Recorded longitude spans **77.21790–77.46313° E**. The point-to-ROI distances above were computed in the existing Mars sphere projection. These observations are kilometres from all three current regions. A mesh needs its product site/drive frame, camera model/extrinsics, source textures and matching localization; an OBJ alone is insufficient. Landform's guide uses `best_interp` for contextual/orbital registration. A future recorded-site experience can use correctly located rover data; none was placed at an unrelated destination.

## Landform reuse assessment

Official repository: [NASA-AMMOS/Landform](https://github.com/NASA-AMMOS/Landform). Its [README](https://github.com/NASA-AMMOS/Landform/blob/main/README.md) describes a C# offline terrain-processing pipeline and notes that several workflows still depend on mission services, with public-PDS substitution requiring development. It links authentic public contextual/wedge examples through `NASA-AMMOS/3DTilesRendererJS`; their actual sites must remain identifiable.

The [license file](https://github.com/NASA-AMMOS/Landform/blob/main/LICENSE.txt) is **not MIT**. The README declares GPL v3 through Emgu.CV, while the file additionally includes a Caltech 2025 commercial-use negotiation notice and export-compliance language; GitHub reports SPDX `NOASSERTION`. This is a factual source review, not a legal determination of those combined terms. No Landform code, binaries or dependencies were imported. Retain it as a method/reference and evaluate any future offline tool adoption separately from the browser runtime.

## Reproduction and checks

```powershell
..\.venv\Scripts\python scripts/review_external_terrain.py
```

The acquired reference TIFF's dimensions, two bands, exact current-grid bounds, Mars CRS, finite values and SHA256 were checked. STAC footprint tests distinguish floor/NOAH from ridge; MSR's geographic bounds exclude all three. Local metadata, raw table/labels, archive central-directory receipts, source-license text and the comparison receipt are retained in `../data-cache/external-terrain/`. Neither candidate quality data nor these external elevation values are currently authoritative planner inputs.
