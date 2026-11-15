"""Photo-projected, display-only backing for bounded holes in stereo coverage.
Never changes navigation-grid.json, original meshes, or support classifications.
Heights between measured samples are interpolated for appearance, not evidence.
"""
from pathlib import Path
import argparse, hashlib, io, json, struct, xml.etree.ElementTree as ET
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from scipy.ndimage import distance_transform_edt
from scipy.spatial.transform import Rotation
from PIL import Image
from prepare_navcam_calibrated import NS, project

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data/drive1004/display-v14'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def support_grid(e, stride=2, max_gap=3):
    g=e['grid'];source=np.array(e['elevation'],float).reshape(g['height'],g['width'])
    z=source[::stride,::stride];cell=g['cellSize']*stride
    rr,cc=np.indices(z.shape);x=g['origin'][0]+(cc*stride+.5)*g['cellSize'];y=g['origin'][1]+(rr*stride+.5)*g['cellSize']
    known=np.isfinite(z);distance=distance_transform_edt(~known)*cell
    filled=LinearNDInterpolator(np.column_stack((x[known],y[known])),z[known])(x,y)
    usable=np.isfinite(filled)&(distance<=max_gap)
    vertices=np.column_stack((x.ravel(),np.nan_to_num(filled,nan=0).ravel()-.04,y.ravel())).astype('<f4')
    a=np.arange(z.size).reshape(z.shape)[:-1,:-1].ravel();w=z.shape[1]
    triangles=np.concatenate((np.column_stack((a,a+w,a+1)),np.column_stack((a+1,a+w,a+w+1))))
    triangles=triangles[np.all(usable.ravel()[triangles],axis=1)]
    return vertices,triangles,{'spacingMetres':cell,'maximumDistanceToHeightSampleMetres':max_gap,'measuredSamples':int(known.sum()),'interpolatedSamples':int((usable&~known).sum()),'verticalDisplayOffsetMetres':-.04}

def build(cache):
    OUT.mkdir(parents=True,exist_ok=True)
    manifest_path=ROOT/'public/data/drive1004/manifest.json';nav=ROOT/'public/data/drive1004/navigation-grid.json'
    nav_hash=sha(nav);evidence=ROOT/'public/data/drive1004/surface-evidence.json'
    manifest=json.loads(manifest_path.read_text());points,triangles,stats=support_grid(json.loads(evidence.read_text()))
    centres=points[triangles].mean(axis=1);best=np.full(len(triangles),-np.inf);owner=np.full(len(triangles),-1);sources=[];uvs=[];photos=[]
    for k,o in enumerate(manifest['observations']):
        report=json.loads((ROOT/f'public/data/drive1004/calibrated-validation-{k}.json').read_text())
        img=cache/'navcam-calibrated'/report['sourceImageUrl'].split('/')[-1]
        xml=cache/'navcam-calibrated'/report['sourceLabelUrl'].split('/')[-1]
        assert sha(img)==report['sourceImageSha256'] and sha(xml)==report['sourceLabelSha256']
        scene_path=cache/'drive1004/source'/o['product']/(o['product']+'_scene.json')
        scene=json.loads(scene_path.read_text());image=scene['images'][0];frame=next(f for f in scene['frames']if f['id']==image['frame_id'])
        rotation=Rotation.from_quat([frame['rotation'][v]for v in ['x','y','z','w']]).as_matrix()
        label=ET.parse(xml).getroot();cm=label.find('.//g:CAHV_Model',NS)
        model={k:np.array([float(v.text)for v in cm.find('g:'+name,NS)])for k,name in [('C','Vector_Center'),('A','Vector_Axis'),('H','Vector_Horizontal'),('V','Vector_Vertical')]}
        arr=label.find('.//p:Array_3D_Image',NS);axes={v.find('p:axis_name',NS).text:int(v.find('p:elements',NS).text)for v in arr.findall('p:Axis_Array',NS)}
        h,w=axes['Line'],axes['Sample'];raw=np.memmap(img,dtype='>i2',mode='r',offset=int(arr.find('p:offset',NS).text),shape=(3,h,w))
        uv,depth=project(points,np.eye(4),rotation,model);px=np.clip(np.rint(uv).astype(int),[0,0],[w-1,h-1])
        valid=(depth>0)&np.all(uv>=[2,2],axis=1)&np.all(uv<[w-2,h-2],axis=1)&(raw[:,px[:,1],px[:,0]].sum(0)>0)
        margin=np.min(np.column_stack((uv[:,0]/w,1-uv[:,0]/w,uv[:,1]/h,1-uv[:,1]/h)),axis=1)
        score=np.min(margin[triangles],axis=1);score[~np.all(valid[triangles],axis=1)]=-np.inf
        use=score>best;best[use]=score[use];owner[use]=k;uvs.append(((uv+.5)/[w,h]).astype('<f4'))
        mapping=report['displayMapping'];rgb=np.moveaxis(np.asarray(raw[:,::2,::2],dtype=np.float32),0,-1)
        rgb=np.rint(np.clip((rgb-mapping['blackDN'])/(mapping['whiteDN']-mapping['blackDN']),0,1)**mapping['power']*255).astype('uint8')
        photo=Image.fromarray(rgb);photo.thumbnail((2048,2048));stream=io.BytesIO();photo.save(stream,'JPEG',quality=92,subsampling=0);photos.append(stream.getvalue())
        sources.append({'image':report['sourceImageUrl'],'imageSha256':sha(img),'label':report['sourceLabelUrl'],'labelSha256':sha(xml),'scene':o['sceneUrl'],'sceneSha256':sha(scene_path)})
    j={'asset':{'version':'2.0','generator':'MARS SHIFT display-only stereo gap context'},'extensionsUsed':['KHR_materials_unlit'],'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[]}],'buffers':[{}],'bufferViews':[],'accessors':[],'images':[],'textures':[],'materials':[]};binary=bytearray()
    def block(data,target=None):
        binary.extend(b'\0'*((-len(binary))%4));v={'buffer':0,'byteOffset':len(binary),'byteLength':len(data)}
        if target:v['target']=target
        j['bufferViews'].append(v);binary.extend(data);return len(j['bufferViews'])-1
    def acc(data,typ,component,target):
        a={'bufferView':block(data.tobytes(),target),'componentType':component,'count':len(data),'type':typ}
        if typ=='VEC3':a.update(min=data.min(0).tolist(),max=data.max(0).tolist())
        j['accessors'].append(a);return len(j['accessors'])-1
    for k in range(4):
        ids=triangles[owner==k].ravel();v=points[ids];uv=uvs[k][ids]
        if not len(ids):continue
        material=len(j['materials']);image=len(j['images']);j['images'].append({'bufferView':block(photos[k]),'mimeType':'image/jpeg'});j['textures'].append({'source':image})
        j['materials'].append({'doubleSided':True,'extensions':{'KHR_materials_unlit':{}},'pbrMetallicRoughness':{'baseColorTexture':{'index':image},'metallicFactor':0,'roughnessFactor':1}})
        j['meshes'][0]['primitives'].append({'attributes':{'POSITION':acc(v,'VEC3',5126,34962),'TEXCOORD_0':acc(uv,'VEC2',5126,34962)},'material':material})
    binary.extend(b'\0'*((-len(binary))%4));j['buffers'][0]['byteLength']=len(binary);js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    result=struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary
    output=OUT/'photo-support.glb';output.write_bytes(result)
    assert sha(nav)==nav_hash
    report={'schemaVersion':1,'kind':'DISPLAY_ONLY_INTERPOLATED_DEPTH','meaning':'Original PDS photos on bounded linear height interpolation, drawn behind original stereo meshes. Not observed depth, soil classification, or traversable support. Never used by planner or ray picking.','navigationGridSha256':nav_hash,'surfaceEvidenceSha256':sha(evidence),'manifestSha256':sha(manifest_path),'generatorSha256':sha(Path(__file__)),**stats,'triangles':int((owner>=0).sum()),'bytes':len(result),'sha256':sha(output),'sources':sources}
    (OUT/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k!='sources'},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);build(p.parse_args().cache)
