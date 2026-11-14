"""Reproduce a compact, articulated visual EMU asset in Blender 5.2.

Run Blender --background --factory-startup --python scripts/prepare_nasa_crew.py.
The NASA source is downloaded as data into the adjacent research directory.
No scripts or executables are downloaded. The walking rig is illustrative.
"""
from pathlib import Path
import hashlib
import json
import math
import urllib.request
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT.parent / 'research' / 'realism'
OUT = ROOT / 'public' / 'models'
SOURCE = WORK / 'nasa-emu-original.glb'
URL = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Extravehicular%20Mobility%20Unit/Extravehicular%20Mobility%20Unit.glb'
WORK.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
if not SOURCE.exists():
    urllib.request.urlretrieve(URL, SOURCE)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
original_triangles = sum(len(p.vertices)-2 for p in mesh.data.polygons)

# Four nested visor layers share essentially coincident surfaces in the original.
# Keep the complete outer visor and helmet, discard redundant interior highlights.
import bmesh
bm = bmesh.new()
bm.from_mesh(mesh.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in {17,18,23,24}], context='FACES')
bm.to_mesh(mesh.data)
bm.free()

def material(name, color, roughness, metalness=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color,1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metalness
    m.diffuse_color = (*color,1)
    return m

mats = [material('Pressure suit / unbranded',(.82,.81,.75),.73),
        material('Life support pack',(.72,.74,.71),.65),
        material('Connectors and seals',(.10,.13,.15),.62,.2),
        material('Hardware',(.17,.21,.24),.4,.45),
        material('Safety bands',(.58,.065,.035),.63),
        material('Gold visor',(.47,.31,.09),.19,.86),
        material('Hose couplings',(.43,.32,.20),.48,.35)]
mapping = {0:0,1:3,2:0,3:1,4:2,5:1,6:1,7:3,8:2,9:4,10:0,11:3,12:6,13:5,14:3,15:6,16:5,18:5,19:3,20:0,21:0,22:5}
indices = [mapping.get(p.material_index,0) for p in mesh.data.polygons]
mesh.data.materials.clear()
for m in mats: mesh.data.materials.append(m)
for p,i in zip(mesh.data.polygons,indices): p.material_index=i

# Preserve source geometry, normalized for the illustration; Blender +Y becomes
# glTF -Z, and Blender +Z becomes glTF +Y. The source chest faces Blender +Y.
low = min(v.co.z for v in mesh.data.vertices)
high = max(v.co.z for v in mesh.data.vertices)
scale = 1.85/(high-low)
for v in mesh.data.vertices:
    v.co = Vector(((v.co.x-.015)*scale,(v.co.y+.105)*scale,(v.co.z-low)*scale))
# The historical source contains overlapping suit shells. Voxel union removes
# hidden shells before reduction, preventing coplanar fragments and z-fighting.
from mathutils.bvhtree import BVHTree
source_tree=BVHTree.FromPolygons([v.co.copy() for v in mesh.data.vertices],[list(p.vertices) for p in mesh.data.polygons],all_triangles=True)
source_materials=[p.material_index for p in mesh.data.polygons]
mesh.data.remesh_voxel_size=.006
bpy.ops.object.voxel_remesh()
dec = mesh.modifiers.new('Web surface reduction','DECIMATE')
dec.ratio = min(1.0,38000/sum(len(p.vertices)-2 for p in mesh.data.polygons))
dec.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=dec.name)
for p in mesh.data.polygons:
    center=sum((mesh.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
    hit=source_tree.find_nearest(center)
    p.material_index=source_materials[hit[2]] if hit and hit[2] is not None else 0
    p.use_smooth=True
# A compact PLSS illustration replaces the space-only maneuvering frame.
# It is asset geometry, never an observed or engineered NASA Mars suit claim.
from mathutils import Matrix
# Remove the original space maneuvering frame behind the pressure suit.
# The cut is capped before remeshing; the head silhouette remains above a
# separately constructed compact illustrative surface-rehearsal pack.
bm=bmesh.new();bm.from_mesh(mesh.data)
cut=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,plane_co=(0,-.12,0),plane_no=(0,-1,0),clear_outer=True,clear_inner=False)
extras=[f for f in bm.faces if f.calc_center_median().z>1.5 and abs(f.calc_center_median().x)>.24 or f.calc_center_median().z<.9 and abs(f.calc_center_median().x)>.30]
bmesh.ops.delete(bm,geom=extras,context='FACES')
bmesh.ops.holes_fill(bm,edges=[e for e in cut['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_valid and e.is_boundary],sides=0)
bmesh.ops.triangulate(bm,faces=list(bm.faces))
existing=set(bm.verts)
def box(center,dimensions,material_index,bevel):
    before=set(bm.faces)
    result=bmesh.ops.create_cube(bm,size=1,matrix=Matrix.Translation(Vector(center))@Matrix.Diagonal((*dimensions,1)))
    edges=list({e for v in result['verts'] for e in v.link_edges})
    if bevel:bmesh.ops.bevel(bm,geom=edges,offset=bevel,segments=3,affect='EDGES')
    for f in set(bm.faces)-before:f.material_index=material_index;f.smooth=False
box((0,-.28,1.12),(.54,.30,.67),1,.035)
box((0,-.441,1.13),(.405,.024,.43),3,.012)
box((0,-.456,1.29),(.405,.015,.025),4,.005)
box((0,-.448,.91),(.37,.016,.045),2,.006)
box((-.19,-.127,1.14),(.045,.026,.59),2,.01)
box((.19,-.127,1.14),(.045,.026,.59),2,.01)
bm.verts.index_update();pack_indices={v.index for v in bm.verts if v not in existing};bm.to_mesh(mesh.data);bm.free()
mesh.name = 'NASA EMU / adapted visual crew'

# A small skin keeps knees and shoulders continuous rather than splitting the
# detailed suit into disconnected primitives. Joint locations are visual fits,
# not a human biomechanics or NASA suit mobility model.
armature = bpy.data.armatures.new('Illustrative EVA walk skeleton')
rig = bpy.data.objects.new('EVA_visual_rig',armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
mesh.select_set(False);rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=armature.edit_bones.new(name);b.head=head;b.tail=tail
    if parent: b.parent=armature.edit_bones[parent]
    return b
bone('CrewRoot',(0,0,.92),(0,0,1.35))
for side,x in [('L',.135),('R',-.135)]:
    bone('Thigh_'+side,(x,0,.89),(x,0,.46),'CrewRoot')
    bone('Shin_'+side,(x,0,.46),(x,0,.08),'Thigh_'+side)
    ax=.31 if side=='L' else -.31
    bone('Arm_'+side,(ax,0,1.42),(ax*1.17,.035,1.12),'CrewRoot')
    bone('Forearm_'+side,(ax*1.17,.035,1.12),(ax*1.21,.12,.94),'Arm_'+side)
bpy.ops.object.mode_set(mode='OBJECT')
groups={b.name:mesh.vertex_groups.new(name=b.name) for b in armature.bones}
for v in mesh.data.vertices:
    x,y,z=v.co
    side='L' if x>=0 else 'R'
    weights={'CrewRoot':1.0}
    # Rear life-support hardware stays attached to the torso.
    if v.index in pack_indices:
        weights={'CrewRoot':1.0}
    elif z<.91:
        leg=max(0,min(1,(.94-z)/.12))
        lower=max(0,min(1,(.54-z)/.16))
        weights={'CrewRoot':1-leg,'Thigh_'+side:leg*(1-lower),'Shin_'+side:leg*lower}
    elif abs(x)>.255 and .76<z<1.57:
        arm=max(0,min(1,(abs(x)-.255)/.09))*max(0,min(1,(1.57-z)/.15))
        fore=max(0,min(1,(1.19-z)/.18))
        weights={'CrewRoot':1-arm,'Arm_'+side:arm*(1-fore),'Forearm_'+side:arm*fore}
    for name,w in weights.items():
        if w>1e-6:groups[name].add([v.index],w,'REPLACE')
modifier=mesh.modifiers.new('Illustrative skin','ARMATURE');modifier.object=rig
mesh.parent=rig
rig['classification']='Illustrative procedural walking; not validated suit biomechanics'
rig['source']='NASA / Michael D. Carbajal, EMU 3D Resources'
mesh['source_url']=URL

target=OUT/'nasa-emu-web.glb'
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True)
bpy.context.view_layer.objects.active=mesh
bpy.ops.export_scene.gltf(filepath=str(target),use_selection=True,export_format='GLB',export_animations=False,export_yup=True,export_apply=False)
triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons)
metadata={'sourceUrl':URL,'sourcePage':'https://science.nasa.gov/3d-resources/extravehicular-mobility-unit/','credit':'NASA / Michael D. Carbajal','sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceBytes':SOURCE.stat().st_size,'originalTriangles':original_triangles,'webTriangles':triangles,'webVertices':len(mesh.data.vertices),'webBytes':target.stat().st_size,'webSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'materials':len(mats),'bones':len(armature.bones),'heightMetres':1.85,'forward':'glTF local -Z','ground':'neutral sole at glTF local y=0','blenderVersion':bpy.app.version_string,'adaptation':['Removed redundant nested visor layers and unioned overlapping legacy shells at 6 mm display scale','Reduced polygons without adding terrain or physical suit claims','Consolidated materials, removed branded texture patches and replaced the space-only maneuvering frame with a compact beveled illustrative PLSS pack for a surface-rehearsal silhouette','Added illustrative 9-bone skin for a procedural walk'],'terms':'NASA Images and Media Usage Guidelines; research/educational illustration, no endorsement or flight qualification'}
(OUT/'nasa-emu-web.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')

# Keep editable source outside the application bundle, plus one compact preview.
deliver=ROOT.parent/'deliverables';deliver.mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(deliver/'MARS-SHIFT-NASA-EMU.blend'))
for name in ['Camera','Light']:
    if name in bpy.data.objects:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
scene=bpy.context.scene
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.engine='CYCLES';scene.cycles.samples=12
scene.world=bpy.data.worlds.new('Neutral asset preview world');scene.world.color=(.13,.15,.18)
def area(name,location,energy,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm key',(2,3,4),500,4);area('Cool rim',(-2,-2,3),350,3)
camera_data=bpy.data.cameras.new('Crew preview camera');camera=bpy.data.objects.new('Crew preview camera',camera_data);scene.collection.objects.link(camera)
camera.location=(2.7,3.8,2.2);camera.rotation_euler=(Vector((0,-.1,.98))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=2.25;scene.camera=camera
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(WORK/'nasa-emu-web-preview.png');bpy.ops.render.render(write_still=True)
camera.location=(-2.7,-3.8,2.2);camera.rotation_euler=(Vector((0,-.1,.98))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(WORK/'nasa-emu-web-back-preview.png');bpy.ops.render.render(write_still=True)
print('CREW_ASSET_REPORT',json.dumps(metadata))
