# Real surface rendering

The local surface uses actual registered Jezero orbital products: approximately 0.3 m HiRISE optical pixels, 1 m stereo DEM and a 5 m planning graph. Read [surface optical provenance](SURFACE_OPTICAL.md) and [NASA crew attribution](NASA_CREW_ASSET.md).

`surface-geometry.ts` samples the native DEM at 1 m near the crew, 2 m and 8 m farther out, and 32 m at long range. A shared conforming grid avoids cracks. It excludes any coarse quad spanning native NoData or an unsupported planning cell. Native DEM gradients provide lighting normals without adding invented relief. At the default base this reduces the terrain from 500,000 to 61,250 triangles (87.75%); counts depend on position. This does not change physical camera interpolation or route collision.

Ground route ribbons resample the computed polyline at intervals no greater than 0.75 m. Both ribbon edges are sampled on the native DEM, with a 4.5 cm display offset to prevent z-fighting. Directional chevrons show travel direction. No path smoothing cuts across excluded cells. The expanded map retains outbound/return alternatives and route-purpose explanations.

Hazard hatching uses the same grid constraints as navigation: excluded cells, steep-slope proximity candidates and unknown coverage remain separate. It is a visualization of defined rules, not observed rockfall or a calibrated safety probability. Hatching is applied in the terrain material so it follows its surface and lighting. Clear ground does not establish that small obstacles are absent.

The NASA-derived crew asset is 852,596 bytes with 23,238 triangles, seven material primitives and nine bones. It loads on demand in third-person mode and disposes safely after asynchronous loads. The compact pack and walk are disclosed visual adaptations. Sky, warm surface tint, sun and contact shadows are simulated presentation; the grayscale optical source is preserved.

Rendering runs on camera/movement/scene changes, caps device pixel ratio, reduces it during sustained slow frames, and uses a local 1024² shadow map. Opening the expanded map releases the underlying 3D renderer. A native DEM normal texture is 4 MB; a decoded full 3334² optical RGBA texture is approximately 44.5 MB before mipmaps. The EVA base texture plus a four-tile1024² atlas uses about8.2 MB before mipmaps, compared with44.5 MB for the full native image. Only the current four512px tiles are decoded. Native geometry is partitioned into128 m patches with tight frustum bounds; shared positions, normals and UVs remain identical. Helmet mode defers the detailed astronaut and its shadow map.

Reproduce numeric checks with `node scripts/run_render_analysis.mjs` and `pnpm test`. The output `public/data/render-validation.json` records actual geometry, asset sizes and rendering-source hashes. A development-only F8 camera sweep records five seconds of active rendering; minimized/background browser throttling must be excluded. CPU draw-call submission time is not GPU time or a frame-rate guarantee.

Limitations: an overhead optical mosaic cannot reveal unobserved rock sides or centimetre detail at eye height. One metre DEM spacing is not one metre accuracy. Independent absolute registration residuals remain unknown. This is a research/education rehearsal, not certified astronaut navigation.
