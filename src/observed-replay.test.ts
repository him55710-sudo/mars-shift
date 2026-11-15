import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {imagePrediction,recordedAt,scoreRecordedMovies} from './observed-replay';
import type {Recordings} from './observed-replay';
import {relocatedVortex,conditionalAt,planObservedEscape,recordedReturnMap} from './observed-escape';
import {roverTerrain,ROVER_SETTINGS,worldPoint,gridPoint,moveOnRover} from './rover-navigation';
import type {RoverGrid} from './rover-navigation';
import {observedSession,observedSnapshot,advanceObserved} from './observed-session';
import {measureEscapePath} from './escape-metrics';
const record=JSON.parse(readFileSync('public/data/hazards/observed-v6/recordings.json','utf8')) as Recordings;
const grid=JSON.parse(readFileSync('public/data/drive1004/navigation-grid.json','utf8')) as RoverGrid;
const flat: RoverGrid={width:24,height:24,cellSize:.25,origin:[-3,-3],elevation:Array(576).fill(0),slope:Array(576).fill(0),start:{x:0,z:0},target:{x:1,z:1}};
describe('Recorded observations retain provenance and timing',()=>{
 it('retains actual pressure and wind clocks, invalid rows and real gaps',()=>{
  expect(record.events.map(e=>e.id)).toEqual(['57a','57b','215']);
  const a=record.events[0],b=record.events[2];expect(a.pressure).toHaveLength(181);expect(a.wind).toHaveLength(361);expect(b.quality.wind.maxGapSeconds).toBe(8);expect(b.fit.diameterSigma).toBeNull();
  const i=b.wind.findIndex((p,i)=>i>0&&p.time-b.wind[i-1].time===8),t=b.wind[i-1].time+4;expect(recordedAt(b.wind,t,1.1)).toBeNull();
  expect(recordedAt(a.pressure,-91,1)).toBeNull();expect(recordedAt(a.pressure,-89.5,1)?.time).toBe(-90);
  expect(Math.min(...a.pressure.map(p=>p.pressurePa))).toBeCloseTo(742.27,2);
 });
 it('checks every extracted frame hash and never expands native cadence into fake fixes',()=>{
  const source=JSON.parse(readFileSync('public/data/hazards/observed-v6/recordings.json','utf8'));
  for(const m of source.movies){expect(m.points).toHaveLength(21);for(const p of m.points){const file='public'+p.image;expect(existsSync(file)).toBe(true);expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(p.imageSha256);}}
  const m=record.movies[0];expect(recordedAt(m.points,11,4)?.frame).toBe(2);expect(m.cadenceSeconds).toBe(4);
 });
 it('forecasts causally in pixels and rejects stale observations',()=>{
  const m=record.movies[0],a=imagePrediction(m,20)!;
  const changed={...m,points:m.points.map(p=>p.time>20?{...p,x:p.x+10000,width:900}:p)};
  expect(imagePrediction(changed,20)).toEqual(a);expect(a.coordinateType).toBe('IMAGE_CROSSRANGE_PIXELS');expect(imagePrediction(m,0)).toBeNull();expect(imagePrediction(m,100)).toBeNull();
  expect(scoreRecordedMovies(record.movies).every(r=>r.n===18&&Number.isFinite(r.rmse))).toBe(true);
 });
});
describe('Observation-constrained local escape',()=>{
 it('defines warning at the nominal disk front with a fixed one-metre margin',()=>{
  const v=relocatedVortex(record.events[0].fit,{x:10,y:11},.25,.37,18),p={x:2.5,y:2.75},c=conditionalAt(v,18);
  expect(Math.hypot(c.x-p.x,c.y-p.y)-c.radius).toBeCloseTo(0,9);
  const m=measureEscapePath([{x:10,y:11,time:0},{x:10,y:11,time:30}],t=>conditionalAt(v,t),.25,0,30);
  expect(m.intervals[0][0]).toBeCloseTo(18,8);expect(()=>relocatedVortex(record.events[2].fit,{x:0,y:0},1,0)).toThrow('uncertainty');
 });
 it('preserves local north/east coordinates and actual route corners through XR',()=>{
  const s=observedSession(grid,record.events[0],.37),snapshot=observedSnapshot(s);
  expect(snapshot.frame.coordinates).toBe('GRID_NORTH_EAST_METRES');expect(snapshot.frame.evidence?.position).toBe('NOT_OBSERVED');expect(snapshot.frame.crs).toContain('LOCAL:');
  for(const p of snapshot.frame.route){const q={x:p.x/grid.cellSize,y:p.y/grid.cellSize},w=worldPoint(grid,q);expect(gridPoint(grid,w.x,w.z).x).toBeCloseTo(q.x);}
  for(const c of snapshot.decision.candidates)for(let i=1;i<c.path.length;i++){const a=c.path[i-1],b=c.path[i];expect(moveOnRover(s.terrain,a,(b.x-a.x)*grid.cellSize,(b.y-a.y)*grid.cellSize,s.settings).reason).toBe('');}
  const before={...s.position};advanceObserved(s,snapshot.decision);expect(s.time).toBe(2);expect(s.position.x).toBeCloseTo(before.x);expect(s.position.y).toBeCloseTo(before.y);
 },30000);
 it('uses identical hard return limits for every model and fails explicitly',()=>{
  const t=roverTerrain(flat,[]),base={x:12,y:12},target={x:16,y:16},v=relocatedVortex(record.events[0].fit,base,.25,0),returns=recordedReturnMap(t,base,ROVER_SETTINGS),r={oxygenSeconds:1,batterySeconds:1,missionSeconds:1,reserveFraction:.2,oxygenReserveSeconds:.2,batteryReserveSeconds:.2};
  for(const model of ['Baseline','Dynamic','MARS SHIFT'] as const){const p=planObservedEscape(t,ROVER_SETTINGS,base,base,target,0,r,v,model,returns);expect(p.chosen).toBeNull();expect(p.reason).toContain('return budget');}
 });
});
