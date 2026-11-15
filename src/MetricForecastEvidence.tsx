import type {TrackerConfig} from './adaptive-tracker-v13';
export type AdaptiveEvidence={
 selection:{selected:string;config:TrackerConfig;covarianceScale:number};
 observed:{positionRMSE:number;rangeMAE:number};
 confirmation:{summary:{model:string;rmse:number;coverage:number|null}[]};
 escape:{promotion:boolean;summary:{arm:string;exposure:number;returnFailures:number}[]};
 guard:{promotion:boolean;summary:{arm:string;exposure:number;returnFailures:number;noContact:number;p95Ms:number}[]};
};
export function MetricForecastEvidence({evidence:e,language='ko'}:{evidence:AdaptiveEvidence;language?:'en'|'ko'}){
 const old=e.confirmation.summary.find(s=>s.model==='IMM_V8')!,now=e.confirmation.summary.find(s=>s.model==='ADAPTIVE')!;
 const before=e.escape.summary.find(s=>s.arm==='MARS SHIFT')!,after=e.escape.summary.find(s=>s.arm==='Adaptive')!;
 if(language==='en')return <div className="metric-upgrade-evidence"><h3>v13 · covariance-aware tracking</h3><p>Range/bearing correlation, cadence, large residuals and dropouts enter the tracker. Forecasts use only observations already delivered.</p><dl><div><dt>Synthetic confirmation</dt><dd>192 cases · 0 independent observed events</dd></div><div><dt>Previous IMM → adaptive RMSE</dt><dd>{old.rmse.toFixed(2)} → {now.rmse.toFixed(2)} m</dd></div><div><dt>Nominal 95% region coverage</dt><dd>{(100*(now.coverage??0)).toFixed(1)}% · synthetic</dd></div></dl><p>Stops, restarts and abrupt reversals remain difficult. Synthetic calibration still under-covers the confirmation set. That calibration multiplier is not transferred to this observed reconstruction.</p><h3>Prediction gain does not imply escape gain</h3><p>In 24 earlier matched synthetic escape cases, mean contact was {before.exposure.toFixed(3)} → {after.exposure.toFixed(3)} s; return failures were {before.returnFailures} and {after.returnFailures}. This is a separate experiment from the 36-case guard comparison.</p><h3>Follow-up: two forecasts screen each route</h3><p>The guard accepts alternatives only when neither forecast increases predicted contact. In 36 fixed synthetic cases: previous 2.482 s, guarded 2.480 s, Static 2.761 s. All had zero return failures and unnecessary HOLD. The additional gain is small; this is not operational EVA validation.</p><a href="/data/review-v15/methods.md">English methods, sources and limits ↗</a></div>;
 return <div className="metric-upgrade-evidence"><h3>v13 · 전체 공분산 추적</h3>
  <p>거리·방위 오차의 상관관계, 관측 간격, 큰 잔차, 센서 누락을 처리합니다. 이전 관측만 사용해 화면의 예측과 타원을 계산합니다.</p>
  <dl><div><dt>새 합성 궤적</dt><dd>192개 · 독립 실측 0개</dd></div><div><dt>기존 IMM → 새 추적 RMSE</dt><dd>{old.rmse.toFixed(2)} → {now.rmse.toFixed(2)}m</dd></div><div><dt>가정상 95% 타원의 실제 포함률</dt><dd>{(100*(now.coverage??0)).toFixed(1)}% · 합성 검증</dd></div></dl>
  <p>정지·재출발, 급반전에서 성능이 낮아집니다. 합성 개발 자료로 조정한 타원도 확인 자료의 95%를 포함하지 못했습니다. 실제 관측 화면에는 이 합성 보정 배율을 적용하지 않습니다.</p>
  <h3>예측 개선 ≠ 대피 개선</h3><p>동일 지형·자원으로 비교한 새 24개 합성 대피 사례에서 평균 접촉시간은 {before.exposure.toFixed(3)} → {after.exposure.toFixed(3)}초였습니다. 두 모델의 복귀 실패는 각각 {before.returnFailures}, {after.returnFailures}건입니다.</p>
  <p>{e.escape.promotion?'고정한 비교 기준 통과.':'대피 기본 모델 교체 기준 미통과. 기존 대피 엔진을 유지합니다.'} 이 화면은 실시간 추적 계산의 관측 재생이며 운용 대피 지시가 아닙니다.</p>
  <h3>후속 검증 · 두 예측으로 경로 비교</h3><p>단독 교체 대신 기존·새 예측 모두에서 접촉 위험이 악화되지 않는 대안만 채택합니다. 별도로 고정한 새 합성 배치 36개에서 평균 접촉시간은 기존 2.482초 → 결합 2.480초, 정적 모델은 2.761초였습니다. 개선 폭은 작습니다. 모두 복귀 실패 0건이며 실제 EVA 검증이 아닙니다.</p><p>{e.guard.promotion?'이 방식은 연구용 3D 시연에 반영했습니다.':'후속 비교 기준 미통과.'} 불필요한 HOLD는 이 비교에서 이미 0건이므로 추가 감소를 주장하지 않습니다.</p>
  <a href="/data/hazards/adaptive-v13/report.md" target="_blank" rel="noreferrer">v13 전체 비교·실패·검증 기록 ↗</a>
 </div>;
}
