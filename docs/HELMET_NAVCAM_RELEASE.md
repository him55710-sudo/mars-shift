# Helmet navigation and recorded Navcam release

## Working experience

The existing Jezero DEM and mission system are retained. The new default is a 1.7 m eye-height helmet view at vertical scale ×1. The five calculated objectives—fastest time, shortest distance, safety priority (terrain-proxy cost), effort-distance, and mission balanced—are selectable inside the visor. Their purposes, modeled time, distance and reserve remain visible in the route selector and larger mission map.

Routes follow the native DEM as thin ground ribbons with directional chevrons. Red/orange/gray ground hatching distinguishes exclusions, candidates and unknown data. It is suppressed when localization is invalid. These graphics do not certify unresolved small obstacles.

The **Full display** control switches to a north-up, crew-following map using native optical display imagery, the same computed routes, exclusions, crew position and resource accounting. Zoom buttons cover a 50–1,000 m vertical field. Turn controls change heading; WASD motion continues through the native collision and remaining-return checks. No teleport or autonomous driving is introduced.

**Dust test** is a visibility rehearsal, not detected weather or a forecast. It sets an illustrative 8 m visual range, opens the full map and degrades the simulated position fix. Movement is held until the user explicitly restores an assumed simulated fix. The observed map then supports rehearsal navigation; it does not reveal new terrain through a real storm. Existing mission-level dust/HOLD constraints remain unchanged.

**NASA road view** opens a separate recorded Perseverance Sol 9 Navcam stereo wedge. Default efficient geometry is 1.86 MB / 103,907 triangles; original geometry is 9.37 MB / 415,633 triangles. Eye-level inspection, orbit, zoom, original-geometry selection, source metadata, 360° panorama access and image fallback are provided. [Exact provenance, conversion and validation](NAVCAM_MESH_REVIEW.md).

## Performance and implementation

- Native HiRISE streaming retains four 512 px tiles in one atlas around the crew; the native 1 m DEM supplies geometry and normals. No invented near-field rocks or generative detail are added.
- Native image contrast expansion is disabled to avoid clipping low image intensities.
- The NASA avatar loads only for follow mode. The default helmet view does not load the character asset or render its shadow map.
- Full navigation pauses GPU draws and native-tile requests while keeping the collision and navigation controller running. Returning to terrain resumes on-demand rendering.
- Navcam is a lazy code/asset load. Its unlit observed texture avoids a second lighting pass. It renders on interaction and resize, disposes the old geometry, and does not run a permanent animation loop.
- Route changes retain a valid return-cost field when its terrain and constraint key are unchanged; changed constraints still invalidate it.
- The offline core includes the efficient Navcam asset, original image, provenance and all three analysis/mission/return workers. Original Navcam geometry is an optional online detail download.

## Verification

The isolated release passed `pnpm test`: **148 tests in 16 files**, and `pnpm build`. Tests include native interpolation, swept collision, excluded cells, mission/scene synchronization, annotation buffers, invalidated routes, current-position emergency return, resource reserves, localization gating and stale-result rejection. Two repeated full-region synchronous integration cases use a 15 s deadline on shared machines; their assertions and search budgets are unchanged.

Actual in-app-browser rendering of the release at **1280 × 720**, auto quality, DPR **1.25**, Eastern Ridge, helmet camera, native tiles ready: the reproducible five-second camera sweep rendered **264 frames (52.8 FPS)**. Median CPU draw-submission time was **0.70 ms**; the last non-blocking GPU timer sample was **3.08 ms**. This is one local hardware/browser observation, not a universal rate or complete latency benchmark. Minimized-Chrome timing samples were discarded.

Full-display verification: the crew moved through accepted motion while the 3D render counter stayed unchanged. Zoom, position degradation/HOLD/recovery and shared route selection were exercised. Navcam efficient and original meshes loaded in the browser; original geometry and UVs were also checked numerically against the PDS source. Desktop/mobile controls and screen layout were inspected separately; no browser console errors were observed in the checked flow.

The published scientific report `public/data/science-results.json` is preserved byte-for-byte with SHA-256 `dd261a7d5b19c0aabb75326439e88004832926d8fc2a3f4d47e8b22943c3efa0`. New navigation figures live in `public/data/navigation-results.json`; the seven-slide presentation and optical training fixtures remain intact.

## Remaining scientific limits

Orbital imagery is still approximately 0.3 m per source pixel, the DEM approximately 1 m and the planning graph 5 m. Enlarging them at eye level cannot recover unobserved rock geometry. The detailed Navcam station is separate and is **not** spatially registered to the planned route. No matching stereo error raster has been imported, no uniform centimeter accuracy is asserted, and Navcam visual LoD is not authoritative collision geometry. Resource and position values are declared simulations. This release does not add real headset tracking, live dust detection, certified EVA safety or learned Gaussian reconstruction.
