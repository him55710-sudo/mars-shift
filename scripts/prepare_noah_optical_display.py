"""Create a0.5 m inspection display from the verified NOAH-region optical crop.

This only prepares imagery. It produces no segmentation, candidates or accuracy.
"""
import json
from pathlib import Path
import hashlib
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data/noah'
with np.load(ROOT.parent/'data-cache/surface-optical-noah-0_3m.npz') as data:
    raw=data['image'];source=json.loads(str(data['metadata']))
assert hashlib.sha256(np.asarray(raw,dtype='<f4').tobytes()).hexdigest()==source['cropFloat32Sha256']
lo,hi=np.nanpercentile(raw,[1,99])
pixels=np.round(np.clip((np.nan_to_num(raw,nan=lo)-lo)/(hi-lo),0,1)*255).astype('uint8')
image=Image.fromarray(pixels).convert('RGBA');image.putalpha(Image.fromarray((np.isfinite(raw)*255).astype('uint8')))
image=image.resize((2000,2000),Image.Resampling.LANCZOS)
path=OUT/'optical-native.webp';image.save(path,quality=95,method=6)
meta={'schemaVersion':1,'region':'noah','image':'/data/noah/optical-native.webp','width':2000,'height':2000,'metresPerPixel':.5,
 'nativeMetresPerPixel':source['sourceResolution'],'bounds':source['bounds'],'crs':source['crs'],'source':source,
 'credit':'NASA MRO HiRISE / Caltech; Annex & Ehlmann (2024), DOI10.22002/stqse-yay61, CC BY4.0',
 'processing':{'display':'Verified~0.3 m source crop; percentile stretch; Lanczos0.5 m display. Native NoData transparent; no super-resolution.',
 'imageSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'imageByteLength':path.stat().st_size},
 'limitations':'Display only. No local optical detector or field-verified boulder labels. Observation date and registration error unknown.'}
(OUT/'optical-native-meta.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'bytes':path.stat().st_size,'sourceVerified':True,'detector':'not generated'}))
