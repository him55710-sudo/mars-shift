# Existing-observation backtest and astronaut visor

Full Korean report, source links, frozen protocol, data and results:
[Recorded-data validation](../public/data/hazards/observed-v11/report.md).

Three previously studied NASA image clips were rotated through model-selection, interval-calibration and evaluation roles. Causal rolling predictions evaluate future image measurements at 1/2/3 frames. The selected robust trend improved equal-clip mean RMSE by 1.95% but worsened two clips and failed coverage criteria. No model promotion.

108,063 archived pressure samples from MEDA Sol 57/215 were replayed against published Table S2 event times. Selection used Sol 57; evaluation used Sol 215. Both legacy and selected candidate detected 1/3 eligible ≥0.5 Pa events over 13.361 common evaluation hours. Missed-event diagnostics identify low causal contrast and the consecutive-detection requirement. Unmatched alerts are not proven false alarms. Pressure-centre lead is not remote boundary warning.

The scene remains actual Navcam geometry with synthetic navigation. The new visor HUD is isolated from the existing HelmetHUD/EVAExplorer styles. Screen-fixed visor markings, resource clocks and localization status accompany the same world-fixed route used by the map. Image-pixel validation is not converted into metre-scale navigation assurance.

Tests: 35 files / 284 passed, including new chronology, analytic trajectory, coordinate-scale, frozen-detector parity, gap and matching checks. TypeScript and production build passed. Existing v10/v9/v8 scientific inputs and outputs remain intact.

Browser verification on the production preview at `http://127.0.0.1:5204/hazards` used the Computer Use tool. Desktop and 390×844 layouts rendered the recorded Navcam surface and helmet HUD. At model time 24 s, switching between visor and route overview retained frame 12, boundary arrival 1.8 s and return margin 288 s. The evidence panel loaded the three measured image errors and the failed pressure gate. No browser console errors were recorded. Temporary viewport overrides were reset.

Screenshots are in the parent workspace: `research/v11-helmet-desktop.jpg` and `research/v11-helmet-mobile.jpg`. This is a UI integration check, not an additional independent evacuation experiment. Existing mesh gaps remain unknown terrain.
