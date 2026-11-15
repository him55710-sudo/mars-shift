# Interface clarity pass — 15 November 2026

The published spatial-visor and mission-workflow release is preserved. This pass changes presentation, marker rendering and initial camera framing; it does not change terrain products, planning costs, feasibility limits or return calculations.

- Replaced the layered visor CSS with one set of graphite surfaces, consistent 8–10 px corners and one pale mint route accent. Warnings retain a separate caution color and visible text.
- Grouped destination and modeled return resources into one instrument area. Terrain readings and the NASA observation entry remain available in a native disclosure.
- Selected routes use mint; inactive alternatives use neutral gray and stay selectable by named route controls. The expanded map initially shows the selected route, with alternatives and the elevation profile available on request.
- Habitat and science target receive A/B labels and contrast backings. Orbital labels stay the same screen size as the camera zooms; label placement respects the viewport. Initial camera fit now uses the measured viewport aspect. The flat map retains backed endpoint labels. Planner pins scale with the visible map size and zoom so phone labels remain readable.
- Camera controls disclose under View. The visor keeps its labeled next waypoint, modeled position state, hazard limitations and source resolution.
- Planning uses a smaller heading, a compact decision strip, neutral route selectors, and a denser phone map legend. Raster quantities and hazard classifications retain their scientific encodings.

## Verification

- TypeScript check, production Vite build and 188 tests across 19 files passed.
- Real Chrome browser checks at 1440 × 900 and 390 × 844: visor, expandable map, 2D map, planning pins, route comparison, terrain disclosure and mobile controls.
- Both endpoint labels were checked on the first portrait map opening. Route choices remain explicitly labeled; muted alternatives are not distinguished solely by color.
- These are browser checks of a research prototype, not an astronaut usability study or operational safety validation.
