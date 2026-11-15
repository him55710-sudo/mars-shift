# Critical audit and interpretation

This audit supersedes broad interpretations of v8 gains; all v8 files remain unchanged.

## What the new evidence supports

- Frozen v8 MARS reduced mean contact from 2.2255 s to 1.4354 s on the new synthetic test: 35.5% relative to Static, 11.9% relative to V8-Nominal.
- Event-cluster bootstrap relative-gain ranges: 15.7–52.0% vs Static and 4.6–20.8% vs V8-Nominal. These are conditional simulation intervals, with exploratory secondary comparisons, not Mars population confidence intervals.
- No-contact improved only from 80/108 to 84/108 vs Static, and from 82/108 vs V8-Nominal. Most placements were already contact-free; a large relative duration reduction is not a large absolute avoidance improvement.
- The new SIPP uncertainty candidate attained 1.4401 s and 83/108 no contact, slightly worse than retained v8. Its 16.0% contact reduction / +3.7 percentage-point no-contact gain vs development-selected SIPP nominal missed preregistered 20% / 5-point gates. It is exposed only as an experimental XR option.
- Active HOLD was zero for the SIPP candidate vs 0.1296 s/placement for retained v8. Total HOLD includes waiting at a destination. Zero active HOLD does not establish that every action was optimal.
- All models returned; this cannot establish an improvement in return failure. Actual reserve breaches were zero. All 54 tight-budget cases had a planning refusal because 48 s lookahead exceeds remaining usable time late in the 180 s evaluation window. That is a horizon/termination limitation, not measured resource exhaustion. Frozen v8 was not retroactively altered to remove it.

## Why “best predictor” or “uncertainty alone helped” is not supported

Nominal SIPP selected IMM; SIPP uncertainty selected LOCAL7. Both selections used development routing loss, but their test difference combines estimator and policy differences. It is not an uncertainty-only ablation. Likewise SIPP nominal performed worse than v8 nominal on this test. SIPP supplies a more complete zero-contact time search than the endpoint bank, but that is not a promise of better decisions under an erroneous forecast. The optimization prefers a terminal near the mission/return goal; when no zero-contact path exists it falls back to the old finite candidate bank. The future-informed oracle can still lose locally, and is not an upper bound over all physically possible policies.

The useful next experiment is a separately frozen, matched-estimator ablation with event-level **new actual metric tracks**, plus resource-horizon handling shared by every arm. Reusing this test to select parameters and reporting it again as unseen would be invalid. No such follow-up result is claimed here.

## Earlier design defects confirmed directly

The v8 confirmation file has 24 wind cases at bearing −0.35, 24 oscillation cases at bearing 0, and 24 gust cases at bearing +0.35. Only wind cases use wind input, all with day 4. The day 5/6 labels on other families did not mean measured forcing was used. Deterministic family trajectories were repeated under placements and virtual sensor seeds. Thus its 72 cases were not 72 independent observed events.

V9 crosses the three bearings for every synthetic event, assigns separate truth/sensor seeds, and uses days 1/2/3 for development wind cases and 4/5/6 for test wind cases. A draft initially retained a day/family coupling; it was preserved as `protocol-draft.json` and corrected before any performance execution. `protocol.json` is the frozen experiment. Its SHA256 is recorded in both runs and selection.

New random draws are only new synthetic evidence. All six Earth analog windows and both DEMs were already seen. Wind-driven events within a day share background forcing. A 36-event cluster bootstrap does not make six reused wind windows or the assumed generator an independently sampled Mars population.

## Data and model boundaries

Actual inputs: Jezero DEM; published MEDA diameter/drift estimates 9.13 m/1.68 m/s and 18.87 m/1.91 m/s; published 60 m/19 km/h image reference; six previously downloaded Botswana wind windows. Synthetic inputs: vortex 2D trajectory, turn process, transient acceleration, radius variation, astronaut placement, metric sensor observations, walking/resource assumptions. The 0.25 s motion integration is not a measured sampling rate. DEM obstacles constrain walking, not vortex steering. No rock-scale CFD or independent sand-trap truth was validated.

The old 3 NASA movie evaluations are retrospective image-coordinate measurements; they are not fresh independent metre-level trajectory data. Neither 7200 old parameter combinations nor 108 new placements should be called independent real observations. No suit damage or headset mechanics model was added, consistent with the requested focus on escape.

## Method references

- [Phillips & Likhachev, SIPP (2011)](https://www.cs.cmu.edu/~maxim/files/sipp_icra11.pdf): safe interval search. The proof is for the stated known-obstacle problem, not these uncertain forecasts.
- [Cawley & Talbot (2010)](https://www.jmlr.org/papers/v11/cawley10a.html): selection overfitting and evaluation bias motivate freezing a selection before final evaluation.
- [Roberts et al. (2017)](https://onlinelibrary.wiley.com/doi/full/10.1111/ecog.02881): dependence-aware evaluation motivates grouping related placements.

Exa was used to review 10 search results and read 3 methodological primary sources. Physical-data sources and detailed measurements are linked in `VORTEX_V9_CRITICAL_RESULTS.md`.
