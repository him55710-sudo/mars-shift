"""Convert NASA source tiles and sample their original geometry; no visual infill."""
from pathlib import Path
import io,json,struct,hashlib,math,urllib.request,concurrent.futures
import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion,label
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'.local/drive1004/source'
OUT=ROOT/'public/data/drive1004';OUT.mkdir(parents=True,exist_ok=True)
SELECT=['NLF_0477_0709296508M723RAS_N0261004NCAM00701_0A0085J02','NLF_0477_0709297328M366RAS_N0261004NCAM03477_0A0195J02','NLF_0477_0709297503M102RAS_N0261004NCAM03477_0A0195J02','NLF_0477_0709298299M678RAS_N0261004NCAM13477_0A0195J02']
CONTEXT=['NLF_0477_0709297668M065RAS_N0261004NCAM03477_0A0195J02','NLF_0477_0709297838M897RAS_N0261004NCAM02477_0A0195J02','NLF_0477_0709298005M099RAS_N0261004NCAM02477_0A0195J02','NLF_0477_0709298187M680RAS_N0261004NCAM13477_0A0195J02','NLF_0477_0709298393M010RAS_N0261004NCAM13477_0A0195J02']
SOURCE_COMMIT='76444abbb4faff1b05f46a09b81ca2c24602b333'
BASE=f'https://raw.githubusercontent.com/NASA-AMMOS/3DTilesSampleData/{SOURCE_COMMIT}/m20-drive-1004/tilesets/'
if any(not (SRC/p/(p+'_tileset.json')).exists() for p in SELECT+CONTEXT):
 tree=json.load(urllib.request.urlopen(f'https://api.github.com/repos/NASA-AMMOS/3DTilesSampleData/git/trees/{SOURCE_COMMIT}?recursive=1'))['tree']
 files=[v for v in tree if v['type']=='blob' and not v['path'].endswith('_index.png') and (any(v['path'].startswith('m20-drive-1004/tilesets/'+p+'/') for p in SELECT) or any(v['path'].startswith('m20-drive-1004/tilesets/'+p+'/') and (v['path'].endswith('.json') or v['path'].endswith('/root.b3dm')) for p in CONTEXT))]
 def download(v):
  relative=v['path'].split('/tilesets/',1)[1];p=SRC/relative;p.parent.mkdir(parents=True,exist_ok=True)
  if not p.exists() or p.stat().st_size!=v['size']:p.write_bytes(urllib.request.urlopen(BASE+relative,timeout=60).read())
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(download,files))
ORIGIN=np.array([-8.,-4.]);CELL=.25;W=160;H=160
YMIN=np.full(W*H,np.inf);YMAX=np.full(W*H,-np.inf);SLOPE=np.zeros(W*H);HITS=np.zeros(W*H,dtype=np.int32)
ASSETS=[];DETAIL_ASSETS=[];RECORDS=[];ALLBOUNDS=[];SOURCE_TRIS=0
DTYPE={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
DIMS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def parse(path):
 b=path.read_bytes();off=28+sum(struct.unpack('<4I',b[12:28]));g=b[off:];jl=struct.unpack('<I',g[12:16])[0];j=json.loads(g[20:20+jl]);bl=struct.unpack('<I',g[20+jl:24+jl])[0];return j,g[28+jl:28+jl+bl]
def acc(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt=np.dtype(DTYPE[a['componentType']]);n=DIMS[a['type']];o=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dt.itemsize*n)
 return np.ndarray((a['count'],n),dtype=dt,buffer=b,offset=o,strides=(stride,dt.itemsize)).copy()
def extract(j,b,m):
 assert all(not any(k in n for k in ['matrix','translation','rotation','scale']) for n in j.get('nodes',[])), 'Unexpected node transform'
 for mesh in j['meshes']:
  for q in mesh['primitives']:
   p=acc(j,b,q['attributes']['POSITION']);pos=p@m[:3,:3].T+m[:3,3];idx=acc(j,b,q['indices']).reshape(-1,3);yield pos,idx
def repack(j,b,path):
 images={a['bufferView']:a for a in j.get('images',[]) if 'bufferView'in a};blocks=[];offset=0;replacement={}
 # Lossless index narrowing: retain every index value and all vertex attributes.
 # No quantization, simplification, normal removal, or vertex-coordinate changes.
 for mesh in j['meshes']:
  for primitive in mesh['primitives']:
   ai=primitive['indices'];a=j['accessors'][ai];vi=a['bufferView'];v=j['bufferViews'][vi]
   if a['componentType']==5125 and not a.get('byteOffset') and 'byteStride' not in v:
    values=acc(j,b,ai)
    if values.max()<65536:
     replacement[vi]=values.astype('<u2').tobytes();a['componentType']=5123
 for i,v in enumerate(j['bufferViews']):
  block=replacement.get(i,b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
  if i in images:
   im=Image.open(io.BytesIO(block)).convert('RGB');o=io.BytesIO();im.save(o,format='JPEG',quality=95,subsampling=0);block=o.getvalue();images[i]['mimeType']='image/jpeg'
  pad=(-offset)%4
  if pad:blocks.append(b'\0'*pad);offset+=pad
  v['byteOffset']=offset;v['byteLength']=len(block);blocks.append(block);offset+=len(block)
 data=b''.join(blocks);data+=b'\0'*((-len(data))%4);j['buffers'][0]['byteLength']=len(data);js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
 out=struct.pack('<4sII',b'glTF',2,28+len(js)+len(data))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(data),b'BIN\0')+data;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(out);return len(out),hashlib.sha256(out).hexdigest()
def raster(pos,idx):
 global SOURCE_TRIS
 SOURCE_TRIS+=len(idx)
 for chunk in range(0,len(idx),20000):
  tri=pos[idx[chunk:chunk+20000]];xz=tri[:,:,[0,2]];lo=np.ceil((xz.min(1)-ORIGIN)/CELL-.5).astype(int);hi=np.floor((xz.max(1)-ORIGIN)/CELL-.5).astype(int)
  lo=np.maximum(lo,[0,0]);hi=np.minimum(hi,[W-1,H-1]);good=np.all(hi>=lo,axis=1);tri=tri[good];lo=lo[good];hi=hi[good]
  if not len(tri):continue
  spans=hi-lo+1
  for sx,sz in np.unique(spans,axis=0):
   mask=(spans[:,0]==sx)&(spans[:,1]==sz);a=tri[mask];l=lo[mask];dx,dz=np.meshgrid(np.arange(sx),np.arange(sz));dx=dx.ravel();dz=dz.ravel();group=max(1,1000000//len(dx))
   for start in range(0,len(a),group):
    t=a[start:start+group];ll=l[start:start+group];gx=ll[:,0,None]+dx;gz=ll[:,1,None]+dz;x=ORIGIN[0]+(gx+.5)*CELL;z=ORIGIN[1]+(gz+.5)*CELL
    ax,az=t[:,0,0,None],t[:,0,2,None];bx,bz=t[:,1,0,None],t[:,1,2,None];cx,cz=t[:,2,0,None],t[:,2,2,None];den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz)
    with np.errstate(divide='ignore',invalid='ignore'):
     u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den;v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;w=1-u-v
    valid=(u>=-1e-7)&(v>=-1e-7)&(w>=-1e-7)&(abs(den)>1e-9)
    with np.errstate(invalid='ignore'):heights=u*t[:,0,1,None]+v*t[:,1,1,None]+w*t[:,2,1,None]
    norm=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);sl=np.degrees(np.arctan2(np.hypot(norm[:,0],norm[:,2]),abs(norm[:,1])))
    ids=(gz*W+gx)[valid];ys=heights[valid];ss=np.broadcast_to(sl[:,None],valid.shape)[valid];np.minimum.at(YMIN,ids,ys);np.maximum.at(YMAX,ids,ys);np.maximum.at(SLOPE,ids,ss);np.add.at(HITS,ids,1)
for si,product in enumerate(SELECT):
 d=SRC/product;t=json.loads((d/(product+'_tileset.json')).read_text());sc=json.loads((d/(product+'_scene.json')).read_text());site=next(f for f in sc['frames'] if f['id']=='site_026');s=np.eye(4);s[:3,3]=[site['translation'][q] for q in 'xyz'];r=np.array([[1,0,0,0],[0,0,-1,0],[0,1,0,0],[0,0,0,1]]);m=r@s@np.array(t['root']['transform']).reshape(4,4).T
 for node in t['root']['children']:
  filename=node['content']['uri'];j,b=parse(d/filename);triangles=0;positions=[]
  for pos,idx in extract(j,b,m):positions.append(pos);triangles+=len(idx)
  xyz=np.concatenate(positions);bounds=[xyz.min(0).tolist(),xyz.max(0).tolist()];ALLBOUNDS.append(bounds);url=f'/data/drive1004/observation-{si}/{Path(filename).stem}.glb';size,sha=repack(j,b,OUT/f'observation-{si}/{Path(filename).stem}.glb')
  ASSETS.append({'url':url,'transform':m.T.ravel().tolist(),'bounds':bounds,'triangles':triangles,'bytes':size,'sha256':sha,'sourceProduct':product,'sourceTile':filename,'sourceUrl':BASE+product+'/'+filename,'sourceSha256':hashlib.sha256((d/filename).read_bytes()).hexdigest(),'visualLod':'NASA tileset first child hierarchy level'})
 leaves=[]
 def visit(n):
  if not n.get('children'):leaves.append(n)
  for c in n.get('children',[]):visit(c)
 visit(t['root'])
 for node in leaves:
  j,b=parse(d/node['content']['uri'])
  positions=[];triangles=0
  for pos,idx in extract(j,b,m):raster(pos,idx);positions.append(pos);triangles+=len(idx)
  xyz=np.concatenate(positions);bounds=[xyz.min(0).tolist(),xyz.max(0).tolist()];filename=node['content']['uri'];url=f'/data/drive1004/detail-{si}/{Path(filename).stem}.glb';size,sha=repack(j,b,OUT/f'detail-{si}/{Path(filename).stem}.glb')
  DETAIL_ASSETS.append({'url':url,'transform':m.T.ravel().tolist(),'bounds':bounds,'triangles':triangles,'bytes':size,'sha256':sha,'sourceProduct':product,'sourceTile':filename,'sourceUrl':BASE+product+'/'+filename,'sourceSha256':hashlib.sha256((d/filename).read_bytes()).hexdigest(),'visualLod':'NASA finest available original leaf mesh and texture'})
 RECORDS.append({'product':product,'sceneUrl':BASE+product+'/'+product+'_scene.json','tilesetUrl':BASE+product+'/'+product+'_tileset.json','sourceLeafTiles':len(leaves),'transform':m.T.ravel().tolist()});print('processed',product,flush=True)
for ci,product in enumerate(CONTEXT):
 d=SRC/product;t=json.loads((d/(product+'_tileset.json')).read_text());sc=json.loads((d/(product+'_scene.json')).read_text());site=next(f for f in sc['frames'] if f['id']=='site_026');s=np.eye(4);s[:3,3]=[site['translation'][q] for q in 'xyz'];r=np.array([[1,0,0,0],[0,0,-1,0],[0,1,0,0],[0,0,0,1]]);m=r@s@np.array(t['root']['transform']).reshape(4,4).T
 filename='root.b3dm';j,b=parse(d/filename);triangles=0;positions=[]
 for pos,idx in extract(j,b,m):positions.append(pos);triangles+=len(idx)
 xyz=np.concatenate(positions);bounds=[xyz.min(0).tolist(),xyz.max(0).tolist()];ALLBOUNDS.append(bounds);url=f'/data/drive1004/context-{ci}.glb';size,sha=repack(j,b,OUT/f'context-{ci}.glb')
 ASSETS.append({'url':url,'transform':m.T.ravel().tolist(),'bounds':bounds,'triangles':triangles,'bytes':size,'sha256':sha,'sourceProduct':product,'sourceTile':filename,'sourceUrl':BASE+product+'/'+filename,'sourceSha256':hashlib.sha256((d/filename).read_bytes()).hexdigest(),'visualLod':'NASA original root hierarchy, visual context only','contextOnly':True})
 DETAIL_ASSETS.append(ASSETS[-1])
coverage=HITS>0;conflict=coverage&((YMAX-YMIN)>.2);valid=coverage&~conflict
# A valid source cell must also have consistent visible geometry. This mask
# prevents walking over a tiny hole introduced by the published visual LoD.
fine=(YMIN.copy(),YMAX.copy(),SLOPE.copy(),HITS.copy(),SOURCE_TRIS)
YMIN[:]=np.inf;YMAX[:]=-np.inf;SLOPE[:]=0;HITS[:]=0
for record in RECORDS:
 d=SRC/record['product'];t=json.loads((d/(record['product']+'_tileset.json')).read_text());m=np.array(record['transform']).reshape(4,4).T
 for n in t['root']['children']:
  j,b=parse(d/n['content']['uri'])
  for pos,idx in extract(j,b,m):raster(pos,idx)
visual=YMAX.copy();YMIN[:],YMAX[:],SLOPE[:],HITS[:],SOURCE_TRIS=fine
agreement=valid&np.isfinite(visual);delta=visual[agreement]-YMAX[agreement]
display_missing=valid&~np.isfinite(visual)
with np.errstate(invalid='ignore'):display_conflict=agreement&(np.abs(visual-YMAX)>.2)
valid=valid&~display_missing&~display_conflict
validation={'sourceCommit':SOURCE_COMMIT,'visualVersusSource':{'sampledKnownCells':int(agreement.sum()),'medianAbsMetres':float(np.median(abs(delta))),'p95AbsMetres':float(np.quantile(abs(delta),.95)),'maxAbsMetres':float(max(abs(delta))),'displayMissingCellsMasked':int(display_missing.sum()),'displayConflictCellsMasked':int(display_conflict.sum()),'limitation':'LoD approximation difference only; not source stereo accuracy'}}
(OUT/'validation.json').write_text(json.dumps(validation,indent=2)+'\n',encoding='utf-8')
z=YMAX.reshape(H,W);v=valid.reshape(H,W);sl=SLOPE.reshape(H,W)
for dx,dz in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]:
 x0=max(0,-dx);x1=min(W,W-dx);z0=max(0,-dz);z1=min(H,H-dz);a=z[z0:z1,x0:x1];b=z[z0+dz:z1+dz,x0+dx:x1+dx];ok=v[z0:z1,x0:x1]&v[z0+dz:z1+dz,x0+dx:x1+dx]
 with np.errstate(invalid='ignore'):g=np.degrees(np.arctan(abs(b-a)/(CELL*math.hypot(dx,dz))))
 section=sl[z0:z1,x0:x1];section[:]=np.where(ok,np.maximum(section,g),section)
walk=binary_erosion(v&(sl<=30),structure=np.ones((5,5),bool),border_value=0);components,n=label(walk,np.ones((3,3)));counts=np.bincount(components.ravel());counts[0]=0;eligible=np.flatnonzero(counts>=200)
def near_score(c):
 p=np.argwhere(components==c);world=np.column_stack([ORIGIN[0]+(p[:,1]+.5)*CELL,ORIGIN[1]+(p[:,0]+.5)*CELL]);return np.linalg.norm(world-[3,3],axis=1).min()
component=int(min(eligible,key=near_score)) if len(eligible) else int(counts.argmax());coords=np.argwhere(components==component)
if len(coords)<10:raise RuntimeError('No useful contiguous walking footprint')
world=np.column_stack([ORIGIN[0]+(coords[:,1]+.5)*CELL,ORIGIN[1]+(coords[:,0]+.5)*CELL]);nearest=int(np.argmin(np.sum((world-[3,3])**2,1)));start=world[nearest];distance=np.linalg.norm(world-start,axis=1);score=abs(distance-15)+.15*abs(world[:,0]-start[0]);target=world[np.argmin(score+np.where(distance>8,0,100))]
encode=lambda arr:[round(float(x),5) if ok else None for x,ok in zip(arr,valid)]
grid={'schemaVersion':1,'width':W,'height':H,'cellSize':CELL,'origin':ORIGIN.tolist(),'elevation':encode(YMAX),'slope':encode(sl.ravel()),'start':{'x':float(start[0]),'z':float(start[1])},'target':{'x':float(target[0]),'z':float(target[1])},'coverage':{'sampledCells':int(coverage.sum()),'conflictingCells':int(conflict.sum()),'knownCells':int(valid.sum()),'totalCells':W*H,'selectedConservativeWalkComponentCells':int(counts[component])},'derivation':{'source':'Original finest available NASA source triangles, not visual LoD','sampling':'Vertical barycentric ray at each grid-cell center; maximum observed surface height','slope':'Maximum contributing triangle slope and eight-neighbor height grade','conflictThresholdMetres':.2,'unobserved':'null; no infill','resolutionMeaning':'0.25 m sampling interval, not an assertion of source stereo accuracy','startSelection':'30 degree, 0.5 m eroded component with at least 200 cells nearest local (3,3)','targetSelection':'Same connected component near 15 m Euclidean distance'}}
(OUT/'navigation-grid.json').write_text(json.dumps(grid,separators=(',',':'))+'\n',encoding='utf-8')
manifest={'schemaVersion':1,'sourceCommit':SOURCE_COMMIT,'validation':'/data/drive1004/validation.json','mediaUsageUrl':'https://www.nasa.gov/nasa-brand-center/images-and-media/','id':'perseverance-drive-1004-sol477','title':'Perseverance · Jezero / Drive 1004','credit':'Courtesy NASA/JPL-Caltech','sourceUrl':'https://github.com/NASA-AMMOS/3DTilesSampleData/tree/master/m20-drive-1004','usagePolicyUrl':'https://www.jpl.nasa.gov/jpl-image-use-policy/','grid':'/data/drive1004/navigation-grid.json','assets':ASSETS,'observations':RECORDS,'frame':{'name':'sitedrive_0261004, displayed with NASA example Rx(+pi/2)','units':'metres','axes':['north','up','east'],'transformOrder':'Rx(+pi/2) * site-frame translation * tileset root transform. Apply asset.transform once; GLB positions are original source positions.','registrationToOrbitalMission':None},'bounds':[np.array(ALLBOUNDS)[:,0].min(0).tolist(),np.array(ALLBOUNDS)[:,1].max(0).tolist()],'start':grid['start'],'target':grid['target'],'processing':{'geometry':'Original NASA first-child meshes plus original root-LoD surrounding context; no added or moved vertices; b3dm repacked as glTF','imageEncoding':'JPEG quality95 4:4:4; original pixel dimensions; no sharpening','displayTriangles':sum(a['triangles']for a in ASSETS),'displayBytes':sum(a['bytes']for a in ASSETS),'displayDrawCalls':len(ASSETS),'navigationSourceTriangles':SOURCE_TRIS},'limitations':['Observed finite wedges only; no synthetic ground beyond coverage.','Local graph belongs to this station and is not a registration of existing NOAH-H routes.','NASA-provided stereo and inter-observation alignment are reused but not independently survey-validated.','0.25m grid sampling and geometric slope are prototype proxies, not calibrated EVA traversability or certified safety.','Source mesh uncertainties and unseen sub-grid obstacles remain unresolved.','Rendered NASA LoD is coarser than the source triangles used for the navigation raster.']}
manifest['detailAssets']=DETAIL_ASSETS
manifest['detailProcessing']={'geometry':'Original NASA finest available leaf meshes for the walking sector plus original root-LoD surrounding context','imageEncoding':'JPEG95 4:4:4, native tile pixel dimensions; no enlargement or sharpening','triangles':sum(a['triangles']for a in DETAIL_ASSETS),'bytes':sum(a['bytes']for a in DETAIL_ASSETS),'drawCalls':len(DETAIL_ASSETS),'textureNote':'Leaf atlases retain the NASA sample tile pixel dimensions; tighter ground footprints improve local detail relative to first-child LoD. They are not full-resolution raw Navcam images.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');print(json.dumps({'assets':len(ASSETS),'processing':manifest['processing'],'detailProcessing':manifest['detailProcessing'],'grid':grid['coverage'],'start':grid['start'],'target':grid['target']}),flush=True)
