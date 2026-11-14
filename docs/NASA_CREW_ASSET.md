# NASA-derived crew visualization

The detailed walking figure reuses [NASA's Extravehicular Mobility Unit 3D model](https://science.nasa.gov/3d-resources/extravehicular-mobility-unit/), credited to **NASA / Michael D. Carbajal**, from the [official NASA GitHub mirror](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Extravehicular%20Mobility%20Unit). It replaces the earlier primitive suit after loading. It is an adapted visualization of a historical EMU model, not an observed astronaut on Mars, a current Mars suit design or validated EVA biomechanics. Use follows the [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/); NASA does not endorse this project.

`scripts/prepare_nasa_crew.py` runs with the installed Blender 5.2.2 LTS in background mode. It downloads the GLB as data when absent, imports the real NASA geometry, removes redundant internal visor layers, unions overlapping legacy shells at a 6 mm **asset processing** scale, and reduces polygons. The 6 mm value describes the synthetic character asset; it says nothing about terrain resolution. Seven consolidated PBR materials retain the white pressure suit, gold visor, dark seals, metal hardware and colored safety bands. Branded texture patches are removed. The original space-only external maneuvering frame is removed, its rear cut capped, and a compact beveled illustrative PLSS pack is added between shoulder and waist. The pack has a dark inset panel and an unbranded safety band. These are disclosed visual adaptations.

The source contains **343,455 triangles** in 25 material slots. The delivered GLB contains **23,238 triangles**, **seven material primitives** and **nine bones**, with approximately 11,634 Blender vertices. It is 852,596 bytes; exact source/output sizes and SHA256 identities are in `public/models/nasa-emu-web.json`. No runtime Draco decoder is required. Its neutral rendered height is approximately 1.85 m, sole height differs from zero by less than 0.1 mm after processing, and local −Z faces forward in Three.js.

The nine-bone skin and procedural walk are illustrative. The legs and arms receive fitted regional weights; rear life-support hardware remains attached to the torso. The animation is driven by traveled distance, with no animation work when idle. It does not model suit joint forces, physiological effort or collision clearance. Terrain collision and route planning continue to use the DEM and existing planning masks.

`createAstronautAvatar(loadDetailed = true)` retains the synchronous `{group, update}` interface and adds `load()`, `ready` and `dispose()`. Passing `false` skips model decoding and requests in orbit-only scenes. `load()` is idempotent. Once its promise resolves, render the scene so a standing figure also updates without movement. Disposal removes and frees loaded/fallback geometry, materials and skeletons; a late GLTF response is disposed rather than attached to a departed scene. Network failure retains the small illustrative fallback.

Reproduce with:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python scripts/prepare_nasa_crew.py
```

The source download and reviewed front/back preview renders are outside the repository under `../research/realism/`. An editable `MARS-SHIFT-NASA-EMU.blend` is saved under `../deliverables/`. The script starts an isolated empty background scene and does not modify a user's open Blender scene. The GLB was parsed with the same Three.js GLTFLoader used by the app; seven meshes, 23,238 triangles and nine bones were verified, along with physical bounds and successful TypeScript compilation of the avatar module. Front/back Blender renders were visually inspected.
