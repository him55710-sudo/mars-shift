# Browser verification

Chrome on 2026-11-14, using the actual running Vite app and bundled scientific data.

| Flow | Observed result |
|---|---|
| Baseline load | Three actual round-trip candidates, expected distances and explicit simulated reserve |
| New exclusion | 12 prior cells intersect; alternate mission route is 1,945 m; change explains +99.1 m |
| Science stop to 120 min | Recalculate gives NEEDS REVISION; time-budget and reserve violations |
| Reduced visibility | Recalculate gives HOLD / verify, even when a path exists |
| Max slope to 2° | No traversable round trip, with an actionable explanation |
| Science objective select | Crater-floor target changes the mission route and metrics |
| Custom map target | Map selection produces a custom science target and point inspection |
| Thermal layer | Real coarse thermal cells, native resolution and quantitative legend |
| Mission JSON export | Actual file downloaded; parsed with 3 routes, provenance, revision and 1,846.0 m baseline |
| Evidence page | Data classification, three scientific products, five challenge resources, limitations and AI disclosure |
| Briefing | Exactly 7 slides, one visible at a time; slide 4 contains computed baseline values |
| Desktop slide layout | All seven checked; cover overflow caused by inline image baseline was fixed |
| Mobile, 390×844 | Horizontal overflow from a nowrap heading was fixed; content width is within viewport |
| Keyboard | Sliders respond to Home/End; route constraints recalculate; briefing arrow controls supported |

The browser download-event notification timed out, but the actual downloaded JSON file was present and independently parsed successfully. An HMR-only duplicate createRoot warning was resolved by separating the app component from the entry point. Neither is represented as a scientific validation claim.

Screenshots are real browser captures in `docs/screenshots/`. Full-page CDP capture was unavailable; native viewport captures were used. No fabricated screenshots or generated Mars imagery were used.

## Crew interface revision — 2026-11-14

Verified the actual crew UI in Chrome: departure checks, checkpoint progression, obstacle HOLD and explicit route adoption, visibility lock, restoration on HOLD, direct-return cancellation/confirmation and Mission Control handoff. A 390 × 844 viewport had no horizontal overflow; primary controls were 52–58 px high and map zoom controls 48 × 48 px. A local production build continued through reload, restoration and return after its HTTP server was stopped. The original public release checks above refer to the earlier analytical interface. The new published build is additionally smoke-tested after deployment and recorded in the task completion audit.

`docs/screenshots/crew-desktop.png` is a direct browser capture of the revised interface. The slide 2 example uses Crater-floor comparison; the route benchmark on slide 4 uses the original default transect. These are different deliberate scenarios.
