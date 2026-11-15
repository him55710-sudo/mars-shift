"""Independent source/GLB array checks and direct triangle-ray raster checks."""
from pathlib import Path
import json,struct,numpy as np
from PIL import Image
import io
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/data/drive1004';SRC=ROOT/'.local/drive1004/source'
manifest=json.loads((OUT/'manifest.json').read_text());grid=json.loads((OUT/'navigation-grid.json').read_text());result=json.loads((OUT/'validation.json').read_text())
DT={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'};DIM={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def parse(path):
 b=path.read_bytes()
 if b[:4]==b'b3dm':b=b[28+sum(struct.unpack('<4I',b[12:28])):]
 length=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+length]);return j,b[28+length:]
def read(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);dim=DIM[a['type']];return np.ndarray((a['count'],dim),buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),dtype=dt,strides=(v.get('byteStride',dt.itemsize*dim),dt.itemsize))
def image_sizes(j,b):
 out=[]
 for im in j.get('images',[]):
  v=j['bufferViews'][im['bufferView']];out.append(Image.open(io.BytesIO(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).size)
 return out
vertices=indices=0
unique_assets={a['url']:a for a in manifest['assets']+manifest.get('detailAssets',[])}
for asset in unique_assets.values():
 a,ab=parse(SRC/asset['sourceProduct']/asset['sourceTile']);b,bb=parse(ROOT/'public'/asset['url'].lstrip('/'));assert len(a['accessors'])==len(b['accessors'])
 for k in range(len(a['accessors'])):assert np.array_equal(read(a,ab,k),read(b,bb,k)),f'Geometry changed: {asset["url"]} accessor {k}'
 assert image_sizes(a,ab)==image_sizes(b,bb),'Image dimensions changed'
 vertices+=a['accessors'][0]['count'];indices+=a['accessors'][3]['count']
triangles=[]
for obs in manifest['observations']:
 d=SRC/obs['product'];t=json.loads((d/(obs['product']+'_tileset.json')).read_text());m=np.array(obs['transform']).reshape(4,4).T;leaves=[]
 def visit(n):
  if not n.get('children'):leaves.append(n)
  for c in n.get('children',[]):visit(c)
 visit(t['root'])
 for n in leaves:
  j,b=parse(d/n['content']['uri'])
  for mesh in j['meshes']:
   for q in mesh['primitives']:
    p=read(j,b,q['attributes']['POSITION'])@m[:3,:3].T+m[:3,3];ix=read(j,b,q['indices']).reshape(-1,3);triangles.append(p[ix])
t=np.concatenate(triangles);lo=t[:,:,[0,2]].min(1);hi=t[:,:,[0,2]].max(1)
known=np.flatnonzero([v is not None for v in grid['elevation']]);samples=known[np.linspace(0,len(known)-1,64,dtype=int)];errors=[]
for i in samples:
 x=grid['origin'][0]+(i%grid['width']+.5)*grid['cellSize'];z=grid['origin'][1]+(i//grid['width']+.5)*grid['cellSize'];c=t[np.all(lo<=[x,z],1)&np.all(hi>=[x,z],1)]
 a,b,d=c[:,0],c[:,1],c[:,2];den=(b[:,2]-d[:,2])*(a[:,0]-d[:,0])+(d[:,0]-b[:,0])*(a[:,2]-d[:,2]);nonzero=abs(den)>1e-9;a=a[nonzero];b=b[nonzero];d=d[nonzero];den=den[nonzero]
 u=((b[:,2]-d[:,2])*(x-d[:,0])+(d[:,0]-b[:,0])*(z-d[:,2]))/den;v=((d[:,2]-a[:,2])*(x-d[:,0])+(a[:,0]-d[:,0])*(z-d[:,2]))/den;w=1-u-v;inside=(u>=-1e-7)&(v>=-1e-7)&(w>=-1e-7);height=(u*a[:,1]+v*b[:,1]+w*d[:,1])[inside]
 assert len(height)>0,'Known raster cell has no original triangle'
 assert height.max()-height.min()<=.200001,'Conflicting source surfaces marked known'
 errors.append(abs(float(height.max())-grid['elevation'][i]))
assert max(errors)<.000006
result['conversionChecks']={'assets':len(unique_assets),'vertices':vertices,'triangleIndices':indices,'allAccessorArraysIdentical':True,'allTextureDimensionsIdentical':True}
result['independentGridChecks']={'sampledKnownCells':len(samples),'method':'Direct vertical triangle intersections independently recomputed from original source leaves','maximumHeightDifferenceMetres':max(errors),'differenceMeaning':'Rounded JSON export consistency, not source measurement accuracy'}
(OUT/'validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,indent=2))
