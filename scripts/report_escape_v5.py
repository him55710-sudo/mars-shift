import json,csv,hashlib
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path('public/data/hazards/escape-v5'); out=Path('exa-results/escape-v5-2026-11-15')
out.mkdir(parents=True,exist_ok=True)
if (out/'report.md').exists():raise RuntimeError('Refusing to overwrite the report')
read=lambda p:json.loads(p.read_text(encoding='utf8'))
d=read(root/'diagnostic.json');h=read(root/'holdout.json');m=read(root/'manifest.json');f=read(root/'implementation-freeze.json')
for name,digest in m['historicalHashes'].items():assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest,name
for name,digest in f['files'].items():assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest,name
arms=list(h['summary']); cases={c['id']:c for c in h['cases']}; episodes={(e['id'],e['arm']):e for e in h['episodes']}
def paired_csv(name,source):
 fields=['id','arm','region','warningPlacement','actualStationaryFirstContact','initiallyInside','stationaryThreat','noContact','exposureSeconds','minClearance','returnFailure','returnMarginSeconds','minReturnMarginSeconds','detectionTime','estimateReadyTime','firstPlanTime','firstMovementTime','holdSeconds','terrainViolations','resourceViolationSeconds']
 with (root/name).open('x',newline='',encoding='utf8') as stream:
  w=csv.DictWriter(stream,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(source['episodes'])
paired_csv('paired-cases.csv',h);paired_csv('diagnostic-pairs.csv',d)
failures=[]
for e in h['episodes']:
 if e['noContact'] and not e['returnFailure']:continue
 oracle=episodes[e['id'],'DEM-full-information-v5']
 flags=[]
 if e['initiallyInside']:flags.append('ALREADY_INSIDE_AT_DETECTION')
 if e['intervals'] and (e['firstMovementTime'] is None or e['intervals'][0][0]<e['firstMovementTime']):flags.append('CONTACT_BEFORE_FIRST_MOVEMENT')
 if oracle['noContact'] and not e['noContact']:flags.append('MATCHED_FULL_INFORMATION_FOUND_NO_CONTACT_ROUTE')
 if not oracle['noContact']:flags.append('BOUNDED_FULL_INFORMATION_REFERENCE_ALSO_CONTACTED_NOT_IMPOSSIBILITY_PROOF')
 if e['returnFailure']:flags.append('STATIC_RETURN_RESERVE_VIOLATION')
 failures.append({**e,'diagnosticFlags':flags})
with (root/'failures.json').open('x',encoding='utf8') as stream:json.dump(failures,stream,indent=2)
pair_rows=[]
for cid in cases:
 a=episodes[cid,'MARS-v4'];b=episodes[cid,'MARS-v5'];pair_rows.append(dict(id=cid,exposureDelta=b['exposureSeconds']-a['exposureSeconds'],clearanceDelta=b['minClearance']-a['minClearance'],avoidanceGain=int(b['noContact'])-int(a['noContact'])))
subgroups={}
for name,predicate in [('floor',lambda c:c['region']=='floor'),('ridge',lambda c:c['region']=='ridge'),('turning',lambda c:c['turnDegrees']!=0),('growing',lambda c:c['growth']!=0),('initially-inside',lambda c:c['initiallyInside']),('straight-constant',lambda c:c['turnDegrees']==0 and c['growth']==0)]:
 ids=[c['id'] for c in cases.values() if predicate(c)]
 subgroups[name]={arm:{'cases':len(ids),'noContact':sum(episodes[cid,arm]['noContact'] for cid in ids),'meanExposure':float(np.mean([episodes[cid,arm]['exposureSeconds'] for cid in ids])) if ids else None} for arm in arms}
summary={k:h[k] for k in ['scope','manifestSHA256','protocolSHA256','implementationSHA256','summary']};summary.update(subgroups=subgroups,pairedChange=pair_rows,independentNewObservedEvents=0,disjointHoldoutScenarios=36,historicalHashesVerified=True,definition={'warning':'STATIONARY_FRONT_BOUNDARY_ENTRY; actual entry is separately reported for growth/turn','paddingMetres':1,'contact':'strict interior positive duration > 1e-8 s','detectionSeconds':0,'estimateReadySeconds':4,'firstActionEligibleSeconds':6,'return':'static return budget feasibility, not executed hazard-free arrival at base'})
with (root/'holdout-summary.json').open('x',encoding='utf8') as stream:json.dump(summary,stream,indent=2)
with (root/'navigation-config.json').open('x',encoding='utf8') as stream:json.dump({'schemaVersion':5,'status':'EXPERIMENTAL_SIMULATION_ONLY','config':f['config'],'accelerationNoise':.08,'validation':'/data/hazards/escape-v5/holdout-summary.json'},stream,indent=2)

names=['Baseline','Dynamic-v5-tracker','MARS-v4','MARS-v5','DEM-full-information-v5'];labels=['Static','Dynamic / 5 fixes','MARS v4','MARS v5','Matched full info']
fig,axes=plt.subplots(1,2,figsize=(12,5),layout='constrained');fig.suptitle('Escape v5: fixed scenarios, matched terrain and resources',weight='bold',fontsize=15)
for ax,key,title,unit in [(axes[0],'meanExposure','Contact duration','Mean seconds / scenario'),(axes[1],'noContact','No-contact scenarios','Count / 36')]:
 values=[h['summary'][n][key] for n in names];bars=ax.bar(np.arange(len(names)),values,color=['#89939d','#dba34c','#93c8c0','#257b70','#615579']);ax.bar_label(bars,fmt='%.2f' if key=='meanExposure' else '%g',padding=3);ax.set_xticks(np.arange(len(names)),labels,rotation=22,ha='right');ax.set_title(title);ax.set_ylabel(unit);ax.grid(axis='y',alpha=.15);ax.set_axisbelow(True);ax.margins(y=.18)
fig.text(.5,-.04,'36 synthetic scenarios, including near misses and 2 initially-inside cases. No new independent observed events.',ha='center',fontsize=9)
fig.savefig(out/'results.png',dpi=180,bbox_inches='tight');fig.savefig(out/'results.pdf',bbox_inches='tight')

def comparison_table():
 rows=['| 모델 | 무접촉 / 36 | 직격 조건 무접촉 | 평균 접촉(s) | 평균 최소 이격(m) | 최악 이격(m) | 귀환 예산 위반 | 계산 p95(ms) |','|---|---:|---:|---:|---:|---:|---:|---:|']
 for name,s in h['summary'].items():rows.append(f"| {name} | {s['noContact']} | {s['threateningNoContact']}/{s['threatening']} | {s['meanExposure']:.3f} | {s['meanMinClearance']:.3f} | {s['worstMinClearance']:.3f} | {s['returnFailures']} | {s['replanMs']['p95']:.1f} |")
 return '\n'.join(rows)
paired=['| 사례 | DEM | 변형 | 정적 접촉(s) | Dynamic 동일 추정 | v4 접촉(s) | v5 접촉(s) | DEM 완전정보 |','|---|---|---|---:|---:|---:|---:|---:|']
for cid,c in cases.items():
 kind='내부 시작' if c['initiallyInside'] else ('회전' if c['turnDegrees'] else '')+('·팽창' if c['growth'] else '') or '등속'
 paired.append(f"| {cid} | {c['region']} | {kind} | "+' | '.join(f"{episodes[cid,a]['exposureSeconds']:.3f}" for a in names)+' |')
v4=h['summary']['MARS-v4'];v5=h['summary']['MARS-v5'];dyn=h['summary']['Dynamic-v5-tracker'];base=h['summary']['Baseline']
gain=lambda other:100*(other['meanExposure']-v5['meanExposure'])/other['meanExposure']
prediction=['| 지평 | v4 위치 RMSE(m) | v5 위치 RMSE(m) | v4/v5 반경 MAE(m) |','|---|---:|---:|---:|']
for horizon in ['5','10','20','30']:
 a=v4['prediction'][horizon];b=v5['prediction'][horizon];prediction.append(f"| {horizon}s | {a['positionRMSE']:.3f} | {b['positionRMSE']:.3f} | {a['radiusMAE']:.3f} / {b['radiusMAE']:.3f} |")
sub=['| 하위 조건 | 사례 수 | v4 무접촉 | v5 무접촉 | v4 평균 접촉 | v5 평균 접촉 |','|---|---:|---:|---:|---:|---:|']
for name,values in subgroups.items():
 a=values['MARS-v4'];b=values['MARS-v5'];sub.append(f"| {name} | {a['cases']} | {a['noContact']} | {b['noContact']} | {a['meanExposure']:.3f} | {b['meanExposure']:.3f} |")
text=f'''# MARS SHIFT: 대피 경로 v5 검증·개선 기록

2026-11-15 KST. 기존 결과 파일의 SHA-256을 검사해 변경되지 않았음을 확인했다.
프로토콜: `docs/ESCAPE_V5_PROTOCOL.md`, 진단 후 선택 근거: `docs/ESCAPE_V5_SELECTION.md`.
원본 자료는 [Hueso et al. Table S3](https://doi.org/10.5281/zenodo.7315863)의 이미 사용한 모델 추정값이다.
이전 7,200조건은 합성 조합이고, 이번 36개 평가 시나리오도 독립적인 실제 관측이 아니다.

## 1. 정의와 회귀 검증

경고 W는 **정지한 출발점에 위험영역의 앞쪽 경계가 처음 닿을 때까지**다.
정면 등속 접근에서는 중심 도착 시간이 W+R/v다. 기존 16·27·53초는 2m 여유를 더한
앞쪽 경계 기준이며, 중심 기준은 각각 약 17.7·30.2·59.3초다(보행 0.6, 이동 5.3m/s, 지연 6초).
그 결과를 수정하거나 덮어쓰지 않았다. 새 비교는 모든 모델에 R=관측 모델 반경+1m를 적용한다.
접촉은 경계 내부에 양의 시간 동안 있는 것이며 접선 접촉 시간은 0이다. 무접촉 수치 허용값은 1e-8초다.

최초 감지 t=0, 0/2/4초 관측, 추정 준비 t=4, 2초 전달·반응 지연 후 최초 계획/이동 가능 t=6.
첫 실제 이동은 HOLD 여부에 따라 더 늦어질 수 있다. 실제 계산 소요시간은 따로 측정하며
가상 동역학에 중복 가산하지 않는다. 실제 감지 장치의 탐지 성능을 입증한 실험이 아니다.
성장·회전 사례의 W는 최초 배치 기준이다. 실제 정지점 접촉 시작 시각을 별도 계산해 CSV에 저장했다.

해석식과 실제 궤적 교차를 대조하고 빠른 0.02초 접촉, 접선, 반경 증가, 방향 전환,
1/0.5/0.1/0.01초 분할에 대한 연속 접촉 불변성을 회귀 검사했다. 실행 평가뿐 아니라
새 경로 후보의 접촉 비용에도 연속 구간 교차 검사를 적용했다. 반경이 선형 변화하는 구간의
최소 이격은 볼록 1차원 수치 최소화로, 고정 반경은 해석식으로 계산한다.

## 2. 공정한 기준선과 병목 진단

평지 참고와 별도로 DEM 완전정보 기준선을 추가했다. 같은 DEM, 속도·부하·보행 비용,
6초 지연, 자원·고정 예비량, 후보 경로 집합, 30초 계획 범위를 사용하고 미래 회오리 궤적만 정확히 안다.
이 기준선 역시 제한된 후보 중 선택하므로 전역 최적해나 물리적 회피 가능성의 상한이라고 부르지 않는다.
귀환은 정적 귀환 경로의 예산 가능성이다. 기지 도착까지 실제로 회피하며 복귀한 검증은 아니다.

12개 진단의 단계 비교: 평지·완전정보·즉시 이동 9/12 무접촉 → DEM 8/12 →
동일 6초 지연 7/12 → 추정정보 6/12. 45초로 계획 범위를 늘리면 5/12로 낮아졌다.
목적지 진행 이득 때문에 피할 수 있는 후보를 버린다는 가설은 이번 후보 감사에서 확인되지 않았다.
따라서 그 가설을 확인된 버그라고 주장하지 않는다.

수정한 병목은 **짧은 이력에 따른 속도 추정 잡음**이다. 기존 3점 회귀를 5점 회귀로 바꾸되,
시작할 때는 사용 가능한 3점으로 시작해 지연을 늘리지 않았다. 반경 추정 방식, 지형 비용, 가중치,
계획 범위와 후보 방향은 고정했다. 긴 이력이 회전 반응을 늦출 수 있으므로 회전 조건도 유지했다.
연속 접촉 비용만 바꾼 진단과 5점 추정까지 바꾼 진단을 분리 보존했다.
같은 새 추정기를 쓰는 Dynamic 통제군도 추가했다.

## 3. 변경 전 고정한 평가: 36사례 × 6모델 = 216회

두 Jezero DEM, 보행 0.4/0.6/0.9m/s, 방향·횡거리, 12/28/50초 경고, 반경 증가,
24초 시점의 ±20도 방향 전환과 내부 시작 2건을 포함한다. 성장과 회전은 합성 가정이다.
사례별 같은 잡음 관측과 자원을 사용했고 설정 동결 뒤 한 번 실행했다. 결과에 맞춰 재조정하지 않았다.

{comparison_table()}

v5 평균 접촉시간 변화: v4 대비 {abs(gain(v4)):.1f}% {'감소' if gain(v4)>=0 else '증가'}, 동일 추정기의 Dynamic 대비 {gain(dyn):.1f}% 감소,
정적 모델 대비 {gain(base):.1f}% 감소. v5는 대피 성능 개선 판정을 통과하지 못해 기본 설정으로 승격하지 않고 XR의 실험용 비교 프로필로만 제공한다.
사례별 v4보다 접촉 감소 {sum(r['exposureDelta']< -1e-8 for r in pair_rows)}건,
증가 {sum(r['exposureDelta']>1e-8 for r in pair_rows)}건, 나머지 동률이다.
전체 무접촉 수에는 원래 비껴가는 경우와 내부 시작이 포함되므로 직격 조건 열을 함께 제시한다.
최소 이격의 음수는 설정한 경계 안으로 들어간 깊이다. 평균 개선만으로 최악 조건 개선을 주장하지 않는다.

![평가 결과](results.png)

{chr(10).join(sub)}

하위 조건은 서로 겹칠 수 있다. 독립적인 사건 확률·실제 사고율·부상률로 해석하지 않는다.

## 4. 예측 오차와 실패 기록

{chr(10).join(prediction)}

위 오차는 알려진 합성 궤적에 대한 지상좌표 오차다. 실제 영상의 미터 단위 위치 정답이나
실제 센서 정확도가 개선됐다는 의미가 아니다. 반복 예측 창은 상관되어 있다.
반경 방식은 그대로 유지했으므로 크기 예측 개선을 주장하지 않는다.

모든 실패를 `failures.json`에 저장했다. 감지, 추정 준비, 최초 계획, 최초 이동 시각;
연속 접촉 시작·종료; 최소 이격; 시간별 위치·행동·관측 시각·계획 소요;
현재와 최소 귀환 여유; 전체 실행 궤적이 포함된다. 완전정보 기준선도 접촉한 경우는
'이 후보 탐색에서도 실패'라고만 표시하며 대피 불가능으로 단정하지 않는다.

## 5. 같은 사례별 비교

{chr(10).join(paired)}

정밀 값과 모든 지표는 `public/data/hazards/escape-v5/paired-cases.csv`에 있으며,
단계별 진단 CSV는 `diagnostic-pairs.csv`다. 전체 원시 로그는 `holdout.json`이다.

## 6. 경로·XR 적용 범위

기존 16방향·2거리·0/4/8초 출발 후보와 DEM A* 연결을 재사용한다. 각 후보의 예상 접촉시간,
불확실성 비용, 지반 위험, 이동거리와 귀환 예산을 평가하고 2초만 실행한 뒤 새 관측으로 다시 선택한다.
무접촉이 불가능한 경우에도 접촉을 줄이는 경로를 비교한다. 최적이라는 표현은 이 후보 집합과 비용
안에서만 성립하며 모든 연속 경로의 전역 최적해를 뜻하지 않는다.
XR와 Mission Control은 같은 선택 경로와 계산된 접촉·이격·귀환 여유를 사용한다.
HUD 도착시간은 정지 위치의 불확실성 경계 도착으로 표시하여 중심 도착과 혼동하지 않게 했다.
v5 설정 파일의 상태는 EXPERIMENTAL_SIMULATION_ONLY다.

재현: `node scripts/run_escape_v5.mjs diagnose`, `cost-diagnose`, `improvement-diagnose`,
`freeze`, `test` 순서. 기존 결과가 있으면 덮어쓰지 않고 중단한다. 처음부터 재현하려면
별도 체크아웃/출력 디렉터리를 사용한다. `scripts/freeze_escape_v5.py`가 사전 시나리오와
이전 결과 해시를 고정한다. 그림 의존성은 `scripts/requirements-local-dust.txt`다.
'''
(out/'report.md').write_text(text,encoding='utf8')
print(json.dumps({'summary':h['summary'],'pairedGains':sum(r['exposureDelta']< -1e-8 for r in pair_rows),'pairedLosses':sum(r['exposureDelta']>1e-8 for r in pair_rows)},indent=2))
