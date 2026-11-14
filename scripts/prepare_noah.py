"""Register the published NOAH-H Jezero categorical mosaic to project grids.

Requires the original CC BY 4.0 archive in ../data-cache. It is never committed.
The original descriptive-class legend is read from the archive; mosaic rank
codes must not be confused with the original network class numbering.

    ../.venv/Scripts/python scripts/prepare_noah.py
    ../.venv/Scripts/python scripts/prepare_noah.py --check
    ../.venv/Scripts/python -m unittest discover -s scripts -p test_prepare_noah.py
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds as grid_transform
from rasterio.warp import reproject, transform, transform_bounds
from rasterio.windows import from_bounds as raster_window, bounds as window_bounds

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
CACHE = ROOT.parent / "data-cache"
ARCHIVE = CACHE / "NOAH-H_17121482_v2.zip"
ARCHIVE_SIZE = 352353484
ARCHIVE_MD5 = "42835d4e3a7cdb322b057b2b85941500"
DOI = "10.21954/ou.rd.17121482.v2"
SOURCE_URL = "https://ordo.open.ac.uk/articles/dataset/NOAH-H_terrain_classifications_of_Jezero_Crater_Mars_zip/17121482/2"
PREFIX = "NOAH-H_terrain_classifications_of_Jezero_Crater_Mars/"
MOSAIC = PREFIX + "NOAH-H_mosaics/Descriptive_classes/Jezero_NOAHH_mosaic_DC.tif"
LEGEND = PREFIX + "NOAH-H_mosaics/Descriptive_classes/DescriptiveClasses_rank_DC.lyrx"
SUBCELL = 0.25
UNKNOWN = 0
NOAH_OVERLAP_CENTRE = (77.565, 18.46)


def digest_file(path: Path, algorithm="sha256") -> str:
    h = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def source_files():
    if ARCHIVE.stat().st_size != ARCHIVE_SIZE or digest_file(ARCHIVE, "md5") != ARCHIVE_MD5:
        raise ValueError("Original NOAH-H archive size or published MD5 differs")
    extracted = CACHE / "noah-h" / "Jezero_NOAHH_mosaic_DC.tif"
    extracted.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ARCHIVE) as archive:
        if not extracted.exists() or extracted.stat().st_size != archive.getinfo(MOSAIC).file_size:
            with archive.open(MOSAIC) as source, extracted.open("wb") as destination:
                shutil.copyfileobj(source, destination)
        # ZipFile validates CRC during complete reads; compare the extracted
        # stream to the exact member, not merely to a filename/size heuristic.
        h = hashlib.sha256()
        with archive.open(MOSAIC) as stream:
            for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
                h.update(chunk)
        if digest_file(extracted) != h.hexdigest():
            raise ValueError("Extracted classification mosaic differs from the archive member")
        legend_bytes = archive.read(LEGEND)
        legend = json.loads(legend_bytes)
        definitions = legend["layerDefinitions"][0]["colorizer"]["groups"][0]["classes"]
        classes = []
        for item in definitions:
            class_id = int(item["values"][0])
            color = "#" + "".join(f"{round(c):02x}" for c in item["color"]["values"][:3])
            label = item["label"]
            classes.append({"id": class_id, "label": label,
                "group": label.split(":")[0] if ":" in label else label,
                "color": color})
        classes.sort(key=lambda c: c["id"])
        if [c["id"] for c in classes] != list(range(1, 15)):
            raise ValueError("Unexpected original descriptive-mosaic legend")
        readmes = [n for n in archive.namelist() if "readme" in n.lower() and not n.endswith("/")]
        readme = {n: archive.read(n).decode("utf-8-sig", errors="replace") for n in readmes}
        control_points = [n for n in archive.namelist() if "/Control_Points/" in n and n.endswith(".txt")]
    return extracted, classes, h.hexdigest(), hashlib.sha256(legend_bytes).hexdigest(), readme, control_points


def overlap_grid() -> dict:
    """Use the same Mars sphere and native-pixel snapping as preprocess.py."""
    reference = json.loads((DATA / "terrain.json").read_text(encoding="utf-8"))
    with rasterio.open(CACHE / "cenjez_DEM_1m.tif") as dem:
        mars_geographic = rasterio.crs.CRS.from_proj4("+proj=longlat +a=3396190 +b=3396190 +no_defs")
        cx, cy = transform(mars_geographic, dem.crs, [NOAH_OVERLAP_CENTRE[0]], [NOAH_OVERLAP_CENTRE[1]])
        win = raster_window(cx[0]-500, cy[0]-500, cx[0]+500, cy[0]+500, dem.transform).round_offsets().round_lengths()
        bounds = list(window_bounds(win, dem.transform))
        if dem.crs != rasterio.crs.CRS.from_wkt(reference["crs"]) or win.width != 1000 or win.height != 1000:
            raise ValueError("Expected the existing Mars 1 m DEM and project CRS")
        native = dem.read(1, window=win, masked=True)
        if native.shape != (1000, 1000):
            raise ValueError("Overlap crop is not within the native DEM raster")
        dem_stats = {"nativeValidFraction": float((~np.ma.getmaskarray(native)).mean()),
            "minimumElevationMetres": float(native.min()), "maximumElevationMetres": float(native.max()),
            "reliefMetres": float(native.max()-native.min()),
            "sourceWindow": [win.col_off, win.row_off, win.width, win.height],
            "source": "cenjez_DEM_1m.tif", "nominalCentreLonLat": list(NOAH_OVERLAP_CENTRE)}
    return {"width": 200, "height": 200, "cellSize": 5, "bounds": bounds,
        "crs": reference["crs"], "demOverlap": dem_stats,
        "selection": "A third real 1 km crop in the narrow NOAH-H/Caltech DEM overlap; approximately 6 km east of the Perseverance landing, not the landing site itself."}


def aggregate_classes(samples: np.ndarray, width: int, height: int, factor: int, ids: list[int]) -> dict:
    """Area-fraction estimates over equally spaced nearest-neighbour samples.

    Unknown samples remain in the area denominator. A wholly unobserved cell
    has null class/fractions, never a fabricated class or zero-risk estimate.
    """
    if samples.shape != (height * factor, width * factor):
        raise ValueError("Categorical sample shape does not match grid and factor")
    blocks = samples.reshape(height, factor, width, factor)
    counts = np.stack([(blocks == class_id).sum(axis=(1, 3)) for class_id in ids], axis=-1)
    count = counts.sum(axis=-1)
    known = count > 0
    total = factor * factor
    maximum = counts.max(axis=-1)
    dominant = np.asarray(ids)[counts.argmax(axis=-1)]
    fraction_rows = counts.reshape(-1, len(ids)) / total
    return {
        "dominantClass": [int(v) if ok else None for v, ok in zip(dominant.flat, known.flat)],
        "coverage": np.round(count.astype(float) / total, 6).reshape(-1).tolist(),
        "dominantAreaFraction": [round(float(v) / total, 6) if ok else None for v, ok in zip(maximum.flat, known.flat)],
        "classFractions": [np.round(values, 6).tolist() if ok else None for values, ok in zip(fraction_rows, known.flat)],
    }


def build_region(region: str, grid: dict, source: Path, classes: list[dict], provenance: dict) -> dict:
    width, height, cell_size = grid["width"], grid["height"], grid["cellSize"]
    factor = round(cell_size / SUBCELL)
    if abs(factor * SUBCELL - cell_size) > 1e-10:
        raise ValueError("Grid cell size is not an integer number of categorical samples")
    samples = np.full((height * factor, width * factor), UNKNOWN, dtype="uint8")
    with rasterio.open(source) as src:
        noah_bounds = transform_bounds(grid["crs"], src.crs, *grid["bounds"], densify_pts=21)
        intersects = noah_bounds[0] < src.bounds.right and noah_bounds[2] > src.bounds.left and noah_bounds[1] < src.bounds.top and noah_bounds[3] > src.bounds.bottom
        if intersects:
            reproject(source=rasterio.band(src, 1), destination=samples,
                src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata,
                dst_transform=grid_transform(*grid["bounds"], width*factor, height*factor),
                dst_crs=grid["crs"], dst_nodata=UNKNOWN, resampling=Resampling.nearest,
                num_threads=2, init_dest_nodata=True)
        ids = [item["id"] for item in classes]
        invalid = ~np.isin(samples, [UNKNOWN, *ids])
        if invalid.any():
            raise ValueError("Class value absent from the original mosaic legend")
        fields = aggregate_classes(samples, width, height, factor, ids)
        source_grid = {"width": src.width, "height": src.height,
            "cellSizeMetres": list(src.res), "bounds": list(src.bounds), "crs": src.crs.to_wkt(),
            "noDataValue": src.nodata, "transformedProjectBounds": list(noah_bounds),
            "geometricBoundingBoxOverlap": intersects}
    counts = Counter(int(v) for v in samples.flat if v)
    total = samples.size
    covered_cells = sum(v is not None for v in fields["dominantClass"])
    result = {"schemaVersion": 1, "region": region,
        "classification": "Published machine-derived terrain classification; not hazard probability or direct soil measurement",
        "grid": {k: grid[k] for k in ["width", "height", "cellSize", "bounds", "crs"]},
        "classes": classes, "classFractionOrder": ids, "fields": fields,
        "coverage": {"sampledFraction": round(sum(counts.values())/total, 8),
            "cellsWithAnyClassification": covered_cells, "totalCells": width*height,
            "fullyCoveredCells": sum(value == 1 for value in fields["coverage"]),
            "unknownCells": width*height-covered_cells,
            "classAreaFractions": {str(i): round(counts.get(i, 0)/total, 8) for i in ids}},
        "sourceRaster": source_grid, "source": provenance,
        "processing": {"categoricalResampling": "nearest", "targetSampleSpacingMetres": SUBCELL,
            "samplesPerPlanningCell": factor*factor,
            "fractionDefinition": "Class sample counts divided by all 400 equal-area 0.25 m sample centres in each 5 m cell; unknown samples stay in the denominator. Fractions are sampling-based area estimates, not model probabilities.",
            "dominantClassDefinition": "Largest known class area count; ties choose the lower published mosaic rank code. null if no classification samples.",
            "coordinateOperation": "Mars sphere3396190 Eqc latTs0 to existing Mars sphere3396190 Eqc latTs18.4663; no Earth WGS84 substitution and no extra empirical image shift.",
            "sourceNoDataPreserved": True, "originalNetworkClassNumberingUsed": False},
        "registration": {"residualMetres": None,
            "status": "Original source rasters were georeferenced by the authors; supplied tie points do not establish a measured residual against this project's later Caltech orthomosaic/DEM. No independent local registration residual measured.",
            "controlPointFiles": provenance["controlPointFiles"]},
        "limitations": ["Terrain class is a texture classification, not calibrated rockfall, bearing strength, sinkage, oxygen use, wheel slip, or astronaut safety.",
            "Classification confidence and acquisition time are not encoded per pixel in this categorical mosaic.",
            "Native0.25m sample spacing does not imply0.25m positional accuracy or validated small-obstacle clearance.",
            "Unknown support must remain visible; no terrain class is assigned outside source coverage."],
    }
    if region == "noah":
        result["studyRegion"] = {"name": "NOAH-H / Caltech overlap", **{k: grid[k] for k in ["selection", "demOverlap"]}}
    return result


def main(check: bool):
    source, classes, source_sha, legend_sha, readme, controls = source_files()
    provenance = {"title": "NOAH-H terrain classifications of Jezero Crater, Mars", "doi": DOI,
        "record": SOURCE_URL, "version": 2, "published": "2022-11-18",
        "credit": "Wright, Barrett, Fawdon, Favaro, Balme, Woods, Karachalios & Gerdes; The Open University / ESA NOAH",
        "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "archiveFile": ARCHIVE.name, "archiveBytes": ARCHIVE_SIZE, "archiveMd5": ARCHIVE_MD5,
        "archiveChecksumVerified": True, "mosaicMember": MOSAIC, "mosaicSha256": source_sha,
        "legendMember": LEGEND, "legendSha256": legend_sha, "readmeFiles": list(readme),
        "controlPointFiles": controls,
        "paper": "https://doi.org/10.1080/17445647.2022.2095935"}
    summaries = []
    for region in ["floor", "ridge", "noah"]:
        output = DATA / region if region != "floor" else DATA
        if region == "noah":
            grid = overlap_grid()
        else:
            grid = json.loads((output / "terrain.json").read_text(encoding="utf-8"))
        result = build_region(region, grid, source, classes, provenance)
        path = output / "noah-terrain.json"
        if check:
            if json.loads(path.read_text(encoding="utf-8")) != result:
                raise ValueError(f"{region} published NOAH product differs")
        else:
            output.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False)+"\n", encoding="utf-8", newline="\n")
        summaries.append({"region": region, "status": "verified" if check else "written", "coverage": result["coverage"], "bounds": result["grid"]["bounds"], "bytes": path.stat().st_size, "sha256": digest_file(path)})
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
