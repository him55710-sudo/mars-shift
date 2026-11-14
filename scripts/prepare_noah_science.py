"""Apply the existing, tested native-DEM equations to the NOAH overlap region.

Existing floor/ridge products and frozen optical model are never rewritten.
No local optical detector mask is available: its field stays entirely unknown.
"""
import argparse
import copy
import json
from pathlib import Path
import numpy as np
import rasterio
import terrain_science as engine

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'public/data/noah'

def prepare(check=False):
    read = lambda p: json.loads(p.read_text(encoding='utf-8'))
    planning = read(DIRECTORY/'terrain.json')
    native = read(DIRECTORY/'jezero-native-dem.json')
    template_path = ROOT/'public/data/science/terrain-metrics.json'
    template = read(template_path)
    source = DIRECTORY/'jezero-dem-1m.tif'
    source_hash = engine.sha256(source.read_bytes())
    assert source_hash == native['source']['sourceCropSha256']
    with rasterio.open(source) as src:
        assert src.res == (1,1) and src.count == 1 and src.transform.e < 0
        z = src.read(1,masked=True).filled(np.nan).astype('float64')
        crs, transform, bounds = src.crs,src.transform,list(src.bounds)
    assert crs == rasterio.crs.CRS.from_wkt(planning['crs'])
    assert np.allclose(bounds,planning['bounds'],rtol=0,atol=1e-8)
    assert z.shape == (planning['height']*5,planning['width']*5)
    fields = engine.terrain_derivatives(z)
    fields['opticalCueFraction'] = np.full(z.shape,np.nan)
    grid = {key:engine.aggregate(value,circular=key=='aspect',mask=key=='uncertaintyMask') for key,value in fields.items()}
    metadata = copy.deepcopy(template['metadata'])
    metadata['opticalProxy'] = {'status':'UNKNOWN','validFraction':0,
        'meaning':'No independently evaluated local optical detector product is supplied for this region. Null is not zero rock abundance. Published NOAH-H texture classes are a separate evidence layer.'}
    metadata['sensorCoverage'] = {'nativeDemValidFraction':float(np.isfinite(z).mean()),
        'opticalMaskValidFraction':0,'thermalGridValidFraction':sum(v is not None for v in planning['thermal'])/len(planning['thermal']),
        'thermalNativeSamplingMetres':100,'interpretation':'Availability only. Optical detector support is absent; no soil strength or slip estimate.'}
    hashes = {str(p.relative_to(ROOT)):engine.sha256(p.read_text(encoding='utf-8').encode()) for p in [Path(__file__),Path(engine.__file__)]}
    provenance = {'demCropSha256':source_hash,'nativeBinarySha256':native['validation']['binarySha256'],
        'source':native['source'],'scriptSha256UTF8LF':hashes[str(Path(__file__).relative_to(ROOT))],
        'methodSourceHashesUTF8LF':hashes,'metadataTemplateSha256':engine.sha256(template_path.read_bytes()),
        'software':{'numpy':np.__version__,'scipy':engine.scipy.__version__,'rasterio':rasterio.__version__,'GDAL':rasterio.__gdal_version__}}
    payload = {'schemaVersion':1,'region':'noah','width':planning['width'],'height':planning['height'],
        'cellSize':5,'bounds':bounds,'crs':crs.to_wkt(),'nativeResolution':1,
        'fields':{key:engine.json_values(value,engine.PRECISION[key]) for key,value in grid.items()},
        'metadata':metadata,'provenance':provenance,
        'summary':{'native':{k:engine.finite_summary(v) for k,v in fields.items()},'planning':{k:engine.finite_summary(v) for k,v in grid.items()}}}
    output=DIRECTORY/'science';output.mkdir(exist_ok=True)
    encoded=(json.dumps(payload,separators=(',',':'),allow_nan=False)+'\n').encode()
    tiff=output/'terrain-derivatives-1m.tif';result=output/'terrain-metrics.json'
    if check:
        assert result.read_bytes()==encoded,'Numerical product differs'
        with rasterio.open(tiff) as src:
            assert src.crs==crs and src.transform==transform and src.descriptions==tuple(fields)
            for n,v in enumerate(fields.values(),1):assert np.array_equal(src.read(n),v.astype('float32'),equal_nan=True)
    else:
        with rasterio.open(tiff,'w',driver='GTiff',width=z.shape[1],height=z.shape[0],count=len(fields),dtype='float32',crs=crs,transform=transform,nodata=np.nan,compress='deflate',predictor=3,tiled=True,blockxsize=256,blockysize=256,interleave='band') as dst:
            dst.update_tags(AREA_OR_POINT='Area',DATA_CLASS='Derived morphology; no local optical detector',SOURCE_SHA256=source_hash)
            for n,(key,value) in enumerate(fields.items(),1):
                dst.write(value.astype('float32'),n);dst.set_band_description(n,key);dst.update_tags(n,units=engine.UNITS[key])
        result.write_bytes(encoded)
    report={'region':'noah','jsonSha256':engine.sha256(encoded),'jsonBytes':len(encoded),'nativeGeoTiffSha256':engine.sha256(tiff.read_bytes()),'nativeGeoTiffBytes':tiff.stat().st_size,'source':provenance,'summary':payload['summary']}
    if not check:(output/'terrain-report.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    else:
        saved=read(output/'terrain-report.json');assert saved['jsonSha256']==report['jsonSha256'] and saved['nativeGeoTiffSha256']==report['nativeGeoTiffSha256']
    print(json.dumps({'region':'noah','verified':check,'nativeDemCoverage':metadata['sensorCoverage']['nativeDemValidFraction'],'slope':payload['summary']['planning']['slope'],'tri':payload['summary']['planning']['tri'],'opticalDetector':'UNKNOWN'}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');prepare(parser.parse_args().check)
