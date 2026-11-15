# Observed-ground exploration

The explorer now starts inside the existing conservative Drive 1004 navigation coverage, with its camera aimed along the first part of the computed route. It retains the shared mission workspace, 2D local map, recorded hazard experiments, terrain evidence and native PDS assets.

## Measured entry coverage

Run `pnpm test` to reproduce `analysis/observed-ground-entry.json` from the original navigation grid.

| Quantity | Previous entry | New entry |
| --- | ---: | ---: |
| Local north/east, m | 1.375 / 5.375 | -2.625 / 7.875 |
| Known grid samples within 3 m | 405 / 441 (91.84%) | 441 / 441 (100%) |
| Distance to nearest missing grid sample, m | 0.75 | 3.482 |

These are sample-coverage figures, not a continuous surface accuracy guarantee. The 0.25 m graph spacing does not imply 0.25 m measurement accuracy. The new destination is (-6.375, 10.375) m in the same local frame. The lower-exposure round trip is 10.547 m, 2.779 modeled minutes including two minutes of science work. The original grid bytes, recorded scenario entry points and orbital registrations remain unchanged.

## Rendering changes

- Original fine NASA meshes write a stencil mask before coarse surrounding meshes. Coarse context cannot cover visible fine detail. Original GLB geometry, textures and transforms remain unchanged.
- Prioritize nearby fine tiles before distant context; keep bounded four-request loading, on-demand rendering, frustum culling and the existing DPR cap. The astronaut asset remains deferred in first person.
- Enable trilinear mipmaps, up to 16x anisotropy and a modest -0.5 mip bias. Two-sided rendering exposes existing scanned triangles from either viewing side; it creates no new triangles.
- The selected walking route is a 5 cm **display mask**, projected in the source mesh shader. It follows actual triangles and cannot float across missing meshes. The numerical planner remains on its existing graph. Overview retains outbound/return ribbons and alternative routes.
- Hazard boundaries and derivative-filtered hatching remain attached to the same surface; reduce the distracting square outlines for slope/unknown classes. Reviewed and simulated exclusions update the same graph and mask.
- Connect the repository's existing `display-v14` NASA-photo context to the main explorer. It uses bounded interpolated depth behind the stereo meshes. It is explicitly labeled **estimated depth**, can be disabled in Layers, and is excluded from picking, collision, planning and walking route projection. It is visual continuity, not measured replacement ground.

## Verification

- `pnpm test`: 55 files, 388 tests passed. Added actual-data coverage, swept movement along both route legs, metre-registration/NoData masking, and invalidation checks. The new raster test checks every pixel with aggregate assertions to avoid hundreds of thousands of assertion allocations. Existing science checks were not weakened.
- `pnpm build`: TypeScript, Vite, static packaging and native-asset checks. All 66 calibrated assets / 1,045,833 source triangles retain their SHA-256 identities.
- Browser: native ground loaded; Shift+W moved 1.10 m without crossing the configured support constraint; inserting a simulated obstacle updated the route from 19 to 25 outbound cells after walking, with 49 warning cells. Removing the test obstacle restored the route.
- Browser: 390x844 layout has no horizontal overflow; mobile provenance stays below controls. Layer switching does not change crew position or the navigation graph.
- Local five-second camera rotation: 58.94 fps at 1280x800, DPR 1, with photo context enabled; 59.35 fps at 713x667, DPR 1.25, before enabling that context. These are local rehearsal measurements, not a minimum FPS guarantee for other hardware or network conditions. Idle rendering remains event-driven.

## Sources and limits

Original mesh: [NASA-AMMOS 3DTilesSampleData, Drive 1004](https://github.com/NASA-AMMOS/3DTilesSampleData/tree/76444abbb4faff1b05f46a09b81ca2c24602b333/m20-drive-1004). Calibrated source imagery and CAHV transformations are enumerated in the existing `calibrated-validation.json` and `display-v14/manifest.json`. Rendering uses the existing Three.js implementation and [documented texture filtering](https://threejs.org/docs/pages/Texture.html).

No new observed boulders, terrain detail, stereo accuracy, accident probabilities or EVA safety claims are introduced. Native images and sparse stereo geometry still impose near-ground resolution limits; this is not a continuous photorealistic reconstruction of all Mars. Photo-context depth and sky are presentation layers, not scientific terrain evidence.
