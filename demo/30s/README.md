# 30-second demo preparation

The Korean narration, six generated WAV chapters and tab-recording helper are saved here as source material. A finished 30-second video has **not** been recorded or exported. Browser capture stopped before recording could start.

The planned sequence is Mission Hub → 2D/3D terrain and sand → native visor → 2D/3D dust encounter → mission resources and return → evidence and limitations. `narration.json` contains the intended 30-second chapter timings. `make-narration.ps1` regenerates the chapters with the installed Microsoft Heami Desktop voice.

These files are preparation assets, excluded from the public static directory. The recording helper expects the local application on `http://127.0.0.1:5178/`; `node serve.mjs` serves the helper on `http://127.0.0.1:5278/`. Recording requires an explicitly selected browser tab and should capture only the application.
