# Scientific engineering results

These are executed calculations on the existing Central floor and Eastern ridge Jezero crops, not illustrative performance figures. `public/data/science-results.json` uses the application's TypeScript mobility, graph search, resource checks and seeded sensitivity code. Native terrain products and their source identities are in each region's `science/terrain-report.json`. Coefficients remain simulation assumptions without local Mars EVA calibration.

## Reproduction and fixed assumptions

Run `pnpm science` to regenerate the numerical artifact with the existing browser engine. The results JSON is the numerical artifact, while this document summarizes it. Source byte identities in that file identify both each unchanged terrain grid and its native-derived science arrays. Standard methods and research status are in [SCIENTIFIC_REFERENCES.md](SCIENTIFIC_REFERENCES.md). Native derivative formulas, supports, units, GeoTIFF bands and numerical validation are in [TERRAIN_METHODS.md](TERRAIN_METHODS.md).

Both regions use base cell `(32,168)` and target `(153,43)` on their own 200×200, 5 m graph. Settings: maximum slope 18°, base speed 0.6 m/s, science stop 20 min, mission duration 110 min, oxygen endurance 150 min, power endurance 140 min, required resource reserve 25%, payload 12 kg, normal visibility. Model 1 retains the previous slope-based effort equation. Model 2 uses the published illustrative directional-geometry-v1 coefficients: uphill 5, downhill 2, payload multiplier 0.015/kg and terrain effort 0.3 with a 1 m TRI reference. Neither model estimates validated physiological consumption.

## Return-feasible area

Area is the number of modeled feasible 5 m cells multiplied by 25 m². The map computes independent minimum outbound and minimum return time, applies science duration and the time/oxygen/power limits, and retains unknown, blocked, disconnected and over-budget classes. Directional return uses the reversed graph's incoming original-edge costs.

|Region|Model 1 feasible area, m²|Model 2 feasible area, m²|Gained cells on common support|Lost cells on common support|Net common-support change, m²|
|---|---:|---:|---:|---:|---:|
|Floor|983,350|966,225|31|0|+775|
|Ridge|919,550|903,825|1|21|-500|

The common known support contains **39,204 cells** in each region. Model 2 has **796 unknown boundary cells (19,900 m²)** because a complete native TRI stencil is unavailable there. Model 1 does not require this derivative. Thus the full-area decrease is confounded by support policy and must not be presented as solely a mobility penalty. On common support the floor gains 775 m²; the ridge loses a net 500 m². These are modest changes under the fixed assumptions, reported without adjusting coefficients to enlarge them.

## Directional minimum travel and route change

The independent Dijkstra fields are a lower bound on modeled travel for the current static graph, and can reconstruct a fastest pair. They do not force the selected shortest/lower-exposure/mission-aware objective to use that pair.

|Region|Model|Minimum outward, min|Minimum return, min|Fastest pair distance, m|Fastest pair total incl. work, min|Fastest pair modeled reserve, %|
|---|---:|---:|---:|---:|---:|---:|
|Floor|1|32.8048|32.8058|1840.160|85.6107|38.8948|
|Floor|2|32.4577|32.4564|1752.858|84.9141|39.4222|
|Ridge|1|32.5082|31.8999|1793.415|84.4080|39.8053|
|Ridge|2|32.9782|32.0654|1764.200|85.0436|39.3241|

The expanded fastest pair changes the floor distance from 1,840.160 m to 1,752.858 m and the ridge distance from 1,793.415 m to 1,764.200 m. The floor's fastest total changes from 85.6107 to 84.9141 min. The ridge's changes from 84.4080 to 85.0436 min. This result shows that shorter geometric travel can take more modeled time. It does not prove the new model is physically more accurate.

## Budget response under model 2

All unlisted assumptions stay fixed. These comparisons change the map's feasible area rather than merely changing a single route score.

|Mission duration, min|Science stop, min|Required reserve, %|Floor feasible, m²|Ridge feasible, m²|
|---:|---:|---:|---:|---:|
|60|20|25|388,075|386,825|
|80|20|25|733,125|704,975|
|110|20|25|966,225|903,825|
|110|40|25|881,925|823,050|
|110|20|50|567,575|554,850|

Increasing science work from 20 to 40 min shrinks the area. Increasing required resource reserve from 25% to 50% also shrinks it. Negative travel allowance makes even the base's work stop infeasible. Feasibility only covers paths inside each cropped graph; outside-crop detours remain unevaluated.

## Selected-route comparison and seeded sensitivity

Each row reevaluates its **fixed selected route**, without replanning. Seed **20261114**, **200 samples**, uniform speed multiplier **0.8–1.2**, work duration **±5 min**, terrain effort multiplier **0.75–1.25**, and imposed synthetic route-closure frequency **0.1**. The same seed gives paired scenario assumptions across comparisons. The imposed closure mechanism affects 25/200 sampled scenarios in this run, illustrating ordinary finite-sample variation around its configured frequency.

|Region|Model|Objective|Distance, m|Total incl. work, min|Modeled reserve, %|Constraint passes /200|Frequency|
|---|---:|---|---:|---:|---:|---:|---:|
|Floor|1|shortest|1752.9|86.98|37.86|172|86.0%|
|Floor|1|exposure|1991.9|88.31|36.85|168|84.0%|
|Floor|1|mission|1846.0|85.66|38.86|175|87.5%|
|Floor|2|shortest|1752.9|84.92|39.42|175|87.5%|
|Floor|2|exposure|1991.9|90.06|35.53|158|79.0%|
|Floor|2|mission|1846.0|86.80|38.00|172|86.0%|
|Ridge|1|shortest|1752.7|88.04|37.05|168|84.0%|
|Ridge|1|exposure|1927.8|87.37|37.56|169|84.5%|
|Ridge|1|mission|1793.4|84.41|39.80|175|87.5%|
|Ridge|2|shortest|1752.7|85.16|39.24|175|87.5%|
|Ridge|2|exposure|1927.8|89.26|36.13|162|81.0%|
|Ridge|2|mission|1793.4|85.79|38.76|175|87.5%|

These frequencies are conditional results of declared uniform perturbations and synthetic closures. They are **not accident, survival or calibrated real-world reliability probabilities**. All reported comparison routes have zero distance in the existing steep-slope proximity proxy; no measured reduction in rockfall exposure follows from this experiment.

|Model 2 mission-aware route|Travel time p05 / p50 / p95, min|Reserve margin p05 / p50 / p95, percentage points|Time failures|Reserve failures|Synthetic closure failures|
|---|---|---|---:|---:|---:|
|Floor|56.78 / 67.67 / 81.35|1.95 / 12.17 / 21.77|0|3|25|
|Ridge|55.91 / 66.65 / 80.13|2.89 / 12.96 / 22.41|0|0|25|

The travel and reserve distributions summarize parameter reevaluation. Closure failures remain a separate feasibility outcome. Failure reasons can overlap, so summing reason counts is not a valid way to derive the pass frequency.

## Limits and presentation claims

Native terrain morphology describes shape. It does not measure soil strength, small-boulder clearance, calibrated rockfall probability or human fatigue. The V2 optical mask is an experimental candidate proxy with unmeasured local object accuracy. THEMIS remains approximately 100 m regional context. DEM vertical and product-registration error remain unquantified.

Forward/reverse Dijkstra gives exact minimum scalar time on this fixed cropped graph. The time-monotone resource model makes that minimum sufficient to test existence of a modeled feasible pair. The claim does not extend to edge-specific resource consumption, time-dependent events, physiology or all possible terrain outside the graph. The objective-alternative route planner remains a bounded search rather than a globally optimal multi-resource solver.

The seven-slide download and the web briefing use computed figures and disclose model assumptions. NASA/JPL, SEXTANT, xDEM and Whitebox are prior methods or references, not claimed new inventions. The software is a research prototype without flight or operational safety certification.

Result JSON SHA256 at report generation: `eee2ee89341457045e766cb3fd9eb1a25f354c17c5a4333b353640c654fb888b`.

