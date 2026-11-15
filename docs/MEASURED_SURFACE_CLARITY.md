# Measured close-view appearance

Field Navigation preserves physical DEM elevations at 1× and the complete surrounding CTX terrain. Close inspection now retains every 1 m native sample within ±96 m of the focus bucket, 2 m samples within ±192 m, and the complete existing orbital grid. The regional seam uses the same axes. The source image footprint, planning arrays, candidate extraction, graph paths, exclusions and resource calculations are unchanged.

## Appearance

- The bounded four-tile atlas still uses the existing registered observed imagery, about 0.3 m pixels. A four-neighbour unsharp filter is limited to ±0.02 linear RGB per channel at full strength, followed by a 20% contrast adjustment around 18% gray. It adds no texture, displacement or inferred rock geometry.
- Object-space normals remain exactly those computed from the measured DEM. The unused alpha channel of the same texture stores a bounded concavity shade from opposing samples at 1, 3 and 8 m. Planar gradients cancel; missing sample pairs are omitted; missing centres remain neutral. Only ambient diffuse light is attenuated, down to at least 0.66 visibility.
- The normal/concavity pixels are memoized per native DEM, so changing between 2D and 3D does not repeat that calculation. The image filter samples its four neighbours only when the clarity adjustment is active.
- The optical close view blends to a fixed display sun about 26° above the horizon, with less uniform ambient fill. Its direction matches the existing DEM horizon-occlusion asset. This is display illumination, not an observed solar condition.
- These adjustments fade out at the survey scale and are disabled on quantitative layers. **Enhance surface shading**, inside Layers & evidence, compares the adjusted appearance with the original lighting/image contrast. It preserves the native geometry, high-resolution image tiles, camera and route revision.

## Route and ground distinction

Selected route strokes are sampled along the actual unsmoothed graph polyline at at most 1 m intervals. Each sample uses measured elevation plus a small display lift; missing native heights split a stroke. Screen-sized dark casings separate mint outbound strokes and pale dashed return strokes from both light and dark ground. A 0.7 m lateral display offset separates coincident legs. It does not change a planned path. Broad animated ribbons are narrower, depth tested, and fade away near the camera.

Sand candidates retain red warning semantics. A light interior, strong footprint boundary and diagonal hatching preserve the underlying image; depressed-ripple candidates add a second hatch direction. Boulder-field texture has a subdued ochre display, distinct from the red sand footprint. Hard constraints retain priority even when candidate layers are hidden. Both 3D and 2D use pattern and line style as well as color, with a compact visible legend. These remain source-based screening candidates, not measured soil strength or confirmed entrapment.

## Validation

Tests check unchanged native arrays and physical normals, planar-gradient cancellation, missing-data boundaries, metric scale consistency, measured-height route samples, stroke splitting at NoData, exact 1 m focus coverage, the conforming regional seam and display-class priority. Browser verification compares the same grid point and camera pose, checks the shading toggle and quantitative layers, and verifies close zoom, route/resource state, mobile layout and console output.

Verified on 2026-11-15:

- Full suite: 307 tests in 39 files passed. The four appearance tests passed again after optimizing the opposing-sample loop.
- TypeScript and production packaging passed, including the unchanged 66 native Navcam asset checks. Static output remains below the 255 MiB limit (254.97 MiB).
- At grid 99,99 and a 145 m camera distance, the close mesh has 390,680 triangles and the native four-tile atlas is active. Switching shading off/on leaves the camera JSON, triangle count, route revision, 1,839 m round trip, 68.7 min and 52% reserve unchanged.
- Slope display disables image contrast, measured concavity shade and fixed-sun occlusion. Returning to imagery restores them.
- The 80 m zoom limit and the continuous verified regional terrain remain active. A settled local close-view draw measured about 10.5 ms; this is one observation, not a frame-rate guarantee.
- At a 390×844 viewport, the close view and expanded map work without horizontal overflow. View switching clears stale inspection labels; Escape restores the standard layout. Temporary viewport override was reset.
- No JavaScript or WebGL errors were reported during the verified local flows.

The subsequently published integrated research release (`70e2c8a`) was merged before publishing this appearance change. Its observed-sand, adaptive-vortex, review, local-map and demo-preparation work is preserved. The combined suite has 391 tests in 55 files: 390 passed in the combined run, and the existing EVA route-freeze test exceeded its 5 s wall-clock limit. Its complete 22-test file then passed alone in 16.15 s. All 391 distinct tests therefore passed. No planner or test timeout was modified.
