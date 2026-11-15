# Navcam close surface release

15 November 2026. Open `/explore?surface=navcam` or **Navcam close-up** in the rover explorer. The default rover exploration also uses the new PDS textures in Native detail. **Mission terrain** returns from the close inspection to the orbital route HUD. A destination launched explicitly for mission planning retains that workflow. The original Sol 9 station remains in **Source & coverage → Open Sol 9 archive**.

## What changed

The orbital 1 m DEM / approximately 0.3 m imagery cannot supply photographic detail at boot distance. The new default inspection surface therefore uses actual rover stereo geometry, with a clearly separate local reference frame.

- **1,045,833 original NASA mesh triangles** from the finest published leaves and surrounding observed context. No generated boulders, heightfield noise, mesh smoothing or terrain infill.
- **61 fine tiles** retextured from four PDS linearized radiance images: one **5120×3840** and three **2560×1920** products. These are actual source pixels, not an upscaled copy of the old 512-pixel tile atlases.
- Published PDS **CAHV C/A/H/V**, the NASA scene quaternion, and the original tile transform project the source image into each mesh. Geometry attributes and indices remain identical. Only texture coordinates and image bindings change.
- A single RGB radiance display mapping, anchored to the first image's sampled 0.5/99.7 percentiles and adjusted with each label's scaling factor, is shared across images. The 1/2.2 display power is disclosed in the record; this is visual tone mapping, not a new radiance measurement or colorimetric calibration.
- Three inspection viewpoints, bounded walking on observed support, centre-ray rock focus, orbit inspection, zoom, and source access. The centre focus uses an actual mesh intersection. Ground detail starts at the published PDS camera centre, aiming into the valid photo footprint. It shows that single observation to avoid overlapping independent scans. Eye level and orbit are illustrative inspection cameras.
- Nearest ground tiles load first through a three-request queue. SHA-256 is checked before glTF decoding. Original textures use anisotropic filtering; the image illumination is retained with unlit materials and no additional haze or blur pass. The renderer draws on changes, rather than redrawing an idle camera continuously.
- Native detail transfers about **36.5 MB** of surface assets; the efficient option uses about **10 MB**. Changing view does not reload geometry. Surface GLBs cache on demand for repeat/offline viewing. Initial offline availability of the orbital map does not imply an unseen Navcam station is already cached.

## References actually inspected

[Gale Marswalk Planner `build_stop.py`](https://github.com/sohaib1083/gale-marswalk-planner/blob/main/navcam3d/build_stop.py) combines measured stereo depth with scaled Depth Anything estimates, merges observations on a 15 cm grid, and distinguishes stereo/estimated support. Its [`pds.py`](https://github.com/sohaib1083/gale-marswalk-planner/blob/main/navcam3d/pds.py) demonstrates published camera projection and frame math. We adopted the camera-aware photo/geometry workflow; learned depth completion and filled terrain are not used in this release. No additional competitor source code was copied.

The mesh source is [NASA-AMMOS 3D Tiles Sample Data, Drive 1004](https://github.com/NASA-AMMOS/3DTilesSampleData/tree/76444abbb4faff1b05f46a09b81ca2c24602b333/m20-drive-1004), pinned to commit `76444abbb4faff1b05f46a09b81ca2c24602b333`. Its README identifies the PDS mesh and calibrated-image bundles; each original scene file supplies camera and pose metadata. PDS labels independently identify Mars 2020 / Navcam Left, Sol 477, site 26 / drive 1004. The repository's instrument attribution line says MSL, but the actual product identifiers and labels identify Perseverance; the UI follows the product labels.

The calibrated source directory is the [PDS calibrated Navcam Sol 477 archive](https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_navcam_ops_calibrated/data/sol/00477/ids/rdr/ncam/). Exact image and label URLs and hashes are recorded in `/data/drive1004/calibrated-validation.json`. The [PDS CAHV definition](https://pds.nasa.gov/datastandards/documents/dd/all/current/ch36s05.html) supplies the linear camera convention. NASA media are credited **Courtesy NASA/JPL-Caltech** under the published [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) and [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/). No endorsement is implied.

## Reproduction

```sh
# Existing Python environment: NumPy, SciPy and Pillow.
../.venv/Scripts/python scripts/prepare_drive1004.py
../.venv/Scripts/python scripts/validate_drive1004.py
../.venv/Scripts/python scripts/prepare_navcam_calibrated.py --all
../.venv/Scripts/python scripts/validate_navcam_calibrated.py
node node_modules/vitest/vitest.mjs run --testTimeout=15000
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

Raw images and source tiles are cached in ignored `.local/` directories and are not shipped to visitors. Processed assets and provenance are versioned, so Python and raw downloads are unnecessary to run the app. The four raw PDS files together are about 207 MB. A repeat build reuses complete cached files and verifies expected byte counts.

## Validation and limits

`validation.json` compares 82 source/repacked assets: original geometry accessor arrays and image dimensions are identical. It also checks 64 sampled ground heights by direct original-triangle intersections; maximum JSON export difference is 0.0000048 m. That is numeric consistency, not stereo accuracy.

The calibrated pipeline separately verifies unchanged geometry attributes and triangle indices for all 61 retextured tiles. The maximum packed-UV camera reprojection difference is below 0.001 pixel (observed maximum 0.000067 px). An analytic camera checks axes and metric scale. Old-atlas/new-projection luminance correlation is a content diagnostic: median 0.697 and minimum 0.118, with different radiometric mapping and resampling. These values do not establish independent physical registration or subpixel source accuracy.

After integrating the current public rover explorer, 202 tests were exercised. One existing mission-reload test exceeded the 5-second limit during concurrent work; all 22 tests in that file passed on a separate run. TypeScript and the production build passed.

The browser check covers native and efficient detail, centre focus/orbit, viewpoint switching, mission return, source disclosure and phone layout. Automated tests cover analytic-plane interpolation, missing/steep support, bounded camera motion, the real source start and published camera metadata, tile path/frame validation and load ordering.

The stereo wedges still contain occlusions, finite boundaries, inter-observation seams and missing ground. They remain visible. The new source photograph does not create geometry below the original mesh sampling. The local camera-support grid is an inspection aid, not an EVA traversability certification or the global mission route. The source frame is not registered to the orbital study regions; no mission path is draped onto unrelated rover observations.
