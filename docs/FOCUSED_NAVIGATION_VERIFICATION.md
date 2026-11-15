# Focused navigation verification — 2026-11-15

- Source: focused native terrain inspection merged with the latest red-risk overlays (remote 0830819).
- Tests: 299/300 passed in the combined run; the remaining EVA route-freeze test exceeded its 5 s timeout during the concurrent build. Its complete 22-test file passed when rerun alone. All 300 distinct tests passed.
- Production build: TypeScript, Vite, static packaging, and native rover display verification passed. Static output: 254.96 MiB.
- Browser desktop: native-point focus reaches 145 m; + controls stop at 80 m; native detail atlas and detailed geometry activate. Candidate inspection leaves mission target, route and worker revision unchanged.
- Mission and layer disclosures retain the camera and planning state. Escape closes candidate details, then the panel; focus returns to the disclosure button.
- Comparison opens and switches Shortest/Balanced correctly, then collapses. Default markers are hidden; the layer checkbox restores them.
- Expanded map fills the viewport and retains essential route/resources. Escape restores normal layout and keyboard focus.
- Mobile 390 x 844: no horizontal overflow; panels flow below the map; expanded map retains route summary. Temporary viewport override reset.
- No browser console errors in the verified local flow.
- Physical limits: close inspection uses existing 1 m measured heights and the registered image tile atlas; no synthetic rocks or invented detail added.