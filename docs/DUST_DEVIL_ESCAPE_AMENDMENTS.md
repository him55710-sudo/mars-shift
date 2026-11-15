# Interpretation corrections after execution — 2026-11-15 KST

The original protocol is retained with its original SHA-256. No weights were tuned.

- The 22 Table S3 rows were reacquired from the original publisher repository and their MD5
  verified. Cross-checking against `observations.json` revealed that ALL 22 central diameter/speed
  values were already in the v1 catalog. They are **not 22 new independent observations** or
  a new event holdout. The phrase "22 new" in the preregistration/initial output is incorrect.
  The 198 trials test new encounter geometry, warning and reaction timing using known events.
  v4's weights were frozen on the separate Bickel development catalog, but historical event
  exposure still prevents claiming these events as unseen throughout the project.
- The geometry sweep uses R=diameter/2+2 m. Terrain comparisons deliberately leave frozen
  v4 unchanged, hence R=diameter/2+1 m. The original protocol did not explicitly restate this
  second padding. Report the two assumptions separately; do not compare them as the same test.
- The ideal oracle has perfect true state, open flat terrain, and speed 0.6 m/s without the
  terrain/load slowdown. A feasible oracle path with a controller failure is an opportunity
  gap, not proof of a planner bug or of feasibility on the real DEM.
- Seven of the 22 geometries per warning are stationary near misses. Report the remaining
  15 threatening cases separately so the near misses do not inflate avoidance success.
- Warning confusion tables describe correlated simulated forecast windows at a stationary
  reference point. First-six-second unavailability and currently-inside windows are counted
  separately. They are neither independent encounters nor measured Martian collision rates.
