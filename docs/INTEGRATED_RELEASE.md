# Integrated Mission Hub release

This release combines the unified workspace and local 2D risk maps with the published terrain-focus release (`44c77e3`) and the completed research/review release (`ca6d980`). Their Git histories are retained through merge commits.

- `/` opens Mission Hub and shared navigation. `/explore` retains calibrated Navcam inspection, focused terrain controls and reviewed or simulated local sand exclusions.
- `/hazards` opens the adaptive dust-encounter rehearsal with 2D and 3D controls. `/hazards?ground=sand` opens observed NOAH-H candidate screening with 2D and 3D controls. Red overlays identify modeled risk or mapped candidates; these are not confirmed physical traps or certified safety predictions.
- `/review` and `/briefing` expose the latest evidence, limitations and presentation. Earlier studies remain accessible through archived views.
- Local Navcam and orbital NOAH-H coordinate frames remain separate. No unregistered orbital classification is projected onto the local photo mesh.

## Rendering and data preservation

The 66 native calibrated GLBs retain 1,045,833 triangles and 36,485,580 bytes. `scripts/verify_rover_display.mjs` verifies the source and packaged SHA-256 identities, metadata and transforms, including embedded photographs. No mesh or image quality reduction is used for hosting.

All experimental source files remain in Git. Hosting distributes large non-runtime traces with lossless gzip compression; `data/static-downloads.json` maps each original URL to its download and records the original byte count and SHA-256. Decompression restores the original bytes. The three multiband analysis GeoTIFFs remain unchanged in the source repository rather than in the size-limited static deployment. Public native 1 m DEM GeoTIFF downloads, runtime terrain arrays, all photographs and meshes remain available. The six linked v15 review sources and all service-worker core inputs remain directly readable and are verified during packaging.

## Validation

The integrated suite contains 54 test files and 384 tests. Release checks include TypeScript, the v15 evidence reproduction guard, the production build, static size and offline-input checks, and byte identity checks for every native calibrated photo mesh.

## Demo preparation

`demo/30s/` contains the Korean script, narration WAV files and recorder preparation. A completed 30-second video has not been captured. The previous capture attempt stopped because the native browser surface could not be verified; these preparation files must not be represented as a finished movie.
