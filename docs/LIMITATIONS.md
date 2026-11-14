# Limitations

- This prototype is not certified for an EVA, rover driving or life-support control.
- The 1 km ROI is central Jezero floor, not the western delta or the current rover position. Habitat and science stops are proposed scenario points; no actual inhabited base is asserted.
- Mean 5 m cell elevations and maximum native slopes cannot resolve every rock or local walking obstacle. Source stereo artifacts and geometric registration errors can persist.
- No automated optical boulder/sand classifier, soil bearing-strength estimate, calibrated safety score, rockfall probability or prediction of imminent terrain change is implemented.
- The cliff-proximity proxy is undirected and uncalibrated. In the baseline example all three routes have zero exposure-proxy crossing distance. Their tradeoff is primarily slope and relief.
- THEMIS remains 100 m context, with unknown cross-product registration accuracy. Physical thermal values are not used for meter-scale routing or resource predictions.
- No new terrain change is observed in paired images. The 35 m exclusion is a clearly labeled simulation.
- Visibility reduction is a scenario; NASA Worldview observes Earth and is not used for Mars weather.
- Resources, speed, crew equipment effects and science-stop costs are demonstration equations, not validated human physiology or space-suit specifications. No actual O₂ units or battery Wh are inferred.
- A* is optimal for the chosen grid and transparent cost. Mission constraints are checked after terrain-cost optimization; rejection of a candidate is not proof that every alternative multi-resource plan is impossible.
- The resource model does not account for radiation, communications, localization, tides, surface temperature, astronaut fatigue/recovery, biomedical differences, vehicle dynamics, or multiple rescue assets.
- Routes are recalculated in the browser and do not persist across a page reload. Mission export captures a reviewable record. The resource/settings editor requires explicit recalculation; the UI labels previous metrics while edits are pending.
- External NASA viewers can be unavailable. Core processed datasets are bundled locally for a reliable offline-data demonstration. External fonts fall back to system fonts if unavailable.
- No claim of winning, global novelty, safety certification, or a specific award-selection advantage is made.
