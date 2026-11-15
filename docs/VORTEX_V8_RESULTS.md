# MARS SHIFT v8 — abrupt local dust-devil encounters

## Outcome / 결과

새로운 급발생 실험과 네 추정기를 구현하고, 첫 54개 검증 및 별도 72개 소형 회오리 거리 실험을 수행했다. 72개에서 정적 경로 대비 평균 접촉 시간이 33.8%, 이동 예측만 적용한 경로 대비 11.5% 감소했다. 그러나 첫 54개에서는 감소가 작고 Nominal보다 나쁘다. HOLD 감소는 확인하지 못했다. 실제 현장에서 사용 가능한 정확도나 세계 최고 성능을 입증한 결과가 아니다.

## First frozen holdout — 54 synthetic cases

| Model | No contact | Mean contact (s) | Mean minimum clearance (m) | HOLD (s) | Return failures |
|---|---:|---:|---:|---:|---:|
| Static | 39/54 | 2.504 | 20.964 | 57.04 | 0 |
| Radial | 39/54 | 2.598 | 21.004 | 55.81 | 0 |
| Lateral | 39/54 | 2.440 | 21.052 | 56.56 | 0 |
| Nominal | 39/54 | 2.435 | 20.966 | 56.33 | 0 |
| MARS SHIFT | 39/54 | 2.447 | 20.941 | 56.19 | 0 |
| Oracle | 39/54 | 2.402 | 21.029 | 55.96 | 0 |

15개 정지 상태 위협 사례에서 모든 모델이 접촉했다. Oracle도 같은 제한된 후보군을 사용하므로, 이는 물리적으로 탈출이 불가능하다는 증명이 아니다. 근접·지연·좁은 Navcam 관측 범위의 한계가 섞여 있다. 이미 비껴가는 39개를 성공적인 회피로 세지 않는다.

## New confirmation — 72 small-vortex distance cases

| Model | No contact | Mean contact (s) | Mean minimum clearance (m) | HOLD (s) | Return failures |
|---|---:|---:|---:|---:|---:|
| Static | 40/72 | 3.258 | 1.085 | 54.50 | 0 |
| Radial | 44/72 | 2.638 | 1.684 | 57.61 | 0 |
| Lateral | 44/72 | 2.512 | 1.690 | 58.83 | 0 |
| Nominal | 45/72 | 2.437 | 1.603 | 58.75 | 0 |
| Oracle | 67/72 | 0.345 | 3.220 | 58.00 | 0 |
| MARS SHIFT | 47/72 | 2.158 | 1.965 | 61.00 | 0 |

첫 검증을 본 뒤 등록한 별도 실험이다. 9.13/18.87 m 회오리, 두 Jezero DEM, .4/.9 m/s 평지 설정, 다른 방향·시작점·잡음 시드를 사용했다. 거리 간격은 평지 하중 보정 참고식의 0.65/1/1.6배이며, 유리한 사례만 골라 첫 검증과 합치지 않았다. 60 m 회오리 및 좁은 Navcam 면적은 첫 검증에 남아 있다. 이 집합의 좋은 성능을 전체 화성 상황으로 일반화하지 않는다.

완전정보 기준선은 67/72 무접촉인데 선택 모델은 47/72다. 주된 남은 병목은 예상하지 못한 방향 변화와 관측 공백, 그리고 그 예측에 따른 피드백 결정이다. 실제 접촉한 사례 중 20개는 같은 후보군 Oracle이 피했다. 단순히 더 빠른 경로 탐색만으로 이 격차가 해소된다고 볼 근거는 없다.

## Fixed definitions and fair comparison

- 대상은 지역 먼지폭풍이 아니라 국지적인 먼지악마다. 관측된 광학 직경을 곧바로 피해 반경으로 주장하지 않는다.
- 합성 회오리는 T+10/20/30초에 작은 반경(최종값의 15%)으로 생기고 4초에 걸쳐 성장한다. 광학적으로 보이는 발생과 물리적 생성은 실제로 구분될 수 있다. 여기서는 명시적인 실험 가정이다.
- 우주비행사는 감지 전 지점에서 작업 중이다. 센서 표본시각+1초 처리시간, 2초 제어 주기에서 수신하고, 최초 수신 뒤 고정 반응 지연을 적용한다. 두 번째 수신 표본부터 속도 추정; 한 표본만 있으면 반응 지연 후 방사방향 후보를 허용한다.
- 센서는 가상 외부 위치 측정망이다. MEDA 기압 또는 단안 영상만으로 2D 위치를 아는 것으로 가정하지 않는다. 시야 가림은 명시적으로 모델링하지 않았고, 감지 지연/관측 공백만 스트레스 처리했다.
- 경고시간은 정지한 현재 위치에 예측 위험 **앞쪽 경계**가 처음 닿는 시각이다. 중심 도착 시각과 다르다.
- 접촉은 합성 물리 반경+1 m 여유 안쪽에 들어간 시간이다. 접선은 접촉 시간이 0이다. 보행 경로와 .25초 진실 궤적의 모든 절점에서 연속 구간 교차를 계산한다. 샘플 사이에 완전히 통과하는 빠른 사건도 검출한다. .25초 궤적 자체는 물리 연속 유동의 수렴 증명이 아닌 정의된 합성 정답이다.
- 모든 모델이 동일한 지지 가능한 DEM 그래프·경사·모서리 장애물·속도·12 kg 하중·자원(520초 산소/배터리, 각각 104초 고정 예비량, 임무 420초)을 사용한다. 산소/배터리 소모율은 1.12/1.06이다. Mars EVA 보행 실측이 아니라 가정이다.
- 48초 후보 경로, 2초 재계획, 16방향×3거리 수준과 2/6초 대기 후보. 이동은 지형 그래프의 최단 연결 경로를 사용한다. 임의의 모든 굴곡 경로를 탐색하는 전역 최적 SIPP가 아니다. 기존 v7 시간 확장 탐색은 그대로 보존했다.
- Static도 같은 감지/반응/자원 조건을 적용한다. Radial/Lateral은 명목 경로 위협 시 같은 지형 후보 중 방향 규칙을 적용한다. 모든 때에 강제로 방사방향으로 움직이는 모델은 아니다.
- Oracle은 감지 전 미래를 누설하지 않으며 감지 후에만 미래 진실을 사용한다. 같은 유한 후보군을 사용하는 참고선이지 전역 최적 경계가 아니다.
- 귀환점은 보호 시설이 아니다. 먼저 돌아와도 T+180초까지 노출 평가를 계속한다. 최대 T+360초까지 귀환을 확인한다. 넉넉한 예산에서 모두 성공했으므로 낮은 예산에서도 실패가 없다는 증거는 아니다.

## Predictor selection and failed improvement

최근 7개 강건 선형 회귀, 저잡음 CV Kalman, 고잡음 CV Kalman, 세 잡음 모드 IMM을 직접 비교했다. IMM은 모드 간 평균/공분산 혼합과 관측 우도 기반 확률 갱신을 구현했다. 알려진 모든 모델 중 최고라는 주장은 하지 않는다.

개발용 18개 조건에서 5/10/20초 예측 RMSE 평균으로 CV_SMOOTH를 선택했다(4.290 m; IMM 4.934; LOCAL7 5.084; responsive 12.070). 첫 별도 54개에서 선택 모델 14.916 m, IMM 14.033 m였다. 이 숫자는 타임스탬프 수정 후 `forecast-clockfix.json` / `forecast-holdout-clockfix.json`의 합성 자료이며, 수정 전 결과도 보존했다. 모델 선택은 수정 전 개발 자료에서 고정했으며 수정 후에도 개발 순위가 같았다. 관측 데이터에 대한 m 단위 정확도는 아니다. 새로운 기동 조건에서 개발 성능이 유지되지 않는다는 진단이다.

NASA의 기존 3개 실제 영상도 다시 측정했다. CV_SMOOTH 위치 RMSE는 PIA26074 1.93 px, PIA26528 11.71 px, PIA24039 22.50 px다. 이미 이전 버전에 사용한 영상이라 새로운 독립 검증으로 부르지 않는다. 1/2/3 프레임 앞 예측이며 영상마다 실제 선행시간이 다르다. 세 영상의 오차를 m로 변환하거나 153개 예측을 153개 독립 사건으로 세지 않는다. 일부 이론적 95% 구간의 실제 포괄률은 매우 낮다. UI의 1σ 외피도 보정된 확률이나 보장이 아니다.

확인한 병목 하나는 불확실성 비용이 명목 접촉을 희생할 수 있다는 점이었다. 원래 허용치 .5초를 0초로 줄이는 수정안을 새 72개 조건 전에 고정해 비교했다. 결과는 평균 2.160429초 대 기존 2.157798초로 개선되지 않았다. HOLD도 같았다. 따라서 더 엄격한 수정안을 성공으로 포장하지 않고 원래 .5초 설정을 XR에 유지했다.

HOLD 집계는 반응 지연 이후의 모든 정지를 포함해 목표점/귀환점 대기와 자발적 대기가 섞여 있다. `avoidable=0`은 정적 경로가 접촉·외피 접촉 모두 더 나쁘지 않은지 검사하는 좁은 지표일 뿐 모든 정지가 필요했다는 증거가 아니다. 통합 모델의 HOLD가 61.00초로 Nominal의 58.75초보다 많다. 요구한 HOLD 감소는 아직 달성하지 못했다.

## New real data and scientific basis

1. [Toledo et al. 2023, MEDA-RDS terrestrial field validation](https://www.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2023.1221726/full), [published data](https://doi.org/10.5281/zenodo.7930641): 원본 16개 파일을 새로 확보하고 SHA256/크기/라이선스를 기록했다. Botswana 6일 바람 시계열과 광학 신호이며, 공개 묶음에는 연속 2D 중심 정답 궤적이 없다. 1–3일/4–6일을 분리했다. 바람 방향 변화와 정규화된 속도를 합성 회오리에 적용한 것은 지상 유사환경 스트레스 가정이며 화성 실측이나 바람=회오리 이동이라는 검증이 아니다. 현재 공개된 18개 광학 사건을 모두 궤적으로 재구성했다고 주장하지 않는다.
2. [Bickel et al. 2025](https://www.science.org/doi/10.1126/sciadv.adw5170): 1,039 검출/373 이동 추정, 초~분 규모 변동을 보고한다. 궤도 해상도에 따른 큰 회오리 표본이므로 작은 9 m 회오리의 고빈도 정답 대신 쓰지 않았다. 27° 방향 변동 통계를 작은 회오리의 검증된 회전 법칙으로 넣지 않았다.
3. [Newman et al. 2022, Jezero atmosphere](https://pmc.ncbi.nlm.nih.gov/articles/PMC9132482/) 및 [Hueso et al. 2023](https://doi.org/10.1029/2022JE007516): 실제 Jezero 배경과 출처가 있는 크기/이동 속도의 근거다. MEDA의 1 Hz 기압·바람이 곧 원격 회오리의 1 Hz 2D 궤적은 아니다.
4. [Phillips & Likhachev 2011, SIPP](https://www.cs.cmu.edu/~maxim/files/sipp_icra11.pdf), [Fiorini & Shiller 1998, velocity obstacles](https://doi.org/10.1177/027836499801700706): 시간에 따른 충돌 검사 및 이동 가능한 속도/경로 중 선택의 근거다. 예측이 틀려도 최적성·안전성이 유지되는 정리가 아니다.
5. [FilterPy IMM reference](https://filterpy.readthedocs.io/en/latest/kalman/IMMEstimator.html): 모드 혼합/우도 갱신 수학의 참고. 구현은 독립 작성했다. 자동차·항공 추적에서 쓰인 방법을 화성에서 최고라고 주장하지 않는다.
6. [Jackson et al. 2015, dune effect](https://pmc.ncbi.nlm.nih.gov/articles/PMC4667610/): 지형이 바람을 바꿀 수 있다는 근거와 개별 작은 회오리의 경로 예측 정확도는 다르다. 검증된 지역 풍장이 없으므로 바위 옆의 꺾임을 관측 사실처럼 생성하지 않는다. 여기서 DEM은 보행 가능성과 이동 시간에 직접 반영된다.

중심에서 멀어지는 방향과 회오리 진행 속도의 반대 방향은 다르다. 빠른 정면 접근에서는 옆/비스듬한 이동이 더 짧은 시간에 통과 띠를 벗어나게 할 수 있다. 평지의 일정 원형 회오리, 속도 v>u, 반응 L, 여유 포함 반경 R에서 무접촉 가능한 초기 앞쪽 간격은 G≥vL+R(v/u−1). 중심 도착 기준 시간은 L+R/u, 앞쪽 경계 기준은 L+R/u−R/v다. 불규칙 기동이나 장애물이 있는 경우 이 식은 참고식이며 경로 엔진을 대신하지 않는다.

## Provenance, timing, and reproducibility

`protocol.json`은 최초 초안이고 지형/기동 유형의 결합을 결과 계산 전에 수정한 `protocol-final.json`이 실제 54개 검증 기준이다. `protocol-confirmation.json`은 후속 72개를 경로 수정 전에 고정한 파일이다. 원본 `holdout.json`, `confirmation.json`을 보존했다. 바람 행 번호를 초로 취급하던 오류를 실제 타임스탬프의 선형 보간/각도 최단 회전으로 수정하고, 전부 `*-clockfix.json`으로 재실행했다. 자료 생성 과정 수정이며 새로운 독립 시험은 아니다. 이어 Lateral 기준선이 같은 쪽 종점 두 개를 고를 수 있는 문제를 수정해 양쪽 수직 방향을 각각 비교하도록 만들었다. 회귀 테스트를 추가하고 모든 모델을 `*-final.json`으로 다시 실행했다. 변경되지 않은 모델의 결과는 직전 실행과 일치한다. 이전 v4–v7 결과는 변경하지 않았다.

현재 선택 모델의 모든 재계획 호출 p95: 첫 검증 2.89 ms, 거리 실험 3.15 ms. 개발 컴퓨터에서 병렬 평가 중 측정한 값이며 XR 장비 시간 보장이 아니다. 전원/최초 로딩 비용은 포함하지 않는다. 1초 처리 예산은 모든 모델에 동일한 실험 가정이다.

각 `final/paired-*.csv`와 `final/failures-*.json`에 발생·감지·추정 준비·계획·이동 시작, 접촉 구간, 최소 이격거리, 귀환 여유와 결정을 기록했다. `diagnostics.json`은 사례별 승/패/동률과 기동 유형별 값을 보존한다. 기존 7,200 조건 역시 합성 조합이며 독립적인 실제 관측이 아니다.

```powershell
..\research\.venv-hazards\Scripts\python.exe -X utf8 scripts/acquire_vortex_v8.py
node scripts/run_vortex_v8.mjs forecast -rerun
node scripts/run_vortex_v8.mjs holdout -rerun
node scripts/run_vortex_v8.mjs confirmation -rerun
node scripts/run_vortex_v8.mjs images -rerun
node node_modules/vitest/vitest.mjs run --testTimeout=15000
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
node scripts/package_navcam_assets.mjs
```

출력은 덮어쓰기 금지다. 이미 받아둔 acquisition 파일이 있으면 재취득 명령도 중단한다. 재평가에서는 원래 `forecast.json`과 `policy-selection.json`을 읽어 설정을 바꾸지 않는다. 그림과 CSV는 원본 결과에서 생성되며 실제 부상률·우주복 피해·장비 안전성은 모델 범위가 아니다.
