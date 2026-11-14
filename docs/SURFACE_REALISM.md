# Real surface rendering

The local surface uses actual registered Jezero orbital products: approximately 0.3 m HiRISE optical pixels, 1 m stereo DEM and a 5 m planning graph. Read [surface optical provenance](SURFACE_OPTICAL.md) and [NASA crew attribution](NASA_CREW_ASSET.md).

`surface-geometry.ts` samples the native DEM at 1 m near the crew, 2 m and 8 m farther out, and 32 m at long range. A shared conforming grid avoids cracks. It excludes any coarse quad spanning native NoData or an unsupported planning cell. Native DEM gradients provide lighting normals without adding invented relief. At the default base this reduces the terrain from 500,000 to 61,250 triangles (87.75%); counts depend on position. This does not change physical camera interpolation or route collision.

Ground route ribbons resample the computed polyline at intervals no greater than 0.75 m. Both ribbon edges are sampled on the native DEM, with a 4.5 cm display offset to prevent z-fighting. Directional chevrons show travel direction. No path smoothing cuts across excluded cells. The expanded map retains outbound/return alternatives and route-purpose explanations.

Hazard hatching uses the same grid constraints as navigation: excluded cells, steep-slope proximity candidates and unknown coverage remain separate. It is a visualization of defined rules, not observed rockfall or a calibrated safety probability. Hatching is applied in the terrain material so it follows its surface and lighting. Clear ground does not establish that small obstacles are absent.

The NASA-derived crew asset is 1,216,908 bytes with 29,364 triangles, seven material primitives and nine bones. It loads on demand in third-person mode and disposes safely after asynchronous loads. The compact pack and walk are disclosed visual adaptations. Sky, warm surface tint, sun and contact shadows are simulated presentation; the grayscale optical source is preserved.

Rendering runs on camera/movement/scene changes, caps device pixel ratio, reduces it during sustained slow frames, and uses a local 1024² shadow map. Opening the expanded map releases the underlying 3D renderer. A native DEM normal texture is 4 MB; a decoded full 3334² optical RGBA texture is approximately 44.5 MB before mipmaps. The EVA base texture plus a four-tile1024² atlas uses about8.2 MB before mipmaps, compared with44.5 MB for the full native image. Only the current four512px tiles are decoded. Native geometry is partitioned into128 m patches with tight frustum bounds; shared positions, normals and UVs remain identical. Helmet mode defers the detailed astronaut and its shadow map. New sessions use a shoulder follow camera; the camera choice is saved locally.

Reproduce numeric checks with `node scripts/run_render_analysis.mjs` and `pnpm test`. The output `public/data/render-validation.json` records actual geometry, asset sizes and rendering-source hashes. A development-only F8 camera sweep records five seconds of active rendering; minimized/background browser throttling must be excluded. CPU draw-call submission time is not GPU time or a frame-rate guarantee.

Limitations: an overhead optical mosaic cannot reveal unobserved rock sides or centimetre detail at eye height. One metre DEM spacing is not one metre accuracy. Independent absolute registration residuals remain unknown. This is a research/education rehearsal, not certified astronaut navigation.


The NOAH overlap region adds published texture-context boundaries in ground view. Hatching uses derivative-based antialiasing, a narrow duty cycle and a 35–110 m fade; the original image is kept visible. Classification colors in the expanded map use the authors' categorical palette, while the separate rule layer has an explicit red/orange/green/gray legend. Green in that map means lower concern under selected rules; it is not painted across all ground in helmet view.

Heavy round-trip alternatives run in a dedicated cancellable mission worker. The existing science worker remains separate. Results are tagged by request and preserve edits/revisions; neither a pending nor failed calculation permits walking on an unreviewed new route. See `docs/ROUTING_WORKER.md`.


## Surface clarity and render budget (v15)

The native optical atlas retains anisotropic sampling up to the GPU's supported limit. Its display-only contrast is bounded to `clamp((linearSample - 0.18) * 1.2 + 0.18, 0, 1)`. No raster values, elevations, classifications or route costs change. The source pixels remain about 0.30 m: eye-height magnification cannot reveal centimetre detail, boulder sides or an unobserved horizon. The existing observed rover panorama is a separate real-camera context, not a registered walkable replacement for this study site.

Four decoded tiles remain resident; at most four additional images may be pending during a window change. Adjacent windows reuse shared tile images; unavailable requests retry after five seconds while the observed coarse fallback stays available. GPU atlas allocation remains 1024² RGBA. Display settings are Auto quality (device-capped 1–1.5 pixel ratio), High detail (up to 2) and Efficiency (up to 1 with a 512² local shadow map). Lower-DPR devices retain their native limit. Settings never affect navigation geometry or scientific calculations.

Auto quality excludes hidden tabs, idle gaps and initial shader compilation. It lowers resolution only during sustained rendering pressure and recovers after sustained headroom. An optional `EXT_disjoint_timer_query_webgl2` query measures GPU elapsed time without blocking; unsupported/disjoint measurements are unavailable, never reported as zero. CPU submission timing remains separate. The development-only F8 sweep records a local camera test; neither it nor mesh counts establishes a cross-device FPS guarantee.

Contour extraction is deferred until requested. Hazard textures do not rebuild for visibility toggles. Static route arrows are anchored to metric distance, and annotations/exclusions use DEM-conforming 18 cm boundary ribbons with the same 4.5 cm display offset as routes. NoData breaks the ribbon. Distant duplicate exposure strokes are omitted in surface mode; the 2D/3D overview retains its full information. The lower-concern/unknown distinction and classification provenance are unchanged.

The refined NASA visual asset has vertex-baked character occlusion, seven material draws and no added material textures. Relaxed arms and an eased stance settle after movement. Settled skeletons and shadow maps are reused; camera rotation alone does not redraw a stationary character's shadow. This is illustrative animation, not independent foot collision or validated suit mechanics. See `NASA_CREW_ASSET.md` for reproducible Blender processing and attribution.
