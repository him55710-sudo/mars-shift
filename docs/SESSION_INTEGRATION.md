# Integrated session and repository handoff

The NASA workspace now contains one source application: Crew view at `/`, Mission Control at `/planning`, optional Terrain Lab at `/terrain`, evidence at `/evidence` and the seven-slide briefing at `/briefing`.

The published crew revision was c3cd4d7c7de73875cbba543db3af00a85a3edd65. Its crew engine, navigator and offline hook are retained. Terrain Lab work from the primary workspace is integrated with its tests, provenance and documentation. Three.js is a lazy-loaded analysis dependency; it is not required to plan a mission or use Crew view. The release checkout's package removal is superseded by the integrated manifest, which intentionally includes the optional analysis dependency.

## Reproduce

Use Node 22.18 or newer and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`, then `pnpm preview`. Existing processed NASA products are included; no API keys or terrain generation are required.

## Usability evidence and limits

40 app tests pass (routing, crew state and terrain analysis), including exclusion persistence through restoration. TypeScript and Vite production build pass. Direct Chrome interaction checks 2D/3D switching, thermal layer selection, coordinate 10/20 inspection, restoration of that selection after leaving and reopening Terrain Lab, Mission Control handoff, crew checkpoint progression and mobile horizontal overflow.

Prior crew validation includes HOLD/verify/compare/adopt, early return, reduced visibility, and offline server-stop restoration. Terrain-specific numerical definitions and earlier browser QA coverage are in TERRAIN_LAB.md. These are software/interaction checks by an agent, not a human participant study, glove test or NASA certification. The downloadable presentation records an earlier validated baseline; its test count is historical.

Local screenshots/downloads, credentials, dependency folders and build output are excluded from Git. The GitHub repository is private. The live Sites release and GitHub main are separate destinations; GitHub push alone does not update the hosted Site.

Mobile check at 390 x 844: no horizontal overflow; HOLD/return buttons measured 52 px high and checkpoint confirmation 58 px. The selected 2D thermal cell 10/20 survived leaving/reopening Terrain Lab. A development hot-refresh reconnect error was observed during source updates; production is checked separately from hot refresh.
