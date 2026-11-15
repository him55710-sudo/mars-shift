# Drive 1004 observed walking surface

The new surface is a subset of NASA/JPL's actual Perseverance tactical meshes, not a generated replacement for the Jezero orbital DEM. Four neighboring detailed Sol 477 observations plus five surrounding context observations from [NASA-AMMOS/3DTilesSampleData](https://github.com/NASA-AMMOS/3DTilesSampleData/tree/76444abbb4faff1b05f46a09b81ca2c24602b333/m20-drive-1004) are used. The published repository version is `76444abbb4faff1b05f46a09b81ca2c24602b333`.

## Scene contract

`public/data/drive1004/manifest.json` lists 21 GLBs, their source product/tile URLs, SHA-256 hashes, metric bounds, and a column-major `transform` for each asset. Load a GLB with Three.js `GLTFLoader`, then apply its manifest matrix exactly once. Keep its unlit material and sRGB texture. No additional axis rotation is required.

The transformation follows the [NASA Landform site-overlay example](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/example/three/landformSiteOverlay.js) and [scene-frame loader](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/example/three/src/jpl/JPLLandformSceneLoader.js):

`display = Rx(+π/2) × site-frame translation × tileset root transform × source vertex`

All selected scene files share `site_026` in `sitedrive_0261004`. The site translation is `[-83.6244, 8.41768, 13.5431]` metres. Display axes are **x north, y up, z east**. They are local station coordinates, not an independently verified registration to NOAH-H or the existing kilometre-scale study regions. Do not project the old mission route onto this scene.

The initial local position is **x 1.375 m, z 5.375 m**, with source-sampled ground height approximately **0.01491 m**. The example target is **x −7.375 m, z 16.875 m**. Both belong to the same conservative connected component after a 30° slope limit and a 0.5 m square-footprint erosion. The actual route remains the app's computed result; the 14.45 m endpoint separation is not a route length.

## What was converted

- The visual surface uses NASA's existing first-child hierarchy meshes: **353,737 triangles / 176,693 vertices / 16 draw calls** for the detailed sector. Five original root-LoD surrounding observations add 57,306 triangles, giving **411,043 triangles / 213,334 vertices / 21 draw calls** total before UI overlays.
- Source b3dm containers were unpacked as GLB. Positions, normals, UVs, and index values were retained exactly. Index-width narrowing is permitted only when every value fits uint16; the current source tiles were already efficiently indexed or require uint32. No terrain was resculpted, inferred, or filled.
- Embedded PNGs were re-encoded as JPEG quality 95, 4:4:4, retaining their pixel dimensions. No texture enlargement, sharpening, or generated detail was applied.
- Total visual GLB payload is **10,008,984 bytes** (8,230,188 bytes detailed sector plus 1,778,796 bytes surrounding context). The original finer source meshes remain in `.local/drive1004/source`, outside the published package.
- The duplicate close-range `NCAM00708` observation was excluded. The selected `NCAM00701` close patch and three neighboring wedges provide a useful observed sector without loading the entire collection.

The native rendering is static but the geometry is actual NASA source LoD. The application does not need the complete dynamic 3D Tiles runtime to render these extracted tiles. The full sample set and runtime remain available for future streaming expansion.

## Navigation raster and uncertainty

`navigation-grid.json` is a **160 × 160**, **0.25 m** cell-center grid with origin **[−8, −4] m**. Rows increase along local east (z); columns along local north (x). A cell center is `origin + (index + 0.5) × cellSize`.

The raster is derived from **988,527 original finest-available source triangles**, separately from the coarser visual LoD. Every grid sample is a vertical intersection with an original triangle. The top observed surface is used. Slope is the maximum contributing triangle slope and adjacent eight-neighbor height grade. NoData is `null` and receives no interpolation or ground infill.

Of 25,600 cells, 10,504 have source observations. **962** have more than 0.2 m vertical disagreement between contributing source triangles and are unknown. A further **96** have no corresponding visual-LoD surface and **3** differ from the visual surface by more than 0.2 m; these are also unknown. The final grid has **9,443 known cells**. Grid spacing is a sampling choice, **not** a stereo accuracy guarantee. A slope overlay is a geometric proxy, not calibrated rockfall or astronaut injury probability.

The example start and target are within a 615-cell conservative component. The app must additionally enforce its configured footprint, swept movement, slope, route, and annotation constraints. A sampled heightfield cannot resolve every overhang, narrow obstacle, or unseen rock. The local scene has no imported THEMIS raster or certified resource model.

## Numerical verification

`validation.json` records:

- All 21 visual GLB accessor arrays exactly match the selected NASA source tiles, and all texture dimensions match.
- 64 deterministic known-cell samples were independently intersected against the original triangles. Maximum difference from the rounded exported heights is **0.000004791 m**. This validates conversion and export consistency only.
- Across 9,446 jointly covered cells, visual-LoD versus original geometry height differences have median **0.001143 m**, 95th percentile **0.004945 m**, and maximum **0.436864 m**. The three differences over 0.2 m are masked. These are approximation differences, not measurement errors.

Browser frame rate, camera height, movement, route behavior, and appearance must be validated in the integrated application separately; the asset validation does not establish those outcomes.

## Reproduction

Use Python with NumPy, SciPy and Pillow:

```sh
python scripts/prepare_drive1004.py
python scripts/validate_drive1004.py
```

The preparation script downloads missing selected source products from the pinned NASA repository revision, caches them locally, repacks display assets, and recomputes the raster. The validator checks source arrays and direct triangle intersections. Both run without Blender, since the published NASA geometry already supplies the required surface.

## Attribution and use conditions

Credit: **Courtesy NASA/JPL-Caltech.** Source repository attribution identifies NASA/JPL Navcam products; the product identifiers and scene metadata identify Mars 2020 Site 26 / Drive 1004.

The [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) specifically cover texture maps and polygon data used for educational/informational simulations and websites, with attribution and no implied NASA endorsement. The [JPL image-use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/) provides the corresponding credit and exceptions. No NASA or JPL insignia is introduced by this terrain conversion. The sample-data repository has no separate top-level LICENSE file; it is not described here as Apache-licensed data. The **renderer software** has its own Apache-2.0 license, which must accompany any redistributed renderer code.

Curiosity's Dingo Gap is a separate Gale Crater scene. It was not substituted into the Jezero region or claimed to be spatially aligned with these observations.

## Axis and context audit

All source tilesets explicitly declare `asset.gltfUpAxis = "z"`. In NASA’s `TilesRenderer.loadRootTileset`, only x-up and y-up data receive an internal correction; z-up uses identity. The b3dm feature tables contain no RTC_CENTER and the embedded glTF nodes contain no transforms. Consequently the manifest matrix already includes the complete official conversion; adding another Y-to-Z rotation would be incorrect.

The additional `contextOnly` assets use the original root-level NASA LoD and cover the remaining Sol 477 viewing directions. The source imagery can still have natural stereo gaps and irregular boundaries; these are not filled. The navigation raster is deliberately unchanged and these context meshes do not authorize movement into unanalysed areas.

## Native-detail option

`manifest.detailAssets` supplies the original finest available leaf meshes and tile textures for the four walking observations, plus the same five surrounding context meshes. It contains **66 assets / 1,045,833 triangles / 28,904,064 bytes**. The 21-asset, 10 MB list in `manifest.assets` remains an explicit efficiency option. Use frustum culling, bounded downloads and on-demand rendering; this byte count is before any HTTP transfer compression.

Typical broad-view source textures are 512 × 379 or 512 × 349 pixels at both parent and near leaf levels, but the near leaves cover approximately half the linear ground span, so their local pixel density is approximately twice the parent level. Some small remote leaf crops have smaller image dimensions. These tile atlases are still not the full raw 3840-pixel Navcam camera image. No enlargement recovers missing source detail.

The native-detail conversion retains the original positions, normals, UV values and triangle indices. The navigation grid, initial position, target and original geometry analysis remain unchanged. Validation compares all 82 distinct coarse/context/detail assets against their NASA source arrays.
