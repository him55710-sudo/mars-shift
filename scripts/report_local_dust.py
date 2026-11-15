"""Render results without selecting or tuning any model after held-out evaluation."""
import json
from pathlib import Path
root=Path('public/data/hazards')
report=json.loads((root/'v4-evaluation.json').read_text(encoding='utf8'))
prediction=json.loads((root/'v4-prediction.json').read_text(encoding='utf8'))
models=report['byModel']; m=models['MARS SHIFT']
rows=['| 모델 | 노출 초/사건 | 불필요 HOLD 초 | 복귀 예산 실패 | 지형 위반 | 재계산 p95 |','|---|---:|---:|---:|---:|---:|']
for name,r in models.items():rows.append(f"| {name} | {r['exposureSeconds']:.3f} | {r['unnecessaryHoldSeconds']:.3f} | {r['episodes']-r['returnFeasibleEpisodes']}/{r['episodes']} | {r['constraintViolations']} | {r['replanMs']['p95']:.1f} ms |")
pred=['| 사건 | 추정기 | 중심 RMSE px | 겉보기 폭 MAE px | 좌우 방향 일치 |','|---|---|---:|---:|---:|']
for r in prediction['results']:
 if r['method'] in ['legacy-kalman','robust']:pred.append(f"| {r['event']} | {r['method']} | {r['positionRMSEpx']:.2f} | {r['apparentWidthMAEpx']:.2f} | {100*r['directionSignAccuracy']:.1f}% |")
reductions={n:100*(1-m['exposureSeconds']/models[n]['exposureSeconds']) for n in ['Baseline','Dynamic']}
text=f'''# 근거리 먼지악마 v4 검증 — 2026-11-15

558 km는 일 단위 **지역 폭풍**의 중심 예측 오차였다. 수십 m 회오리 회피에 사용할 수 없으며,
이번 근거리 예측기·대피 시험·XR 기본 장면에서는 해당 MDAD 데이터를 사용하지 않는다.
이번 결과도 실제 우주비행사 운용 검증에 도달하지 않았다. 관측 영상의 2D 지상 정답이 없고,
사건 두 개의 영상 시험에서 위치·방향·폭 정확도 향상이 일관되지 않았다.

## 실제로 확보한 자료

- [Bickel et al. 2025 공개 데이터](https://doi.org/10.48620/87803): 전문가 확인 1,039개 탐지 CSV 및 1,039개 썸네일 ZIP.
  위치 이동 속도와 크기가 함께 있는 373행 사용(개발 278, 시험 95). 선택된 행의 직경 18.23–337.40 m,
  이동 속도 0.93–43.92 m/s. 전후 시각의 좌표열이 아니라 탐지별 평균 속도/방향이다.
  HRSC 원래 촬영 간격은 대략 9–19 s, CaSSIS 색 프린지법은 약 1 s 규모지만 공개 CSV에서
  원래의 모든 시각별 좌표가 제공되는 것은 아니다.
- [Jezero PIA26074](https://science.nasa.gov/resource/martian-whirlwind-takes-the-thorofare/): 21프레임, 4 s 간격,
  발표 직경 약 60 m, 이동 속도 19 km/h. **개발 사건**.
- [Jezero PIA26528](https://science.nasa.gov/photojournal/perserverance-captures-crater-rim-dust-devil-eating-its-own/):
  21프레임, 약 6 s 간격, 큰 회오리 약 65 m, 작은 회오리 약 5 m, 큰 회오리 약 1 m/s. 합쳐지는 사건. **시험 사건**.
- [Gale PIA24039](https://science.nasa.gov/photojournal/curiosity-spots-a-dust-devil-in-the-hills/): 21프레임, 총 255 s,
  직경 약 5 m. 개별 시각이 없어 **균등 12.75 s를 가정**. **시험 사건**.
- [Guzewich et al. 데이터](https://doi.org/10.5281/zenodo.8344947)의 CSV 3개도 확보하고 공식 MD5를 확인했다.
  Sol별 좌표/관측 순서 정보만으로 개별 회오리의 고빈도 궤적을 만들 수 없어 궤적 정답으로 사용하지 않았다.

원본은 `../data-cache/hazards`, 파생 측정과 SHA-256은 `public/data/hazards/local-observations.json`.
Bickel CSV MD5 `83636c21f762a42de1d669680b1f2127`, ZIP MD5 `8b83cb46939ec8fa8e95cb457e07cc63` 일치.
저장소 CC-BY-NC-SA 4.0과 ReadMe의 CC-BY 표기가 달라 출처 등록부에 양쪽을 보존했다.

## 10–280 m의 의미

[Reiss et al. 2014](https://web.lmd.jussieu.fr/~aspiga/pub/REF/2014Icar..227....8R.pdf)의 관측 표본 직경은 15–280 m다.
[Spirit 관측 연구](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2006JE002743)는 2–276 m,
대부분 10–20 m를 보고했다. **직경**이며 반지름, 인명 피해 범위 또는 모든 먼지악마의 최대 크기가 아니다.
영상에서 보이는 먼지 기둥의 폭과 실제 바람 위험 경계도 같다고 입증되지 않았다.

## 영상 예측: 개선과 실패를 함께 공개

각 프레임에서만 수평 공간 필터와 고정 ROI로 중심·반치폭(FWHM)을 측정했다.
미래 프레임을 이용한 배경 제거는 하지 않았다. ROI는 사람이 정한 측정 영역으로 자동 탐지 성능 검증이 아니다.
추정기는 과거 관측만 받고, 개발 사건으로 3/5/7점 창과 폭 last/median/linear 조합을 선택했다.
선택은 **최근 3점 Huber 가중 회귀, 마지막 폭 유지**, 과정 잡음 0.08. 시험을 본 뒤 변경하지 않았다.
비교군은 기존 Kalman, 마지막 위치 유지, 최근 두 점 등속도. 사건별 51개 예측(1/2/3프레임 앞).

{chr(10).join(pred)}

Gale에서는 위치 RMSE와 폭 MAE가 개선됐지만 Jezero 합체 사건에서는 악화됐다.
같은 영상에서 추출한 파생 측정치를 정답으로 삼은 조건부 결과다. 3D 위치 정확도나 독립적인 센서 오차가 아니다.
단안 영상은 거리·시선 방향 속도·지리적 방위각을 결정하지 못한다. 따라서 오차를 '몇 m'로 확정하지 않는다.
픽셀 관측을 미터 좌표로 직접 넣으면 경로 엔진이 안내를 거부하도록 자동 테스트를 추가했다.

## 동일 자원 제약의 대피 비교

개발: 8101–8124 × 3지형. 최종: **9101–9190 × 3지형 × 3모델 = 810회**.
개발/시험 카탈로그는 2022년 이전/이후, 촬영 group 중복을 검사했다. 영상도 사건 전체를 분리했다.
고정된 가중치는 `v4-frozen.json`, 추정기는 `v4-predictor-frozen.json`에 기록했다.

세 모델 모두 같은 추정기, 후보 은행(기존 지형 A*), 30 s 지평, 2 s 재계산,
0.4/0.6/0.9 m/s 보행 가정, 산소·배터리·임무 시간, 원래 예산의 고정 25% 예비량을 사용한다.
복귀 지도와 연속 위치 연결 비용, 복귀 우선 전환, 실행 2 s의 0.25 s 간격 자원 검사가 모두 공통이다.
Baseline은 정적 A* 지형 경로와 공통 자원 관리, Dynamic은 명목 이동 예측 비용,
MARS SHIFT는 추가 불확실성 비용(가중치 0.5)과 지반 선별 지수다.
따라서 과거 v3의 자원 관리 차이를 통합 모델의 우위로 계산하지 않는다.

{chr(10).join(rows)}

정적 대비 평균 노출 감소 **{reductions['Baseline']:.2f}%**, Dynamic 대비 **{reductions['Dynamic']:.2f}%**.
MARS SHIFT에서 여전히 {m['exposedEpisodes']}/{m['episodes']}회 접촉 노출이 남았다.
복귀 실패는 **세 모델 모두 0회**라서 통합 모델만 복귀 성공률을 높였다는 결론은 아니다.
불필요 HOLD는 Dynamic 0.667 s에서 통합 0.859 s로 증가했다. 이 항목은 개선하지 못했다.
이미 안쪽에 있던 사건의 평균 노출은 세 모델 모두 1.944 s로 동일했고, 방향 전환 사건에서는
통합 0.963 s가 Dynamic 0.889 s보다 나빴다. Dynamic 대비 전체 노출 개선분의 약 83.5%는
PIA26528 영상 형태를 근처에 배치한 oblique 사례에 집중된다. 큰 보편적 우위로 일반화할 수 없다.
280 m 초과 집단은 이번 배치에서 모두 무접촉이어서 큰 회오리 직격 회피 성능을 입증하지 못한다.
사전 기준: `{json.dumps(report['targets'],ensure_ascii=False)}`.
노출 차이(MARS−비교군)의 seed-cluster bootstrap:
`{json.dumps(report['contrasts'],ensure_ascii=False)}`.
이 구간은 이 시뮬레이션 분포에 조건부이며 실제 화성의 모든 사건에 대한 신뢰구간이 아니다.
사건·직경별 결과, 관통 깊이 적분, 재진입, 최초 이탈, 경로 길이, 복귀 실패를 JSON/CSV에 모두 보존했다.

### 달라진 점과 남는 제한

- 과거의 과도한 HOLD: 불확실성 영역과 이미 겹치면 모든 출발 경로를 탈락시키던 경성 제약,
  짧은 후보 경로, 복귀 비용 반올림 때문에 행동이 막히거나 바뀌었다. 접촉이 불가피하면
  예상 접촉 시간·깊이를 줄이는 후보를 선택하고 XR 경로를 유지한다. 위험에서 벗어났다고 표시하지 않는다.
- 고정 예비량과 연속 위치 복귀 비용을 전 모델에 적용했다. 예산이 부족하면 명확히 실패로 표시한다.
  30 s 이후의 복귀 확인은 **정적 지형·자원**에 한정되고 미래 먼지 회피까지 보증하지 않는다.
- 카탈로그 속도/직경은 실제 관측값이지만 우주비행사 근처 배치와 2D 센서는 가상이다.
  영상 이동의 형태를 회전·확대하여 재생한 것도 반사실적 시뮬레이션이다.
  발표 평균 속도(없으면 발표 직경/초기 겉보기 폭)로 변환한 배율은 실제 지상 궤적 보정이 아니다.
- 실제 영상은 4 s/~6 s/가정 12.75 s 간격이다. 대피 시뮬레이션의 2 s, 0.6 또는 2 m 위치 잡음은 센서 가정이다.
  MEDA 한 지점의 풍속만으로 주변 회오리의 2D 위치를 관측할 수 있다고 주장하지 않는다.
- 노출은 숨겨진 시뮬레이션 원형 경계와 0.25 s 중간점 적분으로 평가했다. 매우 빠르거나 작은 회오리의
  접촉 시간에는 시간 이산화 오차가 남는다. 크기 경계는 인체 피해/우주복 손상을 의미하지 않는다.
- HOLD 필요성 평가는 동일 시점의 정적 후보가 미래 30 s를 무접촉으로 통과하는지 보는 사후 지표다.
  임무 완료 후 HOLD와 기하적으로 모든 대안이 같은 상황을 완벽히 분류하지 못한다.
- 사전 지형 풍장이나 검증된 Jezero CFD 벡터장을 새로 확보하지 못했다. 지형 바람 보정은 이번 시험에서 사용하지 않았다.
- 재계산 시간은 이 컴퓨터에서 측정한 값이고 일부 구간은 테스트/브라우저가 함께 실행됐다. 장비 지연 상한은 아니다.

## XR 반영

`/hazards`는 약 65 m Jezero 관측 영상 형태를 근처에 가상 배치한 장면으로 시작한다.
헬멧·관제 지도는 같은 frame과 경로를 공유한다. 직경·속도·관측 경과·접근 시간·자원·다음 행동을 표시한다.
실제 이미지 예측 실패와 동일 자원 비교표를 Evidence & results에서 확인할 수 있다.
지역 폭풍 자료는 별도 접힌 항목이다. 이 실험만으로 실제 화성 현장 운용 가능 판정을 내리지 않는다.

## 재현

```powershell
../research/.venv-hazards/Scripts/python.exe scripts/acquire_local_dust.py
node scripts/run_local_dust.mjs prediction-dev
node scripts/run_local_dust.mjs prediction-test
node scripts/run_local_navigation.mjs dev
node scripts/run_local_navigation.mjs test
python -X utf8 scripts/report_local_dust.py
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

검증 로그는 `../research/hazard-v4-*.log`. 기존 v1–v3 결과는 보존했다.

확인 완료: Vitest **19파일 / 190테스트 통과**, TypeScript 검사 통과, Vite 프로덕션 빌드 통과.
프로토콜·계산 코드 해시가 평가 산출물과 일치한다. 브라우저에서 빌드된 `/hazards`의
2 s 갱신, 같은 frame 번호의 헬멧/관제 지도, 이미 내부에 있을 때 경고와 경로 유지,
v4 비교표와 실제 영상 예측 실패 표시를 확인했다. 최종 탭의 콘솔 오류는 없었다.
화면 기록: `../research/hazard-v4-xr.jpg`. 로컬 미리보기: http://127.0.0.1:5187/hazards
'''
Path('docs/LOCAL_DUST_V4_RESULTS.md').write_text(text,encoding='utf8')
print(json.dumps({'reductions':reductions,'targets':report['targets']},ensure_ascii=False))
