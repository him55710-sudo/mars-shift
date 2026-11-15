# Judge walkthrough — mission value and the way home

Reviewed on 2026-11-15 using the deployed public v17 app, then the revised app through the same browser controls. This is an engineering/heuristic walkthrough from a first-time judge perspective, not a study with recruited judges or astronauts.

## Findings and changes

| Observed friction | Resulting behavior |
|---|---|
| Home said “choose your next step,” making the distinctive decision hard to identify | Home names five round-trip objectives, modeled return reserve and revalidation; the main action is **Plan a mission** |
| Destination button said “plan route” but opened directly in a helmet | Its label now says **Open 3D explorer**. Mission planning is a separate, explicit primary entry |
| Important return numbers were below the initial planning view | A single decision strip shows the selected objective/region, round-trip distance, time against budget and simulated reserve against the minimum. Stale calculations show dashes and a recalculation state |
| Changing region required leaving the planning flow | Study region is selectable directly in mission setup; the existing per-region mission store and calculations are reused |
| A simulated exclusion disabled crew handoff without an approval action in planning | Review links point to the changed-route evidence. **Accept revised plan** uses the existing adoption action and remains disabled for stale or infeasible plans. Departure review unlocks only after acceptance |
| A completed mission did not summarize science achievement alongside return | The completion view now displays science minutes achieved/planned, mission minutes used/budget and modeled return reserve/minimum |
| The independent hazard simulator could be mistaken for continuation of the crew mission | Navigation calls it **Hazard rehearsal**, and its context explicitly says the mission plan is unchanged |

## The visible mission path

**Choose science → Compare round trips → Review/accept changes → Departure checks → Traverse → Science → Return review → Habitat result.**

The first four are shown on the home workflow and planning view. The crew view retains its existing phase indicator and manual checkpoint controls. No tour overlay or forced onboarding is introduced. NASA terrain, thermal context, simulations and uncertainty retain their existing meanings.

## Actual browser task completed

Eastern Ridge, Surface texture transect, mission-aware objective:

1. Opened planning and inspected the five objective alternatives and return assessment.
2. Injected the existing simulated 35 m exclusion. Confirmed departure was disabled while approval was pending.
3. Followed the replacement link, accepted the revised plan and opened departure checks. The crew received the revised 1,823 m round trip.
4. Reviewed all three departure checks and started the rehearsal.
5. Advanced **12 outbound checkpoints**, reaching the science site at simulated T+00:33.
6. Marked the three science notes and logged **20 minutes** of science.
7. Reviewed the return estimate: about **33 minutes** from the science site and **38%** modeled reserve at habitat.
8. Confirmed return and advanced **12 return checkpoints**. Reached habitat at simulated **86/110 minutes**, with **20/20 science minutes**, modeled O2 about **42%**, power about **38%**, and the lower reserve about **38%**, above the **25%** requirement.

These are results of this declared simulation case, not measured suit performance, certified navigation, or a success rate. No physical motion or live telemetry was tested.

Phone checks at CSS 390 × 844: the new primary action is visible on home; planning shows the decision, distance/time and reserve; switching to NOAH-H changes region context and recomputes its own plan. No document-level horizontal overflow was observed in the inspected states. Existing numeric engines and datasets are unchanged by this UI pass.

## Evidence and release checks

[Before planning](judge-evidence/before-planning-desktop.jpg) · [After planning](judge-evidence/after-planning-desktop.jpg) · [Before change review](judge-evidence/before-change-review.jpg) · [After change review](judge-evidence/after-change-review.jpg) · [Completed mission](judge-evidence/completed-mission-desktop.jpg) · [Phone home](judge-evidence/after-home-mobile.jpg) · [Phone planning](judge-evidence/after-planning-mobile.jpg).

The publication workflow runs the existing Vitest suite and TypeScript/Vite build on an isolated checkout containing only this UI change and the published v17 engines. Separate, unfinished dust-research edits in the shared workspace are preserved and excluded. No UI dependencies are added. Scientific assumptions, route algorithms and evidence classifications are not rewritten.

## Additional failure and release check

On NOAH-H, reducing the mission duration to 20 minutes first replaced summary metrics with dashes and disabled departure. After recalculation the summary said **Revise before departure**, with no feasible trip and departure still disabled. Restoring 110 minutes recovered the normal calculation. The isolated release passed **181 tests in 18 files** and a TypeScript/Vite build. The offline cache version is advanced for the new shell; no forced reload is introduced.
