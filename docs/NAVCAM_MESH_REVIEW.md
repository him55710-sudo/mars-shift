# Recorded Perseverance Navcam terrain

MARS SHIFT now includes a separate, authentic rover-station terrain asset from the [NASA PDS Mars 2020 Navcam terrain-mesh collection](https://pds.nasa.gov/ds-view/pds/viewCollection.jsp?identifier=urn:nasa:pds:mars2020_navcam_ops_mesh:data). This is a finite stereo reconstruction observed on Sol 9, not a detail texture substituted into the mission-planning regions.

## Observation and provenance

- Instrument: Perseverance NAVCAM_LEFT.
- Observation: 2021-02-28 03:54:09.291–03:54:10.110 UTC; Sol 9, Site 3, Drive 0.
- Product: `NLF_0009_0667756352M693RAS_N0030000NCAM05000_0A0295J04`.
- PDS LIDVID: `urn:nasa:pds:mars2020_navcam_ops_mesh:data:nlf_0009_0667756352m693ras_n0030000ncam05000_0a0295j.obj::4.0`.
- [Original PDS label](https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_navcam_ops_mesh/data/sol/00009/ids/rdr/mesh/NLF_0009_0667756352M693RAS_N0030000NCAM05000_0A0295J04.obj.xml) and [product directory](https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_navcam_ops_mesh/data/sol/00009/ids/rdr/mesh/).
- Source OBJ: 49,509,495 bytes; 212,457 listed vertices; 415,633 triangles. Original PNG: 1280 × 960, 2,238,656 bytes.
- Geometry is expressed in Site 3 coordinates. No transformation to the current orbital study regions was established.

Credit: **Courtesy NASA/JPL-Caltech**. The [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/) allows public-site image reuse subject to its stated conditions, attribution and no implied endorsement. No third-party rights restriction appears in this product's label or material file. This does not relabel NASA data as MIT-licensed software, and NASA endorsement is not claimed.

The checked archive product is version 4.0. A collection-level registry revision is not evidence that this individual product has changed.

## Conversion and performance

`scripts/build_navcam_scene.py` uses **Blender 5.2.2 LTS** to convert the original OBJ/MTL/PNG. It preserves the original triangle geometry in the full asset and creates one optional 25% visual LoD. No terrain is generated, holes filled, rocks added, texture sharpened, or geometry registered to another location.

| Asset | Triangles | Download bytes | Use |
| --- | ---: | ---: | --- |
| `sol9-navcam-efficient.glb` | 103,907 | 1,862,940 | Default, one mesh/material |
| `sol9-navcam-full.glb` | 415,633 | 9,367,376 | Explicit original-geometry inspection |

Both assets embed a JPEG quality-95 encoding at the original 1280 × 960 dimensions. The original PNG remains available as `observation.png`. `KHR_materials_unlit` preserves the photographed illumination without applying a second simulated sun. There are no animation rigs, normal textures, or runtime decoder dependencies. Load one LoD at a time and release the previous geometry/material/texture. The original asset remains below 10 MB; it should be loaded only on request.

Coordinates transform from source `(north, east, down)` to glTF `(east, -down, -north)`, in metres. No translation or scale is introduced. The [Mars 2020 Camera SIS v3.7](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_mission/document_camera/Mars2020_Camera_SIS.pdf), sections 9.1 and 20.2 (PDF pages 146–147, 237–238), describes stereo terrain wedges, their missing regions and the north/east/down Site frame. The glTF bounds of the actual faces are approximately 105.75 m east–west, 82.03 m north–south and 4.54 m vertically. These bounding dimensions do not mean the full rectangle has observed coverage.

The manifest's suggested camera `[0, 1.7, -0.1]`, target `[-0.8, 0.12, 6]`, and vertical field of view 67° form an **illustrative human-height inspection view**. They are not a reconstruction of the original camera pose. No planetary latitude/longitude has been invented.

## Numerical verification

`scripts/validate_navcam_scene.py` checks every full-mesh face and every exported UV vertex against the original OBJ. Results are stored in `public/data/navcam/validation.json`:

- All 415,633 original faces are present, with no added face geometry.
- Every output position matches the declared axis transformation at float32 precision. Maximum coordinate quantization difference: 0.0000005 m.
- 211,637 exported UV vertices checked; maximum coordinate error: 0.000000044632. glTF V is `1 − OBJ V`; U is unchanged.
- Original and embedded textures both measure 1280 × 960. RGB PSNR of the JPEG encoding against the PNG is 35.651 dB.
- 896 source vertices are orphaned (used by no source triangle); export omits those, while UV seams account for additional exported vertices.

The LoD comparison samples 10,000 evenly spaced **used** source-vertex indices against the nearest reduced triangle surface. Distances: median 0.294 mm, 95th percentile 0.980 mm, maximum 3.083 mm. This one-direction sample describes this simplification only. It is not a bound on all points, a source measurement accuracy, a calibration result or a collision guarantee.

The original observation and a Blender inspection render were visually checked. Real rocks, shadows, the finite wedge boundary and holes are visible. Browser rendering and controls are verified separately by the application owner.

## Reproduce

Download the exact `.obj`, `.mtl`, `.png`, and `.obj.xml` files from the product directory above into a local cache. Their exact SHA-256 values are in `public/data/navcam/conversion.json`. With the repository as working directory:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/build_navcam_scene.py -- --source .local/navcam-sol9
../.venv/Scripts/python.exe scripts/validate_navcam_scene.py --source .local/navcam-sol9
```

Blender supplies its own NumPy runtime. Validation uses the project's existing NumPy and Pillow dependencies. The converter emits the two GLBs, numerical conversion report and a local inspection render. The metadata manifest and original source label retain observation identity and policy links.

## Scientific limits and viewer contract

The source uses adaptive stereo geometry and has occlusions/correlation gaps. Pixel ground scale and depth uncertainty vary with range; a uniform centimetre resolution is not asserted. Camera SIS sections 8.8–8.9 describe error products and range filtering, but matching per-pixel uncertainty has not been imported here.

The station must be labeled as a separate recorded observation. It cannot show the live crew position, mission paths or confirmed obstacles from the study ROIs as though they were spatially registered. It is appropriate for orbit/zoom or an illustrative eye-level inspection, with clear unobserved boundaries. It is not yet a traversable EVA route region. MARS SHIFT's existing DEM, hard exclusions and mission graph remain authoritative for planned navigation.

Authentic data was accessible directly, so the Curiosity Dingo Gap sample from NASA-AMMOS/3DTilesSampleData was not substituted. No new renderer dependency or optional Gaussian splat scene was needed.
