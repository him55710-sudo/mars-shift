# Unified first-person visor — 15 November 2026

The observed Perseverance surface and orbital Jezero EVA now start in first person. Both reuse `VisorChrome` for the heading tape, reticle and three primary actions: **Visor · Route · Layers**. The existing helmet HUD retains modeled return resources and the actual mission state. The rover HUD shows local route guidance and terrain readings without inventing suit telemetry.

## Interaction

- WASD walks; drag looks; scroll adjusts the view. Shift holds 2× rehearsal pace. The optional astronaut follow camera remains in settings.
- The same analytically integrated acceleration and braking function drives both scenes. Diagonal input is normalized. Mouse look and eye height settle smoothly; there is no artificial bob or roll.
- Shift changes interactive preview displacement only. Route costs, simulated resource assumptions and declared planning speed are unchanged. Orbital consumption continues to be accounted from accepted movement by the existing navigation store.
- Every displacement still goes through the existing swept terrain collision checks. Exclusions, missing observations and slope limits remain authoritative. Blocking, blur, a hidden document or an open settings panel stop the movement state.
- The large map returns to the crew's position and viewing direction. Orbital camera memory survives the map's scene unmount. The rover map also restores the visor field of view.
- The selected route, waypoint, map and ground markings use the same computed result. A/B endpoint labels and the concurrent mission-map readability improvements are retained. Detailed science, observations, alternate routes and simulated dust remain available through the corresponding panels.

## Verification

- `pnpm test`: **21 suites, 200 tests passed**. Six new motion tests cover 30/60/120 FPS consistency, acceleration, diagonal speed, boost scaling, braking/reset, swept collision at boost speed and damped look.
- `pnpm build`: TypeScript and production Vite build pass.
- Browser interaction checks at 1280 × 720 and 390 × 844: default first-person view, no eagerly loaded astronaut asset, normal/Shift walking, paused panel input, route selection, map round trip, orbital Shift movement, camera restoration, touch layout and settings sheets.
- A 1.5-second native input hold moved approximately 0.87 m normally and 1.73 m with Shift on the observed surface. These are interactive timing checks, not physiological speed measurements.
- A five-second development-browser rotation measured 301 frames / 5.0032 seconds (60.16 FPS), at DPR 1.25 and 1280 × 720. This is one desktop observation, not a performance guarantee across devices. Rendering remains demand-driven when the camera and crew are stationary.
- The planning engines, collision kernels, terrain rasters and original NASA surface assets are byte-unchanged from the starting release. Visual camera interpolation does not modify authoritative crew coordinates.

This is a browser-based rehearsal HUD, not a certified astronaut navigation display or a new headset/WebXR implementation. Observation gaps and unresolved surface details remain limitations of the source data.
