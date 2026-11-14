# Scientific method register

Reviewed 14 November 2026 using the primary publications and maintainer documentation below. This register separates established methods, the project's adaptations, and ideas cited for context. It does not claim a new routing algorithm or operational EVA qualification.

## Sources and transfer limits

| Primary source | Relevant method | Transfer to MARS SHIFT |
|---|---|---|
| Ono, Rothrock, Almeida, Ansar, Otero, Huertas and Heverly, **Data-Driven Surface Traversability Analysis for Mars 2020 Landing Site Selection**, NASA/JPL / Caltech, [paper](https://robotics.jpl.nasa.gov/media/documents/Data-driven%20surface%20traversability%20analysis%20for%20Mars%202020%20landing%20site%20selection.pdf) | Terrain class, slope and rock cumulative fractional area feed rover mobility estimates. Sequential Dijkstra produces multi-ROI cost maps. A modeled landing-location point cloud produces distance/time distributions. | Adapt the separation of terrain evidence, mobility assumptions and graph cost. Standard Dijkstra is reused for a different round-trip problem. The rover speed tables, rock-abundance calibration, terrain classifier, landing dispersion and multi-ROI algorithm are **not reproduced**. |
| Cunningham, Whittaker and Nesnas, **Improving Slip Prediction on Mars Using Thermal Inertia Measurements**, Robotics: Science and Systems XIII (2017), [paper](https://www.roboticsproceedings.org/rss13/p38.pdf), [DOI](https://doi.org/10.15607/RSS.2017.XIII.038) | Mixture-of-experts slip models use Curiosity observations and thermal inertia estimated from ground and orbital instruments. | **Cited only.** It supports investigating thermal context, not importing a generic thermal-to-slip equation. No Curiosity-calibrated slip predictor, boot traction estimate or soil-strength measurement is implemented here. |
| Johannes J. Norheim, **Path Planning for Human Planetary Surface Exploration in Rough Terrain**, MIT MSc thesis (2018), [record and thesis](https://hdl.handle.net/1721.1/119309) | SEXTANT's Python implementation, rough-DEM path planning, integration with xGDS, and planning/navigation interfaces evaluated in terrestrial BASALT campaigns. Holo-SEXTANT was an AR technology demonstration. | **Cited only / design precedent.** The project does not reproduce SEXTANT's physiological model, field evaluation, HoloLens localization or AR registration. The browser interface is not the first EVA route planner or an operational headset system. |
| xDEM maintainers, [Terrain attributes](https://xdem.readthedocs.io/en/stable/terrain.html), [repository](https://github.com/GlacioHack/xdem) | Explicit surface-derivative definitions, several curvature conventions, windowed TPI, TRI and relief; scale and implementation choices matter. | Standard formulas are reproduced with NumPy/SciPy. xDEM is a reference, not a runtime dependency or an independently run validation unless an actual comparison is recorded in the numerical test report. |
| Whitebox Geospatial, [Terrain Analysis and Geomorphometry](https://whiteboxgeo.com/manuals/api/python/terrain-analysis.html), [Python wrapper](https://github.com/opengeos/whitebox-python) | Slope/aspect, curvature, terrain position and multiscale morphology illustrate complementary geometric descriptors. | **Cited only.** No Whitebox binary or paid workflow is required. Earth hydrology, wetness, drainage, vegetation and landslide susceptibility examples are not transferred to Mars. |

JPL's results concern its particular rover, map, objectives and assumptions. Its landing-point distribution came from a mesoscale wind model, rather than arbitrary uniformly sampled EVA parameters. MARS SHIFT's parameter simulation is sensitivity analysis under declared assumptions; it does not reproduce that landing-dispersion experiment.

## Implemented-method classification

The engineering upgrade uses this classification; exact formulas, output hashes and tests belong in the terrain and calculation reports.

| Method | Classification | Required interpretation |
|---|---|---|
| Native-DEM slope/aspect, TRI, TPI, relief and curvature | Standard methods directly reproduced | Numerical terrain shape at documented support sizes; not new observations or material properties. |
| Dijkstra on a positive-weight grid | Established algorithm directly reproduced | Exact shortest scalar cost within the specified finite graph, topology and cost model. |
| Forward and reversed-graph time fields | Standard shortest-path construction adapted to EVA round trips | Outbound and return are computed independently; return weights preserve the original travel direction. |
| Grade-, complexity- and payload-dependent edge time | Project adaptation | Declared simulation coefficients, not validated Mars EVA physiology or JPL rover calibration. |
| Time / oxygen / power budget feasibility | Project adaptation | Feasibility of modeled constraints, not certified astronaut safety. |
| Seeded parameter perturbations and blocked-route scenarios | Project sensitivity experiment | Conditional constraint-satisfaction frequency and distributions; not survival or accident probabilities. |
| Thermal-inertia / slip research and SEXTANT | Cited precedent | No performance or validation result from these sources is a MARS SHIFT result. |

## Graph and budget contract

Let `c(i,j)` be modeled minutes to traverse the original directed edge from cell `i` to cell `j`. It must be finite and strictly positive for a permitted nonzero edge. Three-dimensional length uses metre-scale projected horizontal spacing and the actual DEM elevation difference. Uphill and downhill terms may differ. Obstacles, invalid geometry, slope limits and diagonal corner constraints apply consistently to all searches.

Forward Dijkstra from base `b` yields `O(x) = min time(b → x)`. Dijkstra from `b` on the **reversed graph** yields `R(x) = min time(x → b)`: when exploring an adjacent predecessor `u` from current vertex `v`, relax with **`c(u,v)`**, not `c(v,u)`. Reversing a displayed outbound polyline is not a substitute for this calculation.

For a science stop of `S` minutes, travel `T = O(x)+R(x)`, time budget `B`, and reserve fraction `r`, the initial project resource model is:

```
T + S ≤ B
T · a(load) + S · a_work ≤ O2_endurance · (1-r)
T · p(load) + S · p_work ≤ power_endurance · (1-r)
```

Here the dimensionless consumption multipliers and endurance parameters are explicitly simulated. These monotone inequalities can be reduced to one upper bound on total travel time. Independently shortest outward and return paths therefore determine existence of a feasible pair **for this scalar, static model**. This conclusion would not hold unchanged for edge-specific oxygen/power costs, time-varying hazards, fatigue state, multiple non-monotone resources or path-history constraints. The older bounded objective-alternative planner also remains bounded; its selected route must not be called globally optimal over all resource trade-offs.

Validate finite positive speeds/endurances, nonnegative stop durations/payload and a reserve inside its stated range. A negative travel allowance means even the stationary work stop fails the assumptions. Never clamp that allowance to zero and classify the base as feasible. Modeled visibility holds remain holds.

## Geometry, missingness and scale

Use the source Mars CRS and metre units. Aspect is downslope clockwise from **projected grid north**; true planetary north may differ by projection convergence. A flat surface has no unique aspect. Likewise, curvature formulas involving division by squared gradient have undefined orientation at zero gradient; document the chosen null policy rather than selecting a hidden direction.

Profile, tangential and planform curvature are different quantities. Under xDEM's geometric convention, with `p=z_x`, `q=z_y`, `r=z_xx`, `s=z_xy`, `t=z_yy`:

```
profile = -(r p² + 2 s p q + t q²) / ((p²+q²) · (1+p²+q²)^(3/2))
planform = -(r q² - 2 s p q + t p²) / (p²+q²)^(3/2)
```

Both have units `1/m`; xDEM conventionally displays these multiplied by 100. Signs and scale factors must accompany exports and comparisons. xDEM's default surface-fit stencil can differ from the project's finite-difference stencil, so agreement cannot be assumed merely from a shared attribute name.

NoData-support masks are coverage information, not measured elevation-error standard deviations. Native one-metre spacing is not one-metre positional or vertical accuracy. Full-neighborhood requirements must mark crop edges and hole-adjacent derivatives missing; do not silently fill them. Keep derived-metric missingness distinct from observed DEM coverage. A fully mapped disconnected component is unreachable within the current graph; terrain outside the cropped graph remains unknown, and detours beyond the crop have not been evaluated.

## Optical and thermal evidence

Keep the existing experimental optical proposals, their measured benchmark and human review provenance. Pixel-mask occupancy or proposal density is an **optical-candidate proxy**, not rock cumulative fractional area calibrated like JPL's product. Proposal caps, missed rocks, shadows, texture and false detections prevent treating the displayed count as a complete boulder census. Human acceptance does not supply exhaustive independent labels or recall.

THEMIS context retains approximately 100 m native sampling. Reprojecting it to a 5 m graph or viewing it at eye level does not add physical detail. Thermal coverage percentages measure available data, not confidence in walkability. No meter-scale wheel-slip, boot traction, soil strength or calibrated rockfall probability follows from these layers.

## Validation boundary

Analytic planes, ridges/valleys, quadratics, NoData holes, blocked grids and seeded-repeat tests validate the software's numerical contract. Actual Jezero integration checks georeferencing, nonempty fields and repeatable results. They do not validate human mobility, sensor errors, physiological consumption, unresolved hazards or real-world safety. Report computed results for both study regions, preserve coefficients when comparing models, and report a negligible difference honestly.
