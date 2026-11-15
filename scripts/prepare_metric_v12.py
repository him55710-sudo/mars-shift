"""Read-only PDS/author inputs -> versioned metric-reconstruction input.
No source image is synthesized. Display stretches are not measurement inputs.
"""
from pathlib import Path
from xml.etree import ElementTree as E
import hashlib,json
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'data-cache/hazards/metric-v12'
OUT=ROOT/'public/data/hazards/metric-v12'
OUT.mkdir(parents=True,exist_ok=True)
assert not (OUT/'inputs.json').exists(),'Refusing overwrite'
ns={'p':'http://pds.nasa.gov/pds4/pds/v1','g':'http://pds.nasa.gov/pds4/geom/v1'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base='https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_navcam_ops_calibrated/data/sol/00215/ids/rdr/ncam/'
products=[];arrays=[]
for f in sorted(CACHE.glob('NLG*.xml')):
 r=E.parse(f).getroot();model=r.find('.//g:CAHVORE_Model',ns)
 vec=lambda name:[float(v.text)for v in model.find('g:'+name,ns)]
 frame=next(n for n in r.findall('.//g:Coordinate_Space_Definition',ns)if n.find('g:Coordinate_Space_Present/g:Coordinate_Space_Indexed/g:coordinate_space_frame_type',ns).text=='ROVER_NAV_FRAME')
 q=[float(n.text)for n in frame.find('g:Quaternion_Plus_Direction',ns)if n.tag.split('}')[-1]!='rotation_direction']
 rot=Rotation.from_quat([*q[1:],q[0]]).as_matrix()
 a=r.find('.//p:Array_2D_Image',ns);off=int(a.find('p:offset',ns).text)
 axes={n.find('p:axis_name',ns).text:int(n.find('p:elements',ns).text)for n in a.findall('p:Axis_Array',ns)}
 assert axes=={'Line':240,'Sample':1280} and a.find('p:Element_Array/p:data_type',ns).text=='SignedMSB2'
 img=f.with_suffix('.IMG');raw=img.read_bytes();assert len(raw)>=off+240*1280*2
 im=np.frombuffer(raw,dtype='>i2',offset=off,count=240*1280).reshape(240,1280).astype(float)
 im*=float(a.find('p:Element_Array/p:scaling_factor',ns).text);arrays.append(im)
 sclk=float(f.name.split('_')[2])+int(f.name.split('_')[3][:3])/1000
 camera={k:vec(n)for k,n in [('C','Vector_Center'),('A','Vector_Axis'),('H','Vector_Horizontal'),('V','Vector_Vertical'),('O','Vector_Optical'),('R','Radial_Terms'),('E','Entrance_Terms')]}
 assert int(model.find('g:cahvore_model_type',ns).text)==2
 products.append(dict(id=f.stem,sclk=sclk,time=sclk-686020339,width=1280,height=240,camera=dict(**camera,linearity=0,rotation=rot.tolist()),
  imageSha256=sha(img),labelSha256=sha(f),labelUrl=base+f.name,imageUrl=base+img.name,utc=r.find('.//p:start_date_time',ns).text))
 # Archive the exact metadata used; original binary is held in the download cache.
 (OUT/f.name).write_bytes(f.read_bytes())
lo,hi=np.percentile(arrays[0][arrays[0]>0],[1,99])
for i,im in enumerate(arrays):
 Image.fromarray(np.uint8(np.clip((im-lo)/(hi-lo)*255,0,255))).save(OUT/f'frame-{i}.jpg',quality=94)
 if i<4:
  # Causal difference to first frame: first-frame dust is a known contamination.
  change=im/np.maximum(arrays[0],.001)-1
  change-=np.median(change,axis=1)[:,None]
  Image.fromarray(np.uint8(np.clip(127+change*2000,0,255))).save(OUT/f'change-{i}.png')
# Digitized published orange scale marks. Match the background photograph to
# original PDS with SIFT/RANSAC only to undo figure resizing; no metre target
# is used by registration. Middle panel is shifted 320 figure pixels.
marks=[]
for i in range(4):
 reg=json.loads((CACHE/f'registration-{i}.json').read_text());M=np.array(reg['inverse']);bar=reg['bars'][-1]
 x,y,w,h=bar['rect'];uv=M@np.array([x+(w-1)/2,y+(h-1)/2-320,1])
 endpoints=[(M@np.array([u,y+(h-1)/2-320,1])).tolist()for u in [x,x+w-1]]
 marks.append(dict(frame=i,pixel=uv.tolist(),edges=endpoints,pixelSigmaAssumption=4,
  annotation='Digitized author-drawn apparent dust width mark, not independent vortex centre truth',figure=10+i))
reg=json.loads((CACHE/'registration-0.json').read_text())
landmarks=[]
for bar,range_m,name in zip(reg['bars'][:4],[110.6,34.5,27.7,14.4],['far feature','middle feature','wheel-track band','near feature']):
 landmarks.append(dict(id=name,pixel=bar['pixel'],range=range_m,rangeSigmaAssumption=max(1,.05*range_m),pixelSigmaAssumption=4,role='check'if name=='wheel-track band'else'calibration'))
payload=dict(schemaVersion=1,event='Perseverance Sol 215 / 2021-09-27',coordinateFrame='SITE_7_LOCAL_NORTH_EAST_DOWN_RELATIVE_TO_ROVER',
 products=products,annotations=marks,landmarks=landmarks,
 referenceRanges=[dict(frame=i,range=r,interval=v)for i,(r,v)in enumerate([(110,[110,110]),(80,[80,80]),(55,[50,60]),(30,[30,30])])],
 paper=dict(doi='10.1038/s41467-022-35100-z',url='https://www.nature.com/articles/s41467-022-35100-z',
  supplementUrl='https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9747922/supplementaryFiles',supplementSha256=sha(CACHE/'41467_2022_35100_MOESM1_ESM.pdf'),sourceDataSha256=sha(CACHE/'41467_2022_35100_MOESM3_ESM.xlsx'),
  speed=5.3,speedSpread=.3,diameter=25,diameterSpread=1.56,fromAzimuth=164.3,azimuthSpread=1.4,
  parameterMeaning='Retrospective combined model fit; best-four-solution spread is not a calibrated confidence interval; never supplied to causal image forecaster'),
 limitations=['One event; four digitized visible-cloud marks, not dense surveyed centre truth.',
 'No right camera products in this movie; monocular rays require a surface assumption.',
 'Surface fit uses published feature ranges; uncertainty magnitudes are explicit sensitivity assumptions, not instrument calibration.',
 'Cloud marks are retrospective author annotations. No automatic detection or complete online-pipeline validation is claimed.',
 'Visible dust width differs from the dynamical vortex diameter.',
 'The first-frame causal difference has weak dust contamination; post-event frames are not used to forecast.'])
(OUT/'inputs.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
print(json.dumps(dict(products=len(products),annotations=marks,landmarks=landmarks),indent=2))
