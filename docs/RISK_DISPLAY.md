# Red hazard areas

Sand candidates and reviewed or simulated sand exclusions use red ground shading and a red boundary on the original photo surface. Hub, Field Navigation and the orbital visor use the same warning color. Source labels still distinguish published texture candidates, user review and simulations. Color does not establish measured sinkage or soil strength. Hiding the sand overlay does not remove route constraints.

Dust encounters add a red current modeled footprint and a lower-opacity red forecast corridor to the original native material. Dashed red lines show forecast envelopes. The corridor sweeps between the valid forecast fixes using the larger endpoint envelope; this is a conservative display, not an additional measured storm boundary. It does not change planning, forecast parameters or sensor observations. Clear cells retain their original imagery, and unsupported cells remain unpainted. The calibrated terrain meshes, transforms, antialiasing and texture settings are unchanged.

`hazard-visual.ts` checks the frame's CRS, bounds and cell size before displaying a metric footprint. Invalid fixes are withheld. The local Sol 477 scene accepts its north/east frame; unregistered orbital masks are not transferred onto it. The conditional dust encounter remains explicitly labeled as a relocated simulation using published fitted parameters.

Recorded NASA movie measurements have a translucent red pixel rectangle; their forecast line is dashed pale red and remains in image pixels. The historical regional storm watch uses a solid red equivalent-area observation circle, dashed red forecast circles and a pale empirical margin. The circles represent area, not observed boundary shape. The existing geographic registration gate still withholds unverified boundary coordinates.

Tests cover current versus future footprint, swept motion between fixes, source gaps, invalid fixes, frame mismatches, moving footprints and preservation of stronger reviewed warnings. The production build separately checks all 66 native photo assets against their original SHA256, including embedded imagery and geometry.
