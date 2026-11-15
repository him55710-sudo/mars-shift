import {blocked,DEFAULTS,nearestAllowed,point} from './planner';
import type {Exclusion,Mode,Point,Route,Settings,Terrain} from './planner';
import {constrainedPlan} from './constrained-planner';
import type {SearchReport} from './constrained-planner';
import {parseAnnotations,withObstacles} from './obstacles';
import type {ObstacleAnnotation} from './obstacles';
export type MissionDraft={base:Point;target:Point;targetName:string;purpose:string;settings:Settings;mode:Mode;exclusion:Exclusion|null;annotations:ObstacleAnnotation[]};
export type MissionSnapshot={draft:MissionDraft;calculated:MissionDraft;reports:Record<Mode,SearchReport>;sandBaseline?:Route|null;revision:number;previous:Route|null;invalidated:number[];pendingAdoption:boolean;computing?:boolean;calculationError?:string;calculationMs?:number};
export type MissionHistory=Pick<MissionSnapshot,'revision'|'previous'|'invalidated'|'pendingAdoption'>;
export const missionKey=(t:Terrain)=>`mars-shift:unified-mission:v2:${t.bounds.join(':')}`;
export const missionSignature=(draft:MissionDraft)=>JSON.stringify({...draft,mode:undefined});
export const missionDirty=(s:MissionSnapshot)=>!!s.computing||!!s.calculationError||s.revision<0||missionSignature(s.draft)!==missionSignature(s.calculated);
export function emptyMission(draft:MissionDraft):MissionSnapshot{
 const blank=():SearchReport=>({route:null,candidates:[],searched:0,feasibleCount:0,travelLimit:0,method:'Not calculated',reason:'Waiting for route calculation.'});
 const reports=Object.fromEntries((['shortest','exposure','mission','time','energy'] as const).map(mode=>[mode,blank()])) as Record<Mode,SearchReport>;
 return {draft,calculated:structuredClone(draft),reports,revision:-1,previous:null,invalidated:[],pendingAdoption:false};
}
export function defaultMission(t:Terrain):MissionDraft{const settings={...DEFAULTS,avoidSand:true,mobilityModel:t.science?2 as const:1 as const,terrainEffort:.3};return {base:nearestAllowed(t,{x:32,y:168},settings),target:nearestAllowed(t,{x:153,y:43},settings),targetName:'Surface texture transect',purpose:'Inspect surface texture and compare local terrain.',settings,mode:'mission',exclusion:null,annotations:[]};}
export function calculateMission(t:Terrain,draft:MissionDraft,previous?:MissionHistory):MissionSnapshot{
 const prepared=withObstacles(t,draft.annotations),reports=Object.fromEntries((['shortest','exposure','mission','time','energy'] as const).map(mode=>[mode,constrainedPlan(prepared,draft.base,draft.target,mode,draft.settings,draft.exclusion)])) as Record<Mode,SearchReport>;
 const sandBaseline=draft.settings.avoidSand?constrainedPlan(prepared,draft.base,draft.target,'shortest',{...draft.settings,avoidSand:false},draft.exclusion).route:null;
 return {draft,calculated:structuredClone(draft),reports,sandBaseline,revision:(previous?.revision??-1)+1,previous:previous?.previous??null,invalidated:previous?.invalidated??[],pendingAdoption:previous?.pendingAdoption??false};
}
export function validDraft(t:Terrain,value:unknown):MissionDraft{
 const d=value as MissionDraft,validPoint=(p:Point)=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<t.width&&p.y<t.height;
 if(!d||!validPoint(d.base)||!validPoint(d.target)||!['shortest','exposure','mission','time','energy'].includes(d.mode)||!d.settings||Object.keys(DEFAULTS).some(k=>k==='dust'?typeof d.settings.dust!=='boolean':!Number.isFinite(d.settings[k as keyof Settings]))||d.settings.maxSlope<0||d.settings.maxSlope>90||d.settings.speed<=0||d.settings.reservePercent<0||d.settings.reservePercent>100||d.settings.durationMinutes<0||d.settings.scienceMinutes<0||d.settings.oxygenMinutes<=0||d.settings.powerMinutes<=0||d.settings.loadKg<0||d.settings.hazardWeight<0||typeof d.targetName!=='string'||typeof d.purpose!=='string'||d.exclusion&&(!validPoint(d.exclusion)||!Number.isFinite(d.exclusion.radius)||d.exclusion.radius<1||d.exclusion.radius>500))throw Error('Invalid mission snapshot.');
 if(d.settings.mobilityModel!==undefined&&![1,2].includes(d.settings.mobilityModel)||d.settings.terrainEffort!==undefined&&(!Number.isFinite(d.settings.terrainEffort)||d.settings.terrainEffort<0||d.settings.terrainEffort>3))throw Error('Invalid mobility assumptions.');
 if(d.settings.avoidSand!==undefined&&typeof d.settings.avoidSand!=='boolean')throw Error('Invalid sand screening policy.');
 return {...d,settings:{...d.settings,avoidSand:d.settings.avoidSand??true,mobilityModel:d.settings.mobilityModel??(t.science?2:1),terrainEffort:d.settings.terrainEffort??.3},annotations:parseAnnotations(d.annotations??[],t)};
}
export function freezeMissionHazard(t:Terrain,s:MissionSnapshot):MissionSnapshot{
 const old=s.reports[s.draft.mode].route;if(!old)return s;const p=point(t,old.outbound[Math.floor(old.outbound.length*.55)]),exclusion={...p,radius:35},draft={...s.draft,exclusion},prepared=withObstacles(t,draft.annotations);
 return {...s,draft,previous:old,invalidated:old.cells.filter(i=>blocked(prepared,i,draft.settings,exclusion)),pendingAdoption:true};
}
export function injectMissionHazard(t:Terrain,s:MissionSnapshot):MissionSnapshot{const frozen=freezeMissionHazard(t,s);return frozen===s?s:calculateMission(t,frozen.draft,frozen);}
