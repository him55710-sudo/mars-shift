import {useEffect,useState} from 'react';
type Result={scope:string;events:number;cases:number;promoted:boolean;summary:Record<string,{noContact:number;meanContact:number;meanActiveHold:number;returnFailures:number;p95Ms:number}>};
const ROOT='/data/hazards/vortex-v9';
export default function CriticalVortexResults(){
  const [result,setResult]=useState<Result|null>(null),[error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();
    fetch(ROOT+'/summary.json',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('새 검증 결과를 불러올 수 없습니다.');return r.json();}).then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[]);
  return <section className="hz-evidence"><div><span className="hz-eyebrow">CRITICAL VALIDATION / FROZEN SYNTHETIC EVENTS</span>
    <h2>정적 경로보다 개선됐지만, 새 후보의 승격 기준은 미달했습니다.</h2>
    <p>개발용 18개 합성 사건으로 설정을 선택한 뒤, 새 36개 사건 × 3개 배치 = 108개 조건에서 평가했습니다. 같은 DEM·보행·감지·반응·자원 조건을 적용했습니다.</p>
    <p>기존 통합 모델의 평균 접촉시간은 정적 대비 35.5%, 기존 이동 예측 대비 11.9% 감소했습니다. 새 SIPP 후보는 기존 통합 모델보다 개선되지 않아 기본 XR 모델을 유지합니다.</p>
    <p>이전 72개 실험은 배치 방향과 이동 유형이 묶여 있었습니다. 아래의 새 비교와 구분해야 합니다. 실제 화성 고빈도 궤적 검증이나 안전 보장을 뜻하지 않습니다.</p>
    <a href="/hazards?lab=v9">SIPP 실험 모드 · 기본 모델과 별도</a><a href={ROOT+'/report.md'}>비판적 검토·방법·실패 분석</a><a href={ROOT+'/paired.csv'} download>108개 동일 사례 비교</a><a href={ROOT+'/protocol.json'}>사전 고정 조건</a>
  </div><div className="hz-table-wrap">{result?<><p role="status">{result.promoted?'승격 기준 통과':'승격 보류 · 기존 모델 유지'} · {result.events}개 합성 사건 / {result.cases}개 배치</p>
    <table><thead><tr><th>모델</th><th>무접촉</th><th>접촉/사례</th><th>접근 중 HOLD</th><th>귀환 실패</th></tr></thead><tbody>{Object.entries(result.summary).map(([name,r])=><tr key={name}><td>{name}</td><td>{r.noContact}/{result.cases}</td><td>{r.meanContact.toFixed(3)} s</td><td>{r.meanActiveHold.toFixed(3)} s</td><td>{r.returnFailures}</td></tr>)}</tbody></table></>:<p role="status">{error||'새 검증 결과를 불러오는 중…'}</p>}
    <p>새 SIPP 후보는 SIPP 기준선 대비 접촉 16.0% 감소, 무접촉률 +3.7%p로, 사전 목표 20%·5%p에 미달했습니다. 비교군의 추정기도 달라 불확실성만의 효과로 해석할 수 없습니다.</p>
    <p>작은 예산의 54개 조건에서는 모든 모델이 긴 계획 지평 때문에 경로를 거부한 시점이 있었습니다. 실제 예비 자원 위반과 귀환 실패는 0건입니다. 실제 귀환 신뢰도를 검증한 결과는 아닙니다.</p>
  </div></section>;
}
