# Surface rehearsal and mission map

The main `/explore` view is a ground-level EVA rehearsal. A locally constructed, illustrative astronaut follows the actual native DEM at ×1 vertical scale. The follow camera adapts its shoulder offset to narrow screens; helmet view remains available. WASD/arrows or touch arrows move, drag/pointer lock looks, and the wheel changes camera distance or helmet field of view. Camera clearance samples the DEM, while movement retains the existing conservative 5 m obstacle/slope mask. The sky, lighting, crew and proposed habitat are simulated; they are not observed terrain objects.

**Expand mission map** or M opens a full-screen map. Switch between oblique 3D and a north-up 2D map, zoom, reset and orient north. A and B identify the shared start/return base and science destination. Select either crosshair and a supported point; then explicitly calculate. Until calculation, the old paths are marked as the last calculation and walking is paused. Choosing a calculated alternative synchronizes the map, surface guidance, Mission Control and Crew handoff.

Four objectives are presented with consistent colors:

|Objective|Color|Meaning|
|---|---|---|
|Fastest time|Cyan|Independently minimum directed outbound and return modeled travel time on the fixed graph; hard round-trip budgets still apply.|
|Shortest distance|Gold|Distance objective among the bounded search's feasible alternatives.|
|Safety priority|Green|Lower slope, relief and steep-slope proximity proxy cost; not certified safety.|
|Mission balanced|Lavender|The existing combined terrain effort, exposure and resource objective.|

The new scalar-time A* uses the same directed edge-time function as the forward/reverse Dijkstra feasibility engine. Its heuristic is straight-line horizontal distance divided by the maximum declared level speed. Resource use is monotone in travel time in this illustrative model, so a minimum-time pair that fails the same hard budgets cannot be rescued by a slower pair. This argument does not extend to calibrated physiology or independent edge-specific resource consumption. Other objectives retain bounded alternative search and make no global optimality claim.

The map displays actual optical, elevation, maximum native slope, local relief and thermal inertia, plus the existing quantitative scientific overlays. Color ranges and units are visible, opacity is adjustable, and 5 m contours are optional. Hazard tint distinguishes exclusions/over-limit slopes, steep-slope proximity and unknown support. Return-feasibility colors replace hazard tint to avoid ambiguous red classes: budget-feasible, over budget, blocked, disconnected and unknown. Unflagged terrain is not labeled safe.

The selected route's outbound elevation profile uses the routing grid's actual elevations and physical 3D edge lengths. Pointer or keyboard scrubbing highlights the matching terrain point. The inspection panel shows an actual 80 × 80 m HiRISE crop, coordinates, morphology and evidence classification; optical review opens the existing annotation workflow. Buffered annotations continue to affect the same 3D map, collision mask and explicitly recalculated routes.

## Resolution and interpretation

Two real 1 km Jezero study regions are retained. Fresh visitors start at the eastern ridge; an existing region preference is preserved. The source DEM is sampled at 1 m for ground following, the rendered mesh uses 2 m vertex spacing, and planning/overlays use 5 m cells. Optical display sampling is 0.5 m (the smaller cached minimap/legacy evidence crop is 1 m); THEMIS is approximately 100 m regional context. Person-height zoom does not create finer image detail. No terrain, rocks or cliffs were invented to imitate the reference illustrations.

Resources in the HUD are **planned return values**, not live measured oxygen consumption. All mobility and resource coefficients remain declared simulations. Safety-priority paths do not establish rockfall probability, soil strength or small-boulder clearance. The current baseline's existing steep-slope proximity exposure remains zero for the compared routes; a lower maximum slope is not a measured rockfall reduction.

## Verification

The web suite has 108 passing tests, including exact minimum-time agreement with directed Dijkstra, time-budget and barrier rejection, shared mode/Crew handoff, physical route-profile distances, NoData handling and mapped evidence classes. Existing movement collision, annotation and route invalidation tests remain in the suite. `pnpm build` and `pnpm science` were executed. Both-region scientific values are unchanged; engine fingerprints were regenerated after the new time objective.

Browser checks covered four route cards, 3D/2D switching, actual elevation and feasibility overlays, contours, keyboard profile inspection, selecting a new target, explicit recalculation, ground-view handoff, follow/helmet views, and a 390 × 844 mobile layout. The desktop map and mobile touch controls preserve the existing scientific and optical review tools.
