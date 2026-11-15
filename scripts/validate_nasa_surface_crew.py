"""Validate the exported illustrative crew asset without a rendering context."""
from pathlib import Path
import json, struct, hashlib
import numpy as np
root=Path(__file__).resolve().parents[1]
path=root/'public/models/nasa-emu-surface.glb'
blob=path.read_bytes(); magic,version,size=struct.unpack_from('<4sII',blob,0)
assert magic==b'glTF' and version==2 and size==len(blob)
jn,jt=struct.unpack_from('<II',blob,12);g=json.loads(blob[20:20+jn]);offset=20+jn
bn,bt=struct.unpack_from('<II',blob,offset);data=blob[offset+8:offset+8+bn]
components={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
lengths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dtype=np.dtype(components[a['componentType']]);n=lengths[a['type']]
 offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*dtype.itemsize)
 return np.ndarray((a['count'],n),dtype=dtype,buffer=data,offset=offset,strides=(stride,dtype.itemsize))
def matrix(node):
 if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
 x,y,z,w=node.get('rotation',[0,0,0,1]);q=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
 m=np.eye(4);m[:3,:3]=q@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0]);return m
triangles=0;bounds=[];skinned=0
world={}
def visit(i,parent):
 node=g['nodes'][i];world[i]=parent@matrix(node)
 for child in node.get('children',[]):visit(child,world[i])
for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,np.eye(4))
for i,node in enumerate(g['nodes']):
 if 'mesh' not in node:continue
 for p in g['meshes'][node['mesh']]['primitives']:
  a=p['attributes'];v=accessor(a['POSITION']);assert np.isfinite(v).all();v=np.c_[v,np.ones(len(v))]@world[i].T;bounds.append(v[:,:3])
  idx=accessor(p['indices']).reshape(-1);assert len(idx)%3==0 and idx.max()<len(v);triangles+=len(idx)//3
  if 'JOINTS_0' in a:
   skinned+=1;weights=accessor(a['WEIGHTS_0']);assert np.allclose(weights.sum(axis=1),1,atol=1e-5)
   assert accessor(a['JOINTS_0']).max()<len(g['skins'][node['skin']]['joints'])
points=np.concatenate(bounds);low=points.min(axis=0);high=points.max(axis=0)
assert triangles<100000
assert abs(low[1])<.03 and 1.8<high[1]-low[1]<1.9,(low,high)
expected={'CrewRoot','Thigh_L','Shin_L','Arm_L','Forearm_L','Thigh_R','Shin_R','Arm_R','Forearm_R'}
actual={g['nodes'][n]['name'] for n in g['skins'][0]['joints']};assert expected==actual
assert any('normalTexture' in m for m in g['materials'])
result={'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'triangles':triangles,'primitives':skinned,'materials':len(g['materials']),'joints':sorted(actual),'boundsMetres':{'min':low.tolist(),'max':high.tolist()},'embeddedImages':len(g.get('images',[])),'finiteVertices':True,'normalizedSkinWeights':True,'scope':'Asset structure, dimensions and rendering contract; not calibrated suit biomechanics'}
(root/'public/models/nasa-emu-surface-validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
