# Illustrative EVA crew avatar

`src/astronaut-avatar.ts` creates a lightweight, stylized astronaut entirely from the installed Three.js geometry classes. It adds no downloaded model, image, network request or package. Ivory suit volumes, articulated arms and legs, a dark-gold visor, orange suit accents and a rounded life-support backpack distinguish it from terrain geometry.

The figure is an illustrative simulated crew member. It is not an observation of an astronaut on Mars, a model of certified suit equipment, an obstacle, or a source of navigation or collision geometry. The DEM and conservative planning graph remain authoritative for movement. No rocks, cliffs or surface observations are created by this asset.

## Integration contract

```ts
const avatar = createAstronautAvatar();
scene.add(avatar.group);
avatar.group.position.set(worldX, actualTerrainHeight, worldZ);
avatar.group.rotation.y = cameraYaw;
avatar.update(walkPhaseRadians, moving);
```

- Coordinates are metres, Y up, with the figure facing local **-Z**. Its back and backpack face local +Z, where an over-the-shoulder camera can sit.
- Neutral helmet height is approximately **1.75 m**; neutral boot soles are at local **Y = 0**. Translation and heading are controlled by the parent terrain scene.
- `walkPhase` is a finite angle in radians, normally advanced from actual moved distance. Nonfinite values use phase zero.
- `moving=false` returns the figure to a static neutral pose. There is no idle bob, continuous sway, forced camera motion or invented forward progress.
- Walking only rotates the limb groups gently. It does not change world position, physical movement speed, terrain height, route cost or recorded walked distance.
- The scene owner disposes the geometry/materials by traversing the group, consistent with the existing terrain scene lifecycle. Materials are shared across parts; standard Three.js disposal is safe when visited more than once.

The asset uses **33 meshes, 7,144 triangles and seven shared materials**. Runtime bounds are approximately **0.825 m wide, 0.589 m deep and 1.753 m tall**; minimum neutral Y is zero within Float32 geometry rounding (about 1e-9 m). Isolated TypeScript compilation passed. A runtime structural check verified the mesh/triangle budget, actual neutral bounds, a walking pose and return to the grounded neutral pose after a nonfinite phase input.

It is intended for browser-based third-person EVA rehearsal, including reduced-motion use (call `update(0,false)` while a stationary pose is preferred). The parent scene owns visual camera verification. No headset, biomechanics or suit mobility validation is claimed.
