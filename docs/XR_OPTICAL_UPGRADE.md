# MARS SHIFT — destination-first spatial explorer

This release retains the existing application, measured DEM geometry, constrained alternatives, Mission Control, Crew workflow, quantitative analysis and Mars Atlas. `/` is now an immersive introduction inspired by the supplied Ascend reference. `/destinations` asks for a real region and science purpose before opening `/explore`. No fictional customers, SaaS statistics, Earth oceans or city lights are copied into the Mars project.

## Interface and open-source reuse

The landing globe uses the actual [NASA Mars texture](https://science.nasa.gov/3d-resources/mars/), Viking imagery processed at USGS, credit NASA/JPL/Caltech. It is presentation imagery, not navigation geometry. Exact source, JPEG hash and orientation limits are in `public/media/mars-global-source.json`.

The MIT [Apple Design skill by Emil Kowalski](https://github.com/emilkowalski/skills/tree/main/skills/apple-design) was downloaded into `.agents/skills/apple-design`, including its license and source blob identity. This is community guidance, not an official Apple product. Applied principles include floating functional materials, visible depth hierarchy, press feedback, reversible panels, pointer/touch controls, legible typography, reduced-motion/transparency support and progressive disclosure. Official HIG references: [visionOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos), [materials](https://developer.apple.com/design/human-interface-guidelines/materials), [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Native headset input, stereoscopic WebXR and eye tracking are not implemented or claimed.

Three.js remains the renderer. Its open-source Line2/LineGeometry/LineMaterial implementations provide readable route ribbons, a subtle halo, direction chevrons and a distinct dashed return. The display offsets each direction slightly for readability; physical metrics and collision continue to use original computed cells. Decorative lines, lighting and floating controls do not add observed geography.

The map occupies the main viewport. Mission, inspection and optical review are floating panels. A visible observation-purpose chip and **Why this route?** connect science intent, route objective, measured slopes and simulated return resources. Explanations come from the selected calculated route; they never invent a quantified reduction in rockfall risk. Waypoint preview jumps the viewpoint along the planned path and is explicitly distinguished from walked distance and recorded imagery.

**Observed road view** reuses the native Mastcam-Z cube viewer at five actual recorded rover stations. It does not place camera imagery at arbitrary DEM-route coordinates or imply continuous coverage. Close/Esc returns to the planning scene.

## Automatic optical pipeline

Actual source HiRISE sampling is about 0.3 m. New georegistered evidence crops are 2000×2000 at explicit 0.5 m display sampling. Downloaded bytes, CRS, bounds, source hashes and image hashes are recorded. No enhanced imagery is represented as a new physical measurement.

V1 is a fixed classical shadow/local-contrast detector. V2 is a small histogram-gradient-boosted pixel classifier trained on the real Mars-Bench training split, using multiscale intensity, local contrast and gradient features. Threshold selection uses only validation patches. The portable model and preprocessing/export scripts are included. The site displays reproducible precomputed proposals for the two study regions; it does not run a live spacecraft camera or undisclosed remote AI service.

Each region has 150 ranked V2 candidate components. Mean model response is uncalibrated: it is not local precision, confidence, a rock-size measurement or a safety probability. The full predicted semantic mask is retained separately from geometry-filtered, spaced and capped proposal lists.

## Measured results and limits

Source: [Mars-Bench mb-boulder_seg v1](https://zenodo.org/records/15494673), CC BY 4.0. Original split: 39 train, 6 validation, 4 test. Test images have 1,000,000 pixels total. Exact file hashes and projected crop bounds do not overlap across split patches, but observation IDs are shared. This is patch-held-out testing, not observation- or region-independent generalization.

| Pixel segmentation metric | V1 shadow cues | V2 supervised follow-up |
|---|---:|---:|
| Precision | 9.42% | 29.60% |
| Recall | 16.34% | 51.93% |
| F1 | 11.95% | 37.70% |
| IoU | 6.36% | 23.23% |

V2 was proposed after observing the weak V1 test, so its test result is explicitly **exploratory follow-up**, even though fitting and threshold selection use train/validation only. Four-tile bootstrap intervals are wide: V2 F1 about 9.5–48.7%, IoU about 5.0–32.2%. These are mask-pixel overlap scores, not the precision of the selected 150 objects and not Jezero field accuracy. Component-box proxy metrics are also recorded and low. Do not promote this model as a reliable or NASA-grade rock recognizer. See [full protocol](OPTICAL_BENCHMARK.md), [baseline](../public/data/optical-benchmark.json), [V2 results](../public/data/optical-benchmark-v2.json).

## Human decisions affect one shared model

Open **Review**, filter unreviewed/all/along-route/confirmed proposals, inspect the actual aspect-preserving evidence crop and proposed footprint, and edit the physical buffer. **Confirm & reroute** adds a provenance-bearing, user-reviewed annotation, updates the 3D exclusion ring and conservative collision mask, and explicitly recalculates the three round trips through the shared store. If the buffer blocks every searched route, the application shows no feasible route rather than inventing a path. **Reject** or **Uncertain** removes any associated exclusion. Unreviewed candidates never block routing automatically.

Reviews and annotations are stored locally per region. Export includes decisions, detector identity, bounds and actual annotations. Review acceptance is not independent accuracy or recall; exhaustive, independently labeled Jezero objects remain necessary for that. Manual review is not field confirmation, and 5 m graph cells do not resolve every sub-grid boulder.

## Verification and reproducibility

84 unit/integration tests cover existing behavior and new georeferenced candidate validation, source-region mismatch, confirmation provenance, graph/collision synchronization, no-feasible-route outcomes, destination validity, actual route explanations and physical next-waypoint guidance. TypeScript/Vite build passes. Browser verification covers the real destination flow, optical evidence review and recalculation/rejection, route display, walking and waypoint preview, a real road-view station, and desktop/mobile layout. Reduced-motion/transparency rules and the existing WebGL-to-2D fallback are retained. Offline core-resource cache completeness is verified by the interface; a new offline reload was not independently exercised in this release. These are software checks, not human usability research or flight certification.

Reproduce data and evaluation using the commands in `OPTICAL_DETECTION.md` and `OPTICAL_BENCHMARK.md`. The benchmark preserves its frozen configurations, model identities, source-integrity audit and original low baseline. No test-dependent tuning is hidden. Python dependencies are in `requirements.txt`; processed results are included so web visitors do not require Python or a GPU.
