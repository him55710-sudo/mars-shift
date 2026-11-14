"""Convert one authentic PDS Navcam OBJ into web GLBs using Blender 5.2.

Run: blender --background --python scripts/build_navcam_scene.py -- --source DIR
Source DIR must contain the four original product files named PRODUCT below.
No hole filling, terrain synthesis, coordinate registration, or texture enhancement.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

PRODUCT = "NLF_0009_0667756352M693RAS_N0030000NCAM05000_0A0295J04"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_unlit(path):
    """Use source photographic illumination, with no extra simulated lighting."""
    data = path.read_bytes()
    length, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(data[20:20+length])
    for material in gltf["materials"]:
        texture = material.pop("emissiveTexture")
        material.pop("emissiveFactor", None)
        material["pbrMetallicRoughness"] = {"baseColorTexture": texture, "metallicFactor": 0, "roughnessFactor": 1}
        material["extensions"] = {"KHR_materials_unlit": {}}
    gltf["extensionsUsed"] = list(dict.fromkeys(gltf.get("extensionsUsed", [])+["KHR_materials_unlit"]))
    metadata = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    metadata += b" " * (-len(metadata) % 4)
    binary = data[20+length:]
    total = 12+8+len(metadata)+len(binary)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, total)+struct.pack("<II", len(metadata), kind)+metadata+binary)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", default="public/data/navcam")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    source, output = Path(args.source).resolve(), Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    vertices, texcoords, triangles, corner_uv = [], [], [], []
    for line in (source / (PRODUCT + ".obj")).open(encoding="utf-8"):
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            north, east, down = map(float, fields[1:4])
            # Blender is Z-up. glTF export then yields (east, up, south).
            vertices.append((east, north, -down))
        elif fields[0] == "vt":
            texcoords.append(tuple(map(float, fields[1:3])))
        elif fields[0] == "f":
            assert len(fields) == 4, "Source must contain triangular faces"
            indices = [field.split("/") for field in fields[1:]]
            triangles.append(tuple(int(v[0]) - 1 for v in indices))
            corner_uv.extend(texcoords[int(v[1]) - 1] for v in indices)
    mesh = bpy.data.meshes.new("Observed Navcam terrain")
    mesh.from_pydata(vertices, [], triangles)
    uv = mesh.uv_layers.new(name="Observed image coordinates")
    uv.data.foreach_set("uv", np.asarray(corner_uv, dtype=np.float32).ravel())
    mesh.update()
    obj = bpy.data.objects.new("Perseverance Sol 9 - Site 3", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    material = bpy.data.materials.new("NASA Navcam observed texture - unlit")
    material.use_nodes = True
    material.node_tree.nodes.clear()
    nodes, links = material.node_tree.nodes, material.node_tree.links
    image = bpy.data.images.load(str(source / (PRODUCT + ".png")))
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = 1
    destination = nodes.new("ShaderNodeOutputMaterial")
    links.new(texture.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs[0], destination.inputs["Surface"])
    mesh.materials.append(material)
    obj["source_product"] = PRODUCT
    obj["source_frame"] = "SITE_FRAME 3; metres; X north, Y east, Z down"
    obj["display_frame"] = "glTF X east, Y up, Z south; no translation or scale"
    obj["credit"] = "Courtesy NASA/JPL-Caltech"
    obj["limitations"] = "Single stereo wedge; holes remain unknown. Not registered to the mission planning grids."
    common = dict(export_format="GLB", use_selection=True, export_yup=True,
                  export_normals=False, export_tangents=False, export_cameras=False,
                  export_lights=False, export_animations=False, export_extras=True,
                  export_image_format="JPEG", export_jpeg_quality=95)
    full = output / "sol9-navcam-full.glb"
    bpy.ops.export_scene.gltf(filepath=str(full), **common)
    make_unlit(full)
    # Optional lighter visual LoD. Authoritative source stays in the full file.
    modifier = obj.modifiers.new("Visual LoD 25 percent", "DECIMATE")
    modifier.ratio = .25
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    reduced = output / "sol9-navcam-efficient.glb"
    bpy.ops.export_scene.gltf(filepath=str(reduced), **common)
    make_unlit(reduced)
    tree = BVHTree.FromPolygons([v.co for v in obj.data.vertices], [list(f.vertices) for f in obj.data.polygons], all_triangles=True)
    used_indices = np.unique(np.asarray(triangles).ravel())
    sample_indices = used_indices[np.linspace(0, len(used_indices)-1, min(len(used_indices), 10000), dtype=int)]
    distances = np.asarray([tree.find_nearest(Vector(vertices[i]))[3] for i in sample_indices])
    scene = bpy.context.scene
    camera_data = bpy.data.cameras.new("Illustrative inspection view")
    camera = bpy.data.objects.new("Illustrative inspection view", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0, -.1, 1.7)
    camera.rotation_euler = (Vector((-.8, -6, .12)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = 23
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.world.color = (.025, .025, .025)
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(source / "inspection.png")
    bpy.ops.render.render(write_still=True)
    report = {"product": PRODUCT, "blender": bpy.app.version_string,
              "sourceVertices": len(vertices), "sourceTriangles": len(triangles),
              "efficientTriangles": len(obj.data.polygons),
              "displayBoundsBlender": {"min": np.min(vertices, axis=0).tolist(), "max": np.max(vertices, axis=0).tolist()},
              "texturePixels": list(image.size),
              "lodDistanceSample": {"direction": "Used source vertices to efficient triangle surface", "method": "10000 evenly spaced used source vertex indices, deterministic, nearest triangle distance in metres; orphan vertices excluded", "samples": len(distances), "medianMetres": float(np.median(distances)), "p95Metres": float(np.percentile(distances, 95)), "maximumMetres": float(np.max(distances)), "limitation": "Sampled approximation error only; not a terrain accuracy or collision guarantee."},
              "files": [{"name": p.name, "bytes": p.stat().st_size, "sha256": digest(p)} for p in (full, reduced)],
              "sources": [{"name": p.name, "bytes": p.stat().st_size, "sha256": digest(p)} for p in [source/(PRODUCT+ext) for ext in (".obj", ".png", ".mtl", ".obj.xml")]]}
    (output / "conversion.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
