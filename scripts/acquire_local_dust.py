"""Preserve real, seconds-cadence NASA frames and independently published kinematics.
The image measurements are apparent column measurements, NOT surveyed ground positions.
Run with ../research/.venv-hazards/Scripts/python.exe.
"""
from pathlib import Path
import csv, hashlib, json, math, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter1d

CACHE=Path('../data-cache/hazards'); OUT=Path('public/data/hazards'); CACHE.mkdir(parents=True,exist_ok=True)
SOURCES=[
 dict(id='PIA26074',file='PIA26074.gif',url='https://assets.science.nasa.gov/content/dam/science/psd/mars/downloadable_items/4/8/48571_PIA26074.gif',page='https://science.nasa.gov/resource/martian-whirlwind-takes-the-thorofare/',split='development',cadenceSeconds=4,cadenceKind='PUBLISHED',diameterMetres=60,advectionMps=19/3.6,rangeMetres=4000,roi=[660,800,12,42],notes='Jezero sol 899. East-to-west motion. Enhanced NASA images.'),
 dict(id='PIA26528',file='PIA26528.gif',url='https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26528/PIA26528.gif',page='https://science.nasa.gov/photojournal/perserverance-captures-crater-rim-dust-devil-eating-its-own/',split='test',cadenceSeconds=6,cadenceKind='PUBLISHED_APPROXIMATE',diameterMetres=65,advectionMps=1,rangeMetres=1000,roi=[700,870,190,228],notes='Jezero sol 1398. Main column only; merger and changing visibility are retained.'),
 dict(id='PIA24039',file='curiosity2847.gif',url='https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia24/pia24039/PIA24039.gif',page='https://science.nasa.gov/photojournal/curiosity-spots-a-dust-devil-in-the-hills/',split='test',cadenceSeconds=255/20,cadenceKind='ASSUMED_UNIFORM_FROM_PUBLISHED_TOTAL',diameterMetres=5,advectionMps=None,rangeMetres=[500,1000],roi=[230,650,65,135],notes='Gale sol 2847. Timing is approximately uniform, not original per-frame timestamps. Weak early plume retained.')
]

def digest(b): return hashlib.sha256(b).hexdigest()

def measurement(image,roi,threshold=.5):
    """Per-frame spatial filtering only. No later frames enter a current observation."""
    x0,x1,y0,y1=roi
    a=np.asarray(image.convert('L'),dtype=float)
    # Remove slowly varying terrain brightness horizontally; narrow bright columns remain.
    residual=a-gaussian_filter1d(a,14,axis=1)
    strip=np.maximum(residual[y0:y1,x0:x1],0)
    profile=gaussian_filter1d(strip.mean(axis=0),1)
    peak=int(np.argmax(profile)); baseline=float(np.median(profile)); height=float(profile[peak]-baseline)
    gate=baseline+max(0,height)*threshold
    left=peak; right=peak
    while left>0 and profile[left-1]>=gate:left-=1
    while right<len(profile)-1 and profile[right+1]>=gate:right+=1
    weights=np.maximum(profile[left:right+1]-baseline,0)
    x=float(np.average(np.arange(left,right+1)+x0,weights=weights)) if weights.sum()>0 else float(peak+x0)
    # FWHM is a reproducible apparent-width definition; not the whole visible dusty envelope.
    width=float(right-left+1)
    noise=float(np.median(np.abs(profile-baseline))*1.4826)
    return dict(x=x,width=width,positionSigma=max(.5,width*.08),radiusSigma=max(.5,width*.12),snr=height/max(.1,noise),quality='WEAK' if height<2 or height/max(.1,noise)<2.5 else 'MEASURED',bounds=[x0+left,y0,x0+right,y1])

events=[]
for source in SOURCES:
    path=CACHE/source['file']
    if not path.exists():path.write_bytes(urllib.request.urlopen(source['url'],timeout=60).read())
    raw=path.read_bytes()
    if not raw.startswith(b'GIF'):raise ValueError('Invalid image response: '+str(path))
    im=Image.open(path)
    if im.n_frames!=21:raise ValueError('Unexpected frame count; inspect cadence before proceeding')
    points=[]; sheets=[]
    for i in range(im.n_frames):
        im.seek(i);m=measurement(im,source['roi']);lo=measurement(im,source['roi'],.4);hi=measurement(im,source['roi'],.6)
        points.append(dict(time=i*source['cadenceSeconds'],frame=i,**m,thresholdSensitivityPx=max(abs(m['x']-lo['x']),abs(m['x']-hi['x'])),widthSensitivityPx=max(abs(m['width']-lo['width']),abs(m['width']-hi['width']))))
        if i in [0,5,10,15,20]:
            tile=im.convert('RGB');draw=ImageDraw.Draw(tile);draw.rectangle(m['bounds'],outline='#00ff88',width=1);draw.text((5,5),f"{source['id']} frame {i} / {i*source['cadenceSeconds']:.2f} s",fill='red');sheets.append(tile)
    canvas=Image.new('RGB',(im.width,(im.height+20)*len(sheets)))
    for i,tile in enumerate(sheets):canvas.paste(tile,(0,i*(im.height+20)))
    canvas.save(Path('../research')/(source['id']+'-measurements.png'))
    events.append({**source,'sha256':digest(raw),'bytes':len(raw),'coordinateType':'IMAGE_CROSSRANGE_PIXELS','measurement':'Spatial-filtered apparent-column FWHM; curated ROI; not physical vortex boundary','points':points})

rawpath=CACHE/'Bickel_et_al_2025_dustdevils_SciAdv_v1.0.csv'
if not rawpath.exists():raise FileNotFoundError('Download the open CSV at DOI 10.48620/87803 using the repository browser; automated HTTP may return an empty response.')
raw=rawpath.read_bytes()
if hashlib.md5(raw).hexdigest()!='83636c21f762a42de1d669680b1f2127':raise ValueError('Bickel published MD5 mismatch')
rows=list(csv.DictReader(raw.decode('utf-8-sig').splitlines()));catalog=[]
for row in rows:
    speedkey='CA fringe speed' if row['instrument']=='CASSIS' else 'HRSC speed'
    speed=float(row[speedkey]);azimuth=float(row['CA fringe azi'] if row['instrument']=='CASSIS' else row['HRSC azi'])
    if not math.isfinite(speed) or not math.isfinite(azimuth):continue
    catalog.append(dict(id=row['ID short']+'/'+row['run ID'],group=row['ID short'],datetime=row['datetime'],instrument=row['instrument'],diameter=float(row['estimated diameter']),speedMps=speed,azimuthDeg=azimuth,pixelMetres=float(row['spatial resolution']),split='development' if row['datetime']<'2022' else 'test',measurement='PUBLISHED_DERIVED_KINEMATICS'))
payload=dict(schemaVersion=1,meaning='Actual high-cadence image observations and published kinematics. Images do not supply surveyed two-dimensional ground truth.',events=events,catalog=catalog,sourceRegister=[dict(doi='10.48620/87803',rows=len(rows),sha256=digest(raw),md5=hashlib.md5(raw).hexdigest(),repositoryLicense='CC-BY-NC-SA-4.0',readmeLicense='CC-BY; differs from repository metadata',measurement='One estimated diameter and mean migration vector per detection, not full position time series'),dict(doi='10.5281/zenodo.8344947',status='ACQUIRED_NOT_USED_AS_HIGH_FREQUENCY',reason='Coordinates are indexed by sol; no per-frame times or object identity. Do not join rows into invented tracks.')])
(OUT/'local-observations.json').write_text(json.dumps(payload,indent=2,allow_nan=False),encoding='utf8')
print('NASA events',len(events),'frames',sum(len(e['points']) for e in events),'published kinematic rows',len(catalog))
for e in events:print(e['id'],'weak labels',sum(p['quality']=='WEAK' for p in e['points']),'x endpoints',e['points'][0]['x'],e['points'][-1]['x'])
