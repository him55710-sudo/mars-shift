"""Build a 1 km Jezero ROI from published rasters, preserving Mars coordinates.

The local range bridge retains verified HTTPS in Requests while allowing GDAL's
range reader to work on Windows installations with non-ASCII certificate paths.
It serves only one fixed public scientific product on a loopback ephemeral port.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from threading import Thread
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json, math, zipfile, unittest
import truststore
truststore.inject_into_ssl()
import requests
import numpy as np
import rasterio
from rasterio.windows import from_bounds, Window
from rasterio.enums import Resampling
from rasterio.warp import transform, reproject
from rasterio.transform import from_origin
from scipy.ndimage import maximum_filter, minimum_filter, binary_dilation
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'data-cache'
OUT=ROOT/'public'/'data'
CELL=5
SIZE=1000
N=SIZE//CELL
CENTER=(77.64,18.45)
OPTICAL='https://data.caltech.edu/api/records/stqse-yay61/files/cenjez_DRG_0_3m.tif/content'
OPTICAL_BYTES=1640221885

def slope_degrees(z, dx, dy):
    gy,gx=np.gradient(z,dy,dx)
    return np.degrees(np.arctan(np.hypot(gx,gy)))

class RangeBridge(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_HEAD(self):
        self.send_response(200);self.send_header('Content-Length',str(OPTICAL_BYTES));self.send_header('Accept-Ranges','bytes');self.end_headers()
    def do_GET(self):
        if self.path!='/optical.tif': self.send_error(404);return
        headers={'Range':self.headers.get('Range','bytes=0-16383')}
        response=requests.get(OPTICAL,headers=headers,timeout=90)
        self.send_response(response.status_code)
        for key in ['Content-Range','Content-Length','Content-Type','Accept-Ranges']:
            if key in response.headers:self.send_header(key,response.headers[key])
        self.end_headers();self.wfile.write(response.content)

def blocks(a,op):
    a=a.reshape(N,CELL,N,CELL)
    return op(op(a,axis=3),axis=1)

def rgba(a,colors,lo,hi,alpha=255):
    valid=np.isfinite(a)
    t=np.where(valid,np.clip((a-lo)/(hi-lo),0,1),0)
    pal=np.array(colors,dtype=float)
    indices=t*(len(pal)-1)
    i=np.minimum(indices.astype(int),len(pal)-2)
    f=indices-i
    rgb=pal[i]*(1-f[...,None])+pal[i+1]*f[...,None]
    return np.dstack([rgb,valid.astype(float)*alpha]).astype('uint8')

def main():
    OUT.mkdir(exist_ok=True,parents=True)
    with rasterio.open(CACHE/'cenjez_DEM_1m.tif') as src:
        print('DEM',src.crs,src.res,src.nodata,flush=True)
        # Geographic CRS is explicitly the geographic component of this Mars CRS.
        geo=rasterio.crs.CRS.from_string('+proj=longlat +a=3396190 +b=3396190 +no_defs')
        cx,cy=transform(geo,src.crs,[CENTER[0]],[CENTER[1]])
        window=from_bounds(cx[0]-SIZE/2,cy[0]-SIZE/2,cx[0]+SIZE/2,cy[0]+SIZE/2,src.transform).round_offsets().round_lengths()
        z=src.read(1,window=window,masked=True)
        if z.shape!=(SIZE,SIZE):raise ValueError('ROI not 1m pixels or incomplete coverage')
        demcrs=src.crs
        roi_transform=src.window_transform(window)
        bounds=rasterio.windows.bounds(window,src.transform)
        original_crs=src.crs.to_wkt()
        native_resolution=list(src.res)
        native_nodata=src.nodata
        profile=src.profile.copy();profile.update(width=SIZE,height=SIZE,transform=roi_transform,compress='deflate')
        with rasterio.open(OUT/'jezero-dem-1m.tif','w',**profile) as dst:dst.write(z.filled(src.nodata),1)
    invalid=np.ma.getmaskarray(z)
    z=z.astype(float).filled(np.nan)
    slope=slope_degrees(z,1,1)
    valid=~blocks(invalid,np.any)
    # Invalidate any cell whose native slope stencil touches missing DEM data.
    valid &= ~blocks(~np.isfinite(slope),np.any)
    elevation=blocks(z,np.nanmean)
    maxslope=blocks(slope,np.nanmax)
    meanslope=blocks(slope,np.nanmean)
    relief=maximum_filter(np.nan_to_num(z,nan=-1e8),size=11)-minimum_filter(np.nan_to_num(z,nan=1e8),size=11)
    roughness=blocks(relief,np.nanmean)
    steep=(maxslope>25)&valid
    # Uncalibrated proximity proxy, explicitly not a probability or direction model.
    exposure=binary_dilation(steep,iterations=4)&valid
    exposure=exposure.astype(float)
    for name,array in [('slope.png',rgba(maxslope,[(26,40,37),(62,112,94),(229,176,98),(228,98,75)],0,30)),('exposure.png',rgba(exposure,[(0,0,0),(249,140,84)],0,1))]:
        if name=='exposure.png':array[:,:,3]=(exposure*100).astype('uint8')
        Image.fromarray(array).save(OUT/name)
    gy,gx=np.gradient(np.nan_to_num(z),1,1)
    shade=np.clip(((-gx*.5+gy*.6+1)/np.sqrt(gx*gx+gy*gy+1))*.6+.35,0,1)
    rgb=np.stack([shade*.62,shade*.54,shade*.43],axis=-1)
    Image.fromarray((rgb*255).astype('uint8')).save(OUT/'hillshade.webp',quality=90)
    print('ROI',bounds,'valid',float(valid.mean()),'slope',np.nanpercentile(maxslope,[0,25,50,75,90,99]).tolist(),flush=True)
    # Quantitative thermal pixels are sampled by nearest neighbour, never sharpened.
    with zipfile.ZipFile(CACHE/'THEMIS_TI_Quantitative.zip') as archive:
        names=[s for s in archive.namelist() if s.lower().endswith('.tif')]
        if len(names)!=1:raise ValueError('Expected exactly one quantitative thermal raster')
        thermal_path=CACHE/'thermal-quantitative.tif'
        if not thermal_path.exists():thermal_path.write_bytes(archive.read(names[0]))
    with rasterio.open(thermal_path) as src:
        print('THEMIS',src.crs,src.res,src.nodata,flush=True)
        thermal=np.full((N,N),np.nan,dtype='float32')
        reproject(source=rasterio.band(src,1),destination=thermal,src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,dst_transform=from_origin(bounds[0],bounds[3],CELL,CELL),dst_crs=demcrs,dst_nodata=np.nan,resampling=Resampling.nearest)
        thermal_crs=src.crs.to_wkt();thermal_resolution=list(src.res)
    finite=thermal[np.isfinite(thermal)]
    if not finite.size:raise ValueError('No thermal overlap')
    ti_lo,ti_hi=float(np.min(finite)),float(np.max(finite))
    Image.fromarray(rgba(np.nan_to_num(thermal,nan=ti_lo),[(47,54,67),(103,134,136),(233,187,108)],ti_lo,max(ti_hi,ti_lo+1))).save(OUT/'thermal.png')
    # Optical TIFF is cached as a small aligned ROI; the multi-GB source is not downloaded.
    optical_path=OUT/'optical.webp'
    optical_meta_path=OUT/'optical-meta.json'
    optical_meta=json.loads(optical_meta_path.read_text()) if optical_meta_path.exists() else None
    if not optical_path.exists() or not optical_meta or optical_meta.get('bounds')!=list(bounds):
        bridge=ThreadingHTTPServer(('127.0.0.1',0),RangeBridge)
        Thread(target=bridge.serve_forever,daemon=True).start()
        try:
            with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',GDAL_HTTP_MULTIRANGE='NO',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
                with rasterio.open(f'http://127.0.0.1:{bridge.server_port}/optical.tif') as src:
                    print('OPTICAL',src.res,src.crs,flush=True)
                    # Both products use the Jezero equirectangular projection; verify it.
                    if src.crs!=demcrs:raise ValueError('Optical CRS differs; explicit reprojection required')
                    win=from_bounds(*bounds,src.transform)
                    image=src.read(1,window=win,out_shape=(1000,1000),resampling=Resampling.bilinear,masked=True)
                    np.save(CACHE/'optical-roi.npy',image.filled(0))
                    optical_valid=float((~np.ma.getmaskarray(image)).mean())
                    qlo,qhi=np.percentile(image.compressed(),[1,99])
                    gray=np.clip((image.filled(qlo)-qlo)/(qhi-qlo),0,1)
                    # Neutral grayscale: imagery colors are not fabricated Mars surface color.
                    Image.fromarray((gray*255).astype('uint8')).save(optical_path,quality=92)
                    optical_meta={'bounds':list(bounds),'crs':src.crs.to_wkt(),'sourceResolution':list(src.res),'validFraction':optical_valid,'displayPixels':[1000,1000],'source':OPTICAL}
                    optical_meta_path.write_text(json.dumps(optical_meta,indent=2))
                    print('Optical coverage',optical_valid,flush=True)
        finally:bridge.shutdown();bridge.server_close()
    def flat(a,precision=2):return [None if not np.isfinite(x) else round(float(x),precision) for x in a.flatten()]
    data={'width':N,'height':N,'cellSize':CELL,'bounds':list(bounds),'center':list(CENTER),'crs':original_crs,'elevation':flat(elevation),'slope':flat(maxslope),'meanSlope':flat(meanslope),'roughness':flat(roughness),'exposure':flat(exposure),'valid':valid.astype(int).flatten().tolist(),'thermal':flat(thermal,1),'thermalRange':[ti_lo,ti_hi]}
    (OUT/'terrain.json').write_text(json.dumps(data,separators=(',',':')))
    manifest={'processedAt':datetime.now(timezone.utc).isoformat(),'roi':{'centerLonLat':list(CENTER),'sizeMeters':SIZE,'gridMeters':CELL,'bounds':list(bounds),'crs':original_crs},'sources':[
      {'id':'dem','agency':'NASA / Caltech','instrument':'MRO HiRISE stereo','product':'cenjez_DEM_1m.tif','url':'https://data.caltech.edu/records/stqse-yay61','doi':'10.22002/stqse-yay61','version':'v2 (2024)','observationDate':None,'resolutionMeters':native_resolution,'verticalUnits':'metres','nodata':native_nodata,'crs':original_crs,'license':'CC BY 4.0; Annex & Ehlmann (2024)','classification':'observed-derived','processing':'1 km crop; native 1m gradient; maximum slope and mean elevation aggregated to 5m planning cells'},
      {'id':'optical','agency':'NASA / Caltech','instrument':'MRO HiRISE','product':'cenjez_DRG_0_3m.tif','url':OPTICAL,'record':'https://data.caltech.edu/records/stqse-yay61','resolutionMeters':0.3,'displayMeters':1,'crs':original_crs,'observationDate':None,'license':'CC BY 4.0; Annex & Ehlmann (2024)','classification':'observed','processing':'HTTP range crop, bilinear display resample to1m; percentile contrast stretch; grayscale'},
      {'id':'thermal','agency':'NASA Mars 2020 / Caltech Murray Lab','instrument':'Mars Odyssey THEMIS','product':'THEMIS_TI_Quantitative','url':(CACHE/'thermal-source.txt').read_text(),'record':'https://murray-lab.caltech.edu/Mars2020/','resolutionMeters':thermal_resolution,'nominalResolutionMeters':100,'units':'J m^-2 K^-1 s^-1/2','crs':thermal_crs,'observationDate':None,'classification':'observed-derived','processing':'Mars-to-Mars reprojection, nearest-neighbour sampling; only regional material context','limitations':'Registered to global THEMIS, not quantitatively controlled. No calibrated bearing strength, astronaut safety or wheel-slip estimates. Coarse layer is excluded from routing cost.'}
    ],'coverage':{'demValidFraction':float(valid.mean()),'thermalValidFraction':float(np.isfinite(thermal).mean()),'opticalValidFraction':optical_meta['validFraction'],'optical':'Aligned real HiRISE crop; display contrast enhanced','thermalMin':ti_lo,'thermalMax':ti_hi},'heuristics':{'exposure':'Within 4 planning cells (20m Manhattan dilation) of native maximum slope >25deg; undirected proximity only, not a rockfall forecast','opticalClassification':'No automated boulder or dune classifier claimed; optical image supports manual inspection only','evidence':'DEM/thermal coverage and resolution; no probabilistic confidence score'},'simulation':'Habitat, targets, new exclusion event and resource budgets are illustrative planning inputs. No confirmed local hazard change is asserted.','aiDisclosure':'Implementation, analysis code and documents authored with Codex assistance. Source measurements were not generated by AI.'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,allow_nan=False))
    print('Wrote terrain.json, manifest and image layers',flush=True)

class TerrainTests(unittest.TestCase):
    def test_flat(self):self.assertTrue(np.allclose(slope_degrees(np.zeros((5,5)),1,1),0))
    def test_planar(self):
        y,x=np.mgrid[:9,:9];self.assertTrue(np.allclose(slope_degrees(x*2.0,2,2),45))
    def test_units(self):
        y,x=np.mgrid[:9,:9];self.assertTrue(np.allclose(slope_degrees(x*1.0,2,2),math.degrees(math.atan(.5))))
    def test_missing_pixels_transparent(self):
        a=np.array([[0.,np.nan],[.5,1.]])
        out=rgba(a,[(0,0,0),(255,255,255)],0,1)
        self.assertEqual(int(out[0,1,3]),0)
        self.assertEqual(int(out[1,1,3]),255)

if __name__=='__main__':
    import sys
    if '--test' in sys.argv: unittest.main(argv=[sys.argv[0]])
    else: main()
