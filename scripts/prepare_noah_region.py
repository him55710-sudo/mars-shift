"""Add a real 1 km Caltech/NOAH-H overlap region, preserving existing regions.

This is east of the Perseverance landing site, NOT the rover landing location.
Reuses the verified regional pipeline rather than inventing new geography.
"""
import argparse
import json
import prepare_ridge as pipeline

pipeline.OUTPUT = pipeline.ROOT / 'public/data/noah'
pipeline.CENTER = (77.565, 18.46)
pipeline.URL_BASE = '/data/noah'

def prepare():
    result = pipeline.prepare()
    path = pipeline.OUTPUT / 'manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    manifest['dataset'] = {'id':'noah','name':'NOAH-H overlap sector','assetBase':'/data/noah',
        'selection':'Actual overlap of the published NOAH-H mosaic and Caltech native DEM; east of the rover landing site. Original floor and ridge regions retained.'}
    path.write_text(json.dumps(manifest,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    classification = json.loads((pipeline.OUTPUT / 'noah-terrain.json').read_text(encoding='utf-8'))
    assert classification['grid']['bounds'] == manifest['roi']['bounds']
    return result

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    print(json.dumps(pipeline.check_assets() if args.check else prepare(),indent=2))
