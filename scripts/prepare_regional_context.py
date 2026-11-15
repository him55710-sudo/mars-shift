"""Freeze observed regional terrain around the existing 1 km planning footprint.

Uses the original USGS 20 m CTX DEM, not Caltech's detrended derivatives.
The CTX image export and DEM are projected into the unchanged planning CRS.
No surrounding geometry or image repetition is invented.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, io, json, math
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.transform import from_bounds, from_origin
from PIL import Image
import truststore
truststore.inject_into_ssl()
import requests

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'data-cache'
OUT=ROOT/'public/data/noah/context'
DEM_URL='https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif'
IMAGE_SERVICE='https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer'
DEM_BYTES=90345300
SPAN=24000
N=256
PIXELS=1024

def sha(b):return hashlib.sha256(b).hexdigest()

def acquire_dem():
    path=CACHE/'M20_JezeroCrater_CTXDEM_20m.tif'
    if not path.exists():
        temporary=path.with_suffix('.partial')
        with requests.get(DEM_URL,stream=True,timeout=(15,120)) as response:
            response.raise_for_status()
            with temporary.open('wb') as f:
                for block in response.iter_content(1024*1024):f.write(block)
        if temporary.stat().st_size!=DEM_BYTES:raise ValueError('CTX DEM source transfer length mismatch')
        temporary.replace(path)
    if path.stat().st_size!=DEM_BYTES:raise ValueError('Cached CTX DEM size mismatch')
    return path

def acquire_image(bounds,crs,span=SPAN):
    path=CACHE/f'noah-regional-ctx-{span//1000}km.npz'
    if path.exists():
        with np.load(path) as c:return c['image'],json.loads(str(c['metadata']))
    service=requests.get(IMAGE_SERVICE,params={'f':'json'},timeout=(15,30));service.raise_for_status();info=service.json();tile=info['tileInfo'];source_crs=tile['spatialReference']['wkt']
    geographic=transform_bounds(crs,source_crs,*bounds,densify_pts=21)
    metres_per_degree=3396190*math.pi/180
    lod=min(tile['lods'],key=lambda x:abs(math.log(x['resolution']*metres_per_degree/(span/PIXELS))))
    resolution=lod['resolution'];rows=tile['rows'];cols=tile['cols'];origin=tile['origin']
    c0=math.floor((geographic[0]-origin['x'])/(resolution*cols));c1=math.floor((geographic[2]-origin['x'])/(resolution*cols))
    r0=math.floor((origin['y']-geographic[3])/(resolution*rows));r1=math.floor((origin['y']-geographic[1])/(resolution*rows))
    if (c1-c0+1)*(r1-r0+1)>25:raise ValueError('Unexpected regional tile request size')
    def fetch_tile(address):
        row,col=address;url=f"{IMAGE_SERVICE}/tile/{lod['level']}/{row}/{col}";response=requests.get(url,timeout=(15,60));response.raise_for_status()
        image=np.asarray(Image.open(io.BytesIO(response.content)).convert('RGBA'))
        if image.shape!=(rows,cols,4):raise ValueError('Unexpected CTX tile dimensions')
        return row,col,image,{'url':url,'sha256':sha(response.content),'bytes':len(response.content)}
    stitched=np.zeros(((r1-r0+1)*rows,(c1-c0+1)*cols,4),dtype='uint8');sources=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for row,col,im,source in pool.map(fetch_tile,[(r,c) for r in range(r0,r1+1) for c in range(c0,c1+1)]):
            stitched[(row-r0)*rows:(row-r0+1)*rows,(col-c0)*cols:(col-c0+1)*cols]=im;sources.append(source)
    image=np.zeros((PIXELS,PIXELS,4),dtype='uint8');source_transform=from_origin(origin['x']+c0*cols*resolution,origin['y']-r0*rows*resolution,resolution,resolution)
    for band in range(4):
        reproject(stitched[:,:,band],image[:,:,band],src_transform=source_transform,src_crs=source_crs,dst_transform=from_bounds(*bounds,PIXELS,PIXELS),dst_crs=crs,resampling=Resampling.bilinear)
    if np.mean(image[:,:,3]>0)<.995:raise ValueError('Regional optical coverage is incomplete')
    meta={'service':IMAGE_SERVICE,'tileLevel':lod['level'],'tileResolutionDegrees':resolution,'sourceCRS':source_crs,'tiles':sources,'bounds':bounds,'crs':crs,'imageResolutionMetres':span/PIXELS,'credit':info.get('copyrightText'),'processing':'Observed CTX tile mosaic reprojected to the original planning CRS; bilinear resampling, no generated texture'}
    np.savez_compressed(path,image=image,metadata=json.dumps(meta,sort_keys=True))
    return image,meta

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    terrain=json.loads((OUT.parent/'terrain.json').read_text(encoding='utf8'))
    b=terrain['bounds'];cx=(b[0]+b[2])/2;cy=(b[1]+b[3])/2
    bounds=[cx-SPAN/2,cy-SPAN/2,cx+SPAN/2,cy+SPAN/2]
    near_bounds=[cx-2000,cy-2000,cx+2000,cy+2000]
    with ThreadPoolExecutor(max_workers=3) as pool:
        dem_future=pool.submit(acquire_dem);image_future=pool.submit(acquire_image,bounds,terrain['crs'])
        near_future=pool.submit(acquire_image,near_bounds,terrain['crs'],4000)
        source_path=dem_future.result();image,image_meta=image_future.result();near_image,near_meta=near_future.result()
    values=np.full((N,N),np.nan,dtype='<f4');transform=from_bounds(*bounds,N,N)
    with rasterio.open(source_path) as src:
        reproject(rasterio.band(src,1),values,src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,dst_transform=transform,dst_crs=terrain['crs'],dst_nodata=np.nan,resampling=Resampling.bilinear)
        near_values=np.full((201,201),np.nan,dtype='<f4')
        reproject(rasterio.band(src,1),near_values,src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,dst_transform=from_bounds(*near_bounds,201,201),dst_crs=terrain['crs'],dst_nodata=np.nan,resampling=Resampling.bilinear)
        source_meta={'url':DEM_URL,'credit':'NASA MRO CTX / USGS Mars 2020 Science Investigation DEM Mosaic','nativeResolutionMetres':list(src.res),'crs':src.crs.to_wkt(),'sourceSha256':sha(source_path.read_bytes()),'sourceBytes':DEM_BYTES,'publishedSourceChecksumVerified':False}
    if np.isfinite(values).mean()<.995:raise ValueError('Regional DEM coverage is incomplete')
    # Keep missing observations missing. Runtime rejects triangles touching them.
    binary=values.tobytes();(OUT/'dem.bin').write_bytes(binary)
    Image.fromarray(image).convert('RGB').save(OUT/'optical.webp',quality=78,method=6)
    near_binary=near_values.tobytes();(OUT/'near-dem.bin').write_bytes(near_binary)
    gray=near_image[:,:,:3].astype('float32');lo,hi=np.percentile(gray,[1,99]);display=np.clip((gray-lo)/(hi-lo),0,1);Image.fromarray(np.uint8(display*255)).save(OUT/'near-optical.webp',quality=83,method=6)
    near_meta['displayNormalization']={'percentiles':[1,99],'low':float(lo),'high':float(hi),'purpose':'Display contrast only; no generated detail or routing changes'}
    near={'width':201,'height':201,'cellSize':4000/201,'bounds':near_bounds,'binarySha256':sha(near_binary),'imageSha256':sha((OUT/'near-optical.webp').read_bytes()),'opticalSource':near_meta}
    meta={'schemaVersion':1,'width':N,'height':N,'cellSize':SPAN/N,'bounds':bounds,'crs':terrain['crs'],'focusBounds':b,'dataType':'float32','byteOrder':'little-endian','verticalUnits':'metres','layout':'pixel centres; rows north to south','binary':'dem.bin','image':'optical.webp','binarySha256':sha(binary),'imageSha256':sha((OUT/'optical.webp').read_bytes()),'demSource':source_meta,'opticalSource':image_meta,'validFraction':float(np.isfinite(values).mean()),'elevationRange':[float(np.nanmin(values)),float(np.nanmax(values))],'near':near,'purpose':'Display-only regional context; excluded from planning, risk detection and resource calculations. Original 1 km native DEM and constraints remain authoritative.','displayTransition':'The browser joins the exact native edge to the regional raster with a 200 m display transition; no physical observations or planning values are changed.'}
    (OUT/'manifest.json').write_text(json.dumps(meta,indent=2,allow_nan=False)+'\n',encoding='utf8')
    print(json.dumps({'bounds':bounds,'validFraction':meta['validFraction'],'elevationRange':meta['elevationRange'],'nativeDEMResolution':source_meta['nativeResolutionMetres'],'runtimeBytes':sum(p.stat().st_size for p in OUT.iterdir())},indent=2))

if __name__=='__main__':main()
