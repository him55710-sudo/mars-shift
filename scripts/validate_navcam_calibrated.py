"""Compare original NASA atlases to PDS-projected textures at mesh vertices.
Content agreement is a diagnostic, not independent metric camera calibration.
"""
import io
import json
import struct
from pathlib import Path
import numpy as np
from PIL import Image
from prepare_navcam_calibrated import accessor,project
ROOT=Path(__file__).resolve().parents[1]


def load(url):
    b=(ROOT/'public'/url.lstrip('/')).read_bytes();length=struct.unpack('<I',b[12:16])[0]
    j=json.loads(b[20:20+length]);data=b[28+length:];q=j['meshes'][0]['primitives'][0]
    ti=j['materials'][q['material']]['pbrMetallicRoughness']['baseColorTexture']['index']
    image=j['images'][j['textures'][ti]['source']];view=j['bufferViews'][image['bufferView']]
    pixels=np.asarray(Image.open(io.BytesIO(data[view['byteOffset']:view['byteOffset']+view['byteLength']])).convert('RGB'),dtype=float).mean(2)
    return pixels,accessor(j,data,q['attributes']['TEXCOORD_0'])


def sample(image,uv):
    x=np.clip(np.rint(uv[:,0]*image.shape[1]-.5).astype(int),0,image.shape[1]-1)
    y=np.clip(np.rint(uv[:,1]*image.shape[0]-.5).astype(int),0,image.shape[0]-1)
    return image[y,x]


if __name__=='__main__':
    # An analytic perspective camera independently checks axes and metric scale.
    model={'C':np.zeros(3),'A':np.array([0,0,1]),'H':np.array([100,0,50]),'V':np.array([0,100,40])}
    uv,depth=project(np.array([[2.,-10.,3.]]),np.eye(4),np.eye(3),model)
    assert np.allclose(uv,[[70,70]])and np.allclose(depth,[10])
    path=ROOT/'public/data/drive1004/calibrated-validation.json';report=json.loads(path.read_text());scores=[]
    for image in report['images']:
        for tile in image['tiles']:
            old,uv=load(tile['sourceTile']);new,newuv=load(tile['output'])
            selected=np.linspace(0,len(uv)-1,min(4096,len(uv)),dtype=int)
            score=float(np.corrcoef(sample(old,uv[selected]),sample(new,newuv[selected]))[0,1])
            if np.isfinite(score):scores.append(score)
            tile['sourceAtlasLuminanceCorrelation']=score if np.isfinite(score)else None
    assert len(scores)>=50 and np.median(scores)>.6,'Reprojected image content does not agree sufficiently with source atlases'
    errors=[t['maximumVertexReprojectionErrorPixels']for r in report['images']for t in r['tiles']]
    assert max(errors)<.001
    report['sourceAtlasAgreement']={'tilesChecked':len(scores),'method':'Pearson luminance correlation at up to 4096 corresponding mesh vertices per tile. Radiometric stretches and source resampling differ.','median':float(np.median(scores)),'minimum':float(min(scores)),'maximumPackedUvErrorPixels':max(errors),'analyticCameraAxesCheck':True,'meaning':'Camera-content consistency and numeric packing checks, not independent ground-control registration, physical stereo accuracy or generated resolution.'}
    path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['sourceAtlasAgreement'],indent=2))
