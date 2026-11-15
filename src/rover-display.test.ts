import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {roverVisualManifest,roverSandGuidance} from './rover-display';
import {gridPoint,worldPoint,roverTerrain,roverRoutes,moveOnRover} from './rover-navigation';
import type {RoverGrid,RoverObstacle} from './rover-navigation';
import {roverHazardPixels} from './rover-hazard-raster';

const manifest=JSON.parse(readFileSync('public/data/drive1004/manifest.json','utf8'));
const actual=JSON.parse(readFileSync('public/data/drive1004/navigation-grid.json','utf8')) as RoverGrid;
const flat=():RoverGrid=>({width:40,height:40,cellSize:.25,origin:[10,20],elevation:Array(1600).fill(0),slope:Array(1600).fill(0),start:{x:12,z:25},target:{x:18,z:25}});

describe('Original photo display with local sand exclusions',()=>{
 it('defaults to all original calibrated meshes with unchanged transforms and textures',()=>{
  const photo=roverVisualManifest(manifest);
  expect(photo.assets).toBe(manifest.calibratedAssets);
  expect(photo.assets).toHaveLength(66);
  expect(photo.assets.reduce((n:number,a:{triangles:number})=>n+a.triangles,0)).toBe(1045833);
  expect(photo.assets.filter((a:{url:string})=>a.url.includes('/calibrated-'))).toHaveLength(61);
  expect(photo.assets.every((a:object,i:number)=>a===manifest.calibratedAssets[i])).toBe(true);
  expect(roverVisualManifest(manifest,false)).toBe(manifest);
  expect(manifest.frame.registrationToOrbitalMission).toBeNull();
 });
 it('uses source detail only when calibrated images are absent, never an empty list',()=>{
  const assets=[{url:'efficient'}],detailAssets=[{url:'source-detail'}];
  expect(roverVisualManifest({assets,detailAssets,calibratedAssets:[]}).assets).toBe(detailAssets);
  expect(roverVisualManifest({assets,detailAssets:[],calibratedAssets:[]}).assets).toBe(assets);
 });
 it('reports local distance to the crew buffer and heading-relative side in metres',()=>{
  const g=flat(),crew=gridPoint(g,12,25),sand:RoverObstacle={id:'local',x:14,z:25,radius:.5,kind:'reviewed',material:'sand'};
  const report=roverSandGuidance(g,null,crew,0,[sand,{...sand,id:'ordinary',material:undefined}]);
  expect(report.nearest?.metres).toBeCloseTo(1.15);
  expect(report.nearest?.side).toBe('ahead');
  expect(roverSandGuidance(g,null,crew,90,[sand]).nearest?.side).toBe('left');
  expect(report).toMatchObject({crossings:null,reviewed:1,simulated:0});
 });
 it('detours both legs around the same reviewed area that blocks walking',()=>{
  const g=flat(),start=gridPoint(g,12.125,25.125),target=gridPoint(g,18.125,25.125);
  const sand:RoverObstacle={id:'sand',x:15.125,z:25.125,radius:.5,kind:'reviewed',material:'sand'};
  const original=roverRoutes(roverTerrain(g,[]),start,target).shortest!;
  const terrain=roverTerrain(g,[sand]),route=roverRoutes(terrain,start,target).shortest!;
  expect(roverSandGuidance(g,original,start,0,[sand]).crossings).toBeGreaterThan(0);
  expect(route.distance).toBeGreaterThan(original.distance);
  expect(roverSandGuidance(g,route,start,0,[sand]).crossings).toBe(0);
  for(const cells of [route.outbound,route.inbound])expect(cells.every(i=>!terrain.obstacleMask?.[i])).toBe(true);
  expect(moveOnRover(terrain,start,6,0).distance).toBeLessThan(2.2);
  const pixels=roverHazardPixels(g,terrain,[sand]),p=gridPoint(g,sand.x,sand.z),i=Math.round(p.y)*g.width+Math.round(p.x);
  expect(Array.from(pixels.slice(i*4,i*4+4))).toEqual([255,166,61,255]);
 });
 it('keeps actual Drive1004 routing truthful after the explicit sand rehearsal',()=>{
  const start=gridPoint(actual,actual.start.x,actual.start.z),target=gridPoint(actual,actual.target.x,actual.target.z);
  const original=roverRoutes(roverTerrain(actual,[]),start,target).exposure!;
  const i=original.outbound[Math.floor(original.outbound.length*.3)],w=worldPoint(actual,{x:i%actual.width,y:Math.floor(i/actual.width)});
  const sand:RoverObstacle={id:'rehearsal',...w,radius:.45,kind:'simulated',material:'sand'};
  const terrain=roverTerrain(actual,[sand]),route=roverRoutes(terrain,start,target).exposure??null;
  expect(roverSandGuidance(actual,original,start,0,[sand]).crossings).toBeGreaterThan(0);
  expect(route?.feasible).toBe(true);
  expect(route!.distance).toBeGreaterThan(original.distance);
  expect(roverSandGuidance(actual,route,start,0,[sand])).toMatchObject({crossings:route?0:null,reviewed:0,simulated:1});
  if(route)for(const i of route.cells)expect(terrain.obstacleMask?.[i]).toBe(0);
  console.log('Native local sand rehearsal', {originalMetres:original.distance,replacementMetres:route?.distance??null,crossings:route?0:null});
 });
});
