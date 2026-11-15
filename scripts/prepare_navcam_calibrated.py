"""Reproject a full PDS linearized Navcam radiance image onto original NASA leaves.

Same CAHV projection as the published camera definition; no generated pixels or
geometry. The first observation covers the close rock/ground inspection preset.
All four fine observations use native PDS source crops.
"""
import argparse
import copy
import hashlib
import io
import json
import struct
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data/drive1004'
CACHE=ROOT/'.local/navcam-calibrated'
BASE='https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_navcam_ops_calibrated/data/sol/00477/ids/rdr/ncam/'
NS={'p':'http://pds.nasa.gov/pds4/pds/v1','g':'http://pds.nasa.gov/pds4/geom/v1'}
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
DIMS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}


def accessor(j,b,i):
    a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);n=DIMS[a['type']]
    return np.ndarray((a['count'],n),dtype=dt,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*n),dt.itemsize)).copy()


def project(points,matrix,rotation,model):
    world=points@matrix[:3,:3].T+matrix[:3,3]
    # Display N/up/E -> sitedrive N/E/down -> published rover-navigation frame.
    ned=world[:,[0,2,1]]*np.array([1,1,-1])
    d=ned@rotation-model['C'];depth=d@model['A']
    return np.column_stack((d@model['H']/depth,d@model['V']/depth)),depth


def inspection_camera(model,rotation,product):
    # Aim into the valid original photo footprint, away from the rover mask.
    pixel=np.array([3100.,1800.])
    ray=np.cross(model['H']-pixel[0]*model['A'],model['V']-pixel[1]*model['A'])
    ray*=np.sign(ray@model['A']);ray/=np.linalg.norm(ray)
    display=lambda v:(rotation@v)[[0,2,1]]*np.array([1,-1,1])
    return {'position':display(model['C']).tolist(),'direction':display(ray).tolist(),'imageSamplePixels':pixel.tolist(),'verticalFovDegrees':32,'sourceProduct':product,'meaning':'Published PDS camera centre in the display local frame; an inspection aim into the valid calibrated photo footprint.'}


def download(name,expected=None):
    p=CACHE/name
    if not p.exists() or expected and p.stat().st_size!=expected:
        print('Downloading',name,flush=True)
        with urllib.request.urlopen(BASE+name,timeout=60) as response,p.open('wb') as f:
            while block:=response.read(1024*1024):f.write(block)
    if expected and p.stat().st_size!=expected:raise ValueError('PDS image byte count mismatch')
    return p


def pack(j,b,crop,uvs,output):
    # Repack existing bufferViews exactly, then append the new UVs and image.
    image_views={image['bufferView']for image in j.get('images',[])if 'bufferView'in image}
    assert all(a.get('bufferView')not in image_views for a in j['accessors'])
    j['images']=[];j['textures']=[]
    blocks=[];offset=0
    for vi,view in enumerate(j['bufferViews']):
        block=b'\0'*4 if vi in image_views else b[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        view['byteLength']=len(block)
        pad=(-offset)%4;blocks.append(b'\0'*pad);offset+=pad
        view['byteOffset']=offset;blocks.append(block);offset+=len(block)
    def append(block,target=None):
        nonlocal offset
        pad=(-offset)%4;blocks.append(b'\0'*pad);offset+=pad
        view={'buffer':0,'byteOffset':offset,'byteLength':len(block)}
        if target:view['target']=target
        index=len(j['bufferViews']);j['bufferViews'].append(view);blocks.append(block);offset+=len(block);return index
    for primitive,uv in zip(j['meshes'][0]['primitives'],uvs):
        vi=append(uv.astype('<f4').tobytes(),34962);ai=len(j['accessors']);j['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(uv),'type':'VEC2'});primitive['attributes']['TEXCOORD_0']=ai
    image=io.BytesIO();crop.save(image,format='JPEG',quality=95,subsampling=0)
    imageIndex=len(j['images']);j['images'].append({'bufferView':append(image.getvalue()),'mimeType':'image/jpeg'})
    textureIndex=len(j['textures']);j['textures'].append({'source':imageIndex})
    for material in j['materials']:
        material['pbrMetallicRoughness']['baseColorTexture']={'index':textureIndex}
        material['pbrMetallicRoughness'].pop('indexTexture',None)
    data=b''.join(blocks);data+=b'\0'*((-len(data))%4);j['buffers'][0]['byteLength']=len(data)
    js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    glb=struct.pack('<4sII',b'glTF',2,28+len(js)+len(data))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(data),b'BIN\0')+data
    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(glb)
    return glb


def main(observation_index=0):
    CACHE.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((OUT/'manifest.json').read_text())
    observation=manifest['observations'][observation_index];product=observation['product']
    scene=json.loads((ROOT/'.local/drive1004/source'/product/(product+'_scene.json')).read_text())
    image=scene['images'][0];stem=image['product_id'].replace('RAS_N','RASLN')
    xml=download(stem+'.xml');label=ET.parse(xml).getroot()
    assert label.find('.//g:Camera_Model_Parameters/g:model_type',NS).text=='CAHV'
    cm=label.find('.//g:CAHV_Model',NS)
    model={k:np.array([float(v.text)for v in cm.find('g:'+name,NS)])for k,name in [('C','Vector_Center'),('A','Vector_Axis'),('H','Vector_Horizontal'),('V','Vector_Vertical')]}
    assert np.allclose(model['C'],image['model']['C'],atol=1e-6)
    array=label.find('.//p:Array_3D_Image',NS);offset=int(array.find('p:offset',NS).text)
    assert array.find('p:Element_Array/p:data_type',NS).text=='SignedMSB2'
    axes={v.find('p:axis_name',NS).text:int(v.find('p:elements',NS).text)for v in array.findall('p:Axis_Array',NS)}
    bands,h,w=axes['Band'],axes['Line'],axes['Sample'];assert bands==3
    source=download(stem+'.IMG',offset+bands*h*w*2)
    raw=np.memmap(source,dtype='>i2',mode='r',offset=offset,shape=(bands,h,w))
    sample=np.asarray(raw[:,::8,::8],dtype=np.float32);valid=sample.sum(0)>0
    black,white=np.percentile(sample[:,valid],[.5,99.7])
    radiance_scale=float(array.find('p:Element_Array/p:scaling_factor',NS).text)
    reference=OUT/'calibrated-validation-0.json'
    if observation_index and reference.exists():
        ref=json.loads(reference.read_text())['displayMapping'];black=ref['blackDN']*ref['radianceScale']/radiance_scale;white=ref['whiteDN']*ref['radianceScale']/radiance_scale
    # One shared radiance display stretch across RGB, not per-channel recoloring.
    rgb=np.clip((np.moveaxis(np.asarray(raw,dtype=np.float32),0,-1)-black)/(white-black),0,1)
    rgb=np.rint(np.power(rgb,1/2.2)*255).astype(np.uint8);photo=Image.fromarray(rgb)
    frame=next(f for f in scene['frames']if f['id']==image['frame_id'])
    rotation=Rotation.from_quat([frame['rotation'][v]for v in ['x','y','z','w']]).as_matrix()
    if observation_index==0:manifest['inspectionCamera']=inspection_camera(model,rotation,product)
    records=[];assets=[]
    existing={(a['sourceProduct'],a['sourceTile']):a for a in manifest.get('calibratedAssets',manifest['detailAssets'])}
    for asset in manifest['detailAssets']:
        if asset['sourceProduct']!=product:assets.append(existing[(asset['sourceProduct'],asset['sourceTile'])]);continue
        original=(ROOT/'public'/asset['url'].lstrip('/')).read_bytes();length=struct.unpack('<I',original[12:16])[0];j=json.loads(original[20:20+length]);b=original[28+length:]
        matrix=np.array(asset['transform']).reshape(4,4).T;coordinates=[];primitives=j['meshes'][0]['primitives']
        for primitive in primitives:
            points=accessor(j,b,primitive['attributes']['POSITION']);uv,depth=project(points,matrix,rotation,model)
            assert np.all(depth>0)and np.all(uv>=[0,0])and np.all(uv<[w,h]),'Projection outside the observed image'
            coordinates.append(uv)
        allUV=np.concatenate(coordinates);lo=np.maximum([0,0],np.floor(allUV.min(0)).astype(int)-3);hi=np.minimum([w,h],np.ceil(allUV.max(0)).astype(int)+4)
        crop=photo.crop((*lo,*hi));size=hi-lo
        # glTF image V is top-down. Pixel centres, at full PDS source pixel spacing.
        uvs=[(uv-lo+.5)/size for uv in coordinates]
        originalj=copy.deepcopy(j)
        relative=asset['url'].replace(f'/detail-{observation_index}/',f'/calibrated-{observation_index}/');glb=pack(j,b,crop,uvs,ROOT/'public'/relative.lstrip('/'))
        # Geometry and index data stay bit-identical; only UVs and image binding change.
        jl=struct.unpack('<I',glb[12:16])[0];newj=json.loads(glb[20:20+jl]);newb=glb[28+jl:]
        for primitive in originalj['meshes'][0]['primitives']:
            for name,ai in primitive['attributes'].items():
                if name.startswith('TEXCOORD'):continue
                assert np.array_equal(accessor(originalj,b,ai),accessor(newj,newb,ai))
            ai=primitive['indices'];assert np.array_equal(accessor(originalj,b,ai),accessor(newj,newb,ai))
        uvError=0.0
        for primitive,expected in zip(newj['meshes'][0]['primitives'],coordinates):
            packed=accessor(newj,newb,primitive['attributes']['TEXCOORD_0']);uvError=max(uvError,float(np.max(abs(packed*size+lo-.5-expected))))
        records.append({'sourceTile':asset['url'],'output':relative,'cropPixels':size.tolist(),'imageCropOriginPixels':lo.tolist(),'vertices':len(allUV),'sourceGeometryUnchanged':True,'maximumVertexReprojectionErrorPixels':uvError})
        assets.append({**asset,'url':relative,'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest(),'visualLod':'Original leaf geometry with full PDS linearized image projection'})
    report={'schemaVersion':1,'sourceImageUrl':BASE+source.name,'sourceLabelUrl':BASE+xml.name,'sourceImageSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceLabelSha256':hashlib.sha256(xml.read_bytes()).hexdigest(),'sourcePixels':[w,h],'model':'Published PDS linearized CAHV in rover-navigation frame; published NASA scene quaternion and original tile transform','displayMapping':{'blackDN':float(black),'whiteDN':float(white),'radianceScale':radiance_scale,'power':1/2.2,'meaning':'Shared RGB display stretch only; images are not a new radiance measurement.'},'tiles':records,'limitations':['No new geometry or source pixels.','Vertex UV projection follows the published model; no independent ground-control registration is claimed.','Rasterization interpolates projected UVs across original fine triangles.','Original NASA meshes and published camera-frame alignment are reused; texture reprojection is not an independent registration survey.']}
    (OUT/f'calibrated-validation-{observation_index}.json').write_text(json.dumps(report,indent=2)+'\n')
    reports=[json.loads(p.read_text())for p in sorted(OUT.glob('calibrated-validation-[0-9].json'))]
    manifest['calibratedAssets']=assets;manifest['calibratedProcessing']={'triangles':sum(a['triangles']for a in assets),'bytes':sum(a['bytes']for a in assets),'tilesRetextured':sum(len(r['tiles'])for r in reports),'sourcePixels':[r['sourcePixels']for r in reports],'validation':'/data/drive1004/calibrated-validation.json'}
    (OUT/'calibrated-validation.json').write_text(json.dumps({'schemaVersion':1,'method':'Original NASA fine mesh geometry; native-resolution PDS linearized image crops projected with published CAHV and pose transforms. Geometry unchanged. Shared radiance display mapping across images.','images':reports},indent=2)+'\n');(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest['calibratedProcessing'],indent=2),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--all',action='store_true');parser.add_argument('--observation',type=int,default=0);args=parser.parse_args()
    for index in range(4)if args.all else [args.observation]:main(index)
