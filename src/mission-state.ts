import {blocked,DEFAULTS,nearestAllowed,point} from './planner';
import type {Exclusion,Mode,Point,Route,Settings,Terrain} from './planner';
import {constrainedPlan} from './constrained-planner';
import type {SearchReport} from './constrained-planner';
import {parseAnnotations,withObstacles} from './obstacles';
import type {ObstacleAnnotation} from './obstacles';
export type MissionDraft={base:Point;target:Point;targetName:string;purpose:string;settings:Settings;mode:Mode;exclusion:Exclusion|null;annotations:ObstacleAnnotation[]};
export type MissionSnapshot={draft:MissionDraft;calculated:MissionDraft;reports:Record<Mode,SearchReport>;revision:number;previous:Route|null;invalidated:number[];pendingAdoption:boolean};
export const missionKey=(t:Terrain)=>`mars-shift:unified-mission:v2:${t.bounds.join(':')}`;
export const missionSignature=(draft:MissionDraft)=>JSON.stringify({...draft,mode:undefined});
export const missionDirty=(s:MissionSnapshot)=>missionSignature(s.draft)!==missionSignature(s.calculated);
export function defaultMission(t:Terrain):MissionDraft{return {base:nearestAllowed(t,{x:32,y:168},DEFAULTS),target:nearestAllowed(t,{x:153,y:43},DEFAULTS),targetName:'Surface texture transect',purpose:'Inspect surface texture and compare local terrain.',settings:{...DEFAULTS,mobilityModel:t.science?2:1,terrainEffort:.3},mode:'mission',exclusion:null,annotations:[]};}
export function calculateMission(t:Terrain,draft:MissionDraft,previous?:MissionSnapshot):MissionSnapshot{
 const prepared=withObstacles(t,draft.annotations),reports=Object.fromEntries((['shortest','exposure','mission','time'] as const).map(mode=>[mode,constrainedPlan(prepared,draft.base,draft.target,mode,draft.settings,draft.exclusion)])) as Record<Mode,SearchReport>;
 return {draft,calculated:structuredClone(draft),reports,revision:(previous?.revision??-1)+1,previous:previous?.previous??null,invalidated:previous?.invalidated??[],pendingAdoption:previous?.pendingAdoption??false};
}
export function validDraft(t:Terrain,value:unknown):MissionDraft{
 const d=value as MissionDraft,validPoint=(p:Point)=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<t.width&&p.y<t.height;
 if(!d||!validPoint(d.base)||!validPoint(d.target)||!['shortest','exposure','mission','time'].includes(d.mode)||!d.settings||Object.keys(DEFAULTS).some(k=>k==='dust'?typeof d.settings.dust!=='boolean':!Number.isFinite(d.settings[k as keyof Settings]))||d.settings.maxSlope<0||d.settings.maxSlope>90||d.settings.speed<=0||d.settings.reservePercent<0||d.settings.reservePercent>100||d.settings.durationMinutes<0||d.settings.scienceMinutes<0||d.settings.oxygenMinutes<=0||d.settings.powerMinutes<=0||d.settings.loadKg<0||d.settings.hazardWeight<0||typeof d.targetName!=='string'||typeof d.purpose!=='string'||d.exclusion&&(!validPoint(d.exclusion)||!Number.isFinite(d.exclusion.radius)||d.exclusion.radius<1||d.exclusion.radius>500))throw Error('Invalid mission snapshot.');
 if(d.settings.mobilityModel!==undefined&&![1,2].includes(d.settings.mobilityModel)||d.settings.terrainEffort!==undefined&&(!Number.isFinite(d.settings.terrainEffort)||d.settings.terrainEffort<0||d.settings.terrainEffort>3))throw Error('Invalid mobility assumptions.');
 return {...d,settings:{...d.settings,mobilityModel:d.settings.mobilityModel??(t.science?2:1),terrainEffort:d.settings.terrainEffort??.3},annotations:parseAnnotations(d.annotations??[],t)};
}
export function injectMissionHazard(t:Terrain,s:MissionSnapshot):MissionSnapshot{
 const old=s.reports[s.draft.mode].route;if(!old)return s;const p=point(t,old.outbound[Math.floor(old.outbound.length*.55)]),exclusion={...p,radius:35},draft={...s.draft,exclusion},prepared=withObstacles(t,draft.annotations);
 const frozen={...s,draft,previous:old,invalidated:old.cells.filter(i=>blocked(prepared,i,draft.settings,exclusion)),pendingAdoption:true};return calculateMission(t,draft,frozen);
}
