# Architecture

```mermaid
flowchart LR
  A[Published HiRISE DEM and optical] --> D[Python: verified download / range crop]
  B[Published THEMIS thermal inertia] --> D
  D --> E[Mars CRS alignment and coverage checks]
  E --> F[1 m slope → 5 m conservative grid]
  E --> G[Optical and 100 m thermal display assets]
  F --> H[Static terrain JSON + source manifest]
  G --> I[React mission planner]
  H --> J[A* outbound and return]
  K[Explicit mission assumptions] --> J
  L[Simulated exclusion / visibility] --> J
  J --> M[Geometry + resource feasibility]
  M --> I
  I --> N[Evidence export / seven-slide briefing]
  I --> O[NASA Mars Trek: existing planetary explorer]
```

The web app has no backend dependency. React/TypeScript/Vite renders locally computed routes over static scientific assets. `planner.ts` is a deterministic pure module used both by the app and tests. `preprocess.py` does geospatial work offline; `acquire.py` keeps raw data outside the source checkout. No account secrets are embedded. The goal-specific Codex quota guard is outside this application and is never deployed.

Paths `/`, `/evidence`, `/briefing` share the SPA. Static hosting must serve `index.html` for those navigation paths. Production data are local assets, so the core map does not depend on NASA service uptime during a demonstration. External NASA tools open as clearly identified context links.
