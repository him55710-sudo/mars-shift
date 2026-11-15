# MARS SHIFT — Flight Deck

15 November update: the immersive visor now uses neutral translucent panels, rounded controls and a compact spatial dock at the user’s request. `src/helmet-hud.css` owns visor styling; general deck rules must not override it. See `docs/SPATIAL_HUD_UPGRADE.md` for the reviewed references, source reuse, responsive behavior and validation. The existing instrument-deck conventions below continue to apply to analysis and planning.

Status: implemented and verified for the Flight Deck interface. See `docs/DESIGN_REVIEW.md` for evidence, test conditions and prototype limitations.

## Purpose and visual direction

Help a crew understand the next modeled action while keeping terrain visible. Mission Control explains the decision; Surface XR carries only the immediate instruction, localization uncertainty, return resources and hazard context. The visual language is an instrument deck: graphite surfaces, legible ivory text, a pale blue action color and a reserved mint route. NASA-like precision comes from evidence, aligned numbers and restrained hierarchy, not a NASA logo or fictitious instrumentation.

The imagery, elevations, route costs, exclusions and scientific classifications retain their existing provenance and definitions. A simulated sensor frame is never relabeled as an actual Martian observation. A synthetic obstacle, uncertain localization and stale sensor feed must remain visibly distinct from a surveyed hazard. Visibility loss never becomes authorization to move merely because a UI looks reassuring.

## Semantic tokens

The implementation source is `src/design-system.css`.

| Token | Value | Role |
|---|---|---|
| `--ms-void` | `#080d12` | Page and immersive surround |
| `--ms-base` | `#0d141c` | Instrument background |
| `--ms-surface` | `#121d27` | Grouped controls |
| `--ms-raised` | `#192733` | Selected and disclosure surfaces |
| `--ms-text` | `#edf2f5` | Headings, instructions, values |
| `--ms-muted` | `#a8b9c6` | Secondary labels and explanations |
| `--ms-subtle` | `#8195a6` | Supporting metadata, never the sole hazard cue |
| `--ms-line` | `#2a3b49` | Functional separators |
| `--ms-action` | `#b9d9f5` | Primary action, focus ring |
| `--ms-on-action` | `#10212f` | Action text |
| `--ms-route` | `#9ce6cb` | Accepted/active route convention |
| `--ms-warning` | `#e7b875` | Simulated event and caution |
| `--ms-danger` | `#ffad98` | Hold, rejection, unavailable guidance |

Scientific raster ramps and existing route-mode colors remain data encodings. They are not replaced with a brand color. Legends state quantity, unit and native resolution; a risk proxy is not a measured probability. Color always accompanies a label, shape or line pattern.

## Typography

Retain the existing DM Sans body, Space Grotesk display and IBM Plex Mono technical roles, with local fallbacks. Do not import Apple fonts. Display sizes: home 72/56/44 px across desktop/tablet/mobile; page heading 28–40 px; section heading 18–24 px; body 14–16 px; control 12–14 px; metadata 10–12 px. No critical control or hazard decision is communicated solely in tiny tracking-heavy uppercase text. Use tabular numbers for time, reserves, ranges, costs and coordinates. Mixed-language labels must wrap without compressing numerical units.

## Spacing and geometry

Use 4, 8, 12, 16, 24, 32, 48 and 64 px. Desktop page gutters 32 px, tablet 24 px, mobile 16–20 px. Related values share an alignment baseline. Main content and supporting controls are separated by whitespace or one separator, rather than nested cards. Corners: 4 px for labels, 8 px for controls and panels, 12–16 px for large terrain windows. Avoid pill shapes except a genuine compact status.

## Components and hierarchy

- **Navigation:** four operational destinations and a native disclosure for the mission library. Every route remains reachable. The current destination stays identified; Escape closes the disclosure and restores summary focus. On phones, labels may wrap to two lines within a 44 px target.
- **Buttons:** one visually dominant action per group, pale blue with dark text. Secondary controls use the base surface. Minimum normal target 44 px; crew primary actions retain their larger existing dimensions. Disabled state is visible and never receives a fake success message.
- **Panels:** the terrain window is primary. One narrow supporting instrument column is sufficient on desktop. Avoid an equally weighted wall of boxes. Configuration is disclosed; start/stop and the next instruction remain reachable.
- **XR overlays:** one next-action panel; a small group of return/localization values; one synchronized minimap. Opaque-enough graphite protects contrast. No full-viewport blur, animated glow, visor ornament or refraction filter over the terrain.
- **Evidence labels:** observed product, derived quantity, simulated condition and unknown must remain explicit in their existing contexts. Source details belong in the evidence view or disclosure, not repeated as paragraphs over the route.
- **Map legend:** distinguish active route, alternatives, return corridor, exclusion and measured raster. Keep units and uncertainty near the encoded quantity. Exaggeration is always a display parameter, never a changed elevation measurement.
- **Dialogs:** accessible names, Escape, contained keyboard focus, explicit confirmation of route adoption and abandoning science. Existing behavior must be rechecked after restyling.

## Motion and performance

Use 120–180 ms color/opacity transitions for interactive feedback, without adding a motion dependency. Respect reduced motion. No camera dolly, parallax, floating panels or autoplay simply for decoration. Preserve worker-based planning, lazy-loaded Three.js, geometry and renderer quality settings. Do not create a second render loop for UI animation. Benchmark real route loads and interactions; CSS token changes alone do not prove stable WebGL performance.

## Responsive layout

Desktop validation: 1440 × 900. Phone validation: 390 × 844. At ≤820 px, stack supporting analysis after the scene and avoid nested scrolling. At ≤550 px, keep simulator transport reachable, provide safe-area clearance, reduce overlay count and wrap navigation. Never hide a source or hazard limitation to make a screenshot cleaner. Crew daylight mode remains available; the default operational view uses the dark system.

## Antipatterns

No NASA/Apple endorsement badge, fake telemetry, copied Apple asset, safety percentage without a calibrated model, rainbow decoration, glow on all numbers, every datum in a card, glass over glass, horizontal navigation clipping, or instructions that depend on hover alone. No UI-only claim that obstacles have been detected from real sensors. Do not flatten measured, inferred and simulated values into identical status chips.

## Research and library decision

Read [Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials), [layout](https://developer.apple.com/design/human-interface-guidelines/layout), [visionOS design](https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos/), [design resources](https://developer.apple.com/design/resources/) and the [resource license](https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf). Adopt restrained hierarchy and comfortable grouping; copy no official assets. Web overlays use authored CSS, not a claim to implement native visionOS glass.

shadcn/ui was evaluated first: its [Vite setup](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/installation/vite.mdx) is compatible, but introducing its Tailwind/class-variant stack for buttons already present is unnecessary. [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility) informs dialog/menu review; existing native disclosures meet the current navigation need. [Motion accessibility](https://motion.dev/docs/react-accessibility) informs reduced-motion rules; no animation requirement currently justifies installation. [Magic UI](https://magicui.design/docs/installation) is suitable for optional marketing effects, which are deliberately excluded from the operational terrain window. No new UI dependency or copied component code has been introduced.

See `docs/DESIGN_RESEARCH.md` for the project comparison and license register, and `docs/DESIGN_REVIEW.md` for real screenshot evidence and verification limits.

The helmet view uses an explicit overview exit, a stable contrast band for heading/status, local opaque backings for the objective and terrain readings, and labeled simulation/position status. On phones, the exploratory inset map and Atlas terrain metrics disclose on demand; the operational map and immediate movement controls remain reachable.
