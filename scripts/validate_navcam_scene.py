"""Numerically verify PDS -> glTF axes, faces, UVs and texture encoding.

python scripts/validate_navcam_scene.py --source .local/navcam-sol9
Requires existing NumPy and Pillow. Does not alter source observations or assets.
"""
import argparse
from collections import Counter
import io
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

PRODUCT = "NLF_0009_0667756352M693RAS_N0030000NCAM05000_0A0295J04"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", default="public/data/navcam")
    args = parser.parse_args()
    source, output = Path(args.source), Path(args.output)
    vertices, texcoords, faces, uv_by_position = [], [], [], {}
    for line in (source / (PRODUCT + ".obj")).open(encoding="utf-8"):
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            north, east, down = map(float, fields[1:4])
            vertices.append((east, -down, -north))
        elif fields[0] == "vt":
            texcoords.append(tuple(map(float, fields[1:3])))
        elif fields[0] == "f":
            parts = [field.split("/") for field in fields[1:]]
            faces.append([int(part[0])-1 for part in parts])
            for part in parts:
                position = tuple(np.asarray(vertices[int(part[0])-1], dtype=np.float32))
                u, v = texcoords[int(part[1])-1]
                uv_by_position.setdefault(position, set()).add((u, 1-v))
    original = np.asarray(vertices)
    original_float = original.astype(np.float32)
    position_ids = {tuple(p): i for i, p in enumerate(original_float)}
    data = (output / "sol9-navcam-full.glb").read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20+json_length])
    binary_start = 20+json_length+8
    primitive = gltf["meshes"][0]["primitives"][0]

    def accessor(index):
        access = gltf["accessors"][index]
        view = gltf["bufferViews"][access["bufferView"]]
        assert "byteStride" not in view, "Expected tightly packed Blender accessor"
        components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[access["type"]]
        dtype = {5126: "<f4", 5125: "<u4", 5123: "<u2"}[access["componentType"]]
        offset = binary_start+view.get("byteOffset", 0)+access.get("byteOffset", 0)
        return np.frombuffer(data, dtype=dtype, count=access["count"]*components, offset=offset).reshape(access["count"], components)

    positions = accessor(primitive["attributes"]["POSITION"])
    uv = accessor(primitive["attributes"]["TEXCOORD_0"])
    indices = accessor(primitive["indices"]).reshape(-1, 3)
    mapped_indices = np.asarray([position_ids[tuple(p)] for p in positions])
    original_indices = np.asarray([position_ids[tuple(p)] for p in original_float])
    canonical_faces = lambda values: Counter(map(tuple, np.sort(values, axis=1)))
    preserved = canonical_faces(original_indices[np.asarray(faces)]) == canonical_faces(mapped_indices[indices])
    uv_error = max(min(max(abs(float(pair[0])-source_uv[0]), abs(float(pair[1])-source_uv[1])) for source_uv in uv_by_position[tuple(p)]) for p, pair in zip(positions, uv))
    image_view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
    image_start = binary_start+image_view.get("byteOffset", 0)
    image_bytes = data[image_start:image_start+image_view["byteLength"]]
    decoded = np.asarray(Image.open(io.BytesIO(image_bytes)).convert("RGB"), dtype=float)
    observed = np.asarray(Image.open(source / (PRODUCT+".png")).convert("RGB"), dtype=float)
    mse = float(np.mean((decoded-observed)**2))
    report = {"sourceTriangles": len(faces), "glbTriangles": len(indices),
              "allSourceFacesPreserved": preserved,
              "allGlbPositionsMatchFloat32Source": True,
              "axisTransform": "SITE_FRAME (north,east,down) -> glTF (east,-down,-north); no shift or scale",
              "maxFloat32CoordinateErrorMetres": float(np.max(np.abs(original-original_float))),
              "checkedUvVertices": len(uv), "maxUvCoordinateError": float(uv_error),
              "uvConvention": "glTF V = 1 - OBJ V; U unchanged",
              "sourceTexturePixels": list(Image.open(source/(PRODUCT+".png")).size),
              "embeddedTexturePixels": list(Image.open(io.BytesIO(image_bytes)).size),
              "textureJpegQuality": 95, "textureRgbPsnrDb": float(10*np.log10(255**2/mse)) if mse else None,
              "materialUnlit": "KHR_materials_unlit" in gltf.get("extensionsUsed", []),
              "sourceVertices": len(vertices), "gltfVertices": len(positions),
              "unusedSourceVerticesRemoved": len(vertices)-len(set(original_indices[np.asarray(faces)].ravel())),
              "displayBoundsGltf": {"min": positions.min(axis=0).tolist(), "max": positions.max(axis=0).tolist()},
              "limitations": "Verifies conversion fidelity, not accuracy of the NASA stereo reconstruction or collision safety."}
    assert preserved and uv_error < 2e-7 and report["materialUnlit"]
    assert decoded.shape == observed.shape
    (output / "validation.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
