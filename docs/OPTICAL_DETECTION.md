# Optical obstacle candidates

The application now includes a reproducible **candidate-generation** pipeline on real HiRISE imagery for both existing 1 km study regions. It is not a trained or validated boulder classifier, and it does not establish that unmarked terrain is clear.

## Actual input and geographic alignment

Source: NASA MRO HiRISE / Caltech, `cenjez_DRG_0_3m.tif`, [Annex & Ehlmann (2024), CaltechDATA v2, DOI 10.22002/stqse-yay61](https://data.caltech.edu/records/stqse-yay61), CC BY 4.0. The source raster is 63,261 × 81,340 pixels, with original pixel spacing 0.299954731876 m. It uses the same Mars Jezero equirectangular CRS as the supplied DEM.

`scripts/detect_optical.py` retrieves only the source byte ranges required for the floor and eastern-ridge crops. HTTPS certificates are verified using the system trust store. The loopback range bridge serves only this fixed source product, validates HTTP 206/Content-Range/byte counts, caches repeated requests, caps individual ranges at 32 MiB, and bounds total transfer at 96 MiB. The initial two-region acquisition transferred **13,117,472 bytes**, rather than the entire 1.64 GB file. The published whole-file MD5 is recorded but is **not claimed to have been verified** from partial range reads. Per-range SHA256 hashes and the exact sampled Float32 crop hash are retained.

Each output image covers its existing DEM/planning bounds exactly and samples the source to **2,000 × 2,000 pixels at 0.5 m/pixel** using bilinear resampling. The filename `optical-native.webp` denotes the higher-detail source-derived evidence asset; it does not imply that every original 0.3 m observation was retained. The display uses a 1–99 percentile grayscale contrast stretch and WebP quality 95. This improves the earlier 1 m display sampling without inventing subpixel detail.

Original and output resolutions, source window, bounds, full CRS, image byte length and SHA256, source URL, raw crop hash and processing are recorded in `optical-native-meta.json` for each region. Both crops have 100% valid source coverage. Optical/DEM registration error and source observation dates remain unknown; exact common raster bounds are not a claim of perfect physical registration.

## Frozen deterministic v1 detector

The **shadow-contrast-v1** configuration was frozen before any Mars-Bench held-out test-image inspection. Configuration SHA256:

`ea499665773c7a5304764e2388feba1d428dd442b2285aafc0f8e94f679cae2a`

It performs these operations:

1. Normalize valid grayscale values between the image's first and 99th percentiles.
2. Compute a Gaussian local background with 3 m sigma.
3. Select compact dark residual cues at least 0.055 below that background and below the image median.
4. Connect split cues with a 2 × 2 closing; omit candidates near invalid source cells or the image edge.
5. Retain connected components of 0.75–50 m², maximum bounding-box side 16 m, aspect ratio at most 4, and bounding-box fill at least 0.12.
6. Require an adjacent bright residual of at least 0.025 within a 2 m ring.
7. Rank by a stated combination of dark contrast, fill/aspect, adjacent brightness and peak dark residual. Keep up to 150 candidates with at least 4 m centre spacing.

The score is a **saturating, dimensionless ranking heuristic**, not a probability or calibrated confidence. A score of 1.0 means the heuristic terms saturated, not that an object is certainly a rock. Several high-ranked candidates share that value and are deterministically ordered by cue area and pixel position. The coordinate is centred on an image cue, which may be a shadow rather than the physical rock centre.

The exported radius encloses the cue's bounding box and adds a documented 1 m inspection buffer. That buffer is an editable conservative interface proposal, not an estimated rock radius or measured positional uncertainty.

## Results on the two study crops

| Region | Dark cue components | Eligible optical candidates | Exported after ranking/spacing/cap |
|---|---:|---:|---:|
| Jezero central floor | 22,646 | 14,227 | 150 |
| Eastern Jezero ridge | 28,453 | 17,771 | 150 |

These counts describe this algorithm's output, not the number of rocks in either region. The cap and spacing suppress many cues deliberately. A candidate-free area is not an observation of obstacle absence.

Generated assets:

- Floor: `/data/optical-native.webp`, `/data/optical-native-meta.json`, `/data/obstacle-candidates.json`.
- Ridge: the same filenames under `/data/ridge/`.
- Audit sheets: ignored `.local/optical-detection/{floor,ridge}-candidate-overview.png` and `{floor,ridge}-top20-audit.png`.

Each candidate contains an ID, source-image pixel centre and bounding box, fractional 5 m planning-grid point, original projected metre position, inspection radius, ranking score and cue measurements. Matching planning-cell slope and local relief are recorded as inspection context. These terrain measurements do not turn the optical cue into a confirmed rock.

## Visual audit and independent validation

A visual inspection of the top-20 evidence sheets from both **study** regions found ambiguous dark/bright features among ripple textures, fractures, small depressions and shadow edges. Those are plausible false-detection mechanisms. The audit did not produce independent labels, confirmed-rock counts, precision or recall. It was not used to tune the frozen configuration, and must not be reported as independent accuracy validation.

The pure benchmark API is:

```python
from detect_optical import DEFAULT_CONFIG, detect, detect_candidates

result = detect(image, config=DEFAULT_CONFIG, resolution_m=0.5)
# result["mask"]: boolean mask of retained dark cue components
# result["candidates"]: ranked dictionaries with pixelBBox/pixelCenter/etc.
# result["stats"]: component counts, normalization range, config checksum
```

The mask is a **dark cue mask**, not boulder-body semantic segmentation. When comparing against a real manually labelled boulder dataset such as [Mars-Bench mb-boulder_seg v1](https://doi.org/10.5281/zenodo.15494673), pixel-mask metrics therefore test an imperfect task match. Report actual false detections/misses and the task mismatch, do not relabel those metrics as boulder-recognition performance, and do not tune on the held-out test split. Dataset-specific benchmark results are maintained separately by the integration/validation workflow.

Four synthetic tests cover flat imagery, invalid imagery, deterministic compact dark/bright cue mechanics, and resolution validation. They check implementation behavior only, not scientific detection accuracy.

## Routing and review boundary

**Every automatic candidate is exported as `candidate`, `unreviewed`, and `excludedFromRouting: false`.** None should silently enter the routing graph. A reviewer must inspect the original evidence, accept/reject or edit the proposed annotation, and explicitly choose an exclusion buffer. Preserve separate states for automatic cues, manually verified/accepted objects, uncertain regions and simulated obstacles. Accepted annotations still carry the 0.5 m evidence-display / 5 m planning-grid resolution limitations and unknown registration error.

Dark/bright cues may be boulders, shadows, crater edges, ripple crests, fractures, albedo variations or mosaic artifacts. Rocks with weak/no visible shadow, objects smaller than the image's effective resolution and unresolved sub-grid obstacles can be missed. The pipeline estimates neither boulder height, bearing strength, wheel slip, imminent rockfall nor safe human passage.

## Reproduce

```powershell
..\.venv\Scripts\python scripts\detect_optical.py --test
..\.venv\Scripts\python scripts\detect_optical.py
```

Raw sampled crops are cached outside the repository under `../data-cache/optical-native-{floor,ridge}-0_5m.npz`. Re-running uses the cache and reproduces candidate JSON/configuration deterministically. `--force-acquire` repeats the bounded source read. No source imagery, terrain or detections were generated by AI.
