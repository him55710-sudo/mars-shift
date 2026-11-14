"""Bounded reference acquisition from the discovered USGS HiRISE STAC item.

Uses the existing verified-HTTPS range bridge; preserves the application data.
Outputs comparison arrays/GeoTIFF and byte-range receipts under ../data-cache.
Run ../.venv/Scripts/python scripts/review_external_terrain.py.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
import rasterio
from rasterio.warp import transform_bounds, reproject, Resampling
from rasterio.windows import from_bounds
from rasterio.transform import from_bounds as grid_transform
import requests
import detect_optical as access

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'data-cache'/'external-terrain'
OUT.mkdir(parents=True,exist_ok=True)
item_file=OUT/'hirise-jezero-stac.json'
if not item_file.exists():
    r=requests.get('https://stac.astrogeology.usgs.gov/api/search',params={'collections':'mro_hirise_socet_dtms','bbox':'77.62,18.43,77.75,18.53','limit':20},timeout=30)
    r.raise_for_status();item_file.write_bytes(r.content)
feature=json.loads(item_file.read_text(encoding='utf-8'))['features'][0]
assert feature['id']=='DTEEC_023247_1985_022957_1985_U01'
t=json.loads((ROOT/'public/data/terrain.json').read_text(encoding='utf-8'))
arrays={};receipts=[]
for key in ['dtm','fom']:
    url=feature['assets'][key]['href']
    head=requests.head(url,timeout=30);head.raise_for_status()
    # The helper accepts only this fixed verified upstream and verifies 206,
    # Content-Range and every byte count. Transfer is capped at 32 MiB per asset.
    access.SOURCE_URL=url;access.SOURCE_SIZE=int(head.headers['Content-Length'])
    state=access.RangeState(maximum_bytes=32*1024*1024)
    server=access.range_server(state)
    try:
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',GDAL_HTTP_MULTIRANGE='NO',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',GDAL_CACHEMAX=32*1024*1024):
            with rasterio.open(f'http://127.0.0.1:{server.server_port}/optical.tif') as ds:
                bounds=transform_bounds(t['crs'],ds.crs,*t['bounds'])
                window=from_bounds(*bounds,ds.transform).round_offsets().round_lengths()
                raw=ds.read(1,window=window,masked=True).astype('float32').filled(np.nan)
                raw=raw*ds.scales[0]+ds.offsets[0]
                data=np.full((t['height'],t['width']),np.nan,dtype='float32')
                reproject(raw,data,src_transform=ds.window_transform(window),src_crs=ds.crs,src_nodata=np.nan,dst_transform=grid_transform(*t['bounds'],t['width'],t['height']),dst_crs=t['crs'],dst_nodata=np.nan,resampling=Resampling.bilinear if key=='dtm' else Resampling.nearest)
                arrays[key]=data
                finite=data[np.isfinite(data)]
                receipts.append({'asset':key,'url':url,'sourceBytes':access.SOURCE_SIZE,'sourceCrs':ds.crs.to_wkt(),'sourceResolution':list(ds.res),'sourceDtype':ds.dtypes[0],'sourceScale':ds.scales[0],'sourceOffset':ds.offsets[0],'sourceNoData':ds.nodata,'readWindow':[window.col_off,window.row_off,window.width,window.height],'outputCoverageFraction':float(np.isfinite(data).mean()),'outputMin':float(finite.min()) if finite.size else None,'outputMax':float(finite.max()) if finite.size else None,'transferBytes':state.bytes_received,'rangeReceipts':state.requests,'wholeSourceHashVerified':False})
    finally:
        server.shutdown();server.server_close()
    print(key,receipts[-1]['outputCoverageFraction'],receipts[-1]['transferBytes'],flush=True)
current=np.array([np.nan if v is None else v for v in t['elevation']],dtype='float32').reshape(t['height'],t['width'])
delta=arrays['dtm']-current;finite=delta[np.isfinite(delta)]
comparison={'matchingCells':int(finite.size),'medianDifferenceMetres':float(np.median(finite)) if finite.size else None,'meanDifferenceMetres':float(np.mean(finite)) if finite.size else None,'p05DifferenceMetres':float(np.percentile(finite,5)) if finite.size else None,'p95DifferenceMetres':float(np.percentile(finite,95)) if finite.size else None,'rmseMetres':float(np.sqrt(np.mean(finite.astype('float64')**2))) if finite.size else None,'interpretation':'USGS DTM minus current Caltech 5 m elevation. This is a raster comparison, not independently validated horizontal/vertical registration or accuracy.'}
target=OUT/'usgs-hirise-floor-reference.tif'
with rasterio.open(target,'w',driver='GTiff',width=t['width'],height=t['height'],count=2,dtype='float32',crs=t['crs'],transform=grid_transform(*t['bounds'],t['width'],t['height']),nodata=np.nan,compress='deflate') as dst:
    dst.write(arrays['dtm'],1);dst.write(arrays['fom'],2);dst.set_band_description(1,'USGS DTM reference, metres');dst.set_band_description(2,'USGS FOM COG, source already cubic-reprojected; unvalidated categorical semantics')
summary={'itemId':feature['id'],'license':feature['properties'].get('license'),'planet':'Mars','outputBounds':t['bounds'],'outputCrs':t['crs'],'outputShape':[t['height'],t['width']],'outputCellMetres':t['cellSize'],'comparison':comparison,'receipts':receipts,'output':{'path':str(target.relative_to(ROOT.parent)),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},'warnings':['No WGS84/Earth transform used. Both CRSs use a 3396190 m Mars sphere.','Neither current region nor routing data were replaced.','STAC observation datetime is inconsistent with ESP orbit products and is not promoted as a verified capture date.','USGS processing provenance uses cubic interpolation for the FOM COG; do not treat its resampled values as original categorical confidence or safety probabilities.','Ridge region lies outside this item footprint.','Original products are MOLA-controlled and aeroid-relative per collection documentation; co-registration with the current Caltech mosaic is not certified.']}
(OUT/'usgs-hirise-floor-reference.json').write_text(json.dumps(summary,indent=2,allow_nan=False)+'\n',encoding='utf-8')
print(json.dumps(comparison,indent=2))
