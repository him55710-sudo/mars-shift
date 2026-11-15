# v8 verification / delivery

Branch: `codex/abrupt-vortex-v8`, based on `be6a11c`.

- Existing v4–v7 experimental artifacts and v7 engine preserved without edits.
- Integrated the surface-evidence work from `1ca8aeb` and close inspection / complete-route camera fixes from `bbb6eb2`. Three-way conflicts were resolved retaining controlled astronaut motion, hazard overlays, and geometry disposal from v7.
- 32 Vitest files / 265 tests passed after the final lateral-direction fix. The additional final-artifact provenance regression then passed with the complete 11-test v8 file: 266 distinct JavaScript/TypeScript tests verified.
- The 6 surface extraction Python tests passed in the existing root `.venv`. The hazard-only Python environment lacks rasterio; the scientific graphics environment was used instead of silently skipping those tests.
- TypeScript build, Vite production build, and calibrated Navcam packaging succeeded. Production preview uses port 5199; development used 5198. Ports used by other sessions were preserved.
- Both lateral directions are independently screened, including a regression that mirrors the vortex's side of approach.
- Fast crossing between observations is checked through analytic segment intersection. Wind timestamp interpolation has its own regression; no row-number-as-time approximation remains in final runs.
- Original experiments, timestamp-corrected runs and final lateral-corrected runs are all retained. 270 + 432 non-Lateral runs reproduce contact, clearance, distance, HOLD and return results exactly between the latter two versions. See `reproducibility.json`.
- Final run hashes bind literal engine, forecast and protocol bytes. `.gitattributes` prevents line ending conversion of these inputs and result artifacts.
- The zero nominal-regret modification did not improve results and was rejected. The XR worker uses the original development-selected .1 uncertainty weight and .5 s nominal regret cap, represented by `PreviousV8` in the raw confirmation experiment and `MARS SHIFT` in the final presentation.
- `final/` contains the current derived summaries, CSVs, failure timelines and comparison figure. Earlier root-level derived reports describe the retained clock-corrected intermediate stage.

No external deployment, remote repository mutation, astronaut injury estimate, operational safety guarantee, or globally optimal/SOTA claim was made.

Browser QA on the production preview: an actual Jezero ridge case (confirm-068) completed return at T+180 s with zero contact. The Navcam custom placement was then paused at T+44 s; Mission Control and Helmet XR displayed the same revision 22, DETOUR route, 0.00 s accumulated contact and 277 s return margin. No browser console errors were captured. Screenshots: `../../research/vortex-v8-map.jpg`, `../../research/vortex-v8-helmet.jpg`. This custom visual check is not an additional independent validation trial.
