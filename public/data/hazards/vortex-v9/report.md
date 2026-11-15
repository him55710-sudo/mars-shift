# V9 critical verification — PROMOTION GATE FAILED

기존 결과는 보존했습니다. 아래는 개발 18개 합성 사건/54개 배치로 선택하고, 새 36개 합성 사건/108개 배치에서 한 번 평가한 결과입니다. 실제 독립 관측 108개가 아닙니다.

| 모델 | 무접촉 | 평균 접촉(s) | 위험 접근 중 HOLD(s) | 귀환 실패 | 계획 거부 사례 | p95(ms) |
|---|---:|---:|---:|---:|---:|---:|
| Static | 80/108 | 2.2255 | 0.556 | 0 | 54 | 2.52 |
| V8-Nominal | 82/108 | 1.6287 | 0.148 | 0 | 54 | 2.95 |
| V8-MARS | 84/108 | 1.4354 | 0.130 | 0 | 54 | 3.27 |
| SIPP-Nominal | 79/108 | 1.7137 | 0.093 | 0 | 54 | 8.14 |
| SIPP-Uncertainty | 83/108 | 1.4401 | 0.000 | 0 | 54 | 8.28 |
| SIPP-Oracle | 91/108 | 0.9458 | 0.000 | 0 | 54 | 7.28 |

## Paired comparisons

| 후보 / 비교 | 접촉 감소 | 사건 묶음 bootstrap 95% 범위 | 개선/악화/동일 배치 |
|---|---:|---:|---:|
| V8-MARS / Static | 35.5% | 15.7% ~ 52.0% | 24/4/80 |
| V8-MARS / V8-Nominal | 11.9% | 4.6% ~ 20.8% | 14/1/93 |
| SIPP-Nominal / Static | 23.0% | 7.7% ~ 35.1% | 22/6/80 |
| SIPP-Nominal / V8-Nominal | -5.2% | -18.2% ~ 2.9% | 16/9/83 |
| SIPP-Uncertainty / Static | 35.3% | 16.6% ~ 51.2% | 26/2/80 |
| SIPP-Uncertainty / SIPP-Nominal | 16.0% | 6.4% ~ 27.8% | 17/6/85 |

## 사전 고정 승격 기준

강한 SIPP 기준선 대비 접촉 20% 이상 감소, 묶음 bootstrap 개선 하한 > 0, 무접촉률 5%p 이상 증가, 귀환 실패·계획 자원 위반·위험 접근 중 HOLD 증가 없음, p95 계산 < 100 ms. 프로젝트 목표이며 안전 기준이 아닙니다.

- contactMagnitude: FAIL
- clusteredGain: PASS
- noContactGain: FAIL
- returnNonInferiority: PASS
- planningBudgetNonInferiority: PASS
- activeHoldNonInferiority: PASS
- latency: PASS

개발 단계 선택: nominal=IMM, uncertainty=LOCAL7 + 0.5σ. 평가 후 재선택하지 않았습니다.

## 해석과 한계

- 이전 72개 실험은 bearing과 motion family가 묶였고 wind 재생은 day 4 하나만 사용했습니다. 따라서 33.8% 감소를 일반적 우위로 해석하지 않습니다.
- 새 실험은 모든 사건에 세 bearing을 교차했습니다. 두 DEM × 세 직경/속도 × 세 합성 이동 유형을 모두 포함합니다. 사건별 새로운 truthSeed를 쓰며 sensorSeed와 구분합니다.
- 36개 묶음의 bootstrap은 고정한 생성기와 재사용한 6개 지구 바람 창에 조건부입니다. 화성 실제 사건 모집단에 대한 신뢰구간이 아닙니다. 부차 비교와 하위군은 탐색적입니다.
- 동일 DEM/속도/반응/자원으로 비교합니다. Oracle은 동일 SIPP 탐색과 감지 시각에서 미래 궤적만 받습니다. 완전정보 성능도 물리적 최적해나 회피 불가능성 증명은 아닙니다.
- SIPP는 안전 시간 구간마다 가장 빠른 도착을 유지하고, 기다림과 이동을 연속 교차 검사합니다. 0.5초 출발 격자/48초 지평/20,000 상태 제한이며, 경로가 없으면 동일 v8 노출 최소화 후보 집합으로 돌아갑니다.
- contact는 회오리 반경 + 1m 내부에 머문 시간입니다. 경고시간은 정지한 우주비행사에 대한 앞쪽 위험 경계 진입 기준입니다. 가상 센서 처리 1초 + 제어 주기 양자화 + 반응 6초를 적용합니다.
- HOLD 총량은 목표점 대기를 포함합니다. activeHold는 이동 가능 시각 이후 현재 위치를 48초 유지하면 합성 정답 궤적과 접촉하는 대기입니다. 이를 곧바로 불필요한 HOLD라고 해석할 수 없습니다.
- raw budgetViolation은 NO FEASIBLE ROUTE 발생 기록입니다. 실제 자원 고갈과 다릅니다. 330초 예산에서는 평가 종료보다 긴 48초 계획 지평 때문에 계획 거부가 발생할 수 있습니다. summary.json은 actualReserveViolations를 별도 계산합니다.
- 관측 화성 크기/평균 속도와 실제 DEM을 재사용했지만 이동 경로·급선회·성장은 합성입니다. 지형이 보행을 제한할 뿐 회오리 궤적을 굽히는 검증된 CFD는 없습니다.
- 실제 화성 신규 고빈도 2D 위치/직경 정답을 추가 확보하지 못했습니다. 지구 바람은 그런 정답의 대체물이 아닙니다. 실제 NASA 3개 영상은 이미 검토한 자료이므로 독립 검증으로 재포장하지 않았습니다.
- 모든 비교군이 같은 보행 지형 비용을 쓰므로 이 실험은 별도 Sand Trap 엔진의 효과를 입증하지 않습니다. 0.5σ 역시 보정된 확률 신뢰영역이 아닙니다.
- 실행시간은 현재 데스크톱 측정입니다. 일부 구간은 자동 테스트와 동시에 실행됐으며 실시간 최악시간 보장이 아닙니다.
- 기존 7,200개 조건도 합성 조합입니다. 실제 안전 보장, 부상률, 최고의 예측 모델이라는 주장은 하지 않습니다.

불확실성 후보의 접촉 실패 25개 중 완전정보 SIPP가 피한 사례는 8개입니다. 개별 시각·접촉 구간·최소 이격·귀환 여유는 failures.json에 기록했습니다.

## 근거

- [Phillips & Likhachev 2011 — SIPP](https://www.cs.cmu.edu/~maxim/files/sipp_icra11.pdf): 안전 구간 탐색의 근거. 불확실한 실제 먼지악마에 대한 안전 증명은 아닙니다.
- [Cawley & Talbot 2010](https://www.jmlr.org/papers/v11/cawley10a.html): 모델 선택 자체의 과적합과 편향. 선택/평가 분리의 근거.
- [Roberts et al. 2017](https://onlinelibrary.wiley.com/doi/full/10.1111/ecog.02881): 구조적 의존성이 있는 데이터의 분리 평가.
- [Toledo et al. 2023](https://www.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2023.1221726/full), [공개 데이터](https://doi.org/10.5281/zenodo.7930641): 지구 먼지악마 현장 계측. 2D 화성 궤적은 아님.
- [Hueso et al. 2023](https://doi.org/10.1029/2022JE007516): 기존 MEDA 기반 추정 크기·속도 출처.
- [Bickel et al. 2025](https://www.science.org/doi/10.1126/sciadv.adw5170): 화성 먼지악마 이동 변동의 관측 근거. 이 실험의 작은 회오리 확률분포를 직접 결정하지 않음.

이번 방법론 검색: Exa 결과 10개 검토, 주요 원문 3개 확인. 기존 물리 자료와 코드는 그대로 유지했습니다.

재현: `node scripts/run_vortex_v9.mjs development`, `node scripts/run_vortex_v9.mjs holdout`, `python scripts/report_vortex_v9.py`. 결과 파일 존재 시 덮어쓰기를 거부합니다. 재실행은 별도 출력 디렉터리/복사본에서 수행해야 합니다.
