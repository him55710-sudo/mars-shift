# Methodology

## Geometry and alignment

The DEM is `cenjez_DEM_1m.tif`, CaltechDATA v2. The Mars sphere radius is 3,396,190 m; the equirectangular standard parallel is 18.4663°. All graph distances use projected metres in a 1 km ROI close to that standard parallel. Projection-scale error and source geolocation error are not quantified. Optical CRS equality is checked before reading the common bounds. The optical source window is resampled to the same 1 km footprint for display. No visual image is synthesized as terrain.

THEMIS uses the provider's MarsEC0 CRS, with a Mars ellipsoid and equatorial standard parallel. Rasterio/GDAL reprojects this into the DEM CRS using nearest-neighbor sampling. Fine display cells repeat native thermal pixels; no new spatial detail is asserted. Provider warns that the regional GIS products are registered but not quantitatively controlled.

## Terrain

For native elevation z, centered finite differences use the measured 1 m pixel spacing:

`slope = atan(sqrt((dz/dx)^2 + (dz/dy)^2)) × 180 / pi`.

Each 5 m planning cell retains mean elevation, maximum native slope, mean native slope and an 11 m local max-minus-min relief proxy. If any native cell is NoData or its slope stencil is invalid, the planning cell is blocked. Elevation gain and route distance use the mean 5 m cell elevation, not a claim to model subcell foot placement.

The exposure proxy dilates cells with native maximum slope above 25° by four grid steps (20 m in Manhattan distance). This is undirected proximity to steep terrain. It does not model cliff orientation, ballistic trajectories, rockfall occurrence or collapse timing. It is shown as a potential exposure proxy, never an event probability.

Optical imagery supports human visual inspection. There is no trained or rule-based boulder/dune classifier in this implementation. Optical obstacles are not silently invented or treated as validated passability masks.

## Path search

Eight-neighbor A* independently optimizes base→target and target→base. Step length is `sqrt(horizontal_metres² + elevation_difference²)`. The Euclidean horizontal distance is an admissible heuristic because all cost multipliers are at least one. Hard constraints are NoData, explicit exclusion circles and the configured maximum cell slope. Diagonal movement also requires both adjacent orthogonal cells to be allowed.

For average adjacent-cell mean slope s, relief r, exposure e, missing thermal coverage u and positive elevation increase dz+:

- Shortest multiplier: `1`.
- Lower-exposure multiplier: `1 + W*e + 0.035*s² + 0.20*r + 0.20*u`.
- Mission multiplier: `1 + 0.55*W*e + 0.012*s² + 2*dz+/horizontal + 0.08*r + 0.10*u`.

W is configurable (default 8). Thermal *values* are not used as physical mobility costs. Only missing supplementary coverage contributes the explicit evidence penalty u. This ROI has full thermal coverage, so that penalty is zero.

These cost functions are heuristics with transparent, uncalibrated weights. They do not produce risk probabilities. There is no claimed global optimum under coupled resource constraints: after terrain-cost optimization, each candidate is checked against mission duration and resource reserve.

## Simulated resource equations

For each segment, `effort = 1 + 0.012*s² + 0.015*loadKg + 2*dz+/horizontal`.

`travel_minutes = sum(segment_distance * effort / (speed * visibility_factor * 60))`.

`visibility_factor = 1` normally, `0.55` in the reduced-visibility scenario.

`total_minutes = travel_minutes + science_minutes`.

`oxygen_use = travel_minutes * (1 + 0.01*loadKg) + 0.65*science_minutes`.

`power_use = travel_minutes * (1 + 0.005*loadKg) + 0.80*science_minutes`.

Each remaining resource percent is `100*(1-use/endurance)`; the return reserve is the lower of oxygen and power. Endurance values are normalized simulation inputs in minutes, not verified suit specifications. A candidate needs revision if time is exceeded or reserve falls below the required percentage. Reduced visibility independently imposes HOLD/verify; a nominal budget does not authorize movement.

## Revalidation

The event center is the cell 55% along the selected outbound cell sequence, with a 35 m radius. It is labeled simulated throughout. The prior path is preserved and affected cells are identified. All three round trips are recomputed with the event as a hard exclusion. A null path means no terrain path under the current graph constraints; resource rejection is reported separately. No real multitemporal change detection is claimed.
