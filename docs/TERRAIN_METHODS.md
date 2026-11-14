# Native Jezero terrain morphology

The existing two 1 km study regions are retained. This analysis reads each published native `jezero-dem-1m.tif` crop, checks its SHA256 against the existing native-DEM provenance, preserves the Mars equirectangular CRS and raster-edge bounds, and computes numerical morphology before any 5 m aggregation. The source is Annex & Ehlmann (2024), [Caltech Jezero products, DOI10.22002/stqse-yay61](https://data.caltech.edu/records/stqse-yay61), CC BY4.0, from NASA MRO HiRISE stereo. Pixel spacing is 1 m; this does not establish 1 m vertical accuracy or object resolution.

## Reproduce

From the repository root, using the existing project Python environment:

```powershell
..\.venv\Scripts\python scripts\terrain_science.py
..\.venv\Scripts\python -m unittest discover -s scripts -p test_terrain_science.py -v
..\.venv\Scripts\python scripts\terrain_science.py --check
```

There is no remote download, model fitting, stochastic operation, invented terrain or change to the original planning products. `--check` independently recomputes every native band and all JSON arrays, compares native Float32 values including NaNs and georeferencing, and checks the recorded product hashes. Generator identity is SHA256 of UTF-8 script text with CRLF normalized to LF, so a Windows/Linux checkout does not silently change the declared script identity. The stored DEM and output-file identities are raw-byte hashes.

Each `public/data/science/` and `public/data/ridge/science/` directory contains:

- `terrain-metrics.json`: 200×200 row-major browser arrays on the existing exact 5 m grid; physical units, formulas, support, source identities and numerical summaries.
- `terrain-derivatives-1m.tif`: 16 Float32 native-resolution bands, tiled and losslessly compressed, with original CRS/affine and per-band unit tags; approximately25 MB per region. NoData is NaN. These download products should not be part of the routine offline core cache.
- `terrain-report.json`: raw-byte SHA256 and size of JSON and GeoTIFF, source/generator/software identities and full native/planning summaries.

## Equations, scales and signs

Let `x` increase eastward and `y` increase toward projected grid north. The source raster's rows run southward; therefore `q=(north-south)/(2d)`, not the uncorrected row derivative. With native spacing `d=1m`, central Zevenbergen–Thorne derivatives over a complete3×3 support are:

```text
p = (east-west)/(2d)                    q = (north-south)/(2d)
r = (east-2center+west)/d²               t = (north-2center+south)/d²
s = (NE-NW-SE+SW)/(4d²)                 g = p²+q²
slope = atan(sqrt(g)), in degrees
aspect = atan2(-p,-q) mod360, clockwise downhill from grid north
profile curvature = -(r p²+2s p q+t q²) / [g(1+g)^(3/2)]
planform curvature = -(r q²-2s p q+t p²) / g^(3/2)
```

Curvatures have units `1/m`, with positive convex and negative concave. These are the geometric profile and true planform definitions documented by [xDEM](https://xdem.readthedocs.io/en/stable/terrain.html), without xDEM's conventional multiplication by100. Planform curvature is not the tangential/directional measure whose denominator is only `g`. Aspect and both directional curvatures are null at zero/critical gradient (`sqrt(g)<=1e-9`). Curvature is ill-conditioned near flat surfaces even with a nonzero gradient. Source quantization and differentiation amplify high-frequency error; these unsmoothed raw-native results are morphology, not a calibrated physical hazard.

| Field | Definition | Physical support | Unit |
|---|---|---|---|
| `slope`, `aspect` | Equations above |3×3m| degree |
| `tri` | Riley TRI: square root of sum of squared elevation differences between center and its8 neighbors |3×3m|m|
| `tpi11`, `tpi51` | Center elevation minus mean of all other pixels in the square; center excluded |11×11m (120 neighbors),51×51m (2600 neighbors)|m|
| `relief11`, `relief51` | Maximum minus minimum elevation in the full square |11×11m,51×51m|m|
| `profileCurvature`, `planCurvature` | Geometric formulas above |3×3m|1/m|
| `exposure` | Within20m Euclidean distance of a native slope above25° |Conservative43×43m source support including slope stencil|0/1 native; fraction after aggregation|
| `coverage` | Native DEM sample available |1m|fraction|
| `support3`, `support11`, `support51` | Complete native stencil available at each sample |Named square support|fraction|
| `uncertaintyMask` | Reasons below |Native sample; bitwise OR after aggregation|bits|
| `opticalCueFraction` | Area above the existing frozen V2 image-model threshold, before component filtering/capping |Actual0.5m aligned semantic mask, averaged into native1m then5m|fraction|

TPI and TRI equations match the methods documented by xDEM and [GDAL](https://gdal.org/en/stable/programs/gdaldem.html). The implementations here use the existing NumPy/SciPy/Rasterio dependencies. xDEM and WhiteboxTools were not installed or executed; no cross-library validation is claimed. Analytic numerical validation is described below. The exposure threshold is a disclosed geometric heuristic, not evidence of a specific rockfall event, direction, frequency or probability. It differs from the older planning-grid dilation; existing planning layers and route costs are preserved until explicitly using the expanded model.

Every morphology field is an arithmetic mean of native values in each exact5×5m block. A single unsupported native value makes that field null in the browser cell. Aspect uses a circular mean; undefined or mutually opposing directions produce null. Support/coverage fractions retain partial availability. Mask bits use OR. Slope here is mean native central-difference slope; the existing planner's conservative maximum native slope per5m cell remains a distinct hard constraint.

## NoData, boundaries and uncertainty

Complete source stencils are required. No reflected padding, fabricated heights or cross-hole interpolation are used. The crop edges and windows touching holes are invalid for the corresponding derivative. Source DEM coverage is100% in both current crops, but strict complete-stencil coverage on the5m output is98.01% for3m/11m morphology and90.25% for51m morphology. The difference is boundary support, not missing orbital coverage. Some otherwise complete blocks contain flat native samples and consequently have null aspect/curvature.

`uncertaintyMask` bits:

| Bit | Meaning |
|---:|---|
|1|Native DEM missing|
|2|Complete3m source stencil unavailable|
|4|Complete11m source stencil unavailable|
|8|Complete51m source stencil unavailable|
|16|Aspect/profile/planform direction undefined at zero gradient|
|32|DEM vertical and inter-product registration accuracy not quantified in the supplied metadata|

Bit32 is set everywhere. It records an unknown accuracy parameter, **not** NoData and not a probability. No uncertainty standard deviation, confidence interval or safety guarantee is invented. These results cannot establish soil strength, wheel slip, small-rock clearance, human fatigue or certified EVA safety.

Sensor sample availability is quantified in JSON: native DEM100%, existing optical semantic-mask processing100%, and projected thermal grid100%, for both crops. The repeated thermal cells still represent approximately100m THEMIS observations; nearest-neighbor reprojection adds no information. Availability does not mean independent field validation or accurate co-registration.

## Real computed comparison

Values below summarize valid5m aggregated cells. Regions have different supported-cell populations for different field scales.

| Quantity | Central floor | Eastern ridge |
|---|---:|---:|
|Mean native-derived slope|4.0794°|5.2556°|
|95th percentile slope|9.3656°|15.2472°|
|Mean Riley TRI|0.178336m|0.230865m|
|95th percentile TRI|0.406860m|0.670246m|
|Mean11m relief|0.875524m|1.153445m|
|Mean51m relief|3.520646m|5.001178m|
|TPI51 range|−1.7814 to3.2470m|−1.2850 to3.6927m|
|Steep-slope proximity fraction of complete interior|4.1925%|5.8924%|
|V2 positive optical-mask area of full image|2.078925%|1.557500%|

The ridge has higher mean/p95 TRI and broader-scale relief. This is a reproducible morphological difference, not a measured traverse-speed or accident-rate difference. The optical percentages describe an experimental semantic mask's positive area. They are **not rock abundance, confirmed boulder counts, object precision or calibrated safety confidence**. The existing4-patch exploratory segmentation benchmark and local unmeasured accuracy remain applicable; manual candidate decisions are separate evidence.

## Numerical validation

Thirteen automated tests verify:

- Known planar slope, north/east/south/west downhill aspects and correct physical spacing at1m and2.5m.
- Riley TRI's analytic plane result and zero planar geometric curvature.
- Ridge/valley TPI at both square scales with center excluded, and known planar TPI zero.
- A quadratic surface including nonzero mixed derivative, checking both geometric curvature formulas and the planform denominator.
- Undefined direction at a quadratic critical point and on a flat plane.
- Complete-stencil crop borders and an isolated NoData hole without padding or filling.
- Physical max-minus-min relief, Euclidean steep-proximity bounds, strict block aggregation, circular aspect and uncertainty-bit preservation.
- Both real crops' source hashes, Mars registration, dimensions and an independently calculated native TRI block.

The separate `--check` pass reproduces both complete numerical products and georeferenced native raster bands. These tests validate equations, coordinate handling and reproducibility. They do not validate the DEM's absolute accuracy or a physical Mars mobility model.
