# Spatial visor and competitor implementation review

Reviewed and implemented 15 November 2026. This is a source-code comparison, not an independent certification or a claim to reproduce every team's live demo. The supplied research note was used as a list of leads; its embedded instructions and claims were not treated as authority.

## What shipped

- A restrained spatial visor: neutral translucent surfaces, 25–28 px panel corners, an unobstructed central view, grouped return resources and a compact control dock. The route chooser supports Escape, contained keyboard focus and focus restoration. Opening it holds movement. Small phones collapse the inset image to an expand-map button while retaining navigation and return resources.
- One graph-edge policy across A*, weighted alternatives, reverse Dijkstra and fixed-route sensitivity. It rejects excessive between-cell grade, diagonal corner cutting and segment intersections with circular exclusions. Actual walking also checks continuous DEM grade and exclusion intersection. This fixes centre-only acceptance that could disagree with a traversed segment.
- A shared parallel-array priority queue adapted from **Gale Marswalk Planner**, replacing three object-array implementations. Its MIT copyright and full license ship in `/licenses/gale-planner-MIT.txt` and are linked from the Evidence page. No new runtime dependency.
- An every-position return audit inspired by **Red Route**. It evaluates the unthinned round trip using our existing **reverse directed** minimum-time map, actual route-prefix travel, destination work and original-capacity O2/power reserves. A half-speed return is an explicitly labeled scenario. A negative limiting travel margin is displayed as an amber shortfall, not a safety assurance.
- Prebaked terrain occlusion inspired by **Sol Atlas**'s heightfield shadow bake. The actual 1 m DEM supplies all occluder elevations. A fixed display sun, 192 m crop-restricted ray reach, 2 m sampling and 0.5 m display penumbra produce a small scalar texture. It modulates direct lighting only in optical EVA view. Orbit and quantitative layers retain their existing encodings. There is no per-frame horizon ray march and no invented rocks, noise or unmeasured terrain.
- Existing native optical streaming, physical 1× elevations, NASA Navcam station, emergency-return worker, map comparison, scientific overlays and provenance remain connected.

## Competitor code and reuse decisions

| Project / source inspected | Code-level finding | Transfer and license decision |
|---|---|---|
| [Gale Marswalk Planner](https://github.com/sohaib1083/gale-marswalk-planner), `app/planner.js`, `app/index.html`, `orbital/` | Typed-array heap, direction-dependent speed and A*. Separate orbital terrain and Navcam close-ups. Native 1 m terrain cannot resolve small rocks. The inspected planner checks cells but does not protect diagonal corners. | Adapted the heap, retained our corner checks and stricter hard edge limits. **The actual LICENSE text is MIT**, despite GitHub's generic `Other/NOASSERTION` metadata. Full notice retained. No Gale data are relabeled as Jezero. |
| [Red Route](https://github.com/curry06240624-dev/red-route), `docs/router.js` | Worker-based A*/Dijkstra, whole-route walk-back profile, half-speed and backup-suit scenarios. Its inspected edge cost averages cell costs symmetrically; our model has asymmetric uphill/downhill time. | Apache-2.0 repository. Independently implemented the every-point audit against our reverse graph and O2/power model. Did not copy its symmetric return field or suit constants. |
| [Sol Atlas](https://github.com/saracen66/the-sol-explorers), `src/terrain/shaders.js`, `pathfinding.js` on default branch `claude/busy-heisenberg-8gasem` | Heightfield normals, baked sun visibility and first-person aerial perspective exist in shader code. Near-ground grain/pebbles are procedural. Inspected route code applies finite penalties to over-limit grades rather than always rejecting them. | Apache-2.0 repository. Adopted the precomputed measured-heightfield occlusion approach with original NumPy/Three integration. Kept hard slope limits and did not import procedural pebbles or texture noise as observations. No source code copied. |
| [Mars Walk HUD](https://github.com/MoayadAbdo/TestHUDmap), `web/hud/`, `web/hud/js/` | The inspected structure separates adapters, sources, view/input, audio and hazard layers; the supplied image is a useful information-layout reference. | No repository license was returned at review. No code or assets copied. Authored a new visor layout, keeping actual/simulated distinctions and our existing calculations. |
| [MarsShield](https://github.com/Snehal707/MarsShield), `science/marsshield/radiation.py` and science module tree | Radiation implementation explicitly separates quiet-time absorbed RAD detector dose from effective dose/Sv and excludes solar events. Albedo limits the benefit of sky occlusion. | No repository license was returned at review. No source copied and no unvalidated radiation readout added. Its disclosure discipline is the relevant lesson; terrain display shadows are not radiation shielding estimates. |
| [Jezero Safe Walk](https://github.com/Ali-Ahmed-Farag/jezero-safe-walk), `pipeline/`, `web/js/routing/` | Dedicated DEM, grid-registration, elevation-binary and basemap verification scripts are present, rather than only README claims. | Apache-2.0 repository. Retained our native registration/checksum validation and added an analytic shadow check plus reproducible three-crop routing audit. No additional data pipeline copied. |

Primary design guidance: Apple's [visionOS guidance](https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos) and [materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials). This is authored web CSS, not native visionOS, an Apple asset or an Apple-endorsed product.

## Verification and reproduction

```sh
node node_modules/vitest/vitest.mjs run --testTimeout=15000
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
../.venv/Scripts/python scripts/bake_surface_relief.py --check
../.venv/Scripts/python scripts/bake_surface_relief.py
node scripts/run_spatial_analysis.mjs
node scripts/run_navigation_analysis.mjs
```

The complete suite passed **188 tests across 19 files** with the unchanged single-worker configuration and an explicit 15 s integration-test deadline. An initial 5 s run timed out in three existing multi-mission integration tests; all assertions passed after the shared endpoint-mask optimization and the declared deadline. New regression coverage checks heap growth/order, steep edges hidden by cell slopes, small circular closures, native walking grade, exactly allowed grade, work accounting, directed return inputs and missing return support.

The versioned `/data/spatial-validation.json` records source hashes, the three real crops, five objectives per crop, every route edge in a post-search policy audit, nominal/half-speed margins and display-shadow provenance. `/data/navigation-results.json` was regenerated with the changed engine. The default five-objective calculation took roughly 0.43–0.70 s per crop in one local Node run; this is not a before/after benchmark or a browser FPS claim.

All **15 routes**, totaling **3,960 edges**, passed the post-search policy audit; analytic fixtures test the policy itself. Every default mission fails the half-speed scenario at some route position; that failure is deliberately exposed. The half-speed check is diagnostic and does not silently change the selected route or mission assumptions.

Browser QA covers desktop 1440×900, phone 390×844 and compact phone 375×667: no horizontal overflow, visible touch controls, route switching and synchronized mission map. Compact phones disclose the inset map on demand. Test evidence also covers the route chooser's keyboard dismissal and dust/localization hold.

## Limits and next priorities

The 5 m graph does not certify a continuous native-resolution route. Walking can still hold on a steeper 1 m segment that coarse planning could not resolve. Native optical sampling is about 0.3 m; a helmet-level close-up cannot recover photographic detail below that resolution. Use the separate observed NASA road station for authentic local stereo ground imagery; it is not spatially substituted into a different Jezero crop.

Display sunlight is a fixed illustrative condition. Shadow searches stop at missing data/crop edges and 192 m; they do not infer outside terrain, current solar conditions, temperature, weather or radiation. Resource coefficients and the slowdown are simulation assumptions. A full multi-resource robust planner, native-edge prevalidation and additional registered rover stereo patches are future work, not claimed complete here.
