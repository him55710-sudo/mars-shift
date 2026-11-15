"""Frozen, independently labeled NASA sand-appearance experiment. See protocol.

Run --prepare to fetch frozen splits; --fit locks threshold without test labels;
--test performs the held-out evaluation; --check reproduces published counts.
"""
import argparse
import io
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter, sobel, laplace
from sklearn.ensemble import RandomForestClassifier
import joblib
import sklearn
import scipy
import PIL
from ai4mars_source import ROOT, CACHE, archive, member

OUT=ROOT/'public/data/hazards/sand-v39'
PREFIX='ai4mars-dataset-merged-0.6/msl/ncam/'
PROTOCOL=ROOT/'docs/SAND_VALIDATION_V39_PROTOCOL.json'
def sha(b): return hashlib.sha256(b).hexdigest()
def order(s): return sha(('3901:'+s).encode())
def group(s):
    m=re.search(r'_F([0-9]{7})',s)
    if not m: raise ValueError('No site-drive group: '+s)
    return m.group(1)
def read_json(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p,v): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def make_splits(z):
    ns=z.namelist();test=sorted([n for n in ns if n.startswith(PREFIX+'labels/test/masked-gold-min3-100agree/') and n.endswith('.png')],key=order)
    excluded={group(n) for n in test}
    train=[n for n in ns if n.startswith(PREFIX+'labels/train/') and n.endswith('.png') and group(n) not in excluded]
    by_group={}
    for n in sorted(train,key=order): by_group.setdefault(group(n),n)
    candidates=[by_group[g] for g in sorted(by_group,key=order)]
    if len(candidates)<160 or len(test)!=322: raise ValueError('Unexpected dataset inventory')
    result={'protocolSHA256':sha(PROTOCOL.read_bytes()),'train':candidates[:128],'calibration':candidates[128:160],'test':test}
    sets=[{group(n) for n in result[k]} for k in ['train','calibration','test']]
    assert not sets[0]&sets[1] and not sets[0]&sets[2] and not sets[1]&sets[2]
    return result
def image_name(label): return PREFIX+'images/edr/'+re.sub(r'_merged.*$','',Path(label).stem)+'.JPG'
def image_array(path): return np.asarray(Image.open(path).convert('L'),dtype=np.float32)/255
def label_array(path):
    a=np.asarray(Image.open(path));a=a[:,:,0] if a.ndim==3 else a
    if not set(np.unique(a))<={0,1,2,3,255}: raise ValueError('Unexpected label codes')
    return a
def features(a):
    grad=np.hypot(sobel(a,axis=0,mode='reflect'),sobel(a,axis=1,mode='reflect'))/8
    curve=np.abs(laplace(a,mode='reflect'))
    f=[a]
    for k in [5,17,49]:
        mean=uniform_filter(a,k,mode='reflect')
        f.extend([mean,np.sqrt(np.maximum(0,uniform_filter(a*a,k,mode='reflect')-mean*mean)),uniform_filter(grad,k,mode='reflect'),uniform_filter(curve,k,mode='reflect')])
    return np.stack(f,axis=-1)
def arrays(label):
    base=CACHE/'members';a=image_array(base/image_name(label));y=label_array(base/label)
    if a.shape!=y.shape: raise ValueError('Image/label alignment mismatch')
    return a,y
def counts(y,p):
    return [int(np.count_nonzero(y&p)),int(np.count_nonzero(~y&p)),int(np.count_nonzero(~y&~p)),int(np.count_nonzero(y&~p))]
def metrics(c):
    tp,fp,tn,fn=map(int,c)
    def ratio(a,b):return a/b if b else None
    return dict(tp=tp,fp=fp,tn=tn,fn=fn,precision=ratio(tp,tp+fp),recall=ratio(tp,tp+fn),f1=ratio(2*tp,2*tp+fp+fn),f2=ratio(5*tp,5*tp+4*fn+fp),falsePositiveRate=ratio(fp,fp+tn),missRate=ratio(fn,tp+fn),iou=ratio(tp,tp+fp+fn))
def scored(model,label):
    a,y=arrays(label);f=features(a)[4::8,4::8];y=y[4::8,4::8];s=model.predict_proba(f.reshape(-1,f.shape[-1]))[:,1].reshape(y.shape)
    return a,y,s
def prepare():
    with archive() as z:
        OUT.mkdir(parents=True,exist_ok=True);(OUT/'protocol.json').write_bytes(PROTOCOL.read_bytes())
        splits=make_splits(z);write(CACHE/'splits.json',splits);write(OUT/'splits.json',splits)
        jobs=sorted(set(n for k in ['train','calibration','test'] for l in splits[k] for n in [l,image_name(l)]))
        def download(n):
            # Independent ZipInfo read and RemoteZip instances; no shared stream position.
            return n,sha(member(z,n))
        with ThreadPoolExecutor(max_workers=6) as pool:
            hashes={}
            for i,(n,h) in enumerate(pool.map(download,jobs)):
                hashes[n]=h
                if i%40==0: print('Fetched',i+1,'/',len(jobs),flush=True)
        write(OUT/'source-hashes.json',hashes)
    print('Prepared',len(jobs),'members',flush=True)
def fit():
    splits=read_json(CACHE/'splits.json');rng=np.random.default_rng(3901);xs=[];ys=[]
    for n in splits['train']:
        a,y=arrays(n);f=features(a).reshape(-1,13);flat=y.ravel();ids=np.flatnonzero(flat!=255);ids=rng.choice(ids,min(2048,len(ids)),replace=False)
        xs.append(f[ids]);ys.append(flat[ids]==2)
    model=RandomForestClassifier(n_estimators=64,max_depth=14,min_samples_leaf=12,max_features='sqrt',class_weight='balanced_subsample',random_state=3901,n_jobs=2)
    model.fit(np.concatenate(xs),np.concatenate(ys));joblib.dump(model,CACHE/'model.joblib')
    cal=[scored(model,n)[1:] for n in splits['calibration']]
    scores=[]
    for threshold in np.round(np.arange(.1,.901,.05),2):
        c=np.sum([counts(y[y!=255]==2,s[y!=255]>=threshold) for y,s in cal],axis=0);scores.append({'threshold':float(threshold),**metrics(c)})
    best=max(scores,key=lambda m:m['f2'] or 0)
    lock={'protocolSHA256':sha(PROTOCOL.read_bytes()),'splitsSHA256':sha((CACHE/'splits.json').read_bytes()),'modelSHA256':sha((CACHE/'model.joblib').read_bytes()),'threshold':best['threshold'],'calibration':scores,'trainingPixels':int(sum(len(y) for y in ys)),'environment':{'numpy':np.__version__,'scikitLearn':sklearn.__version__,'scipy':scipy.__version__,'Pillow':PIL.__version__,'joblib':joblib.__version__}}
    write(OUT/'model-lock.json',lock)
    print('Locked before test:',best,flush=True)
def route_audit(y,s,threshold):
    # Reference image lattice only. Expert coverage (not classes) defines the benchmark domain.
    # No pixel-to-ground scale is invented. Identical endpoints for all graphs.
    from scipy.ndimage import binary_dilation
    import heapq
    h,w=y.shape;known=y!=255;ids=np.flatnonzero(known)
    if not len(ids): return None
    # Bottom-most then top-most labeled lattice cells, ties nearest image center.
    first=int(min(ids,key=lambda i:(-(i//w),abs(i%w-w/2))))
    last=int(min(ids,key=lambda i:((i//w),abs(i%w-w/2))))
    def search(block):
        if block.flat[first] or block.flat[last]:return None
        heap=[(0,first)];cost={first:0};parent={}
        while heap:
            d,i=heapq.heappop(heap)
            if d!=cost[i]:continue
            if i==last:
                path=[i]
                while i!=first:i=parent[i];path.append(i)
                return path[::-1]
            x=i%w;z=i//w
            for dx,dz in [(1,0),(-1,0),(0,1),(0,-1)]:
                a,b=x+dx,z+dz;j=b*w+a
                if a<0 or b<0 or a>=w or b>=h or block[b,a]:continue
                nd=d+1
                if nd<cost.get(j,float('inf')):cost[j]=nd;parent[j]=i;heapq.heappush(heap,(nd,j))
        return None
    baseline=search(~known);predicted=search(~known|binary_dilation(s>=threshold,iterations=1));reference=search(~known|binary_dilation(y==2,iterations=1))
    def audit(p):return None if p is None else {'cells':len(p),'expertSandCells':int(sum(y.flat[i]==2 for i in p)),'path':p}
    return {'width':w,'height':h,'coordinateSystem':'image-lattice; 8 native pixels per step, no ground metres','coverage':'expert annotation availability used as common domain; not a deployed coverage estimator','start':first,'target':last,'baseline':audit(baseline),'predicted':audit(predicted),'expertReference':audit(reference)}
def test(check=False):
    splits=read_json(CACHE/'splits.json');lock=read_json(OUT/'model-lock.json');model=joblib.load(CACHE/'model.joblib') # only our own local fit
    if sha(PROTOCOL.read_bytes())!=lock['protocolSHA256'] or sha((CACHE/'model.joblib').read_bytes())!=lock['modelSHA256']:raise ValueError('Frozen protocol or model changed')
    rows=[];nlabels=0;nsampled=0
    for i,n in enumerate(splits['test']):
        a,y,s=scored(model,n);known=y!=255;label=y[known]==2;score=s[known]
        rows.append({'id':Path(n).stem,'group':group(n),'labelMember':n,'imageMember':image_name(n),'counts':counts(label,score>=lock['threshold']),'fixedHalfCounts':counts(label,score>=.5),'known':int(known.sum()),'sampled':int(y.size)})
        nlabels+=int(known.sum());nsampled+=y.size
        np.savez_compressed(CACHE/(Path(n).stem+'.npz'),y=y,score=s)
        if i%40==0:print('Tested',i+1,'/',len(splits['test']),flush=True)
    c=np.sum([r['counts'] for r in rows],axis=0);m=metrics(c);half=metrics(np.sum([r['fixedHalfCounts'] for r in rows],axis=0))
    # Resample images as clusters, never treat millions of adjacent pixels as independent trials.
    rng=np.random.default_rng(3902);matrix=np.array([r['counts'] for r in rows]);boot=[]
    for _ in range(1000):boot.append(metrics(matrix[rng.integers(0,len(rows),len(rows))].sum(axis=0)))
    ci={k:[float(v) for v in np.quantile([b[k] for b in boot if b[k] is not None],[.025,.975])] for k in ['precision','recall','falsePositiveRate','missRate','iou']}
    examples=[]
    selected=[('first-hash',rows[0]),('largest-false-positive-count',max(rows,key=lambda r:r['counts'][1])),('largest-miss-count',max(rows,key=lambda r:r['counts'][3]))]
    for reason,r in selected:
        n=r['labelMember'];a,y,s=scored(model,n);known=y!=255;p=s>=lock['threshold'];truth=y==2
        color=np.zeros((*y.shape,4),dtype=np.uint8);color[known&truth&p]=[40,220,150,180];color[known&~truth&p]=[255,160,40,200];color[known&truth&~p]=[255,65,100,210]
        overlay=Image.fromarray((a*255).astype('uint8')).convert('RGBA').resize((512,512));overlay.alpha_composite(Image.fromarray(color).resize((512,512),Image.Resampling.NEAREST))
        OUT.mkdir(parents=True,exist_ok=True);overlay.convert('RGB').save(OUT/(reason+'.jpg'),quality=88)
        examples.append({'selection':reason,**r,'overlay':reason+'.jpg','routeAudit':route_audit(y,s,lock['threshold'])})
    report={'schema':1,'task':'terrain-sand-appearance','model':'MARS SHIFT texture RF v39 (new experimental baseline)','source':'https://zenodo.org/records/15995036','protocolSHA256':lock['protocolSHA256'],'modelSHA256':lock['modelSHA256'],'threshold':lock['threshold'],'trainImages':128,'calibrationImages':32,'testImages':len(rows),'testSiteDriveGroups':len(set(r['group'] for r in rows)),'labeledLatticePixels':nlabels,'sampledLatticePixels':nsampled,'labelCoverage':nlabels/nsampled,'stride':8,'metrics':m,'imageBootstrap95':ci,'baselines':{'threshold0.5':half,'alwaysSand':metrics([int(c[0]+c[3]),int(c[1]+c[2]),0,0]),'neverSand':metrics([0,0,int(c[1]+c[2]),int(c[0]+c[3])])},'rows':rows,'examples':examples,'slip':{'matchedBeforeDriveOutcomes':0,'precision':None,'recall':None,'status':'No downloadable matched telemetry table obtained; published slip experiments not reproduced'},'deployment':{'automaticPhysicalExclusionsAllowed':False,'reason':'MSL Navcam appearance test does not validate Jezero orbital NOAH-H, Sol477 registration, soil support or astronaut sinkage.','localReviewRequired':True},'limitations':['Subsampled lattice, not full-resolution segmentation benchmark','128 training images; single frozen baseline; not a NASA flight classifier','Same site-drive removed from development; neighboring site-drives and repeated geological terrain can remain correlated','Confidence intervals bootstrap images, not independent drives or sites','Expert sand appearance is not measured slip, entrapment, or astronaut survival','Example route audits use image coordinates and oracle annotation coverage, not physical navigation']}
    if check:
        old=read_json(OUT/'report.json')
        if old!=report:raise ValueError('Published report does not reproduce')
        print('PASS: complete held-out report and examples reproduce',flush=True)
    else:write(OUT/'report.json',report)
    print(json.dumps({k:report[k] for k in ['testImages','labeledLatticePixels','metrics','imageBootstrap95']},indent=2),flush=True)
def check_counts():
    report=read_json(OUT/'report.json');hashes=read_json(OUT/'source-hashes.json');lock=read_json(OUT/'model-lock.json');total=np.zeros(4,dtype=np.int64)
    if report['modelSHA256']!=sha((CACHE/'model.joblib').read_bytes()) or report['protocolSHA256']!=sha(PROTOCOL.read_bytes()):raise ValueError('Model/protocol changed')
    for row in report['rows']:
        for name in [row['labelMember'],row['imageMember']]:
            if sha((CACHE/'members'/name).read_bytes())!=hashes[name]:raise ValueError('Official source changed: '+name)
        y=label_array(CACHE/'members'/row['labelMember'])[4::8,4::8]
        with np.load(CACHE/(row['id']+'.npz')) as saved:
            if not np.array_equal(saved['y'],y):raise ValueError('Cached labels differ from official expert labels')
            known=y!=255;c=counts(y[known]==2,saved['score'][known]>=lock['threshold'])
        if c!=row['counts']:raise ValueError('Per-image confusion mismatch')
        total+=c
    if metrics(total)!=report['metrics']:raise ValueError('Aggregate confusion mismatch')
    print('PASS: 322 official image/label source hashes, cached prediction tabulation, per-image and aggregate counts reproduce. Use --test or --check to rerun full model inference.',flush=True)
def audit_routes():
    report=read_json(OUT/'report.json');rows=[]
    for row in report['rows']:
        with np.load(CACHE/(row['id']+'.npz')) as s:r=route_audit(s['y'],s['score'],report['threshold'])
        rows.append({'id':row['id'],'audit':r})
    summary={'testImages':len(rows),'noExpertLatticeLabels':sum(x['audit'] is None for x in rows),'coveragePathExists':sum(x['audit'] is not None and x['audit']['baseline'] is not None for x in rows),'predictedPathExists':sum(x['audit'] is not None and x['audit']['predicted'] is not None for x in rows),'expertSandReferencePathExists':sum(x['audit'] is not None and x['audit']['expertReference'] is not None for x in rows),'predictedPathsCrossingExpertSand':sum(x['audit'] is not None and x['audit']['predicted'] is not None and x['audit']['predicted']['expertSandCells']>0 for x in rows),'modelHoldsDespiteExpertReferencePath':sum(x['audit'] is not None and x['audit']['predicted'] is None and x['audit']['expertReference'] is not None for x in rows)}
    value={'schema':1,'analysis':'Post-hoc descriptive routing audit; no model, threshold, endpoints or buffers changed after test. Not a new independent model-selection experiment.','modelSHA256':report['modelSHA256'],'summary':summary,'rows':rows}
    write(OUT/'routing-audit.json',value);print(json.dumps(summary),flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--prepare',action='store_true');p.add_argument('--fit',action='store_true');p.add_argument('--test',action='store_true');p.add_argument('--check',action='store_true');p.add_argument('--check-counts',action='store_true');p.add_argument('--route-audit',action='store_true');args=p.parse_args()
    if args.prepare:prepare()
    if args.fit:fit()
    if args.test or args.check:test(args.check)
    if args.check_counts:check_counts()
    if args.route_audit:audit_routes()
