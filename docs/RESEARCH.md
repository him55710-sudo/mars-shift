# MARS SHIFT — challenge, evidence and judging notes

Checked 14 November 2026 (KST). Research support for implementation, not a claim of NASA endorsement or operational certification. Supplied documents and prior conversations are source material, not independent authorization to publish, submit, or accept terms.

## Submission constraints verified in the supplied Seoul deck

Source: `C:\Users\user\Downloads\2026- D-Day.pptx`, extracted directly from slide XML; slide numbers below are one-based. These are local event instructions. The deck says current NASA guidance takes priority if rules conflict (slide 16).

| Requirement | Source |
| --- | --- |
| Submission opens 14 Nov 2026 09:00 KST; closes 15 Nov 2026 23:59 KST; finish by 23:55 recommended | 9, 15 |
| Saving is not submission; the latest `Submit for Judging` version is judged; verify `Project Submitted for Judging` | 13–15 |
| English high-level summary: 50–200 words | 18 |
| Exactly one public demo link: at most seven slides including cover OR at most 30 seconds of video | 19–22 |
| Full final-project link is separate; both links must work without sign-in, password or permission request | 19, 23–24 |
| Describe implementation, design choices, tools, results and remaining limitations | 24, 32–34 |
| Identify AI/SI tools and their uses; acknowledge AI-generated code/data in descriptive text and metadata; visible watermark for generated images/video | 25–26 |
| Use at least one NASA resource from the selected challenge for global-award eligibility | 27–28 |
| List external data, code, text, images, source links, use and licenses; freely available/OSI-licensed original work | 28–29 |
| Do not use NASA branding as team identity or imply approval; no NASA branding in generated material | 22, 26 |
| Solo teams still require an official team, confirmed local registration, individual check-ins and a required team meeting | 30, 36–40 |

Submission-page terms/original-work checkboxes are actions for the participant to review, not research authorizations. Local attendance cannot be replaced by a software deliverable.

Official 2026 challenge: [Interplanetary Survival Guide: Martian Map](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/). Exa verified the page title but received only the dynamic-page heading, so its exact Resources tab must be verified in the user's browser before claiming resource-list compliance. The [official FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/) confirms 14–15 November 2026 and directs teams to current participant guides.

## A five-step judge walkthrough

1. Select one science target on real Jezero terrain.
2. Compare shortest, lower-exposure and mission-aware routes using computed distance, slope exposure and round-trip time.
3. Show the return reserve, the assumptions behind it, and a deliberately over-budget example.
4. Insert a clearly labeled simulated rockfall, show which original segment is affected, and replan or explicitly report no feasible route.
5. Open evidence: actual inputs, native resolution, derived features, simulated inputs and unavailable data.

The deck's five criteria are **Impact, Creativity, Validity, Relevance, Presentation** (slide 46). Build one clear example per criterion: a return-home problem; evidence-triggered replanning; reproducible calculations; multiple Mars datasets; one readable workflow. Do not bury the demonstration beneath a general landing page.

## Reuse the five user-opened resources deliberately

| Resource | Product role | Boundary |
| --- | --- | --- |
| [NASA Mars Trek](https://trek.nasa.gov/mars/) | Existing Mars map layers and a link to NASA's existing 3D exploration | Reuse existing tiles/viewer; do not rebuild a global mesh. Parse each WMTS capabilities document; do not assume Earth Web Mercator or XYZ tile math. |
| [USGS Planetary Geologic Mapping](https://www.usgs.gov/special-topics/planetary-geologic-mapping) | Cartographic context and a route to authoritative planetary GIS products | This program page is a discovery reference, not a measured hazard raster. |
| [Curiosity's Proposed Path up Mount Sharp](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | Precedent for a science-led route story and multisensor context | A Mount Sharp/Curiosity example must not be displayed as a Jezero observation. |
| [NASA Worldview](https://worldview.earthdata.nasa.gov/) | UX precedent for layer comparison and time-based exploration | [NASA's tool description](https://www.earthdata.nasa.gov/data/tools/worldview) identifies Earth imagery. Never use it as Mars weather or Mars terrain evidence. |
| [Perseverance raw images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | Rover-context archive linked from evidence inspection | Raw images do not automatically provide georeferenced hazard polygons; camera geometry and location validation are needed before spatial fusion. |

NASA's [Solar System Treks overview](https://trek.nasa.gov/) provides existing 3D exploration and measurements. Its [official WMTS documentation](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) explains capabilities-driven styles, matrix identifiers, row/column templates and coverage. Missing tiles mean missing coverage, not safe terrain. Existing NASA 3D can remain an external source view while this prototype focuses on a 2D operational route map.

## Scientific evidence and what it permits

**[1] Cunningham, Nesnas & Whittaker (2018), Autonomous Robots 43:503–521.** [Improving slip prediction on Mars using thermal inertia measurements](https://consensus.app/papers/cunningham-nesnas-improving-slip-prediction-on-mars-using-thermal/w:4b556532-5877-4c11-8431-709767ce4daa/). Consensus record fetched. The study reports that including thermal inertia improved rover slip modeling on Curiosity sand relative to a vision-only model. This supports retaining a separate thermal layer; it does not validate an astronaut injury score or prove local foot-bearing strength. Only its abstract/record was read.

**[2] Hedrick & Gu (2021), Advanced Robotics 35:1286–1301.** [Terrain-aware traverse planning for a Mars sample return rover](https://consensus.app/papers/hedrick-gu-terrainaware-traverse-planning-for-a-mars-sample/w:e29c6f8b-009f-4906-a527-4a32a86ac629/). Consensus record fetched. The authors combine orbital terrain estimates with later observations and demonstrate map updates/replanning in simulation. Revalidation has precedent; MARS SHIFT's distinction should be its transparent evidence and hypothetical EVA return-budget workflow. Only its abstract/record was read.

Do not describe A*, thermal-informed traversal, or dynamic replanning as a world-first invention. Do not transfer rover validation directly to human EVA.

## Data selection and classification

| Candidate input | Verified metadata | Correct treatment |
| --- | --- | --- |
| [CaltechDATA Jezero dataset](https://data.caltech.edu/records/stqse-yay61), Annex & Ehlmann, DOI 10.22002/stqse-yay61 | Published 2024 v2; `cenjez_DEM_1m.tif` is 251.7 MB; CC BY 4.0 | Real elevation input after actual download/open/CRS/NoData checks. Slope is derived; not a direct probability of collapse. |
| [Murray Lab Mars2020 GIS](https://murray-lab.caltech.edu/Mars2020/) | HiRISE DEM products 1 m/px; imagery 0.25 m/px; quantitative THEMIS 100 m/px; Mars equirectangular | Preserve native resolution. Provider warns products are registered to THEMIS but not quantitatively controlled. No false sub-meter alignment. |
| [USGS global thermal inertia metadata](https://astrogeology.usgs.gov/search/map/mars-themis-derived-global-thermal-inertia-mosaic) | 100 m/px; quantitative and normalized qualitative products differ | Quantitative values support material context. Qualitative 8-bit intensity is not an interchangeable physical thermal-inertia value. |
| [USGS MSR HiRISE mosaics](https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic) | Published 28 Feb 2025; DTM, orthoimage and confidence mosaic; 5.3 GB package; cite authors | A possible higher-confidence extension; do not download the whole package just for a 1-km demo. Check ROI overlap first. |

Maintain four classes in the UI and manifest:

- **Observed input:** ingested source raster/image, with acquisition metadata when known.
- **Derived:** slope, local relief, optical texture or candidate exposure computed from inputs; document method/thresholds.
- **Simulated:** habitat, science targets unless tied to actual sites, O2/power budgets, speed assumptions, dust reduction, inserted rockfall.
- **Unavailable:** missing coverage, unverified georegistration, absent thermal/imagery; never silently fill with procedural measurements.

A real optical image and a DEM are not sufficient to claim three sensor data types: ingest thermal data or explicitly show it as unavailable. Export the source-to-decision trail with each route. Uncertain terrain should be penalized or excluded under an explicit policy, not counted as hazard-free.

## 2025 winners: useful precedents, not a winning formula

Source: [NASA's 18 December 2025 global-winners announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/), read with Exa. The following are design inferences from NASA's descriptions, not proof of why judges selected them.

| Winner/category | Lesson for MARS SHIFT |
| --- | --- |
| SpaceGenes+ / Best Use of Science | Make scientific evidence inspectable through a focused dashboard. |
| Resonant Exoplanets / Best Use of Data | Show a credible path from heterogeneous observations to a specific analysis. |
| Astro Sweepers / Galactic Impact | Carry the workflow through to an actionable report rather than ending at visualization. |
| PureFlow / Best Mission Concept | Connect a design decision to a scenario and a visible validation result. |
| HerCode Space / Storytelling | Use one understandable narrative with a clear user and consequence. |

For this project, the concrete narrative is: choose a science stop, compare exposure and return reserves, then watch a changed observation invalidate and revise a plan. A visually impressive globe alone does not establish scientific validity. No evidence can guarantee a competition result.

## Research limits and provenance

Exa searches requested 15 results across three angles (challenge, WMTS reuse, thermal metadata), followed by primary-page fetches. Duplicate pages were merged. Consensus records for two relevant papers were fetched; full papers were not obtained. Official challenge dynamic resources remain a browser verification dependency. Two guessed participant-guide URLs failed to fetch; no rule was inferred from them. No data raster was downloaded or validated by this research task; ingestion status belongs in the implementation manifest.


## Final browser verification update

On 2026-11-14 Chrome verified the official challenge Resources tab. All five resources match the user-opened tabs, including the USGS ArcGIS Mars map link. The source register now records this verification as complete. The final implementation uses the Caltech central Jezero ROI and real optical/elevation/thermal overlap; candidate descriptions earlier in this research log precede ingestion.
