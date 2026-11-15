"""Record primary-source availability, including unsuccessful slip-data retrieval.

This is an availability audit, not an exhaustive proof that telemetry is not public.
"""
import hashlib
import json
from pathlib import Path
import requests

OUT=Path(__file__).resolve().parents[1]/'public/data/hazards/sand-v39/source-audit.json'
def main():
    url='https://dataverse.jpl.nasa.gov/api/datasets/:persistentId/?persistentId=doi:10.48577/jpl.M8FWRK'
    r=requests.get(url,timeout=40);r.raise_for_status();j=r.json()
    files=[{'id':f['dataFile']['id'],'filename':f['dataFile']['filename'],'bytes':f['dataFile']['filesize']} for f in j['data']['latestVersion']['files']]
    result={'schema':1,'matchedSlipOutcomesObtained':0,'trapConfusionMatrix':None,'retrievals':[{'url':url,'status':r.status_code,'responseSHA256':hashlib.sha256(r.content).hexdigest(),'files':files,'finding':'This repository entry supplies a paper PDF, not an image-to-slip telemetry table.'},{'url':'https://ntrs.nasa.gov/citations/20210006223','finding':'Slip study paper record; no downloadable per-drive table obtained.'},{'url':'https://www.roboticsproceedings.org/rss13/p38.pdf','finding':'Published in-situ slip/slope/thermal experiments; referenced method, not reproduced. Aggregate paper figures do not supply independent outcomes matched to our predictions.'},{'url':'https://zenodo.org/records/15995036','finding':'Official NASA/JPL AI4Mars expert terrain labels downloaded directly. Sand appearance only; no sinkage or drive slip outcome column.'}],'scope':'Primary sources retrieved in this audit. Absence of an obtained matched table is not a claim that no public telemetry exists.','requiredForSlipEvaluation':['Image product ID and acquisition time before traversal','Drive ID and timestamp','Independent wheel/visual odometry slip definition and quality flags','Location and frame transform linking wheel footprints to input imagery','Whole-drive/site held-out split; commanded/achieved displacement alone must account for steering, turns and failed VO'],'routingConsequence':'Withhold automatic physical hazard classification from the new appearance experiment; retain declared/manual exclusions and show local-validation requirement.'}
    OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print('Audited JPL files:',files)
if __name__=='__main__':main()
