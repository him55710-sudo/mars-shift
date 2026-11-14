# Crew workflow

The primary user is a crew member making the next EVA decision. Detailed route comparison belongs in Mission Control; the default view carries one selected mission into the field rehearsal.

## Operating sequence

1. **Prepare:** review the objective, full round trip, resource margin and three departure acknowledgments. “Review departure checks” focuses the checklist; departure remains gated by completion and modeled feasibility.
2. **Traverse:** show a roughly 75 m checkpoint, planned bearing, remaining distance, direct return time, projected end reserve and time margin. The local map follows the crew/checkpoint pair; a separate overview shows the full route. Position changes only by explicit simulation controls.
3. **Science:** record three local task marks and advance modeled science in five-minute increments. Spent time, O₂ and power accumulate. Notes survive session restoration and are included in the local JSON report.
4. **Return:** review a newly computed direct route from the current simulated position. Confirmation ends the remaining science plan. Incomplete science is labeled ended/skipped, never checked off as completed. Reaching the habitat ends the rehearsal.

HOLD is always available during an active rehearsal. A simulated obstacle creates a 35 m exclusion ahead, blocks movement and requests position/buddy verification. A candidate can be compared while held; it is not adopted automatically. Infeasible or missing paths remain explicit. The single-exclusion prototype prevents a second scenario from replacing an existing exclusion. Reduced visibility remains held until the scenario is restored and local acknowledgments are repeated. A browser reload offers restoration on HOLD, with resource use preserved.

## Human-factors rationale

NASA's [Crew Interfaces reference](https://www.nasa.gov/reference/10-0-crew-interfaces-vol-2/) informed these design decisions:

- **V2 10113:** present directly usable return time and remaining margins; avoid making the operator calculate them from several screens.
- **V2 10020:** label missing telemetry, unknown observation dates and offline readiness explicitly.
- **V2 10080:** confirm changes that abandon science or replace a route.
- **V2 10153:** keep rehearsal mode visible; isolate scenario manipulation from ordinary movement controls.

The [NASA PersEIDS research paper](https://ntrs.nasa.gov/api/citations/20230007488/downloads/ICES%202023%20PersEIDS.pdf) motivates local EVA decision support under communication latency. The adjustable 4–22 minute one-way delay is a scenario, not a live ephemeris calculation or actual communications link. Earth support cannot be assumed immediate.

Daylight contrast, 48 px or larger primary touch targets, large checkpoint values, persistent HOLD/return controls, text plus color for alerts, and keyboard-contained dialogs support reduced attention and limited dexterity. On small screens the next action and HOLD procedure precede the map. Supporting evidence, event history and model controls remain available through separate dialogs.

These are design choices inspired by guidance. No NASA compliance, astronaut validation, glove testing, pressure-suit suitability or certified navigation capability is claimed. There is no GPS, suit telemetry, terrain change detector, current weather feed or Earth-message transmission.

## Offline behavior

Production builds install a service worker that stores the shell, hashed JS/CSS and six terrain products. “Map saved offline” appears only after those entries are verified. A first online load is required. External fonts fall back to local fonts; external NASA explorers and the PPTX are not cached. A new worker waits for old clients to close, so an update does not reload an ongoing rehearsal.

The crew session is local browser storage. Its source-region fingerprint, routes, cursor and resource values are checked before restoration. The bounded event log and local report are rehearsal records; the app does not transmit them to a habitat or Earth. The model and terrain limitations in `METHODOLOGY.md` and `LIMITATIONS.md` still apply.
