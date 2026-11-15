# Surface rehearsal crew asset

The new `public/models/nasa-emu-surface.glb` is a derived visual asset, based on the [NASA EMU model credited to Michael D. Carbajal](https://science.nasa.gov/3d-resources/extravehicular-mobility-unit/). It keeps the existing illustrative nine-bone walking rig, 1.85 m height and glTF local -Z forward orientation. The neutral soles sit at y=0.

Compared with `nasa-emu-web.glb`, the conversion uses the proven 4.5 mm shell-union display scale with a higher polygon budget, then trims the original space-only maneuvering frame. The compact pack, hoses and shell details are the existing illustrative surface adaptation. A small repeating woven-fabric normal map and material sheen give the pressure suit local shading detail. Hardware and the coated gold visor have distinct roughness and metalness. Vertex ambient occlusion is baked once, with no runtime screen-space occlusion pass.

The fabric normal map is author-created, not a NASA material scan. The adapted pack and walk rig are illustrations, not a NASA Mars suit design, physical model or validated suit biomechanics. No astronaut identity, agency logo or mission endorsement is introduced.

Use the [NASA media usage guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) with visible source attribution and no implication of NASA endorsement. The NASA asset page credits NASA/Michael D. Carbajal. These links were checked for this release.

## Reproduction and verification

Run Blender 5.2 in background mode with `scripts/prepare_nasa_surface_crew.py`. The script uses the existing cached original NASA GLB when present, otherwise downloads only that data file from the NASA 3D Resources repository. It emits the GLB, provenance JSON, a local editable blend and front/back neutral-light previews. It does not modify the original `nasa-emu-web.glb`.

Run `python scripts/validate_nasa_surface_crew.py` in an environment with NumPy (the bundled Blender Python is also suitable) to verify finite coordinates, triangle index ranges, fewer than 100,000 triangles, complete expected joint names, normalized skin weights, the neutral height/ground contract and embedded fabric normals. The exact measured counts, bounds and checksum are in `public/models/nasa-emu-surface-validation.json`.

The improved material requires a usable environment reflection for a convincing metallic visor; a black visor under an unlit environment is a lighting issue, not missing terrain or missing model texture. Use a sun/key light plus restrained ambient/environment illumination. Use this asset only in follow mode and dispose textures/skeletons when leaving the scene.

## Measured release asset

- 57,160 triangles, seven skinned primitives/materials and nine joints.
- 3,678,680 bytes, including one 256 × 256 repeating normal map.
- Neutral vertical bounds: 0.000315 m to 1.849973 m.
- SHA-256: `7bb3310e71a3df903aaec1e7e4157289b9330deeab80628cb3e5f0d64e3ceca9`.
- Structural validation passed. Front/back neutral-light Blender previews were inspected. The finer 2.8 mm shell-union experiment was rejected because it introduced visible shell artifacts; the released asset retains the proven 4.5 mm union and larger polygon budget. The trimmed rear helmet/collar is closed with explicitly illustrative covers.

This is an incremental NASA-derived character improvement. It does not provide motion-captured walking, individual foot IK, measured Mars suit materials or a photoreal scanned astronaut. Those should not be claimed from this asset.
