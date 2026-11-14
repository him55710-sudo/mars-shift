# Data sources and classification

Canonical machine-readable metadata: `public/data/manifest.json`; additional research records: `public/data/research-sources.json`.

| Product | Agency / instrument | Actual use | Native resolution | Classification |
|---|---|---|---:|---|
| cenjez_DEM_1m.tif | NASA MRO HiRISE / Caltech | Elevation, slope, relief and routing | 1 m | Published stereo-derived topography |
| cenjez_DRG_0_3m.tif | NASA MRO HiRISE / Caltech | Geographically aligned grayscale optical map | ~0.3 m | Published optical orthomosaic |
| THEMIS_TI_Quantitative | NASA Mars Odyssey THEMIS / Caltech Murray Lab | Regional thermal material context | 100 m | Published thermal-inertia retrieval |

DEM and optical: [Annex & Ehlmann (2024), CaltechDATA v2, DOI 10.22002/stqse-yay61](https://data.caltech.edu/records/stqse-yay61). CC BY 4.0. The DEM checksum is verified against the published MD5. Original optical metadata are validated from the remote TIFF header; only a range-read ROI is fetched. The optical display is bilinearly downsampled to 1 m with 1–99 percentile grayscale contrast stretch.

Thermal: [Mars 2020 Landing Site Working Group 2.0](https://murray-lab.caltech.edu/Mars2020/), quantitative 32-bit product. Units: J m^-2 K^-1 s^-1/2. ROI values range about 294.5–387.8. This is not the qualitative normalized 0–255 layer. The provider's native resolution is 100 m and the product is registered to a THEMIS global mosaic, not quantitatively controlled. Product-specific reuse terms were not explicitly supplied on the index page; retain provider and instrument credit and verify terms before broader redistribution.

Observation dates are unavailable in the inspected records; they are stored as unknown, not the date of processing. Full DEM and thermal coverage here does not establish current visibility, local obstacle absence or geolocation certainty. Thermal-to-optical registration accuracy is not quantified.

## Five official challenge resources

Chrome inspection on 2026-11-14 verified all five at the [official challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources).

| Resource | Use in MARS SHIFT | Boundary |
|---|---|---|
| [NASA/JPL Mars Trek](https://trek.nasa.gov/mars/) | Existing geolocated planetary explorer linked from the operational map | External NASA tool; no custom 3D model or unverified embedding |
| [USGS–NASA Mars geologic maps](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | Regional geologic mapping context and resource register | Geologic map units are not fine-grained passability measurements |
| [Curiosity's proposed path](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | Science-objective/traverse presentation precedent | Gale crater, not Jezero; not spatially fused |
| [NASA Worldview](https://worldview.earthdata.nasa.gov/) | Layer and scenario comparison interface reference | Earth service, not Mars weather input |
| [Perseverance raw images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | External surface observation gallery | No georegistered camera footprint or change detection claimed |

## Literature

[1] Cunningham, Nesnas & Whittaker, *Improving slip prediction on Mars using thermal inertia measurements*, Autonomous Robots 43, 503–521. [Fetched Consensus record](https://consensus.app/papers/cunningham-nesnas-improving-slip-prediction-on-mars-using-thermal/w:4b556532-5877-4c11-8431-709767ce4daa/). Supports research interest in complementary thermal data; does not validate our human resource model.

[2] Hedrick & Gu (2021), *Terrain-aware traverse planning for a Mars sample return rover*, Advanced Robotics 35, 1286–1301. [Fetched Consensus record](https://consensus.app/papers/hedrick-gu-terrainaware-traverse-planning-for-a-mars-sample/w:e29c6f8b-009f-4906-a527-4a32a86ac629/). Establishes terrain-aware traversal as prior work. Full texts were not read in this project research pass.

## Additional registered NOAH overlap region

The third 1 km² region centered at 18.4600° N, 77.5650° E uses the same real Caltech/NASA HiRISE native DEM and optical raster plus THEMIS context. It adds actual NOAH-H class coverage where the original two regions have none. NOAH-H is a derived texture classification (CC BY 4.0; Wright et al.; DOI 10.21954/ou.rd.17121482.v2), not observed soil strength or a geological-unit map. See `NOAH_H.md` for exact bounds, original source identity, reprojection, original legend, coverage and null-data policy. Numerical integration results are in `/data/noah/integration-results.json`.
