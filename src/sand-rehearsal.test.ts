import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {roverTerrain,gridPoint,moveOnRover} from './rover-navigation';
import {explorationGrid,observedCoverage} from './rover-entry';
import {planTraining,trainingObstacles,SAND_SETTINGS,routeTrainingAudit} from './sand-rehearsal';
import type {RoverTerrain} from './rover-navigation';
const source=JSON.parse(readFileSync('public/data/drive1004/navigation-grid.json','utf8')),g=explorationGrid(source),crew=gridPoint(g,g.start.x,g.start.z),target=gridPoint(g,g.target.x,g.target.z);let terrain:RoverTerrain;
beforeAll(()=>{terrain=roverTerrain(g,[]);});
describe('sand escape on actual NASA mesh support',()=>{
 it('starts with complete measured height coverage in a 3 m neighbourhood',()=>{expect(observedCoverage(g,g.start.x,g.start.z).fraction).toBe(1);expect(g.elevation).toBe(source.elevation);});
 it('reroutes both legs without entering the continuous buffered footprint',()=>{const obstacles=trainingObstacles(g,'detour',crew),r=planTraining(terrain,g,crew,target,obstacles);expect(r.route).not.toBeNull();expect(r.baselineAudit!.exposureMetres).toBeGreaterThan(5);expect(r.audit!.exposureMetres).toBe(0);expect(r.audit!.minClearance).toBeGreaterThan(0);expect(r.route!.distance).toBeGreaterThan(r.baseline!.distance);const errors=[];for(const leg of [r.route!.outbound,r.route!.inbound])for(let k=1;k<leg.length;k++){const a={x:leg[k-1]%g.width,y:Math.floor(leg[k-1]/g.width)},b={x:leg[k]%g.width,y:Math.floor(leg[k]/g.width)};const m=moveOnRover(r.terrain,a,(b.x-a.x)*g.cellSize,(b.y-a.y)*g.cellSize,SAND_SETTINGS);if(m.reason)errors.push(m.reason);}expect(errors).toEqual([]);});
 it('holds when surrounded or when the budget cannot cover the return',()=>{expect(planTraining(terrain,g,crew,target,trainingObstacles(g,'surrounded',crew)).route).toBeNull();expect(planTraining(terrain,g,crew,target,[],1).route).toBeNull();});
 it('preserves the original base when returning from the checkpoint and never mutates source support',()=>{const original=Array.from(terrain.obstacleMask!),o=trainingObstacles(g,'detour',crew),out=planTraining(terrain,g,crew,target,o),back=planTraining(terrain,g,target,crew,o);expect(back.route).not.toBeNull();expect(back.route!.outbound.at(-1)).toBe(crew.y*g.width+crew.x);expect(routeTrainingAudit(g,back.route,o)!.exposureMetres).toBe(0);expect(out.route!.inbound.at(-1)).toBe(crew.y*g.width+crew.x);expect(Array.from(terrain.obstacleMask!)).toEqual(original);});
 it('keeps strict sand exclusions for all route objectives',()=>{const o=trainingObstacles(g,'detour',crew);for(const mode of ['shortest','exposure','time'] as const){const r=planTraining(terrain,g,crew,target,o,180,mode);expect(r.route).not.toBeNull();expect(r.audit?.exposureMetres).toBe(0);}});
});
