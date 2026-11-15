"""One-off checked edits for the existing compact JSX. Does not change frozen engines."""
from pathlib import Path
def change(path, edits):
    p=Path(path);s=p.read_text(encoding='utf8')
    for before,after in edits:
        assert s.count(before)==1,(path,before,s.count(before))
        s=s.replace(before,after)
    p.write_text(s,encoding='utf8',newline='\n')
change('src/VortexResults.tsx',[
    ('return <section className="hz-evidence">','return <><CriticalVortexResults/><section className="hz-evidence">'),
    ('</div></section>;','</div></section></>;')])
change('src/HazardNavigator.tsx',[
    ('key={String(v8)} v8={v8}',"key={String(v8)} v8={v8} v9={new URLSearchParams(location.search).get('lab')==='v9'}")])
change('src/EncounterLab.tsx',[
    ('type LabCase=EncounterCase&Partial<AbruptCase>;',"type LabCase=EncounterCase&Partial<AbruptCase>;\ntype LabArm=EncounterArm|ArmV8|'SIPP Nominal'|'SIPP Uncertainty'|'SIPP Oracle';"),
    ('v8:boolean;wind:WindDays;predictor:string','v8:boolean;v9:boolean;selection:any;wind:WindDays;predictor:string'),
    ('v8=false,onPrevious}', 'v8=false,v9=false,onPrevious}'),
    ('v8?:boolean;onPrevious?', 'v8?:boolean;v9?:boolean;onPrevious?'),
    ("read(v8?'/data/hazards/vortex-v8/protocol-confirmation.json'", "read(v9?'/data/hazards/vortex-v9/protocol.json':v8?'/data/hazards/vortex-v8/protocol-confirmation.json'"),
    ("read(v8?'/data/hazards/vortex-v8/policy-selection.json'", "read(v9?'/data/hazards/vortex-v9/selection.json':v8?'/data/hazards/vortex-v8/policy-selection.json'"),
    ('setBundle({protocol,manifest,grid,', "setBundle({protocol:v9?{...protocol,cases:protocol.cases.filter((c:LabCase)=>c.split==='holdout')}:protocol,manifest,grid,"),
    ('v8,wind:wind.days', 'v8,v9,selection,wind:wind.days'),
    ('},[v8]);','},[v8,v9]);'),
    ("{v8?'갑작스러운 회오리, 다음 행동을 다시 계산.'", "{v9?'SIPP 연구 비교 · 기본 모델 승격 보류':v8?'갑작스러운 회오리, 다음 행동을 다시 계산.'"),
    ("useState<EncounterArm|ArmV8>(b.v8?'MARS SHIFT':'Adaptive')", "useState<LabArm>(b.v9?'SIPP Nominal':b.v8?'MARS SHIFT':'Adaptive')"),
    ('wind:b.wind,predictor:b.predictor}', 'wind:b.wind,predictor:b.predictor,v9:b.v9,selection:b.selection}'),
    ('b.alpha,b.trackerWindow,restart]', 'b.alpha,b.trackerWindow,b.wind,b.predictor,b.v9,b.selection,restart]'),
    ('<option value="navcam">고화질 Navcam · 제한 범위</option>', '<option value="navcam" disabled={b.v9}>고화질 Navcam · v8에서 이용</option>'),
    ('<option value="oscillate">불규칙 좌우 변화 · 합성</option>', '{b.v9?<option value="meander">상관 이동 변화 · 합성</option>:<option value="oscillate">불규칙 좌우 변화 · 합성</option>}'),
    ('as EncounterArm|ArmV8)', 'as LabArm)'),
    ('<option value="Static">Static · 정적 경로</option>', '<option value="Static">Static · 정적 경로</option>{b.v9&&<><option value="SIPP Nominal">SIPP 기준선 · 실험</option><option value="SIPP Uncertainty">SIPP 불확실성 후보 · 승격 미달</option><option value="SIPP Oracle">SIPP 완전정보 · 연구용</option></>}'),
    ('<p className="hz-note">보행 속도는', '<p className="hz-note">{b.v9&&"새 합성 사건 검증 모드입니다. SIPP 후보는 기본 모델보다 개선되지 않아 연구용으로만 비교합니다. "}보행 속도는')])
change('src/abrupt-worker.ts',[
    ("import {encounterGraph,advanceEncounter}", "import {makeEncounterV9,planSippV9} from './encounter-v9';\nimport {encounterGraph,advanceEncounter}"),
    ("arm:ArmV8='MARS SHIFT'", "arm:ArmV8|'SIPP Nominal'|'SIPP Uncertainty'|'SIPP Oracle'='MARS SHIFT'"),
    ('s=makeAbrupt(encounterGraph', 's=data.v9?makeEncounterV9(encounterGraph(t,data.case.speed),data.case,data.source,data.wind):makeAbrupt(encounterGraph'),
    ("s.predictor=data.predictor??'CV_SMOOTH';", "s.predictor=data.v9&&arm.startsWith('SIPP')?(arm==='SIPP Uncertainty'?data.selection.candidate.predictor:data.selection.nominal.predictor):data.predictor??'CV_SMOOTH';"),
    ("decision=planAbrupt(s,arm);", "decision=arm==='SIPP Nominal'?planSippV9(s,0):arm==='SIPP Uncertainty'?planSippV9(s,.5):arm==='SIPP Oracle'?planSippV9(s,0,true):planAbrupt(s,arm);"),
    ("abruptPrediction(s,arm==='Oracle')", "abruptPrediction(s,arm==='Oracle'||arm==='SIPP Oracle')")])
